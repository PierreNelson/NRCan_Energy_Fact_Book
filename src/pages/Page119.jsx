import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const BAR_COLORS = ['#59A63A', '#437D2C', '#396624', '#2c6a38'];
const LINE_COLOR = '#26374A';

const PAGE119_EXPORT_PAIRS = [
    [201403, 48], [201406, 56], [201409, 64], [201412, 72],
    [201503, 52], [201506, 38], [201509, 34], [201512, 31],
    [201603, 36], [201606, 44], [201609, 50], [201612, 58],
    [201703, 70], [201706, 85], [201709, 98], [201712, 108],
    [201803, 118], [201806, 142], [201809, 168], [201812, 188],
    [201903, 195], [201906, 210], [201909, 225], [201912, 238],
    [202003, 392], [202006, 118], [202009, 92], [202012, 86],
    [202103, 98], [202106, 108], [202109, 102], [202112, 95],
    [202203, 92], [202206, 98], [202209, 104], [202212, 100],
    [202303, 105], [202306, 110], [202309, 114], [202312, 118],
    [202403, 118], [202406, 120], [202409, 116], [202412, 114],
    [202503, 112], [202506, 108]
];

const PAGE119_DOMESTIC_PAIRS = [
    [2014, 95], [2015, 93], [2016, 91], [2017, 92], [2018, 94], [2019, 93],
    [2020, 95], [2021, 96], [2022, 97], [2023, 96], [2024, 98], [2025, 99]
];

const PAGE119_DOMESTIC_BY_YEAR = PAGE119_DOMESTIC_PAIRS.reduce((acc, [y, v]) => {
    acc[y] = v;
    return acc;
}, {});

const PAGE119_QUARTERS = PAGE119_EXPORT_PAIRS.map(([mm, exportVal], idx) => {
    const y = Math.floor(mm / 100);
    const mo = mm % 100;
    const q = mo === 3 ? 1 : mo === 6 ? 2 : mo === 9 ? 3 : 4;
    return {
        idx,
        refDate: mm,
        year: y,
        quarter: q,
        exportVal,
        domesticAnnual: PAGE119_DOMESTIC_BY_YEAR[y] ?? null
    };
});

const Page119 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const quarters = PAGE119_QUARTERS;
    const domesticByYear = PAGE119_DOMESTIC_BY_YEAR;
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [viewportZoom, setViewportZoom] = useState(() => {
        if (typeof window === 'undefined') {
            return { pinScale: 1, layoutRatio: 1, cssZoomFactor: 1, dprZoomFactor: 1, screenZoomHint: 1 };
        }
        const inner = window.innerWidth;
        const outer = window.outerWidth;
        const vv = window.visualViewport;
        let pinScale = 1;
        let layoutRatio = 1;
        if (vv) {
            pinScale = vv.scale || 1;
            const w = vv.width || inner;
            layoutRatio = w > 0 ? inner / w : 1;
        }
        const sw = window.screen?.availWidth ?? window.screen?.width ?? 0;
        let screenZoomHint = 1;
        if (sw > 0 && outer >= sw - 24 && inner > 0) {
            const ratio = sw / inner;
            if (ratio >= 1.75) screenZoomHint = Math.min(ratio, 10);
        }
        return { pinScale, layoutRatio, cssZoomFactor: 1, dprZoomFactor: 1, screenZoomHint };
    });
    const [isTableOpen, setIsTableOpen] = useState(false);
    /** null = no focus; bars = per-quarter selection; line = whole domestic trace on/off. */
    const [chartFocus, setChartFocus] = useState(null);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
    /** When outerWidth is stable, innerWidth shrink/grow tracks Ctrl+ page zoom (Chromium keeps visualViewport.scale≈1). */
    const zoomBaselineRef = useRef(null);
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);

    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    const formatNumber = (num) => {
        if (num === undefined || num === null || Number.isNaN(num)) return '\u2014';
        return Math.round(num).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');
    };

    const exportLabel = getText('page119_legend_exports', lang);
    const domesticLabel = getText('page119_legend_domestic', lang);
    const chartTitlePlain = stripHtml(getText('page119_chart_title', lang));

    const yearSpanLabel = `${PAGE119_QUARTERS[0].year}-${PAGE119_QUARTERS[PAGE119_QUARTERS.length - 1].year}`;
    const downloadFileStem =
        lang === 'en' ? `oil_by_rail_volume_${yearSpanLabel}` : `volume_petrole_voie_ferree_${yearSpanLabel}`;

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const syncZoom = () => {
            const inner = window.innerWidth;
            const outer = window.outerWidth;

            const dpr = window.devicePixelRatio || 1;
            if (zoomBaselineRef.current == null) {
                zoomBaselineRef.current = { outer, inner, dpr };
            } else {
                const b0 = zoomBaselineRef.current;
                if (Math.abs(outer - b0.outer) > 64) {
                    zoomBaselineRef.current = { outer, inner, dpr };
                }
            }
            const b = zoomBaselineRef.current;

            const outerStable = b && Math.abs(outer - b.outer) <= 64;

            let cssZoomFactor = 1;
            if (b && inner > 0 && b.inner > 0 && outerStable) {
                cssZoomFactor = Math.max(b.inner / inner, inner / b.inner);
            }

            let dprZoomFactor = 1;
            if (b && b.dpr > 0 && outerStable) {
                dprZoomFactor = Math.max(b.dpr / dpr, dpr / b.dpr);
            }

            const sw = window.screen?.availWidth ?? window.screen?.width ?? 0;
            let screenZoomHint = 1;
            if (sw > 0 && outer >= sw - 24 && inner > 0) {
                const ratio = sw / inner;
                if (ratio >= 1.75) screenZoomHint = Math.min(ratio, 10);
            }

            const vv = window.visualViewport;
            let pinScale = 1;
            let layoutRatio = 1;
            if (vv) {
                pinScale = vv.scale || 1;
                const w = vv.width || inner;
                layoutRatio = w > 0 ? inner / w : 1;
            }

            setViewportZoom({ pinScale, layoutRatio, cssZoomFactor, dprZoomFactor, screenZoomHint });
        };

        const rafId = requestAnimationFrame(() => {
            syncZoom();
        });
        const vv = typeof window !== 'undefined' ? window.visualViewport : null;
        if (vv) {
            vv.addEventListener('resize', syncZoom);
            vv.addEventListener('scroll', syncZoom);
        }
        window.addEventListener('resize', syncZoom);
        return () => {
            cancelAnimationFrame(rafId);
            if (vv) {
                vv.removeEventListener('resize', syncZoom);
                vv.removeEventListener('scroll', syncZoom);
            }
            window.removeEventListener('resize', syncZoom);
        };
    }, []);

    useEffect(() => {
        if (!chartRef.current) return;
        const setupChartAccessibility = () => {
            const plotContainer = chartRef.current;
            if (!plotContainer) return;
            plotContainer.querySelectorAll('.main-svg, .svg-container svg').forEach((svg) => {
                svg.setAttribute('aria-hidden', 'true');
            });
            plotContainer.querySelectorAll('.modebar-btn').forEach((btn) => {
                const dataTitle = btn.getAttribute('data-title');
                if (dataTitle && (dataTitle.includes('Download') || /charger/i.test(dataTitle))) {
                    btn.setAttribute('aria-label', dataTitle);
                    btn.setAttribute('role', 'button');
                    btn.setAttribute('tabindex', '0');
                    btn.removeAttribute('aria-hidden');
                } else {
                    btn.setAttribute('aria-hidden', 'true');
                    btn.setAttribute('tabindex', '-1');
                }
            });
        };
        const timer = setTimeout(setupChartAccessibility, 500);
        const observer = new MutationObserver(setupChartAccessibility);
        observer.observe(chartRef.current, { childList: true, subtree: true });
        return () => {
            clearTimeout(timer);
            observer.disconnect();
        };
    }, [quarters, lang, chartFocus]);

    useEffect(() => {
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;
        if (!topScroll || !tableScroll) return;
        let isSyncingTop = false;
        let isSyncingTable = false;
        const syncTopToTable = () => {
            if (isSyncingTable) return;
            isSyncingTop = true;
            tableScroll.scrollLeft = topScroll.scrollLeft;
            requestAnimationFrame(() => {
                isSyncingTop = false;
            });
        };
        const syncTableToTop = () => {
            if (isSyncingTop) return;
            isSyncingTable = true;
            topScroll.scrollLeft = tableScroll.scrollLeft;
            requestAnimationFrame(() => {
                isSyncingTable = false;
            });
        };
        const updateTopScrollWidth = () => {
            const table = tableScroll.querySelector('table');
            if (table && topScroll.firstChild) {
                topScroll.firstChild.style.width = `${table.scrollWidth}px`;
            }
        };
        topScroll.addEventListener('scroll', syncTopToTable);
        tableScroll.addEventListener('scroll', syncTableToTop);
        updateTopScrollWidth();
        const resizeObserver = new ResizeObserver(updateTopScrollWidth);
        const table = tableScroll.querySelector('table');
        if (table) resizeObserver.observe(table);
        return () => {
            topScroll.removeEventListener('scroll', syncTopToTable);
            tableScroll.removeEventListener('scroll', syncTableToTop);
            resizeObserver.disconnect();
        };
    }, [isTableOpen, quarters]);

    const zebraShapes = useMemo(() => {
        if (!quarters.length) return [];
        const byYear = {};
        quarters.forEach((q) => {
            if (!byYear[q.year]) byYear[q.year] = [];
            byYear[q.year].push(q.idx);
        });
        const shapes = [];
        Object.keys(byYear).forEach((ys) => {
            const year = Number(ys);
            if (year % 2 !== 0) return;
            const idxs = byYear[year];
            const x0 = Math.min(...idxs) - 0.5;
            const x1 = Math.max(...idxs) + 0.5;
            shapes.push({
                type: 'rect',
                xref: 'x',
                yref: 'paper',
                x0,
                x1,
                y0: 0,
                y1: 1,
                fillcolor: '#8C8C8C',
                line: { width: 0 },
                layer: 'below'
            });
        });
        return shapes;
    }, [quarters]);

    const lineSeries = useMemo(() => {
        const years = [...new Set(quarters.map((q) => q.year))].sort((a, b) => a - b);
        const lx = [];
        const ly = [];
        const lyear = [];
        years.forEach((yr) => {
            const idxs = quarters.filter((q) => q.year === yr).map((q) => q.idx);
            if (!idxs.length || domesticByYear[yr] == null) return;
            lx.push((Math.min(...idxs) + Math.max(...idxs)) / 2);
            ly.push(domesticByYear[yr]);
            lyear.push(String(yr));
        });
        return { lx, ly, lyear };
    }, [quarters, domesticByYear]);

    const yearAxisTickInfo = useMemo(() => {
        const byYear = {};
        quarters.forEach((q) => {
            if (!byYear[q.year]) byYear[q.year] = [];
            byYear[q.year].push(q.idx);
        });
        const yearTickvals = [];
        const yearTicktext = [];
        Object.keys(byYear)
            .map(Number)
            .sort((a, b) => a - b)
            .forEach((yr) => {
                const idxs = byYear[yr];
                yearTickvals.push((Math.min(...idxs) + Math.max(...idxs)) / 2);
                yearTicktext.push(String(yr));
            });
        return { yearTickvals, yearTicktext };
    }, [quarters]);

    const xRange = [-0.5, quarters.length - 0.5];
    // Pinch: visualViewport.scale. Ctrl+ zoom: compare innerWidth while outerWidth stable (see zoomBaselineRef).
    // Near-maximized: screen availWidth / innerWidth ≈ zoom when few CSS px fit across the screen.
    const zoomEffective = Math.max(
        viewportZoom.pinScale,
        viewportZoom.layoutRatio,
        viewportZoom.cssZoomFactor,
        viewportZoom.dprZoomFactor,
        viewportZoom.screenZoomHint
    );
    /** Only true page zoom (Ctrl+/pinch/maximized sw/inner), not layoutRatio/DPR, so Q1–Q4 stay full size at 100%. */
    const pageZoomForQuarterTicks = Math.max(
        viewportZoom.cssZoomFactor,
        viewportZoom.pinScale,
        viewportZoom.screenZoomHint
    );
    const tickFontBaseSize = windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15;
    const tickFont = { size: tickFontBaseSize, family: 'Arial, sans-serif' };
    /** Q1–Q4 labels: unchanged at 100%; smaller only at ~300%+ and ~500%+ page zoom. */
    const quarterXTickFont = {
        size:
            pageZoomForQuarterTicks >= 5
                ? Math.max(6, tickFontBaseSize - 9)
                : pageZoomForQuarterTicks >= 3
                  ? Math.max(9, tickFontBaseSize - 5)
                  : tickFontBaseSize,
        family: 'Arial, sans-serif'
    };
    const useVerticalQuarterTicks = zoomEffective >= 1.9 || windowWidth <= 720;
    const quarterTickAngle = useVerticalQuarterTicks ? 90 : 0;
    const plotBottomMargin = useVerticalQuarterTicks
        ? windowWidth <= 480
            ? 188
            : windowWidth <= 768
              ? 168
              : 152
        : windowWidth <= 480
          ? 120
          : windowWidth <= 768
            ? 108
            : 100;
    const plotTopMargin = windowWidth <= 480 ? 24 : 16;
    const chartHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 440;

    const yearLabelAnnotations = useMemo(() => {
        const vertical = useVerticalQuarterTicks;
        const yshift = vertical ? -48 : -30;
        const fs = windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15;
        return yearAxisTickInfo.yearTickvals.map((xval, i) => ({
            xref: 'x',
            x: xval,
            yref: 'y',
            y: 0,
            xanchor: 'center',
            yanchor: vertical ? 'middle' : 'top',
            yshift,
            textangle: vertical ? 90 : 0,
            text: yearAxisTickInfo.yearTicktext[i],
            showarrow: false,
            cliponaxis: false,
            font: { family: 'Arial Black, Arial, sans-serif', size: fs, color: '#333333' }
        }));
    }, [yearAxisTickInfo, useVerticalQuarterTicks, windowWidth]);

    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        try {
            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 1200,
                height: 640,
                scale: 2
            });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                const titleHeight = 90;
                const legendHeight = 36;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight + legendHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 32px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(
                    `${stripHtml(getText('page119_title', lang))} — ${chartTitlePlain} (${yearSpanLabel})`,
                    canvas.width / 2,
                    42
                );
                ctx.drawImage(img, 0, titleHeight);
                const legendY = titleHeight + img.height + 14;
                ctx.font = '18px Arial';
                ctx.textAlign = 'left';
                ctx.fillStyle = BAR_COLORS[2];
                ctx.fillRect(40, legendY - 14, 22, 14);
                ctx.fillStyle = '#333333';
                ctx.fillText(exportLabel, 70, legendY);
                ctx.strokeStyle = LINE_COLOR;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(240, legendY - 8);
                ctx.lineTo(280, legendY - 8);
                ctx.stroke();
                ctx.fillStyle = LINE_COLOR;
                ctx.fillRect(256, legendY - 12, 8, 8);
                ctx.fillStyle = '#333333';
                ctx.fillText(domesticLabel, 295, legendY);
                canvas.toBlob((blob) => {
                    if (blob) saveAs(blob, `${downloadFileStem}.png`);
                });
            };
            img.src = imgData;
        } catch {
            return;
        }
    };

    const downloadTableAsCSV = () => {
        const pCol = getText('page119_table_col_period', lang);
        const eCol = getText('page119_table_col_exports', lang);
        const dCol = getText('page119_table_col_domestic', lang);
        const headers = [pCol, eCol, dCol];
        const rows = quarters.map((q) => [
            `${q.year} Q${q.quarter}`,
            String(Math.round(q.exportVal)),
            q.domesticAnnual != null ? String(Math.round(q.domesticAnnual)) : ''
        ]);
        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${downloadFileStem}.csv`);
    };

    const downloadTableAsDocx = async () => {
        const pCol = getText('page119_table_col_period', lang);
        const eCol = getText('page119_table_col_exports', lang);
        const dCol = getText('page119_table_col_domestic', lang);
        const headerRow = new TableRow({
            children: [pCol, eCol, dCol].map(
                (header) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: header, bold: true, size: 22 })],
                                alignment: AlignmentType.CENTER
                            })
                        ],
                        shading: { fill: 'E6E6E6' }
                    })
            )
        });
        const dataRows = quarters.map(
            (q) =>
                new TableRow({
                    children: [
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: `${q.year} Q${q.quarter}`, size: 22 })],
                                    alignment: AlignmentType.CENTER
                                })
                            ]
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: String(Math.round(q.exportVal)), size: 22 })],
                                    alignment: AlignmentType.CENTER
                                })
                            ]
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text:
                                                q.domesticAnnual != null
                                                    ? String(Math.round(q.domesticAnnual))
                                                    : '\u2014',
                                            size: 22
                                        })
                                    ],
                                    alignment: AlignmentType.CENTER
                                })
                            ]
                        })
                    ]
                })
        );
        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: `${stripHtml(getText('page119_title', lang))} — ${chartTitlePlain} (${yearSpanLabel})`,
                                    bold: true,
                                    size: 28
                                })
                            ],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 }
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [2800, 2200, 2200],
                            rows: [headerRow, ...dataRows]
                        })
                    ]
                }
            ]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${downloadFileStem}.docx`);
    };

    const xIndices = quarters.map((q) => q.idx);
    const exportVals = quarters.map((q) => q.exportVal);
    const barColors = quarters.map((q) => BAR_COLORS[(q.quarter - 1) % 4]);
    const quarterTicktext = quarters.map((q) => `Q${q.quarter}`);

    const page119PlotTraces = useMemo(
        () => [
            {
                x: xIndices,
                y: exportVals,
                type: 'bar',
                name: exportLabel,
                marker: {
                    color: barColors,
                    opacity:
                        chartFocus === null
                            ? 1
                            : quarters.map((_, i) => (chartFocus.bars.includes(i) ? 1 : 0.3))
                },
                customdata: quarters.map((q) => `${q.year} Q${q.quarter}`),
                hovertemplate: `<b>${exportLabel}</b><br>%{customdata}<br>%{y:,.0f}<extra></extra>`
            },
            {
                x: lineSeries.lx,
                y: lineSeries.ly,
                type: 'scatter',
                mode: 'lines+markers',
                name: domesticLabel,
                line: { color: LINE_COLOR, width: 3 },
                marker: {
                    color: LINE_COLOR,
                    size: 8,
                    symbol: 'square'
                },
                opacity: chartFocus === null ? 1 : chartFocus.line ? 1 : 0.3,
                customdata: lineSeries.lyear,
                hovertemplate: `<b>${domesticLabel}</b><br>%{customdata}<br>%{y:,.0f}<extra></extra>`
            }
        ],
        [
            barColors,
            domesticLabel,
            exportLabel,
            exportVals,
            lineSeries.lx,
            lineSeries.ly,
            lineSeries.lyear,
            quarters,
            chartFocus,
            xIndices
        ]
    );

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-119"
            role="main"
            lang={lang}
            aria-labelledby="page119-main-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
                .page-119.page-content {
                    max-width: none !important;
                    overflow-x: visible !important;
                }
                .page-119 {
                    margin-left: -${layoutPadding?.left || 55}px;
                    margin-right: -${layoutPadding?.right || 15}px;
                    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
                    padding-left: ${layoutPadding?.left || 55}px;
                    padding-right: ${layoutPadding?.right || 15}px;
                }
                .page119-container {
                    width: 100%;
                    padding: 15px 0 40px 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                }
                .page-119.page-content h1.page119-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 41px !important;
                    font-weight: bold;
                    color: var(--gc-text);
                    margin-top: 0;
                    margin-bottom: 25px;
                    position: relative;
                    padding-bottom: 0.5em;
                    line-height: 1.2;
                }
                .page-119.page-content h1.page119-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }
                .page-119 p.page119-para {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    color: var(--gc-text);
                    line-height: 1.5;
                    margin: 0 0 16px 0;
                }
                .page119-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    margin-top: 8px;
                    margin-bottom: 20px;
                    box-sizing: border-box;
                    overflow: visible;
                }
                .page119-chart-block {
                    display: flex;
                    flex-direction: column;
                    align-items: stretch;
                    width: 100%;
                }
                .page119-chart-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: var(--gc-text);
                    text-align: center;
                    margin: 0 0 12px 0;
                }
                .page119-legend {
                    display: flex;
                    justify-content: center;
                    margin-top: -28px;
                    margin-bottom: 12px;
                    font-family: 'Noto Sans', sans-serif;
                    padding: 4px 16px 8px;
                }
                .page119-legend-inner {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 15px 40px;
                    justify-content: center;
                }
                .page119-legend-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .page119-legend-swatch-bar {
                    width: 22px;
                    height: 14px;
                    flex-shrink: 0;
                    background-color: ${BAR_COLORS[2]};
                }
                .page119-legend-line {
                    width: 28px;
                    height: 0;
                    border-top: 3px solid ${LINE_COLOR};
                    position: relative;
                    flex-shrink: 0;
                }
                .page119-legend-line::after {
                    content: '';
                    position: absolute;
                    width: 8px;
                    height: 8px;
                    background: ${LINE_COLOR};
                    left: 10px;
                    top: -5px;
                }
                .page119-legend-label {
                    font-size: 18px;
                    color: var(--gc-text);
                }
                .page119-table-wrapper {
                    display: block;
                    width: 100%;
                    margin-top: 20px;
                    margin-bottom: 0;
                }
                .page119-table-wrapper details > summary {
                    display: block;
                    width: 100%;
                    padding: 12px 15px;
                    background-color: #8C8C8C;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    color: #ffffff;
                    list-style: none;
                }
                .page119-table-wrapper details > summary::-webkit-details-marker {
                    display: none;
                }
                .page119-table-wrapper details > summary::marker {
                    display: none;
                    content: '';
                }
                .page119-table-wrapper details > summary:hover {
                    background-color: #404040 !important;
                }
                .page119-table-wrapper .table-responsive {
                    display: block;
                    width: 100%;
                    overflow-x: auto !important;
                    -webkit-overflow-scrolling: touch;
                    border: 1px solid #ddd;
                    background: #fff;
                }
                .page119-table-wrapper .table-responsive table th,
                .page119-table-wrapper .table-responsive table td {
                    white-space: nowrap;
                    padding: 8px 12px;
                    font-family: var(--font-body);
                    color: var(--gc-text);
                }
                .page119-download-buttons {
                    display: flex;
                    gap: 10px;
                    margin-top: 15px;
                    flex-wrap: wrap;
                }
                .page119-download-buttons button {
                    padding: 8px 16px;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    background: #8C8C8C;
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    color: #ffffff;
                }
                .page119-download-buttons button:hover {
                    background: #404040 !important;
                }
                @media (max-width: 768px) {
                    .page-119.page-content h1.page119-title {
                        font-size: 37px !important;
                    }
                    .page-119 p.page119-para {
                        font-size: 18px;
                    }
                    .page119-chart-title {
                        font-size: 26px;
                    }
                    .page119-legend-label {
                        font-size: 16px;
                    }
                    .page119-legend {
                        margin-top: -22px;
                    }
                }
            `}</style>

            <div className="page119-container">
                <h1 id="page119-main-title" className="page119-title">
                    {getText('page119_title', lang)}
                </h1>
                <p className="page119-para">{getText('page119_para1', lang)}</p>
                <p className="page119-para">{getText('page119_para2', lang)}</p>
                <p className="page119-para">{getText('page119_para3', lang)}</p>

                <div className="page119-chart-frame">
                    <h2 className="page119-chart-title">{getText('page119_chart_title', lang)}</h2>

                    <div className="page119-chart-block">
                    <div role="region" aria-label={getText('page119_chart_aria', lang)} tabIndex="0">
                        {chartFocus !== null && (
                            <div style={{ marginBottom: 8 }}>
                                <button
                                    type="button"
                                    onClick={() => setChartFocus(null)}
                                    style={{
                                        padding: '6px 12px',
                                        backgroundColor: '#8C8C8C',
                                        border: '1px solid #404040',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontFamily: 'Arial, sans-serif',
                                        fontSize: 14,
                                        color: '#fff'
                                    }}
                                >
                                    {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                                </button>
                            </div>
                        )}
                        <figure ref={chartRef} style={{ margin: 0, position: 'relative' }}>
                            <div aria-hidden="true">
                                <Plot
                                    data={page119PlotTraces}
                                    layout={{
                                        shapes: zebraShapes,
                                        annotations: yearLabelAnnotations,
                                        barmode: 'group',
                                        bargap: 0.25,
                                        hoverlabel: {
                                            bgcolor: '#ffffff',
                                            font: { color: '#000000', size: 14, family: 'Arial, sans-serif' }
                                        },
                                        hovermode: 'closest',
                                        clickmode: 'event',
                                        dragmode: false,
                                        xaxis: {
                                            type: 'linear',
                                            range: xRange,
                                            tickmode: 'array',
                                            tickvals: xIndices,
                                            ticktext: quarterTicktext,
                                            tickangle: quarterTickAngle,
                                            showgrid: false,
                                            zeroline: false,
                                            showline: true,
                                            linewidth: 1,
                                            linecolor: '#333',
                                            tickfont: quarterXTickFont,
                                            automargin: false
                                        },
                                        yaxis: {
                                            title: {
                                                text: getText('page119_yaxis', lang),
                                                font: {
                                                    size: windowWidth <= 768 ? 18 : 22,
                                                    family: 'Arial, sans-serif',
                                                    color: '#58585a'
                                                },
                                                standoff: 8
                                            },
                                            range: [0, 420],
                                            dtick: 50,
                                            showgrid: false,
                                            zeroline: false,
                                            showline: true,
                                            linewidth: 1,
                                            linecolor: '#333',
                                            tickfont: tickFont,
                                            automargin: true
                                        },
                                        showlegend: false,
                                        margin: { l: 64, r: 16, t: plotTopMargin, b: plotBottomMargin },
                                        autosize: true,
                                        paper_bgcolor: 'rgba(0,0,0,0)',
                                        plot_bgcolor: 'rgba(0,0,0,0)'
                                    }}
                                    config={{
                                        displayModeBar: true,
                                        displaylogo: false,
                                        responsive: true,
                                        scrollZoom: false,
                                        modeBarButtonsToRemove: [
                                            'pan2d',
                                            'select2d',
                                            'lasso2d',
                                            'zoom2d',
                                            'zoomIn2d',
                                            'zoomOut2d',
                                            'autoScale2d',
                                            'resetScale2d',
                                            'toImage'
                                        ],
                                        modeBarButtonsToAdd: [
                                            {
                                                name: getText('page119_download_chart', lang),
                                                icon: {
                                                    width: 24,
                                                    height: 24,
                                                    path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z'
                                                },
                                                click: (gd) => downloadChartWithTitle(gd)
                                            }
                                        ]
                                    }}
                                    style={{ width: '100%', height: `${chartHeight}px` }}
                                    useResizeHandler={true}
                                    onClick={(data) => {
                                        if (!data.points || data.points.length === 0) return;
                                        const clickedPoint = data.points[0];
                                        const traceIndex = clickedPoint.curveNumber;
                                        const pointIndex = clickedPoint.pointIndex;
                                        if (traceIndex === undefined) return;
                                        if (traceIndex === 0 && pointIndex === undefined) return;

                                        if (windowWidth <= 768) {
                                            const currentTime = Date.now();
                                            const lastClick = lastClickRef.current;
                                            const sameTarget =
                                                traceIndex === 1
                                                    ? lastClick.traceIndex === 1
                                                    : lastClick.traceIndex === traceIndex &&
                                                      lastClick.pointIndex === pointIndex;
                                            const isDoubleTap = sameTarget && currentTime - lastClick.time < 300;
                                            lastClickRef.current = {
                                                time: currentTime,
                                                traceIndex,
                                                pointIndex: traceIndex === 1 ? null : pointIndex
                                            };
                                            if (!isDoubleTap) return;
                                        }

                                        if (traceIndex === 1) {
                                            setChartFocus((prev) => {
                                                if (prev === null) return { bars: [], line: true };
                                                const line = !prev.line;
                                                if (prev.bars.length === 0 && !line) return null;
                                                return { bars: [...prev.bars], line };
                                            });
                                            return;
                                        }

                                        setChartFocus((prev) => {
                                            if (prev === null) {
                                                return { bars: [pointIndex], line: false };
                                            }
                                            const has = prev.bars.includes(pointIndex);
                                            const bars = has
                                                ? prev.bars.filter((p) => p !== pointIndex)
                                                : [...prev.bars, pointIndex];
                                            if (bars.length === 0 && !prev.line) return null;
                                            return { bars, line: prev.line };
                                        });
                                    }}
                                />
                            </div>
                        </figure>
                    </div>

                    <div className="page119-legend" aria-hidden="true">
                        <div className="page119-legend-inner">
                            <div className="page119-legend-item">
                                <span className="page119-legend-swatch-bar" />
                                <span className="page119-legend-label">{exportLabel}</span>
                            </div>
                            <div className="page119-legend-item">
                                <span className="page119-legend-line" />
                                <span className="page119-legend-label">{domesticLabel}</span>
                            </div>
                        </div>
                    </div>
                    </div>

                    <div className="page119-table-wrapper">
                        <details className="page119-data-table" onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>
                                    {isTableOpen ? '▼' : '▶'}
                                </span>
                                {getText('page119_table_summary', lang)}
                                <span className="wb-inv">{getText('page119_table_toggle_sr', lang)}</span>
                            </summary>

                            <div
                                ref={topScrollRef}
                                style={{
                                    width: '100%',
                                    overflowX: 'auto',
                                    overflowY: 'hidden',
                                    marginBottom: '0px',
                                    display: windowWidth <= 768 ? 'none' : 'block'
                                }}
                                aria-hidden="true"
                            >
                                <div style={{ height: '20px' }} />
                            </div>
                            <div
                                ref={tableScrollRef}
                                className="table-responsive"
                                role="region"
                                tabIndex="0"
                                aria-label={getText('page119_table_aria', lang)}
                            >
                                <table className="table table-striped table-hover" style={{ marginTop: '15px' }}>
                                    <caption className="wb-inv">{getText('page119_table_caption', lang)}</caption>
                                    <thead>
                                        <tr>
                                            <th
                                                scope="col"
                                                style={{
                                                    border: '1px solid #ddd',
                                                    padding: '10px',
                                                    backgroundColor: '#f0f0f0'
                                                }}
                                            >
                                                {getText('page119_table_col_period', lang)}
                                            </th>
                                            <th
                                                scope="col"
                                                style={{
                                                    border: '1px solid #ddd',
                                                    padding: '10px',
                                                    backgroundColor: '#f0f0f0',
                                                    textAlign: 'right'
                                                }}
                                            >
                                                {getText('page119_table_col_exports', lang)}
                                            </th>
                                            <th
                                                scope="col"
                                                style={{
                                                    border: '1px solid #ddd',
                                                    padding: '10px',
                                                    backgroundColor: '#f0f0f0',
                                                    textAlign: 'right'
                                                }}
                                            >
                                                {getText('page119_table_col_domestic', lang)}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {quarters.map((q) => (
                                            <tr key={`${q.refDate}`}>
                                                <th
                                                    scope="row"
                                                    style={{ border: '1px solid #ddd', padding: '10px' }}
                                                >
                                                    {q.year} Q{q.quarter}
                                                </th>
                                                <td
                                                    style={{
                                                        border: '1px solid #ddd',
                                                        padding: '10px',
                                                        textAlign: 'right'
                                                    }}
                                                >
                                                    {formatNumber(q.exportVal)}
                                                </td>
                                                <td
                                                    style={{
                                                        border: '1px solid #ddd',
                                                        padding: '10px',
                                                        textAlign: 'right'
                                                    }}
                                                >
                                                    {q.domesticAnnual != null
                                                        ? formatNumber(q.domesticAnnual)
                                                        : '\u2014'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="page119-download-buttons">
                                <button type="button" onClick={downloadTableAsCSV}>
                                    {getText('page119_download_csv', lang)}
                                </button>
                                <button type="button" onClick={downloadTableAsDocx}>
                                    {getText('page119_download_docx', lang)}
                                </button>
                            </div>
                        </details>
                    </div>
                </div>

                <aside className="wb-fnote" role="note" style={{ marginTop: '12px', marginBottom: 0 }}>
                    <h2 id="fn-page119">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt>{lang === 'en' ? 'Footnote' : 'Note de bas de page'}</dt>
                        <dd style={{ marginBottom: 0 }}>
                            <p style={{ margin: 0 }}>{getText('page119_footnote', lang)}</p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page119;
