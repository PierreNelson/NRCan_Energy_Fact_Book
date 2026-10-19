import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import useWindowWidth from '../hooks/useWindowWidth';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { downloadInfographicImagePng } from '../utils/downloadInfographicPng';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getWorldBiofuelsProductionData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import HtmlLegend from '../components/HtmlLegend';
import AccessibleInfographic from '../components/AccessibleInfographic';
import worldBiofuelsBgEn from '../assets/world_biofuels_production_bg.svg?raw';
import worldBiofuelsBgFr from '../assets/world_biofuels_production_bg_fr.svg?raw';
import {
    TRACE_KEYS,
    LEGEND_KEYS,
    COLORS,
    DOC_COLUMN_WIDTHS,
    rowTotal,
} from './WorldBiofuelsProduction.constants';
import hexToRgba from '../utils/hexToRgba';

const TRACE_COUNT = TRACE_KEYS.length;

const HOVER_LABEL = {
    bgcolor: '#ffffff',
    bordercolor: '#000000',
    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
};

const DENSIFY_STEPS = 12;

const densifyBandSeries = (years, yTops, yBases, label, categoryValues, formatHover) => {
    if (!years.length) return { x: [], y: [], hover: [] };

    const xDense = [];
    const topDense = [];
    const baseDense = [];
    const hover = [];

    const pushPoint = (xVal, top, bottom, nearestIdx) => {
        xDense.push(xVal);
        topDense.push(top);
        baseDense.push(bottom);
        hover.push(`<b>${label}</b><br>${years[nearestIdx]}: ${formatHover(categoryValues[nearestIdx])}<extra></extra>`);
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

/** Build cumulative tops for each band (bottom → top). Index 0 top = values[0], etc. */
const buildCumTops = (valueArrays) => {
    const n = valueArrays[0]?.length ?? 0;
    return valueArrays.map((_, bandIdx) =>
        Array.from({ length: n }, (_, i) => {
            let sum = 0;
            for (let b = 0; b <= bandIdx; b += 1) sum += valueArrays[b][i];
            return sum;
        }),
    );
};

const resolveHoverFromPointer = (graphDiv, clientX, clientY, data) => {
    if (!graphDiv?._fullLayout || !data?.years?.length) return null;

    const { years, traceLabels, traceValueArrays, cumTops, yRangeMax, formatHover } = data;

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

    const bandBounds = cumTops.map((tops, bandIdx) => {
        const lo = bandIdx === 0 ? 0 : lerp(cumTops[bandIdx - 1]);
        const hi = lerp(tops);
        return [lo, hi];
    });

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
        value: formatHover(traceValueArrays[traceIndex][nearestIndex]),
    };
};

const WorldBiofuelsProductionPlot = memo(function WorldBiofuelsProductionPlot({
    plotData, plotLayout, chartConfig, plotHeight, onPlotReady,
}) {
    return (
        <Plot
            key={`world-biofuels-production-${plotHeight}`}
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

const WorldBiofuelsProduction = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [selectedTraceIds, setSelectedTraceIds] = useState(null);
    const windowWidth = useWindowWidth();
    const chartRef = useRef(null);
    const graphDivRef = useRef(null);
    const clickHandlerRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null });
    const hoverDataRef = useRef(null);
    const infographicImgRef = useRef(null);

    const [trend, setTrend] = useState(null);

    useEffect(() => {
        let cancelled = false;
        getWorldBiofuelsProductionData().then((data) => {
            if (!cancelled) setTrend(data?.trend ?? null);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const formatPj = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const hoverUnit = getText('world_biofuels_production_hover_unit', lang);
    const tableUnitSuffix = getText('world_biofuels_production_table_unit', lang);

    const formatHover = (value) => {
        const formatted = formatPj(value);
        return formatted === '—' ? formatted : `${formatted}${hoverUnit}`;
    };

    const tableRows = trend?.rows ?? [];
    const years = tableRows.map((row) => row.year);
    const startYear = trend?.startYear;
    const endYear = trend?.endYear;
    const yearTicks = years.filter((y) => y % 2 === 1);
    const yMax = years.length
        ? Math.max(500, Math.ceil(Math.max(...tableRows.map((row) => rowTotal(row))) / 500) * 500)
        : 500;
    const yTickvals = Array.from({ length: yMax / 500 + 1 }, (_, index) => index * 500);

    const dataTableRows = useMemo(
        () => tableRows.map((row) => ({ ...row, total: rowTotal(row) })),
        [tableRows],
    );

    const traceLabels = TRACE_KEYS.map((key) => getText(`world_biofuels_production_legend_${key}`, lang));
    const chartTitle = getText('world_biofuels_production_chart_title', lang);
    const exportChartTitle = stripHtml(chartTitle);
    const pageTitle = getText('world_biofuels_production_title', lang);
    const yAxisTitle = getText('world_biofuels_production_yaxis', lang);
    const downloadTitle = getText('world_biofuels_production_download_title', lang);
    const fileTitle = startYear && endYear ? `${downloadTitle}_${startYear}-${endYear}` : downloadTitle;
    const infographicFileTitle = getText('world_biofuels_production_infographic_download_title', lang);
    const tableCaption = (startYear && endYear)
        ? getText('world_biofuels_production_table_caption', lang)
            .replace('{{start}}', String(startYear))
            .replace('{{end}}', String(endYear))
        : getText('world_biofuels_production_table_caption', lang);
    const supplyDemandTitle = getText('world_biofuels_production_supply_demand_title', lang);
    const bgMarkup = lang === 'en' ? worldBiofuelsBgEn : worldBiofuelsBgFr;

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('world_biofuels_production_table_col_year', lang), align: 'left' },
        ...TRACE_KEYS.map((key) => ({
            key,
            header: `${getText(`world_biofuels_production_legend_${key}`, lang)} ${tableUnitSuffix}`,
            align: 'num',
        })),
        {
            key: 'total',
            header: `${getText('world_biofuels_production_table_col_total', lang)} ${tableUnitSuffix}`,
            align: 'num',
        },
    ], [lang, tableUnitSuffix]);

    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 72 : windowWidth <= 768 ? 62 : 50;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    const traceValueArrays = TRACE_KEYS.map((key) => tableRows.map((row) => row[key]));
    const cumTops = buildCumTops(traceValueArrays);
    const zeroBases = years.map(() => 0);


    




    const toggleTraceSelection = useCallback((traceIndex) => {
        setSelectedTraceIds((prev) => {
            if (prev === null) return [traceIndex];
            if (prev.includes(traceIndex)) {
                const next = prev.filter((t) => t !== traceIndex);
                return next.length === 0 ? null : next;
            }
            return [...prev, traceIndex];
        });
    }, []);

    const applyTraceSelection = useCallback(
        (traceIndex) => {
            if (traceIndex == null || traceIndex < 0 || traceIndex >= TRACE_COUNT) return;

            if (windowWidth <= 768) {
                const currentTime = Date.now();
                const lastClick = lastClickRef.current;
                const isDoubleTap = traceIndex === lastClick.traceIndex && currentTime - lastClick.time < 300;
                lastClickRef.current = { time: currentTime, traceIndex };
                if (!isDoubleTap) return;
            }

            toggleTraceSelection(traceIndex);
        },
        [windowWidth, toggleTraceSelection],
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

        if (graphDiv._worldBiofuelsProductionClick) {
            graphDiv.removeListener('plotly_click', graphDiv._worldBiofuelsProductionClick);
        }

        const clickHandler = (event) => clickHandlerRef.current?.(event);
        graphDiv._worldBiofuelsProductionClick = clickHandler;
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
            label: getText(`world_biofuels_production_legend_${key}`, lang),
        })),
    }),
        [COLORS, LEGEND_KEYS, exportChartTitle, fileTitle, getText, lang],
    );

    const chartConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
        name: getText('world_biofuels_production_download_png', lang),
    });

    const downloadInfographicPng = async () => {
        await downloadInfographicImagePng(
            infographicImgRef.current?.getGraphicElement?.() ?? infographicImgRef.current,
            { filename: `${infographicFileTitle}.png`, scale: 2 },
        );
    };

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

    const denseBands = TRACE_KEYS.map((key, bandIdx) => {
        const yTops = cumTops[bandIdx];
        const yBases = bandIdx === 0 ? zeroBases : cumTops[bandIdx - 1];
        return densifyBandSeries(
            years,
            yTops,
            yBases,
            traceLabels[bandIdx],
            traceValueArrays[bandIdx],
            formatHover,
        );
    });

    useEffect(() => {
        hoverDataRef.current = {
            years,
            traceLabels,
            traceValueArrays,
            cumTops,
            yRangeMax: yMax,
            formatHover,
        };
    });

    const plotData = [
        ...TRACE_KEYS.map((key, traceIndex) => ({
            type: 'scatter',
            mode: 'lines',
            x: years,
            y: traceValueArrays[traceIndex],
            stackgroup: 'world-biofuels',
            fill: traceIndex === 0 ? 'tozeroy' : 'tonexty',
            line: { color: hexToRgba(COLORS[key], traceOpacityFor(selectedTraceIds, traceIndex)), width: 0 },
            fillcolor: hexToRgba(COLORS[key], traceOpacityFor(selectedTraceIds, traceIndex)),
            connectgaps: true,
            hoverinfo: 'skip',
            showlegend: false,
        })),
        ...denseBands.map(({ x, y, hover }) => ({
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

    const getChartSummary = () => {
        const body = summarizeByCategory({
            categories: years,
            series: TRACE_KEYS.map((key, index) => ({
                name: traceLabels[index],
                values: traceValueArrays[index],
                format: formatPj,
            })),
            lang,
            newestFirst: true,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Stacked area chart of world biofuels production from ${startYear} to ${endYear}`
                : `Graphique en aires empilées de la production mondiale de biocarburants de ${startYear} à ${endYear}`,
            unitNote: lang === 'en' ? 'Values in petajoules' : 'Valeurs en pétajoules',
            body,
        });
    };
    const chartRegionLabel = `${exportChartTitle}. ${getChartSummary()}`;

    return (
        <PageShell tabIndex="-1"
            className="page-content world-biofuels-production page-chrome page-chrome--bleed"
            role="main"
            aria-label={pageTitle}
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.world-biofuels-production.page-content { max-width: none !important; overflow-x: visible !important; }
.world-biofuels-production {
}
.world-biofuels-production-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.world-biofuels-production-chart-frame {
    margin-top: 0;
    margin-bottom: 0;
}
.world-biofuels-production-chart-title {
    color: var(--gc-text);
    margin-bottom: 12px;
    text-transform: none;
}
.world-biofuels-production-supply-demand-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 32px 0 12px 0;
    text-transform: none;
}
.world-biofuels-production-chart { width: 100%; min-width: 0; height: ${plotHeight}px; position: relative; }
.world-biofuels-production-chart > div { width: 100%; height: 100%; }
.world-biofuels-production-legend {
    align-items: center;
    gap: 18px 28px;
    margin-top: 12px;
    margin-bottom: 8px;
    font-size: 14px;
    color: var(--gc-text);
}
.world-biofuels-production-legend-item {
    white-space: nowrap;
}
.world-biofuels-production-legend-swatch { width: 22px; height: 14px; border: 1px solid rgba(0, 0, 0, 0.12); }
.world-biofuels-production-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.world-biofuels-production-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.world-biofuels-production-download-buttons button:hover { background-color: #404040 !important; }
.world-biofuels-production-infographic-section { margin-top: 8px; }
.world-biofuels-production-infographic-figure { margin: 0; width: 100%; }
.world-biofuels-production-bg-image {
    display: block;
    width: 100%;
    height: auto;
    max-width: 100%;
}
@media (max-width: 768px) {
    .world-biofuels-production-supply-demand-title { font-size: 26px; }
}
            `}</style>
            <div className="world-biofuels-production-inner">
                <div className="world-biofuels-production-chart-frame page-chrome-chart-frame">
                    <h2 id="world-biofuels-production-chart-title" className="world-biofuels-production-chart-title page-chrome-chart-title">{chartTitle}</h2>

                    {selectedTraceIds !== null && (
                        <ClearSelectionButton
                            lang={lang}
                            label={getText('world_biofuels_production_clear_selection', lang)}
                            onClick={() => setSelectedTraceIds(null)}
                        />
                    )}

                    <figure
                        ref={chartRef}
                        className="world-biofuels-production-chart"
                        role="region"
                        aria-label={chartRegionLabel}
                        tabIndex={0}
                        style={{ margin: 0 }}
                    >
                        <div aria-hidden="true">
                        <WorldBiofuelsProductionPlot
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
                                    ticktext: yTickvals.map((v) => formatPj(v)),
                                    range: [0, yMax],
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
                        </div>
                    </figure>

                    <HtmlLegend
                        className="world-biofuels-production-legend"
                        variant="swatch"
                        itemClassName="world-biofuels-production-legend-item"
                        markerClassName="world-biofuels-production-legend-swatch"
                        items={LEGEND_KEYS.map((key) => ({
                            label: getText(`world_biofuels_production_legend_${key}`, lang),
                            color: COLORS[key],
                        }))}
                    />

                    <div className="world-biofuels-production-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={dataTableRows}
                            csvFilename={`${fileTitle}.csv`}
                            docx={{
                                filename: `${fileTitle}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: DOC_COLUMN_WIDTHS,
                                fontSize: 22,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatPj(raw)
                            )}
                        />
                    </div>
                </div>

                <h2 className="world-biofuels-production-supply-demand-title">{supplyDemandTitle}</h2>

                <div className="world-biofuels-production-infographic-section">
                    <AccessibleInfographic
                        ref={infographicImgRef}
                        mode="text"
                        as="figure"
                        className="world-biofuels-production-infographic-figure"
                        title={supplyDemandTitle}
                        svgMarkup={bgMarkup}
                        imgClassName="world-biofuels-production-bg-image"
                        imgStyle={{ width: '100%', height: 'auto', display: 'block' }}
                        idPrefix={`world-biofuels-${lang}`}
                    />

                    <div className="world-biofuels-production-download-buttons">
                        <button type="button" onClick={downloadInfographicPng} style={downloadBtnStyle}>
                            {getText('world_biofuels_production_download_infographic_png', lang)}
                        </button>
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default WorldBiofuelsProduction;
