import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import SafeHtml from '../components/SafeHtml';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getForeignControlData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import { formatLocalePct } from '../utils/formatLocale';

const foreign_control_COLORS = {
    utilities: '#284162',
    oil_gas: '#419563',
    all_non_financial: '#8B7355',
};

const ForeignControl = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const {
        selected: selectedPoints,
        clear,
        onPlotClick: handleChartClick,
        opacityFor,
    } = usePlotlySelection({ mode: 'points', traceCount: 3, windowWidth });
    const chartRef = useRef(null);

    const formatPct = (val) => formatLocalePct(val, lang, {
        suffix: false,
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });

    useEffect(() => {
        getForeignControlData()
            .then((foreignData) => {
                setChartData(foreignData);
            })
            .catch((err) => {
                console.error('Failed to load foreign control data:', err);
                setError(err.message || 'Failed to load data');
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    const years = useMemo(() => chartData.map((d) => d.year), [chartData]);
    const utilitiesValues = useMemo(() => chartData.map((d) => d.utilities || 0), [chartData]);
    const oilGasValues = useMemo(() => chartData.map((d) => d.oil_gas || 0), [chartData]);
    const allIndustriesValues = useMemo(
        () => chartData.map((d) => d.all_non_financial || 0),
        [chartData],
    );

    const legendUtilities = getText('foreign_control_legend_utilities', lang);
    const legendOilGas = getText('foreign_control_legend_oil_gas', lang);
    const legendAllIndustries = getText('foreign_control_legend_all_industries', lang);

    const pageTitle = getText('foreign_control_title', lang);
    const chartTitle = getText('foreign_control_chart_title', lang);
    const exportChartTitle = stripHtml(chartTitle);
    const yAxisTitle = getText('foreign_control_yaxis', lang);

    const chartDownloadSlug = lang === 'en'
        ? 'foreign_control_of_canadian_assets'
        : 'controle_etranger_actifs_canadiens';

    const tableCaption = lang === 'en'
        ? 'Foreign control of Canadian assets (percentage of total assets)'
        : "Contrôle étranger d'actifs canadiens (pourcentage des actifs totaux)";

    const unitHeader = '(%)';
    const tableColumns = useMemo(() => [
        { key: 'year', header: lang === 'en' ? 'Year' : 'Année', align: 'left' },
        { key: 'utilities', header: `${legendUtilities} ${unitHeader}`, align: 'num' },
        { key: 'oil_gas', header: `${legendOilGas} ${unitHeader}`, align: 'num' },
        { key: 'all_non_financial', header: `${legendAllIndustries} ${unitHeader}`, align: 'num' },
    ], [lang, legendUtilities, legendOilGas, legendAllIndustries]);

    const tableRows = useMemo(
        () => chartData.map((d) => ({
            year: d.year,
            utilities: d.utilities || 0,
            oil_gas: d.oil_gas || 0,
            all_non_financial: d.all_non_financial || 0,
        })),
        [chartData],
    );

    const minYear = years.length ? Math.min(...years) : null;
    const maxYear = years.length ? Math.max(...years) : null;
    const tickVals = useMemo(() => {
        if (maxYear == null) return [];
        const vals = [];
        for (let y = 2010; y <= maxYear; y += 2) vals.push(y);
        return vals;
    }, [maxYear]);

    const getChartSummary = () => {
        if (!years.length) return '';
        const body = summarizeByCategory({
            categories: years,
            series: [
                { name: legendAllIndustries, values: allIndustriesValues, format: (v) => `${formatPct(v)}%` },
                { name: legendOilGas, values: oilGasValues, format: (v) => `${formatPct(v)}%` },
                { name: legendUtilities, values: utilitiesValues, format: (v) => `${formatPct(v)}%` },
            ],
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Grouped bar chart showing foreign control of Canadian assets from ${minYear} to ${maxYear}`
                : `Graphique à barres groupées montrant le contrôle étranger des actifs canadiens de ${minYear} à ${maxYear}`,
            unitNote: lang === 'en' ? 'Values in percent of total assets' : 'Valeurs en pourcentage des actifs totaux',
            body,
        });
    };

    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const hoverFontSize = windowWidth <= 480 ? 12 : 14;

    const traces = useMemo(() => {
        if (!years.length) return [];
        const buildHoverText = (values, label) => values.map((v, i) => (
            `<b>${label}</b><br>${years[i]}: ${formatPct(v)}%`
        ));
        const opacityForTrace = (traceIndex) => (
            selectedPoints === null
                ? 1
                : years.map((_, i) => opacityFor(traceIndex, i))
        );
        const hoverlabel = {
            bgcolor: '#ffffff',
            bordercolor: '#000000',
            font: { color: '#000000', size: hoverFontSize, family: 'Arial, sans-serif' },
        };
        return [
            {
                name: legendAllIndustries,
                x: years,
                y: allIndustriesValues,
                type: 'bar',
                marker: {
                    color: foreign_control_COLORS.all_non_financial,
                    opacity: opacityForTrace(0),
                },
                hovertext: buildHoverText(allIndustriesValues, getText('foreign_control_hover_all_industries', lang)),
                hoverinfo: 'text',
                hoverlabel,
            },
            {
                name: legendOilGas,
                x: years,
                y: oilGasValues,
                type: 'bar',
                marker: {
                    color: foreign_control_COLORS.oil_gas,
                    opacity: opacityForTrace(1),
                },
                hovertext: buildHoverText(oilGasValues, getText('foreign_control_hover_oil_gas', lang)),
                hoverinfo: 'text',
                hoverlabel,
            },
            {
                name: legendUtilities,
                x: years,
                y: utilitiesValues,
                type: 'bar',
                marker: {
                    color: foreign_control_COLORS.utilities,
                    opacity: opacityForTrace(2),
                },
                hovertext: buildHoverText(utilitiesValues, getText('foreign_control_hover_utilities', lang)),
                hoverinfo: 'text',
                hoverlabel,
            },
        ];
    }, [
        years,
        allIndustriesValues,
        oilGasValues,
        utilitiesValues,
        selectedPoints,
        opacityFor,
        lang,
        legendAllIndustries,
        legendOilGas,
        legendUtilities,
        hoverFontSize,
        formatPct,
    ]);

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${chartDownloadSlug}.png`,
        title: exportChartTitle,
        height: 600,
        legendItems: [
            { label: legendAllIndustries, color: foreign_control_COLORS.all_non_financial },
            { label: legendOilGas, color: foreign_control_COLORS.oil_gas },
            { label: legendUtilities, color: foreign_control_COLORS.utilities },
        ],
    }),
        [chartDownloadSlug, exportChartTitle, foreign_control_COLORS, legendAllIndustries, legendOilGas, legendUtilities],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const sectionBold = getText('foreign_control_section_bold_text', lang);
    const sectionHtml = getText('foreign_control_section_text', lang).replace(
        sectionBold,
        `<span class="visual-bold">${sectionBold}</span>`,
    );

    

    if (loading || error) {
        return (
            <PageShell
                className="page-content page-32 page-chrome page-chrome--bleed"
                aria-label={pageTitle}
                style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
            >
                <PageStatus
                    lang={lang}
                    loading={loading}
                    error={error}
                    style={{ padding: '24px', fontFamily: 'Arial, sans-serif' }}
                />
            </PageShell>
        );
    }

    if (!years.length) {
        return (
            <PageShell
                className="page-content page-32 page-chrome page-chrome--bleed"
                aria-label={pageTitle}
                style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
            >
                <p style={{ padding: '24px', fontFamily: 'Arial, sans-serif' }}>
                    {lang === 'en' ? 'No data available. Please refresh the page.' : 'Aucune données disponibles. Veuillez actualiser la page.'}
                </p>
            </PageShell>
        );
    }

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-32 page-chrome page-chrome--bleed"
            aria-labelledby="foreign-control-main-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
                .page-32.page-content {
                    max-width: none !important;
                    overflow-x: visible !important;
                }
                .foreign-control-container {
                    width: 100%;
                    padding: 15px 0 40px 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                }
                .page-32.page-content h1.foreign-control-title {
                    font-size: 41px !important;
                }
                .foreign-control-section-text {
                    font-family: 'Noto Sans', sans-serif;
                    color: var(--gc-text);
                    font-size: 20px;
                    margin: 0 0 20px 0;
                    line-height: 1.5;
                }
                .visual-bold { font-weight: bold; }
                .foreign-control-chart-frame {
                    margin-top: 8px;
                }
                .foreign-control-chart-title {
                    color: var(--gc-text);
                    margin: 0 0 12px 0;
                }
                .foreign-control-chart {
                    width: 100%;
                    min-width: 0;
                    height: ${plotHeight}px;
                    position: relative;
                }
                .foreign-control-chart > div { width: 100%; height: 100%; }
                .foreign-control-table-wrapper {
                    display: block;
                    width: 100%;
                    margin-top: 20px;
                }
                @media (max-width: 768px) {
                    .page-32.page-content h1.foreign-control-title {
                        font-size: 37px !important;
                    }
                    .foreign-control-section-text { font-size: 18px; }
                }
                @media (max-width: 480px) {
                    .foreign-control-chart { height: 320px; }
                }
            `}</style>

            <div className="foreign-control-container">
                <h1 id="foreign-control-main-title" className="foreign-control-title page-chrome-title">
                    {pageTitle}
                </h1>

                <SafeHtml
                    as="p"
                    className="foreign-control-section-text"
                    html={sectionHtml}
                />

                <div className="foreign-control-chart-frame page-chrome-chart-frame">
                    <h2 className="foreign-control-chart-title page-chrome-chart-title">{chartTitle}</h2>

                    {selectedPoints !== null && <ClearSelectionButton lang={lang} onClick={clear} />}

                    <figure ref={chartRef} style={{ margin: 0 }}>
                        <div role="region" aria-label={`${exportChartTitle}. ${getChartSummary()}`} tabIndex="0">
                            <div aria-hidden="true">
                                <Plot
                                    data={traces}
                                    layout={{
                                        barmode: 'group',
                                        hovermode: 'closest',
                                        clickmode: 'event',
                                        dragmode: false,
                                        showlegend: true,
                                        legend: {
                                            orientation: windowWidth <= 1280 ? 'h' : 'v',
                                            x: windowWidth <= 1280 ? 0.5 : 1.02,
                                            xanchor: windowWidth <= 1280 ? 'center' : 'left',
                                            y: windowWidth <= 1280 ? -0.1 : 0.1,
                                            yanchor: windowWidth <= 1280 ? 'top' : 'middle',
                                            font: { size: windowWidth <= 480 ? 13 : 16, family: 'Arial, sans-serif' },
                                            itemclick: false,
                                            itemdoubleclick: false,
                                        },
                                        xaxis: {
                                            tickvals: tickVals,
                                            showgrid: false,
                                            zeroline: false,
                                            range: [minYear - 0.5, maxYear + 0.5],
                                            tickangle: windowWidth <= 640 ? -45 : 0,
                                            tickfont: { size: windowWidth <= 480 ? 11 : 12, family: 'Arial, sans-serif' },
                                            automargin: true,
                                        },
                                        yaxis: {
                                            title: {
                                                text: yAxisTitle,
                                                font: {
                                                    size: windowWidth <= 768 ? 14 : windowWidth <= 960 ? 16 : 18,
                                                    family: 'Arial, sans-serif',
                                                    color: '#333',
                                                },
                                                standoff: 5,
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
                                            tickfont: { size: windowWidth <= 480 ? 11 : 12, family: 'Arial, sans-serif' },
                                        },
                                        margin: {
                                            l: 0,
                                            r: 0,
                                            t: 20,
                                            b: windowWidth <= 1280 ? 80 : 50,
                                        },
                                        autosize: true,
                                        height: plotHeight,
                                        bargap: 0.15,
                                        bargroupgap: 0.1,
                                        paper_bgcolor: 'rgba(0,0,0,0)',
                                        plot_bgcolor: 'rgba(0,0,0,0)',
                                    }}
                                    style={{ width: '100%', height: '100%' }}
                                    className="foreign-control-chart"
                                    useResizeHandler
                                    onClick={handleChartClick}
                                    config={plotConfig}
                                />
                            </div>
                        </div>
                    </figure>

                    <div className="foreign-control-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={`${chartDownloadSlug}.csv`}
                            docx={{
                                filename: `${chartDownloadSlug}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [1800, 2200, 2200, 3000],
                                fontSize: 22,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatPct(raw)
                            )}
                        />
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default ForeignControl;
