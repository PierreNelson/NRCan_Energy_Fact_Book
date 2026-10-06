import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { saveAs } from 'file-saver';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import renewableEnergyInternationalBgEn from '../assets/renewable_energy_international_bg.svg';
import renewableEnergyInternationalBgFr from '../assets/renewable_energy_international_bg_fr.svg';
import { formatLocalePct } from '../utils/formatLocale';

const CANADA_CAPSULE = '#819476';
const GREY_BAR = '#7a7a7a';
const CANADA_BAR = '#3f6b4a';

const HOVER_LABEL = {
    bgcolor: '#ffffff',
    bordercolor: '#000000',
    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
};


/** Position custom tooltip relative to the chart bg wrapper (same as page 76). */
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

/**
 * Memoized Plot so hover-tip state updates do not re-render Plotly.
 * That was the page-76 fix for one-click select + sticky hover.
 */
const RenewableEnergyInternationalPlot = memo(function RenewableEnergyInternationalPlot({
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

const REFERENCE_YEAR = 2023;
const PRODUCTION_TOTAL_PJ = 89633;
const PRODUCTION_TOTAL_MTOE = 2141;

const PRODUCTION_RANKING = [
    { key: 'china', rank: 1, pct: 19 },
    { key: 'india', rank: 2, pct: 11 },
    { key: 'united_states', rank: 3, pct: 9 },
    { key: 'brazil', rank: 4, pct: 7 },
    { key: 'indonesia', rank: 5, pct: 3 },
    { key: 'canada', rank: 6, pct: 2, isCanada: true },
];

const SHARE_ROWS = [
    { key: 'world', value: 14.1, color: GREY_BAR },
    { key: 'oecd', value: 12.6, color: GREY_BAR },
    { key: 'canada', value: 16.5, color: CANADA_BAR },
];
const SHARE_VALUES = SHARE_ROWS.map((row) => row.value);
const SHARE_COLORS = SHARE_ROWS.map((row) => row.color);

/**
 * Illustration is a Plotly layout.image in fixed paper coordinates.
 * Plot height scales with width so the plot aspect ratio stays constant across
 * browser zoom — that keeps stretch undistorted AND locked to the bars.
 * Tune EN / FR independently (0–1 paper units):
 *   x / sizex — horizontal placement within the plot area
 *   y / sizey — vertical placement (y=1 is top)
 * BARS_Y_DOMAIN — vertical slice used by the bars (shared; leave headroom for the dam)
 */
const OVERLAY_BY_LANG = {
    en: { x: 0.43, y: 1.05, sizex: 0.58, sizey: 0.92 },
    fr: { x: 0.43, y: 1.12, sizex: 0.58, sizey: 0.92 },
};
const BARS_Y_DOMAIN = [0, 0.62];
/** Height at reference plot-area width; shrinks with width so aspect stays constant.
 *  MIN is only a Plotly sanity floor — keep it low so ~500% zoom can still match width. */
const PLOT_HEIGHT_BASE = 320;
const PLOT_HEIGHT_MIN = 72;
const PLOT_AREA_WIDTH_REF = 700;
const PLOT_MARGIN = { l: 0, r: 16, t: 12, b: 12 };
/** Category labels — same width breakpoints as HydroelectricCapacity (page 76). */
const TICK_FONT_FAMILY = 'Arial, sans-serif';
/** Left margin may use at most this share of the chart width so bars/art are not crushed. */
const LEFT_MARGIN_MAX_FRAC = 0.26;

const tickFontSizeForWidth = (width) => (
    width <= 480 ? 13 : width <= 768 ? 14 : 15
);

/** In-bar % labels — fixed accessible size (browser zoom scales it on screen). */
const BAR_VALUE_FONT_SIZE = 14;
const BAR_GAP = 0.58;

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

/** At high zoom, wrapped two-line ticks collide — use short single-line names instead. */
const compactShareLabelIfNeeded = (label, { compact }) => {
    if (!compact) return label;
    if (label === 'OECD countries') return 'OECD';
    if (label === "Pays de l'OCDE") return 'OCDE';
    return label;
};

const wrapShareLabelIfNeeded = (label, { wrap }) => {
    if (!wrap) return label;
    if (label === 'OECD countries') return 'OECD<br>countries';
    if (label === "Pays de l'OCDE") return "Pays de<br>l'OCDE";
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
        const inferred = inner / vv.width;
        if (inferred > 1.02 && inferred < 8) layoutZoom = inferred;
    }

    const pageCssZoom = Math.max(pinScale, layoutZoom, cssZoomFactor);
    return { pageCssZoom, baseline: nextBaseline };
};

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const drawRoundedRect = (ctx, x, y, w, h, r) => {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
};

const RenewableEnergyInternational = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const [pageCssZoom, setPageCssZoom] = useState(() => computePageZoomScale(null).pageCssZoom);
    const {
        selected: selectedPoints,
        clear: clearSelection,
        onPlotClick,
    } = usePlotlySelection({ mode: 'slices', windowWidth });
    const [hoverTip, setHoverTip] = useState(null);

    const chartRef = useRef(null);
    const chartBgRef = useRef(null);
    const chartWidthRef = useRef(null);
    const zoomBaselineRef = useRef(null);
    const clickHandlerRef = useRef(null);
    const hoverHandlerRef = useRef(null);
    const hoverClearRef = useRef(null);
    const [chartWidth, setChartWidth] = useState(800);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const bgImage = lang === 'en' ? renewableEnergyInternationalBgEn : renewableEnergyInternationalBgFr;

    const formatPct = useCallback((value, digits = 1) => formatLocalePct(value, lang, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }), [lang]);

    const formatWhole = (value) => Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });

    const textVars = {
        year: REFERENCE_YEAR,
        pj: formatWhole(PRODUCTION_TOTAL_PJ),
        mtoe: formatWhole(PRODUCTION_TOTAL_MTOE),
    };

    const pageTitle = getText('renewable_energy_international_title', lang);
    const subtitle = getText('renewable_energy_international_subtitle', lang);
    const productionTitle = substitute(getText('renewable_energy_international_production_title', lang), textVars);
    const chartTitle = substitute(getText('renewable_energy_international_chart_title', lang), textVars);
    const exportChartTitle = stripHtml(chartTitle);
    const chartDownloadSlug = getText('renewable_energy_international_download_title', lang).replace(/\s+/g, '_');
    const rankingDownloadSlug = getText('renewable_energy_international_ranking_download_title', lang).replace(/\s+/g, '_');
    const tableCaption = getText('renewable_energy_international_table_caption', lang);

    const rankingRows = useMemo(
        () => PRODUCTION_RANKING.map((row) => ({
            ...row,
            name: getText(`renewable_energy_international_country_${row.key}`, lang),
        })),
        [lang],
    );

    const shareLabels = useMemo(
        () => SHARE_ROWS.map((row) => getText(`renewable_energy_international_share_${row.key}`, lang)),
        [lang],
    );
    const shareValues = SHARE_VALUES;
    const shareColors = SHARE_COLORS;

    const tableColumns = useMemo(() => [
        { key: 'category', header: getText('renewable_energy_international_table_col_category', lang), align: 'left' },
        { key: 'share', header: getText('renewable_energy_international_table_col_share', lang), align: 'num' },
    ], [lang]);

    const dataTableRows = useMemo(
        () => SHARE_ROWS.map((row, index) => ({
            category: shareLabels[index],
            share: row.value,
        })),
        [shareLabels],
    );

    // Match page 76 label sizes at low zoom; compact labels + margin cap protect the plot at high zoom.
    const tickFontSize = tickFontSizeForWidth(windowWidth);
    // High zoom: short single-line ticks (avoid OECD<br>countries colliding with World/Canada).
    const compactCategoryLabels = pageCssZoom >= 2.5 || chartWidth < 420;
    const wrapCategoryLabels = !compactCategoryLabels && chartWidth < 580;
    const categoryTickLabels = useMemo(
        () => shareLabels.map((label) => {
            const compact = compactShareLabelIfNeeded(label, { compact: compactCategoryLabels });
            return wrapShareLabelIfNeeded(compact, { wrap: wrapCategoryLabels });
        }),
        [shareLabels, compactCategoryLabels, wrapCategoryLabels],
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
        // Prefer exact aspect; only clamp to minAreaH if Plotly would get an unusable height.
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

    const overlayPaper = OVERLAY_BY_LANG[lang] || OVERLAY_BY_LANG.en;

    const chartImages = useMemo(() => ([{
        source: bgImage,
        xref: 'paper',
        yref: 'paper',
        x: overlayPaper.x,
        y: overlayPaper.y,
        sizex: overlayPaper.sizex,
        sizey: overlayPaper.sizey,
        xanchor: 'left',
        yanchor: 'top',
        sizing: 'stretch',
        layer: 'above',
    }]), [bgImage, overlayPaper]);

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
        if (!pt) return;
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
        if (graphDiv._renewableEnergyInternationalHover) {
            graphDiv.removeListener('plotly_hover', graphDiv._renewableEnergyInternationalHover);
        }
        if (graphDiv._renewableEnergyInternationalUnhover) {
            graphDiv.removeListener('plotly_unhover', graphDiv._renewableEnergyInternationalUnhover);
        }
        if (graphDiv._renewableEnergyInternationalClick) {
            graphDiv.removeListener('plotly_click', graphDiv._renewableEnergyInternationalClick);
        }
        const hoverHandler = (event) => hoverHandlerRef.current?.(event);
        const unhoverHandler = () => hoverClearRef.current?.();
        const clickHandler = (event) => clickHandlerRef.current?.(event);
        graphDiv._renewableEnergyInternationalHover = hoverHandler;
        graphDiv._renewableEnergyInternationalUnhover = unhoverHandler;
        graphDiv._renewableEnergyInternationalClick = clickHandler;
        graphDiv.on('plotly_hover', hoverHandler);
        graphDiv.on('plotly_unhover', unhoverHandler);
        graphDiv.on('plotly_click', clickHandler);
    }, []);

    const onPlotReady = useCallback(
        (_figure, graphDiv) => bindPlotHandlers(graphDiv),
        [bindPlotHandlers],
    );

    const handleChartWrapperLeave = useCallback(() => setHoverTip(null), []);

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




    const downloadRankingPng = () => {
        const scale = 2;
        const W = 900;
        const pad = 28;
        const titleH = 56;
        const rowH = 46;
        const rowGap = 10;
        const H = pad + titleH + pad + rankingRows.length * (rowH + rowGap) + pad;
        const canvas = document.createElement('canvas');
        canvas.width = W * scale;
        canvas.height = H * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 24px Lato, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(productionTitle, pad, pad, W - pad * 2);

        const barWrapW = W * 0.34;
        const pillW = 72;
        const startY = pad + titleH + 12;
        rankingRows.forEach((row, index) => {
            const y = startY + index * (rowH + rowGap);
            const maxPct = rankingRows[0].pct || 1;
            const ratio = maxPct > 0 ? row.pct / maxPct : 1;
            const barW = Math.max(90, barWrapW * (0.62 + 0.2 * ratio));
            const isCanada = Boolean(row.isCanada);
            ctx.fillStyle = isCanada ? CANADA_CAPSULE : '#d1d1d1';
            drawRoundedRect(ctx, pad, y + (rowH - 42) / 2, barW, 42, 21);
            ctx.fill();
            ctx.fillStyle = isCanada ? '#ffffff' : '#333333';
            ctx.font = `${isCanada ? 'bold ' : ''}15px "Noto Sans", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${row.rank} ${row.name}`, pad + barW / 2, y + rowH / 2);

            const connX = pad + barW;
            const connW = W - pad - barW - pillW - pad;
            ctx.strokeStyle = isCanada ? CANADA_CAPSULE : '#b0b0b0';
            ctx.lineWidth = isCanada ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(connX, y + rowH / 2);
            ctx.lineTo(connX + connW, y + rowH / 2);
            ctx.stroke();

            const pillX = W - pad - pillW;
            const pillY = y + (rowH - 34) / 2;
            ctx.fillStyle = '#ffffff';
            drawRoundedRect(ctx, pillX, pillY, pillW, 34, 17);
            ctx.fill();
            ctx.strokeStyle = isCanada ? CANADA_CAPSULE : '#b0b0b0';
            ctx.lineWidth = isCanada ? 2 : 1;
            drawRoundedRect(ctx, pillX, pillY, pillW, 34, 17);
            ctx.stroke();
            ctx.fillStyle = '#333333';
            ctx.font = `${isCanada ? 'bold 16px' : '15px'} "Noto Sans", sans-serif`;
            ctx.fillText(formatPct(row.pct, 0), pillX + pillW / 2, y + rowH / 2);
        });

        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${rankingDownloadSlug}.png`);
        });
    };

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${chartDownloadSlug}.png`,
        title: exportChartTitle,
        height: 520,
    }),
        [chartDownloadSlug, exportChartTitle],
    );

    const barLabelFont = useMemo(() => ({
        size: BAR_VALUE_FONT_SIZE,
        color: '#ffffff',
        family: 'Arial, sans-serif',
        weight: 700,
    }), []);

    const plotData = useMemo(() => [{
        type: 'bar',
        orientation: 'h',
        y: shareLabels,
        x: shareValues,
        marker: {
            color: shareColors,
            opacity: SHARE_ROWS.map((_, index) => barOpacityFor(index)),
            line: { width: 0 },
        },
        text: shareValues.map((value) => formatPct(value, 1)),
        textposition: 'inside',
        insidetextanchor: 'end',
        textfont: barLabelFont,
        insidetextfont: barLabelFont,
        cliponaxis: false,
        hoverinfo: 'none',
        hovertemplate: '<extra></extra>',
    }], [shareLabels, shareValues, shareColors, barOpacityFor, formatPct, barLabelFont]);

    const plotLayout = useMemo(() => ({
        showlegend: false,
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
            range: [0, 22],
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

    const chartConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const plotKey = `renewable-energy-international-${lang}-${tickFontSize}-${leftMargin}-${plotHeight}`;

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
                ? 'Bar chart of international renewable energy shares'
                : "Graphique à barres des parts d'énergie renouvelable à l'échelle internationale",
            body,
            lang,
        });
    };
    const chartRegionLabel = `${chartTitle}. ${getChartSummary()}`;
    const formatShareSpoken = (value) => {
        const formatted = formatLocalePct(value, lang, {
            maximumFractionDigits: 0,
            suffix: false,
        });
        return `${formatted} ${lang === 'en' ? 'percent' : 'pour cent'}`;
    };
    const rankingAria = rankingRows.length ? joinChartSummary({
        intro: stripHtml(productionTitle),
        body: summarizeByCategory({
            categories: rankingRows.map((row) => (
                lang === 'en' ? `Rank ${row.rank}, ${row.name}` : `Rang ${row.rank}, ${row.name}`
            )),
            series: [{
                name: lang === 'en' ? 'Share' : 'Part',
                values: rankingRows.map((row) => row.pct),
                format: formatShareSpoken,
            }],
            lang,
        }),
    }) : stripHtml(productionTitle);

    return (
        <PageShell id="main-content"
            tabIndex="-1"
            className="page-content renewable-energy-international page-chrome page-chrome--bleed"
            role="main"
            aria-labelledby="renewable-energy-international-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.renewable-energy-international-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.renewable-energy-international.page-content h1.renewable-energy-international-title {
    font-size: 50px !important;
    color: #819476;
    margin: 0 0 12px 0;
    text-transform: none;
}
.renewable-energy-international-subtitle {
    font-family: 'Lato', sans-serif;
    font-size: clamp(22px, 2.6vw, 28px);
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 12px 0;
    text-transform: none;
}
.renewable-energy-international-production-title {
    font-family: 'Lato', sans-serif;
    font-size: clamp(20px, 2.4vw, 26px);
    font-weight: bold;
    color: #000000;
    margin: 0 0 14px 0;
    text-transform: none;
}
.renewable-energy-international-capsule-graphic {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(100%, 720px);
    font-family: 'Noto Sans', sans-serif;
    margin-bottom: 12px;
}
.renewable-energy-international-capsule-row {
    display: flex;
    align-items: center;
    min-height: 52px;
    gap: 0;
    min-width: 0;
}
.renewable-energy-international-capsule-bar-wrap { flex: 0 0 34%; min-width: 0; display: flex; align-items: center; }
.renewable-energy-international-capsule-bar {
    min-height: 44px;
    min-width: 90px;
    border-radius: 999px;
    background-color: #d1d1d1;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 10px 12px;
    font-size: clamp(13px, 1.5vw, 15px);
    color: #333;
    box-sizing: border-box;
    width: 100%;
}
.renewable-energy-international-capsule-row-canada .renewable-energy-international-capsule-bar {
    background-color: ${CANADA_CAPSULE};
    color: #fff;
    font-weight: bold;
}
.renewable-energy-international-capsule-connector { flex: 1 1 0; min-width: 10px; height: 2px; background-color: #b0b0b0; }
.renewable-energy-international-capsule-row-canada .renewable-energy-international-capsule-connector { background-color: ${CANADA_CAPSULE}; }
.renewable-energy-international-capsule-pill {
    flex: 0 0 72px;
    height: 36px;
    min-width: 72px;
    border-radius: 999px;
    border: 1px solid #b0b0b0;
    background-color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #333;
    box-sizing: border-box;
}
.renewable-energy-international-capsule-row-canada .renewable-energy-international-capsule-pill {
    border-width: 2px;
    border-color: ${CANADA_CAPSULE};
    font-weight: bold;
}
.renewable-energy-international-ranking-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin: 0 0 28px 0;
}
.renewable-energy-international-ranking-actions button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: bold;
    color: #ffffff;
}
.renewable-energy-international-ranking-actions button:hover { background-color: #404040 !important; }
.renewable-energy-international-chart-frame {
    position: relative;
}
.renewable-energy-international-chart-bg-wrapper {
    position: relative;
    width: 100%;
    isolation: isolate;
}
/*
 * Illustration: fixed Plotly layout.images paper coords + height scaled with width
 * (see OVERLAY_BY_LANG / BARS_Y_DOMAIN / PLOT_AREA_WIDTH_REF at top of file).
 */
.renewable-energy-international-chart-title {
    position: relative;
    z-index: 5;
    font-family: Arial, sans-serif;
    font-size: 18px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: right;
    margin: 0 8px 12px 0;
    padding: 0;
    line-height: 1.25;
    text-transform: none;
    background: transparent;
    white-space: normal;
    overflow-wrap: break-word;
    word-break: normal;
    box-sizing: border-box;
}
.renewable-energy-international-chart-overlay {
    position: relative;
    z-index: 2;
    width: 100%;
    pointer-events: auto;
}
.renewable-energy-international-hover-layer {
    position: absolute;
    inset: 0;
    z-index: 10;
    pointer-events: none;
    overflow: visible;
}
.renewable-energy-international-hover-tip {
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
.renewable-energy-international-hover-tip strong { display: block; font-weight: 700; }
.renewable-energy-international-hover-tip span { display: block; }
.renewable-energy-international-chart {
    width: 100%;
    min-width: 0;
    height: ${plotHeight}px;
    position: relative;
    z-index: 1;
    overflow: visible;
}
.renewable-energy-international-chart > div { width: 100%; height: 100%; overflow: visible; }
.renewable-energy-international-chart .js-plotly-plot,
.renewable-energy-international-chart .plot-container,
.renewable-energy-international-chart .svg-container {
    overflow: visible !important;
    pointer-events: auto !important;
}
.renewable-energy-international-chart .js-plotly-plot .plotly .modebar {
    right: 4px !important;
    top: 2px !important;
}
.renewable-energy-international-chart .hoverlayer { display: none !important; }
.renewable-energy-international-table-wrapper { display: block; width: 100%; margin-top: 20px; }
@media (max-width: 768px) {
    .renewable-energy-international.page-content h1.renewable-energy-international-title { font-size: 37px !important; }
}
            `}</style>

            <div className="renewable-energy-international-inner">
                <h1 id="renewable-energy-international-title" className="renewable-energy-international-title page-chrome-title">{pageTitle}</h1>
                <h2 className="renewable-energy-international-subtitle">{subtitle}</h2>

                <h3 className="renewable-energy-international-production-title" tabIndex={0} data-prose-tab="1">{productionTitle}</h3>
                <div
                    className="renewable-energy-international-capsule-graphic"
                    role="region"
                    tabIndex={0}
                    aria-label={rankingAria}
                >
                    {rankingRows.map((row) => (
                        <div
                            key={row.key}
                            className={`renewable-energy-international-capsule-row${row.isCanada ? ' renewable-energy-international-capsule-row-canada' : ''}`}
                        >
                            <div className="renewable-energy-international-capsule-bar-wrap">
                                <div className="renewable-energy-international-capsule-bar">
                                    <span>{row.rank} {row.name}</span>
                                </div>
                            </div>
                            <div className="renewable-energy-international-capsule-connector" aria-hidden="true" />
                            <div className="renewable-energy-international-capsule-pill">
                                <span>{formatPct(row.pct, 0)}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="renewable-energy-international-ranking-actions">
                    <button type="button" onClick={downloadRankingPng}>
                        {getText('renewable_energy_international_download_png', lang)}
                    </button>
                </div>

                <div className="renewable-energy-international-chart-frame page-chrome-chart-frame">
                    <h2 className="renewable-energy-international-chart-title">
                        {chartTitle}
                    </h2>

                    {selectedPoints !== null && <ClearSelectionButton lang={lang} onClick={clearSelection} />}

                    <div
                        ref={(node) => {
                            chartBgRef.current = node;
                            chartWidthRef.current = node;
                        }}
                        className="renewable-energy-international-chart-bg-wrapper"
                        style={{ minHeight: plotHeight }}
                        onMouseLeave={handleChartWrapperLeave}
                    >
                        <div className="renewable-energy-international-chart-overlay">
                            <figure
                                ref={chartRef}
                                className="renewable-energy-international-chart"
                                style={{ height: plotHeight, margin: 0 }}
                                role="region"
                                aria-label={chartRegionLabel}
                                tabIndex={0}
                            >
                                <div aria-hidden="true" style={{ width: '100%', height: '100%' }}>
                                    <RenewableEnergyInternationalPlot
                                        plotKey={plotKey}
                                        plotData={plotData}
                                        plotLayout={plotLayout}
                                        chartConfig={chartConfig}
                                        onPlotReady={onPlotReady}
                                    />
                                </div>
                            </figure>
                        </div>
                        {hoverTip && (
                            <div className="renewable-energy-international-hover-layer" aria-hidden={false}>
                                <div
                                    className="renewable-energy-international-hover-tip"
                                    style={{ left: hoverTip.left, top: hoverTip.top }}
                                    role="tooltip"
                                >
                                    <strong>{hoverTip.label}</strong>
                                    <span>{hoverTip.value}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="renewable-energy-international-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={dataTableRows}
                            csvFilename={`${chartDownloadSlug}.csv`}
                            docx={{
                                filename: `${chartDownloadSlug}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [4200, 2200],
                                fontSize: 18,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatPct(raw, 1)
                            )}
                        />
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default RenewableEnergyInternational;
