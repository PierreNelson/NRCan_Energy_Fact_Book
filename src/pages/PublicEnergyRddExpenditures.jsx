import React, { useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import FootnoteMarker from '../components/FootnoteMarker';
import ClearSelectionButton from '../components/ClearSelectionButton';
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

import { makeScrollToIdHandler } from '../utils/scrollToId';

const START_YEAR = '2019';
const END_YEAR = '2024';
const TRACE_KEYS = ['federalExcl', 'federalCcus', 'ptExcl', 'ptCcus'];
const TRACE_COUNT = TRACE_KEYS.length;

/** Hardcoded public energy RD&D expenditures ($ million). */
const DATA = [
    { period: '2019-20', federalExcl: 745, federalCcus: 20, ptExcl: 255, ptCcus: 60 },
    { period: '2020-21', federalExcl: 810, federalCcus: 30, ptExcl: 330, ptCcus: 15 },
    { period: '2021-22', federalExcl: 950, federalCcus: 55, ptExcl: 365, ptCcus: 50 },
    { period: '2022-23', federalExcl: 1025, federalCcus: 45, ptExcl: 420, ptCcus: 15 },
    { period: '2023-24', federalExcl: 1410, federalCcus: 65, ptExcl: 365, ptCcus: 40 },
];

const COLORS = {
    federalExcl: '#48A36C',
    federalCcus: '#0061A6',
    ptExcl: '#857550',
    ptCcus: '#6097b6',
};

const PublicEnergyRddExpenditures = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const {
        selected: selectedPoints,
        clear,
        onPlotClick: handleChartClick,
        opacityFor,
    } = usePlotlySelection({ mode: 'points', traceCount: TRACE_COUNT, windowWidth });
    const chartRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const scrollToElement = (id) => makeScrollToIdHandler(id);

    const formatMillions = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const periods = DATA.map((row) => row.period);

    const traceValues = useMemo(
        () => Object.fromEntries(TRACE_KEYS.map((key) => [key, DATA.map((row) => row[key])])),
        [],
    );

    const totalValues = useMemo(
        () => DATA.map((row) => TRACE_KEYS.reduce((sum, key) => sum + row[key], 0)),
        [],
    );

    const chartTitle = getText('public_energy_rdd_expenditures_chart_title', lang);
    const exportChartTitle = `${stripHtml(chartTitle)} (${START_YEAR}–${END_YEAR})`;
    const yAxisTitle = getText('public_energy_rdd_expenditures_y_axis', lang);
    const totalLabel = getText('public_energy_rdd_expenditures_legend_total', lang);
    const tableUnit = getText('public_energy_rdd_expenditures_table_unit_row', lang);
    const traceLabels = Object.fromEntries(
        TRACE_KEYS.map((key) => [key, getText(`public_energy_rdd_expenditures_legend_${key}`, lang)]),
    );

    const fileSlugBase = getText('public_energy_rdd_expenditures_download_title', lang)
        .replace(/\{\{startYear\}\}/g, START_YEAR)
        .replace(/\{\{endYear\}\}/g, END_YEAR)
        .replace(/\s+/g, '_')
        .replace(/–/g, '-');

    const tableCaption = getText('public_energy_rdd_expenditures_table_caption', lang)
        .replace('{{startYear}}', START_YEAR)
        .replace('{{endYear}}', END_YEAR);

    const tableColumns = useMemo(() => [
        { key: 'period', header: getText('public_energy_rdd_expenditures_table_col_period', lang), align: 'left' },
        ...TRACE_KEYS.map((key) => ({
            key,
            header: `${getText(`public_energy_rdd_expenditures_table_col_${key}`, lang)} ${tableUnit}`,
            align: 'num',
        })),
        {
            key: 'total',
            header: `${getText('public_energy_rdd_expenditures_table_col_total', lang)} ${tableUnit}`,
            align: 'num',
        },
    ], [lang, tableUnit]);

    // Newest fiscal year first (period strings are not auto-sorted by ChartDataTable).
    const tableRows = useMemo(
        () => [...DATA].reverse().map((row) => ({
            ...row,
            total: TRACE_KEYS.reduce((sum, key) => sum + row[key], 0),
        })),
        [],
    );

    const getChartSummary = () => {
        const first = DATA[0];
        const last = DATA[DATA.length - 1];
        if (!first || !last) return '';
        const body = summarizeByCategory({
            categories: periods,
            series: TRACE_KEYS.map((key) => ({
                name: traceLabels[key],
                values: traceValues[key],
                format: formatMillions,
            })),
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Stacked bar chart of public energy RD&D expenditures from ${first.period} to ${last.period}`
                : `Graphique à barres empilées des dépenses publiques en R-D-D énergétique de ${first.period} à ${last.period}`,
            unitNote: lang === 'en' ? 'Values in millions of dollars' : 'Valeurs en millions de dollars',
            body,
            lang,
        });
    };

    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };
    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 62 : windowWidth <= 768 ? 56 : 50;

    const buildHoverTemplates = (key, values) =>
        periods.map(
            (period, i) =>
                `<b>${traceLabels[key]}</b><br>${period}: ${formatMillions(values[i])}<br><b>${totalLabel}</b>: ${formatMillions(totalValues[i])}<extra></extra>`,
        );

    const opacityForTrace = (traceIndex) => {
        if (selectedPoints === null) return 1;
        return periods.map((_, pointIndex) => opacityFor(traceIndex, pointIndex));
    };

        const downloadChartWithTitle = useChartPngDownloader(
            chartRef,
            () => ({
            filename: `${fileSlugBase}.png`,
            title: exportChartTitle,
            height: 700,
            legendItems: TRACE_KEYS.map((key) => ({
                label: traceLabels[key],
                color: COLORS[key],
            })),
        }),
            [COLORS, TRACE_KEYS, exportChartTitle, fileSlugBase, traceLabels],
        );

    


    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
        name: getText('public_energy_rdd_expenditures_download_chart', lang),
    });

    return (
        <PageShell tabIndex="-1"
            className="page-content page-35 public-energy-rdd-expenditures-rdd page-chrome page-chrome--bleed"
            aria-labelledby="public-energy-rdd-expenditures-chart-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.page-35.public-energy-rdd-expenditures-rdd {
}
.public-energy-rdd-expenditures-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.public-energy-rdd-expenditures-chart-title {
    color: var(--gc-text);
    margin: 0 0 12px 0;
    text-transform: none;
}
.public-energy-rdd-expenditures-chart-figure { margin: 0; }
.public-energy-rdd-expenditures-chart { width: 100%; min-width: 0; height: ${plotHeight}px; position: relative; }
.public-energy-rdd-expenditures-chart > div { width: 100%; height: 100%; }
.public-energy-rdd-expenditures-legend {
    align-items: center;
    gap: 14px 24px;
    margin-top: 10px;
    font-size: 14px;
    color: var(--gc-text);
}
.public-energy-rdd-expenditures-legend-item { white-space: nowrap; }
.public-energy-rdd-expenditures-legend-box { width: 18px; height: 14px; border-radius: 2px; }
.public-energy-rdd-expenditures-body {
    font-family: var(--font-body);
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
    margin: 50px 0 24px 0;
    max-width: none;
}
.public-energy-rdd-expenditures-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.public-energy-rdd-expenditures-chart-frame button[type="button"]:hover { background-color: #404040 !important; }
.public-energy-rdd-expenditures-footnotes {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--gc-text);
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
    line-height: 1.65;
}
.public-energy-rdd-expenditures-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0 0 1rem 0;
}
.public-energy-rdd-expenditures-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
@media (max-width: 768px) {
    .public-energy-rdd-expenditures-body { font-size: 18px; }
    .public-energy-rdd-expenditures-legend { font-size: 13px; }
}
            `}</style>

            <div className="public-energy-rdd-expenditures-inner">
                <div className="public-energy-rdd-expenditures-chart-frame page-chrome-chart-frame">
                    <h2 id="public-energy-rdd-expenditures-chart-title" className="public-energy-rdd-expenditures-chart-title page-chrome-chart-title">
                        {chartTitle}
                        <FootnoteMarker
                            lang={lang}
                            href="#fn-asterisk-public-energy-rdd-expenditures"
                            id="fn-asterisk-rf-public-energy-rdd-expenditures"
                            marker="*"
                            onClick={scrollToElement('fn-asterisk-public-energy-rdd-expenditures')}
                        />
                    </h2>

                    {selectedPoints != null && <ClearSelectionButton lang={lang} onClick={clear} />}

                    <figure ref={chartRef} className="public-energy-rdd-expenditures-chart-figure">
                        <div role="region" aria-label={`${exportChartTitle}. ${getChartSummary()}`} tabIndex="0">
                            <Plot
                                data={TRACE_KEYS.map((key, traceIndex) => ({
                                    x: periods,
                                    y: traceValues[key],
                                    type: 'bar',
                                    name: traceLabels[key],
                                    marker: {
                                        color: COLORS[key],
                                        opacity: opacityForTrace(traceIndex),
                                    },
                                    hovertemplate: buildHoverTemplates(key, traceValues[key]),
                                }))}
                                layout={{
                                    barmode: 'stack',
                                    bargap: 0.22,
                                    hoverlabel: {
                                        bgcolor: '#ffffff',
                                        font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
                                    },
                                    hovermode: 'closest',
                                    clickmode: 'event',
                                    dragmode: false,
                                    xaxis: {
                                        type: 'category',
                                        categoryorder: 'array',
                                        categoryarray: periods,
                                        showgrid: false,
                                        zeroline: false,
                                        showline: true,
                                        linewidth: 1,
                                        linecolor: '#333',
                                        tickfont: tickFont,
                                        automargin: true,
                                    },
                                    yaxis: {
                                        title: {
                                            text: yAxisTitle,
                                            font: axisTitleFont,
                                            standoff: 12,
                                        },
                                        range: [0, 2000],
                                        dtick: 200,
                                        showgrid: false,
                                        showline: true,
                                        linewidth: 1,
                                        linecolor: '#333',
                                        zeroline: false,
                                        tickfont: tickFont,
                                        automargin: true,
                                    },
                                    showlegend: false,
                                    margin: { l: 70, r: 24, t: plotTopMargin, b: plotBottomMargin },
                                    autosize: true,
                                    paper_bgcolor: 'rgba(0,0,0,0)',
                                    plot_bgcolor: 'rgba(0,0,0,0)',
                                }}
                                style={{ width: '100%', height: `${plotHeight}px` }}
                                config={plotConfig}
                                className="public-energy-rdd-expenditures-chart"
                                useResizeHandler
                                onClick={handleChartClick}
                            />
                        </div>
                    </figure>

                    <HtmlLegend
                        className="public-energy-rdd-expenditures-legend"
                        variant="swatch"
                        itemClassName="public-energy-rdd-expenditures-legend-item"
                        markerClassName="public-energy-rdd-expenditures-legend-box"
                        items={TRACE_KEYS.map((key) => ({
                            label: traceLabels[key],
                            color: COLORS[key],
                        }))}
                    />

                    <div className="public-energy-rdd-expenditures-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={`${fileSlugBase}.csv`}
                            docx={{
                                filename: `${fileSlugBase}.docx`,
                                title: tableCaption,
                                titleAlign: 'center',
                                columnWidths: [1200, 1800, 1600, 1800, 1600, 1200],
                                fontSize: 18,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatMillions(raw)
                            )}
                        />
                    </div>
                </div>

                <p className="public-energy-rdd-expenditures-body">{getText('public_energy_rdd_expenditures_body', lang)}</p>

                <PageFootnotes
                    lang={lang}
                    titleId="fn-public-energy-rdd-expenditures"
                    className="public-energy-rdd-expenditures-footnotes"
                    items={[
                        { id: 'fn-asterisk-public-energy-rdd-expenditures', marker: '*', text: getText('public_energy_rdd_expenditures_footnote_asterisk', lang), returnHref: '#fn-asterisk-rf-public-energy-rdd-expenditures' },
                    ]}
                />
            </div>
        </PageShell>
    );
};

export default PublicEnergyRddExpenditures;
