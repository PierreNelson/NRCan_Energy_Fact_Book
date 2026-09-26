import React, { useState, useEffect, useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import YearSelect from '../components/YearSelect';
import usePlotlySelection from '../hooks/usePlotlySelection';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import PageStatus from '../components/PageStatus';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getInfrastructureData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import hexToRgba from '../utils/hexToRgba';

const infrastructure_COLORS = {
    'environmental': '#8F7200', 'fuel_energy_pipelines': '#3A8357',
    'transport': '#23808B', 'education': '#4870D5',
    'health_housing': '#857550', 'public_safety': '#CA4B0C',
};

const infrastructure_CATEGORY_ORDER = ['environmental', 'fuel_energy_pipelines', 'transport', 'education', 'health_housing', 'public_safety'];

const Infrastructure = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [year, setYear] = useState(null);
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [isChartInteractive, setIsChartInteractive] = useState(typeof window !== 'undefined' ? window.innerWidth > 768 : true);
    const {
        selected: selectedSlices,
        clear: clearSelection,
        onPlotClick: handlePieClick,
    } = usePlotlySelection({ mode: 'slices', windowWidth });
    const chartRef = useRef(null);

    const minYear = useMemo(() => pageData.length > 0 ? pageData[0].year : 2007, [pageData]);
    const maxYear = useMemo(() => pageData.length > 0 ? pageData[pageData.length - 1].year : 2024, [pageData]);

    const yearsList = useMemo(() => Array.from(
        { length: maxYear - minYear + 1 },
        (_, i) => minYear + i
    ), [minYear, maxYear]);
    const yearsListDesc = useMemo(() => [...yearsList].sort((a, b) => b - a), [yearsList]);

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
        const handleClickOutside = (event) => {
            if (windowWidth <= 768 && isChartInteractive && chartRef.current && !chartRef.current.contains(event.target)) {
                setIsChartInteractive(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isChartInteractive, windowWidth]);

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
    }, []);

    

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: lang === 'en' ? `infrastructure_chart_${year}.png` : `graphique_infrastructures_${year}.png`,
        title: `${stripHtml(getText('infrastructure_title', lang))} (${year})`,
        height: 800,
    }),
        [getText, lang, stripHtml, year],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

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

        infrastructure_CATEGORY_ORDER.forEach(cat => {
            const value = currentYearData[cat] || 0;
            // Use pre-calculated percentage from database if available, otherwise calculate
            const pct = currentYearData[`${cat}_pct`] ?? (total > 0 ? (value / total) * 100 : 0);
            // Use pre-calculated billions from database if available, otherwise calculate
            const valueBillions = currentYearData[`${cat}_billions`] ?? (value / 1000);
            
            if (value >= 0) { 
                values.push(value);
                colors.push(infrastructure_COLORS[cat]);
                pctDict[cat] = pct;
                const catName = getText(hoverKeys[cat], lang);
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
        return infrastructure_CATEGORY_ORDER.map(cat => {
            const labelText = getText(transKeys[cat], lang);
            return labelText;
        });
    }, [lang]);

    const annotations = useMemo(() => {
        if (!chartData || !chartData.pctDict) return [];
        // Use pre-calculated total_billions from database if available
        const totalBillions = currentYearData?.total_billions ?? ((chartData.total || 0) / 1000);

        const centerText = lang === 'en'
            ? `<b>Total</b><br><b>$${totalBillions.toFixed(0)}</b><br><b>billion</b>`
            : `<b>Total</b><br><b>${totalBillions.toFixed(0)} $</b><br><b>milliards</b>`;

        return [{
            text: centerText, x: 0.5, y: 0.54,
            font: { size: 22, color: '#424243', family: 'Arial Black, sans-serif' },
            showarrow: false,
        }];
    }, [chartData, currentYearData?.total_billions, lang]);

    const unitHeader = lang === 'en' ? '($ billions)' : '(milliards $)';
    const categoryLabels = useMemo(() => ({
        environmental: stripHtml(getText('infra_environmental', lang)),
        fuel_energy_pipelines: stripHtml(getText('infra_fuel_energy', lang)),
        transport: stripHtml(getText('infra_transport', lang)),
        education: stripHtml(getText('infra_education', lang)),
        health_housing: stripHtml(getText('infra_health_housing', lang)),
        public_safety: stripHtml(getText('infra_public_safety', lang)),
    }), [lang]);

    const tableCaption = lang === 'en'
        ? 'Capital expenditures on construction in infrastructure (billions of dollars)'
        : 'Dépenses en immobilisations pour la construction d\'infrastructures (milliards de dollars)';
    const exportTableTitle = stripHtml(getText('infrastructure_title', lang));
    const tableFilenameBase = lang === 'en' ? 'infrastructure_expenditures' : 'depenses_infrastructures';

    const tableColumns = useMemo(() => [
        { key: 'year', header: lang === 'en' ? 'Year' : 'Année', align: 'left' },
        ...infrastructure_CATEGORY_ORDER.map((cat) => ({
            key: cat,
            header: `${categoryLabels[cat]} ${unitHeader}`,
            align: 'num',
        })),
        { key: 'total', header: `${lang === 'en' ? 'Total' : 'Total'} ${unitHeader}`, align: 'num' },
    ], [lang, categoryLabels, unitHeader]);

    const tableRows = useMemo(() => pageData.map((yearData) => {
        const row = { year: yearData.year };
        infrastructure_CATEGORY_ORDER.forEach((cat) => {
            row[cat] = yearData[`${cat}_billions`] ?? ((yearData[cat] || 0) / 1000);
        });
        row.total = yearData.total_billions ?? ((yearData.total || 0) / 1000);
        return row;
    }), [pageData]);

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

    const getSubtitleText = () => {
        if (!currentYearData) return '';
        // Use pre-calculated values from database
        const fuelPct = currentYearData.fuel_energy_pipelines_pct ?? ((currentYearData['fuel_energy_pipelines'] || 0) / currentYearData.total * 100);
        const fuelValueBillions = currentYearData.fuel_energy_pipelines_billions ?? ((currentYearData['fuel_energy_pipelines'] || 0) / 1000);
        const billionText = getText('billion', lang);
        const dollarsText = lang === 'en' ? 'dollars' : 'dollars';
        const valueDisplay = `(${fuelValueBillions.toFixed(1)} ${billionText} ${dollarsText})`;

        return `${getText('infrastructure_subtitle_part1', lang).replace(/<br>/g, ' ')} ${getText('infrastructure_subtitle_part2', lang).replace(/\n/g, ' ')} ${fuelPct.toFixed(1)}% ${getText('infrastructure_subtitle_part3', lang)} ${year} ${valueDisplay}${getText('infrastructure_subtitle_part4', lang)}`;
    };

    const getSubtitle = () => {
        if (!currentYearData) return null;
        // Use pre-calculated values from database
        const fuelPct = currentYearData.fuel_energy_pipelines_pct ?? ((currentYearData['fuel_energy_pipelines'] || 0) / currentYearData.total * 100);
        const fuelValueBillions = currentYearData.fuel_energy_pipelines_billions ?? ((currentYearData['fuel_energy_pipelines'] || 0) / 1000);
        const billionText = getText('billion', lang);
        const valueDisplay = lang === 'en'
            ? `($${fuelValueBillions.toFixed(1)} ${billionText})`
            : `(${fuelValueBillions.toFixed(1)} $ ${billionText})`;

        return (
            <span>
                <strong>{getText('infrastructure_subtitle_part1', lang)}</strong>
                {getText('infrastructure_subtitle_part2', lang)}
                <strong style={{ color: '#8a7d5a' }}>{fuelPct.toFixed(1)}%</strong>
                {getText('infrastructure_subtitle_part3', lang)}
                <strong>{year}</strong>
                {' '}
                <strong>{valueDisplay}</strong>
                {getText('infrastructure_subtitle_part4', lang)}
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

        const parts = infrastructure_CATEGORY_ORDER.map(cat => {
            const pct = chartData.pctDict[cat] || 0;
            const name = getText(categoryNames[cat], lang).replace(/<br>/g, ' ');
            // Use pre-calculated billions from database
            const valueBillions = (currentYearData[`${cat}_billions`] ?? ((currentYearData[cat] || 0) / 1000)).toFixed(1);
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

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-25" 
            role="main"
            aria-label={getText('infrastructure_title', lang)}
            style={{
                backgroundColor: 'white', 
                flex: '1 1 auto', 
                display: 'flex',
                flexDirection: 'column',
                overflowX: 'visible',
                overflowY: 'visible',
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

                .page-25 {
                    margin-right: -${layoutPadding?.right || 15}px;
                    width: calc(100% + ${layoutPadding?.right || 15}px);
                    padding-right: ${layoutPadding?.right || 15}px; 
                }

                .infrastructure-stock-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 50px;
                    font-weight: bold;
                    color: #8a7d5a;
                    margin: 0 0 3px 0;
                    line-height: 1.2;
                    position: relative;
                    padding-bottom: 0.5em;
                }

                .infrastructure-stock-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }

                .infrastructure-stock-subtitle {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                }

                .infrastructure-stock-body-text {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                }

                .infrastructure-stock-container {
                    width: 100%;
                    padding: 0; 
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    min-height: 100%;
                }

                .infrastructure-stock-content-row {
                    display: flex;
                    flex-direction: row;
                    flex: 1 1 auto;
                    min-height: 0;
                    align-items: flex-start;
                    gap: 40px;
                }

                .infrastructure-stock-slider-region {
                    width: 100%;
                    position: relative;
                    z-index: 50;
                }
                .infrastructure-stock-slider-track { flex: 1; }

                .infrastructure-stock-chart-column {
                    width: 100%;
                    height: auto;
                    min-height: 500px;
                    position: relative;
                    margin-bottom: 20px;
                }

                .infrastructure-stock-chart-column details {
                    width: 100%;
                    position: relative;
                    z-index: 50;
                }

                .layout-stacked {
                    flex-direction: column !important;
                    height: auto !important;
                    align-items: stretch !important;
                    flex: 0 0 auto !important;
                }
                .layout-stacked .infrastructure-stock-chart-frame {
                    width: calc(100% + ${layoutPadding?.right || 15}px) !important;
                    margin-left: 0 !important;
                    margin-right: -${layoutPadding?.right || 15}px !important;
                    padding-right: ${layoutPadding?.right || 15}px;
                }
                .layout-stacked .infrastructure-stock-chart-column {
                    width: 100% !important;
                    height: auto !important;
                    max-height: none !important;
                    margin-bottom: 30px !important;
                    overflow: visible !important;
                }
                .layout-stacked .infrastructure-stock-text-column {
                    width: 100% !important;
                    padding-left: 0 !important;
                    padding-right: 0 !important;
                    margin-top: 20px !important;
                }
                .layout-stacked .infrastructure-stock-body-text {
                    margin-left: auto !important;
                    margin-right: auto !important;
                }
                .layout-stacked figure {
                    height: 500px !important;
                    min-height: 500px !important;
                }

                .infrastructure-stock-chart-column figure {
                    height: 450px;
                    min-height: 450px;
                }

                .infrastructure-stock-text-column {
                    width: 40%;
                    padding-left: 25px;
                    padding-right: 0;
                    padding-top: 0;
                    margin-top: 0;
                }

                .infrastructure-stock-definition-box {
                    position: relative;
                    background-color: #aa9c7a;
                    padding: 20px 30px;
                    border-radius: 3px;
                    width: 100%;
                    margin-top: 10px;
                }
                .infrastructure-stock-definition-box h2 {
                    text-align: center !important;
                    padding-left: 0 !important;
                }

                .infrastructure-stock-year-selector {
                    display: flex;
                    align-items: center;
                    margin-bottom: 15px;
                    margin-top: 0;
                }

                .infrastructure-stock-year-label {
                    font-weight: bold;
                    margin-right: 15px;
                    font-size: 20px;
                    font-family: 'Noto Sans', sans-serif;
                    white-space: nowrap;
                }

                .infrastructure-stock-definition-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                }

                .custom-dropdown {
                    position: relative;
                    display: inline-block;
                }

                .dropdown-button {
                    padding: 8px 35px 8px 12px;
                    font-size: 18px;
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

                .js-plotly-plot .plotly .slice path.textline { display: none !important; }
                .js-plotly-plot .plotly g.slice path[class*="textline"] { display: none !important; }

                @media (max-width: 1800px) {
                    .infrastructure-stock-content-row {
                        flex-direction: column;
                        height: auto;
                        align-items: stretch;
                        gap: 20px;
                    }

                    .infrastructure-stock-chart-frame {
                        width: calc(100% + ${layoutPadding?.right || 15}px) !important;
                        margin-left: 0 !important;
                        margin-right: -${layoutPadding?.right || 15}px !important;
                        padding-right: ${layoutPadding?.right || 15}px;
                        box-sizing: border-box;
                    }

                    .infrastructure-stock-chart-column {
                        width: 100%;
                        height: auto;
                        min-height: 500px;
                        max-height: none;
                        margin-bottom: 30px;
                    }

                    .infrastructure-stock-chart-column figure {
                        height: 480px !important;
                        min-height: 480px !important;
                    }

                    .infrastructure-stock-text-column {
                        width: 100%;
                        padding-left: 0;
                        padding-right: 0;
                        margin-top: 20px;
                        margin-bottom: 40px;
                    }
                    .infrastructure-stock-body-text {
                        margin-left: auto !important;
                        margin-right: auto !important;
                    }
                }

                @media (max-width: 960px) {
                    .infrastructure-stock-year-ticks { display: none !important; }

                    .infrastructure-stock-chart-column figure {
                        height: 520px !important;
                        min-height: 520px !important;
                    }
                }

                @media (max-width: 768px) {
                    .page-25 { border-right: none !important; }

                    .infrastructure-stock-title {
                        font-size: 37px;
                    }

                    .infrastructure-stock-subtitle {
                        font-size: 18px;
                    }

                    .infrastructure-stock-body-text {
                        font-size: 18px;
                    }

                    .infrastructure-stock-year-label {
                        font-size: 18px;
                    }

                    .infrastructure-stock-definition-title {
                        font-size: 26px;
                    }

                    .infrastructure-stock-chart-column figure { 
                        height: 320px !important; 
                        min-height: 320px !important; 
                    }

                    .infrastructure-stock-chart-column {
                        height: auto !important; 
                        min-height: 340px !important; 
                        margin-bottom: 20px !important;
                    }

                    .infrastructure-stock-slider-region {
                        flex-direction: column !important;
                        align-items: stretch !important;
                    }
                    .infrastructure-stock-slider-label { margin-bottom: 10px; margin-right: 0 !important; }
                }

                @media (max-width: 640px) {
                    .infrastructure-stock-slider-region {
                        flex-direction: column !important;
                        align-items: stretch !important;
                    }

                    .infrastructure-stock-chart-column,
                    .layout-stacked .infrastructure-stock-chart-column { 
                        width: 100% !important; 
                        height: auto !important; 
                        min-height: 500px !important; 
                        margin-bottom: 20px !important;
                    }
                    .infrastructure-stock-chart-column figure { height: 480px !important; min-height: 480px !important; }
                    .decorative-quote { display: none !important; }

                    input[type=range] { height: 44px !important; padding: 10px 0 !important; }
                    input[type=range]::-webkit-slider-thumb { height: 28px !important; width: 28px !important; margin-top: -10px !important; }
                }

                @media (max-width: 480px) {
                    .infrastructure-stock-chart-column { min-height: 480px !important; margin-bottom: 20px !important; }
                    .infrastructure-stock-chart-column figure { height: 480px !important; min-height: 480px !important; }
                }

                @media (max-width: 384px) {
                    .infrastructure-stock-chart-column,
                    .layout-stacked .infrastructure-stock-chart-column {
                        width: 100% !important; 
                        height: auto !important; 
                        min-height: 400px !important; 
                        margin-bottom: 20px !important;
                    }

                    .infrastructure-stock-chart-column figure { 
                        height: 420px !important; 
                        min-height: 420px !important; 
                    }
                }

                details summary::-webkit-details-marker, details summary::marker { display: none; }
                .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
                .infrastructure-stock-table-btn-wrapper summary:focus {outline: none !important;}

                .infrastructure-stock-table-wrapper {
                    display: block;
                    width: 100%;
                    margin: 0;
                }

                .infrastructure-stock-table-wrapper details > summary {
                    display: block;
                    width: 100%;
                    padding: 12px 15px;
                    background-color: #8C8C8C;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                    color: #ffffff;
                    box-sizing: border-box;
                    list-style: none;
                }

                .infrastructure-stock-table-wrapper details > summary::-webkit-details-marker {
                    display: none;
                }

                .infrastructure-stock-table-wrapper details > summary:hover {
                    background-color: #404040 !important;
                }

                .infrastructure-stock-table-wrapper button[type="button"]:hover,
                .infrastructure-stock-table-wrapper button:hover {
                    background-color: #404040 !important;
                }

                .infrastructure-stock-chart-column button[type="button"]:hover,
                .infrastructure-stock-chart-column button:hover {
                    background-color: #404040 !important;
                }

                /* Table horizontal scroll */
                .table-responsive {
                    display: block;
                    width: 100%;
                    overflow-x: auto !important;
                    -webkit-overflow-scrolling: touch;
                    border: 1px solid #ddd;
                    background: #fff;
                }

                .table-responsive table {
                    width: max-content !important;
                    min-width: 100%;
                    border-collapse: collapse;
                }

                .infrastructure-stock-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    width: 60%;
                    box-sizing: border-box;
                }
            `}</style>

            <div className="infrastructure-stock-container">
                <header 
                    role="region" 
                    aria-label={`${getText('infrastructure_title', lang).replace(/<br>/g, ' ')}. ${getSubtitleText()}`}
                >
                    <h1 className="infrastructure-stock-title" aria-hidden="true">
                        {getText('infrastructure_title', lang)}
                    </h1>

                    <p className="infrastructure-stock-subtitle" aria-hidden="true" style={{ color: '#333', marginBottom: '5px', whiteSpace: 'pre-line' }}>
                        {getSubtitle()}
                    </p>
                </header>
                <div className={`infrastructure-stock-content-row ${isTableOpen ? 'layout-stacked' : ''}`}>
                    {/* Chart Frame with Year Selector and Chart */}
                    <div className="infrastructure-stock-chart-frame">
                        <YearSelect
                            lang={lang}
                            id="infrastructure-year-select"
                            className="infrastructure-year-selector"
                            label={getText('year_slider_label', lang)}
                            years={yearsListDesc}
                            value={year || maxYear}
                            onChange={setYear}
                        />
                        <div role="status" className="wb-inv" aria-live="polite">
                            {year ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${year}` : ''}
                        </div>

                    <div 
                        className="infrastructure-stock-chart-column"
                        role="region"
                        aria-label={`${lang === 'en' ? 'Infrastructure pie chart for' : 'Graphique circulaire des infrastructures pour'} ${year}. ${getChartDataSummary()}. ${lang === 'en' ? 'Expand the data table below for detailed values.' : 'Développez le tableau de données ci-dessous pour les valeurs détaillées.'}`}
                        tabIndex="0"
                    >
                        {chartData && (
                            <>
                                    {selectedSlices !== null && selectedSlices.length > 0 && (
                                    <ClearSelectionButton lang={lang} onClick={clearSelection} />
                                )}
                                <figure ref={chartRef} className="infrastructure-stock-chart" style={{ width: '100%', height: '450px', minHeight: '450px', margin: 0, position: 'relative' }}>
                                <Plot
                                    key={`pie-${selectedSlices ? selectedSlices.join('-') : 'none'}`}
                                    data={[{
                                        values: chartData.values,
                                        labels: pieLabels,
                                        hole: windowWidth <= 480 ? 0.80 : windowWidth <= 768 ? 0.75 : windowWidth <= 1400 ? 0.73 : 0.70,
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
                                        texttemplate: windowWidth <= 768 ? '%{percent:.0%}' : '%{label}<br>%{percent:.0%}',
                                        textinfo: windowWidth <= 768 ? 'percent' : 'label+percent',
                                        textposition: windowWidth <= 768 ? 'inside' : 'outside',
                                        textfont: { 
                                            size: windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18, 
                                            family: 'Arial, sans-serif',
                                            color: (() => {
                                                if (windowWidth <= 768) return '#fff';
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
                                        hovertext: chartData.hoverTexts, hoverinfo: 'text',
                                        hoverlabel: { bgcolor: 'white', font: { size: 14, family: 'Arial, sans-serif' } },
                                        direction: 'clockwise', sort: false, rotation: 335,
                                        pull: (() => {
                                            if (selectedSlices === null) return chartData.values.map(() => 0.02);
                                            return chartData.values.map((_, i) => selectedSlices.includes(i) ? 0.08 : 0.02);
                                        })(),
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
                                            ? { l: 0, r: 0, t: 10, b: 80 }
                                            : windowWidth <= 480
                                                ? { l: 0, r: 0, t: 10, b: 70 }
                                                : windowWidth <= 640
                                                    ? { l: 0, r: 0, t: 10, b: 60 }
                                                    : windowWidth <= 768 
                                                        ? { l: 0, r: 0, t: 10, b: 10 }
                                                        : { l: 0, r: 0, t: 40, b: 40 },
                                        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
                                        autosize: true, 
                                        annotations: annotations,
                                        clickmode: 'event',
                                        dragmode: false
                                    }}
                                    useResizeHandler={true}
                                    style={{ width: '100%', height: '100%' }}
                                    onClick={handlePieClick}
                                    config={plotConfig}
                                />
                            </figure>
                            </>
                        )}

                        <div
                            className="infrastructure-stock-table-wrapper"
                            onToggle={(e) => {
                                if (e.target instanceof HTMLDetailsElement) {
                                    setIsTableOpen(e.target.open);
                                }
                            }}
                        >
                            <ChartDataTable
                                lang={lang}
                                columns={tableColumns}
                                rows={tableRows}
                                csvFilename={`${tableFilenameBase}_data.csv`}
                                docx={{
                                    filename: `${tableFilenameBase}_table.docx`,
                                    title: exportTableTitle,
                                    titleAlign: 'center',
                                    columnWidths: [1100, 1150, 1150, 1150, 1150, 1150, 1150, 1150],
                                    fontSize: 18,
                                }}
                                caption={tableCaption}
                                tableAriaLabel={tableCaption}
                                renderCell={(raw, { colIndex }) => {
                                    if (colIndex === 0) return String(raw ?? '');
                                    const formatted = formatNumberTable(Number(raw) || 0);
                                    return colIndex === tableColumns.length - 1
                                        ? <strong>{formatted}</strong>
                                        : formatted;
                                }}
                            />
                        </div>
                    </div>
                    </div>

                    <aside 
                        className="infrastructure-stock-text-column"
                        role="region"
                        aria-label={getRightSideText()}
                        tabIndex="0"
                    >
                        <div className="infrastructure-stock-definition-box" aria-hidden="true">
                            <h2 className="infrastructure-stock-definition-title" style={{ textAlign: 'center', color: '#333', margin: '0 0 15px 0px', lineHeight: '1.4', whiteSpace: 'pre-line' }}>
                                {getText('infra_definition_title', lang)}
                            </h2>
                            <div style={{ textAlign: 'center' }}>
                                <p className="infrastructure-stock-body-text" style={{ color: '#333', lineHeight: '1.6', whiteSpace: 'pre-line', textAlign: 'center', margin: 0, padding: '0 10px' }}>
                                    {getText('infra_definition_text', lang)}
                                </p>
                            </div>
                        </div>
                        <p className="infrastructure-stock-body-text" aria-hidden="true" style={{ color: '#333', lineHeight: '1.5', marginTop: '10px', marginLeft: '0', textAlign: 'center', whiteSpace: 'pre-line' }}>
                            {getText('infra_description', lang)}
                        </p>
                    </aside>
                </div>
            </div>
        </main>
    );
};

export default Infrastructure;
