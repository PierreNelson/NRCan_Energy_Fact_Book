import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const DATA = [
    { year: 2018, direct: 191, indirect: 303, total: 494 },
    { year: 2019, direct: 187, indirect: 298, total: 486 },
    { year: 2020, direct: 157, indirect: 254, total: 411 },
    { year: 2021, direct: 167, indirect: 275, total: 442 },
    { year: 2022, direct: 186, indirect: 304, total: 490 },
    { year: 2023, direct: 190, indirect: 313, total: 503 },
    { year: 2024, direct: 190, indirect: 313, total: 503 }
];

const COLORS = {
    direct: '#433430',
    indirect: '#6097b6'
};

const Page106 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);

    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    const formatNumber = (num) => {
        if (num === undefined || num === null) return '\u2014';
        return Math.round(num).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');
    };

    const years = DATA.map((d) => d.year);
    const directValues = DATA.map((d) => d.direct);
    const indirectValues = DATA.map((d) => d.indirect);
    const totalValues = DATA.map((d) => d.total);

    const directLabel = getText('page106_legend_direct', lang);
    const indirectLabel = getText('page106_legend_indirect', lang);
    const totalLabel = getText('page106_legend_total', lang);

    const directHoverTemplates = years.map(
        (y, i) =>
            `<b>${directLabel}</b><br>${y}: ${formatNumber(directValues[i])}<br><b>${totalLabel}</b>: ${formatNumber(totalValues[i])}<extra></extra>`
    );
    const indirectHoverTemplates = years.map(
        (y, i) =>
            `<b>${indirectLabel}</b><br>${y}: ${formatNumber(indirectValues[i])}<br><b>${totalLabel}</b>: ${formatNumber(totalValues[i])}<extra></extra>`
    );

    const fileSlugBase = `${stripHtml(getText('page106_chart_title', lang))
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'petroleum-employment'}-2018-2024`;

    const plotBottomMargin = windowWidth <= 480 ? 72 : windowWidth <= 768 ? 62 : 50;
    const plotTopMargin = windowWidth <= 480 ? 56 : 48;
    const chartHeight = windowWidth <= 480 ? 320 : windowWidth <= 768 ? 360 : 400;

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

            const svgElements = plotContainer.querySelectorAll('.main-svg, .svg-container svg');
            svgElements.forEach((svg) => svg.setAttribute('aria-hidden', 'true'));

            const modebarButtons = plotContainer.querySelectorAll('.modebar-btn');
            modebarButtons.forEach((btn) => {
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
    }, [lang, selectedPoints]);

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

        const title = `${stripHtml(getText('page106_chart_title', lang))} (2018-2024)`;
        const subtitle = stripHtml(getText('page106_chart_subtitle', lang));

        try {
            if (!window.Plotly) return;

            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 1200,
                height: 640,
                scale: 2
            });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                const titleHeight = 110;
                const legendHeight = 56;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight + legendHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 36px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, canvas.width / 2, 45);
                ctx.font = '24px Arial';
                ctx.fillText(subtitle, canvas.width / 2, 80);
                ctx.drawImage(img, 0, titleHeight);

                const legendY = titleHeight + img.height + 28;
                const items = [
                    { label: directLabel, color: COLORS.direct },
                    { label: indirectLabel, color: COLORS.indirect }
                ];
                const totalW = items.reduce((acc, it) => acc + ctx.measureText(it.label).width + 44, 0);
                let xPos = (canvas.width - totalW) / 2;
                items.forEach((it) => {
                    ctx.fillStyle = it.color;
                    ctx.fillRect(xPos, legendY - 10, 22, 14);
                    ctx.fillStyle = '#333333';
                    ctx.font = '22px Arial';
                    ctx.textAlign = 'left';
                    ctx.fillText(it.label, xPos + 30, legendY + 4);
                    xPos += 30 + ctx.measureText(it.label).width + 36;
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
        const unitText = lang === 'en' ? 'thousands of jobs' : 'milliers d\'emplois';
        const headers = [
            getText('page106_table_col_year', lang),
            `${directLabel} (${unitText})`,
            `${indirectLabel} (${unitText})`,
            `${totalLabel} (${unitText})`
        ];
        const rows = DATA.map((d) => [d.year, d.direct, d.indirect, d.total]);
        const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${fileSlugBase}.csv`);
    };

    const downloadTableAsDocx = async () => {
        const unitText = getText('page106_table_unit_row', lang);
        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: stripHtml(getText('page106_chart_title', lang)), bold: true, size: 28 })]
                        }),
                        new Table({
                            columnWidths: [1500, 2500, 2500, 2500],
                            rows: [
                                new TableRow({
                                    children: [
                                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '', bold: true })] })] }),
                                        new TableCell({
                                            children: [
                                                new Paragraph({
                                                    alignment: AlignmentType.CENTER,
                                                    children: [new TextRun({ text: unitText, bold: true })]
                                                })
                                            ],
                                            columnSpan: 3
                                        })
                                    ]
                                }),
                                new TableRow({
                                    children: [
                                        new TableCell({
                                            children: [new Paragraph({ children: [new TextRun({ text: getText('page106_table_col_year', lang), bold: true })] })]
                                        }),
                                        new TableCell({
                                            children: [
                                                new Paragraph({
                                                    alignment: AlignmentType.RIGHT,
                                                    children: [new TextRun({ text: directLabel, bold: true })]
                                                })
                                            ]
                                        }),
                                        new TableCell({
                                            children: [
                                                new Paragraph({
                                                    alignment: AlignmentType.RIGHT,
                                                    children: [new TextRun({ text: indirectLabel, bold: true })]
                                                })
                                            ]
                                        }),
                                        new TableCell({
                                            children: [
                                                new Paragraph({
                                                    alignment: AlignmentType.RIGHT,
                                                    children: [new TextRun({ text: totalLabel, bold: true })]
                                                })
                                            ]
                                        })
                                    ]
                                }),
                                ...DATA.map(
                                    (d) =>
                                        new TableRow({
                                            children: [
                                                new TableCell({
                                                    children: [new Paragraph({ children: [new TextRun({ text: String(d.year) })] })]
                                                }),
                                                new TableCell({
                                                    children: [
                                                        new Paragraph({
                                                            alignment: AlignmentType.RIGHT,
                                                            children: [new TextRun({ text: formatNumber(d.direct) })]
                                                        })
                                                    ]
                                                }),
                                                new TableCell({
                                                    children: [
                                                        new Paragraph({
                                                            alignment: AlignmentType.RIGHT,
                                                            children: [new TextRun({ text: formatNumber(d.indirect) })]
                                                        })
                                                    ]
                                                }),
                                                new TableCell({
                                                    children: [
                                                        new Paragraph({
                                                            alignment: AlignmentType.RIGHT,
                                                            children: [new TextRun({ text: formatNumber(d.total), bold: true })]
                                                        })
                                                    ]
                                                })
                                            ]
                                        })
                                )
                            ]
                        })
                    ]
                }
            ]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${fileSlugBase}.docx`);
    };

    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-106"
            role="main"
            aria-labelledby="page106-chart-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
                .page-106.page-content {
                    max-width: none !important;
                    overflow-x: visible !important;
                }

                .page-106 {
                    margin-left: -${layoutPadding?.left || 55}px;
                    margin-right: -${layoutPadding?.right || 15}px;
                    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
                    padding-left: ${layoutPadding?.left || 55}px;
                    padding-right: ${layoutPadding?.right || 15}px;
                }

                .page106-rpp-crosslink {
                    font-family: var(--font-body);
                    font-size: 1rem;
                    line-height: 1.5;
                    margin: 0 0 16px 0;
                }
                .page106-rpp-crosslink a {
                    font-weight: 600;
                }
                .page106-container {
                    width: 100%;
                    padding: 15px 0 40px 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                }

                .page106-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 0;
                    box-sizing: border-box;
                    overflow: visible;
                }

                .page106-chart-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: var(--gc-text);
                    text-align: center;
                    margin: 0 0 5px 0;
                }

                .page106-chart-subtitle {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    color: var(--gc-text);
                    text-align: center;
                    margin: 0 0 15px 0;
                }

                .page106-chart-block {
                    display: flex;
                    flex-direction: column;
                    align-items: stretch;
                    width: 100%;
                }

                .page106-chart {
                    width: 100%;
                    flex-shrink: 0;
                    position: relative;
                    margin-bottom: 0 !important;
                }

                .page106-legend {
                    display: flex;
                    justify-content: center;
                    margin-top: 20px;
                    margin-bottom: 20px;
                    font-family: 'Noto Sans', sans-serif;
                    padding: 10px 20px;
                    flex-shrink: 0;
                }

                .page106-legend-inner {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 15px 40px;
                    justify-content: center;
                }

                .page106-legend-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .page106-legend-swatch {
                    width: 22px;
                    height: 14px;
                    flex-shrink: 0;
                }

                .page106-legend-label {
                    font-size: 18px;
                    color: var(--gc-text);
                }

                .page106-table-wrapper {
                    display: block;
                    width: 100%;
                    margin-top: 20px;
                    margin-bottom: 0;
                }

                .page106-table-wrapper details > summary {
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

                .page106-table-wrapper details > summary::-webkit-details-marker {
                    display: none;
                }

                .page106-table-wrapper details > summary::marker {
                    display: none;
                    content: '';
                }

                .page106-table-wrapper details > summary:hover {
                    background-color: #404040 !important;
                }

                .page106-table-wrapper .table-responsive {
                    display: block;
                    width: 100%;
                    overflow-x: auto !important;
                    -webkit-overflow-scrolling: touch;
                    border: 1px solid #ddd;
                    background: #fff;
                }

                .page106-table-wrapper .table-responsive table {
                    width: max-content !important;
                    min-width: 100%;
                    border-collapse: collapse;
                }

                .page106-table-wrapper .table-responsive table.table {
                    font-family: var(--font-body);
                    color: var(--gc-text);
                }

                .page106-table-wrapper .table-responsive table th,
                .page106-table-wrapper .table-responsive table td {
                    white-space: nowrap;
                    padding: 8px 12px;
                    font-family: var(--font-body);
                    color: var(--gc-text);
                }

                .page106-download-buttons {
                    display: flex;
                    gap: 10px;
                    margin-top: 15px;
                    flex-wrap: wrap;
                }

                .page106-download-buttons button {
                    padding: 8px 16px;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    background: #8C8C8C;
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    color: #ffffff;
                }

                .page106-download-buttons button:hover,
                .page106-table-wrapper button:hover,
                .page106-chart-frame button[type="button"]:hover,
                .page106-chart-frame button:hover {
                    background: #404040 !important;
                    background-color: #404040 !important;
                }

                @media (max-width: 768px) {
                    .page106-chart-title { font-size: 26px; }
                    .page106-chart-subtitle { font-size: 18px; }
                    .page106-legend { flex-wrap: wrap; gap: 20px; }
                    .page106-legend-label { font-size: 16px; }
                }

                @media (max-width: 480px) {
                    .page106-legend-label { font-size: 14px; }
                }
            `}</style>

            <div className="page106-container">
                <div className="page106-chart-frame">
                    <h2 id="page106-chart-title" className="page106-chart-title">
                        {getText('page106_chart_title', lang)}
                    </h2>
                    <p className="page106-chart-subtitle">{getText('page106_chart_subtitle', lang)}</p>

                    <div className="page106-chart-block">
                        <div role="region" aria-label={getText('page106_chart_aria', lang)} tabIndex="0">
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
                            <figure ref={chartRef} style={{ margin: 0, position: 'relative' }}>
                                <div aria-hidden="true">
                                    <Plot
                                        data={[
                                            {
                                                x: years,
                                                y: directValues,
                                                type: 'bar',
                                                name: directLabel,
                                                marker: {
                                                    color: COLORS.direct,
                                                    opacity:
                                                        selectedPoints === null
                                                            ? 1
                                                            : years.map((_, i) =>
                                                                  selectedPoints[0]?.includes(i) ? 1 : 0.3
                                                              )
                                                },
                                                hovertemplate: directHoverTemplates
                                            },
                                            {
                                                x: years,
                                                y: indirectValues,
                                                type: 'bar',
                                                name: indirectLabel,
                                                marker: {
                                                    color: COLORS.indirect,
                                                    opacity:
                                                        selectedPoints === null
                                                            ? 1
                                                            : years.map((_, i) =>
                                                                  selectedPoints[1]?.includes(i) ? 1 : 0.3
                                                              )
                                                },
                                                hovertemplate: indirectHoverTemplates
                                            }
                                        ]}
                                        layout={{
                                            barmode: 'stack',
                                            bargap: 0.22,
                                            hoverlabel: {
                                                bgcolor: '#ffffff',
                                                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' }
                                            },
                                            hovermode: 'closest',
                                            clickmode: 'event',
                                            dragmode: false,
                                            xaxis: {
                                                type: 'linear',
                                                tickmode: 'array',
                                                tickvals: years,
                                                ticktext: years.map(String),
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                tickfont: tickFont,
                                                automargin: true
                                            },
                                            yaxis: {
                                                range: [0, 550],
                                                dtick: 50,
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                tickfont: tickFont,
                                                automargin: true
                                            },
                                            showlegend: false,
                                            margin: { l: 52, r: 20, t: plotTopMargin, b: plotBottomMargin },
                                            autosize: true,
                                            paper_bgcolor: 'rgba(0,0,0,0)',
                                            plot_bgcolor: 'rgba(0,0,0,0)'
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
                                                'toImage'
                                            ],
                                            modeBarButtonsToAdd: [
                                                {
                                                    name: getText('page106_download_chart', lang),
                                                    icon: {
                                                        width: 24,
                                                        height: 24,
                                                        path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z'
                                                    },
                                                    click: (gd) => downloadChartWithTitle(gd)
                                                }
                                            ]
                                        }}
                                        className="page106-chart"
                                        style={{ width: '100%', height: `${chartHeight}px` }}
                                        useResizeHandler={true}
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

                        <div className="page106-legend" aria-hidden="true">
                            <div className="page106-legend-inner">
                                <div className="page106-legend-item">
                                    <span className="page106-legend-swatch" style={{ backgroundColor: COLORS.direct }}></span>
                                    <span className="page106-legend-label">{directLabel}</span>
                                </div>
                                <div className="page106-legend-item">
                                    <span className="page106-legend-swatch" style={{ backgroundColor: COLORS.indirect }}></span>
                                    <span className="page106-legend-label">{indirectLabel}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="page106-table-wrapper">
                        <details className="page106-data-table" onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                {getText('page106_table_summary', lang)}
                                <span className="wb-inv">{getText('page106_table_toggle_sr', lang)}</span>
                            </summary>

                            <div
                                ref={topScrollRef}
                                style={{
                                    width: '100%',
                                    overflowX: 'auto',
                                    overflowY: 'hidden',
                                    marginBottom: '0px',
                                    display: windowWidth <= 768 ? 'none' : 'block'
                                }}
                                aria-hidden="true"
                            >
                                <div style={{ height: '20px' }}></div>
                            </div>
                            <div
                                ref={tableScrollRef}
                                className="table-responsive"
                                role="region"
                                tabIndex="0"
                                aria-label={getText('page106_table_aria', lang)}
                            >
                                <table className="table table-striped table-hover" style={{ marginTop: '15px' }}>
                                    <caption className="wb-inv">{getText('page106_table_caption', lang)}</caption>
                                    <thead>
                                        <tr>
                                            <td
                                                style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f0f0f0' }}
                                                aria-hidden="true"
                                            ></td>
                                            <th
                                                scope="colgroup"
                                                colSpan={3}
                                                style={{
                                                    border: '1px solid #ddd',
                                                    padding: '10px',
                                                    backgroundColor: '#f0f0f0',
                                                    textAlign: 'center'
                                                }}
                                            >
                                                <span aria-hidden="true">{getText('page106_table_unit_row', lang)}</span>
                                                <span className="wb-inv">{getText('page106_table_unit_row', lang)}</span>
                                            </th>
                                        </tr>
                                        <tr>
                                            <th
                                                scope="col"
                                                style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f0f0f0' }}
                                            >
                                                {getText('page106_table_col_year', lang)}
                                            </th>
                                            <th
                                                scope="col"
                                                style={{
                                                    border: '1px solid #ddd',
                                                    padding: '10px',
                                                    backgroundColor: '#f0f0f0',
                                                    textAlign: 'right'
                                                }}
                                            >
                                                {directLabel}
                                            </th>
                                            <th
                                                scope="col"
                                                style={{
                                                    border: '1px solid #ddd',
                                                    padding: '10px',
                                                    backgroundColor: '#f0f0f0',
                                                    textAlign: 'right'
                                                }}
                                            >
                                                {indirectLabel}
                                            </th>
                                            <th
                                                scope="col"
                                                style={{
                                                    border: '1px solid #ddd',
                                                    padding: '10px',
                                                    backgroundColor: '#f0f0f0',
                                                    textAlign: 'right'
                                                }}
                                            >
                                                {totalLabel}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {DATA.map((d) => (
                                            <tr key={d.year}>
                                                <th scope="row" style={{ border: '1px solid #ddd', padding: '10px' }}>
                                                    {d.year}
                                                </th>
                                                <td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right' }}>
                                                    {formatNumber(d.direct)}
                                                </td>
                                                <td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right' }}>
                                                    {formatNumber(d.indirect)}
                                                </td>
                                                <td
                                                    style={{
                                                        border: '1px solid #ddd',
                                                        padding: '10px',
                                                        textAlign: 'right',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    {formatNumber(d.total)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="page106-download-buttons">
                                <button type="button" onClick={downloadTableAsCSV}>
                                    {getText('page106_download_csv', lang)}
                                </button>
                                <button type="button" onClick={downloadTableAsDocx}>
                                    {getText('page106_download_docx', lang)}
                                </button>
                            </div>
                        </details>
                    </div>
                </div>

                <aside className="wb-fnote" role="note" style={{ marginTop: '20px', marginBottom: 0 }}>
                    <h2 id="fn-page106">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt>{lang === 'en' ? 'Footnote' : 'Note de bas de page'}</dt>
                        <dd style={{ marginBottom: 0 }}>
                            <p>{getText('page106_footnote', lang)}</p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page106;
