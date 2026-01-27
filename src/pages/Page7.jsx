import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getNominalGDPData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const Page7 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [year, setYear] = useState(null);
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const chartRef = useRef(null);
    const stripHtml = (text) => text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    const hexToRgba = (hex, opacity = 1) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
        }
        return hex;
    };

    const minYear = useMemo(() => pageData.length > 0 ? pageData[0].year : 2022, [pageData]);
    const maxYear = useMemo(() => pageData.length > 0 ? pageData[pageData.length - 1].year : 2024, [pageData]);

    useEffect(() => {
        const handleResize = () => {
            const newWidth = window.innerWidth;
            setWindowWidth(newWidth);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        getNominalGDPData()
            .then(data => {
                setPageData(data);
                if (data && data.length > 0) {
                    setYear(data[data.length - 1].year);
                }
            })
            .catch(err => {
                console.error("Failed to load nominal GDP data:", err);
                setError(err.message || 'Failed to load data');
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        if (!chartRef.current) return;
        
        const setupChartAccessibility = () => {
            const plotContainer = chartRef.current;
            if (!plotContainer) return;

            const svgElements = plotContainer.querySelectorAll('.main-svg, .svg-container svg');
            svgElements.forEach(svg => {
                svg.setAttribute('aria-hidden', 'true');
            });

            const modebarButtons = plotContainer.querySelectorAll('.modebar-btn');
            modebarButtons.forEach(btn => {
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
        if (chartRef.current) {
            observer.observe(chartRef.current, { childList: true, subtree: true });
        }

        return () => {
            clearTimeout(timer);
            observer.disconnect();
        };
    }, [pageData, lang, year]);

    const COLORS = {
        'energy_total': '#245e7f',
        'non_energy': '#c4bfb5',
    };

    const currentData = useMemo(() => {
        if (!year || pageData.length === 0) return null;
        return pageData.find(d => d.year === year) || pageData[pageData.length - 1];
    }, [year, pageData]);

    const chartTitle = `${stripHtml(getText('page7_chart_title', lang))} (${year})`;

    const getChartDataSummary = () => {
        if (!currentData) return '';
        const billionText = lang === 'en' ? 'billion dollars' : 'milliards de dollars';
        const energyTotal = Math.round(currentData.total / 1000);
        const energyDirect = Math.round(currentData.direct / 1000);
        const energyIndirect = Math.round(currentData.indirect / 1000);
        const marketGDP = Math.round((currentData.market || 2879000) / 1000);
        const nonEnergy = marketGDP - energyTotal;
        
        if (lang === 'en') {
            return `Pie chart showing Canada's nominal GDP composition for ${year}. Energy sector total: ${energyTotal} ${billionText} (${currentData.total_pct}% of GDP), consisting of Energy Direct at ${energyDirect} ${billionText} (${currentData.direct_pct}%) and Energy Indirect at ${energyIndirect} ${billionText} (${currentData.indirect_pct}%). Non-energy: ${nonEnergy} ${billionText} (${(100 - currentData.total_pct).toFixed(1)}%).`;
        } else {
            return `Graphique circulaire montrant la composition du PIB nominal du Canada pour ${year}. Total du secteur de l'énergie : ${energyTotal} ${billionText} (${currentData.total_pct} % du PIB), composé de l'Énergie directe à ${energyDirect} ${billionText} (${currentData.direct_pct} %) et de l'Énergie indirecte à ${energyIndirect} ${billionText} (${currentData.indirect_pct} %). Hors énergie : ${nonEnergy} ${billionText} (${(100 - currentData.total_pct).toFixed(1)} %).`;
        }
    };

    const getLegendText = () => {
        if (!currentData) return '';
        const billionText = lang === 'en' ? 'billion dollars' : 'milliards de dollars';
        
        if (lang === 'en') {
            return `Canadian GDP breakdown. Energy Direct: ${currentData.direct_pct}% or ${Math.round(currentData.direct / 1000)} ${billionText}. This includes Petroleum at ${currentData.petroleum_pct}%, Electricity at ${currentData.electricity_pct}%, and Other at ${currentData.other_pct}%. Energy Indirect: ${currentData.indirect_pct}% or ${Math.round(currentData.indirect / 1000)} ${billionText}.`;
        } else {
            return `Répartition du PIB canadien. Énergie directe : ${currentData.direct_pct} % ou ${Math.round(currentData.direct / 1000)} ${billionText}. Cela comprend le Pétrole à ${currentData.petroleum_pct} %, l'Électricité à ${currentData.electricity_pct} % et Autres à ${currentData.other_pct} %. Énergie indirecte : ${currentData.indirect_pct} % ou ${Math.round(currentData.indirect / 1000)} ${billionText}.`;
        }
    };

    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || document.querySelector('.page7-chart .js-plotly-plot') || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement) {
            console.error('Plot element not found');
            alert('Could not find chart element. Please try again.');
            return;
        }

        const title = chartTitle;

        try {
            if (!window.Plotly) {
                console.error('Plotly not available on window');
                alert('Plotly library not loaded. Please refresh the page and try again.');
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
            const chartImage = new Image();

            await new Promise((resolve, reject) => {
                chartImage.onload = resolve;
                chartImage.onerror = reject;
                chartImage.src = imgData;
            });

            const titleHeight = 80;
            canvas.width = chartImage.width;
            canvas.height = chartImage.height + titleHeight;

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#333333';
            ctx.font = 'bold 48px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(title, canvas.width / 2, 55);
            ctx.drawImage(chartImage, 0, titleHeight);

            canvas.toBlob((blob) => {
                if (blob) {
                    const filename = lang === 'en' 
                        ? `economic_contributions_${year}.png` 
                        : `contributions_economiques_${year}.png`;
                    saveAs(blob, filename);
                }
            }, 'image/png');

        } catch (error) {
            console.error('Error downloading chart:', error);
            alert('Failed to download chart. Please try again.');
        }
    };

    const downloadTableAsDocx = async () => {
        if (pageData.length === 0) return;
        
        const title = lang === 'en' 
            ? `Energy's nominal GDP contribution for Canada (${minYear}-${maxYear})`
            : `Contribution de l'énergie au PIB nominal du Canada (${minYear}-${maxYear})`;

        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            lang === 'en' ? 'Energy Direct ($ billions)' : 'Énergie directe (milliards $)',
            lang === 'en' ? 'Energy Indirect ($ billions)' : 'Énergie indirecte (milliards $)',
            lang === 'en' ? 'Total ($ billions)' : 'Total (milliards $)',
            lang === 'en' ? 'Total (% of GDP)' : 'Total (% du PIB)',
        ];

        const headerRow = new TableRow({
            children: headers.map(header => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 22 })], alignment: AlignmentType.CENTER })],
                shading: { fill: 'E6E6E6' },
            })),
        });

        const dataRows = pageData.map(yearData => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(yearData.year), size: 22 })], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `$${Math.round(yearData.direct / 1000)}`, size: 22 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `$${Math.round(yearData.indirect / 1000)}`, size: 22 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `$${Math.round(yearData.total / 1000)}`, bold: true, size: 22 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${yearData.total_pct}%`, bold: true, size: 22 })], alignment: AlignmentType.RIGHT })] }),
            ],
        }));

        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: title, bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                    }),
                    new Table({
                        rows: [headerRow, ...dataRows],
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [1500, 2200, 2200, 1800, 1800],
                    }),
                ],
            }],
        });

        const blob = await Packer.toBlob(doc);
        const filename = lang === 'en' 
            ? `economic_contributions_${minYear}-${maxYear}.docx` 
            : `contributions_economiques_${minYear}-${maxYear}.docx`;
        saveAs(blob, filename);
    };

    const downloadTableAsCSV = () => {
        if (pageData.length === 0) return;

        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            lang === 'en' ? 'Energy Direct ($ billions)' : 'Énergie directe (milliards $)',
            lang === 'en' ? 'Energy Indirect ($ billions)' : 'Énergie indirecte (milliards $)',
            lang === 'en' ? 'Total ($ billions)' : 'Total (milliards $)',
            lang === 'en' ? 'Total (% of GDP)' : 'Total (% du PIB)',
        ];

        const dataRows = pageData.map(yearData => [
            yearData.year,
            Math.round(yearData.direct / 1000),
            Math.round(yearData.indirect / 1000),
            Math.round(yearData.total / 1000),
            yearData.total_pct
        ]);

        const csvContent = [headers.join(','), ...dataRows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const filename = lang === 'en' 
            ? `economic_contributions_${minYear}-${maxYear}.csv` 
            : `contributions_economiques_${minYear}-${maxYear}.csv`;
        saveAs(blob, filename);
    };

    const chartData = useMemo(() => {
        if (!currentData) return [];
        
        const energyTotal = currentData.total || 0;
        const marketGDP = currentData.market || 2879000;
        const nonEnergy = marketGDP - energyTotal;
        const energyPct = currentData.total_pct || 0;
        const nonEnergyPct = 100 - energyPct;

        const energyLabel = `<b>${energyPct}%</b><br>or<br><b>$${Math.round(energyTotal / 1000)} billion</b>`;
        const energyLabelFr = `<b>${energyPct} %</b><br>ou<br><b>${Math.round(energyTotal / 1000)} milliards $</b>`;

        return [{
            type: 'pie',
            values: [energyTotal, nonEnergy],
            labels: [
                getText('page7_energy_total', lang),
                getText('page7_non_energy', lang)
            ],
            text: [lang === 'en' ? energyLabel : energyLabelFr, ''],
            texttemplate: windowWidth <= 768 ? '%{percent:.1%}' : '%{text}',
            textinfo: windowWidth <= 768 ? 'percent' : 'text',
            textposition: windowWidth <= 768 ? 'inside' : 'outside',
            textfont: { 
                size: windowWidth <= 480 ? 14 : windowWidth <= 768 ? 16 : 24, 
                family: 'Arial, sans-serif',
                color: windowWidth <= 768 ? '#ffffff' : '#221e1f'
            },
            outsidetextfont: { 
                color: '#221e1f',
                size: windowWidth <= 768 ? 16 : 24,
                family: 'Arial, sans-serif'
            },
            hoverinfo: 'text',
            hovertext: [
                `<b>${getText('page7_energy_total', lang)}</b><br>$${Math.round(energyTotal / 1000)} ${lang === 'en' ? 'billion' : 'milliards'}<br>${energyPct}%`,
                `<b>${getText('page7_non_energy', lang)}</b><br>$${Math.round(nonEnergy / 1000)} ${lang === 'en' ? 'billion' : 'milliards'}<br>${nonEnergyPct.toFixed(1)}%`
            ],
            hoverlabel: {
                bgcolor: '#ffffff',
                bordercolor: '#000000',
                font: { color: '#000000', size: windowWidth <= 640 ? 12 : 14, family: 'Arial, sans-serif' }
            },
            marker: {
                colors: [COLORS.energy_total, COLORS.non_energy],
                line: { color: '#ffffff', width: 2 }
            },
            hole: 0.0,
            direction: 'clockwise',
            rotation: 45,
            sort: false,
            pull: [0.02, 0],
        }];
    }, [currentData, lang, windowWidth]);

    const formatBillions = (val) => {
        if (lang === 'fr') {
            return `${Math.round(val / 1000)} milliards $`;
        }
        return `$${Math.round(val / 1000)} billion`;
    };

    const formatPercent = (val) => {
        if (lang === 'fr') {
            return `${val.toString().replace('.', ',')} %`;
        }
        return `${val}%`;
    };

    if (loading) {
        return (
            <main id="main-content" tabIndex="-1" className="page-content page-7" role="main">
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                    <p>{lang === 'en' ? 'Loading...' : 'Chargement...'}</p>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main id="main-content" tabIndex="-1" className="page-content page-7" role="main">
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                    <p style={{ color: 'red' }}>{lang === 'en' ? 'Error loading data' : 'Erreur de chargement'}: {error}</p>
                </div>
            </main>
        );
    }

    const captionId = 'page7-table-caption';
    const billionsSR = lang === 'en' ? 'billions of dollars' : 'milliards de dollars';

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-7" 
            role="main"
            style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}
        >
            <style>{`
                .page7-chart {
                    position: relative;
                    width: 100%;
                    margin-top: 20px;
                }
                .page7-chart .js-plotly-plot {
                    width: 100% !important;
                }
                .page7-legend {
                    margin-left: 60px;
                    padding-top: 10px;
                }
                .page7-legend-item {
                    margin-bottom: 12px;
                    font-size: 1.2rem;
                }
                .page7-legend-header {
                    font-weight: bold;
                    color: #245e7f;
                    font-size: 1.5rem;
                    margin-bottom: 8px;
                    text-transform: uppercase;
                }
                .page7-legend-sub {
                    margin-left: 25px;
                    color: #58585a;
                    font-size: 1.25rem;
                    text-transform: uppercase;
                    margin-bottom: 6px;
                    font-weight: bold;
                }
                .page7-canadian-gdp {
                    font-weight: bold;
                    font-size: 1.6rem;
                    margin-bottom: 25px;
                    color: #242021;
                    text-transform: uppercase;
                }
                .year-selector {
                    display: flex;
                    align-items: center;
                    margin: 10px 0 20px 0;
                    padding: 2px 0;
                    position: relative;
                    z-index: 10;
                }
                .year-selector label {
                    font-weight: bold;
                    margin-right: 15px;
                    font-size: 18px;
                    font-family: Arial, sans-serif;
                }
                .year-selector select {
                    padding: 8px 12px;
                    font-size: 16px;
                    font-family: Arial, sans-serif;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    background-color: #fff;
                    cursor: pointer;
                    min-width: 100px;
                }
                .year-selector select:hover {
                    border-color: #007bff;
                }
                .year-selector select:focus {
                    outline: 2px solid #005fcc;
                    outline-offset: 2px;
                    border-color: #007bff;
                }
                .data-table-wrapper {
                    margin-top: 20px;
                }
                .data-table-wrapper summary {
                    cursor: pointer;
                    padding: 10px 15px;
                    background-color: #f5f5f5;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    list-style: none;
                    font-weight: bold;
                }
                .data-table-wrapper summary::-webkit-details-marker {
                    display: none;
                }
                .data-table-wrapper[open] summary {
                    border-bottom-left-radius: 0;
                    border-bottom-right-radius: 0;
                }
                .wb-inv {
                    clip: rect(1px, 1px, 1px, 1px);
                    height: 1px;
                    margin: 0;
                    overflow: hidden;
                    position: absolute;
                    width: 1px;
                    white-space: nowrap;
                }
                @media (max-width: 768px) {
                    .page7-content-wrapper {
                        flex-direction: column !important;
                    }
                    .page7-legend {
                        margin-left: 0;
                        margin-top: 20px;
                    }
                    .page7-legend-header {
                        font-size: 1.2rem;
                    }
                    .page7-legend-sub {
                        font-size: 1.1rem;
                    }
                    .page7-canadian-gdp {
                        font-size: 1.3rem;
                    }
                }
                @media (min-width: 1200px) {
                    .page7-legend {
                        margin-left: 100px;
                    }
                    .page7-legend-header {
                        font-size: 1.6rem;
                    }
                    .page7-legend-sub {
                        font-size: 1.35rem;
                    }
                    .page7-canadian-gdp {
                        font-size: 1.8rem;
                    }
                }
            `}</style>

            <header>
                <h1 style={{ 
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    fontSize: '2.8rem',
                    color: '#245e7f',
                    marginBottom: '5px'
                }}>
                    {getText('page7_title', lang)}
                </h1>
                <h2 style={{ 
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '1.8rem',
                    fontWeight: 'bold',
                    color: '#5d5d5f',
                }}>
                    {getText('page7_subtitle', lang)} ({year})
                </h2>
                <h3 style={{ 
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '1.6rem',
                    fontWeight: 'bold',
                    color: '#527291',
                    marginBottom: '20px',
                    marginTop: '-10px',
                }}>
                    {getText('page7_subtitle2', lang)}
                </h3>
            </header>

            <div className="year-selector">
                <label id="year-label" htmlFor="year-select">
                    {getText('year_slider_label', lang)}
                </label>
                <select
                    id="year-select"
                    value={year || maxYear}
                    onChange={(e) => setYear(parseInt(e.target.value))}
                    aria-labelledby="year-label"
                >
                    {pageData.map(yearData => (
                        <option key={yearData.year} value={yearData.year}>
                            {yearData.year}
                        </option>
                    ))}
                </select>
            </div>

            <h4 style={{ 
                fontFamily: 'Arial, sans-serif',
                fontSize: '1.4rem',
                fontWeight: 'bold',
                color: '#221e1f',
                marginBottom: '15px',
                textTransform: 'uppercase'
            }}>
                {getText('page7_chart_title', lang)}
            </h4>

            <div className="page7-content-wrapper" style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div 
                    role="region" 
                    aria-label={getChartDataSummary()}
                    style={{ flex: '0 0 auto', width: windowWidth <= 768 ? '100%' : '500px' }}
                >
                    <figure ref={chartRef} className="page7-chart" style={{ margin: 0, position: 'relative' }}>
                        <Plot
                            data={chartData}
                            layout={{
                                autosize: true,
                                clickmode: 'event',
                                dragmode: false,
                                showlegend: false,
                                margin: { t: 30, r: 150, b: 30, l: 30 },
                                paper_bgcolor: 'rgba(0,0,0,0)',
                                plot_bgcolor: 'rgba(0,0,0,0)',
                            }}
                            config={{
                                displayModeBar: true,
                                displaylogo: false,
                                responsive: true,
                                scrollZoom: false,
                                staticPlot: false,
                                modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d', 'toImage'],
                                modeBarButtonsToAdd: [{
                                    name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
                                    icon: {
                                        width: 24,
                                        height: 24,
                                        path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z',
                                        transform: 'matrix(1 0 0 1 0 0)'
                                    },
                                    click: () => downloadChartWithTitle()
                                }]
                            }}
                            style={{ width: '100%', height: '350px' }}
                        />
                    </figure>
                </div>

                <aside 
                    className="page7-legend"
                    role="region"
                    aria-label={getLegendText()}
                >
                    <div aria-hidden="true">
                        <div className="page7-canadian-gdp">
                            {getText('page7_canadian_gdp', lang)}
                        </div>
                        
                        <div className="page7-legend-header">
                            {getText('page7_energy_direct', lang)} {formatPercent(currentData?.direct_pct || 0)} ({formatBillions(currentData?.direct || 0)})
                        </div>
                        <div className="page7-legend-sub">
                            {getText('page7_petroleum', lang)} {formatPercent(currentData?.petroleum_pct || 0)}
                        </div>
                        <div className="page7-legend-sub">
                            {getText('page7_electricity', lang)} {formatPercent(currentData?.electricity_pct || 0)}
                        </div>
                        <div className="page7-legend-sub">
                            {getText('page7_other', lang)} {formatPercent(currentData?.other_pct || 0)}
                        </div>
                        
                        <div className="page7-legend-header" style={{ marginTop: '20px' }}>
                            {getText('page7_energy_indirect', lang)} {formatPercent(currentData?.indirect_pct || 0)} ({formatBillions(currentData?.indirect || 0)})
                        </div>
                    </div>
                </aside>
            </div>

            <details 
                className="data-table-wrapper"
                onToggle={(e) => setIsTableOpen(e.currentTarget.open)}
            >
                <summary role="button" aria-expanded={isTableOpen}>
                    <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                    {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                    <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                </summary>

                <div className="table-responsive" role="region" aria-labelledby={captionId} style={{ overflowX: 'auto', border: '1px solid #ddd', borderTop: 'none', padding: '15px' }}>
                    <table className="table table-striped table-hover" style={{ minWidth: '500px', borderCollapse: 'collapse' }}>
                        <caption id={captionId} className="wb-inv">
                            {lang === 'en' 
                                ? `Energy's nominal GDP contribution for Canada, ${minYear} to ${maxYear}. Values in billions of dollars.` 
                                : `Contribution de l'énergie au PIB nominal du Canada, ${minYear} à ${maxYear}. Valeurs en milliards de dollars.`}
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd' }}>
                                    {lang === 'en' ? 'Year' : 'Année'}
                                </th>
                                <th scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd' }}>
                                    {lang === 'en' ? 'Energy Direct' : 'Énergie directe'}<br/>
                                    <span aria-hidden="true">{lang === 'en' ? '($ billions)' : '(milliards $)'}</span>
                                    <span className="wb-inv">{lang === 'en' ? 'in billions of dollars' : 'en milliards de dollars'}</span>
                                </th>
                                <th scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd' }}>
                                    {lang === 'en' ? 'Energy Indirect' : 'Énergie indirecte'}<br/>
                                    <span aria-hidden="true">{lang === 'en' ? '($ billions)' : '(milliards $)'}</span>
                                    <span className="wb-inv">{lang === 'en' ? 'in billions of dollars' : 'en milliards de dollars'}</span>
                                </th>
                                <th scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd' }}>
                                    {lang === 'en' ? 'Total' : 'Total'}<br/>
                                    <span aria-hidden="true">{lang === 'en' ? '($ billions)' : '(milliards $)'}</span>
                                    <span className="wb-inv">{lang === 'en' ? 'in billions of dollars' : 'en milliards de dollars'}</span>
                                </th>
                                <th scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd' }}>
                                    {lang === 'en' ? '% of GDP' : '% du PIB'}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageData.map((yearData) => (
                                <tr key={yearData.year}>
                                    <th scope="row" className="text-center" style={{ fontWeight: 'bold', padding: '8px', border: '1px solid #ddd' }}>
                                        {yearData.year}
                                    </th>
                                    <td 
                                        className="text-right" 
                                        style={{ textAlign: 'right', padding: '8px', border: '1px solid #ddd' }}
                                        aria-label={`${yearData.year}, ${lang === 'en' ? 'Energy Direct' : 'Énergie directe'}: ${Math.round(yearData.direct / 1000)} ${billionsSR}`}
                                    >
                                        ${Math.round(yearData.direct / 1000)}
                                    </td>
                                    <td 
                                        className="text-right" 
                                        style={{ textAlign: 'right', padding: '8px', border: '1px solid #ddd' }}
                                        aria-label={`${yearData.year}, ${lang === 'en' ? 'Energy Indirect' : 'Énergie indirecte'}: ${Math.round(yearData.indirect / 1000)} ${billionsSR}`}
                                    >
                                        ${Math.round(yearData.indirect / 1000)}
                                    </td>
                                    <td 
                                        className="text-right" 
                                        style={{ textAlign: 'right', padding: '8px', fontWeight: 'bold', border: '1px solid #ddd' }}
                                        aria-label={`${yearData.year}, ${lang === 'en' ? 'Total' : 'Total'}: ${Math.round(yearData.total / 1000)} ${billionsSR}`}
                                    >
                                        ${Math.round(yearData.total / 1000)}
                                    </td>
                                    <td 
                                        className="text-right" 
                                        style={{ textAlign: 'right', padding: '8px', fontWeight: 'bold', border: '1px solid #ddd' }}
                                        aria-label={`${yearData.year}, ${lang === 'en' ? 'Percentage of GDP' : 'Pourcentage du PIB'}: ${yearData.total_pct}%`}
                                    >
                                        {yearData.total_pct}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '15px' }}>
                        <button
                            onClick={downloadTableAsCSV}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#f9f9f9',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontFamily: 'Arial, sans-serif',
                                fontWeight: 'bold',
                                color: '#333'
                            }}
                        >
                            {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                        </button>
                        <button
                            onClick={downloadTableAsDocx}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#f9f9f9',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontFamily: 'Arial, sans-serif',
                                fontWeight: 'bold',
                                color: '#333'
                            }}
                        >
                            {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                        </button>
                    </div>
                </div>
            </details>

            <aside className="wb-fnote" role="note" style={{ marginTop: 'auto', paddingTop: '30px' }}>
                <h2 className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                <dl style={{ margin: 0 }}>
                    <dt style={{ display: 'none' }}>*</dt>
                    <dd style={{ margin: 0 }}>
                        <p style={{ 
                            fontSize: '1rem', 
                            color: '#000000', 
                            lineHeight: 1.6, 
                            margin: 0,
                            whiteSpace: 'pre-line' 
                        }}>
                            {getText('page7_footnote', lang)}
                        </p>
                    </dd>
                </dl>
            </aside>
        </main>
    );
};

export default Page7;
