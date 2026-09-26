import React, { useState, useEffect, useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import PageStatus from '../components/PageStatus';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getInvestmentByAssetData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { formatLocaleNumber } from '../utils/formatLocale';

const investment_by_asset_COLORS = {
    'transmission_distribution': '#224397',
    'pipelines': '#857550',
    'nuclear': '#E4570C',
    'other_electric': '#787878',
    'hydraulic': '#2CA2AF',
    'wind_solar': '#6cbe8d',
    'steam_thermal': '#A78F16',
};

const investment_by_asset_CATEGORY_ORDER = [
    'transmission_distribution',
    'hydraulic',
    'pipelines',
    'wind_solar',
    'nuclear',
    'steam_thermal',
    'other_electric'
];

const investment_by_asset_LEGEND_KEYS = {
    'transmission_distribution': 'investment_by_asset_legend_transmission',
    'pipelines': 'investment_by_asset_legend_pipelines',
    'nuclear': 'investment_by_asset_legend_nuclear',
    'other_electric': 'investment_by_asset_legend_other',
    'hydraulic': 'investment_by_asset_legend_hydraulic',
    'wind_solar': 'investment_by_asset_legend_wind_solar',
    'steam_thermal': 'investment_by_asset_legend_steam',
};

const investment_by_asset_HOVER_KEYS = {
    'transmission_distribution': 'investment_by_asset_hover_transmission',
    'pipelines': 'investment_by_asset_hover_pipelines',
    'nuclear': 'investment_by_asset_hover_nuclear',
    'other_electric': 'investment_by_asset_hover_other',
    'hydraulic': 'investment_by_asset_hover_hydraulic',
    'wind_solar': 'investment_by_asset_hover_wind_solar',
    'steam_thermal': 'investment_by_asset_hover_steam',
};

const InvestmentByAsset = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const {
        selected: selectedPoints,
        clear: clearSelection,
        onPlotClick: handleChartClick,
    } = usePlotlySelection({
        mode: 'points',
        traceCount: investment_by_asset_CATEGORY_ORDER.length,
        windowWidth,
    });
    const chartRef = useRef(null);

    const legendSettings = useMemo(() => {
        // entrywidth = 1/numColumns so legend spans full width (left anchor to right anchor) with evenly spaced columns
        if (windowWidth <= 480) {
            return { width: 1.0, margin: 120, fontSize: 9, y: -0.25, x: 0, xanchor: 'left' };
        }
        else if (windowWidth <= 640) {
            return { width: 1.0, margin: 120, fontSize: 11, y: -0.24, x: 0, xanchor: 'left' };
        }
        else if (windowWidth <= 960) {
            return { width: 0.5, margin: 120, fontSize: 12, y: -0.22, x: 0, xanchor: 'left' };
        }
        else if (windowWidth <= 1097) {
            return { width: 0.33, margin: 120, fontSize: 14, y: -0.18, x: 0, xanchor: 'left' };
        }
        else if (windowWidth <= 1536) {
            return { width: 0.33, margin: 120, fontSize: 14, y: -0.18, x: 0, xanchor: 'left' };
        }
        else {
            return { width: 0.33, margin: 120, fontSize: 14, y: -0.15, x: 0, xanchor: 'left' };
        }
    }, [windowWidth]);

    useEffect(() => {
        getInvestmentByAssetData()
            .then(data => {
                setPageData(data);
            })
            .catch(err => {
                console.error("Failed to load investment by asset data:", err);
                setError(err.message || 'Failed to load data');
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    

    const chartData = useMemo(() => {
        if (pageData.length === 0) return null;

        const years = pageData.map(d => d.year);
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);

        const tickVals = [];
        for (let y = minYear; y <= maxYear; y++) {
            tickVals.push(y);
        }

        // Use pre-calculated total_billions from database if available
        const totalValues = pageData.map(d => d.total_billions ?? (() => {
            let total = 0;
            investment_by_asset_CATEGORY_ORDER.forEach(cat => {
                total += (d[cat] || 0) / 1000;
            });
            return total;
        })());

        const LEGEND_ORDER_ZOOMED = [
            'transmission_distribution',
            'hydraulic',
            'pipelines',
            'wind_solar',
            'nuclear',
            'steam_thermal',
            'other_electric'
        ];

        const LEGEND_ORDER_DEFAULT = [
            'transmission_distribution',
            'pipelines',
            'nuclear',
            'other_electric',  
            'hydraulic',
            'wind_solar',
            'steam_thermal'              
        ];

        const LEGEND_ORDER = windowWidth <= 1536 ? LEGEND_ORDER_ZOOMED : LEGEND_ORDER_DEFAULT;

        const traces = investment_by_asset_CATEGORY_ORDER.map((cat) => {
            // Use pre-calculated billions from database if available
            const values = pageData.map(d => d[`${cat}_billions`] ?? ((d[cat] || 0) / 1000));

            const hoverTexts = values.map((v, i) => {
                const y = years[i];
                const tot = totalValues[i];
                const catName = getText(investment_by_asset_HOVER_KEYS[cat], lang);
                const vFormatted = v < 1 ? v.toFixed(2) : v.toFixed(1);
                const totFormatted = tot < 1 ? tot.toFixed(2) : tot.toFixed(1);
                return `<b>${catName}</b><br>${y}: $${vFormatted}B<br>${getText('investment_by_asset_hover_total', lang)}: $${totFormatted}B`;
            });

            const legendRank = LEGEND_ORDER.indexOf(cat) + 2;

            const traceIndex = investment_by_asset_CATEGORY_ORDER.indexOf(cat);
            return {
                name: getText(investment_by_asset_LEGEND_KEYS[cat], lang),
                x: years,
                y: values,
                type: 'bar',
                marker: { 
                    color: investment_by_asset_COLORS[cat],
                    opacity: selectedPoints === null ? 1 : years.map((_, i) => selectedPoints[traceIndex]?.includes(i) ? 1 : 0.3)
                },
                hovertext: hoverTexts,
                hoverinfo: 'text',
                hoverlabel: {
                    bgcolor: '#ffffff',
                    bordercolor: '#000000',
                    font: { color: '#000000', size: windowWidth <= 480 ? 14 : windowWidth <= 768 ? 13 : 12, family: 'Arial, sans-serif' }
                },
                legendrank: legendRank
            };
        });

        const chartTitle = `${getText('investment_by_asset_chart_title_prefix', lang)}${minYear} ${lang === 'en' ? 'to' : 'à'} ${maxYear}`;

        return { traces, years, tickVals, minYear, maxYear, chartTitle, numTraces: investment_by_asset_CATEGORY_ORDER.length };
    }, [pageData, lang, windowWidth, selectedPoints]);

    const formatBillionSR = (val) => {
        const decimals = val < 1 ? 2 : 1;
        return lang === 'en' 
            ? `${val.toFixed(decimals)} billion dollars` 
            : `${val.toFixed(decimals)} milliards de dollars`;
    };

    const getChartDataSummary = () => {
        if (!pageData || pageData.length === 0) return '';

        const firstYear = pageData[0];
        const latestYear = pageData[pageData.length - 1];
        const firstYearNum = firstYear.year;
        const latestYearNum = latestYear.year;

        // Use pre-calculated total_billions from database if available
        let total = latestYear.total_billions ?? (() => {
            let t = 0;
            investment_by_asset_CATEGORY_ORDER.forEach(cat => {
                t += (latestYear[cat] || 0) / 1000;
            });
            return t;
        })();

        if (lang === 'en') {
            return `Stacked bar chart showing public and private investment in fuel, energy and pipeline infrastructure from ${firstYearNum} to ${latestYearNum}. Total investment in ${latestYearNum} was approximately ${formatBillionSR(total)}. Expand the data table below for detailed values.`;
        } else {
            return `Graphique à barres empilées montrant les investissements publics et privés dans les infrastructures de carburant, d'énergie et de pipeline de ${firstYearNum} à ${latestYearNum}. L'investissement total en ${latestYearNum} était d'environ ${formatBillionSR(total)}. Développez le tableau de données ci-dessous pour les valeurs détaillées.`;
        }
    };

    const formatNumber = (val) => {
        const decimals = val < 1 ? 2 : 1;
        return formatLocaleNumber(val, lang, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
    };

    const unitHeader = lang === 'en' ? '($ billions)' : '(milliards $)';
    const categoryLabels = useMemo(() => ({
        transmission_distribution: stripHtml(getText('investment_by_asset_legend_transmission', lang)),
        hydraulic: stripHtml(getText('investment_by_asset_legend_hydraulic', lang)),
        pipelines: stripHtml(getText('investment_by_asset_legend_pipelines', lang)),
        wind_solar: stripHtml(getText('investment_by_asset_legend_wind_solar', lang)),
        nuclear: stripHtml(getText('investment_by_asset_legend_nuclear', lang)),
        steam_thermal: stripHtml(getText('investment_by_asset_legend_steam', lang)),
        other_electric: stripHtml(getText('investment_by_asset_legend_other', lang)),
    }), [lang]);

    const tableFilenameBase = lang === 'en' ? 'capital_expenditures' : 'depenses_en_capital';
    const exportChartTitle = chartData?.chartTitle
        ? stripHtml(chartData.chartTitle)
        : stripHtml(getText('investment_by_asset_chart_title_prefix', lang));
    const tableCaption = lang === 'en'
        ? 'Public and private investment in fuel, energy and pipeline infrastructure (billions of constant 2012 dollars)'
        : 'Investissements publics et privés dans les infrastructures de carburant, d\'énergie et de pipeline (milliards de dollars constants de 2012)';
    const tableTitle = exportChartTitle || stripHtml(getText('investment_by_asset_title', lang));

    const tableColumns = useMemo(() => [
        { key: 'year', header: lang === 'en' ? 'Year' : 'Année', align: 'left' },
        ...investment_by_asset_CATEGORY_ORDER.map((cat) => ({
            key: cat,
            header: `${categoryLabels[cat]} ${unitHeader}`,
            align: 'num',
        })),
        { key: 'total', header: `${lang === 'en' ? 'Total' : 'Total'} ${unitHeader}`, align: 'num' },
    ], [lang, categoryLabels, unitHeader]);

    const tableRows = useMemo(() => pageData.map((yearData) => {
        const row = { year: yearData.year };
        investment_by_asset_CATEGORY_ORDER.forEach((cat) => {
            row[cat] = yearData[`${cat}_billions`] ?? ((yearData[cat] || 0) / 1000);
        });
        row.total = yearData.total_billions ?? (() => {
            let t = 0;
            investment_by_asset_CATEGORY_ORDER.forEach((cat) => { t += (yearData[cat] || 0) / 1000; });
            return t;
        })();
        return row;
    }), [pageData]);

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: lang === 'en' ? 'capital_expenditures_chart.png' : 'depenses_en_capital_graphique.png',
        title: exportChartTitle,
        height: 600,
    }),
        [exportChartTitle, lang],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

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

    if (!chartData) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>No data available. Please refresh the page.</div>;
    }

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-27" 
            role="main"
            aria-label={getText('investment_by_asset_title', lang)}
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

                .page-27 {
                    margin-right: -${layoutPadding?.right || 15}px;
                    width: calc(100% + ${layoutPadding?.right || 15}px);
                    padding-right: ${layoutPadding?.right || 15}px; 
                }

                .investment-by-asset-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 41px;
                    font-weight: bold;
                    color: var(--gc-text);
                    margin-top: 0;
                    margin-bottom: 25px;
                    text-align: left;
                    position: relative;
                    padding-bottom: 0.5em;
                }

                .investment-by-asset-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }

                .investment-by-asset-body-text {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    max-width: 80ch;
                }

                .investment-by-asset-container {
                    width: 100%;
                    padding: 10px 0 0 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    flex: 1;
                    overflow: visible;
                }

                .investment-by-asset-container .chart-region {
                    width: 100%;
                }

                .investment-by-asset-chart {
                    width: 100%;
                    height: calc(100vh - 380px);
                    min-height: 350px;
                }

                @media (max-width: 1745px) {
                    .investment-by-asset-chart {
                        height: calc(100vh - 280px);
                        min-height: 380px;
                    }
                }

                @media (max-width: 1536px) {
                    .investment-by-asset-chart {
                        height: calc(100vh - 220px);
                        min-height: 360px;
                    }
                }

                @media (max-width: 1280px) {
                    .investment-by-asset-chart {
                        height: calc(100vh - 160px);
                        min-height: 340px;
                    }
                }

                @media (max-width: 1097px) {
                    .investment-by-asset-chart {
                        height: calc(100vh - 120px);
                        min-height: 320px;
                    }
                }

                @media (max-width: 960px) {
                    .investment-by-asset-chart {
                        height: calc(100vh - 80px);
                        min-height: 300px;
                    }
                }

                @media (max-width: 768px) {
                    .page-27 { border-right: none !important; }
                    .investment-by-asset-title {
                        font-size: 37px !important;
                        text-align: left !important;
                    }
                    .investment-by-asset-body-text {
                        font-size: 18px;
                    }
                    .investment-by-asset-chart {
                        height: calc(100vh - 20px);
                        min-height: 280px;
                    }
                }

                @media (max-width: 640px) {
                    .investment-by-asset-title {
                        font-size: 32px !important;
                    }
                    .investment-by-asset-chart {
                        height: calc(100vh + 100px);
                        min-height: 260px;
                    }
                }

                @media (max-width: 480px) {
                    .investment-by-asset-title {
                        font-size: 28px !important;
                    }
                    .investment-by-asset-chart {
                        height: calc(100vh + 200px) !important;
                        min-height: 200px;
                    }
                }

                @media (max-width: 384px) {
                    .investment-by-asset-title {
                        font-size: 24px !important;
                    }
                    .investment-by-asset-chart {
                        height: calc(100% + 160px) !important;
                        min-height: 400px;
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

                .investment-by-asset-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    box-sizing: border-box;
                }

                .investment-by-asset-table-wrapper {
                    display: block;
                    width: 100%;
                    margin: 0;
                }

                .investment-by-asset-chart-frame button[type="button"]:hover,
                .investment-by-asset-chart-frame button:hover {
                    background-color: #404040 !important;
                }
            `}</style>

            <div className="investment-by-asset-container">
                <header 
                    role="region"
                    aria-label={chartData.chartTitle}
                >
                    <h1 className="investment-by-asset-title" aria-hidden="true">
                        {chartData.chartTitle}
                    </h1>
                </header>

                <div className="investment-by-asset-chart-frame">
                <div 
                    role="region"
                    aria-label={getChartDataSummary()}
                    tabIndex="0"
                >
                    {selectedPoints !== null && (
                            <ClearSelectionButton lang={lang} onClick={clearSelection} />
                        )}
                        <figure ref={chartRef} style={{ margin: 0, position: 'relative' }}>
                        <div aria-hidden="true">
                        <Plot
                            data={chartData.traces}
                            layout={{
                                barmode: 'stack',
                                hovermode: 'closest',
                                clickmode: 'event',
                                dragmode: false,
                                xaxis: {
                                    tickvals: chartData.tickVals,
                                    showgrid: false,
                                    zeroline: false,
                                    range: [chartData.minYear - 0.5, chartData.maxYear + 0.5],
                                    tickangle: windowWidth <= 640 ? -45 : 0,
                                    tickfont: { size: windowWidth <= 480 ? 10 : 11, family: 'Arial, sans-serif' },
                                    automargin: true,
                                },
                                yaxis: {
                                    title: { 
                                        text: windowWidth <= 640 
                                            ? (lang === 'en' ? '$ billion<br>(constant 2012 $)' : 'milliards $<br>($ constants 2012)')
                                            : windowWidth <= 1097
                                                ? (lang === 'en' ? '$ billion<br>(constant 2012 dollars)' : 'En milliards de $<br>(dollars constants de 2012)')
                                                : getText('investment_by_asset_yaxis', lang), 
                                        font: { size: windowWidth <= 768 ? 12 : windowWidth <= 960 ? 14 : windowWidth <= 1280 ? 16 : 18, family: 'Arial, sans-serif' },
                                        standoff: 5
                                    },
                                    range: [0, 32],
                                    dtick: 5,
                                    showgrid: false,
                                    showline: true,
                                    linewidth: 1,
                                    linecolor: '#333',
                                    automargin: true,
                                    tickfont: { size: windowWidth <= 480 ? 9 : 10, family: 'Arial, sans-serif' }
                                },
                                legend: {
                                    orientation: 'h',
                                    x: legendSettings.x,
                                    xanchor: legendSettings.xanchor,
                                    y: legendSettings.y,
                                    yanchor: 'top',
                                    entrywidth: legendSettings.width,
                                    entrywidthmode: 'fraction',
                                    font: { size: legendSettings.fontSize, family: 'Arial, sans-serif' },
                                    traceorder: 'normal',
                                    itemclick: false,
                                    itemdoubleclick: false
                                },
                                margin: { 
                                    l: 0, 
                                    r: 0,
                                    t: 10, 
                                    b: legendSettings.margin
                                },
                                autosize: true,
                                bargap: 0.15,
                                paper_bgcolor: 'rgba(0,0,0,0)',
                                plot_bgcolor: 'rgba(0,0,0,0)'
                            }}
                            className="investment-by-asset-chart"
                            useResizeHandler={true}
                            onClick={handleChartClick}
                            config={plotConfig}
                        />
                        </div>
                    </figure>

                    <div className="investment-by-asset-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={`${tableFilenameBase}_data.csv`}
                            docx={{
                                filename: `${tableFilenameBase}_table.docx`,
                                title: tableTitle,
                                titleAlign: 'center',
                                columnWidths: [900, 1100, 1100, 1100, 1100, 1100, 1100, 1100, 1000],
                                fontSize: 18,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                            renderCell={(raw, { colIndex }) => {
                                if (colIndex === 0) return String(raw ?? '');
                                const formatted = formatNumber(Number(raw) || 0);
                                return colIndex === tableColumns.length - 1
                                    ? <strong>{formatted}</strong>
                                    : formatted;
                            }}
                        />
                    </div>
                </div>
                </div> {/* End chart-frame */}
            </div>
        </main>
    );
};

export default InvestmentByAsset;
