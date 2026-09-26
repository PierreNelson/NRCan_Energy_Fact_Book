import React, { useState, useEffect, useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import FootnoteMarker from '../components/FootnoteMarker';
import PageFootnotes from '../components/PageFootnotes';
import YearSelect from '../components/YearSelect';
import useWindowWidth from '../hooks/useWindowWidth';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import PageStatus from '../components/PageStatus';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getNominalGDPData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';

import { makeScrollToIdHandler } from '../utils/scrollToId';
import { formatLocalePct } from '../utils/formatLocale';

const nominal_gdp_COLORS = {
    'energy_total': '#245e7f',
    'non_energy': '#9A9389',
};

const NominalGdp = () => {
    const { lang } = useOutletContext();
    const windowWidth = useWindowWidth();
    const [year, setYear] = useState(null);
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const chartRef = useRef(null);

    const scrollToFootnote = makeScrollToIdHandler('fn-asterisk');

    const scrollToRef = makeScrollToIdHandler('fn-asterisk-rf');

    const minYear = useMemo(() => pageData.length > 0 ? pageData[0].year : 2022, [pageData]);
    const maxYear = useMemo(() => pageData.length > 0 ? pageData[pageData.length - 1].year : 2024, [pageData]);
    const yearsDescending = useMemo(
        () => [...pageData].sort((a, b) => b.year - a.year).map((d) => d.year),
        [pageData]
    );

    useEffect(() => {
        getNominalGDPData()
            .then(data => {
                setPageData(data);
                if (data && data.length > 0) {
                    setYear(data[data.length - 1].year);
                }
            })
            .catch(err => {
                console.error("Failed to load nominal GDP data:", err);
                setError(err.message || 'Failed to load data');
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    

    const currentData = useMemo(() => {
        if (!year || pageData.length === 0) return null;
        return pageData.find(d => d.year === year) || pageData[pageData.length - 1];
    }, [year, pageData]);

    const chartTitle = `${stripHtml(getText('nominal_gdp_chart_title', lang))} (${year})`;
    const tableFilenameBase = lang === 'en'
        ? `economic_contributions_${minYear}-${maxYear}`
        : `contributions_economiques_${minYear}-${maxYear}`;
    const tableCaption = lang === 'en'
        ? `Energy's nominal GDP contribution for Canada, ${minYear} to ${maxYear}. Values in billions of dollars.`
        : `Contribution de l'énergie au PIB nominal du Canada, ${minYear} à ${maxYear}. Valeurs en milliards de dollars.`;
    const tableTitle = lang === 'en'
        ? `Energy's nominal GDP contribution for Canada (${minYear}-${maxYear})`
        : `Contribution de l'énergie au PIB nominal du Canada (${minYear}-${maxYear})`;

    const tableColumns = useMemo(() => [
        { key: 'year', header: lang === 'en' ? 'Year' : 'Année', align: 'left' },
        {
            key: 'direct',
            header: lang === 'en' ? 'Energy Direct ($ billions)' : 'Énergie directe (milliards $)',
            align: 'num',
        },
        {
            key: 'indirect',
            header: lang === 'en' ? 'Energy Indirect ($ billions)' : 'Énergie indirecte (milliards $)',
            align: 'num',
        },
        {
            key: 'total',
            header: lang === 'en' ? 'Total ($ billions)' : 'Total (milliards $)',
            align: 'num',
        },
        {
            key: 'pct',
            header: lang === 'en' ? 'Total (% of GDP)' : 'Total (% du PIB)',
            align: 'num',
        },
    ], [lang]);

    const tableRows = useMemo(() => pageData.map((yearData) => ({
        year: yearData.year,
        direct: yearData.direct_billions ?? Math.round(yearData.direct / 1000),
        indirect: yearData.indirect_billions ?? Math.round(yearData.indirect / 1000),
        total: yearData.total_billions ?? Math.round(yearData.total / 1000),
        pct: yearData.total_pct,
    })), [pageData]);

    const getChartDataSummary = () => {
        if (!currentData) return '';
        const billionText = lang === 'en' ? 'billion dollars' : 'milliards de dollars';
        // Use pre-calculated billions from database
        const energyTotal = currentData.total_billions ?? Math.round(currentData.total / 1000);
        const energyDirect = currentData.direct_billions ?? Math.round(currentData.direct / 1000);
        const energyIndirect = currentData.indirect_billions ?? Math.round(currentData.indirect / 1000);
        const marketGDP = currentData.market_billions ?? Math.round((currentData.market || 2879000) / 1000);
        const nonEnergy = marketGDP - energyTotal;
        
        if (lang === 'en') {
            return `Pie chart showing Canada's nominal GDP composition for ${year}. Energy sector total: ${energyTotal} ${billionText} (${currentData.total_pct}% of GDP), consisting of Energy Direct at ${energyDirect} ${billionText} (${currentData.direct_pct}%) and Energy Indirect at ${energyIndirect} ${billionText} (${currentData.indirect_pct}%). Non-energy: ${nonEnergy} ${billionText} (${(100 - currentData.total_pct).toFixed(1)}%).`;
        } else {
            return `Graphique circulaire montrant la composition du PIB nominal du Canada pour ${year}. Total du secteur de l'énergie : ${energyTotal} ${billionText} (${currentData.total_pct} % du PIB), composé de l'Énergie directe à ${energyDirect} ${billionText} (${currentData.direct_pct} %) et de l'Énergie indirecte à ${energyIndirect} ${billionText} (${currentData.indirect_pct} %). Hors énergie : ${nonEnergy} ${billionText} (${(100 - currentData.total_pct).toFixed(1)} %).`;
        }
    };

    const getLegendText = () => {
        if (!currentData) return '';
        const billionText = lang === 'en' ? 'billion dollars' : 'milliards de dollars';
        // Use pre-calculated billions from database
        const directBillions = currentData.direct_billions ?? Math.round(currentData.direct / 1000);
        const indirectBillions = currentData.indirect_billions ?? Math.round(currentData.indirect / 1000);
        
        if (lang === 'en') {
            return `Canadian GDP breakdown. Energy Direct: ${currentData.direct_pct}% or ${directBillions} ${billionText}. This includes Petroleum at ${currentData.petroleum_pct}%, Electricity at ${currentData.electricity_pct}%, and Other at ${currentData.other_pct}%. Energy Indirect: ${currentData.indirect_pct}% or ${indirectBillions} ${billionText}.`;
        } else {
            return `Répartition du PIB canadien. Énergie directe : ${currentData.direct_pct} % ou ${directBillions} ${billionText}. Cela comprend le Pétrole à ${currentData.petroleum_pct} %, l'Électricité à ${currentData.electricity_pct} % et Autres à ${currentData.other_pct} %. Énergie indirecte : ${currentData.indirect_pct} % ou ${indirectBillions} ${billionText}.`;
        }
    };

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: lang === 'en'
            ? `economic_contributions_${year}.png`
            : `contributions_economiques_${year}.png`,
        title: chartTitle,
        height: 800,
    }),
        [chartTitle, lang, year],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const chartData = useMemo(() => {
        if (!currentData) return [];
        
        const energyTotal = currentData.total || 0;
        const marketGDP = currentData.market || 2879000;
        const nonEnergy = marketGDP - energyTotal;
        const energyPct = currentData.total_pct || 0;
        const nonEnergyPct = 100 - energyPct;
        
        // Use pre-calculated billions from database
        const energyTotalBillions = currentData.total_billions ?? Math.round(energyTotal / 1000);
        const nonEnergyBillions = (currentData.market_billions ?? Math.round(marketGDP / 1000)) - energyTotalBillions;

        const energyLabel = `<b>${energyPct}%</b><br>or<br><b>$${energyTotalBillions} billion</b>`;
        const energyLabelFr = `<b>${energyPct} %</b><br>ou<br><b>${energyTotalBillions} milliards $</b>`;

        return [{
            type: 'pie',
            values: [energyTotal, nonEnergy],
            labels: [
                getText('nominal_gdp_energy_total', lang),
                getText('nominal_gdp_non_energy', lang)
            ],
            text: [lang === 'en' ? energyLabel : energyLabelFr, ''],
            texttemplate: windowWidth <= 768 ? '%{percent:.1%}' : '%{text}',
            textinfo: windowWidth <= 768 ? 'percent' : 'text',
            textposition: windowWidth <= 768 ? 'inside' : 'outside',
            textfont: { 
                size: windowWidth <= 480 ? 14 : windowWidth <= 768 ? 16 : 24, 
                family: 'Arial, sans-serif',
                color: windowWidth <= 768 ? '#ffffff' : '#221e1f'
            },
            outsidetextfont: { 
                color: '#221e1f',
                size: windowWidth <= 768 ? 16 : 24,
                family: 'Arial, sans-serif'
            },
            hoverinfo: 'text',
            hovertext: [
                `<b>${getText('nominal_gdp_energy_total', lang)}</b><br>$${energyTotalBillions} ${lang === 'en' ? 'billion' : 'milliards'}<br>${energyPct}%`,
                `<b>${getText('nominal_gdp_non_energy', lang)}</b><br>$${nonEnergyBillions} ${lang === 'en' ? 'billion' : 'milliards'}<br>${nonEnergyPct.toFixed(1)}%`
            ],
            hoverlabel: {
                bgcolor: '#ffffff',
                bordercolor: '#000000',
                font: { color: '#000000', size: windowWidth <= 640 ? 12 : 14, family: 'Arial, sans-serif' }
            },
            marker: {
                colors: [nominal_gdp_COLORS.energy_total, nominal_gdp_COLORS.non_energy],
                line: { color: '#ffffff', width: 2 }
            },
            hole: 0.0,
            direction: 'clockwise',
            rotation: 45,
            sort: false,
            pull: [0.02, 0],
        }];
    }, [currentData, lang, windowWidth]);

    const formatBillions = (val, preCalcBillions) => {
        const billions = preCalcBillions ?? Math.round(val / 1000);
        if (lang === 'fr') {
            return `${billions} milliards $`;
        }
        return `$${billions} billion`;
    };

    const formatPercent = (val) => formatLocalePct(val, lang, { maximumFractionDigits: 20 });

    if (loading || error) {
        return (
            <main id="main-content" tabIndex="-1" className="page-content page-7" role="main">
                <PageStatus
                    lang={lang}
                    loading={loading}
                    error={error}
                    style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}
                />
            </main>
        );
    }

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-7" 
            role="main"
            style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}
        >
            <style>{`
                .nominal-gdp-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 50px;
                    font-weight: bold;
                    color: #245e7f;
                    margin-top: 0;
                    margin-bottom: 25px;
                    position: relative;
                    padding-bottom: 0.5em;
                }
                .nominal-gdp-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }
                .nominal-gdp-subtitle {
                    font-family: 'Lato', sans-serif;
                    font-size: 39px;
                    font-weight: bold;
                    color: #5d5d5f;
                    margin-top: 0;
                    margin-bottom: 20px;
                }
                .nominal-gdp-subtitle2 {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: #245e7f;
                    margin-top: 0;
                    margin-bottom: 20px;
                }
                .nominal-gdp-chart-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: #221e1f;
                    margin-top: 0;
                    margin-bottom: 20px;
                }
                .nominal-gdp-chart {
                    position: relative;
                    width: 100%;
                    margin-top: 0;
                    margin-bottom: 15px;
                }
                .nominal-gdp-chart .js-plotly-plot {
                    width: 100% !important;
                }
                .nominal-gdp-legend {
                    margin-left: 60px;
                    padding-top: 10px;
                    font-family: 'Noto Sans', sans-serif;
                    border-radius: 2px;
                }
                .nominal-gdp-legend:focus,
                .nominal-gdp-legend:focus-visible {
                    outline: 3px solid #ffbf47;
                    outline-offset: 4px;
                }
                .nominal-gdp-legend-item {
                    margin-bottom: 12px;
                    font-size: 20px;
                }
                .nominal-gdp-legend-header {
                    font-weight: bold;
                    color: #245e7f;
                    font-size: 20px;
                    margin-bottom: 8px;
                }
                .nominal-gdp-legend-sub {
                    margin-left: 25px;
                    color: #58585a;
                    font-size: 20px;
                    margin-bottom: 6px;
                    font-weight: bold;
                }
                .nominal-gdp-canadian-gdp {
                    font-weight: bold;
                    font-size: 20px;
                    margin-bottom: 25px;
                    color: #242021;
                }
                .year-selector {
                    display: flex;
                    align-items: center;
                    margin: 10px 0 20px 0;
                    padding: 2px 0;
                    position: relative;
                    z-index: 10;
                }
                .year-selector label {
                    font-weight: bold;
                    margin-right: 15px;
                    font-size: 20px;
                    font-family: 'Noto Sans', sans-serif;
                }
                .custom-dropdown {
                    position: relative;
                    display: inline-block;
                }
                .dropdown-button {
                    padding: 8px 35px 8px 12px;
                    font-size: 20px;
                    font-family: 'Noto Sans', sans-serif;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    background-color: #fff;
                    cursor: pointer;
                    min-width: 100px;
                    text-align: left;
                    position: relative;
                }
                .dropdown-button:hover {
                    border-color: #007bff;
                }
                .dropdown-button:focus {
                    outline: 2px solid #005fcc;
                    outline-offset: 2px;
                    border-color: #007bff;
                }
                .dropdown-arrow {
                    position: absolute;
                    right: 10px;
                    top: 50%;
                    transform: translateY(-50%);
                    font-size: 10px;
                    pointer-events: none;
                }
                .dropdown-list {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    width: 100%;
                    margin: 0;
                    padding: 0;
                    list-style: none;
                    border: 1px solid #ccc;
                    border-top: none;
                    border-radius: 0 0 4px 4px;
                    background-color: #fff;
                    max-height: 200px;
                    overflow-y: auto;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    z-index: 1000;
                }
                .dropdown-list:focus {
                    outline: 2px solid #005fcc;
                    outline-offset: -2px;
                }
                .dropdown-option {
                    padding: 8px 12px;
                    cursor: pointer;
                    border-bottom: 1px solid #eee;
                }
                .dropdown-option:last-child {
                    border-bottom: none;
                }
                .dropdown-option.focused {
                    background-color: #005fcc;
                    color: #fff;
                }
                .dropdown-option.selected {
                    font-weight: bold;
                }
                .dropdown-option:hover {
                    background-color: #005fcc;
                    color: #fff;
                }
                .wb-inv {
                    clip: rect(1px, 1px, 1px, 1px);
                    height: 1px;
                    margin: 0;
                    overflow: hidden;
                    position: absolute;
                    width: 1px;
                    white-space: nowrap;
                }
                @media (max-width: 768px) {
                    .nominal-gdp-title {
                        font-size: 37px;
                    }
                    .nominal-gdp-subtitle {
                        font-size: 35px;
                    }
                    .nominal-gdp-subtitle2,
                    .nominal-gdp-chart-title {
                        font-size: 26px;
                    }
                    .nominal-gdp-content-wrapper {
                        flex-direction: column !important;
                    }
                    .nominal-gdp-legend {
                        margin-left: 190px !important;
                        text-align: center;
                        margin-top: 20px;
                    }
                    .nominal-gdp-legend-header,
                    .nominal-gdp-legend-sub,
                    .nominal-gdp-canadian-gdp,
                    .nominal-gdp-legend-item {
                        font-size: 18px;
                    }
                    .year-selector label {
                        font-size: 18px;
                    }
                    .dropdown-button {
                        font-size: 18px;
                    }
                }
                @media (min-width: 1200px) {
                    .nominal-gdp-legend {
                        margin-left: 100px;
                    }
                }

                .nominal-gdp-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    margin-top: 0;
                    margin-bottom: 20px;
                    box-sizing: border-box;
                }

                .nominal-gdp-table-wrapper {
                    display: block;
                    width: 100%;
                    margin: 0;
                    margin-top: 20px;
                }

                @media (max-width: 640px) {
                    .nominal-gdp-legend {
                        margin-left: 130px !important;
                    }
                }

                @media (max-width: 480px) {
                    .nominal-gdp-legend {
                        margin-left: 50px !important;
                    }
                }

                @media (max-width: 384px) {
                    .nominal-gdp-legend {
                        margin-left: 5px !important;
                    }
                }
              
            `}</style>

            <header>
                <h1 className="nominal-gdp-title">
                    {getText('nominal_gdp_title', lang)}
                </h1>
                <h2 className="nominal-gdp-subtitle">
                    {getText('nominal_gdp_subtitle', lang)} ({year})
                </h2>
                <h3 className="nominal-gdp-subtitle2">
                    {getText('nominal_gdp_subtitle2', lang)}
                </h3>
            </header>

            {/* Chart Frame with Year Selector and Chart */}
            <div className="nominal-gdp-chart-frame">
                <YearSelect
                    lang={lang}
                    id="nominal-gdp-year-select"
                    label={getText('year_slider_label', lang)}
                    years={yearsDescending}
                    value={year}
                    onChange={setYear}
                />
                
                <div role="status" className="wb-inv" aria-live="polite">
                    {year ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${year}` : ''}
                </div>

            <h4 className="nominal-gdp-chart-title">
                {getText('nominal_gdp_chart_title', lang)}
                <FootnoteMarker
                    lang={lang}
                    href="#fn-asterisk"
                    id="fn-asterisk-rf"
                    marker="*"
                    onClick={scrollToFootnote}
                />
            </h4>

            <div className="nominal-gdp-content-wrapper" style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div 
                    role="region" 
                    aria-label={getChartDataSummary()}
                    style={{ flex: '0 0 auto', width: windowWidth <= 768 ? '100%' : '500px' }}
                    tabIndex="0"
                >
                    <figure ref={chartRef} className="nominal-gdp-chart" style={{ margin: 0, position: 'relative' }} aria-hidden="true">
                        <Plot
                            data={chartData}
                            layout={{
                                autosize: true,
                                clickmode: 'event',
                                dragmode: false,
                                showlegend: false,
                                margin: { 
                                    t: 30, 
                                    r: windowWidth <= 768 ? 30 : 150, 
                                    b: 30, 
                                    l: 30 
                                },
                                paper_bgcolor: 'rgba(0,0,0,0)',
                                plot_bgcolor: 'rgba(0,0,0,0)',
                            }}
                            config={plotConfig}
                            style={{ width: '100%', height: '350px' }}
                        />
                    </figure>
                </div>

                <aside 
                    className="nominal-gdp-legend"
                    role="region"
                    aria-label={getLegendText()}
                    tabIndex="0"
                >
                    <div aria-hidden="true">
                        <div className="nominal-gdp-canadian-gdp">
                            {getText('nominal_gdp_canadian_gdp', lang)}
                        </div>
                        
                        <div className="nominal-gdp-legend-header">
                            {getText('nominal_gdp_energy_direct', lang)} {formatPercent(currentData?.direct_pct || 0)} ({formatBillions(currentData?.direct || 0)})
                        </div>
                        <div className="nominal-gdp-legend-sub">
                            {getText('nominal_gdp_petroleum', lang)} {formatPercent(currentData?.petroleum_pct || 0)}
                        </div>
                        <div className="nominal-gdp-legend-sub">
                            {getText('nominal_gdp_electricity', lang)} {formatPercent(currentData?.electricity_pct || 0)}
                        </div>
                        <div className="nominal-gdp-legend-sub">
                            {getText('nominal_gdp_other', lang)} {formatPercent(currentData?.other_pct || 0)}
                        </div>
                        
                        <div className="nominal-gdp-legend-header" style={{ marginTop: '20px' }}>
                            {getText('nominal_gdp_energy_indirect', lang)} {formatPercent(currentData?.indirect_pct || 0)} ({formatBillions(currentData?.indirect || 0)})
                        </div>
                    </div>
                </aside>
            </div>

            <div className="nominal-gdp-table-wrapper">
                <ChartDataTable
                    lang={lang}
                    columns={tableColumns}
                    rows={tableRows}
                    csvFilename={`${tableFilenameBase}.csv`}
                    docx={{
                        filename: `${tableFilenameBase}.docx`,
                        title: tableTitle,
                        titleAlign: 'center',
                        columnWidths: [1500, 2200, 2200, 1800, 1800],
                        fontSize: 22,
                    }}
                    caption={tableCaption}
                    tableAriaLabel={tableCaption}
                    renderCell={(raw, { colIndex }) => {
                        if (colIndex === 0) return String(raw ?? '');
                        if (colIndex === 4) return `${raw}%`;
                        return `$${raw}`;
                    }}
                />
            </div>
            </div>

            <PageFootnotes
                lang={lang}
                titleId="fn"
                items={[
                    { id: 'fn-asterisk', marker: '*', text: getText('nominal_gdp_footnote', lang), returnHref: '#fn-asterisk-rf' },
                ]}
            />
        </main>
    );
};

export default NominalGdp;
