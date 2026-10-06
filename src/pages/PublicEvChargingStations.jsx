import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import FootnoteMarker from '../components/FootnoteMarker';
import ClearSelectionButton from '../components/ClearSelectionButton';
import PageFootnotes from '../components/PageFootnotes';
import useWindowWidth from '../hooks/useWindowWidth';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import hexToRgba from '../utils/hexToRgba';

import { makeScrollToIdHandler } from '../utils/scrollToId';
import { formatLocaleNumber, formatLocalePct } from '../utils/formatLocale';

const PIE_DATA_YEAR = 2026;
const BAR_START_YEAR = 2018;
const BAR_END_YEAR = 2025;

const SLICE_KEYS = ['level1', 'level2', 'level3'];

const SLICE_COLORS = {
    level1: '#A4C639',
    level2: '#F9B233',
    level3: '#2B5C3F',
};

const BAR_COLOR = '#2B5C3F';

/** Hardcoded until data pipeline is available — reference values from the published fact book. */
const PIE_HARDCODED_DATA = [
    {
        year: PIE_DATA_YEAR,
        total: 39000,
        slices: { level1: 0.1, level2: 78.3, level3: 21.6 },
    },
];

const BAR_HARDCODED_DATA = [
    { year: 2018, stations: 1118, growth: null },
    { year: 2019, stations: 3045, growth: 172 },
    { year: 2020, stations: 3775, growth: 22 },
    { year: 2021, stations: 5015, growth: 33 },
    { year: 2022, stations: 7105, growth: 42 },
    { year: 2023, stations: 9704, growth: 37 },
    { year: 2024, stations: 11934, growth: 23 },
    { year: 2025, stations: 13997, growth: 17 },
];

const HOVER_LABEL = {
    bgcolor: '#ffffff',
    bordercolor: '#000000',
    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
};


const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const BAR_YEARS = BAR_HARDCODED_DATA.map((row) => row.year);

const BAR_BARGAP = 0.25;

const findNearestBarIndex = (graphDiv, clientX, clientY, years = BAR_YEARS) => {
    if (!graphDiv?._fullLayout?._size || !years?.length) return null;

    const xaxis = graphDiv._fullLayout.xaxis;
    const rect = graphDiv.getBoundingClientRect();
    const size = graphDiv._fullLayout._size;
    const xPixel = clientX - rect.left;
    const yPixel = clientY - rect.top;
    if (xPixel < size.l || xPixel > size.l + size.w) return null;
    if (yPixel < size.t || yPixel > size.t + size.h) return null;

    const [xMin, xMax] = xaxis.range;
    const xInPlot = xPixel - size.l;
    const xData = xMin + (xInPlot / size.w) * (xMax - xMin);

    const yearStep = years.length > 1 ? Math.abs(years[1] - years[0]) : 1;
    const halfBand = (yearStep * (1 - BAR_BARGAP)) / 2;

    for (let index = 0; index < years.length; index += 1) {
        const year = years[index];
        if (xData >= year - halfBand && xData <= year + halfBand) return index;
    }

    return null;
};

const resolveBarPointIndex = (event, graphDiv, years = BAR_YEARS) => {
    const point = event?.points?.[0];
    if (point?.curveNumber === 0) {
        const fromIdx = point.pointIndex ?? point.pointNumber;
        if (fromIdx != null && fromIdx >= 0 && fromIdx < years.length) return fromIdx;
        const byYear = years.indexOf(Number(point.x));
        if (byYear >= 0) return byYear;
    }
    const domEvent = event?.event;
    if (graphDiv && domEvent) {
        return findNearestBarIndex(graphDiv, domEvent.clientX, domEvent.clientY, years);
    }
    return null;
};

/** Browser zoom at which pie/bar stack vertically (150% = 1.5). */
const STACKED_LAYOUT_BROWSER_ZOOM = 1.5;
/**
 * innerWidth-based zoom reads ~25% low in the factbook shell (sidebar/layout chrome),
 * so 150% browser zoom ≈ 1.125 detected — 200% browser ≈ 1.5 detected.
 */
const STACKED_LAYOUT_DETECTED_ZOOM = STACKED_LAYOUT_BROWSER_ZOOM * 0.75;

/** Browser zoom (~125%) at which pie outside labels switch to HTML legend. */
/**
 * Detected css zoom ≈ 1.0 @ 100% and ~1.125 @ 150% (see STACKED_LAYOUT_*).
 * Sit slightly below the ~1.125 reading at 125% browser zoom.
 */
const PIE_LEGEND_DETECTED_ZOOM = 1.12;

/** Ctrl+ page zoom is not exposed on visualViewport.scale on desktop; infer from innerWidth baseline. */
const computePageZoomScale = (baseline) => {
    if (typeof window === 'undefined') return 1;

    const inner = window.innerWidth;
    const outer = window.outerWidth;
    const dpr = window.devicePixelRatio || 1;

    let nextBaseline = baseline;
    if (!nextBaseline) {
        nextBaseline = { outer, inner, dpr };
    } else if (Math.abs(outer - nextBaseline.outer) > 64) {
        nextBaseline = { outer, inner, dpr };
    }

    const outerStable = Math.abs(outer - nextBaseline.outer) <= 64;

    let cssZoomFactor = 1;
    if (nextBaseline.inner > 0 && inner > 0 && outerStable) {
        cssZoomFactor = Math.max(nextBaseline.inner / inner, inner / nextBaseline.inner);
    }

    const vv = window.visualViewport;
    const pinScale = vv?.scale || 1;

    let layoutZoom = 1;
    if (vv?.width > 0 && inner > 0) {
        const inferred = inner / vv.width;
        if (inferred > 1.02 && inferred < 8) layoutZoom = inferred;
    }

    const sw = window.screen?.width ?? 0;
    const avail = window.screen?.availWidth ?? 0;
    let screenZoomHint = 1;
    if (sw >= 1024 && inner > 0 && avail > 0 && outer >= avail * 0.88 && inner < sw * 0.92) {
        const inferredFull = sw / inner;
        if (inferredFull > 1.02 && inferredFull < 4) screenZoomHint = inferredFull;
    }

    const pageCssZoom = Math.max(pinScale, layoutZoom, cssZoomFactor);
    const zoomScale = Math.max(pageCssZoom, screenZoomHint);

    return { zoomScale, pageCssZoom, cssZoomFactor, baseline: nextBaseline };
};

const PublicEvChargingStationsPlot = memo(function PublicEvChargingStationsPlot({
    plotData, plotLayout, chartConfig, plotKey,
    onPlotReady, onPlotInitialized, onPlotUpdated, onClick,
}) {
    const handleInit = onPlotInitialized ?? onPlotReady;
    const handleUpdate = onPlotUpdated ?? onPlotReady;
    return (
        <Plot
            key={plotKey}
            data={plotData}
            layout={plotLayout}
            config={chartConfig}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
            onInitialized={handleInit}
            onUpdate={handleUpdate}
            onClick={onClick}
        />
    );
});

const PublicEvChargingStations = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [selectedPieYear] = useState(PIE_DATA_YEAR);
    const [selectedPieSlices, setSelectedPieSlices] = useState(null);
    const [selectedBarPoints, setSelectedBarPoints] = useState(null);
    const windowWidth = useWindowWidth();
    const [pageCssZoom, setPageCssZoom] = useState(() => computePageZoomScale(null).pageCssZoom);
    const [cssZoomFactor, setCssZoomFactor] = useState(() => computePageZoomScale(null).cssZoomFactor);
    const zoomBaselineRef = useRef(null);

    const pieChartRef = useRef(null);
    const barChartRef = useRef(null);
    const contentRowRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });
    const lastBarClickRef = useRef({ time: 0, pointIndex: null });
    const pieClickHandlerRef = useRef(null);
    const barClickHandlerRef = useRef(null);
    const barGraphDivRef = useRef(null);

    const useStackedLayout = pageCssZoom >= STACKED_LAYOUT_DETECTED_ZOOM;
    const pieColumnWidth = useStackedLayout ? windowWidth : Math.max(280, Math.floor(windowWidth * 0.4));

    const formatNumber = (value) => formatLocaleNumber(value, lang, { maximumFractionDigits: 0 });

    const formatPct = (value, digits = 1) => formatLocalePct(value, lang, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });

    const formatGrowth = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '';
        return `+${formatLocalePct(value, lang, { maximumFractionDigits: 0 })}`;
    };

    const pieRow = useMemo(
        () => PIE_HARDCODED_DATA.find((row) => row.year === selectedPieYear) || PIE_HARDCODED_DATA[0],
        [selectedPieYear],
    );

    const pieSlices = useMemo(() => SLICE_KEYS.map((key) => ({
        key,
        pct: pieRow?.slices?.[key] ?? 0,
    })), [pieRow]);

    const pieTextVars = useMemo(() => ({ year: selectedPieYear }), [selectedPieYear]);
    const barTextVars = useMemo(() => ({ startYear: BAR_START_YEAR, endYear: BAR_END_YEAR }), []);

    const pieChartTitle = useMemo(() => substitute(getText('public_ev_charging_stations_pie_chart_title', lang), pieTextVars), [lang, pieTextVars]);
    const barChartTitle = useMemo(() => getText('public_ev_charging_stations_bar_chart_title', lang), [lang]);
    const exportPieChartTitle = useMemo(() => stripHtml(pieChartTitle), [pieChartTitle]);
    const exportBarChartTitle = useMemo(() => stripHtml(barChartTitle), [barChartTitle]);
    const pieFileTitle = useMemo(() => substitute(getText('public_ev_charging_stations_pie_download_title', lang), pieTextVars), [lang, pieTextVars]);
    const barFileTitle = useMemo(() => substitute(getText('public_ev_charging_stations_bar_download_title', lang), barTextVars), [lang, barTextVars]);
    const pieTableCaption = substitute(getText('public_ev_charging_stations_pie_table_caption', lang), pieTextVars);
    const barTableCaption = substitute(getText('public_ev_charging_stations_bar_table_caption', lang), barTextVars);

    const pieTableColumns = useMemo(() => [
        { key: 'year', header: getText('public_ev_charging_stations_pie_table_col_year', lang), align: 'left' },
        { key: 'type', header: getText('public_ev_charging_stations_pie_table_col_type', lang), align: 'left' },
        { key: 'share', header: getText('public_ev_charging_stations_pie_table_col_share', lang), align: 'num' },
    ], [lang]);

    const barTableColumns = useMemo(() => [
        { key: 'year', header: getText('public_ev_charging_stations_bar_table_col_year', lang), align: 'left' },
        { key: 'stations', header: getText('public_ev_charging_stations_bar_table_col_stations', lang), align: 'num' },
        { key: 'growth', header: getText('public_ev_charging_stations_bar_table_col_growth', lang), align: 'num' },
    ], [lang]);


    const zoomLegendMode = windowWidth <= 768
        || cssZoomFactor >= PIE_LEGEND_DETECTED_ZOOM
        || (cssZoomFactor < 1.02 && pieColumnWidth <= 520);
    const effectivePieSlices = windowWidth > 768 ? selectedPieSlices : null;

    const pieLabels = pieSlices.map((slice) => getText(`public_ev_charging_stations_legend_${slice.key}`, lang));
    const pieValues = pieSlices.map((slice) => (slice.pct > 0 ? slice.pct : 0.001));
    const basePieColors = pieSlices.map((slice) => SLICE_COLORS[slice.key]);
    const pieColors = effectivePieSlices?.length
        ? basePieColors.map((color, index) => (effectivePieSlices.includes(index) ? color : hexToRgba(color, 0.3)))
        : basePieColors;

    const pieTextSize = windowWidth <= 480 ? 12 : windowWidth <= 768 ? 14 : 16;
    const piePctFontSize = windowWidth <= 480 ? 18 : windowWidth <= 768 ? 22 : 26;
    const pieOutsideTextSize = pieTextSize;
    const pieCenterValueSize = windowWidth <= 480 ? 28 : windowWidth <= 768 ? 34 : 40;
    const pieCenterLabelSize = windowWidth <= 480 ? 14 : windowWidth <= 768 ? 16 : 18;

    const piePlotHeight = windowWidth <= 480 ? 440 : useStackedLayout ? 560 : 520;
    const pieSideMargin = windowWidth <= 480
        ? 0
        : zoomLegendMode
            ? 16
            : 24;

    const labelPctGap = '<br>';
    const pctLabelTemplate = `<span style="font-size:${piePctFontSize}px;line-height:1.1"><b>%{percent:.1%}</b></span>`;
    const outsideLabelTemplate = pieSlices.map((slice) => {
        if (slice.key === 'level1') return '';
        if (slice.key === 'level3') {
            return `${getText('public_ev_charging_stations_legend_level3_line1', lang)}<br>${getText('public_ev_charging_stations_legend_level3_line2', lang)}${labelPctGap}${pctLabelTemplate}`;
        }
        return `%{label}${labelPctGap}${pctLabelTemplate}`;
    });
    const zoomLabelTemplate = pieSlices.map(() => pctLabelTemplate);

    const pieTrace = pieSlices.length ? {
        type: 'pie',
        values: pieValues,
        labels: pieLabels,
        hole: 0.55,
        direction: 'clockwise',
        rotation: 0,
        sort: false,
        texttemplate: zoomLegendMode ? zoomLabelTemplate : outsideLabelTemplate,
        textinfo: zoomLegendMode ? 'text' : 'label+percent',
        textposition: zoomLegendMode ? 'inside' : 'outside',
        textfont: {
            size: pieTextSize,
            family: 'Arial, sans-serif',
            color: zoomLegendMode ? '#ffffff' : pieColors,
        },
        outsidetextfont: {
            size: pieOutsideTextSize,
            color: pieColors,
            family: 'Arial, sans-serif',
        },
        marker: { colors: pieColors, line: { color: '#ffffff', width: 1 } },
        pull: effectivePieSlices?.length
            ? pieValues.map((_, index) => (effectivePieSlices.includes(index) ? 0.08 : 0.02))
            : pieValues.map((_, index) => (index === 0 ? 0.05 : 0.02)),
        hovertext: pieSlices.map((slice) => {
            const label = getText(`public_ev_charging_stations_legend_${slice.key}`, lang);
            return `<b>${label}</b><br>${formatPct(slice.pct)}`;
        }),
        hoverinfo: 'text',
        hoverlabel: HOVER_LABEL,
        automargin: true,
    } : null;

    const level1Slice = pieSlices.find((slice) => slice.key === 'level1');

    const pieCenterAnnotation = pieRow?.total != null ? {
        text: `<span style="font-size:${pieCenterValueSize}px"><b>${getText('public_ev_charging_stations_pie_center_value', lang)}</b></span><br><span style="font-size:${pieCenterLabelSize}px">${getText('public_ev_charging_stations_pie_center_label_line1', lang)}</span><br><span style="font-size:${pieCenterLabelSize}px">${getText('public_ev_charging_stations_pie_center_label_line2', lang)}</span>`,
        showarrow: false,
        x: 0.5,
        y: 0.5,
        xref: 'paper',
        yref: 'paper',
        font: {
            size: pieCenterLabelSize,
            color: '#424243',
            family: 'Arial Black, Arial, sans-serif',
        },
    } : null;

    const pieLayout = {
        showlegend: false,
        margin: {
            t: zoomLegendMode ? 70 : 40,
            b: zoomLegendMode ? 90 : 40,
            l: pieSideMargin,
            r: pieSideMargin,
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        height: piePlotHeight,
        autosize: true,
        clickmode: 'event',
        dragmode: false,
        annotations: pieCenterAnnotation ? [pieCenterAnnotation] : [],
    };

    const barYears = BAR_HARDCODED_DATA.map((row) => row.year);
    const barPlotValues = BAR_HARDCODED_DATA.map((row) => row.stations / 1000);
    const barPlotHeight = windowWidth <= 480 ? 360 : 420;

    const barPlotData = [{
        x: barYears,
        y: barPlotValues,
        type: 'bar',
        marker: {
            color: BAR_COLOR,
            opacity: barPlotValues.map((_, index) => (
                selectedBarPoints === null || selectedBarPoints.includes(index) ? 1 : 0.3
            )),
            line: { width: 0 },
        },
        text: BAR_HARDCODED_DATA.map((row) => formatNumber(row.stations)),
        textposition: 'inside',
        insidetextanchor: 'end',
        textfont: { color: '#ffffff', size: windowWidth <= 480 ? 11 : 13, family: 'Arial, sans-serif' },
        cliponaxis: false,
        hovertemplate: BAR_HARDCODED_DATA.map((row) => {
            const growthLine = row.growth != null ? `<br>${formatGrowth(row.growth)}` : '';
            return `<b>${row.year}</b><br>${formatNumber(row.stations)}${growthLine}<extra></extra>`;
        }),
        hoverlabel: HOVER_LABEL,
    }];

    const growthAnnotations = BAR_HARDCODED_DATA
        .filter((row) => row.growth != null)
        .map((row) => ({
            x: row.year,
            y: row.stations / 1000,
            xref: 'x',
            yref: 'y',
            text: `<b>${formatGrowth(row.growth)}</b>`,
            showarrow: false,
            xanchor: 'center',
            yanchor: 'bottom',
            yshift: 12,
            captureevents: false,
            font: { size: windowWidth <= 480 ? 12 : 14, color: '#333333', family: 'Arial, sans-serif' },
        }));

    const barLayout = {
        showlegend: false,
        hovermode: 'closest',
        hoverlabel: HOVER_LABEL,
        clickmode: 'event',
        dragmode: false,
        height: barPlotHeight,
        margin: { t: 48, b: windowWidth <= 480 ? 60 : 50, l: 72, r: 24 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        autosize: true,
        bargap: BAR_BARGAP,
        annotations: growthAnnotations,
        xaxis: {
            type: 'linear',
            tickmode: 'array',
            tickvals: barYears,
            ticktext: barYears.map(String),
            range: [BAR_START_YEAR - 0.5, BAR_END_YEAR + 0.5],
            showgrid: false,
            showline: true,
            linewidth: 1,
            linecolor: '#333333',
            tickfont: { size: windowWidth <= 480 ? 12 : 14, family: 'Arial, sans-serif' },
            fixedrange: true,
            automargin: true,
        },
        yaxis: {
            title: { text: getText('public_ev_charging_stations_bar_yaxis', lang), font: { size: windowWidth <= 768 ? 15 : 16, family: 'Arial, sans-serif', color: '#58585a' }, standoff: 12 },
            range: [0, 14],
            dtick: 2,
            tickfont: { size: windowWidth <= 480 ? 12 : 14, family: 'Arial, sans-serif' },
            fixedrange: true,
            automargin: true,
        },
    };

    const pieTableRows = pieSlices.map((slice) => ({
        year: selectedPieYear,
        type: getText(`public_ev_charging_stations_legend_${slice.key}`, lang),
        share: slice.pct,
    }));

    const scrollToElement = (id) => makeScrollToIdHandler(id);

    useEffect(() => {
        const syncLayout = () => {
            const {
                pageCssZoom: nextPageCssZoom,
                cssZoomFactor: nextCssZoomFactor,
                baseline,
            } = computePageZoomScale(zoomBaselineRef.current);
            zoomBaselineRef.current = baseline;
            setPageCssZoom(nextPageCssZoom);
            setCssZoomFactor(nextCssZoomFactor);
        };
        syncLayout();
        window.addEventListener('resize', syncLayout);
        const vv = window.visualViewport;
        vv?.addEventListener('resize', syncLayout);
        vv?.addEventListener('scroll', syncLayout);
        return () => {
            window.removeEventListener('resize', syncLayout);
            vv?.removeEventListener('resize', syncLayout);
            vv?.removeEventListener('scroll', syncLayout);
        };
    }, []);


    const togglePieSelection = useCallback((sliceIndex) => {
        if (windowWidth <= 768) {
            const now = Date.now();
            const last = lastPieClickRef.current;
            const isDoubleTap = sliceIndex === last.index && now - last.time < 300;
            lastPieClickRef.current = { time: now, index: sliceIndex };
            if (!isDoubleTap) return;
        }
        setSelectedPieSlices((previous) => {
            if (previous === null) return [sliceIndex];
            if (previous.includes(sliceIndex)) {
                return previous.length <= 1 ? null : previous.filter((item) => item !== sliceIndex);
            }
            return [...previous, sliceIndex];
        });
    }, [windowWidth]);

    const handlePieClick = useCallback((event) => {
        const point = event?.points?.[0];
        if (!point) return;
        const index = point.pointNumber ?? point.pointIndex;
        if (index == null || index < 0) return;
        togglePieSelection(index);
    }, [togglePieSelection]);

    useEffect(() => {
        pieClickHandlerRef.current = handlePieClick;
    }, [handlePieClick]);

    const bindPiePlotHandlers = useCallback((graphDiv) => {
        if (!graphDiv?.on) return;
        if (graphDiv._publicEvChargingStationsPieClick) {
            graphDiv.removeListener('plotly_click', graphDiv._publicEvChargingStationsPieClick);
        }
        const clickHandler = (event) => pieClickHandlerRef.current?.(event);
        graphDiv._publicEvChargingStationsPieClick = clickHandler;
        graphDiv.on('plotly_click', clickHandler);
    }, []);

    const resizeCharts = useCallback(() => {
        [pieChartRef, barChartRef].forEach((ref) => {
            const plotEl = ref.current?.querySelector('.js-plotly-plot');
            if (plotEl && window.Plotly?.Plots?.resize) {
                window.Plotly.Plots.resize(plotEl);
            }
        });
    }, []);

    const onPiePlotReady = useCallback((_figure, graphDiv) => {
        bindPiePlotHandlers(graphDiv);
        window.requestAnimationFrame(resizeCharts);
    }, [bindPiePlotHandlers, resizeCharts]);

    const toggleBarSelection = useCallback((pointIndex) => {
        if (windowWidth <= 768) {
            const currentTime = Date.now();
            const lastClick = lastBarClickRef.current;
            const isSamePoint = pointIndex === lastClick.pointIndex && lastClick.pointIndex != null;
            const isDoubleTap = isSamePoint && currentTime - lastClick.time < 300;
            lastBarClickRef.current = { time: currentTime, pointIndex };
            if (!isDoubleTap) return;
        }

        setSelectedBarPoints((prev) => {
            if (prev === null) return [pointIndex];
            if (prev.includes(pointIndex)) {
                return prev.length <= 1 ? null : prev.filter((p) => p !== pointIndex);
            }
            return [...prev, pointIndex];
        });
    }, [windowWidth]);

    const handleBarClick = useCallback((event) => {
        const pointIndex = resolveBarPointIndex(event, barGraphDivRef.current);
        if (pointIndex == null || pointIndex < 0) return;
        toggleBarSelection(pointIndex);
    }, [toggleBarSelection]);

    useEffect(() => {
        barClickHandlerRef.current = handleBarClick;
    }, [handleBarClick]);

    const bindBarPlotHandlers = useCallback((graphDiv) => {
        if (!graphDiv?.on) return;
        barGraphDivRef.current = graphDiv;
        if (graphDiv._publicEvChargingStationsBarClick) {
            graphDiv.removeListener('plotly_click', graphDiv._publicEvChargingStationsBarClick);
        }
        const clickHandler = (event) => barClickHandlerRef.current?.(event);
        graphDiv._publicEvChargingStationsBarClick = clickHandler;
        graphDiv.on('plotly_click', clickHandler);
    }, []);

    const onBarPlotReady = useCallback((_figure, graphDiv) => {
        bindBarPlotHandlers(graphDiv);
        window.requestAnimationFrame(resizeCharts);
    }, [bindBarPlotHandlers, resizeCharts]);

    const downloadPieChartWithTitle = useChartPngDownloader(
        pieChartRef,
        () => ({
        filename: `${pieFileTitle}.png`,
        title: exportPieChartTitle,
        height: 700,
        legendItems: SLICE_KEYS.map((key) => ({
            label: getText(`public_ev_charging_stations_legend_${key}`, lang),
            color: SLICE_COLORS[key],
        })),
    }),
        [SLICE_COLORS, SLICE_KEYS, exportPieChartTitle, getText, lang, pieFileTitle],
    );

    const downloadBarChartWithTitle = useChartPngDownloader(
        barChartRef,
        () => ({
        filename: `${barFileTitle}.png`,
        title: exportBarChartTitle,
        height: 700,
        legendItems: [
            { label: getText('public_ev_charging_stations_bar_table_col_stations', lang), color: BAR_COLOR },
        ],
    }),
        [BAR_COLOR, barFileTitle, exportBarChartTitle, getText, lang],
    );

    const piePlotKey = `public-ev-charging-stations-pie-${selectedPieYear}-${useStackedLayout ? 'stacked' : 'side'}-${zoomLegendMode ? 'zoom' : 'full'}-${pieColumnWidth}`;
    const barPlotKey = `public-ev-charging-stations-bar-${useStackedLayout ? 'stacked' : 'side'}-${barPlotHeight}`;

    const pieChartConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadPieChartWithTitle(gd),
        name: getText('public_ev_charging_stations_download_png', lang),
    });

    const barChartConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadBarChartWithTitle(gd),
        name: getText('public_ev_charging_stations_download_png', lang),
    });

    const footnoteLink = (referrerId) => (
        <FootnoteMarker
                            lang={lang}
                            href="#fn-asterisk-public-ev-charging-stations"
                            id={referrerId}
                            marker="*"
                            onClick={scrollToElement('fn-asterisk-public-ev-charging-stations')}
                        />
    );

    const getPieLegendLabel = (sliceKey) => getText(`public_ev_charging_stations_legend_${sliceKey}`, lang);

    const renderPieLegendItem = (slice) => (
        <span key={slice.key} className="public-ev-charging-stations-custom-legend-item">
            <span className="public-ev-charging-stations-custom-legend-swatch" style={{ backgroundColor: SLICE_COLORS[slice.key] }} aria-hidden="true" />
            {getPieLegendLabel(slice.key)}
            {' '}
            <strong>{formatPct(slice.pct)}</strong>
        </span>
    );

    const formatShareSpoken = (value, digits = 1) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        const formatted = formatLocalePct(value, lang, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
            suffix: false,
        });
        return `${formatted} ${lang === 'en' ? 'percent' : 'pour cent'}`;
    };
    const piePlainTitle = substitute(getText('public_ev_charging_stations_pie_chart_title_plain', lang), pieTextVars);
    const barPlainTitle = getText('public_ev_charging_stations_bar_chart_title_plain', lang);
    const pieSummary = joinChartSummary({
        intro: lang === 'en'
            ? `Pie chart of public EV charger types in Canada for ${selectedPieYear}`
            : `Graphique circulaire des types de bornes de recharge publiques au Canada pour ${selectedPieYear}`,
        body: summarizeByCategory({
            categories: pieLabels,
            series: [{
                name: lang === 'en' ? 'Share' : 'Part',
                values: pieSlices.map((slice) => slice.pct),
                format: (value) => formatShareSpoken(value, 1),
            }],
            lang,
        }),
    });
    const barSummary = joinChartSummary({
        intro: lang === 'en'
            ? `Bar chart of public EV charging stations in Canada from ${BAR_START_YEAR} to ${BAR_END_YEAR}`
            : `Graphique à barres des stations publiques de recharge de véhicules électriques au Canada de ${BAR_START_YEAR} à ${BAR_END_YEAR}`,
        unitNote: lang === 'en'
            ? 'Station counts and year-over-year growth'
            : 'Nombre de stations et croissance d’une année à l’autre',
        body: summarizeByCategory({
            categories: barYears,
            series: [
                {
                    name: lang === 'en' ? 'Stations' : 'Stations',
                    values: BAR_HARDCODED_DATA.map((row) => row.stations),
                    format: (value) => formatNumber(value),
                },
                {
                    name: lang === 'en' ? 'Growth' : 'Croissance',
                    values: BAR_HARDCODED_DATA.map((row) => row.growth),
                    format: (value) => formatShareSpoken(value, 0),
                },
            ],
            lang,
            newestFirst: true,
        }),
    });
    const pieRegionLabel = `${piePlainTitle}. ${pieSummary}`;
    const barRegionLabel = `${barPlainTitle}. ${barSummary}`;

    return (
        <PageShell id="main-content"
            tabIndex="-1"
            className="page-content page-99 page-chrome page-chrome--bleed"
            role="main"
            aria-labelledby="public-ev-charging-stations-pie-chart-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.page-99.page-content { max-width: none !important; overflow-x: visible !important; }
.page-99 {
}
.public-ev-charging-stations-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.public-ev-charging-stations-content-row {
    display: flex;
    flex-direction: row;
    width: 100%;
    align-items: stretch;
    gap: 0;
}
.public-ev-charging-stations-pie-column {
    width: 40%;
    min-width: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
}
.public-ev-charging-stations-pie-column-side {
    background-color: #f5f5f5;
    padding: 20px 16px;
}
.public-ev-charging-stations-bar-column {
    width: 60%;
    min-width: 0;
    box-sizing: border-box;
    padding: 0 0 0 24px;
    display: flex;
    flex-direction: column;
}
.public-ev-charging-stations-chart-frame {
    margin-bottom: 0;
    display: flex;
    flex-direction: column;
    flex: 1;
}
.public-ev-charging-stations-pie-panel {
    box-sizing: border-box;
    overflow: visible;
    display: flex;
    flex-direction: column;
    flex: 1;
}
.public-ev-charging-stations-chart-block {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 0;
}
.public-ev-charging-stations-panel-footer {
    margin-top: auto;
    flex-shrink: 0;
}
.public-ev-charging-stations-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 24px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    line-height: 1.25;
    text-transform: none;
}
.public-ev-charging-stations-chart-title .fn-lnk { color: var(--gc-text); }
.public-ev-charging-stations-chart-scroll { width: 100%; overflow: visible; display: flex; justify-content: center; align-items: center; }
.public-ev-charging-stations-chart {
    width: 100%;
    min-width: 0;
    min-height: 320px;
    position: relative;
    z-index: 1;
    overflow: visible;
}
.public-ev-charging-stations-chart > div { width: 100%; height: 100%; overflow: visible; }
.public-ev-charging-stations-chart .js-plotly-plot,
.public-ev-charging-stations-chart .plot-container,
.public-ev-charging-stations-chart .svg-container { overflow: visible !important; }
.public-ev-charging-stations-chart .plotly .slice path.textline {
    stroke: #000000 !important;
    stroke-width: 2px;
    fill: none;
}
.public-ev-charging-stations-level1-label {
    position: absolute;
    z-index: 40;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    font-family: Arial, sans-serif;
    pointer-events: none;
    color: ${SLICE_COLORS.level1};
    left: calc(50% + 20px);
    top: 80px;
}
.public-ev-charging-stations-level1-row {
    display: flex;
    flex-direction: row;
    align-items: center;
}
.public-ev-charging-stations-level1-leader {
    position: relative;
    width: 4px;
    right: 10px;
    height: ${Math.round(pieTextSize * 1.15)}px;
    flex-shrink: 0;
}
.public-ev-charging-stations-level1-leader::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    width: 2px;
    height: 46px;
    margin-top: -1px;
    background: #000;
}
.public-ev-charging-stations-level1-leader::after {
    content: '';
    position: absolute;
    left: 0;
    top: calc(50% - 1px);
    width: 100%;
    height: 2px;
    background: #000;
}
.public-ev-charging-stations-level1-name {
    font-size: ${pieTextSize}px;
    line-height: 1.15;
    font-weight: 400;
}
.public-ev-charging-stations-level1-label .public-ev-charging-stations-level1-pct {
    font-size: ${piePctFontSize}px;
    font-weight: bold;
    line-height: 1.1;
}
.public-ev-charging-stations-custom-legend {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px 18px;
    flex-wrap: wrap;
    margin-top: 8px;
    margin-bottom: 4px;
    font-family: Arial, sans-serif;
    font-size: 13px;
    color: var(--gc-text);
}
.public-ev-charging-stations-custom-legend-item { display: inline-flex; align-items: center; gap: 6px; }
.public-ev-charging-stations-custom-legend-swatch {
    width: 14px;
    height: 14px;
    display: inline-block;
    border-radius: 2px;
    border: 1px solid rgba(0, 0, 0, 0.12);
}
.public-ev-charging-stations-paragraph {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: #332f30;
    margin: 28px 0 0 0;
    line-height: 1.45;
    width: 100%;
    box-sizing: border-box;
}
.page-99 .data-table-wrapper.public-ev-charging-stations-panel-footer { margin-top: auto; padding-top: 20px; }
.public-ev-charging-stations-footnotes {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--gc-text);
    margin-top: 24px;
    margin-bottom: 0;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
    line-height: 1.65;
}
.public-ev-charging-stations-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 1rem;
}
.public-ev-charging-stations-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
.public-ev-charging-stations-footnotes dd p { margin: 0; }
.layout-stacked.public-ev-charging-stations-content-row { flex-direction: column !important; }
.layout-stacked .public-ev-charging-stations-pie-column,
.layout-stacked .public-ev-charging-stations-bar-column {
    width: 100% !important;
    min-width: 0 !important;
    padding: 0 !important;
}
.layout-stacked .public-ev-charging-stations-pie-column-side { background-color: transparent; padding: 0; }
.layout-stacked .public-ev-charging-stations-bar-column { margin-top: 28px; }

@media (max-width: 768px) {
    .public-ev-charging-stations-chart-title { font-size: 22px; }
    .public-ev-charging-stations-paragraph { font-size: 18px; }
    .public-ev-charging-stations-level1-label { left: calc(50% + 24px); top: 40px; }
    .public-ev-charging-stations-level1-leader::before { height: 42px; }
}
@media (max-width: 480px) {
    .public-ev-charging-stations-level1-label { left: calc(50% + 4px); top: 44px; }
    .public-ev-charging-stations-level1-leader { width: 3px; }
    .public-ev-charging-stations-level1-leader::before { height: 36px; }
    .public-ev-charging-stations-level1-name { font-size: 12px; }
}
            `}</style>

            <div className="public-ev-charging-stations-inner">
                <div ref={contentRowRef} className={`public-ev-charging-stations-content-row ${useStackedLayout ? 'layout-stacked' : ''}`}>
                    <div className={`public-ev-charging-stations-pie-column ${useStackedLayout ? '' : 'public-ev-charging-stations-pie-column-side'}`}>
                        <div className={useStackedLayout ? 'public-ev-charging-stations-chart-frame page-chrome-chart-frame' : 'public-ev-charging-stations-pie-panel'}>
                            <h2 id="public-ev-charging-stations-pie-chart-title" className="public-ev-charging-stations-chart-title">
                                {substitute(getText('public_ev_charging_stations_pie_chart_title_plain', lang), pieTextVars)}
                                {footnoteLink('fn-asterisk-rf-public-ev-charging-stations-pie')}
                            </h2>

                            {effectivePieSlices?.length > 0 && <ClearSelectionButton lang={lang} onClick={() => setSelectedPieSlices(null)} />}

                            <div className="public-ev-charging-stations-chart-block public-ev-charging-stations-chart-scroll">
                                <figure
                                    ref={pieChartRef}
                                    className="public-ev-charging-stations-chart"
                                    role="region"
                                    aria-label={pieRegionLabel}
                                    tabIndex={0}
                                    style={{ margin: 0, height: `${piePlotHeight}px` }}
                                >
                                    <div aria-hidden="true">
                                    {pieTrace && (
                                        <PublicEvChargingStationsPlot
                                            plotData={[pieTrace]}
                                            plotLayout={pieLayout}
                                            chartConfig={pieChartConfig}
                                            plotHeight={piePlotHeight}
                                            plotKey={piePlotKey}
                                            onPlotReady={onPiePlotReady}
                                        />
                                    )}
                                    </div>
                                    {!zoomLegendMode && level1Slice && (
                                        <span className="public-ev-charging-stations-level1-label" aria-hidden="true">
                                            <span className="public-ev-charging-stations-level1-row">
                                                <span className="public-ev-charging-stations-level1-leader" />
                                                <span className="public-ev-charging-stations-level1-name">{getText('public_ev_charging_stations_legend_level1', lang)}</span>
                                            </span>
                                            <span className="public-ev-charging-stations-level1-pct">{formatPct(level1Slice.pct)}</span>
                                        </span>
                                    )}
                                </figure>
                            </div>

                            {zoomLegendMode && (
                                <div className="public-ev-charging-stations-custom-legend" aria-label={lang === 'en' ? 'Chart legend' : 'Légende du graphique'}>
                                    {pieSlices.map(renderPieLegendItem)}
                                </div>
                            )}

                            <ChartDataTable
                                lang={lang}
                                className="public-ev-charging-stations-panel-footer"
                                columns={pieTableColumns}
                                rows={pieTableRows}
                                csvFilename={`${pieFileTitle}.csv`}
                                docx={{
                                    filename: `${pieFileTitle}.docx`,
                                    title: exportPieChartTitle,
                                    titleAlign: 'center',
                                    columnWidths: [900, 4200, 1800],
                                    fontSize: 22,
                                }}
                                caption={pieTableCaption}
                                tableAriaLabel={pieTableCaption}
                                renderCell={(raw, { colIndex }) => {
                                    if (colIndex === 0) return String(raw ?? '');
                                    if (colIndex === 1) return String(raw ?? '');
                                    return formatPct(raw);
                                }}
                            />
                        </div>
                    </div>

                    <div className="public-ev-charging-stations-bar-column">
                        <div className="public-ev-charging-stations-chart-frame page-chrome-chart-frame">
                            <h2 id="public-ev-charging-stations-bar-chart-title" className="public-ev-charging-stations-chart-title">
                                {getText('public_ev_charging_stations_bar_chart_title_plain', lang)}
                                {footnoteLink('fn-asterisk-rf-public-ev-charging-stations-bar')}
                            </h2>

                            {selectedBarPoints !== null && <ClearSelectionButton lang={lang} onClick={() => setSelectedBarPoints(null)} />}

                            <div className="public-ev-charging-stations-chart-block">
                                <figure
                                    ref={barChartRef}
                                    className="public-ev-charging-stations-chart"
                                    role="region"
                                    aria-label={barRegionLabel}
                                    tabIndex={0}
                                    style={{ margin: 0, height: `${barPlotHeight}px` }}
                                >
                                    <div aria-hidden="true">
                                    <PublicEvChargingStationsPlot
                                        plotData={barPlotData}
                                        plotLayout={barLayout}
                                        chartConfig={barChartConfig}
                                        plotHeight={barPlotHeight}
                                        plotKey={barPlotKey}
                                        onPlotReady={onBarPlotReady}
                                    />
                                    </div>
                                </figure>
                            </div>

                            <ChartDataTable
                                lang={lang}
                                className="public-ev-charging-stations-panel-footer"
                                columns={barTableColumns}
                                rows={BAR_HARDCODED_DATA}
                                csvFilename={`${barFileTitle}.csv`}
                                docx={{
                                    filename: `${barFileTitle}.docx`,
                                    title: exportBarChartTitle,
                                    titleAlign: 'center',
                                    columnWidths: [900, 2600, 1800],
                                    fontSize: 22,
                                }}
                                caption={barTableCaption}
                                tableAriaLabel={barTableCaption}
                                renderCell={(raw, { colIndex }) => {
                                    if (colIndex === 0) return String(raw ?? '');
                                    if (colIndex === 1) return formatNumber(raw);
                                    return raw != null ? formatGrowth(raw) : '—';
                                }}
                            />
                        </div>
                    </div>
                </div>

                <p className="public-ev-charging-stations-paragraph">
                    {getText('public_ev_charging_stations_paragraph_part1', lang)}
                    <strong>{getText('public_ev_charging_stations_paragraph_bold', lang)}</strong>
                    {getText('public_ev_charging_stations_paragraph_part2', lang)}
                </p>

                <PageFootnotes
                    lang={lang}
                    className="public-ev-charging-stations-footnotes"
                    items={[
                        { id: 'fn-asterisk-public-ev-charging-stations', marker: '*', text: getText('public_ev_charging_stations_footnote', lang), returnHref: '#fn-asterisk-rf-public-ev-charging-stations-pie' },
                    ]}
                />
            </div>
        </PageShell>
    );
};

export default PublicEvChargingStations;
