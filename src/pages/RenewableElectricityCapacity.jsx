import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getRenewableElectricityCapacityData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import HtmlLegend from '../components/HtmlLegend';
import hexToRgba from '../utils/hexToRgba';

const TRACE_KEYS = ['hydro', 'wind', 'solarTidal', 'biomass'];
const LEGEND_KEYS = [...TRACE_KEYS].reverse();
const TRACE_COUNT = TRACE_KEYS.length;

const COLORS = {
    hydro: '#2B5C3F',
    wind: '#5E9348',
    solarTidal: '#C4D56E',
    biomass: '#6D91B3',
};

const HOVER_LABEL = {
    bgcolor: '#ffffff',
    bordercolor: '#000000',
    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
};

const DENSIFY_STEPS = 12;

const densifyBandSeries = (years, yTops, yBases, label, categoryValues, formatHoverMw) => {
    if (!years.length) return { x: [], y: [], hover: [] };

    const xDense = [];
    const topDense = [];
    const baseDense = [];
    const hover = [];

    const pushPoint = (xVal, top, bottom, nearestIdx) => {
        xDense.push(xVal);
        topDense.push(top);
        baseDense.push(bottom);
        hover.push(`<b>${label}</b><br>${years[nearestIdx]}: ${formatHoverMw(categoryValues[nearestIdx])}<extra></extra>`);
    };

    if (years.length === 1) {
        pushPoint(years[0], yTops[0], yBases[0] ?? 0, 0);
    } else {
        for (let i = 0; i < years.length - 1; i += 1) {
            for (let s = 0; s < DENSIFY_STEPS; s += 1) {
                const t = s / DENSIFY_STEPS;
                const xVal = years[i] + t * (years[i + 1] - years[i]);
                const top = yTops[i] + t * (yTops[i + 1] - yTops[i]);
                const bottom = yBases[i] + t * (yBases[i + 1] - yBases[i]);
                const nearestIdx = t < 0.5 ? i : i + 1;
                pushPoint(xVal, top, bottom, nearestIdx);
            }
        }
        const last = years.length - 1;
        pushPoint(years[last], yTops[last], yBases[last], last);
    }

    const hoverClosed = [...hover, ...hover.slice().reverse()];
    return {
        x: [...xDense, ...xDense.slice().reverse()],
        y: [...topDense, ...baseDense.slice().reverse()],
        hover: hoverClosed,
    };
};

const traceIndexFromCurveNumber = (curveNumber) => {
    if (curveNumber == null || curveNumber < 0) return null;
    if (curveNumber < TRACE_COUNT) return curveNumber;
    if (curveNumber < TRACE_COUNT * 2) return curveNumber - TRACE_COUNT;
    return null;
};

const traceOpacityFor = (selectedTraceIds, traceIndex) => {
    if (selectedTraceIds === null || selectedTraceIds.includes(traceIndex)) return 1;
    return 0.3;
};

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const computeYAxis = (maxTotal) => {
    if (!maxTotal || maxTotal <= 0) {
        return { tickvals: [0, 20000, 40000, 60000, 80000, 100000], range: [0, 110000] };
    }
    const padded = maxTotal * 1.1;
    const magnitude = 10 ** Math.floor(Math.log10(padded));
    const step = padded <= 120000 ? 20000 : magnitude >= 100000 ? 100000 : 50000;
    const axisMax = Math.ceil(padded / step) * step;
    const tickvals = [];
    for (let v = 0; v <= axisMax; v += step) tickvals.push(v);
    return { tickvals, range: [0, axisMax] };
};

const resolveHoverFromPointer = (graphDiv, clientX, clientY, data) => {
    if (!graphDiv?._fullLayout || !data?.years?.length) return null;

    const {
        years, traceLabels, traceValueArrays, hydroValues,
        cumWindTops, cumSolarTidalTops, cumBiomassTops, yRangeMax, formatHoverMw,
    } = data;

    const xax = graphDiv._fullLayout.xaxis;
    const yax = graphDiv._fullLayout.yaxis;
    const gdRect = graphDiv.getBoundingClientRect();
    const xPx = clientX - gdRect.left - xax._offset;
    const yPx = clientY - gdRect.top - yax._offset;

    if (xPx < 0 || xPx > xax._length || yPx < 0 || yPx > yax._length) return null;

    const xData = xax.p2l(xPx);
    const yData = yax.p2l(yPx);
    if (xData < years[0] || xData > years[years.length - 1]) return null;
    if (yData < 0 || yData > yRangeMax) return null;

    let nearestIndex = 0;
    let minDist = Infinity;
    years.forEach((year, i) => {
        const dist = Math.abs(year - xData);
        if (dist < minDist) {
            minDist = dist;
            nearestIndex = i;
        }
    });

    let segIndex = years.length - 2;
    for (let i = 0; i < years.length - 1; i += 1) {
        if (xData <= years[i + 1]) {
            segIndex = i;
            break;
        }
    }
    segIndex = Math.max(0, Math.min(segIndex, years.length - 2));

    const x0 = years[segIndex];
    const x1 = years[segIndex + 1];
    const t = x1 === x0 ? 0 : (xData - x0) / (x1 - x0);
    const lerp = (arr) => arr[segIndex] + t * (arr[segIndex + 1] - arr[segIndex]);

    const bandBounds = [
        [0, lerp(hydroValues)],
        [lerp(hydroValues), lerp(cumWindTops)],
        [lerp(cumWindTops), lerp(cumSolarTidalTops)],
        [lerp(cumSolarTidalTops), lerp(cumBiomassTops)],
    ];

    const yEpsilon = yRangeMax * 0.002;
    let traceIndex = null;
    for (let i = TRACE_COUNT - 1; i >= 0; i -= 1) {
        const [lo, hi] = bandBounds[i];
        if (yData >= lo - yEpsilon && yData <= hi + yEpsilon) {
            traceIndex = i;
            break;
        }
    }
    if (traceIndex === null) return null;

    return {
        traceIndex,
        nearestIndex,
        xData,
        category: traceLabels[traceIndex],
        year: years[nearestIndex],
        value: formatHoverMw(traceValueArrays[traceIndex][nearestIndex]),
    };
};

const RenewableElectricityCapacityPlot = memo(function RenewableElectricityCapacityPlot({
    plotData, plotLayout, chartConfig, plotHeight, onPlotReady,
}) {
    return (
        <Plot
            key={`renewable-electricity-capacity-${plotHeight}`}
            data={plotData}
            layout={plotLayout}
            config={chartConfig}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
            onInitialized={onPlotReady}
            onUpdate={onPlotReady}
        />
    );
});

const RenewableElectricityCapacity = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const windowWidth = useWindowWidth();
    const {
        selected: selectedTraceIds,
        clear: clearSelection,
        toggleSlice,
    } = usePlotlySelection({ mode: 'slices', windowWidth });
    const chartRef = useRef(null);
    const graphDivRef = useRef(null);
    const clickHandlerRef = useRef(null);
    const hoverDataRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const formatMw = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const hoverUnit = getText('renewable_electricity_capacity_hover_unit', lang);
    const tableUnitSuffix = getText('renewable_electricity_capacity_table_unit', lang);

    const formatHoverMw = (value) => {
        const formatted = formatMw(value);
        return formatted === '—' ? formatted : `${formatted}${hoverUnit}`;
    };

    useEffect(() => {
        getRenewableElectricityCapacityData()
            .then(setResult)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    const tableRows = useMemo(() => result?.data ?? [], [result]);
    const years = tableRows.map((row) => row.year);
    const startYear = result?.startYear;
    const endYear = result?.endYear;
    const yearTicks = years.filter((y) => y % 2 === 1);

    const hydroLabel = getText('renewable_electricity_capacity_legend_hydro', lang);
    const windLabel = getText('renewable_electricity_capacity_legend_wind', lang);
    const solarTidalLabel = getText('renewable_electricity_capacity_legend_solarTidal', lang);
    const biomassLabel = getText('renewable_electricity_capacity_legend_biomass', lang);
    const totalLabel = getText('renewable_electricity_capacity_table_col_total', lang);
    const traceLabels = [hydroLabel, windLabel, solarTidalLabel, biomassLabel];
    const chartTitle = substitute(getText('renewable_electricity_capacity_chart_title', lang), {
        startYear: startYear ?? '',
        endYear: endYear ?? '',
    });
    const exportChartTitle = stripHtml(chartTitle);
    const yAxisTitle = getText('renewable_electricity_capacity_yaxis', lang);
    const fileTitle = `${getText('renewable_electricity_capacity_download_title', lang)}_${startYear ?? ''}-${endYear ?? ''}`;
    const tableCaption = substitute(getText('renewable_electricity_capacity_table_caption', lang), {
        startYear: startYear ?? '',
        endYear: endYear ?? '',
    });

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('renewable_electricity_capacity_table_col_year', lang), align: 'left' },
        { key: 'hydro', header: `${hydroLabel} ${tableUnitSuffix}`, align: 'num' },
        { key: 'wind', header: `${windLabel} ${tableUnitSuffix}`, align: 'num' },
        { key: 'solarTidal', header: `${solarTidalLabel} ${tableUnitSuffix}`, align: 'num' },
        { key: 'biomass', header: `${biomassLabel} ${tableUnitSuffix}`, align: 'num' },
        { key: 'total', header: `${totalLabel} ${tableUnitSuffix}`, align: 'num' },
    ], [lang, hydroLabel, windLabel, solarTidalLabel, biomassLabel, totalLabel, tableUnitSuffix]);

    const dataTableRows = useMemo(
        () => tableRows.map((row) => ({
            year: row.year,
            hydro: row.hydro,
            wind: row.wind,
            solarTidal: row.solarTidal,
            biomass: row.biomass,
            total: row.hydro + row.wind + row.solarTidal + row.biomass,
        })),
        [tableRows],
    );

    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 72 : windowWidth <= 768 ? 62 : 50;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    const hydroValues = tableRows.map((row) => row.hydro);
    const windValues = tableRows.map((row) => row.wind);
    const solarTidalValues = tableRows.map((row) => row.solarTidal);
    const biomassValues = tableRows.map((row) => row.biomass);

    const maxTotal = useMemo(
        () => (tableRows.length
            ? Math.max(...tableRows.map((row) => row.hydro + row.wind + row.solarTidal + row.biomass))
            : 0),
        [tableRows],
    );
    const { tickvals: yTickvals, range: yRange } = useMemo(() => computeYAxis(maxTotal), [maxTotal]);

    const traceValueArrays = [hydroValues, windValues, solarTidalValues, biomassValues];
    const cumWindTops = years.map((_, i) => hydroValues[i] + windValues[i]);
    const cumSolarTidalTops = years.map((_, i) => hydroValues[i] + windValues[i] + solarTidalValues[i]);
    const cumBiomassTops = years.map(
        (_, i) => hydroValues[i] + windValues[i] + solarTidalValues[i] + biomassValues[i],
    );


    




    const applyTraceSelection = useCallback(
        (traceIndex) => {
            if (traceIndex == null || traceIndex < 0 || traceIndex >= TRACE_COUNT) return;
            toggleSlice(traceIndex);
        },
        [toggleSlice],
    );

    const handleChartClick = useCallback(
        (event) => {
            let traceIndex = null;
            if (event?.points?.length) {
                traceIndex = traceIndexFromCurveNumber(event.points[0].curveNumber);
            }
            if (traceIndex == null && event?.event && graphDivRef.current) {
                const resolved = resolveHoverFromPointer(
                    graphDivRef.current,
                    event.event.clientX,
                    event.event.clientY,
                    hoverDataRef.current,
                );
                if (resolved) traceIndex = resolved.traceIndex;
            }
            if (traceIndex == null) return;
            applyTraceSelection(traceIndex);
        },
        [applyTraceSelection],
    );

    useEffect(() => {
        clickHandlerRef.current = handleChartClick;
    }, [handleChartClick]);

    const bindPlotHandlers = useCallback((graphDiv) => {
        if (!graphDiv?.on) return;
        graphDivRef.current = graphDiv;

        if (graphDiv._renewableElectricityCapacityClick) {
            graphDiv.removeListener('plotly_click', graphDiv._renewableElectricityCapacityClick);
        }

        const clickHandler = (event) => clickHandlerRef.current?.(event);
        graphDiv._renewableElectricityCapacityClick = clickHandler;
        graphDiv.on('plotly_click', clickHandler);
    }, []);

    const onPlotReady = useCallback(
        (_figure, graphDiv) => bindPlotHandlers(graphDiv),
        [bindPlotHandlers],
    );

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${fileTitle}.png`,
        title: exportChartTitle,
        height: 700,
        legendItems: LEGEND_KEYS.map((key) => ({
            color: COLORS[key],
            label: getText(`renewable_electricity_capacity_legend_${key}`, lang),
        })),
    }),
        [COLORS, LEGEND_KEYS, exportChartTitle, fileTitle, getText, lang],
    );

    const chartConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
        name: getText('renewable_electricity_capacity_download_png', lang),
    });

    const zeroBases = years.map(() => 0);
    const hydroDense = densifyBandSeries(years, hydroValues, zeroBases, hydroLabel, hydroValues, formatHoverMw);
    const windDense = densifyBandSeries(years, cumWindTops, hydroValues, windLabel, windValues, formatHoverMw);
    const solarTidalDense = densifyBandSeries(years, cumSolarTidalTops, cumWindTops, solarTidalLabel, solarTidalValues, formatHoverMw);
    const biomassDense = densifyBandSeries(years, cumBiomassTops, cumSolarTidalTops, biomassLabel, biomassValues, formatHoverMw);

    useEffect(() => {
        hoverDataRef.current = {
            years,
            traceLabels,
            traceValueArrays,
            hydroValues,
            cumWindTops,
            cumSolarTidalTops,
            cumBiomassTops,
            yRangeMax: yRange[1],
            formatHoverMw,
        };
    });

    const traceDefs = [
        { key: 'hydro', values: hydroValues, fill: 'tozeroy', traceIndex: 0 },
        { key: 'wind', values: windValues, fill: 'tonexty', traceIndex: 1 },
        { key: 'solarTidal', values: solarTidalValues, fill: 'tonexty', traceIndex: 2 },
        { key: 'biomass', values: biomassValues, fill: 'tonexty', traceIndex: 3 },
    ];

    const hitTraceDefs = [
        { ...hydroDense, traceIndex: 0 },
        { ...windDense, traceIndex: 1 },
        { ...solarTidalDense, traceIndex: 2 },
        { ...biomassDense, traceIndex: 3 },
    ];

    const plotData = [
        ...traceDefs.map(({ key, values, fill, traceIndex }) => ({
            type: 'scatter',
            mode: 'lines',
            x: years,
            y: values,
            stackgroup: 'renewable',
            fill,
            line: { color: hexToRgba(COLORS[key], traceOpacityFor(selectedTraceIds, traceIndex)), width: 0 },
            fillcolor: hexToRgba(COLORS[key], traceOpacityFor(selectedTraceIds, traceIndex)),
            connectgaps: true,
            hoverinfo: 'skip',
            showlegend: false,
        })),
        ...hitTraceDefs.map(({ x, y, hover }) => ({
            type: 'scatter',
            x,
            y,
            fill: 'toself',
            fillcolor: 'rgba(0,0,0,0.001)',
            line: { color: 'rgba(0,0,0,0)', width: 0 },
            hoveron: 'points+fills',
            hovertemplate: hover,
            showlegend: false,
            name: '',
        })),
    ];

    const hasChartData = !loading && !error && tableRows.length > 0;

    const getChartSummary = () => {
        const body = summarizeByCategory({
            categories: years,
            series: [
                { name: hydroLabel, values: hydroValues, format: (v) => String(v) },
                { name: windLabel, values: windValues, format: (v) => String(v) },
                { name: solarTidalLabel, values: solarTidalValues, format: (v) => String(v) },
                { name: biomassLabel, values: biomassValues, format: (v) => String(v) },
            ].filter((ser) => Array.isArray(ser.values) && ser.values.length),
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Area chart of renewable electricity capacity from ${startYear} to ${endYear}`
                : `Graphique en aires de la capacité d'électricité renouvelable de ${startYear} à ${endYear}`,
            body,
            lang,
        });
    };
    const chartRegionLabel = `${chartTitle}. ${getChartSummary()}`;

    return (
        <PageShell tabIndex="-1"
            className="page-content page-74 page-chrome page-chrome--bleed"
            role="main"
            aria-labelledby="renewable-electricity-capacity-chart-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.page-74.page-content { max-width: none !important; overflow-x: visible !important; }
.page-74 {
}
.renewable-electricity-capacity-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.renewable-electricity-capacity-chart-frame {
    margin-top: 0;
    margin-bottom: 0;
}
.renewable-electricity-capacity-chart-title {
    color: var(--gc-text);
    margin-bottom: 12px;
    text-transform: none;
}
.renewable-electricity-capacity-chart { width: 100%; min-width: 0; height: ${plotHeight}px; position: relative; }
.renewable-electricity-capacity-chart > div { width: 100%; height: 100%; }
.renewable-electricity-capacity-legend {
    align-items: center;
    gap: 18px 28px;
    margin-top: 12px;
    margin-bottom: 8px;
    font-size: 14px;
    color: var(--gc-text);
}
.renewable-electricity-capacity-legend-item {
    white-space: nowrap;
}
.renewable-electricity-capacity-legend-swatch { width: 22px; height: 14px; border: 1px solid rgba(0, 0, 0, 0.12); }
.page-74 .data-table-wrapper { padding-top: 5px; margin-top: 20px; width: 100%; box-sizing: border-box; }
.page-74 .data-table-wrapper summary {
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    padding: 10px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    list-style: none;
    box-sizing: border-box;
    width: 100%;
    color: #ffffff;
}
.page-74 .data-table-wrapper summary::-webkit-details-marker { display: none; }
.page-74 .data-table-wrapper summary:hover,
.page-74 .data-table-wrapper button:hover { background-color: #404040 !important; }
.renewable-electricity-capacity-loading, .renewable-electricity-capacity-error {
    font-family: Arial, sans-serif;
    font-size: 16px;
    color: var(--gc-text);
    padding: 24px 0;
}
            `}</style>
            <div className="renewable-electricity-capacity-inner">
                {loading && (
                    <p className="renewable-electricity-capacity-loading">{lang === 'en' ? 'Loading data…' : 'Chargement des données…'}</p>
                )}
                {!loading && error && (
                    <p className="renewable-electricity-capacity-error" role="alert">{error}</p>
                )}
                {!loading && !error && !tableRows.length && (
                    <p className="renewable-electricity-capacity-error">{lang === 'en' ? 'No data available.' : 'Aucune donnée disponible.'}</p>
                )}

                {hasChartData && (
                <div className="renewable-electricity-capacity-chart-frame page-chrome-chart-frame">
                    <h2 id="renewable-electricity-capacity-chart-title" className="renewable-electricity-capacity-chart-title page-chrome-chart-title">{chartTitle}</h2>

                    {selectedTraceIds !== null && <ClearSelectionButton lang={lang} onClick={clearSelection} />}

                    <figure
                        ref={chartRef}
                        className="renewable-electricity-capacity-chart"
                        role="region"
                        aria-label={chartRegionLabel}
                        tabIndex={0}
                        style={{ margin: 0 }}
                    >
                        <RenewableElectricityCapacityPlot
                            plotData={plotData}
                            plotLayout={{
                                showlegend: false,
                                hovermode: 'closest',
                                hoverdistance: 50,
                                hoverlabel: HOVER_LABEL,
                                clickmode: 'event',
                                dragmode: false,
                                margin: { t: plotTopMargin, b: plotBottomMargin, l: 72, r: 24 },
                                paper_bgcolor: 'rgba(0,0,0,0)',
                                plot_bgcolor: 'rgba(0,0,0,0)',
                                autosize: true,
                                xaxis: {
                                    tickmode: 'array',
                                    tickvals: yearTicks,
                                    ticktext: yearTicks.map(String),
                                    range: years.length
                                        ? [years[0], years[years.length - 1]]
                                        : undefined,
                                    tickfont: tickFont,
                                    showgrid: false,
                                    showline: true,
                                    linewidth: 1,
                                    linecolor: '#333',
                                    automargin: true,
                                    fixedrange: true,
                                },
                                yaxis: {
                                    title: { text: yAxisTitle, font: axisTitleFont, standoff: 12 },
                                    tickvals: yTickvals,
                                    ticktext: yTickvals.map((v) => formatMw(v)),
                                    range: yRange,
                                    tickfont: tickFont,
                                    showgrid: false,
                                    showline: true,
                                    linewidth: 1,
                                    linecolor: '#333',
                                    zeroline: false,
                                    automargin: true,
                                    fixedrange: true,
                                },
                            }}
                            chartConfig={chartConfig}
                            plotHeight={plotHeight}
                            onPlotReady={onPlotReady}
                        />
                    </figure>

                    <HtmlLegend
                        className="renewable-electricity-capacity-legend"
                        variant="swatch"
                        itemClassName="renewable-electricity-capacity-legend-item"
                        markerClassName="renewable-electricity-capacity-legend-swatch"
                        items={LEGEND_KEYS.map((key) => ({
                            label: getText(`renewable_electricity_capacity_legend_${key}`, lang),
                            color: COLORS[key],
                        }))}
                    />

                    <ChartDataTable
                        lang={lang}
                        columns={tableColumns}
                        rows={dataTableRows}
                        csvFilename={`${fileTitle}.csv`}
                        docx={{
                            filename: `${fileTitle}.docx`,
                            title: exportChartTitle,
                            titleAlign: 'center',
                            columnWidths: [1200, 1700, 1700, 2200, 1500, 1500],
                            fontSize: 22,
                        }}
                        caption={tableCaption}
                        tableAriaLabel={tableCaption}
                        renderCell={(raw, { colIndex }) => (
                            colIndex === 0 ? String(raw ?? '') : formatMw(raw)
                        )}
                    />
                </div>
                )}
            </div>
        </PageShell>
    );
};

export default RenewableElectricityCapacity;
