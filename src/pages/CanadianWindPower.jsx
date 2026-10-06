import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { saveAs } from 'file-saver';
import { getCanadianWindPowerData } from '../utils/dataLoader';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import CanadianWindPowerInfographic from '../components/CanadianWindPowerInfographic';
import { exportCanadianWindInfographicPng, getGrowthOverlayParts } from '../components/CanadianWindPowerInfographic.constants';

const TRACE_KEYS = ['cumulative', 'annual'];
const COLORS = {
    cumulative: '#8CC63E',
    annual: '#2D5A27',
};

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
    const padded = (maxValue || 17000) * 1.05;
    const step = 1000;
    const axisMax = Math.ceil(padded / step) * step;
    const tickvals = [];
    for (let v = 0; v <= axisMax; v += step) tickvals.push(v);
    return { tickvals, range: [0, axisMax] };
};

const CanadianWindPower = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const windowWidth = useWindowWidth();
    const {
        selected: selectedPoints,
        clear: clearSelection,
        onPlotClick: handleChartClick,
    } = usePlotlySelection({ mode: 'points', traceCount: TRACE_KEYS.length, windowWidth });
    const chartRef = useRef(null);
    const infographicRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    useEffect(() => {
        getCanadianWindPowerData()
            .then(setResult)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);


    const tableRows = useMemo(() => result?.chartRows ?? [], [result]);
    const years = tableRows.map((row) => row.year);
    const startYear = result?.startYear;
    const endYear = result?.endYear;
    const stats = result?.stats ?? {};
    const tableRowsDesc = useMemo(() => [...tableRows].reverse(), [tableRows]);

    const formatMw = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const formatGw = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    };

    const formatTwh = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    };

    const chartTitle = substitute(getText('wind_power_canada_chart_title', lang), {
        startYear: startYear ?? '',
        endYear: endYear ?? '',
    });
    const exportChartTitle = stripHtml(chartTitle);
    const yAxisTitle = getText('wind_power_canada_yaxis', lang);
    const cumulativeLabel = getText('wind_power_canada_legend_cumulative', lang);
    const annualLabel = getText('wind_power_canada_legend_annual', lang);
    const fileTitle = `${getText('wind_power_canada_download_title', lang)}_${startYear ?? ''}-${endYear ?? ''}`;
    const tableCaption = substitute(getText('wind_power_canada_table_caption', lang), {
        startYear: startYear ?? '',
        endYear: endYear ?? '',
    });

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('wind_power_canada_table_col_year', lang), align: 'left' },
        { key: 'cumulativeMw', header: `${cumulativeLabel} (${getText('wind_power_canada_table_unit_mw', lang)})`, align: 'num' },
        { key: 'annualMw', header: `${annualLabel} (${getText('wind_power_canada_table_unit_mw', lang)})`, align: 'num' },
    ], [lang, cumulativeLabel, annualLabel]);

    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 72 : windowWidth <= 768 ? 62 : 50;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    const cumulativeValues = tableRows.map((row) => row.cumulativeMw ?? 0);
    const annualValues = tableRows.map((row) => row.annualMw ?? 0);
    const maxCumulative = cumulativeValues.length ? Math.max(...cumulativeValues) : 17000;
    const { tickvals: yTickvals, range: yRange } = useMemo(() => computeYAxis(maxCumulative), [maxCumulative]);

    const pointOpacityFor = (traceIndex, pointIndex) => {
        if (selectedPoints === null) return 1;
        return selectedPoints[traceIndex]?.includes(pointIndex) ? 1 : 0.25;
    };

    const pointOpacitiesFor = (traceIndex) =>
        selectedPoints === null ? 1 : years.map((_, i) => pointOpacityFor(traceIndex, i));

    const buildHoverTemplate = (label) =>
        `<b>${label}</b><br>%{x}: %{customdata} ${getText('wind_power_canada_table_unit_mw', lang)}<extra></extra>`;

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
            showgrid: false,
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
        const canvas = await exportCanadianWindInfographicPng(infographicRef.current, { scale: 2 });
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${getText('wind_power_canada_download_infographic_title', lang)}.png`);
        });
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

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        name: getText('wind_power_canada_download_chart_png', lang),
        click: (gd) => downloadChartWithTitle(gd),
    });

    const capYear = stats.capYear != null ? Math.round(stats.capYear) : '';
    const genYear = stats.genYear != null ? Math.round(stats.genYear) : '';
    const capUnit = getText('wind_power_canada_unit_gw', lang);
    const genUnit = getText('wind_power_canada_unit_twh', lang);
    const sinceLabel = getText('wind_power_canada_since_2011', lang);
    const infographicAria = substitute(getText('wind_power_canada_infographic_aria', lang), { capYear, genYear });
    const capGrowth = getGrowthOverlayParts(stats.capGrowthKey, getText, lang);
    const genGrowth = getGrowthOverlayParts(stats.genGrowthKey, getText, lang);

    if (loading || error) {
        return (
            <PageShell id="main-content" className="page-content page-80 page-chrome page-chrome--bleed" role="main">
                <PageStatus lang={lang} loading={loading} error={error} />
            </PageShell>
        );
    }

    const getChartSummary = () => {
        const body = summarizeByCategory({
            categories: years,
            series: [
                { name: getText('wind_power_canada_legend_cumulative', lang), values: cumulativeValues, format: formatMw },
                { name: getText('wind_power_canada_legend_annual', lang), values: annualValues, format: formatMw },
            ],
            lang,
            newestFirst: true,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Bar chart of Canadian wind power capacity from ${startYear} to ${endYear}`
                : `Graphique à barres de la capacité éolienne canadienne de ${startYear} à ${endYear}`,
            unitNote: lang === 'en' ? 'Values in megawatts' : 'Valeurs en mégawatts',
            body,
            lang,
        });
    };
    const chartRegionLabel = `${chartTitle}. ${getChartSummary()}`;

    return (
        <PageShell
            id="main-content"
            tabIndex="-1"
            className="page-content page-80 page-chrome page-chrome--bleed"
            role="main"
            aria-label={getText('wind_power_canada_title', lang)}
            style={{backgroundColor: 'white',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',
                boxSizing: 'border-box', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.page-80 {
    container-type: inline-size;
}
.wind-power-canada-page-title {
    font-size: clamp(28px, 4vw, 39px);
    margin: 0 0 24px 0;
    text-transform: none;
}
.wind-power-canada-infographic-section {
    width: 100%;
    max-width: 900px;
    margin: 0 auto 8px;
    overflow: visible;
}
.wind-power-canada-infographic-figure {
    position: relative;
    margin: 0;
    width: 100%;
    overflow: visible;
}
.wind-power-canada-infographic-wrapper {
    position: relative;
    width: 100%;
    container-type: inline-size;
    overflow: visible;
}
.wind-power-canada-column-stop {
    position: absolute;
    z-index: 4;
    top: 0;
    bottom: auto;
    box-sizing: border-box;
}
.wind-power-canada-column-stop:focus,
.wind-power-canada-column-stop:focus-visible {
    outline: 3px solid #ffbf47;
    outline-offset: 0;
}
.wind-power-canada-bg-image {
    display: block;
    pointer-events: none;
}
.wind-power-canada-overlay {
    position: absolute;
    font-family: 'Arial Black', Arial, sans-serif;
    font-weight: 900;
    color: #333333;
    line-height: 1.15;
    pointer-events: none;
}
.wind-power-canada-value-green,
.wind-power-canada-growth,
.wind-power-canada-growth-prefix,
.wind-power-canada-growth-word {
    color: #63ad46;
}
.wind-power-canada-growth-prefix,
.wind-power-canada-growth-word {
    display: block;
    white-space: nowrap;
}
.wind-power-canada-label {
    font-family: Arial, sans-serif;
    font-weight: bold;
}
.wind-power-canada-since {
    font-family: Arial, sans-serif;
    font-weight: bold;
}
.wind-power-canada-chart-section { width: 100%; }
.wind-power-canada-chart-title {
    color: var(--gc-text);
    margin-bottom: 12px;
    text-transform: none;
}
.wind-power-canada-chart-scroll {
    width: 100%;
    overflow: visible;
    position: relative;
    padding-top: 36px;
    padding-right: 36px;
    box-sizing: border-box;
}
.wind-power-canada-chart { width: 100%; min-width: 0; position: relative; z-index: 1; overflow: visible; }
.wind-power-canada-chart > div { width: 100%; height: 100%; overflow: visible; }
.wind-power-canada-chart .js-plotly-plot,
.wind-power-canada-chart .plot-container,
.wind-power-canada-chart .svg-container { overflow: visible !important; pointer-events: auto !important; }
.wind-power-canada-custom-legend {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px 24px;
    flex-wrap: wrap;
    margin: 8px 0;
    font-family: Arial, sans-serif;
    font-size: 13px;
}
.wind-power-canada-custom-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
.wind-power-canada-custom-legend-swatch {
    width: 14px;
    height: 14px;
    border-radius: 2px;
    border: 1px solid rgba(0,0,0,0.12);
}
.wind-power-canada-infographic-download {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin: 12px 0 28px;
    max-width: 900px;
}
.wind-power-canada-infographic-download button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
    font-size: 14px;
}
.wind-power-canada-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.wind-power-canada-infographic-download button:hover {
    background-color: #404040 !important;
}
`}</style>

            <h1 className="wind-power-canada-page-title page-chrome-title">{getText('wind_power_canada_title', lang)}</h1>

            <section className="wind-power-canada-infographic-section" ref={infographicRef} aria-label={infographicAria}>
                <CanadianWindPowerInfographic
                    lang={lang}
                    capacity={{
                        label: substitute(getText('wind_power_canada_capacity_label', lang), { year: capYear }),
                        value: `${formatGw(stats.capGw)} ${capUnit}`,
                        growthPrefix: genGrowth.prefix,
                        growthWord: genGrowth.word,
                        mult: stats.genMultLabel,
                        since: sinceLabel,
                    }}
                    generation={{
                        label: substitute(getText('wind_power_canada_generation_label', lang), { year: genYear }),
                        value: `${formatTwh(stats.genTwh)} ${genUnit}`,
                        growthPrefix: capGrowth.prefix,
                        growthWord: capGrowth.word,
                        mult: stats.capMultLabel,
                        since: sinceLabel,
                    }}
                    ariaLabel={infographicAria}
                />
            </section>

            <div className="wind-power-canada-infographic-download">
                <button type="button" onClick={downloadInfographicPng}>
                    {getText('wind_power_canada_download_infographic_png', lang)}
                </button>
            </div>

            <section className="wind-power-canada-chart-section">
                <div className="wind-power-canada-chart-frame page-chrome-chart-frame">
                    <h2 id="wind-power-canada-chart-title" className="wind-power-canada-chart-title page-chrome-chart-title">{chartTitle}</h2>
                    {selectedPoints && (
                        <ClearSelectionButton lang={lang} onClick={clearSelection} />
                    )}
                    <div className="wind-power-canada-chart-scroll">
                        <figure ref={chartRef} className="wind-power-canada-chart" role="region" aria-label={chartRegionLabel} tabIndex={0}>
                            <div aria-hidden="true" style={{ width: '100%', height: '100%' }}>
                            <Plot
                                key={`wind-power-canada-${selectedPoints ? 'sel' : 'all'}-${plotHeight}`}
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
                    <div className="wind-power-canada-custom-legend" aria-hidden="true">
                        <span className="wind-power-canada-custom-legend-item">
                            <span className="wind-power-canada-custom-legend-swatch" style={{ backgroundColor: COLORS.cumulative }} />
                            {cumulativeLabel}
                        </span>
                        <span className="wind-power-canada-custom-legend-item">
                            <span className="wind-power-canada-custom-legend-swatch" style={{ backgroundColor: COLORS.annual }} />
                            {annualLabel}
                        </span>
                    </div>
                    <div className="wind-power-canada-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            className="wind-power-canada-data-table"
                            columns={tableColumns}
                            rows={tableRowsDesc}
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
            </section>
        </PageShell>
    );
};

export default CanadianWindPower;
