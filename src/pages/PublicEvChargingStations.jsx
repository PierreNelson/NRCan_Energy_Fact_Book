import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';

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

const MODEBAR_REMOVE = [
    'pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d',
    'autoScale2d', 'resetScale2d', 'toImage', 'hoverClosestCartesian',
    'hoverCompareCartesian', 'toggleSpikelines',
];

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    }
    return hex;
};

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

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
    const [isPieTableOpen, setIsPieTableOpen] = useState(false);
    const [isBarTableOpen, setIsBarTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
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
    const pieTopScrollRef = useRef(null);
    const pieTableScrollRef = useRef(null);
    const pieBottomScrollRef = useRef(null);
    const barTopScrollRef = useRef(null);
    const barTableScrollRef = useRef(null);
    const barBottomScrollRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const useStackedLayout = pageCssZoom >= STACKED_LAYOUT_DETECTED_ZOOM;
    const pieColumnWidth = useStackedLayout ? windowWidth : Math.max(280, Math.floor(windowWidth * 0.4));

    const formatNumber = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const formatPct = (value, digits = 1) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        const formatted = Number(value).toLocaleString(locale, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        });
        return lang === 'fr' ? `${formatted} %` : `${formatted}%`;
    };

    const formatGrowth = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '';
        const formatted = Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
        return lang === 'fr' ? `+${formatted} %` : `+${formatted}%`;
    };

    const scrollToElement = (id) => (event) => {
        event?.preventDefault();
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    useEffect(() => {
        const syncLayout = () => {
            setWindowWidth(window.innerWidth);
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

    const resizeCharts = useCallback(() => {
        [pieChartRef, barChartRef].forEach((ref) => {
            const plotEl = ref.current?.querySelector('.js-plotly-plot');
            if (plotEl && window.Plotly?.Plots?.resize) {
                window.Plotly.Plots.resize(plotEl);
            }
        });
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(resizeCharts, 120);
        window.addEventListener('resize', resizeCharts);
        const rowEl = contentRowRef.current;
        const observer = rowEl ? new ResizeObserver(() => window.requestAnimationFrame(resizeCharts)) : null;
        if (rowEl && observer) observer.observe(rowEl);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('resize', resizeCharts);
            observer?.disconnect();
        };
    }, [resizeCharts, useStackedLayout, windowWidth, cssZoomFactor, selectedPieYear, isPieTableOpen, isBarTableOpen]);

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
    const pieFileTitle = useMemo(() => substitute(getText('public_ev_charging_stations_pie_download_title', lang), pieTextVars), [lang, pieTextVars]);
    const barFileTitle = useMemo(() => substitute(getText('public_ev_charging_stations_bar_download_title', lang), barTextVars), [lang, barTextVars]);
    const pieTableCaption = substitute(getText('public_ev_charging_stations_pie_table_caption', lang), pieTextVars);
    const barTableCaption = substitute(getText('public_ev_charging_stations_bar_table_caption', lang), barTextVars);

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

    const pieTableHeaders = [
        getText('public_ev_charging_stations_pie_table_col_year', lang),
        getText('public_ev_charging_stations_pie_table_col_type', lang),
        getText('public_ev_charging_stations_pie_table_col_share', lang),
    ];

    const barTableHeaders = [
        getText('public_ev_charging_stations_bar_table_col_year', lang),
        getText('public_ev_charging_stations_bar_table_col_stations', lang),
        getText('public_ev_charging_stations_bar_table_col_growth', lang),
    ];

    const pieTableRows = pieSlices.map((slice) => ({
        year: selectedPieYear,
        type: getText(`public_ev_charging_stations_legend_${slice.key}`, lang),
        share: slice.pct,
    }));

    const barTableRowsDesc = [...BAR_HARDCODED_DATA].reverse();

    const syncTableScroll = useCallback((topRef, scrollRef, bottomRef) => {
        const topScroll = topRef.current;
        const tableScroll = scrollRef.current;
        const bottomScroll = bottomRef.current;
        if (!topScroll || !tableScroll || !bottomScroll) return;
        const table = tableScroll.querySelector('table');
        if (!table) return;
        [topScroll.firstElementChild, bottomScroll.firstElementChild].forEach((spacer) => {
            if (spacer) spacer.style.width = `${table.offsetWidth}px`;
        });
        const shouldShow = table.offsetWidth > tableScroll.clientWidth;
        topScroll.style.display = shouldShow ? 'block' : 'none';
        bottomScroll.style.display = shouldShow ? 'block' : 'none';
    }, []);

    const bindTableScroll = useCallback((isOpen, topRef, scrollRef, bottomRef) => {
        if (!isOpen) return undefined;
        const topScroll = topRef.current;
        const tableScroll = scrollRef.current;
        const bottomScroll = bottomRef.current;
        if (!topScroll || !tableScroll || !bottomScroll) return undefined;

        const sync = () => syncTableScroll(topRef, scrollRef, bottomRef);
        const syncFrom = (source) => {
            if (source !== topScroll && topScroll.scrollLeft !== source.scrollLeft) topScroll.scrollLeft = source.scrollLeft;
            if (source !== tableScroll && tableScroll.scrollLeft !== source.scrollLeft) tableScroll.scrollLeft = source.scrollLeft;
            if (source !== bottomScroll && bottomScroll.scrollLeft !== source.scrollLeft) bottomScroll.scrollLeft = source.scrollLeft;
        };

        const handleTop = () => syncFrom(topScroll);
        const handleTable = () => syncFrom(tableScroll);
        const handleBottom = () => syncFrom(bottomScroll);
        const rafSync = () => window.requestAnimationFrame(sync);

        topScroll.addEventListener('scroll', handleTop);
        tableScroll.addEventListener('scroll', handleTable);
        bottomScroll.addEventListener('scroll', handleBottom);
        const observer = new ResizeObserver(rafSync);
        const tableEl = tableScroll.querySelector('table');
        if (tableEl) observer.observe(tableEl);
        observer.observe(tableScroll);
        rafSync();

        return () => {
            topScroll.removeEventListener('scroll', handleTop);
            tableScroll.removeEventListener('scroll', handleTable);
            bottomScroll.removeEventListener('scroll', handleBottom);
            observer.disconnect();
        };
    }, [syncTableScroll]);

    useEffect(() => bindTableScroll(isPieTableOpen, pieTopScrollRef, pieTableScrollRef, pieBottomScrollRef), [isPieTableOpen, windowWidth, bindTableScroll]);
    useEffect(() => bindTableScroll(isBarTableOpen, barTopScrollRef, barTableScrollRef, barBottomScrollRef), [isBarTableOpen, windowWidth, bindTableScroll]);

    const setupChartAccessibility = useCallback((chartRef) => {
        const plotContainer = chartRef.current;
        if (!plotContainer) return;
        plotContainer.querySelectorAll('.main-svg, .svg-container svg').forEach((svg) => {
            svg.setAttribute('aria-hidden', 'true');
        });
        plotContainer.querySelectorAll('.modebar-btn').forEach((btn) => {
            const dataTitle = btn.getAttribute('data-title');
            if (dataTitle && (dataTitle.includes('Download') || /télécharger|charger/i.test(dataTitle))) {
                btn.setAttribute('aria-label', dataTitle);
                btn.setAttribute('role', 'button');
                btn.setAttribute('tabindex', '0');
                btn.removeAttribute('aria-hidden');
            } else {
                btn.setAttribute('aria-hidden', 'true');
                btn.setAttribute('tabindex', '-1');
            }
        });
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            setupChartAccessibility(pieChartRef);
            setupChartAccessibility(barChartRef);
        }, 500);
        const observers = [pieChartRef, barChartRef].map((ref) => {
            if (!ref.current) return null;
            const observer = new MutationObserver(() => setupChartAccessibility(ref));
            observer.observe(ref.current, { childList: true, subtree: true });
            return observer;
        });
        return () => {
            clearTimeout(timer);
            observers.forEach((observer) => observer?.disconnect());
        };
    }, [lang, selectedPieSlices, selectedBarPoints, setupChartAccessibility, selectedPieYear]);

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

    const downloadChartPng = useCallback(async (plotEl, title, fileTitleBase) => {
        if (!plotEl || !window.Plotly) return;
        const titlePlain = stripHtml(title);
        try {
            const imgData = await window.Plotly.toImage(plotEl, {
                format: 'png',
                width: 1200,
                height: 700,
                scale: 2,
            });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                const titleHeight = 90;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 32px Lato, Arial, sans-serif';
                ctx.textAlign = 'center';
                const titleLines = titlePlain.match(/.{1,70}(\s|$)/g) || [titlePlain];
                titleLines.forEach((line, index) => {
                    ctx.fillText(line.trim(), canvas.width / 2, 40 + index * 36);
                });
                ctx.drawImage(img, 0, titleHeight);
                canvas.toBlob((blob) => {
                    if (blob) saveAs(blob, `${fileTitleBase}.png`);
                });
            };
            img.src = imgData;
        } catch {
            /* ignore export errors */
        }
    }, []);

    const downloadPieCsv = () => {
        const header = pieTableHeaders.map(csvEscape).join(',');
        const rows = pieTableRows.map((row) => [row.year, row.type, formatPct(row.share)].map(csvEscape).join(','));
        saveAs(new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' }), `${pieFileTitle}.csv`);
    };

    const downloadPieDocx = async () => {
        const headerRow = new TableRow({
            children: pieTableHeaders.map((header) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 22 })], alignment: AlignmentType.CENTER })],
                shading: { fill: 'E6E6E6' },
            })),
        });
        const dataRows = pieTableRows.map((row) => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(row.year), size: 22 })], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row.type, size: 22 })], alignment: AlignmentType.LEFT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatPct(row.share), size: 22 })], alignment: AlignmentType.RIGHT })] }),
            ],
        }));
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: stripHtml(pieChartTitle), bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [900, 4200, 1800],
                        rows: [headerRow, ...dataRows],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), `${pieFileTitle}.docx`);
    };

    const downloadBarCsv = () => {
        const header = barTableHeaders.map(csvEscape).join(',');
        const rows = barTableRowsDesc.map((row) => [
            row.year,
            row.stations,
            row.growth != null ? formatGrowth(row.growth) : '',
        ].map(csvEscape).join(','));
        saveAs(new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' }), `${barFileTitle}.csv`);
    };

    const downloadBarDocx = async () => {
        const headerRow = new TableRow({
            children: barTableHeaders.map((header) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 22 })], alignment: AlignmentType.CENTER })],
                shading: { fill: 'E6E6E6' },
            })),
        });
        const dataRows = barTableRowsDesc.map((row) => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(row.year), size: 22 })], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatNumber(row.stations), size: 22 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row.growth != null ? formatGrowth(row.growth) : '—', size: 22 })], alignment: AlignmentType.RIGHT })] }),
            ],
        }));
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: stripHtml(barChartTitle), bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [900, 2600, 1800],
                        rows: [headerRow, ...dataRows],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), `${barFileTitle}.docx`);
    };

    const downloadBtnStyle = {
        padding: '8px 16px',
        backgroundColor: '#8C8C8C',
        border: '1px solid #404040',
        borderRadius: '4px',
        cursor: 'pointer',
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        color: '#ffffff',
    };

    const piePlotKey = `public-ev-charging-stations-pie-${selectedPieYear}-${useStackedLayout ? 'stacked' : 'side'}-${zoomLegendMode ? 'zoom' : 'full'}-${pieColumnWidth}`;
    const barPlotKey = `public-ev-charging-stations-bar-${useStackedLayout ? 'stacked' : 'side'}-${barPlotHeight}`;

    const pieChartConfig = useMemo(() => ({
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        modeBarButtonsToRemove: MODEBAR_REMOVE,
        modeBarButtonsToAdd: [{
            name: getText('public_ev_charging_stations_download_png', lang),
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: (gd) => downloadChartPng(gd, pieChartTitle, pieFileTitle),
        }],
    }), [lang, downloadChartPng, pieChartTitle, pieFileTitle]);

    const barChartConfig = useMemo(() => ({
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        modeBarButtonsToRemove: MODEBAR_REMOVE,
        modeBarButtonsToAdd: [{
            name: getText('public_ev_charging_stations_download_png', lang),
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: (gd) => downloadChartPng(gd, barChartTitle, barFileTitle),
        }],
    }), [lang, downloadChartPng, barChartTitle, barFileTitle]);

    const footnoteLink = (referrerId) => (
        <span id={referrerId} style={{ verticalAlign: 'super', fontSize: '0.75em' }}>
            <a className="fn-lnk" href="#fn-asterisk-public-ev-charging-stations" onClick={scrollToElement('fn-asterisk-public-ev-charging-stations')}>
                <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                <span aria-hidden="true">*</span>
            </a>
        </span>
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

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-99"
            role="main"
            aria-labelledby="public-ev-charging-stations-pie-chart-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-99.page-content { max-width: none !important; overflow-x: visible !important; }
.page-99 {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
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
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    box-sizing: border-box;
    overflow: visible;
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
.public-ev-charging-stations-clear-selection {
    padding: 6px 12px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: #fff;
    margin-bottom: 8px;
    width: fit-content;
    align-self: flex-start;
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
.public-ev-charging-stations-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.public-ev-charging-stations-download-buttons button:hover,
.page-99 .data-table-wrapper summary:hover,
.page-99 .data-table-wrapper button:hover,
.public-ev-charging-stations-clear-selection:hover { background-color: #404040 !important; }
.page-99 .data-table-wrapper { padding-top: 5px; margin-top: 20px; width: 100%; box-sizing: border-box; }
.page-99 .data-table-wrapper.public-ev-charging-stations-panel-footer { margin-top: auto; padding-top: 20px; }
.page-99 .data-table-wrapper summary {
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    padding: 10px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    list-style: none;
    box-sizing: border-box;
    width: 100%;
    color: #ffffff;
}
.page-99 .data-table-wrapper summary::-webkit-details-marker { display: none; }
.public-ev-charging-stations-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.public-ev-charging-stations-table-scrollbar > div { height: 20px; }
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
                        <div className={useStackedLayout ? 'public-ev-charging-stations-chart-frame' : 'public-ev-charging-stations-pie-panel'}>
                            <h2 id="public-ev-charging-stations-pie-chart-title" className="public-ev-charging-stations-chart-title">
                                {substitute(getText('public_ev_charging_stations_pie_chart_title_plain', lang), pieTextVars)}
                                {footnoteLink('fn-asterisk-rf-public-ev-charging-stations-pie')}
                            </h2>

                            {effectivePieSlices?.length > 0 && (
                                <button type="button" className="public-ev-charging-stations-clear-selection" onClick={() => setSelectedPieSlices(null)}>
                                    {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                                </button>
                            )}

                            <div className="public-ev-charging-stations-chart-block public-ev-charging-stations-chart-scroll">
                                <figure
                                    ref={pieChartRef}
                                    className="public-ev-charging-stations-chart"
                                    role="region"
                                    aria-label={pieChartTitle}
                                    tabIndex={0}
                                    style={{ margin: 0, height: `${piePlotHeight}px` }}
                                >
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

                            <details className="data-table-wrapper public-ev-charging-stations-panel-footer" onToggle={(e) => setIsPieTableOpen(e.currentTarget.open)}>
                                <summary role="button" aria-expanded={isPieTableOpen}>
                                    <span aria-hidden="true" style={{ marginRight: '8px' }}>{isPieTableOpen ? '▼' : '▶'}</span>
                                    {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                    <span className="wb-inv">
                                        {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                    </span>
                                </summary>
                                <div ref={pieTopScrollRef} className="public-ev-charging-stations-table-scrollbar" aria-hidden="true"><div /></div>
                                <div
                                    ref={pieTableScrollRef}
                                    className="table-responsive"
                                    role="region"
                                    aria-label={lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                    tabIndex={0}
                                >
                                    <table className="table table-bordered table-striped table-hover">
                                        <caption className="wb-inv">{pieTableCaption}</caption>
                                        <thead>
                                            <tr>
                                                {pieTableHeaders.map((header, index) => (
                                                    <th
                                                        key={header}
                                                        scope="col"
                                                        style={{
                                                            fontWeight: 'bold',
                                                            textAlign: 'center',
                                                            whiteSpace: 'nowrap',
                                                            verticalAlign: 'bottom',
                                                            ...(index === 0 ? {
                                                                position: 'sticky',
                                                                left: 0,
                                                                backgroundColor: '#f8f9fa',
                                                                zIndex: 2,
                                                                borderRight: '2px solid #dee2e6',
                                                            } : {}),
                                                        }}
                                                    >
                                                        {header}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pieTableRows.map((row) => (
                                                <tr key={row.type}>
                                                    <th
                                                        scope="row"
                                                        style={{
                                                            position: 'sticky',
                                                            left: 0,
                                                            zIndex: 1,
                                                            fontWeight: 'bold',
                                                            textAlign: 'center',
                                                            borderRight: '2px solid #dee2e6',
                                                        }}
                                                    >
                                                        {row.year}
                                                    </th>
                                                    <td>{row.type}</td>
                                                    <td style={{ textAlign: 'right' }}>{formatPct(row.share)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div ref={pieBottomScrollRef} className="public-ev-charging-stations-table-scrollbar" aria-hidden="true"><div /></div>
                                <div className="public-ev-charging-stations-download-buttons">
                                    <button type="button" onClick={downloadPieCsv} style={downloadBtnStyle}>
                                        {getText('public_ev_charging_stations_download_csv', lang)}
                                    </button>
                                    <button type="button" onClick={downloadPieDocx} style={downloadBtnStyle}>
                                        {getText('public_ev_charging_stations_download_docx', lang)}
                                    </button>
                                </div>
                            </details>
                        </div>
                    </div>

                    <div className="public-ev-charging-stations-bar-column">
                        <div className="public-ev-charging-stations-chart-frame">
                            <h2 id="public-ev-charging-stations-bar-chart-title" className="public-ev-charging-stations-chart-title">
                                {getText('public_ev_charging_stations_bar_chart_title_plain', lang)}
                                {footnoteLink('fn-asterisk-rf-public-ev-charging-stations-bar')}
                            </h2>

                            {selectedBarPoints !== null && (
                                <button type="button" className="public-ev-charging-stations-clear-selection" onClick={() => setSelectedBarPoints(null)}>
                                    {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                                </button>
                            )}

                            <div className="public-ev-charging-stations-chart-block">
                                <figure
                                    ref={barChartRef}
                                    className="public-ev-charging-stations-chart"
                                    role="region"
                                    aria-label={barChartTitle}
                                    tabIndex={0}
                                    style={{ margin: 0, height: `${barPlotHeight}px` }}
                                >
                                    <PublicEvChargingStationsPlot
                                        plotData={barPlotData}
                                        plotLayout={barLayout}
                                        chartConfig={barChartConfig}
                                        plotHeight={barPlotHeight}
                                        plotKey={barPlotKey}
                                        onPlotReady={onBarPlotReady}
                                    />
                                </figure>
                            </div>

                            <details className="data-table-wrapper public-ev-charging-stations-panel-footer" onToggle={(e) => setIsBarTableOpen(e.currentTarget.open)}>
                                <summary role="button" aria-expanded={isBarTableOpen}>
                                    <span aria-hidden="true" style={{ marginRight: '8px' }}>{isBarTableOpen ? '▼' : '▶'}</span>
                                    {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                    <span className="wb-inv">
                                        {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                    </span>
                                </summary>
                                <div ref={barTopScrollRef} className="public-ev-charging-stations-table-scrollbar" aria-hidden="true"><div /></div>
                                <div
                                    ref={barTableScrollRef}
                                    className="table-responsive"
                                    role="region"
                                    aria-label={lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                    tabIndex={0}
                                >
                                    <table className="table table-bordered table-striped table-hover">
                                        <caption className="wb-inv">{barTableCaption}</caption>
                                        <thead>
                                            <tr>
                                                {barTableHeaders.map((header, index) => (
                                                    <th
                                                        key={header}
                                                        scope="col"
                                                        style={{
                                                            fontWeight: 'bold',
                                                            textAlign: 'center',
                                                            whiteSpace: 'nowrap',
                                                            verticalAlign: 'bottom',
                                                            ...(index === 0 ? {
                                                                position: 'sticky',
                                                                left: 0,
                                                                backgroundColor: '#f8f9fa',
                                                                zIndex: 2,
                                                                borderRight: '2px solid #dee2e6',
                                                            } : {}),
                                                        }}
                                                    >
                                                        {header}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {barTableRowsDesc.map((row) => (
                                                <tr key={row.year}>
                                                    <th
                                                        scope="row"
                                                        style={{
                                                            position: 'sticky',
                                                            left: 0,
                                                            zIndex: 1,
                                                            fontWeight: 'bold',
                                                            textAlign: 'center',
                                                            borderRight: '2px solid #dee2e6',
                                                        }}
                                                    >
                                                        {row.year}
                                                    </th>
                                                    <td style={{ textAlign: 'right' }}>{formatNumber(row.stations)}</td>
                                                    <td style={{ textAlign: 'right' }}>{row.growth != null ? formatGrowth(row.growth) : '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div ref={barBottomScrollRef} className="public-ev-charging-stations-table-scrollbar" aria-hidden="true"><div /></div>
                                <div className="public-ev-charging-stations-download-buttons">
                                    <button type="button" onClick={downloadBarCsv} style={downloadBtnStyle}>
                                        {getText('public_ev_charging_stations_download_csv', lang)}
                                    </button>
                                    <button type="button" onClick={downloadBarDocx} style={downloadBtnStyle}>
                                        {getText('public_ev_charging_stations_download_docx', lang)}
                                    </button>
                                </div>
                            </details>
                        </div>
                    </div>
                </div>

                <p className="public-ev-charging-stations-paragraph">
                    {getText('public_ev_charging_stations_paragraph_part1', lang)}
                    <strong>{getText('public_ev_charging_stations_paragraph_bold', lang)}</strong>
                    {getText('public_ev_charging_stations_paragraph_part2', lang)}
                </p>

                <aside className="wb-fnote public-ev-charging-stations-footnotes" role="note">
                    <h2>{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnote' : 'Note de bas de page'}</dt>
                        <dd id="fn-asterisk-public-ev-charging-stations">
                            <a
                                href="#fn-asterisk-rf-public-ev-charging-stations-pie"
                                onClick={scrollToElement('fn-asterisk-rf-public-ev-charging-stations-pie')}
                                className="fn-num"
                                title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}
                            >
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                            </a>
                            {' '}
                            <p>{getText('public_ev_charging_stations_footnote', lang)}</p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default PublicEvChargingStations;
