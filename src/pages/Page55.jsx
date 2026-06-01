import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import Page55IntensityInfographic from '../components/Page55IntensityInfographic';

const PAGE55_DATA = [
    { year: 2000, perCapita: 100, perGdp: 100 },
    { year: 2001, perCapita: 96, perGdp: 95 },
    { year: 2002, perCapita: 98, perGdp: 96 },
    { year: 2003, perCapita: 100, perGdp: 96 },
    { year: 2004, perCapita: 101, perGdp: 96 },
    { year: 2005, perCapita: 99, perGdp: 92 },
    { year: 2006, perCapita: 97, perGdp: 89 },
    { year: 2007, perCapita: 101, perGdp: 91 },
    { year: 2008, perCapita: 98, perGdp: 89 },
    { year: 2009, perCapita: 94, perGdp: 89 },
    { year: 2010, perCapita: 94, perGdp: 88 },
    { year: 2011, perCapita: 97, perGdp: 88 },
    { year: 2012, perCapita: 96, perGdp: 87 },
    { year: 2013, perCapita: 97, perGdp: 86 },
    { year: 2014, perCapita: 97, perGdp: 85 },
    { year: 2015, perCapita: 96, perGdp: 84 },
    { year: 2016, perCapita: 94, perGdp: 82 },
    { year: 2017, perCapita: 96, perGdp: 82 },
    { year: 2018, perCapita: 99, perGdp: 83 },
    { year: 2019, perCapita: 98, perGdp: 83 },
    { year: 2020, perCapita: 87, perGdp: 78 },
    { year: 2021, perCapita: 89, perGdp: 75 },
    { year: 2022, perCapita: 91, perGdp: 75 },
];

const COLORS = {
    perCapita: '#CE8003',
    perGdp: '#4b4c4d',
};

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    }
    return hex;
};

const Page55 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const chartRef = useRef(null);
    const infographicRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    const formatIndex = (num) => {
        if (num == null || Number.isNaN(Number(num))) return '—';
        return Math.round(Number(num)).toLocaleString(locale);
    };

    const years = useMemo(() => PAGE55_DATA.map((r) => r.year), []);
    const perCapitaValues = useMemo(() => PAGE55_DATA.map((r) => r.perCapita), []);
    const perGdpValues = useMemo(() => PAGE55_DATA.map((r) => r.perGdp), []);
    const tableRowsDesc = useMemo(() => [...PAGE55_DATA].reverse(), []);

    const legendPerCapita = getText('page55_legend_per_capita', lang);
    const legendPerGdp = getText('page55_legend_per_gdp', lang);

    const chartTitle = getText('page55_chart_title', lang);
    const exportChartTitle = stripHtml(chartTitle);
    const chartDownloadSlug = getText('page55_download_title', lang).replace(/\s+/g, '_');

    const yAxisTitle = getText('page55_yaxis', lang);
    const tableHeaders = [
        getText('page106_table_col_year', lang),
        `${legendPerCapita} (${yAxisTitle})`,
        `${legendPerGdp} (${yAxisTitle})`,
    ];

    const xTickvals = years.filter((y) => y % 2 === 0);
    const yTickvals = [70, 80, 90, 100, 110];
    const yTicktext = yTickvals.map((v) => String(v));

    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 62 : windowWidth <= 768 ? 56 : 50;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    const traceHasSelection = (traceIndex) => selectedPoints?.[traceIndex]?.length > 0;

    const markerOpacityFor = (traceIndex, pointIndex) => {
        if (selectedPoints === null) return 1;
        return selectedPoints[traceIndex]?.includes(pointIndex) ? 1 : 0.3;
    };

    const lineColorFor = (traceIndex, baseColor) => {
        if (selectedPoints === null) return baseColor;
        return traceHasSelection(traceIndex) ? baseColor : hexToRgba(baseColor, 0.3);
    };

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

    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        try {
            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 1200,
                height: 640,
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
                ctx.font = 'bold 32px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(exportChartTitle, canvas.width / 2, 48);
                ctx.drawImage(img, 0, titleHeight);
                const legendY = titleHeight + img.height + 36;
                const legendItems = [
                    { color: COLORS.perCapita, label: legendPerCapita },
                    { color: COLORS.perGdp, label: legendPerGdp },
                ];
                ctx.font = '20px Arial';
                ctx.textAlign = 'left';
                const totalLegendWidth =
                    legendItems.reduce((acc, item) => acc + ctx.measureText(item.label).width + 56, 0) + 40;
                let x = (canvas.width - totalLegendWidth) / 2;
                legendItems.forEach((item) => {
                    ctx.strokeStyle = item.color;
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.moveTo(x, legendY);
                    ctx.lineTo(x + 28, legendY);
                    ctx.stroke();
                    ctx.fillStyle = '#333333';
                    ctx.fillText(item.label, x + 36, legendY + 6);
                    x += 36 + ctx.measureText(item.label).width + 40;
                });
                canvas.toBlob((blob) => {
                    if (blob) saveAs(blob, `${chartDownloadSlug}.png`);
                });
            };
            img.src = imgData;
        } catch (err) {
            console.error('Error downloading chart:', err);
        }
    };

    const downloadTableAsCSV = () => {
        const lines = [tableHeaders.map((h) => `"${h.replace(/"/g, '""')}"`).join(',')];
        tableRowsDesc.forEach((row) => {
            lines.push([row.year, row.perCapita, row.perGdp].join(','));
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${chartDownloadSlug}.csv`);
    };

    const downloadTableAsDocx = async () => {
        const headerRow = new TableRow({
            children: tableHeaders.map(
                (cell) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: cell, bold: true, size: 20 })],
                                alignment: AlignmentType.CENTER,
                            }),
                        ],
                        shading: { fill: 'E6E6E6' },
                    }),
            ),
        });
        const dataRows = tableRowsDesc.map(
            (row) =>
                new TableRow({
                    children: [row.year, formatIndex(row.perCapita), formatIndex(row.perGdp)].map((val, index) =>
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: String(val), size: 20 })],
                                    alignment: index === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
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
                            children: [new TextRun({ text: exportChartTitle, bold: true, size: 28 })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [900, 3600, 3600],
                            rows: [headerRow, ...dataRows],
                        }),
                    ],
                },
            ],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${chartDownloadSlug}.docx`);
    };

    const handleChartClick = (event) => {
        if (!event.points?.length) return;
        const traceIndex = event.points[0].curveNumber;
        const pointIndex = event.points[0].pointIndex;
        if (traceIndex === undefined || traceIndex < 0 || traceIndex > 1) return;

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
                const next = [[], []];
                next[traceIndex].push(pointIndex);
                return next;
            }
            const isSelected = prev[traceIndex]?.includes(pointIndex);
            if (isSelected) {
                const next = prev.map((tracePoints, idx) =>
                    idx === traceIndex ? tracePoints.filter((p) => p !== pointIndex) : [...tracePoints],
                );
                return next.every((arr) => arr.length === 0) ? null : next;
            }
            return prev.map((tracePoints, idx) => (idx === traceIndex ? [...tracePoints, pointIndex] : [...tracePoints]));
        });
    };

    const perCapitaHover = years.map(
        (y, i) => `<b>${legendPerCapita}</b><br>${y}: ${formatIndex(perCapitaValues[i])}<extra></extra>`,
    );
    const perGdpHover = years.map(
        (y, i) => `<b>${legendPerGdp}</b><br>${y}: ${formatIndex(perGdpValues[i])}<extra></extra>`,
    );

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-55 page55-intensity-index"
            role="main"
            aria-labelledby="page55-chart-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-55.page55-intensity-index {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.page55-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.page55-infographic-section {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0;
}
.page55-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-top: 8px;
    box-sizing: border-box;
    overflow: visible;
}
.page55-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
}
.page55-chart {
    width: 100%;
    min-width: 0;
    height: ${plotHeight}px;
    position: relative;
}
.page55-chart > div { width: 100%; height: 100%; }
.page55-legend {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 18px 28px;
    margin-top: 12px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: var(--gc-text);
}
.page55-legend-item { display: inline-flex; align-items: center; gap: 8px; }
.page55-legend-line { width: 28px; height: 0; border-top: 3px solid; display: inline-block; }
.page55-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.page55-table-wrapper details > summary {
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
.page55-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page55-table-wrapper details > summary:hover,
.page55-chart-frame button[type="button"]:hover { background-color: #404040 !important; }
.page55-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page55-table-scrollbar > div { height: 20px; }
.page55-table-responsive {
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
.page55-table-responsive::-webkit-scrollbar { display: none; }
.page55-table-responsive table { width: max-content; min-width: 100%; border-collapse: collapse; }
.page55-table-responsive th,
.page55-table-responsive td {
    padding: 8px 12px;
    border: 1px solid #ddd;
    font-family: Arial, sans-serif;
    color: var(--gc-text);
    white-space: nowrap;
}
.page55-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.page55-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.page55-download-buttons button:hover { background: #404040 !important; }
@media (max-width: 768px) {
    .page55-chart-title { font-size: 26px; }
}
@media (max-width: 480px) {
    .page55-chart { height: 320px; }
}
            `}</style>

            <div className="page55-inner">
                <div className="page55-chart-frame">
                    <h2 id="page55-chart-title" className="page55-chart-title">{chartTitle}</h2>

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

                    <figure ref={chartRef} style={{ margin: 0 }}>
                        <div role="region" aria-label={getText('page55_chart_aria', lang)} tabIndex="0">
                            <Plot
                                key={`page55-${selectedPoints ? `${selectedPoints[0].join('-')}_${selectedPoints[1].join('-')}` : 'all'}-${plotHeight}`}
                                data={[
                                    {
                                        x: years,
                                        y: perCapitaValues,
                                        type: 'scatter',
                                        mode: 'lines+markers',
                                        name: legendPerCapita,
                                        line: { color: lineColorFor(0, COLORS.perCapita), width: 2.5 },
                                        marker: {
                                            color: COLORS.perCapita,
                                            size: 8,
                                            opacity: years.map((_, i) => markerOpacityFor(0, i)),
                                        },
                                        hovertemplate: perCapitaHover,
                                    },
                                    {
                                        x: years,
                                        y: perGdpValues,
                                        type: 'scatter',
                                        mode: 'lines+markers',
                                        name: legendPerGdp,
                                        line: { color: lineColorFor(1, COLORS.perGdp), width: 2.5 },
                                        marker: {
                                            color: COLORS.perGdp,
                                            size: 8,
                                            opacity: years.map((_, i) => markerOpacityFor(1, i)),
                                        },
                                        hovertemplate: perGdpHover,
                                    },
                                ]}
                                layout={{
                                    showlegend: false,
                                    clickmode: 'event',
                                    dragmode: false,
                                    hovermode: 'closest',
                                    hoverlabel: {
                                        bgcolor: '#ffffff',
                                        font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
                                    },
                                    margin: { l: 72, r: 24, t: plotTopMargin, b: plotBottomMargin },
                                    paper_bgcolor: 'rgba(0,0,0,0)',
                                    plot_bgcolor: 'rgba(0,0,0,0)',
                                    height: plotHeight,
                                    autosize: true,
                                    xaxis: {
                                        type: 'linear',
                                        tickmode: 'array',
                                        tickvals: xTickvals,
                                        ticktext: xTickvals.map(String),
                                        showgrid: false,
                                        zeroline: false,
                                        showline: true,
                                        linewidth: 1,
                                        linecolor: '#333',
                                        tickfont: tickFont,
                                        automargin: true,
                                    },
                                    yaxis: {
                                        title: { text: yAxisTitle, font: axisTitleFont, standoff: 12 },
                                        range: [70, 110],
                                        tickmode: 'array',
                                        tickvals: yTickvals,
                                        ticktext: yTicktext,
                                        showgrid: true,
                                        gridcolor: '#e0e0e0',
                                        showline: true,
                                        linewidth: 1,
                                        linecolor: '#333',
                                        zeroline: false,
                                        tickfont: tickFont,
                                        automargin: true,
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
                                    modeBarButtonsToAdd: [
                                        {
                                            name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
                                            icon: {
                                                width: 24,
                                                height: 24,
                                                path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z',
                                            },
                                            click: (gd) => downloadChartWithTitle(gd),
                                        },
                                    ],
                                }}
                                className="page55-chart"
                                useResizeHandler
                                onClick={handleChartClick}
                            />
                        </div>
                    </figure>

                    <div className="page55-legend" aria-hidden="true">
                        <div className="page55-legend-item">
                            <span className="page55-legend-line" style={{ borderColor: COLORS.perCapita }} />
                            <span>{legendPerCapita}</span>
                        </div>
                        <div className="page55-legend-item">
                            <span className="page55-legend-line" style={{ borderColor: COLORS.perGdp }} />
                            <span>{legendPerGdp}</span>
                        </div>
                    </div>

                    <div className="page55-table-wrapper">
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
                            <div ref={topScrollRef} className="page55-table-scrollbar" aria-hidden="true">
                                <div />
                            </div>
                            <div ref={tableScrollRef} className="page55-table-responsive" role="region" tabIndex="0">
                                <table className="table table-striped table-hover">
                                    <caption className="wb-inv">{getText('page55_table_caption', lang)}</caption>
                                    <thead>
                                        <tr>
                                            {tableHeaders.map((hdr) => (
                                                <th
                                                    key={hdr}
                                                    scope="col"
                                                    style={{
                                                        fontWeight: 'bold',
                                                        textAlign: hdr === tableHeaders[0] ? 'left' : 'center',
                                                    }}
                                                >
                                                    {hdr}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableRowsDesc.map((row) => (
                                            <tr key={row.year}>
                                                <th scope="row" style={{ fontWeight: 'bold' }}>{row.year}</th>
                                                <td style={{ textAlign: 'center' }}>{formatIndex(row.perCapita)}</td>
                                                <td style={{ textAlign: 'center' }}>{formatIndex(row.perGdp)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="page55-download-buttons">
                                    <button type="button" onClick={downloadTableAsCSV}>
                                        {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                    </button>
                                    <button type="button" onClick={downloadTableAsDocx}>
                                        {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                    </button>
                                </div>
                            </div>
                            <div ref={bottomScrollRef} className="page55-table-scrollbar" aria-hidden="true">
                                <div />
                            </div>
                        </details>
                    </div>
                </div>

                <div className="page55-infographic-section">
                    <Page55IntensityInfographic
                        figureRef={infographicRef}
                        lang={lang}
                        getText={getText}
                        ariaLabel={getText('page55_infographic_aria', lang)}
                    />
                </div>
            </div>
        </main>
    );
};

export default Page55;
