import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getText } from '../utils/translations';
import { getOilGasGhgSpotlightData, getGhgNarrativeStats } from '../utils/dataLoader';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const TRACE_COUNT = 4;
const COLORS = ['#5c4033', '#6097b6', '#DF793A', '#1e3a5f'];

const Page132 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [chartRows, setChartRows] = useState([]);
    const [narrativeStats, setNarrativeStats] = useState(null);
    const [loadError, setLoadError] = useState(false);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);

    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    const formatMt = (num) => {
        if (num === undefined || num === null || Number.isNaN(Number(num))) return '\u2014';
        return Math.round(Number(num) * 10) / 10;
    };

    const formatMtLocale = (num) => {
        if (num === undefined || num === null || Number.isNaN(Number(num))) return '\u2014';
        const v = Math.round(Number(num) * 10) / 10;
        return v.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [rows, stats] = await Promise.all([
                    getOilGasGhgSpotlightData(),
                    getGhgNarrativeStats(),
                ]);
                if (!cancelled) {
                    setChartRows(rows);
                    setNarrativeStats(stats);
                    setLoadError(!rows || rows.length === 0);
                }
            } catch {
                if (!cancelled) {
                    setChartRows([]);
                    setLoadError(true);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const stats = narrativeStats ?? {
        baseYear: 2000,
        endYear: 2023,
        oilGasSpotlightTotalPct: null,
        oilSandsRatio: null,
        convGasPct: null,
    };

    const formatPctDisplay = (value) => {
        const n = Math.abs(Math.round(Number(value)));
        return lang === 'fr' ? `${n} %` : `${n}%`;
    };

    const para1Highlight = stats.oilGasSpotlightTotalPct != null
        ? (() => {
            const n = formatPctDisplay(stats.oilGasSpotlightTotalPct);
            if (lang === 'fr') {
                const verb = Number(stats.oilGasSpotlightTotalPct) < 0 ? `diminué de ${n}` : `augmenté de ${n}`;
                return `${verb} entre ${stats.baseYear} et ${stats.endYear}`;
            }
            const verb = Number(stats.oilGasSpotlightTotalPct) < 0 ? `gone down ${n}` : `gone up ${n}`;
            return `have ${verb} between ${stats.baseYear} and ${stats.endYear}`;
        })()
        : getText('page132_para1b', lang);

    const para2HighlightSand = stats.oilSandsRatio != null
        ? (() => {
            const r = Number(stats.oilSandsRatio);
            if (!Number.isFinite(r)) return getText('page132_para2b', lang);
            if (r >= 3) return lang === 'fr' ? 'ont plus que triplé' : 'more than tripled';
            if (r >= 2) return lang === 'fr' ? 'ont plus que doublé' : 'more than doubled';
            const pct = Math.round((r - 1) * 100);
            return lang === 'fr' ? `ont augmenté de ${formatPctDisplay(pct)}` : `increased ${formatPctDisplay(pct)}`;
        })()
        : getText('page132_para2b', lang);

    const para2HighlightConvGas = stats.convGasPct != null
        ? (() => {
            const n = formatPctDisplay(stats.convGasPct);
            if (lang === 'fr') {
                return Number(stats.convGasPct) < 0 ? `diminué de ${n}` : `augmenté de ${n}`;
            }
            return Number(stats.convGasPct) < 0 ? `decreased by ${n}` : `increased by ${n}`;
        })()
        : getText('page132_para2d', lang);

    const para1Text = `${getText('page132_para1a', lang)}${para1Highlight}${getText('page132_para1c', lang)}`;
    const para2Text = `${getText('page132_para2a', lang)}${para2HighlightSand}${getText('page132_para2c', lang)}${para2HighlightConvGas}${getText('page132_para2e', lang)}`;

    const years = useMemo(() => chartRows.map((r) => r.year), [chartRows]);
    const oilSands = useMemo(() => chartRows.map((r) => r.oil_sands), [chartRows]);
    const naturalGas = useMemo(() => chartRows.map((r) => r.natural_gas), [chartRows]);
    const conventionalOil = useMemo(() => chartRows.map((r) => r.conventional_oil), [chartRows]);
    const other = useMemo(() => chartRows.map((r) => r.other), [chartRows]);

    const legendOilSands = getText('page132_legend_oil_sands', lang);
    const legendNaturalGas = getText('page132_legend_natural_gas', lang);
    const legendConventional = getText('page132_legend_conventional', lang);
    const legendOther = getText('page132_legend_other', lang);
    const legendLabels = [legendOilSands, legendNaturalGas, legendConventional, legendOther];

    const exportChartTitle = stripHtml(getText('page132_chart_title', lang));
    const quantityHdrSuffix = getText('page132_table_hdr_quantity_suffix', lang);
    const tableHeaders = [
        getText('page106_table_col_year', lang),
        ...legendLabels.map((label) => `${label}${quantityHdrSuffix}`),
        `${getText('page132_table_col_total', lang)}${quantityHdrSuffix}`
    ];

    const fileSlugBase =
        lang === 'en'
            ? 'oil_gas_sector_ghg_emissions_canada_2000-2023'
            : 'emissions_ges_petrole_gaz_canada_2000-2023';

    const plotBottomMargin = windowWidth <= 480 ? 88 : windowWidth <= 768 ? 76 : 64;
    const plotTopMargin = windowWidth <= 480 ? 56 : 48;
    const chartHeight = windowWidth <= 480 ? 320 : windowWidth <= 768 ? 360 : 400;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = {
        size: windowWidth <= 768 ? 18 : 22,
        family: 'Arial, sans-serif',
        color: '#58585a'
    };

    const xTickvals = [];
    for (let y = 2001; y <= 2023; y += 2) {
        xTickvals.push(y);
    }

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
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
                    btn.onkeydown = (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            btn.click();
                        }
                    };
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
    }, [lang, selectedPoints, chartRows.length]);

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
    }, [isTableOpen, chartRows.length]);

    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        const title = exportChartTitle;
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
                const titleHeight = 96;
                const legendHeight = 64;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight + legendHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 32px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, canvas.width / 2, 48);
                ctx.drawImage(img, 0, titleHeight);
                const legendY = titleHeight + img.height + 28;
                const items = legendLabels.map((label, idx) => ({ label, color: COLORS[idx] }));
                const gap = 28;
                let totalW = 0;
                items.forEach((it) => {
                    ctx.font = '18px Arial';
                    totalW += 28 + gap + ctx.measureText(it.label).width + gap;
                });
                let xPos = (canvas.width - totalW) / 2;
                items.forEach((it) => {
                    ctx.fillStyle = it.color;
                    ctx.fillRect(xPos, legendY - 10, 22, 14);
                    ctx.fillStyle = '#333333';
                    ctx.font = '18px Arial';
                    ctx.textAlign = 'left';
                    ctx.fillText(it.label, xPos + 28, legendY + 4);
                    xPos += 28 + gap + ctx.measureText(it.label).width + gap;
                });
                canvas.toBlob((blob) => {
                    if (blob) saveAs(blob, `${fileSlugBase}.png`);
                });
            };
            img.src = imgData;
        } catch (err) {
            console.error('Error downloading chart:', err);
        }
    };

    const downloadTableAsCSV = () => {
        const lines = [tableHeaders.join(',')];
        chartRows.forEach((r) => {
            const total =
                Number(r.oil_sands) + Number(r.natural_gas) + Number(r.conventional_oil) + Number(r.other);
            lines.push(
                [r.year, formatMt(r.oil_sands), formatMt(r.natural_gas), formatMt(r.conventional_oil), formatMt(r.other), formatMt(total)].join(
                    ','
                )
            );
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${fileSlugBase}.csv`);
    };

    const downloadTableAsDocx = async () => {
        const yCol = getText('page106_table_col_year', lang);
        const h = [yCol, ...legendLabels, getText('page132_table_col_total', lang)];
        const headerRow = new TableRow({
            children: h.map(
                (cell) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: cell, bold: true, size: 20 })],
                                alignment: AlignmentType.CENTER
                            })
                        ],
                        shading: { fill: 'E6E6E6' }
                    })
            )
        });
        const dataRows = chartRows.map(
            (r) =>
                new TableRow({
                    children: [
                        r.year,
                        formatMt(r.oil_sands),
                        formatMt(r.natural_gas),
                        formatMt(r.conventional_oil),
                        formatMt(r.other),
                        formatMt(
                            Number(r.oil_sands) + Number(r.natural_gas) + Number(r.conventional_oil) + Number(r.other)
                        )
                    ].map(
                        (val) =>
                            new TableCell({
                                children: [
                                    new Paragraph({
                                        children: [new TextRun({ text: String(val), size: 20 })],
                                        alignment: AlignmentType.CENTER
                                    })
                                ]
                            })
                    )
                })
        );
        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: exportChartTitle, bold: true, size: 28 })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 }
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [900, 1100, 1100, 1100, 900, 900],
                            rows: [headerRow, ...dataRows]
                        })
                    ]
                }
            ]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${fileSlugBase}.docx`);
    };

    const barOpacityFor = (traceIdx) => {
        if (selectedPoints === null) return 1;
        return years.map((_, i) => (selectedPoints[traceIdx]?.includes(i) ? 1 : 0.3));
    };

    const plotData =
        years.length === 0
            ? []
            : [
                  {
                      x: years,
                      y: oilSands,
                      type: 'bar',
                      name: legendOilSands,
                      marker: { color: COLORS[0], opacity: barOpacityFor(0) },
                      hovertemplate: years.map(
                          (y, i) =>
                              `<b>${legendOilSands}</b><br>${y}: ${formatMtLocale(oilSands[i])} Mt<extra></extra>`
                      )
                  },
                  {
                      x: years,
                      y: naturalGas,
                      type: 'bar',
                      name: legendNaturalGas,
                      marker: { color: COLORS[1], opacity: barOpacityFor(1) },
                      hovertemplate: years.map(
                          (y, i) =>
                              `<b>${legendNaturalGas}</b><br>${y}: ${formatMtLocale(naturalGas[i])} Mt<extra></extra>`
                      )
                  },
                  {
                      x: years,
                      y: conventionalOil,
                      type: 'bar',
                      name: legendConventional,
                      marker: { color: COLORS[2], opacity: barOpacityFor(2) },
                      hovertemplate: years.map(
                          (y, i) =>
                              `<b>${legendConventional}</b><br>${y}: ${formatMtLocale(conventionalOil[i])} Mt<extra></extra>`
                      )
                  },
                  {
                      x: years,
                      y: other,
                      type: 'bar',
                      name: legendOther,
                      marker: { color: COLORS[3], opacity: barOpacityFor(3) },
                      hovertemplate: years.map(
                          (y, i) => `<b>${legendOther}</b><br>${y}: ${formatMtLocale(other[i])} Mt<extra></extra>`
                      )
                  }
              ];

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-132"
            role="main"
            aria-labelledby="page132-main-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
                .page-132.page-content {
                    max-width: none !important;
                    overflow-x: visible !important;
                }
                .page-132 {
                    margin-left: -${layoutPadding?.left || 55}px;
                    margin-right: -${layoutPadding?.right || 15}px;
                    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
                    padding-left: ${layoutPadding?.left || 55}px;
                    padding-right: ${layoutPadding?.right || 15}px;
                }
                .page132-container {
                    width: 100%;
                    padding: 15px 0 40px 0;
                    box-sizing: border-box;
                }
                .page-132.page-content h1.page132-title {
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
                .page-132.page-content h1.page132-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }
                .page132-body {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    color: #332f30;
                    line-height: 1.5;
                    margin: 0 0 16px 0;
                    max-width: 80ch;
                }
                .page132-body .visual-bold {
                    font-weight: 700;
                }
                .page132-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    box-sizing: border-box;
                    overflow: visible;
                }
                .page132-chart-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: var(--gc-text);
                    text-align: center;
                    margin: 0 0 12px 0;
                }
                .page132-chart-block {
                    display: flex;
                    flex-direction: column;
                    align-items: stretch;
                    width: 100%;
                }
                .page132-chart {
                    width: 100%;
                    flex-shrink: 0;
                    position: relative;
                    min-height: 0;
                }
                .page132-legend {
                    display: flex;
                    justify-content: center;
                    margin-top: 20px;
                    margin-bottom: 20px;
                    font-family: 'Noto Sans', sans-serif;
                    padding: 10px 20px;
                }
                .page132-legend-inner {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 15px 28px;
                    justify-content: center;
                }
                .page132-legend-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .page132-legend-swatch {
                    width: 22px;
                    height: 14px;
                    flex-shrink: 0;
                }
                .page132-legend-label {
                    font-size: 18px;
                    color: var(--gc-text);
                }
                .page132-table-wrapper {
                    display: block;
                    width: 100%;
                    margin-top: 20px;
                    margin-bottom: 0;
                }
                .page132-table-wrapper details > summary {
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
                .page132-table-wrapper details > summary::-webkit-details-marker {
                    display: none;
                }
                .page132-table-wrapper details > summary:hover,
                .page132-chart-frame button[type="button"]:hover {
                    background-color: #404040 !important;
                }
                .page132-table-wrapper .table-responsive {
                    display: block;
                    width: 100%;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    border: 1px solid #ddd;
                    background: #fff;
                    margin-top: 10px;
                }
                .page132-table-wrapper .table-responsive table th,
                .page132-table-wrapper .table-responsive table td {
                    white-space: nowrap;
                    padding: 8px 12px;
                    font-family: var(--font-body);
                    color: var(--gc-text);
                }
                .page132-download-buttons {
                    display: flex;
                    gap: 10px;
                    margin-top: 15px;
                    flex-wrap: wrap;
                }
                .page132-download-buttons button {
                    padding: 8px 16px;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    background: #8C8C8C;
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    color: #ffffff;
                }
                .page132-download-buttons button:hover {
                    background: #404040 !important;
                }
                @media (max-width: 768px) {
                    .page-132.page-content h1.page132-title {
                        font-size: 37px !important;
                    }
                    .page132-body { font-size: 18px; }
                    .page132-chart-title { font-size: 26px; }
                    .page132-legend-label { font-size: 16px; }
                }
                @media (max-width: 480px) {
                    .page132-legend-label { font-size: 14px; }
                }
            `}</style>

            <div className="page132-container">
                <h1 id="page132-main-title" className="page132-title">
                    {getText('page132_title', lang)}
                </h1>

                <p className="page132-body" aria-label={para1Text}>
                    {getText('page132_para1a', lang)}
                    <span className="visual-bold">{para1Highlight}</span>
                    {getText('page132_para1c', lang)}
                </p>
                <p className="page132-body" aria-label={para2Text}>
                    {getText('page132_para2a', lang)}
                    <span className="visual-bold">{para2HighlightSand}</span>
                    {getText('page132_para2c', lang)}
                    <span className="visual-bold">{para2HighlightConvGas}</span>
                    {getText('page132_para2e', lang)}
                </p>

                {loadError && (
                    <p className="page132-body" role="alert">
                        {lang === 'en'
                            ? 'Chart data could not be loaded.'
                            : 'Les données du graphique n’ont pas pu être chargées.'}
                    </p>
                )}

                <div className="page132-chart-frame">
                    <h2 id="page132-chart-title" className="page132-chart-title">
                        {getText('page132_chart_title', lang)}
                    </h2>

                    <div className="page132-chart-block">
                        <div role="region" aria-label={getText('page132_chart_aria', lang)} tabIndex="0">
                            {selectedPoints !== null && (
                                <div style={{ marginBottom: 8 }}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedPoints(null)}
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
                            <figure ref={chartRef} className="page132-chart" style={{ margin: 0 }}>
                                {years.length > 0 && (
                                    <div aria-hidden="true">
                                        <Plot
                                            data={plotData}
                                            layout={{
                                                barmode: 'stack',
                                                bargap: 0.22,
                                                hoverlabel: {
                                                    bgcolor: '#ffffff',
                                                    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' }
                                                },
                                                hovermode: 'closest',
                                                clickmode: 'event',
                                                dragmode: false,
                                                xaxis: {
                                                    type: 'linear',
                                                    tickmode: 'array',
                                                    tickvals: xTickvals,
                                                    ticktext: xTickvals.map(String),
                                                    showgrid: false,
                                                    zeroline: false,
                                                    showline: true,
                                                    linewidth: 1,
                                                    linecolor: '#333',
                                                    tickfont: tickFont,
                                                    range: [1999.5, 2023.5],
                                                    automargin: true
                                                },
                                                yaxis: {
                                                    title: {
                                                        text: getText('page132_yaxis', lang),
                                                        font: axisTitleFont,
                                                        standoff: 8
                                                    },
                                                    range: [0, 250],
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
                                                margin: { l: 58, r: 18, t: plotTopMargin, b: plotBottomMargin },
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
                                                        name:
                                                            lang === 'en'
                                                                ? 'Download chart as PNG'
                                                                : 'Télécharger le graphique en PNG',
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
                                                if (traceIndex === undefined || pointIndex === undefined) return;

                                                if (windowWidth <= 768) {
                                                    const currentTime = Date.now();
                                                    const lastClick = lastClickRef.current;
                                                    const isSamePoint =
                                                        traceIndex === lastClick.traceIndex &&
                                                        pointIndex === lastClick.pointIndex;
                                                    const isDoubleTap = isSamePoint && currentTime - lastClick.time < 300;
                                                    lastClickRef.current = {
                                                        time: currentTime,
                                                        traceIndex,
                                                        pointIndex
                                                    };
                                                    if (!isDoubleTap) return;
                                                }

                                                setSelectedPoints((prev) => {
                                                    if (prev === null) {
                                                        const next = Array.from({ length: TRACE_COUNT }, () => []);
                                                        next[traceIndex].push(pointIndex);
                                                        return next;
                                                    }
                                                    const isSelected = prev[traceIndex]?.includes(pointIndex);
                                                    if (isSelected) {
                                                        const next = prev.map((tracePoints, idx) =>
                                                            idx === traceIndex
                                                                ? tracePoints.filter((p) => p !== pointIndex)
                                                                : [...tracePoints]
                                                        );
                                                        return next.every((arr) => arr.length === 0) ? null : next;
                                                    }
                                                    return prev.map((tracePoints, idx) =>
                                                        idx === traceIndex ? [...tracePoints, pointIndex] : [...tracePoints]
                                                    );
                                                });
                                            }}
                                        />
                                    </div>
                                )}
                            </figure>
                        </div>

                        <div className="page132-legend" aria-hidden="true">
                            <div className="page132-legend-inner">
                                {legendLabels.map((label, idx) => (
                                    <div key={label} className="page132-legend-item">
                                        <span
                                            className="page132-legend-swatch"
                                            style={{ backgroundColor: COLORS[idx] }}
                                        />
                                        <span className="page132-legend-label">{label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="page132-table-wrapper">
                        <details onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>
                                    {isTableOpen ? '▼' : '▶'}
                                </span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">
                                    {lang === 'en'
                                        ? ' Press Enter to open or close.'
                                        : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                </span>
                            </summary>

                            <div
                                ref={topScrollRef}
                                style={{
                                    width: '100%',
                                    overflowX: 'auto',
                                    overflowY: 'hidden',
                                    marginTop: '10px',
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
                                aria-label={lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                tabIndex="0"
                            >
                                <table className="table table-bordered table-striped table-hover">
                                    <caption className="wb-inv">{getText('page132_table_caption', lang)}</caption>
                                    <thead>
                                        <tr>
                                            {tableHeaders.map((hdr) => (
                                                <th key={hdr} scope="col" style={{ fontWeight: 'bold', textAlign: 'center' }}>
                                                    {hdr}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {chartRows.map((r) => {
                                            const total =
                                                Number(r.oil_sands) +
                                                Number(r.natural_gas) +
                                                Number(r.conventional_oil) +
                                                Number(r.other);
                                            return (
                                                <tr key={r.year}>
                                                    <td style={{ textAlign: 'center' }}>{r.year}</td>
                                                    <td style={{ textAlign: 'center' }}>{formatMtLocale(r.oil_sands)}</td>
                                                    <td style={{ textAlign: 'center' }}>{formatMtLocale(r.natural_gas)}</td>
                                                    <td style={{ textAlign: 'center' }}>{formatMtLocale(r.conventional_oil)}</td>
                                                    <td style={{ textAlign: 'center' }}>{formatMtLocale(r.other)}</td>
                                                    <td style={{ textAlign: 'center' }}>{formatMtLocale(total)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="page132-download-buttons">
                                <button type="button" onClick={downloadTableAsCSV}>
                                    {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                </button>
                                <button type="button" onClick={() => downloadTableAsDocx()}>
                                    {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                </button>
                            </div>
                        </details>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Page132;
