import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const BAR_COLOR = '#4a8eb8';
const LINE_COLOR = '#e07020';

/** Shown on exported PNG/DOCX titles (matches petroleum employment year suffix style). */
const western_canada_gas_well_completions_YEAR_RANGE_SUFFIX = ' (2000-2024)';

const lerpAnchors = (anchors, year) => {
    if (year <= anchors[0][0]) return anchors[0][1];
    if (year >= anchors[anchors.length - 1][0]) return anchors[anchors.length - 1][1];
    for (let i = 0; i < anchors.length - 1; i++) {
        const [y0, v0] = anchors[i];
        const [y1, v1] = anchors[i + 1];
        if (year >= y0 && year <= y1) {
            return v0 + ((year - y0) / (y1 - y0)) * (v1 - v0);
        }
    }
    return anchors[anchors.length - 1][1];
};

const COUNT_ANCHORS = [
    [2000, 9200],
    [2005, 16800],
    [2006, 14800],
    [2008, 7200],
    [2010, 4200],
    [2012, 1350],
    [2014, 2050],
    [2016, 1750],
    [2018, 1550],
    [2020, 1180],
    [2022, 1920],
    [2024, 2050]
];

const DEPTH_ANCHORS = [
    [2000, 1000],
    [2005, 1050],
    [2010, 1700],
    [2012, 1950],
    [2015, 2650],
    [2018, 3450],
    [2021, 4100],
    [2024, 4650]
];

const western_canada_gas_well_completions_DATA = [];
for (let y = 2000; y <= 2024; y++) {
    western_canada_gas_well_completions_DATA.push({
        year: y,
        count: Math.round(lerpAnchors(COUNT_ANCHORS, y)),
        depth: Math.round(lerpAnchors(DEPTH_ANCHORS, y))
    });
}

const WesternCanadaGasWellCompletions = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);

    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    const formatInt = (n) =>
        n == null || Number.isNaN(n)
            ? '\u2014'
            : Math.round(n).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');

    const years = useMemo(() => western_canada_gas_well_completions_DATA.map((d) => d.year), []);
    const counts = useMemo(() => western_canada_gas_well_completions_DATA.map((d) => d.count), []);
    const depths = useMemo(() => western_canada_gas_well_completions_DATA.map((d) => d.depth), []);

    const legendBars = getText('western_canada_gas_well_completions_legend_bars', lang);
    const legendLine = getText('western_canada_gas_well_completions_legend_line', lang);
    const yCount = getText('western_canada_gas_well_completions_yaxis_count', lang);
    const yDepth = getText('western_canada_gas_well_completions_yaxis_depth', lang);

    const fileSlugBase =
        lang === 'en'
            ? 'western_canada_natural_gas_wells_2000-2024'
            : 'puits_gaz_naturel_ouest_canada_2000-2024';

    const plotBottomMargin = windowWidth <= 480 ? 100 : windowWidth <= 768 ? 88 : 72;
    const plotTopMargin = windowWidth <= 480 ? 56 : 48;
    const chartHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 440;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = {
        size: windowWidth <= 768 ? 18 : 22,
        family: 'Arial, sans-serif',
        color: '#58585a'
    };

    const exportTitleWithRange = `${stripHtml(getText('western_canada_gas_well_completions_title', lang))}${western_canada_gas_well_completions_YEAR_RANGE_SUFFIX}`;

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
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
                if (dataTitle && (dataTitle.includes('Download') || /charger/i.test(dataTitle))) {
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
    }, [lang, counts, depths, selectedPoints]);

    useEffect(() => {
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;
        if (!topScroll || !tableScroll) return;
        let isSyncingTop = false;
        let isSyncingTable = false;
        const syncTopToTable = () => {
            if (isSyncingTable) return;
            isSyncingTop = true;
            tableScroll.scrollLeft = topScroll.scrollLeft;
            requestAnimationFrame(() => {
                isSyncingTop = false;
            });
        };
        const syncTableToTop = () => {
            if (isSyncingTop) return;
            isSyncingTable = true;
            topScroll.scrollLeft = tableScroll.scrollLeft;
            requestAnimationFrame(() => {
                isSyncingTable = false;
            });
        };
        const updateTopScrollWidth = () => {
            const table = tableScroll.querySelector('table');
            if (table && topScroll.firstChild) {
                topScroll.firstChild.style.width = `${table.scrollWidth}px`;
            }
        };
        topScroll.addEventListener('scroll', syncTopToTable);
        tableScroll.addEventListener('scroll', syncTableToTop);
        updateTopScrollWidth();
        const resizeObserver = new ResizeObserver(updateTopScrollWidth);
        const table = tableScroll.querySelector('table');
        if (table) resizeObserver.observe(table);
        return () => {
            topScroll.removeEventListener('scroll', syncTopToTable);
            tableScroll.removeEventListener('scroll', syncTableToTop);
            resizeObserver.disconnect();
        };
    }, [isTableOpen]);

    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement) return;
        const title = exportTitleWithRange;
        try {
            if (!window.Plotly) return;
            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 1200,
                height: 700,
                scale: 2
            });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                const titleHeight = 96;
                const legendHeight = 52;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight + legendHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 32px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, canvas.width / 2, 48);
                ctx.drawImage(img, 0, titleHeight);
                const legendY = titleHeight + img.height + 30;
                const items = [
                    { label: legendBars, color: BAR_COLOR, isLine: false },
                    { label: legendLine, color: LINE_COLOR, isLine: true }
                ];
                const totalW =
                    items.reduce((acc, it) => acc + ctx.measureText(it.label).width + 50, 0) + 40;
                let xPos = (canvas.width - totalW) / 2;
                items.forEach((it) => {
                    if (it.isLine) {
                        ctx.strokeStyle = it.color;
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.moveTo(xPos, legendY);
                        ctx.lineTo(xPos + 28, legendY);
                        ctx.stroke();
                    } else {
                        ctx.fillStyle = it.color;
                        ctx.fillRect(xPos, legendY - 8, 24, 14);
                    }
                    ctx.fillStyle = '#333333';
                    ctx.font = '20px Arial';
                    ctx.textAlign = 'left';
                    ctx.fillText(it.label, xPos + 34, legendY + 6);
                    xPos += 34 + ctx.measureText(it.label).width + 36;
                });
                canvas.toBlob((blob) => {
                    if (blob) saveAs(blob, `${fileSlugBase}.png`);
                });
            };
            img.src = imgData;
        } catch (err) {
            console.error('Error downloading chart:', err);
        }
    };

    const downloadTableAsCSV = () => {
        const headers = [
            getText('petroleum_employment_table_col_year', lang),
            getText('western_canada_gas_well_completions_table_col_count', lang),
            getText('western_canada_gas_well_completions_table_col_depth', lang)
        ];
        const rows = western_canada_gas_well_completions_DATA.map((d) => [d.year, d.count, d.depth]);
        const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${fileSlugBase}.csv`);
    };

    const downloadTableAsDocx = async () => {
        const yCol = getText('petroleum_employment_table_col_year', lang);
        const cCol = getText('western_canada_gas_well_completions_table_col_count', lang);
        const dCol = getText('western_canada_gas_well_completions_table_col_depth', lang);
        const headerRow = new TableRow({
            children: [yCol, cCol, dCol].map(
                (h) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: h, bold: true, size: 22 })],
                                alignment: AlignmentType.CENTER
                            })
                        ],
                        shading: { fill: 'E6E6E6' }
                    })
            )
        });
        const dataRows = western_canada_gas_well_completions_DATA.map(
            (d) =>
                new TableRow({
                    children: [
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: String(d.year), size: 22 })],
                                    alignment: AlignmentType.CENTER
                                })
                            ]
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: String(d.count), size: 22 })],
                                    alignment: AlignmentType.CENTER
                                })
                            ]
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: String(d.depth), size: 22 })],
                                    alignment: AlignmentType.CENTER
                                })
                            ]
                        })
                    ]
                })
        );
        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: exportTitleWithRange, bold: true, size: 28 })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 }
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [2000, 3200, 3200],
                            rows: [headerRow, ...dataRows]
                        })
                    ]
                }
            ]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${fileSlugBase}.docx`);
    };

    const countHoverTemplates = years.map(
        (yr, i) => `<b>${legendBars}</b><br>${yr}: ${formatInt(counts[i])}<extra></extra>`
    );
    const depthHoverTemplates = years.map(
        (yr, i) => `<b>${legendLine}</b><br>${yr}: ${formatInt(depths[i])} m<extra></extra>`
    );

    const barMarkerOpacity =
        selectedPoints === null
            ? 1
            : years.map((_, i) => (selectedPoints[0]?.includes(i) ? 1 : 0.3));
    const lineMarkerOpacity =
        selectedPoints === null
            ? 1
            : years.map((_, i) => (selectedPoints[1]?.includes(i) ? 1 : 0.3));
    const lineStrokeOpacity =
        selectedPoints === null || (selectedPoints[1] && selectedPoints[1].length > 0) ? 1 : 0.3;

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-126"
            role="main"
            aria-labelledby="western-canada-gas-well-completions-chart-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
                .page-126.page-content {
                    max-width: none !important;
                    overflow-x: visible !important;
                }
                .page-126 {
                    margin-left: -${layoutPadding?.left || 55}px;
                    margin-right: -${layoutPadding?.right || 15}px;
                    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
                    padding-left: ${layoutPadding?.left || 55}px;
                    padding-right: ${layoutPadding?.right || 15}px;
                }
                .western-canada-gas-well-completions-container {
                    width: 100%;
                    padding: 15px 0 40px 0;
                    box-sizing: border-box;
                }
                .western-canada-gas-well-completions-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 24px;
                    box-sizing: border-box;
                    overflow: visible;
                }
                .western-canada-gas-well-completions-chart-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: var(--gc-text);
                    text-align: center;
                    margin: 0 0 12px 0;
                }
                .western-canada-gas-well-completions-chart-block {
                    display: flex;
                    flex-direction: column;
                    align-items: stretch;
                    width: 100%;
                }
                .western-canada-gas-well-completions-chart {
                    width: 100%;
                    position: relative;
                    min-height: 0;
                    flex-shrink: 0;
                }
                .western-canada-gas-well-completions-legend {
                    display: flex;
                    justify-content: center;
                    margin-top: 20px;
                    margin-bottom: 20px;
                    font-family: 'Noto Sans', sans-serif;
                    padding: 10px 20px;
                }
                .western-canada-gas-well-completions-legend-inner {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 15px 40px;
                    justify-content: center;
                }
                .western-canada-gas-well-completions-legend-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .western-canada-gas-well-completions-legend-swatch-bar {
                    width: 22px;
                    height: 14px;
                    flex-shrink: 0;
                    background-color: ${BAR_COLOR};
                }
                .western-canada-gas-well-completions-legend-line {
                    width: 28px;
                    height: 0;
                    border-top: 3px solid ${LINE_COLOR};
                    position: relative;
                    flex-shrink: 0;
                }
                .western-canada-gas-well-completions-legend-line::after {
                    content: '';
                    position: absolute;
                    width: 8px;
                    height: 8px;
                    background: ${LINE_COLOR};
                    left: 10px;
                    top: -5px;
                }
                .western-canada-gas-well-completions-legend-label {
                    font-size: 18px;
                    color: var(--gc-text);
                }
                .western-canada-gas-well-completions-table-wrapper {
                    display: block;
                    width: 100%;
                    margin-top: 20px;
                    margin-bottom: 0;
                }
                .western-canada-gas-well-completions-table-wrapper details > summary {
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
                .western-canada-gas-well-completions-table-wrapper details > summary::-webkit-details-marker {
                    display: none;
                }
                .western-canada-gas-well-completions-table-wrapper details > summary:hover,
                .western-canada-gas-well-completions-chart-frame button[type="button"]:hover {
                    background-color: #404040 !important;
                }
                .western-canada-gas-well-completions-table-wrapper .table-responsive {
                    display: block;
                    width: 100%;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    border: 1px solid #ddd;
                    background: #fff;
                    margin-top: 10px;
                }
                .western-canada-gas-well-completions-table-wrapper .table-responsive table {
                    width: max-content;
                    min-width: 100%;
                }
                .western-canada-gas-well-completions-table-wrapper .table-responsive table th,
                .western-canada-gas-well-completions-table-wrapper .table-responsive table td {
                    white-space: nowrap;
                    padding: 8px 12px;
                    font-family: var(--font-body);
                    color: var(--gc-text);
                }
                .western-canada-gas-well-completions-download-buttons {
                    display: flex;
                    gap: 10px;
                    margin-top: 15px;
                    flex-wrap: wrap;
                }
                .western-canada-gas-well-completions-download-buttons button {
                    padding: 8px 16px;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    background: #8C8C8C;
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    color: #ffffff;
                }
                .western-canada-gas-well-completions-download-buttons button:hover {
                    background: #404040 !important;
                }
                @media (max-width: 768px) {
                    .western-canada-gas-well-completions-chart-title { font-size: 26px; }
                    .western-canada-gas-well-completions-legend { flex-wrap: wrap; gap: 20px; }
                    .western-canada-gas-well-completions-legend-label { font-size: 16px; }
                }
                @media (max-width: 480px) {
                    .western-canada-gas-well-completions-legend-label { font-size: 14px; }
                }
            `}</style>

            <div className="western-canada-gas-well-completions-container">
                <div className="western-canada-gas-well-completions-chart-frame">
                    <h2 id="western-canada-gas-well-completions-chart-title" className="western-canada-gas-well-completions-chart-title">
                        {getText('western_canada_gas_well_completions_title', lang)}
                    </h2>

                    <div className="western-canada-gas-well-completions-chart-block">
                        <div role="region" aria-label={getText('western_canada_gas_well_completions_chart_aria', lang)} tabIndex="0">
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
                                            color: '#fff'
                                        }}
                                    >
                                        {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                                    </button>
                                </div>
                            )}
                            <figure ref={chartRef} className="western-canada-gas-well-completions-chart" style={{ margin: 0 }}>
                                <div aria-hidden="true">
                                    <Plot
                                        data={[
                                            {
                                                name: legendBars,
                                                x: years,
                                                y: counts,
                                                type: 'bar',
                                                marker: { color: BAR_COLOR, opacity: barMarkerOpacity },
                                                hovertemplate: countHoverTemplates
                                            },
                                            {
                                                name: legendLine,
                                                x: years,
                                                y: depths,
                                                type: 'scatter',
                                                mode: 'lines+markers',
                                                line: {
                                                    color: LINE_COLOR,
                                                    width: 3,
                                                    opacity: lineStrokeOpacity
                                                },
                                                marker: { color: LINE_COLOR, size: 6, opacity: lineMarkerOpacity },
                                                yaxis: 'y2',
                                                hovertemplate: depthHoverTemplates
                                            }
                                        ]}
                                        layout={{
                                            autosize: true,
                                            hoverlabel: {
                                                bgcolor: '#ffffff',
                                                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' }
                                            },
                                            hovermode: 'closest',
                                            clickmode: 'event',
                                            dragmode: false,
                                            bargap: 0.2,
                                            margin: {
                                                l: windowWidth <= 480 ? 52 : 64,
                                                r: windowWidth <= 480 ? 52 : 64,
                                                t: plotTopMargin,
                                                b: plotBottomMargin
                                            },
                                            paper_bgcolor: 'rgba(0,0,0,0)',
                                            plot_bgcolor: 'rgba(0,0,0,0)',
                                            showlegend: false,
                                            xaxis: {
                                                title: {
                                                    text: getText('petroleum_employment_table_col_year', lang),
                                                    font: axisTitleFont,
                                                    standoff: 8
                                                },
                                                tickmode: 'linear',
                                                dtick: 2,
                                                tickfont: tickFont,
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                range: [1999, 2025],
                                                automargin: true
                                            },
                                            yaxis: {
                                                title: { text: yCount, font: axisTitleFont, standoff: 8 },
                                                range: [0, 18000],
                                                tick0: 0,
                                                dtick: 2000,
                                                tickfont: tickFont,
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                side: 'left',
                                                automargin: true
                                            },
                                            yaxis2: {
                                                title: { text: yDepth, font: axisTitleFont, standoff: 8 },
                                                range: [0, 5000],
                                                tick0: 0,
                                                dtick: 500,
                                                tickfont: tickFont,
                                                overlaying: 'y',
                                                side: 'right',
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                automargin: true
                                            }
                                        }}
                                        config={{
                                            displayModeBar: true,
                                            displaylogo: false,
                                            responsive: true,
                                            scrollZoom: false,
                                            modeBarButtonsToRemove: [
                                                'toImage',
                                                'select2d',
                                                'lasso2d',
                                                'zoom2d',
                                                'pan2d',
                                                'zoomIn2d',
                                                'zoomOut2d',
                                                'autoScale2d',
                                                'resetScale2d'
                                            ],
                                            modeBarButtonsToAdd: [
                                                {
                                                    name:
                                                        lang === 'en'
                                                            ? 'Download chart as PNG'
                                                            : 'Télécharger le graphique en PNG',
                                                    icon: {
                                                        width: 24,
                                                        height: 24,
                                                        path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z'
                                                    },
                                                    click: (gd) => downloadChartWithTitle(gd)
                                                }
                                            ]
                                        }}
                                        style={{ width: '100%', height: `${chartHeight}px` }}
                                        useResizeHandler
                                        onClick={(data) => {
                                            if (!data.points || data.points.length === 0) return;
                                            const clickedPoint = data.points[0];
                                            const traceIndex = clickedPoint.curveNumber;
                                            const pointIndex = clickedPoint.pointIndex;
                                            if (traceIndex === undefined || pointIndex === undefined) return;

                                            if (windowWidth <= 768) {
                                                const currentTime = Date.now();
                                                const lastClick = lastClickRef.current;
                                                const isSamePoint =
                                                    traceIndex === lastClick.traceIndex &&
                                                    pointIndex === lastClick.pointIndex;
                                                const isDoubleTap = isSamePoint && currentTime - lastClick.time < 300;
                                                lastClickRef.current = {
                                                    time: currentTime,
                                                    traceIndex,
                                                    pointIndex
                                                };
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
                                                        idx === traceIndex
                                                            ? tracePoints.filter((p) => p !== pointIndex)
                                                            : [...tracePoints]
                                                    );
                                                    return next.every((arr) => arr.length === 0) ? null : next;
                                                }
                                                return prev.map((tracePoints, idx) =>
                                                    idx === traceIndex ? [...tracePoints, pointIndex] : [...tracePoints]
                                                );
                                            });
                                        }}
                                    />
                                </div>
                            </figure>
                        </div>

                        <div className="western-canada-gas-well-completions-legend" aria-hidden="true">
                            <div className="western-canada-gas-well-completions-legend-inner">
                                <div className="western-canada-gas-well-completions-legend-item">
                                    <span className="western-canada-gas-well-completions-legend-swatch-bar" />
                                    <span className="western-canada-gas-well-completions-legend-label">{legendBars}</span>
                                </div>
                                <div className="western-canada-gas-well-completions-legend-item">
                                    <span className="western-canada-gas-well-completions-legend-line" />
                                    <span className="western-canada-gas-well-completions-legend-label">{legendLine}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="western-canada-gas-well-completions-table-wrapper">
                        <details onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>
                                    {isTableOpen ? '▼' : '▶'}
                                </span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">
                                    {lang === 'en'
                                        ? ' Press Enter to open or close.'
                                        : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                </span>
                            </summary>

                            <div
                                ref={topScrollRef}
                                style={{
                                    width: '100%',
                                    overflowX: 'auto',
                                    overflowY: 'hidden',
                                    marginTop: '10px',
                                    display: windowWidth <= 768 ? 'none' : 'block'
                                }}
                                aria-hidden="true"
                            >
                                <div style={{ height: '20px' }} />
                            </div>

                            <div
                                ref={tableScrollRef}
                                className="table-responsive"
                                role="region"
                                aria-label={lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                tabIndex="0"
                            >
                                <table className="table table-bordered table-striped table-hover">
                                    <caption className="wb-inv">{getText('western_canada_gas_well_completions_table_caption', lang)}</caption>
                                    <thead>
                                        <tr>
                                            <th scope="col" style={{ fontWeight: 'bold', textAlign: 'center' }}>
                                                {getText('petroleum_employment_table_col_year', lang)}
                                            </th>
                                            <th scope="col" style={{ fontWeight: 'bold', textAlign: 'center' }}>
                                                {getText('western_canada_gas_well_completions_table_col_count', lang)}
                                            </th>
                                            <th scope="col" style={{ fontWeight: 'bold', textAlign: 'center' }}>
                                                {getText('western_canada_gas_well_completions_table_col_depth', lang)}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {western_canada_gas_well_completions_DATA.map((d) => (
                                            <tr key={d.year}>
                                                <td style={{ textAlign: 'center' }}>{d.year}</td>
                                                <td style={{ textAlign: 'center' }}>{formatInt(d.count)}</td>
                                                <td style={{ textAlign: 'center' }}>{formatInt(d.depth)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="western-canada-gas-well-completions-download-buttons">
                                <button type="button" onClick={downloadTableAsCSV}>
                                    {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                </button>
                                <button type="button" onClick={() => downloadTableAsDocx()}>
                                    {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                </button>
                            </div>
                        </details>
                    </div>
                </div>

                <aside className="wb-fnote" role="note" style={{ marginTop: '12px', marginBottom: 0 }}>
                    <h2 id="fn-western-canada-gas-well-completions">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt>{lang === 'en' ? 'Footnote' : 'Note de bas de page'}</dt>
                        <dd style={{ marginBottom: 0 }}>
                            <p style={{ margin: 0 }}>{getText('western_canada_gas_well_completions_footnote', lang)}</p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default WesternCanadaGasWellCompletions;
