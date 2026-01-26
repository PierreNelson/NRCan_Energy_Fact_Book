import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getInvestmentByAssetData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const Page27 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [isChartInteractive, setIsChartInteractive] = useState(typeof window !== 'undefined' ? window.innerWidth > 768 : true);
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

    const legendSettings = useMemo(() => {
        if (windowWidth <= 480) {
            return { width: 1.0, margin: 120, fontSize: 9, y: -0.25, x: 0, xanchor: 'left' };
        }
        else if (windowWidth <= 640) {
            return { width: 0.85, margin: 120, fontSize: 11, y: -0.24, x: 0, xanchor: 'left' };
        }
        else if (windowWidth <= 960) {
            return { width: 0.49, margin: 120, fontSize: 12, y: -0.22, x: 0, xanchor: 'left' };
        }
        else if (windowWidth <= 1097) {
            return { width: 0.49, margin: 120, fontSize: 14, y: -0.18, x: 0, xanchor: 'left' };
        }
        else if (windowWidth <= 1536) {
            return { width: 0.32, margin: 120, fontSize: 14, y: -0.18, x: 0, xanchor: 'left' };
        }
        else {
            return { width: 0.25, margin: 120, fontSize: 14, y: -0.15, x: 0, xanchor: 'left' };
        }
    }, [windowWidth]);

    useEffect(() => {
        getInvestmentByAssetData()
            .then(data => {
                setPageData(data);
            })
            .catch(err => {
                console.error("Failed to load investment by asset data:", err);
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
    }, [pageData, lang]);

    const COLORS = {
        'transmission_distribution': '#224397',  
        'pipelines': '#857550',                  
        'nuclear': '#E4570C',                   
        'other_electric': '#787878',          
        'hydraulic': '#2CA2AF',            
        'wind_solar': '#6cbe8d',                
        'steam_thermal': '#A78F16',             
    };

    const CATEGORY_ORDER = [
        'transmission_distribution',
        'hydraulic',
        'pipelines', 
        'wind_solar',
        'nuclear',
        'steam_thermal',
        'other_electric'
    ];

    const LEGEND_KEYS = {
        'transmission_distribution': 'page27_legend_transmission',
        'pipelines': 'page27_legend_pipelines',
        'nuclear': 'page27_legend_nuclear',
        'other_electric': 'page27_legend_other',
        'hydraulic': 'page27_legend_hydraulic',
        'wind_solar': 'page27_legend_wind_solar',
        'steam_thermal': 'page27_legend_steam',
    };

    const HOVER_KEYS = {
        'transmission_distribution': 'page27_hover_transmission',
        'pipelines': 'page27_hover_pipelines',
        'nuclear': 'page27_hover_nuclear',
        'other_electric': 'page27_hover_other',
        'hydraulic': 'page27_hover_hydraulic',
        'wind_solar': 'page27_hover_wind_solar',
        'steam_thermal': 'page27_hover_steam',
    };

    const chartData = useMemo(() => {
        if (pageData.length === 0) return null;

        const years = pageData.map(d => d.year);
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);

        const tickVals = [];
        for (let y = minYear; y <= maxYear; y++) {
            tickVals.push(y);
        }

        const totalValues = pageData.map(d => {
            let total = 0;
            CATEGORY_ORDER.forEach(cat => {
                total += (d[cat] || 0) / 1000;
            });
            return total;
        });

        const LEGEND_ORDER_ZOOMED = [
            'transmission_distribution',
            'hydraulic',
            'pipelines',
            'wind_solar',
            'nuclear',
            'steam_thermal',
            'other_electric'
        ];

        const LEGEND_ORDER_DEFAULT = [
            'transmission_distribution',
            'pipelines',
            'nuclear',
            'other_electric',  
            'hydraulic',
            'wind_solar',
            'steam_thermal'              
        ];

        const LEGEND_ORDER = windowWidth <= 1536 ? LEGEND_ORDER_ZOOMED : LEGEND_ORDER_DEFAULT;

        const traces = CATEGORY_ORDER.map((cat) => {
            const values = pageData.map(d => (d[cat] || 0) / 1000);

            const hoverTexts = values.map((v, i) => {
                const y = years[i];
                const tot = totalValues[i];
                const catName = getText(HOVER_KEYS[cat], lang);
                const vFormatted = v < 1 ? v.toFixed(2) : v.toFixed(1);
                const totFormatted = tot < 1 ? tot.toFixed(2) : tot.toFixed(1);
                return `<b>${catName}</b><br>${y}: $${vFormatted}B<br>${getText('page27_hover_total', lang)}: $${totFormatted}B`;
            });

            const legendRank = LEGEND_ORDER.indexOf(cat) + 2;

            const traceIndex = CATEGORY_ORDER.indexOf(cat);
            return {
                name: getText(LEGEND_KEYS[cat], lang),
                x: years,
                y: values,
                type: 'bar',
                marker: { 
                    color: COLORS[cat],
                    opacity: selectedPoints === null ? 1 : years.map((_, i) => selectedPoints[traceIndex]?.includes(i) ? 1 : 0.3)
                },
                hovertext: hoverTexts,
                hoverinfo: 'text',
                hoverlabel: {
                    bgcolor: '#ffffff',
                    bordercolor: '#000000',
                    font: { color: '#000000', size: windowWidth <= 480 ? 14 : windowWidth <= 768 ? 13 : 12, family: 'Arial, sans-serif' }
                },
                legendrank: legendRank
            };
        });

        const chartTitle = `${getText('page27_chart_title_prefix', lang)}${minYear} ${lang === 'en' ? 'to' : 'à'} ${maxYear}`;

        return { traces, years, tickVals, minYear, maxYear, chartTitle, numTraces: CATEGORY_ORDER.length };
    }, [pageData, lang, windowWidth, selectedPoints]);

    const formatBillionSR = (val) => {
        const decimals = val < 1 ? 2 : 1;
        return lang === 'en' 
            ? `${val.toFixed(decimals)} billion dollars` 
            : `${val.toFixed(decimals)} milliards de dollars`;
    };

    const getChartDataSummary = () => {
        if (!pageData || pageData.length === 0) return '';

        const firstYear = pageData[0];
        const latestYear = pageData[pageData.length - 1];
        const firstYearNum = firstYear.year;
        const latestYearNum = latestYear.year;

        let total = 0;
        CATEGORY_ORDER.forEach(cat => {
            total += (latestYear[cat] || 0) / 1000;
        });

        if (lang === 'en') {
            return `Stacked bar chart showing public and private investment in fuel, energy and pipeline infrastructure from ${firstYearNum} to ${latestYearNum}. Total investment in ${latestYearNum} was approximately ${formatBillionSR(total)}. Expand the data table below for detailed values.`;
        } else {
            return `Graphique à barres empilées montrant les investissements publics et privés dans les infrastructures de carburant, d'énergie et de pipeline de ${firstYearNum} à ${latestYearNum}. L'investissement total en ${latestYearNum} était d'environ ${formatBillionSR(total)}. Développez le tableau de données ci-dessous pour les valeurs détaillées.`;
        }
    };

    const formatNumber = (val) => {
        const decimals = val < 1 ? 2 : 1;
        return val.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { 
            minimumFractionDigits: decimals, 
            maximumFractionDigits: decimals 
        });
    };

    const stripHtml = (text) => text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

    const getAccessibleDataTable = () => {
        if (!pageData || pageData.length === 0) return null;

        const categoryLabels = {
            'transmission_distribution': stripHtml(getText('page27_legend_transmission', lang)),
            'hydraulic': stripHtml(getText('page27_legend_hydraulic', lang)),
            'pipelines': stripHtml(getText('page27_legend_pipelines', lang)),
            'wind_solar': stripHtml(getText('page27_legend_wind_solar', lang)),
            'nuclear': stripHtml(getText('page27_legend_nuclear', lang)),
            'steam_thermal': stripHtml(getText('page27_legend_steam', lang)),
            'other_electric': stripHtml(getText('page27_legend_other', lang)),
        };

        const cellUnitSR = lang === 'en' ? ' billion dollars' : ' milliards de dollars';
        const headerUnitVisual = lang === 'en' ? '($ billions)' : '(milliards $)';
        const headerUnitSR = lang === 'en' ? '(billions of dollars)' : '(milliards de dollars)';
        const captionId = 'page27-table-caption';

        return (
            <details 
                onToggle={(e) => setIsTableOpen(e.currentTarget.open)}
                style={{ 
                    marginTop: '10px', 
                    marginBottom: '10px', 
                    marginLeft: 0,
                    marginRight: 0,
                    fontFamily: 'Arial, sans-serif'
                }}
            >
                <summary 
                    role="button"
                    aria-expanded={isTableOpen}
                    style={{ 
                        cursor: 'pointer', 
                        color: '#333', 
                        fontWeight: 'bold', 
                        padding: '10px',
                        border: '1px solid #ccc',
                        backgroundColor: '#f9f9f9',
                        borderRadius: '4px',
                        listStyle: 'none'
                    }}
                >
                    <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                    {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                    <span className="sr-only">{lang === 'en' ? ' (press Enter to open or close)' : ' (appuyez sur Entrée pour ouvrir ou fermer)'}</span>
                </summary>

                <div className="table-responsive" role="region" aria-labelledby={captionId}>
                    <table className="table table-striped table-hover">
                        <caption id={captionId} className="wb-inv">
                            {lang === 'en' 
                                ? 'Public and private investment in fuel, energy and pipeline infrastructure (billions of constant 2012 dollars)'
                                : 'Investissements publics et privés dans les infrastructures de carburant, d\'énergie et de pipeline (milliards de dollars constants de 2012)'}
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col" className="text-center" style={{ fontWeight: 'bold' }}>{lang === 'en' ? 'Year' : 'Année'}</th>
                                {CATEGORY_ORDER.map(cat => (
                                    <th key={cat} scope="col" className="text-center" style={{ fontWeight: 'bold' }}>
                                        {categoryLabels[cat]}<br/>
                                        <span aria-hidden="true">{headerUnitVisual}</span>
                                        <span className="wb-inv">{headerUnitSR}</span>
                                    </th>
                                ))}
                                <th scope="col" className="text-center" style={{ fontWeight: 'bold' }}>
                                    {lang === 'en' ? 'Total' : 'Total'}<br/>
                                    <span aria-hidden="true">{headerUnitVisual}</span>
                                    <span className="wb-inv">{headerUnitSR}</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageData.map(yearData => {
                                let total = 0;
                                CATEGORY_ORDER.forEach(cat => {
                                    total += (yearData[cat] || 0) / 1000;
                                });
                                return (
                                    <tr key={yearData.year}>
                                        <th scope="row" className="text-center" style={{ fontWeight: 'bold' }}>{yearData.year}</th>
                                        {CATEGORY_ORDER.map(cat => (
                                            <td 
                                                key={cat} 
                                                style={{ textAlign: 'right' }}
                                                aria-label={`${yearData.year}, ${categoryLabels[cat]}: ${formatNumber((yearData[cat] || 0) / 1000)}${cellUnitSR}`}
                                            >
                                                {formatNumber((yearData[cat] || 0) / 1000)}
                                            </td>
                                        ))}
                                        <td 
                                            style={{ textAlign: 'right' }}
                                            aria-label={`${yearData.year}, ${lang === 'en' ? 'Total' : 'Total'}: ${formatNumber(total)}${cellUnitSR}`}
                                        >
                                            <strong>{formatNumber(total)}</strong>
                                        </td>
                                    </tr>
                                );
                            })}
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

        const categoryLabels = {
            'transmission_distribution': stripHtml(getText('page27_legend_transmission', lang)),
            'hydraulic': stripHtml(getText('page27_legend_hydraulic', lang)),
            'pipelines': stripHtml(getText('page27_legend_pipelines', lang)),
            'wind_solar': stripHtml(getText('page27_legend_wind_solar', lang)),
            'nuclear': stripHtml(getText('page27_legend_nuclear', lang)),
            'steam_thermal': stripHtml(getText('page27_legend_steam', lang)),
            'other_electric': stripHtml(getText('page27_legend_other', lang)),
        };

        const unitHeader = lang === 'en' ? '($ billions constant 2012)' : '(milliards $ constants 2012)';
        const headers = [
            lang === 'en' ? 'Year' : 'Année', 
            ...CATEGORY_ORDER.map(cat => `${categoryLabels[cat]} ${unitHeader}`), 
            `Total ${unitHeader}`
        ];
        const rows = pageData.map(yearData => {
            let total = 0;
            const values = CATEGORY_ORDER.map(cat => {
                const val = (yearData[cat] || 0) / 1000;
                total += val;
                return val.toFixed(2);
            });
            return [yearData.year, ...values, total.toFixed(2)];
        });
        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'capital_expenditures_data.csv' : 'depenses_en_capital_donnees.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };
    const downloadTableAsDocx = async () => {
        if (!pageData || pageData.length === 0) return;

        const categoryLabels = {
            'transmission_distribution': stripHtml(getText('page27_legend_transmission', lang)),
            'hydraulic': stripHtml(getText('page27_legend_hydraulic', lang)),
            'pipelines': stripHtml(getText('page27_legend_pipelines', lang)),
            'wind_solar': stripHtml(getText('page27_legend_wind_solar', lang)),
            'nuclear': stripHtml(getText('page27_legend_nuclear', lang)),
            'steam_thermal': stripHtml(getText('page27_legend_steam', lang)),
            'other_electric': stripHtml(getText('page27_legend_other', lang)),
        };

        const unitHeader = lang === 'en' ? '($ billions constant 2012)' : '(milliards $ constants 2012)';
        const title = stripHtml(getText('page27_title', lang));

        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            ...CATEGORY_ORDER.map(cat => `${categoryLabels[cat]} ${unitHeader}`),
            `Total ${unitHeader}`
        ];

        const headerRow = new TableRow({
            children: headers.map(header => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: header, bold: true, size: 18 })],
                    alignment: AlignmentType.CENTER
                })],
                shading: { fill: 'E6E6E6' }
            }))
        });

        const dataRows = pageData.map(yearData => {
            let total = 0;
            const values = CATEGORY_ORDER.map(cat => {
                const val = (yearData[cat] || 0) / 1000;
                total += val;
                return val.toFixed(2);
            });
            return new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(yearData.year), size: 20 })], alignment: AlignmentType.CENTER })] }),
                    ...values.map(val => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: val, size: 20 })], alignment: AlignmentType.RIGHT })] })),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: total.toFixed(2), bold: true, size: 20 })], alignment: AlignmentType.RIGHT })] })
                ]
            });
        });

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
                        columnWidths: [1100, 1150, 1150, 1150, 1150, 1150, 1150, 1150],
                        rows: [headerRow, ...dataRows]
                    })
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'capital_expenditures_table.docx' : 'depenses_en_capital_tableau.docx');
    };
    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || document.querySelector('.page27-chart.js-plotly-plot') || document.querySelector('.page27-chart-wrapper .js-plotly-plot');
        if (!plotElement) {
            console.error('Plot element not found');
            alert('Could not find chart element. Please try again.');
            return;
        }

        const title = chartData?.chartTitle ? stripHtml(chartData.chartTitle) : stripHtml(getText('page27_chart_title_prefix', lang));

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
                canvas.width = img.width;
                canvas.height = img.height + titleHeight;

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.fillStyle = '#333333';
                ctx.font = 'bold 36px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, canvas.width / 2, 50);

                ctx.drawImage(img, 0, titleHeight);

                const link = document.createElement('a');
                link.download = lang === 'en' ? 'capital_expenditures_chart.png' : 'depenses_en_capital_graphique.png';
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

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
    }

    if (error) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'red' }}>Error: {error}. Please refresh the page.</div>;
    }

    if (!chartData) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>No data available. Please refresh the page.</div>;
    }

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-27" 
            role="main"
            aria-label={getText('page27_title', lang)}
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

                .page-27 {
                    margin-right: -${layoutPadding?.right || 15}px;
                    width: calc(100% + ${layoutPadding?.right || 15}px);
                    padding-right: ${layoutPadding?.right || 15}px; 
                }

                .page27-container {
                    width: 100%;
                    padding: 10px 0 0 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    flex: 1;
                    overflow: visible;
                }

                .page27-container .chart-region {
                    width: 100%;
                }

                .page27-chart {
                    width: 100%;
                    height: calc(100vh - 380px);
                    min-height: 350px;
                }

                @media (max-width: 1745px) {
                    .page27-chart {
                        height: calc(100vh - 280px);
                        min-height: 380px;
                    }
                }

                @media (max-width: 1536px) {
                    .page27-chart {
                        height: calc(100vh - 220px);
                        min-height: 360px;
                    }
                }

                @media (max-width: 1280px) {
                    .page27-chart {
                        height: calc(100vh - 160px);
                        min-height: 340px;
                    }
                }

                @media (max-width: 1097px) {
                    .page27-chart {
                        height: calc(100vh - 120px);
                        min-height: 320px;
                    }
                }

                @media (max-width: 960px) {
                    .page27-chart {
                        height: calc(100vh - 80px);
                        min-height: 300px;
                    }
                }

                @media (max-width: 768px) {
                    .page-27 { border-right: none !important; }
                    .page27-container h1 {
                        font-size: 1.4rem !important;
                        text-align: left !important;
                    }
                    .page27-chart {
                        height: calc(100vh - 20px);
                        min-height: 280px;
                    }
                }

                @media (max-width: 640px) {
                    .page27-container h1 {
                        font-size: 1.3rem !important;
                    }
                    .page27-chart {
                        height: calc(100vh + 100px);
                        min-height: 260px;
                    }
                }

                @media (max-width: 480px) {
                    .page27-container h1 {
                        font-size: 1.2rem !important;
                    }
                    .page27-chart {
                        height: calc(100vh + 200px) !important;
                        min-height: 200px;
                    }
                }

                @media (max-width: 384px) {
                    .page27-container h1 {
                        font-size: 1.1rem !important;
                    }
                    .page27-chart {
                        height: calc(100% + 160px) !important;
                        min-height: 400px;
                    }
                }

                details summary::-webkit-details-marker,
                details summary::marker {
                    display: none;
                }

                .sr-only-table {
                    position: absolute;
                    width: 1px;
                    height: 1px;
                    padding: 0;
                    margin: -1px;
                    overflow: hidden;
                    clip: rect(0, 0, 0, 0);
                    white-space: nowrap;
                    border: 0;
                }

                .sr-only {
                    position: absolute;
                    width: 1px;
                    height: 1px;
                    padding: 0;
                    margin: -1px;
                    overflow: hidden;
                    clip: rect(0, 0, 0, 0);
                    white-space: nowrap;
                    border: 0;
                }
            `}</style>

            <div className="page27-container">
                <header 
                    role="region"
                    aria-label={chartData.chartTitle}
                >
                    <h1 aria-hidden="true" style={{
                        fontFamily: 'Arial, sans-serif',
                        color: '#333',
                        fontSize: '1.8rem',
                        fontWeight: 'bold',
                        marginBottom: '10px',
                        marginTop: '5px',
                        textAlign: 'left',
                    }}>
                        {chartData.chartTitle}
                    </h1>
                </header>

                <div 
                    role="region"
                    aria-label={getChartDataSummary()}
                >
                    <figure ref={chartRef} style={{ margin: 0, position: 'relative' }}>
                        {selectedPoints !== null && (
                            <button onClick={() => setSelectedPoints(null)} style={{ position: 'absolute', top: 0, right: 295, zIndex: 20 }}>{lang === 'en' ? 'Clear' : 'Effacer'}</button>
                        )}
                        <Plot
                            data={chartData.traces}
                            layout={{
                                barmode: 'stack',
                                hovermode: 'closest',
                                dragmode: windowWidth <= 768 ? false : 'zoom',
                                xaxis: {
                                    tickvals: chartData.tickVals,
                                    showgrid: false,
                                    zeroline: false,
                                    range: [chartData.minYear - 0.5, chartData.maxYear + 0.5],
                                    tickangle: windowWidth <= 640 ? -45 : 0,
                                    tickfont: { size: windowWidth <= 480 ? 10 : 11, family: 'Arial, sans-serif' },
                                    automargin: true,
                                },
                                yaxis: {
                                    title: { 
                                        text: windowWidth <= 640 
                                            ? (lang === 'en' ? '$ billion<br>(constant 2012 $)' : 'milliards $<br>($ constants 2012)')
                                            : windowWidth <= 1097
                                                ? (lang === 'en' ? '$ billion<br>(constant 2012 dollars)' : 'En milliards de $<br>(dollars constants de 2012)')
                                                : getText('page27_yaxis', lang), 
                                        font: { size: windowWidth <= 768 ? 12 : windowWidth <= 960 ? 14 : windowWidth <= 1280 ? 16 : 18, family: 'Arial, sans-serif' },
                                        standoff: 5
                                    },
                                    range: [0, 32],
                                    dtick: 5,
                                    showgrid: false,
                                    showline: true,
                                    linewidth: 1,
                                    linecolor: '#333',
                                    automargin: true,
                                    tickfont: { size: windowWidth <= 480 ? 9 : 10, family: 'Arial, sans-serif' }
                                },
                                legend: {
                                    orientation: 'h',
                                    x: legendSettings.x,
                                    xanchor: legendSettings.xanchor,
                                    y: legendSettings.y,
                                    yanchor: 'top',
                                    entrywidth: legendSettings.width,
                                    entrywidthmode: 'fraction',
                                    font: { size: legendSettings.fontSize, family: 'Arial, sans-serif' },
                                    traceorder: 'normal',
                                    itemclick: false,
                                    itemdoubleclick: false
                                },
                                margin: { 
                                    l: 0, 
                                    r: 0,
                                    t: 10, 
                                    b: legendSettings.margin
                                },
                                autosize: true,
                                bargap: 0.15
                            }}
                            className="page27-chart"
                            useResizeHandler={true}
                            onClick={(data) => {
                                if (!data.points || data.points.length === 0) return;
                                const clickedPoint = data.points[0];
                                const traceIndex = clickedPoint.curveNumber;
                                const pointIndex = clickedPoint.pointIndex;
                                const numTraces = chartData.numTraces;

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
                                        const newSelection = Array(numTraces).fill(null).map(() => []);
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
                                displayModeBar: true, 
                                displaylogo: false,
                                responsive: true,
                                scrollZoom: false,
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

                    {getAccessibleDataTable()}
                </div>
            </div>
        </main>
    );
};

export default Page27;
