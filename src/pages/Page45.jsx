import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const COUNTRY_KEYS = ['canada', 'france', 'germany', 'italy', 'uk', 'usa'];

const PAGE45_DATA = {
    canada: { gasoline: 1.3, electricity: 130, naturalGas: 30 },
    france: { gasoline: 2.3, electricity: 360, naturalGas: 170 },
    germany: { gasoline: 2.1, electricity: 480, naturalGas: 160 },
    italy: { gasoline: 2.5, electricity: 490, naturalGas: 200 },
    uk: { gasoline: 1.8, electricity: 390, naturalGas: 100 },
    usa: { gasoline: 0.9, electricity: 140, naturalGas: 40 },
};

const COLORS = {
    gasoline: '#8C8C8C',
    electricity: '#1B99BB',
    naturalGas: '#9f346d',
};

const EXPORT_CHART_WIDTH = 1100;

/** Vertical country ticks from ~200% page zoom (Ctrl+/pinch), matching GHG emissions sector and spotlight pattern. */
const PAGE45_VERTICAL_TICK_ZOOM = 2.0;
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
        return z >= PAGE45_VERTICAL_TICK_ZOOM && z <= 6.0;
    });
}

const Page45 = () => {
    const { lang } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [viewportZoom, setViewportZoom] = useState(createInitialViewportZoom);
    const zoomBaselineRef = useRef(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState(null);
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

    const formatGasoline = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
        });
    };

    const formatMwh = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        });
    };

    const fileSlugBase = getText('page45_download_title', lang).replace(/\s+/g, '_');
    const chartTitle = getText('page45_chart_title', lang);
    const pageTitleLine1 = getText('page45_title_line1', lang);
    const pageTitleLine2 = getText('page45_title_line2', lang);
    const pageTitleFull = `${stripHtml(pageTitleLine1)} ${stripHtml(pageTitleLine2)}`;

    const countryLabels = useMemo(
        () => COUNTRY_KEYS.map((key) => getText(`page45_country_${key}`, lang)),
        [lang],
    );

    const legendGasoline = getText('page45_legend_gasoline', lang);
    const legendElectricity = getText('page45_legend_electricity', lang);
    const legendNaturalGas = getText('page45_legend_natural_gas', lang);
    const yLeftLabel = getText('page45_yaxis_left', lang);
    const yRightLabel = getText('page45_yaxis_right', lang);

    const gasolineValues = useMemo(() => COUNTRY_KEYS.map((key) => PAGE45_DATA[key].gasoline), []);
    const electricityValues = useMemo(() => COUNTRY_KEYS.map((key) => PAGE45_DATA[key].electricity), []);
    const naturalGasValues = useMemo(() => COUNTRY_KEYS.map((key) => PAGE45_DATA[key].naturalGas), []);

    const pageZoomForLayout = Math.max(
        viewportZoom.pinScale,
        viewportZoom.layoutRatio,
        viewportZoom.cssZoomFactor,
        viewportZoom.screenZoomHint,
    );
    const pinVertical =
        viewportZoom.pinScale > 1.02 && viewportZoom.pinScale >= PAGE45_VERTICAL_TICK_ZOOM;
    const useVerticalXLabels =
        pageZoomForLayout >= PAGE45_VERTICAL_TICK_ZOOM ||
        pinVertical ||
        isBrowserZoomInVerticalTickRange();
    const xTickAngle = useVerticalXLabels ? 90 : 0;
    const xTickFontSize = useVerticalXLabels
        ? windowWidth <= 480
            ? 12
            : 13
        : windowWidth <= 480
          ? 12
          : 14;
    const yTickFontSize = windowWidth <= 480 ? 9 : 11;
    const axisTitleFontSize = 16;
    const chartHeight = useVerticalXLabels
        ? windowWidth <= 768
            ? 560
            : 580
        : windowWidth <= 768
          ? 480
          : 540;
    const plotBottomMargin = useVerticalXLabels
        ? windowWidth <= 768
            ? 120
            : 100
        : windowWidth <= 768
          ? 70
          : 60;

    const traceOpacity = (traceIndex, pointIndex) => {
        if (selectedPoints === null) return 1;
        return selectedPoints[traceIndex]?.includes(pointIndex) ? 1 : 0.3;
    };

    const markerColors = (traceIndex, baseColor) =>
        COUNTRY_KEYS.map((_, index) =>
            selectedPoints === null ? baseColor : hexToRgba(baseColor, traceOpacity(traceIndex, index)),
        );

    const gasolineTrace = {
        type: 'bar',
        name: legendGasoline,
        x: COUNTRY_KEYS,
        y: gasolineValues,
        marker: { color: markerColors(0, COLORS.gasoline) },
        yaxis: 'y',
        hovertext: COUNTRY_KEYS.map(
            (_, i) => `<b>${countryLabels[i]}</b><br>${legendGasoline}: ${formatGasoline(gasolineValues[i])}`,
        ),
        hoverinfo: 'text',
        hoverlabel: {
            bgcolor: '#ffffff',
            font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
        },
    };

    const electricityTrace = {
        type: 'bar',
        name: legendElectricity,
        x: COUNTRY_KEYS,
        y: electricityValues,
        marker: { color: markerColors(1, COLORS.electricity) },
        yaxis: 'y2',
        hovertext: COUNTRY_KEYS.map(
            (_, i) => `<b>${countryLabels[i]}</b><br>${legendElectricity}: ${formatMwh(electricityValues[i])}`,
        ),
        hoverinfo: 'text',
        hoverlabel: {
            bgcolor: '#ffffff',
            font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
        },
    };

    const naturalGasTrace = {
        type: 'bar',
        name: legendNaturalGas,
        x: COUNTRY_KEYS,
        y: naturalGasValues,
        marker: { color: markerColors(2, COLORS.naturalGas) },
        yaxis: 'y2',
        hovertext: COUNTRY_KEYS.map(
            (_, i) => `<b>${countryLabels[i]}</b><br>${legendNaturalGas}: ${formatMwh(naturalGasValues[i])}`,
        ),
        hoverinfo: 'text',
        hoverlabel: {
            bgcolor: '#ffffff',
            font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
        },
    };

    const plotLayout = useMemo(
        () => {
            const axisTitleFont = { size: axisTitleFontSize, family: 'Arial, sans-serif', color: '#333' };
            return {
            barmode: 'group',
            bargap: 0.15,
            bargroupgap: 0.08,
            hovermode: 'closest',
            clickmode: 'event',
            dragmode: windowWidth <= 768 ? false : 'zoom',
            showlegend: false,
            xaxis: {
                type: 'category',
                categoryorder: 'array',
                categoryarray: COUNTRY_KEYS,
                tickmode: 'array',
                tickvals: COUNTRY_KEYS,
                ticktext: countryLabels,
                showgrid: false,
                zeroline: false,
                tickangle: xTickAngle,
                tickfont: { size: xTickFontSize, family: 'Arial, sans-serif' },
                automargin: true,
            },
            yaxis: {
                title: { text: yLeftLabel, font: axisTitleFont, standoff: 8 },
                range: [0, 2.6],
                dtick: 0.2,
                showgrid: false,
                showline: true,
                linewidth: 1,
                linecolor: '#333',
                zeroline: true,
                tickfont: { size: yTickFontSize, family: 'Arial, sans-serif' },
                automargin: true,
                side: 'left',
            },
            yaxis2: {
                title: { text: yRightLabel, font: axisTitleFont, standoff: 8 },
                range: [0, 600],
                dtick: 100,
                overlaying: 'y',
                side: 'right',
                showgrid: false,
                showline: true,
                linewidth: 1,
                linecolor: '#333',
                zeroline: false,
                tickfont: { size: yTickFontSize, family: 'Arial, sans-serif' },
                automargin: true,
            },
            margin: {
                l: windowWidth <= 480 ? 52 : 64,
                r: windowWidth <= 480 ? 52 : 64,
                t: 20,
                b: plotBottomMargin,
            },
            height: chartHeight,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            autosize: true,
        };
        },
        [countryLabels, xTickAngle, xTickFontSize, yTickFontSize, axisTitleFontSize, yLeftLabel, yRightLabel, chartHeight, plotBottomMargin, windowWidth],
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

    const drawLegendOnCanvas = (ctx, startX, legendY, fontSize) => {
        const items = [
            { label: legendGasoline, color: COLORS.gasoline },
            { label: legendElectricity, color: COLORS.electricity },
            { label: legendNaturalGas, color: COLORS.naturalGas },
        ];
        let xPos = startX;
        ctx.font = `${fontSize}px Arial`;
        items.forEach((item, index) => {
            ctx.fillStyle = item.color;
            ctx.fillRect(xPos, legendY - 8, 22, 14);
            ctx.fillStyle = '#333333';
            ctx.textAlign = 'left';
            ctx.fillText(item.label, xPos + 30, legendY + 4);
            xPos += 30 + ctx.measureText(item.label).width + (index < items.length - 1 ? 36 : 0);
        });
    };

    const downloadChartWithTitle = async () => {
        const plotElement = chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;

        try {
            const title = stripHtml(chartTitle);
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
                const legendHeight = 52;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight + legendHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 22px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, canvas.width / 2, 40);
                ctx.drawImage(img, 0, titleHeight);
                drawLegendOnCanvas(ctx, 64, titleHeight + img.height + 30, 18);
                const link = document.createElement('a');
                link.download = `${fileSlugBase}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            };
            img.src = imgData;
        } catch (e) {
            console.error(e);
        }
    };

    const downloadTableAsCSV = () => {
        const headers = [
            getText('page45_table_country', lang),
            getText('page45_table_gasoline', lang),
            getText('page45_table_electricity', lang),
            getText('page45_table_natural_gas', lang),
        ];
        const rows = COUNTRY_KEYS.map((key, i) => [
            countryLabels[i],
            PAGE45_DATA[key].gasoline,
            PAGE45_DATA[key].electricity,
            PAGE45_DATA[key].naturalGas,
        ]);
        const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${fileSlugBase}.csv`);
    };

    const downloadTableAsDocx = async () => {
        const title = stripHtml(chartTitle);
        const headers = [
            getText('page45_table_country', lang),
            getText('page45_table_gasoline', lang),
            getText('page45_table_electricity', lang),
            getText('page45_table_natural_gas', lang),
        ];
        const headerRow = new TableRow({
            children: headers.map(
                (header) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: header, bold: true, size: 18 })],
                                alignment: AlignmentType.CENTER,
                            }),
                        ],
                        shading: { fill: 'E6E6E6' },
                    }),
            ),
        });
        const dataRows = COUNTRY_KEYS.map((key, i) =>
            new TableRow({
                children: [
                    countryLabels[i],
                    formatGasoline(PAGE45_DATA[key].gasoline),
                    formatMwh(PAGE45_DATA[key].electricity),
                    formatMwh(PAGE45_DATA[key].naturalGas),
                ].map((text, colIndex) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: String(text), size: 18 })],
                                alignment: colIndex === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
                            }),
                        ],
                    }),
                ),
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
                            columnWidths: [3200, 2400, 2400, 2400],
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
        const parts = COUNTRY_KEYS.map((key, i) => {
            const data = PAGE45_DATA[key];
            return `${countryLabels[i]}: ${legendGasoline} ${formatGasoline(data.gasoline)}, ${legendElectricity} ${formatMwh(data.electricity)}, ${legendNaturalGas} ${formatMwh(data.naturalGas)}`;
        }).join('; ');
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
                const newSelection = [[], [], []];
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
            return prev.map((tracePoints, idx) =>
                idx === traceIndex ? [...tracePoints, pointIndex] : [...tracePoints],
            );
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
            className="page-content page-45"
            role="main"
            aria-labelledby="page45-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-45 { width: 100%; }
.page45-container { width: 100%; padding: 15px 0 0 0; display: flex; flex-direction: column; box-sizing: border-box; flex: 1; overflow: visible; }
.page45-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    line-height: 1.2;
    margin: 0 0 20px 0;
}
.page45-title-line1 {
    display: block;
    color: var(--gc-text);
    position: relative;
    padding-bottom: 0.5em;
}
.page45-title-line1::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.page45-title-line2 {
    display: block;
    color: #a0346e;
}
.page45-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-sizing: border-box;
    overflow: visible;
}
.page45-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 15px 0;
    text-align: center;
}
.page45-chart { width: 100%; position: relative; }
.page45-legend {
    display: flex;
    justify-content: flex-start;
    margin-top: 12px;
    margin-bottom: 4px;
    font-family: 'Noto Sans', sans-serif;
    padding: 0 4px;
}
.page45-legend-inner {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 36px;
    justify-content: flex-start;
}
.page45-legend-item {
    display: flex;
    align-items: center;
    gap: 10px;
}
.page45-legend-swatch {
    width: 22px;
    height: 14px;
    flex-shrink: 0;
}
.page45-legend-label {
    font-size: 16px;
    color: var(--gc-text);
}
.page45-table-wrapper { display: block; width: 100%; margin: 20px 0 0 0; }
.page45-table-wrapper details > summary {
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
.page45-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page45-table-wrapper details > summary:hover { background-color: #404040 !important; }
.page45-table-wrapper button[type="button"]:hover,
.page45-chart-frame button[type="button"]:hover { background-color: #404040 !important; }
.page45-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page45-table-scrollbar > div { height: 20px; }
.page45-table-responsive {
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
.page45-table-responsive::-webkit-scrollbar { display: none; }
.page45-table-responsive table { width: max-content; min-width: 100%; border-collapse: collapse; }
.page45-table-responsive th,
.page45-table-responsive td {
    padding: 8px 12px;
    border: 1px solid #ddd;
    font-family: Arial, sans-serif;
    color: var(--gc-text);
    white-space: nowrap;
}
.page45-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.page45-download-buttons button {
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
    .page45-title { font-size: 37px; margin-bottom: 16px; }
    .page45-chart-title { font-size: 26px; }
    .page45-legend-label { font-size: 14px; }
}
            `}</style>

            <div className="page45-container">
                <header role="region" aria-label={pageTitleFull}>
                    <h1 id="page45-title" className="page45-title">
                        <span className="page45-title-line1">{pageTitleLine1}</span>
                        <span className="page45-title-line2">{pageTitleLine2}</span>
                    </h1>
                </header>

                <div className="page45-chart-frame">
                    <h2 className="page45-chart-title">{chartTitle}</h2>

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
                        <figure ref={chartRef} className="page45-chart" style={{ margin: 0, height: chartHeight }}>
                            <Plot
                                key={`page45-${useVerticalXLabels ? 'v' : 'h'}-${chartHeight}-${lang}`}
                                data={[gasolineTrace, electricityTrace, naturalGasTrace]}
                                layout={plotLayout}
                                config={config}
                                style={{ width: '100%', height: '100%' }}
                                useResizeHandler={true}
                                onClick={handleChartClick}
                            />
                        </figure>
                    </div>

                    <div className="page45-legend" aria-hidden="true">
                        <div className="page45-legend-inner">
                            <div className="page45-legend-item">
                                <span className="page45-legend-swatch" style={{ backgroundColor: COLORS.gasoline }} />
                                <span className="page45-legend-label">{legendGasoline}</span>
                            </div>
                            <div className="page45-legend-item">
                                <span className="page45-legend-swatch" style={{ backgroundColor: COLORS.electricity }} />
                                <span className="page45-legend-label">{legendElectricity}</span>
                            </div>
                            <div className="page45-legend-item">
                                <span className="page45-legend-swatch" style={{ backgroundColor: COLORS.naturalGas }} />
                                <span className="page45-legend-label">{legendNaturalGas}</span>
                            </div>
                        </div>
                    </div>

                    <div className="page45-table-wrapper">
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
                            <div ref={topScrollRef} className="page45-table-scrollbar" aria-hidden="true">
                                <div />
                            </div>
                            <div ref={tableScrollRef} className="page45-table-responsive" role="region" tabIndex="0">
                                <table className="table table-striped table-hover">
                                    <caption className="wb-inv">{getText('page45_table_caption', lang)}</caption>
                                    <thead>
                                        <tr>
                                            <th scope="col" style={{ fontWeight: 'bold' }}>
                                                {getText('page45_table_country', lang)}
                                            </th>
                                            <th scope="col" style={{ fontWeight: 'bold', textAlign: 'center' }}>
                                                {getText('page45_table_gasoline', lang)}
                                            </th>
                                            <th scope="col" style={{ fontWeight: 'bold', textAlign: 'center' }}>
                                                {getText('page45_table_electricity', lang)}
                                            </th>
                                            <th scope="col" style={{ fontWeight: 'bold', textAlign: 'center' }}>
                                                {getText('page45_table_natural_gas', lang)}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {COUNTRY_KEYS.map((key, i) => (
                                            <tr key={key}>
                                                <th scope="row" style={{ fontWeight: 'bold' }}>
                                                    {countryLabels[i]}
                                                </th>
                                                <td style={{ textAlign: 'center' }}>
                                                    {formatGasoline(PAGE45_DATA[key].gasoline)}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {formatMwh(PAGE45_DATA[key].electricity)}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {formatMwh(PAGE45_DATA[key].naturalGas)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="page45-download-buttons">
                                    <button type="button" onClick={downloadTableAsCSV}>
                                        {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                    </button>
                                    <button type="button" onClick={downloadTableAsDocx}>
                                        {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                    </button>
                                </div>
                            </div>
                            <div ref={bottomScrollRef} className="page45-table-scrollbar" aria-hidden="true">
                                <div />
                            </div>
                        </details>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Page45;
