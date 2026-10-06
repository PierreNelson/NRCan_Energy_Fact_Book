import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useWindowWidth from '../hooks/useWindowWidth';
import PageFootnotes from '../components/PageFootnotes';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import { formatLocaleNumber } from '../utils/formatLocale';

const BAR_COLORS = ['#59A63A', '#437D2C', '#396624', '#2c6a38'];
const LINE_COLOR = '#26374A';

const oil_by_rail_EXPORT_PAIRS = [
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

const oil_by_rail_DOMESTIC_PAIRS = [
    [2014, 95], [2015, 93], [2016, 91], [2017, 92], [2018, 94], [2019, 93],
    [2020, 95], [2021, 96], [2022, 97], [2023, 96], [2024, 98], [2025, 99]
];

const oil_by_rail_DOMESTIC_BY_YEAR = oil_by_rail_DOMESTIC_PAIRS.reduce((acc, [y, v]) => {
    acc[y] = v;
    return acc;
}, {});

const oil_by_rail_QUARTERS = oil_by_rail_EXPORT_PAIRS.map(([mm, exportVal], idx) => {
    const y = Math.floor(mm / 100);
    const mo = mm % 100;
    const q = mo === 3 ? 1 : mo === 6 ? 2 : mo === 9 ? 3 : 4;
    return {
        idx,
        refDate: mm,
        year: y,
        quarter: q,
        exportVal,
        domesticAnnual: oil_by_rail_DOMESTIC_BY_YEAR[y] ?? null
    };
});

const OilByRail = () => {
    const { lang, layoutPadding } = useOutletContext();
    const quarters = oil_by_rail_QUARTERS;
    const domesticByYear = oil_by_rail_DOMESTIC_BY_YEAR;
    const windowWidth = useWindowWidth();
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
    /** null = no focus; bars = per-quarter selection; line = whole domestic trace on/off. */
    const [chartFocus, setChartFocus] = useState(null);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
    /** When outerWidth is stable, innerWidth shrink/grow tracks Ctrl+ page zoom (Chromium keeps visualViewport.scale≈1). */
    const zoomBaselineRef = useRef(null);

    const formatNumber = (num) => formatLocaleNumber(num, lang, { maximumFractionDigits: 0 });

    const exportLabel = getText('oil_by_rail_legend_exports', lang);
    const domesticLabel = getText('oil_by_rail_legend_domestic', lang);
    const chartTitlePlain = stripHtml(getText('oil_by_rail_chart_title', lang));
    const yearSpanLabel = `${oil_by_rail_QUARTERS[0].year}-${oil_by_rail_QUARTERS[oil_by_rail_QUARTERS.length - 1].year}`;
    const downloadFileStem =
        lang === 'en' ? `oil_by_rail_volume_${yearSpanLabel}` : `volume_petrole_voie_ferree_${yearSpanLabel}`;
    const exportChartTitle = `${stripHtml(getText('oil_by_rail_title', lang))} — ${chartTitlePlain} (${yearSpanLabel})`;

    const tableColumns = useMemo(() => [
        { key: 'period', header: getText('oil_by_rail_table_col_period', lang), align: 'left' },
        { key: 'exports', header: getText('oil_by_rail_table_col_exports', lang), align: 'num' },
        { key: 'domestic', header: getText('oil_by_rail_table_col_domestic', lang), align: 'num' },
    ], [lang]);

    const tableRows = useMemo(
        () =>
            quarters.map((q) => ({
                period: `${q.year} Q${q.quarter}`,
                exports: q.exportVal,
                domestic: q.domesticAnnual,
            })),
        [quarters],
    );

    const getChartSummary = () => {
        if (!quarters.length) return '';
        const body = summarizeByCategory({
            categories: quarters.map((q) => `${q.year} Q${q.quarter}`),
            series: [
                { name: exportLabel, values: quarters.map((q) => q.exportVal), format: formatNumber },
                { name: domesticLabel, values: quarters.map((q) => q.domesticAnnual), format: formatNumber },
            ],
            lang,
            newestFirst: true,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Combined bar and line chart of oil by rail volumes for ${yearSpanLabel}`
                : `Graphique combiné (barres et ligne) des volumes de pétrole transporté par train pour ${yearSpanLabel}`,
            unitNote: lang === 'en'
                ? 'Values in thousand barrels per day. Domestic values are annual'
                : 'Valeurs en milliers de barils par jour. Les valeurs intérieures sont annuelles',
            body,
        });
    };


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

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${downloadFileStem}.png`,
        title: exportChartTitle,
        height: 640,
        legendItems: [
            { label: exportLabel, color: BAR_COLORS[2] },
            { label: domesticLabel, color: LINE_COLOR },
        ],
    }),
        [BAR_COLORS, LINE_COLOR, domesticLabel, downloadFileStem, exportChartTitle, exportLabel],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        name: getText('oil_by_rail_download_chart', lang),
        click: (gd) => downloadChartWithTitle(gd),
    });

    const xIndices = quarters.map((q) => q.idx);
    const exportVals = quarters.map((q) => q.exportVal);
    const barColors = quarters.map((q) => BAR_COLORS[(q.quarter - 1) % 4]);
    const quarterTicktext = quarters.map((q) => `Q${q.quarter}`);

    const oilByRailPlotTraces = useMemo(
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

    

    return (
        <PageShell tabIndex="-1"
            className="page-content page-119 page-chrome page-chrome--bleed"
            lang={lang}
            aria-labelledby="oil-by-rail-main-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
                .page-119.page-content {
                    max-width: none !important;
                    overflow-x: visible !important;
                }
                .page-119 {
                }
                .oil-by-rail-container {
                    width: 100%;
                    padding: 15px 0 40px 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                }
                .page-119.page-content h1.oil-by-rail-title {
                    font-size: 41px !important;
                }
                .page-119 p.oil-by-rail-para {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    color: var(--gc-text);
                    line-height: 1.5;
                    margin: 0 0 16px 0;
                }
                .oil-by-rail-chart-frame {
                    margin-top: 8px;
                }
                .oil-by-rail-chart-block {
                    display: flex;
                    flex-direction: column;
                    align-items: stretch;
                    width: 100%;
                }
                .oil-by-rail-chart-title {
                    color: var(--gc-text);
                    margin: 0 0 12px 0;
                }
                .oil-by-rail-legend {
                    display: flex;
                    justify-content: center;
                    margin-top: -28px;
                    margin-bottom: 12px;
                    font-family: 'Noto Sans', sans-serif;
                    padding: 4px 16px 8px;
                }
                .oil-by-rail-legend-inner {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 15px 40px;
                    justify-content: center;
                }
                .oil-by-rail-legend-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .oil-by-rail-legend-swatch-bar {
                    width: 22px;
                    height: 14px;
                    flex-shrink: 0;
                    background-color: ${BAR_COLORS[2]};
                }
                .oil-by-rail-legend-line {
                    width: 28px;
                    height: 0;
                    border-top: 3px solid ${LINE_COLOR};
                    position: relative;
                    flex-shrink: 0;
                }
                .oil-by-rail-legend-line::after {
                    content: '';
                    position: absolute;
                    width: 8px;
                    height: 8px;
                    background: ${LINE_COLOR};
                    left: 10px;
                    top: -5px;
                }
                .oil-by-rail-legend-label {
                    font-size: 18px;
                    color: var(--gc-text);
                }
                .oil-by-rail-table-wrapper {
                    display: block;
                    width: 100%;
                    margin-top: 20px;
                    margin-bottom: 0;
                }
                .oil-by-rail-table-wrapper details > summary {
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
                .oil-by-rail-table-wrapper details > summary::-webkit-details-marker {
                    display: none;
                }
                .oil-by-rail-table-wrapper details > summary::marker {
                    display: none;
                    content: '';
                }
                .oil-by-rail-table-wrapper details > summary:hover {
                    background-color: #404040 !important;
                }
                @media (max-width: 768px) {
                    .page-119.page-content h1.oil-by-rail-title {
                        font-size: 37px !important;
                    }
                    .page-119 p.oil-by-rail-para {
                        font-size: 18px;
                    }
                    .oil-by-rail-legend-label {
                        font-size: 16px;
                    }
                    .oil-by-rail-legend {
                        margin-top: -22px;
                    }
                }
            `}</style>

            <div className="oil-by-rail-container">
                <h1 id="oil-by-rail-main-title" className="oil-by-rail-title page-chrome-title">
                    {getText('oil_by_rail_title', lang)}
                </h1>
                <p className="oil-by-rail-para">{getText('oil_by_rail_para1', lang)}</p>
                <p className="oil-by-rail-para">{getText('oil_by_rail_para2', lang)}</p>
                <p className="oil-by-rail-para">{getText('oil_by_rail_para3', lang)}</p>

                <div className="oil-by-rail-chart-frame page-chrome-chart-frame">
                    <h2 className="oil-by-rail-chart-title page-chrome-chart-title">{getText('oil_by_rail_chart_title', lang)}</h2>

                    <div className="oil-by-rail-chart-block">
                    <div role="region" aria-label={`${chartTitlePlain}. ${getChartSummary()}`} tabIndex="0">
                        {chartFocus !== null && (
                            <ClearSelectionButton lang={lang} onClick={() => setChartFocus(null)} />
                        )}
                        <figure ref={chartRef} style={{ margin: 0, position: 'relative' }}>
                            <div aria-hidden="true">
                                <Plot
                                    data={oilByRailPlotTraces}
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
                                                text: getText('oil_by_rail_yaxis', lang),
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
                                    config={plotConfig}
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

                    <div className="oil-by-rail-legend" aria-hidden="true">
                        <div className="oil-by-rail-legend-inner">
                            <div className="oil-by-rail-legend-item">
                                <span className="oil-by-rail-legend-swatch-bar" />
                                <span className="oil-by-rail-legend-label">{exportLabel}</span>
                            </div>
                            <div className="oil-by-rail-legend-item">
                                <span className="oil-by-rail-legend-line" />
                                <span className="oil-by-rail-legend-label">{domesticLabel}</span>
                            </div>
                        </div>
                    </div>
                    </div>

                    <div className="oil-by-rail-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            className="oil-by-rail-data-table"
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={`${downloadFileStem}.csv`}
                            docx={{
                                filename: `${downloadFileStem}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [2800, 2200, 2200],
                                fontSize: 22,
                            }}
                            caption={getText('oil_by_rail_table_caption', lang)}
                            tableAriaLabel={getText('oil_by_rail_table_caption', lang)}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0
                                    ? String(raw ?? '')
                                    : raw == null
                                      ? '\u2014'
                                      : formatNumber(raw)
                            )}
                        />
                    </div>
                </div>

                <PageFootnotes
                    lang={lang}
                    titleId="fn-oil-by-rail"
                    items={[{
                        id: 'fn-asterisk-oil-by-rail',
                        marker: '*',
                        text: getText('oil_by_rail_footnote', lang),
                        hideReturn: true,
                    }]}
                />
            </div>
        </PageShell>
    );
};

export default OilByRail;
