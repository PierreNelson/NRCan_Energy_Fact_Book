import React, { useCallback, useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import FootnoteMarker from '../components/FootnoteMarker';
import PageFootnotes from '../components/PageFootnotes';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import hexToRgba from '../utils/hexToRgba';
import { makeScrollToIdHandler } from '../utils/scrollToId';

import CanadianSupplyDemandInfographic from '../components/CanadianSupplyDemandInfographic';

const REFERENCE_YEAR = 2024;

/** Hardcoded snapshot values for the infographic (2024). */
const INFOGRAPHIC_DATA = {
    production: 5.1,
    exports: 4.1,
    imports: 0.7,
    refinery: 1.7,
};

/** Hardcoded trade time series (MMb/d). */
const TRADE_DATA = [
    { year: 2008, exports: 1.9, imports: 0.9 },
    { year: 2009, exports: 1.9, imports: 0.9 },
    { year: 2010, exports: 1.9, imports: 0.8 },
    { year: 2011, exports: 2.1, imports: 0.8 },
    { year: 2012, exports: 2.3, imports: 0.75 },
    { year: 2013, exports: 2.6, imports: 0.75 },
    { year: 2014, exports: 2.8, imports: 0.7 },
    { year: 2015, exports: 3.0, imports: 0.75 },
    { year: 2016, exports: 3.0, imports: 0.75 },
    { year: 2017, exports: 3.4, imports: 0.7 },
    { year: 2018, exports: 3.6, imports: 0.65 },
    { year: 2019, exports: 3.7, imports: 0.7 },
    { year: 2020, exports: 3.6, imports: 0.6 },
    { year: 2021, exports: 3.8, imports: 0.5 },
    { year: 2022, exports: 3.9, imports: 0.5 },
    { year: 2023, exports: 4.0, imports: 0.5 },
    { year: 2024, exports: 4.3, imports: 0.55 },
];

const COLORS = {
    exports: '#7D962C',
    imports: '#3B95C9',
};

const INFOGRAPHIC_ROW_KEYS = ['production', 'exports', 'imports', 'refinery'];

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const CanadianSupplyDemand = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const {
        selected: selectedTraceIds,
        clear: clearSelection,
        toggleSlice,
    } = usePlotlySelection({ mode: 'slices', windowWidth });
    const chartRef = useRef(null);
    const infographicFigureRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const formatMmbd = (value, digits = 1) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        });
    };

    const formatHoverMmbd = (value, digits = 1) => {
        const formatted = formatMmbd(value, digits);
        if (formatted === '–') return formatted;
        return lang === 'fr' ? formatted.replace('.', ',') : formatted;
    };

    const scrollToElement = (id) => makeScrollToIdHandler(id);

    const startYear = TRADE_DATA[0]?.year ?? 2008;
    const endYear = TRADE_DATA[TRADE_DATA.length - 1]?.year ?? 2024;
    const textVars = { year: REFERENCE_YEAR, startYear, endYear };

    const years = TRADE_DATA.map((row) => row.year);
    const yearTicks = years.filter((yearValue) => yearValue % 2 === 0);
    const exportValues = TRADE_DATA.map((row) => row.exports);
    const importValues = TRADE_DATA.map((row) => row.imports);
    const chartYearMin = years[0];
    const chartYearMax = years[years.length - 1];

    const exportsLabel = getText('canadian_supply_demand_legend_exports', lang);
    const importsLabel = getText('canadian_supply_demand_legend_imports', lang);
    const chartTitle = getText('canadian_supply_demand_chart_title', lang);
    const exportChartTitle = stripHtml(`${chartTitle} (${startYear}–${endYear})`);
    const yAxisTitle = getText('canadian_supply_demand_y_axis', lang);

    const tableCaption = substitute(getText('canadian_supply_demand_table_caption', lang), textVars);
    const infographicTableCaption = substitute(
        getText('canadian_supply_demand_infographic_table_caption', lang),
        textVars,
    );
    const exportTableTitle = stripHtml(tableCaption);
    const exportInfographicTableTitle = stripHtml(infographicTableCaption);

    const fileSlugBase = substitute(getText('canadian_supply_demand_download_title', lang), textVars)
        .replace(/\s+/g, '_')
        .replace(/–/g, '-');
    const infographicDownloadTitle = substitute(getText('canadian_supply_demand_infographic_download_title', lang), textVars)
        .replace(/\s+/g, '_')
        .replace(/–/g, '-');

    const chartTableColumns = useMemo(() => [
        { key: 'year', header: getText('canadian_supply_demand_table_col_year', lang), align: 'left' },
        { key: 'exports', header: getText('canadian_supply_demand_table_col_exports', lang), align: 'num' },
        { key: 'imports', header: getText('canadian_supply_demand_table_col_imports', lang), align: 'num' },
    ], [lang]);

    const infographicColumns = useMemo(() => [
        { key: 'label', header: getText('canadian_supply_demand_infographic_table_col_indicator', lang), align: 'left' },
        { key: 'value', header: getText('canadian_supply_demand_infographic_table_col_value', lang), align: 'num' },
    ], [lang]);

    const infographicTableRows = useMemo(
        () => INFOGRAPHIC_ROW_KEYS.map((key) => ({
            label: getText(`canadian_supply_demand_infographic_row_${key}`, lang),
            value: INFOGRAPHIC_DATA[key],
        })),
        [lang],
    );

    const exportsHoverTexts = years.map(
        (yearValue, i) => `<b>${exportsLabel}</b><br>${yearValue}: ${formatHoverMmbd(exportValues[i])}<extra></extra>`,
    );
    const importsHoverTexts = years.map(
        (yearValue, i) => `<b>${importsLabel}</b><br>${yearValue}: ${formatHoverMmbd(importValues[i])}<extra></extra>`,
    );

    const exportsFocused = selectedTraceIds === null || selectedTraceIds.includes(0);
    const importsFocused = selectedTraceIds === null || selectedTraceIds.includes(1);

    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };
    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 62 : windowWidth <= 768 ? 56 : 50;

    const handleChartClick = useCallback(
        (data) => {
            if (!data?.points?.length) return;
            const traceIndex = data.points[0].curveNumber;
            if (traceIndex === undefined || traceIndex < 0 || traceIndex > 1) return;
            toggleSlice(traceIndex);
        },
        [toggleSlice],
    );

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${fileSlugBase}.png`,
        title: exportChartTitle,
        height: 700,
        legendItems: [
            { label: exportsLabel, color: COLORS.exports },
            { label: importsLabel, color: COLORS.imports },
        ],
    }),
        [COLORS, exportChartTitle, exportsLabel, fileSlugBase, importsLabel],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        name: getText('canadian_supply_demand_download_chart', lang),
        click: (gd) => downloadChartWithTitle(gd),
    });

    const getChartSummary = () => {
        const body = summarizeByCategory({
            categories: years,
            series: [
                { name: exportsLabel, values: exportValues, format: (v) => String(v) },
                { name: importsLabel, values: importValues, format: (v) => String(v) },
            ],
            lang,
            newestFirst: true,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Line chart of Canadian crude oil exports and imports from ${startYear} to ${endYear}`
                : `Graphique linéaire des exportations et importations canadiennes de pétrole brut de ${startYear} à ${endYear}`,
            unitNote: lang === 'en' ? 'Values in million barrels per day' : 'Valeurs en millions de barils par jour',
            body,
        });
    };
    const chartRegionLabel = `${stripHtml(chartTitle)}. ${getChartSummary()}`;

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-112 canadian-supply-demand-supply-demand page-chrome page-chrome--bleed"
            aria-labelledby="canadian-supply-demand-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.page-112.canadian-supply-demand-supply-demand {
}
.canadian-supply-demand-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.canadian-supply-demand-title {
    margin-bottom: 20px;
    line-height: 1.25;
    text-transform: none;
}
.canadian-supply-demand-section-title {
    font-family: 'Lato', sans-serif;
    font-size: 28px;
    font-weight: bold;
    color: #423330;
    margin: 28px 0 16px 0;
    text-transform: none;
}
.canadian-supply-demand-chart-title {
    color: var(--gc-text);
    margin-bottom: 12px;
    text-transform: none;
}
.canadian-supply-demand-chart-figure { margin: 0; }
.canadian-supply-demand-chart { width: 100%; min-width: 0; height: ${plotHeight}px; position: relative; }
.canadian-supply-demand-chart > div { width: 100%; height: 100%; }
.canadian-supply-demand-legend {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 18px 28px;
    flex-wrap: wrap;
    margin-top: 10px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: var(--gc-text);
}
.canadian-supply-demand-legend-item { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.canadian-supply-demand-legend-line {
    width: 28px;
    height: 0;
    border-top: 4px solid;
    display: inline-block;
}
.canadian-supply-demand-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.canadian-supply-demand-infographic-table-wrapper { margin-bottom: 0; }
.canadian-supply-demand-footnotes {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--gc-text);
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
    line-height: 1.65;
}
.canadian-supply-demand-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0 0 1rem 0;
}
.canadian-supply-demand-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
@media (max-width: 768px) {
    .canadian-supply-demand-section-title { font-size: 24px; }
}
            `}</style>

            <div className="canadian-supply-demand-inner">
                <h1 id="canadian-supply-demand-title" className="canadian-supply-demand-title page-chrome-title">
                    {getText('canadian_supply_demand_title', lang)}
                    <FootnoteMarker
                            lang={lang}
                            href="#fn-asterisk-canadian-supply-demand"
                            id="fn-asterisk-rf-canadian-supply-demand"
                            marker="*"
                            onClick={scrollToElement('fn-asterisk-canadian-supply-demand')}
                        />
                    {' '}({REFERENCE_YEAR})
                </h1>

                <CanadianSupplyDemandInfographic
                    figureRef={infographicFigureRef}
                    lang={lang}
                    overlayValues={INFOGRAPHIC_DATA}
                    formatMmbd={formatMmbd}
                    getText={getText}
                    ariaLabel={getText('canadian_supply_demand_bg_alt', lang)}
                />

                <div className="canadian-supply-demand-table-wrapper canadian-supply-demand-infographic-table-wrapper">
                    <ChartDataTable
                        lang={lang}
                        columns={infographicColumns}
                        rows={infographicTableRows}
                        csvFilename={`${infographicDownloadTitle}.csv`}
                        docx={{
                            filename: `${infographicDownloadTitle}.docx`,
                            title: exportInfographicTableTitle,
                            titleAlign: 'center',
                            columnWidths: [4200, 1600],
                            fontSize: 20,
                        }}
                        caption={infographicTableCaption}
                        tableAriaLabel={infographicTableCaption}
                        renderCell={(raw, { colIndex }) => (
                            colIndex === 0 ? String(raw ?? '') : formatMmbd(raw, 1)
                        )}
                    />
                </div>

                <h2 className="canadian-supply-demand-section-title">{getText('canadian_supply_demand_section_trade', lang)}</h2>

                <div className="canadian-supply-demand-chart-frame page-chrome-chart-frame">
                    <h3 className="canadian-supply-demand-chart-title page-chrome-chart-title">{chartTitle}</h3>

                    {selectedTraceIds != null && (
                        <ClearSelectionButton lang={lang} onClick={clearSelection} />
                    )}

                    <figure ref={chartRef} className="canadian-supply-demand-chart-figure" role="region" aria-label={chartRegionLabel} tabIndex={0}>
                        <div aria-hidden="true">
                        <Plot
                            key={`canadian-supply-demand-${selectedTraceIds ? selectedTraceIds.join('-') : 'all'}-${plotHeight}`}
                            data={[
                                {
                                    x: years,
                                    y: exportValues,
                                    type: 'scatter',
                                    mode: 'lines',
                                    name: exportsLabel,
                                    line: { color: hexToRgba(COLORS.exports, exportsFocused ? 1 : 0.25), width: 2.5 },
                                    hovertemplate: exportsHoverTexts,
                                },
                                {
                                    x: years,
                                    y: importValues,
                                    type: 'scatter',
                                    mode: 'lines',
                                    name: importsLabel,
                                    line: { color: hexToRgba(COLORS.imports, importsFocused ? 1 : 0.25), width: 2.5 },
                                    hovertemplate: importsHoverTexts,
                                },
                            ]}
                            layout={{
                                hoverlabel: {
                                    bgcolor: '#ffffff',
                                    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
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
                                    tickfont: tickFont,
                                    tickmode: 'array',
                                    tickvals: yearTicks,
                                    ticktext: yearTicks.map(String),
                                    range: [chartYearMin, chartYearMax],
                                    automargin: true,
                                },
                                yaxis: {
                                    title: {
                                        text: yAxisTitle,
                                        font: axisTitleFont,
                                        standoff: 12,
                                    },
                                    showgrid: false,
                                    showline: true,
                                    linewidth: 1,
                                    linecolor: '#333',
                                    zeroline: false,
                                    tickfont: tickFont,
                                    range: [0, 4.5],
                                    dtick: 0.5,
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
                            className="canadian-supply-demand-chart"
                            useResizeHandler
                            onClick={handleChartClick}
                        />
                        </div>
                    </figure>

                    <div className="canadian-supply-demand-legend" aria-hidden="true">
                        <div className="canadian-supply-demand-legend-item">
                            <span className="canadian-supply-demand-legend-line" style={{ borderColor: COLORS.exports }} />
                            <span>{exportsLabel}</span>
                        </div>
                        <div className="canadian-supply-demand-legend-item">
                            <span className="canadian-supply-demand-legend-line" style={{ borderColor: COLORS.imports }} />
                            <span>{importsLabel}</span>
                        </div>
                    </div>

                    <div className="canadian-supply-demand-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={chartTableColumns}
                            rows={TRADE_DATA}
                            csvFilename={`${fileSlugBase}.csv`}
                            docx={{
                                filename: `${fileSlugBase}.docx`,
                                title: exportTableTitle,
                                titleAlign: 'center',
                                columnWidths: [900, 1800, 1800],
                                fontSize: 20,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatMmbd(raw, 1)
                            )}
                        />
                    </div>
                </div>

                <PageFootnotes
                    lang={lang}
                    titleId="fn-canadian-supply-demand"
                    className="canadian-supply-demand-footnotes"
                    items={[
                        { id: 'fn-asterisk-canadian-supply-demand', marker: '*', text: getText('canadian_supply_demand_footnote_asterisk', lang), returnHref: '#fn-asterisk-rf-canadian-supply-demand' },
                    ]}
                />
            </div>
        </PageShell>
    );
};

export default CanadianSupplyDemand;
