import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getInternationalInvestmentData } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const Page31 = () => {
    const { lang, layoutPadding } = useOutletContext();
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

    const COLORS = {
        'cdia': '#419563',  
        'fdi': '#2EA3AD',  
    };

    const chartData = useMemo(() => {
        if (pageData.length === 0) return null;

        const years = pageData.map(d => d.year);
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        
        const tickVals = [];
        for (let y = 2008; y <= maxYear; y += 2) {
            tickVals.push(y);
        }

        const cdiaValues = pageData.map(d => (d.cdia || 0) / 1000);
        const fdiValues = pageData.map(d => (d.fdi || 0) / 1000);

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

    const formatBillionSR = (val) => {
        const decimals = val < 1 ? 2 : 1;
        return lang === 'en' 
            ? `${val.toFixed(decimals)} billion dollars` 
            : `${val.toFixed(decimals)} milliards de dollars`;
    };

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

    const getChartTitleSR = () => {
        if (lang === 'en') {
            return 'Stock of foreign direct investment in Canada and Canadian direct investment abroad in the energy industry';
        } else {
            return "Stock d'investissement direct étranger au Canada et investissement direct canadien à l'étranger dans le secteur de l'énergie";
        }
    };

    const getFootnotesSR = () => {
        if (lang === 'en') {
            return 'Direct investment is defined as a company owning a minimum of 10% of voting equity interest in a foreign enterprise and is measured as the total equity value at the time of acquisition. Excludes residential expenditures and intellectual property investments such as exploration expenses. Foreign direct investment and Canadian direct investment abroad include investments in renewable electricity, do not capture other forms of renewable energy.';
        } else {
            return "L'investissement direct est défini comme une société détenant au moins 10 % des actions avec droit de vote dans une entreprise étrangère et est mesuré comme la valeur totale des capitaux propres au moment de l'acquisition. Exclut les dépenses résidentielles et les investissements en propriété intellectuelle tels que les dépenses d'exploration. L'investissement direct étranger et l'investissement direct canadien à l'étranger incluent les investissements dans l'électricité renouvelable, ne comprennent pas d'autres formes d'énergie renouvelable.";
        }
    };

    const formatNumber = (val) => {
        const decimals = val < 1 ? 2 : 1;
        return val.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { 
            minimumFractionDigits: decimals, 
            maximumFractionDigits: decimals 
        });
    };

    const getAccessibleDataTable = () => {
        if (!pageData || pageData.length === 0) return null;
        
        const cellUnitSR = lang === 'en' ? ' billion dollars' : ' milliards de dollars';
        const headerUnitVisual = lang === 'en' ? '($ billions)' : '(milliards $)';
        const headerUnitSR = lang === 'en' ? '(billions of dollars)' : '(milliards de dollars)';
        const captionId = 'page31-table-caption';
        const cdiaLabel = getText('page31_legend_cdia', lang);
        const fdiLabel = getText('page31_legend_fdi', lang);
        
        return (
            <details 
                onToggle={(e) => setIsTableOpen(e.currentTarget.open)}
                className="page31-data-table"
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
                                ? 'Stock of foreign direct investment (FDI) in Canada and Canadian direct investment abroad (CDIA) in the energy industry (billions of dollars)'
                                : "Stock d'investissement direct étranger (IDE) au Canada et investissement direct canadien à l'étranger (IDCE) dans le secteur de l'énergie (milliards de dollars)"}
                        </caption>
                        <thead>
                            <tr>
                                <td className="text-center fw-bold">{lang === 'en' ? 'Year' : 'Année'}</td>
                                <td className="text-center fw-bold">
                                    {cdiaLabel}<br/>
                                    <span aria-hidden="true">{headerUnitVisual}</span>
                                    <span className="wb-inv">{headerUnitSR}</span>
                                </td>
                                <td className="text-center fw-bold">
                                    {fdiLabel}<br/>
                                    <span aria-hidden="true">{headerUnitVisual}</span>
                                    <span className="wb-inv">{headerUnitSR}</span>
                                </td>
                            </tr>
                        </thead>
                        <tbody>
                            {pageData.map(yearData => {
                                const yearHeaderId = `year-${yearData.year}`;
                                const cdiaVal = (yearData.cdia || 0) / 1000;
                                const fdiVal = (yearData.fdi || 0) / 1000;
                                return (
                                    <tr key={yearData.year}>
                                        <th scope="row" id={yearHeaderId}>{yearData.year}</th>
                                        <td headers={yearHeaderId}>
                                            <span className="wb-inv">{yearData.year}, {cdiaLabel}: </span>
                                            {formatNumber(cdiaVal)}
                                            <span className="wb-inv">{cellUnitSR}</span>
                                        </td>
                                        <td headers={yearHeaderId}>
                                            <span className="wb-inv">{yearData.year}, {fdiLabel}: </span>
                                            {formatNumber(fdiVal)}
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
                boxSizing: 'border-box',
                borderRight: '18px solid #8e7e52',
            }}
        >
            <style>{`
                /* =====================================================
                   PAGE 31 - BORDER PAGE STYLES
                   Border extends past container, content aligns with anchors.
                   ===================================================== */

                /* Extend right for border, content padded to align with anchors */
                .page-31 {
                    margin-right: -${layoutPadding?.right || 15}px;
                    width: calc(100% + ${layoutPadding?.right || 15}px);
                    padding-right: ${(layoutPadding?.right || 15) - 18}px; /* 18px is border width */
                }
                
                .page31-container {
                    width: 100%;
                    padding: 15px 0 0 0; 
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    flex: 1;
                    overflow: visible;
                }
                
                .page31-chart {
                    height: calc(100vh - 700px);
                    width: 100%;
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

                .page31-data-table {
                    margin-top: 10px;
                    margin-bottom: 10px;
                    margin-left: 0;
                    margin-right: 0;
                    font-family: Arial, sans-serif;
                    width: 100%;
                }

                .page31-footnotes {
                    font-family: Arial, sans-serif;
                    font-size: 1rem;
                    color: #555;
                    margin-top: 10px;
                    line-height: 1.4;
                }

                /* Chart height and font size breakpoints only */
                @media (max-width: 1745px) {
                    .page31-chart {
                        height: calc(100vh - 450px);
                        min-height: 480px;
                    }
                }

                @media (max-width: 1536px) {
                    .page31-title {
                        font-size: 1.8rem;
                    }
                    .page31-chart {
                        height: calc(100vh - 420px);
                        min-height: 460px;
                    }
                }

                @media (max-width: 1280px) {
                    .page31-title {
                        font-size: 1.6rem;
                    }
                    .page31-chart {
                        height: calc(100vh - 380px);
                        min-height: 440px;
                    }
                }

                @media (max-width: 1097px) {
                    .page31-title {
                        font-size: 1.5rem;
                    }
                    .page31-subtitle {
                        font-size: 1.2rem;
                    }
                    .page31-chart {
                        height: calc(100vh - 340px);
                        min-height: 420px;
                    }
                }

                @media (max-width: 960px) {
                    .page31-title {
                        font-size: 1.4rem;
                    }
                    .page31-subtitle {
                        font-size: 1.2rem;
                    }
                    .page31-chart {
                        height: calc(100vh - 280px);
                        min-height: 400px;
                    }
                }

                @media (max-width: 768px) {
                    .page-31 { border-right: none !important; }
                    .page31-title {
                        font-size: 1.3rem;
                        text-align: left !important;
                    }
                    .page31-subtitle {
                        font-size: 1.2rem;
                        text-align: left !important;
                    }
                    .page31-chart {
                        height: calc(100vh - 280px);
                        min-height: 350px;
                    }
                    .page31-footnotes {
                        font-size: 0.9rem;
                    }
                }
                
                @media (max-width: 640px) {
                    .page31-title {
                        font-size: 1.2rem;
                    }
                    .page31-subtitle {
                        font-size: 1.2rem;
                    }
                    .page31-chart {
                        height: calc(100vh - 260px);
                        min-height: 320px;
                    }
                }

                @media (max-width: 480px) {
                    .page31-title {
                        font-size: 1.1rem;
                    }
                    .page31-subtitle {
                        font-size: 1.2rem;
                    }
                    .page31-chart {
                        height: calc(100vh - 240px);
                        min-height: 280px;
                    }
                }

                @media (max-width: 384px) {
                    .page31-title {
                        font-size: 1rem;
                    }
                    .page31-subtitle {
                        font-size: 1.2rem;
                    }
                    .page31-chart {
                        height: calc(100vh - 220px);
                        min-height: 250px;
                    }
                }
                
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
                <header role="region" aria-label={getText('page31_title', lang)}>
                    <h1 className="page31-title" aria-hidden="true">
                        {getText('page31_title', lang)}
                    </h1>
                    <p className="page31-subtitle">
                        {getText('page31_subtitle', lang)}
                    </p>
                </header>

                <div>
                    <h2 className="page31-chart-title" aria-hidden="true">
                        {getText('page31_chart_title', lang)}
                    </h2>
                    
                    <h2 className="sr-only">{getChartTitleSR()}</h2>
                    
                    <p className="sr-only">{getFootnotesSR()}</p>

                    <div 
                        role="region"
                        aria-label={getChartDataSummary()}
                    >
                        <figure 
                            ref={chartRef} 
                            className="page31-chart"
                            aria-hidden="true" 
                            style={{ margin: 0, position: 'relative' }}
                        >
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
                                    x: windowWidth <= 384 ? 0.17 : windowWidth <= 480 ? 0.13 : windowWidth <= 640 ? 0.12 : windowWidth <= 768 ? 0.094 : windowWidth <= 960 ? 0.074 : windowWidth <= 1097 ? 0.064 : windowWidth <= 1280 ? 0.052 : windowWidth <= 1536 ? 0.044 : windowWidth <= 1745 ? 0.044 : 0.045,
                                    xanchor: 'center',
                                    y: windowWidth <= 384 ? -0.40 : windowWidth <= 480 ? -0.34 : windowWidth <= 640 ? -0.34 : windowWidth <= 768 ? -0.24 : windowWidth <= 960 ? -0.18 : windowWidth <= 1097 ? -0.16 :windowWidth <= 1280 ? -0.16 : windowWidth <= 1536 ? -0.16 : windowWidth <= 1745 ? -0.16 : -0.16,
                                    yanchor: 'bottom',
                                    font: { size: windowWidth <= 480 ? 11 : 18, family: 'Arial, sans-serif' },
                                    traceorder: 'normal'
                                },
                                margin: { 
                                    l: 0, 
                                    r: 0,
                                    t: 40, 
                                    b: 50
                                },
                                autosize: true,
                                bargap: 0.15,
                                bargroupgap: 0.1
                            }}
                            style={{ width: '100%', height: '100%' }} 
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

                <aside className="wb-fnote" role="note" style={{ marginTop: '10px', padding: '10px 0' }}>
                    <h2 id="fn-page31" className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl className="page31-footnotes" style={{ margin: 0 }}>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnote 1' : 'Note de bas de page 1'}</dt>
                        <dd id="fn1-page31" style={{ margin: '0 0 8px 0' }}>
                            <p style={{ margin: 0 }}>{getText('page31_footnote1', lang)}</p>
                        </dd>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnote 2' : 'Note de bas de page 2'}</dt>
                        <dd id="fn2-page31" style={{ margin: 0 }}>
                            <p style={{ margin: 0 }}>{getText('page31_footnote2', lang)}</p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page31;
