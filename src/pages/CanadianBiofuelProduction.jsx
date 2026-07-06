import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';

const CHART_START_YEAR = 2020;
const CHART_END_YEAR = 2025;
const CHART_END_MONTH = 10;

const COLORS = { ethanol: '#809276', biodiesel: '#333333' };

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

const PAGE_ZOOM_VERTICAL_TICK_MIN = 3.55;
const PAGE_ZOOM_VERTICAL_TICK_MAX = 5.45;
const LIKELY_OS_DPR_BASES = [1, 1.25, 1.3333333333333333, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5];

const isZoomRatioInVerticalTickBands = (z) =>
    z >= PAGE_ZOOM_VERTICAL_TICK_MIN && z <= PAGE_ZOOM_VERTICAL_TICK_MAX;

const isBrowserZoomInVerticalTickRange = () => {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    return LIKELY_OS_DPR_BASES.some((b) => isZoomRatioInVerticalTickBands(dpr / b));
};

const isPinchScaleInVerticalTickBands = (s) =>
    typeof s === 'number' && s > 1.02 && isZoomRatioInVerticalTickBands(s);

const ethanolValue = (year, month) => {
    if (year === 2020 && month === 4) return 85;
    const seasonal = 20 * Math.sin(((month - 2) / 12) * 2 * Math.PI);
    let base = 128 + seasonal;
    if (year === 2020 && month < 4) base = 152 - month * 5;
    if (year === 2020 && month > 4) base = 118 + seasonal;
    const noise = ((year * 13 + month * 7) % 11) - 5;
    return Math.round(Math.max(78, Math.min(168, base + noise)));
};

const biodieselValue = (year, month) => {
    const seasonal = 6 * Math.sin((month / 12) * 2 * Math.PI);
    if (year < 2024) {
        let base = 38 + seasonal;
        if (year === 2022 && month <= 3) base = 22;
        const noise = ((year * 11 + month * 5) % 9) - 4;
        return Math.round(Math.max(20, Math.min(55, base + noise)));
    }
    const monthsFrom2024 = (year - 2024) * 12 + month;
    let base = 48 + monthsFrom2024 * 1.35 + seasonal * 2;
    const spike = month === 6 ? 15 : month === 3 ? 10 : 0;
    if (year === 2025 && month >= 6) base += 20;
    const noise = ((year * 17 + month * 3) % 13) - 6;
    return Math.round(Math.max(35, Math.min(148, base + spike + noise)));
};

const buildChartData = () => {
    const rows = [];
    for (let year = CHART_START_YEAR; year <= CHART_END_YEAR; year += 1) {
        const lastMonth = year === CHART_END_YEAR ? CHART_END_MONTH : 12;
        for (let month = 1; month <= lastMonth; month += 1) {
            rows.push({
                refDate: year * 100 + month,
                dateIso: `${year}-${String(month).padStart(2, '0')}-15`,
                ethanol: ethanolValue(year, month),
                biodiesel: biodieselValue(year, month),
            });
        }
    }
    return rows;
};

const canadian_biofuel_production_CHART_DATA = buildChartData();

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    }
    return hex;
};

const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const formatMonthRef = (refDate, lang) => {
    const year = Math.floor(refDate / 100);
    const month = refDate % 100;
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString(lang === 'en' ? 'en-CA' : 'fr-CA', { month: 'long', year: 'numeric' });
};

const formatAxisTick = (dateIso, lang) => {
    const d = new Date(dateIso);
    const yy = String(d.getFullYear()).slice(-2);
    if (lang === 'fr') {
        const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juill.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
        return `${months[d.getMonth()]}-${yy}`;
    }
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]}-${yy}`;
};

const CanadianBiofuelProductionPlot = memo(function CanadianBiofuelProductionPlot({
    plotData, plotLayout, chartConfig, plotKey, onChartClick,
}) {
    return (
        <Plot
            key={plotKey}
            data={plotData}
            layout={plotLayout}
            config={chartConfig}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
            onClick={onChartClick}
        />
    );
});

const CanadianBiofuelProduction = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedTraceIds, setSelectedTraceIds] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [xAxisVerticalForPageZoom, setXAxisVerticalForPageZoom] = useState(false);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null });
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const textVars = { startYear: CHART_START_YEAR, endYear: CHART_END_YEAR };

    const ethanolLabel = getText('canadian_biofuel_production_legend_ethanol', lang);
    const biodieselLabel = getText('canadian_biofuel_production_legend_biodiesel', lang);
    const chartTitle = substitute(getText('canadian_biofuel_production_chart_title', lang), textVars);
    const yAxisTitle = getText('canadian_biofuel_production_yaxis', lang);
    const fileTitle = substitute(getText('canadian_biofuel_production_download_title', lang), textVars);
    const tableCaption = substitute(getText('canadian_biofuel_production_table_caption', lang), textVars);

    const tableHeaders = [
        getText('canadian_biofuel_production_table_col_date', lang),
        `${ethanolLabel} (${yAxisTitle})`,
        `${biodieselLabel} (${yAxisTitle})`,
    ];

    const chartData = canadian_biofuel_production_CHART_DATA;
    const tableRowsDesc = useMemo(() => [...chartData].reverse(), [chartData]);

    const xDates = useMemo(() => chartData.map((row) => row.dateIso), [chartData]);
    const ethanolValues = useMemo(() => chartData.map((row) => row.ethanol), [chartData]);
    const biodieselValues = useMemo(() => chartData.map((row) => row.biodiesel), [chartData]);

    const tickVals = useMemo(() => xDates, [xDates]);
    const tickText = useMemo(
        () => chartData.map((row, index) => {
            const month = row.refDate % 100;
            if (month === 1 || month === 4 || month === 7 || month === 10) {
                return formatAxisTick(xDates[index], lang);
            }
            return '';
        }),
        [chartData, xDates, lang],
    );

    const formatVolume = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const plotHeight = windowWidth <= 480 ? 320 : windowWidth <= 768 ? 360 : 400;
    const plotTopMargin = windowWidth <= 480 ? 20 : 16;
    const plotBottomMarginHorizontal = windowWidth <= 480 ? 88 : windowWidth <= 768 ? 78 : 68;
    const plotBottomMarginVertical = windowWidth <= 480 ? 148 : windowWidth <= 768 ? 128 : 108;
    const useVerticalXTicks = xAxisVerticalForPageZoom || windowWidth <= 480;
    const plotBottomMargin = useVerticalXTicks ? plotBottomMarginVertical : plotBottomMarginHorizontal;
    const plotKey = `canadian-biofuel-production-${plotHeight}-${useVerticalXTicks ? 'v' : 'h'}`;
    const tickFont = { size: windowWidth <= 480 ? 11 : windowWidth <= 768 ? 12 : 13, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 15 : 16, family: 'Arial, sans-serif', color: '#58585a' };

    useEffect(() => {
        const syncViewport = () => {
            setWindowWidth(window.innerWidth);
            const s = window.visualViewport?.scale ?? 1;
            const pinchVertical = isPinchScaleInVerticalTickBands(s);
            setXAxisVerticalForPageZoom(pinchVertical || isBrowserZoomInVerticalTickRange());
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
                    btn.onkeydown = (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            btn.click();
                        }
                    };
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
    }, [lang, selectedTraceIds]);

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

    const handleChartClick = useCallback((event) => {
        if (!event?.points?.length) return;
        const traceIndex = event.points[0].curveNumber;
        if (traceIndex !== 0 && traceIndex !== 1) return;

        if (windowWidth <= 768) {
            const now = Date.now();
            const last = lastClickRef.current;
            const isDoubleTap = traceIndex === last.traceIndex && now - last.time < 300;
            lastClickRef.current = { time: now, traceIndex };
            if (!isDoubleTap) return;
        }

        setSelectedTraceIds((prev) => {
            if (prev === null) return [traceIndex];
            if (prev.includes(traceIndex)) {
                const next = prev.filter((t) => t !== traceIndex);
                return next.length === 0 ? null : next;
            }
            return [...prev, traceIndex];
        });
    }, [windowWidth]);

    const ethanolFocused = selectedTraceIds === null || selectedTraceIds.includes(0);
    const biodieselFocused = selectedTraceIds === null || selectedTraceIds.includes(1);

    const ethanolHoverTemplates = chartData.map(
        (row) => `<b>${ethanolLabel}</b><br>${formatMonthRef(row.refDate, lang)}: ${formatVolume(row.ethanol)}<extra></extra>`,
    );
    const biodieselHoverTemplates = chartData.map(
        (row) => `<b>${biodieselLabel}</b><br>${formatMonthRef(row.refDate, lang)}: ${formatVolume(row.biodiesel)}<extra></extra>`,
    );

    const plotData = [
        {
            x: xDates,
            y: ethanolValues,
            type: 'scatter',
            mode: 'lines',
            name: ethanolLabel,
            line: {
                color: ethanolFocused ? COLORS.ethanol : hexToRgba(COLORS.ethanol, 0.3),
                width: 2.5,
            },
            hovertemplate: ethanolHoverTemplates,
            hoveron: 'points',
        },
        {
            x: xDates,
            y: biodieselValues,
            type: 'scatter',
            mode: 'lines',
            name: biodieselLabel,
            line: {
                color: biodieselFocused ? COLORS.biodiesel : hexToRgba(COLORS.biodiesel, 0.3),
                width: 2.5,
            },
            hovertemplate: biodieselHoverTemplates,
            hoveron: 'points',
        },
    ];

    const downloadChartPng = async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        const title = stripHtml(chartTitle);
        try {
            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 1200,
                height: 700,
                scale: 2,
            });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                const titleHeight = 100;
                const legendHeight = 56;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight + legendHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 36px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, canvas.width / 2, 48);
                ctx.drawImage(img, 0, titleHeight);
                const legendY = titleHeight + img.height + 36;
                const legendItems = [
                    { color: COLORS.biodiesel, label: biodieselLabel },
                    { color: COLORS.ethanol, label: ethanolLabel },
                ];
                const totalWidth = legendItems.reduce((acc, item) => acc + ctx.measureText(item.label).width + 56, 0) + 40;
                let x = (canvas.width - totalWidth) / 2;
                ctx.font = '24px Arial';
                ctx.textAlign = 'left';
                legendItems.forEach((item) => {
                    ctx.strokeStyle = item.color;
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.moveTo(x, legendY);
                    ctx.lineTo(x + 28, legendY);
                    ctx.stroke();
                    ctx.fillStyle = '#333333';
                    ctx.fillText(item.label, x + 36, legendY + 6);
                    x += ctx.measureText(item.label).width + 56;
                });
                canvas.toBlob((blob) => {
                    if (blob) saveAs(blob, `${fileTitle}.png`);
                });
            };
            img.src = imgData;
        } catch {
            /* ignore export errors */
        }
    };

    const downloadCsv = () => {
        const header = tableHeaders.map(csvEscape).join(',');
        const rows = tableRowsDesc.map((row) => [
            formatMonthRef(row.refDate, lang),
            row.ethanol,
            row.biodiesel,
        ].map(csvEscape).join(','));
        saveAs(new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' }), `${fileTitle}.csv`);
    };

    const downloadDocx = async () => {
        const headerRow = new TableRow({
            children: tableHeaders.map(
                (header) =>
                    new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({ text: header, bold: true, size: 22 })],
                            alignment: AlignmentType.CENTER,
                        })],
                        shading: { fill: 'E6E6E6' },
                    }),
            ),
        });
        const dataRows = tableRowsDesc.map((row) =>
            new TableRow({
                children: [
                    formatMonthRef(row.refDate, lang),
                    formatVolume(row.ethanol),
                    formatVolume(row.biodiesel),
                ].map((value, index) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: String(value), size: 22 })],
                                alignment: index === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
                            }),
                        ],
                    }),
                ),
            }),
        );
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: stripHtml(chartTitle), bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [3200, 2800, 3200],
                        rows: [headerRow, ...dataRows],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), `${fileTitle}.docx`);
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

    const useStackedLayout = isTableOpen || windowWidth <= 1200;

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-93"
            role="main"
            aria-labelledby="canadian-biofuel-production-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-93.page-content { max-width: none !important; overflow-x: visible !important; }
.page-93 {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.canadian-biofuel-production-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.canadian-biofuel-production-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 20px 0;
    line-height: 1.25;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: none;
}
.canadian-biofuel-production-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.canadian-biofuel-production-content-row {
    display: flex;
    flex-direction: row;
    width: 100%;
    gap: 32px;
    align-items: flex-start;
}
.canadian-biofuel-production-text-column {
    width: 42%;
    min-width: 260px;
    padding-top: 8px;
    box-sizing: border-box;
}
.canadian-biofuel-production-chart-column {
    width: 58%;
    min-width: 0;
}
.canadian-biofuel-production-bullet {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
    margin-bottom: 16px;
}
.canadian-biofuel-production-bullet-list {
    list-style-type: disc;
    padding-left: 24px;
    margin: 0;
}
.canadian-biofuel-production-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    box-sizing: border-box;
}
.canadian-biofuel-production-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    line-height: 1.2;
    margin: 0 0 12px 0;
    text-align: center;
    text-transform: none;
}
.canadian-biofuel-production-chart { width: 100%; min-width: 0; height: ${plotHeight}px; position: relative; }
.canadian-biofuel-production-chart > div { width: 100%; height: 100%; }
.canadian-biofuel-production-legend {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 18px 28px;
    flex-wrap: wrap;
    margin-top: 12px;
    margin-bottom: 4px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: var(--gc-text);
}
.canadian-biofuel-production-legend-item { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.canadian-biofuel-production-legend-line { width: 28px; height: 0; border-top: 3px solid; display: inline-block; }
.canadian-biofuel-production-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.canadian-biofuel-production-download-buttons button:hover,
.page-93 .data-table-wrapper summary:hover,
.page-93 .data-table-wrapper button:hover { background-color: #404040 !important; }
.page-93 .data-table-wrapper { padding-top: 5px; margin-top: 20px; width: 100%; box-sizing: border-box; }
.page-93 .data-table-wrapper summary {
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
.page-93 .data-table-wrapper summary::-webkit-details-marker { display: none; }
.canadian-biofuel-production-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.canadian-biofuel-production-table-scrollbar > div { height: 20px; }
.layout-stacked.canadian-biofuel-production-content-row { flex-direction: column !important; }
.layout-stacked .canadian-biofuel-production-text-column,
.layout-stacked .canadian-biofuel-production-chart-column { width: 100% !important; min-width: 0 !important; }
.layout-stacked .canadian-biofuel-production-text-column { padding-top: 0; margin-bottom: 24px; }
@media (max-width: 1200px) {
    .canadian-biofuel-production-content-row { flex-direction: column; }
    .canadian-biofuel-production-text-column,
    .canadian-biofuel-production-chart-column { width: 100%; }
    .canadian-biofuel-production-text-column { padding-top: 0; margin-bottom: 24px; }
}
@media (max-width: 768px) {
    .canadian-biofuel-production-title { font-size: 37px; }
    .canadian-biofuel-production-chart-title { font-size: 26px; }
    .canadian-biofuel-production-bullet { font-size: 18px; }
}
@media (max-width: 480px) {
    .canadian-biofuel-production-title { font-size: 28px; }
}
            `}</style>
            <div className="canadian-biofuel-production-inner">
                <h1 id="canadian-biofuel-production-title" className="canadian-biofuel-production-title">{getText('canadian_biofuel_production_title', lang)}</h1>

                <div className={`canadian-biofuel-production-content-row ${useStackedLayout ? 'layout-stacked' : ''}`}>
                    <aside className="canadian-biofuel-production-text-column" aria-label={getText('canadian_biofuel_production_text_aria', lang)}>
                        <ul className="canadian-biofuel-production-bullet-list">
                            <li className="canadian-biofuel-production-bullet">
                                {getText('canadian_biofuel_production_bullet1_part1', lang)}
                                <strong>{getText('canadian_biofuel_production_bullet1_part2', lang)}</strong>
                            </li>
                            <li className="canadian-biofuel-production-bullet">
                                {getText('canadian_biofuel_production_bullet2_part1', lang)}
                                <strong>{getText('canadian_biofuel_production_bullet2_part2', lang)}</strong>
                                {getText('canadian_biofuel_production_bullet2_part3', lang)}
                                <strong>{getText('canadian_biofuel_production_bullet2_part4', lang)}</strong>
                                {getText('canadian_biofuel_production_bullet2_part5', lang)}
                            </li>
                            <li className="canadian-biofuel-production-bullet">
                                {getText('canadian_biofuel_production_bullet3_part1', lang)}
                                <strong>{getText('canadian_biofuel_production_bullet3_part2', lang)}</strong>
                                {getText('canadian_biofuel_production_bullet3_part3', lang)}
                            </li>
                            <li className="canadian-biofuel-production-bullet">
                                {getText('canadian_biofuel_production_bullet4_part1', lang)}
                                <strong>{getText('canadian_biofuel_production_bullet4_part2', lang)}</strong>
                                {getText('canadian_biofuel_production_bullet4_part3', lang)}
                            </li>
                        </ul>
                    </aside>

                    <div className="canadian-biofuel-production-chart-column">
                        <div className="canadian-biofuel-production-chart-frame">
                            <h2 id="canadian-biofuel-production-chart-title" className="canadian-biofuel-production-chart-title">{chartTitle}</h2>

                            {selectedTraceIds !== null && (
                                <div style={{ marginBottom: 8 }}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTraceIds(null)}
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

                            <figure
                                ref={chartRef}
                                className="canadian-biofuel-production-chart"
                                role="region"
                                aria-label={getText('canadian_biofuel_production_chart_aria', lang)}
                                tabIndex={0}
                                style={{ margin: 0 }}
                            >
                                <CanadianBiofuelProductionPlot
                                    plotKey={plotKey}
                                    plotData={plotData}
                                    plotLayout={{
                                        showlegend: false,
                                        hovermode: 'closest',
                                        hoverlabel: HOVER_LABEL,
                                        clickmode: 'event',
                                        dragmode: false,
                                        margin: { t: plotTopMargin, b: plotBottomMargin, l: 72, r: 24 },
                                        paper_bgcolor: 'rgba(0,0,0,0)',
                                        plot_bgcolor: 'rgba(0,0,0,0)',
                                        autosize: true,
                                        xaxis: {
                                            type: 'date',
                                            tickmode: 'array',
                                            tickvals: tickVals,
                                            ticktext: tickText,
                                            tickangle: useVerticalXTicks ? 90 : -45,
                                            tickfont: tickFont,
                                            ticks: 'inside',
                                            ticklen: 4,
                                            tickwidth: 1,
                                            tickcolor: '#333333',
                                            showgrid: false,
                                            showline: true,
                                            linewidth: 1,
                                            linecolor: '#333',
                                            automargin: true,
                                            fixedrange: true,
                                        },
                                        yaxis: {
                                            title: { text: yAxisTitle, font: axisTitleFont, standoff: 12 },
                                            range: [0, 180],
                                            dtick: 20,
                                            tickfont: tickFont,
                                            showgrid: false,
                                            showline: true,
                                            linewidth: 1,
                                            linecolor: '#333',
                                            zeroline: false,
                                            automargin: true,
                                            fixedrange: true,
                                        },
                                    }}
                                    chartConfig={{
                                        displayModeBar: true,
                                        displaylogo: false,
                                        responsive: true,
                                        scrollZoom: false,
                                        modeBarButtonsToRemove: MODEBAR_REMOVE,
                                        modeBarButtonsToAdd: [{
                                            name: getText('canadian_biofuel_production_download_png', lang),
                                            icon: {
                                                width: 24,
                                                height: 24,
                                                path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z',
                                            },
                                            click: (gd) => downloadChartPng(gd),
                                        }],
                                    }}
                                    plotHeight={plotHeight}
                                    onChartClick={handleChartClick}
                                />
                            </figure>

                            <div className="canadian-biofuel-production-legend" aria-hidden="true">
                                <span className="canadian-biofuel-production-legend-item">
                                    <span className="canadian-biofuel-production-legend-line" style={{ borderColor: COLORS.biodiesel }} />
                                    {biodieselLabel}
                                </span>
                                <span className="canadian-biofuel-production-legend-item">
                                    <span className="canadian-biofuel-production-legend-line" style={{ borderColor: COLORS.ethanol }} />
                                    {ethanolLabel}
                                </span>
                            </div>

                            <details className="data-table-wrapper" onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                                <summary role="button" aria-expanded={isTableOpen}>
                                    <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                    {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                    <span className="wb-inv">
                                        {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                    </span>
                                </summary>
                                <div ref={topScrollRef} className="canadian-biofuel-production-table-scrollbar" aria-hidden="true"><div /></div>
                                <div
                                    ref={tableScrollRef}
                                    className="table-responsive"
                                    role="region"
                                    aria-label={lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                    tabIndex={0}
                                >
                                    <table className="table table-bordered table-striped table-hover">
                                        <caption className="wb-inv">{tableCaption}</caption>
                                        <thead>
                                            <tr>
                                                {tableHeaders.map((header, index) => (
                                                    <th
                                                        key={header}
                                                        scope="col"
                                                        style={{
                                                            fontWeight: 'bold',
                                                            textAlign: 'center',
                                                            whiteSpace: 'nowrap',
                                                            verticalAlign: 'bottom',
                                                            ...(index === 0
                                                                ? {
                                                                    position: 'sticky',
                                                                    left: 0,
                                                                    backgroundColor: '#f8f9fa',
                                                                    zIndex: 2,
                                                                    borderRight: '2px solid #dee2e6',
                                                                }
                                                                : {}),
                                                        }}
                                                    >
                                                        {header}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tableRowsDesc.map((row) => (
                                                <tr key={row.refDate}>
                                                    <th
                                                        scope="row"
                                                        style={{
                                                            position: 'sticky',
                                                            left: 0,
                                                            zIndex: 1,
                                                            fontWeight: 'bold',
                                                            textAlign: 'left',
                                                            whiteSpace: 'nowrap',
                                                            borderRight: '2px solid #dee2e6',
                                                        }}
                                                    >
                                                        {formatMonthRef(row.refDate, lang)}
                                                    </th>
                                                    <td style={{ textAlign: 'right' }}>{formatVolume(row.ethanol)}</td>
                                                    <td style={{ textAlign: 'right' }}>{formatVolume(row.biodiesel)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div ref={bottomScrollRef} className="canadian-biofuel-production-table-scrollbar" aria-hidden="true"><div /></div>
                                <div className="canadian-biofuel-production-download-buttons">
                                    <button type="button" onClick={downloadCsv} style={downloadBtnStyle}>
                                        {getText('canadian_biofuel_production_download_csv', lang)}
                                    </button>
                                    <button type="button" onClick={downloadDocx} style={downloadBtnStyle}>
                                        {getText('canadian_biofuel_production_download_docx', lang)}
                                    </button>
                                </div>
                            </details>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default CanadianBiofuelProduction;
