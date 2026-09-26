import React, { useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
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
import EnergyIntensityIndexInfographic from '../components/EnergyIntensityIndexInfographic';

const energy_intensity_index_DATA = [
    { year: 2000, perCapita: 100, perGdp: 100 },
    { year: 2001, perCapita: 96, perGdp: 95 },
    { year: 2002, perCapita: 98, perGdp: 96 },
    { year: 2003, perCapita: 100, perGdp: 96 },
    { year: 2004, perCapita: 101, perGdp: 96 },
    { year: 2005, perCapita: 99, perGdp: 92 },
    { year: 2006, perCapita: 97, perGdp: 89 },
    { year: 2007, perCapita: 101, perGdp: 91 },
    { year: 2008, perCapita: 98, perGdp: 89 },
    { year: 2009, perCapita: 94, perGdp: 89 },
    { year: 2010, perCapita: 94, perGdp: 88 },
    { year: 2011, perCapita: 97, perGdp: 88 },
    { year: 2012, perCapita: 96, perGdp: 87 },
    { year: 2013, perCapita: 97, perGdp: 86 },
    { year: 2014, perCapita: 97, perGdp: 85 },
    { year: 2015, perCapita: 96, perGdp: 84 },
    { year: 2016, perCapita: 94, perGdp: 82 },
    { year: 2017, perCapita: 96, perGdp: 82 },
    { year: 2018, perCapita: 99, perGdp: 83 },
    { year: 2019, perCapita: 98, perGdp: 83 },
    { year: 2020, perCapita: 87, perGdp: 78 },
    { year: 2021, perCapita: 89, perGdp: 75 },
    { year: 2022, perCapita: 91, perGdp: 75 },
];

const COLORS = {
    perCapita: '#CE8003',
    perGdp: '#4b4c4d',
};

const EnergyIntensityIndex = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const {
        selected: selectedPoints,
        clear,
        onPlotClick: handleChartClick,
        opacityFor,
    } = usePlotlySelection({ mode: 'points', traceCount: 2, windowWidth });
    const chartRef = useRef(null);
    const infographicRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const formatIndex = (num) => {
        if (num == null || Number.isNaN(Number(num))) return '—';
        return Math.round(Number(num)).toLocaleString(locale);
    };

    const years = useMemo(() => energy_intensity_index_DATA.map((r) => r.year), []);
    const perCapitaValues = useMemo(() => energy_intensity_index_DATA.map((r) => r.perCapita), []);
    const perGdpValues = useMemo(() => energy_intensity_index_DATA.map((r) => r.perGdp), []);
    const tableRows = useMemo(() => [...energy_intensity_index_DATA].reverse(), []);

    const legendPerCapita = getText('energy_intensity_index_legend_per_capita', lang);
    const legendPerGdp = getText('energy_intensity_index_legend_per_gdp', lang);

    const chartTitle = getText('energy_intensity_index_chart_title', lang);
    const exportChartTitle = stripHtml(chartTitle);
    const chartDownloadSlug = getText('energy_intensity_index_download_title', lang).replace(/\s+/g, '_');

    const yAxisTitle = getText('energy_intensity_index_yaxis', lang);
    const tableCaption = getText('energy_intensity_index_table_caption', lang);

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('petroleum_employment_table_col_year', lang), align: 'left' },
        { key: 'perCapita', header: `${legendPerCapita} (${yAxisTitle})`, align: 'num' },
        { key: 'perGdp', header: `${legendPerGdp} (${yAxisTitle})`, align: 'num' },
    ], [lang, legendPerCapita, legendPerGdp, yAxisTitle]);

    const getChartSummary = () => {
        const body = summarizeByCategory({
            categories: years,
            series: [
                { name: legendPerCapita, values: perCapitaValues, format: formatIndex },
                { name: legendPerGdp, values: perGdpValues, format: formatIndex },
            ],
            lang,
        });
        return joinChartSummary({
            intro: getText('energy_intensity_index_chart_aria', lang),
            unitNote: lang === 'en' ? 'Values as index (2000=100)' : 'Valeurs en indice (2000=100)',
            body,
            lang,
        });
    };

    const xTickvals = years.filter((y) => y % 2 === 0);
    const yTickvals = [70, 80, 90, 100, 110];
    const yTicktext = yTickvals.map((v) => String(v));

    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 62 : windowWidth <= 768 ? 56 : 50;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    const traceHasSelection = (traceIndex) => selectedPoints?.[traceIndex]?.length > 0;

    const markerOpacityFor = (traceIndex, pointIndex) => opacityFor(traceIndex, pointIndex);

    const lineColorFor = (traceIndex, baseColor) => {
        if (selectedPoints === null) return baseColor;
        return traceHasSelection(traceIndex) ? baseColor : hexToRgba(baseColor, 0.3);
    };

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
            filename: `${chartDownloadSlug}.png`,
            title: exportChartTitle,
            height: 640,
            legendItems: [
                { label: legendPerCapita, color: COLORS.perCapita },
                { label: legendPerGdp, color: COLORS.perGdp },
            ],
        }),
        [COLORS, chartDownloadSlug, exportChartTitle, legendPerCapita, legendPerGdp],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const perCapitaHover = years.map(
        (y, i) => `<b>${legendPerCapita}</b><br>${y}: ${formatIndex(perCapitaValues[i])}<extra></extra>`,
    );
    const perGdpHover = years.map(
        (y, i) => `<b>${legendPerGdp}</b><br>${y}: ${formatIndex(perGdpValues[i])}<extra></extra>`,
    );

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-55 energy-intensity-index-intensity-index page-chrome page-chrome--bleed"
            aria-labelledby="energy-intensity-index-chart-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.page-55.energy-intensity-index-intensity-index {
}
.energy-intensity-index-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.energy-intensity-index-infographic-section {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0;
}
.energy-intensity-index-chart-frame {
    margin-top: 8px;
}
.energy-intensity-index-chart-title {
    color: var(--gc-text);
    margin: 0 0 12px 0;
    text-transform: none;
}
.energy-intensity-index-chart {
    width: 100%;
    min-width: 0;
    height: ${plotHeight}px;
    position: relative;
}
.energy-intensity-index-chart > div { width: 100%; height: 100%; }
.energy-intensity-index-legend {
    gap: 18px 28px;
    margin-top: 12px;
    font-size: 14px;
    color: var(--gc-text);
}
.energy-intensity-index-table-wrapper { display: block; width: 100%; margin-top: 20px; }
@media (max-width: 480px) {
    .energy-intensity-index-chart { height: 320px; }
}
            `}</style>

            <div className="energy-intensity-index-inner">
                <div className="energy-intensity-index-chart-frame page-chrome-chart-frame">
                    <h2
                        id="energy-intensity-index-chart-title"
                        className="energy-intensity-index-chart-title page-chrome-chart-title"
                    >
                        {chartTitle}
                    </h2>

                    {selectedPoints !== null && <ClearSelectionButton lang={lang} onClick={clear} />}

                    <figure ref={chartRef} style={{ margin: 0 }}>
                        <div
                            role="region"
                            aria-label={`${exportChartTitle}. ${getChartSummary()}`}
                            tabIndex="0"
                        >
                            <Plot
                                key={`energy-intensity-index-${selectedPoints ? `${selectedPoints[0].join('-')}_${selectedPoints[1].join('-')}` : 'all'}-${plotHeight}`}
                                data={[
                                    {
                                        x: years,
                                        y: perCapitaValues,
                                        type: 'scatter',
                                        mode: 'lines+markers',
                                        name: legendPerCapita,
                                        line: { color: lineColorFor(0, COLORS.perCapita), width: 2.5 },
                                        marker: {
                                            color: COLORS.perCapita,
                                            size: 8,
                                            opacity: years.map((_, i) => markerOpacityFor(0, i)),
                                        },
                                        hovertemplate: perCapitaHover,
                                    },
                                    {
                                        x: years,
                                        y: perGdpValues,
                                        type: 'scatter',
                                        mode: 'lines+markers',
                                        name: legendPerGdp,
                                        line: { color: lineColorFor(1, COLORS.perGdp), width: 2.5 },
                                        marker: {
                                            color: COLORS.perGdp,
                                            size: 8,
                                            opacity: years.map((_, i) => markerOpacityFor(1, i)),
                                        },
                                        hovertemplate: perGdpHover,
                                    },
                                ]}
                                layout={{
                                    showlegend: false,
                                    clickmode: 'event',
                                    dragmode: false,
                                    hovermode: 'closest',
                                    hoverlabel: {
                                        bgcolor: '#ffffff',
                                        font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
                                    },
                                    margin: { l: 72, r: 24, t: plotTopMargin, b: plotBottomMargin },
                                    paper_bgcolor: 'rgba(0,0,0,0)',
                                    plot_bgcolor: 'rgba(0,0,0,0)',
                                    height: plotHeight,
                                    autosize: true,
                                    xaxis: {
                                        type: 'linear',
                                        tickmode: 'array',
                                        tickvals: xTickvals,
                                        ticktext: xTickvals.map(String),
                                        showgrid: false,
                                        zeroline: false,
                                        showline: true,
                                        linewidth: 1,
                                        linecolor: '#333',
                                        tickfont: tickFont,
                                        automargin: true,
                                    },
                                    yaxis: {
                                        title: { text: yAxisTitle, font: axisTitleFont, standoff: 12 },
                                        range: [70, 110],
                                        tickmode: 'array',
                                        tickvals: yTickvals,
                                        ticktext: yTicktext,
                                        showgrid: true,
                                        gridcolor: '#e0e0e0',
                                        showline: true,
                                        linewidth: 1,
                                        linecolor: '#333',
                                        zeroline: false,
                                        tickfont: tickFont,
                                        automargin: true,
                                    },
                                }}
                                config={plotConfig}
                                className="energy-intensity-index-chart"
                                useResizeHandler
                                onClick={handleChartClick}
                            />
                        </div>
                    </figure>

                    <HtmlLegend
                        className="energy-intensity-index-legend"
                        variant="line"
                        itemClassName="energy-intensity-index-legend-item"
                        markerClassName="energy-intensity-index-legend-line"
                        items={[
                            { label: legendPerCapita, color: COLORS.perCapita },
                            { label: legendPerGdp, color: COLORS.perGdp },
                        ]}
                    />

                    <div className="energy-intensity-index-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={`${chartDownloadSlug}.csv`}
                            docx={{
                                filename: `${chartDownloadSlug}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [900, 3600, 3600],
                                fontSize: 20,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatIndex(raw)
                            )}
                        />
                    </div>
                </div>

                <div className="energy-intensity-index-infographic-section">
                    <EnergyIntensityIndexInfographic
                        figureRef={infographicRef}
                        lang={lang}
                        getText={getText}
                        ariaLabel={getText('energy_intensity_index_infographic_aria', lang)}
                    />
                </div>
            </div>
        </PageShell>
    );
};

export default EnergyIntensityIndex;
