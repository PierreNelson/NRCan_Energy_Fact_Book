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
    { year: 2018, direct: 191, indirect: 303, total: 494 },
    { year: 2019, direct: 187, indirect: 298, total: 486 },
    { year: 2020, direct: 157, indirect: 254, total: 411 },
    { year: 2021, direct: 167, indirect: 275, total: 442 },
    { year: 2022, direct: 186, indirect: 304, total: 490 },
    { year: 2023, direct: 190, indirect: 313, total: 503 },
    { year: 2024, direct: 190, indirect: 313, total: 503 }
];

const COLORS = {
    direct: '#433430',
    indirect: '#6097b6'
};

const PetroleumEmployment = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const {
        selected: selectedPoints,
        clear: clearSelection,
        onPlotClick: handleChartClick,
    } = usePlotlySelection({ mode: 'points', traceCount: 2, windowWidth });
    const chartRef = useRef(null);

    const years = DATA.map((d) => d.year);
    const directValues = DATA.map((d) => d.direct);
    const indirectValues = DATA.map((d) => d.indirect);
    const totalValues = DATA.map((d) => d.total);

    const directLabel = getText('petroleum_employment_legend_direct', lang);
    const indirectLabel = getText('petroleum_employment_legend_indirect', lang);
    const totalLabel = getText('petroleum_employment_legend_total', lang);

    const chartTitle = getText('petroleum_employment_chart_title', lang);
    const exportChartTitle = `${stripHtml(chartTitle)} (2018-2024)`;
    const chartSubtitle = getText('petroleum_employment_chart_subtitle', lang);
    const unitText = lang === 'en' ? 'thousands of jobs' : "milliers d'emplois";

    const fileSlugBase = `${stripHtml(chartTitle)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'petroleum-employment'}-2018-2024`;

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('petroleum_employment_table_col_year', lang), align: 'left' },
        { key: 'direct', header: `${directLabel} (${unitText})`, align: 'num' },
        { key: 'indirect', header: `${indirectLabel} (${unitText})`, align: 'num' },
        { key: 'total', header: `${totalLabel} (${unitText})`, align: 'num' },
    ], [lang, directLabel, indirectLabel, totalLabel, unitText]);

    const getChartSummary = () => {
        const body = summarizeByCategory({
            categories: years,
            series: [
                { name: directLabel, values: directValues, format: (v) => formatLocaleNumber(v, lang, { maximumFractionDigits: 0 }) },
                { name: indirectLabel, values: indirectValues, format: (v) => formatLocaleNumber(v, lang, { maximumFractionDigits: 0 }) },
            ],
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? 'Stacked bar chart of petroleum employment from 2018 to 2024, showing direct and indirect employment'
                : "Diagramme à bandes empilées de l'emploi pétrolier de 2018 à 2024, montrant les emplois directs et indirects",
            unitNote: lang === 'en' ? 'Values in thousands of jobs' : "Valeurs en milliers d'emplois",
            body,
            lang,
        });
    };

    const directHoverTemplates = years.map(
        (y, i) =>
            `<b>${directLabel}</b><br>${y}: ${formatLocaleNumber(directValues[i], lang, { maximumFractionDigits: 0 })}<br><b>${totalLabel}</b>: ${formatLocaleNumber(totalValues[i], lang, { maximumFractionDigits: 0 })}<extra></extra>`
    );
    const indirectHoverTemplates = years.map(
        (y, i) =>
            `<b>${indirectLabel}</b><br>${y}: ${formatLocaleNumber(indirectValues[i], lang, { maximumFractionDigits: 0 })}<br><b>${totalLabel}</b>: ${formatLocaleNumber(totalValues[i], lang, { maximumFractionDigits: 0 })}<extra></extra>`
    );

    const plotBottomMargin = windowWidth <= 480 ? 72 : windowWidth <= 768 ? 62 : 50;
    const plotTopMargin = windowWidth <= 480 ? 56 : 48;
    const chartHeight = windowWidth <= 480 ? 320 : windowWidth <= 768 ? 360 : 400;

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${fileSlugBase}.png`,
        title: exportChartTitle,
        subtitle: stripHtml(chartSubtitle),
        height: 640,
        legendItems: [
            { label: directLabel, color: COLORS.direct },
            { label: indirectLabel, color: COLORS.indirect },
        ],
    }),
        [COLORS, chartSubtitle, directLabel, exportChartTitle, fileSlugBase, indirectLabel, stripHtml],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        name: getText('petroleum_employment_download_chart', lang),
        click: (gd) => downloadChartWithTitle(gd),
    });

    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };

    

    return (
        <PageShell tabIndex="-1"
            className="page-content page-106 page-chrome page-chrome--bleed"
            aria-labelledby="petroleum-employment-chart-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
                .page-106.page-content {
                    max-width: none !important;
                    overflow-x: visible !important;
                }

                .page-106 {
                }

                .petroleum-employment-rpp-crosslink {
                    font-family: var(--font-body);
                    font-size: 1rem;
                    line-height: 1.5;
                    margin: 0 0 16px 0;
                }
                .petroleum-employment-rpp-crosslink a {
                    font-weight: 600;
                }
                .petroleum-employment-container {
                    width: 100%;
                    padding: 15px 0 40px 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                }

                .petroleum-employment-chart-frame {
                    margin-bottom: 0;
                }

                .petroleum-employment-chart-title {
                    color: var(--gc-text);
                    margin: 0 0 5px 0;
                }

                .petroleum-employment-chart-subtitle {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    color: var(--gc-text);
                    text-align: center;
                    margin: 0 0 15px 0;
                }

                .petroleum-employment-chart-block {
                    display: flex;
                    flex-direction: column;
                    align-items: stretch;
                    width: 100%;
                }

                .petroleum-employment-chart {
                    width: 100%;
                    flex-shrink: 0;
                    position: relative;
                    margin-bottom: 0 !important;
                }

                .petroleum-employment-legend {
                    gap: 15px 40px;
                    margin-top: 20px;
                    margin-bottom: 20px;
                    font-family: 'Noto Sans', sans-serif;
                    padding: 10px 20px;
                    flex-shrink: 0;
                }

                .petroleum-employment-legend-swatch {
                    width: 22px;
                    height: 14px;
                    flex-shrink: 0;
                }

                .petroleum-employment-legend-label {
                    font-size: 18px;
                    color: var(--gc-text);
                }

                .petroleum-employment-table-wrapper {
                    display: block;
                    width: 100%;
                    margin-top: 20px;
                    margin-bottom: 0;
                }

                .petroleum-employment-table-wrapper details > summary {
                    display: block;
                    width: 100%;
                    padding: 12px 15px;
                    background-color: #8C8C8C;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    color: #ffffff;
                    list-style: none;
                }

                .petroleum-employment-table-wrapper details > summary::-webkit-details-marker {
                    display: none;
                }

                .petroleum-employment-table-wrapper details > summary::marker {
                    display: none;
                    content: '';
                }

                .petroleum-employment-table-wrapper details > summary:hover {
                    background-color: #404040 !important;
                }

                .petroleum-employment-table-wrapper .table-responsive {
                    display: block;
                    width: 100%;
                    overflow-x: auto !important;
                    -webkit-overflow-scrolling: touch;
                    border: 1px solid #ddd;
                    background: #fff;
                }

                .petroleum-employment-table-wrapper .table-responsive table {
                    width: max-content !important;
                    min-width: 100%;
                    border-collapse: collapse;
                }

                .petroleum-employment-table-wrapper .table-responsive table.table {
                    font-family: var(--font-body);
                    color: var(--gc-text);
                }

                .petroleum-employment-table-wrapper .table-responsive table th,
                .petroleum-employment-table-wrapper .table-responsive table td {
                    white-space: nowrap;
                    padding: 8px 12px;
                    font-family: var(--font-body);
                    color: var(--gc-text);
                }

                .petroleum-employment-download-buttons {
                    display: flex;
                    gap: 10px;
                    margin-top: 15px;
                    flex-wrap: wrap;
                }

                .petroleum-employment-download-buttons button {
                    padding: 8px 16px;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    background: #8C8C8C;
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    color: #ffffff;
                }

                .petroleum-employment-download-buttons button:hover,
                .petroleum-employment-table-wrapper button:hover,
                .petroleum-employment-chart-frame button[type="button"]:hover,
                .petroleum-employment-chart-frame button:hover {
                    background: #404040 !important;
                    background-color: #404040 !important;
                }

                @media (max-width: 768px) {
                    .petroleum-employment-chart-subtitle { font-size: 18px; }
                    .petroleum-employment-legend { gap: 20px; }
                    .petroleum-employment-legend-label { font-size: 16px; }
                }

                @media (max-width: 480px) {
                    .petroleum-employment-legend-label { font-size: 14px; }
                }
            `}</style>

            <div className="petroleum-employment-container">
                <div className="petroleum-employment-chart-frame page-chrome-chart-frame">
                    <h2 id="petroleum-employment-chart-title" className="petroleum-employment-chart-title page-chrome-chart-title">
                        {chartTitle}
                    </h2>
                    <p className="petroleum-employment-chart-subtitle">{chartSubtitle}</p>

                    <div className="petroleum-employment-chart-block">
                        <div role="region" aria-label={getChartSummary()} tabIndex="0">
                            {selectedPoints !== null && <ClearSelectionButton lang={lang} onClick={clearSelection} />}
                            <figure ref={chartRef} style={{ margin: 0, position: 'relative' }}>
                                <div aria-hidden="true">
                                    <Plot
                                        data={[
                                            {
                                                x: years,
                                                y: directValues,
                                                type: 'bar',
                                                name: directLabel,
                                                marker: {
                                                    color: COLORS.direct,
                                                    opacity:
                                                        selectedPoints === null
                                                            ? 1
                                                            : years.map((_, i) =>
                                                                  selectedPoints[0]?.includes(i) ? 1 : 0.3
                                                              )
                                                },
                                                hovertemplate: directHoverTemplates
                                            },
                                            {
                                                x: years,
                                                y: indirectValues,
                                                type: 'bar',
                                                name: indirectLabel,
                                                marker: {
                                                    color: COLORS.indirect,
                                                    opacity:
                                                        selectedPoints === null
                                                            ? 1
                                                            : years.map((_, i) =>
                                                                  selectedPoints[1]?.includes(i) ? 1 : 0.3
                                                              )
                                                },
                                                hovertemplate: indirectHoverTemplates
                                            }
                                        ]}
                                        layout={{
                                            barmode: 'stack',
                                            bargap: 0.22,
                                            hoverlabel: {
                                                bgcolor: '#ffffff',
                                                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' }
                                            },
                                            hovermode: 'closest',
                                            clickmode: 'event',
                                            dragmode: false,
                                            xaxis: {
                                                type: 'linear',
                                                tickmode: 'array',
                                                tickvals: years,
                                                ticktext: years.map(String),
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                tickfont: tickFont,
                                                automargin: true
                                            },
                                            yaxis: {
                                                range: [0, 550],
                                                dtick: 50,
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                tickfont: tickFont,
                                                automargin: true
                                            },
                                            showlegend: false,
                                            margin: { l: 52, r: 20, t: plotTopMargin, b: plotBottomMargin },
                                            autosize: true,
                                            paper_bgcolor: 'rgba(0,0,0,0)',
                                            plot_bgcolor: 'rgba(0,0,0,0)'
                                        }}
                                        config={plotConfig}
                                        className="petroleum-employment-chart"
                                        style={{ width: '100%', height: `${chartHeight}px` }}
                                        useResizeHandler={true}
                                        onClick={handleChartClick}
                                    />
                                </div>
                            </figure>
                        </div>

                        <HtmlLegend
                            className="petroleum-employment-legend"
                            variant="swatch"
                            itemClassName="petroleum-employment-legend-item"
                            markerClassName="petroleum-employment-legend-swatch"
                            labelClassName="petroleum-employment-legend-label"
                            items={[
                                { label: directLabel, color: COLORS.direct },
                                { label: indirectLabel, color: COLORS.indirect },
                            ]}
                        />
                    </div>

                    <div className="petroleum-employment-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            className="petroleum-employment-data-table"
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
                            caption={getText('petroleum_employment_table_caption', lang)}
                            tableAriaLabel={getText('petroleum_employment_table_aria', lang)}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatLocaleNumber(raw, lang, { maximumFractionDigits: 0 })
                            )}
                        />
                    </div>
                </div>

                <PageFootnotes
                    lang={lang}
                    titleId="fn-petroleum-employment"
                    items={[{
                        id: 'fn-asterisk-petroleum-employment',
                        marker: '*',
                        text: getText('petroleum_employment_footnote', lang),
                        hideReturn: true,
                    }]}
                />
            </div>
        </PageShell>
    );
};

export default PetroleumEmployment;
