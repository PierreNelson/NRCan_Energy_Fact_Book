import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getInfrastructureData } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const Page25 = () => {
    const { lang } = useOutletContext();
    const [year, setYear] = useState(null); // Will be set to maxYear once data loads
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

    const minYear = useMemo(() => pageData.length > 0 ? pageData[0].year : 2007, [pageData]);
    const maxYear = useMemo(() => pageData.length > 0 ? pageData[pageData.length - 1].year : 2024, [pageData]);
    
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
        getInfrastructureData().then(data => {
            setPageData(data);
            if (data.length > 0) {
                setYear(data[data.length - 1].year);
            }
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

    // Generate labels for pie chart slices
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

    // Center annotation only (for TOTAL) - responsive font size
    const annotations = useMemo(() => {
        if (!chartData || !chartData.pctDict) return [];
        const totalBillions = (chartData.total || 0) / 1000;
        
        const centerText = lang === 'en'
            ? `<b>TOTAL</b><br><b>$${totalBillions.toFixed(0)}</b><br><b>BILLION</b>`
            : `<b>TOTAL</b><br><b>${totalBillions.toFixed(0)} $</b><br><b>MILLIARDS</b>`;

        // Responsive font size to prevent overlap at all zoom levels
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
            text: centerText, x: 0.5, y: 0.5,
            font: { size: 22, color: '#424243', family: 'Arial Black, sans-serif' },
            showarrow: false,
        }];
    }, [chartData, lang, windowWidth]);


    if (loading || !currentYearData) return <div>Loading...</div>;

    // Build the full subtitle text for screen readers
    // Format numbers so screen readers read them naturally
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

    // Build complete chart data as one paragraph for screen readers
    // Format numbers so screen readers read them naturally
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

    // Build right side content as one block for screen readers
    const getRightSideText = () => {
        const title = getText('infra_definition_title', lang).replace(/\n/g, ' ');
        const quote = getText('infra_definition_text', lang).replace(/\n/g, ' ');
        const description = getText('infra_description', lang).replace(/\n/g, ' ');
        return `${title} "${quote}" ${description}`;
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
                borderRight: '18px solid #8e7e52', 
                boxSizing: 'border-box',
                marginLeft: '40px',
                width: 'calc(100% - 40px)',
            }}
        >
            <style>{`
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

                /* Dynamic Layout Classes for 200% Zoom Compliance */
                .page25-container {
                    width: calc(100% - 40px);
                    padding: 3px 8px;
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
                
                .page25-chart-column {
                    width: 55%;
                    height: calc(100vh - 480px);
                    min-height: 350px;
                    padding-left: 80px;
                    position: relative;
                }
                
                .page25-text-column {
                    width: 42%;
                    padding-left: 25px;
                    padding-right: 20px;
                    padding-top: 0;
                }
                
                .page25-slider-track {
                    flex: 1;
                }
                
                .page25-definition-box {
                    position: relative;
                    background-color: #aa9c7a;
                    padding: 20px 50px;
                    border-radius: 3px;
                    width: 100%;
                    margin-left: 0;
                    margin-top: 50px;
                }

                /* MEDIA QUERY: When zoomed in (125%+), switch to stacked layout */
                @media (max-width: 1800px) {
                    .page25-content-row {
                        flex-direction: column;
                        height: auto;
                        align-items: center;
                    }

                    h1 {
                margin-top: 40px !important; 
                padding-top: 20px !important;
                }
                    
                    .page25-chart-column {
                        width: 100%;
                        height: 500px;
                        padding-left: 0;
                        margin-top: 0;
                        margin-bottom: 20px;
                    }
                    
                    .page25-text-column {
                        width: 100%;
                        padding-left: 0;
                        padding-right: 0;
                        margin-bottom: 40px;
                    }
                    
                    .page25-definition-box {
                        width: 90% !important;
                        margin-left: auto !important;
                        margin-right: auto !important;
                    }
                }
                
                /* MEDIA QUERY: At 200%+ zoom, hide year ticks on slider */
                @media (max-width: 960px) {
                    .page25-year-ticks {
                        display: none !important;
                    }
                }
                

                /* REFLOW: At 250%+ zoom 
                @media (max-width: 768px) {
                    .page-25 {
                        margin-left: 0 !important;
                        width: 100% !important;
                        border-right: none !important;
                    }
                    
                    .page25-container {
                        width: 100% !important;
                        padding: 5px !important;
                    }
                    
                    .page25-container h1 {
                        font-size: 1.8rem !important;
                    }
                    
                    .page25-container p {
                        font-size: 1rem !important;
                    }
                    
                    .page25-year-ticks {
                        display: none !important;
                    }
                    
                    .page25-slider-region {
                        flex-direction: column !important;
                        align-items: stretch !important;
                    }
                    
                    .page25-slider-label {
                        white-space: normal !important;
                        margin-bottom: 10px;
                        margin-right: 0 !important;
                    }
                    
                    .page25-chart-column {
                        height: 450px !important;
                    }
                    
                    .page25-definition-box .decorative-quote {
                        display: none !important;
                    }
                }
                
                /* REFLOW: At 400% zoom (320px width) */
                @media (max-width: 480px) {
                    .page25-chart-column {
                        height: 400px !important;
                    }
                    
                    .page25-definition-box {
                        padding: 15px 20px !important;
                    }
                    
                    .page25-container h1 {
                        font-size: 1.5rem !important;
                    }
                }
            `}</style>

            {/* Container */}
            <div className="page25-container">
                {/* REGION 1: Title and Subtitle - read as one block */}
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

                {/* REGION 2: Year Slider - Reduced margins to fit content at 100% zoom */}
                <div 
                    className="page25-slider-region"
                    role="region" 
                    aria-label={`${getText('year_slider_label', lang)} ${year}. ${lang === 'en' ? 'Use arrow keys to change year from' : 'Utilisez les touches fléchées pour changer l\'année de'} ${minYear} ${lang === 'en' ? 'to' : 'à'} ${maxYear}.`}
                    style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', marginTop: '5px', padding: '2px 5px' }}
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

                {/* Live region for year changes */}
                <div 
                    aria-live="polite" 
                    aria-atomic="true" 
                    style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}
                >
                    {chartData && `${year}`}
                </div>

                {/* Content Row - switches from row to column when zoomed */}
                <div className="page25-content-row">
                    {/* REGION 3: Chart with all data read as one block */}
                    <div 
                        className="page25-chart-column"
                        role="region"
                        aria-label={`${lang === 'en' ? 'Infrastructure pie chart for' : 'Graphique circulaire des infrastructures pour'} ${year}. ${getChartDataSummary()}`}
                    >
                        {chartData && (
                            <figure aria-hidden="true" style={{ width: '100%', height: '100%', margin: 0 }}>
                                <Plot
                                    data={[{
                                        values: chartData.values,
                                        labels: pieLabels,
                                        // Responsive hole size - larger at narrower viewports to fit center text
                                        hole: windowWidth <= 768 ? 0.75 : windowWidth <= 1400 ? 0.73 : 0.70,
                                        type: 'pie',
                                        marker: { colors: chartData.colors, line: { color: 'black', width: 3 } },
                                        // Responsive labels: use legend at narrow widths, outside labels at wider widths
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
                                        // Show legend at narrow widths since labels are inside/abbreviated
                                        showlegend: windowWidth <= 768,
                                        legend: windowWidth <= 768 ? {
                                            orientation: 'v',
                                            y: 0.5,
                                            x: 1.05,
                                            xanchor: 'left',
                                            yanchor: 'middle',
                                            font: { size: windowWidth <= 480 ? 9 : 10 },
                                            itemclick: false,
                                            itemdoubleclick: false
                                        } : undefined,
                                        margin: windowWidth <= 768 
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
                    </div>

                    {/* REGION 4: Definition and description - read as one block */}
                    <aside 
                        className="page25-text-column"
                        role="region"
                        aria-label={getRightSideText()}
                    >
                        {/* Definition box uses absolute positioning for quotes to prevent overlap */}
                        <div className="page25-definition-box" aria-hidden="true">
                            <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', textAlign: 'center', color: '#333', margin: '0 0 15px 0', lineHeight: '1.4', whiteSpace: 'pre-line' }}>
                                {getText('infra_definition_title', lang)}
                            </h2>
                            <div style={{ textAlign: 'center' }}>
                                {/* Top Quote - hidden at narrow viewports */}
                                <span className="decorative-quote" aria-hidden="true" style={{ 
                                    position: 'absolute',
                                    top: '-5px',
                                    left: '10px',
                                    fontSize: '6rem', 
                                    color: '#292419', 
                                    fontFamily: 'Georgia, serif', 
                                    lineHeight: '1',
                                    pointerEvents: 'none'
                                }}>❝</span>
                                
                                <p style={{ fontSize: '1.05rem', color: '#333', lineHeight: '1.6', whiteSpace: 'pre-line', textAlign: 'center', margin: 0, padding: '0 10px' }}>
                                    {getText('infra_definition_text', lang)}
                                </p>
                                
                                {/* Bottom Quote - hidden at narrow viewports */}
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
