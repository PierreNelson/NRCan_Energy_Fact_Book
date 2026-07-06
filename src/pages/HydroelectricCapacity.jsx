import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import HydroelectricCapacityHydroMapLayer, { HydroelectricCapacityHydroForegroundOverlays, HydroelectricCapacityHoverTooltip } from '../components/HydroelectricCapacityInfographic';
import { getHydroelectricCapacityData } from '../utils/dataLoader';
import { getText } from '../utils/translations';

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

const MODEBAR_REMOVE = [
    'pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d',
    'autoScale2d', 'resetScale2d', 'toImage', 'hoverClosestCartesian',
    'hoverCompareCartesian', 'toggleSpikelines',
];

const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

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
    const [selectedPoints, setSelectedPoints] = useState(null);
    const [hoverTip, setHoverTip] = useState(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [viewportZoom, setViewportZoom] = useState(createInitialViewportZoom);

    const chartRef = useRef(null);
    const chartBgRef = useRef(null);
    const zoomBaselineRef = useRef(null);
    const tableTopRef = useRef(null);
    const tableScrollRef = useRef(null);
    const tableBottomRef = useRef(null);
    const lastClickRef = useRef({ time: 0, pointIndex: null });
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

    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

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
        };
        const timer = setTimeout(setupChartAccessibility, 500);
        const observer = new MutationObserver(setupChartAccessibility);
        observer.observe(chartRef.current, { childList: true, subtree: true });
        return () => {
            clearTimeout(timer);
            observer.disconnect();
        };
    }, [lang, selectedPoints, loading, error, result]);

    const syncTableScroll = useCallback(() => {
        const topScroll = tableTopRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = tableBottomRef.current;
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
        const topScroll = tableTopRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = tableBottomRef.current;
        if (!topScroll || !tableScroll || !bottomScroll || !isTableOpen) return;

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
        if (!event?.points?.length) return;
        const pointIndex = getPointIndex(event.points[0]);
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

    const clearSelection = () => {
        lastClickRef.current = { time: 0, pointIndex: null };
        setSelectedPoints(null);
    };

    const handleChartWrapperLeave = useCallback(() => setHoverTip(null), []);

    const chartTitleSuffix = substitute(getText('major_hydro_facilities_chart_title_suffix', lang), { year: referenceYear ?? '' });
    const chartTitleFull = `${stripHtml(getText('major_hydro_facilities_chart_title', lang))}${stripHtml(chartTitleSuffix)}`;
    const tableCaption = substitute(getText('major_hydro_facilities_table_caption', lang), { year: referenceYear ?? '' });
    const fileTitle = getText('major_hydro_facilities_download_title', lang);

    const calloutLines = useMemo(() => {
        if (totalHydroMw == null || referenceYear == null) return null;
        const value = formatMw(totalHydroMw);
        return [
            getText('major_hydro_facilities_callout_line1', lang),
            substitute(getText('major_hydro_facilities_callout_line2', lang), { value }),
            substitute(getText('major_hydro_facilities_callout_line3', lang), { year: referenceYear }),
        ];
    }, [totalHydroMw, referenceYear, lang, formatMw]);

    const downloadChartWithLegend = useCallback(async () => {
        const plotElement = chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        try {
            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 1000,
                height: facPlotHeight,
                scale: 2,
            });
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
                ctx.fillText(chartTitleFull, canvas.width / 2, 35);
                ctx.drawImage(img, 0, titleHeight);

                const legendItems = LEGEND_KEYS.map((key) => ({
                    color: FACILITY_PROV_COLORS[key],
                    label: getLegendLabel(key),
                }));
                const legendY = titleHeight + img.height + 32;
                ctx.font = '16px Arial';
                const totalLegendWidth = legendItems.reduce((sum, item) => sum + ctx.measureText(item.label).width + 36, 0);
                let legendX = (canvas.width - totalLegendWidth) / 2;
                legendItems.forEach((item) => {
                    ctx.fillStyle = item.color;
                    ctx.fillRect(legendX, legendY - 8, 22, 14);
                    ctx.fillStyle = '#333333';
                    ctx.textAlign = 'left';
                    ctx.fillText(item.label, legendX + 28, legendY + 4);
                    legendX += ctx.measureText(item.label).width + 36;
                });

                canvas.toBlob((blob) => {
                    if (blob) saveAs(blob, `${fileTitle}.png`);
                });
            };
            img.src = imgData;
        } catch (err) {
            console.error(err);
        }
    }, [facPlotHeight, chartTitleFull, getLegendLabel, fileTitle]);

    const downloadCsv = () => {
        const headers = [getText('major_hydro_facilities_table_col_facility', lang), getText('major_hydro_facilities_table_col_capacity', lang)];
        const rows = facilities.map((row) => [row.facility, row.capacity]);
        const csv = [headers.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
        saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${fileTitle}.csv`);
    };

    const downloadDocx = async () => {
        const headerCells = [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: getText('major_hydro_facilities_table_col_facility', lang), bold: true, size: 22 })], alignment: AlignmentType.LEFT })], shading: { fill: 'E6E6E6' } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: getText('major_hydro_facilities_table_col_capacity', lang), bold: true, size: 22 })], alignment: AlignmentType.CENTER })], shading: { fill: 'E6E6E6' } }),
        ];
        const dataRows = facilities.map((row) => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row.facility, size: 22 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatMw(row.capacity), size: 22 })], alignment: AlignmentType.RIGHT })] }),
            ],
        }));
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: chartTitleFull, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [5600, 2000], rows: [new TableRow({ children: headerCells }), ...dataRows] }),
                ],
            }],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${fileTitle}.docx`);
    };

    const chartConfig = useMemo(() => ({
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        modeBarButtonsToRemove: MODEBAR_REMOVE,
        modeBarButtonsToAdd: [{
            name: getText('major_hydro_facilities_download_png', lang),
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: () => downloadChartWithLegend(),
        }],
    }), [lang, downloadChartWithLegend]);

    if (loading) {
        return <p className="major-hydro-facilities-loading">{lang === 'en' ? 'Loading data…' : 'Chargement des données…'}</p>;
    }
    if (error) {
        return <p className="major-hydro-facilities-error" role="alert">{error}</p>;
    }
    if (!facilities.length) {
        return <p className="major-hydro-facilities-error">{lang === 'en' ? 'No data available.' : 'Aucune donnée disponible.'}</p>;
    }

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-76"
            role="main"
            aria-labelledby="major-hydro-facilities-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-76.page-content { max-width: none !important; overflow-x: visible !important; }
.page-76 {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.major-hydro-facilities-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.major-hydro-facilities-title {
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
.major-hydro-facilities-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
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
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-top: 0;
    margin-bottom: 0;
    box-sizing: border-box;
    overflow: visible;
}
.major-hydro-facilities-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
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
.major-hydro-facilities-chart > div { width: 100%; height: 100%; overflow: visible; }
.major-hydro-facilities-chart .js-plotly-plot,
.major-hydro-facilities-chart .plot-container,
.major-hydro-facilities-chart .svg-container { overflow: visible !important; pointer-events: auto !important; }
.major-hydro-facilities-chart .js-plotly-plot .plotly .modebar { right: 4px !important; top: 2px !important; }
.major-hydro-facilities-chart .hoverlayer { display: none !important; }
.major-hydro-facilities-clear-selection {
    padding: 6px 12px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: #fff;
    margin-bottom: 8px;
}
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
.major-hydro-facilities-table-wrapper details > summary {
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
.major-hydro-facilities-table-wrapper details > summary::-webkit-details-marker { display: none; }
.major-hydro-facilities-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.major-hydro-facilities-table-scrollbar > div { height: 20px; }
.major-hydro-facilities-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #ddd;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.major-hydro-facilities-table-responsive::-webkit-scrollbar { display: none; }
.major-hydro-facilities-table-responsive table { width: max-content !important; min-width: 100%; }
.major-hydro-facilities-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.major-hydro-facilities-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.major-hydro-facilities-chart-frame button:hover,
.major-hydro-facilities-table-wrapper summary:hover,
.major-hydro-facilities-download-buttons button:hover { background-color: #404040 !important; }
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
    .major-hydro-facilities-title { font-size: 37px; }
    .major-hydro-facilities-subtitle { font-size: 26px; }
    .major-hydro-facilities-chart-title { font-size: 26px; }
    .major-hydro-facilities-column-headers { font-size: 14px; }
}
            `}</style>

            <div className="major-hydro-facilities-inner">
                <h1 id="major-hydro-facilities-title" className="major-hydro-facilities-title">{getText('major_hydro_facilities_title', lang)}</h1>
                <h2 className="major-hydro-facilities-subtitle">{getText('major_hydro_facilities_subtitle', lang)}</h2>

                <div className="major-hydro-facilities-chart-frame">
                    <h2 id="major-hydro-facilities-chart-title" className="major-hydro-facilities-chart-title wb-inv">
                        {getText('major_hydro_facilities_chart_title', lang)}{chartTitleSuffix}
                    </h2>

                    {selectedPoints !== null && (
                        <button type="button" className="major-hydro-facilities-clear-selection" onClick={clearSelection}>
                            {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                        </button>
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
                                    aria-label={chartTitleFull}
                                    tabIndex={0}
                                >
                                    <HydroelectricCapacityPlot
                                        plotKey={`major-hydro-facilities-${useWrapLabels ? 'wrap' : 'plain'}-${Math.round(zoomEffective * 100)}-${facPlotHeight}-${facLeftMargin}`}
                                        plotData={facPlotData}
                                        plotLayout={facPlotLayout}
                                        chartConfig={chartConfig}
                                        onPlotReady={onPlotReady}
                                    />
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
                        <details className="major-hydro-facilities-data-table" onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                            </summary>
                            <div ref={tableTopRef} className="major-hydro-facilities-table-scrollbar" aria-hidden="true"><div /></div>
                            <div
                                ref={tableScrollRef}
                                className="major-hydro-facilities-table-responsive"
                                role="region"
                                aria-labelledby="major-hydro-facilities-table-caption"
                                tabIndex={0}
                            >
                                <table className="table table-bordered table-striped table-hover">
                                    <caption id="major-hydro-facilities-table-caption" className="wb-inv">{tableCaption}</caption>
                                    <thead>
                                        <tr>
                                            <th scope="col">{getText('major_hydro_facilities_table_col_facility', lang)}</th>
                                            <th scope="col">{getText('major_hydro_facilities_table_col_capacity', lang)}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {facilities.map((row) => (
                                            <tr key={row.index}>
                                                <th scope="row">{row.facility}</th>
                                                <td style={{ textAlign: 'right' }}>{formatMw(row.capacity)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div ref={tableBottomRef} className="major-hydro-facilities-table-scrollbar" aria-hidden="true"><div /></div>
                            <div className="major-hydro-facilities-download-buttons">
                                <button type="button" onClick={downloadCsv}>{getText('major_hydro_facilities_download_csv', lang)}</button>
                                <button type="button" onClick={downloadDocx}>{getText('major_hydro_facilities_download_docx', lang)}</button>
                            </div>
                        </details>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default HydroelectricCapacity;
