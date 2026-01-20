import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getEconomicContributionsData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import page26BgImage from '../assets/page26_bg.png';

const Page26 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [year, setYear] = useState(null);
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isTableOpen, setIsTableOpen] = useState(false);

    useEffect(() => {
        getEconomicContributionsData()
            .then(data => {
                setPageData(data);
                if (data && data.length > 0) {
                    setYear(data[data.length - 1].year);
                }
            })
            .catch(err => {
                console.error("Failed to load economic contributions data:", err);
                setError(err.message || 'Failed to load data');
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    const minYear = pageData.length > 0 ? pageData[0].year : 2007;
    const maxYear = pageData.length > 0 ? pageData[pageData.length - 1].year : 2024;
    
    const yearsList = Array.from(
        { length: maxYear - minYear + 1 }, 
        (_, i) => minYear + i
    );

    const COLORS = {
        title: '#58585a',
        jobs: '#82734A',
        income: '#82734A',
        gdp: '#82734A',
        year: '#000000',
        border: '#8e7e52'
    };

    const currentYearData = useMemo(() => {
        return pageData.find(d => d.year === year) || pageData[pageData.length - 1];
    }, [year, pageData]);

    const formatJobs = (val) => `${(val / 1000).toFixed(1)} k`;

    const formatBillions = (val) => {
        const b = val / 1000;
        const text = getText('billion', lang);
        return lang === 'en' ? `$${b.toFixed(1)} ${text}` : `${b.toFixed(1)} $ ${text}`;
    };

    const formatJobsSR = (val) => {
        const k = (val / 1000).toFixed(1);
        return lang === 'en' ? `${k} thousand jobs` : `${k} mille emplois`;
    };

    const formatBillionsSR = (val) => {
        const b = (val / 1000).toFixed(1);
        const text = getText('billion', lang);
        return `${b} ${text} ${lang === 'en' ? 'dollars' : 'dollars'}`;
    };

    const formatNumberTable = (val) => {
        return (val / 1000).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { 
            minimumFractionDigits: 1, 
            maximumFractionDigits: 1 
        });
    };

    const formatJobsTable = (val) => {
        return (val / 1000).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { 
            minimumFractionDigits: 1, 
            maximumFractionDigits: 1 
        });
    };

    const getAccessibleDataTable = () => {
        if (!pageData || pageData.length === 0) return null;
        
        const captionId = 'page26-table-caption';
        
        return (
            <details 
                onToggle={(e) => setIsTableOpen(e.currentTarget.open)}
                style={{ 
                    marginTop: '10px', 
                    marginBottom: '10px', 
                    width: '100%', 
                    minWidth: '300px',
                    marginLeft: 0,
                    marginRight: 0,
                    fontFamily: 'Arial, sans-serif',
                    position: 'relative',
                    zIndex: 2,
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    borderRadius: '4px'
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
                                ? 'Economic contributions of fuel, energy and pipeline infrastructure'
                                : 'Contributions économiques des infrastructures de carburant, d\'énergie et de pipelines'}
                        </caption>
                        <thead>
                            <tr>
                                <td className="text-center fw-bold">{lang === 'en' ? 'Year' : 'Année'}</td>
                                <td className="text-center fw-bold">
                                    {lang === 'en' ? 'Jobs' : 'Emplois'}<br/>
                                    <span aria-hidden="true">{lang === 'en' ? '(thousands)' : '(milliers)'}</span>
                                    <span className="wb-inv">{lang === 'en' ? '(thousands)' : '(milliers)'}</span>
                                </td>
                                <td className="text-center fw-bold">
                                    {lang === 'en' ? 'Employment income' : 'Revenu d\'emploi'}<br/>
                                    <span aria-hidden="true">{lang === 'en' ? '($ billions)' : '(milliards $)'}</span>
                                    <span className="wb-inv">{lang === 'en' ? '(billions of dollars)' : '(milliards de dollars)'}</span>
                                </td>
                                <td className="text-center fw-bold">
                                    {lang === 'en' ? 'GDP' : 'PIB'}<br/>
                                    <span aria-hidden="true">{lang === 'en' ? '($ billions)' : '(milliards $)'}</span>
                                    <span className="wb-inv">{lang === 'en' ? '(billions of dollars)' : '(milliards de dollars)'}</span>
                                </td>
                                <td className="text-center fw-bold">
                                    {lang === 'en' ? 'Investment' : 'Investissement'}<br/>
                                    <span aria-hidden="true">{lang === 'en' ? '($ billions)' : '(milliards $)'}</span>
                                    <span className="wb-inv">{lang === 'en' ? '(billions of dollars)' : '(milliards de dollars)'}</span>
                                </td>
                            </tr>
                        </thead>
                        <tbody>
                            {pageData.map(yearData => {
                                const yearHeaderId = `year-${yearData.year}`;
                                const jobsLabel = lang === 'en' ? 'Jobs' : 'Emplois';
                                const incomeLabel = lang === 'en' ? 'Employment income' : 'Revenu d\'emploi';
                                const gdpLabel = lang === 'en' ? 'GDP' : 'PIB';
                                const investLabel = lang === 'en' ? 'Investment' : 'Investissement';
                                const jobsUnit = lang === 'en' ? ' thousand jobs' : ' mille emplois';
                                const billionUnit = lang === 'en' ? ' billion dollars' : ' milliards de dollars';
                                
                                return (
                                    <tr key={yearData.year}>
                                        <th scope="row" id={yearHeaderId}>{yearData.year}</th>
                                        
                                        <td headers={yearHeaderId}>
                                            <span className="wb-inv">{yearData.year}, {jobsLabel}: </span>
                                            {formatJobsTable(yearData.jobs)}
                                            <span className="wb-inv">{jobsUnit}</span>
                                        </td>
                                        <td headers={yearHeaderId}>
                                            <span className="wb-inv">{yearData.year}, {incomeLabel}: </span>
                                            {formatNumberTable(yearData.employment_income)}
                                            <span className="wb-inv">{billionUnit}</span>
                                        </td>
                                        <td headers={yearHeaderId}>
                                            <span className="wb-inv">{yearData.year}, {gdpLabel}: </span>
                                            {formatNumberTable(yearData.gdp)}
                                            <span className="wb-inv">{billionUnit}</span>
                                        </td>
                                        <td headers={yearHeaderId}>
                                            <span className="wb-inv">{yearData.year}, {investLabel}: </span>
                                            {formatNumberTable(yearData.investment_value)}
                                            <span className="wb-inv">{billionUnit}</span>
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

    if (!currentYearData || year === null) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>No data available. Please refresh the page.</div>;
    }

    const investmentValue = currentYearData.investment_value;

    const getTitleText = () => {
        return getText('page26_title', lang);
    };

    const getSliderText = () => {
        if (lang === 'en') {
            return `${getText('year_slider_label', lang)} ${year}. Use arrow keys to change year from ${minYear} to ${maxYear}.`;
        } else {
            return `${getText('year_slider_label', lang)} ${year}. Utilisez les touches fléchées pour changer l'année de ${minYear} à ${maxYear}.`;
        }
    };

    const getStatsSummary = () => {
        const jobsText = formatJobsSR(currentYearData.jobs);
        const incomeText = formatBillionsSR(currentYearData.employment_income);
        const gdpText = formatBillionsSR(currentYearData.gdp);
        
        if (lang === 'en') {
            return `Economic contributions in ${year}. Fuel, energy and pipeline infrastructure supported ${jobsText}, generated ${incomeText} in employment income, and ${gdpText} in GDP. These are direct and indirect contributions.`;
        } else {
            return `Contributions économiques en ${year}. Les infrastructures de carburant, d'énergie et de pipelines ont soutenu ${jobsText}, ont généré ${incomeText} en revenus d'emploi, et ${gdpText} en PIB. Ce sont des contributions directes et indirectes.`;
        }
    };

    const getFooterText = () => {
        const investmentText = formatBillionsSR(investmentValue);
        if (lang === 'en') {
            return `Public and private investment in fuel, energy and pipeline infrastructure in ${year} was ${investmentText} nominal.`;
        } else {
            return `L'investissement public et privé dans les infrastructures de carburant, d'énergie et de pipelines en ${year} était de ${investmentText} nominal.`;
        }
    };

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-26" 
            role="main"
            aria-label={getTitleText()}
            style={{
                backgroundColor: 'white',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',
                borderLeft: `18px solid ${COLORS.border}`,
            }}
        >
            <style>{`
                /* =====================================================
                   PAGE 26 - BORDER PAGE STYLES
                   Border extends past container, content aligns with anchors.
                   ===================================================== */

                .wb-inv {
                    clip: rect(1px, 1px, 1px, 1px);
                    height: 1px;
                    margin: 0;
                    overflow: hidden;
                    position: absolute;
                    width: 1px;
                    white-space: nowrap;
                }

                /* Extend left for border, content padded to align with anchors */
                .page-26 {
                    margin-left: -${layoutPadding?.left || 55}px;
                    width: calc(100% + ${layoutPadding?.left || 55}px);
                    padding-left: ${(layoutPadding?.left || 55) - 18}px; /* 18px is border width */
                }
                
                input[type=range] {
                    -webkit-appearance: none;
                    width: 100%;
                    background: transparent;
                }
                input[type=range]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    height: 20px;
                    width: 20px;
                    border-radius: 50%;
                    background: #007bff;
                    cursor: pointer;
                    margin-top: -6px;
                }
                input[type=range]::-webkit-slider-runnable-track {
                    width: 100%;
                    height: 8px;
                    cursor: pointer;
                    background: #007bff;
                    border-radius: 4px;
                }
                input[type=range]:focus {
                    outline: 2px solid #005fcc;
                    outline-offset: 2px;
                }
                input[type=range]:focus::-webkit-slider-thumb {
                    box-shadow: 0 0 0 3px rgba(0,123,255,0.5);
                }

                .page26-container {
                    width: 100%;
                    min-height: calc(100vh - 300px);
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                }
                
                .page26-slider-track {
                    flex: 1;
                }
                
                .page26-content {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    min-height: 450px;
                    width: 100%;
                }
                
                .page26-stats-row {
                    position: relative;
                    z-index: 1;
                    display: flex;
                    flex-direction: row;
                    justify-content: space-between;
                    margin-top: 10px;
                    padding: 0;
                }
                
                .page26-stat-col {
                    flex: none;
                    width: fit-content;
                    background: rgba(255, 255, 255, 0.95);
                    padding: 12px 16px;
                    border-radius: 6px;
                }
                
                .page26-stat-col-1 { margin-left: 0; }
                .page26-stat-col-2 { margin-left: 360px; }
                .page26-stat-col-3 { margin-left: 360px; }
                
                .page26-stat-value {
                    font-size: 36px;
                    font-weight: bold;
                    line-height: 1;
                }
                
                .page26-stat-label {
                    font-size: 20px;
                }

                /* Layout breakpoints only */
                @media (max-width: 1800px) {
                    .page26-container {
                        height: auto;
                    }
                    
                    .page26-stats-row {
                        flex-direction: column;
                        gap: 30px;
                    }
                    
                    .page26-stat-col {
                        margin-left: 0 !important;
                        padding: 12px 16px;
                        background: rgba(255, 255, 255, 0.95);
                        border-radius: 6px;
                        width: fit-content;
                    }
                    
                    .page26-stat-value {
                        font-size: 28px;
                    }
                    
                    .page26-stat-label {
                        font-size: 16px;
                    }
                }

                @media (max-width: 1280px) {
                    .page-26 {
                        border-left: none !important;
                    }
                }            
                
                @media (max-width: 1097px) {
                    .page26-bg-image {
                        background-size: 80% 100% !important;
                        background-position: right !important;
                    }
                }
                
                @media (max-width: 768px) {
                    .page26-year-ticks { display: none !important; }

                    .page26-bg-image {
                        background-size: 70% 100% !important;
                        background-position: right !important;
                    }
                    
                    .page26-slider-region {
                        flex-direction: column !important;
                        align-items: stretch !important;
                    }
                    
                    .page26-slider-label {
                        white-space: normal !important;
                        margin-bottom: 10px;
                        margin-right: 0 !important;
                    }
                }
                
                @media (max-width: 480px) {
                    .page26-bg-image {
                        display: none !important;
                    }
                    
                    .page26-stat-value {
                        font-size: 20px !important;
                    }
                    
                    .page26-stat-label {
                        font-size: 14px !important;
                    }
                    
                    .page26-container h1 {
                        font-size: 1.5rem !important;
                    }
                    
                    .page26-content {
                        display: block !important;
                        min-height: auto !important;
                    }

                    .page26-data-table-wrapper {
                        margin-top: 20px !important;
                    }

                    input[type=range] {
                        height: 44px !important;
                        padding: 10px 0 !important;
                    }
                    
                    input[type=range]::-webkit-slider-thumb {
                        height: 28px !important;
                        width: 28px !important;
                        margin-top: -10px !important;
                    }
                    
                    input[type=range]::-webkit-slider-runnable-track {
                        height: 12px !important;
                    }
                }
                
                @media (max-width: 384px) {
                    input[type=range] {
                        height: 50px !important;
                        padding: 12px 0 !important;
                    }
                    
                    input[type=range]::-webkit-slider-thumb {
                        height: 32px !important;
                        width: 32px !important;
                        margin-top: -12px !important;
                    }
                    
                    input[type=range]::-webkit-slider-runnable-track {
                        height: 14px !important;
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

            <div className="page26-container">
                <header 
                    role="region"
                    aria-label={getTitleText()}
                    style={{ flexShrink: 0, padding: '15px 0px 0 0px'}}
                >
                    <h1 aria-hidden="true" style={{
                        color: COLORS.title,
                        fontSize: '38px',
                        fontWeight: 'bold',
                        fontFamily: 'Arial, sans-serif',
                        marginBottom: '10px',
                        marginTop: '0px'
                    }}>
                        {getText('page26_title', lang)}
                    </h1>

                    <div 
                        className="page26-slider-region"
                        role="region"
                        aria-label={getSliderText()}
                        style={{
                            display: 'flex', 
                            alignItems: 'center', 
                            marginBottom: '10px',
                            padding: '10px 0'
                        }}
                    >
                        <label className="page26-slider-label" aria-hidden="true" style={{ 
                            fontWeight: 'bold', 
                            marginRight: '15px', 
                            fontSize: '18px', 
                            fontFamily: 'Arial, sans-serif',
                            whiteSpace: 'nowrap'
                        }}>
                            {getText('year_slider_label', lang)} {year}
                        </label>
                        <div className="page26-slider-track">
                            <input
                                type="range"
                                min={minYear}
                                max={maxYear}
                                step={1}
                                value={year}
                                onChange={(e) => setYear(parseInt(e.target.value))}
                                aria-valuemin={minYear}
                                aria-valuemax={maxYear}
                                aria-valuenow={year}
                                aria-valuetext={`${year}`}
                            />
                            <div className="page26-year-ticks" aria-hidden="true" style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                fontSize: '10px', 
                                marginTop: '5px',
                                color: '#666',
                                width: '100%'
                            }}>
                                {yearsList.map(y => (
                                    <span key={y} style={{ textAlign: 'center', minWidth: '15px' }}>
                                        {y}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </header>

                <div className="page26-content">
                    <div className="page26-bg-image" aria-hidden="true" style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundImage: `url(${page26BgImage})`,
                        backgroundSize: '100% 100%',
                        backgroundPosition: 'center center',
                        backgroundRepeat: 'no-repeat',
                        zIndex: 0
                    }} />

                    <section 
                        className="page26-stats-row"
                        role="region"
                        aria-label={getStatsSummary()}
                    >
                        <div className="page26-stat-col page26-stat-col-1" aria-hidden="true">
                            <div className="page26-stat-label" style={{ fontWeight: 'bold', color: '#333' }}>{getText('page26_supported', lang)}</div>
                            <div className="page26-stat-value" style={{ color: COLORS.jobs }}>
                                {formatJobs(currentYearData.jobs)}
                            </div>
                            <div className="page26-stat-label" style={{ color: '#666' }}>{getText('page26_jobs', lang)}</div>
                        </div>

                        <div className="page26-stat-col page26-stat-col-2" aria-hidden="true">
                            <div className="page26-stat-label" style={{ fontWeight: 'bold', color: '#333' }}>{getText('page26_generated', lang)}</div>
                            <div className="page26-stat-value" style={{ color: COLORS.income }}>
                                {formatBillions(currentYearData.employment_income)}
                            </div>
                            <div className="page26-stat-label" style={{ color: '#333' }}>{getText('page26_in_employment_income', lang)}</div>
                        </div>

                        <div className="page26-stat-col page26-stat-col-3" aria-hidden="true">
                            <div className="page26-stat-label" style={{ fontWeight: 'bold', color: '#333' }}>{getText('page26_and', lang)}</div>
                            <div className="page26-stat-value" style={{ color: COLORS.gdp }}>
                                {formatBillions(currentYearData.gdp)}
                            </div>
                            <div style={{ fontSize: '30px', fontWeight: 'bold', color: '#666', lineHeight: '1' }}>{getText('page26_in_gdp', lang)}</div>
                            <div style={{ fontSize: '18px', color: '#333', marginTop: '5px' }}>
                                {getText('page26_in_year', lang)} <span style={{fontWeight: 'bold'}}>{year}</span>
                            </div>
                            <div style={{ fontSize: '14px', color: '#666', fontStyle: 'italic', marginTop: '5px' }}>
                                {getText('page26_contributions', lang)}
                            </div>
                        </div>
                    </section>
                </div>

                <div className="page26-data-table-wrapper" style={{ 
                    position: 'relative', 
                    zIndex: 2, 
                    marginTop: '20px',
                    marginBottom: '20px'
                }}>
                    {getAccessibleDataTable()}
                </div>

                <footer 
                    role="region"
                    aria-label={getFooterText()}
                    style={{ 
                        position: 'relative',
                        zIndex: 1,
                        padding: '10px 0px',
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        marginBottom: '0px',
                        marginTop: '0px'
                    }}
                >
                    <p aria-hidden="true" style={{ fontSize: '16px', margin: '0', fontFamily: 'Arial, sans-serif', color: '#555' }}>
                        <span>{getText('page26_footer_part1', lang)}</span>
                        <span style={{ fontWeight: 'bold' }}> {year} </span>
                        <span>{getText('page26_footer_part2', lang)} </span>
                        <span style={{ color: '#544B30', fontWeight: 'bold', fontSize: '20px' }}>
                            {formatBillions(investmentValue)}
                        </span>
                        <span> {getText('page26_footer_part3', lang)}</span>
                    </p>
                </footer>
            </div>
        </main>
    );
};

export default Page26;
