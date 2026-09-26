import React, { useState, useEffect, useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import YearSelect from '../components/YearSelect';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getEnvironmentalProtectionData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import hexToRgba from '../utils/hexToRgba';
import { formatLocaleNumber } from '../utils/formatLocale';

const environmental_protection_COLORS = {
    'wastewater': '#857550',
    'soil': '#224397',
    'air': '#23808B',
    'solid_waste': '#CA4F0C',
    'other': '#877312',
};

const environmental_protection_CATEGORY_ORDER = ['wastewater', 'soil', 'air', 'solid_waste', 'other'];

const environmental_protection_CAT_KEYS = {
    wastewater: 'oil_gas_wastewater',
    soil: 'oil_gas_soil',
    air: 'oil_gas_air',
    solid_waste: 'oil_gas_solid_waste',
    other: 'oil_gas_other',
};

const EnvironmentalProtection = () => {
    const { lang, layoutPadding } = useOutletContext();
    const mainRef = useRef(null);
    const [year, setYear] = useState(null);
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const windowWidth = useWindowWidth();
    const [isChartInteractive, setIsChartInteractive] = useState(typeof window !== 'undefined' ? window.innerWidth > 768 : true);
    const {
        selected: selectedSlices,
        clear: clearSelection,
        onPlotClick: handlePieClick,
    } = usePlotlySelection({ mode: 'slices', windowWidth });
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

    const minYear = useMemo(() => pageData.length > 0 ? pageData[0].year : 2018, [pageData]);
    const maxYear = useMemo(() => pageData.length > 0 ? pageData[pageData.length - 1].year : 2022, [pageData]);

    const yearsList = useMemo(() => Array.from(
        { length: maxYear - minYear + 1 },
        (_, i) => minYear + i
    ), [minYear, maxYear]);
    const yearsListDesc = useMemo(() => [...yearsList].sort((a, b) => b - a), [yearsList]);
    useEffect(() => {
        const handleResize = () => {
            const newWidth = window.innerWidth;
            if (newWidth > 768) {
                setIsChartInteractive(true);
            }
        };
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

    

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => {
        const chartTitleText = getText('environmental_protection_chart_title', lang);
        const subtitle = getText('environmental_protection_chart_subtitle', lang);
        const title = `${stripHtml(chartTitleText)} (${year}, ${stripHtml(subtitle)})`;
        const filename = lang === 'en'
            ? `environmental_protection_chart_${year}.png`
            : `graphique_protection_environnement_${year}.png`;

        return {
            filename,
            title,
            width: 1200,
            height: 800,
            legendItems: environmental_protection_CATEGORY_ORDER.map((cat) => ({
                label: stripHtml(getText(`environmental_protection_cat_${cat}`, lang)),
                color: environmental_protection_COLORS[cat],
            })),
        };
    },
        [environmental_protection_CATEGORY_ORDER, environmental_protection_COLORS, getText, lang, stripHtml, year],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
        staticPlot: false,
    });

    const currentYearData = useMemo(() => {
        if (!year || pageData.length === 0) return null;
        return pageData.find(d => d.year === year) || pageData[pageData.length - 1];
    }, [year, pageData]);
    const dynamicValues = useMemo(() => {
        if (!currentYearData) return null;

        const oilGasTotal = currentYearData.oil_gas_total || 0;
        const allIndustriesTotal = currentYearData.all_industries_total || 0;
        const electricTotal = currentYearData.electric_total || 0;
        const naturalGasTotal = currentYearData.natural_gas_total || 0;
        const petroleumTotal = currentYearData.petroleum_total || 0;
        const petroleumPollution = currentYearData.petroleum_pollution || 0;
        const energySectorTotal = oilGasTotal + electricTotal + naturalGasTotal + petroleumTotal;
        const petroleumPollutionPct = petroleumTotal > 0 ? Math.round((petroleumPollution / petroleumTotal) * 100) : 0;
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
    const chartData = useMemo(() => {
        if (!currentYearData) return null;

        const values = [];
        const colors = [];
        const hoverTexts = [];
        const pctDict = {};

        const oilGasTotal = currentYearData.oil_gas_total || 0;
        const millionText = getText('environmental_protection_million', lang);

        const hoverKeys = {
            'wastewater': 'environmental_protection_hover_wastewater',
            'soil': 'environmental_protection_hover_soil',
            'air': 'environmental_protection_hover_air',
            'solid_waste': 'environmental_protection_hover_solid_waste',
            'other': 'environmental_protection_hover_other'
        };
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

        environmental_protection_CATEGORY_ORDER.forEach(cat => {
            const value = currentYearData[environmental_protection_CAT_KEYS[cat]] || 0;
            const pct = oilGasTotal > 0 ? (value / oilGasTotal) * 100 : 0;
            if (value >= 0) {
                values.push(value);
                colors.push(environmental_protection_COLORS[cat]);
                pctDict[cat] = pct;
                let catName = getText(hoverKeys[cat], lang);
                if (windowWidth <= 480) {
                    catName = wrapText(catName, 20);
                }

                let hoverText = lang === 'en' 
                    ? `<b>${catName}</b><br>$${value.toLocaleString()} ${millionText}<br>${pct.toFixed(0)}%`
                    : `<b>${catName}</b><br>${value.toLocaleString()} ${millionText}<br>${pct.toFixed(0)}%`;
                hoverTexts.push(hoverText);
            }
        });

        return { values, colors, hoverTexts, total: oilGasTotal, pctDict };
    }, [currentYearData, lang, windowWidth]);
    const pieLabels = useMemo(() => {
        const transKeys = {
            'wastewater': 'environmental_protection_cat_wastewater',
            'soil': 'environmental_protection_cat_soil',
            'air': 'environmental_protection_cat_air',
            'solid_waste': 'environmental_protection_cat_solid_waste',
            'other': 'environmental_protection_cat_other'
        };
        return environmental_protection_CATEGORY_ORDER.map(cat => getText(transKeys[cat], lang));
    }, [lang]);
    const annotations = useMemo(() => {
        if (!chartData) return [];
        // Use pre-calculated billions from database
        const totalBillions = currentYearData?.total_billions ?? ((chartData.total || 0) / 1000);

        const centerText = lang === 'en'
            ? `<b>Total</b><br><b>$${totalBillions.toFixed(0)}B</b>`
            : `<b>Total</b><br><b>${totalBillions.toFixed(0)}</b><br><b>milliards</b>`;

        return [{
            text: centerText, x: 0.5, y: 0.5,
            font: { size: windowWidth <= 480 ? 14 : windowWidth <= 768 ? 16 : 22, color: '#424243', family: 'Arial Black, sans-serif' },
            showarrow: false,
        }];
    }, [chartData, currentYearData, lang, windowWidth]);
    const formatNumber = (val, preCalcBillions) => {
        if (val >= 1000) {
            const billions = preCalcBillions ?? (val / 1000);
            return `$${formatLocaleNumber(billions, lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${lang === 'en' ? 'billion' : 'milliards de dollars'}`;
        }
        return `$${formatLocaleNumber(val, lang, { maximumFractionDigits: 0 })} ${getText('environmental_protection_million', lang)}`;
    };
    const formatNumberTable = (val) => formatLocaleNumber(val, lang, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
    const unitHeader = lang === 'en' ? '($ millions)' : '(millions $)';
    const tableCaption = lang === 'en'
        ? 'Oil and gas extraction expenditures per environmental activity (millions of dollars)'
        : "Dépenses d'extraction de pétrole et de gaz par activité environnementale (millions de dollars)";
    const chartDownloadSlug = lang === 'en'
        ? 'environmental_protection_expenditures_data'
        : 'depenses_protection_environnement_donnees';
    const exportTableTitle = stripHtml(getText('environmental_protection_title', lang));

    const tableColumns = useMemo(() => [
        { key: 'year', header: lang === 'en' ? 'Year' : 'Année', align: 'left' },
        ...environmental_protection_CATEGORY_ORDER.map((cat) => ({
            key: environmental_protection_CAT_KEYS[cat],
            header: `${stripHtml(getText(`environmental_protection_cat_${cat}`, lang))} ${unitHeader}`,
            align: 'num',
        })),
        { key: 'oil_gas_total', header: `${getText('total', lang)} ${unitHeader}`, align: 'num' },
    ], [lang, unitHeader]);

    const tableRows = useMemo(() => pageData || [], [pageData]);

    const getChartDataSummary = () => {
        if (!chartData || !currentYearData) return '';
        const millionText = getText('environmental_protection_million', lang);
        const categoryNames = {
            'wastewater': 'environmental_protection_hover_wastewater',
            'soil': 'environmental_protection_hover_soil',
            'air': 'environmental_protection_hover_air',
            'solid_waste': 'environmental_protection_hover_solid_waste',
            'other': 'environmental_protection_hover_other'
        };

        const parts = environmental_protection_CATEGORY_ORDER.map(cat => {
            const value = currentYearData[environmental_protection_CAT_KEYS[cat]] || 0;
            const pct = chartData.pctDict[cat] || 0;
            const name = stripHtml(getText(categoryNames[cat], lang));
            return `${name}: ${value.toLocaleString()} ${millionText} (${pct.toFixed(0)}%)`;
        });

        const totalText = `${getText('total', lang)}: ${chartData.total.toLocaleString()} ${millionText}`;
        return `${parts.join('. ')}. ${totalText}.`;
    };

    if (loading || error) {
        return (
            <PageStatus
                lang={lang}
                loading={loading}
                error={error}
                style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
            />
        );
    }

    if (!currentYearData) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>No data available. Please refresh the page.</div>;
    }







    return (
        <PageShell ref={mainRef}
            tabIndex="-1"
            className="page-37 page-chrome page-chrome--bleed"
            aria-label={getText('environmental_protection_title', lang)}
            style={{backgroundColor: 'white', 
                flex: '1 1 auto', 
                display: 'flex', 
                flexDirection: 'column',
                boxSizing: 'border-box', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`

                .page-37 {
                    padding-right: ${layoutPadding?.right || 15}px; 
                }

                .wb-inv {
                    clip: rect(1px, 1px, 1px, 1px);
                    height: 1px;
                    margin: 0;
                    overflow: hidden;
                    position: absolute;
                    width: 1px;
                }

                .js-plotly-plot .plotly .slice path.textline { display: none !important; }
                .js-plotly-plot .plotly g.slice path[class*="textline"] { display: none !important; }

                .environmental-protection-year-selector {
                    display: flex;
                    align-items: center;
                    margin-bottom: 15px;
                    padding: 2px 0;
                }

                .environmental-protection-year-label {
                    font-weight: bold;
                    margin-right: 15px;
                    font-size: 18px;
                    font-family: Arial, sans-serif;
                    white-space: nowrap;
                }

                .custom-dropdown {
                    position: relative;
                    display: inline-block;
                }

                .dropdown-button {
                    padding: 8px 35px 8px 12px;
                    font-size: 16px;
                    font-family: Arial, sans-serif;
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

                .environmental-protection-container {
                    width: 100%;
                    padding: 15px 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    min-height: 100%;
                }

                .environmental-protection-title {
                    color: #8a7d5a;
                    font-size: 50px;
                    margin: 0 0 10px 0;
                }

                .environmental-protection-subtitle {
                    font-family: 'Noto Sans', sans-serif;
                    color: var(--gc-text);
                    font-size: 20px;
                    margin-bottom: 10px;
                    line-height: 1.5;
                }

                .environmental-protection-subtitle:focus,
                .environmental-protection-text:focus {
                    outline: none;
                }

                .environmental-protection-text {
                    font-family: 'Noto Sans', sans-serif;
                    color: var(--gc-text);
                    font-size: 20px;
                    margin-bottom: 15px;
                    line-height: 1.5;
                }

                .environmental-protection-content-row {
                    display: flex;
                    flex-direction: row;
                    flex: 1 1 auto;
                    min-height: 0;
                    align-items: flex-start;
                    gap: 40px;
                }

                .environmental-protection-chart-column {
                    width: 55%;
                    height: auto;
                    min-height: auto;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                }

                .environmental-protection-chart-area {
                    width: 100%;
                    height: calc(100vh - 550px); 
                    min-height: 400px;
                    margin-bottom: 50px;
                    position: relative;
                    z-index: 1;
                }

                .environmental-protection-text-column {
                    width: 40%;
                    padding-top: 20px;
                }

                .environmental-protection-chart-title {
                    color: var(--gc-text);
                    margin-bottom: 5px;
                }

                .environmental-protection-bullets {
                    font-family: 'Noto Sans', sans-serif;
                    color: var(--gc-text);
                    font-size: 20px;
                    line-height: 1.6;
                    padding-left: 20px;
                    list-style-type: disc;
                }

                .environmental-protection-bullets li {
                    margin-bottom: 12px;
                }

                .visual-bold {
                    font-weight: bold;
                }

                .environmental-protection-chart-frame button[type="button"]:hover,
                .environmental-protection-chart-frame button:hover {
                    background-color: #404040 !important;
                }

                @media (max-width: 1745px) {
                    .environmental-protection-content-row {
                        flex-direction: column; 
                        align-items: stretch;
                    }

                    .environmental-protection-chart-column,
                    .environmental-protection-text-column {
                        width: 100%;
                    }

                    .environmental-protection-chart-column {
                        margin-bottom: 30px;
                    }

                    .environmental-protection-chart-area {
                        height: 500px;
                    }

                    .environmental-protection-text-column {
                        padding-top: 10px;
                    }

                }

                @media (max-width: 1536px) {
                    .environmental-protection-title {
                        font-size: 2rem;
                    }

                    .environmental-protection-chart-column {
                        height: auto;
                        max-height: none;
                    }

                    .environmental-protection-text-column {
                        padding-top: 0;
                    }
                }

                @media (max-width: 1280px) {
                    .environmental-protection-title {
                        font-size: 1.8rem;
                    }
                    .environmental-protection-chart-column {
                        height: auto;
                    }
                    .environmental-protection-chart-area {
                        height: 550px;
                    }
                }

                @media (max-width: 960px) {
                    .environmental-protection-year-ticks {
                        display: none !important;
                    }
                }

               @media (max-width: 768px) {
                    .page-37 {
                        border-right: none !important;
                    }
                    .environmental-protection-title {
                        font-size: 37px;
                    }
                    .environmental-protection-subtitle {
                        font-size: 18px;
                    }
                    .environmental-protection-text {
                        font-size: 18px;
                    }
                    .environmental-protection-bullets {
                        font-size: 18px;
                    }
                    .environmental-protection-year-selector {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                    }
                    .environmental-protection-year-label {
                        margin-bottom: 10px;
                        margin-right: 0;
                    }
                    
                    .environmental-protection-chart-area {
                        height: 400px;
                    }

                    .environmental-protection-chart-column {
                        height: auto !important;
                        min-height: 400px;
                        margin-bottom: 0 !important; 
                    }
                }

                @media (max-width: 640px) {
                    .environmental-protection-chart-area {
                        height: 360px;
                    }
                    .environmental-protection-chart-column {
                        height: auto !important;
                    }
                }

                @media (max-width: 480px) {
                    .environmental-protection-chart-area {
                        height: 460px;
                    }
                    .environmental-protection-chart-column {
                        height: auto !important;
                    }
                    .environmental-protection-title {
                        font-size: 1.3rem;
                    }
                }

                @media (max-width: 384px) {
                   .environmental-protection-chart-area {
                        height: 460px;
                    }
                    .environmental-protection-chart-column {
                        height: auto !important;
                    }
                }

                .environmental-protection-chart-frame {
                    margin-bottom: 0;
                }

                .environmental-protection-table-wrapper {
                    display: block;
                    width: 100%;
                    margin: 0;
                    position: relative;
                    z-index: 10;
                }
            `}</style>

            <div className="environmental-protection-container">
                <header role="region" aria-label={getText('environmental_protection_title', lang)}>
                    <h1 className="environmental-protection-title page-chrome-title">
                        {getText('environmental_protection_title', lang)}
                    </h1>

                    {dynamicValues && (
                        <>
                            <p className="environmental-protection-subtitle">
                                {getText('environmental_protection_subtitle_part1', lang)}
                                <span className="visual-bold">{formatNumber(dynamicValues.energySectorTotal)}</span>
                                {getText('environmental_protection_subtitle_part2', lang)}
                                {year}
                                {getText('environmental_protection_subtitle_part3', lang)}
                                <span className="visual-bold">{dynamicValues.energySectorPct.toFixed(0)}%</span>
                                {getText('environmental_protection_subtitle_part4', lang)}
                            </p>
                            <p className="environmental-protection-text">
                                {getText('environmental_protection_text_part1', lang)}
                                <span className="visual-bold">{formatNumber(dynamicValues.oilGasTotal)}</span>
                                {getText('environmental_protection_text_part2', lang)}
                                <span className="visual-bold">{dynamicValues.oilGasPct.toFixed(0)}%</span>
                                {getText('environmental_protection_text_part3', lang)}
                            </p>
                        </>
                    )}
                </header>
                <YearSelect
                    lang={lang}
                    id="environmental-protection-year-select"
                    className="environmental-protection-year-selector"
                    label={getText('year_slider_label', lang)}
                    years={yearsListDesc}
                    value={year || maxYear}
                    onChange={setYear}
                />
                <div role="status" className="wb-inv" aria-live="polite">
                    {year ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${year}` : ''}
                </div>
                <div className="environmental-protection-content-row">
                    <div className="environmental-protection-chart-column">
                        <div className="environmental-protection-chart-frame page-chrome-chart-frame">
                        <h2 className="environmental-protection-chart-title page-chrome-chart-title">
                            {getText('environmental_protection_chart_title', lang)}
                            <br />
                            ({year}, {getText('environmental_protection_chart_subtitle', lang)})
                        </h2>

                        {chartData && (
                            <div 
                                role="region"
                                className="environmental-protection-chart-area" 
                                aria-label={`${lang === 'en' ? 'Environmental protection expenditures pie chart for' : 'Graphique circulaire des dépenses de protection de l\'environnement pour'} ${year}. ${getChartDataSummary()}. ${lang === 'en' ? 'Expand the data table below for detailed values.' : 'Développez le tableau de données ci-dessous pour les valeurs détaillées.'}`}
                                style={{ width: '100%' }} 
                                tabIndex="0"
                            >
                                {selectedSlices !== null && <ClearSelectionButton lang={lang} onClick={clearSelection} />}
                                <figure ref={chartRef} className="environmental-protection-chart" style={{ width: '100%', height: '100%', margin: 0, position: 'relative' }}>
                                    <div aria-hidden="true">
                                    <Plot
                                        key={`pie-${selectedSlices ? selectedSlices.join('-') : 'none'}`}
                                        data={[{
                                            values: chartData.values,
                                            labels: pieLabels,
                                            hole: 0.60,
                                            type: 'pie',
                                            marker: { 
                                                colors: (() => {
                                                    if (selectedSlices === null) return chartData.colors;
                                                    return chartData.colors.map((color, i) => {
                                                        if (selectedSlices.includes(i)) return color;
                                                        return hexToRgba(color, 0.3);
                                                    });
                                                })(), 
                                                line: { color: 'white', width: 2 }
                                            },
                                            texttemplate: windowWidth <= 768 ? '%{percent:.0%}' : '%{label}<br><b>%{value:,.0f}</b>',
                                            textinfo: windowWidth <= 768 ? 'percent' : 'label+value',
                                            textposition: 'outside',
                                            textfont: { 
                                                size: windowWidth <= 480 ? 11 : windowWidth <= 768 ? 12 : windowWidth <= 1280 ? 15 : 18, 
                                                family: 'Arial, sans-serif',
                                                color: (() => {
                                                    if (selectedSlices === null) return chartData.colors;
                                                    return chartData.colors.map((color, i) => {
                                                        if (selectedSlices.includes(i)) return color;
                                                        return hexToRgba(color, 0.3);
                                                    });
                                                })()
                                            },
                                            outsidetextfont: { 
                                                color: (() => {
                                                    if (selectedSlices === null) return chartData.colors;
                                                    return chartData.colors.map((color, i) => {
                                                        if (selectedSlices.includes(i)) return color;
                                                        return hexToRgba(color, 0.3);
                                                    });
                                                })()
                                            },
                                            hovertext: chartData.hoverTexts, 
                                            hoverinfo: 'text',
                                            hoverlabel: { bgcolor: 'white', font: { size: 14, family: 'Arial, sans-serif' } },
                                            direction: 'clockwise', 
                                            sort: false, 
                                            rotation: 330,
                                            pull: (() => {
                                                if (selectedSlices === null) return chartData.values.map(() => 0.02);
                                                return chartData.values.map((_, i) => selectedSlices.includes(i) ? 0.08 : 0.02);
                                            })(),
                                            automargin: true
                                        }]}
                                        layout={{
                                            showlegend: windowWidth <= 768,
                                            legend: windowWidth <= 768 ? (
                                                windowWidth <= 480 ? {
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
                                                ? { l: 0, r: 0, t: 5, b: 140 }
                                                : windowWidth <= 768 
                                                    ? { l: 0, r: 0, t: 10, b: 10 }
                                                    : { l: 0, r: 0, t: 30, b: 30 },
                                            paper_bgcolor: 'rgba(0,0,0,0)', 
                                            plot_bgcolor: 'rgba(0,0,0,0)',
                                            autosize: true, 
                                            annotations: annotations,
                                            clickmode: 'event',
                                            dragmode: false,
                                        }}
                                        useResizeHandler={true}
                                        style={{ width: '100%', height: '100%' }}
                                        onClick={handlePieClick}
                                        config={plotConfig}
                                    />
                                    </div>
                                </figure>
                            </div>
                        )}

                        <div className="environmental-protection-table-wrapper">
                            <ChartDataTable
                                lang={lang}
                                columns={tableColumns}
                                rows={tableRows}
                                csvFilename={`${chartDownloadSlug}.csv`}
                                docx={{
                                    filename: `${chartDownloadSlug}.docx`,
                                    title: exportTableTitle,
                                    titleAlign: 'center',
                                    columnWidths: [1200, 1300, 1300, 1300, 1300, 1300, 1300],
                                    fontSize: 18,
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
                    <div className="environmental-protection-text-column">

                        {dynamicValues && (
                            <ul className="environmental-protection-bullets" role="list">
                                <li role="listitem" aria-label={lang === 'en'
                                    ? `Electric power generation, transmission and distribution invested ${formatNumber(dynamicValues.electricTotal)} on environmental protection measures.`
                                    : `Les secteurs de production, le transport et la distribution d'électricité ont investi ${formatNumber(dynamicValues.electricTotal)} dans des mesures de protection de l'environnement.`
                                }>
                                    <span aria-hidden="true">
                                        {getText('environmental_protection_bullet1_part1', lang)}
                                        <span className="visual-bold">{formatNumber(dynamicValues.electricTotal)}</span>
                                        {getText('environmental_protection_bullet1_part2', lang)}
                                    </span>
                                </li>
                                <li role="listitem" aria-label={lang === 'en'
                                    ? `Petroleum and coal product manufacturing invested ${formatNumber(dynamicValues.petroleumTotal)} in environmental protection activities, with the largest percentage of spending (${dynamicValues.petroleumPollutionPct}%) in pollution abatement and control.`
                                    : `Le secteur de fabrication de produits du pétrole et du charbon a investi ${formatNumber(dynamicValues.petroleumTotal)} dans des activités de protection de l'environnement, dont le pourcentage le plus élevé des dépenses (${dynamicValues.petroleumPollutionPct} %) a été consacré à la réduction et au contrôle de la pollution.`
                                }>
                                    <span aria-hidden="true">
                                        {getText('environmental_protection_bullet2_part1', lang)}
                                        <span className="visual-bold">{formatNumber(dynamicValues.petroleumTotal)}</span>
                                        {getText('environmental_protection_bullet2_part2', lang)}
                                        {dynamicValues.petroleumPollutionPct}
                                        {getText('environmental_protection_bullet2_part3', lang)}
                                    </span>
                                </li>
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default EnvironmentalProtection;
