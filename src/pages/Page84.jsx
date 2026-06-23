import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import page84Bg from '../assets/page84_bg.png';
import { getPage84Data } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const PROJECT_PROV_COLORS = {
    ab: '#709735',
    on: '#4b4c4d',
};
const LEGEND_KEYS = ['ab', 'on'];

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

const PAGE84_PROJ_WRAP_ZOOM = 2.5;
const PAGE84_PROJ_WRAP_DEEP_ZOOM = 3.25;

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

const Page84 = () => {
    const { lang } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [viewportZoom, setViewportZoom] = useState(createInitialViewportZoom);

    const chartRef = useRef(null);
    const zoomBaselineRef = useRef(null);
    const tableTopRef = useRef(null);
    const tableScrollRef = useRef(null);
    const tableBottomRef = useRef(null);
    const lastClickRef = useRef({ time: 0, pointIndex: null });
    const clickHandlerRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };

    const getLegendLabel = useCallback((key) => getText(`page84_legend_${key}`, lang), [lang]);

    const formatMw = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const scrollToFootnote = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-page84')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const scrollToRef = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-rf-page84')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    useEffect(() => {
        getPage84Data()
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

    const projects = useMemo(() => result?.projects ?? [], [result]);
    const referenceYear = result?.referenceYear;

    const zoomEffective = Math.max(
        viewportZoom.pinScale,
        viewportZoom.layoutRatio,
        viewportZoom.cssZoomFactor,
        viewportZoom.dprZoomFactor,
        viewportZoom.screenZoomHint,
    );
    const useWrapLabels = zoomEffective >= PAGE84_PROJ_WRAP_ZOOM || windowWidth <= 480;
    const labelMaxLength = zoomEffective >= PAGE84_PROJ_WRAP_DEEP_ZOOM ? 14 : 20;

    const projLabels = useMemo(() => projects.map((row) => row.facility), [projects]);
    const projValues = useMemo(() => projects.map((row) => row.capacity), [projects]);
    const projTickText = useMemo(() => {
        if (!useWrapLabels) return projLabels;
        return projLabels.map((label) => wrapTickLabel(label, labelMaxLength));
    }, [projLabels, useWrapLabels, labelMaxLength]);

    const projRightMargin = 70;
    const projLeftMargin = useMemo(() => {
        const labels = useWrapLabels ? projTickText : projLabels;
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
    }, [useWrapLabels, projTickText, projLabels, tickFont.size, windowWidth]);

    const projColumnHeaderStyle = {
        gridTemplateColumns: `${projLeftMargin}px 1fr`,
        marginRight: projRightMargin,
    };

    const projRowHeight = windowWidth <= 480 ? 24 : 28;
    const projPlotHeight = useMemo(
        () => Math.max(480, projects.length * projRowHeight + 80),
        [projects.length, projRowHeight],
    );

    const projXMax = useMemo(() => {
        const max = Math.max(...projValues, 0);
        return Math.ceil(max * 1.15 / 50) * 50;
    }, [projValues]);

    const barOpacityFor = (pointIndex) => {
        if (selectedPoints === null) return 1;
        return selectedPoints.includes(pointIndex) ? 1 : 0.3;
    };

    const barLabelFontSize = windowWidth <= 480 ? 12 : 14;
    const barLabelFont = {
        size: barLabelFontSize,
        color: '#58585a',
        family: 'Arial, sans-serif',
    };

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
            color: projBaseColors,
            opacity: projects.map((_, i) => barOpacityFor(i)),
            line: { width: 0 },
        },
        text: projValues.map((v) => formatMw(v)),
        textposition: 'outside',
        textfont: barLabelFont,
        outsidetextfont: barLabelFont,
        cliponaxis: false,
        hovertemplate: '<b>%{y}</b><br>%{customdata} MW<extra></extra>',
    }], [projLabels, projValues, projects, projBaseColors, selectedPoints, barLabelFont, locale]);

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
            automargin: false,
            showticklabels: false,
            title: { text: '' },
        },
        yaxis: {
            type: 'category',
            categoryorder: 'array',
            categoryarray: projLabels,
            tickmode: 'array',
            tickvals: projLabels,
            ticktext: useWrapLabels ? projTickText : projLabels,
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
    }), [projXMax, projLabels, projTickText, tickFont, projPlotHeight, useWrapLabels, projLeftMargin, projRightMargin]);

    const getPointIndex = (point) => {
        if (point.pointIndex != null && point.pointIndex >= 0) return point.pointIndex;
        if (point.pointNumber != null && point.pointNumber >= 0) return point.pointNumber;
        return undefined;
    };

    const handleChartClick = useCallback((event) => {
        if (!event?.points?.length) return;
        const pointIndex = getPointIndex(event.points[0]);
        if (pointIndex === undefined) return;

        if (windowWidth <= 768) {
            const now = Date.now();
            const last = lastClickRef.current;
            const isDoubleTap = pointIndex === last.pointIndex && now - last.time < 300;
            lastClickRef.current = { time: now, pointIndex };
            if (!isDoubleTap) return;
        }

        setSelectedPoints((prev) => {
            if (prev === null) return [pointIndex];
            if (prev.includes(pointIndex)) {
                const next = prev.filter((i) => i !== pointIndex);
                return next.length === 0 ? null : next;
            }
            return [...prev, pointIndex];
        });
    }, [windowWidth]);

    clickHandlerRef.current = handleChartClick;

    const bindPlotClickHandler = useCallback((graphDiv) => {
        if (!graphDiv?.on) return;
        if (graphDiv._page84Click) {
            graphDiv.removeListener('plotly_click', graphDiv._page84Click);
        }
        const handler = (event) => clickHandlerRef.current?.(event);
        graphDiv._page84Click = handler;
        graphDiv.on('plotly_click', handler);
    }, []);

    const onPlotReady = useCallback(
        (_figure, graphDiv) => bindPlotClickHandler(graphDiv),
        [bindPlotClickHandler],
    );

    const clearSelection = () => {
        lastClickRef.current = { time: 0, pointIndex: null };
        setSelectedPoints(null);
    };

    const chartTitleSuffix = substitute(getText('page84_chart_title_suffix', lang), { year: referenceYear ?? '' });
    const chartTitleFull = `${stripHtml(getText('page84_chart_title', lang))}*${stripHtml(chartTitleSuffix)}`;
    const tableCaption = substitute(getText('page84_table_caption', lang), { year: referenceYear ?? '' });

    const downloadChartWithLegend = async () => {
        const plotElement = chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        try {
            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 1000,
                height: projPlotHeight,
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
                    color: PROJECT_PROV_COLORS[key],
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
                    if (blob) {
                        saveAs(blob, lang === 'en' ? 'largest_solar_projects.png' : 'principales_installations_solaires.png');
                    }
                });
            };
            img.src = imgData;
        } catch (err) {
            console.error(err);
        }
    };

    const downloadCsv = () => {
        const headers = [getText('page84_table_col_facility', lang), getText('page84_table_col_capacity', lang)];
        const rows = projects.map((row) => [row.facility, row.capacity]);
        const csv = [headers.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
        saveAs(
            new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
            lang === 'en' ? 'largest_solar_projects.csv' : 'principales_installations_solaires.csv',
        );
    };

    const downloadDocx = async () => {
        const headerCells = [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: getText('page84_table_col_facility', lang), bold: true, size: 22 })], alignment: AlignmentType.LEFT })], shading: { fill: 'E6E6E6' } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: getText('page84_table_col_capacity', lang), bold: true, size: 22 })], alignment: AlignmentType.CENTER })], shading: { fill: 'E6E6E6' } }),
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
                    new Paragraph({ children: [new TextRun({ text: chartTitleFull, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [5200, 2200], rows: [new TableRow({ children: headerCells }), ...dataRows] }),
                ],
            }],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'largest_solar_projects.docx' : 'principales_installations_solaires.docx');
    };

    const chartConfig = useMemo(() => ({
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        modeBarButtonsToRemove: MODEBAR_REMOVE,
        modeBarButtonsToAdd: [{
            name: getText('page84_download_png', lang),
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: () => downloadChartWithLegend(),
        }],
    }), [lang, projPlotHeight]);

    if (loading) {
        return <p className="page84-loading">{lang === 'en' ? 'Loading data…' : 'Chargement des données…'}</p>;
    }
    if (error) {
        return <p className="page84-error" role="alert">{error}</p>;
    }
    if (!projects.length) {
        return <p className="page84-error">{lang === 'en' ? 'No data available.' : 'Aucune donnée disponible.'}</p>;
    }

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-84"
            role="main"
            aria-labelledby="page84-chart-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-84 { width: 100%; }
.page84-container { width: 100%; padding: 15px 0 40px 0; display: flex; flex-direction: column; box-sizing: border-box; }
.page84-chart-frame { background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 24px; box-sizing: border-box; overflow: visible; }
.page84-chart-title { font-family: 'Lato', sans-serif; font-size: 29px; font-weight: bold; color: var(--gc-text); text-align: center; margin: 0 0 12px 0; text-transform: none; }
.page84-chart-title .fn-lnk { color: #26374a; text-decoration: underline; }
.page84-chart-bg-wrapper {
    position: relative;
    width: 100%;
}
.page84-bg-layer {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
}
.page84-bg-image {
    display: block;
    width: 100%;
    height: auto;
    max-height: 100%;
    flex-shrink: 0;
}
.page84-chart-overlay { position: relative; z-index: 1; width: 100%; }
.page84-chart-scroll { width: 100%; overflow: visible; position: relative; }
.page84-chart { width: 100%; min-width: 0; position: relative; z-index: 1; overflow: visible; }
.page84-chart > div { width: 100%; height: 100%; overflow: visible; }
.page84-chart .js-plotly-plot,
.page84-chart .plot-container,
.page84-chart .svg-container { overflow: visible !important; pointer-events: auto !important; }
.page84-chart .js-plotly-plot .plotly .modebar { right: 4px !important; top: 2px !important; }
.page84-clear-selection { padding: 6px 12px; background-color: #8C8C8C; border: 1px solid #404040; border-radius: 4px; cursor: pointer; font-family: Arial, sans-serif; font-size: 14px; color: #fff; margin-bottom: 8px; }
.page84-column-headers {
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
.page84-column-headers span:first-child { text-align: right; padding-right: 2px; box-sizing: border-box; }
.page84-column-headers span:last-child { text-align: right; box-sizing: border-box; }
.page84-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 18px 28px; margin-top: 16px; font-family: Arial, sans-serif; font-size: 14px; color: var(--gc-text); }
.page84-legend-item { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.page84-legend-swatch { width: 22px; height: 14px; display: inline-block; border: 1px solid rgba(0, 0, 0, 0.12); }
.page84-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.page84-table-wrapper details > summary { display: block; width: 100%; padding: 12px 15px; background-color: #8C8C8C; border: 1px solid #404040; border-radius: 4px; cursor: pointer; font-family: Arial, sans-serif; font-weight: bold; color: #ffffff; list-style: none; }
.page84-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page84-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page84-table-scrollbar > div { height: 20px; }
.page84-table-responsive { display: block; width: 100%; overflow-x: auto; border: 1px solid #ddd; background: #fff; scrollbar-width: none; -ms-overflow-style: none; }
.page84-table-responsive::-webkit-scrollbar { display: none; }
.page84-table-responsive table { width: max-content !important; min-width: 100%; }
.page84-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.page84-download-buttons button { padding: 8px 16px; border: 1px solid #404040; border-radius: 4px; background: #8C8C8C; cursor: pointer; font-family: Arial, sans-serif; font-weight: bold; color: #ffffff; }
.page84-chart-frame button:hover, .page84-table-wrapper summary:hover, .page84-download-buttons button:hover { background-color: #404040 !important; }
.page84-footnotes { font-family: var(--font-body); font-size: 1rem; color: var(--gc-text); margin-top: 24px; margin-bottom: 0; padding-top: 12px; border-top: 1px solid #e0e0e0; line-height: 1.65; max-width: 100%; box-sizing: border-box; }
.page84-footnotes h2 { font-family: var(--font-heading); font-size: 1.4rem; font-weight: 700; color: var(--gc-text); margin-top: 0; margin-bottom: 1rem; }
.page84-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
.page84-loading, .page84-error { font-family: 'Noto Sans', sans-serif; font-size: 18px; color: var(--gc-text); margin: 24px 0; }
@media (max-width: 768px) {
    .page84-chart-title { font-size: 26px; }
    .page84-footnotes { font-size: 0.9rem; }
    .page84-footnotes h2 { font-size: 1.2rem; margin-bottom: 0.75rem; }
    .page84-column-headers { font-size: 14px; }
}
            `}</style>

            <div className="page84-container">
                <div className="page84-chart-frame">
                    <h2 id="page84-chart-title" className="page84-chart-title">
                        {getText('page84_chart_title', lang)}
                        <span id="fn-asterisk-rf-page84" style={{ verticalAlign: 'super', fontSize: '0.75em' }}>
                            <a className="fn-lnk" href="#fn-asterisk-page84" onClick={scrollToFootnote}>
                                <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                                <span aria-hidden="true">*</span>
                            </a>
                        </span>
                        {chartTitleSuffix}
                    </h2>

                    {selectedPoints !== null && (
                        <button type="button" className="page84-clear-selection" onClick={clearSelection}>
                            {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                        </button>
                    )}

                    <div className="page84-chart-bg-wrapper" style={{ minHeight: projPlotHeight }}>
                        <div className="page84-bg-layer" aria-hidden="true">
                            <img src={page84Bg} alt="" className="page84-bg-image" draggable={false} />
                        </div>
                        <div className="page84-chart-overlay">
                            <div className="page84-column-headers" style={projColumnHeaderStyle} aria-hidden="true">
                                <span>{getText('page84_table_col_facility', lang)}</span>
                                <span>{getText('page84_table_col_capacity', lang)}</span>
                            </div>

                            <div className="page84-chart-scroll">
                                <figure
                                    ref={chartRef}
                                    className="page84-chart"
                                    style={{ height: projPlotHeight, margin: 0 }}
                                    role="region"
                                    aria-label={chartTitleFull}
                                    tabIndex={0}
                                >
                                    <Plot
                                        key={`page84-${useWrapLabels ? 'wrap' : 'plain'}-${Math.round(zoomEffective * 100)}-${projPlotHeight}-${projLeftMargin}`}
                                        data={projPlotData}
                                        layout={projPlotLayout}
                                        config={chartConfig}
                                        style={{ width: '100%', height: '100%' }}
                                        useResizeHandler
                                        onInitialized={onPlotReady}
                                        onUpdate={onPlotReady}
                                    />
                                </figure>
                            </div>
                        </div>
                    </div>

                    <div className="page84-legend">
                        {LEGEND_KEYS.map((key) => (
                            <span key={key} className="page84-legend-item">
                                <span className="page84-legend-swatch" style={{ backgroundColor: PROJECT_PROV_COLORS[key] }} />
                                {getLegendLabel(key)}
                            </span>
                        ))}
                    </div>

                    <div className="page84-table-wrapper">
                        <details className="page84-data-table" onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                            </summary>
                            <div ref={tableTopRef} className="page84-table-scrollbar" aria-hidden="true"><div /></div>
                            <div
                                ref={tableScrollRef}
                                className="page84-table-responsive"
                                role="region"
                                aria-labelledby="page84-table-caption"
                                tabIndex={0}
                            >
                                <table className="table table-bordered table-striped table-hover">
                                    <caption id="page84-table-caption" className="wb-inv">{tableCaption}</caption>
                                    <thead>
                                        <tr>
                                            <th scope="col">{getText('page84_table_col_facility', lang)}</th>
                                            <th scope="col">{getText('page84_table_col_capacity', lang)}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {projects.map((row) => (
                                            <tr key={row.index}>
                                                <th scope="row">{row.facility}</th>
                                                <td style={{ textAlign: 'right' }}>{formatMw(row.capacity)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div ref={tableBottomRef} className="page84-table-scrollbar" aria-hidden="true"><div /></div>
                            <div className="page84-download-buttons">
                                <button type="button" onClick={downloadCsv}>{getText('page84_download_csv', lang)}</button>
                                <button type="button" onClick={downloadDocx}>{getText('page84_download_docx', lang)}</button>
                            </div>
                        </details>
                    </div>
                </div>

                <aside className="wb-fnote page84-footnotes" role="note">
                    <h2>{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnote' : 'Note de bas de page'}</dt>
                        <dd id="fn-asterisk-page84">
                            <a href="#fn-asterisk-rf-page84" onClick={scrollToRef} className="fn-num" title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}>
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                            </a>
                            {' '}{getText('page84_footnote', lang)}
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page84;
