import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const Page11 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);

    const COLORS = {
        direct: '#33bccb',
        indirect: '#7a9a9e',
        total: '#857650'
    };

    const gdpData = [
        { year: 2018, direct: 163, indirect: 36, total: 199 },
        { year: 2019, direct: 165, indirect: 36, total: 202 },
        { year: 2020, direct: 121, indirect: 30, total: 150 },
        { year: 2021, direct: 198, indirect: 43, total: 241 },
        { year: 2022, direct: 277, indirect: 58, total: 335 },
        { year: 2023, direct: 235, indirect: 51, total: 286 },
        { year: 2024, direct: 232, indirect: 50, total: 282 }
    ];

    const stripHtml = (text) => text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

    const hexToRgba = (hex, opacity = 1) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
        }
        return hex;
    };

    const formatNumber = (num) => {
        if (num === undefined || num === null) return '—';
        return Math.round(num).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');
    };

    const formatCurrency = (num) => {
        if (num === undefined || num === null) return '—';
        return lang === 'en' ? `$${formatNumber(num)}` : `${formatNumber(num)} $`;
    };

    const scrollToFootnote = (e) => {
        e.preventDefault();
        document.getElementById('fn1-page11')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const scrollToRef = (e) => {
        e.preventDefault();
        document.getElementById('fn1-rf-page11')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

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
            svgElements.forEach(svg => svg.setAttribute('aria-hidden', 'true'));

            const modebarButtons = plotContainer.querySelectorAll('.modebar-btn');
            modebarButtons.forEach(btn => {
                const dataTitle = btn.getAttribute('data-title');
                if (dataTitle && (dataTitle.includes('Download') || dataTitle.includes('Télécharger'))) {
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
        if (chartRef.current) observer.observe(chartRef.current, { childList: true, subtree: true });

        return () => {
            clearTimeout(timer);
            observer.disconnect();
        };
    }, [lang]);

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
            requestAnimationFrame(() => { isSyncingTop = false; });
        };

        const syncTableToTop = () => {
            if (isSyncingTop) return;
            isSyncingTable = true;
            topScroll.scrollLeft = tableScroll.scrollLeft;
            requestAnimationFrame(() => { isSyncingTable = false; });
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

    const years = gdpData.map(d => d.year);
    const directValues = gdpData.map(d => d.direct);
    const indirectValues = gdpData.map(d => d.indirect);
    const totalValues = gdpData.map(d => d.total);

    const directLabel = getText('page11_legend_direct', lang);
    const indirectLabel = getText('page11_legend_indirect', lang);
    const totalLabel = getText('page11_legend_total', lang);

    const getChartSummary = () => {
        const latest = gdpData[gdpData.length - 1];
        if (lang === 'en') {
            return `Line chart showing energy sector GDP from 2018 to 2024. In ${latest.year}, direct GDP was $${latest.direct} billion, indirect GDP was $${latest.indirect} billion, and total GDP was $${latest.total} billion.`;
        }
        return `Graphique linéaire montrant le PIB du secteur de l'énergie de 2018 à 2024. En ${latest.year}, le PIB direct était de ${latest.direct} milliards de dollars, le PIB indirect était de ${latest.indirect} milliards de dollars et le PIB total était de ${latest.total} milliards de dollars.`;
    };

    const getLineColors = (baseColor, traceIndex) => {
        if (selectedPoints === null) return baseColor;
        if (selectedPoints[traceIndex] && selectedPoints[traceIndex].length > 0) return baseColor;
        return hexToRgba(baseColor, 0.3);
    };

    const hoverTemplate = (label, values) => {
        return values.map((val, i) => {
            const yearVal = years[i];
            const formatted = lang === 'en' ? `$${formatNumber(val)}B` : `${formatNumber(val)} G$`;
            return `<b>${label}</b><br>${yearVal}: ${formatted}<extra></extra>`;
        });
    };

    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement) return;

        const title = `${stripHtml(getText('page11_chart_title', lang))} (2018-2024)`;
        const subtitle = stripHtml(getText('page11_chart_subtitle', lang));

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

                legendItems.forEach(item => {
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

                canvas.toBlob(blob => {
                    if (blob) saveAs(blob, `energy-sector-gdp-2018-2024.png`);
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
            lang === 'en' ? 'Year' : 'Année',
            `${directLabel} (${unitText})`,
            `${indirectLabel} (${unitText})`,
            `Total (${unitText})`
        ];
        const rows = gdpData.map(d => [d.year, d.direct, d.indirect, d.total]);
        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, 'energy-sector-gdp.csv');
    };

    const downloadTableAsDocx = async () => {
        const unitText = lang === 'en' ? '(billions of dollars)' : '(milliards de dollars)';
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: stripHtml(getText('page11_chart_title', lang)), bold: true, size: 28 })]
                    }),
                    new Table({
                        columnWidths: [1500, 2500, 2500, 2500],
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '', bold: true })] })] }),
                                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: unitText, bold: true })] })], columnSpan: 3 })
                                ]
                            }),
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: lang === 'en' ? 'Year' : 'Année', bold: true })] })] }),
                                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: directLabel, bold: true })] })] }),
                                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: indirectLabel, bold: true })] })] }),
                                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Total', bold: true })] })] })
                                ]
                            }),
                            ...gdpData.map(d => new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(d.year) })] })] }),
                                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatCurrency(d.direct) })] })] }),
                                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatCurrency(d.indirect) })] })] }),
                                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatCurrency(d.total), bold: true })] })] })
                                ]
                            }))
                        ]
                    })
                ]
            }]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, 'energy-sector-gdp.docx');
    };

    return (
        <main
            id="main-content"
            className="page-content page-11"
            role="main"
            aria-labelledby="page11-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
                .page-11 {
                    margin-right: -${layoutPadding?.right || 15}px;
                    width: calc(100% + ${layoutPadding?.right || 15}px);
                    padding-right: ${layoutPadding?.right || 15}px;
                }

                .page11-container {
                    width: 100%;
                    padding: 15px 0 40px 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                }

                .page11-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 0;
                    box-sizing: border-box;
                    overflow: visible;
                }

                .page11-chart-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: var(--gc-text);
                    text-align: center;
                    margin: 0 0 5px 4%;
                    padding-left: 450px;
                }

                .page11-chart-subtitle {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    color: var(--gc-text);
                    text-align: center;
                    margin: 0 0 15px 0;
                    padding-left: 525px;
                }

                .page11-chart {
                    width: 100%;
                    height: 300px;
                    flex-shrink: 0;
                    position: relative;
                    margin-bottom: 0 !important;
                }

                .page11-legend {
                    display: flex;
                    justify-content: center;
                    margin-top: 20px;
                    margin-bottom: 20px;
                    font-family: 'Noto Sans', sans-serif;
                    padding: 10px 20px;
                }

                .page11-legend-inner {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 15px 40px;
                    justify-content: center;
                }

                .page11-legend-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .page11-legend-line {
                    width: 30px;
                    height: 3px;
                    flex-shrink: 0;
                }

                .page11-legend-line.dashed {
                    background: repeating-linear-gradient(
                        to right,
                        currentColor,
                        currentColor 6px,
                        transparent 6px,
                        transparent 10px
                    );
                }

                .page11-legend-line.solid {
                    background: currentColor;
                }

                .page11-legend-label {
                    font-size: 18px;
                    color: var(--gc-text);
                }

                .page11-table-wrapper {
                    display: block;
                    width: 100%;
                    margin-top: 20px;
                    margin-bottom: 0;
                }

                .page11-table-wrapper details > summary {
                    display: block;
                    width: 100%;
                    padding: 12px 15px;
                    background-color: #26374a;
                    border: 1px solid #26374a;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    color: #ffffff;
                    list-style: none;
                }

                .page11-table-wrapper details > summary::-webkit-details-marker {
                    display: none;
                }

                .page11-table-wrapper details > summary:hover {
                    background-color: #1e2a3a;
                }

                .page11-table-wrapper .table-responsive {
                    display: block;
                    width: 100%;
                    overflow-x: auto !important;
                    -webkit-overflow-scrolling: touch;
                    border: 1px solid #ddd;
                    background: #fff;
                }

                .page11-table-wrapper .table-responsive table {
                    width: max-content !important;
                    min-width: 100%;
                    border-collapse: collapse;
                }

                .page11-table-wrapper .table-responsive table th,
                .page11-table-wrapper .table-responsive table td {
                    white-space: nowrap;
                    padding: 8px 12px;
                }

                .page11-download-buttons {
                    display: flex;
                    gap: 10px;
                    margin-top: 15px;
                    flex-wrap: wrap;
                }

                .page11-download-buttons button {
                    padding: 8px 16px;
                    border: 1px solid #26374a;
                    border-radius: 4px;
                    background: #26374a;
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    color: #ffffff;
                }

                .page11-download-buttons button:hover {
                    background: #1e2a3a;
                }

                @media (max-width: 1280px) {
                    .page11-chart-title { padding-left: 32%; margin-left: 7% !important; }
                    .page11-chart-subtitle { padding-left: 25%; margin-left: 5.5% !important; }
                }

                @media (max-width: 1097px) {
                    .page11-chart-subtitle { padding-left: 25%; margin-left: 1.5% !important; }
                }

                @media (max-width: 960px) {
                    .page11-chart-title { padding-left: 28%; }
                    .page11-chart-subtitle { padding-left: 10%; }
                }

                @media (max-width: 768px) {
                    .page-11 { border-right: none !important; }
                    .page11-chart-title { font-size: 26px; padding-left: 25%; }
                    .page11-chart-subtitle { font-size: 18px; padding-left: 0%; }
                    .page11-legend { flex-wrap: wrap; gap: 20px; }
                    .page11-legend-label { font-size: 16px; }
                }

                @media (max-width: 640px) {
                    .page11-chart-title { padding-left: 20%; }
                    .page11-chart-subtitle { padding-left: 0; }
                }

                @media (max-width: 480px) {
                    .page11-chart { height: 275px; }
                    .page11-legend-label { font-size: 14px; }
                    .page11-chart-title { padding-left: 18%; }
                    .page11-chart-subtitle { padding-left: 5%; }
                }

                @media (max-width: 384px) {
                    .page11-chart-title { padding-left: 0; margin-left: 0 !important; }
                    .page11-chart-subtitle { padding-left: 0; margin-left: 0 !important; }
                }

                @media (max-width: 384px) {
                    .page11-chart-title { padding-left: 17.5% !important; }
                    .page11-chart-subtitle { padding-left: 10% !important; }
                }
            `}</style>

            <div className="page11-container">
                <div className="page11-chart-frame">
                    <h2 className="page11-chart-title" aria-hidden="true">
                        {getText('page11_chart_title', lang)}
                        <sup id="fn1-rf-page11" style={{ verticalAlign: 'super', fontSize: '0.6em', lineHeight: 0 }}>
                            <a className="fn-lnk" href="#fn1-page11" onClick={scrollToFootnote}>
                                <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>1
                            </a>
                        </sup>
                    </h2>
                    <p className="page11-chart-subtitle" aria-hidden="true">
                        {getText('page11_chart_subtitle', lang)}
                    </p>

                    <div 
                        role="region" 
                        aria-label={getChartSummary()}
                        tabIndex="0"
                    >
                        <figure ref={chartRef} style={{ margin: 0, position: 'relative' }}>
                            {selectedPoints !== null && (
                                <button 
                                    onClick={() => setSelectedPoints(null)} 
                                    style={{ position: 'absolute', top: 0, right: 50, zIndex: 20, padding: '5px 10px', cursor: 'pointer' }}
                                >
                                    {lang === 'en' ? 'Clear' : 'Effacer'}
                                </button>
                            )}
                            <div aria-hidden="true">
                                <Plot
                                    data={[
                                        {
                                            x: years,
                                            y: directValues,
                                            type: 'scatter',
                                            mode: 'lines+markers',
                                            name: directLabel,
                                            line: { color: getLineColors(COLORS.direct, 0), width: 2, dash: 'dash' },
                                            marker: { color: getLineColors(COLORS.direct, 0), size: 6 },
                                            hovertemplate: hoverTemplate(directLabel, directValues)
                                        },
                                        {
                                            x: years,
                                            y: indirectValues,
                                            type: 'scatter',
                                            mode: 'lines+markers',
                                            name: indirectLabel,
                                            line: { color: getLineColors(COLORS.indirect, 1), width: 2, dash: 'dash' },
                                            marker: { color: getLineColors(COLORS.indirect, 1), size: 6 },
                                            hovertemplate: hoverTemplate(indirectLabel, indirectValues)
                                        },
                                        {
                                            x: years,
                                            y: totalValues,
                                            type: 'scatter',
                                            mode: 'lines+markers',
                                            name: totalLabel,
                                            line: { color: getLineColors(COLORS.total, 2), width: 3 },
                                            marker: { color: getLineColors(COLORS.total, 2), size: 8 },
                                            hovertemplate: hoverTemplate(totalLabel, totalValues)
                                        }
                                    ]}
                                    layout={{
                                        hoverlabel: { bgcolor: '#ffffff' },
                                        hovermode: 'closest',
                                        clickmode: 'event',
                                        dragmode: windowWidth <= 768 ? false : 'zoom',
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
                                                size: windowWidth <= 480 ? 10 : 12, 
                                                family: 'Arial, sans-serif' 
                                            },
                                            range: [0, 380],
                                            dtick: 50,
                                            automargin: true
                                        },
                                        showlegend: false,
                                        margin: { 
                                            l: 50,
                                            r: 20, 
                                            t: 40, 
                                            b: 50 
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
                                        modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d', 'toImage'],
                                        modeBarButtonsToAdd: [{
                                            name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
                                            icon: {
                                                width: 24,
                                                height: 24,
                                                path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z'
                                            },
                                            click: (gd) => downloadChartWithTitle(gd)
                                        }]
                                    }}
                                    onClick={(data) => {
                                        if (!data.points || data.points.length === 0) return;
                                        const clickedPoint = data.points[0];
                                        const traceIndex = clickedPoint.curveNumber;
                                        const pointIndex = clickedPoint.pointIndex;

                                        if (windowWidth <= 768) {
                                            const currentTime = new Date().getTime();
                                            const lastClick = lastClickRef.current;
                                            const isSamePoint = (traceIndex === lastClick.traceIndex && pointIndex === lastClick.pointIndex);
                                            const isDoubleTap = isSamePoint && (currentTime - lastClick.time < 300);
                                            
                                            lastClickRef.current = { time: currentTime, traceIndex, pointIndex };
                                            
                                            if (!isDoubleTap) return;
                                        }

                                        setSelectedPoints(prev => {
                                            const newSelection = prev ? [...prev] : [[], [], []];
                                            if (!newSelection[traceIndex]) newSelection[traceIndex] = [];
                                            
                                            const idx = newSelection[traceIndex].indexOf(pointIndex);
                                            if (idx > -1) {
                                                newSelection[traceIndex].splice(idx, 1);
                                            } else {
                                                newSelection[traceIndex].push(pointIndex);
                                            }
                                            const allEmpty = newSelection.every(arr => !arr || arr.length === 0);
                                            return allEmpty ? null : newSelection;
                                        });
                                    }}
                                    className="page11-chart"
                                    useResizeHandler={true}
                                />
                            </div>
                        </figure>
                    </div>

                    <div className="page11-legend" aria-hidden="true">
                        <div className="page11-legend-inner">
                            <div className="page11-legend-item">
                                <span className="page11-legend-line dashed" style={{ color: COLORS.direct }}></span>
                                <span className="page11-legend-label">{directLabel}</span>
                            </div>
                            <div className="page11-legend-item">
                                <span className="page11-legend-line dashed" style={{ color: COLORS.indirect }}></span>
                                <span className="page11-legend-label">{indirectLabel}</span>
                            </div>
                            <div className="page11-legend-item">
                                <span className="page11-legend-line solid" style={{ color: COLORS.total }}></span>
                                <span className="page11-legend-label">{totalLabel}</span>
                            </div>
                        </div>
                    </div>

                    <div className="page11-table-wrapper">
                        <details 
                            className="page11-data-table"
                            onToggle={(e) => setIsTableOpen(e.currentTarget.open)}
                        >
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
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
                                aria-label={lang === 'en' ? 'Energy sector GDP data table' : 'Tableau de données du PIB du secteur de l\'énergie'}
                            >
                                <table className="table table-striped table-hover" style={{ marginTop: '15px' }}>
                                    <caption className="wb-inv">
                                        {lang === 'en' ? 'Energy sector GDP data from 2018 to 2024' : 'Données du PIB du secteur de l\'énergie de 2018 à 2024'}
                                    </caption>
                                    <thead>
                                        <tr>
                                            <td style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f0f0f0' }} aria-hidden="true"></td>
                                            <th scope="colgroup" colSpan={3} style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f0f0f0', textAlign: 'center' }}>
                                                <span aria-hidden="true">{lang === 'en' ? '(billions of dollars)' : '(milliards de dollars)'}</span>
                                                <span className="wb-inv">{lang === 'en' ? '(billions of dollars)' : '(milliards de dollars)'}</span>
                                            </th>
                                        </tr>
                                        <tr>
                                            <th scope="col" style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f0f0f0' }}>{lang === 'en' ? 'Year' : 'Année'}</th>
                                            <th scope="col" style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f0f0f0', textAlign: 'right' }}>{directLabel}</th>
                                            <th scope="col" style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f0f0f0', textAlign: 'right' }}>{indirectLabel}</th>
                                            <th scope="col" style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f0f0f0', textAlign: 'right' }}>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {gdpData.map(d => (
                                            <tr key={d.year}>
                                                <th scope="row" style={{ border: '1px solid #ddd', padding: '10px' }}>{d.year}</th>
                                                <td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right' }}>{formatCurrency(d.direct)}</td>
                                                <td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right' }}>{formatCurrency(d.indirect)}</td>
                                                <td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(d.total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="page11-download-buttons">
                                <button onClick={downloadTableAsCSV}>
                                    {lang === 'en' ? 'Download as CSV' : 'Télécharger en CSV'}
                                </button>
                                <button onClick={downloadTableAsDocx}>
                                    {lang === 'en' ? 'Download as DOCX' : 'Télécharger en DOCX'}
                                </button>
                            </div>
                        </details>
                    </div>
                </div>

                <aside className="wb-fnote" role="note" style={{ marginTop: '20px', marginBottom: 0 }}>
                    <h2 id="fn-page11">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt>{lang === 'en' ? 'Footnote 1' : 'Note de bas de page 1'}</dt>
                        <dd id="fn1-page11" style={{ marginBottom: 0 }}>
                            <a href="#fn1-rf-page11" onClick={scrollToRef} className="fn-num" title={lang === 'en' ? 'Return to footnote 1 referrer' : 'Retour à la référence de la note de bas de page 1'}>
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>1
                            </a>
                            <p>
                                {getText('page11_footnote', lang)}
                            </p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page11;
