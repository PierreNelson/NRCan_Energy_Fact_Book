import React, { useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import PageFootnotes from '../components/PageFootnotes';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import HtmlLegend from '../components/HtmlLegend';
import { formatLocaleNumber } from '../utils/formatLocale';

const DATA = [
    { year: 2018, direct: 119, indirect: 30, total: 149 },
    { year: 2019, direct: 120, indirect: 28, total: 148 },
    { year: 2020, direct: 77, indirect: 20, total: 97 },
    { year: 2021, direct: 148, indirect: 33, total: 182 },
    { year: 2022, direct: 219, indirect: 48, total: 267 },
    { year: 2023, direct: 175, indirect: 40, total: 215 },
    { year: 2024, direct: 172, indirect: 39, total: 211 }
];

const COLORS = {
    direct: '#6191AE',
    indirect: '#7C9E33',
    total: '#344653'
};

const PetroleumGdp = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    /** null = no focus; otherwise whole line traces (0=direct, 1=indirect, 2=total) included here stay full opacity. */
    const {
        selected: selectedTraceIds,
        clear: clearSelection,
        toggleSlice,
    } = usePlotlySelection({ mode: 'slices', windowWidth });
    const chartRef = useRef(null);

    const handleChartClick = (data) => {
        if (!data.points || data.points.length === 0) return;
        const traceIndex = data.points[0].curveNumber;
        if (traceIndex === undefined || traceIndex < 0 || traceIndex > 2) return;
        toggleSlice(traceIndex);
    };

    const formatCurrency = (num) => {
        if (num === undefined || num === null) return '\u2014';
        const formatted = formatLocaleNumber(num, lang, { maximumFractionDigits: 0 });
        return lang === 'en' ? `$${formatted}` : `${formatted} $`;
    };

    const years = DATA.map((d) => d.year);
    const directValues = DATA.map((d) => d.direct);
    const indirectValues = DATA.map((d) => d.indirect);
    const totalValues = DATA.map((d) => d.total);

    const directLabel = getText('petroleum_gdp_legend_direct', lang);
    const indirectLabel = getText('petroleum_gdp_legend_indirect', lang);
    const totalLabel = getText('petroleum_gdp_legend_total', lang);

    const chartTitle = getText('petroleum_gdp_chart_title', lang);
    const chartTitlePlain = stripHtml(chartTitle);
    const exportChartTitle = `${chartTitlePlain} (2018-2024)`;
    const chartSubtitle = getText('petroleum_gdp_chart_subtitle', lang);
    const unitText = lang === 'en' ? 'billions of dollars' : 'milliards de dollars';
    const tableCaption = getText('petroleum_gdp_table_caption', lang);

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('petroleum_gdp_table_col_year', lang), align: 'left' },
        { key: 'direct', header: `${directLabel} (${unitText})`, align: 'num' },
        { key: 'indirect', header: `${indirectLabel} (${unitText})`, align: 'num' },
        { key: 'total', header: `${totalLabel} (${unitText})`, align: 'num' },
    ], [lang, directLabel, indirectLabel, totalLabel, unitText]);

    const getChartSummary = () => {
        const body = summarizeByCategory({
            categories: years,
            series: [
                {
                    name: directLabel,
                    values: directValues,
                    format: (v) => (lang === 'en' ? `$${formatLocaleNumber(v, lang, { maximumFractionDigits: 0 })}B` : `${formatLocaleNumber(v, lang, { maximumFractionDigits: 0 })} G$`),
                },
                {
                    name: indirectLabel,
                    values: indirectValues,
                    format: (v) => (lang === 'en' ? `$${formatLocaleNumber(v, lang, { maximumFractionDigits: 0 })}B` : `${formatLocaleNumber(v, lang, { maximumFractionDigits: 0 })} G$`),
                },
                {
                    name: totalLabel,
                    values: totalValues,
                    format: (v) => (lang === 'en' ? `$${formatLocaleNumber(v, lang, { maximumFractionDigits: 0 })}B` : `${formatLocaleNumber(v, lang, { maximumFractionDigits: 0 })} G$`),
                },
            ],
            lang,
            newestFirst: true,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? 'Line chart showing petroleum sector GDP from 2018 to 2024'
                : 'Graphique linéaire montrant le PIB du secteur pétrolier de 2018 à 2024',
            unitNote: lang === 'en' ? 'Values in billions of dollars' : 'Valeurs en milliards de dollars',
            body,
        });
    };

    const fileSlugBase = `${chartTitlePlain
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'petroleum-gdp'}-2018-2024`;

    const hoverTemplate = (label, values) =>
        values.map((val, i) => {
            const yearVal = years[i];
            const formatted = lang === 'en' ? `$${formatLocaleNumber(val, lang, { maximumFractionDigits: 0 })}B` : `${formatLocaleNumber(val, lang, { maximumFractionDigits: 0 })} G$`;
            return `<b>${label}</b><br>${yearVal}: ${formatted}<extra></extra>`;
        });

    const plotBottomMargin = windowWidth <= 480 ? 72 : windowWidth <= 768 ? 62 : 50;
    const plotTopMargin = windowWidth <= 480 ? 48 : 40;

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${fileSlugBase}.png`,
        title: exportChartTitle,
        subtitle: stripHtml(chartSubtitle),
        legendItems: [
            { label: directLabel, color: COLORS.direct, dash: true },
            { label: indirectLabel, color: COLORS.indirect, dash: true },
            { label: totalLabel, color: COLORS.total, dash: false },
        ],
    }),
        [COLORS, chartSubtitle, directLabel, exportChartTitle, fileSlugBase, indirectLabel, stripHtml, totalLabel],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        name: getText('petroleum_gdp_download_chart', lang),
        click: (gd) => downloadChartWithTitle(gd),
    });



    

    return (
        <PageShell tabIndex="-1"
            className="page-content page-107 page-chrome page-chrome--bleed"
            aria-labelledby="petroleum-gdp-chart-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
                .page-107.page-content {
                    max-width: none !important;
                    overflow-x: visible !important;
                }

                .page-107 {
                }

                .petroleum-gdp-container {
                    width: 100%;
                    padding: 15px 0 40px 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                }

                .petroleum-gdp-chart-frame {
                    margin-bottom: 0;
                }

                .petroleum-gdp-chart-title {
                    color: var(--gc-text);
                    margin: 0 0 5px 0;
                }

                .petroleum-gdp-chart-subtitle {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    color: var(--gc-text);
                    text-align: center;
                    margin: 0 0 15px 0;
                }

                .petroleum-gdp-chart-block {
                    display: flex;
                    flex-direction: column;
                    align-items: stretch;
                    width: 100%;
                }

                .petroleum-gdp-chart {
                    width: 100%;
                    height: 300px;
                    flex-shrink: 0;
                    position: relative;
                    margin-bottom: 0 !important;
                }

                .petroleum-gdp-legend {
                    gap: 15px 40px;
                    margin-top: 20px;
                    margin-bottom: 20px;
                    font-family: 'Noto Sans', sans-serif;
                    padding: 10px 20px;
                    flex-shrink: 0;
                }

                .petroleum-gdp-legend-label {
                    font-size: 18px;
                    color: var(--gc-text);
                }

                .petroleum-gdp-table-wrapper {
                    display: block;
                    width: 100%;
                    margin-top: 20px;
                    margin-bottom: 0;
                }

                @media (max-width: 768px) {
                    .petroleum-gdp-chart-subtitle { font-size: 18px; }
                    .petroleum-gdp-legend { flex-wrap: wrap; gap: 20px; }
                    .petroleum-gdp-legend-label { font-size: 16px; }
                }

                @media (max-width: 480px) {
                    .petroleum-gdp-chart { height: 275px; }
                    .petroleum-gdp-legend-label { font-size: 14px; }
                }
            `}</style>

            <div className="petroleum-gdp-container">
                <div className="petroleum-gdp-chart-frame page-chrome-chart-frame">
                    <h2 id="petroleum-gdp-chart-title" className="petroleum-gdp-chart-title page-chrome-chart-title">
                        {chartTitle}
                    </h2>
                    <p className="petroleum-gdp-chart-subtitle">{chartSubtitle}</p>

                    <div className="petroleum-gdp-chart-block">
                        <div role="region" aria-label={`${chartTitlePlain}. ${getChartSummary()}`} tabIndex="0">
                            {selectedTraceIds !== null && <ClearSelectionButton lang={lang} onClick={clearSelection} />}
                            <figure ref={chartRef} style={{ margin: 0, position: 'relative' }}>
                                <div aria-hidden="true">
                                    <Plot
                                        data={[
                                            {
                                                x: years,
                                                y: directValues,
                                                type: 'scatter',
                                                mode: 'lines+markers',
                                                name: directLabel,
                                                line: { color: COLORS.direct, width: 2, dash: 'dash' },
                                                marker: { color: COLORS.direct, size: 6 },
                                                opacity:
                                                    selectedTraceIds === null
                                                        ? 1
                                                        : selectedTraceIds.includes(0)
                                                          ? 1
                                                          : 0.3,
                                                hovertemplate: hoverTemplate(directLabel, directValues)
                                            },
                                            {
                                                x: years,
                                                y: indirectValues,
                                                type: 'scatter',
                                                mode: 'lines+markers',
                                                name: indirectLabel,
                                                line: { color: COLORS.indirect, width: 2, dash: 'dash' },
                                                marker: { color: COLORS.indirect, size: 6 },
                                                opacity:
                                                    selectedTraceIds === null
                                                        ? 1
                                                        : selectedTraceIds.includes(1)
                                                          ? 1
                                                          : 0.3,
                                                hovertemplate: hoverTemplate(indirectLabel, indirectValues)
                                            },
                                            {
                                                x: years,
                                                y: totalValues,
                                                type: 'scatter',
                                                mode: 'lines+markers',
                                                name: totalLabel,
                                                line: { color: COLORS.total, width: 3, dash: 'solid' },
                                                marker: { color: COLORS.total, size: 8 },
                                                opacity:
                                                    selectedTraceIds === null
                                                        ? 1
                                                        : selectedTraceIds.includes(2)
                                                          ? 1
                                                          : 0.3,
                                                hovertemplate: hoverTemplate(totalLabel, totalValues)
                                            }
                                        ]}
                                        layout={{
                                            hoverlabel: {
                                                bgcolor: '#ffffff',
                                                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' }
                                            },
                                            hovermode: 'closest',
                                            clickmode: 'event',
                                            dragmode: false,
                                            xaxis: {
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                tickfont: {
                                                    size: windowWidth <= 480 ? 12 : windowWidth <= 768 ? 14 : 16,
                                                    family: 'Arial, sans-serif'
                                                },
                                                tickmode: 'array',
                                                tickvals: years,
                                                ticktext: years.map(String),
                                                automargin: true
                                            },
                                            yaxis: {
                                                showgrid: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                zeroline: false,
                                                tickfont: {
                                                    size: windowWidth <= 480 ? 12 : windowWidth <= 768 ? 14 : 16,
                                                    family: 'Arial, sans-serif'
                                                },
                                                range: [0, 300],
                                                dtick: 50,
                                                automargin: true
                                            },
                                            showlegend: false,
                                            margin: {
                                                l: 50,
                                                r: 20,
                                                t: plotTopMargin,
                                                b: plotBottomMargin
                                            },
                                            autosize: true,
                                            paper_bgcolor: 'rgba(0,0,0,0)',
                                            plot_bgcolor: 'rgba(0,0,0,0)'
                                        }}
                                        config={plotConfig}
                                        className="petroleum-gdp-chart"
                                        useResizeHandler={true}
                                        onClick={handleChartClick}
                                    />
                                </div>
                            </figure>
                        </div>

                        <HtmlLegend
                            className="petroleum-gdp-legend"
                            variant="line"
                            itemClassName="petroleum-gdp-legend-item"
                            markerClassName="petroleum-gdp-legend-line"
                            labelClassName="petroleum-gdp-legend-label"
                            items={[
                                { label: directLabel, color: COLORS.direct, dash: true },
                                { label: indirectLabel, color: COLORS.indirect, dash: true },
                                { label: totalLabel, color: COLORS.total },
                            ]}
                        />
                    </div>

                    <div className="petroleum-gdp-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            className="petroleum-gdp-data-table"
                            columns={tableColumns}
                            rows={DATA}
                            csvFilename={`${fileSlugBase}.csv`}
                            docx={{
                                filename: `${fileSlugBase}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [1500, 2500, 2500, 2500],
                                fontSize: 20,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatCurrency(raw)
                            )}
                        />
                    </div>
                </div>

                <PageFootnotes
                    lang={lang}
                    titleId="fn-petroleum-gdp"
                    items={[{
                        id: 'fn-asterisk-petroleum-gdp',
                        marker: '*',
                        text: getText('petroleum_gdp_footnote', lang),
                        hideReturn: true,
                    }]}
                />
            </div>
        </PageShell>
    );
};

export default PetroleumGdp;
