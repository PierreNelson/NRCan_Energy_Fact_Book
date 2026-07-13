import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import canadianRenewableEnergyProductionBg from '../assets/canadian_renewable_energy_production_bg.svg';

const VALUE_BAR = '#2B5C3F';
const TRACK_BAR = '#e8e8e8';

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

const REFERENCE_YEAR = 2023;
const PRODUCTION_TOTAL_PJ = 1987;
const PRODUCTION_TOTAL_MTOE = 47.5;

const SHARE_ROWS = [
    { key: 'hydro', value: 65.3 },
    { key: 'solid_biomass', value: 21.4 },
    { key: 'wind', value: 7.3 },
    { key: 'ethanol', value: 1.8 },
    { key: 'municipal_waste', value: 1.9 },
    { key: 'biodiesel', value: 0.8 },
    { key: 'solar_pv', value: 1.3 },
    { key: 'solar_thermal', value: 0.1 },
];
const SHARE_VALUES = SHARE_ROWS.map((row) => row.value);
const TRACK_VALUES = SHARE_ROWS.map(() => 100);

const DOC_COLUMN_WIDTHS = [5200, 2000];

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

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const CanadianRenewableEnergyProduction = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [pageCssZoom, setPageCssZoom] = useState(() => computePageZoomScale(null).pageCssZoom);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const [hoverTip, setHoverTip] = useState(null);

    const chartRef = useRef(null);
    const chartBgRef = useRef(null);
    const chartWidthRef = useRef(null);
    const zoomBaselineRef = useRef(null);
    const lastClickRef = useRef({ time: 0, pointIndex: null });
    const clickHandlerRef = useRef(null);
    const hoverHandlerRef = useRef(null);
    const hoverClearRef = useRef(null);
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);
    const [chartWidth, setChartWidth] = useState(800);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const bgImage = canadianRenewableEnergyProductionBg;

    const formatPct = useCallback((value, digits = 1) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        const formatted = Number(value).toLocaleString(locale, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        });
        return lang === 'en' ? `${formatted}%` : `${formatted} %`;
    }, [lang, locale]);

    const formatWhole = (value) => Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    const formatMtoe = (value) => Number(value).toLocaleString(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });

    const textVars = {
        year: REFERENCE_YEAR,
        pj: formatWhole(PRODUCTION_TOTAL_PJ),
        mtoe: formatMtoe(PRODUCTION_TOTAL_MTOE),
    };

    const pageTitle = substitute(getText('canadian_renewable_energy_production_title', lang), textVars);
    const chartTitlePrefix = getText('canadian_renewable_energy_production_chart_title_prefix', lang);
    const chartTitleSuffix = substitute(getText('canadian_renewable_energy_production_chart_title_suffix', lang), textVars);
    const chartTitlePlain = `${chartTitlePrefix}*${chartTitleSuffix}`;
    const chartDownloadSlug = getText('canadian_renewable_energy_production_download_title', lang).replace(/\s+/g, '_');

    const shareLabels = useMemo(
        () => SHARE_ROWS.map((row) => getText(`canadian_renewable_energy_production_cat_${row.key}`, lang)),
        [lang],
    );
    const shareValues = SHARE_VALUES;

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
        const pointIndex = getPointIndex(point);
        if (pointIndex === undefined) return;

        const isCoarsePointer = typeof window !== 'undefined'
            && window.matchMedia('(pointer: coarse)').matches;

        if (isCoarsePointer) {
            const now = Date.now();
            const last = lastClickRef.current;
            const isDoubleTap = pointIndex === last.pointIndex && now - last.time < 300;
            lastClickRef.current = { time: now, pointIndex };
            if (!isDoubleTap) return;
        }

        setHoverTip(null);

        setSelectedPoints((prev) => {
            if (prev === null) return [pointIndex];
            if (prev.includes(pointIndex)) {
                const next = prev.filter((i) => i !== pointIndex);
                return next.length === 0 ? null : next;
            }
            return [...prev, pointIndex];
        });
    }, []);

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

    const clearSelection = () => {
        lastClickRef.current = { time: 0, pointIndex: null };
        setSelectedPoints(null);
    };

    const handleChartWrapperLeave = useCallback(() => setHoverTip(null), []);

    const scrollToFootnote = (event) => {
        event.preventDefault();
        document.getElementById('fn-asterisk-canadian-renewable-energy-production')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const scrollToRef = (event) => {
        event.preventDefault();
        document.getElementById('fn-asterisk-rf-canadian-renewable-energy-production')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    useEffect(() => {
        const onResize = () => {
            setWindowWidth(window.innerWidth);
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

    const syncTableScroll = useCallback(() => {
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = bottomScrollRef.current;
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

    useEffect(() => {
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = bottomScrollRef.current;
        if (!topScroll || !tableScroll || !bottomScroll || !isTableOpen) return undefined;

        const syncFrom = (source) => {
            if (source !== topScroll && topScroll.scrollLeft !== source.scrollLeft) topScroll.scrollLeft = source.scrollLeft;
            if (source !== tableScroll && tableScroll.scrollLeft !== source.scrollLeft) tableScroll.scrollLeft = source.scrollLeft;
            if (source !== bottomScroll && bottomScroll.scrollLeft !== source.scrollLeft) bottomScroll.scrollLeft = source.scrollLeft;
        };

        const handleTopScroll = () => syncFrom(topScroll);
        const handleTableScroll = () => syncFrom(tableScroll);
        const handleBottomScroll = () => syncFrom(bottomScroll);
        const sync = () => window.requestAnimationFrame(syncTableScroll);

        topScroll.addEventListener('scroll', handleTopScroll);
        tableScroll.addEventListener('scroll', handleTableScroll);
        bottomScroll.addEventListener('scroll', handleBottomScroll);
        const observer = new ResizeObserver(sync);
        const tableEl = tableScroll.querySelector('table');
        if (tableEl) observer.observe(tableEl);
        observer.observe(tableScroll);
        sync();

        return () => {
            topScroll.removeEventListener('scroll', handleTopScroll);
            tableScroll.removeEventListener('scroll', handleTableScroll);
            bottomScroll.removeEventListener('scroll', handleBottomScroll);
            observer.disconnect();
        };
    }, [isTableOpen, windowWidth, syncTableScroll]);

    const downloadChartWithTitle = useCallback(async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        try {
            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 1200,
                height: Math.max(520, plotHeight + 40),
                scale: 2,
            });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = imgData;
            });
            const titleHeight = 90;
            canvas.width = img.width;
            canvas.height = img.height + titleHeight;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#333333';
            ctx.font = 'bold 28px Arial';
            ctx.textAlign = 'center';
            const words = chartTitlePlain.split(' ');
            const lines = [];
            let line = '';
            words.forEach((word) => {
                const test = line ? `${line} ${word}` : word;
                if (ctx.measureText(test).width > canvas.width - 80 && line) {
                    lines.push(line);
                    line = word;
                } else {
                    line = test;
                }
            });
            if (line) lines.push(line);
            lines.forEach((textLine, index) => {
                ctx.fillText(textLine, canvas.width / 2, 36 + index * 30);
            });
            ctx.drawImage(img, 0, titleHeight);
            canvas.toBlob((blob) => {
                if (blob) saveAs(blob, `${chartDownloadSlug}.png`);
            });
        } catch (err) {
            console.error('Error downloading chart:', err);
        }
    }, [chartTitlePlain, chartDownloadSlug, plotHeight]);

    const downloadCsv = () => {
        const sections = [
            csvEscape(chartTitlePlain),
            [
                csvEscape(getText('canadian_renewable_energy_production_table_col_category', lang)),
                csvEscape(getText('canadian_renewable_energy_production_table_col_share', lang)),
            ].join(','),
            ...SHARE_ROWS.map((row, index) => [
                csvEscape(shareLabels[index]),
                csvEscape(formatPct(row.value, 1)),
            ].join(',')),
        ];
        saveAs(new Blob([sections.join('\n')], { type: 'text/csv;charset=utf-8;' }), `${chartDownloadSlug}.csv`);
    };

    const downloadDocx = async () => {
        const shareHeader = new TableRow({
            children: [
                getText('canadian_renewable_energy_production_table_col_category', lang),
                getText('canadian_renewable_energy_production_table_col_share', lang),
            ].map((cell) => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: cell, bold: true, size: 18 })],
                    alignment: AlignmentType.CENTER,
                })],
                shading: { fill: 'E6E6E6' },
            })),
        });
        const shareDocRows = SHARE_ROWS.map((row, index) => new TableRow({
            children: [shareLabels[index], formatPct(row.value, 1)].map((val, colIndex) => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: String(val), size: 18 })],
                    alignment: colIndex === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
                })],
            })),
        }));

        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: pageTitle, bold: true, size: 28 })],
                        spacing: { after: 200 },
                    }),
                    new Paragraph({
                        children: [new TextRun({ text: chartTitlePlain, bold: true, size: 22 })],
                        spacing: { after: 160 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: DOC_COLUMN_WIDTHS,
                        rows: [shareHeader, ...shareDocRows],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), `${chartDownloadSlug}.docx`);
    };

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

    const plotData = useMemo(() => [
        {
            type: 'bar',
            orientation: 'h',
            y: shareLabels,
            x: TRACK_VALUES,
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
                opacity: SHARE_ROWS.map((_, index) => barOpacityFor(index)),
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
    ], [shareLabels, shareValues, barOpacityFor, formatPct, barLabelFont, outsideLabelFont, textPositions]);

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

    const chartConfig = useMemo(() => ({
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        modeBarButtonsToRemove: MODEBAR_REMOVE,
        modeBarButtonsToAdd: [{
            name: getText('canadian_renewable_energy_production_download_png', lang),
            icon: {
                width: 24,
                height: 24,
                path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z',
            },
            click: (gd) => downloadChartWithTitle(gd),
        }],
    }), [lang, downloadChartWithTitle]);

    const plotKey = `canadian-renewable-energy-production-${lang}-${tickFontSize}-${leftMargin}-${plotHeight}`;

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content canadian-renewable-energy-production"
            role="main"
            aria-labelledby="canadian-renewable-energy-production-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.canadian-renewable-energy-production {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.canadian-renewable-energy-production-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.canadian-renewable-energy-production-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 25px;
    line-height: 1.25;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: none;
}
.canadian-renewable-energy-production-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
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
.canadian-renewable-energy-production-clear-selection {
    padding: 6px 12px;
    margin-bottom: 8px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: bold;
    color: #ffffff;
}
.canadian-renewable-energy-production-clear-selection:hover,
.canadian-renewable-energy-production-download-buttons button:hover,
.canadian-renewable-energy-production-table-wrapper details > summary:hover {
    background-color: #404040 !important;
}
.canadian-renewable-energy-production-chart-frame {
    position: relative;
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    box-sizing: border-box;
    overflow: visible;
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
.canadian-renewable-energy-production-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.canadian-renewable-energy-production-table-wrapper details > summary {
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
.canadian-renewable-energy-production-table-wrapper details > summary::-webkit-details-marker { display: none; }
.canadian-renewable-energy-production-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.canadian-renewable-energy-production-table-scrollbar > div { height: 20px; }
.canadian-renewable-energy-production-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #ddd;
    background: #fff;
    padding: 15px;
    box-sizing: border-box;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.canadian-renewable-energy-production-table-responsive::-webkit-scrollbar { display: none; }
.canadian-renewable-energy-production-table-responsive table { width: max-content; min-width: 100%; border-collapse: collapse; }
.canadian-renewable-energy-production-table-responsive th,
.canadian-renewable-energy-production-table-responsive td {
    padding: 0.75rem;
    border: 1px solid #ddd;
    white-space: nowrap;
}
.canadian-renewable-energy-production-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.canadian-renewable-energy-production-download-buttons button {
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
@media (max-width: 768px) {
    .canadian-renewable-energy-production-title { font-size: 37px; }
}
            `}</style>

            <div className="canadian-renewable-energy-production-inner">
                <h1 id="canadian-renewable-energy-production-title" className="canadian-renewable-energy-production-title">
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

                <div className="canadian-renewable-energy-production-chart-frame">
                    {selectedPoints !== null && (
                        <button type="button" className="canadian-renewable-energy-production-clear-selection" onClick={clearSelection}>
                            {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                        </button>
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
                                aria-label={chartTitlePlain}
                                tabIndex={0}
                            >
                                <CanadianRenewableEnergyProductionPlot
                                    plotKey={plotKey}
                                    plotData={plotData}
                                    plotLayout={plotLayout}
                                    chartConfig={chartConfig}
                                    onPlotReady={onPlotReady}
                                />
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

                <div className="canadian-renewable-energy-production-table-wrapper">
                    <details onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                        <summary role="button" aria-expanded={isTableOpen}>
                            <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                            {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                            <span className="wb-inv">
                                {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                            </span>
                        </summary>
                        <div ref={topScrollRef} className="canadian-renewable-energy-production-table-scrollbar" aria-hidden="true"><div /></div>
                        <div ref={tableScrollRef} className="canadian-renewable-energy-production-table-responsive" role="region" tabIndex={0}>
                            <table className="table table-striped table-hover">
                                <caption className="wb-inv">{getText('canadian_renewable_energy_production_table_caption', lang)}</caption>
                                <thead>
                                    <tr>
                                        <th scope="col">{getText('canadian_renewable_energy_production_table_col_category', lang)}</th>
                                        <th scope="col">{getText('canadian_renewable_energy_production_table_col_share', lang)}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {SHARE_ROWS.map((row, index) => (
                                        <tr key={row.key}>
                                            <th scope="row">{shareLabels[index]}</th>
                                            <td style={{ textAlign: 'right' }}>{formatPct(row.value, 1)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="canadian-renewable-energy-production-download-buttons">
                                <button type="button" onClick={downloadCsv}>
                                    {getText('canadian_renewable_energy_production_download_csv', lang)}
                                </button>
                                <button type="button" onClick={downloadDocx}>
                                    {getText('canadian_renewable_energy_production_download_docx', lang)}
                                </button>
                            </div>
                        </div>
                        <div ref={bottomScrollRef} className="canadian-renewable-energy-production-table-scrollbar" aria-hidden="true"><div /></div>
                    </details>
                </div>

                <aside className="wb-fnote canadian-renewable-energy-production-footnotes" role="note">
                    <h2>{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnote' : 'Note de bas de page'}</dt>
                        <dd id="fn-asterisk-canadian-renewable-energy-production">
                            <a
                                href="#fn-asterisk-rf-canadian-renewable-energy-production"
                                onClick={scrollToRef}
                                className="fn-num"
                                title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}
                            >
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                            </a>
                            {' '}{getText('canadian_renewable_energy_production_footnote', lang)}
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default CanadianRenewableEnergyProduction;
