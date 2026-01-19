import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getForeignControlData, getInternationalInvestmentData } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const Page32 = () => {
    const { lang } = useOutletContext();
    const [chartData, setChartData] = useState([]);
    const [investmentData, setInvestmentData] = useState([]);
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

    // Track window width for responsive chart settings
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Load data on mount
    useEffect(() => {
        Promise.all([
            getForeignControlData(),
            getInternationalInvestmentData()
        ])
            .then(([foreignData, intlData]) => {
                setChartData(foreignData);
                setInvestmentData(intlData);
            })
            .catch(err => {
                console.error("Failed to load page 32 data:", err);
                setError(err.message || 'Failed to load data');
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    // Colors matching the NRCan Factbook chart
    const COLORS = {
        'utilities': '#284162',      // Dark blue
        'oil_gas': '#419563',        // Green
        'all_non_financial': '#8B7355', // Olive/brown
    };

    // Calculate bullet point values from investment data
    const bulletValues = useMemo(() => {
        if (investmentData.length < 2) return null;
        
        const latestYear = investmentData[investmentData.length - 1];
        const prevYear = investmentData[investmentData.length - 2];
        
        const fdiLatest = (latestYear.fdi || 0) / 1000; // Convert to billions
        const fdiPrev = (prevYear.fdi || 0) / 1000;
        const cdiaLatest = (latestYear.cdia || 0) / 1000;
        const cdiaPrev = (prevYear.cdia || 0) / 1000;
        
        const fdiGrowth = fdiPrev > 0 ? ((fdiLatest - fdiPrev) / fdiPrev * 100) : 0;
        const cdiaGrowth = cdiaPrev > 0 ? ((cdiaLatest - cdiaPrev) / cdiaPrev * 100) : 0;
        
        // Energy industry share of overall FDI - approximately 10%
        const energyShare = 10;
        
        // Oil and gas extraction as portion of CDIA - approximately $36B
        // This is roughly 17% of total CDIA based on the factbook
        const oilGasCdia = Math.round(cdiaLatest * 0.168);
        
        return {
            year: latestYear.year,
            prevYear: prevYear.year,
            fdi: Math.round(fdiLatest),
            fdiGrowth: fdiGrowth.toFixed(1),
            energyShare,
            cdia: Math.round(cdiaLatest),
            cdiaGrowth: Math.round(cdiaGrowth),
            oilGasCdia
        };
    }, [investmentData]);

    // Process chart data
    const processedChartData = useMemo(() => {
        if (chartData.length === 0) return null;

        const years = chartData.map(d => d.year);
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        
        // Generate tick values: start at 2010, every 2 years up to maxYear
        const tickVals = [];
        for (let y = 2010; y <= maxYear; y += 2) {
            tickVals.push(y);
        }

        const utilitiesValues = chartData.map(d => d.utilities || 0);
        const oilGasValues = chartData.map(d => d.oil_gas || 0);
        const allIndustriesValues = chartData.map(d => d.all_non_financial || 0);

        // Build hover text
        const buildHoverText = (values, labelKey) => values.map((v, i) => {
            return `${getText(labelKey, lang)}<br>${years[i]}: ${v.toFixed(1)}%`;
        });

        // Order: All non-financial, Oil/gas, Utilities (left to right in chart)
        const traces = [
            {
                name: getText('page32_legend_all_industries', lang),
                x: years,
                y: allIndustriesValues,
                type: 'bar',
                marker: { color: COLORS.all_non_financial },
                hovertext: buildHoverText(allIndustriesValues, 'page32_hover_all_industries'),
                hoverinfo: 'text',
                hoverlabel: {
                    bgcolor: '#ffffff',
                    bordercolor: '#000000',
                    font: { color: '#000000', size: windowWidth <= 480 ? 12 : 14, family: 'Arial, sans-serif' }
                },
            },
            {
                name: getText('page32_legend_oil_gas', lang),
                x: years,
                y: oilGasValues,
                type: 'bar',
                marker: { color: COLORS.oil_gas },
                hovertext: buildHoverText(oilGasValues, 'page32_hover_oil_gas'),
                hoverinfo: 'text',
                hoverlabel: {
                    bgcolor: '#ffffff',
                    bordercolor: '#000000',
                    font: { color: '#000000', size: windowWidth <= 480 ? 12 : 14, family: 'Arial, sans-serif' }
                },
            },
            {
                name: getText('page32_legend_utilities', lang),
                x: years,
                y: utilitiesValues,
                type: 'bar',
                marker: { color: COLORS.utilities },
                hovertext: buildHoverText(utilitiesValues, 'page32_hover_utilities'),
                hoverinfo: 'text',
                hoverlabel: {
                    bgcolor: '#ffffff',
                    bordercolor: '#000000',
                    font: { color: '#000000', size: windowWidth <= 480 ? 12 : 14, family: 'Arial, sans-serif' }
                },
            }
        ];

        return { traces, years, tickVals, minYear, maxYear, utilitiesValues, oilGasValues, allIndustriesValues };
    }, [chartData, lang, windowWidth]);

    // Format value for screen readers
    const formatPercentSR = (val) => {
        return lang === 'en' 
            ? `${val.toFixed(1)} percent` 
            : `${val.toFixed(1)} pour cent`;
    };

    // Screen reader version of chart title
    const getChartTitleSR = () => {
        if (lang === 'en') {
            return 'Foreign control of Canadian assets';
        } else {
            return "Contrôle étranger d'actifs canadiens";
        }
    };

    // Screen reader summary
    const getChartDataSummary = () => {
        if (!chartData || chartData.length === 0) return '';
        
        const latestYear = chartData[chartData.length - 1];
        const latestYearNum = latestYear.year;

        if (lang === 'en') {
            return `Grouped bar chart showing foreign control of Canadian assets from ${processedChartData?.minYear} to ${latestYearNum}. In ${latestYearNum}, Utilities were at ${formatPercentSR(latestYear.utilities || 0)}, Oil and gas extraction at ${formatPercentSR(latestYear.oil_gas || 0)}, and All non-financial industries at ${formatPercentSR(latestYear.all_non_financial || 0)}. Expand the data table below for detailed values.`;
        } else {
            return `Graphique à barres groupées montrant le contrôle étranger des actifs canadiens de ${processedChartData?.minYear} à ${latestYearNum}. En ${latestYearNum}, les Services publics étaient à ${formatPercentSR(latestYear.utilities || 0)}, l'Extraction de pétrole et de gaz à ${formatPercentSR(latestYear.oil_gas || 0)}, et le Total des industries non financières à ${formatPercentSR(latestYear.all_non_financial || 0)}. Développez le tableau de données ci-dessous pour les valeurs détaillées.`;
        }
    };

    // Format number for table display
    const formatNumber = (val) => {
        return val.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { 
            minimumFractionDigits: 1, 
            maximumFractionDigits: 1 
        });
    };

    // Generate accessible data table
    // Generate accessible data table
    const getAccessibleDataTable = () => {
        if (!chartData || chartData.length === 0) return null;
        
        const unitText = lang === 'en' ? ', in percent' : ', en pourcentage';
        const captionId = 'page32-table-caption';
        
        const utilitiesLabel = getText('page32_legend_utilities', lang);
        const oilGasLabel = getText('page32_legend_oil_gas', lang);
        const allIndustriesLabel = getText('page32_legend_all_industries', lang);
        const cellUnitSR = lang === 'en' ? ' percent' : ' pour cent';
        const headerUnitVisual = '(%)';
        const headerUnitSR = lang === 'en' ? '(percentage)' : '(pourcentage)';
        
        return (
            <details 
                onToggle={(e) => setIsTableOpen(e.currentTarget.open)}
                className="page32-data-table"
                style={{ cursor: 'pointer' }} 
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

                <div className="table-responsive" style={{ marginTop: '10px' }} role="region" aria-labelledby={captionId}>
                    <table className="table table-striped table-hover">
                        <caption id={captionId} className="wb-inv">
                            {lang === 'en' 
                                ? 'Foreign control of Canadian assets (percentage of total assets)'
                                : "Contrôle étranger d'actifs canadiens (pourcentage des actifs totaux)"}
                        </caption>
                        <thead>
                            <tr>
                                <td className="text-center fw-bold">{lang === 'en' ? 'Year' : 'Année'}</td>
                                <td className="text-center fw-bold">
                                    {utilitiesLabel}<br/>
                                    <span aria-hidden="true">{headerUnitVisual}</span>
                                    <span className="wb-inv">{headerUnitSR}</span>
                                </td>
                                <td className="text-center fw-bold">
                                    {oilGasLabel}<br/>
                                    <span aria-hidden="true">{headerUnitVisual}</span>
                                    <span className="wb-inv">{headerUnitSR}</span>
                                </td>
                                <td className="text-center fw-bold">
                                    {allIndustriesLabel}<br/>
                                    <span aria-hidden="true">{headerUnitVisual}</span>
                                    <span className="wb-inv">{headerUnitSR}</span>
                                </td>
                            </tr>
                        </thead>
                        <tbody>
                            {chartData.map(yearData => {
                                const yearHeaderId = `year-${yearData.year}`;
                                return (
                                    <tr key={yearData.year}>
                                        <th scope="row" id={yearHeaderId}>{yearData.year}</th>
                                        <td headers={yearHeaderId}>
                                            <span className="wb-inv">{yearData.year}, {utilitiesLabel}: </span>
                                            <span aria-hidden="true">{formatNumber(yearData.utilities || 0)}%</span>
                                            <span className="wb-inv">{formatNumber(yearData.utilities || 0)}{cellUnitSR}</span>
                                        </td>
                                        <td headers={yearHeaderId}>
                                            <span className="wb-inv">{yearData.year}, {oilGasLabel}: </span>
                                            <span aria-hidden="true">{formatNumber(yearData.oil_gas || 0)}%</span>
                                            <span className="wb-inv">{formatNumber(yearData.oil_gas || 0)}{cellUnitSR}</span>
                                        </td>
                                        <td headers={yearHeaderId}>
                                            <span className="wb-inv">{yearData.year}, {allIndustriesLabel}: </span>
                                            <span aria-hidden="true">{formatNumber(yearData.all_non_financial || 0)}%</span>
                                            <span className="wb-inv">{formatNumber(yearData.all_non_financial || 0)}{cellUnitSR}</span>
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

    if (!processedChartData) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>No data available. Please refresh the page.</div>;
    }

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-32" 
            role="main"
            aria-label={getText('page32_title', lang)}
            style={{
                backgroundColor: 'white',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                borderLeft: '18px solid #8e7e52',
                boxSizing: 'border-box',
            }}
        >
            <style>{`
                .page-32 {
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

                .page32-container {
                    width: 100%;
                    padding: 15px 30px 20px 55px;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    flex: 1;
                    overflow: visible;
                }

                .page32-title {
                    font-family: 'Georgia', serif;
                    color: #857550;
                    font-size: 2.2rem;
                    font-weight: bold;
                    font-style: italic;
                    margin-left: -19px;
                    margin-top: 5px;
                    line-height: 1.3;
                }

                .page32-bullets {
                    font-family: Arial, sans-serif;
                    color: #333;
                    font-size: 1rem;
                    margin-bottom: 10px;
                    line-height: 1.6;
                    margin-left: -21px;
                    list-style-type: disc;
                }

                .page32-bullets li {
                    margin-bottom: 8px;
                    margin-left: -21px;
                }

                .page32-bullets li::marker {
                    font-size: 1rem; 
                }

                .visual-bold {
                    font-weight: bold;
                }

                .page32-section-title {
                    font-family: Arial, sans-serif;
                    color: #333;
                    font-size: 1.2rem;
                    font-weight: bold;
                    margin-bottom: 0px;
                    margin-top: 15px;
                    margin-left: -19px;
                }

                .page32-section-text {
                    font-family: Arial, sans-serif;
                    color: #333;
                    font-size: 1rem;
                    margin-bottom: 0px;
                    line-height: 1.5;
                    position: relative;
                    margin-left: -19px;
                }

                .page32-chart-title {
                    font-family: Arial, sans-serif;
                    color: #333;
                    font-size: 1.2rem;
                    font-weight: bold;
                    text-align: center;
                    margin-bottom: 5px;
                    margin-left: -19px;
                }

                .page32-chart-wrapper {
                    display: flex;
                    flex-direction: row;
                    align-items: flex-start;
                    justify-content: flex-start;
                    gap: 20px;
                    width: 100%;
                    margin-left: -39px;
                }

                .page32-chart {
                    flex: 1;
                    min-width: 0;
                    width: 100%;
                    height: calc(100vh - 680px);
                    min-height: 260px;
                }

                .page32-data-table {
                    margin-left: -21px !important;
                    width: calc(100% - 400px) !important;
                }

                /* 110% zoom (~1745px) */
                @media (max-width: 1745px) {
                    .page32-chart {
                        height: calc(100vh - 660px);
                        min-height: 264px;
                    }
                }

                /* 125% zoom (~1536px) */
                @media (max-width: 1536px) {
                    .page32-container {
                        padding: 10px 25px 10px 25px;
                    }
                    .page32-title {
                        font-size: 1.8rem;
                        margin-left: 10px !important;
                    }
                    .page32-chart {
                        height: calc(100vh - 640px);
                        min-height: 268px;
                    }

                    .page32-bullets {
                        margin-left: -6px !important;
                    }

                    .page32-bullets li {
                        margin-left: -6px !important;
                    }

                    .page32-section-title {
                        margin-left: 10px !important;
                    }

                    .page32-section-text {
                        margin-left: 10px !important;
                    }

                    .page32-chart-title {
                        margin-left: 10px !important;
                    }

                    .page32-chart-wrapper {
                        margin-left: -8px !important;
                    }

                    .page32-data-table {
                        margin-left: 10px !important;
                        width: calc(100% - 400px) !important;
                    }
                }

                /* 150% zoom (~1280px) */
                @media (max-width: 1280px) {
                    .page32-container {
                        padding: 10px 20px 10px 20px;
                    }
                    .page32-title {
                        font-size: 1.6rem;
                    }
                    
                    .page32-chart {
                        flex: 0 0 auto;
                        height: calc(100vh - 620px);
                        min-height: 272px;
                        width: calc(100% + 20px) !important;
                    }

                     .page32-data-table {
                        width: calc(100% - 18px) !important;
                    }
                }

                /* 175% zoom (~1097px) */
                @media (max-width: 1097px) {
                    .page32-title {
                        font-size: 1.5rem;
                        margin-left: 16px !important;
                        padding-right: 10px !important; 
                        box-sizing: border-box !important;
                    }
                    .page32-chart {
                        height: calc(100vh - 600px);
                        min-height: 276px;
                        width: calc(100% + 10px) !important;
                    }

                    .page32-bullets {
                        margin-left: -4px !important;
                        padding-right: 10px !important; 
                        box-sizing: border-box !important;
                    }

                    .page32-bullets li {
                        margin-left: -4px !important;
                        padding-right: 10px !important; 
                        box-sizing: border-box !important;
                    }

                    .page32-section-title {
                        margin-left: 16px !important;
                        padding-right: 10px !important; 
                        box-sizing: border-box !important;
                    }

                    .page32-section-text {
                        margin-left: 16px !important;
                        padding-right: 10px !important; 
                        box-sizing: border-box !important;
                    }

                    .page32-chart-title {
                        margin-left: 16px !important;
                        padding-right: 10px !important; 
                        box-sizing: border-box !important;
                    }

                    .page32-chart-wrapper {
                        margin-left: 0px !important;
                    }

                    .page32-data-table {
                        margin-left: 16px !important;
                        width: calc(100% - 25px) !important;
                    }
                }

                /* 200% zoom (~960px) */
                @media (max-width: 960px) {
                    .page32-container {
                        padding: 8px 15px 8px 15px;
                    }
                      
                    .page32-title {
                        font-size: 1.4rem;
                        margin-left: 14px !important;
                    }
                    .page32-chart {
                        height: calc(100% - 0px);
                        min-height: 280px;
                    }

                    .page32-bullets {
                        margin-left: -6px !important;
                    }

                    .page32-bullets li {
                        margin-left: -6px !important;
                    }

                    .page32-section-title {
                        margin-left: 14px !important;
                    }

                    .page32-section-text {
                        margin-left: 14px !important;
                    }

                    .page32-chart-title {
                        margin-left: 14px !important;
                    }

                      .page32-chart-wrapper {
                        margin-left: -6px !important;
                    }

                    .page32-data-table {
                        width: calc(100% - 28px) !important;
                    }
                }

                /* 250% zoom (~768px) */
                @media (max-width: 768px) {
                    .page-32 {
                        margin-left: -20px !important;
                        margin-right: -20px !important;
                        width: calc(100% + 40px) !important;
                        border-left: none !important;
                    }
                    .page32-container {
                        padding: 8px 20px 8px 45px !important;
                    }
                    .page32-title {
                        font-size: 1.3rem;
                        margin-left: -24px !important;
                    }
                    .page32-chart {
                        height: calc(100vh - 550px);
                        min-height: 285px;
                        width: calc(100% + 55px) !important;
                    }

                    .page32-bullets {
                        margin-left: -25px !important;
                    }

                    .page32-bullets li {
                        margin-left: -25px !important;
                    }

                    .page32-section-title {
                        margin-left: -24px !important;
                    }

                    .page32-section-text {
                        margin-left: -24px !important;
                    }

                    .page32-chart-title {
                        margin-left: -24px !important;
                    }

                      .page32-chart-wrapper {
                        margin-left: -36px !important;
                    }

                    .page32-data-table {
                        width: calc(100% + 28px) !important;
                        margin-left: -26px !important;
                    }
                }
                
                /* 300% zoom (~640px) */
                @media (max-width: 640px) {
                    .page32-title {
                        font-size: 1.2rem;
                    }
                    .page32-chart {
                        height: calc(100vh - 520px);
                        min-height: 290px;
                    }

                    .page32-bullets {
                        margin-left: -30px !important;
                    }

                    .page32-bullets li {
                        margin-left: -22px !important;
                    }

                    .page32-section-title {
                        margin-left: -22px !important;
                    }
                }

                /* 400% zoom (~480px) */
                @media (max-width: 480px) {
                    .page32-container {
                        padding: 5px 10px;
                    }
                    .page32-title {
                        font-size: 1.1rem;
                    }
                    .page32-chart {
                        height: calc(100vh - 500px);
                        min-height: 295px;
                        margin-left: 4px !important;
                        width: calc(100% + 50px) !important;
                    }
                }

                /* 500% zoom (~384px) */
                @media (max-width: 384px) {
                    .page32-container {
                        padding: 5px 8px;
                    }
                    .page32-title {
                        font-size: 1rem;
                    }
                    .page32-chart {
                        height: calc(100vh - 480px);
                        min-height: 300px;
                    }
                }
                
                details summary::-webkit-details-marker,
                details summary::marker {
                    display: none;
                }
            `}</style>

            <div className="page32-container">
                {/* Title */}
                <h1 className="page32-title">
                    {getText('page32_title', lang)}
                </h1>

                {/* Bullet Points with Dynamic Values */}
                {bulletValues && (
                    <ul className="page32-bullets" role="list">
                        {/* Bullet 1 - FIXED: Removed trailing period from aria-label to stop "Dot" reading */}
                        <li role="listitem" aria-label={lang === 'en' 
                            ? `${getText('page32_bullet1_part1', lang)}${getText('page32_bullet1_part2', lang)}${getText('page32_bullet1_part3', lang)}${bulletValues.year}${getText('page32_bullet1_part4', lang)}${bulletValues.fdi}${getText('page32_bullet1_part5', lang)} (+${bulletValues.fdiGrowth}% over the previous year)`
                            : `${getText('page32_bullet1_part1', lang)}${getText('page32_bullet1_part2', lang)}${getText('page32_bullet1_part3', lang)}${bulletValues.fdi}${getText('page32_bullet1_part4', lang)}${getText('page32_bullet1_part5', lang)}${bulletValues.year} (+${bulletValues.fdiGrowth}% par rapport à l'année précédente)`
                        }>
                            <span aria-hidden="true">
                                {lang === 'en' ? (
                                    <>
                                        {getText('page32_bullet1_part1', lang)}
                                        <span className="visual-bold">{getText('page32_bullet1_part2', lang)}</span>
                                        {getText('page32_bullet1_part3', lang)}
                                        {bulletValues.year}
                                        {getText('page32_bullet1_part4', lang)}
                                        <span className="visual-bold">${bulletValues.fdi}{getText('page32_bullet1_part5', lang)}</span>
                                        {' (+'}
                                        {bulletValues.fdiGrowth}
                                        {'% over the previous year).'}
                                    </>
                                ) : (
                                    <>
                                        {getText('page32_bullet1_part1', lang)}
                                        <span className="visual-bold">{getText('page32_bullet1_part2', lang)}</span>
                                        {getText('page32_bullet1_part3', lang)}
                                        <span className="visual-bold">{bulletValues.fdi}{getText('page32_bullet1_part4', lang)}</span>
                                        {getText('page32_bullet1_part5', lang)}
                                        {bulletValues.year}
                                        {' (+'}
                                        {bulletValues.fdiGrowth}
                                        {"% par rapport à l'année précédente)."}
                                    </>
                                )}
                            </span>
                        </li>

                        {/* Bullet 2 */}
                        <li role="listitem" aria-label={`${getText('page32_bullet2_part1', lang)} ${bulletValues.energyShare}${getText('page32_bullet2_part2', lang)}${bulletValues.year}${getText('page32_bullet2_part3', lang)}${bulletValues.prevYear}${getText('page32_bullet2_part4', lang)}`}>
                            <span aria-hidden="true">
                                {getText('page32_bullet2_part1', lang)}
                                <span className="visual-bold">{bulletValues.energyShare}</span>
                                {getText('page32_bullet2_part2', lang)}
                                {bulletValues.year}
                                {getText('page32_bullet2_part3', lang)}
                                {bulletValues.prevYear}
                                {getText('page32_bullet2_part4', lang)}
                            </span>
                        </li>

                        {/* Bullet 3 */}
                        <li role="listitem" aria-label={lang === 'en'
                            ? `${getText('page32_bullet3_part1', lang)}${getText('page32_bullet3_part2', lang)}${getText('page32_bullet3_part3', lang)}${bulletValues.cdia}${getText('page32_bullet3_part4', lang)}${getText('page32_bullet3_part5', lang)}${bulletValues.year}${getText('page32_bullet3_part6', lang)}${bulletValues.cdiaGrowth}${getText('page32_bullet3_part7', lang)}${bulletValues.prevYear}${getText('page32_bullet3_part8', lang)}`
                            : `${getText('page32_bullet3_part1', lang)}${getText('page32_bullet3_part2', lang)}${getText('page32_bullet3_part3', lang)}${bulletValues.cdia}${getText('page32_bullet3_part4', lang)}${getText('page32_bullet3_part5', lang)}${bulletValues.year}${getText('page32_bullet3_part6', lang)}${bulletValues.cdiaGrowth}${getText('page32_bullet3_part7', lang)}${bulletValues.prevYear}${getText('page32_bullet3_part8', lang)}`
                        }>
                            <span aria-hidden="true">
                                {getText('page32_bullet3_part1', lang)}
                                <span className="visual-bold">{getText('page32_bullet3_part2', lang)}</span>
                                {getText('page32_bullet3_part3', lang)}
                                <span className="visual-bold">${bulletValues.cdia}{getText('page32_bullet3_part4', lang)}</span>
                                {getText('page32_bullet3_part5', lang)}
                                {bulletValues.year}
                                {getText('page32_bullet3_part6', lang)}
                                {bulletValues.cdiaGrowth}
                                {getText('page32_bullet3_part7', lang)}
                                {bulletValues.prevYear}
                                {getText('page32_bullet3_part8', lang)}
                            </span>
                        </li>

                        {/* Bullet 4 */}
                        <li role="listitem" aria-label={lang === 'en'
                            ? `${getText('page32_bullet4_part1', lang)}${bulletValues.oilGasCdia}${getText('page32_bullet4_part2', lang)}${getText('page32_bullet4_part3', lang)}${bulletValues.year}${getText('page32_bullet4_part4', lang)}`
                            : `${getText('page32_bullet4_part1', lang)}${bulletValues.oilGasCdia}${getText('page32_bullet4_part2', lang)}${getText('page32_bullet4_part3', lang)}${bulletValues.year}${getText('page32_bullet4_part4', lang)}`
                        }>
                            <span aria-hidden="true">
                                {getText('page32_bullet4_part1', lang)}
                                <span className="visual-bold">${bulletValues.oilGasCdia}{getText('page32_bullet4_part2', lang)}</span>
                                {getText('page32_bullet4_part3', lang)}
                                {bulletValues.year}
                                {getText('page32_bullet4_part4', lang)}
                            </span>
                        </li>
                    </ul>
                )}

                {/* Section Title */}
                <h2 className="page32-section-title">
                    {getText('page32_section_title', lang)}
                </h2>

                {/* Section Text - FIXED: Use SR-only span to ensure reading */}
                <p className="page32-section-text">
                    {/* 1. Screen Reader sees this simple block */}
                    <span className="wb-inv">
                        {getText('page32_section_text', lang)}
                    </span>
                    
                    {/* 2. Sighted user sees this HTML with bolding, hidden from SR */}
                    <span 
                        aria-hidden="true"
                        dangerouslySetInnerHTML={{
                            __html: getText('page32_section_text', lang).replace(
                                getText('page32_section_bold_text', lang),
                                `<span class="visual-bold">${getText('page32_section_bold_text', lang)}</span>`
                            )
                        }}
                    />
                </p>

                {/* Chart Section */}
                <div>
                    <h3 
                        className="page32-chart-title" 
                        aria-label={getChartTitleSR()} 
                    >
                        {getText('page32_chart_title', lang)}
                    </h3>

                        <div role="region" aria-label={getChartDataSummary()}>
                        <div className="page32-chart-wrapper">
                            <figure ref={chartRef} aria-hidden="true" className="page32-chart" style={{ margin: 0, position: 'relative' }}>
                                {!isChartInteractive && (
                                    <div onClick={() => setIsChartInteractive(true)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10, cursor: 'pointer' }} title={lang === 'en' ? 'Click to interact' : 'Cliquez pour interagir'} role="button" tabIndex={0} />
                                )}
                                
                                {isChartInteractive && (
                                    <button onClick={() => setIsChartInteractive(false)} style={{ position: 'absolute', top: 0, right: 295, zIndex: 20 }}>{lang === 'en' ? 'Done' : 'Terminé'}</button>
                                )}
                                <Plot
                                    data={processedChartData.traces}
                                    layout={{
                                        barmode: 'group',
                                        hovermode: 'closest',
                                        showlegend: true,
                                        legend: {
                                            orientation: windowWidth <= 1280 ? 'h' : 'v',
                                            x: windowWidth <= 1280 ? 0.5 : 1.02,
                                            xanchor: windowWidth <= 1280 ? 'center' : 'left',
                                            y: windowWidth <= 1280 ? -0.25 : 0.1,
                                            yanchor: windowWidth <= 1280 ? 'top' : 'middle',
                                            font: { size: windowWidth <= 480 ? 13 : 16, family: 'Arial, sans-serif' },
                                            itemclick: 'toggle',
                                            itemdoubleclick: 'toggleothers'
                                        },
                                        xaxis: {
                                            tickvals: processedChartData.tickVals,
                                            showgrid: false,
                                            zeroline: false,
                                            range: [processedChartData.minYear - 0.5, processedChartData.maxYear + 0.5],
                                            tickangle: windowWidth <= 640 ? -45 : 0,
                                            tickfont: { size: windowWidth <= 480 ? 11 : 12, family: 'Arial, sans-serif' },
                                            automargin: true,
                                        },
                                        yaxis: {
                                            title: { 
                                                text: getText('page32_yaxis', lang), 
                                                font: { size: windowWidth <= 768 ? 14 : windowWidth <= 960 ? 16 : 18, family: 'Arial, sans-serif', color: '#333'},
                                                standoff: 5
                                            },
                                            range: [0, 55],
                                            dtick: 10,
                                            tickformat: '.0f',
                                            ticksuffix: '%',
                                            showgrid: false,
                                            showline: true,
                                            linewidth: 1,
                                            linecolor: '#333',
                                            automargin: true,
                                            tickfont: { size: windowWidth <= 480 ? 11 : 12, family: 'Arial, sans-serif' }
                                        },
                                        margin: { 
                                            l: windowWidth <= 480 ? 50 : windowWidth <= 768 ? 60 : 70, 
                                            r: windowWidth <= 1280 ? 15 : 180,
                                            t: 20, 
                                            b: windowWidth <= 1280 ? 80 : 50
                                        },
                                        autosize: true,
                                        bargap: 0.15,
                                        bargroupgap: 0.1
                                    }}
                                    style={{ width: '100%', height: '100%' }}
                                    useResizeHandler={true}
                                    config={{ displayModeBar: isChartInteractive, responsive: true }}
                                />
                            </figure>
                        </div>
                        
                        {getAccessibleDataTable()}
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Page32;
