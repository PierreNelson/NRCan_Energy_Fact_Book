import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const Page10 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);

    const COLORS = {
        direct: '#857650',
        indirect: '#2AA2AC'
    };

    const employmentData = [
        { year: 2018, direct: 297, indirect: 395, total: 692 },
        { year: 2019, direct: 296, indirect: 395, total: 691 },
        { year: 2020, direct: 257, indirect: 349, total: 606 },
        { year: 2021, direct: 269, indirect: 367, total: 636 },
        { year: 2022, direct: 295, indirect: 399, total: 694 },
        { year: 2023, direct: 312, indirect: 423, total: 735 },
        { year: 2024, direct: 316, indirect: 429, total: 745 }
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

    const scrollToElement = (elementId) => (e) => {
        e.preventDefault();
        document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

    // Sync dual scrollbars for data table
    useEffect(() => {
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;

        if (!topScroll || !tableScroll) return;

        const syncScrollbars = () => {
            const table = tableScroll.querySelector('table');
            if (!table) return;

            const scrollWidth = table.offsetWidth;
            const containerWidth = tableScroll.clientWidth;

            const topSpacer = topScroll.firstElementChild;
            if (topSpacer) {
                topSpacer.style.width = `${scrollWidth}px`;
            }

            if (scrollWidth > containerWidth) {
                topScroll.style.display = 'block';
                topScroll.style.opacity = '1';
            } else {
                topScroll.style.display = 'none';
            }
        };

        const handleTopScroll = () => {
            tableScroll.scrollLeft = topScroll.scrollLeft;
        };
        const handleTableScroll = () => {
            topScroll.scrollLeft = tableScroll.scrollLeft;
        };

        topScroll.addEventListener('scroll', handleTopScroll);
        tableScroll.addEventListener('scroll', handleTableScroll);

        syncScrollbars();
        window.addEventListener('resize', syncScrollbars);

        const resizeObserver = new ResizeObserver(syncScrollbars);
        if (tableScroll.querySelector('table')) {
            resizeObserver.observe(tableScroll.querySelector('table'));
        }

        return () => {
            topScroll.removeEventListener('scroll', handleTopScroll);
            tableScroll.removeEventListener('scroll', handleTableScroll);
            window.removeEventListener('resize', syncScrollbars);
            resizeObserver.disconnect();
        };
    }, [isTableOpen]);

    const directLabel = getText('page10_legend_direct', lang);
    const indirectLabel = getText('page10_legend_indirect', lang);

    const scrollToFootnote = (e) => {
        e.preventDefault();
        document.getElementById('fn1-page10')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const scrollToRef = (e) => {
        e.preventDefault();
        document.getElementById('fn1-rf-page10')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const hoverTemplate = (label, values) => {
        return values.map((v, i) => {
            const y = employmentData[i].year;
            const tot = employmentData[i].total;
            const unit = lang === 'en' ? 'thousand jobs' : "milliers d'emplois";
            return `<b>${label}</b><br>${y}: ${v} ${unit}<br>Total: ${tot} ${unit}`;
        });
    };

    const getChartSummary = () => {
        const latest = employmentData[employmentData.length - 1];
        return lang === 'en'
            ? `Stacked bar chart showing energy sector employment from 2018 to 2024. In ${latest.year}, direct employment was ${latest.direct} thousand jobs and indirect employment was ${latest.indirect} thousand jobs, for a total of ${latest.total} thousand jobs.`
            : `Graphique à barres empilées montrant l'emploi dans le secteur de l'énergie de 2018 à 2024. En ${latest.year}, l'emploi direct était de ${latest.direct} milliers d'emplois et l'emploi indirect de ${latest.indirect} milliers d'emplois, pour un total de ${latest.total} milliers d'emplois.`;
    };

    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement) {
            alert('Could not find chart element.');
            return;
        }

        const title = `${stripHtml(getText('page10_chart_title', lang))} (2018-2024)`;
        const subtitle = getText('page10_chart_subtitle', lang);

        try {
            if (!window.Plotly) {
                alert('Plotly library not loaded.');
                return;
            }

            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 1200,
                height: 800,
                scale: 2
            });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                const titleHeight = 100;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight;

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.fillStyle = '#333333';
                ctx.font = 'bold 40px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, canvas.width / 2, 45);

                ctx.font = '28px Arial';
                ctx.fillText(subtitle, canvas.width / 2, 80);

                ctx.drawImage(img, 0, titleHeight);

                const link = document.createElement('a');
                link.download = lang === 'en' ? 'energy_sector_employment.png' : 'emplois_secteur_energie.png';
                link.href = canvas.toDataURL('image/png');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };

            img.src = imgData;
        } catch (error) {
            alert('Error downloading chart: ' + error.message);
        }
    };

    const downloadTableAsCSV = () => {
        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            `${directLabel} (${lang === 'en' ? 'thousands' : 'milliers'})`,
            `${indirectLabel} (${lang === 'en' ? 'thousands' : 'milliers'})`,
            `Total (${lang === 'en' ? 'thousands' : 'milliers'})`
        ];

        const rows = employmentData.map(d => [
            d.year,
            d.direct,
            d.indirect,
            d.total
        ]);

        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'energy_sector_employment.csv' : 'emplois_secteur_energie.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadTableAsDocx = async () => {
        const title = stripHtml(getText('page10_chart_title', lang));
        const unitText = lang === 'en' ? '(thousands of jobs)' : "(milliers d'emplois)";
        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            `${directLabel} ${unitText}`,
            `${indirectLabel} ${unitText}`,
            `Total ${unitText}`
        ];

        const headerRow = new TableRow({
            children: headers.map(header => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: header, bold: true, size: 22 })],
                    alignment: AlignmentType.CENTER
                })],
                shading: { fill: 'E6E6E6' }
            }))
        });

        const dataRows = employmentData.map(d => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(d.year), size: 22 })], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(d.direct), size: 22 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(d.indirect), size: 22 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(d.total), size: 22 })], alignment: AlignmentType.RIGHT })] })
            ]
        }));

        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: title, bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 }
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [1500, 2500, 2500, 2500],
                        rows: [headerRow, ...dataRows]
                    })
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'energy_sector_employment.docx' : 'emplois_secteur_energie.docx');
    };

    const years = employmentData.map(d => d.year);
    const directValues = employmentData.map(d => d.direct);
    const indirectValues = employmentData.map(d => d.indirect);
    const totalValues = employmentData.map(d => d.total);

    const getBarColors = (baseColor, traceIndex) => {
        if (selectedPoints === null) return baseColor;
        return employmentData.map((_, i) => {
            const isSelected = selectedPoints[traceIndex]?.includes(i);
            return isSelected ? baseColor : hexToRgba(baseColor, 0.3);
        });
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-10"
            role="main"
            aria-labelledby="page10-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
                .page-10 {
                    margin-right: -${layoutPadding?.right || 15}px;
                    width: calc(100% + ${layoutPadding?.right || 15}px);
                    padding-right: ${layoutPadding?.right || 15}px;
                }

                .page10-container {
                    width: 100%;
                    padding: 15px 0 40px 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                }

                .page10-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 0;
                    box-sizing: border-box;
                    overflow: visible;
                }

                .page10-chart-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: var(--gc-text);
                    text-align: center;
                    margin: 0 0 5px 0;
                    padding-left: 450px;
                }

                .page10-chart-subtitle {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    color: var(--gc-text);
                    text-align: center;
                    margin: 0 0 15px 0;
                    padding-left: 525px;
                }

                .page10-chart {
                    width: 100%;
                    height: 400px;
                    flex-shrink: 0;
                    position: relative;
                    margin-bottom: 0 !important;
                }

                .page10-legend {
                    display: flex;
                    justify-content: center;
                    margin-top: 20px;
                    margin-bottom: 20px;
                    font-family: 'Noto Sans', sans-serif;
                    padding: 10px 20px;
                }

                .page10-legend-inner {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 15px 40px;
                    justify-content: center;
                }

                .page10-legend-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .page10-legend-color {
                    width: 30px;
                    height: 20px;
                    flex-shrink: 0;
                }

                .page10-legend-label {
                    font-size: 18px;
                    color: var(--gc-text);
                }

                .page10-table-wrapper {
                    display: block;
                    width: 100%;
                    margin-top: 20px;
                    margin-bottom: 0;
                }

                .page10-table-wrapper details > summary {
                    display: block;
                    width: 100%;
                    padding: 12px 15px;
                    background-color: #fff;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    color: #333;
                    list-style: none;
                }

                .page10-table-wrapper details > summary::-webkit-details-marker {
                    display: none;
                }

                .page10-table-wrapper details > summary:hover {
                    background-color: #f5f5f5;
                }

                /* Table horizontal scroll */
                .page10-table-wrapper .table-responsive {
                    display: block;
                    width: 100%;
                    overflow-x: auto !important;
                    -webkit-overflow-scrolling: touch;
                    border: 1px solid #ddd;
                    background: #fff;
                }

                .page10-table-wrapper .table-responsive table {
                    width: max-content !important;
                    min-width: 100%;
                    border-collapse: collapse;
                }

                .page10-table-wrapper .table-responsive table th,
                .page10-table-wrapper .table-responsive table td {
                    white-space: nowrap;
                    padding: 8px 12px;
                }

                @media (max-width: 1280px) {
                    .page10-chart-title { padding-left: 32%; }
                    .page10-chart-subtitle { padding-left: 25%; }
                }

                @media (max-width: 960px) {
                    .page10-chart-title { padding-left: 28%; }
                    .page10-chart-subtitle { padding-left: 10%; }
                }

                @media (max-width: 768px) {
                    .page-10 { border-right: none !important; }
                    .page10-chart-title { font-size: 26px; padding-left: 25%; }
                    .page10-chart-subtitle { font-size: 18px; padding-left: 0% }
                    .page10-legend { flex-wrap: wrap; gap: 20px; }
                    .page10-legend-label { font-size: 16px; }
                    .page10-chart { height: 350px; }
                }

                @media (max-width: 640px) {
                    .page10-chart-title { padding-left: 20%; }
                    .page10-chart-subtitle { padding-left: 0; }
                    .page10-chart { height: 325px; }
                }

                @media (max-width: 480px) {
                    .page10-chart { height: 275px; }
                    .page10-legend-label { font-size: 14px; }
                    .page10-chart-title { padding-left: 10%; }
                }

                @media (max-width: 384px) {
                    .page10-chart-title { padding-left: 25%; }
                    .page10-chart { height: 250px; }
                    .page10-legend-inner {
                        flex-direction: column;       
                        align-items: flex-start;      
                        width: fit-content;           
                        margin: 0 auto;              
                    }
                }
            `}</style>

            <div className="page10-container">
                <div className="page10-chart-frame">
                    <h2 className="page10-chart-title" aria-hidden="true">
                        {getText('page10_chart_title', lang)}
                        <sup id="fn1-rf-page10" style={{ verticalAlign: 'super', fontSize: '0.6em', lineHeight: 0 }}>
                            <a className="fn-lnk" href="#fn1-page10" onClick={scrollToFootnote}>
                                <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>1
                            </a>
                        </sup>
                    </h2>
                    <p className="page10-chart-subtitle" aria-hidden="true">
                        {getText('page10_chart_subtitle', lang)}
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
                                            type: 'bar',
                                            name: directLabel,
                                            marker: { color: getBarColors(COLORS.direct, 0) },
                                            hovertext: hoverTemplate(directLabel, directValues),
                                            hoverinfo: 'text'
                                        },
                                        {
                                            x: years,
                                            y: indirectValues,
                                            type: 'bar',
                                            name: indirectLabel,
                                            marker: { color: getBarColors(COLORS.indirect, 1) },
                                            hovertext: hoverTemplate(indirectLabel, indirectValues),
                                            hoverinfo: 'text'
                                        }
                                    ]}
                                    layout={{
                                        barmode: 'stack',
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
                                            range: [0, 850],
                                            dtick: 100,
                                            automargin: true
                                        },
                                        showlegend: false,
                                        margin: { 
                                            l: 50,
                                            r: 20, 
                                            t: 20, 
                                            b: 50 
                                        },
                                        autosize: true,
                                        paper_bgcolor: 'rgba(0,0,0,0)',
                                        plot_bgcolor: 'rgba(0,0,0,0)',
                                        bargap: 0.3
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
                                            if (prev === null) {
                                                const newSelection = [[], []];
                                                newSelection[traceIndex] = [pointIndex];
                                                return newSelection;
                                            }
                                            const newSelection = prev.map(arr => arr ? [...arr] : []);
                                            const currentSeriesSelection = newSelection[traceIndex] || [];
                                            if (currentSeriesSelection.includes(pointIndex)) {
                                                newSelection[traceIndex] = currentSeriesSelection.filter(i => i !== pointIndex);
                                            } else {
                                                newSelection[traceIndex] = [...currentSeriesSelection, pointIndex];
                                            }
                                            const allEmpty = newSelection.every(arr => !arr || arr.length === 0);
                                            return allEmpty ? null : newSelection;
                                        });
                                    }}
                                    className="page10-chart"
                                    useResizeHandler={true}
                                />
                            </div>
                        </figure>
                    </div>

                    <div className="page10-legend" aria-hidden="true">
                        <div className="page10-legend-inner">
                            <div className="page10-legend-item">
                                <span className="page10-legend-color" style={{ backgroundColor: COLORS.direct }}></span>
                                <span className="page10-legend-label">{directLabel}</span>
                            </div>
                            <div className="page10-legend-item">
                                <span className="page10-legend-color" style={{ backgroundColor: COLORS.indirect }}></span>
                                <span className="page10-legend-label">{indirectLabel}</span>
                            </div>
                        </div>
                    </div>

                    <div className="page10-table-wrapper">
                        <details 
                            className="page10-data-table"
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
                                aria-label={lang === 'en' ? 'Energy sector employment data table' : 'Tableau de données sur l\'emploi dans le secteur de l\'énergie'}
                            >
                                <table className="table table-striped table-hover" style={{ marginTop: '15px' }}>
                                    <caption className="wb-inv">
                                        {lang === 'en' ? 'Energy sector employment data from 2018 to 2024' : 'Données sur l\'emploi dans le secteur de l\'énergie de 2018 à 2024'}
                                    </caption>
                                    <thead>
                                        <tr>
                                            <td style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f0f0f0' }} aria-hidden="true"></td>
                                            <th scope="colgroup" colSpan={3} style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f0f0f0', textAlign: 'center' }}>
                                                <span aria-hidden="true">{lang === 'en' ? '(thousands of jobs)' : "(milliers d'emplois)"}</span>
                                                <span className="wb-inv">{lang === 'en' ? '(thousands of jobs)' : "(milliers d'emplois)"}</span>
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
                                        {employmentData.map(d => (
                                            <tr key={d.year}>
                                                <th scope="row" style={{ border: '1px solid #ddd', padding: '10px' }}>{d.year}</th>
                                                <td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right' }} aria-label={`${d.year}, ${directLabel}: ${d.direct} ${lang === 'en' ? 'thousand jobs' : 'milliers d\'emplois'}`}>{d.direct}</td>
                                                <td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right' }} aria-label={`${d.year}, ${indirectLabel}: ${d.indirect} ${lang === 'en' ? 'thousand jobs' : 'milliers d\'emplois'}`}>{d.indirect}</td>
                                                <td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'right', fontWeight: 'bold' }} aria-label={`${d.year}, Total: ${d.total} ${lang === 'en' ? 'thousand jobs' : 'milliers d\'emplois'}`}>{d.total}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                                <button 
                                    onClick={downloadTableAsCSV} 
                                    style={{ padding: '8px 16px', backgroundColor: '#f9f9f9', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#333' }}
                                >
                                    {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                </button>
                                <button 
                                    onClick={downloadTableAsDocx} 
                                    style={{ padding: '8px 16px', backgroundColor: '#f9f9f9', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#333' }}
                                >
                                    {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                </button>
                            </div>
                        </details>
                    </div>
                </div>

                <aside className="wb-fnote" role="note" style={{ marginTop: '20px', marginBottom: 0 }}>
                    <h2 id="fn-page10">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt>{lang === 'en' ? 'Footnote 1' : 'Note de bas de page 1'}</dt>
                        <dd id="fn1-page10" style={{ marginBottom: 0 }}>
                            <a href="#fn1-rf-page10" onClick={scrollToRef} className="fn-num" title={lang === 'en' ? 'Return to footnote 1 referrer' : 'Retour à la référence de la note de bas de page 1'}>
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>1
                            </a>
                            <p>
                                {getText('page10_footnote', lang)}
                            </p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page10;
