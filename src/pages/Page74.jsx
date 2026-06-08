import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';

const TRACE_KEYS = ['hydro', 'wind', 'solarTidal', 'biomass'];

const COLORS = {
    hydro: '#2B5C3F',
    wind: '#5E9348',
    solarTidal: '#C4D56E',
    biomass: '#6D91B3',
};

const PAGE74_DATA = [
    { year: 2011, hydro: 75500, wind: 5200, solarTidal: 600, biomass: 2700 },
    { year: 2012, hydro: 75500, wind: 6300, solarTidal: 800, biomass: 2700 },
    { year: 2013, hydro: 76000, wind: 7800, solarTidal: 1200, biomass: 2700 },
    { year: 2014, hydro: 78500, wind: 9700, solarTidal: 1800, biomass: 2700 },
    { year: 2015, hydro: 79200, wind: 11200, solarTidal: 2300, biomass: 2700 },
    { year: 2016, hydro: 80400, wind: 11900, solarTidal: 2700, biomass: 2700 },
    { year: 2017, hydro: 81000, wind: 12600, solarTidal: 2900, biomass: 2700 },
    { year: 2018, hydro: 81400, wind: 12800, solarTidal: 3100, biomass: 2700 },
    { year: 2019, hydro: 81400, wind: 13400, solarTidal: 3300, biomass: 2700 },
    { year: 2020, hydro: 81400, wind: 13600, solarTidal: 3300, biomass: 2700 },
    { year: 2021, hydro: 82300, wind: 14300, solarTidal: 3900, biomass: 2700 },
    { year: 2022, hydro: 82300, wind: 15300, solarTidal: 4400, biomass: 2700 },
    { year: 2023, hydro: 83200, wind: 16000, solarTidal: 5500, biomass: 2700 },
];

const START_YEAR = PAGE74_DATA[0].year;
const END_YEAR = PAGE74_DATA[PAGE74_DATA.length - 1].year;
const TRACE_COUNT = TRACE_KEYS.length;

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    }
    return hex;
};

const Page74 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');
    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const formatMw = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const hoverUnit = getText('page74_hover_unit', lang);
    const tableUnitSuffix = getText('page74_table_unit', lang);

    const formatHoverMw = (value) => {
        const formatted = formatMw(value);
        return formatted === '—' ? formatted : `${formatted}${hoverUnit}`;
    };

    const years = PAGE74_DATA.map((row) => row.year);
    const yearTicks = years.filter((y) => y % 2 === 1);
    const tableRowsDesc = useMemo(() => [...PAGE74_DATA].reverse(), []);

    const hydroLabel = getText('page74_legend_hydro', lang);
    const windLabel = getText('page74_legend_wind', lang);
    const solarTidalLabel = getText('page74_legend_solarTidal', lang);
    const biomassLabel = getText('page74_legend_biomass', lang);
    const chartTitle = getText('page74_chart_title', lang);
    const yAxisTitle = getText('page74_yaxis', lang);
    const fileTitle = `${getText('page74_download_title', lang)} ${START_YEAR}-${END_YEAR}`;

    const tableHeaders = [
        getText('page74_table_col_year', lang),
        `${hydroLabel} ${tableUnitSuffix}`,
        `${windLabel} ${tableUnitSuffix}`,
        `${solarTidalLabel} ${tableUnitSuffix}`,
        `${biomassLabel} ${tableUnitSuffix}`,
        `${getText('page74_table_col_total', lang)} ${tableUnitSuffix}`,
    ];

    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 72 : windowWidth <= 768 ? 62 : 50;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    const hydroValues = PAGE74_DATA.map((row) => row.hydro);
    const windValues = PAGE74_DATA.map((row) => row.wind);
    const solarTidalValues = PAGE74_DATA.map((row) => row.solarTidal);
    const biomassValues = PAGE74_DATA.map((row) => row.biomass);

    const seriesFillFor = (traceIndex, baseColor) =>
        years.map((_, i) =>
            hexToRgba(baseColor, selectedPoints === null || selectedPoints[traceIndex]?.includes(i) ? 0.85 : 0.25),
        );

    const seriesLineFor = (traceIndex, baseColor) =>
        years.map((_, i) =>
            hexToRgba(baseColor, selectedPoints === null || selectedPoints[traceIndex]?.includes(i) ? 1 : 0.25),
        );

    const buildHoverTexts = (label, values) =>
        years.map((yearValue, i) => `<b>${label}</b><br>${yearValue}: ${formatHoverMw(values[i])}<extra></extra>`);

    const hydroHoverTexts = buildHoverTexts(hydroLabel, hydroValues);
    const windHoverTexts = buildHoverTexts(windLabel, windValues);
    const solarTidalHoverTexts = buildHoverTexts(solarTidalLabel, solarTidalValues);
    const biomassHoverTexts = buildHoverTexts(biomassLabel, biomassValues);

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
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
            if (traceIndex === undefined || traceIndex < 0 || traceIndex >= TRACE_COUNT) return;
            if (pointIndex === undefined || pointIndex < 0) return;

            if (windowWidth <= 768) {
                const currentTime = Date.now();
                const lastClick = lastClickRef.current;
                const isSamePoint =
                    traceIndex === lastClick.traceIndex &&
                    pointIndex === lastClick.pointIndex &&
                    lastClick.traceIndex != null;
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

    const downloadChartPng = async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        const title = `${stripHtml(chartTitle)} (${START_YEAR}–${END_YEAR})`;
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
                const legendItems = TRACE_KEYS.map((key) => ({
                    color: COLORS[key],
                    label: getText(`page74_legend_${key}`, lang),
                }));
                const totalWidth = legendItems.length * 260;
                let x = (canvas.width - totalWidth) / 2 + 20;
                ctx.font = '24px Arial';
                ctx.textAlign = 'left';
                legendItems.forEach((item) => {
                    ctx.fillStyle = item.color;
                    ctx.fillRect(x, legendY - 10, 24, 24);
                    ctx.fillStyle = '#333333';
                    ctx.fillText(item.label, x + 32, legendY + 6);
                    x += 260;
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
        const rows = tableRowsDesc.map((row) => {
            const total = row.hydro + row.wind + row.solarTidal + row.biomass;
            return [row.year, row.hydro, row.wind, row.solarTidal, row.biomass, total].map(csvEscape).join(',');
        });
        saveAs(new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' }), `${fileTitle}.csv`);
    };

    const downloadDocx = async () => {
        const headerRow = new TableRow({
            children: tableHeaders.map(
                (header) =>
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 22 })], alignment: AlignmentType.CENTER })],
                        shading: { fill: 'E6E6E6' },
                    }),
            ),
        });
        const dataRows = tableRowsDesc.map((row) => {
            const total = row.hydro + row.wind + row.solarTidal + row.biomass;
            return new TableRow({
                children: [row.year, row.hydro, row.wind, row.solarTidal, row.biomass, total].map((value, index) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: String(value), size: 22 })],
                                alignment: index === 0 ? AlignmentType.CENTER : AlignmentType.RIGHT,
                            }),
                        ],
                    }),
                ),
            });
        });
        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: `${stripHtml(chartTitle)} (${START_YEAR}–${END_YEAR})`, bold: true, size: 28 })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [1200, 1700, 1700, 2200, 1500, 1500],
                            rows: [headerRow, ...dataRows],
                        }),
                    ],
                },
            ],
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

    const plotData = [
        {
            x: years,
            y: hydroValues,
            name: hydroLabel,
            type: 'scatter',
            mode: 'lines',
            line: { color: seriesLineFor(0, COLORS.hydro), width: 0.5 },
            fill: 'tozeroy',
            fillcolor: seriesFillFor(0, COLORS.hydro),
            stackgroup: 'capacity',
            hoveron: 'points',
            hovertemplate: hydroHoverTexts,
        },
        {
            x: years,
            y: windValues,
            name: windLabel,
            type: 'scatter',
            mode: 'lines',
            line: { color: seriesLineFor(1, COLORS.wind), width: 0.5 },
            fill: 'tonexty',
            fillcolor: seriesFillFor(1, COLORS.wind),
            stackgroup: 'capacity',
            hoveron: 'points',
            hovertemplate: windHoverTexts,
        },
        {
            x: years,
            y: solarTidalValues,
            name: solarTidalLabel,
            type: 'scatter',
            mode: 'lines',
            line: { color: seriesLineFor(2, COLORS.solarTidal), width: 0.5 },
            fill: 'tonexty',
            fillcolor: seriesFillFor(2, COLORS.solarTidal),
            stackgroup: 'capacity',
            hoveron: 'points',
            hovertemplate: solarTidalHoverTexts,
        },
        {
            x: years,
            y: biomassValues,
            name: biomassLabel,
            type: 'scatter',
            mode: 'lines',
            line: { color: seriesLineFor(3, COLORS.biomass), width: 0.5 },
            fill: 'tonexty',
            fillcolor: seriesFillFor(3, COLORS.biomass),
            stackgroup: 'capacity',
            hoveron: 'points',
            hovertemplate: biomassHoverTexts,
        },
    ];

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-74"
            role="main"
            aria-labelledby="page74-chart-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-74.page-content { max-width: none !important; overflow-x: visible !important; }
.page-74 {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.page74-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.page74-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-top: 0;
    margin-bottom: 0;
    box-sizing: border-box;
    overflow: visible;
}
.page74-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
}
.page74-chart { width: 100%; min-width: 0; height: ${plotHeight}px; position: relative; }
.page74-chart > div { width: 100%; height: 100%; }
.page74-legend {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 18px 28px;
    flex-wrap: wrap;
    margin-top: 12px;
    margin-bottom: 8px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: var(--gc-text);
}
.page74-legend-item { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.page74-legend-swatch { width: 22px; height: 14px; display: inline-block; border: 1px solid rgba(0, 0, 0, 0.12); }
.page74-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.page74-download-buttons button:hover,
.page-74 .data-table-wrapper summary:hover,
.page-74 .data-table-wrapper button:hover { background-color: #404040 !important; }
.page-74 .data-table-wrapper { padding-top: 5px; margin-top: 20px; width: 100%; box-sizing: border-box; }
.page-74 .data-table-wrapper summary {
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
.page-74 .data-table-wrapper summary::-webkit-details-marker { display: none; }
.page74-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page74-table-scrollbar > div { height: 20px; }
@media (max-width: 768px) {
    .page74-chart-title { font-size: 26px; }
}
            `}</style>

            <div className="page74-inner">
                <div className="page74-chart-frame">
                    <h2 id="page74-chart-title" className="page74-chart-title">{chartTitle}</h2>

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

                    <figure ref={chartRef} className="page74-chart" role="region" aria-label={chartTitle} tabIndex={0} style={{ margin: 0 }}>
                        <Plot
                            key={`page74-${selectedPoints ? selectedPoints.map((arr) => arr.join('-')).join('_') : 'all'}-${plotHeight}`}
                            data={plotData}
                            layout={{
                                showlegend: false,
                                hoverlabel: {
                                    bgcolor: '#ffffff',
                                    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
                                },
                                hovermode: 'closest',
                                hoverdistance: 40,
                                clickmode: 'event',
                                dragmode: false,
                                margin: { t: plotTopMargin, b: plotBottomMargin, l: 72, r: 24 },
                                paper_bgcolor: 'rgba(0,0,0,0)',
                                plot_bgcolor: 'rgba(0,0,0,0)',
                                autosize: true,
                                xaxis: {
                                    tickvals: yearTicks,
                                    ticktext: yearTicks.map(String),
                                    tickfont: tickFont,
                                    showgrid: false,
                                    showline: true,
                                    linewidth: 1,
                                    linecolor: '#333',
                                    automargin: true,
                                    fixedrange: true,
                                },
                                yaxis: {
                                    title: { text: yAxisTitle, font: axisTitleFont, standoff: 12 },
                                    tickvals: [0, 20000, 40000, 60000, 80000, 100000],
                                    ticktext: [0, 20000, 40000, 60000, 80000, 100000].map((v) => formatMw(v)),
                                    range: [0, 110000],
                                    tickfont: tickFont,
                                    showgrid: true,
                                    gridcolor: '#e0e0e0',
                                    showline: true,
                                    linewidth: 1,
                                    linecolor: '#333',
                                    zeroline: false,
                                    automargin: true,
                                    fixedrange: true,
                                },
                            }}
                            config={{
                                displayModeBar: true,
                                displaylogo: false,
                                responsive: true,
                                scrollZoom: false,
                                modeBarButtonsToRemove: [
                                    'pan2d',
                                    'select2d',
                                    'lasso2d',
                                    'zoom2d',
                                    'zoomIn2d',
                                    'zoomOut2d',
                                    'autoScale2d',
                                    'resetScale2d',
                                    'toImage',
                                ],
                                modeBarButtonsToAdd: [{
                                    name: getText('page74_download_png', lang),
                                    icon: {
                                        width: 24,
                                        height: 24,
                                        path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z',
                                    },
                                    click: (gd) => downloadChartPng(gd),
                                }],
                            }}
                            style={{ width: '100%', height: '100%' }}
                            useResizeHandler
                            onClick={handleChartClick}
                        />
                    </figure>

                    <div className="page74-legend" aria-hidden="true">
                        {TRACE_KEYS.map((key) => (
                            <span key={key} className="page74-legend-item">
                                <span className="page74-legend-swatch" style={{ backgroundColor: COLORS[key] }} />
                                {getText(`page74_legend_${key}`, lang)}
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
                        <div ref={topScrollRef} className="page74-table-scrollbar" aria-hidden="true"><div /></div>
                        <div
                            ref={tableScrollRef}
                            className="table-responsive"
                            role="region"
                            aria-label={lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                            tabIndex={0}
                        >
                            <table className="table table-bordered table-striped table-hover">
                                <caption className="wb-inv">{getText('page74_table_caption', lang)}</caption>
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
                                    {tableRowsDesc.map((row) => {
                                        const total = row.hydro + row.wind + row.solarTidal + row.biomass;
                                        return (
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
                                                <td style={{ textAlign: 'right' }}>{formatMw(row.hydro)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatMw(row.wind)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatMw(row.solarTidal)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatMw(row.biomass)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatMw(total)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div ref={bottomScrollRef} className="page74-table-scrollbar" aria-hidden="true"><div /></div>
                        <div className="page74-download-buttons">
                            <button type="button" onClick={downloadCsv} style={downloadBtnStyle}>
                                {getText('page74_download_csv', lang)}
                            </button>
                            <button type="button" onClick={downloadDocx} style={downloadBtnStyle}>
                                {getText('page74_download_docx', lang)}
                            </button>
                        </div>
                    </details>
                </div>
            </div>
        </main>
    );
};

export default Page74;
