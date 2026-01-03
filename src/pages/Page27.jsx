import React, { useState, useEffect, useMemo } from 'react';
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

    // Track window width for responsive chart settings
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Calculate legend settings based on zoom level (window width)
    const legendSettings = useMemo(() => {
        // 400%+ Zoom (<=480px): Target 7 rows (1 column)
        if (windowWidth <= 480) {
            return { width: 1.0, margin: 120, fontSize: 9, y: -0.25 };
        }
        // 300% Zoom (<=640px): Target 6 rows
        else if (windowWidth <= 640) {
            return { width: 0.85, margin: 120, fontSize: 11, y: -0.24 };
        }
        // 200%-250% Zoom (<=960px): Target 4 rows (2 columns)
        else if (windowWidth <= 960) {
            return { width: 0.49, margin: 120, fontSize: 12, y: -0.22 };
        }

        else if (windowWidth <= 1097) {
            return { width: 0.49, margin: 120, fontSize: 14, y: -0.18 };
        }
        // 125%-175% Zoom (<=1536px): Target 3 rows (3 columns)
        else if (windowWidth <= 1536) {
            return { width: 0.32, margin: 120, fontSize: 14, y: -0.18 };
        }
        // Default (100%-110% Zoom): Target 2 rows (4 columns)
        else {
            return { width: 0.25, margin: 120, fontSize: 16, y: -0.15 };
        }
    }, [windowWidth]);

    // Load data on mount
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

    // Colors matching the NRCan Factbook chart (from bottom to top of stack)
    const COLORS = {
        'transmission_distribution': '#224397',  
        'pipelines': '#857550',                  
        'nuclear': '#E4570C',                   
        'other_electric': '#787878',          
        'hydraulic': '#2CA2AF',            
        'wind_solar': '#6cbe8d',                
        'steam_thermal': '#A78F16',             
    };

    // Category order (bottom to top in stack) - matching Factbook order
    const CATEGORY_ORDER = [
        'transmission_distribution',
        'hydraulic',
        'pipelines', 
        'wind_solar',
        'nuclear',
        'steam_thermal',
        'other_electric'
    ];

    // Legend key mapping
    const LEGEND_KEYS = {
        'transmission_distribution': 'page27_legend_transmission',
        'pipelines': 'page27_legend_pipelines',
        'nuclear': 'page27_legend_nuclear',
        'other_electric': 'page27_legend_other',
        'hydraulic': 'page27_legend_hydraulic',
        'wind_solar': 'page27_legend_wind_solar',
        'steam_thermal': 'page27_legend_steam',
    };

    // Hover key mapping
    const HOVER_KEYS = {
        'transmission_distribution': 'page27_hover_transmission',
        'pipelines': 'page27_hover_pipelines',
        'nuclear': 'page27_hover_nuclear',
        'other_electric': 'page27_hover_other',
        'hydraulic': 'page27_hover_hydraulic',
        'wind_solar': 'page27_hover_wind_solar',
        'steam_thermal': 'page27_hover_steam',
    };

    // Data processing
    const chartData = useMemo(() => {
        if (pageData.length === 0) return null;

        const years = pageData.map(d => d.year);
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        
        // Generate tick values (every 1 year)
        const tickVals = [];
        for (let y = minYear; y <= maxYear; y++) {
            tickVals.push(y);
        }

        // Calculate totals for each year
        const totalValues = pageData.map(d => {
            let total = 0;
            CATEGORY_ORDER.forEach(cat => {
                total += (d[cat] || 0) / 1000; // Convert to billions
            });
            return total;
        });

        // Legend order changes based on zoom level
        // At 125%+ zoom (<=1536px): left-to-right order
        // At 100%-110% zoom (>1536px): 4-column layout order
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

        // Build traces for each category with per-category hover
        const traces = CATEGORY_ORDER.map((cat) => {
            const values = pageData.map(d => (d[cat] || 0) / 1000); // Convert to billions
            
            // Build hover text for each bar
            // Use 2 decimal places for values < 1B, 1 decimal place otherwise
            const hoverTexts = values.map((v, i) => {
                const y = years[i];
                const tot = totalValues[i];
                const catName = getText(HOVER_KEYS[cat], lang);
                const vFormatted = v < 1 ? v.toFixed(2) : v.toFixed(1);
                const totFormatted = tot < 1 ? tot.toFixed(2) : tot.toFixed(1);
                return `${catName}<br>${y}: $${vFormatted}B<br><b>${getText('page27_hover_total', lang)}: $${totFormatted}B</b>`;
            });

            // Get legend rank based on display order (not stack order)
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

        // Dynamic chart title with year range
        const chartTitle = `${getText('page27_chart_title_prefix', lang)}${minYear}–${maxYear}`;

        return { traces, years, tickVals, minYear, maxYear, chartTitle };
    }, [pageData, lang, windowWidth]);

    // Format value for screen readers (avoids "$30.3" being read as "30 dollars and 30 cents")
    // Use 2 decimal places for values < 1B, 1 decimal place otherwise
    const formatBillionSR = (val) => {
        const decimals = val < 1 ? 2 : 1;
        return lang === 'en' 
            ? `${val.toFixed(decimals)} billion dollars` 
            : `${val.toFixed(decimals)} milliards de dollars`;
    };

    // Screen reader summary
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

    // Format number for screen readers using locale
    // Use 2 decimal places for values < 1B, 1 decimal place otherwise
    const formatNumber = (val) => {
        const decimals = val < 1 ? 2 : 1;
        return val.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { 
            minimumFractionDigits: decimals, 
            maximumFractionDigits: decimals 
        });
    };

    // Helper to strip HTML tags from text
    const stripHtml = (text) => text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

    // Generate accessible data table with details/summary pattern
    const getAccessibleDataTable = () => {
        if (!pageData || pageData.length === 0) return null;
        
        // Strip HTML tags from category labels
        const categoryLabels = {
            'transmission_distribution': stripHtml(getText('page27_legend_transmission', lang)),
            'hydraulic': stripHtml(getText('page27_legend_hydraulic', lang)),
            'pipelines': stripHtml(getText('page27_legend_pipelines', lang)),
            'wind_solar': stripHtml(getText('page27_legend_wind_solar', lang)),
            'nuclear': stripHtml(getText('page27_legend_nuclear', lang)),
            'steam_thermal': stripHtml(getText('page27_legend_steam', lang)),
            'other_electric': stripHtml(getText('page27_legend_other', lang)),
        };

        const unitText = lang === 'en' ? ', in billions of dollars' : ', en milliards de dollars';
        const captionId = 'page27-table-caption';
        
        return (
            <details 
                onToggle={(e) => setIsTableOpen(e.currentTarget.open)}
                style={{ 
                    marginTop: '10px', 
                    marginBottom: '10px', 
                    width: '95%',
                    marginLeft: 'auto',
                    marginRight: 'auto',
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
                    {lang === 'en' ? 'View Data Table' : 'Voir le tableau de données'}
                    <span className="sr-only">{lang === 'en' ? ' (press Enter to open or close)' : ' (appuyez sur Entrée pour ouvrir ou fermer)'}</span>
                </summary>

                <div 
                    role="region"
                    aria-labelledby={captionId}
                    tabIndex="0"
                    style={{ 
                        overflowX: 'auto',
                        overflowY: 'visible',
                        border: '1px solid #ccc', 
                        borderTop: 'none',
                        padding: '10px',
                        maxHeight: 'none'
                    }}
                >
                    <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                        <caption 
                            id={captionId}
                            style={{ 
                                textAlign: 'left', 
                                padding: '8px', 
                                fontWeight: 'bold',
                                backgroundColor: '#f0f0f0'
                            }}
                        >
                            {lang === 'en' 
                                ? 'Public and private investment in fuel, energy and pipeline infrastructure (billions of constant 2012 dollars)'
                                : 'Investissements publics et privés dans les infrastructures de carburant, d\'énergie et de pipeline (milliards de dollars constants de 2012)'}
                        </caption>
                        <thead>
                            <tr style={{ backgroundColor: '#eee' }}>
                                <th scope="col" style={{ 
                                    padding: '8px', 
                                    borderBottom: '2px solid #ddd',
                                    position: 'sticky',
                                    left: 0,
                                    backgroundColor: '#eee',
                                    zIndex: 2
                                }}>
                                    {lang === 'en' ? 'Year' : 'Année'}
                                </th>
                                {CATEGORY_ORDER.map(cat => (
                                    <th key={cat} scope="col" style={{ padding: '8px', borderBottom: '2px solid #ddd', whiteSpace: 'nowrap' }}>
                                        {categoryLabels[cat]}
                                        <span className="sr-only"> {unitText}</span>
                                    </th>
                                ))}
                                <th scope="col" style={{ padding: '8px', borderBottom: '2px solid #ddd' }}>
                                    {lang === 'en' ? 'Total' : 'Total'}
                                    <span className="sr-only"> {unitText}</span>
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
                                    <tr key={yearData.year} style={{ borderBottom: '1px solid #eee' }}>
                                        <th scope="row" style={{ 
                                            padding: '8px', 
                                            fontWeight: 'normal',
                                            position: 'sticky',
                                            left: 0,
                                            backgroundColor: '#f9f9f9',
                                            zIndex: 1
                                        }}>
                                            {yearData.year}
                                        </th>
                                        {CATEGORY_ORDER.map(cat => (
                                            <td key={cat} style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                                                {formatNumber((yearData[cat] || 0) / 1000)}
                                            </td>
                                        ))}
                                        <td style={{ padding: '8px', fontWeight: 'bold' }}>{formatNumber(total)}</td>
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
                borderRight: '18px solid #8e7e52',
                boxSizing: 'border-box',
            }}
        >
            <style>{`
                /* BASE: 100% zoom (>1745px) */
                .page27-container {
                    width: 100%;
                    padding: 10px 30px 0px 30px;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    flex: 1;
                    overflow: visible;
                }
                
                .page27-chart {
                    width: 100%;
                    height: calc(100vh - 380px);
                    min-height: 350px;
                }

                /* 110% zoom (~1745px) */
                @media (max-width: 1745px) {
                    .page27-chart {
                        height: calc(100vh - 280px);
                        min-height: 380px;
                    }
                }

                /* 125% zoom (~1536px) */
                @media (max-width: 1536px) {
                    .page27-container {
                        padding: 10px 25px 0px 25px;
                    }
                    .page27-chart {
                        height: calc(100vh - 220px);
                        min-height: 360px;
                    }
                }

                /* 150% zoom (~1280px) */
                @media (max-width: 1280px) {
                    .page27-container {
                        padding: 10px 20px 0px 20px;
                    }
                    .page27-chart {
                        height: calc(100vh - 160px);
                        min-height: 340px;
                    }
                }

                /* 175% zoom (~1097px) */
                @media (max-width: 1097px) {
                    .page27-chart {
                        height: calc(100vh - 120px);
                        min-height: 320px;
                    }
                }

                /* 200% zoom (~960px) */
                @media (max-width: 960px) {
                    .page27-container {
                        padding: 8px 15px 0px 15px;
                    }
                    .page27-chart {
                        height: calc(100vh - 80px);
                        min-height: 300px;
                    }
                }

                /* 250% zoom (~768px) */
                @media (max-width: 768px) {
                    .page-27 {
                        border-right: none !important;
                    }
                    .page27-container {
                        padding: 8px 15px;
                    }
                    .page27-container h1 {
                        font-size: 1.4rem !important;
                    }
                    .page27-chart {
                        height: calc(100vh - 20px);
                        min-height: 280px;
                    }
                }
                
                /* 300% zoom (~640px) */
                @media (max-width: 640px) {
                    .page27-container h1 {
                        font-size: 1.3rem !important;
                    }
                    .page27-chart {
                        height: calc(100vh + 100px);
                        min-height: 260px;
                    }
                }

                /* 400% zoom (~480px) */
                @media (max-width: 480px) {
                    .page27-container {
                        padding: 5px 10px;
                    }
                    .page27-container h1 {
                        font-size: 1.2rem !important;
                    }
                    .page27-chart {
                        height: calc(100vh + 200px);
                        min-height: 240px;
                    }
                }

                /* 500% zoom (~384px) */
                @media (max-width: 384px) {
                    .page27-container {
                        padding: 5px 8px;
                    }
                    .page27-container h1 {
                        font-size: 1.1rem !important;
                    }
                    .page27-chart {
                        height: calc(100vh + 300px);
                        min-height: 220px;
                    }
                }
                
                /* Hide default disclosure triangle */
                details summary::-webkit-details-marker,
                details summary::marker {
                    display: none;
                }

                /* Screen reader only table - visually hidden but accessible */
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
                {/* Title */}
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
                        textAlign: 'center',
                    }}>
                        {chartData.chartTitle}
                    </h1>
                </header>

                {/* Chart */}
                <div 
                    role="region"
                    aria-label={getChartDataSummary()}
                >
                    {/* Accessible data table for screen readers */}
                    {getAccessibleDataTable()}
                    
                    <figure aria-hidden="true" style={{ margin: 0 }}>
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
                                    x: 0.5,
                                    xanchor: 'center',
                                    y: legendSettings.y,
                                    yanchor: 'top',
                                    entrywidth: legendSettings.width,
                                    entrywidthmode: 'fraction',
                                    font: { size: legendSettings.fontSize, family: 'Arial, sans-serif' },
                                    traceorder: 'normal'
                                },
                                margin: { 
                                    l: windowWidth <= 480 ? 50 : windowWidth <= 768 ? 60 : 70, 
                                    r: 15,
                                    t: 10, 
                                    b: legendSettings.margin
                                },
                                autosize: true,
                                bargap: 0.15
                            }}
                            className="page27-chart"
                            useResizeHandler={true}
                            config={{ displayModeBar: false, responsive: true }}
                        />
                    </figure>
                </div>
            </div>
        </main>
    );
};

export default Page27;

