import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const CATEGORY_KEYS = [
    'women',
    'women_trades',
    'women_office',
    'immigrants',
    'indigenous',
    'visible_minorities',
    'high_school_plus',
    'university_plus',
    'age_55_plus',
];

const PAGE42_DATA = {
    women: { energy: 24, all: 48 },
    women_trades: { energy: 7, all: 9 },
    women_office: { energy: 65, all: 68 },
    immigrants: { energy: 17, all: 25 },
    indigenous: { energy: 6, all: 4 },
    visible_minorities: { energy: 21, all: 26 },
    high_school_plus: { energy: 75, all: 66 },
    university_plus: { energy: 33, all: 32 },
    age_55_plus: { energy: 21, all: 24 },
};

const COLORS = {
    energy: '#1B99BB',
    all: '#9f346d',
};

const formatPage42Pct = (value, lang) => {
    if (value == null || Number.isNaN(Number(value))) return '—';
    const formatted = Number(value).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
    return lang === 'fr' ? `${formatted} %` : `${formatted}%`;
};

/** Horizontal inset from plot left to first legend symbol (matches Plotly legend swatch padding). */
const LEGEND_SYMBOL_INSET_PX = 17;

const getLegendTitleX = (plotWidthPx) => LEGEND_SYMBOL_INSET_PX / Math.max(plotWidthPx, 320);

/** Gap between legend title and swatch row (~8px at typical chart heights). */
const LEGEND_TITLE_TO_ITEMS_GAP = 0.014;

const EXPORT_CHART_WIDTH = 1100;
const EXPORT_MARGIN = { l: 50, r: 20, t: 20 };

const waitForPlotRender = () =>
    new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
    });

const buildLegendTitleAnnotation = (legendSettings, titleX) => ({
    xref: 'paper',
    yref: 'paper',
    x: titleX,
    y: legendSettings.y + LEGEND_TITLE_TO_ITEMS_GAP,
    xanchor: 'left',
    yanchor: 'bottom',
    text: `<b>${legendSettings.legendTitle}</b>`,
    showarrow: false,
    font: {
        size: legendSettings.fontSize,
        family: 'Arial, sans-serif',
        color: '#333333',
    },
});

const buildLegendRelayout = (legendSettings, titleX, bottomMargin) => ({
    margin: { ...EXPORT_MARGIN, b: bottomMargin },
    showlegend: true,
    'legend.orientation': 'h',
    'legend.x': 0,
    'legend.xanchor': 'left',
    'legend.y': legendSettings.y,
    'legend.yanchor': 'top',
    'legend.font.size': legendSettings.fontSize,
    'legend.font.family': 'Arial, sans-serif',
    'legend.title.text': '',
    annotations: [buildLegendTitleAnnotation(legendSettings, titleX)],
});

/** Vertical category ticks from ~300% page zoom (Ctrl+/pinch), matching Page 96 / Page 111. */
const PAGE42_VERTICAL_TICK_ZOOM = 2.85;
const LIKELY_OS_DPR_BASES = [1, 1.25, 1.3333333333333333, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5];

const createInitialViewportZoom = () => {
    if (typeof window === 'undefined') {
        return { pinScale: 1, layoutRatio: 1, cssZoomFactor: 1, screenZoomHint: 1 };
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
    return { pinScale, layoutRatio, cssZoomFactor: 1, screenZoomHint };
};

function isBrowserZoomInVerticalTickRange() {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    return LIKELY_OS_DPR_BASES.some((b) => {
        const z = dpr / b;
        return z >= PAGE42_VERTICAL_TICK_ZOOM && z <= 5.45;
    });
}

const Page42 = () => {
    const { lang } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [viewportZoom, setViewportZoom] = useState(createInitialViewportZoom);
    const zoomBaselineRef = useRef(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const [plotResetKey, setPlotResetKey] = useState(0);
    const chartRef = useRef(null);
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });

    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    const hexToRgba = (hex, opacity = 1) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
        }
        return hex;
    };

    const fileSlugBase = getText('page42_download_title', lang).replace(/\s+/g, '_');
    const chartTitle = getText('page42_chart_title', lang);

    const categoryLabelsFull = useMemo(
        () => CATEGORY_KEYS.map((key) => getText(`page42_cat_${key}_full`, lang)),
        [lang],
    );

    const categoryTickLabels = useMemo(
        () => CATEGORY_KEYS.map((key) => getText(`page42_cat_${key}_tick`, lang)),
        [lang],
    );

    const energyValues = useMemo(() => CATEGORY_KEYS.map((key) => PAGE42_DATA[key].energy), []);
    const allValues = useMemo(() => CATEGORY_KEYS.map((key) => PAGE42_DATA[key].all), []);

    const pageZoomForLayout = Math.max(
        viewportZoom.pinScale,
        viewportZoom.layoutRatio,
        viewportZoom.cssZoomFactor,
        viewportZoom.screenZoomHint,
    );
    const pinVertical =
        viewportZoom.pinScale > 1.02 && viewportZoom.pinScale >= PAGE42_VERTICAL_TICK_ZOOM;
    const useVerticalXLabels =
        pageZoomForLayout >= PAGE42_VERTICAL_TICK_ZOOM ||
        pinVertical ||
        isBrowserZoomInVerticalTickRange();
    const xTickText = useVerticalXLabels ? categoryLabelsFull : categoryTickLabels;
    const xTickAngle = useVerticalXLabels ? 90 : 0;
    const xTickFontSize = useVerticalXLabels
        ? windowWidth <= 480
            ? 9
            : 10
        : windowWidth <= 480
          ? 10
          : 12;
    const yTickFontSize = windowWidth <= 480 ? 9 : 11;

    const legendSettings = useMemo(() => {
        const legendTitle = getText('page42_legend_title', lang);
        if (windowWidth <= 480) {
            return { y: -0.44, fontSize: 11, margin: useVerticalXLabels ? 320 : 230, legendTitle };
        }
        if (windowWidth <= 768) {
            return { y: -0.40, fontSize: 12, margin: useVerticalXLabels ? 310 : 225, legendTitle };
        }
        if (windowWidth <= 1097) {
            return { y: -0.36, fontSize: 14, margin: useVerticalXLabels ? 300 : 215, legendTitle };
        }
        return { y: -0.34, fontSize: 14, margin: useVerticalXLabels ? 290 : 210, legendTitle };
    }, [windowWidth, useVerticalXLabels, lang]);

    const chartHeight = useVerticalXLabels ? (windowWidth <= 768 ? 560 : 580) : windowWidth <= 768 ? 480 : 540;
    const plotAreaWidthPx = Math.max(windowWidth - 70, 320);

    const legendTitleAnnotation = useMemo(
        () => buildLegendTitleAnnotation(legendSettings, getLegendTitleX(plotAreaWidthPx)),
        [legendSettings, plotAreaWidthPx],
    );

    const energyTrace = useMemo(
        () => ({
            type: 'bar',
            name: getText('page42_legend_energy', lang),
            x: CATEGORY_KEYS,
            y: energyValues,
            marker: {
                color: CATEGORY_KEYS.map((_, index) =>
                    selectedPoints === null
                        ? COLORS.energy
                        : hexToRgba(COLORS.energy, selectedPoints[0]?.includes(index) ? 1 : 0.3),
                ),
            },
            hovertext: CATEGORY_KEYS.map(
                (key, i) =>
                    `<b>${categoryLabelsFull[i]}</b><br>${getText('page42_legend_energy', lang)}: ${formatPage42Pct(energyValues[i], lang)}`,
            ),
            hoverinfo: 'text',
            hoverlabel: {
                bgcolor: '#ffffff',
                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
            },
        }),
        [lang, categoryLabelsFull, energyValues, selectedPoints],
    );

    const allTrace = useMemo(
        () => ({
            type: 'bar',
            name: getText('page42_legend_all', lang),
            x: CATEGORY_KEYS,
            y: allValues,
            marker: {
                color: CATEGORY_KEYS.map((_, index) =>
                    selectedPoints === null
                        ? COLORS.all
                        : hexToRgba(COLORS.all, selectedPoints[1]?.includes(index) ? 1 : 0.3),
                ),
            },
            hovertext: CATEGORY_KEYS.map(
                (key, i) =>
                    `<b>${categoryLabelsFull[i]}</b><br>${getText('page42_legend_all', lang)}: ${formatPage42Pct(allValues[i], lang)}`,
            ),
            hoverinfo: 'text',
            hoverlabel: {
                bgcolor: '#ffffff',
                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
            },
        }),
        [lang, categoryLabelsFull, allValues, selectedPoints],
    );

    const plotLayout = useMemo(
        () => ({
            barmode: 'group',
            bargap: 0.15,
            bargroupgap: 0.08,
            hovermode: 'closest',
            clickmode: 'event',
            dragmode: windowWidth <= 768 ? false : 'zoom',
            xaxis: {
                type: 'category',
                categoryorder: 'array',
                categoryarray: CATEGORY_KEYS,
                tickmode: 'array',
                tickvals: CATEGORY_KEYS,
                ticktext: xTickText,
                showgrid: false,
                zeroline: false,
                tickangle: xTickAngle,
                tickfont: { size: xTickFontSize, family: 'Arial, sans-serif' },
                automargin: false,
            },
            yaxis: {
                range: [0, 100],
                dtick: 10,
                ticksuffix: lang === 'fr' ? ' %' : '%',
                showgrid: false,
                showline: true,
                linewidth: 1,
                linecolor: '#333',
                zeroline: true,
                tickfont: { size: yTickFontSize, family: 'Arial, sans-serif' },
                automargin: true,
            },
            legend: {
                orientation: 'h',
                x: 0,
                xanchor: 'left',
                y: legendSettings.y,
                yanchor: 'top',
                font: { size: legendSettings.fontSize, family: 'Arial, sans-serif' },
                title: { text: '' },
                traceorder: 'normal',
                itemclick: false,
                itemdoubleclick: false,
            },
            annotations: [legendTitleAnnotation],
            showlegend: true,
            margin: { l: 50, r: 20, t: 20, b: legendSettings.margin },
            height: chartHeight,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            autosize: true,
        }),
        [lang, xTickText, xTickAngle, xTickFontSize, yTickFontSize, legendSettings, legendTitleAnnotation, chartHeight, windowWidth],
    );

    useEffect(() => {
        const syncViewport = () => {
            setWindowWidth(window.innerWidth);

            const inner = window.innerWidth;
            const outer = window.outerWidth;
            const dpr = window.devicePixelRatio || 1;

            if (zoomBaselineRef.current == null) {
                zoomBaselineRef.current = { outer, inner, dpr };
            } else {
                const baseline = zoomBaselineRef.current;
                if (Math.abs(outer - baseline.outer) > 64) {
                    zoomBaselineRef.current = { outer, inner, dpr };
                }
            }
            const baseline = zoomBaselineRef.current;
            const outerStable = baseline && Math.abs(outer - baseline.outer) <= 64;

            let cssZoomFactor = 1;
            if (baseline && inner > 0 && baseline.inner > 0 && outerStable) {
                cssZoomFactor = Math.max(baseline.inner / inner, inner / baseline.inner);
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

            setViewportZoom({ pinScale, layoutRatio, cssZoomFactor, screenZoomHint });
        };

        syncViewport();
        window.addEventListener('resize', syncViewport);
        const vv = window.visualViewport;
        vv?.addEventListener('resize', syncViewport);
        vv?.addEventListener('scroll', syncViewport);
        return () => {
            window.removeEventListener('resize', syncViewport);
            vv?.removeEventListener('resize', syncViewport);
            vv?.removeEventListener('scroll', syncViewport);
        };
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

        const timer = setTimeout(setupChartAccessibility, 500);
        const observer = new MutationObserver(setupChartAccessibility);
        observer.observe(chartRef.current, { childList: true, subtree: true });

        return () => {
            clearTimeout(timer);
            observer.disconnect();
        };
    }, [lang]);

    const downloadChartWithTitle = async () => {
        const plotElement = chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;

        try {
            const title = stripHtml(chartTitle);
            const exportTitleX = getLegendTitleX(EXPORT_CHART_WIDTH - EXPORT_MARGIN.l - EXPORT_MARGIN.r);

            await window.Plotly.relayout(plotElement, {
                ...buildLegendRelayout(legendSettings, exportTitleX, legendSettings.margin),
                'xaxis.automargin': false,
                'xaxis.ticktext': categoryTickLabels,
                'xaxis.tickangle': 0,
            });
            await waitForPlotRender();

            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: EXPORT_CHART_WIDTH,
                height: chartHeight,
                scale: 2,
            });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                const titleHeight = 60;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 22px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, canvas.width / 2, 40);
                ctx.drawImage(img, 0, titleHeight);
                const link = document.createElement('a');
                link.download = `${fileSlugBase}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            };
            img.src = imgData;
        } catch (e) {
            console.error(e);
        } finally {
            setPlotResetKey((key) => key + 1);
        }
    };

    const downloadTableAsCSV = () => {
        const headers = [
            getText('page42_table_group', lang),
            getText('page42_table_energy', lang),
            getText('page42_table_all', lang),
        ];
        const rows = CATEGORY_KEYS.map((key, i) => [
            categoryLabelsFull[i],
            PAGE42_DATA[key].energy,
            PAGE42_DATA[key].all,
        ]);
        const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${fileSlugBase}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadTableAsDocx = async () => {
        const title = stripHtml(chartTitle);
        const headers = [
            getText('page42_table_group', lang),
            getText('page42_table_energy', lang),
            getText('page42_table_all', lang),
        ];
        const headerRow = new TableRow({
            children: headers.map(
                (header, index) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: header, bold: true, size: 22 })],
                                alignment: index === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
                            }),
                        ],
                        shading: { fill: 'E6E6E6' },
                    }),
            ),
        });
        const dataRows = CATEGORY_KEYS.map((key, i) =>
            new TableRow({
                children: [
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: categoryLabelsFull[i], size: 22 })],
                            }),
                        ],
                    }),
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: String(PAGE42_DATA[key].energy), size: 22 })],
                                alignment: AlignmentType.CENTER,
                            }),
                        ],
                    }),
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: String(PAGE42_DATA[key].all), size: 22 })],
                                alignment: AlignmentType.CENTER,
                            }),
                        ],
                    }),
                ],
            }),
        );
        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: title, bold: true, size: 28 })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [4800, 2400, 2400],
                            rows: [headerRow, ...dataRows],
                        }),
                    ],
                },
            ],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${fileSlugBase}.docx`);
    };

    const getChartSummary = () => {
        const parts = CATEGORY_KEYS.map(
            (key, i) =>
                `${categoryLabelsFull[i]}: ${getText('page42_legend_energy', lang)} ${formatPage42Pct(energyValues[i], lang)}, ${getText('page42_legend_all', lang)} ${formatPage42Pct(allValues[i], lang)}`,
        ).join('; ');
        return `${stripHtml(chartTitle)}. ${parts}.`;
    };

    const handleChartClick = (data) => {
        if (!data.points || data.points.length === 0) return;
        const clickedPoint = data.points[0];
        const traceIndex = clickedPoint.curveNumber;
        const pointIndex = clickedPoint.pointIndex;

        if (windowWidth <= 768) {
            const currentTime = Date.now();
            const lastClick = lastClickRef.current;
            const isSamePoint = traceIndex === lastClick.traceIndex && pointIndex === lastClick.pointIndex;
            const isDoubleTap = isSamePoint && currentTime - lastClick.time < 300;
            lastClickRef.current = { time: currentTime, traceIndex, pointIndex };
            if (!isDoubleTap) return;
        }

        setSelectedPoints((prev) => {
            if (prev === null) {
                const newSelection = [[], []];
                newSelection[traceIndex].push(pointIndex);
                return newSelection;
            }
            const isSelected = prev[traceIndex]?.includes(pointIndex);
            if (isSelected) {
                const newSelection = prev.map((tracePoints, idx) =>
                    idx === traceIndex ? tracePoints.filter((p) => p !== pointIndex) : [...tracePoints],
                );
                return newSelection.every((arr) => arr.length === 0) ? null : newSelection;
            }
            const newSelection = prev.map((tracePoints, idx) =>
                idx === traceIndex ? [...tracePoints, pointIndex] : [...tracePoints],
            );
            return newSelection;
        });
    };

    const config = {
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d', 'toImage'],
        modeBarButtonsToAdd: [
            {
                name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
                icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
                click: () => downloadChartWithTitle(),
            },
        ],
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-42"
            role="main"
            aria-labelledby="page42-chart-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-42 { width: 100%; }
.page42-container { width: 100%; padding: 15px 0 0 0; display: flex; flex-direction: column; box-sizing: border-box; flex: 1; overflow: visible; }
.page42-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-sizing: border-box;
    overflow: visible;
}
.page42-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 15px 0;
    text-align: center;
    text-transform: none;
}
.page42-chart { width: 100%; height: ${chartHeight}px; position: relative; z-index: 1; }
.page42-table-wrapper { display: block; width: 100%; margin: 20px 0 0 0; }
.page42-table-wrapper details > summary {
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
.page42-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page42-table-wrapper details > summary:hover { background-color: #404040 !important; }
.page42-table-wrapper button[type="button"]:hover,
.page42-chart-frame button[type="button"]:hover { background-color: #404040 !important; }
.page42-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page42-table-scrollbar > div { height: 20px; }
.page42-table-responsive {
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
.page42-table-responsive::-webkit-scrollbar { display: none; }
.page42-table-responsive table { width: max-content; min-width: 100%; border-collapse: collapse; }
.page42-table-responsive th,
.page42-table-responsive td {
    padding: 8px 12px;
    border: 1px solid #ddd;
    font-family: Arial, sans-serif;
    color: var(--gc-text);
    white-space: nowrap;
}
.page42-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.page42-download-buttons button {
    padding: 8px 16px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
@media (max-width: 768px) {
    .page42-chart-title { font-size: 26px; }
}
            `}</style>

            <div className="page42-container">
                <div className="page42-chart-frame">
                    <h1 className="wb-inv">{stripHtml(chartTitle)}</h1>
                    <h2 id="page42-chart-title" className="page42-chart-title">
                        {chartTitle}
                    </h2>

                    <div role="region" aria-label={getChartSummary()} tabIndex="0">
                        {selectedPoints !== null && (
                            <div style={{ marginBottom: 8 }}>
                                <button
                                    type="button"
                                    onClick={() => setSelectedPoints(null)}
                                    style={{
                                        padding: '6px 12px',
                                        backgroundColor: '#8C8C8C',
                                        border: '1px solid #404040',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontFamily: 'Arial, sans-serif',
                                        fontSize: 14,
                                        color: '#fff',
                                    }}
                                >
                                    {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                                </button>
                            </div>
                        )}
                        <figure ref={chartRef} className="page42-chart" style={{ margin: 0, position: 'relative', height: chartHeight }}>
                            <Plot
                                key={`page42-${useVerticalXLabels ? 'v' : 'h'}-${chartHeight}-${lang}-${plotResetKey}`}
                                data={[energyTrace, allTrace]}
                                layout={plotLayout}
                                config={config}
                                style={{ width: '100%', height: '100%' }}
                                useResizeHandler={true}
                                onClick={handleChartClick}
                            />
                        </figure>
                    </div>

                    <div className="page42-table-wrapper">
                        <details onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>
                                    {isTableOpen ? '▼' : '▶'}
                                </span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">
                                    {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                </span>
                            </summary>
                            <div ref={topScrollRef} className="page42-table-scrollbar" aria-hidden="true">
                                <div />
                            </div>
                            <div ref={tableScrollRef} className="page42-table-responsive" role="region" tabIndex="0">
                                <table className="table table-striped table-hover">
                                    <caption className="wb-inv">{getText('page42_table_caption', lang)}</caption>
                                    <thead>
                                        <tr>
                                            <th scope="col" style={{ fontWeight: 'bold' }}>
                                                {getText('page42_table_group', lang)}
                                            </th>
                                            <th scope="col" style={{ fontWeight: 'bold', textAlign: 'center' }}>
                                                {getText('page42_table_energy', lang)}
                                            </th>
                                            <th scope="col" style={{ fontWeight: 'bold', textAlign: 'center' }}>
                                                {getText('page42_table_all', lang)}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {CATEGORY_KEYS.map((key, i) => (
                                            <tr key={key}>
                                                <th scope="row" style={{ fontWeight: 'bold' }}>
                                                    {categoryLabelsFull[i]}
                                                </th>
                                                <td style={{ textAlign: 'center' }} aria-label={`${categoryLabelsFull[i]}, ${getText('page42_table_energy', lang)}: ${formatPage42Pct(PAGE42_DATA[key].energy, lang)}`}>
                                                    {formatPage42Pct(PAGE42_DATA[key].energy, lang)}
                                                </td>
                                                <td style={{ textAlign: 'center' }} aria-label={`${categoryLabelsFull[i]}, ${getText('page42_table_all', lang)}: ${formatPage42Pct(PAGE42_DATA[key].all, lang)}`}>
                                                    {formatPage42Pct(PAGE42_DATA[key].all, lang)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="page42-download-buttons">
                                    <button type="button" onClick={downloadTableAsCSV}>
                                        {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                    </button>
                                    <button type="button" onClick={downloadTableAsDocx}>
                                        {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                    </button>
                                </div>
                            </div>
                            <div ref={bottomScrollRef} className="page42-table-scrollbar" aria-hidden="true">
                                <div />
                            </div>
                        </details>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Page42;
