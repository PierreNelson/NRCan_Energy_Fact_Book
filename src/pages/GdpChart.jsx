import React, { useMemo, useRef } from 'react';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import FootnoteMarker from '../components/FootnoteMarker';
import PageFootnotes from '../components/PageFootnotes';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import HtmlLegend from '../components/HtmlLegend';
import hexToRgba from '../utils/hexToRgba';
import { formatLocaleNumber } from '../utils/formatLocale';

import { makeScrollToIdHandler } from '../utils/scrollToId';

const COLORS = {
    direct: '#33bccb',
    indirect: '#7a9a9e',
    total: '#857650'
};

const gdpData = [
    { year: 2018, direct: 163, indirect: 36, total: 199 },
    { year: 2019, direct: 165, indirect: 36, total: 202 },
    { year: 2020, direct: 121, indirect: 30, total: 150 },
    { year: 2021, direct: 198, indirect: 43, total: 241 },
    { year: 2022, direct: 277, indirect: 58, total: 335 },
    { year: 2023, direct: 235, indirect: 51, total: 286 },
    { year: 2024, direct: 232, indirect: 50, total: 282 }
];

const GdpChart = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const {
        selected: selectedPoints,
        clear,
        onPlotClick,
    } = usePlotlySelection({ mode: 'points', traceCount: 3, windowWidth });
    const chartRef = useRef(null);

    const formatCurrency = (num) => {
        if (num === undefined || num === null) return '—';
        const formatted = formatLocaleNumber(num, lang, { maximumFractionDigits: 0 });
        return lang === 'en' ? `$${formatted}` : `${formatted} $`;
    };

    const chartTitle = getText('gdp_chart_chart_title', lang);
    const exportChartTitle = `${stripHtml(chartTitle)} (2018-2024)`;
    const chartSubtitle = getText('gdp_chart_chart_subtitle', lang);
    const chartDownloadSlug = lang === 'en' ? 'energy-sector-gdp-2018-2024' : 'pib-secteur-energie-2018-2024';

    const directLabel = getText('gdp_chart_legend_direct', lang);
    const indirectLabel = getText('gdp_chart_legend_indirect', lang);
    const totalLabel = getText('gdp_chart_legend_total', lang);

    const unitText = lang === 'en' ? 'billions of dollars' : 'milliards de dollars';
    const chartTitleSpoken = `${stripHtml(chartTitle)}, ${unitText}`;
    const tableCaption = lang === 'en'
        ? 'Energy sector GDP data from 2018 to 2024'
        : "Données du PIB du secteur de l'énergie de 2018 à 2024";

    const tableColumns = useMemo(() => [
        { key: 'year', header: lang === 'en' ? 'Year' : 'Année', align: 'left' },
        { key: 'direct', header: `${directLabel} (${unitText})`, align: 'num' },
        { key: 'indirect', header: `${indirectLabel} (${unitText})`, align: 'num' },
        { key: 'total', header: `${totalLabel} (${unitText})`, align: 'num' },
    ], [lang, directLabel, indirectLabel, totalLabel, unitText]);

    const scrollToFootnote = makeScrollToIdHandler('fn-asterisk-gdp-chart');

    const years = gdpData.map(d => d.year);
    const directValues = gdpData.map(d => d.direct);
    const indirectValues = gdpData.map(d => d.indirect);
    const totalValues = gdpData.map(d => d.total);

    const getChartSummary = () => {
        const body = summarizeByCategory({
            categories: years,
            series: [
                { name: directLabel, values: directValues, format: (v) => `${formatLocaleNumber(v, lang, { maximumFractionDigits: 0 })} ${unitText}` },
                { name: indirectLabel, values: indirectValues, format: (v) => `${formatLocaleNumber(v, lang, { maximumFractionDigits: 0 })} ${unitText}` },
                { name: totalLabel, values: totalValues, format: (v) => `${formatLocaleNumber(v, lang, { maximumFractionDigits: 0 })} ${unitText}` },
            ],
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? 'Line chart showing energy sector GDP from 2018 to 2024'
                : "Graphique linéaire montrant le PIB du secteur de l'énergie de 2018 à 2024",
            body,
        });
    };

    const getLineColors = (baseColor, traceIndex) => {
        if (selectedPoints === null) return baseColor;
        if (selectedPoints[traceIndex] && selectedPoints[traceIndex].length > 0) return baseColor;
        return hexToRgba(baseColor, 0.3);
    };

    const hoverTemplate = (label, values) => {
        return values.map((val, i) => {
            const yearVal = years[i];
            const formatted = lang === 'en' ? `$${formatLocaleNumber(val, lang, { maximumFractionDigits: 0 })}B` : `${formatLocaleNumber(val, lang, { maximumFractionDigits: 0 })} G$`;
            return `<b>${label}</b><br>${yearVal}: ${formatted}<extra></extra>`;
        });
    };

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${chartDownloadSlug}.png`,
        title: exportChartTitle,
        subtitle: stripHtml(chartSubtitle),
        legendItems: [
            { label: directLabel, color: COLORS.direct, dash: true },
            { label: indirectLabel, color: COLORS.indirect, dash: true },
            { label: totalLabel, color: COLORS.total, dash: false },
        ],
    }),
        [COLORS, chartDownloadSlug, chartSubtitle, directLabel, exportChartTitle, indirectLabel, stripHtml, totalLabel],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    

    return (
        <PageShell tabIndex="-1"
            className="page-content page-11 page-chrome page-chrome--bleed"
            aria-labelledby="gdp-chart-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
                .page-11 {
                }

                .gdp-chart-container {
                    width: 100%;
                    padding: 15px 0 40px 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                }

                .gdp-chart-chart-frame {
                    margin-bottom: 0;
                }

                .gdp-chart-chart-title {
                    color: var(--gc-text);
                    margin: 0 0 15px 0;
                    padding-left: 15px;
                }

                .gdp-chart-chart-subtitle {
                    display: block;
                    font-family: 'Noto Sans', sans-serif !important;
                    font-size: 20px !important;
                    font-weight: 400 !important;
                    color: var(--gc-text);
                    text-align: center;
                    margin: 5px 0 0 0 !important;
                    padding-left: 0;
                }

                .gdp-chart-chart {
                    width: 100%;
                    height: 300px;
                    flex-shrink: 0;
                    position: relative;
                    margin-bottom: 0 !important;
                }

                .gdp-chart-legend {
                    gap: 15px 40px;
                    margin-top: 20px;
                    margin-bottom: 20px;
                    font-family: 'Noto Sans', sans-serif;
                    padding: 10px 20px;
                }

                .gdp-chart-legend-label {
                    font-size: 18px;
                    color: var(--gc-text);
                }

                .gdp-chart-table-wrapper {
                    display: block;
                    width: 100%;
                    margin-top: 20px;
                    margin-bottom: 0;
                }

                .gdp-chart-chart-frame button[type="button"]:hover,
                .gdp-chart-chart-frame button:hover {
                    background: #404040 !important;
                    background-color: #404040 !important;
                }

                @media (max-width: 768px) {
                    .page-11 { border-right: none !important; }
                    .gdp-chart-chart-subtitle { font-size: 18px !important; }
                    .gdp-chart-legend { gap: 20px; }
                    .gdp-chart-legend-label { font-size: 16px; }
                }

                @media (max-width: 480px) {
                    .gdp-chart-chart { height: 275px; }
                    .gdp-chart-legend-label { font-size: 14px; }
                }
            `}</style>

            <div className="gdp-chart-container">
                <div className="gdp-chart-chart-frame page-chrome-chart-frame">
                    <h2
                        id="gdp-chart-title"
                        className="gdp-chart-chart-title page-chrome-chart-title"
                        aria-label={chartTitleSpoken}
                    >
                        <span aria-hidden="true">{chartTitle}</span>
                        <FootnoteMarker
                            lang={lang}
                            href="#fn-asterisk-gdp-chart"
                            id="fn-asterisk-rf-gdp-chart"
                            marker="*"
                            onClick={scrollToFootnote}
                        />
                        <span className="gdp-chart-chart-subtitle" aria-hidden="true">
                            {chartSubtitle}
                        </span>
                    </h2>

                    <div 
                        role="region" 
                        aria-label={getChartSummary()}
                        tabIndex="0"
                    >
                        {selectedPoints !== null && <ClearSelectionButton lang={lang} onClick={clear} />}
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
                                            line: { color: getLineColors(COLORS.direct, 0), width: 2, dash: 'dash' },
                                            marker: { color: getLineColors(COLORS.direct, 0), size: 6 },
                                            hovertemplate: hoverTemplate(directLabel, directValues)
                                        },
                                        {
                                            x: years,
                                            y: indirectValues,
                                            type: 'scatter',
                                            mode: 'lines+markers',
                                            name: indirectLabel,
                                            line: { color: getLineColors(COLORS.indirect, 1), width: 2, dash: 'dash' },
                                            marker: { color: getLineColors(COLORS.indirect, 1), size: 6 },
                                            hovertemplate: hoverTemplate(indirectLabel, indirectValues)
                                        },
                                        {
                                            x: years,
                                            y: totalValues,
                                            type: 'scatter',
                                            mode: 'lines+markers',
                                            name: totalLabel,
                                            line: { color: getLineColors(COLORS.total, 2), width: 3 },
                                            marker: { color: getLineColors(COLORS.total, 2), size: 8 },
                                            hovertemplate: hoverTemplate(totalLabel, totalValues)
                                        }
                                    ]}
                                    layout={{
                                        hoverlabel: { bgcolor: '#ffffff' },
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
                                                size: windowWidth <= 480 ? 10 : 12, 
                                                family: 'Arial, sans-serif' 
                                            },
                                            range: [0, 380],
                                            dtick: 50,
                                            automargin: true
                                        },
                                        showlegend: false,
                                        margin: { 
                                            l: 50,
                                            r: 20, 
                                            t: 40, 
                                            b: 50 
                                        },
                                        autosize: true,
                                        paper_bgcolor: 'rgba(0,0,0,0)',
                                        plot_bgcolor: 'rgba(0,0,0,0)'
                                    }}
                                    config={plotConfig}
                                    onClick={onPlotClick}
                                    className="gdp-chart-chart"
                                    useResizeHandler={true}
                                />
                            </div>
                        </figure>
                    </div>

                    <HtmlLegend
                        className="gdp-chart-legend"
                        variant="line"
                        itemClassName="gdp-chart-legend-item"
                        markerClassName="gdp-chart-legend-line"
                        labelClassName="gdp-chart-legend-label"
                        items={[
                            { label: directLabel, color: COLORS.direct, dash: true },
                            { label: indirectLabel, color: COLORS.indirect, dash: true },
                            { label: totalLabel, color: COLORS.total },
                        ]}
                    />

                    <div className="gdp-chart-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            className="gdp-chart-data-table"
                            columns={tableColumns}
                            rows={gdpData}
                            csvFilename={`${chartDownloadSlug}.csv`}
                            docx={{
                                filename: `${chartDownloadSlug}.docx`,
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
                    titleId="fn-gdp-chart"
                    items={[{
                        id: 'fn-asterisk-gdp-chart',
                        marker: '*',
                        text: getText('gdp_chart_footnote', lang),
                        returnHref: '#fn-asterisk-rf-gdp-chart',
                    }]}
                />
            </div>
        </PageShell>
    );
};

export default GdpChart;
