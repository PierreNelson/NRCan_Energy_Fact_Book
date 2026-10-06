import React, { useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import useViewportZoom from '../hooks/useViewportZoom';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { downloadInfographicImagePng } from '../utils/downloadInfographicPng';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import SolarPvCanadaInfographic from '../components/SolarPvCanadaInfographic';

const TRACE_KEYS = ['cumulative', 'annual'];
const COLORS = {
    cumulative: '#8CC63E',
    annual: '#2D5A27',
};
const START_YEAR = 2011;
const END_YEAR = 2024;
const STAT_YEAR = 2024;

/** Hardcoded installed capacity (MW) — replace with pipeline data when available. */
const CHART_ROWS = [
    { year: 2011, cumulativeMw: 500, annualMw: 300 },
    { year: 2012, cumulativeMw: 700, annualMw: 200 },
    { year: 2013, cumulativeMw: 1100, annualMw: 400 },
    { year: 2014, cumulativeMw: 1600, annualMw: 550 },
    { year: 2015, cumulativeMw: 2200, annualMw: 600 },
    { year: 2016, cumulativeMw: 2300, annualMw: 100 },
    { year: 2017, cumulativeMw: 2550, annualMw: 250 },
    { year: 2018, cumulativeMw: 2700, annualMw: 150 },
    { year: 2019, cumulativeMw: 2900, annualMw: 200 },
    { year: 2020, cumulativeMw: 3150, annualMw: 250 },
    { year: 2021, cumulativeMw: 3950, annualMw: 800 },
    { year: 2022, cumulativeMw: 4400, annualMw: 450 },
    { year: 2023, cumulativeMw: 5100, annualMw: 700 },
    { year: 2024, cumulativeMw: 5290, annualMw: 190 },
];


const HOVER_LABEL = {
    bgcolor: '#ffffff',
    bordercolor: '#000000',
    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
};

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const computeYAxis = (maxValue) => {
    const padded = (maxValue || 6000) * 1.05;
    const step = 1000;
    const axisMax = Math.max(step, Math.ceil(padded / step) * step);
    const tickvals = [];
    for (let v = 0; v <= axisMax; v += step) tickvals.push(v);
    return { tickvals, range: [0, axisMax] };
};

const SolarPvInCanada = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const {
        selected: selectedPoints,
        clear: clearSelection,
        onPlotClick: handleChartClick,
    } = usePlotlySelection({ mode: 'points', traceCount: TRACE_KEYS.length, windowWidth });
    const { viewportScale } = useViewportZoom();
    const chartRef = useRef(null);
    const infographicRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const stackedLayout = viewportScale >= 1.1 || windowWidth <= 1000;

    const tableRows = CHART_ROWS;
    const years = tableRows.map((row) => row.year);

    const formatMw = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const vars = { startYear: START_YEAR, endYear: END_YEAR, year: STAT_YEAR };
    const chartTitle = substitute(getText('solar_pv_canada_chart_title', lang), vars);
    const exportChartTitle = stripHtml(chartTitle);
    const yAxisTitle = getText('solar_pv_canada_yaxis', lang);
    const cumulativeLabel = getText('solar_pv_canada_legend_cumulative', lang);
    const annualLabel = getText('solar_pv_canada_legend_annual', lang);
    const fileTitle = `${getText('solar_pv_canada_download_title', lang)}_${START_YEAR}-${END_YEAR}`;
    const tableCaption = substitute(getText('solar_pv_canada_table_caption', lang), vars);

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('solar_pv_canada_table_col_year', lang), align: 'left' },
        { key: 'cumulativeMw', header: `${cumulativeLabel} (${getText('solar_pv_canada_table_unit_mw', lang)})`, align: 'num' },
        { key: 'annualMw', header: `${annualLabel} (${getText('solar_pv_canada_table_unit_mw', lang)})`, align: 'num' },
    ], [lang, cumulativeLabel, annualLabel]);

    const plotHeight = stackedLayout
        ? (windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420)
        : (windowWidth <= 768 ? 300 : 320);
    const plotTopMargin = stackedLayout
        ? (windowWidth <= 480 ? 24 : 20)
        : 12;
    const plotBottomMargin = stackedLayout
        ? (windowWidth <= 480 ? 72 : windowWidth <= 768 ? 62 : 50)
        : (windowWidth <= 768 ? 48 : 40);
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    const cumulativeValues = tableRows.map((row) => row.cumulativeMw ?? 0);
    const annualValues = tableRows.map((row) => row.annualMw ?? 0);
    const maxCumulative = cumulativeValues.length ? Math.max(...cumulativeValues) : 6000;
    const { tickvals: yTickvals, range: yRange } = useMemo(() => computeYAxis(maxCumulative), [maxCumulative]);

    const pointOpacityFor = (traceIndex, pointIndex) => {
        if (selectedPoints === null) return 1;
        return selectedPoints[traceIndex]?.includes(pointIndex) ? 1 : 0.25;
    };

    const pointOpacitiesFor = (traceIndex) =>
        selectedPoints === null ? 1 : years.map((_, i) => pointOpacityFor(traceIndex, i));

    const buildHoverTemplate = (label) =>
        `<b>${label}</b><br>%{x}: %{customdata} ${getText('solar_pv_canada_table_unit_mw', lang)}<extra></extra>`;

    const plotData = [
        {
            type: 'bar',
            name: cumulativeLabel,
            x: years.map(String),
            y: cumulativeValues,
            marker: { color: COLORS.cumulative, opacity: pointOpacitiesFor(0) },
            customdata: cumulativeValues.map((v) => formatMw(v)),
            hovertemplate: buildHoverTemplate(cumulativeLabel),
            hoverlabel: HOVER_LABEL,
        },
        {
            type: 'bar',
            name: annualLabel,
            x: years.map(String),
            y: annualValues,
            marker: { color: COLORS.annual, opacity: pointOpacitiesFor(1) },
            customdata: annualValues.map((v) => formatMw(v)),
            hovertemplate: buildHoverTemplate(annualLabel),
            hoverlabel: HOVER_LABEL,
        },
    ];

    const layout = {
        barmode: 'group',
        bargap: 0.15,
        bargroupgap: 0.08,
        hovermode: 'closest',
        hoverlabel: HOVER_LABEL,
        clickmode: 'event',
        dragmode: false,
        showlegend: false,
        xaxis: {
            type: 'category',
            categoryorder: 'array',
            categoryarray: years.map(String),
            tickmode: 'array',
            tickvals: years.map(String),
            ticktext: years.map(String),
            showgrid: false,
            zeroline: false,
            tickfont: tickFont,
            automargin: true,
            fixedrange: true,
        },
        yaxis: {
            title: { text: yAxisTitle, font: axisTitleFont, standoff: 12 },
            tickvals: yTickvals,
            range: yRange,
            showgrid: true,
            gridcolor: '#e0e0e0',
            showline: true,
            linewidth: 1,
            linecolor: '#333',
            zeroline: false,
            tickfont: tickFont,
            automargin: true,
            fixedrange: true,
        },
        margin: { t: plotTopMargin, r: 20, b: plotBottomMargin, l: windowWidth <= 480 ? 56 : 72 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        height: plotHeight,
    };

    const downloadInfographicPng = async () => {
        await downloadInfographicImagePng(
            infographicRef.current?.getGraphicElement?.() ?? infographicRef.current,
            { filename: `${getText('solar_pv_canada_download_infographic_title', lang)}.png` },
        );
    };

        const downloadChartWithTitle = useChartPngDownloader(
            chartRef,
            () => ({
            filename: `${fileTitle}.png`,
            title: exportChartTitle,
            height: 700,
            legendItems: [
                { label: cumulativeLabel, color: COLORS.cumulative },
                { label: annualLabel, color: COLORS.annual },
            ],
        }),
            [COLORS, annualLabel, cumulativeLabel, exportChartTitle, fileTitle],
        );

    const downloadBtnStyle = {
        padding: '8px 16px',
        backgroundColor: '#8C8C8C',
        border: '1px solid #404040',
        borderRadius: '4px',
        cursor: 'pointer',
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        color: '#ffffff',
    };

    const getChartSummary = () => {
        const body = summarizeByCategory({
            categories: years,
            series: [
                { name: cumulativeLabel, values: cumulativeValues, format: formatMw },
                { name: annualLabel, values: annualValues, format: formatMw },
            ],
            lang,
            newestFirst: true,
        });
        return joinChartSummary({
            intro: lang === 'en' ? 'Bar chart of solar PV capacity in Canada' : 'Graphique à barres de la capacité solaire photovoltaïque au Canada',
            unitNote: lang === 'en' ? 'Values in megawatts' : 'Valeurs en mégawatts',
            body,
            lang,
        });
    };
    const chartRegionLabel = `${chartTitle}. ${getChartSummary()}`;


    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
        name: getText('solar_pv_canada_download_chart_png', lang),
    });

    return (
        <PageShell id="main-content"
            tabIndex="-1"
            className="page-content solar-pv-canada-page page-chrome page-chrome--bleed"
            role="main"
            aria-labelledby="solar-pv-canada-main-title"
            style={{backgroundColor: 'white',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',
                boxSizing: 'border-box', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.solar-pv-canada-page {
    container-type: inline-size;
}
.solar-pv-canada-container { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.solar-pv-canada-title {
    line-height: 1.25;
    text-transform: none;
}
.solar-pv-canada-split {
    display: grid;
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
    gap: 24px;
    align-items: start;
}
.solar-pv-canada-split.is-stacked {
    grid-template-columns: 1fr;
}
.solar-pv-canada-split:not(.is-stacked) {
    align-items: stretch;
}
.solar-pv-canada-left,
.solar-pv-canada-right { min-width: 0; }
.solar-pv-canada-split:not(.is-stacked) .solar-pv-canada-left {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
}
.solar-pv-canada-split:not(.is-stacked) .solar-pv-canada-infographic-download {
    margin-top: auto;
    margin-bottom: 0;
}
.solar-pv-canada-split:not(.is-stacked) .solar-pv-canada-chart-frame {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    padding: 14px 16px 16px;
    height: 100%;
}
.solar-pv-canada-split:not(.is-stacked) .solar-pv-canada-chart-align-spacer {
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
}
.solar-pv-canada-split:not(.is-stacked) .solar-pv-canada-chart-scroll {
    padding-top: 20px;
    padding-right: 24px;
}
.solar-pv-canada-split:not(.is-stacked) .solar-pv-canada-chart-title {
    margin-bottom: 8px;
}
.solar-pv-canada-split:not(.is-stacked) .solar-pv-canada-custom-legend {
    margin: 4px 0 8px;
}
.solar-pv-canada-split:not(.is-stacked) .solar-pv-canada-table-wrapper {
    margin-top: 0 !important;
}
.solar-pv-canada-infographic-figure { margin: 0 0 12px 0; }
.solar-pv-canada-infographic { width: 100%; }
.solar-pv-canada-infographic-bg,
.solar-pv-canada-infographic-bg svg { width: 100%; height: auto; display: block; }
.solar-pv-canada-infographic-download { display: flex; gap: 10px; flex-wrap: wrap; margin: 0 0 8px; }
.solar-pv-canada-chart-title {
    color: var(--gc-text);
    margin-bottom: 12px;
    text-transform: none;
}
.solar-pv-canada-chart-scroll {
    width: 100%;
    overflow: visible;
    position: relative;
    padding-top: 36px;
    padding-right: 36px;
    box-sizing: border-box;
}
.solar-pv-canada-chart { width: 100%; min-width: 0; position: relative; z-index: 1; overflow: visible; margin: 0; }
.solar-pv-canada-chart > div { width: 100%; height: 100%; overflow: visible; }
.solar-pv-canada-chart .js-plotly-plot,
.solar-pv-canada-chart .plot-container,
.solar-pv-canada-chart .svg-container { overflow: visible !important; pointer-events: auto !important; }
.solar-pv-canada-custom-legend {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px 24px;
    flex-wrap: wrap;
    margin: 8px 0;
    font-family: Arial, sans-serif;
    font-size: 13px;
    color: var(--gc-text);
}
.solar-pv-canada-custom-legend-item { display: inline-flex; align-items: center; gap: 6px; }
.solar-pv-canada-custom-legend-swatch {
    width: 14px;
    height: 14px;
    border-radius: 2px;
    border: 1px solid rgba(0,0,0,0.12);
}
.solar-pv-canada-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.solar-pv-canada-infographic-download button:hover { background-color: #404040 !important; }
@media (max-width: 768px) {
    .solar-pv-canada-chart-title { font-size: 24px; }
}
            `}</style>

            <div className="solar-pv-canada-container">
                <header>
                    <h1 id="solar-pv-canada-main-title" className="solar-pv-canada-title page-chrome-title">
                        {getText('solar_pv_canada_title', lang)}
                    </h1>
                </header>

                <div className={`solar-pv-canada-split${stackedLayout ? ' is-stacked' : ''}`}>
                    <div className="solar-pv-canada-left">
                        <SolarPvCanadaInfographic
                            lang={lang}
                            stacked={stackedLayout}
                            title={getText('solar_pv_canada_title', lang)}
                            figureRef={infographicRef}
                        />
                        <div className="solar-pv-canada-infographic-download">
                            <button type="button" onClick={downloadInfographicPng} style={downloadBtnStyle}>
                                {getText('solar_pv_canada_download_infographic_png', lang)}
                            </button>
                        </div>
                    </div>

                    <div className="solar-pv-canada-right">
                        <div className="solar-pv-canada-chart-frame page-chrome-chart-frame">
                            <h2 id="solar-pv-canada-chart-title" className="solar-pv-canada-chart-title page-chrome-chart-title">{chartTitle}</h2>
                            {selectedPoints && (
                                <ClearSelectionButton
                                    lang={lang}
                                    label={getText('solar_pv_canada_clear_selection', lang)}
                                    onClick={clearSelection}
                                />
                            )}
                            <div className="solar-pv-canada-chart-scroll">
                                <figure ref={chartRef} className="solar-pv-canada-chart" role="region" aria-label={chartRegionLabel} tabIndex={0}>
                                    <div aria-hidden="true" style={{ width: '100%', height: '100%' }}>
                                    <Plot
                                        key={`solar-pv-canada-${selectedPoints ? 'sel' : 'all'}-${plotHeight}-${stackedLayout ? 'stack' : 'side'}`}
                                        data={plotData}
                                        layout={layout}
                                        config={plotConfig}
                                        style={{ width: '100%', height: '100%' }}
                                        useResizeHandler
                                        onClick={handleChartClick}
                                    />
                                    </div>
                                </figure>
                            </div>
                            <div className="solar-pv-canada-custom-legend" aria-hidden="true">
                                <span className="solar-pv-canada-custom-legend-item">
                                    <span className="solar-pv-canada-custom-legend-swatch" style={{ backgroundColor: COLORS.cumulative }} />
                                    {cumulativeLabel}
                                </span>
                                <span className="solar-pv-canada-custom-legend-item">
                                    <span className="solar-pv-canada-custom-legend-swatch" style={{ backgroundColor: COLORS.annual }} />
                                    {annualLabel}
                                </span>
                            </div>

                            {!stackedLayout && (
                                <div
                                    className="solar-pv-canada-chart-align-spacer"
                                    aria-hidden="true"
                                />
                            )}

                            <div className="solar-pv-canada-table-wrapper">
                                <ChartDataTable
                                    lang={lang}
                                    className="solar-pv-canada-data-table"
                                    columns={tableColumns}
                                    rows={tableRows}
                                    csvFilename={`${fileTitle}.csv`}
                                    docx={{
                                        filename: `${fileTitle}.docx`,
                                        title: exportChartTitle,
                                        titleAlign: 'center',
                                        columnWidths: [1400, 3200, 3200],
                                        fontSize: 22,
                                    }}
                                    caption={tableCaption}
                                    tableAriaLabel={tableCaption}
                                    renderCell={(raw, { colIndex }) => (
                                        colIndex === 0 ? String(raw ?? '') : formatMw(raw ?? 0)
                                    )}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default SolarPvInCanada;
