import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import PageFootnotes from '../components/PageFootnotes';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { getCanadianRenewableEnergyProductionData } from '../utils/dataLoader';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import { makeScrollToIdHandler } from '../utils/scrollToId';

import canadianRenewableEnergyProductionBg from '../assets/canadian_renewable_energy_production_bg.svg';
import { formatLocalePct } from '../utils/formatLocale';

const VALUE_BAR = '#2B5C3F';
const TRACK_BAR = '#e8e8e8';

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

const CanadianRenewableEnergyProductionPlot = memo(function CanadianRenewableEnergyProductionPlot({
    plotKey, plotData, plotLayout, chartConfig, onPlotReady,
}) {
    return (
        <Plot
            key={plotKey}
            data={plotData}
            layout={plotLayout}
            config={chartConfig}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
            onInitialized={onPlotReady}
        />
    );
});

const OVERLAY = { x: 0.52, y: 0.98, sizex: 0.48, sizey: 0.95 };
const BARS_Y_DOMAIN = [0.02, 0.98];
const PLOT_HEIGHT_BASE = 420;
const PLOT_HEIGHT_MIN = 72;
const PLOT_AREA_WIDTH_REF = 700;
const PLOT_MARGIN = { l: 0, r: 16, t: 12, b: 12 };
const TICK_FONT_FAMILY = 'Arial, sans-serif';
const LEFT_MARGIN_MAX_FRAC = 0.28;
const BAR_VALUE_FONT_SIZE = 14;
const BAR_GAP = 0.32;
const INSIDE_LABEL_MIN = 5;

const tickFontSizeForWidth = (width) => (
    width <= 480 ? 13 : width <= 768 ? 14 : 15
);

const measureBoldLabelWidth = (label, fontSize) => {
    if (typeof document === 'undefined') {
        return Math.ceil(String(label).length * fontSize * 0.56);
    }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return Math.ceil(String(label).length * fontSize * 0.56);
    ctx.font = `700 ${fontSize}px ${TICK_FONT_FAMILY}`;
    const lines = String(label).split(/<br\s*\/?>/i);
    return Math.ceil(Math.max(...lines.map((line) => ctx.measureText(line.replace(/<\/?b>/gi, '')).width)));
};

const COMPACT_LABELS = {
    en: {
        'Solid biomass (e.g. wood/waste)': 'Solid biomass',
        'Municipal waste/landfill gas': 'Municipal waste',
        'Solar photovoltaic': 'Solar PV',
    },
    fr: {
        'Hydroélectricité': 'Hydro',
        'Biomasses solides (p. ex. bois/déchets)': 'Biomasses solides',
        'Énergie éolienne': 'Éolienne',
        "Déchets municipaux renouvelables/gaz de sites d'enfouissement": 'Déchets municipaux',
        'Énergie solaire photovoltaïque': 'Solaire PV',
        'Énergie solaire thermique': 'Solaire thermique',
    },
};

const compactCategoryLabelIfNeeded = (label, { compact, lang }) => {
    if (!compact) return label;
    return COMPACT_LABELS[lang]?.[label] || label;
};

const wrapCategoryLabelIfNeeded = (label, { wrap }) => {
    if (!wrap) return label;
    if (label.includes('/')) {
        const parts = label.split('/');
        if (parts[0].length > 22) return `${parts[0].trim()}<br>${parts.slice(1).join('/').trim()}`;
    }
    if (label.length > 36) {
        const mid = label.lastIndexOf(' ', Math.floor(label.length / 2));
        if (mid > 10) return `${label.slice(0, mid)}<br>${label.slice(mid + 1)}`;
    }
    return label;
};

const computePageZoomScale = (baseline) => {
    if (typeof window === 'undefined') return { pageCssZoom: 1, baseline: null };

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
        layoutZoom = Math.max(inner / vv.width, vv.width / inner);
    }

    const pageCssZoom = Math.max(pinScale, layoutZoom, cssZoomFactor);
    return { pageCssZoom, baseline: nextBaseline };
};

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const CanadianRenewableEnergyProduction = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const [pageCssZoom, setPageCssZoom] = useState(() => computePageZoomScale(null).pageCssZoom);
    const {
        selected: selectedPoints,
        clear: clearSelection,
        onPlotClick,
    } = usePlotlySelection({ mode: 'slices', windowWidth });
    const [hoverTip, setHoverTip] = useState(null);
    const [production, setProduction] = useState(null);

    const chartRef = useRef(null);
    const chartBgRef = useRef(null);
    const chartWidthRef = useRef(null);
    const zoomBaselineRef = useRef(null);
    const clickHandlerRef = useRef(null);
    const hoverHandlerRef = useRef(null);
    const hoverClearRef = useRef(null);
    const [chartWidth, setChartWidth] = useState(800);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const bgImage = canadianRenewableEnergyProductionBg;

    const formatPct = useCallback((value, digits = 1) => formatLocalePct(value, lang, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }), [lang]);

    const formatWhole = (value) => Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    const formatMtoe = (value) => Number(value).toLocaleString(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });

    useEffect(() => {
        let cancelled = false;
        getCanadianRenewableEnergyProductionData()
            .then((data) => {
                if (!cancelled) setProduction(data);
            })
            .catch(() => {
                if (!cancelled) setProduction(null);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const shareRows = production?.rows ?? [];
    const shareValues = shareRows.map((row) => row.share);
    const trackValues = shareRows.map(() => 100);

    const textVars = {
        year: production?.year ?? '',
        pj: production ? formatWhole(production.totalPj) : '',
        mtoe: production ? formatMtoe(production.totalMtoe) : '',
    };

    const pageTitle = substitute(getText('canadian_renewable_energy_production_title', lang), textVars);
    const chartTitlePrefix = getText('canadian_renewable_energy_production_chart_title_prefix', lang);
    const chartTitleSuffix = substitute(getText('canadian_renewable_energy_production_chart_title_suffix', lang), textVars);
    const chartTitlePlain = `${chartTitlePrefix}*${chartTitleSuffix}`;
    const exportChartTitle = stripHtml(chartTitlePlain);
    const chartDownloadSlug = substitute(
        getText('canadian_renewable_energy_production_download_title', lang),
        textVars,
    ).replace(/\s+/g, '_');
    const tableCaption = substitute(
        getText('canadian_renewable_energy_production_table_caption', lang),
        textVars,
    );

    const shareLabels = useMemo(
        () => shareRows.map((row) => getText(`canadian_renewable_energy_production_cat_${row.key}`, lang)),
        [shareRows, lang],
    );

    const tableColumns = useMemo(() => [
        { key: 'category', header: getText('canadian_renewable_energy_production_table_col_category', lang), align: 'left' },
        { key: 'share', header: getText('canadian_renewable_energy_production_table_col_share', lang), align: 'num' },
    ], [lang]);

    const tableRows = useMemo(
        () => shareRows.map((row, index) => ({
            category: shareLabels[index],
            share: row.share,
        })),
        [shareRows, shareLabels],
    );

    const tickFontSize = tickFontSizeForWidth(windowWidth);
    const compactCategoryLabels = pageCssZoom >= 2.5 || chartWidth < 420;
    const wrapCategoryLabels = !compactCategoryLabels && (chartWidth < 640 || lang === 'fr');
    const categoryTickLabels = useMemo(
        () => shareLabels.map((label) => {
            const compact = compactCategoryLabelIfNeeded(label, { compact: compactCategoryLabels, lang });
            return wrapCategoryLabelIfNeeded(compact, { wrap: wrapCategoryLabels });
        }),
        [shareLabels, compactCategoryLabels, wrapCategoryLabels, lang],
    );

    const leftMargin = useMemo(() => {
        const pad = 10;
        const needed = Math.max(
            64,
            ...categoryTickLabels.map((label) => measureBoldLabelWidth(label, tickFontSize) + pad),
        );
        const maxAllowed = Math.max(64, Math.floor(chartWidth * LEFT_MARGIN_MAX_FRAC));
        return Math.min(needed, maxAllowed);
    }, [categoryTickLabels, tickFontSize, chartWidth]);

    const plotMargin = useMemo(() => ({
        ...PLOT_MARGIN,
        l: leftMargin,
    }), [leftMargin]);

    const plotHeight = useMemo(() => {
        const plotAreaW = Math.max(64, chartWidth - leftMargin - PLOT_MARGIN.r);
        const baseAreaH = PLOT_HEIGHT_BASE - PLOT_MARGIN.t - PLOT_MARGIN.b;
        const minAreaH = Math.max(40, PLOT_HEIGHT_MIN - PLOT_MARGIN.t - PLOT_MARGIN.b);
        const scaledAreaH = plotAreaW * (baseAreaH / PLOT_AREA_WIDTH_REF);
        const plotAreaH = Math.min(baseAreaH, Math.max(minAreaH, scaledAreaH));
        return Math.round(plotAreaH + PLOT_MARGIN.t + PLOT_MARGIN.b);
    }, [chartWidth, leftMargin]);

    const tickFont = useMemo(
        () => ({ size: tickFontSize, family: TICK_FONT_FAMILY }),
        [tickFontSize],
    );
    const boldTickText = useMemo(
        () => categoryTickLabels.map((label) => String(label)
            .split(/<br\s*\/?>/i)
            .map((line) => `<b>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</b>`)
            .join('<br>')),
        [categoryTickLabels],
    );

    const chartImages = useMemo(() => ([{
        source: bgImage,
        xref: 'paper',
        yref: 'paper',
        x: OVERLAY.x,
        y: OVERLAY.y,
        sizex: OVERLAY.sizex,
        sizey: OVERLAY.sizey,
        xanchor: 'left',
        yanchor: 'top',
        sizing: 'stretch',
        layer: 'above',
    }]), [bgImage]);

    const barOpacityFor = useCallback((index) => {
        if (selectedPoints === null) return 1;
        return selectedPoints.includes(index) ? 1 : 0.3;
    }, [selectedPoints]);

    const getPointIndex = (point) => {
        if (point?.pointIndex != null && point.pointIndex >= 0) return point.pointIndex;
        if (point?.pointNumber != null && point.pointNumber >= 0) return point.pointNumber;
        return undefined;
    };

    const handleChartHover = useCallback((event) => {
        const pt = event?.points?.[0];
        if (!pt || pt.curveNumber !== 1) return;
        const pointIndex = getPointIndex(pt);
        if (pointIndex === undefined) return;
        const position = getPlotTooltipPosition(event, chartBgRef, chartRef);
        if (!position) return;
        setHoverTip({
            left: position.left,
            top: position.top,
            label: shareLabels[pointIndex],
            value: formatPct(shareValues[pointIndex], 1),
        });
    }, [shareLabels, shareValues, formatPct]);

    const handleChartClick = useCallback((event) => {
        if (!event?.points?.length) return;
        const point = event.points[0];
        if (point.curveNumber !== 1) return;
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
        if (graphDiv._canadianRenewableEnergyProductionHover) {
            graphDiv.removeListener('plotly_hover', graphDiv._canadianRenewableEnergyProductionHover);
        }
        if (graphDiv._canadianRenewableEnergyProductionUnhover) {
            graphDiv.removeListener('plotly_unhover', graphDiv._canadianRenewableEnergyProductionUnhover);
        }
        if (graphDiv._canadianRenewableEnergyProductionClick) {
            graphDiv.removeListener('plotly_click', graphDiv._canadianRenewableEnergyProductionClick);
        }
        const hoverHandler = (event) => hoverHandlerRef.current?.(event);
        const unhoverHandler = () => hoverClearRef.current?.();
        const clickHandler = (event) => clickHandlerRef.current?.(event);
        graphDiv._canadianRenewableEnergyProductionHover = hoverHandler;
        graphDiv._canadianRenewableEnergyProductionUnhover = unhoverHandler;
        graphDiv._canadianRenewableEnergyProductionClick = clickHandler;
        graphDiv.on('plotly_hover', hoverHandler);
        graphDiv.on('plotly_unhover', unhoverHandler);
        graphDiv.on('plotly_click', clickHandler);
    }, []);

    const onPlotReady = useCallback(
        (_figure, graphDiv) => bindPlotHandlers(graphDiv),
        [bindPlotHandlers],
    );

    const handleChartWrapperLeave = useCallback(() => setHoverTip(null), []);

    const scrollToFootnote = makeScrollToIdHandler('fn-asterisk-canadian-renewable-energy-production');

    const scrollToRef = makeScrollToIdHandler('fn-asterisk-rf-canadian-renewable-energy-production');

    useEffect(() => {
        const onResize = () => {
            const { pageCssZoom: nextZoom, baseline } = computePageZoomScale(zoomBaselineRef.current);
            zoomBaselineRef.current = baseline;
            setPageCssZoom(nextZoom);
        };
        onResize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('scroll', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
            window.visualViewport?.removeEventListener('resize', onResize);
            window.visualViewport?.removeEventListener('scroll', onResize);
        };
    }, []);

    useEffect(() => {
        const el = chartWidthRef.current || chartBgRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const ro = new ResizeObserver((entries) => {
            const width = entries[0]?.contentRect?.width;
            if (width > 0) setChartWidth(width);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);




    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${chartDownloadSlug}.png`,
        title: exportChartTitle,
        height: Math.max(520, plotHeight + 40),
    }),
        [chartDownloadSlug, exportChartTitle, plotHeight],
    );

    const barLabelFont = useMemo(() => ({
        size: BAR_VALUE_FONT_SIZE,
        color: '#ffffff',
        family: 'Arial, sans-serif',
        weight: 700,
    }), []);

    const outsideLabelFont = useMemo(() => ({
        size: BAR_VALUE_FONT_SIZE,
        color: '#333333',
        family: 'Arial, sans-serif',
        weight: 700,
    }), []);

    const textPositions = useMemo(
        () => shareValues.map((value) => (value >= INSIDE_LABEL_MIN ? 'inside' : 'outside')),
        [shareValues],
    );

    const plotData = useMemo(() => {
        if (!shareLabels.length) return [];
        return [
        {
            type: 'bar',
            orientation: 'h',
            y: shareLabels,
            x: trackValues,
            marker: {
                color: TRACK_BAR,
                opacity: 1,
                line: { width: 0 },
            },
            hoverinfo: 'skip',
            hovertemplate: '<extra></extra>',
            showlegend: false,
            cliponaxis: false,
        },
        {
            type: 'bar',
            orientation: 'h',
            y: shareLabels,
            x: shareValues,
            marker: {
                color: VALUE_BAR,
                opacity: shareRows.map((_, index) => barOpacityFor(index)),
                line: { width: 0 },
            },
            text: shareValues.map((value) => formatPct(value, 1)),
            textposition: textPositions,
            insidetextanchor: 'end',
            textfont: barLabelFont,
            insidetextfont: barLabelFont,
            outsidetextfont: outsideLabelFont,
            cliponaxis: false,
            hoverinfo: 'none',
            hovertemplate: '<extra></extra>',
        },
    ];
    }, [shareLabels, shareValues, shareRows, trackValues, barOpacityFor, formatPct, barLabelFont, outsideLabelFont, textPositions]);

    const plotLayout = useMemo(() => ({
        showlegend: false,
        barmode: 'overlay',
        hovermode: 'closest',
        hoverlabel: HOVER_LABEL,
        clickmode: 'event',
        dragmode: false,
        height: plotHeight,
        autosize: true,
        margin: plotMargin,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        images: chartImages,
        xaxis: {
            range: [0, 100],
            domain: [0, 1],
            showgrid: false,
            showticklabels: false,
            showline: false,
            zeroline: false,
            fixedrange: true,
        },
        yaxis: {
            type: 'category',
            categoryorder: 'array',
            categoryarray: shareLabels,
            tickmode: 'array',
            tickvals: shareLabels,
            ticktext: boldTickText,
            autorange: 'reversed',
            side: 'left',
            ticklabelposition: 'outside',
            domain: BARS_Y_DOMAIN,
            showgrid: false,
            tickfont: { ...tickFont, weight: 700 },
            fixedrange: true,
            automargin: false,
        },
        bargap: BAR_GAP,
    }), [plotHeight, plotMargin, chartImages, shareLabels, boldTickText, tickFont]);

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        name: getText('canadian_renewable_energy_production_download_png', lang),
        click: (gd) => downloadChartWithTitle(gd),
    });

    const plotKey = `canadian-renewable-energy-production-${lang}-${tickFontSize}-${leftMargin}-${plotHeight}`;

    const getChartSummary = () => {
        const body = summarizeByCategory({
            categories: shareLabels,
            series: [{
                name: lang === 'en' ? 'Share' : 'Part',
                values: shareValues,
                format: (v) => {
                    const formatted = formatLocalePct(v, lang, {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                        suffix: false,
                    });
                    return `${formatted} ${lang === 'en' ? 'percent' : 'pour cent'}`;
                },
            }],
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? 'Bar chart of renewable energy production shares'
                : 'Graphique à barres des parts de production d\'énergie renouvelable',
            body,
            lang,
        });
    };
    const chartRegionLabel = `${exportChartTitle}. ${getChartSummary()}`;

    return (
        <PageShell id="main-content"
            tabIndex="-1"
            className="page-content canadian-renewable-energy-production page-chrome page-chrome--bleed"
            role="main"
            aria-labelledby="canadian-renewable-energy-production-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.canadian-renewable-energy-production {
}
.canadian-renewable-energy-production-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.canadian-renewable-energy-production-title {
    line-height: 1.25;
    text-transform: none;
}
.canadian-renewable-energy-production-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: clamp(20px, 2.4vw, 26px);
    font-weight: bold;
    color: #000000;
    margin: 0 0 14px 0;
    line-height: 1.3;
    text-transform: none;
}
.canadian-renewable-energy-production-chart-title .fn-lnk {
    color: inherit;
    text-decoration: none;
}
.canadian-renewable-energy-production-chart-frame {
    position: relative;
}
.canadian-renewable-energy-production-chart-bg-wrapper {
    position: relative;
    width: 100%;
    isolation: isolate;
}
.canadian-renewable-energy-production-chart-overlay {
    position: relative;
    z-index: 2;
    width: 100%;
    pointer-events: auto;
}
.canadian-renewable-energy-production-hover-layer {
    position: absolute;
    inset: 0;
    z-index: 10;
    pointer-events: none;
    overflow: visible;
}
.canadian-renewable-energy-production-hover-tip {
    position: absolute;
    z-index: 10;
    pointer-events: none;
    background: #ffffff;
    border: 1px solid #000000;
    padding: 8px 12px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: 400;
    color: #000000;
    line-height: 1.3;
    transform: translate(12px, -50%);
    white-space: nowrap;
}
.canadian-renewable-energy-production-hover-tip strong { display: block; font-weight: 700; }
.canadian-renewable-energy-production-hover-tip span { display: block; }
.canadian-renewable-energy-production-chart {
    width: 100%;
    min-width: 0;
    height: ${plotHeight}px;
    position: relative;
    z-index: 1;
    overflow: visible;
}
.canadian-renewable-energy-production-chart > div { width: 100%; height: 100%; overflow: visible; }
.canadian-renewable-energy-production-chart .js-plotly-plot,
.canadian-renewable-energy-production-chart .plot-container,
.canadian-renewable-energy-production-chart .svg-container {
    overflow: visible !important;
    pointer-events: auto !important;
}
.canadian-renewable-energy-production-chart .js-plotly-plot .plotly .modebar {
    right: 4px !important;
    top: 2px !important;
}
.canadian-renewable-energy-production-chart .hoverlayer { display: none !important; }
.canadian-renewable-energy-production-footnotes {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--gc-text);
    margin-top: 24px;
    margin-bottom: 0;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
    line-height: 1.65;
    max-width: 100%;
    box-sizing: border-box;
}
.canadian-renewable-energy-production-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 1rem;
}
.canadian-renewable-energy-production-footnotes dd {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-left: 0;
    margin-bottom: 1rem;
}
.wb-inv {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    border: 0;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
}
            `}</style>

            <div className="canadian-renewable-energy-production-inner">
                <h1 id="canadian-renewable-energy-production-title" className="canadian-renewable-energy-production-title page-chrome-title">
                    {pageTitle}
                </h1>

                <h2 className="canadian-renewable-energy-production-chart-title">
                    {chartTitlePrefix}
                    <span id="fn-asterisk-rf-canadian-renewable-energy-production" style={{ verticalAlign: 'super', fontSize: '0.75em', lineHeight: '0', marginLeft: '0.05em' }}>
                        <a className="fn-lnk" href="#fn-asterisk-canadian-renewable-energy-production" onClick={scrollToFootnote}>
                            <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                            <span aria-hidden="true">*</span>
                        </a>
                    </span>
                    {chartTitleSuffix}
                </h2>

                <div className="canadian-renewable-energy-production-chart-frame page-chrome-chart-frame">
                    {selectedPoints !== null && (
                        <ClearSelectionButton lang={lang} onClick={clearSelection} />
                    )}

                    <div
                        ref={(node) => {
                            chartBgRef.current = node;
                            chartWidthRef.current = node;
                        }}
                        className="canadian-renewable-energy-production-chart-bg-wrapper"
                        style={{ minHeight: plotHeight }}
                        onMouseLeave={handleChartWrapperLeave}
                    >
                        <div className="canadian-renewable-energy-production-chart-overlay">
                            <figure
                                ref={chartRef}
                                className="canadian-renewable-energy-production-chart"
                                style={{ height: plotHeight, margin: 0 }}
                                role="region"
                                aria-label={chartRegionLabel}
                                tabIndex={0}
                            >
                                <div aria-hidden="true" style={{ width: '100%', height: '100%' }}>
                                    <CanadianRenewableEnergyProductionPlot
                                        plotKey={plotKey}
                                        plotData={plotData}
                                        plotLayout={plotLayout}
                                        chartConfig={plotConfig}
                                        onPlotReady={onPlotReady}
                                    />
                                </div>
                            </figure>
                        </div>
                        {hoverTip && (
                            <div className="canadian-renewable-energy-production-hover-layer" aria-hidden={false}>
                                <div
                                    className="canadian-renewable-energy-production-hover-tip"
                                    style={{ left: hoverTip.left, top: hoverTip.top }}
                                    role="tooltip"
                                >
                                    <strong>{hoverTip.label}</strong>
                                    <span>{hoverTip.value}</span>
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                <div className="canadian-renewable-energy-production-table-wrapper" style={{ marginTop: 20 }}>
                    <ChartDataTable
                        lang={lang}
                        columns={tableColumns}
                        rows={tableRows}
                        csvFilename={`${chartDownloadSlug}.csv`}
                        docx={{
                            filename: `${chartDownloadSlug}.docx`,
                            title: exportChartTitle,
                            titleAlign: 'center',
                            columnWidths: [5200, 2000],
                            fontSize: 18,
                        }}
                        caption={tableCaption}
                        tableAriaLabel={tableCaption}
                        renderCell={(raw, { colIndex }) => (
                            colIndex === 0 ? String(raw ?? '') : formatPct(raw, 1)
                        )}
                    />
                </div>

                <PageFootnotes
                    lang={lang}
                    className="canadian-renewable-energy-production-footnotes"
                    items={[
                        { id: 'fn-asterisk-canadian-renewable-energy-production', marker: '*', text: getText('canadian_renewable_energy_production_footnote', lang), returnHref: '#fn-asterisk-rf-canadian-renewable-energy-production' },
                    ]}
                />
            </div>
        </PageShell>
    );
};

export default CanadianRenewableEnergyProduction;
