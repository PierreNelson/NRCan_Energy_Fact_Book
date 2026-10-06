
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import FootnoteMarker from '../components/FootnoteMarker';
import ClearSelectionButton from '../components/ClearSelectionButton';
import PageFootnotes from '../components/PageFootnotes';
import usePlotlySelection from '../hooks/usePlotlySelection';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import PageStatus from '../components/PageStatus';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getCapitalExpendituresData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import HtmlLegend from '../components/HtmlLegend';

import { makeScrollToIdHandler } from '../utils/scrollToId';

const COLORS = { oil_gas: '#48A36C', electricity: '#E3540D', other: '#857550' };

const toBillions = (row, key) => row[`${key}_billions`] ?? (row[key] / 1000);

const CapitalExpenditures = () => {
    const { lang } = useOutletContext();
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [isChartInteractive, setIsChartInteractive] = useState(typeof window !== 'undefined' ? window.innerWidth > 768 : true);

    const [hiddenSeries] = useState([]);
    const {
        selected: selectedPoints,
        clear: clearSelection,
        onPlotClick: handleChartClick,
    } = usePlotlySelection({ mode: 'points', traceCount: 3, windowWidth });

    const scrollToFootnote = makeScrollToIdHandler('fn-asterisk-capital-expenditure');

    const scrollToRef = makeScrollToIdHandler('fn-asterisk-rf-capital-expenditure');

    const chartRef = useRef(null);
    const tableWrapperRef = useRef(null);

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
        const handleResize = () => {
            const newWidth = window.innerWidth;
            setWindowWidth(newWidth);
            if (newWidth > 768) {
                setIsChartInteractive(true);
            }
        };
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
    }, []);

    useEffect(() => {
        const root = tableWrapperRef.current;
        if (!root) return undefined;
        const details = root.querySelector('details');
        if (!details) return undefined;
        const onToggle = () => setIsTableOpen(details.open);
        details.addEventListener('toggle', onToggle);
        setIsTableOpen(details.open);
        return () => details.removeEventListener('toggle', onToggle);
    }, [pageData, loading]);

    

    const { latestRow, peakRow, row2020 } = useMemo(() => {
        if (pageData.length === 0) return { latestRow: null, peakRow: null, row2020: null };
        const latest = pageData[pageData.length - 1];
        const peak = [...pageData].sort((a, b) => b.total - a.total)[0];
        const r2020 = pageData.find(d => d.year === 2020) || latest;
        return { latestRow: latest, peakRow: peak, row2020: r2020 };
    }, [pageData]);

    const oilGasLabel = stripHtml(getText('capital_expenditures_legend_oil_gas', lang));
    const electricityLabel = stripHtml(getText('capital_expenditures_legend_electricity', lang));
    const otherLabel = stripHtml(getText('capital_expenditures_legend_other', lang));
    const totalLabel = getText('capital_expenditures_hover_total', lang);
    const unitHeader = lang === 'en' ? '($ billions)' : '(milliards $)';

    const tableColumns = useMemo(() => [
        { key: 'year', header: lang === 'en' ? 'Year' : 'Année', align: 'left' },
        { key: 'oil_gas', header: `${oilGasLabel} ${unitHeader}`, align: 'num' },
        { key: 'electricity', header: `${electricityLabel} ${unitHeader}`, align: 'num' },
        { key: 'other', header: `${otherLabel} ${unitHeader}`, align: 'num' },
        { key: 'total', header: `${totalLabel} ${unitHeader}`, align: 'num' },
    ], [lang, oilGasLabel, electricityLabel, otherLabel, totalLabel, unitHeader]);

    const tableRows = useMemo(() => pageData.map((row) => ({
        year: row.year,
        oil_gas: toBillions(row, 'oil_gas'),
        electricity: toBillions(row, 'electricity'),
        other: toBillions(row, 'other'),
        total: toBillions(row, 'total'),
    })), [pageData]);

    const tableCaption = lang === 'en'
        ? 'Capital expenditures in the energy sector (billions of dollars)'
        : "Dépenses en immobilisations dans le secteur de l'énergie (milliards de dollars)";
    const csvFilename = lang === 'en' ? 'capital_expenditures_energy_data.csv' : 'depenses_en_capital_energie_donnees.csv';
    const docxFilename = lang === 'en' ? 'capital_expenditures_energy_table.docx' : 'depenses_en_capital_energie_tableau.docx';
    const chartPngFilename = lang === 'en' ? 'capital_expenditures_energy_chart.png' : 'depenses_en_capital_energie_graphique.png';

    const years = pageData.map(d => d.year);
    const minYear = years.length > 0 ? Math.min(...years) : 2007;
    const maxYear = years.length > 0 ? Math.max(...years) : 2024;
    const chartTitle = `${getText('capital_expenditures_chart_title_prefix', lang)}${minYear} ${lang === 'en' ? 'to' : 'à'} ${maxYear}`;
    const exportChartTitle = stripHtml(chartTitle);

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
            filename: chartPngFilename,
            title: exportChartTitle,
            height: 600,
            legendItems: [
                { label: oilGasLabel, color: COLORS.oil_gas },
                { label: electricityLabel, color: COLORS.electricity },
                { label: otherLabel, color: COLORS.other },
            ],
        }),
        [COLORS, chartPngFilename, electricityLabel, exportChartTitle, oilGasLabel, otherLabel],
    );

    if (loading || error) return <PageStatus lang={lang} loading={loading} error={error} />;
    if (!latestRow) return <div>No data available.</div>;

    const totalLatestBillion = toBillions(latestRow, 'total');
    const peakTotalBillion = toBillions(peakRow, 'total');
    const low2020Billion = toBillions(row2020, 'total');
    const declineFromPeakPct = ((peakTotalBillion - totalLatestBillion) / peakTotalBillion) * 100;
    const reboundFrom2020Pct = ((totalLatestBillion - low2020Billion) / low2020Billion) * 100;
    const oilGasBillion = toBillions(latestRow, 'oil_gas');
    const electricityBillion = toBillions(latestRow, 'electricity');

    const formatBillion = (val) => {
        const text = getText('billion', lang);
        return lang === 'en' ? `$${val.toFixed(0)} ${text}` : `${val.toFixed(0)} $ ${text}`;
    };

    const formatBillionSR = (val) => {
        const text = getText('billion', lang);
        return `${val.toFixed(1)} ${text} ${lang === 'en' ? 'dollars' : 'dollars'}`;
    };

    const tickVals = [];
    for (let y = minYear + 1; y <= maxYear + 1; y += 2) {
        tickVals.push(y);
    }

    const oilGasValues = pageData.map(d => toBillions(d, 'oil_gas'));
    const electricValues = pageData.map(d => toBillions(d, 'electricity'));
    const otherValues = pageData.map(d => toBillions(d, 'other'));
    const totalValues = pageData.map(d => toBillions(d, 'total'));

    const hoverTemplate = (name, vals) => {
        return vals.map((v, i) => {
            const y = years[i];
            const tot = totalValues[i];
            return `<b>${getText(name, lang)}</b><br>${y}: $${v.toFixed(1)}B<br>${getText('capital_expenditures_hover_total', lang)}: $${tot.toFixed(1)}B`;
        });
    };

    const formatNumberTable = (val) => {
        if (val == null || Number.isNaN(Number(val))) return '—';
        return Number(val).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    };

    const stripForSR = (text) => stripHtml(text).replace(/\*/g, '').replace(/\s+/g, ' ').trim();

    const renderTextWithFootnoteLink = (text, showFootnote = true) => {
        if (!text) return null;
        if (!text.includes('*')) return text;
        const parts = text.split('*');
        return parts.map((part, index) => (
            <React.Fragment key={index}>
                {part}
                {index < parts.length - 1 && showFootnote && (
                    <sup id="fn-asterisk-rf-capital-expenditure" aria-hidden="true">
                        <a className="fn-lnk" href="#fn-asterisk-capital-expenditure" onClick={scrollToFootnote} tabIndex="-1">*</a>
                    </sup>
                )}
            </React.Fragment>
        ));
    };

    const formatChartValue = (val) => {
        if (val == null || Number.isNaN(Number(val))) return '—';
        return Number(val).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
        });
    };

    const getChartSummary = () => {
        if (!pageData.length || !years.length) return '';
        const body = summarizeByCategory({
            categories: years,
            series: [
                { name: oilGasLabel, values: oilGasValues, format: formatChartValue },
                { name: electricityLabel, values: electricValues, format: formatChartValue },
                { name: otherLabel, values: otherValues, format: formatChartValue },
            ],
            lang,
            newestFirst: true,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Stacked bar chart of capital expenditures in Canada's energy industry from ${minYear} to ${maxYear}`
                : `Graphique à barres empilées des dépenses en immobilisations dans l'industrie de l'énergie de ${minYear} à ${maxYear}`,
            unitNote: lang === 'en' ? 'Values in billions of dollars' : 'Valeurs en milliards de dollars',
            body,
        });
    };

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const legendItems = [
        { id: 'oil_gas', label: getText('capital_expenditures_legend_oil_gas', lang), color: COLORS.oil_gas },
        { id: 'electricity', label: getText('capital_expenditures_legend_electricity', lang), color: COLORS.electricity },
        { id: 'other', label: getText('capital_expenditures_legend_other', lang), color: COLORS.other },
    ];
    const chartMarginLeft = 50;
    const chartMarginRight = 40;

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-24" 
            role="main"
            aria-label={getText('capital_expenditures_title', lang)}
            style={{
                backgroundColor: 'white',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',
                boxSizing: 'border-box',
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

                .capital-expenditure-table-btn-wrapper summary::-webkit-details-marker,
                .capital-expenditure-table-btn-wrapper summary::marker {
                    display: none;
                }

                .page-24 {
                    width: 100%;
                    max-width: 100%;
                    overflow-x: hidden;
                    box-sizing: border-box;
                }

                .capital-expenditure-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 50px;
                    font-weight: bold;
                    margin-top: 0;
                    margin-bottom: 25px;
                    color: #8a7d5a;
                    margin: 0 0 20px 0;
                    line-height: 1.2;
                    position: relative;
                    padding-bottom: 0.5em;
                }

                .capital-expenditure-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }

                .capital-expenditure-chart-wrapper {
                    position: relative;
                    width: 100%;
                    margin-left: 0;
                    overflow: visible;
                }

                .capital-expenditure-chart-region {
                    overflow: visible;
                    padding-right: 8px;
                    box-sizing: border-box;
                }

                .capital-expenditure-chart-wrapper div[role="button"]:focus {
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

                .capital-expenditure-legend {
                    gap: 15px;
                    margin-top: 15px;
                    cursor: default;
                    justify-content: flex-start;
                    width: 100%;
                    box-sizing: border-box;
                }

                .capital-expenditure-table-btn-wrapper {
                    width: 100%;
                    position: relative;
                    z-index: 50;
                }

                .capital-expenditure-container { width: 100%; display: flex; flex-direction: column; min-height: 100%; }
                .capital-expenditure-header { padding-top: 20px; padding-bottom: 20px; }

                .capital-expenditure-content-row { 
                    display: flex; 
                    flex-direction: row; 
                    flex: 1; 
                    width: 100%; 
                    overflow: visible;
                    gap: 40px;
                }

                .capital-expenditure-chart-column { 
                    width: 55%; 
                }

                .capital-expenditure-text-column {
                    width: 45%;
                    padding-top: 30px;
                    padding-left: 30px; 
                    padding-right: 0;
                    box-sizing: border-box;
                    min-width: 300px; 
                }

                .capital-expenditure-chart-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: var(--gc-text);
                    line-height: 1.2;
                    max-width: 100%;
                }

                .capital-expenditure-legend-item {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    color: var(--gc-text);
                    cursor: default;
                    user-select: none;
                    min-width: 0;
                }
                .capital-expenditure-legend-item .capital-expenditure-legend-color { width: 15px; height: 15px; }
                .capital-expenditure-legend-item > span:last-child { text-align: left; word-wrap: break-word; overflow-wrap: break-word; }

                .capital-expenditure-bullet {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                }

                .capital-expenditure-footnote {
                    font-family: 'Noto Sans', sans-serif;
                }

                .js-plotly-plot .plotly .modebar {
                    right: 20px !important;
                    top: 2px !important;
                }

                .capital-expenditure-chart-wrapper button:focus {
                    outline: 4px solid #ffbf47 !important;
                    outline-offset: 2px !important;
                }

                .capital-expenditure-chart { width: 100%; height: 300px; }

                /* Layout stacked mode when table is open */
                .layout-stacked {
                    flex-direction: column !important;
                    height: auto !important;
                    align-items: center !important;
                }
                .layout-stacked .capital-expenditure-chart-column {
                    width: 100% !important;
                    height: auto !important;
                    max-height: none !important;
                    margin-bottom: 30px !important;
                    overflow: visible !important;
                }
                .layout-stacked .capital-expenditure-text-column {
                    width: 100% !important;
                    padding-left: 0 !important;
                    padding-right: 0 !important;
                    padding-top: 0 !important;
                    margin-top: 20px !important;
                }

               

                @media (max-width: 1400px) {
                    .capital-expenditure-content-row { flex-direction: column; }
                    .capital-expenditure-chart-column { width: 100%; margin-bottom: 30px; }
                    .capital-expenditure-text-column { width: 100%; padding-top: 0; padding-left: 0; }
                }

                @media (max-width: 768px) {
                    .capital-expenditure-title {
                        font-size: 37px;
                    }
                    .capital-expenditure-chart-title {
                        font-size: 26px;
                    }
                    .capital-expenditure-legend-item {
                        font-size: 18px;
                    }
                    .capital-expenditure-bullet {
                        font-size: 18px;
                    }
                }

                @media (max-width: 640px) {
                    .page-24 { 
                        border-left: none !important; 
                        margin-left: 0;
                        width: 100%;
                        padding-left: 0;
                    }
                    .capital-expenditure-legend {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                    }
                }

                @media (max-width: 480px) {
                    .capital-expenditure-chart { height: 275px; }
                }

                .capital-expenditure-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    box-sizing: border-box;
                }

                .capital-expenditure-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    box-sizing: border-box;
                }

                .capital-expenditure-table-wrapper {
                    display: block;
                    width: 100%;
                    margin: 0;
                }
            `}</style>

            <div className="capital-expenditure-container">
                <header className="capital-expenditure-header">
                    <h1 className="capital-expenditure-title">
                        {getText('capital_expenditures_title', lang)}
                    </h1>
                </header>

                <div className={`capital-expenditure-content-row ${isTableOpen ? 'layout-stacked' : ''}`}>
                    <div className="capital-expenditure-chart-column">
                        <div className="capital-expenditure-chart-frame">
                        <h2 
                            className="capital-expenditure-chart-title"
                            role="region"
                            aria-label={stripForSR(chartTitle)}
                            tabIndex="0"
                        >
                            <span aria-hidden="true">{renderTextWithFootnoteLink(chartTitle, false)}</span>
                            <FootnoteMarker
                            lang={lang}
                            href="#fn-asterisk-capital-expenditure"
                            id="fn-asterisk-rf-capital-expenditure"
                            marker="*"
                            onClick={scrollToFootnote}
                        />
                        </h2>

                        <div className="capital-expenditure-chart-region" role="region" aria-label={getChartSummary()} tabIndex="0">
                            {selectedPoints !== null && (
                                    <ClearSelectionButton lang={lang} onClick={clearSelection} />
                                )}
                                <figure ref={chartRef} className="capital-expenditure-chart-wrapper">
                            <Plot
                                data={[
                                    { 
                                        name: getText('capital_expenditures_legend_oil_gas', lang), 
                                        x: years, y: oilGasValues, type: 'bar', 
                                        marker: { 
                                            color: COLORS.oil_gas,
                                            opacity: selectedPoints === null ? 1 : years.map((_, i) => selectedPoints[0]?.includes(i) ? 1 : 0.3)
                                        }, 
                                        hovertext: hoverTemplate('capital_expenditures_hover_oil_gas', oilGasValues), hoverinfo: 'text',
                                        visible: hiddenSeries.includes('oil_gas') ? 'legendonly' : true
                                    },
                                    { 
                                        name: getText('capital_expenditures_legend_electricity', lang), 
                                        x: years, y: electricValues, type: 'bar', 
                                        marker: { 
                                            color: COLORS.electricity,
                                            opacity: selectedPoints === null ? 1 : years.map((_, i) => selectedPoints[1]?.includes(i) ? 1 : 0.3)
                                        }, 
                                        hovertext: hoverTemplate('capital_expenditures_hover_electricity', electricValues), hoverinfo: 'text',
                                        visible: hiddenSeries.includes('electricity') ? 'legendonly' : true
                                    },
                                    { 
                                        name: getText('capital_expenditures_legend_other', lang), 
                                        x: years, y: otherValues, type: 'bar', 
                                        marker: { 
                                            color: COLORS.other,
                                            opacity: selectedPoints === null ? 1 : years.map((_, i) => selectedPoints[2]?.includes(i) ? 1 : 0.3)
                                        }, 
                                        hovertext: hoverTemplate('capital_expenditures_hover_other', otherValues), hoverinfo: 'text',
                                        visible: hiddenSeries.includes('other') ? 'legendonly' : true
                                    }
                                ]}
                                layout={{ 
                                    barmode: 'stack', 
                                    hoverlabel: { bgcolor: '#ffffff' }, 
                                    showlegend: false,
                                    clickmode: 'event',
                                    dragmode: false,
                                    xaxis: { 
                                        tickvals: tickVals, 
                                        automargin: true,
                                        tickangle: windowWidth <= 400 ? +90 : 'auto'
                                    }, 
                                    yaxis: { 
                                        title: { text: getText('capital_expenditures_yaxis', lang) }, 
                                        automargin: true,
                                    }, 
                                    margin: { l: chartMarginLeft, r: chartMarginRight, t: 30, b: 10 }, 
                                    autosize: true, 
                                    bargap: 0.2,
                                    paper_bgcolor: 'rgba(0,0,0,0)',
                                    plot_bgcolor: 'rgba(0,0,0,0)'
                                }}
                                className="capital-expenditure-chart"
                                style={{ width: '100%', height: windowWidth <= 480 ? 275 : 300 }} 
                                useResizeHandler={true} 
                                onClick={handleChartClick}
                                config={plotConfig}
                            />
                        </figure>
                        </div>

                        <HtmlLegend
                            className="capital-expenditure-legend"
                            variant="swatch"
                            itemClassName="capital-expenditure-legend-item"
                            markerClassName="capital-expenditure-legend-color"
                            items={legendItems.map((item) => ({
                                label: item.label,
                                color: item.color,
                            }))}
                        />

                        <div className="capital-expenditure-table-wrapper" ref={tableWrapperRef}>
                            <ChartDataTable
                                lang={lang}
                                columns={tableColumns}
                                rows={tableRows}
                                csvFilename={csvFilename}
                                docx={{
                                    filename: docxFilename,
                                    title: stripHtml(getText('capital_expenditures_title', lang)),
                                    titleAlign: 'center',
                                    columnWidths: [1200, 2000, 2000, 2000, 1800],
                                    fontSize: 22,
                                }}
                                caption={tableCaption}
                                tableAriaLabel={tableCaption}
                                renderCell={(raw, { colIndex }) => (
                                    colIndex === 0 ? String(raw ?? '') : formatNumberTable(raw)
                                )}
                            />
                        </div>
                        </div> {/* End chart-frame */}
                    </div>

                    <aside className="capital-expenditure-text-column align-right-edge">
                        <ul style={{ listStyleType: 'disc', paddingLeft: '20px', margin: '0', color: '#333' }}>
                            <li 
                                className="capital-expenditure-bullet" 
                                style={{ marginBottom: '20px', lineHeight: '1.4', marginTop: '20px' }}
                                aria-label={lang === 'en' 
                                    ? `Capital expenditures in Canada's energy sector totaled ${formatBillionSR(totalLatestBillion)} in ${latestRow.year}, a decrease of ${declineFromPeakPct.toFixed(0)} percent from a peak in ${peakRow.year}.`
                                    : `Les dépenses en immobilisations dans le secteur canadien de l'énergie ont totalisé ${formatBillionSR(totalLatestBillion)} en ${latestRow.year}, une baisse de ${declineFromPeakPct.toFixed(0)} pour cent par rapport au sommet de ${peakRow.year}.`
                                }
                            >
                                <span aria-hidden="true">
                                    {getText('capital_expenditures_bullet1_part1', lang)}<strong>{formatBillion(totalLatestBillion)}</strong>{getText('capital_expenditures_bullet1_part2', lang)}{latestRow.year}{getText('capital_expenditures_bullet1_part3', lang)}{declineFromPeakPct.toFixed(0)}{getText('capital_expenditures_bullet1_part4', lang)}{peakRow.year}{getText('capital_expenditures_bullet1_part5', lang)}
                                </span>
                            </li>

                            <li 
                                className="capital-expenditure-bullet" 
                                style={{ marginBottom: '20px', lineHeight: '1.4' }}
                                aria-label={lang === 'en'
                                    ? `After reaching an eleven year low of ${formatBillionSR(low2020Billion)} in 2020, investment has rebounded by ${reboundFrom2020Pct.toFixed(0)} percent.`
                                    : `Après avoir atteint un creux de onze ans de ${formatBillionSR(low2020Billion)} en 2020, l'investissement a rebondi de ${reboundFrom2020Pct.toFixed(0)} pour cent.`
                                }
                            >
                                <span aria-hidden="true">
                                    {getText('capital_expenditures_bullet2_part1', lang)}<strong>{formatBillion(low2020Billion)}</strong>{getText('capital_expenditures_bullet2_part2', lang)}<strong>{reboundFrom2020Pct.toFixed(0)}</strong>{getText('capital_expenditures_bullet2_part3', lang)}
                                </span>
                            </li>

                            <li 
                                className="capital-expenditure-bullet" 
                                style={{ marginBottom: '2px', lineHeight: '1.4' }}
                                aria-label={lang === 'en'
                                    ? `Oil and gas extraction was the largest area of energy sector capital expenditure at ${formatBillionSR(oilGasBillion)} in ${latestRow.year}, followed by electrical power generation and distribution at ${formatBillionSR(electricityBillion)}.`
                                    : `L'extraction de pétrole et de gaz était le plus grand domaine de dépenses en immobilisations du secteur de l'énergie avec ${formatBillionSR(oilGasBillion)} en ${latestRow.year}, suivie de la production et distribution d'électricité avec ${formatBillionSR(electricityBillion)}.`
                                }
                            >
                                <span aria-hidden="true">
                                    {getText('capital_expenditures_bullet3_part1', lang)}<strong>{formatBillion(oilGasBillion)}</strong>{getText('capital_expenditures_bullet3_part2', lang)}{latestRow.year}{getText('capital_expenditures_bullet3_part3', lang)}{formatBillion(electricityBillion)}{getText('capital_expenditures_bullet3_part4', lang)}
                                </span>
                            </li>
                        </ul>
                    </aside>
                </div>

                <PageFootnotes
                    lang={lang}
                    titleId="fn"
                    items={[
                        { id: 'fn-asterisk-capital-expenditure', marker: '*', text: getText('capital_expenditures_footnote', lang), returnHref: '#fn-asterisk-rf-capital-expenditure' },
                    ]}
                />
            </div>
        </main>
    );
};

export default CapitalExpenditures;
