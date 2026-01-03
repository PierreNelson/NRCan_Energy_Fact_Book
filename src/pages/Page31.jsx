import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getInternationalInvestmentData } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const Page31 = () => {
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

    // Load data on mount
    useEffect(() => {
        getInternationalInvestmentData()
            .then(data => {
                setPageData(data);
            })
            .catch(err => {
                console.error("Failed to load international investment data:", err);
                setError(err.message || 'Failed to load data');
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    // Colors matching the NRCan Factbook chart
    const COLORS = {
        'cdia': '#419563',  
        'fdi': '#2EA3AD',  
    };

    // Data processing
    const chartData = useMemo(() => {
        if (pageData.length === 0) return null;

        const years = pageData.map(d => d.year);
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        
        // Generate tick values: start at 2008, every 2 years up to maxYear
        const tickVals = [];
        for (let y = 2008; y <= maxYear; y += 2) {
            tickVals.push(y);
        }

        // Build traces for CDIA and FDI (grouped bars)
        // Values are in millions, convert to billions
        const cdiaValues = pageData.map(d => (d.cdia || 0) / 1000);
        const fdiValues = pageData.map(d => (d.fdi || 0) / 1000);

        // Build hover text
        const cdiaHoverText = cdiaValues.map((v, i) => {
            const vFormatted = v < 1 ? v.toFixed(2) : v.toFixed(1);
            return `${getText('page31_hover_cdia', lang)}<br>${years[i]}: $${vFormatted}B`;
        });

        const fdiHoverText = fdiValues.map((v, i) => {
            const vFormatted = v < 1 ? v.toFixed(2) : v.toFixed(1);
            return `${getText('page31_hover_fdi', lang)}<br>${years[i]}: $${vFormatted}B`;
        });

        const traces = [
            {
                name: getText('page31_legend_cdia', lang),
                x: years,
                y: cdiaValues,
                type: 'bar',
                marker: { color: COLORS.cdia },
                hovertext: cdiaHoverText,
                hoverinfo: 'text',
                hoverlabel: {
                    bgcolor: '#ffffff',
                    bordercolor: '#000000',
                    font: { color: '#000000', size: windowWidth <= 480 ? 12 : 14, family: 'Arial, sans-serif' }
                },
            },
            {
                name: getText('page31_legend_fdi', lang),
                x: years,
                y: fdiValues,
                type: 'bar',
                marker: { color: COLORS.fdi },
                hovertext: fdiHoverText,
                hoverinfo: 'text',
                hoverlabel: {
                    bgcolor: '#ffffff',
                    bordercolor: '#000000',
                    font: { color: '#000000', size: windowWidth <= 480 ? 12 : 14, family: 'Arial, sans-serif' }
                },
            }
        ];

        return { traces, years, tickVals, minYear, maxYear, cdiaValues, fdiValues };
    }, [pageData, lang, windowWidth]);

    // Format value for screen readers
    const formatBillionSR = (val) => {
        const decimals = val < 1 ? 2 : 1;
        return lang === 'en' 
            ? `${val.toFixed(decimals)} billion dollars` 
            : `${val.toFixed(decimals)} milliards de dollars`;
    };

    // Screen reader summary - uses full names instead of acronyms
    const getChartDataSummary = () => {
        if (!pageData || pageData.length === 0) return '';
        
        const latestYear = pageData[pageData.length - 1];
        const latestYearNum = latestYear.year;
        const latestCDIA = (latestYear.cdia || 0) / 1000;
        const latestFDI = (latestYear.fdi || 0) / 1000;

        if (lang === 'en') {
            return `Grouped bar chart showing stock of foreign direct investment in Canada and Canadian direct investment abroad in the energy industry from ${chartData?.minYear} to ${latestYearNum}. In ${latestYearNum}, Canadian direct investment abroad was approximately ${formatBillionSR(latestCDIA)} and foreign direct investment was approximately ${formatBillionSR(latestFDI)}. Expand the data table below for detailed values.`;
        } else {
            return `Graphique à barres groupées montrant le stock d'investissement direct étranger au Canada et l'investissement direct canadien à l'étranger dans le secteur de l'énergie de ${chartData?.minYear} à ${latestYearNum}. En ${latestYearNum}, l'investissement direct canadien à l'étranger était d'environ ${formatBillionSR(latestCDIA)} et l'investissement direct étranger était d'environ ${formatBillionSR(latestFDI)}. Développez le tableau de données ci-dessous pour les valeurs détaillées.`;
        }
    };

    // Screen reader version of chart title (no asterisk, full names)
    const getChartTitleSR = () => {
        if (lang === 'en') {
            return 'Stock of foreign direct investment in Canada and Canadian direct investment abroad in the energy industry';
        } else {
            return "Stock d'investissement direct étranger au Canada et investissement direct canadien à l'étranger dans le secteur de l'énergie";
        }
    };

    // Screen reader version of footnotes (no asterisks, full names)
    const getFootnotesSR = () => {
        if (lang === 'en') {
            return 'Direct investment is defined as a company owning a minimum of 10% of voting equity interest in a foreign enterprise and is measured as the total equity value at the time of acquisition. Excludes residential expenditures and intellectual property investments such as exploration expenses. Foreign direct investment and Canadian direct investment abroad include investments in renewable electricity, do not capture other forms of renewable energy.';
        } else {
            return "L'investissement direct est défini comme une société détenant au moins 10 % des actions avec droit de vote dans une entreprise étrangère et est mesuré comme la valeur totale des capitaux propres au moment de l'acquisition. Exclut les dépenses résidentielles et les investissements en propriété intellectuelle tels que les dépenses d'exploration. L'investissement direct étranger et l'investissement direct canadien à l'étranger incluent les investissements dans l'électricité renouvelable, ne comprennent pas d'autres formes d'énergie renouvelable.";
        }
    };

    // Format number for table display
    const formatNumber = (val) => {
        const decimals = val < 1 ? 2 : 1;
        return val.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { 
            minimumFractionDigits: decimals, 
            maximumFractionDigits: decimals 
        });
    };

    // Generate accessible data table
    const getAccessibleDataTable = () => {
        if (!pageData || pageData.length === 0) return null;
        
        const unitText = lang === 'en' ? ', in billions of dollars' : ', en milliards de dollars';
        const captionId = 'page31-table-caption';
        
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
                    <table style={{ 
                        width: '100%', 
                        minWidth: windowWidth <= 480 ? '100%' : '400px', 
                        borderCollapse: 'collapse', 
                        textAlign: 'left', 
                        fontSize: '14px' 
                    }}>
                        <caption 
                            id={captionId}
                            style={{ 
                                textAlign: 'left', 
                                padding: '8px', 
                                fontWeight: 'bold',
                                backgroundColor: '#f0f0f0',
                                whiteSpace: 'normal',
                                wordBreak: 'break-word'
                            }}
                        >
                            {lang === 'en' 
                                ? 'Stock of foreign direct investment (FDI) in Canada and Canadian direct investment abroad (CDIA) in the energy industry (billions of dollars)'
                                : "Stock d'investissement direct étranger (IDE) au Canada et investissement direct canadien à l'étranger (IDCE) dans le secteur de l'énergie (milliards de dollars)"}
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
                                <th scope="col" style={{ padding: '8px', borderBottom: '2px solid #ddd' }}>
                                    {getText('page31_legend_cdia', lang)}
                                    <span className="sr-only">{unitText}</span>
                                </th>
                                <th scope="col" style={{ padding: '8px', borderBottom: '2px solid #ddd' }}>
                                    {getText('page31_legend_fdi', lang)}
                                    <span className="sr-only">{unitText}</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageData.map(yearData => {
                                const cdiaVal = (yearData.cdia || 0) / 1000;
                                const fdiVal = (yearData.fdi || 0) / 1000;
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
                                        <td style={{ padding: '8px' }}>{formatNumber(cdiaVal)}</td>
                                        <td style={{ padding: '8px' }}>{formatNumber(fdiVal)}</td>
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
            className="page-content page-31" 
            role="main"
            aria-label={getText('page31_title', lang)}
            style={{
                backgroundColor: 'white',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                overflowX: 'hidden',
                borderRight: '18px solid #8e7e52',
                boxSizing: 'border-box',
            }}
        >
            <style>{`
                /* BASE: 100% zoom (>1745px) */
                .page31-container {
                    width: 100%;
                    padding: 15px 30px 0 30px;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    flex: 1;
                    overflow: visible;
                }
                
                .page31-chart {
                    width: 100%;
                    height: calc(100vh - 300px); 
                    min-height: 500px;
                }

                .page31-title {
                    font-family: 'Georgia', serif;
                    color: #58585a;
                    font-size: 2.4rem;
                    font-weight: bold;
                    margin-bottom: 10px;
                    margin-top: 5px;
                }

                .page31-subtitle {
                    font-family: Arial, sans-serif;
                    color: #332f30;
                    font-size: 1.125rem;
                    margin-bottom: 15px;
                    line-height: 1.5;
                }

                .page31-chart-title {
                    font-family: Arial, sans-serif;
                    color: #333;
                    font-size: 1.4rem;
                    font-weight: bold;
                    text-align: center;
                    margin-bottom: 5px;
                }

                .page31-footnotes {
                    font-family: Arial, sans-serif;
                    font-size: 1rem;
                    color: #555;
                    margin-top: 10px;
                    line-height: 1.4;
                }

                /* 110% zoom (~1745px) */
                @media (max-width: 1745px) {
                    .page31-chart {
                        height: calc(100vh - 450px);
                        min-height: 260px;
                        max-height: 450px;
                    }
                }

                /* 125% zoom (~1536px) */
                @media (max-width: 1536px) {
                    .page31-container {
                        padding: 10px 25px 10px 25px;
                    }
                    .page31-title {
                        font-size: 1.8rem;
                    }
                    .page31-chart {
                        height: calc(100vh - 420px);
                        min-height: 240px;
                        max-height: 400px;
                    }
                }

                /* 150% zoom (~1280px) */
                @media (max-width: 1280px) {
                    .page31-container {
                        padding: 10px 20px 10px 20px;
                    }
                    .page31-title {
                        font-size: 1.6rem;
                    }
                    .page31-chart {
                        height: calc(100vh - 380px);
                        min-height: 220px;
                        max-height: 380px;
                    }
                }

                /* 175% zoom (~1097px) */
                @media (max-width: 1097px) {
                    .page31-title {
                        font-size: 1.5rem;
                    }
                    .page31-subtitle {
                        font-size: 1.2rem;
                    }
                    .page31-chart {
                        height: calc(100vh - 340px);
                        min-height: 200px;
                        max-height: 350px;
                    }
                }

                /* 200% zoom (~960px) */
                @media (max-width: 960px) {
                    .page31-container {
                        padding: 8px 15px 8px 15px;
                    }
                    .page31-title {
                        font-size: 1.4rem;
                    }
                    .page31-subtitle {
                        font-size: 1.2rem;
                    }
                    .page31-chart {
                        height: calc(100vh - 280px);
                        min-height: 180px;
                        max-height: 320px;
                    }
                }

                /* 250% zoom (~768px) */
                @media (max-width: 768px) {
                    .page-31 {
                        border-right: none !important;
                    }
                    .page31-container {
                        padding: 8px 15px;
                    }
                    .page31-title {
                        font-size: 1.3rem;
                    }
                    .page31-subtitle {
                        font-size: 1.2rem;
                    }
                    .page31-chart {
                        height: 400px;
                        min-height: 200px;
                        max-height: none;
                    }
                    .page31-footnotes {
                        font-size: 0.9rem;
                    }
                }
                
                /* 300% zoom (~640px) */
                @media (max-width: 640px) {
                    .page31-title {
                        font-size: 1.2rem;
                    }
                    .page31-subtitle {
                        font-size: 1.2rem;
                    }
                    .page31-chart {
                        height: 450px;
                        min-height: 180px;
                    }
                }

                /* 400% zoom (~480px) */
                @media (max-width: 480px) {
                    .page31-container {
                        padding: 5px 10px;
                    }
                    .page31-title {
                        font-size: 1.1rem;
                    }
                    .page31-subtitle {
                        font-size: 1.2rem;
                    }
                    .page31-chart {
                        height: 500px;
                        min-height: 160px;
                    }
                }

                /* 500% zoom (~384px) */
                @media (max-width: 384px) {
                    .page31-container {
                        padding: 5px 8px;
                    }
                    .page31-title {
                        font-size: 1rem;
                    }
                    .page31-subtitle {
                        font-size: 1.2rem;
                    }
                    .page31-chart {
                        height: 550px;
                        min-height: 140px;
                    }
                }
                
                /* Hide default disclosure triangle */
                details summary::-webkit-details-marker,
                details summary::marker {
                    display: none;
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

            <div className="page31-container">
                {/* Header Section */}
                <header role="region" aria-label={getText('page31_title', lang)}>
                    <h1 className="page31-title" aria-hidden="true">
                        {getText('page31_title', lang)}
                    </h1>
                    <p className="page31-subtitle">
                        {getText('page31_subtitle', lang)}
                    </p>
                </header>

                {/* Chart Section */}
                <div>
                    {/* Chart Title - visible version with asterisk */}
                    <h2 className="page31-chart-title" aria-hidden="true">
                        {getText('page31_chart_title', lang)}
                    </h2>
                    
                    {/* Screen reader: Chart title (no asterisk, full names) */}
                    <h2 className="sr-only">{getChartTitleSR()}</h2>
                    
                    {/* Screen reader: Footnotes read immediately after title */}
                    <p className="sr-only">{getFootnotesSR()}</p>

                    {/* Chart overview for screen readers */}
                    <div 
                        role="region"
                        aria-label={getChartDataSummary()}
                    >
                        {/* Accessible data table */}
                        {getAccessibleDataTable()}
                        
                        <figure aria-hidden="true" style={{ margin: 0 }}>
                            <Plot
                            data={chartData.traces}
                            layout={{
                                barmode: 'group',
                                hovermode: 'closest',
                                xaxis: {
                                    tickvals: chartData.tickVals,
                                    showgrid: false,
                                    zeroline: false,
                                    range: [chartData.minYear - 0.5, chartData.maxYear + 0.5],
                                    tickangle: windowWidth <= 640 ? -45 : 0,
                                    tickfont: { size: windowWidth <= 480 ? 10 : 12, family: 'Arial, sans-serif' },
                                    automargin: true,
                                },
                                yaxis: {
                                    title: { 
                                        text: getText('page31_yaxis', lang), 
                                        font: { size: windowWidth <= 768 ? 18 : windowWidth <= 960 ? 20 : 24, family: 'Arial, sans-serif', color: '#58585a'},
                                        standoff: 5
                                    },
                                    rangemode: 'tozero',
                                    showgrid: false,
                                    showline: true,
                                    linewidth: 1,
                                    linecolor: '#333',
                                    automargin: true,
                                    tickfont: { size: windowWidth <= 480 ? 9 : 11, family: 'Arial, sans-serif' }
                                },
                                legend: {
                                    orientation: 'h',
                                    x: windowWidth <= 384 ? 0.17 : windowWidth <= 480 ? 0.13 : windowWidth <= 640 ? 0.12 : windowWidth <= 768 ? 0.094 : windowWidth <= 960 ? 0.074 : windowWidth <= 1097 ? 0.064 : windowWidth <= 1280 ? 0.052 : windowWidth <= 1536 ? 0.044 : windowWidth <= 1745 ? 0.038 : 0.035,
                                    xanchor: 'center',
                                    y: -0.34,
                                    yanchor: 'bottom',
                                    font: { size: windowWidth <= 480 ? 11 : 18, family: 'Arial, sans-serif' },
                                    traceorder: 'normal'
                                },
                                margin: { 
                                    l: windowWidth <= 480 ? 45 : windowWidth <= 768 ? 55 : 65, 
                                    r: 15,
                                    t: 40, 
                                    b: 50
                                },
                                autosize: true,
                                bargap: 0.15,
                                bargroupgap: 0.1
                            }}
                            style={{ width: '100%', height: windowWidth <= 768 ? '320px' : '340px' }}
                            useResizeHandler={true}
                            config={{ displayModeBar: false, responsive: true }}
                            />
                        </figure>
                    </div>
                </div>

                {/* Footnotes - visible version (hidden from screen readers since read above) */}
                <footer className="page31-footnotes" aria-hidden="true">
                    <p style={{ marginBottom: '8px' }}>{getText('page31_footnote1', lang)}</p>
                    <p>{getText('page31_footnote2', lang)}</p>
                </footer>
            </div>
        </main>
    );
};

export default Page31;

