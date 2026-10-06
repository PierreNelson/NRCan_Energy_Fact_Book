import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';

const canada_global_energy_trade_CAT_ORDER = [
    'coal',
    'crude',
    'rpp',
    'gas',
    'ngl',
    'uranium',
    'electricity',
    'biofuels',
    'other',
];

/** Fixed download basename: canadas-global-energy-trade-{min}-{max} */
const canada_global_energy_trade_EXPORT_FILE_BASE = 'canadas-global-energy-trade';

const canada_global_energy_trade_COLORS = {
    coal: '#6B4423',
    crude: '#2A9BA7',
    rpp: '#1B4F72',
    gas: '#8B1538',
    ngl: '#D87118',
    uranium: '#699933',
    electricity: '#A48A13',
    biofuels: '#D81B60',
    other: '#7f8c8d',
};

const canada_global_energy_trade_DATA = [
    {
        year: 2017,
        totalExp: 169,
        totalImp: 71,
        exp_coal: 8.45,
        imp_coal: 7.1,
        exp_crude: 81.12,
        imp_crude: 14.2,
        exp_rpp: 25.35,
        imp_rpp: 21.3,
        exp_gas: 16.9,
        imp_gas: 8.52,
        exp_ngl: 11.83,
        imp_ngl: 3.55,
        exp_uranium: 4.225,
        imp_uranium: 0.568,
        exp_electricity: 9.295,
        imp_electricity: 7.1,
        exp_biofuels: 3.38,
        imp_biofuels: 2.84,
        exp_other: 8.45,
        imp_other: 5.822,
    },
    {
        year: 2018,
        totalExp: 171,
        totalImp: 71,
        exp_coal: 8.55,
        imp_coal: 7.1,
        exp_crude: 82.08,
        imp_crude: 14.2,
        exp_rpp: 25.65,
        imp_rpp: 21.3,
        exp_gas: 17.1,
        imp_gas: 8.52,
        exp_ngl: 11.97,
        imp_ngl: 3.55,
        exp_uranium: 4.275,
        imp_uranium: 0.568,
        exp_electricity: 9.405,
        imp_electricity: 7.1,
        exp_biofuels: 3.42,
        imp_biofuels: 2.84,
        exp_other: 8.55,
        imp_other: 5.822,
    },
    {
        year: 2019,
        totalExp: 186,
        totalImp: 69,
        exp_coal: 9.3,
        imp_coal: 6.9,
        exp_crude: 89.28,
        imp_crude: 13.8,
        exp_rpp: 27.9,
        imp_rpp: 20.7,
        exp_gas: 18.6,
        imp_gas: 8.28,
        exp_ngl: 13.02,
        imp_ngl: 3.45,
        exp_uranium: 4.65,
        imp_uranium: 0.552,
        exp_electricity: 10.23,
        imp_electricity: 6.9,
        exp_biofuels: 3.72,
        imp_biofuels: 2.76,
        exp_other: 9.3,
        imp_other: 5.658,
    },
    {
        year: 2020,
        totalExp: 182,
        totalImp: 64,
        exp_coal: 9.1,
        imp_coal: 6.4,
        exp_crude: 87.36,
        imp_crude: 12.8,
        exp_rpp: 27.3,
        imp_rpp: 19.2,
        exp_gas: 18.2,
        imp_gas: 7.68,
        exp_ngl: 12.74,
        imp_ngl: 3.2,
        exp_uranium: 4.55,
        imp_uranium: 0.512,
        exp_electricity: 10.01,
        imp_electricity: 6.4,
        exp_biofuels: 3.64,
        imp_biofuels: 2.56,
        exp_other: 9.1,
        imp_other: 5.248,
    },
    {
        year: 2021,
        totalExp: 191,
        totalImp: 66,
        exp_coal: 9.55,
        imp_coal: 6.6,
        exp_crude: 91.68,
        imp_crude: 13.2,
        exp_rpp: 28.65,
        imp_rpp: 19.8,
        exp_gas: 19.1,
        imp_gas: 7.92,
        exp_ngl: 13.37,
        imp_ngl: 3.3,
        exp_uranium: 4.775,
        imp_uranium: 0.528,
        exp_electricity: 10.505,
        imp_electricity: 6.6,
        exp_biofuels: 3.82,
        imp_biofuels: 2.64,
        exp_other: 9.55,
        imp_other: 5.412,
    },
    {
        year: 2022,
        totalExp: 189,
        totalImp: 57,
        exp_coal: 9.45,
        imp_coal: 5.7,
        exp_crude: 90.72,
        imp_crude: 11.4,
        exp_rpp: 28.35,
        imp_rpp: 17.1,
        exp_gas: 18.9,
        imp_gas: 6.84,
        exp_ngl: 13.23,
        imp_ngl: 2.85,
        exp_uranium: 4.725,
        imp_uranium: 0.456,
        exp_electricity: 10.395,
        imp_electricity: 5.7,
        exp_biofuels: 3.78,
        imp_biofuels: 2.28,
        exp_other: 9.45,
        imp_other: 4.674,
    },
    {
        year: 2023,
        totalExp: 195,
        totalImp: 58,
        exp_coal: 9.75,
        imp_coal: 5.8,
        exp_crude: 93.6,
        imp_crude: 11.6,
        exp_rpp: 29.25,
        imp_rpp: 17.4,
        exp_gas: 19.5,
        imp_gas: 6.96,
        exp_ngl: 13.65,
        imp_ngl: 2.9,
        exp_uranium: 4.875,
        imp_uranium: 0.464,
        exp_electricity: 10.725,
        imp_electricity: 5.8,
        exp_biofuels: 3.9,
        imp_biofuels: 2.32,
        exp_other: 9.75,
        imp_other: 4.756,
    },
    {
        year: 2024,
        totalExp: 208,
        totalImp: 56,
        exp_coal: 10.4,
        imp_coal: 5.6,
        exp_crude: 99.84,
        imp_crude: 11.2,
        exp_rpp: 31.2,
        imp_rpp: 16.8,
        exp_gas: 20.8,
        imp_gas: 6.72,
        exp_ngl: 14.56,
        imp_ngl: 2.8,
        exp_uranium: 5.2,
        imp_uranium: 0.448,
        exp_electricity: 11.44,
        imp_electricity: 5.6,
        exp_biofuels: 4.16,
        imp_biofuels: 2.24,
        exp_other: 10.4,
        imp_other: 4.592,
    },
];

const CanadaGlobalEnergyTrade = () => {
    const { lang } = useOutletContext();
    const windowWidth = useWindowWidth();
    const {
        selected: selectedSegments,
        clear: clearSelection,
        onPlotClick: handleChartClick,
        hasSelection,
    } = usePlotlySelection({
        mode: 'points',
        traceCount: canada_global_energy_trade_CAT_ORDER.length * 2,
        windowWidth,
    });
    const chartRef = useRef(null);
    /** Slot the chart flex column actually occupies — drives Plotly layout.width (fixes overflow when responsive is off). */
    const chartSlotRef = useRef(null);
    const calloutsRef = useRef(null);
    const [arrowMetrics, setArrowMetrics] = useState(null);
    /** Measured width of .canada-global-energy-trade-chart-main (not window.innerWidth — excludes callout column + padding). */
    const [plotSlotWidth, setPlotSlotWidth] = useState(null);
    /** Pinch / mobile visualViewport.scale only (often stays 1 during desktop Ctrl+ zoom). */
    const [viewportScale, setViewportScale] = useState(1);
    /**
     * Zoom factor for layout tweaks: max(visualViewport.scale, inferred desktop zoom).
     * Desktop browser zoom does not raise visualViewport.scale in most browsers; we infer from
     * screen width vs innerWidth when the layout viewport is unusually narrow (not media queries).
     */
    const [effectiveZoom, setEffectiveZoom] = useState(1);

    const years = useMemo(() => canada_global_energy_trade_DATA.map((r) => r.year), []);

    useLayoutEffect(() => {
        const el = chartSlotRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const measure = () => {
            const w = el.getBoundingClientRect().width;
            if (!(w > 0)) return;
            const rounded = Math.max(160, Math.floor(w));
            setPlotSlotWidth((prev) => (prev === rounded ? prev : rounded));
        };
        measure();
        const ro = new ResizeObserver(() => {
            requestAnimationFrame(measure);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        const vv = window.visualViewport;
        const syncPinch = () => setViewportScale(vv && vv.scale > 0 ? vv.scale : 1);
        const syncEffective = () => {
            const iw = window.innerWidth;
            const pinch = vv && vv.scale > 0 ? vv.scale : 1;
            let z = pinch;
            /** Browsers that shrink vv on Ctrl+ zoom (not all do). */
            if (vv && vv.width > 0 && iw > 0) {
                const layoutZoom = iw / vv.width;
                if (layoutZoom > 1.02 && layoutZoom < 8) {
                    z = Math.max(z, layoutZoom);
                }
            }
            /** Many browsers keep vv.width ≈ iw during page zoom; infer from screen vs layout when (~) maximized. */
            const sw = window.screen?.width ?? 0;
            const avail = window.screen?.availWidth ?? 0;
            const ow = window.outerWidth;
            if (sw >= 1024 && iw > 0 && avail > 0 && ow >= avail * 0.88 && iw < sw * 0.92) {
                const inferredFull = sw / iw;
                if (inferredFull > 1.12 && inferredFull < 4) {
                    z = Math.max(z, inferredFull);
                }
            }
            if (pinch <= 1.02) {
                if (sw >= 1024 && iw > 0 && iw < 560) {
                    const inferred = sw / iw;
                    if (inferred > 1.12) z = Math.min(6, Math.max(z, inferred));
                }
            }
            setEffectiveZoom(z);
        };
        syncPinch();
        syncEffective();
        if (vv) {
            vv.addEventListener('resize', syncPinch);
            vv.addEventListener('scroll', syncPinch);
            vv.addEventListener('resize', syncEffective);
            vv.addEventListener('scroll', syncEffective);
        }
        window.addEventListener('resize', syncEffective);
        return () => {
            if (vv) {
                vv.removeEventListener('resize', syncPinch);
                vv.removeEventListener('scroll', syncPinch);
                vv.removeEventListener('resize', syncEffective);
                vv.removeEventListener('scroll', syncEffective);
            }
            window.removeEventListener('resize', syncEffective);
        };
    }, []);

    const canadaGlobalEnergyTradeYearRange = useMemo(() => ({ min: 2017, max: 2024 }), []);

    const canadaGlobalEnergyTradeExportStem = useMemo(
        () => `${canada_global_energy_trade_EXPORT_FILE_BASE}-${canadaGlobalEnergyTradeYearRange.min}-${canadaGlobalEnergyTradeYearRange.max}`,
        [canadaGlobalEnergyTradeYearRange.min, canadaGlobalEnergyTradeYearRange.max]
    );

    const formatBillions = useCallback(
        (n) => (lang === 'fr' ? Number(n).toLocaleString('fr-CA') : Number(n).toLocaleString('en-CA')),
        [lang]
    );

    const exportChartTitle = stripHtml(getText('canada_global_energy_trade_chart_title', lang));
    const chartSubtitle = getText('canada_global_energy_trade_chart_subtitle', lang);
    const unitText = lang === 'en' ? 'billions of dollars' : 'milliards de dollars';
    /** Title focus speaks the real subtitle wording (not a shortened "$ billions"). */
    const titleUnitSpoken = stripHtml(chartSubtitle).replace(/^\(|\)$/g, '').trim();
    const chartTitleSpoken = `${exportChartTitle}, ${titleUnitSpoken}`;

    /** Category rows per year, then a total row for that year (on-page table + CSV/DOCX). */
    const tableRowsWithTotals = useMemo(() => {
        const rows = [];
        for (const r of canada_global_energy_trade_DATA) {
            for (const key of canada_global_energy_trade_CAT_ORDER) {
                rows.push({
                    rowKind: 'category',
                    year: r.year,
                    categoryKey: key,
                    categoryLabel: getText(`canada_global_energy_trade_cat_${key}`, lang),
                    exports: r[`exp_${key}`],
                    imports: r[`imp_${key}`],
                });
            }
            rows.push({
                rowKind: 'total',
                year: r.year,
                categoryKey: 'total',
                categoryLabel: getText('canada_global_energy_trade_table_row_total', lang),
                exports: r.totalExp,
                imports: r.totalImp,
            });
        }
        return rows;
    }, [lang]);

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('canada_global_energy_trade_table_year', lang), align: 'left' },
        { key: 'categoryLabel', header: getText('canada_global_energy_trade_table_category', lang), align: 'left' },
        { key: 'exports', header: getText('canada_global_energy_trade_table_exports_b', lang), align: 'num' },
        { key: 'imports', header: getText('canada_global_energy_trade_table_imports_b', lang), align: 'num' },
    ], [lang]);

    const syncCalloutArrows = useCallback(() => {
        const calloutsEl = calloutsRef.current;
        const gd = chartRef.current?.querySelector('.js-plotly-plot');
        if (!calloutsEl || !gd?._fullLayout?.yaxis) return;
        const ya = gd._fullLayout.yaxis;
        const yMin = ya.range[0];
        const yMax = ya.range[1];
        if (yMax === yMin) return;
        const h = ya._length;
        if (typeof h !== 'number' || h <= 0) return;
        const zeroFromPlotTop = h * (yMax - 0) / (yMax - yMin);
        const plotAreaOffsetTop = typeof ya._offset === 'number' ? ya._offset : 0;
        const zeroFromCalloutsTop = Math.min(Math.max(zeroFromPlotTop, 8), Math.max(h - 8, 8));
        setArrowMetrics({
            zeroFromCalloutsTop,
            plotAreaMarginTop: plotAreaOffsetTop,
            plotAreaHeight: h,
        });
    }, []);

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${canadaGlobalEnergyTradeExportStem}.png`,
        title: exportChartTitle,
        height: 720,
    }),
        [canadaGlobalEnergyTradeExportStem, exportChartTitle],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const plotBundle = useMemo(() => {
        const barOpacityForTrace = (curveNumber) =>
            years.map((_, pointIndex) =>
                selectedSegments === null || selectedSegments[curveNumber]?.includes(pointIndex) ? 1 : 0.35
            );

        const traces = [];
        let curveNumber = 0;
        for (const key of canada_global_energy_trade_CAT_ORDER) {
            const color = canada_global_energy_trade_COLORS[key];
            traces.push({
                type: 'bar',
                x: years,
                y: canada_global_energy_trade_DATA.map((r) => r[`exp_${key}`]),
                name: getText(`canada_global_energy_trade_cat_${key}`, lang),
                legendgroup: key,
                marker: { color, opacity: barOpacityForTrace(curveNumber), line: { width: 0 } },
                stackgroup: 'exp',
                hovertemplate:
                    lang === 'fr'
                        ? `<b>%{x}</b><br>${getText(`canada_global_energy_trade_cat_${key}`, lang)}<br>%{y:.2f} Md$<extra></extra>`
                        : `<b>%{x}</b><br>${getText(`canada_global_energy_trade_cat_${key}`, lang)}<br>$%{y:.2f}B<extra></extra>`,
            });
            curveNumber += 1;
        }
        for (const key of canada_global_energy_trade_CAT_ORDER) {
            const color = canada_global_energy_trade_COLORS[key];
            traces.push({
                type: 'bar',
                x: years,
                y: canada_global_energy_trade_DATA.map((r) => -r[`imp_${key}`]),
                name: getText(`canada_global_energy_trade_cat_${key}`, lang),
                legendgroup: key,
                showlegend: false,
                marker: { color, opacity: barOpacityForTrace(curveNumber), line: { width: 0 } },
                stackgroup: 'imp',
                hovertemplate:
                    lang === 'fr'
                        ? `<b>%{x}</b><br>${getText(`canada_global_energy_trade_cat_${key}`, lang)}<br>%{customdata:.2f} Md$<extra></extra>`
                        : `<b>%{x}</b><br>${getText(`canada_global_energy_trade_cat_${key}`, lang)}<br>$%{customdata:.2f}B<extra></extra>`,
                customdata: canada_global_energy_trade_DATA.map((r) => r[`imp_${key}`]),
            });
            curveNumber += 1;
        }

        const yMinAxis = -92;
        const yMaxAxis = 232;
        const yTickStep = 20;
        const yTickVals = [];
        for (let v = Math.ceil(yMinAxis / yTickStep) * yTickStep; v <= yMaxAxis + 1e-9; v += yTickStep) {
            yTickVals.push(v);
        }
        const yTickText = yTickVals.map((v) => (v < 0 ? String(Math.abs(v)) : String(v)));

        const baseAxisTickPx = windowWidth <= 480 ? 12 : 16;
        /** ~400% zoom: smaller ticks/labels to reduce overlap; ~500% zoom: one step smaller again. */
        const axisTickFontSize =
            effectiveZoom >= 5
                ? (windowWidth <= 480 ? 8 : 9)
                : effectiveZoom >= 4
                  ? (windowWidth <= 480 ? 9 : 10)
                  : baseAxisTickPx;
        const axisTicksNormalWeight = effectiveZoom >= 4;
        const axisTickFont = {
            size: axisTickFontSize,
            family: 'Arial, sans-serif',
            color: '#000000',
            ...(axisTicksNormalWeight ? { weight: 'normal' } : {}),
        };
        const barTotalsMatchAxisTicks = effectiveZoom >= 4;
        const barTotalFontSize =
            effectiveZoom >= 5 ? Math.max(8, axisTickFontSize - 1) : axisTickFontSize;
        const annotations = canada_global_energy_trade_DATA.map((r) => {
            const expText = lang === 'fr' ? `${r.totalExp} $` : `$${r.totalExp}`;
            const impText = lang === 'fr' ? `${r.totalImp} $` : `$${r.totalImp}`;
            const bold2019 = r.year === 2019;
            const bold2024 = r.year === 2024;
            const expSize = barTotalsMatchAxisTicks
                ? barTotalFontSize
                : bold2019 || bold2024
                  ? 13
                  : 12;
            const impSize = barTotalsMatchAxisTicks ? barTotalFontSize : r.year === 2017 ? 13 : 12;
            return [
                {
                    x: r.year,
                    y: r.totalExp + 6,
                    text: expText,
                    showarrow: false,
                    font: {
                        family: 'Arial, sans-serif',
                        size: expSize,
                        color: '#000000',
                        ...(axisTicksNormalWeight ? { weight: 'normal' } : {}),
                    },
                },
                {
                    x: r.year,
                    y: -r.totalImp - 6,
                    text: impText,
                    showarrow: false,
                    font: {
                        family: 'Arial, sans-serif',
                        size: impSize,
                        color: '#000000',
                        ...(axisTicksNormalWeight ? { weight: 'normal' } : {}),
                    },
                },
            ];
        }).flat();
        const baseYTitlePx = windowWidth <= 480 ? 14 : 18;
        const yTitleFontSize =
            effectiveZoom >= 5
                ? Math.max(9, baseYTitlePx - 6)
                : effectiveZoom >= 4
                  ? Math.max(10, baseYTitlePx - 4)
                  : baseYTitlePx;
        const legendFontSize = windowWidth <= 640 ? 11 : windowWidth <= 900 ? 12 : axisTickFontSize;
        /** Smooth functions of width avoid staircase jumps at zoom breakpoints (overlap vs huge gap). */
        const wPlot = Math.max(340, windowWidth);
        const bottomMargin = Math.round(
            Math.min(318, Math.max(228, 168 + 118000 / wPlot))
        );
        const legendBlend = Math.min(1, Math.max(0, (1280 - wPlot) / (1280 - 380)));
        const legendY = -0.21 - 0.22 * legendBlend;
        const plotHeight =
            windowWidth <= 400 ? 520 : windowWidth <= 640 ? 560 : windowWidth <= 900 ? 600 : windowWidth <= 1100 ? 620 : 640;
        /** Match the flex chart column; default guesses callouts + frame padding until ResizeObserver runs. */
        const layoutWidth = plotSlotWidth ?? Math.max(200, windowWidth - 220);

        const layout = {
            autosize: false,
            width: layoutWidth,
            barmode: 'relative',
            bargap: 0.22,
            clickmode: 'event',
            hoverlabel: {
                bgcolor: '#ffffff',
                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
            },
            xaxis: {
                type: 'linear',
                tickmode: 'array',
                tickvals: years,
                ticktext: years.map(String),
                tickfont: { ...axisTickFont },
                showgrid: false,
                zeroline: false,
                automargin: true,
            },
            yaxis: {
                range: [yMinAxis, yMaxAxis],
                tickmode: 'array',
                tickvals: yTickVals,
                ticktext: yTickText,
                tickfont: { ...axisTickFont },
                gridcolor: '#dddddd',
                zeroline: true,
                zerolinewidth: 2,
                zerolinecolor: '#000000',
                automargin: true,
                title: {
                    text: getText('canada_global_energy_trade_yaxis_title', lang),
                    font: {
                        size: yTitleFontSize,
                        family: 'Arial, sans-serif',
                        color: '#000000',
                        ...(axisTicksNormalWeight ? { weight: 'normal' } : {}),
                    },
                    standoff: 15,
                },
            },
            legend: {
                orientation: 'h',
                y: legendY,
                yanchor: 'top',
                x: 0.5,
                xanchor: 'center',
                font: { size: legendFontSize, family: 'Arial, sans-serif', color: '#000000' },
                traceorder: 'normal',
            },
            margin: { l: 58, r: 8, t: 24, b: bottomMargin },
            height: plotHeight,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: '#fafafa',
            showlegend: true,
            annotations,
            hovermode: 'closest',
        };

        return { data: traces, layout };
    }, [lang, years, selectedSegments, windowWidth, effectiveZoom, plotSlotWidth]);

    useEffect(() => {
        if (!chartRef?.current) return;
        const plotContainer = chartRef.current;
        const setup = () => {
            const svgElements = plotContainer.querySelectorAll('.main-svg, .svg-container svg');
            svgElements.forEach((svg) => svg.setAttribute('aria-hidden', 'true'));
            const modebarButtons = plotContainer.querySelectorAll('.modebar-btn');
            modebarButtons.forEach((btn) => {
                const dataTitle = btn.getAttribute('data-title');
                if (dataTitle && (dataTitle.includes('Download') || dataTitle.includes('Télécharger'))) {
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
        const t = setTimeout(setup, 500);
        const observer = new MutationObserver(setup);
        observer.observe(plotContainer, { childList: true, subtree: true });
        return () => {
            clearTimeout(t);
            observer.disconnect();
        };
    }, [lang]);

    const scheduleArrowSync = useCallback(() => {
        requestAnimationFrame(() => {
            setTimeout(syncCalloutArrows, 0);
        });
    }, [syncCalloutArrows]);

    useLayoutEffect(() => {
        scheduleArrowSync();
        window.addEventListener('resize', scheduleArrowSync);
        const node = chartRef.current;
        const ro =
            typeof ResizeObserver !== 'undefined' && node
                ? new ResizeObserver(() => scheduleArrowSync())
                : null;
        if (node && ro) ro.observe(node);
        return () => {
            window.removeEventListener('resize', scheduleArrowSync);
            ro?.disconnect();
        };
    }, [
        scheduleArrowSync,
        plotBundle.layout?.height,
        plotBundle.layout?.width,
        windowWidth,
        effectiveZoom,
        selectedSegments,
        lang,
        plotSlotWidth,
    ]);

    const showCalloutBrackets = Boolean(arrowMetrics && arrowMetrics.plotAreaHeight > 50);
    const vvForLayout = Math.min(Math.max(effectiveZoom, 1), 4);
    /** Positive = move modebar down (clear subtitle); avoid negative values that pull it into the title line. */
    const modebarTranslateYPx = effectiveZoom >= 4 ? 6 : 4;
    /** Vertical when zoomed or narrow layout (≤560px catches ~400% zoom on typical desktop widths). */
    const useVerticalCalloutLabels =
        effectiveZoom >= 4 || windowWidth <= 560 || viewportScale >= 1.55;
    /**
     * Short callout copy matches vertical/narrow/high-zoom; imports bracket must use calloutImportsKey (not hardcoded).
     * Width ≤640: short text whenever horizontal wrap would show long clipped strings.
     * effectiveZoom ≳1.45: ~140%+ page zoom (see syncEffective: vv ratio, screen/inner when maximized).
     */
    const useShortCalloutLabels =
        useVerticalCalloutLabels || windowWidth <= 640 || effectiveZoom >= 1.45;
    const calloutExportsKey = useShortCalloutLabels ? 'canada_global_energy_trade_callout_exports_500' : 'canada_global_energy_trade_callout_exports';
    const calloutImportsKey = useShortCalloutLabels ? 'canada_global_energy_trade_callout_imports_500' : 'canada_global_energy_trade_callout_imports';
    const modebarScale = Math.min(1, 1.25 / vvForLayout);

    /** One word per line in vertical callouts (matches imports wrapping); only short keys + vertical. */
    const canadaGlobalEnergyTradeCalloutDisplayText = useCallback(
        (key) => {
            const raw = getText(key, lang);
            if (!useVerticalCalloutLabels || !useShortCalloutLabels) return raw;
            if (key === 'canada_global_energy_trade_callout_exports_500') {
                return lang === 'fr' ? 'Exportations\nénergétiques\ndu Canada' : "Canada's\nenergy\nexports";
            }
            if (key === 'canada_global_energy_trade_callout_imports_500') {
                return lang === 'fr' ? 'Importations\nénergétiques\ndu Canada' : "Canada's\nenergy\nimports";
            }
            return raw;
        },
        [lang, useVerticalCalloutLabels, useShortCalloutLabels]
    );

    const getChartSummary = () => {
        const totalExportsLabel = lang === 'en' ? 'Total exports' : 'Total des exportations';
        const totalImportsLabel = lang === 'en' ? 'Total imports' : 'Total des importations';
        const body = summarizeByCategory({
            categories: years,
            series: [
                {
                    name: totalExportsLabel,
                    values: canada_global_energy_trade_DATA.map((r) => r.totalExp),
                    format: (v) => `${formatBillions(v)} ${unitText}`,
                },
                {
                    name: totalImportsLabel,
                    values: canada_global_energy_trade_DATA.map((r) => r.totalImp),
                    format: (v) => `${formatBillions(v)} ${unitText}`,
                },
            ],
            lang,
            newestFirst: true,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Bar chart of Canada's global energy trade across ${years[0]}–${years[years.length - 1]}`
                : `Graphique à barres du commerce énergétique mondial du Canada de ${years[0]} à ${years[years.length - 1]}`,
            body,
            lang,
        });
    };
    const chartRegionLabel = `${getText('canada_global_energy_trade_chart_aria', lang)}. ${getChartSummary()}`;

    return (
        <PageShell
            id="main-content"
            tabIndex="-1"
            className="page-content page-15"
            role="main"
            aria-labelledby="canada-global-energy-trade-heading"
            style={{
                backgroundColor: 'white',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',
                boxSizing: 'border-box',
            }}
        >
            <style>{`
.page-15 { width: 100%; }
/* Plotly SVG often ignores font.weight; force normal tick labels at ≥400% zoom (see data-canada-global-energy-trade-high-zoom). */
.page-content.page-15[data-canada-global-energy-trade-high-zoom="true"] .js-plotly-plot .plotly g.xtick text,
.page-content.page-15[data-canada-global-energy-trade-high-zoom="true"] .js-plotly-plot .plotly g.ytick text,
.page-content.page-15[data-canada-global-energy-trade-high-zoom="true"] .js-plotly-plot .plotly g.xtick tspan,
.page-content.page-15[data-canada-global-energy-trade-high-zoom="true"] .js-plotly-plot .plotly g.ytick tspan {
    font-weight: normal !important;
}
.canada-global-energy-trade-container { width: 100%; padding: 15px 0 0 0; box-sizing: border-box; }
.canada-global-energy-trade-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    padding-bottom: 20px;
    padding-right: max(20px, 2vw);
    border-radius: 8px;
    margin-bottom: 20px;
    box-sizing: border-box;
    overflow: visible;
}
@media (max-width: 560px) {
    .canada-global-energy-trade-chart-frame {
        padding-right: max(14px, 3vw);
    }
}
.canada-global-energy-trade-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 15px 0;
    padding-left: 15px;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: fit-content;
    max-width: 100%;
    margin-left: auto;
    margin-right: auto;
}
.canada-global-energy-trade-chart-subtitle {
    display: block;
    font-family: 'Noto Sans', sans-serif !important;
    font-size: clamp(16px, 2.4vw, 20px) !important;
    font-weight: 400 !important;
    color: var(--gc-text);
    text-align: center;
    margin: 5px 0 0 0 !important;
}
.canada-global-energy-trade-chart-row {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    flex-wrap: nowrap;
    gap: 2px;
    width: 100%;
    min-height: 0;
    overflow: visible;
    margin-bottom: 0;
}
.canada-global-energy-trade-chart-main {
    flex: 1 1 auto;
    min-width: 0;
    position: relative;
}
.canada-global-energy-trade-callouts {
    font-family: 'Noto Sans', sans-serif;
    line-height: 1.35;
    color: var(--gc-text);
    box-sizing: border-box;
}
/* Callout font: viewport width only (browser zoom narrows the layout viewport). Aligns with Plotly tickfont: 16px >480px, 12px ≤480px; one step smaller when very narrow. */
.page-content.page-15 .canada-global-energy-trade-callouts {
    font-size: 16px;
}
@media (max-width: 480px) {
    .page-content.page-15 .canada-global-energy-trade-callouts {
        font-size: 12px;
    }
}
@media (max-width: 400px) {
    .page-content.page-15 .canada-global-energy-trade-callouts {
        font-size: 11px;
    }
}
.canada-global-energy-trade-callouts--brackets {
    flex: 0 1 auto;
    width: min(32%, 7.75rem);
    min-width: 6.5rem;
    max-width: 9rem;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 0 0 0 1px;
    overflow: hidden;
}
/* Tight column: max-content was inflating width and adding a huge gap before labels. */
.canada-global-energy-trade-callouts--brackets.canada-global-energy-trade-callouts--vertical-labels {
    overflow: visible;
    width: auto;
    min-width: 2.5rem;
    max-width: 4rem;
    flex: 0 0 auto;
    flex-shrink: 0;
    padding: 0 2px 0 0;
    box-sizing: border-box;
}
.canada-global-energy-trade-callout-split {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    gap: clamp(2px, 0.5vw, 6px);
    min-height: 0;
}
.canada-global-energy-trade-callout-split--exports { flex-shrink: 0; }
.canada-global-energy-trade-callout-split--imports {
    flex: 1;
    min-height: 56px;
}
.canada-global-energy-trade-bracket {
    position: relative;
    width: 12px;
    flex-shrink: 0;
    align-self: stretch;
}
.canada-global-energy-trade-bracket-line--up {
    position: absolute;
    right: 0;
    top: 6px;
    bottom: 5px;
    width: var(--canada-global-energy-trade-bracket-line, 2px);
    background: #222;
}
.canada-global-energy-trade-bracket-cap--up {
    position: absolute;
    right: -2px;
    top: 0;
    width: 0;
    height: 0;
    border-left: 3px solid transparent;
    border-right: 3px solid transparent;
    border-bottom: 6px solid #222;
}
.canada-global-energy-trade-bracket-line--down {
    position: absolute;
    right: 0;
    top: 5px;
    bottom: 6px;
    width: var(--canada-global-energy-trade-bracket-line, 2px);
    background: #222;
}
.canada-global-energy-trade-bracket-cap--down {
    position: absolute;
    right: -2px;
    bottom: 0;
    width: 0;
    height: 0;
    border-left: 3px solid transparent;
    border-right: 3px solid transparent;
    border-top: 6px solid #222;
}
.canada-global-energy-trade-callout-label {
    margin: 0;
    flex: 1;
    align-self: flex-start;
    padding-top: 1px;
    font-size: inherit;
    line-height: 1.25;
    word-break: normal;
    overflow-wrap: normal;
    hyphens: manual;
}
/* Beat .page-content p { font-size: 20px }; size comes from .canada-global-energy-trade-callouts media queries above. */
.page-content.page-15 .canada-global-energy-trade-callouts .canada-global-energy-trade-callout-label {
    font-size: inherit;
    line-height: 1.35;
}
.page-content.page-15 .canada-global-energy-trade-callouts .canada-global-energy-trade-callout-simple {
    font-size: inherit;
    line-height: 1.35;
}
.canada-global-energy-trade-callouts--vertical-labels .canada-global-energy-trade-callout-label {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    align-self: center;
    max-height: none;
    overflow: visible;
    flex: 0 0 auto;
    padding-top: 0;
    padding-right: 0;
    margin: 0;
    letter-spacing: 0.01em;
    white-space: pre-line;
}
.canada-global-energy-trade-callouts--vertical-labels .canada-global-energy-trade-callout-split {
    gap: 0;
}
.canada-global-energy-trade-callouts--vertical-labels .canada-global-energy-trade-bracket {
    width: 8px;
    flex-shrink: 0;
}
.canada-global-energy-trade-callouts--simple {
    flex: 0 1 auto;
    width: min(30%, 7rem);
    min-width: 6.25rem;
    max-width: 8.5rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 4px 0 12px 0;
    overflow: hidden;
}
.canada-global-energy-trade-callouts--simple.canada-global-energy-trade-callouts--vertical-labels {
    overflow: visible;
    min-width: 2.5rem;
    max-width: 4rem;
    width: auto;
    flex-shrink: 0;
    padding: 2px 2px 8px 0;
}
.canada-global-energy-trade-callouts--vertical-labels.canada-global-energy-trade-callouts--simple .canada-global-energy-trade-callout-simple {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    min-height: 0;
    max-height: none;
    overflow: visible;
    font-size: inherit;
    line-height: 1.2;
}
.canada-global-energy-trade-callouts--vertical-labels.canada-global-energy-trade-callouts--simple .canada-global-energy-trade-callout-arrow {
    display: inline;
    margin-bottom: 0;
}
.canada-global-energy-trade-callout-simple { min-height: 1.5em; }
.canada-global-energy-trade-callout-arrow {
    font-size: 1.25em;
    line-height: 1;
    display: block;
    margin-bottom: 2px;
}
.canada-global-energy-trade-map-wrap { width: 100%; position: relative; min-height: 400px; }
.canada-global-energy-trade-map-wrap .js-plotly-plot .plotly .modebar {
    top: -14px !important;
    right: 4px !important;
    left: auto !important;
    transform: translateY(var(--canada-global-energy-trade-modebar-translate-y, 0px)) scale(var(--canada-global-energy-trade-modebar-scale, 1));
    transform-origin: top right;
}
.canada-global-energy-trade-table-wrapper {
    display: block;
    width: 100%;
    margin: 0 0 48px 0;
    clear: both;
    position: relative;
}
.canada-global-energy-trade-table-wrapper button[type="button"]:hover,
.canada-global-energy-trade-table-wrapper button:hover,
.canada-global-energy-trade-chart-frame button[type="button"]:hover,
.canada-global-energy-trade-chart-frame button:hover { background-color: #404040 !important; }
.canada-global-energy-trade-summary {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: #332f30;
    line-height: 1.5;
    margin-top: 8px;
}
.canada-global-energy-trade-summary--below-frame {
    margin-top: 50px;
    margin-bottom: 0;
    clear: both;
}
@media (max-width: 900px) {
    .canada-global-energy-trade-chart-title { font-size: clamp(22px, 4.5vw, 26px); }
}
@media (max-width: 768px) {
    .canada-global-energy-trade-chart-title { font-size: 26px; }
    .canada-global-energy-trade-chart-subtitle { font-size: 18px; }
    .canada-global-energy-trade-summary { font-size: 18px; }
}
            `}</style>
            <div className="canada-global-energy-trade-container">
                <div className="canada-global-energy-trade-chart-frame">
                    <h1
                        id="canada-global-energy-trade-heading"
                        className="canada-global-energy-trade-chart-title"
                        aria-labelledby="canada-global-energy-trade-heading-spoken"
                    >
                        <span id="canada-global-energy-trade-heading-spoken" className="wb-inv">
                            {chartTitleSpoken}
                        </span>
                        <span aria-hidden="true">{getText('canada_global_energy_trade_chart_title', lang)}</span>
                        <span className="canada-global-energy-trade-chart-subtitle" aria-hidden="true">
                            {chartSubtitle}
                        </span>
                    </h1>
                    {hasSelection && (
                        <ClearSelectionButton lang={lang} onClick={clearSelection} />
                    )}
                    <div
                        className="canada-global-energy-trade-chart-row"
                        style={{
                            '--canada-global-energy-trade-modebar-scale': String(modebarScale),
                            '--canada-global-energy-trade-modebar-translate-y': `${modebarTranslateYPx}px`,
                            '--canada-global-energy-trade-bracket-line': vvForLayout >= 2.2 ? '1.5px' : '2px',
                        }}
                    >
                        <div
                            ref={chartSlotRef}
                            className="canada-global-energy-trade-map-wrap canada-global-energy-trade-chart-main"
                            role="region"
                            aria-label={chartRegionLabel}
                            tabIndex="0"
                            style={{ minHeight: plotBundle.layout.height }}
                        >
                            <figure ref={chartRef} style={{ margin: 0, position: 'relative', width: '100%' }}>
                                <Plot
                                    data={plotBundle.data}
                                    layout={plotBundle.layout}
                                    config={plotConfig}
                                    style={{ width: '100%' }}
                                    onClick={handleChartClick}
                                    onInitialized={scheduleArrowSync}
                                    onAfterPlot={scheduleArrowSync}
                                />
                            </figure>
                        </div>
                        <div
                            ref={calloutsRef}
                            className={[
                                showCalloutBrackets ? 'canada-global-energy-trade-callouts canada-global-energy-trade-callouts--brackets' : 'canada-global-energy-trade-callouts canada-global-energy-trade-callouts--simple',
                                useVerticalCalloutLabels ? 'canada-global-energy-trade-callouts--vertical-labels' : '',
                            ]
                                .filter(Boolean)
                                .join(' ')}
                            style={
                                arrowMetrics?.plotAreaHeight != null
                                    ? {
                                          marginTop: arrowMetrics.plotAreaMarginTop ?? 0,
                                          height: arrowMetrics.plotAreaHeight,
                                          maxHeight: arrowMetrics.plotAreaHeight,
                                          alignSelf: 'flex-start',
                                      }
                                    : { alignSelf: 'flex-start' }
                            }
                        >
                            {showCalloutBrackets ? (
                                <>
                                    <div
                                        className="canada-global-energy-trade-callout-split canada-global-energy-trade-callout-split--exports"
                                        style={{ height: arrowMetrics.zeroFromCalloutsTop }}
                                    >
                                        <div className="canada-global-energy-trade-bracket" aria-hidden="true">
                                            <span className="canada-global-energy-trade-bracket-line canada-global-energy-trade-bracket-line--up" />
                                            <span className="canada-global-energy-trade-bracket-cap canada-global-energy-trade-bracket-cap--up" />
                                        </div>
                                        <p className="canada-global-energy-trade-callout-label">{canadaGlobalEnergyTradeCalloutDisplayText(calloutExportsKey)}</p>
                                    </div>
                                    <div className="canada-global-energy-trade-callout-split canada-global-energy-trade-callout-split--imports">
                                        <div className="canada-global-energy-trade-bracket" aria-hidden="true">
                                            <span className="canada-global-energy-trade-bracket-line canada-global-energy-trade-bracket-line--down" />
                                            <span className="canada-global-energy-trade-bracket-cap canada-global-energy-trade-bracket-cap--down" />
                                        </div>
                                        <p className="canada-global-energy-trade-callout-label">{canadaGlobalEnergyTradeCalloutDisplayText(calloutImportsKey)}</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="canada-global-energy-trade-callout-simple">
                                        <span className="canada-global-energy-trade-callout-arrow" aria-hidden="true">
                                            ↑
                                        </span>
                                        {canadaGlobalEnergyTradeCalloutDisplayText(calloutExportsKey)}
                                    </div>
                                    <div className="canada-global-energy-trade-callout-simple">
                                        <span className="canada-global-energy-trade-callout-arrow" aria-hidden="true">
                                            ↓
                                        </span>
                                        {canadaGlobalEnergyTradeCalloutDisplayText(calloutImportsKey)}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="canada-global-energy-trade-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRowsWithTotals}
                            csvFilename={`${canadaGlobalEnergyTradeExportStem}.csv`}
                            docx={{
                                filename: `${canadaGlobalEnergyTradeExportStem}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [1200, 4000, 2200, 2200],
                                fontSize: 22,
                            }}
                            caption={exportChartTitle}
                            tableAriaLabel={exportChartTitle}
                            renderCell={(raw, { row, colIndex }) => {
                                const text = colIndex <= 1 ? String(raw ?? '') : formatBillions(raw);
                                return row.rowKind === 'total' ? <strong>{text}</strong> : text;
                            }}
                        />
                    </div>
                </div>
                <p className="canada-global-energy-trade-summary canada-global-energy-trade-summary--below-frame">
                    {getText('canada_global_energy_trade_summary_before', lang)}
                    <strong>{getText('canada_global_energy_trade_summary_bold_exp', lang)}</strong>
                    {getText('canada_global_energy_trade_summary_mid', lang)}
                    <strong>{getText('canada_global_energy_trade_summary_bold_imp', lang)}</strong>
                    {getText('canada_global_energy_trade_summary_after', lang)}
                </p>
            </div>
        </PageShell>
    );
};

export default CanadaGlobalEnergyTrade;
