
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getCapitalExpendituresData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

const Page24 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [isChartInteractive, setIsChartInteractive] = useState(typeof window !== 'undefined' ? window.innerWidth > 768 : true);

    const [hiddenSeries, setHiddenSeries] = useState([]); 
    const [selectedPoints, setSelectedPoints] = useState(null);

    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isChartInteractive && chartRef.current && !chartRef.current.contains(event.target)) {
                setIsChartInteractive(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isChartInteractive]);

    useEffect(() => {
        const handleResize = () => {
            const newWidth = window.innerWidth;
            setWindowWidth(newWidth);
            if (newWidth > 768) {
                setIsChartInteractive(true);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        getCapitalExpendituresData()
            .then(data => setPageData(data))
            .catch(err => {
                console.error("Failed to load capital expenditures data:", err);
                setError(err.message || 'Failed to load data');
            })
            .finally(() => setLoading(false));
        import('./Page25');
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
    }, [pageData, lang]);

    const { latestRow, peakRow, row2020 } = useMemo(() => {
        if (pageData.length === 0) return { latestRow: null, peakRow: null, row2020: null };
        const latest = pageData[pageData.length - 1];
        const peak = [...pageData].sort((a, b) => b.total - a.total)[0];
        const r2020 = pageData.find(d => d.year === 2020) || latest;
        return { latestRow: latest, peakRow: peak, row2020: r2020 };
    }, [pageData]);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!latestRow) return <div>No data available.</div>;

    const totalLatestBillion = latestRow.total / 1000;
    const peakTotalBillion = peakRow.total / 1000;
    const low2020Billion = row2020.total / 1000;
    const declineFromPeakPct = ((peakTotalBillion - totalLatestBillion) / peakTotalBillion) * 100;
    const reboundFrom2020Pct = ((totalLatestBillion - low2020Billion) / low2020Billion) * 100;
    const oilGasBillion = latestRow.oil_gas / 1000;
    const electricityBillion = latestRow.electricity / 1000;

    const formatBillion = (val) => {
        const text = getText('billion', lang);
        return lang === 'en' ? `$${val.toFixed(0)} ${text}` : `${val.toFixed(0)} $ ${text}`;
    };

    const formatBillionSR = (val) => {
        const text = getText('billion', lang);
        return `${val.toFixed(1)} ${text} ${lang === 'en' ? 'dollars' : 'dollars'}`;
    };

    const years = pageData.map(d => d.year);
    const minYear = years.length > 0 ? Math.min(...years) : 2007;
    const maxYear = years.length > 0 ? Math.max(...years) : 2024;
    const chartTitle = `${getText('page24_chart_title_prefix', lang)}${minYear} ${lang === 'en' ? 'to' : 'à'} ${maxYear}`;
    const tickVals = [];
    for (let y = minYear + 1; y <= maxYear + 1; y += 2) {
        tickVals.push(y);
    }

    const oilGasValues = pageData.map(d => d.oil_gas / 1000);
    const electricValues = pageData.map(d => d.electricity / 1000);
    const otherValues = pageData.map(d => d.other / 1000);
    const totalValues = pageData.map(d => d.total / 1000);

    const colors = { 'oil_gas': '#48A36C', 'electricity': '#E3540D', 'other': '#857550' };

    const hoverTemplate = (name, vals) => {
        return vals.map((v, i) => {
            const y = years[i];
            const tot = totalValues[i];
            return `<b>${getText(name, lang)}</b><br>${y}: $${v.toFixed(1)}B<br>${getText('page24_hover_total', lang)}: $${tot.toFixed(1)}B`;
        });
    };

    const formatNumberTable = (val) => {
        return val.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    };

    const stripHtml = (text) => text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

    const renderTextWithHiddenAsterisk = (text) => {
        if (!text) return null;
        if (!text.includes('*')) return text;
        const parts = text.split('*');
        return parts.map((part, index) => (
            <React.Fragment key={index}>
                {part}
                {index < parts.length - 1 && <span aria-hidden="true">*</span>}
            </React.Fragment>
        ));
    };

    const getAccessibleDataTable = () => {
        if (!pageData || pageData.length === 0) return null;

        const oilGasLabel = stripHtml(getText('page24_legend_oil_gas', lang));
        const electricityLabel = stripHtml(getText('page24_legend_electricity', lang));
        const otherLabel = stripHtml(getText('page24_legend_other', lang));
        const totalLabel = getText('page24_hover_total', lang);

        const cellUnitText = lang === 'en' ? ' billion dollars' : ' milliards de dollars';
        const headerUnitVisual = lang === 'en' ? '($ billions)' : '(milliards $)';
        const headerUnitSR = lang === 'en' ? '(billions of dollars)' : '(milliards de dollars)';
        const captionId = 'page24-table-caption';

        return (
            <details onToggle={(e) => setIsTableOpen(e.currentTarget.open)} className="page24-table-btn-wrapper" style={{ marginTop: '20px', marginBottom: '10px' }}>
                <summary 
                    role="button" 
                    aria-expanded={isTableOpen}
                    style={{ 
                        cursor: 'pointer', 
                        fontWeight: 'bold', 
                        padding: '10px', 
                        border: '1px solid #ccc', 
                        backgroundColor: '#f9f9f9', 
                        display: 'flex', 
                        alignItems: 'center',
                        listStyle: 'none' 
                    }}
                >
                    <svg 
                        aria-hidden="true" 
                        focusable="false" 
                        width="12" height="12" 
                        viewBox="0 0 12 12" 
                        style={{ marginRight: '8px', transform: isTableOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                    >
                        <path d="M4 2 L10 6 L4 10 Z" fill="#333" />
                    </svg>

                    {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}

                    <span className="wb-inv">
                        {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                    </span>
                </summary>
                <div className="table-responsive" style={{ width: '100%', marginTop: '10px' }}>
                    <table className="table table-striped table-hover">
                        <caption id={captionId} className="wb-inv">
                            {lang === 'en' 
                                ? 'Capital expenditures in the energy sector (billions of dollars)' 
                                : 'Dépenses en immobilisations dans le secteur de l\'énergie (milliards de dollars)'}
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col" className="text-center" style={{ fontWeight: 'bold' }}>
                                    {lang === 'en' ? 'Year' : 'Année'}
                                </th>
                                <th scope="col" className="text-center" style={{ fontWeight: 'bold' }}>
                                    {oilGasLabel}<br/>
                                    <span aria-hidden="true">{headerUnitVisual}</span>
                                    <span className="wb-inv">{headerUnitSR}</span>
                                </th>
                                <th scope="col" className="text-center" style={{ fontWeight: 'bold' }}>
                                    {electricityLabel}<br/>
                                    <span aria-hidden="true">{headerUnitVisual}</span>
                                    <span className="wb-inv">{headerUnitSR}</span>
                                </th>
                                <th scope="col" className="text-center" style={{ fontWeight: 'bold' }}>
                                    {otherLabel}<br/>
                                    <span aria-hidden="true">{headerUnitVisual}</span>
                                    <span className="wb-inv">{headerUnitSR}</span>
                                </th>
                                <th scope="col" className="text-center" style={{ fontWeight: 'bold' }}>
                                    {totalLabel}<br/>
                                    <span aria-hidden="true">{headerUnitVisual}</span>
                                    <span className="wb-inv">{headerUnitSR}</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageData.map(yearData => (
                                <tr key={yearData.year}>
                                    <th scope="row" className="text-center" style={{ fontWeight: 'bold' }}>
                                        {yearData.year}
                                    </th>
                                    <td 
                                        style={{ textAlign: 'right' }}
                                        aria-label={`${yearData.year}, ${oilGasLabel}: ${formatNumberTable(yearData.oil_gas / 1000)}${cellUnitText}`}
                                    >
                                        {formatNumberTable(yearData.oil_gas / 1000)}
                                    </td>
                                    <td 
                                        style={{ textAlign: 'right' }}
                                        aria-label={`${yearData.year}, ${electricityLabel}: ${formatNumberTable(yearData.electricity / 1000)}${cellUnitText}`}
                                    >
                                        {formatNumberTable(yearData.electricity / 1000)}
                                    </td>
                                    <td 
                                        style={{ textAlign: 'right' }}
                                        aria-label={`${yearData.year}, ${otherLabel}: ${formatNumberTable(yearData.other / 1000)}${cellUnitText}`}
                                    >
                                        {formatNumberTable(yearData.other / 1000)}
                                    </td>
                                    <td 
                                        style={{ textAlign: 'right' }}
                                        aria-label={`${yearData.year}, ${getText('page24_hover_total', lang)}: ${formatNumberTable(yearData.total / 1000)}${cellUnitText}`}
                                    >
                                        {formatNumberTable(yearData.total / 1000)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                    <button
                        onClick={() => downloadTableAsCSV()}
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
                        onClick={() => downloadTableAsDocx()}
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
            </details>
        );
    };
    const downloadTableAsCSV = () => {
        if (!pageData || pageData.length === 0) return;

        const oilGasLabel = stripHtml(getText('page24_legend_oil_gas', lang));
        const electricityLabel = stripHtml(getText('page24_legend_electricity', lang));
        const otherLabel = stripHtml(getText('page24_legend_other', lang));
        const unitHeader = lang === 'en' ? '($ billions)' : '(milliards $)';
        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            `${oilGasLabel} ${unitHeader}`,
            `${electricityLabel} ${unitHeader}`,
            `${otherLabel} ${unitHeader}`,
            `Total ${unitHeader}`
        ];
        const rows = pageData.map(yearData => [
            yearData.year,
            (yearData.oil_gas / 1000).toFixed(2),
            (yearData.electricity / 1000).toFixed(2),
            (yearData.other / 1000).toFixed(2),
            (yearData.total / 1000).toFixed(2)
        ]);
        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'capital_expenditures_energy_data.csv' : 'depenses_en_capital_energie_donnees.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };
    const downloadTableAsDocx = async () => {
        if (!pageData || pageData.length === 0) return;

        const oilGasLabel = stripHtml(getText('page24_legend_oil_gas', lang));
        const electricityLabel = stripHtml(getText('page24_legend_electricity', lang));
        const otherLabel = stripHtml(getText('page24_legend_other', lang));
        const unitHeader = lang === 'en' ? '($ billions)' : '(milliards $)';
        const title = stripHtml(getText('page24_title', lang));

        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            `${oilGasLabel} ${unitHeader}`,
            `${electricityLabel} ${unitHeader}`,
            `${otherLabel} ${unitHeader}`,
            `Total ${unitHeader}`
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
        const dataRows = pageData.map(yearData => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(yearData.year), size: 22 })], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (yearData.oil_gas / 1000).toFixed(2), size: 22 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (yearData.electricity / 1000).toFixed(2), size: 22 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (yearData.other / 1000).toFixed(2), size: 22 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (yearData.total / 1000).toFixed(2), bold: true, size: 22 })], alignment: AlignmentType.RIGHT })] })
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
                        columnWidths: [1200, 2000, 2000, 2000, 1800],
                        rows: [headerRow, ...dataRows]
                    })
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'capital_expenditures_energy_table.docx' : 'depenses_en_capital_energie_tableau.docx');
    };
    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || document.querySelector('.page24-chart.js-plotly-plot') || document.querySelector('.page24-chart-wrapper .js-plotly-plot');
        if (!plotElement) {
            console.error('Plot element not found');
            alert('Could not find chart element. Please try again.');
            return;
        }

        const title = stripHtml(chartTitle);
        const oilGasLabel = stripHtml(getText('page24_legend_oil_gas', lang));
        const electricityLabel = stripHtml(getText('page24_legend_electricity', lang));
        const otherLabel = stripHtml(getText('page24_legend_other', lang));

        try {
            if (!window.Plotly) {
                console.error('Plotly not available on window');
                alert('Plotly library not loaded. Please refresh the page and try again.');
                return;
            }

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
                const titleHeight = 80;
                const legendHeight = 60;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight + legendHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 36px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, canvas.width / 2, 50);
                ctx.drawImage(img, 0, titleHeight);
                const legendY = titleHeight + img.height + 30;
                const legendItemsData = [
                    { label: oilGasLabel, color: colors.oil_gas },
                    { label: electricityLabel, color: colors.electricity },
                    { label: otherLabel, color: colors.other }
                ];

                ctx.font = '24px Arial';
                ctx.textAlign = 'left';
                let xPos = (canvas.width - 800) / 2;

                legendItemsData.forEach(item => {
                    ctx.fillStyle = item.color;
                    ctx.fillRect(xPos, legendY - 18, 24, 24);
                    ctx.fillStyle = '#333333';
                    ctx.fillText(item.label, xPos + 32, legendY);
                    xPos += ctx.measureText(item.label).width + 80;
                });
                const link = document.createElement('a');
                link.download = lang === 'en' ? 'capital_expenditures_energy_chart.png' : 'depenses_en_capital_energie_graphique.png';
                link.href = canvas.toDataURL('image/png');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };

            img.onerror = () => {
                console.error('Failed to load chart image');
                alert('Failed to generate chart image. Please try again.');
            };

            img.src = imgData;
        } catch (error) {
            console.error('Error downloading chart:', error);
            alert('Error downloading chart: ' + error.message);
        }
    };

    const legendItems = [
        { id: 'oil_gas', label: getText('page24_legend_oil_gas', lang), color: colors.oil_gas },
        { id: 'electricity', label: getText('page24_legend_electricity', lang), color: colors.electricity },
        { id: 'other', label: getText('page24_legend_other', lang), color: colors.other }
    ];

    const handleLegendClick = (id) => {
        setHiddenSeries(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    const handleLegendDoubleClick = (id) => {
        const allIds = legendItems.map(item => item.id);
        const others = allIds.filter(item => item !== id);
        const isIsolated = others.every(o => hiddenSeries.includes(o)) && !hiddenSeries.includes(id);
        setHiddenSeries(isIsolated ? [] : others);
    };
    const isColumnFormat = windowWidth <= 1400;
    const chartMarginLeft = 50;
    const chartMarginRight = isColumnFormat ? 0 : 15;

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-24" 
            role="main"
            aria-label={getText('page24_title', lang)}
            style={{
                backgroundColor: 'white',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',
                boxSizing: 'border-box',
            }}
        >
            <style>{`

                .wb-inv {
                    clip: rect(1px, 1px, 1px, 1px);
                    height: 1px;
                    margin: 0;
                    overflow: hidden;
                    position: absolute;
                    width: 1px;
                    white-space: nowrap;
                }

                .page24-table-btn-wrapper summary::-webkit-details-marker,
                .page24-table-btn-wrapper summary::marker {
                    display: none;
                }

                .page-24 {
                    margin-left: -${layoutPadding?.left || 55}px;
                    width: calc(100% + ${layoutPadding?.left || 55}px);
                    padding-left: ${layoutPadding?.left || 55}px; 
                }

                .page24-chart-wrapper {
                    position: relative;
                    width: calc(100% + 30px);
                    margin-left: 0px;
                }

                @media (max-width: 1400px) {
                    .page24-chart-wrapper {
                        width: 100%;
                        margin-left: 0;
                    }
                }

                .page24-chart-wrapper div[role="button"]:focus {
                    outline: none !important;
                    box-shadow: none !important;
                }

                .chart-title-wrapper {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    width: 100%;
                    box-sizing: border-box;
                    margin-bottom: 10px;
                }

                .page24-legend {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 15px;
                    margin-top: 10px;
                    cursor: default;
                    justify-content: center;
                    width: 100%;
                    box-sizing: border-box;
                }

                .page24-table-btn-wrapper {
                    width: 100%;
                }

                .page24-container { width: 100%; display: flex; flex-direction: column; min-height: 100%; }
                .page24-header { padding-top: 20px; padding-bottom: 20px; }

                .page24-content-row { 
                    display: flex; 
                    flex-direction: row; 
                    flex: 1; 
                    width: 100%; 
                    overflow: visible;
                    gap: 40px;
                }

                .page24-chart-column { 
                    width: 55%; 
                }

                .page24-text-column {
                    width: 45%;
                    padding-top: 30px;
                    padding-left: 30px; 
                    padding-right: 0;
                    box-sizing: border-box;
                    min-width: 300px; 
                }

                .page24-chart-title {
                    font-family: Arial, sans-serif;
                    font-size: 1.25rem;
                    font-weight: bold;
                    color: #333;
                    line-height: 1.2;
                    max-width: 100%;
                }

                .page24-legend-item {
                    display: flex;
                    align-items: center;
                    font-family: Arial, sans-serif;
                    font-size: 0.9rem;
                    color: #333;
                    cursor: pointer;
                    user-select: none;
                }
                .page24-legend-color { width: 15px; height: 15px; margin-right: 8px; display: inline-block; }

                .js-plotly-plot .plotly .modebar {
                    right: 20px !important;
                    top: 2px !important;
                }

                .page24-chart-wrapper button:focus,
                .js-plotly-plot .plotly .modebar-btn:focus {
                    outline: none !important;
                    box-shadow: none !important;
                }

                .page24-chart { width: 100%; height: 300px; }

                @media (max-width: 1400px) {
                    .page24-content-row { flex-direction: column; }
                    .page24-chart-column { width: 100%; margin-bottom: 30px; }
                    .page24-text-column { width: 100%; padding-top: 0; padding-left: 0; }
                }

                @media (max-width: 640px) {
                    .page-24 { 
                        border-left: none !important; 
                        margin-left: 0;
                        width: 100%;
                        padding-left: 0;
                    }
                    .page24-legend {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                    }
                }

                @media (max-width: 480px) {
                    .page24-chart { height: 275px; }
                }
            `}</style>

            <div className="page24-container">
                <header className="page24-header">
                    <h1 style={{ fontFamily: 'Georgia, serif', color: '#8e7e52', fontSize: '3rem', fontWeight: 'normal', margin: 0, lineHeight: 1.1 }}>
                        {renderTextWithHiddenAsterisk(getText('page24_title', lang))}
                    </h1>
                </header>

                <div className={`page24-content-row`}>
                    <div className="page24-chart-column">

                        <div className="chart-title-wrapper">
                            <h2 className="page24-chart-title">
                                {renderTextWithHiddenAsterisk(chartTitle)}
                            </h2>
                        </div>

                        <figure ref={chartRef} className="page24-chart-wrapper">
                            {selectedPoints !== null && (
                                <button onClick={() => setSelectedPoints(null)} style={{ position: 'absolute', top: 0, right: 295, zIndex: 20 }}>{lang === 'en' ? 'Clear' : 'Effacer'}</button>
                            )}

                            <Plot
                                data={[
                                    { 
                                        name: getText('page24_legend_oil_gas', lang), 
                                        x: years, y: oilGasValues, type: 'bar', 
                                        marker: { 
                                            color: colors.oil_gas,
                                            opacity: selectedPoints === null ? 1 : years.map((_, i) => selectedPoints[0]?.includes(i) ? 1 : 0.3)
                                        }, 
                                        hovertext: hoverTemplate('page24_hover_oil_gas', oilGasValues), hoverinfo: 'text',
                                        visible: hiddenSeries.includes('oil_gas') ? 'legendonly' : true
                                    },
                                    { 
                                        name: getText('page24_legend_electricity', lang), 
                                        x: years, y: electricValues, type: 'bar', 
                                        marker: { 
                                            color: colors.electricity,
                                            opacity: selectedPoints === null ? 1 : years.map((_, i) => selectedPoints[1]?.includes(i) ? 1 : 0.3)
                                        }, 
                                        hovertext: hoverTemplate('page24_hover_electricity', electricValues), hoverinfo: 'text',
                                        visible: hiddenSeries.includes('electricity') ? 'legendonly' : true
                                    },
                                    { 
                                        name: getText('page24_legend_other', lang), 
                                        x: years, y: otherValues, type: 'bar', 
                                        marker: { 
                                            color: colors.other,
                                            opacity: selectedPoints === null ? 1 : years.map((_, i) => selectedPoints[2]?.includes(i) ? 1 : 0.3)
                                        }, 
                                        hovertext: hoverTemplate('page24_hover_other', otherValues), hoverinfo: 'text',
                                        visible: hiddenSeries.includes('other') ? 'legendonly' : true
                                    }
                                ]}
                                layout={{ 
                                    barmode: 'stack', 
                                    hoverlabel: { bgcolor: '#ffffff' }, 
                                    showlegend: false,
                                    xaxis: { 
                                        tickvals: tickVals, 
                                        automargin: true,
                                        tickangle: windowWidth <= 400 ? +90 : 'auto'
                                    }, 
                                    yaxis: { 
                                        title: { text: getText('page24_yaxis', lang) }, 
                                        automargin: true,
                                    }, 
                                    margin: { l: chartMarginLeft, r: chartMarginRight, t: 30, b: 10 }, 
                                    autosize: true, 
                                    bargap: 0.2,
                                    paper_bgcolor: 'rgba(0,0,0,0)',
                                    plot_bgcolor: 'rgba(0,0,0,0)'
                                }}
                                className="page24-chart" 
                                useResizeHandler={true} 
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
                                        
                                        if (!isDoubleTap) {
                                            return; // Single tap: show hover label only
                                        }
                                    }

                                    setSelectedPoints(prev => {
                                        if (prev === null) {
                                            const newSelection = [[], [], []];
                                            newSelection[traceIndex].push(pointIndex);
                                            return newSelection;
                                        }
                                        const isSelected = prev[traceIndex]?.includes(pointIndex);

                                        if (isSelected) {
                                            const newSelection = prev.map((tracePoints, idx) => 
                                                idx === traceIndex ? tracePoints.filter(p => p !== pointIndex) : [...tracePoints]
                                            );
                                            if (newSelection.every(arr => arr.length === 0)) {
                                                return null;
                                            }
                                            return newSelection;
                                        } else {
                                            const newSelection = prev.map((tracePoints, idx) => 
                                                idx === traceIndex ? [...tracePoints, pointIndex] : [...tracePoints]
                                            );
                                            return newSelection;
                                        }
                                    });
                                }}
                                config={{ 
                                    displayModeBar: windowWidth > 768 || isChartInteractive, 
                                    displaylogo: false,
                                    responsive: true,
                                    modeBarButtonsToRemove: ['toImage', 'select2d', 'lasso2d'],
                                    modeBarButtonsToAdd: [{
                                        name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
                                        icon: {
                                            width: 1000,
                                            height: 1000,
                                            path: 'm500 450c-83 0-150-67-150-150 0-83 67-150 150-150 83 0 150 67 150 150 0 83-67 150-150 150z m400 150h-120c-16 0-34 13-39 29l-31 93c-6 15-23 28-40 28h-340c-16 0-34-13-39-28l-31-94c-6-15-23-28-40-28h-120c-55 0-100-45-100-100v-450c0-55 45-100 100-100h800c55 0 100 45 100 100v450c0 55-45 100-100 100z m-400-550c-138 0-250 112-250 250 0 138 112 250 250 250 138 0 250-112 250-250 0-138-112-250-250-250z m365 380c-19 0-35 16-35 35 0 19 16 35 35 35 19 0 35-16 35-35 0-19-16-35-35-35z',
                                            transform: 'matrix(1 0 0 -1 0 850)'
                                        },
                                        click: (gd) => downloadChartWithTitle(gd)
                                    }]
                                }}
                            />
                        </figure>

                        <div className="page24-legend" aria-hidden="true">
                            {legendItems.map((item) => (
                                <div 
                                    key={item.id} 
                                    className="page24-legend-item"
                                    style={{ cursor: 'default' }}
                                >
                                    <span className="page24-legend-color" style={{ backgroundColor: item.color }}></span>
                                    <span>{item.label}</span>
                                </div>
                            ))}
                        </div>

                        {getAccessibleDataTable()}
                    </div>

                    <aside className="page24-text-column align-right-edge">
                        <ul style={{ listStyleType: 'disc', paddingLeft: '20px', margin: '0', color: '#333' }}>
                            <li 
                                className="page24-bullet" 
                                style={{ marginBottom: '20px', lineHeight: '1.25', fontSize: '1.5rem', marginTop: '20px' }}
                                aria-label={lang === 'en' 
                                    ? `Capital expenditures in Canada's energy sector totaled ${formatBillionSR(totalLatestBillion)} in ${latestRow.year}, a decrease of ${declineFromPeakPct.toFixed(0)} percent from a peak in ${peakRow.year}.`
                                    : `Les dépenses en immobilisations dans le secteur canadien de l'énergie ont totalisé ${formatBillionSR(totalLatestBillion)} en ${latestRow.year}, une baisse de ${declineFromPeakPct.toFixed(0)} pour cent par rapport au sommet de ${peakRow.year}.`
                                }
                            >
                                <span aria-hidden="true">
                                    {getText('page24_bullet1_part1', lang)}<strong>{formatBillion(totalLatestBillion)}</strong>{getText('page24_bullet1_part2', lang)}{latestRow.year}{getText('page24_bullet1_part3', lang)}{declineFromPeakPct.toFixed(0)}{getText('page24_bullet1_part4', lang)}{peakRow.year}{getText('page24_bullet1_part5', lang)}
                                </span>
                            </li>

                            <li 
                                className="page24-bullet" 
                                style={{ marginBottom: '20px', lineHeight: '1.25', fontSize: '1.5rem' }}
                                aria-label={lang === 'en'
                                    ? `After reaching an eleven year low of ${formatBillionSR(low2020Billion)} in 2020, investment has rebounded by ${reboundFrom2020Pct.toFixed(0)} percent.`
                                    : `Après avoir atteint un creux de onze ans de ${formatBillionSR(low2020Billion)} en 2020, l'investissement a rebondi de ${reboundFrom2020Pct.toFixed(0)} pour cent.`
                                }
                            >
                                <span aria-hidden="true">
                                    {getText('page24_bullet2_part1', lang)}<strong>{formatBillion(low2020Billion)}</strong>{getText('page24_bullet2_part2', lang)}<strong>{reboundFrom2020Pct.toFixed(0)}</strong>{getText('page24_bullet2_part3', lang)}
                                </span>
                            </li>

                            <li 
                                className="page24-bullet" 
                                style={{ marginBottom: '2px', lineHeight: '1.25', fontSize: '1.5rem' }}
                                aria-label={lang === 'en'
                                    ? `Oil and gas extraction was the largest area of energy sector capital expenditure at ${formatBillionSR(oilGasBillion)} in ${latestRow.year}, followed by electrical power generation and distribution at ${formatBillionSR(electricityBillion)}.`
                                    : `L'extraction de pétrole et de gaz était le plus grand domaine de dépenses en immobilisations du secteur de l'énergie avec ${formatBillionSR(oilGasBillion)} en ${latestRow.year}, suivie de la production et distribution d'électricité avec ${formatBillionSR(electricityBillion)}.`
                                }
                            >
                                <span aria-hidden="true">
                                    {getText('page24_bullet3_part1', lang)}<strong>{formatBillion(oilGasBillion)}</strong>{getText('page24_bullet3_part2', lang)}{latestRow.year}{getText('page24_bullet3_part3', lang)}{formatBillion(electricityBillion)}{getText('page24_bullet3_part4', lang)}
                                </span>
                            </li>
                        </ul>
                    </aside>
                </div>

                <aside className="wb-fnote" role="note" style={{ marginTop: 'auto', paddingTop: '10px', paddingBottom: '15px' }}>
                    <h2 id="fn-page24" className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl style={{ margin: 0 }}>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnote 1' : 'Note de bas de page 1'}</dt>
                        <dd id="fn1-page24" style={{ margin: 0 }}>
                            <p className="page24-footnote" style={{
                                fontSize: '1rem',
                                color: '#000000',
                                marginBottom: '0',
                                lineHeight: '1.15',
                                whiteSpace: 'pre-line'
                            }}>
                                {renderTextWithHiddenAsterisk(getText('page24_footnote', lang))}
                            </p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page24;
