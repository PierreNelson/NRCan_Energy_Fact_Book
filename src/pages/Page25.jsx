import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getInfrastructureData } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const Page25 = () => {
    const { lang } = useOutletContext();
    const [year, setYear] = useState(null);
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);

    const minYear = useMemo(() => pageData.length > 0 ? pageData[0].year : 2007, [pageData]);
    const maxYear = useMemo(() => pageData.length > 0 ? pageData[pageData.length - 1].year : 2024, [pageData]);
    
    const yearsList = useMemo(() => Array.from(
        { length: maxYear - minYear + 1 },
        (_, i) => minYear + i
    ), [minYear, maxYear]);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        getInfrastructureData()
            .then(data => {
                setPageData(data);
                if (data && data.length > 0) {
                    setYear(data[data.length - 1].year);
                }
            })
            .catch(err => {
                console.error("Failed to load infrastructure data:", err);
                setError(err.message || 'Failed to load data');
            })
            .finally(() => {
                setLoading(false);
            });
        import('./Page26');
    }, []);

    const COLORS = {
        'environmental': '#e9d259', 'fuel_energy_pipelines': '#6cbe8d',
        'transport': '#2DA6B4', 'education': '#597DD9',
        'health_housing': '#857550', 'public_safety': '#f58445',
    };

    const CATEGORY_ORDER = ['environmental', 'fuel_energy_pipelines', 'transport', 'education', 'health_housing', 'public_safety'];

    const currentYearData = useMemo(() => {
        if (!year || pageData.length === 0) return null;
        return pageData.find(d => d.year === year) || pageData[pageData.length - 1];
    }, [year, pageData]);

    const chartData = useMemo(() => {
        if (!currentYearData) return null;
        const total = currentYearData.total;
        const values = [];
        const colors = [];
        const hoverTexts = [];
        const pctDict = {};

        const hoverKeys = {
            'environmental': 'hover_environmental', 'fuel_energy_pipelines': 'hover_fuel_energy',
            'transport': 'hover_transport', 'education': 'hover_education',
            'health_housing': 'hover_health_housing', 'public_safety': 'hover_public_safety',
        };
        const billionText = getText('billion', lang);

        CATEGORY_ORDER.forEach(cat => {
            const value = currentYearData[cat] || 0;
            const pct = total > 0 ? (value / total) * 100 : 0;
            if (value >= 0) { 
                values.push(value);
                colors.push(COLORS[cat]);
                pctDict[cat] = pct;
                const catName = getText(hoverKeys[cat], lang);
                const valueBillions = value / 1000;
                let hoverText = lang === 'en' 
                    ? `<b>${catName}</b><br>$${valueBillions.toFixed(1)} ${billionText}<br>${pct.toFixed(0)}%`
                    : `<b>${catName}</b><br>${valueBillions.toFixed(1)} $ ${billionText}<br>${pct.toFixed(0)}%`;
                hoverTexts.push(hoverText);
            }
        });
        return { values, colors, hoverTexts, total, pctDict };
    }, [currentYearData, lang]);

    const pieLabels = useMemo(() => {
        const transKeys = {
            'environmental': 'infra_environmental', 'fuel_energy_pipelines': 'infra_fuel_energy',
            'transport': 'infra_transport', 'education': 'infra_education',
            'health_housing': 'infra_health_housing', 'public_safety': 'infra_public_safety',
        };
        return CATEGORY_ORDER.map(cat => {
            const labelText = getText(transKeys[cat], lang);
            return labelText;
        });
    }, [lang]);

    const annotations = useMemo(() => {
        if (!chartData || !chartData.pctDict) return [];
        const totalBillions = (chartData.total || 0) / 1000;
        
        const centerText = lang === 'en'
            ? `<b>TOTAL</b><br><b>$${totalBillions.toFixed(0)}</b><br><b>BILLION</b>`
            : `<b>TOTAL</b><br><b>${totalBillions.toFixed(0)} $</b><br><b>MILLIARDS</b>`;

        let fontSize;
        if (windowWidth <= 480) {
            fontSize = 12;
        } else if (windowWidth <= 768) {
            fontSize = 14;
        } else if (windowWidth <= 1400) {
            fontSize = 16;
        } else {
            fontSize = 30;
        }

        return [{
            text: centerText, x: 0.5, y: 0.54,
            font: { size: 22, color: '#424243', family: 'Arial Black, sans-serif' },
            showarrow: false,
        }];
    }, [chartData, lang, windowWidth]);


    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
    }

    if (error) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'red' }}>Error: {error}. Please refresh the page.</div>;
    }

    if (!currentYearData) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>No data available. Please refresh the page.</div>;
    }

    const getSubtitleText = () => {
        if (!currentYearData) return '';
        const fuelPct = ((currentYearData['fuel_energy_pipelines'] || 0) / currentYearData.total) * 100;
        const fuelValueBillions = (currentYearData['fuel_energy_pipelines'] || 0) / 1000;
        const billionText = getText('billion', lang);
        const dollarsText = lang === 'en' ? 'dollars' : 'dollars';
        const valueDisplay = `(${fuelValueBillions.toFixed(1)} ${billionText} ${dollarsText})`;
        
        return `${getText('page25_subtitle_part1', lang).replace(/<br>/g, ' ')} ${getText('page25_subtitle_part2', lang).replace(/\n/g, ' ')} ${fuelPct.toFixed(1)}% ${getText('page25_subtitle_part3', lang)} ${year} ${valueDisplay}${getText('page25_subtitle_part4', lang)}`;
    };

    const getSubtitle = () => {
        if (!currentYearData) return null;
        const fuelPct = ((currentYearData['fuel_energy_pipelines'] || 0) / currentYearData.total) * 100;
        const fuelValueBillions = (currentYearData['fuel_energy_pipelines'] || 0) / 1000;
        const billionText = getText('billion', lang);
        const valueDisplay = lang === 'en'
            ? `($${fuelValueBillions.toFixed(1)} ${billionText})`
            : `(${fuelValueBillions.toFixed(1)} $ ${billionText})`;

        return (
            <span>
                <strong>{getText('page25_subtitle_part1', lang)}</strong>
                {getText('page25_subtitle_part2', lang)}
                <strong>{fuelPct.toFixed(1)}%</strong>
                {getText('page25_subtitle_part3', lang)}
                <strong>{year}</strong>
                {' '}
                <strong>{valueDisplay}</strong>
                {getText('page25_subtitle_part4', lang)}
            </span>
        );
    };

    const getChartDataSummary = () => {
        if (!chartData || !currentYearData) return '';
        const billionText = getText('billion', lang);
        const dollarsText = lang === 'en' ? 'dollars' : 'dollars';
        const categoryNames = {
            'environmental': 'hover_environmental',
            'fuel_energy_pipelines': 'hover_fuel_energy',
            'transport': 'hover_transport',
            'education': 'hover_education',
            'health_housing': 'hover_health_housing',
            'public_safety': 'hover_public_safety'
        };
        
        const parts = CATEGORY_ORDER.map(cat => {
            const value = currentYearData[cat] || 0;
            const pct = chartData.pctDict[cat] || 0;
            const name = getText(categoryNames[cat], lang).replace(/<br>/g, ' ');
            const valueBillions = (value / 1000).toFixed(1);
            return `${name}: ${valueBillions} ${billionText} ${dollarsText} (${pct.toFixed(1)}%)`;
        });
        
        const totalBillions = (chartData.total / 1000).toFixed(1);
        const totalText = `${getText('total', lang)}: ${totalBillions} ${billionText} ${dollarsText}`;
        
        return `${parts.join('. ')}. ${totalText}.`;
    };

    const getRightSideText = () => {
        const title = getText('infra_definition_title', lang).replace(/\n/g, ' ');
        const quote = getText('infra_definition_text', lang).replace(/\n/g, ' ');
        const description = getText('infra_description', lang).replace(/\n/g, ' ');
        return `${title} "${quote}" ${description}`;
    };

    const formatNumberTable = (val) => {
        return val.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { 
            minimumFractionDigits: 1, 
            maximumFractionDigits: 1 
        });
    };

    const stripHtml = (text) => text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

    const getAccessibleDataTable = () => {
        if (!pageData || pageData.length === 0) return null;
        
        const categoryLabels = {
            'environmental': stripHtml(getText('infra_environmental', lang)),
            'fuel_energy_pipelines': stripHtml(getText('infra_fuel_energy', lang)),
            'transport': stripHtml(getText('infra_transport', lang)),
            'education': stripHtml(getText('infra_education', lang)),
            'health_housing': stripHtml(getText('infra_health_housing', lang)),
            'public_safety': stripHtml(getText('infra_public_safety', lang)),
        };

        const cellUnitSR = lang === 'en' ? ' billion dollars' : ' milliards de dollars';
        const headerUnitVisual = lang === 'en' ? '($ billions)' : '(milliards $)';
        const headerUnitSR = lang === 'en' ? '(billions of dollars)' : '(milliards de dollars)';
        const captionId = 'page25-table-caption';
        
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
                    {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                    <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                </summary>

                <div className="table-responsive" role="region" aria-labelledby={captionId}>
                    <table className="table table-striped table-hover">
                        <caption id={captionId} className="wb-inv">
                            {lang === 'en' 
                                ? 'Capital expenditures on construction in infrastructure (billions of dollars)'
                                : 'Dépenses en immobilisations pour la construction d\'infrastructures (milliards de dollars)'}
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
                                return (
                                    <tr key={yearData.year}>
                                        <th scope="row" id={yearHeaderId}>{yearData.year}</th>
                                        {CATEGORY_ORDER.map(cat => (
                                            <td key={cat} headers={yearHeaderId}>
                                                <span className="wb-inv">{yearData.year}, {categoryLabels[cat]}: </span>
                                                {formatNumberTable((yearData[cat] || 0) / 1000)}
                                                <span className="wb-inv">{cellUnitSR}</span>
                                            </td>
                                        ))}
                                        <td headers={yearHeaderId}>
                                            <span className="wb-inv">{yearData.year}, {lang === 'en' ? 'Total' : 'Total'}: </span>
                                            <strong>{formatNumberTable((yearData.total || 0) / 1000)}</strong>
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

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-25" 
            role="main"
            aria-label={getText('page25_title', lang)}
            style={{
                backgroundColor: 'white', 
                flex: '1 1 auto', 
                display: 'flex',
                flexDirection: 'column',
                overflowX: 'hidden',
                overflowY: 'visible',
                boxSizing: 'border-box',
                borderRight: '18px solid #8e7e52',
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
  
                .page-25 {
                    margin-left: -37px;
                    margin-right: -30px;
                    width: calc(100% + 67px);
                }

                .page25-slider-region

                .page25-container {
                    width: 100%;
                    padding: 0; 
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    min-height: 100%;
                }
                
                .page25-content-row {
                    display: flex;
                    flex-direction: row;
                    flex: 1 1 auto;
                    min-height: 0;
                    align-items: flex-start;
                }

                .page25-container > header {
                    padding-left: 0px !important; 
                    padding-right: 48px;
                    box-sizing: border-box;
                }
                .page25-container > header h1,
                .page25-container > header p {
                    padding-left: 54px !important;
                }

                .page25-slider-region {
                    padding-left: 54px !important; 
                    padding-right: 48px !important;
                    width: calc(100% + 35px) !important;
                    margin-left: 0px !important;
                    margin-right: 0 !important;
                    position: relative !important;
                    z-index: 50 !important; 
                }
                .page25-slider-track { flex: 1; }

                .page25-chart-column {
                    width: 90%;
                    height: auto !important; 
                    min-height: 500px;
                    max-height: none !important;
                    padding-right: 175px;
                    position: relative;
                    margin-bottom: 20px;
                }

                .page25-chart-column details {
                    margin-left: 55px !important;
                    margin-top: 0px !important;
                    width: calc(100% - 100px) !important;
                    position: relative !important;
                    z-index: 50 !important;;
                }

                .layout-stacked {
                    flex-direction: column !important;
                    height: auto !important;
                    align-items: center !important;
                    flex: 0 0 auto !important;
                }
                .layout-stacked .page25-chart-column {
                    width: 100% !important;
                    height: auto !important;
                    max-height: none !important;
                    padding-left: 80px !important;
                    margin-bottom: 30px !important;
                    overflow: visible !important;
                }
                .layout-stacked .page25-text-column {
                    width: 100% !important;
                    padding-left: 0 !important;
                    padding-right: 0 !important;
                    margin-top: 20px !important;
                }
                .layout-stacked figure {
                    height: 500px !important;
                    min-height: 500px !important;
                }
                .layout-stacked .page25-chart-column details {
                    margin-left: -28px !important;
                    width: calc(100% + 194px) !important;
                }
                .layout-stacked .page25-definition-box {
                    margin-left: 55px !important;
                    margin-top: -20px !important;
                    width: calc(100% - 68px) !important;
                }

                .page25-chart-column figure {
                    height: 450px;
                    min-height: 450px;
                }

                .page25-text-column {
                    width: 42%;
                    padding-left: 25px;
                    padding-right: 20px;
                    padding-top: 0;
                    margin-top: 0px;
                }

                .page25-definition-box {
                    position: relative;
                    background-color: #aa9c7a;
                    padding: 20px 50px;
                    border-radius: 3px;
                    width: 100%;
                    margin-left: 8px;
                    margin-top: 10px;
                }
                .page25-definition-box h2 {
                    text-align: center !important;
                    padding-left: 0 !important;
                }

                input[type=range] { -webkit-appearance: none; width: 100%; background: transparent; }
                input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 20px; width: 20px; border-radius: 50%; background: #007bff; cursor: pointer; margin-top: -6px; }
                input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 8px; cursor: pointer; background: #007bff; border-radius: 4px; }
                input[type=range]:focus { outline: 2px solid #005fcc; outline-offset: 2px; }
                input[type=range]:focus::-webkit-slider-thumb { box-shadow: 0 0 0 3px rgba(0,123,255,0.5); }

                .js-plotly-plot .plotly .slice path.textline { display: none !important; }
                .js-plotly-plot .plotly g.slice path[class*="textline"] { display: none !important; }
                .js-plotly-plot .plotly .pielayer text {
                    paint-order: stroke fill;
                    stroke: #000000;
                    stroke-width: 5px;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                }


                @media (max-width: 1800px) {
                    .page25-content-row {
                        flex-direction: column;
                        height: auto;
                        align-items: center;
                    }

                    h1 { margin-top: 20px !important; }
                    
                    .page25-chart-column {
                        width: 100%;
                        height: auto;
                        min-height: 500px;
                        max-height: none;
                        padding-left: 80px;
                        margin-bottom: 30px;
                    }
                    
                    .page25-chart-column figure {
                        height: 480px !important;
                        min-height: 480px !important;
                    }
                    
                    .page25-text-column {
                        width: 100%;
                        padding-left: 0;
                        padding-right: 0;
                        margin-top: 20px;
                        margin-bottom: 40px;
                    }

                    .page25-definition-box {
                        margin-left: 55px !important;
                        width: calc(100% - 65px) !important;
                        margin-right: auto !important;
                        margin-top: -20px !important;
                    }

                    .page25-chart-column details {
                        margin-left: -25px !important;
                        margin-top: 0px !important; 
                        width: calc(100% + 190px) !important;
                    }
                        
                }
                
                @media (max-width: 960px) {
                    .page25-year-ticks { display: none !important; }
                    
                    .page25-chart-column figure {
                        height: 520px !important;
                        min-height: 520px !important;
                    }

                     .page25-container > header {
                        padding-left: 45px !important; 
                        padding-right: 30px;
                        box-sizing: border-box;
                    }
                    .page25-container > header h1,
                    .page25-container > header p {
                        padding-left: 0px !important;
                    }

                    .page25-slider-region {
                        padding-left: 45px !important; 
                        padding-right: 50px !important;
                    }

                    .page25-chart-column details {
                        margin-left: -35px !important;
                        margin-top: -10px !important;
                        width: calc(100% + 198px) !important;
                    }

                    .layout-stacked .page25-chart-column details {
                        margin-left: -35px !important;
                        width: calc(100% + 198px) !important;
                    }

                    .page25-definition-box,
                    .layout-stacked .page25-definition-box {
                        text-align: center !important;
                        margin-left: 45px !important;
                        width: calc(100% - 58px) !important;
                        margin-top: -30px !important;
                    }

                }

                @media (max-width: 768px) {
                    .page-25 {
                        margin-left: -45px !important;
                        margin-right: -20px !important;
                        width: calc(100% + 65px) !important;
                        border-right: none !important;
                    }

                    .page25-chart-column figure { 
                        margin-left: 50px !important;
                        height: 320px !important; 
                        min-height: 320px !important; 
                    }
                    
                    .page25-container > header,
                    .page25-slider-region,
                    .page25-chart-column details {
                        padding-left: 0;
                        margin-left: 0px !important; 
                    }
                    
                    .page25-chart-column {
                        margin-top: 0 !important;
                        padding-left: 0 !important;
                        height: auto !important; 
                        min-height: 340px !important; 
                        margin-bottom: 20px !important;
                    }
                    
                    .page25-chart-column details { 
                        margin-left: 45px !important;
                        margin-top: 0px !important;
                        width: calc(100% + 112px) !important; 
                    } 

                    .page25-slider-region {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        padding-right: 20px !important;
                        width: calc(100% + 0px) !important;
                    }
                    .page25-slider-label { margin-bottom: 10px; margin-right: 0 !important; }

                    .layout-stacked .page25-chart-column details {
                        margin-left: -34px !important;
                        width: calc(100% + 190px) !important;
                        box-sizing: border-box !important;
                    }

                     .page25-definition-box,
                    .layout-stacked .page25-definition-box {
                        text-align: center !important;
                        margin-left: 45px !important;
                        width: calc(100% - 64px) !important;
                    }
                }
                
                @media (max-width: 640px) {
                     .page-25 { 
                        margin-left: 0 !important; 
                        margin-right: 0 !important; 
                        width: auto !important;
                        padding-left: 10px;
                        padding-right: 10px;
                    }

                    .page25-container > header,
                    .page25-slider-region,
                    .page25-definition-box,
                    .page25-chart-column details {
                        margin-left: -10px !important;
                        padding-left: 0px !important;
                        width: 100% !important;
                    }
                    .page25-slider-region {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        
                        padding-right: 0px !important; 
                        padding-left: 0px !important;
                        margin-left: -10px !important;
                        width: calc(100% + 18px) !important;
                    }
                    .page25-definition-box, .layout-stacked .page25-definition-box {
                        width: calc(100% + 215px) !important;
                        margin-left: -100px !important;
                        padding-left: 115px !important; 
                        padding-right: 100px !important; 
                        box-sizing: border-box !important;
                        margin-top: -30px !important;
                    }
                    
                    .page25-chart-column,
                    .layout-stacked .page25-chart-column { 
                        width: 100% !important; 
                        height: auto !important; 
                        min-height: 500px !important; 
                        padding-left: 40px !important; 
                        margin-top: 0 !important;
                        margin-bottom: 20px !important;
                    }
                    .page25-chart-column figure { height: 480px !important; min-height: 480px !important; }
                    .page25-chart-column details, .layout-stacked .page25-chart-column details { 
                        margin-left: -50px !important;
                        margin-top: 0px !important;
                        width: calc(100% + 235px) !important; 
                    }
                    .decorative-quote { display: none !important; }
                    
                    input[type=range] { height: 44px !important; padding: 10px 0 !important; }
                    input[type=range]::-webkit-slider-thumb { height: 28px !important; width: 28px !important; margin-top: -10px !important; }
                }

                @media (max-width: 480px) {
                    .page25-chart-column { min-height: 480px !important; margin-bottom: 20px !important; }
                    .page25-chart-column figure { height: 480px !important; min-height: 480px !important; }
                    .page25-chart-column details, .layout-stacked .page25-chart-column details { margin-top: 10px !important; }
                }

                @media (max-width: 384px) {
                    .page25-chart-column,
                    .layout-stacked .page25-chart-column {
                        width: 100% !important; 
                        margin-left: 0 !important;
                        padding-left: 0px !important;
                        padding-right: 0px !important;
                        height: auto !important; 
                        min-height: 400px !important; 
                        margin-bottom: 20px !important;
                        margin-top: 0 !important;
                        align-items: flex-start !important; 
                    }

                    .page25-chart-column figure { 
                        height: 420px !important; 
                        min-height: 420px !important; 
                        margin-left: 0px !important;
                    }

                    .page25-chart-column details, 
                    .layout-stacked .page25-chart-column details {
                        margin-top: 0px !important; 
                        margin-left: -10px !important; 
                        width: 94vw !important; 
                        box-sizing: border-box !important;
                    }
                }
                
                details summary::-webkit-details-marker, details summary::marker { display: none; }
                .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
                .page25-table-btn-wrapper summary:focus {outline: none !important;}
            `}</style>

            <div className="page25-container">
                <header 
                    role="region" 
                    aria-label={`${getText('page25_title', lang).replace(/<br>/g, ' ')}. ${getSubtitleText()}`}
                >
                    <h1 aria-hidden="true" style={{ fontFamily: 'Georgia, serif', color: '#8e7e52', fontSize: '3rem', fontWeight: 'normal', margin: '0 0 3px 0', paddingLeft: '10px' }}>
                        {getText('page25_title', lang)}
                    </h1>

                    <p aria-hidden="true" style={{ fontSize: '1.4rem', color: '#333', marginBottom: '5px', paddingLeft: '10px', whiteSpace: 'pre-line' }}>
                        {getSubtitle()}
                    </p>
                </header>

                <div 
                    className="page25-slider-region"
                    role="region" 
                    aria-label={`${getText('year_slider_label', lang)} ${year}. ${lang === 'en' ? 'Use arrow keys to change year from' : 'Utilisez les touches fléchées pour changer l\'année de'} ${minYear} ${lang === 'en' ? 'to' : 'à'} ${maxYear}.`}
                    style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', marginTop: '5px' }}
                >
                    <label 
                        id="slider-label"
                        className="page25-slider-label"
                        htmlFor="year-slider" 
                        aria-hidden="true"
                        style={{ fontWeight: 'bold', marginRight: '15px', fontSize: '18px', fontFamily: 'Arial, sans-serif', whiteSpace: 'nowrap' }}
                    >
                        {getText('year_slider_label', lang)} {year}
                    </label>
                    <div className="page25-slider-track">
                        <input
                            id="year-slider"
                            type="range"
                            min={minYear}
                            max={maxYear}
                            step={1}
                            value={year || maxYear}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            style={{ width: '100%' }}
                            aria-valuemin={minYear}
                            aria-valuemax={maxYear}
                            aria-valuenow={year}
                            aria-valuetext={`${year}`}
                        />
                        <div className="page25-year-ticks" aria-hidden="true" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginTop: '5px', color: '#666', width: '100%' }}>
                            {yearsList.map(y => (
                                <span key={y} style={{ textAlign: 'center', minWidth: '15px' }}>{y}</span>
                            ))}
                        </div>
                    </div>
                </div>

                <div 
                    aria-live="polite" 
                    aria-atomic="true" 
                    style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}
                >
                    {chartData && `${year}`}
                </div>

                <div className={`page25-content-row ${isTableOpen ? 'layout-stacked' : ''}`}>
                    <div 
                        className="page25-chart-column"
                        role="region"
                        aria-label={`${lang === 'en' ? 'Infrastructure pie chart for' : 'Graphique circulaire des infrastructures pour'} ${year}. ${getChartDataSummary()}. ${lang === 'en' ? 'Expand the data table below for detailed values.' : 'Développez le tableau de données ci-dessous pour les valeurs détaillées.'}`}
                    >
                        {chartData && (
                            <figure aria-hidden="true" style={{ width: '100%', height: '450px', minHeight: '450px', margin: 0 }}>
                                <Plot
                                    data={[{
                                        values: chartData.values,
                                        labels: pieLabels,
                                        hole: windowWidth <= 480 ? 0.80 : windowWidth <= 768 ? 0.75 : windowWidth <= 1400 ? 0.73 : 0.70,
                                        type: 'pie',
                                        marker: { colors: chartData.colors, line: { color: 'black', width: 3 } },
                                        texttemplate: windowWidth <= 768 ? '%{percent:.0%}' : '%{label}<br>%{percent:.0%}',
                                        textinfo: windowWidth <= 768 ? 'percent' : 'label+percent',
                                        textposition: windowWidth <= 768 ? 'inside' : 'outside',
                                        textfont: { 
                                            size: windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18, 
                                            family: 'Arial, sans-serif',
                                            color: windowWidth <= 768 ? '#fff' : chartData.colors
                                        },
                                        outsidetextfont: { color: chartData.colors },
                                        hovertext: chartData.hoverTexts, hoverinfo: 'text',
                                        hoverlabel: { bgcolor: 'white', font: { size: 14, family: 'Arial, sans-serif' } },
                                        direction: 'clockwise', sort: false, rotation: 335,
                                        pull: [0.02, 0.02, 0.02, 0.02, 0.02, 0.02],
                                        automargin: true
                                    }]}
                                    layout={{
                                        showlegend: windowWidth <= 768,
                                        legend: windowWidth <= 768 ? (
                                            windowWidth <= 384 ? {
                                                orientation: 'h',
                                                y: -0.50,
                                                x: 0.5,
                                                xanchor: 'center',
                                                yanchor: 'top',
                                                font: { size: 9 },
                                                itemclick: false,
                                                itemdoubleclick: false
                                            } : windowWidth <= 480 ? {
                                                orientation: 'h',
                                                y: -0.15, 
                                                x: 0.5,
                                                xanchor: 'center',
                                                yanchor: 'top',
                                                font: { size: 9 },
                                                itemclick: false,
                                                itemdoubleclick: false
                                            } : windowWidth <= 640 ? {
                                                orientation: 'h',
                                                y: -0.15,
                                                x: 0.6,
                                                xanchor: 'center',
                                                yanchor: 'top',
                                                font: { size: 10 },
                                                itemclick: false,
                                                itemdoubleclick: false
                                            } : {
                                                orientation: 'v',
                                                y: 0.5,
                                                x: 1.05,
                                                xanchor: 'left',
                                                yanchor: 'middle',
                                                font: { size: 10 },
                                                itemclick: false,
                                                itemdoubleclick: false
                                            }
                                        ) : undefined,
                                        margin: windowWidth <= 384
                                            ? { l: 10, r: 10, t: 10, b: 80 }
                                            : windowWidth <= 480
                                                ? { l: 10, r: 10, t: 10, b: 70 }
                                                : windowWidth <= 640
                                                    ? { l: 10, r: 10, t: 10, b: 60 }
                                                    : windowWidth <= 768 
                                                        ? { l: 10, r: 120, t: 10, b: 10 }
                                                        : { l: 80, r: 80, t: 40, b: 40 },
                                        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
                                        autosize: true, 
                                        annotations: annotations
                                    }}
                                    useResizeHandler={true}
                                    style={{ width: '100%', height: '100%' }}
                                    config={{ displayModeBar: false, responsive: true, staticPlot: false }}
                                />
                            </figure>
                        )}
                        
                        {getAccessibleDataTable()}
                    </div>

                    <aside 
                        className="page25-text-column"
                        role="region"
                        aria-label={getRightSideText()}
                    >
                        <div className="page25-definition-box" aria-hidden="true">
                            <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', textAlign: 'center', color: '#333', margin: '0 0 15px 0px', lineHeight: '1.4', whiteSpace: 'pre-line' }}>
                                {getText('infra_definition_title', lang)}
                            </h2>
                            <div style={{ textAlign: 'center' }}>
                                <span className="decorative-quote" aria-hidden="true" style={{ 
                                    position: 'absolute',
                                    top: '-5px',
                                    left: '10px',
                                    fontSize: '6rem', 
                                    color: '#292419', 
                                    fontFamily: 'Georgia, serif', 
                                    lineHeight: '1',
                                    pointerEvents: 'none'
                                }}>❞</span>
                                
                                <p style={{ fontSize: '1.05rem', color: '#333', lineHeight: '1.6', whiteSpace: 'pre-line', textAlign: 'center', margin: 0, padding: '0 10px' }}>
                                    {getText('infra_definition_text', lang)}
                                </p>
                                
                                <span className="decorative-quote" aria-hidden="true" style={{ 
                                    position: 'absolute',
                                    bottom: '-35px',
                                    left: 'calc(100% - 70px)',
                                    fontSize: '6rem', 
                                    color: '#292419', 
                                    fontFamily: 'Georgia, serif', 
                                    lineHeight: '1',
                                    pointerEvents: 'none'
                                }}>❞</span>
                            </div>
                        </div>
                        <p aria-hidden="true" style={{ fontSize: '1.05rem', color: '#333', lineHeight: '1.5', marginTop: '10px', marginLeft: '0', textAlign: 'center', whiteSpace: 'pre-line' }}>
                            {getText('infra_description', lang)}
                        </p>
                    </aside>
                </div>
            </div>
        </main>
    );
};

export default Page25;
