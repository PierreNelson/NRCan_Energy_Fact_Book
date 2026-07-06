import React, { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const DATA = [
    { year: 2018, direct: 119, indirect: 30, total: 149 },
    { year: 2019, direct: 120, indirect: 28, total: 148 },
    { year: 2020, direct: 77, indirect: 20, total: 97 },
    { year: 2021, direct: 148, indirect: 33, total: 182 },
    { year: 2022, direct: 219, indirect: 48, total: 267 },
    { year: 2023, direct: 175, indirect: 40, total: 215 },
    { year: 2024, direct: 172, indirect: 39, total: 211 }
];

const COLORS = {
    direct: '#6191AE',
    indirect: '#7C9E33',
    total: '#344653'
};

const PetroleumGdp = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    /** null = no focus; otherwise whole line traces (0=direct, 1=indirect, 2=total) included here stay full opacity. */
    const [selectedTraceIds, setSelectedTraceIds] = useState(null);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null });
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);

    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    const formatNumber = (num) => {
        if (num === undefined || num === null) return '\u2014';
        return Math.round(num).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');
    };

    const formatCurrency = (num) => {
        if (num === undefined || num === null) return '\u2014';
        return lang === 'en' ? `$${formatNumber(num)}` : `${formatNumber(num)} $`;
    };

    const years = DATA.map((d) => d.year);
    const directValues = DATA.map((d) => d.direct);
    const indirectValues = DATA.map((d) => d.indirect);
    const totalValues = DATA.map((d) => d.total);

    const directLabel = getText('petroleum_gdp_legend_direct', lang);
    const indirectLabel = getText('petroleum_gdp_legend_indirect', lang);
    const totalLabel = getText('petroleum_gdp_legend_total', lang);

    const fileSlugBase = `${stripHtml(getText('petroleum_gdp_chart_title', lang))
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'petroleum-gdp'}-2018-2024`;

    const hoverTemplate = (label, values) =>
        values.map((val, i) => {
            const yearVal = years[i];
            const formatted = lang === 'en' ? `$${formatNumber(val)}B` : `${formatNumber(val)} G$`;
            return `<b>${label}</b><br>${yearVal}: ${formatted}<extra></extra>`;
        });

    const plotBottomMargin = windowWidth <= 480 ? 72 : windowWidth <= 768 ? 62 : 50;
    const plotTopMargin = windowWidth <= 480 ? 48 : 40;

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
    }, [lang, selectedTraceIds]);

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

        const title = `${stripHtml(getText('petroleum_gdp_chart_title', lang))} (2018-2024)`;
        const subtitle = stripHtml(getText('petroleum_gdp_chart_subtitle', lang));

        try {
            if (!window.Plotly) return;

            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 1200,
                height: 600,
                scale: 2
            });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                const titleHeight = 110;
                const legendHeight = 60;
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

                const legendY = titleHeight + img.height + 30;
                const legendItems = [
                    { label: directLabel, color: COLORS.direct, dash: true },
                    { label: indirectLabel, color: COLORS.indirect, dash: true },
                    { label: totalLabel, color: COLORS.total, dash: false }
                ];
                const totalWidth = legendItems.reduce((acc, item) => acc + ctx.measureText(item.label).width + 60, 0);
                let xPos = (canvas.width - totalWidth) / 2;

                legendItems.forEach((item) => {
                    ctx.strokeStyle = item.color;
                    ctx.lineWidth = 3;
                    if (item.dash) {
                        ctx.setLineDash([8, 4]);
                    } else {
                        ctx.setLineDash([]);
                    }
                    ctx.beginPath();
                    ctx.moveTo(xPos, legendY);
                    ctx.lineTo(xPos + 30, legendY);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.fillStyle = '#333333';
                    ctx.font = '24px Arial';
                    ctx.textAlign = 'left';
                    ctx.fillText(item.label, xPos + 40, legendY + 8);
                    xPos += ctx.measureText(item.label).width + 80;
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
        const unitText = lang === 'en' ? 'billions' : 'milliards';
        const headers = [
            getText('petroleum_gdp_table_col_year', lang),
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
        const unitText = lang === 'en' ? '(billions of dollars)' : '(milliards de dollars)';
        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: stripHtml(getText('petroleum_gdp_chart_title', lang)), bold: true, size: 28 })]
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
                                            children: [new Paragraph({ children: [new TextRun({ text: getText('petroleum_gdp_table_col_year', lang), bold: true })] })]
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
                                                            children: [new TextRun({ text: formatCurrency(d.direct) })]
                                                        })
                                                    ]
                                                }),
                                                new TableCell({
                                                    children: [
                                                        new Paragraph({
                                                            alignment: AlignmentType.RIGHT,
                                                            children: [new TextRun({ text: formatCurrency(d.indirect) })]
                                                        })
                                                    ]
                                                }),
                                                new TableCell({
                                                    children: [
                                                        new Paragraph({
                                                            alignment: AlignmentType.RIGHT,
                                                            children: [new TextRun({ text: formatCurrency(d.total), bold: true })]
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

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-107"
            role="main"
            aria-labelledby="petroleum-gdp-chart-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
                .page-107.page-content {
                    max-width: none !important;
                    overflow-x: visible !important;
                }

                .page-107 {
                    margin-left: -${layoutPadding?.left || 55}px;
                    margin-right: -${layoutPadding?.right || 15}px;
                    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
                    padding-left: ${layoutPadding?.left || 55}px;
                    padding-right: ${layoutPadding?.right || 15}px;
                }

                .petroleum-gdp-container {
                    width: 100%;
                    padding: 15px 0 40px 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                }

                .petroleum-gdp-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 0;
                    box-sizing: border-box;
                    overflow: visible;
                }

                .petroleum-gdp-chart-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: var(--gc-text);
                    text-align: center;
                    margin: 0 0 5px 0;
                }

                .petroleum-gdp-chart-subtitle {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    color: var(--gc-text);
                    text-align: center;
                    margin: 0 0 15px 0;
                }

                .petroleum-gdp-chart-block {
                    display: flex;
                    flex-direction: column;
                    align-items: stretch;
                    width: 100%;
                }

                .petroleum-gdp-chart {
                    width: 100%;
                    height: 300px;
                    flex-shrink: 0;
                    position: relative;
                    margin-bottom: 0 !important;
                }

                .petroleum-gdp-legend {
                    display: flex;
                    justify-content: center;
                    margin-top: 20px;
                    margin-bottom: 20px;
                    font-family: 'Noto Sans', sans-serif;
                    padding: 10px 20px;
                    flex-shrink: 0;
                }

                .petroleum-gdp-legend-inner {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 15px 40px;
                    justify-content: center;
                }

                .petroleum-gdp-legend-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .petroleum-gdp-legend-line {
                    width: 30px;
                    height: 3px;
                    flex-shrink: 0;
                }

                .petroleum-gdp-legend-line-dashed {
                    background: repeating-linear-gradient(
                        to right,
                        currentColor,
                        currentColor 6px,
                        transparent 6px,
                        transparent 10px
                    );
                }

                .petroleum-gdp-legend-line-solid {
                    background: currentColor;
                }

                .petroleum-gdp-legend-label {
                    font-size: 18px;
                    color: var(--gc-text);
                }

                .petroleum-gdp-table-wrapper {
                    display: block;
                    width: 100%;
                    margin-top: 20px;
                    margin-bottom: 0;
                }

                .petroleum-gdp-table-wrapper details > summary {
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

                .petroleum-gdp-table-wrapper details > summary::-webkit-details-marker {
                    display: none;
                }

                .petroleum-gdp-table-wrapper details > summary::marker {
                    display: none;
                    content: '';
                }

                .petroleum-gdp-table-wrapper details > summary:hover {
                    background-color: #404040 !important;
                }

                .petroleum-gdp-table-wrapper .table-responsive {
                    display: block;
                    width: 100%;
                    overflow-x: auto !important;
                    -webkit-overflow-scrolling: touch;
                    border: 1px solid #ddd;
                    background: #fff;
                }

                .petroleum-gdp-table-wrapper .table-responsive table {
                    width: max-content !important;
                    min-width: 100%;
                    border-collapse: collapse;
                }

                .petroleum-gdp-table-wrapper .table-responsive table.table {
                    font-family: var(--font-body);
                    color: var(--gc-text);
                }

                .petroleum-gdp-table-wrapper .table-responsive table th,
                .petroleum-gdp-table-wrapper .table-responsive table td {
                    white-space: nowrap;
                    padding: 8px 12px;
                    font-family: var(--font-body);
                    color: var(--gc-text);
                }

                .petroleum-gdp-download-buttons {
                    display: flex;
                    gap: 10px;
                    margin-top: 15px;
                    flex-wrap: wrap;
                }

                .petroleum-gdp-download-buttons button {
                    padding: 8px 16px;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    background: #8C8C8C;
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    color: #ffffff;
                }

                .petroleum-gdp-download-buttons button:hover,
                .petroleum-gdp-table-wrapper button:hover,
                .petroleum-gdp-chart-frame button[type="button"]:hover,
                .petroleum-gdp-chart-frame button:hover {
                    background: #404040 !important;
                    background-color: #404040 !important;
                }

                @media (max-width: 768px) {
                    .petroleum-gdp-chart-title { font-size: 26px; }
                    .petroleum-gdp-chart-subtitle { font-size: 18px; }
                    .petroleum-gdp-legend { flex-wrap: wrap; gap: 20px; }
                    .petroleum-gdp-legend-label { font-size: 16px; }
                }

                @media (max-width: 480px) {
                    .petroleum-gdp-chart { height: 275px; }
                    .petroleum-gdp-legend-label { font-size: 14px; }
                }
            `}</style>

            <div className="petroleum-gdp-container">
                <div className="petroleum-gdp-chart-frame">
                    <h2 id="petroleum-gdp-chart-title" className="petroleum-gdp-chart-title">
                        {getText('petroleum_gdp_chart_title', lang)}
                    </h2>
                    <p className="petroleum-gdp-chart-subtitle">{getText('petroleum_gdp_chart_subtitle', lang)}</p>

                    <div className="petroleum-gdp-chart-block">
                        <div role="region" aria-label={getText('petroleum_gdp_chart_aria', lang)} tabIndex="0">
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
                                            color: '#fff'
                                        }}
                                    >
                                        {lang === 'en' ? 'Clear selection' : 'Effacer la s\u00e9lection'}
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
                                                type: 'scatter',
                                                mode: 'lines+markers',
                                                name: directLabel,
                                                line: { color: COLORS.direct, width: 2, dash: 'dash' },
                                                marker: { color: COLORS.direct, size: 6 },
                                                opacity:
                                                    selectedTraceIds === null
                                                        ? 1
                                                        : selectedTraceIds.includes(0)
                                                          ? 1
                                                          : 0.3,
                                                hovertemplate: hoverTemplate(directLabel, directValues)
                                            },
                                            {
                                                x: years,
                                                y: indirectValues,
                                                type: 'scatter',
                                                mode: 'lines+markers',
                                                name: indirectLabel,
                                                line: { color: COLORS.indirect, width: 2, dash: 'dash' },
                                                marker: { color: COLORS.indirect, size: 6 },
                                                opacity:
                                                    selectedTraceIds === null
                                                        ? 1
                                                        : selectedTraceIds.includes(1)
                                                          ? 1
                                                          : 0.3,
                                                hovertemplate: hoverTemplate(indirectLabel, indirectValues)
                                            },
                                            {
                                                x: years,
                                                y: totalValues,
                                                type: 'scatter',
                                                mode: 'lines+markers',
                                                name: totalLabel,
                                                line: { color: COLORS.total, width: 3, dash: 'solid' },
                                                marker: { color: COLORS.total, size: 8 },
                                                opacity:
                                                    selectedTraceIds === null
                                                        ? 1
                                                        : selectedTraceIds.includes(2)
                                                          ? 1
                                                          : 0.3,
                                                hovertemplate: hoverTemplate(totalLabel, totalValues)
                                            }
                                        ]}
                                        layout={{
                                            hoverlabel: {
                                                bgcolor: '#ffffff',
                                                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' }
                                            },
                                            hovermode: 'closest',
                                            clickmode: 'event',
                                            dragmode: false,
                                            xaxis: {
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                tickfont: {
                                                    size: windowWidth <= 480 ? 12 : windowWidth <= 768 ? 14 : 16,
                                                    family: 'Arial, sans-serif'
                                                },
                                                tickmode: 'array',
                                                tickvals: years,
                                                ticktext: years.map(String),
                                                automargin: true
                                            },
                                            yaxis: {
                                                showgrid: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                zeroline: false,
                                                tickfont: {
                                                    size: windowWidth <= 480 ? 12 : windowWidth <= 768 ? 14 : 16,
                                                    family: 'Arial, sans-serif'
                                                },
                                                range: [0, 300],
                                                dtick: 50,
                                                automargin: true
                                            },
                                            showlegend: false,
                                            margin: {
                                                l: 50,
                                                r: 20,
                                                t: plotTopMargin,
                                                b: plotBottomMargin
                                            },
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
                                                    name: getText('petroleum_gdp_download_chart', lang),
                                                    icon: {
                                                        width: 24,
                                                        height: 24,
                                                        path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z'
                                                    },
                                                    click: (gd) => downloadChartWithTitle(gd)
                                                }
                                            ]
                                        }}
                                        className="petroleum-gdp-chart"
                                        useResizeHandler={true}
                                        onClick={(data) => {
                                            if (!data.points || data.points.length === 0) return;
                                            const clickedPoint = data.points[0];
                                            const traceIndex = clickedPoint.curveNumber;
                                            if (traceIndex === undefined || traceIndex < 0 || traceIndex > 2) return;

                                            if (windowWidth <= 768) {
                                                const currentTime = Date.now();
                                                const lastClick = lastClickRef.current;
                                                const isSameTrace =
                                                    traceIndex === lastClick.traceIndex && lastClick.traceIndex != null;
                                                const isDoubleTap = isSameTrace && currentTime - lastClick.time < 300;
                                                lastClickRef.current = { time: currentTime, traceIndex };
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
                                        }}
                                    />
                                </div>
                            </figure>
                        </div>

                        <div className="petroleum-gdp-legend" aria-hidden="true">
                            <div className="petroleum-gdp-legend-inner">
                                <div className="petroleum-gdp-legend-item">
                                    <span className="petroleum-gdp-legend-line petroleum-gdp-legend-line-dashed" style={{ color: COLORS.direct }}></span>
                                    <span className="petroleum-gdp-legend-label">{directLabel}</span>
                                </div>
                                <div className="petroleum-gdp-legend-item">
                                    <span className="petroleum-gdp-legend-line petroleum-gdp-legend-line-dashed" style={{ color: COLORS.indirect }}></span>
                                    <span className="petroleum-gdp-legend-label">{indirectLabel}</span>
                                </div>
                                <div className="petroleum-gdp-legend-item">
                                    <span className="petroleum-gdp-legend-line petroleum-gdp-legend-line-solid" style={{ color: COLORS.total }}></span>
                                    <span className="petroleum-gdp-legend-label">{totalLabel}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="petroleum-gdp-table-wrapper">
                        <details className="petroleum-gdp-data-table" onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '\u25BC' : '\u25B6'}</span>
                                {getText('petroleum_gdp_table_summary', lang)}
                                <span className="wb-inv">{getText('petroleum_gdp_table_toggle_sr', lang)}</span>
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
                                aria-label={getText('petroleum_gdp_table_aria', lang)}
                            >
                                <table className="table table-striped table-hover" style={{ marginTop: '15px' }}>
                                    <caption className="wb-inv">{getText('petroleum_gdp_table_caption', lang)}</caption>
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
                                                <span aria-hidden="true">
                                                    {lang === 'en' ? '(billions of dollars)' : '(milliards de dollars)'}
                                                </span>
                                                <span className="wb-inv">
                                                    {lang === 'en' ? '(billions of dollars)' : '(milliards de dollars)'}
                                                </span>
                                            </th>
                                        </tr>
                                        <tr>
                                            <th
                                                scope="col"
                                                style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f0f0f0' }}
                                            >
                                                {getText('petroleum_gdp_table_col_year', lang)}
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
                                                    {formatCurrency(d.direct)}
                                                </td>
                                                <td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right' }}>
                                                    {formatCurrency(d.indirect)}
                                                </td>
                                                <td
                                                    style={{
                                                        border: '1px solid #ddd',
                                                        padding: '10px',
                                                        textAlign: 'right',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    {formatCurrency(d.total)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="petroleum-gdp-download-buttons">
                                <button type="button" onClick={downloadTableAsCSV}>
                                    {getText('petroleum_gdp_download_csv', lang)}
                                </button>
                                <button type="button" onClick={downloadTableAsDocx}>
                                    {getText('petroleum_gdp_download_docx', lang)}
                                </button>
                            </div>
                        </details>
                    </div>
                </div>

                <aside className="wb-fnote" role="note" style={{ marginTop: '20px', marginBottom: 0 }}>
                    <h2 id="fn-petroleum-gdp">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt>{lang === 'en' ? 'Footnote' : 'Note de bas de page'}</dt>
                        <dd style={{ marginBottom: 0 }}>
                            <p>{getText('petroleum_gdp_footnote', lang)}</p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default PetroleumGdp;
