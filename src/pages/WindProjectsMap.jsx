import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getWindProjectsMapData } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const PROV_BAR_COLOR = '#2B5C3F';
const PROJECT_PROV_COLORS = {
    on: '#4b4c4d',
    qc: '#2B5C3F',
    ab: '#709735',
    sk: '#C87A04',
};
const LEGEND_KEYS = ['on', 'qc', 'ab', 'sk'];

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

const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

/** ~300% browser zoom — same threshold as plug-in EV registrations / Canadian production infographics. */
const largest_wind_projects_PROV_VERTICAL_TICK_ZOOM = 2.85;
const largest_wind_projects_PROJ_WRAP_ZOOM = 2.85;
const largest_wind_projects_PROJ_WRAP_DEEP_ZOOM = 3.55;

const createInitialViewportZoom = () => {
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
};

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

const WindProjectsMap = () => {
    const { lang } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedProvPoints, setSelectedProvPoints] = useState(null);
    const [selectedProjPoints, setSelectedProjPoints] = useState(null);
    const [isProvTableOpen, setIsProvTableOpen] = useState(false);
    const [isProjTableOpen, setIsProjTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [viewportZoom, setViewportZoom] = useState(createInitialViewportZoom);

    const provChartRef = useRef(null);
    const projChartRef = useRef(null);
    const zoomBaselineRef = useRef(null);
    const provTableTopRef = useRef(null);
    const provTableScrollRef = useRef(null);
    const provTableBottomRef = useRef(null);
    const projTableTopRef = useRef(null);
    const projTableScrollRef = useRef(null);
    const projTableBottomRef = useRef(null);
    const provLastClickRef = useRef({ time: 0, pointIndex: null });
    const projLastClickRef = useRef({ time: 0, pointIndex: null });
    const provClickHandlerRef = useRef(null);
    const projClickHandlerRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const tickFont = useMemo(() => ({ size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' }), [windowWidth]);

    const getProvLabel = useCallback((key) => getText(`electricity_generation_provincial_prov_${key}`, lang), [lang]);
    const getLegendLabel = useCallback((key) => getText(`largest_wind_projects_legend_${key}`, lang), [lang]);

    const formatMw = useCallback((value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    }, [locale]);

    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const scrollToFootnote = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-wind-capacity')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const scrollToRef = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-rf-wind-capacity')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    useEffect(() => {
        getWindProjectsMapData()
            .then(setResult)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const syncZoom = () => {
            const inner = window.innerWidth;
            const outer = window.outerWidth;
            const dpr = window.devicePixelRatio || 1;
            setWindowWidth(inner);
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

    const setupChartAccessibility = useCallback((chartRef) => {
        if (!chartRef?.current) return;
        const plotContainer = chartRef.current;
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
            setupChartAccessibility(provChartRef);
            setupChartAccessibility(projChartRef);
        }, 500);
        const observers = [provChartRef, projChartRef].map((ref) => {
            if (!ref.current) return null;
            const observer = new MutationObserver(() => setupChartAccessibility(ref));
            observer.observe(ref.current, { childList: true, subtree: true });
            return observer;
        });
        return () => {
            clearTimeout(timer);
            observers.forEach((observer) => observer?.disconnect());
        };
    }, [lang, loading, error, result, setupChartAccessibility]);

    const getPointIndex = (point) => {
        if (!point) return undefined;
        if (point.pointIndex != null && point.pointIndex >= 0) return point.pointIndex;
        if (point.pointNumber != null && point.pointNumber >= 0) return point.pointNumber;
        return undefined;
    };

    const togglePointSelection = useCallback((pointIndex, setSelected, lastClickRef) => {
        if (pointIndex === undefined) return;

        if (windowWidth <= 768) {
            const now = Date.now();
            const last = lastClickRef.current;
            const isDoubleTap = pointIndex === last.pointIndex && now - last.time < 300;
            lastClickRef.current = { time: now, pointIndex };
            if (!isDoubleTap) return;
        }

        setSelected((prev) => {
            if (prev === null) return [pointIndex];
            if (prev.includes(pointIndex)) {
                const next = prev.filter((i) => i !== pointIndex);
                return next.length === 0 ? null : next;
            }
            return [...prev, pointIndex];
        });
    }, [windowWidth]);

    const syncTableScroll = useCallback((topRef, tableRef, bottomRef) => {
        const topScroll = topRef.current;
        const tableScroll = tableRef.current;
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

    const useSyncedTableScroll = (isOpen, topRef, tableRef, bottomRef) => {
        useEffect(() => {
            const topScroll = topRef.current;
            const tableScroll = tableRef.current;
            const bottomScroll = bottomRef.current;
            if (!topScroll || !tableScroll || !bottomScroll || !isOpen) return;

            const syncFrom = (source) => {
                if (source !== topScroll && topScroll.scrollLeft !== source.scrollLeft) topScroll.scrollLeft = source.scrollLeft;
                if (source !== tableScroll && tableScroll.scrollLeft !== source.scrollLeft) tableScroll.scrollLeft = source.scrollLeft;
                if (source !== bottomScroll && bottomScroll.scrollLeft !== source.scrollLeft) bottomScroll.scrollLeft = source.scrollLeft;
            };

            const handleTopScroll = () => syncFrom(topScroll);
            const handleTableScroll = () => syncFrom(tableScroll);
            const handleBottomScroll = () => syncFrom(bottomScroll);
            const sync = () => window.requestAnimationFrame(() => syncTableScroll(topRef, tableRef, bottomRef));

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
        }, [isOpen, topRef, tableRef, bottomRef]);
    };

    useSyncedTableScroll(isProvTableOpen, provTableTopRef, provTableScrollRef, provTableBottomRef);
    useSyncedTableScroll(isProjTableOpen, projTableTopRef, projTableScrollRef, projTableBottomRef);

    const provinces = useMemo(() => result?.provinces ?? [], [result]);
    const projects = useMemo(() => result?.projects ?? [], [result]);
    const referenceYear = result?.referenceYear;
    const provChartTitle = substitute(getText('largest_wind_projects_prov_chart_title', lang), { year: referenceYear ?? '' });
    const projChartTitleSuffix = substitute(getText('largest_wind_projects_proj_chart_title_suffix', lang), { year: referenceYear ?? '' });

    const zoomEffective = Math.max(
        viewportZoom.pinScale,
        viewportZoom.layoutRatio,
        viewportZoom.cssZoomFactor,
        viewportZoom.dprZoomFactor,
        viewportZoom.screenZoomHint,
    );
    const useVerticalProvTicks = zoomEffective >= largest_wind_projects_PROV_VERTICAL_TICK_ZOOM || windowWidth <= 480;
    const useWrapProjLabels = zoomEffective >= largest_wind_projects_PROJ_WRAP_ZOOM;
    const projLabelMaxLength = zoomEffective >= largest_wind_projects_PROJ_WRAP_DEEP_ZOOM ? 14 : 20;

    const provLabels = useMemo(() => provinces.map((row) => getProvLabel(row.key)), [provinces, getProvLabel]);
    const provValues = useMemo(() => provinces.map((row) => row.capacity), [provinces]);
    const projLabels = useMemo(() => projects.map((row) => row.facility), [projects]);
    const projValues = useMemo(() => projects.map((row) => row.capacity), [projects]);
    const projTickText = useMemo(() => {
        if (!useWrapProjLabels) return projLabels;
        return projLabels.map((label) => wrapTickLabel(label, projLabelMaxLength));
    }, [projLabels, useWrapProjLabels, projLabelMaxLength]);

    const projRightMargin = 70;
    const projLeftMargin = useMemo(() => {
        const labels = useWrapProjLabels ? projTickText : projLabels;
        const fontSize = tickFont.size;
        const charPx = fontSize * 0.58;
        const minMargin = windowWidth <= 480 ? 100 : 120;
        const defaultMargin = windowWidth <= 480 ? 140 : 180;
        const maxLineWidth = Math.max(
            0,
            ...labels.flatMap((label) =>
                String(label).split('<br>').map((line) => line.length * charPx),
            ),
        );
        const padded = Math.ceil(maxLineWidth + 14);
        const floor = useWrapProjLabels ? minMargin : defaultMargin;
        return Math.max(floor, padded);
    }, [useWrapProjLabels, projTickText, projLabels, tickFont.size, windowWidth]);
    const projColumnHeaderStyle = {
        gridTemplateColumns: `${projLeftMargin}px 1fr`,
        marginRight: projRightMargin,
    };
    const provBottomMargin = useVerticalProvTicks
        ? windowWidth <= 480
            ? 110
            : 90
        : windowWidth <= 480
          ? 90
          : 60;
    const projRowHeight = useWrapProjLabels ? (windowWidth <= 480 ? 36 : 40) : (windowWidth <= 480 ? 24 : 28);
    const projPlotHeight = useMemo(() => {
        const lineCounts = useWrapProjLabels
            ? projTickText.map((label) => label.split('<br>').length)
            : projects.map(() => 1);
        const rowsHeight = lineCounts.reduce((sum, lines) => sum + projRowHeight * lines, 0);
        return Math.max(520, rowsHeight + 80);
    }, [projects, projTickText, useWrapProjLabels, projRowHeight]);
    const provPlotHeight = windowWidth <= 480 ? 360 : windowWidth <= 768 ? 400 : 440;

    const provYMax = useMemo(() => {
        const max = Math.max(...provValues, 0);
        return Math.ceil(max * 1.12 / 500) * 500;
    }, [provValues]);

    const projXMax = useMemo(() => {
        const max = Math.max(...projValues, 0);
        return Math.ceil(max * 1.15 / 50) * 50;
    }, [projValues]);

    const provBarOpacityFor = useCallback((pointIndex) => {
        if (selectedProvPoints === null) return 1;
        return selectedProvPoints.includes(pointIndex) ? 1 : 0.3;
    }, [selectedProvPoints]);

    const provBarColorFor = useCallback((pointIndex) => {
        if (selectedProvPoints === null) return PROV_BAR_COLOR;
        return selectedProvPoints.includes(pointIndex) ? PROV_BAR_COLOR : hexToRgba(PROV_BAR_COLOR, 0.3);
    }, [selectedProvPoints]);

    const projBarOpacityFor = useCallback((pointIndex) => {
        if (selectedProjPoints === null) return 1;
        return selectedProjPoints.includes(pointIndex) ? 1 : 0.3;
    }, [selectedProjPoints]);

    const projBarColorFor = useCallback((pointIndex, baseColor) => {
        if (selectedProjPoints === null) return baseColor;
        return selectedProjPoints.includes(pointIndex) ? baseColor : hexToRgba(baseColor, 0.3);
    }, [selectedProjPoints]);

    const barLabelFontSize = windowWidth <= 480 ? 12 : 14;
    const barLabelFont = useMemo(() => ({
        size: barLabelFontSize,
        color: '#58585a',
        family: 'Arial, sans-serif',
    }), [barLabelFontSize]);

    const provPlotData = useMemo(() => [{
        type: 'bar',
        x: provLabels,
        y: provValues,
        customdata: provValues.map((v) => formatMw(v)),
        marker: {
            color: provinces.map((_, i) => provBarColorFor(i)),
            opacity: provinces.map((_, i) => provBarOpacityFor(i)),
            line: { width: 0 },
        },
        text: provValues.map((v) => formatMw(v)),
        textposition: 'outside',
        textfont: barLabelFont,
        outsidetextfont: barLabelFont,
        cliponaxis: false,
        hovertemplate: '<b>%{x}</b><br>%{customdata} MW<extra></extra>',
    }], [provLabels, provValues, provinces, barLabelFont, formatMw, provBarColorFor, provBarOpacityFor]);

    const projBaseColors = useMemo(
        () => projects.map((row) => PROJECT_PROV_COLORS[row.provKey] || '#666666'),
        [projects],
    );

    const projPlotData = useMemo(() => [{
        type: 'bar',
        orientation: 'h',
        y: projLabels,
        x: projValues,
        customdata: projValues.map((v) => formatMw(v)),
        marker: {
            color: projBaseColors.map((color, i) => projBarColorFor(i, color)),
            opacity: projects.map((_, i) => projBarOpacityFor(i)),
            line: { width: 0 },
        },
        text: projValues.map((v) => formatMw(v)),
        textposition: 'outside',
        textfont: barLabelFont,
        outsidetextfont: barLabelFont,
        cliponaxis: false,
        hovertemplate: '<b>%{y}</b><br>%{customdata} MW<extra></extra>',
    }], [projLabels, projValues, projects, projBaseColors, barLabelFont, formatMw, projBarColorFor, projBarOpacityFor]);

    const provPlotLayout = useMemo(() => ({
        showlegend: false,
        hovermode: 'closest',
        hoverlabel: HOVER_LABEL,
        clickmode: 'event',
        dragmode: false,
        height: provPlotHeight,
        xaxis: {
            type: 'category',
            categoryorder: 'array',
            categoryarray: provLabels,
            tickangle: useVerticalProvTicks ? 90 : (windowWidth <= 480 ? -45 : 0),
            tickfont: tickFont,
            showgrid: false,
            showline: true,
            linewidth: 1,
            linecolor: '#333',
            fixedrange: true,
            automargin: true,
        },
        yaxis: {
            range: [0, provYMax],
            showgrid: false,
            showline: true,
            linewidth: 1,
            linecolor: '#333',
            zeroline: true,
            tickfont: tickFont,
            fixedrange: true,
            automargin: true,
        },
        margin: { l: 70, r: 50, t: 30, b: provBottomMargin },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        autosize: true,
    }), [provYMax, provLabels, tickFont, windowWidth, provPlotHeight, useVerticalProvTicks, provBottomMargin]);

    const projPlotLayout = useMemo(() => ({
        showlegend: false,
        hovermode: 'closest',
        hoverlabel: HOVER_LABEL,
        clickmode: 'event',
        dragmode: false,
        height: projPlotHeight,
        xaxis: {
            range: [0, projXMax],
            showgrid: false,
            showline: true,
            linewidth: 1,
            linecolor: '#333',
            tickfont: tickFont,
            fixedrange: true,
            automargin: true,
            showticklabels: false,
            title: { text: '' },
        },
        yaxis: {
            type: 'category',
            categoryorder: 'array',
            categoryarray: projLabels,
            ...(useWrapProjLabels ? {
                tickmode: 'array',
                tickvals: projLabels,
                ticktext: projTickText,
            } : {}),
            autorange: 'reversed',
            showgrid: false,
            tickfont: tickFont,
            fixedrange: true,
            automargin: false,
            side: 'left',
            ticklabelposition: 'outside',
            title: { text: '' },
        },
        margin: { l: projLeftMargin, r: projRightMargin, t: 8, b: 40 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        autosize: true,
    }), [projXMax, projLabels, projTickText, tickFont, projPlotHeight, useWrapProjLabels, projLeftMargin, projRightMargin]);

    const handleProvClick = useCallback((event) => {
        if (!event?.points?.length) return;
        togglePointSelection(getPointIndex(event.points[0]), setSelectedProvPoints, provLastClickRef);
    }, [togglePointSelection]);

    const handleProjClick = useCallback((event) => {
        if (!event?.points?.length) return;
        togglePointSelection(getPointIndex(event.points[0]), setSelectedProjPoints, projLastClickRef);
    }, [togglePointSelection]);

    provClickHandlerRef.current = handleProvClick;
    projClickHandlerRef.current = handleProjClick;

    const bindPlotClickHandler = useCallback((graphDiv, handlerRef, storageKey) => {
        if (!graphDiv?.on) return;
        if (graphDiv[storageKey]) {
            graphDiv.removeListener('plotly_click', graphDiv[storageKey]);
        }
        const handler = (event) => handlerRef.current?.(event);
        graphDiv[storageKey] = handler;
        graphDiv.on('plotly_click', handler);
    }, []);

    const onProvPlotReady = useCallback(
        (_figure, graphDiv) => bindPlotClickHandler(graphDiv, provClickHandlerRef, '_windCapacityProvClick'),
        [bindPlotClickHandler],
    );

    const onProjPlotReady = useCallback(
        (_figure, graphDiv) => bindPlotClickHandler(graphDiv, projClickHandlerRef, '_windCapacityProjClick'),
        [bindPlotClickHandler],
    );

    const clearProvSelection = () => {
        provLastClickRef.current = { time: 0, pointIndex: null };
        setSelectedProvPoints(null);
    };

    const clearProjSelection = () => {
        projLastClickRef.current = { time: 0, pointIndex: null };
        setSelectedProjPoints(null);
    };

    const downloadChartWithTitle = async (plotEl, title, filename, height = 600) => {
        const plotElement = plotEl || provChartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        try {
            const imgData = await window.Plotly.toImage(plotElement, { format: 'png', width: 1000, height, scale: 2 });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                const titleHeight = 50;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(stripHtml(title), canvas.width / 2, 35);
                ctx.drawImage(img, 0, titleHeight);
                const link = document.createElement('a');
                link.download = filename;
                link.href = canvas.toDataURL('image/png');
                link.click();
            };
            img.src = imgData;
        } catch (err) {
            console.error(err);
        }
    };

    const downloadProjChartWithLegend = useCallback(async () => {
        const plotElement = projChartRef?.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        try {
            const title = `${stripHtml(getText('largest_wind_projects_proj_chart_title', lang))}*${stripHtml(getText('largest_wind_projects_proj_chart_title_suffix', lang))}`;
            const imgData = await window.Plotly.toImage(plotElement, { format: 'png', width: 1000, height: projPlotHeight, scale: 2 });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                const titleHeight = 50;
                const legendHeight = 50;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight + legendHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, canvas.width / 2, 35);
                ctx.drawImage(img, 0, titleHeight);

                const legendItems = LEGEND_KEYS.map((key) => ({
                    color: PROJECT_PROV_COLORS[key],
                    label: getLegendLabel(key),
                }));
                const legendY = titleHeight + img.height + 32;
                ctx.font = '16px Arial';
                const totalLegendWidth = legendItems.reduce((sum, item) => sum + ctx.measureText(item.label).width + 36, 0);
                let legendX = (canvas.width - totalLegendWidth) / 2;
                legendItems.forEach((item) => {
                    ctx.beginPath();
                    ctx.arc(legendX + 7, legendY, 7, 0, Math.PI * 2);
                    ctx.fillStyle = item.color;
                    ctx.fill();
                    ctx.fillStyle = '#333333';
                    ctx.textAlign = 'left';
                    ctx.fillText(item.label, legendX + 20, legendY + 5);
                    legendX += ctx.measureText(item.label).width + 36;
                });

                const link = document.createElement('a');
                link.download = lang === 'en' ? 'largest_wind_projects.png' : 'principales_installations_eoliennes.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            };
            img.src = imgData;
        } catch (err) {
            console.error(err);
        }
    }, [projPlotHeight, getLegendLabel, lang]);

    const downloadProvCsv = () => {
        const headers = [getText('largest_wind_projects_table_col_province', lang), getText('largest_wind_projects_table_col_capacity', lang)];
        const rows = provinces.map((row) => [getProvLabel(row.key), row.capacity]);
        const csv = [headers.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
        saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), lang === 'en' ? 'wind_capacity_by_province.csv' : 'capacite_eolienne_par_province.csv');
    };

    const downloadProjCsv = () => {
        const headers = [getText('largest_wind_projects_table_col_facility', lang), getText('largest_wind_projects_table_col_total_capacity', lang)];
        const rows = projects.map((row) => [row.facility, row.capacity]);
        const csv = [headers.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
        saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), lang === 'en' ? 'largest_wind_projects.csv' : 'principales_installations_eoliennes.csv');
    };

    const downloadProvDocx = async () => {
        const title = stripHtml(getText('largest_wind_projects_prov_chart_title', lang));
        const headerCells = [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: getText('largest_wind_projects_table_col_province', lang), bold: true, size: 22 })], alignment: AlignmentType.CENTER })], shading: { fill: 'E6E6E6' } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: getText('largest_wind_projects_table_col_capacity', lang), bold: true, size: 22 })], alignment: AlignmentType.CENTER })], shading: { fill: 'E6E6E6' } }),
        ];
        const dataRows = provinces.map((row) => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: getProvLabel(row.key), size: 22 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatMw(row.capacity), size: 22 })], alignment: AlignmentType.RIGHT })] }),
            ],
        }));
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [3200, 2200], rows: [new TableRow({ children: headerCells }), ...dataRows] }),
                ],
            }],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'wind_capacity_by_province.docx' : 'capacite_eolienne_par_province.docx');
    };

    const downloadProjDocx = async () => {
        const title = `${stripHtml(getText('largest_wind_projects_proj_chart_title', lang))}*${stripHtml(getText('largest_wind_projects_proj_chart_title_suffix', lang))}`;
        const headerCells = [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: getText('largest_wind_projects_table_col_facility', lang), bold: true, size: 22 })], alignment: AlignmentType.LEFT })], shading: { fill: 'E6E6E6' } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: getText('largest_wind_projects_table_col_total_capacity', lang), bold: true, size: 22 })], alignment: AlignmentType.CENTER })], shading: { fill: 'E6E6E6' } }),
        ];
        const dataRows = projects.map((row) => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row.facility, size: 22 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatMw(row.capacity), size: 22 })], alignment: AlignmentType.RIGHT })] }),
            ],
        }));
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [5200, 2200], rows: [new TableRow({ children: headerCells }), ...dataRows] }),
                ],
            }],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'largest_wind_projects.docx' : 'principales_installations_eoliennes.docx');
    };

    const provChartConfig = useMemo(() => ({
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        modeBarButtonsToRemove: MODEBAR_REMOVE,
        modeBarButtonsToAdd: [{
            name: getText('largest_wind_projects_download_prov_png', lang),
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: (gd) => downloadChartWithTitle(
                gd,
                getText('largest_wind_projects_prov_chart_title', lang),
                lang === 'en' ? 'wind_capacity_by_province.png' : 'capacite_eolienne_par_province.png',
                provPlotHeight,
            ),
        }],
    }), [lang, provPlotHeight]);

    const projChartConfig = useMemo(() => ({
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        modeBarButtonsToRemove: MODEBAR_REMOVE,
        modeBarButtonsToAdd: [{
            name: getText('largest_wind_projects_download_proj_png', lang),
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: () => downloadProjChartWithLegend(),
        }],
    }), [lang, downloadProjChartWithLegend]);

    const provTableCaption = substitute(getText('largest_wind_projects_table_caption_prov', lang), { year: referenceYear ?? '' });
    const projTableCaption = substitute(getText('largest_wind_projects_table_caption_proj', lang), { year: referenceYear ?? '' });

    const renderDataTable = ({
        isOpen,
        setIsOpen,
        topRef,
        tableRef,
        bottomRef,
        caption,
        headers,
        rows,
        onCsv,
        onDocx,
        captionId,
    }) => (
        <div className="wind-capacity-table-wrapper">
            <details className="wind-capacity-data-table" onToggle={(e) => setIsOpen(e.currentTarget.open)}>
                <summary role="button" aria-expanded={isOpen}>
                    <span aria-hidden="true" style={{ marginRight: '8px' }}>{isOpen ? '▼' : '▶'}</span>
                    {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                    <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                </summary>
                <div ref={topRef} className="wind-capacity-table-scrollbar" aria-hidden="true"><div /></div>
                <div
                    ref={tableRef}
                    className="wind-capacity-table-responsive"
                    role="region"
                    aria-labelledby={captionId}
                    tabIndex={0}
                >
                    <table className="table table-bordered table-striped table-hover">
                        <caption id={captionId} className="wb-inv">{caption}</caption>
                        <thead>
                            <tr>
                                {headers.map((header) => (
                                    <th key={header} scope="col">{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>{rows}</tbody>
                    </table>
                </div>
                <div ref={bottomRef} className="wind-capacity-table-scrollbar" aria-hidden="true"><div /></div>
                <div className="wind-capacity-download-buttons">
                    <button type="button" onClick={onCsv}>
                        {getText('largest_wind_projects_download_csv', lang)}
                    </button>
                    <button type="button" onClick={onDocx}>
                        {getText('largest_wind_projects_download_docx', lang)}
                    </button>
                </div>
            </details>
        </div>
    );

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-81"
            role="main"
            aria-labelledby="wind-capacity-prov-chart-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-81 { width: 100%; }
.wind-capacity-container { width: 100%; padding: 15px 0 40px 0; display: flex; flex-direction: column; box-sizing: border-box; }
.wind-capacity-chart-frame { background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 24px; box-sizing: border-box; overflow: visible; }
.wind-capacity-chart-title { font-family: 'Lato', sans-serif; font-size: 29px; font-weight: bold; color: var(--gc-text); text-align: center; margin: 0 0 12px 0; text-transform: none; }
.wind-capacity-chart-title .fn-lnk { color: #26374a; text-decoration: underline; }
.wind-capacity-chart-scroll { width: 100%; overflow: visible; position: relative; }
.wind-capacity-chart { width: 100%; min-width: 0; position: relative; z-index: 1; overflow: visible; }
.wind-capacity-chart > div { width: 100%; height: 100%; overflow: visible; }
.wind-capacity-chart .js-plotly-plot,
.wind-capacity-chart .plot-container,
.wind-capacity-chart .svg-container { overflow: visible !important; pointer-events: auto !important; }
.wind-capacity-chart .js-plotly-plot .plotly .modebar { right: 4px !important; top: 2px !important; }
.wind-capacity-clear-selection { padding: 6px 12px; background-color: #8C8C8C; border: 1px solid #404040; border-radius: 4px; cursor: pointer; font-family: Arial, sans-serif; font-size: 14px; color: #fff; margin-bottom: 8px; }
.wind-capacity-proj-column-headers {
    display: grid;
    align-items: flex-end;
    font-family: Arial, sans-serif;
    font-size: 16px;
    font-weight: bold;
    color: #58585a;
    margin-bottom: 4px;
    padding: 0;
    box-sizing: border-box;
}
.wind-capacity-proj-column-headers span:first-child {
    text-align: right;
    padding-right: 2px;
    box-sizing: border-box;
}
.wind-capacity-proj-column-headers span:last-child {
    text-align: right;
    box-sizing: border-box;
}
.wind-capacity-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 18px 28px; margin-top: 16px; font-family: Arial, sans-serif; font-size: 14px; color: var(--gc-text); }
.wind-capacity-legend-item { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.wind-capacity-legend-swatch { width: 22px; height: 14px; display: inline-block; border: 1px solid rgba(0, 0, 0, 0.12); }
.wind-capacity-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.wind-capacity-table-wrapper details > summary { display: block; width: 100%; padding: 12px 15px; background-color: #8C8C8C; border: 1px solid #404040; border-radius: 4px; cursor: pointer; font-family: Arial, sans-serif; font-weight: bold; color: #ffffff; list-style: none; }
.wind-capacity-table-wrapper details > summary::-webkit-details-marker { display: none; }
.wind-capacity-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.wind-capacity-table-scrollbar > div { height: 20px; }
.wind-capacity-table-responsive { display: block; width: 100%; overflow-x: auto; border: 1px solid #ddd; background: #fff; scrollbar-width: none; -ms-overflow-style: none; }
.wind-capacity-table-responsive::-webkit-scrollbar { display: none; }
.wind-capacity-table-responsive table { width: max-content !important; min-width: 100%; }
.wind-capacity-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.wind-capacity-download-buttons button { padding: 8px 16px; border: 1px solid #404040; border-radius: 4px; background: #8C8C8C; cursor: pointer; font-family: Arial, sans-serif; font-weight: bold; color: #ffffff; }
.wind-capacity-chart-frame button:hover, .wind-capacity-table-wrapper summary:hover, .wind-capacity-download-buttons button:hover { background-color: #404040 !important; }
.wind-capacity-footnotes { font-family: var(--font-body); font-size: 1rem; color: var(--gc-text); margin-top: 24px; margin-bottom: 0; padding-top: 12px; border-top: 1px solid #e0e0e0; line-height: 1.65; max-width: 100%; box-sizing: border-box; }
.wind-capacity-footnotes h2 { font-family: var(--font-heading); font-size: 1.4rem; font-weight: 700; color: var(--gc-text); margin-top: 0; margin-bottom: 1rem; }
.wind-capacity-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
.wind-capacity-loading, .wind-capacity-error { font-family: 'Noto Sans', sans-serif; font-size: 18px; color: var(--gc-text); margin: 24px 0; }
@media (max-width: 768px) {
    .wind-capacity-chart-title { font-size: 26px; }
    .wind-capacity-footnotes { font-size: 0.9rem; }
    .wind-capacity-footnotes h2 { font-size: 1.2rem; margin-bottom: 0.75rem; }
    .wind-capacity-proj-column-headers { font-size: 14px; }
}
            `}</style>

            <div className="wind-capacity-container">
                {loading && <p className="wind-capacity-loading">{lang === 'en' ? 'Loading data…' : 'Chargement des données…'}</p>}
                {error && <p className="wind-capacity-error" role="alert">{error}</p>}

                {!loading && !error && provinces.length > 0 && (
                    <div className="wind-capacity-chart-frame">
                        <h2 id="wind-capacity-prov-chart-title" className="wind-capacity-chart-title">
                            {provChartTitle}
                        </h2>

                        {selectedProvPoints !== null && (
                            <button type="button" className="wind-capacity-clear-selection" onClick={clearProvSelection}>
                                {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                            </button>
                        )}

                        <div className="wind-capacity-chart-scroll">
                            <figure
                                ref={provChartRef}
                                className="wind-capacity-chart"
                                style={{ height: provPlotHeight, margin: 0 }}
                                role="region"
                                aria-label={provChartTitle}
                                tabIndex={0}
                            >
                                <Plot
                                    key={`wind-capacity-prov-${useVerticalProvTicks ? 'v' : 'h'}-${provPlotHeight}`}
                                    data={provPlotData}
                                    layout={provPlotLayout}
                                    config={provChartConfig}
                                    style={{ width: '100%', height: '100%' }}
                                    useResizeHandler
                                    onInitialized={onProvPlotReady}
                                    onUpdate={onProvPlotReady}
                                />
                            </figure>
                        </div>

                        {renderDataTable({
                            isOpen: isProvTableOpen,
                            setIsOpen: setIsProvTableOpen,
                            topRef: provTableTopRef,
                            tableRef: provTableScrollRef,
                            bottomRef: provTableBottomRef,
                            caption: provTableCaption,
                            captionId: 'wind-capacity-prov-table-caption',
                            headers: [getText('largest_wind_projects_table_col_province', lang), getText('largest_wind_projects_table_col_capacity', lang)],
                            rows: provinces.map((row) => (
                                <tr key={row.key}>
                                    <th scope="row">{getProvLabel(row.key)}</th>
                                    <td style={{ textAlign: 'right' }}>{formatMw(row.capacity)}</td>
                                </tr>
                            )),
                            onCsv: downloadProvCsv,
                            onDocx: downloadProvDocx,
                        })}
                    </div>
                )}

                {!loading && !error && projects.length > 0 && (
                    <div className="wind-capacity-chart-frame">
                        <h2 id="wind-capacity-proj-chart-title" className="wind-capacity-chart-title">
                            {getText('largest_wind_projects_proj_chart_title', lang)}
                            <span id="fn-asterisk-rf-wind-capacity" style={{ verticalAlign: 'super', fontSize: '0.75em' }}>
                                <a className="fn-lnk" href="#fn-asterisk-wind-capacity" onClick={scrollToFootnote}>
                                    <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                                    <span aria-hidden="true">*</span>
                                </a>
                            </span>
                            {projChartTitleSuffix}
                        </h2>

                        {selectedProjPoints !== null && (
                            <button type="button" className="wind-capacity-clear-selection" onClick={clearProjSelection}>
                                {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                            </button>
                        )}

                        <div className="wind-capacity-proj-column-headers" style={projColumnHeaderStyle} aria-hidden="true">
                            <span>{getText('largest_wind_projects_table_col_facility', lang)}</span>
                            <span>{getText('largest_wind_projects_table_col_total_capacity', lang)}</span>
                        </div>

                        <div className="wind-capacity-chart-scroll">
                            <figure
                                ref={projChartRef}
                                className="wind-capacity-chart"
                                style={{ height: projPlotHeight, margin: 0 }}
                                role="region"
                                aria-label={`${getText('largest_wind_projects_proj_chart_title', lang)}${getText('largest_wind_projects_proj_chart_title_suffix', lang)}`}
                                tabIndex={0}
                            >
                                <Plot
                                    key={`wind-capacity-proj-${useWrapProjLabels ? 'wrap' : 'plain'}-${projPlotHeight}-${projLeftMargin}`}
                                    data={projPlotData}
                                    layout={projPlotLayout}
                                    config={projChartConfig}
                                    style={{ width: '100%', height: '100%' }}
                                    useResizeHandler
                                    onInitialized={onProjPlotReady}
                                    onUpdate={onProjPlotReady}
                                />
                            </figure>
                        </div>

                        <div className="wind-capacity-legend" aria-hidden="false">
                            {LEGEND_KEYS.map((key) => (
                                <span key={key} className="wind-capacity-legend-item">
                                    <span className="wind-capacity-legend-swatch" style={{ backgroundColor: PROJECT_PROV_COLORS[key] }} />
                                    {getLegendLabel(key)}
                                </span>
                            ))}
                        </div>

                        {renderDataTable({
                            isOpen: isProjTableOpen,
                            setIsOpen: setIsProjTableOpen,
                            topRef: projTableTopRef,
                            tableRef: projTableScrollRef,
                            bottomRef: projTableBottomRef,
                            caption: projTableCaption,
                            captionId: 'wind-capacity-proj-table-caption',
                            headers: [getText('largest_wind_projects_table_col_facility', lang), getText('largest_wind_projects_table_col_total_capacity', lang)],
                            rows: projects.map((row) => (
                                <tr key={row.index}>
                                    <th scope="row">{row.facility}</th>
                                    <td style={{ textAlign: 'right' }}>{formatMw(row.capacity)}</td>
                                </tr>
                            )),
                            onCsv: downloadProjCsv,
                            onDocx: downloadProjDocx,
                        })}
                    </div>
                )}

                {!loading && !error && projects.length > 0 && (
                    <aside className="wb-fnote wind-capacity-footnotes" role="note">
                        <h2>{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                        <dl>
                            <dt className="wb-inv">{lang === 'en' ? 'Footnote' : 'Note de bas de page'}</dt>
                            <dd id="fn-asterisk-wind-capacity">
                                <a href="#fn-asterisk-rf-wind-capacity" onClick={scrollToRef} className="fn-num" title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}>
                                    <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                                </a>
                                {' '}{getText('largest_wind_projects_footnote', lang)}
                            </dd>
                        </dl>
                    </aside>
                )}
            </div>
        </main>
    );
};

export default WindProjectsMap;
