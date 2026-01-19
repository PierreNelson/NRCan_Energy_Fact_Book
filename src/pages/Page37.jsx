import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getEnvironmentalProtectionData } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const Page37 = () => {
    const { lang } = useOutletContext();
    const mainRef = useRef(null);
    const tableSummaryRef = useRef(null);
    
    // 1. DEFINE STATE FIRST
    const [year, setYear] = useState(null);
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);

    useEffect(() => {
        if (tableSummaryRef.current) {
            tableSummaryRef.current.focus();
        }
    }, [isTableOpen]);

    // Auto-focus disabled - was causing issues with stacked section layout
    // useEffect(() => {
    //     if (!loading && mainRef.current) {
    //         const timer = setTimeout(() => {
    //             mainRef.current.focus();
    //         }, 100);
    //         return () => clearTimeout(timer);
    //     }
    // }, [loading]);

    const minYear = useMemo(() => pageData.length > 0 ? pageData[0].year : 2018, [pageData]);
    const maxYear = useMemo(() => pageData.length > 0 ? pageData[pageData.length - 1].year : 2022, [pageData]);
    
    const yearsList = useMemo(() => Array.from(
        { length: maxYear - minYear + 1 },
        (_, i) => minYear + i
    ), [minYear, maxYear]);

    // Track window width for responsive chart
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        getEnvironmentalProtectionData()
            .then(data => {
                setPageData(data);
                if (data && data.length > 0) {
                    setYear(data[data.length - 1].year);
                }
            })
            .catch(err => {
                console.error("Failed to load environmental protection data:", err);
                setError(err.message || 'Failed to load data');
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    // Colors matching the factbook chart
    const COLORS = {
        'wastewater': '#857550',  
        'soil': '#224397',        
        'air': '#33bccb',         
        'solid_waste': '#f48244', 
        'other': '#e9d259',       
    };

    const CATEGORY_ORDER = ['wastewater', 'soil', 'air', 'solid_waste', 'other'];

    const currentYearData = useMemo(() => {
        if (!year || pageData.length === 0) return null;
        return pageData.find(d => d.year === year) || pageData[pageData.length - 1];
    }, [year, pageData]);

    // Calculate dynamic values
    const dynamicValues = useMemo(() => {
        if (!currentYearData) return null;
        
        const oilGasTotal = currentYearData.oil_gas_total || 0;
        const allIndustriesTotal = currentYearData.all_industries_total || 0;
        const electricTotal = currentYearData.electric_total || 0;
        const naturalGasTotal = currentYearData.natural_gas_total || 0;
        const petroleumTotal = currentYearData.petroleum_total || 0;
        const petroleumPollution = currentYearData.petroleum_pollution || 0;
        
        // Energy sector total (oil+gas + electric + natural gas distribution + petroleum)
        const energySectorTotal = oilGasTotal + electricTotal + naturalGasTotal + petroleumTotal;
        
        // Petroleum pollution abatement percentage (air + wastewater + solid waste + soil as % of total)
        const petroleumPollutionPct = petroleumTotal > 0 ? Math.round((petroleumPollution / petroleumTotal) * 100) : 0;
        
        // Percentage of all industries
        const energySectorPct = allIndustriesTotal > 0 ? (energySectorTotal / allIndustriesTotal) * 100 : 0;
        const oilGasPct = allIndustriesTotal > 0 ? (oilGasTotal / allIndustriesTotal) * 100 : 0;
        
        return {
            energySectorTotal,
            energySectorPct,
            oilGasTotal,
            oilGasPct,
            electricTotal,
            petroleumTotal,
            petroleumPollutionPct,
            allIndustriesTotal
        };
    }, [currentYearData]);

    // Chart data for pie chart
    const chartData = useMemo(() => {
        if (!currentYearData) return null;
        
        const values = [];
        const colors = [];
        const hoverTexts = [];
        const pctDict = {};
        
        const oilGasTotal = currentYearData.oil_gas_total || 0;
        const millionText = getText('page37_million', lang);
        
        const catMapping = {
            'wastewater': 'oil_gas_wastewater',
            'soil': 'oil_gas_soil',
            'air': 'oil_gas_air',
            'solid_waste': 'oil_gas_solid_waste',
            'other': 'oil_gas_other'
        };
        
        const hoverKeys = {
            'wastewater': 'page37_hover_wastewater',
            'soil': 'page37_hover_soil',
            'air': 'page37_hover_air',
            'solid_waste': 'page37_hover_solid_waste',
            'other': 'page37_hover_other'
        };

        // Helper to wrap text for mobile hovers (400% zoom)
        const wrapText = (text, maxLength = 30) => {
            if (!text || text.length <= maxLength) return text;
            const words = text.split(' ');
            let currentLine = '';
            let result = '';
            words.forEach(word => {
                if ((currentLine + word).length > maxLength) {
                    result += currentLine.trim() + '<br>';
                    currentLine = word + ' ';
                } else {
                    currentLine += word + ' ';
                }
            });
            return result + currentLine.trim();
        };

        CATEGORY_ORDER.forEach(cat => {
            const value = currentYearData[catMapping[cat]] || 0;
            const pct = oilGasTotal > 0 ? (value / oilGasTotal) * 100 : 0;
            if (value >= 0) {
                values.push(value);
                colors.push(COLORS[cat]);
                pctDict[cat] = pct;
                
                // Get name and wrap if on mobile/high zoom
                let catName = getText(hoverKeys[cat], lang);
                if (windowWidth <= 480) {
                    catName = wrapText(catName, 20); // Wrap at ~20 chars for small screens
                }

                let hoverText = lang === 'en' 
                    ? `<b>${catName}</b><br>$${value.toLocaleString()} ${millionText}<br>${pct.toFixed(0)}%`
                    : `<b>${catName}</b><br>${value.toLocaleString()} ${millionText}<br>${pct.toFixed(0)}%`;
                hoverTexts.push(hoverText);
            }
        });
        
        return { values, colors, hoverTexts, total: oilGasTotal, pctDict };
    }, [currentYearData, lang, windowWidth]); // Added windowWidth dependency

    // Generate labels for pie chart slices
    const pieLabels = useMemo(() => {
        const transKeys = {
            'wastewater': 'page37_cat_wastewater',
            'soil': 'page37_cat_soil',
            'air': 'page37_cat_air',
            'solid_waste': 'page37_cat_solid_waste',
            'other': 'page37_cat_other'
        };
        return CATEGORY_ORDER.map(cat => getText(transKeys[cat], lang));
    }, [lang]);

    // Center annotation for donut chart
    const annotations = useMemo(() => {
        if (!chartData) return [];
        const totalBillions = (chartData.total || 0) / 1000;
        
        const centerText = lang === 'en'
            ? `<b>TOTAL</b><br><b>$${totalBillions.toFixed(0)}B</b>`
            : `<b>TOTAL</b><br><b>${totalBillions.toFixed(0)}</b><br><b>milliards</b>`;

        return [{
            text: centerText, x: 0.5, y: 0.5,
            font: { size: windowWidth <= 480 ? 14 : windowWidth <= 768 ? 16 : 22, color: '#424243', family: 'Arial Black, sans-serif' },
            showarrow: false,
        }];
    }, [chartData, lang, windowWidth]);

    // Format number for display
    const formatNumber = (val) => {
        if (val >= 1000) {
            return `$${(val / 1000).toFixed(1)} ${lang === 'en' ? 'billion' : 'milliards de dollars'}`;
        }
        return `$${val.toLocaleString()} ${getText('page37_million', lang)}`;
    };

    // Format number for table
    const formatNumberTable = (val) => {
        return val.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { 
            minimumFractionDigits: 0, 
            maximumFractionDigits: 0 
        });
    };

    // Strip HTML tags
    const stripHtml = (text) => text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

    // Build subtitle text for screen readers
    const getSubtitleText = () => {
        if (!dynamicValues) return '';
        return `${getText('page37_subtitle_part1', lang)}${formatNumber(dynamicValues.energySectorTotal)}${getText('page37_subtitle_part2', lang)}${year}${getText('page37_subtitle_part3', lang)}${dynamicValues.energySectorPct.toFixed(0)}${getText('page37_subtitle_part4', lang)}`;
    };

    // Build chart data summary for screen readers
    const getChartDataSummary = () => {
        if (!chartData || !currentYearData) return '';
        const millionText = getText('page37_million', lang);
        const categoryNames = {
            'wastewater': 'page37_hover_wastewater',
            'soil': 'page37_hover_soil',
            'air': 'page37_hover_air',
            'solid_waste': 'page37_hover_solid_waste',
            'other': 'page37_hover_other'
        };
        
        const catMapping = {
            'wastewater': 'oil_gas_wastewater',
            'soil': 'oil_gas_soil',
            'air': 'oil_gas_air',
            'solid_waste': 'oil_gas_solid_waste',
            'other': 'oil_gas_other'
        };
        
        const parts = CATEGORY_ORDER.map(cat => {
            const value = currentYearData[catMapping[cat]] || 0;
            const pct = chartData.pctDict[cat] || 0;
            const name = stripHtml(getText(categoryNames[cat], lang));
            return `${name}: ${value.toLocaleString()} ${millionText} (${pct.toFixed(0)}%)`;
        });
        
        const totalText = `${getText('total', lang)}: ${chartData.total.toLocaleString()} ${millionText}`;
        return `${parts.join('. ')}. ${totalText}.`;
    };

// Helper to generate Accessible Text for Subtitle and Text blocks
const getAccessibleStrings = () => {
    if(!dynamicValues) return { subtitle: '', text: '' };
    
    const percentWord = lang === 'en' ? 'percent' : 'pour cent';
    
    const subtitle = `${getText('page37_subtitle_part1', lang)} ${formatNumber(dynamicValues.energySectorTotal)} ${getText('page37_subtitle_part2', lang)} ${year} ${getText('page37_subtitle_part3', lang)} ${dynamicValues.energySectorPct.toFixed(0)} ${percentWord} ${getText('page37_subtitle_part4', lang)}`;
    
    const text = `${getText('page37_text_part1', lang)} ${formatNumber(dynamicValues.oilGasTotal)} ${getText('page37_text_part2', lang)} ${dynamicValues.oilGasPct.toFixed(0)} ${percentWord} ${getText('page37_text_part3', lang)}`;
    
    return { subtitle, text };
};

const accessibleStrings = getAccessibleStrings();

// Accessible data table
const getAccessibleDataTable = () => {
    if (!pageData || pageData.length === 0) return null;
        
        const categoryLabels = {
            'wastewater': stripHtml(getText('page37_cat_wastewater', lang)),
            'soil': stripHtml(getText('page37_cat_soil', lang)),
            'air': stripHtml(getText('page37_cat_air', lang)),
            'solid_waste': stripHtml(getText('page37_cat_solid_waste', lang)),
            'other': stripHtml(getText('page37_cat_other', lang)),
        };
        
        const catMapping = {
            'wastewater': 'oil_gas_wastewater',
            'soil': 'oil_gas_soil',
            'air': 'oil_gas_air',
            'solid_waste': 'oil_gas_solid_waste',
            'other': 'oil_gas_other'
        };

        const captionId = 'page37-table-caption';
        
        return (
            <details 
                open={isTableOpen}
                onToggle={(e) => setIsTableOpen(e.currentTarget.open)}
                className="page37-data-table"
                style={{ position: 'relative', zIndex: 10 }} 
            >
                <summary
                    ref={tableSummaryRef}
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
                    <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                </summary>

                <div className="table-responsive" style={{ marginTop: '10px' }} role="region" aria-labelledby={captionId}>
                    <table className="table table-striped table-hover">
                        <caption id={captionId} className="wb-inv">
                            {lang === 'en' 
                                ? 'Oil and gas extraction expenditures per environmental activity (millions of dollars)'
                                : "Dépenses d'extraction de pétrole et de gaz par activité environnementale (millions de dollars)"}
                        </caption>
                        <thead>
                            <tr>
                                <td className="text-center fw-bold">{lang === 'en' ? 'Year' : 'Année'}</td>
                                {CATEGORY_ORDER.map(cat => (
                                    <td key={cat} className="text-center fw-bold">
                                        {categoryLabels[cat]}<br/>
                                        <span aria-hidden="true">{lang === 'en' ? '($ millions)' : '(millions $)'}</span>
                                        <span className="wb-inv">{lang === 'en' ? '(millions of dollars)' : '(millions de dollars)'}</span>
                                    </td>
                                ))}
                                <td className="text-center fw-bold">
                                    {getText('total', lang)}<br/>
                                    <span aria-hidden="true">{lang === 'en' ? '($ millions)' : '(millions $)'}</span>
                                    <span className="wb-inv">{lang === 'en' ? '(millions of dollars)' : '(millions de dollars)'}</span>
                                </td>
                            </tr>
                        </thead>
                        <tbody>
                            {pageData.map(yearData => {
                                const yearHeaderId = `year-${yearData.year}`;
                                const cellUnitSR = lang === 'en' ? ' million dollars' : ' millions de dollars';
                                return (
                                    <tr key={yearData.year}>
                                        <th scope="row" id={yearHeaderId}>{yearData.year}</th>
                                        {CATEGORY_ORDER.map(cat => (
                                            <td key={cat} headers={yearHeaderId}>
                                                <span className="wb-inv">{yearData.year}, {categoryLabels[cat]}: </span>
                                                {formatNumberTable(yearData[catMapping[cat]] || 0)}
                                                <span className="wb-inv">{cellUnitSR}</span>
                                            </td>
                                        ))}
                                        <td headers={yearHeaderId}>
                                            <span className="wb-inv">{yearData.year}, {getText('total', lang)}: </span>
                                            <strong>{formatNumberTable(yearData.oil_gas_total || 0)}</strong>
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

    if (!currentYearData) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>No data available. Please refresh the page.</div>;
    }

    return (
        <main 
            id="main-content"
            ref={mainRef}
            tabIndex="-1"
            className="page-37"
            role="main"
            aria-label={getText('page37_title', lang)}
            style={{ 
                backgroundColor: 'white', 
                flex: '1 1 auto', 
                display: 'flex', 
                flexDirection: 'column',
                overflowY: 'visible',
                overflowX: 'visible',
                borderRight: '18px solid #8e7e52',
                boxSizing: 'border-box',
                position: 'relative',
                zIndex: 0
            }}
        >
            <style>{`
                .page-37 {
                    margin-left: -37px;
                    margin-right: -30px;
                    width: calc(100% + 67px);
                }

                .wb-inv {
                    clip: rect(1px, 1px, 1px, 1px);
                    height: 1px;
                    margin: 0;
                    overflow: hidden;
                    position: absolute;
                    width: 1px;
                }

                input[type=range] { -webkit-appearance: none; width: 100%; background: transparent; }
                input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 20px; width: 20px; border-radius: 50%; background: #007bff; cursor: pointer; margin-top: -6px; }
                input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 8px; cursor: pointer; background: #007bff; border-radius: 4px; }
                input[type=range]:focus { outline: 2px solid #005fcc; outline-offset: 2px; }
                input[type=range]:focus::-webkit-slider-thumb { box-shadow: 0 0 0 3px rgba(0,123,255,0.5); }
            
                .page37-slider-track {
                    flex: 1; 
                    width: auto;
                    margin-left: 0px;
                    margin-right: -20px;
                }

                .page37-slider-input {
                    width: 100%;
                    margin: 0;
                    display: block;
                }

                .page37-slider-label {
                    font-weight: bold;
                    margin-right: 15px;
                    font-size: 18px;
                    font-family: Arial, sans-serif;
                    white-space: nowrap;
                    margin-left: -5px; 
                }

                .page37-container {
                    width: 100%;
                    padding: 15px 30px 20px 55px;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    min-height: 100%;
                }

                .page37-title {
                    font-family: 'Georgia', serif;
                    color: #857550;
                    font-size: 2.5rem;
                    font-weight: normal;
                    font-style: italic;
                    margin: 0 0 10px 0;
                    line-height: 1.2;
                }

                .page37-subtitle {
                    font-family: Arial, sans-serif;
                    color: #333;
                    font-size: 1.1rem;
                    margin-bottom: 10px;
                    line-height: 1.5;

                }

                .page37-subtitle:focus {
                    outline: none;

                }

                .page37-text {
                    font-family: Arial, sans-serif;
                    color: #333;
                    font-size: 1.1rem;
                    margin-bottom: 15px;
                    line-height: 1.5;
                }

                .page37-text:focus {
                    outline: none;
                }

                .page37-content-row {
                    display: flex;
                    flex-direction: row;
                    flex: 1 1 auto;
                    min-height: 0;
                    align-items: flex-start;
                    gap: 20px;
                }

                .page37-chart-column {
                    width: 55%;
                    height: auto !important; /* Changed from fixed calc */
                    min-height: auto;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                }

                .page37-chart-area {
                    width: 100%;
                    /* Adjusted height to leave room for the button */
                    height: calc(100vh - 550px); 
                    min-height: 400px;
                }

                .page37-text-column {
                    width: 40%;
                    padding-top: 20px;
                }

                .page37-chart-title {
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    color: #333;
                    font-size: 1rem;
                    text-align: center !important;
                    margin-bottom: 5px;
                    margin-left: -50px;
                }

                .page37-bullets {
                    font-family: Arial, sans-serif;
                    color: #333;
                    font-size: 1.4rem;
                    line-height: 1.6;
                    padding-left: 20px;
                    list-style-type: disc;
                }

                .page37-bullets li {
                    margin-bottom: 12px;
                }

                .visual-bold {
                    font-weight: bold;
                }

                 .page37-data-table {
                    margin-top: 10px;
                    margin-bottom: 10px;
                    font-family: Arial, sans-serif;
                    width: calc(100% - 45px);
                    margin-left: 0px; 
                    margin-right: 0px;
                }

                /* Forced Stacked Layout when Table is Open */
                .layout-stacked {
                    flex-direction: column !important;
                    height: auto !important;
                    align-items: center !important;
                }

                .layout-stacked .page37-chart-column {
                    width: 100% !important;
                    height: auto !important;
                    max-height: none !important;
                    margin-bottom: 30px !important;
                }

                .layout-stacked .page37-text-column {
                    width: 100% !important;
                    padding-top: 0 !important;
                }

                .layout-stacked .page37-data-table {
                    width: calc(100% + 10px);
                    margin-right: 0px;
                    margin-bottom: -50px;
                }


                /* 110% zoom (~1745px) - Switch to Stacked Layout */
                @media (max-width: 1745px) {
                    .page37-content-row {
                        flex-direction: column; 
                        align-items: center;
                    }

                    .page37-chart-column {
                        width: 100%;
                        margin-bottom: 50px;
                    }

                   .page37-chart-area {
                        height: 500px !important;
                    }

                    .page37-text-column {
                        width: 100%;
                        padding-top: 10px;
                    }

                    .layout-stacked .page37-data-table {
                        width: calc(100% + 16px);
                        margin-left: 0px;
                        margin-right: 0px;
                    }

                    .page37-data-table {
                        width: calc(100% + 16px);
                        margin-bottom: -80px;
                    }
                }

                /* 125% zoom */
                @media (max-width: 1536px) {
                    .page37-title {
                        font-size: 2rem;
                    }

                    .page37-chart-column {
                        width: 100%;
                        height: 540px;
                        max-height: 540px;
                    }
                    
                    .page37-text-column {
                        width: 100%;
                        padding-top: 0;
                    }
                }

                /* 150% zoom */
                @media (max-width: 1280px) {
                    .page37-title {
                        font-size: 1.8rem;
                    }
                    .page37-chart-column {
                        height: 550px;
                    }
                    .page37-chart-area {
                        height: 550px !important;
                    }
                }

                /* 200% zoom */
                @media (max-width: 960px) {
                    .page37-container {
                        padding: 10px 15px;
                    }
                    .page37-year-ticks {
                        display: none !important;
                    }

                    .page37-title {
                     margin-left: 32px !important;
                    }

                    .page37-subtitle {
                        margin-left: 32px !important;
                        }

                    .page37-text {
                       margin-left: 32px !important;
                    }

                    .page37-slider-label {
                        margin-left: 30px !important;
                    }

                    .page37-slider-track {
                        margin-right: -10px !important;
                    }

                    .page37-bullets {
                        margin-left: 30px !important;
                    }

                    .page37-data-table {
                        width: calc(100% - 25px) !important;
                        margin-left: 30px !important; 
                    }
                }

                /* 250% zoom */
                @media (max-width: 768px) {
                    .page-37 {
                        margin-left: -20px !important;
                        margin-right: -20px !important;
                        width: calc(100% + 40px) !important;
                        border-right: none !important;
                    }
                    .page37-container {
                        padding: 8px 20px 8px 45px !important;
                    }
                    .page37-title {
                        font-size: 1.5rem !important;
                    }
                    .page37-slider-region {
                        flex-direction: column !important;
                        align-items: stretch !important;
                    }
                    .page37-slider-label {
                        margin-bottom: 10px;
                        margin-right: 0 !important;
                    }
                    .page37-chart-column {
                        height: 400px !important;
                    }
                    .page37-chart-area {
                        height: 400px !important;
                    }

                    .page37-title, .page37-subtitle, .page37-text, .page37-slider-track, .page37-data-table {
                        margin-left: -24px !important;
                    }

                    .page37-slider-label {
                        margin-left: -30px !important;
                    }

                    .page37-data-table {
                        width: calc(100% + 24px) !important;
                    }

                    .page37-bullets {
                        margin-top: 50px !important;
                        margin-left: -26px !important;
                    }

                    .layout-stacked .page37-bullets {
                        margin-top: 0px !important;
                    }

                     .page37-slider-track {
                        margin-right: -4px !important;
                    }
                }

                /* 300% zoom */
                @media (max-width: 640px) {
                    .page37-chart-column {
                        height: 360px !important;
                    }
                    .page37-chart-area {
                        height: 360px !important;
                    }

                     .page37-bullets {
                        margin-top: 100px !important;
                        margin-left: -28px !important;
                    }
                }

                /* 400% zoom */
                @media (max-width: 480px) {
                    .page37-chart-area {
                        height: 460px !important;
                    }
                    .page37-chart-column {
                        margin-right: 25px !important;
                    }
                    .page37-title {
                        font-size: 1.3rem !important;
                    }
                    input[type=range] {
                        height: 44px !important;
                    }

                    .page37-chart-title {
                        padding-left: 50px !important;
                        padding-right: 50px !important;
                        margin-left: 30px !important;
                    }

                    .page37-data-table {
                        margin-left: -12px !important;
                    }

                }

                /* 500% zoom */
                @media (max-width: 384px) {
                    .page37-chart-column {
                        height: 460px !important;
                    }
                    .page37-chart-area {
                        height: 460px !important;
                    }
                    input[type=range] {
                        height: 50px !important;
                    }
                }

                /* Hide default disclosure triangle */
                details summary::-webkit-details-marker,
                details summary::marker {
                    display: none;
                }
            `}</style>

            <div className="page37-container">
                {/* Title and Subtitle */}
                <header role="region" aria-label={getText('page37_title', lang)}>
                    <h1 className="page37-title">
                        {getText('page37_title', lang)}
                    </h1>

                    {dynamicValues && (
                        <>
                            {/* Subtitle - Screen Reader reads hidden span, ignores visible span */}
                            <p 
                                className="page37-subtitle"
                                tabIndex="0"
                            >
                                <span className="wb-inv">{accessibleStrings.subtitle}</span>
                                <span aria-hidden="true">
                                    {getText('page37_subtitle_part1', lang)}
                                    <span className="visual-bold">{formatNumber(dynamicValues.energySectorTotal)}</span>
                                    {getText('page37_subtitle_part2', lang)}
                                    {year}
                                    {getText('page37_subtitle_part3', lang)}
                                    <span className="visual-bold">{dynamicValues.energySectorPct.toFixed(0)}%</span>
                                    {getText('page37_subtitle_part4', lang)}
                                </span>
                            </p>

                            {/* Text - Screen Reader reads hidden span, ignores visible span */}
                            <p 
                                className="page37-text"
                                tabIndex="0"
                            >
                                <span className="wb-inv">{accessibleStrings.text}</span>
                                <span aria-hidden="true">
                                    {getText('page37_text_part1', lang)}
                                    <span className="visual-bold">{formatNumber(dynamicValues.oilGasTotal)}</span>
                                    {getText('page37_text_part2', lang)}
                                    <span className="visual-bold">{dynamicValues.oilGasPct.toFixed(0)}%</span>
                                    {getText('page37_text_part3', lang)}
                                </span>
                            </p>
                        </>
                    )}
                </header>

                {/* Year Slider */}
                <div 
                    className="page37-slider-region"
                    role="region" 
                    aria-label={`${getText('year_slider_label', lang)} ${year}. ${lang === 'en' ? 'Use arrow keys to change year from' : 'Utilisez les touches fléchées pour changer l\'année de'} ${minYear} ${lang === 'en' ? 'to' : 'à'} ${maxYear}.`}
                    style={{ display: 'flex', alignItems: 'center', marginBottom: '15px', padding: '2px 5px' }}
                >
                    <label 
                        id="slider-label-37"
                        className="page37-slider-label"
                        htmlFor="year-slider-37" 
                        aria-hidden="true"
                    >
                        {getText('year_slider_label', lang)} {year}
                    </label>
                    <div className="page37-slider-track">
                        <input
                            id="year-slider-37"
                            className="page37-slider-input" 
                            type="range"
                            min={minYear}
                            max={maxYear}
                            step={1}
                            value={year || maxYear}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            aria-valuemin={minYear}
                            aria-valuemax={maxYear}
                            aria-valuenow={year}
                            aria-valuetext={`${year}`}
                        />
                        <div className="page37-year-ticks" aria-hidden="true" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginTop: '5px', color: '#666', width: '100%' }}>
                            {yearsList.map(y => (
                                <span key={y} style={{ textAlign: 'center', minWidth: '30px' }}>{y}</span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Live region for year changes */}
                <div 
                    aria-live="polite" 
                    aria-atomic="true" 
                    className="wb-inv"
                >
                    {chartData && `${year}`}
                </div>

                {/* Content Row */}
                <div className={`page37-content-row ${isTableOpen ? 'layout-stacked' : ''}`}>
                    {/* Chart Column */}
                    <div className="page37-chart-column">
                        {/* Chart Title */}
                        <h2 className="page37-chart-title" aria-hidden="true">
                            {getText('page37_chart_title', lang)}
                            <br />
                            ({year}, {getText('page37_chart_subtitle', lang)})
                        </h2>

                        {chartData && (
                            <div 
                                role="region"
                                className="page37-chart-area" 
                                aria-label={`${lang === 'en' ? 'Environmental protection expenditures pie chart for' : 'Graphique circulaire des dépenses de protection de l\'environnement pour'} ${year}. ${getChartDataSummary()}`}
                                style={{ width: '100%' }} 
                            >
                                <figure aria-hidden="true" style={{ width: '100%', height: '100%', margin: 0 }}>
                                    <Plot
                                        data={[{
                                            values: chartData.values,
                                            labels: pieLabels,
                                            hole: 0.60,
                                            type: 'pie',
                                            marker: { colors: chartData.colors, line: { color: 'white', width: 2 } },
                                            texttemplate: windowWidth <= 768 ? '%{percent:.0%}' : '%{label}<br><b>%{value:,.0f}</b>',
                                            textinfo: windowWidth <= 768 ? 'percent' : 'label+value',
                                            textposition: 'outside',
                                            textfont: { 
                                                size: windowWidth <= 480 ? 11 : windowWidth <= 768 ? 12 : windowWidth <= 1280 ? 15 : 18, 
                                                family: 'Arial, sans-serif',
                                                color: chartData.colors
                                            },
                                            outsidetextfont: { color: chartData.colors },
                                            hovertext: chartData.hoverTexts, 
                                            hoverinfo: 'text',
                                            hoverlabel: { bgcolor: 'white', font: { size: 14, family: 'Arial, sans-serif' } },
                                            direction: 'clockwise', 
                                            sort: false, 
                                            rotation: 330,
                                            pull: [0.02, 0.02, 0.02, 0.02, 0.02],
                                            automargin: true
                                        }]}
                                        layout={{
                                            showlegend: windowWidth <= 768,
                                            legend: windowWidth <= 768 ? (
                                                windowWidth <= 480 ? {
                                                    // 400% zoom and up - legend below chart
                                                    orientation: 'h',
                                                    y: -0.10,
                                                    x: 0.6,
                                                    xanchor: 'center',
                                                    yanchor: 'top',
                                                    font: { size: 9 },
                                                    itemwidth: 30,
                                                    itemclick: false,
                                                    itemdoubleclick: false
                                                } : {
                                                    // 250% zoom - legend to the right
                                                    orientation: 'v',
                                                    y: 0.5,
                                                    x: 1.02,
                                                    xanchor: 'left',
                                                    yanchor: 'middle',
                                                    font: { size: 12 },
                                                    itemclick: false,
                                                    itemdoubleclick: false
                                                }
                                            ) : undefined,
                                            margin: windowWidth <= 480
                                                ? { l: 5, r: 5, t: 5, b: 140 }
                                                : windowWidth <= 768 
                                                    ? { l: 10, r: 100, t: 10, b: 10 }
                                                    : { l: 40, r: 40, t: 30, b: 30 },
                                            paper_bgcolor: 'rgba(0,0,0,0)', 
                                            plot_bgcolor: 'rgba(0,0,0,0)',
                                            autosize: true, 
                                            annotations: annotations
                                        }}
                                        useResizeHandler={true}
                                        style={{ width: '100%', height: '100%' }}
                                        config={{ displayModeBar: false, responsive: true, staticPlot: false }}
                                    />
                                </figure>
                            </div>
                        )}
                        
                        {getAccessibleDataTable()}
                    </div>

                    {/* Text Column with Bullet Points */}
                    <div className="page37-text-column">
                        
                        {dynamicValues && (
                            <ul className="page37-bullets" role="list">
                                <li role="listitem" aria-label={lang === 'en'
                                    ? `Electric power generation, transmission and distribution invested ${formatNumber(dynamicValues.electricTotal)} on environmental protection measures.`
                                    : `Les secteurs de production, le transport et la distribution d'électricité ont investi ${formatNumber(dynamicValues.electricTotal)} dans des mesures de protection de l'environnement.`
                                }>
                                    <span aria-hidden="true">
                                        {getText('page37_bullet1_part1', lang)}
                                        <span className="visual-bold">{formatNumber(dynamicValues.electricTotal)}</span>
                                        {getText('page37_bullet1_part2', lang)}
                                    </span>
                                </li>
                                <li role="listitem" aria-label={lang === 'en'
                                    ? `Petroleum and coal product manufacturing invested ${formatNumber(dynamicValues.petroleumTotal)} in environmental protection activities, with the largest percentage of spending (${dynamicValues.petroleumPollutionPct}%) in pollution abatement and control.`
                                    : `Le secteur de fabrication de produits du pétrole et du charbon a investi ${formatNumber(dynamicValues.petroleumTotal)} dans des activités de protection de l'environnement, dont le pourcentage le plus élevé des dépenses (${dynamicValues.petroleumPollutionPct} %) a été consacré à la réduction et au contrôle de la pollution.`
                                }>
                                    <span aria-hidden="true">
                                        {getText('page37_bullet2_part1', lang)}
                                        <span className="visual-bold">{formatNumber(dynamicValues.petroleumTotal)}</span>
                                        {getText('page37_bullet2_part2', lang)}
                                        {dynamicValues.petroleumPollutionPct}
                                        {getText('page37_bullet2_part3', lang)}
                                    </span>
                                </li>
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Page37;
