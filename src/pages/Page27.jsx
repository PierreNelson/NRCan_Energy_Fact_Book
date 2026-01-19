import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getInvestmentByAssetData } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const Page27 = () => {
    const { lang } = useOutletContext();
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [isChartInteractive, setIsChartInteractive] = useState(false);
    const chartRef = useRef(null);

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
        const handleResize = () => setWindowWidth(window.innerWidth);
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
                return `${catName}<br>${y}: $${vFormatted}B<br><b>${getText('page27_hover_total', lang)}: $${totFormatted}B</b>`;
            });

            const legendRank = LEGEND_ORDER.indexOf(cat) + 2;

            return {
                name: getText(LEGEND_KEYS[cat], lang),
                x: years,
                y: values,
                type: 'bar',
                marker: { color: COLORS[cat] },
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

        const chartTitle = `${getText('page27_chart_title_prefix', lang)}${minYear}–${maxYear}`;

        return { traces, years, tickVals, minYear, maxYear, chartTitle };
    }, [pageData, lang, windowWidth]);

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
                    marginLeft: windowWidth <= 384 ? '30px' : windowWidth <= 480 ? '35px' : windowWidth <= 640 ? '40px' : windowWidth <= 768 ? '45px' : '55px',
                    marginRight: windowWidth <= 384 ? '35px' : windowWidth <= 480 ? '30px' : windowWidth <= 640 ? '25px' : windowWidth <= 768 ? '20px' : '9px',
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
                                <td className="text-center fw-bold">{lang === 'en' ? 'Year' : 'Année'}</td>
                                {CATEGORY_ORDER.map(cat => (
                                    <td key={cat} className="text-center fw-bold">
                                        {categoryLabels[cat]}<br/>
                                        <span aria-hidden="true">{headerUnitVisual}</span>
                                        <span className="wb-inv">{headerUnitSR}</span>
                                    </td>
                                ))}
                                <td className="text-center fw-bold">
                                    {lang === 'en' ? 'Total' : 'Total'}<br/>
                                    <span aria-hidden="true">{headerUnitVisual}</span>
                                    <span className="wb-inv">{headerUnitSR}</span>
                                </td>
                            </tr>
                        </thead>
                        <tbody>
                            {pageData.map(yearData => {
                                const yearHeaderId = `year-${yearData.year}`;
                                let total = 0;
                                CATEGORY_ORDER.forEach(cat => {
                                    total += (yearData[cat] || 0) / 1000;
                                });
                                return (
                                    <tr key={yearData.year}>
                                        <th scope="row" id={yearHeaderId}>{yearData.year}</th>
                                        {CATEGORY_ORDER.map(cat => (
                                            <td key={cat} headers={yearHeaderId}>
                                                <span className="wb-inv">{yearData.year}, {categoryLabels[cat]}: </span>
                                                {formatNumber((yearData[cat] || 0) / 1000)}
                                                <span className="wb-inv">{cellUnitSR}</span>
                                            </td>
                                        ))}
                                        <td headers={yearHeaderId}>
                                            <span className="wb-inv">{yearData.year}, {lang === 'en' ? 'Total' : 'Total'}: </span>
                                            <strong>{formatNumber(total)}</strong>
                                            <span className="wb-inv">{cellUnitSR}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </details>
        );
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
                borderRight: '18px solid #8e7e52',
            }}
        >
            <style>{`
                .page-27 {
                    margin-left: -37px !important;
                    margin-right: -30px !important;
                    width: calc(100% + 67px) !important;
                }
                
                .page27-container {
                    width: 100%;
                    padding: 10px 0px 0px 0px;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    flex: 1;
                    overflow: visible;
                }
                
                .page27-container header {
                    padding-left: 55px;
                    padding-right: 48px;
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
                        width: calc(100% - 40px) !important;
                        margin-left: 35px !important;
                    }
                }

                @media (max-width: 1097px) {
                    .page27-chart {
                        height: calc(100vh - 120px);
                        min-height: 320px;
                        width: calc(100% - 40px) !important;
                        margin-left: 30px !important;
                    }
                }

                @media (max-width: 960px) {
                    .page27-chart {
                        height: calc(100vh - 80px);
                        min-height: 300px;
                    }

                    .page-27 {
                        margin-left: -47px !important;
                        margin-right: -30px !important;
                        width: calc(100% + 67px) !important;
                    }
                }

                @media (max-width: 768px) {
                    .page-27 {
                        margin-left: -47px !important;
                        margin-right: -30px !important;
                        width: calc(100% + 67px) !important;
                        border-right: none !important;
                    }
                    .page27-container header {
                        padding-left: 45px;
                        padding-right: 20px;
                    }
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
                    .page27-container header {
                        padding-left: 40px;
                        padding-right: 15px;
                    }
                    .page27-container h1 {
                        font-size: 1.3rem !important;
                    }
                    .page27-chart {
                        height: calc(100vh + 100px);
                        min-height: 260px;
                    }

                    .page-27 {
                        margin-left: -41px !important;
                        margin-right: -30px !important;
                        width: calc(100% + 67px) !important;
                    }
                }

                @media (max-width: 480px) {
                    .page27-container header {
                        padding-left: 35px;
                        padding-right: 10px;
                    }
                    .page27-container h1 {
                        font-size: 1.2rem !important;
                    }
                    .page27-chart {
                        height: calc(100vh + 200px) !important;
                        min-height: 200px;
                        width: calc(100% - 50px) !important;
                    }

                     .page-27 {
                        margin-left: -36px !important;
                        margin-right: -30px !important;
                        width: calc(100% + 67px) !important;
                    }
                }

                @media (max-width: 384px) {
                    .page27-container header {
                        padding-left: 30px;
                        padding-right: 24px;
                    }
                    .page27-container h1 {
                        font-size: 1.1rem !important;
                    }
                    .page27-chart {
                        height: calc(100% + 160px) !important;
                        min-height: 400px;
                        width: calc(100% - 55px) !important;
                    }

                    .page-27 {
                        margin-left: -31px !important;
                        margin-right: -30px !important;
                        width: calc(100% + 67px) !important;
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
                    <figure ref={chartRef} aria-hidden="true" style={{ margin: 0, position: 'relative' }}>
                        {!isChartInteractive && (
                            <div
                                onClick={() => setIsChartInteractive(true)}
                                onDoubleClick={() => setIsChartInteractive(true)}
                                onTouchEnd={(e) => {
                                    const now = Date.now();
                                    if (now - (e.target.lastTouch || 0) < 300) {
                                        setIsChartInteractive(true);
                                    }
                                    e.target.lastTouch = now;
                                }}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    zIndex: 10,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: 'rgba(255,255,255,0.01)'
                                }}
                                title={lang === 'en' ? 'Click to interact with chart' : 'Cliquez pour interagir avec le graphique'}
                                role="button"
                                aria-label={lang === 'en' ? 'Click to enable chart interaction' : 'Cliquez pour activer l\'interaction avec le graphique'}
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setIsChartInteractive(true);
                                    }
                                }}
                            >
                                <span style={{
                                    background: 'rgba(0,0,0,0.7)',
                                    color: 'white',
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    pointerEvents: 'none',
                                    fontSize: '14px',
                                    fontFamily: 'Arial, sans-serif'
                                }}>
                                    {lang === 'en' ? 'Click to interact' : 'Cliquez pour interagir'}
                                </span>
                            </div>
                        )}
                        {isChartInteractive && (
                            <button onClick={() => setIsChartInteractive(false)} style={{ position: 'absolute', top: 0, right: 295, zIndex: 20 }}>{lang === 'en' ? 'Done' : 'Terminé'}</button>
                        )}
                        <Plot
                            data={chartData.traces}
                            layout={{
                                barmode: 'stack',
                                hovermode: 'closest',
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
                                    traceorder: 'normal'
                                },
                                margin: { 
                                    l: windowWidth <= 384 ? 30 : windowWidth <= 480 ? 35 : windowWidth <= 640 ? 40 : windowWidth <= 768 ? 45 : 55, 
                                    r: windowWidth <= 384 ? 8 : windowWidth <= 480 ? 10 : windowWidth <= 640 ? 15 : windowWidth <= 768 ? 20 : 48,
                                    t: 10, 
                                    b: legendSettings.margin
                                },
                                autosize: true,
                                bargap: 0.15
                            }}
                            className="page27-chart"
                            useResizeHandler={true}
                            config={{ 
                                displayModeBar: isChartInteractive, 
                                responsive: true,
                                scrollZoom: isChartInteractive
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
