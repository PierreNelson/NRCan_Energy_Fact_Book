import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getEconomicContributionsData } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const Page26 = () => {
    const { lang } = useOutletContext();
    const [year, setYear] = useState(null); // Will be set to maxYear once data loads
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);

    // Load data on mount
    useEffect(() => {
        getEconomicContributionsData().then(data => {
            setPageData(data);
            // Set initial year to the latest year in the data
            if (data.length > 0) {
                setYear(data[data.length - 1].year);
            }
            setLoading(false);
        });
    }, []);

    const minYear = pageData.length > 0 ? pageData[0].year : 2007;
    const maxYear = pageData.length > 0 ? pageData[pageData.length - 1].year : 2024;
    
    // Create an array of years for the slider labels (e.g., 2007, 2008... 2024)
    const yearsList = Array.from(
        { length: maxYear - minYear + 1 }, 
        (_, i) => minYear + i
    );

    // Colors
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

    // Visual formatting (with $ symbol)
    const formatJobs = (val) => `${(val / 1000).toFixed(1)} k`;

    const formatBillions = (val) => {
        const b = val / 1000;
        const text = getText('billion', lang);
        return lang === 'en' ? `$${b.toFixed(1)} ${text}` : `${b.toFixed(1)} $ ${text}`;
    };

    // Screen reader formatting (no $ symbol for natural reading)
    const formatJobsSR = (val) => {
        const k = (val / 1000).toFixed(1);
        return lang === 'en' ? `${k} thousand jobs` : `${k} mille emplois`;
    };

    const formatBillionsSR = (val) => {
        const b = (val / 1000).toFixed(1);
        const text = getText('billion', lang);
        return `${b} ${text} ${lang === 'en' ? 'dollars' : 'dollars'}`;
    };

    if (loading || !currentYearData || year === null) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
    }

    // Investment value comes from the pre-calculated data
    const investmentValue = currentYearData.investment_value;

    // ===== ACCESSIBILITY: Build screen reader text blocks =====
    
    // Title for screen readers
    const getTitleText = () => {
        return getText('page26_title', lang);
    };

    // Slider region text
    const getSliderText = () => {
        if (lang === 'en') {
            return `${getText('year_slider_label', lang)} ${year}. Use arrow keys to change year from ${minYear} to ${maxYear}.`;
        } else {
            return `${getText('year_slider_label', lang)} ${year}. Utilisez les touches fléchées pour changer l'année de ${minYear} à ${maxYear}.`;
        }
    };

    // Statistics summary for screen readers
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

    // Footer text for screen readers
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
            {/* Dynamic Layout CSS with Media Queries for 200% Zoom Compliance */}
            <style>{`
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

                /* Dynamic Layout Classes */
                .page26-container {
                    width: calc(100% - 40px);
                    min-height: calc(100vh - 300px);
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                }
                
                .page26-slider-track {
                    flex: 1;
                }
                
                .page26-content {
                    position: relative;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    min-height: 0;
                    width: 100%;
                }
                
                .page26-stats-row {
                    position: relative;
                    z-index: 1;
                    display: flex;
                    flex-direction: row;
                    justify-content: space-between;
                    margin-top: 10px;
                    padding: 0 25px;
                }
                
                .page26-stat-col {
                    flex: none;
                    width: fit-content;
                    background: rgba(255, 255, 255, 0.95);
                    padding: 12px 16px;
                    border-radius: 6px;
                }
                
                .page26-stat-col-1 { margin-left: 100px; }
                .page26-stat-col-2 { margin-left: 350px; }
                .page26-stat-col-3 { margin-left: 450px; }
                
                .page26-stat-value {
                    font-size: 36px;
                    font-weight: bold;
                    line-height: 1;
                }
                
                .page26-stat-label {
                    font-size: 20px;
                }

                /* MEDIA QUERY: When zoomed in (110%+), switch to stacked layout */
                @media (max-width: 1800px) {
                    .page26-container {
                        height: auto;
                        min-height: 100vh;
                    }
                    h1 {
                        margin-top: 20px !important; 
                        padding-top: 20px !important;
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
                
                /* REFLOW: At 175%+ zoom - shift background image to the right */
                @media (max-width: 1097px) {
                    .page26-bg-image {
                        background-size: 80% 100% !important;
                        background-position: right !important;
                    }
                }
                
                /* REFLOW: At 250%+ zoom - hide year ticks, stack slider, shift background image to the right */
                @media (max-width: 768px) {
                    .page26-year-ticks {
                        display: none !important;
                    }

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
                
                /* REFLOW: At 400% zoom -hide background image*/
                @media (max-width: 480px) {
                    .page-26 {
                        border-left: none !important;
                    }

                    .page26-bg-image {
                        display: none !important;
                    }
                    
                    .page26-container {
                        width: 100%;
                        padding: 5px;
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
                }

            `}</style>

            {/* Container */}
            <div className="page26-container">
                {/* REGION 1: Title */}
                <header 
                    role="region"
                    aria-label={getTitleText()}
                    style={{ flexShrink: 0, padding: '15px 25px 0 25px' }}
                >
                    <h1 aria-hidden="true" style={{
                        color: COLORS.title,
                        fontSize: '38px',
                        fontWeight: 'bold',
                        fontFamily: 'Arial, sans-serif',
                        marginBottom: '10px',
                        marginTop: '0px',
                        textTransform: 'uppercase'
                    }}>
                        {getText('page26_title', lang)}
                    </h1>

                    {/* REGION 2: Year Slider */}
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
                            {/* Year tick labels - decorative, hidden at 400% zoom for reflow compliance */}
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

                {/* Main Content Area */}
                <div className="page26-content">
                    {/* Background Image - decorative */}
                    <div className="page26-bg-image" aria-hidden="true" style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundImage: 'url(/assets/page26image.png)',
                        backgroundSize: '100% 100%',
                        backgroundPosition: 'center center',
                        backgroundRepeat: 'no-repeat',
                        zIndex: 0
                    }} />

                    {/* REGION 3: Statistics - all data read as one block */}
                    <section 
                        className="page26-stats-row"
                        role="region"
                        aria-label={getStatsSummary()}
                    >
                        {/* Column 1: Jobs */}
                        <div className="page26-stat-col page26-stat-col-1" aria-hidden="true">
                            <div className="page26-stat-label" style={{ fontWeight: 'bold', color: '#333' }}>{getText('page26_supported', lang)}</div>
                            <div className="page26-stat-value" style={{ color: COLORS.jobs }}>
                                {formatJobs(currentYearData.jobs)}
                            </div>
                            <div className="page26-stat-label" style={{ color: '#666' }}>{getText('page26_jobs', lang)}</div>
                        </div>

                        {/* Column 2: Income */}
                        <div className="page26-stat-col page26-stat-col-2" aria-hidden="true">
                            <div className="page26-stat-label" style={{ fontWeight: 'bold', color: '#333' }}>{getText('page26_generated', lang)}</div>
                            <div className="page26-stat-value" style={{ color: COLORS.income }}>
                                {formatBillions(currentYearData.employment_income)}
                            </div>
                            <div className="page26-stat-label" style={{ color: '#333' }}>{getText('page26_in_employment_income', lang)}</div>
                        </div>

                        {/* Column 3: GDP */}
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

                    {/* Spacer to push footer to bottom */}
                    <div style={{ flex: 1 }} />

                    {/* REGION 4: Footer */}
                    <footer 
                        role="region"
                        aria-label={getFooterText()}
                        style={{ 
                            position: 'relative',
                            zIndex: 1,
                            padding: '10px 25px',
                            backgroundColor: 'rgba(255,255,255,0.9)',
                            marginBottom: '0px'
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
            </div>
        </main>
    );
};

export default Page26;