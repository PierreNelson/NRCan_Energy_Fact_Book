
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getCapitalExpendituresData } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const Page24 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [isChartInteractive, setIsChartInteractive] = useState(false);
    
    const [hiddenSeries, setHiddenSeries] = useState([]); 
    
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
        getCapitalExpendituresData()
            .then(data => setPageData(data))
            .catch(err => {
                console.error("Failed to load capital expenditures data:", err);
                setError(err.message || 'Failed to load data');
            })
            .finally(() => setLoading(false));
        import('./Page25');
    }, []);

    const { latestRow, peakRow, row2020 } = useMemo(() => {
        if (pageData.length === 0) return { latestRow: null, peakRow: null, row2020: null };
        const latest = pageData[pageData.length - 1];
        const peak = [...pageData].sort((a, b) => b.total - a.total)[0];
        const r2020 = pageData.find(d => d.year === 2020) || latest;
        return { latestRow: latest, peakRow: peak, row2020: r2020 };
    }, [pageData]);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!latestRow) return <div>No data available.</div>;

    const totalLatestBillion = latestRow.total / 1000;
    const peakTotalBillion = peakRow.total / 1000;
    const low2020Billion = row2020.total / 1000;
    const declineFromPeakPct = ((peakTotalBillion - totalLatestBillion) / peakTotalBillion) * 100;
    const reboundFrom2020Pct = ((totalLatestBillion - low2020Billion) / low2020Billion) * 100;
    const oilGasBillion = latestRow.oil_gas / 1000;
    const electricityBillion = latestRow.electricity / 1000;

    const formatBillion = (val) => {
        const text = getText('billion', lang);
        return lang === 'en' ? `$${val.toFixed(0)} ${text}` : `${val.toFixed(0)} $ ${text}`;
    };

    const formatBillionSR = (val) => {
        const text = getText('billion', lang);
        return `${val.toFixed(1)} ${text} ${lang === 'en' ? 'dollars' : 'dollars'}`;
    };

    const years = pageData.map(d => d.year);
    const minYear = years.length > 0 ? Math.min(...years) : 2007;
    const maxYear = years.length > 0 ? Math.max(...years) : 2024;
    const tickVals = [];
    for (let y = minYear + 1; y <= maxYear + 1; y += 2) {
        tickVals.push(y);
    }
    
    const oilGasValues = pageData.map(d => d.oil_gas / 1000);
    const electricValues = pageData.map(d => d.electricity / 1000);
    const otherValues = pageData.map(d => d.other / 1000);
    const totalValues = pageData.map(d => d.total / 1000);

    const colors = { 'oil_gas': '#48A36C', 'electricity': '#E3540D', 'other': '#857550' };

    const hoverTemplate = (name, vals) => {
        return vals.map((v, i) => {
            const y = years[i];
            const tot = totalValues[i];
            return `${getText(name, lang)}<br>${y}: $${v.toFixed(1)}B<br><b>${getText('page24_hover_total', lang)}: $${tot.toFixed(1)}B</b>`;
        });
    };

    const formatNumberTable = (val) => {
        return val.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    };

    const stripHtml = (text) => text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

    const renderTextWithHiddenAsterisk = (text) => {
        if (!text) return null;
        if (!text.includes('*')) return text;
        const parts = text.split('*');
        return parts.map((part, index) => (
            <React.Fragment key={index}>
                {part}
                {index < parts.length - 1 && <span aria-hidden="true">*</span>}
            </React.Fragment>
        ));
    };

    const getAccessibleDataTable = () => {
        if (!pageData || pageData.length === 0) return null;
        
        const oilGasLabel = stripHtml(getText('page24_legend_oil_gas', lang));
        const electricityLabel = stripHtml(getText('page24_legend_electricity', lang));
        const otherLabel = stripHtml(getText('page24_legend_other', lang));
        const totalLabel = getText('page24_hover_total', lang);
        
        const cellUnitText = lang === 'en' ? ' billion dollars' : ' milliards de dollars';
        const headerUnitVisual = lang === 'en' ? '($ billions)' : '(milliards $)';
        const headerUnitSR = lang === 'en' ? '(billions of dollars)' : '(milliards de dollars)';
        const captionId = 'page24-table-caption';
        
        return (
            <details onToggle={(e) => setIsTableOpen(e.currentTarget.open)} className="page24-table-btn-wrapper" style={{ marginTop: '20px', marginBottom: '10px' }}>
                <summary 
                    role="button" 
                    aria-expanded={isTableOpen}
                    style={{ 
                        cursor: 'pointer', 
                        fontWeight: 'bold', 
                        padding: '10px', 
                        border: '1px solid #ccc', 
                        backgroundColor: '#f9f9f9', 
                        display: 'flex', 
                        alignItems: 'center',
                        listStyle: 'none' 
                    }}
                >
                    <svg 
                        aria-hidden="true" 
                        focusable="false" 
                        width="12" height="12" 
                        viewBox="0 0 12 12" 
                        style={{ marginRight: '8px', transform: isTableOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                    >
                        <path d="M4 2 L10 6 L4 10 Z" fill="#333" />
                    </svg>
                    
                    {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                    
                    <span className="wb-inv">
                        {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                    </span>
                </summary>
                <div className="table-responsive" style={{ width: '100%', marginTop: '10px' }}>
                    <table className="table table-striped table-hover">
                        <caption id={captionId} className="wb-inv">
                            {lang === 'en' 
                                ? 'Capital expenditures in the energy sector (billions of dollars)' 
                                : 'Dépenses en immobilisations dans le secteur de l\'énergie (milliards de dollars)'}
                        </caption>
                        <thead>
                            <tr>
                                <td className="text-center fw-bold">
                                    {lang === 'en' ? 'Year' : 'Année'}
                                </td>
                                <td className="text-center fw-bold">
                                    {oilGasLabel}<br/>
                                    <span aria-hidden="true">{headerUnitVisual}</span>
                                    <span className="wb-inv">{headerUnitSR}</span>
                                </td>
                                <td className="text-center fw-bold">
                                    {electricityLabel}<br/>
                                    <span aria-hidden="true">{headerUnitVisual}</span>
                                    <span className="wb-inv">{headerUnitSR}</span>
                                </td>
                                <td className="text-center fw-bold">
                                    {otherLabel}<br/>
                                    <span aria-hidden="true">{headerUnitVisual}</span>
                                    <span className="wb-inv">{headerUnitSR}</span>
                                </td>
                                <td className="text-center fw-bold">
                                    {totalLabel}<br/>
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
                <th scope="row" id={yearHeaderId}>
                    {yearData.year}
                </th>
                
                <td headers={yearHeaderId}>
                    <span className="wb-inv">{yearData.year}, {oilGasLabel}: </span>
                    {formatNumberTable(yearData.oil_gas / 1000)}
                    <span className="wb-inv">{cellUnitText}</span>
                </td>

                <td headers={yearHeaderId}>
                    <span className="wb-inv">{yearData.year}, {electricityLabel}: </span>
                    {formatNumberTable(yearData.electricity / 1000)}
                    <span className="wb-inv">{cellUnitText}</span>
                </td>

                <td headers={yearHeaderId}>
                    <span className="wb-inv">{yearData.year}, {otherLabel}: </span>
                    {formatNumberTable(yearData.other / 1000)}
                    <span className="wb-inv">{cellUnitText}</span>
                </td>

                <td headers={yearHeaderId}>
                    <span className="wb-inv">{yearData.year}, {getText('page24_hover_total', lang)}: </span>
                    {formatNumberTable(yearData.total / 1000)}
                    <span className="wb-inv">{cellUnitText}</span>
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

    const legendItems = [
        { id: 'oil_gas', label: getText('page24_legend_oil_gas', lang), color: colors.oil_gas },
        { id: 'electricity', label: getText('page24_legend_electricity', lang), color: colors.electricity },
        { id: 'other', label: getText('page24_legend_other', lang), color: colors.other }
    ];

    const handleLegendClick = (id) => {
        setHiddenSeries(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    const handleLegendDoubleClick = (id) => {
        const allIds = legendItems.map(item => item.id);
        const others = allIds.filter(item => item !== id);
        const isIsolated = others.every(o => hiddenSeries.includes(o)) && !hiddenSeries.includes(id);
        setHiddenSeries(isIsolated ? [] : others);
    };

    // Chart margins - in column format (stacked), use 0 margins for full width alignment with anchors
    // In two-column format, use margins for proper spacing
    const isColumnFormat = windowWidth <= 1400;
    const chartMarginLeft = isColumnFormat ? 0 : 50;
    const chartMarginRight = isColumnFormat ? 0 : 15;

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
                boxSizing: 'border-box',
                borderLeft: '18px solid #8e7e52',
            }}
        >
            <style>{`
                /* =====================================================
                   PAGE 24 - BORDER PAGE STYLES
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

                .page24-table-btn-wrapper summary::-webkit-details-marker,
                .page24-table-btn-wrapper summary::marker {
                    display: none;
                }

                /* Extend left for border, content padded to align with anchors */
                .page-24 {
                    margin-left: -${layoutPadding?.left || 55}px;
                    width: calc(100% + ${layoutPadding?.left || 55}px);
                    padding-left: ${(layoutPadding?.left || 55) - 18}px; /* 18px is border width */
                }

                .page24-chart-wrapper {
                    position: relative;
                    width: calc(100% + 50px);
                    margin-left: -5px; /* Pull chart left so y-axis labels align with title */
                }
                
                @media (max-width: 1400px) {
                    .page24-chart-wrapper {
                        width: 100%;
                        margin-left: 0;
                    }
                }

                .page24-chart-wrapper div[role="button"]:focus {
                    outline: none !important;
                    box-shadow: none !important;
                }

                .chart-title-wrapper {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    width: 100%;
                    box-sizing: border-box;
                    margin-bottom: 10px;
                }

                .page24-legend {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 15px;
                    margin-top: 10px;
                    cursor: default;
                    justify-content: center;
                    width: 100%;
                    box-sizing: border-box;
                }

                .page24-table-btn-wrapper {
                    width: 100%;
                }

                .page24-container { width: 100%; display: flex; flex-direction: column; min-height: 100%; }
                .page24-header { padding-top: 20px; padding-bottom: 20px; }

                .page24-content-row { 
                    display: flex; 
                    flex-direction: row; 
                    flex: 1; 
                    width: 100%; 
                    overflow: visible;
                }

                .page24-chart-column { 
                    width: 55%; 
                }

                .page24-text-column {
                    width: 45%;
                    padding-top: 30px;
                    padding-left: 30px; 
                    padding-right: 0;
                    box-sizing: border-box;
                    min-width: 300px; 
                }

                .page24-chart-title {
                    font-family: Arial, sans-serif;
                    font-size: 1.25rem;
                    font-weight: bold;
                    color: #333;
                    line-height: 1.2;
                    max-width: 100%;
                }

                .page24-legend-item {
                    display: flex;
                    align-items: center;
                    font-family: Arial, sans-serif;
                    font-size: 0.9rem;
                    color: #333;
                    cursor: pointer;
                    user-select: none;
                }
                .page24-legend-color { width: 15px; height: 15px; margin-right: 8px; display: inline-block; }

                .js-plotly-plot .plotly .modebar {
                    right: 20px !important;
                    top: 2px !important;
                }

                .page24-chart-wrapper button:focus,
                .js-plotly-plot .plotly .modebar-btn:focus {
                    outline: none !important;
                    box-shadow: none !important;
                }

                .page24-chart { width: 100%; height: 300px; }

                /* Layout breakpoints only */
                @media (max-width: 1400px) {
                    .page24-content-row { flex-direction: column; }
                    .page24-chart-column { width: 100%; margin-bottom: 30px; }
                    .page24-text-column { width: 100%; padding-top: 0; padding-left: 0; }
                }

                @media (max-width: 640px) {
                    .page-24 { 
                        border-left: none !important; 
                        margin-left: 0;
                        width: 100%;
                        padding-left: 0;
                    }
                    .page24-legend {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                    }
                }

                @media (max-width: 480px) {
                    .page24-chart { height: 275px; }
                }
            `}</style>

            <div className="page24-container">
                <header className="page24-header">
                    <h1 style={{ fontFamily: 'Georgia, serif', color: '#8e7e52', fontSize: '3rem', fontWeight: 'normal', margin: 0, lineHeight: 1.1 }}>
                        {renderTextWithHiddenAsterisk(getText('page24_title', lang))}
                    </h1>
                </header>

                <div className={`page24-content-row`}>
                    <div className="page24-chart-column">
                        
                        <div className="chart-title-wrapper">
                            <h2 className="page24-chart-title">
                                {renderTextWithHiddenAsterisk(getText('page24_chart_title', lang))}
                            </h2>
                        </div>

                        <figure ref={chartRef} aria-hidden="true" className="page24-chart-wrapper">
                            {!isChartInteractive && (
                                <div 
                                    onClick={() => setIsChartInteractive(true)} 
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            setIsChartInteractive(true);
                                        }
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
                                data={[
                                    { 
                                        name: getText('page24_legend_oil_gas', lang), 
                                        x: years, y: oilGasValues, type: 'bar', 
                                        marker: { color: colors.oil_gas }, 
                                        hovertext: hoverTemplate('page24_hover_oil_gas', oilGasValues), hoverinfo: 'text',
                                        visible: hiddenSeries.includes('oil_gas') ? 'legendonly' : true 
                                    },
                                    { 
                                        name: getText('page24_legend_electricity', lang), 
                                        x: years, y: electricValues, type: 'bar', 
                                        marker: { color: colors.electricity }, 
                                        hovertext: hoverTemplate('page24_hover_electricity', electricValues), hoverinfo: 'text',
                                        visible: hiddenSeries.includes('electricity') ? 'legendonly' : true 
                                    },
                                    { 
                                        name: getText('page24_legend_other', lang), 
                                        x: years, y: otherValues, type: 'bar', 
                                        marker: { color: colors.other }, 
                                        hovertext: hoverTemplate('page24_hover_other', otherValues), hoverinfo: 'text',
                                        visible: hiddenSeries.includes('other') ? 'legendonly' : true 
                                    }
                                ]}
                                layout={{ 
                                    barmode: 'stack', 
                                    hoverlabel: { bgcolor: '#ffffff' }, 
                                    showlegend: false, 
                                    xaxis: { 
                                        tickvals: tickVals, 
                                        automargin: true,
                                        tickangle: windowWidth <= 400 ? +90 : 'auto'
                                    }, 
                                    yaxis: { 
                                        title: { text: getText('page24_yaxis', lang) }, 
                                        automargin: true,
                                    }, 
                                    margin: { l: chartMarginLeft, r: chartMarginRight, t: 30, b: 10 }, 
                                    autosize: true, 
                                    bargap: 0.2,
                                    paper_bgcolor: 'rgba(0,0,0,0)',
                                    plot_bgcolor: 'rgba(0,0,0,0)'
                                }}
                                className="page24-chart" 
                                useResizeHandler={true} 
                                config={{ displayModeBar: isChartInteractive, responsive: true }}
                            />
                        </figure>

                        <div className="page24-legend" aria-hidden="true">
                            {legendItems.map((item) => {
                                const isHidden = hiddenSeries.includes(item.id);
                                return (
                                    <div 
                                        key={item.id} 
                                        className="page24-legend-item"
                                        onClick={() => handleLegendClick(item.id)}
                                        onDoubleClick={() => handleLegendDoubleClick(item.id)}
                                        style={{ opacity: isHidden ? 0.5 : 1 }}
                                        title={lang === 'en' ? 'Click to toggle, double-click to isolate' : 'Cliquez pour basculer, double-cliquez pour isoler'}
                                    >
                                        <span className="page24-legend-color" style={{ backgroundColor: item.color }}></span>
                                        <span style={{ textDecoration: isHidden ? 'line-through' : 'none' }}>{item.label}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {getAccessibleDataTable()}
                    </div>

                    <aside className="page24-text-column align-right-edge">
                        <ul style={{ listStyleType: 'disc', paddingLeft: '20px', margin: '0', color: '#333' }}>
                            <li 
                                className="page24-bullet" 
                                style={{ marginBottom: '20px', lineHeight: '1.25', fontSize: '1.5rem', marginTop: '20px' }}
                                aria-label={lang === 'en' 
                                    ? `Capital expenditures in Canada's energy sector totaled ${formatBillionSR(totalLatestBillion)} in ${latestRow.year}, a decrease of ${declineFromPeakPct.toFixed(0)} percent from a peak in ${peakRow.year}.`
                                    : `Les dépenses en immobilisations dans le secteur canadien de l'énergie ont totalisé ${formatBillionSR(totalLatestBillion)} en ${latestRow.year}, une baisse de ${declineFromPeakPct.toFixed(0)} pour cent par rapport au sommet de ${peakRow.year}.`
                                }
                            >
                                <span aria-hidden="true">
                                    {getText('page24_bullet1_part1', lang)}<strong>{formatBillion(totalLatestBillion)}</strong>{getText('page24_bullet1_part2', lang)}{latestRow.year}{getText('page24_bullet1_part3', lang)}{declineFromPeakPct.toFixed(0)}{getText('page24_bullet1_part4', lang)}{peakRow.year}{getText('page24_bullet1_part5', lang)}
                                </span>
                            </li>

                            <li 
                                className="page24-bullet" 
                                style={{ marginBottom: '20px', lineHeight: '1.25', fontSize: '1.5rem' }}
                                aria-label={lang === 'en'
                                    ? `After reaching an eleven year low of ${formatBillionSR(low2020Billion)} in 2020, investment has rebounded by ${reboundFrom2020Pct.toFixed(0)} percent.`
                                    : `Après avoir atteint un creux de onze ans de ${formatBillionSR(low2020Billion)} en 2020, l'investissement a rebondi de ${reboundFrom2020Pct.toFixed(0)} pour cent.`
                                }
                            >
                                <span aria-hidden="true">
                                    {getText('page24_bullet2_part1', lang)}<strong>{formatBillion(low2020Billion)}</strong>{getText('page24_bullet2_part2', lang)}<strong>{reboundFrom2020Pct.toFixed(0)}</strong>{getText('page24_bullet2_part3', lang)}
                                </span>
                            </li>

                            <li 
                                className="page24-bullet" 
                                style={{ marginBottom: '2px', lineHeight: '1.25', fontSize: '1.5rem' }}
                                aria-label={lang === 'en'
                                    ? `Oil and gas extraction was the largest area of energy sector capital expenditure at ${formatBillionSR(oilGasBillion)} in ${latestRow.year}, followed by electrical power generation and distribution at ${formatBillionSR(electricityBillion)}.`
                                    : `L'extraction de pétrole et de gaz était le plus grand domaine de dépenses en immobilisations du secteur de l'énergie avec ${formatBillionSR(oilGasBillion)} en ${latestRow.year}, suivie de la production et distribution d'électricité avec ${formatBillionSR(electricityBillion)}.`
                                }
                            >
                                <span aria-hidden="true">
                                    {getText('page24_bullet3_part1', lang)}<strong>{formatBillion(oilGasBillion)}</strong>{getText('page24_bullet3_part2', lang)}{latestRow.year}{getText('page24_bullet3_part3', lang)}{formatBillion(electricityBillion)}{getText('page24_bullet3_part4', lang)}
                                </span>
                            </li>
                        </ul>
                    </aside>
                </div>

                <aside className="wb-fnote" role="note" style={{ marginTop: 'auto', paddingTop: '10px', paddingBottom: '15px' }}>
                    <h2 id="fn-page24" className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl style={{ margin: 0 }}>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnote 1' : 'Note de bas de page 1'}</dt>
                        <dd id="fn1-page24" style={{ margin: 0 }}>
                            <p className="page24-footnote" style={{
                                fontSize: '1rem',
                                color: '#000000',
                                marginBottom: '0',
                                lineHeight: '1.15',
                                whiteSpace: 'pre-line'
                            }}>
                                {renderTextWithHiddenAsterisk(getText('page24_footnote', lang))}
                            </p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page24;
