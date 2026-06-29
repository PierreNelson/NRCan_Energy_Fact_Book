import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';

const START_YEAR = 2000;
const END_YEAR = 2024;

const TRACE_KEYS = [
    'passengerCars',
    'passengerLightTrucks',
    'passengerAviation',
    'freightTrucks',
    'freightAviation',
    'other',
];

const COLORS = {
    passengerCars: '#2B5C3F',
    passengerLightTrucks: '#5E9348',
    passengerAviation: '#84962C',
    freightTrucks: '#657f9b',
    freightAviation: '#4b4c4d',
    other: '#DF790C',
};

const MODEBAR_REMOVE = [
    'pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d',
    'autoScale2d', 'resetScale2d', 'toImage', 'hoverClosestCartesian',
    'hoverCompareCartesian', 'toggleSpikelines',
];

const HOVER_LABEL = {
    bgcolor: '#ffffff',
    bordercolor: '#000000',
    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
};

/** Hardcoded until data pipeline is available — approximates page 97 reference trends. */
const buildPage97Data = () => {
    const rows = [];
    for (let year = START_YEAR; year <= END_YEAR; year += 1) {
        const progress = (year - START_YEAR) / (END_YEAR - START_YEAR);
        let total;
        if (year <= 2019) {
            total = Math.round(141 + ((year - START_YEAR) / 19) * 29);
        } else if (year === 2020) {
            total = 145;
        } else if (year === 2021) {
            total = 148;
        } else if (year === 2022) {
            total = 151;
        } else if (year === 2023) {
            total = 153;
        } else {
            total = 155;
        }

        const passScale = year === 2020 ? 0.84 : year === 2021 ? 0.9 : year >= 2022 ? 0.94 + (year - 2022) * 0.02 : 1;

        const passengerCars = Math.round(total * (0.44 - progress * 0.13) * passScale);
        const passengerLightTrucks = Math.round(total * (0.16 + progress * 0.12) * passScale);
        const passengerAviation = Math.round(total * (0.08 - progress * 0.01) * passScale);
        const freightTrucks = Math.round(total * (0.17 + progress * 0.06));
        const freightAviation = Math.round(total * (0.06 + progress * 0.015));
        let other = total - passengerCars - passengerLightTrucks - passengerAviation - freightTrucks - freightAviation;
        if (other < 3) other = 3;

        rows.push({
            year,
            passengerCars,
            passengerLightTrucks,
            passengerAviation,
            freightTrucks,
            freightAviation,
            other,
        });
    }
    return rows;
};

const PAGE97_CHART_DATA = buildPage97Data();

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const markerOpacityFor = (selectedPoints, length, traceIndex) => {
    if (selectedPoints === null) return 1;
    return Array.from({ length }, (_, i) => (selectedPoints[traceIndex]?.includes(i) ? 1 : 0.3));
};

const rowTotal = (row) => TRACE_KEYS.reduce((sum, key) => sum + (row[key] ?? 0), 0);

const Page97Plot = memo(function Page97Plot({
    plotData, plotLayout, chartConfig, plotHeight, onPlotReady,
}) {
    return (
        <Plot
            key={`page97-${plotHeight}`}
            data={plotData}
            layout={plotLayout}
            config={chartConfig}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
            onInitialized={onPlotReady}
            onUpdate={onPlotReady}
        />
    );
});

const Page97 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
    const clickHandlerRef = useRef(null);
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const textVars = { startYear: START_YEAR, endYear: END_YEAR };

    const formatMt = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const hoverUnit = ' Mt';

    const tableRows = PAGE97_CHART_DATA;
    const years = useMemo(() => tableRows.map((row) => row.year), [tableRows]);
    const yearTicks = useMemo(() => years.filter((y) => y % 2 === 0), [years]);
    const tableRowsDesc = useMemo(() => [...tableRows].reverse(), [tableRows]);

    const chartTitle = substitute(getText('page97_chart_title', lang), textVars);
    const yAxisTitle = getText('page97_yaxis', lang);
    const fileTitle = `${getText('page97_download_title', lang)}_${START_YEAR}-${END_YEAR}`;
    const tableCaption = substitute(getText('page97_table_caption', lang), textVars);
    const tableUnitSuffix = getText('page97_table_unit', lang);

    const legendLabel = (key) => getText(`page97_legend_${key}`, lang);

    const tableHeaders = [
        getText('page97_table_col_year', lang),
        ...TRACE_KEYS.map((key) => `${legendLabel(key)} ${tableUnitSuffix}`),
        `${getText('page97_table_col_total', lang)} ${tableUnitSuffix}`,
    ];

    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 72 : windowWidth <= 768 ? 62 : 50;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        if (!chartRef.current) return undefined;
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
    }, [lang, selectedPoints]);

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

    const handleChartClick = useCallback(
        (data) => {
            if (!data?.points?.length) return;
            const traceIndex = data.points[0].curveNumber;
            const pointIndex = data.points[0].pointIndex;
            if (traceIndex == null || traceIndex < 0 || traceIndex >= TRACE_KEYS.length) return;
            if (pointIndex == null || pointIndex < 0) return;

            if (windowWidth <= 768) {
                const currentTime = Date.now();
                const lastClick = lastClickRef.current;
                const isSamePoint =
                    traceIndex === lastClick.traceIndex
                    && pointIndex === lastClick.pointIndex
                    && lastClick.traceIndex != null;
                const isDoubleTap = isSamePoint && currentTime - lastClick.time < 300;
                lastClickRef.current = { time: currentTime, traceIndex, pointIndex };
                if (!isDoubleTap) return;
            }

            setSelectedPoints((prev) => {
                if (prev === null) {
                    const newSelection = TRACE_KEYS.map(() => []);
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
        },
        [windowWidth],
    );

    useEffect(() => {
        clickHandlerRef.current = handleChartClick;
    }, [handleChartClick]);

    const bindPlotHandlers = useCallback((graphDiv) => {
        if (!graphDiv?.on) return;
        if (graphDiv._page97Click) {
            graphDiv.removeListener('plotly_click', graphDiv._page97Click);
        }
        const clickHandler = (event) => clickHandlerRef.current?.(event);
        graphDiv._page97Click = clickHandler;
        graphDiv.on('plotly_click', clickHandler);
    }, []);

    const onPlotReady = useCallback(
        (_figure, graphDiv) => bindPlotHandlers(graphDiv),
        [bindPlotHandlers],
    );

    const downloadChartPng = useCallback(async (plotEl = null) => {
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
                const legendHeight = 110;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight + legendHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 36px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, canvas.width / 2, 48);
                ctx.drawImage(img, 0, titleHeight);
                const legendItems = TRACE_KEYS.map((key) => ({
                    color: COLORS[key],
                    label: legendLabel(key),
                }));
                const colCount = 3;
                const colWidth = canvas.width / colCount;
                ctx.font = '20px Arial';
                ctx.textAlign = 'left';
                legendItems.forEach((item, index) => {
                    const col = index % colCount;
                    const row = Math.floor(index / colCount);
                    const x = col * colWidth + 40;
                    const y = titleHeight + img.height + 36 + row * 36;
                    ctx.fillStyle = item.color;
                    ctx.fillRect(x, y - 12, 24, 16);
                    ctx.fillStyle = '#333333';
                    ctx.fillText(item.label, x + 32, y);
                });
                canvas.toBlob((blob) => {
                    if (blob) saveAs(blob, `${fileTitle}.png`);
                });
            };
            img.src = imgData;
        } catch {
            /* ignore export errors */
        }
    }, [chartTitle, fileTitle, legendLabel]);

    const downloadCsv = () => {
        const header = tableHeaders.map(csvEscape).join(',');
        const rows = tableRowsDesc.map((row) => {
            const cells = [row.year, ...TRACE_KEYS.map((key) => row[key]), rowTotal(row)];
            return cells.map(csvEscape).join(',');
        });
        saveAs(new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' }), `${fileTitle}.csv`);
    };

    const downloadDocx = async () => {
        const headerRow = new TableRow({
            children: tableHeaders.map(
                (header) => new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 22 })], alignment: AlignmentType.CENTER })],
                    shading: { fill: 'E6E6E6' },
                }),
            ),
        });
        const dataRows = tableRowsDesc.map((row) => new TableRow({
            children: [row.year, ...TRACE_KEYS.map((key) => row[key]), rowTotal(row)].map((value, index) =>
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: String(value), size: 22 })],
                            alignment: index === 0 ? AlignmentType.CENTER : AlignmentType.RIGHT,
                        }),
                    ],
                }),
            ),
        }));
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
                        columnWidths: [900, 1500, 1800, 2200, 1500, 2000, 1100, 1200],
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

    const plotData = TRACE_KEYS.map((key, traceIndex) => {
        const label = legendLabel(key);
        const values = tableRows.map((row) => row[key]);
        return {
            x: years,
            y: values,
            name: label,
            type: 'bar',
            marker: {
                color: COLORS[key],
                opacity: markerOpacityFor(selectedPoints, values.length, traceIndex),
                line: { width: 0 },
            },
            hovertemplate: values.map(
                (value, i) => `<b>${label}</b><br>${years[i]}: ${formatMt(value)}${hoverUnit}<extra></extra>`,
            ),
            hoverlabel: HOVER_LABEL,
        };
    });

    const chartConfig = useMemo(() => ({
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        modeBarButtonsToRemove: MODEBAR_REMOVE,
        modeBarButtonsToAdd: [{
            name: getText('page97_download_png', lang),
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: (gd) => downloadChartPng(gd),
        }],
    }), [lang, downloadChartPng]);

    const plotLayout = {
        barmode: 'stack',
        showlegend: false,
        hoverlabel: HOVER_LABEL,
        hovermode: 'closest',
        clickmode: 'event',
        dragmode: false,
        margin: { t: plotTopMargin, b: plotBottomMargin, l: 72, r: 20 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        autosize: true,
        bargap: 0.15,
        xaxis: {
            type: 'category',
            tickmode: 'array',
            tickvals: yearTicks,
            ticktext: yearTicks.map(String),
            tickfont: tickFont,
            automargin: true,
            fixedrange: true,
        },
        yaxis: {
            title: { text: yAxisTitle, font: axisTitleFont, standoff: 12 },
            range: [0, 200],
            dtick: 50,
            tickfont: tickFont,
            automargin: true,
            fixedrange: true,
        },
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-97"
            role="main"
            aria-labelledby="page97-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-97.page-content { max-width: none !important; overflow-x: visible !important; }
.page-97 {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.page97-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.page97-title {
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
.page97-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.page97-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-top: 0;
    margin-bottom: 0;
    box-sizing: border-box;
    overflow: visible;
}
.page97-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
}
.page97-chart { width: 100%; min-width: 0; height: ${plotHeight}px; position: relative; }
.page97-chart > div { width: 100%; height: 100%; }
.page97-legend {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 28px;
    margin: 12px auto 8px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: var(--gc-text);
}
.page97-legend-item { display: inline-flex; align-items: flex-start; gap: 8px; line-height: 1.3; }
.page97-legend-swatch { width: 22px; height: 14px; flex-shrink: 0; margin-top: 2px; display: inline-block; border: 1px solid rgba(0, 0, 0, 0.12); }
.page97-bullet {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: #332f30;
    margin: 28px 0 0 0;
    padding-left: 1.25rem;
    line-height: 1.45;
}
.page97-bullet li { margin: 0; }
.page97-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.page97-download-buttons button:hover,
.page-97 .data-table-wrapper summary:hover,
.page-97 .data-table-wrapper button:hover { background-color: #404040 !important; }
.page-97 .data-table-wrapper { padding-top: 5px; margin-top: 20px; width: 100%; box-sizing: border-box; }
.page-97 .data-table-wrapper summary {
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
.page-97 .data-table-wrapper summary::-webkit-details-marker { display: none; }
.page97-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page97-table-scrollbar > div { height: 20px; }
@media (max-width: 768px) {
    .page97-title { font-size: 37px; }
    .page97-chart-title { font-size: 26px; }
    .page97-bullet { font-size: 18px; }
    .page97-legend { grid-template-columns: 1fr; max-width: 100%; }
}
            `}</style>

            <div className="page97-inner">
                <h1 id="page97-title" className="page97-title">{getText('page97_title', lang)}</h1>

                <div className="page97-chart-frame">
                    <h2 id="page97-chart-title" className="page97-chart-title">{chartTitle}</h2>

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

                    <figure ref={chartRef} className="page97-chart" role="region" aria-label={getText('page97_chart_aria', lang)} tabIndex={0} style={{ margin: 0 }}>
                        <Page97Plot
                            plotData={plotData}
                            plotLayout={plotLayout}
                            chartConfig={chartConfig}
                            plotHeight={plotHeight}
                            onPlotReady={onPlotReady}
                        />
                    </figure>

                    <div className="page97-legend" aria-hidden="true">
                        {TRACE_KEYS.map((key) => (
                            <span key={key} className="page97-legend-item">
                                <span className="page97-legend-swatch" style={{ backgroundColor: COLORS[key] }} />
                                {legendLabel(key)}
                            </span>
                        ))}
                    </div>

                    <details className="data-table-wrapper" onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                        <summary role="button" aria-expanded={isTableOpen}>
                            <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                            {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                            <span className="wb-inv">
                                {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                            </span>
                        </summary>
                        <div ref={topScrollRef} className="page97-table-scrollbar" aria-hidden="true"><div /></div>
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
                                        <tr key={row.year}>
                                            <th
                                                scope="row"
                                                style={{
                                                    position: 'sticky',
                                                    left: 0,
                                                    zIndex: 1,
                                                    fontWeight: 'bold',
                                                    textAlign: 'center',
                                                    borderRight: '2px solid #dee2e6',
                                                }}
                                            >
                                                {row.year}
                                            </th>
                                            {TRACE_KEYS.map((key) => (
                                                <td key={key} style={{ textAlign: 'right' }}>{formatMt(row[key])}</td>
                                            ))}
                                            <td style={{ textAlign: 'right' }}>{formatMt(rowTotal(row))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div ref={bottomScrollRef} className="page97-table-scrollbar" aria-hidden="true"><div /></div>
                        <div className="page97-download-buttons">
                            <button type="button" onClick={downloadCsv} style={downloadBtnStyle}>
                                {getText('page97_download_csv', lang)}
                            </button>
                            <button type="button" onClick={downloadDocx} style={downloadBtnStyle}>
                                {getText('page97_download_docx', lang)}
                            </button>
                        </div>
                    </details>
                </div>

                <ul className="page97-bullet" aria-label={getText('page97_bullet_aria', lang)}>
                    <li>
                        <strong>{getText('page97_bullet_bold1', lang)}</strong>
                        {getText('page97_bullet_part1', lang)}
                        <strong>{getText('page97_bullet_bold2', lang)}</strong>
                        {getText('page97_bullet_part2', lang)}
                    </li>
                </ul>
            </div>
        </main>
    );
};

export default Page97;
