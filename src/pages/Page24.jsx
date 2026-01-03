
import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getCapitalExpendituresData } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const Page24 = () => {
    const { lang } = useOutletContext();
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false); // Track if data table is expanded

    // Track window width for responsive chart settings
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Load data on mount + prefetch next page
    useEffect(() => {
        getCapitalExpendituresData()
            .then(data => {
                setPageData(data);
            })
            .catch(err => {
                console.error("Failed to load capital expenditures data:", err);
                setError(err.message || 'Failed to load data');
            })
            .finally(() => {
                setLoading(false);
            });
        
        // Preload the next page while user reads this one
        import('./Page25');
    }, []);

    // Data Processing
    const { latestRow, peakRow, row2020 } = useMemo(() => {
        if (pageData.length === 0) return { latestRow: null, peakRow: null, row2020: null };
        const latest = pageData[pageData.length - 1];
        const peak = [...pageData].sort((a, b) => b.total - a.total)[0];
        const r2020 = pageData.find(d => d.year === 2020) || latest;
        return { latestRow: latest, peakRow: peak, row2020: r2020 };
    }, [pageData]);

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
    }

    if (error) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'red' }}>Error: {error}. Please refresh the page.</div>;
    }

    if (!latestRow) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>No data available. Please refresh the page.</div>;
    }

    // Calculations
    const totalLatestBillion = latestRow.total / 1000;
    const peakTotalBillion = peakRow.total / 1000;
    const low2020Billion = row2020.total / 1000;

    const declineFromPeakPct = ((peakTotalBillion - totalLatestBillion) / peakTotalBillion) * 100;
    const reboundFrom2020Pct = ((totalLatestBillion - low2020Billion) / low2020Billion) * 100;

    // Billions for display
    const oilGasBillion = latestRow.oil_gas / 1000;
    const electricityBillion = latestRow.electricity / 1000;

    // Helper for formatting (visual display with $)
    const formatBillion = (val) => {
        const text = getText('billion', lang);
        return lang === 'en' ? `$${val.toFixed(0)} ${text}` : `${val.toFixed(0)} $ ${text}`;
    };

    // Helper for screen reader formatting (no $ symbol)
    const formatBillionSR = (val) => {
        const text = getText('billion', lang);
        return `${val.toFixed(1)} ${text} ${lang === 'en' ? 'dollars' : 'dollars'}`;
    };

    // Chart Data Preparation
    const years = pageData.map(d => d.year);
    const minYear = years.length > 0 ? Math.min(...years) : 2007;
    const maxYear = years.length > 0 ? Math.max(...years) : 2024;
    
    // Generate dynamic tick values (every 2 years from minYear to maxYear)
    const tickVals = [];
    for (let y = minYear; y <= maxYear + 1; y += 2) {
        tickVals.push(y);
    }
    
    const oilGasValues = pageData.map(d => d.oil_gas / 1000);
    const electricValues = pageData.map(d => d.electricity / 1000);
    const otherValues = pageData.map(d => d.other / 1000);
    const totalValues = pageData.map(d => d.total / 1000);

    const colors = {
        'oil_gas': '#48A36C',
        'electricity': '#E3540D',
        'other': '#857550'
    };

    const hoverTemplate = (name, vals) => {
        return vals.map((v, i) => {
            const y = years[i];
            const tot = totalValues[i];
            return `${getText(name, lang)}<br>${y}: $${v.toFixed(1)}B<br><b>${getText('page24_hover_total', lang)}: $${tot.toFixed(1)}B</b>`;
        });
    };

    // ===== ACCESSIBILITY: Build screen reader text blocks =====
    
    // Chart data summary for screen readers - includes title, footnote, then data
    const getChartDataSummary = () => {
        // Remove asterisk from chart title for natural reading
        const chartTitle = getText('page24_chart_title', lang).replace(/\*/g, '');
        // Get footnote without asterisk and newlines
        const footnote = getText('page24_footnote', lang).replace(/\*/g, '').replace(/\n/g, ' ').trim();
        const oilGasLabel = getText('page24_legend_oil_gas', lang);
        const electricityLabel = getText('page24_legend_electricity', lang);
        const otherLabel = getText('page24_legend_other', lang);
        
        // Summarize the chart trend
        const latestTotal = formatBillionSR(totalLatestBillion);
        const peakTotal = formatBillionSR(peakTotalBillion);
        
        // Order: Title -> Footnote disclaimer -> Chart description -> Data
        if (lang === 'en') {
            return `${chartTitle}. ${footnote} Stacked bar chart showing capital expenditures from ${minYear} to ${maxYear}. Categories: ${oilGasLabel}, ${electricityLabel}, and ${otherLabel}. In ${latestRow.year}, total was ${latestTotal}. Peak was ${peakTotal} in ${peakRow.year}.`;
        } else {
            return `${chartTitle}. ${footnote} Graphique à barres empilées montrant les dépenses en immobilisations de ${minYear} à ${maxYear}. Catégories: ${oilGasLabel}, ${electricityLabel}, et ${otherLabel}. En ${latestRow.year}, le total était de ${latestTotal}. Le sommet était de ${peakTotal} en ${peakRow.year}.`;
        }
    };

    // Bullet points summary for screen readers
    const getBulletsSummary = () => {
        const bullet1 = lang === 'en'
            ? `Capital expenditures in Canada's energy sector totaled ${formatBillionSR(totalLatestBillion)} in ${latestRow.year}, a decrease of ${declineFromPeakPct.toFixed(0)} percent from a peak in ${peakRow.year}.`
            : `Les dépenses en immobilisations dans le secteur canadien de l'énergie ont totalisé ${formatBillionSR(totalLatestBillion)} en ${latestRow.year}, une baisse de ${declineFromPeakPct.toFixed(0)} pour cent par rapport au sommet de ${peakRow.year}.`;
        
        const bullet2 = lang === 'en'
            ? `After reaching an eleven year low of ${formatBillionSR(low2020Billion)} in 2020, investment has rebounded by ${reboundFrom2020Pct.toFixed(0)} percent.`
            : `Après avoir atteint un creux de onze ans de ${formatBillionSR(low2020Billion)} en 2020, l'investissement a rebondi de ${reboundFrom2020Pct.toFixed(0)} pour cent.`;
        
        const bullet3 = lang === 'en'
            ? `Oil and gas extraction was the largest area of energy sector capital expenditure at ${formatBillionSR(oilGasBillion)} in ${latestRow.year}, followed by electrical power generation and distribution at ${formatBillionSR(electricityBillion)}.`
            : `L'extraction de pétrole et de gaz était le plus grand domaine de dépenses en immobilisations du secteur de l'énergie avec ${formatBillionSR(oilGasBillion)} en ${latestRow.year}, suivie de la production et distribution d'électricité avec ${formatBillionSR(electricityBillion)}.`;
        
        return `${bullet1} ${bullet2} ${bullet3}`;
    };

    // Format number for screen readers using locale
    const formatNumberTable = (val) => {
        return val.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { 
            minimumFractionDigits: 1, 
            maximumFractionDigits: 1 
        });
    };

    // Helper to strip HTML tags from text
    const stripHtml = (text) => text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

    // Generate accessible data table with details/summary pattern
    const getAccessibleDataTable = () => {
        if (!pageData || pageData.length === 0) return null;
        
        // Strip HTML tags from labels
        const oilGasLabel = stripHtml(getText('page24_legend_oil_gas', lang));
        const electricityLabel = stripHtml(getText('page24_legend_electricity', lang));
        const otherLabel = stripHtml(getText('page24_legend_other', lang));
        const unitText = lang === 'en' ? ', in billions of dollars' : ', en milliards de dollars';
        const captionId = 'page24-table-caption';
        
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
                    <table style={{ width: '100%', minWidth: '500px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
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
                                ? 'Capital expenditures on construction in the energy sector (billions of dollars)'
                                : 'Dépenses en immobilisations pour la construction dans le secteur de l\'énergie (milliards de dollars)'}
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
                                <th scope="col" style={{ padding: '8px', borderBottom: '2px solid #ddd', whiteSpace: 'nowrap' }}>
                                    {oilGasLabel}
                                    <span className="sr-only"> {unitText}</span>
                                </th>
                                <th scope="col" style={{ padding: '8px', borderBottom: '2px solid #ddd', whiteSpace: 'nowrap' }}>
                                    {electricityLabel}
                                    <span className="sr-only"> {unitText}</span>
                                </th>
                                <th scope="col" style={{ padding: '8px', borderBottom: '2px solid #ddd', whiteSpace: 'nowrap' }}>
                                    {otherLabel}
                                    <span className="sr-only"> {unitText}</span>
                                </th>
                                <th scope="col" style={{ padding: '8px', borderBottom: '2px solid #ddd' }}>
                                    {lang === 'en' ? 'Total' : 'Total'}
                                    <span className="sr-only"> {unitText}</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageData.map(yearData => (
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
                                    <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{formatNumberTable(yearData.oil_gas / 1000)}</td>
                                    <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{formatNumberTable(yearData.electricity / 1000)}</td>
                                    <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{formatNumberTable(yearData.other / 1000)}</td>
                                    <td style={{ padding: '8px', fontWeight: 'bold' }}>{formatNumberTable(yearData.total / 1000)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </details>
        );
    };

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
            borderLeft: '18px solid #8e7e52',
            boxSizing: 'border-box',
        }}>
            {/* Dynamic Layout CSS with Media Queries for 200% Zoom Compliance */}
            <style>{`
                .page24-container {
                    width: calc(100% - 40px);
                    padding: 5px 20px;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    min-height: 100%;
                }
                
                .page24-content-row {
                    display: flex;
                    flex-direction: row;
                    flex: 1;
                    min-height: 0;
                }
                
                .page24-chart-column {
                    width: 58%;
                }
                
                .page24-text-column {
                    width: 40%;
                    padding-left: 8px;
                    padding-top: 15px;
                    white-space: pre-line;
                }
                
                .page24-chart {
                    width: 100%;
                    height: calc(100vh - 480px);
                    min-height: 300px;
                }

                /* Forced Stacked Layout when Table is Open */
                .layout-stacked {
                    flex-direction: column !important;
                    height: auto !important;
                    align-items: stretch !important;
                    flex: 0 0 auto !important;
                }

                .layout-stacked .page24-chart-column {
                    width: 100% !important;
                    margin-bottom: 30px !important;
                    overflow: visible !important;
                }

                .layout-stacked .page24-text-column {
                    width: 100% !important;
                    padding-left: 20px !important;
                    padding-right: 20px !important;
                    margin-top: 20px !important;
                }
                
                .layout-stacked .page24-chart {
                    height: 400px !important;
                    min-height: 350px !important;
                }

                /* MEDIA QUERY: When zoomed in (125%+), switch to stacked layout */
                @media (max-width: 1400px) {
                    .page24-content-row {
                        flex-direction: column;
                        height: auto;
                    }
                    
                    .page24-chart-column {
                        width: 100%;
                        margin-bottom: 20px;
                    }
                    
                    .page24-text-column {
                        width: 100%;
                        padding-left: 20px;
                    }
                    
                    .page24-chart {
                        height: 350px;
                    }
                    
                    .page24-bullet {
                        margin-left: 20px !important;
                        margin-top: 0 !important;
                        font-size: 1.1rem !important;
                    }
                }
                
                /* REFLOW: At 250%+ zoom */
                @media (max-width: 768px) {
                    .page-24 {
                        border-left: 10px solid #8e7e52 !important;
                    }
                    
                    .page24-container {
                        width: 100%;
                        padding: 5px 10px;
                    }
                    
                    .page24-container h1 {
                        font-size: 1.8rem !important;
                        margin-left: 5px !important;
                        margin-bottom: 20px !important;
                    }
                    
                    .page24-bullet {
                        margin-left: 10px !important;
                        font-size: 1rem !important;
                        line-height: 1.4 !important;
                    }
                    
                    .page24-footnote {
                        margin-left: 10px !important;
                        font-size: 0.85rem !important;
                    }
                }
                
                /* REFLOW: At 400% zoom (320px width) - ensure x-axis labels remain legible */
                @media (max-width: 480px) {
                    .page-24 {
                        border-left: none !important;
                    }
                    
                    .page24-container {
                        padding: 5px;
                    }
                    
                    .page24-container h1 {
                        font-size: 1.4rem !important;
                        margin-left: 0 !important;
                        margin-bottom: 10px !important;
                    }
                    
                    .page24-chart {
                        height: 300px;
                    }
                    
                    .page24-bullet {
                        margin-left: 5px !important;
                        font-size: 0.9rem !important;
                    }
                    
                    .page24-footnote {
                        margin-left: 5px !important;
                        font-size: 0.8rem !important;
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

            {/* Container */}
            <div className="page24-container">
                {/* REGION 1: Title */}
                <header 
                    role="region"
                    aria-label={getText('page24_title', lang)}
                >
                    <h1 aria-hidden="true" style={{
                        fontFamily: 'Georgia, "Times New Roman", serif',
                        color: '#8e7e52',
                        fontSize: '3rem',
                        fontWeight: 'normal',
                        marginBottom: '30px',
                        marginLeft: '15px',
                        marginTop: '-10px',
                    }}>
                        {getText('page24_title', lang)}
                    </h1>
                </header>

                {/* Main Content - switches from row to column when zoomed OR when table is open */}
                <div className={`page24-content-row ${isTableOpen ? 'layout-stacked' : ''}`}>
                    {/* REGION 2: Chart - all data read as one block */}
                    <div 
                        className="page24-chart-column"
                        role="region"
                        aria-label={getChartDataSummary()}
                    >
                {/* Accessible data table for screen readers */}
                {getAccessibleDataTable()}
                
                <figure aria-hidden="true" style={{ margin: 0 }}>
                <Plot
    data={[
        {
            name: getText('page24_legend_oil_gas', lang),
            x: years,
            y: oilGasValues,
            type: 'bar',
            marker: { color: colors.oil_gas },
            hovertext: hoverTemplate('page24_hover_oil_gas', oilGasValues),
            font: {
                color: '#000000',   
                size: 14,           
                family: 'Arial, sans-serif'
            },
            hoverinfo: 'text',
            legendrank: 3 
        },
        {
            name: getText('page24_legend_electricity', lang),
            x: years,
            y: electricValues,
            type: 'bar',
            marker: { color: colors.electricity },
            hovertext: hoverTemplate('page24_hover_electricity', electricValues),
            font: {
                color: '#000000',   
                size: 14,           
                family: 'Arial, sans-serif'
            },
            hoverinfo: 'text',
            legendrank: 2
        },
        {
            name: getText('page24_legend_other', lang),
            x: years,
            y: otherValues,
            type: 'bar',
            marker: { color: colors.other },
            hovertext: hoverTemplate('page24_hover_other', otherValues),
            font: {
                color: '#000000',   
                size: 14,           
                family: 'Arial, sans-serif'
            },
            hoverinfo: 'text',
            legendrank: 1 
        }
    ]}
    layout={{
        barmode: 'stack',
                        hoverlabel: {
                            bgcolor: '#ffffff',  
                            bordercolor: '#000000', 
                            font: { 
                                color: '#000000',
                                size: windowWidth <= 480 ? 16 : windowWidth <= 768 ? 15 : 14,
                                family: 'Arial, sans-serif'
                            }
                        },
                            title: {
                                // Wrap title at 400%+ zoom (480px and below)
                                text: windowWidth <= 480 
                                    ? `<b>${getText('page24_chart_title', lang).replace(', ', ',<br>')}</b>`
                                    : `<b>${getText('page24_chart_title', lang)}</b>`,
                                font: { size: windowWidth <= 480 ? 14 : 20, color: '#333', family: 'Arial, sans-serif' },
                                x: 0.5, xanchor: 'center', y: windowWidth <= 480 ? 0.90 : 0.98
                            },
                            xaxis: {
                                tickvals: tickVals,
                                showgrid: false, 
                                zeroline: false,
                                range: [minYear - 0.5, maxYear + 0.5],
                                // Horizontal labels up to 250% zoom (above 640px), diagonal at 300%+ (640px and below)
                                tickangle: windowWidth <= 640 ? -45 : 0,
                                tickfont: { size: windowWidth <= 480 ? 10 : 12, family: 'Arial, sans-serif' },
                                automargin: true,  // Auto-adjust margin for rotated labels
                                tickmode: 'array',
                                // Show all years on x-axis for better readability
                                dtick: 1
                            },
                            yaxis: {
                                title: { text: getText('page24_yaxis', lang), font: { size: 11 } },
                                range: [0, 120], dtick: 20,
                                showgrid: false, showline: true, linewidth: 1, linecolor: '#333'
                            },
                            legend: {
                                orientation: 'h', y: windowWidth <= 640 ? -0.25 : -0.15, x: 0,
                                font: {
                                size: windowWidth <= 480 ? 11 : 14,
                                color: '#333333'
                                }
                            },
                            margin: { l: 50, r: 15, t: windowWidth <= 480 ? 60 : 40, b: windowWidth <= 640 ? 85 : 60 },
                            autosize: true,
                            bargap: 0.2
                        }}
                        className="page24-chart"
                        useResizeHandler={true}
                        config={{ displayModeBar: false, responsive: true }}
                    />
                </figure>
                </div>

                <aside className="page24-text-column">
                   
                    {(() => {
                        const bullet1Text = lang === 'en'
                            ? `Capital expenditures in Canada's energy sector totaled ${formatBillionSR(totalLatestBillion)} in ${latestRow.year}, a decrease of ${declineFromPeakPct.toFixed(0)} percent from a peak in ${peakRow.year}.`
                            : `Les dépenses en immobilisations dans le secteur canadien de l'énergie ont totalisé ${formatBillionSR(totalLatestBillion)} en ${latestRow.year}, une baisse de ${declineFromPeakPct.toFixed(0)} pour cent par rapport au sommet de ${peakRow.year}.`;
                        
                        const bullet2Text = lang === 'en'
                            ? `After reaching an eleven year low of ${formatBillionSR(low2020Billion)} in 2020, investment has rebounded by ${reboundFrom2020Pct.toFixed(0)} percent.`
                            : `Après avoir atteint un creux de onze ans de ${formatBillionSR(low2020Billion)} en 2020, l'investissement a rebondi de ${reboundFrom2020Pct.toFixed(0)} pour cent.`;
                        
                        const bullet3Text = lang === 'en'
                            ? `Oil and gas extraction was the largest area of energy sector capital expenditure at ${formatBillionSR(oilGasBillion)} in ${latestRow.year}, followed by electrical power generation and distribution at ${formatBillionSR(electricityBillion)}.`
                            : `L'extraction de pétrole et de gaz était le plus grand domaine de dépenses en immobilisations du secteur de l'énergie avec ${formatBillionSR(oilGasBillion)} en ${latestRow.year}, suivie de la production et distribution d'électricité avec ${formatBillionSR(electricityBillion)}.`;

                        return (
                            <ul style={{ listStyleType: 'disc', paddingLeft: '15px', margin: '0', color: '#333' }}>
                                {/* Bullet 1 */}
                                <li 
                                    className="page24-bullet" 
                                    aria-label={bullet1Text}
                                    style={{ marginBottom: '20px', lineHeight: '1.25', fontSize: '1.5rem', marginLeft: '80px', marginTop: '20px' }}
                                >
                                    <span aria-hidden="true">
                                        {getText('page24_bullet1_part1', lang)}
                                        <strong>{formatBillion(totalLatestBillion)}</strong>
                                        {getText('page24_bullet1_part2', lang)}
                                        {latestRow.year}
                                        {getText('page24_bullet1_part3', lang)}
                                        {declineFromPeakPct.toFixed(0)}
                                        {getText('page24_bullet1_part4', lang)}
                                        {peakRow.year}
                                        {getText('page24_bullet1_part5', lang)}
                                    </span>
                                </li>

                                {/* Bullet 2 */}
                                <li 
                                    className="page24-bullet"
                                    aria-label={bullet2Text}
                                    style={{ marginBottom: '20px', lineHeight: '1.25', fontSize: '1.5rem', marginLeft: '80px' }}
                                >
                                    <span aria-hidden="true">
                                        {getText('page24_bullet2_part1', lang)}
                                        <strong>{formatBillion(low2020Billion)}</strong>
                                        {getText('page24_bullet2_part2', lang)}
                                        <strong>{reboundFrom2020Pct.toFixed(0)}</strong>
                                        {getText('page24_bullet2_part3', lang)}
                                    </span>
                                </li>

                                {/* Bullet 3 */}
                                <li 
                                    className="page24-bullet" 
                                    aria-label={bullet3Text}
                                    style={{ marginBottom: '2px', lineHeight: '1.25', fontSize: '1.5rem', marginLeft: '80px' }}
                                >
                                    <span aria-hidden="true">
                                        {getText('page24_bullet3_part1', lang)}
                                        <strong>{formatBillion(oilGasBillion)}</strong>
                                        {getText('page24_bullet3_part2', lang)}
                                        {latestRow.year}
                                        {getText('page24_bullet3_part3', lang)}
                                        {formatBillion(electricityBillion)}
                                        {getText('page24_bullet3_part4', lang)}
                                    </span>
                                </li>
                            </ul>
                        );
                    })()}
                </aside>
            </div>

            <footer aria-hidden="true" style={{ marginTop: 'auto' }}>
                <p className="page24-footnote" style={{
                    fontSize: '1rem',
                    color: '#000000',
                    marginLeft: '30px',
                    marginBottom: '15px',
                    lineHeight: '1.15',
                    whiteSpace: 'pre-line'
                }}>
                    {getText('page24_footnote', lang)}
                </p>
            </footer>
            </div>
        </main>
    );
};

export default Page24;
