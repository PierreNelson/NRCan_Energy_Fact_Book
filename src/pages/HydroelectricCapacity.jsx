import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import HydroelectricCapacityHydroMapLayer, { HydroelectricCapacityHydroForegroundOverlays, HydroelectricCapacityHoverTooltip } from '../components/HydroelectricCapacityInfographic';
import { getHydroelectricCapacityData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';

const FACILITY_PROV_COLORS = {
    on: '#4b4c4d',
    qc: '#2B5C3F',
    bc: '#709735',
    man: '#C87A04',
    nl: '#5B9BD5',
};
const LEGEND_KEYS = ['on', 'bc', 'qc', 'nl', 'man'];

const HOVER_LABEL = {
    bgcolor: '#ffffff',
    bordercolor: '#000000',
    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
};

const getPlotTooltipPosition = (event, bgRef, chartRef) => {
    const bgEl = bgRef.current;
    if (!bgEl) return null;
    const bgRect = bgEl.getBoundingClientRect();
    const mouseEv = event?.event ?? event?.nativeEvent;
    if (mouseEv && Number.isFinite(mouseEv.clientX) && Number.isFinite(mouseEv.clientY)) {
        return {
            left: mouseEv.clientX - bgRect.left,
            top: mouseEv.clientY - bgRect.top,
        };
    }
    const pt = event?.points?.[0];
    const plotEl = chartRef.current?.querySelector('.plot-container') ?? chartRef.current;
    if (pt?.bbox && plotEl) {
        const plotRect = plotEl.getBoundingClientRect();
        return {
            left: plotRect.left - bgRect.left + (pt.bbox.x0 + pt.bbox.x1) / 2,
            top: plotRect.top - bgRect.top + (pt.bbox.y0 + pt.bbox.y1) / 2,
        };
    }
    return null;
};

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const tokenizeLabelForWrap = (text) => {
    if (!text) return [];
    const tokens = [];
    const re = /(\([^)]*\))|\S+/g;
    let match;
    while ((match = re.exec(text)) !== null) {
        tokens.push(match[0]);
    }
    return tokens;
};

const wrapTickLabel = (text, maxLength) => {
    if (!text || text.length <= maxLength) return text;
    const tokens = tokenizeLabelForWrap(text);
    const lines = [];
    let currentLine = '';
    tokens.forEach((token) => {
        const candidate = currentLine ? `${currentLine} ${token}` : token;
        if (candidate.length > maxLength && currentLine) {
            lines.push(currentLine);
            currentLine = token;
        } else {
            currentLine = candidate;
        }
    });
    if (currentLine) lines.push(currentLine);
    return lines.join('<br>');
};

const major_hydro_facilities_FAC_WRAP_ZOOM = 2.5;
const major_hydro_facilities_FAC_WRAP_DEEP_ZOOM = 3.25;

const HydroelectricCapacityPlot = memo(function HydroelectricCapacityPlot({
    plotKey, plotData, plotLayout, plotConfig, onPlotReady,
}) {
    return (
        <Plot
            key={plotKey}
            data={plotData}
            layout={plotLayout}
            config={plotConfig}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
            onInitialized={onPlotReady}
        />
    );
});

const createInitialViewportZoom = () => {
    if (typeof window === 'undefined') {
        return { pinScale: 1, layoutRatio: 1, cssZoomFactor: 1, dprZoomFactor: 1, screenZoomHint: 1, outerInnerZoom: 1 };
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
    const outerInnerZoom = inner > 0 ? outer / inner : 1;
    return { pinScale, layoutRatio, cssZoomFactor: 1, dprZoomFactor: 1, screenZoomHint, outerInnerZoom };
};

const HydroelectricCapacity = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hoverTip, setHoverTip] = useState(null);
    const windowWidth = useWindowWidth();
    const {
        selected: selectedPoints,
        clear: clearSelection,
        onPlotClick,
    } = usePlotlySelection({ mode: 'slices', windowWidth });
    const [viewportZoom, setViewportZoom] = useState(createInitialViewportZoom);

    const chartRef = useRef(null);
    const chartBgRef = useRef(null);
    const zoomBaselineRef = useRef(null);
    const hoverHandlerRef = useRef(null);
    const clickHandlerRef = useRef(null);
    const hoverClearRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const tickFont = useMemo(() => ({ size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' }), [windowWidth]);

    const getLegendLabel = useCallback((key) => getText(`major_hydro_facilities_legend_${key}`, lang), [lang]);

    const formatMw = useCallback((value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    }, [locale]);

    useEffect(() => {
        getHydroelectricCapacityData()
            .then(setResult)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
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
            setViewportZoom({
                pinScale,
                layoutRatio,
                cssZoomFactor,
                dprZoomFactor,
                screenZoomHint,
                outerInnerZoom: inner > 0 ? outer / inner : 1,
            });
        };
        syncZoom();
        const vv = window.visualViewport;
        vv?.addEventListener('resize', syncZoom);
        vv?.addEventListener('scroll', syncZoom);
        window.addEventListener('resize', syncZoom);
        return () => {
            vv?.removeEventListener('resize', syncZoom);
            vv?.removeEventListener('scroll', syncZoom);
            window.removeEventListener('resize', syncZoom);
        };
    }, []);

    




    const facilities = useMemo(() => result?.facilities ?? [], [result]);
    const referenceYear = result?.referenceYear;
    const totalHydroMw = result?.totalHydroMw;

    const zoomEffective = Math.max(
        viewportZoom.pinScale,
        viewportZoom.layoutRatio,
        viewportZoom.cssZoomFactor,
        viewportZoom.dprZoomFactor,
        viewportZoom.screenZoomHint,
    );
    const useWrapLabels = zoomEffective >= major_hydro_facilities_FAC_WRAP_ZOOM || windowWidth <= 480;
    const labelMaxLength = zoomEffective >= major_hydro_facilities_FAC_WRAP_DEEP_ZOOM ? 14 : 20;

    const facLabels = useMemo(() => facilities.map((row) => row.facility), [facilities]);
    const facValues = useMemo(() => facilities.map((row) => row.capacity), [facilities]);
    const facTickText = useMemo(() => {
        if (!useWrapLabels) return facLabels;
        return facLabels.map((label) => wrapTickLabel(label, labelMaxLength));
    }, [facLabels, useWrapLabels, labelMaxLength]);

    const facBoldTickText = useMemo(() => {
        const labels = useWrapLabels ? facTickText : facLabels;
        return labels.map((label) =>
            String(label)
                .split('<br>')
                .map((line) => `<b>${line.replace(/<[^>]*>/g, '')}</b>`)
                .join('<br>'),
        );
    }, [facLabels, facTickText, useWrapLabels]);

    const facRightMargin = windowWidth <= 480 ? 8 : 12;
    const facLeftMargin = useMemo(() => {
        const labels = useWrapLabels ? facTickText : facLabels;
        const fontSize = tickFont.size;
        const charPx = fontSize * 0.58;
        const minMargin = windowWidth <= 480 ? 72 : 88;
        const maxLineWidth = Math.max(
            0,
            ...labels.flatMap((label) =>
                String(label).split('<br>').map((line) => line.replace(/<[^>]*>/g, '').length * charPx),
            ),
        );
        return Math.max(minMargin, Math.ceil(maxLineWidth + 8));
    }, [useWrapLabels, facTickText, facLabels, tickFont.size, windowWidth]);

    const facColumnHeaderStyle = {
        gridTemplateColumns: `${facLeftMargin}px 1fr`,
        marginRight: 0,
        paddingRight: 0,
    };

    const facRowHeight = windowWidth <= 480 ? 24 : 28;
    const facPlotHeight = useMemo(
        () => Math.max(480, facilities.length * facRowHeight + 80),
        [facilities.length, facRowHeight],
    );

    const facXMax = useMemo(() => {
        const max = Math.max(...facValues, 0);
        return Math.ceil(max * 1.15 / 50) * 50;
    }, [facValues]);

    const barOpacityFor = useCallback((pointIndex) => {
        if (selectedPoints === null) return 1;
        return selectedPoints.includes(pointIndex) ? 1 : 0.3;
    }, [selectedPoints]);

    const barLabelFontSize = windowWidth <= 480 ? 12 : 14;
    const insideBarLabelFont = useMemo(() => ({
        size: barLabelFontSize,
        color: '#ffffff',
        family: 'Arial, sans-serif',
        weight: 700,
    }), [barLabelFontSize]);

    const facBaseColors = useMemo(
        () => facilities.map((row) => FACILITY_PROV_COLORS[row.provKey] || '#666666'),
        [facilities],
    );

    const facPlotData = useMemo(() => [{
        type: 'bar',
        orientation: 'h',
        y: facLabels,
        x: facValues,
        customdata: facValues.map((v) => formatMw(v)),
        marker: {
            color: facBaseColors,
            opacity: facilities.map((_, i) => barOpacityFor(i)),
            line: { width: 0 },
        },
        text: facValues.map((v) => formatMw(v)),
        textposition: 'inside',
        insidetextanchor: 'end',
        textfont: insideBarLabelFont,
        insidetextfont: insideBarLabelFont,
        cliponaxis: false,
        hoverinfo: 'none',
        hovertemplate: '<extra></extra>',
    }], [facLabels, facValues, facilities, facBaseColors, insideBarLabelFont, barOpacityFor, formatMw]);

    const facPlotLayout = useMemo(() => ({
        showlegend: false,
        hovermode: 'closest',
        hoverlabel: HOVER_LABEL,
        clickmode: 'event',
        dragmode: false,
        height: facPlotHeight,
        xaxis: {
            range: [0, facXMax],
            showgrid: false,
            showline: true,
            linewidth: 1,
            linecolor: '#333',
            tickfont: tickFont,
            fixedrange: true,
            automargin: false,
            showticklabels: false,
            title: { text: '' },
        },
        yaxis: {
            type: 'category',
            categoryorder: 'array',
            categoryarray: facLabels,
            tickmode: 'array',
            tickvals: facLabels,
            ticktext: facBoldTickText,
            autorange: 'reversed',
            showgrid: false,
            tickfont: { ...tickFont, weight: 700 },
            fixedrange: true,
            automargin: false,
            side: 'left',
            ticklabelposition: 'outside',
            title: { text: '' },
        },
        margin: { l: facLeftMargin, r: facRightMargin, t: 8, b: 40 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        autosize: true,
    }), [facXMax, facLabels, facBoldTickText, tickFont, facPlotHeight, facLeftMargin, facRightMargin]);

    const getPointIndex = (point) => {
        if (point.pointIndex != null && point.pointIndex >= 0) return point.pointIndex;
        if (point.pointNumber != null && point.pointNumber >= 0) return point.pointNumber;
        return undefined;
    };

    const handleChartHover = useCallback((event) => {
        const pt = event?.points?.[0];
        if (!pt) return;
        const pointIndex = getPointIndex(pt);
        const row = pointIndex != null ? facilities[pointIndex] : null;
        if (!row) return;
        const position = getPlotTooltipPosition(event, chartBgRef, chartRef);
        if (!position) return;
        setHoverTip({
            left: position.left,
            top: position.top,
            title: row.facility,
            value: `${formatMw(row.capacity)} MW`,
        });
    }, [facilities, formatMw]);

    const handleChartClick = useCallback((event) => {
        setHoverTip(null);
        onPlotClick(event);
    }, [onPlotClick]);

    useEffect(() => {
        hoverHandlerRef.current = handleChartHover;
        clickHandlerRef.current = handleChartClick;
        hoverClearRef.current = () => setHoverTip(null);
    });

    const bindPlotHandlers = useCallback((graphDiv) => {
        if (!graphDiv?.on) return;
        if (graphDiv._majorHydroFacilitiesHover) {
            graphDiv.removeListener('plotly_hover', graphDiv._majorHydroFacilitiesHover);
        }
        if (graphDiv._majorHydroFacilitiesUnhover) {
            graphDiv.removeListener('plotly_unhover', graphDiv._majorHydroFacilitiesUnhover);
        }
        if (graphDiv._majorHydroFacilitiesClick) {
            graphDiv.removeListener('plotly_click', graphDiv._majorHydroFacilitiesClick);
        }
        const hoverHandler = (event) => hoverHandlerRef.current?.(event);
        const unhoverHandler = () => hoverClearRef.current?.();
        const clickHandler = (event) => clickHandlerRef.current?.(event);
        graphDiv._majorHydroFacilitiesHover = hoverHandler;
        graphDiv._majorHydroFacilitiesUnhover = unhoverHandler;
        graphDiv._majorHydroFacilitiesClick = clickHandler;
        graphDiv.on('plotly_hover', hoverHandler);
        graphDiv.on('plotly_unhover', unhoverHandler);
        graphDiv.on('plotly_click', clickHandler);
    }, []);

    const onPlotReady = useCallback(
        (_figure, graphDiv) => bindPlotHandlers(graphDiv),
        [bindPlotHandlers],
    );

    const handleChartWrapperLeave = useCallback(() => setHoverTip(null), []);

    const chartTitleSuffix = substitute(getText('major_hydro_facilities_chart_title_suffix', lang), { year: referenceYear ?? '' });
    const chartTitleFull = `${stripHtml(getText('major_hydro_facilities_chart_title', lang))}${stripHtml(chartTitleSuffix)}`;
    const chartTitleSpoken = substitute(getText('major_hydro_facilities_chart_title_spoken', lang), { year: referenceYear ?? '' });
    const subtitleSpoken = getText('major_hydro_facilities_subtitle_spoken', lang);
    const unitSpoken = getText('major_hydro_facilities_unit_spoken', lang);
    const calloutSpoken = (totalHydroMw != null && referenceYear != null)
        ? substitute(getText('major_hydro_facilities_callout_spoken', lang), {
            value: formatMw(totalHydroMw),
            year: referenceYear,
        })
        : '';
    const exportChartTitle = chartTitleFull;
    const chartDownloadSlug = getText('major_hydro_facilities_download_title', lang).replace(/\s+/g, '_');
    const colFacility = getText('major_hydro_facilities_table_col_facility', lang);
    const colCapacity = getText('major_hydro_facilities_table_col_capacity', lang);

    const tableColumns = useMemo(() => [
        { key: 'facility', header: colFacility, align: 'left' },
        { key: 'capacity', header: colCapacity, align: 'num' },
    ], [colFacility, colCapacity]);

    const calloutLines = useMemo(() => {
        if (totalHydroMw == null || referenceYear == null) return null;
        const value = formatMw(totalHydroMw);
        return [
            getText('major_hydro_facilities_callout_line1', lang),
            substitute(getText('major_hydro_facilities_callout_line2', lang), { value }),
            substitute(getText('major_hydro_facilities_callout_line3', lang), { year: referenceYear }),
        ];
    }, [totalHydroMw, referenceYear, lang, formatMw]);

    const calloutStopRef = useRef(null);
    useLayoutEffect(() => {
        const stop = calloutStopRef.current;
        const figure = chartRef.current;
        const root = chartBgRef.current;
        if (!stop || !figure || !root) return undefined;

        const place = () => {
            const lines = root.querySelectorAll('.major-hydro-facilities-overlay-callout-line');
            if (!lines.length) return;
            const figBox = figure.getBoundingClientRect();
            let top = Infinity;
            let left = Infinity;
            let right = -Infinity;
            let bottom = -Infinity;
            lines.forEach((el) => {
                const box = el.getBoundingClientRect();
                top = Math.min(top, box.top);
                left = Math.min(left, box.left);
                right = Math.max(right, box.right);
                bottom = Math.max(bottom, box.bottom);
            });
            const pad = 8;
            stop.style.top = `${top - figBox.top - pad}px`;
            stop.style.left = `${left - figBox.left - pad}px`;
            stop.style.width = `${Math.max(0, right - left + pad * 2)}px`;
            stop.style.height = `${Math.max(0, bottom - top + pad * 2)}px`;
        };

        place();
        const observer = new ResizeObserver(place);
        observer.observe(figure);
        observer.observe(root);
        return () => observer.disconnect();
    }, [calloutLines, facPlotHeight, lang]);

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${chartDownloadSlug}.png`,
        title: exportChartTitle,
        width: 1000,
        height: facPlotHeight,
        legendItems: LEGEND_KEYS.map((key) => ({
            label: getLegendLabel(key),
            color: FACILITY_PROV_COLORS[key],
        })),
    }),
        [FACILITY_PROV_COLORS, LEGEND_KEYS, chartDownloadSlug, exportChartTitle, facPlotHeight, getLegendLabel],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        name: getText('major_hydro_facilities_download_png', lang),
        click: (gd) => downloadChartWithTitle(gd),
    });

    if (loading) {
        return (
            <PageStatus
                lang={lang}
                loading
                loadingMessage={lang === 'en' ? 'Loading data…' : 'Chargement des données…'}
                className="major-hydro-facilities-loading"
            />
        );
    }
    if (error) {
        return <PageStatus lang={lang} error={error} className="major-hydro-facilities-error" />;
    }
    if (!facilities.length) {
        return <p className="major-hydro-facilities-error">{lang === 'en' ? 'No data available.' : 'Aucune donnée disponible.'}</p>;
    }

    const getChartSummary = () => {
        const cats = (facPlotData?.[0]?.y || facPlotData?.[0]?.x || []).slice();
        const vals = facValues || facPlotData?.[0]?.x || facPlotData?.[0]?.y || [];
        const body = summarizeByCategory({
            categories: Array.isArray(cats) ? cats : [],
            series: [{
                name: lang === 'en' ? 'Capacity' : 'Capacité',
                values: vals,
                format: (v) => {
                    const formatted = formatMw(v);
                    return formatted === '—' ? formatted : `${formatted} ${unitSpoken}`;
                },
            }],
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en' ? 'Bar chart of major hydroelectric facilities' : 'Graphique à barres des grandes installations hydroélectriques',
            body,
            lang,
        });
    };
    const chartRegionLabel = `${chartTitleSpoken}. ${getChartSummary()}`;

    return (
        <PageShell id="main-content"
            tabIndex="-1"
            className="page-content page-76 page-chrome page-chrome--bleed"
            role="main"
            aria-labelledby="major-hydro-facilities-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.page-76.page-content { max-width: none !important; overflow-x: visible !important; }
.page-76 {
}
.major-hydro-facilities-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.major-hydro-facilities-title {
    line-height: 1.25;
    text-transform: none;
}
.major-hydro-facilities-subtitle {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 20px;
    text-transform: none;
    line-height: 1.3;
}
.major-hydro-facilities-chart-frame {
    margin-top: 0;
    margin-bottom: 0;
}
.major-hydro-facilities-chart-title {
    color: var(--gc-text);
    margin-bottom: 12px;
    text-transform: none;
}
.major-hydro-facilities-chart-bg-wrapper {
    position: relative;
    width: 100%;
    isolation: isolate;
}
.major-hydro-facilities-chart-overlay { position: relative; z-index: 2; width: 100%; pointer-events: auto; }
.major-hydro-facilities-chart-scroll { width: 100%; overflow: visible; position: relative; pointer-events: auto; }
.major-hydro-facilities-chart { width: 100%; min-width: 0; position: relative; z-index: 1; overflow: visible; }
.major-hydro-facilities-callout-stop {
    position: absolute;
    z-index: 6;
    pointer-events: none;
    box-sizing: border-box;
}
.major-hydro-facilities-chart > div { width: 100%; height: 100%; overflow: visible; }
.major-hydro-facilities-chart .js-plotly-plot,
.major-hydro-facilities-chart .plot-container,
.major-hydro-facilities-chart .svg-container { overflow: visible !important; pointer-events: auto !important; }
.major-hydro-facilities-chart .js-plotly-plot .plotly .modebar { right: 4px !important; top: 2px !important; }
.major-hydro-facilities-chart .hoverlayer { display: none !important; }
.major-hydro-facilities-column-headers {
    display: grid;
    align-items: flex-end;
    font-family: Arial, sans-serif;
    font-size: 16px;
    font-weight: bold;
    color: #58585a;
    margin-bottom: 4px;
    padding: 0;
    box-sizing: border-box;
    width: 100%;
    pointer-events: none;
}
.major-hydro-facilities-column-headers span { text-align: right; padding-right: 2px; box-sizing: border-box; }
.major-hydro-facilities-legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 14px 24px;
    margin-top: 16px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: var(--gc-text);
}
.major-hydro-facilities-legend-item { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.major-hydro-facilities-legend-swatch { width: 22px; height: 14px; display: inline-block; border: 1px solid rgba(0, 0, 0, 0.12); }
.major-hydro-facilities-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.major-hydro-facilities-chart-frame button:hover { background-color: #404040 !important; }
.major-hydro-facilities-loading, .major-hydro-facilities-error {
    font-family: 'Noto Sans', sans-serif;
    font-size: 18px;
    color: var(--gc-text);
    margin: 24px 0;
}
@media (max-width: 900px) {
    .major-hydro-facilities-legend { justify-content: center; }
}
@media (max-width: 768px) {
    .major-hydro-facilities-subtitle { font-size: 26px; }
    .major-hydro-facilities-column-headers { font-size: 14px; }
}
            `}</style>

            <div className="major-hydro-facilities-inner">
                <h1 id="major-hydro-facilities-title" className="major-hydro-facilities-title page-chrome-title">{getText('major_hydro_facilities_title', lang)}</h1>
                <h2 className="major-hydro-facilities-subtitle" aria-label={subtitleSpoken}>{getText('major_hydro_facilities_subtitle', lang)}</h2>

                <div className="major-hydro-facilities-chart-frame page-chrome-chart-frame">
                    <h2 id="major-hydro-facilities-chart-title" className="major-hydro-facilities-chart-title page-chrome-chart-title wb-inv" aria-label={chartTitleSpoken}>
                        {getText('major_hydro_facilities_chart_title', lang)}{chartTitleSuffix}
                    </h2>

                    {selectedPoints !== null && (
                        <ClearSelectionButton lang={lang} onClick={clearSelection} />
                    )}

                    <div
                        className="major-hydro-facilities-chart-bg-wrapper"
                        ref={chartBgRef}
                        style={{ minHeight: facPlotHeight }}
                        onMouseLeave={handleChartWrapperLeave}
                    >
                        <HydroelectricCapacityHydroMapLayer minHeight={facPlotHeight} />

                        <div className="major-hydro-facilities-chart-overlay">
                            <div className="major-hydro-facilities-column-headers" style={facColumnHeaderStyle} aria-hidden="true">
                                <span>{getText('major_hydro_facilities_table_col_facility', lang)}</span>
                            </div>

                            <div className="major-hydro-facilities-chart-scroll">
                                <figure
                                    ref={chartRef}
                                    className="major-hydro-facilities-chart"
                                    style={{ height: facPlotHeight, margin: 0 }}
                                    role="region"
                                    aria-label={chartRegionLabel}
                                    tabIndex={0}
                                >
                                    {calloutSpoken ? (
                                        <div
                                            ref={calloutStopRef}
                                            className="major-hydro-facilities-callout-stop"
                                            tabIndex={0}
                                            role="group"
                                            data-prose-tab="1"
                                            aria-label={calloutSpoken}
                                        />
                                    ) : null}
                                    <div aria-hidden="true" style={{ width: '100%', height: '100%' }}>
                                    <HydroelectricCapacityPlot
                                        plotKey={`major-hydro-facilities-${useWrapLabels ? 'wrap' : 'plain'}-${Math.round(zoomEffective * 100)}-${facPlotHeight}-${facLeftMargin}`}
                                        plotData={facPlotData}
                                        plotLayout={facPlotLayout}
                                        plotConfig={plotConfig}
                                        onPlotReady={onPlotReady}
                                    />
                                    </div>
                                </figure>
                            </div>
                        </div>

                        <HydroelectricCapacityHydroForegroundOverlays
                            lang={lang}
                            damLabel={getText('major_hydro_facilities_dam_label', lang)}
                            minHeight={facPlotHeight}
                            calloutLines={calloutLines}
                            style={{ pointerEvents: 'none' }}
                        />
                        <HydroelectricCapacityHoverTooltip tip={hoverTip} />
                    </div>

                    <div className="major-hydro-facilities-legend" aria-hidden="false">
                        {LEGEND_KEYS.map((key) => (
                            <span key={key} className="major-hydro-facilities-legend-item">
                                <span className="major-hydro-facilities-legend-swatch" style={{ backgroundColor: FACILITY_PROV_COLORS[key] }} />
                                {getLegendLabel(key)}
                            </span>
                        ))}
                    </div>

                    <div className="major-hydro-facilities-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={facilities}
                            csvFilename={`${chartDownloadSlug}.csv`}
                            docx={{
                                filename: `${chartDownloadSlug}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [5600, 2000],
                                fontSize: 22,
                            }}
                                caption={chartTitleSpoken}
                                tableAriaLabel={chartTitleSpoken}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatMw(raw)
                            )}
                        />
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default HydroelectricCapacity;
