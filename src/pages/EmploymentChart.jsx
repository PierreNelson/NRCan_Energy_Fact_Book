import React, { useMemo, useRef } from 'react';
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
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import HtmlLegend from '../components/HtmlLegend';
import hexToRgba from '../utils/hexToRgba';

import { makeScrollToIdHandler } from '../utils/scrollToId';

const COLORS = {
    direct: '#857650',
    indirect: '#2AA2AC',
};

const employmentData = [
    { year: 2018, direct: 297, indirect: 395, total: 692 },
    { year: 2019, direct: 296, indirect: 395, total: 691 },
    { year: 2020, direct: 257, indirect: 349, total: 606 },
    { year: 2021, direct: 269, indirect: 367, total: 636 },
    { year: 2022, direct: 295, indirect: 399, total: 694 },
    { year: 2023, direct: 312, indirect: 423, total: 735 },
    { year: 2024, direct: 316, indirect: 429, total: 745 },
];

const EmploymentChart = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const {
        selected: selectedPoints,
        clear,
        onPlotClick,
    } = usePlotlySelection({ mode: 'points', traceCount: 2, windowWidth });
    const chartRef = useRef(null);

    const directLabel = getText('employment_chart_legend_direct', lang);
    const indirectLabel = getText('employment_chart_legend_indirect', lang);

    const chartTitle = getText('employment_chart_chart_title', lang);
    const exportChartTitle = `${stripHtml(chartTitle)} (2018-2024)`;
    const chartSubtitle = getText('employment_chart_chart_subtitle', lang);
    const chartDownloadSlug = lang === 'en' ? 'energy_sector_employment' : 'emplois_secteur_energie';

    const unitText = lang === 'en' ? 'thousands of jobs' : "milliers d'emplois";
    const chartTitleSpoken = `${stripHtml(chartTitle)}, ${unitText}`;
    const tableCaption = lang === 'en'
        ? 'Energy sector employment data from 2018 to 2024'
        : "Données sur l'emploi dans le secteur de l'énergie de 2018 à 2024";

    const tableColumns = useMemo(() => [
        { key: 'year', header: lang === 'en' ? 'Year' : 'Année', align: 'left' },
        { key: 'direct', header: `${directLabel} (${unitText})`, align: 'num' },
        { key: 'indirect', header: `${indirectLabel} (${unitText})`, align: 'num' },
        { key: 'total', header: `Total (${unitText})`, align: 'num' },
    ], [lang, directLabel, indirectLabel, unitText]);

    const scrollToFootnote = makeScrollToIdHandler('fn-asterisk-employment-chart');

    const scrollToRef = makeScrollToIdHandler('fn-asterisk-rf-employment-chart');

    const years = employmentData.map((d) => d.year);
    const directValues = employmentData.map((d) => d.direct);
    const indirectValues = employmentData.map((d) => d.indirect);

    const hoverTemplate = (label, values) => {
        return values.map((v, i) => {
            const y = employmentData[i].year;
            const tot = employmentData[i].total;
            const unit = lang === 'en' ? 'thousand jobs' : "milliers d'emplois";
            return `<b>${label}</b><br>${y}: ${v} ${unit}<br>Total: ${tot} ${unit}`;
        });
    };

    const getChartSummary = () => {
        const min = Math.min(...years);
        const max = Math.max(...years);
        const body = summarizeByCategory({
            categories: years,
            series: [
                { name: directLabel, values: directValues, format: (v) => `${v} ${unitText}` },
                { name: indirectLabel, values: indirectValues, format: (v) => `${v} ${unitText}` },
            ],
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Stacked bar chart showing energy sector employment from ${min} to ${max}`
                : `Graphique à barres empilées montrant l'emploi dans le secteur de l'énergie de ${min} à ${max}`,
            body,
        });
    };

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${chartDownloadSlug}.png`,
        title: exportChartTitle,
        subtitle: stripHtml(chartSubtitle),
        height: 800,
        legendItems: [
            { label: directLabel, color: COLORS.direct },
            { label: indirectLabel, color: COLORS.indirect },
        ],
    }),
        [COLORS, chartDownloadSlug, chartSubtitle, directLabel, exportChartTitle, indirectLabel, stripHtml],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const getBarColors = (baseColor, traceIndex) => {
        if (selectedPoints === null) return baseColor;
        return employmentData.map((_, i) => {
            const isSelected = selectedPoints[traceIndex]?.includes(i);
            return isSelected ? baseColor : hexToRgba(baseColor, 0.3);
        });
    };

    

    return (
        <PageShell tabIndex="-1"
            className="page-content page-10 page-chrome page-chrome--bleed"
            aria-labelledby="employment-chart-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
                .page-10 {
                }

                .employment-chart-container {
                    width: 100%;
                    padding: 15px 0 40px 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                }

                .employment-chart-chart-frame {
                    margin-bottom: 0;
                }

                .employment-chart-chart-title {
                    color: var(--gc-text);
                    margin: 0 0 15px 0;
                }

                .employment-chart-chart-subtitle {
                    display: block;
                    font-family: 'Noto Sans', sans-serif !important;
                    font-size: 20px !important;
                    font-weight: 400 !important;
                    color: var(--gc-text);
                    text-align: center;
                    margin: 5px 0 0 0 !important;
                }

                .employment-chart-chart {
                    width: 100%;
                    height: 400px;
                    flex-shrink: 0;
                    position: relative;
                    margin-bottom: 0 !important;
                }

                .employment-chart-legend {
                    gap: 15px 40px;
                    margin-top: 20px;
                    margin-bottom: 20px;
                    font-family: 'Noto Sans', sans-serif;
                    padding: 10px 20px;
                }

                .employment-chart-legend-color {
                    width: 30px;
                    height: 20px;
                    flex-shrink: 0;
                }

                .employment-chart-legend-label {
                    font-size: 18px;
                    color: var(--gc-text);
                }

                .employment-chart-table-wrapper {
                    display: block;
                    width: 100%;
                    margin-top: 20px;
                    margin-bottom: 0;
                }

                .employment-chart-chart-frame button[type="button"]:hover,
                .employment-chart-chart-frame button:hover {
                    background-color: #404040 !important;
                }

                @media (max-width: 768px) {
                    .page-10 { border-right: none !important; }
                    .employment-chart-chart-subtitle { font-size: 18px !important; }
                    .employment-chart-legend { gap: 20px; }
                    .employment-chart-legend-label { font-size: 16px; }
                    .employment-chart-chart { height: 350px; }
                }

                @media (max-width: 640px) {
                    .employment-chart-chart { height: 325px; }
                }

                @media (max-width: 480px) {
                    .employment-chart-chart { height: 275px; }
                    .employment-chart-legend-label { font-size: 14px; }
                }

                @media (max-width: 384px) {
                    .employment-chart-chart { height: 250px; }
                    .employment-chart-legend {
                        flex-direction: column;
                        align-items: flex-start;
                        width: fit-content;
                        margin-left: auto;
                        margin-right: auto;
                    }
                }
            `}</style>

            <div className="employment-chart-container">
                <div className="employment-chart-chart-frame page-chrome-chart-frame">
                    <h2
                        id="employment-chart-title"
                        className="employment-chart-chart-title page-chrome-chart-title"
                        aria-label={chartTitleSpoken}
                    >
                        <span aria-hidden="true">{chartTitle}</span>
                        <FootnoteMarker
                            lang={lang}
                            href="#fn-asterisk-employment-chart"
                            id="fn-asterisk-rf-employment-chart"
                            marker="*"
                            onClick={scrollToFootnote}
                        />
                        <span className="employment-chart-chart-subtitle" aria-hidden="true">
                            {chartSubtitle}
                        </span>
                    </h2>

                    {selectedPoints !== null && <ClearSelectionButton lang={lang} onClick={clear} />}

                    <figure ref={chartRef} style={{ margin: 0, position: 'relative' }}>
                        <div role="region" aria-label={`${exportChartTitle}. ${getChartSummary()}`} tabIndex="0">
                            <Plot
                                data={[
                                    {
                                        x: years,
                                        y: directValues,
                                        type: 'bar',
                                        name: directLabel,
                                        marker: { color: getBarColors(COLORS.direct, 0) },
                                        hovertext: hoverTemplate(directLabel, directValues),
                                        hoverinfo: 'text',
                                    },
                                    {
                                        x: years,
                                        y: indirectValues,
                                        type: 'bar',
                                        name: indirectLabel,
                                        marker: { color: getBarColors(COLORS.indirect, 1) },
                                        hovertext: hoverTemplate(indirectLabel, indirectValues),
                                        hoverinfo: 'text',
                                    },
                                ]}
                                layout={{
                                    barmode: 'stack',
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
                                            family: 'Arial, sans-serif',
                                        },
                                        tickmode: 'array',
                                        tickvals: years,
                                        ticktext: years.map(String),
                                        automargin: true,
                                    },
                                    yaxis: {
                                        showgrid: false,
                                        showline: true,
                                        linewidth: 1,
                                        linecolor: '#333',
                                        zeroline: false,
                                        tickfont: {
                                            size: windowWidth <= 480 ? 10 : 12,
                                            family: 'Arial, sans-serif',
                                        },
                                        range: [0, 850],
                                        dtick: 100,
                                        automargin: true,
                                    },
                                    showlegend: false,
                                    margin: {
                                        l: 50,
                                        r: 20,
                                        t: 20,
                                        b: 50,
                                    },
                                    autosize: true,
                                    paper_bgcolor: 'rgba(0,0,0,0)',
                                    plot_bgcolor: 'rgba(0,0,0,0)',
                                    bargap: 0.3,
                                }}
                                config={plotConfig}
                                onClick={onPlotClick}
                                className="employment-chart-chart"
                                useResizeHandler={true}
                            />
                        </div>
                    </figure>

                    <HtmlLegend
                        className="employment-chart-legend"
                        variant="swatch"
                        itemClassName="employment-chart-legend-item"
                        markerClassName="employment-chart-legend-color"
                        labelClassName="employment-chart-legend-label"
                        items={[
                            { label: directLabel, color: COLORS.direct },
                            { label: indirectLabel, color: COLORS.indirect },
                        ]}
                    />

                    <div className="employment-chart-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            className="employment-chart-data-table"
                            columns={tableColumns}
                            rows={employmentData}
                            csvFilename={`${chartDownloadSlug}.csv`}
                            docx={{
                                filename: `${chartDownloadSlug}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [1500, 2500, 2500, 2500],
                                fontSize: 22,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                        />
                    </div>
                </div>

                <PageFootnotes
                    lang={lang}
                    titleId="fn-employment-chart"
                    items={[
                        { id: 'fn-asterisk-employment-chart', marker: '*', text: getText('employment_chart_footnote', lang), returnHref: '#fn-asterisk-rf-employment-chart' },
                    ]}
                />
            </div>
        </PageShell>
    );
};

export default EmploymentChart;
