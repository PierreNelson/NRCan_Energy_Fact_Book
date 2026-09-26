import React, { useState, useEffect, useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import hexToRgba from '../utils/hexToRgba';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';

const COUNTRY_KEYS = ['canada', 'france', 'germany', 'italy', 'uk', 'usa'];

const household_energy_prices_comparison_DATA = {
    canada: { gasoline: 1.3, electricity: 130, naturalGas: 30 },
    france: { gasoline: 2.3, electricity: 360, naturalGas: 170 },
    germany: { gasoline: 2.1, electricity: 480, naturalGas: 160 },
    italy: { gasoline: 2.5, electricity: 490, naturalGas: 200 },
    uk: { gasoline: 1.8, electricity: 390, naturalGas: 100 },
    usa: { gasoline: 0.9, electricity: 140, naturalGas: 40 },
};

const COLORS = {
    gasoline: '#8C8C8C',
    electricity: '#1B99BB',
    naturalGas: '#9f346d',
};

const EXPORT_CHART_WIDTH = 1100;

/** Vertical country ticks from ~200% page zoom (Ctrl+/pinch), matching GHG emissions sector and spotlight pattern. */
const household_energy_prices_comparison_VERTICAL_TICK_ZOOM = 2.0;
const LIKELY_OS_DPR_BASES = [1, 1.25, 1.3333333333333333, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5];

const createInitialViewportZoom = () => {
    if (typeof window === 'undefined') {
        return { pinScale: 1, layoutRatio: 1, cssZoomFactor: 1, screenZoomHint: 1 };
    }
    const inner = window.innerWidth;
    const outer = window.outerWidth;
    const vv = window.visualViewport;
    let pinScale = 1;
    let layoutRatio = 1;
    if (vv) {
        pinScale = vv.scale || 1;
        const w = vv.width || inner;
        layoutRatio = w > 0 ? inner / w : 1;
    }
    const sw = window.screen?.availWidth ?? window.screen?.width ?? 0;
    let screenZoomHint = 1;
    if (sw > 0 && outer >= sw - 24 && inner > 0) {
        const ratio = sw / inner;
        if (ratio >= 1.75) screenZoomHint = Math.min(ratio, 10);
    }
    return { pinScale, layoutRatio, cssZoomFactor: 1, screenZoomHint };
};

function isBrowserZoomInVerticalTickRange() {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    return LIKELY_OS_DPR_BASES.some((b) => {
        const z = dpr / b;
        return z >= household_energy_prices_comparison_VERTICAL_TICK_ZOOM && z <= 6.0;
    });
}

/** Legend axis cues are visual only — omit from spoken chart summaries. */
function stripAxisCue(label) {
    return String(label || '')
        .replace(/\s*\((?:left|right)\s+axis\)\s*$/i, '')
        .replace(/\s*\(axe de (?:gauche|droite)\)\s*$/i, '')
        .trim();
}

const HouseholdEnergyPricesComparison = () => {
    const { lang } = useOutletContext();
    const windowWidth = useWindowWidth();
    const [viewportZoom, setViewportZoom] = useState(createInitialViewportZoom);
    const zoomBaselineRef = useRef(null);
    const {
        selected: selectedPoints,
        clear: clearSelection,
        onPlotClick: handleChartClick,
    } = usePlotlySelection({ mode: 'points', traceCount: 3, windowWidth });
    const chartRef = useRef(null);

    const formatGasoline = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
        });
    };

    const formatMwh = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        });
    };

    const fileSlugBase = getText('household_energy_prices_comparison_download_title', lang).replace(/\s+/g, '_');
    const chartTitle = getText('household_energy_prices_comparison_chart_title', lang);
    const exportChartTitle = stripHtml(chartTitle);
    const pageTitleLine1 = getText('household_energy_prices_comparison_title_line1', lang);
    const pageTitleLine2 = getText('household_energy_prices_comparison_title_line2', lang);
    const pageTitleFull = `${stripHtml(pageTitleLine1)} ${stripHtml(pageTitleLine2)}`;

    const countryLabels = useMemo(
        () => COUNTRY_KEYS.map((key) => getText(`household_energy_prices_comparison_country_${key}`, lang)),
        [lang],
    );

    const legendGasoline = getText('household_energy_prices_comparison_legend_gasoline', lang);
    const legendElectricity = getText('household_energy_prices_comparison_legend_electricity', lang);
    const legendNaturalGas = getText('household_energy_prices_comparison_legend_natural_gas', lang);
    const yLeftLabel = getText('household_energy_prices_comparison_yaxis_left', lang);
    const yRightLabel = getText('household_energy_prices_comparison_yaxis_right', lang);

    const gasolineValues = useMemo(() => COUNTRY_KEYS.map((key) => household_energy_prices_comparison_DATA[key].gasoline), []);
    const electricityValues = useMemo(() => COUNTRY_KEYS.map((key) => household_energy_prices_comparison_DATA[key].electricity), []);
    const naturalGasValues = useMemo(() => COUNTRY_KEYS.map((key) => household_energy_prices_comparison_DATA[key].naturalGas), []);

    const tableColumns = useMemo(() => [
        { key: 'country', header: getText('household_energy_prices_comparison_table_country', lang), align: 'left' },
        { key: 'gasoline', header: getText('household_energy_prices_comparison_table_gasoline', lang), align: 'num' },
        { key: 'electricity', header: getText('household_energy_prices_comparison_table_electricity', lang), align: 'num' },
        { key: 'naturalGas', header: getText('household_energy_prices_comparison_table_natural_gas', lang), align: 'num' },
    ], [lang]);

    const tableRows = useMemo(
        () => COUNTRY_KEYS.map((key, i) => ({
            country: countryLabels[i],
            gasoline: household_energy_prices_comparison_DATA[key].gasoline,
            electricity: household_energy_prices_comparison_DATA[key].electricity,
            naturalGas: household_energy_prices_comparison_DATA[key].naturalGas,
        })),
        [countryLabels],
    );

    const pageZoomForLayout = Math.max(
        viewportZoom.pinScale,
        viewportZoom.layoutRatio,
        viewportZoom.cssZoomFactor,
        viewportZoom.screenZoomHint,
    );
    const pinVertical =
        viewportZoom.pinScale > 1.02 && viewportZoom.pinScale >= household_energy_prices_comparison_VERTICAL_TICK_ZOOM;
    const useVerticalXLabels =
        pageZoomForLayout >= household_energy_prices_comparison_VERTICAL_TICK_ZOOM ||
        pinVertical ||
        isBrowserZoomInVerticalTickRange();
    const xTickAngle = useVerticalXLabels ? 90 : 0;
    const xTickFontSize = useVerticalXLabels
        ? windowWidth <= 480
            ? 12
            : 13
        : windowWidth <= 480
          ? 12
          : 14;
    const yTickFontSize = windowWidth <= 480 ? 9 : 11;
    const axisTitleFontSize = 16;
    const chartHeight = useVerticalXLabels
        ? windowWidth <= 768
            ? 560
            : 580
        : windowWidth <= 768
          ? 480
          : 540;
    const plotBottomMargin = useVerticalXLabels
        ? windowWidth <= 768
            ? 120
            : 100
        : windowWidth <= 768
          ? 70
          : 60;

    const traceOpacity = (traceIndex, pointIndex) => {
        if (selectedPoints === null) return 1;
        return selectedPoints[traceIndex]?.includes(pointIndex) ? 1 : 0.3;
    };

    const markerColors = (traceIndex, baseColor) =>
        COUNTRY_KEYS.map((_, index) =>
            selectedPoints === null ? baseColor : hexToRgba(baseColor, traceOpacity(traceIndex, index)),
        );

    const gasolineTrace = {
        type: 'bar',
        name: legendGasoline,
        x: COUNTRY_KEYS,
        y: gasolineValues,
        marker: { color: markerColors(0, COLORS.gasoline) },
        yaxis: 'y',
        hovertext: COUNTRY_KEYS.map(
            (_, i) => `<b>${countryLabels[i]}</b><br>${legendGasoline}: ${formatGasoline(gasolineValues[i])}`,
        ),
        hoverinfo: 'text',
        hoverlabel: {
            bgcolor: '#ffffff',
            font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
        },
    };

    const electricityTrace = {
        type: 'bar',
        name: legendElectricity,
        x: COUNTRY_KEYS,
        y: electricityValues,
        marker: { color: markerColors(1, COLORS.electricity) },
        yaxis: 'y2',
        hovertext: COUNTRY_KEYS.map(
            (_, i) => `<b>${countryLabels[i]}</b><br>${legendElectricity}: ${formatMwh(electricityValues[i])}`,
        ),
        hoverinfo: 'text',
        hoverlabel: {
            bgcolor: '#ffffff',
            font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
        },
    };

    const naturalGasTrace = {
        type: 'bar',
        name: legendNaturalGas,
        x: COUNTRY_KEYS,
        y: naturalGasValues,
        marker: { color: markerColors(2, COLORS.naturalGas) },
        yaxis: 'y2',
        hovertext: COUNTRY_KEYS.map(
            (_, i) => `<b>${countryLabels[i]}</b><br>${legendNaturalGas}: ${formatMwh(naturalGasValues[i])}`,
        ),
        hoverinfo: 'text',
        hoverlabel: {
            bgcolor: '#ffffff',
            font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
        },
    };

    const plotLayout = useMemo(
        () => {
            const axisTitleFont = { size: axisTitleFontSize, family: 'Arial, sans-serif', color: '#333' };
            return {
            barmode: 'group',
            bargap: 0.15,
            bargroupgap: 0.08,
            hovermode: 'closest',
            clickmode: 'event',
            dragmode: false,
            showlegend: false,
            xaxis: {
                type: 'category',
                categoryorder: 'array',
                categoryarray: COUNTRY_KEYS,
                tickmode: 'array',
                tickvals: COUNTRY_KEYS,
                ticktext: countryLabels,
                showgrid: false,
                zeroline: false,
                tickangle: xTickAngle,
                tickfont: { size: xTickFontSize, family: 'Arial, sans-serif' },
                automargin: true,
            },
            yaxis: {
                title: { text: yLeftLabel, font: axisTitleFont, standoff: 8 },
                range: [0, 2.6],
                dtick: 0.2,
                showgrid: false,
                showline: true,
                linewidth: 1,
                linecolor: '#333',
                zeroline: true,
                tickfont: { size: yTickFontSize, family: 'Arial, sans-serif' },
                automargin: true,
                side: 'left',
            },
            yaxis2: {
                title: { text: yRightLabel, font: axisTitleFont, standoff: 8 },
                range: [0, 600],
                dtick: 100,
                overlaying: 'y',
                side: 'right',
                showgrid: false,
                showline: true,
                linewidth: 1,
                linecolor: '#333',
                zeroline: false,
                tickfont: { size: yTickFontSize, family: 'Arial, sans-serif' },
                automargin: true,
            },
            margin: {
                l: windowWidth <= 480 ? 52 : 64,
                r: windowWidth <= 480 ? 52 : 64,
                t: 20,
                b: plotBottomMargin,
            },
            height: chartHeight,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            autosize: true,
        };
        },
        [countryLabels, xTickAngle, xTickFontSize, yTickFontSize, axisTitleFontSize, yLeftLabel, yRightLabel, chartHeight, plotBottomMargin, windowWidth],
    );

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${fileSlugBase}.png`,
        title: exportChartTitle,
        width: EXPORT_CHART_WIDTH,
        height: chartHeight,
        legendItems: [
            { label: legendGasoline, color: COLORS.gasoline },
            { label: legendElectricity, color: COLORS.electricity },
            { label: legendNaturalGas, color: COLORS.naturalGas },
        ],
    }),
        [COLORS, EXPORT_CHART_WIDTH, chartHeight, exportChartTitle, fileSlugBase, legendElectricity, legendGasoline, legendNaturalGas],
    );

    const getChartSummary = () => {
        const body = summarizeByCategory({
            categories: countryLabels,
            series: [
                {
                    name: stripAxisCue(legendGasoline),
                    values: gasolineValues,
                    format: (v) => `${formatGasoline(v)} ${yLeftLabel}`,
                },
                {
                    name: stripAxisCue(legendElectricity),
                    values: electricityValues,
                    format: (v) => `${formatMwh(v)} ${yRightLabel}`,
                },
                {
                    name: stripAxisCue(legendNaturalGas),
                    values: naturalGasValues,
                    format: (v) => `${formatMwh(v)} ${yRightLabel}`,
                },
            ],
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? 'Grouped bar chart comparing household energy prices per unit across countries for 2024'
                : "Graphique à barres groupées comparant les prix unitaires de l'énergie domestique entre pays pour 2024",
            unitNote: lang === 'en'
                ? `Gasoline in ${yLeftLabel}; electricity and natural gas in ${yRightLabel}`
                : `Essence en ${yLeftLabel} ; électricité et gaz naturel en ${yRightLabel}`,
            body,
        });
    };

    const chartRegionLabel = `${exportChartTitle}. ${getChartSummary()}`;

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    useEffect(() => {
        const syncViewport = () => {

            const inner = window.innerWidth;
            const outer = window.outerWidth;
            const dpr = window.devicePixelRatio || 1;

            if (zoomBaselineRef.current == null) {
                zoomBaselineRef.current = { outer, inner, dpr };
            } else {
                const baseline = zoomBaselineRef.current;
                if (Math.abs(outer - baseline.outer) > 64) {
                    zoomBaselineRef.current = { outer, inner, dpr };
                }
            }
            const baseline = zoomBaselineRef.current;
            const outerStable = baseline && Math.abs(outer - baseline.outer) <= 64;

            let cssZoomFactor = 1;
            if (baseline && inner > 0 && baseline.inner > 0 && outerStable) {
                cssZoomFactor = Math.max(baseline.inner / inner, inner / baseline.inner);
            }

            const sw = window.screen?.availWidth ?? window.screen?.width ?? 0;
            let screenZoomHint = 1;
            if (sw > 0 && outer >= sw - 24 && inner > 0) {
                const ratio = sw / inner;
                if (ratio >= 1.75) screenZoomHint = Math.min(ratio, 10);
            }

            const vv = window.visualViewport;
            let pinScale = 1;
            let layoutRatio = 1;
            if (vv) {
                pinScale = vv.scale || 1;
                const w = vv.width || inner;
                layoutRatio = w > 0 ? inner / w : 1;
            }

            setViewportZoom({ pinScale, layoutRatio, cssZoomFactor, screenZoomHint });
        };

        syncViewport();
        window.addEventListener('resize', syncViewport);
        const vv = window.visualViewport;
        vv?.addEventListener('resize', syncViewport);
        vv?.addEventListener('scroll', syncViewport);
        return () => {
            window.removeEventListener('resize', syncViewport);
            vv?.removeEventListener('resize', syncViewport);
            vv?.removeEventListener('scroll', syncViewport);
        };
    }, []);

    

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-45"
            aria-labelledby="household-energy-prices-comparison-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-45 { width: 100%; }
.household-energy-prices-comparison-container { width: 100%; padding: 15px 0 0 0; display: flex; flex-direction: column; box-sizing: border-box; flex: 1; overflow: visible; }
.household-energy-prices-comparison-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    line-height: 1.2;
    margin: 0 0 20px 0;
}
.household-energy-prices-comparison-title-line1 {
    display: block;
    color: var(--gc-text);
    position: relative;
    padding-bottom: 0.5em;
}
.household-energy-prices-comparison-title-line1::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.household-energy-prices-comparison-title-line2 {
    display: block;
    color: #a0346e;
}
.household-energy-prices-comparison-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-sizing: border-box;
    overflow: visible;
}
.household-energy-prices-comparison-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 15px 0;
    text-align: center;
}
.household-energy-prices-comparison-chart { width: 100%; position: relative; }
.household-energy-prices-comparison-legend {
    display: flex;
    justify-content: flex-start;
    margin-top: 12px;
    margin-bottom: 4px;
    font-family: 'Noto Sans', sans-serif;
    padding: 0 4px;
}
.household-energy-prices-comparison-legend-inner {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 36px;
    justify-content: flex-start;
}
.household-energy-prices-comparison-legend-item {
    display: flex;
    align-items: center;
    gap: 10px;
}
.household-energy-prices-comparison-legend-swatch {
    width: 22px;
    height: 14px;
    flex-shrink: 0;
}
.household-energy-prices-comparison-legend-label {
    font-size: 16px;
    color: var(--gc-text);
}
.household-energy-prices-comparison-table-wrapper { display: block; width: 100%; margin: 20px 0 0 0; }
.household-energy-prices-comparison-chart-frame button[type="button"]:hover { background-color: #404040 !important; }
@media (max-width: 768px) {
    .household-energy-prices-comparison-title { font-size: 37px; margin-bottom: 16px; }
    .household-energy-prices-comparison-chart-title { font-size: 26px; }
    .household-energy-prices-comparison-legend-label { font-size: 14px; }
}
            `}</style>

            <div className="household-energy-prices-comparison-container">
                <header role="region" aria-label={pageTitleFull}>
                    <h1 id="household-energy-prices-comparison-title" className="household-energy-prices-comparison-title">
                        <span className="household-energy-prices-comparison-title-line1">{pageTitleLine1}</span>
                        <span className="household-energy-prices-comparison-title-line2">{pageTitleLine2}</span>
                    </h1>
                </header>

                <div className="household-energy-prices-comparison-chart-frame">
                    <h2 className="household-energy-prices-comparison-chart-title">{chartTitle}</h2>

                    <div role="region" aria-label={chartRegionLabel} tabIndex="0">
                        {selectedPoints !== null && (
                            <ClearSelectionButton lang={lang} onClick={clearSelection} />
                        )}
                        <figure ref={chartRef} className="household-energy-prices-comparison-chart" style={{ margin: 0, height: chartHeight }}>
                            <Plot
                                key={`household-energy-prices-comparison-${useVerticalXLabels ? 'v' : 'h'}-${chartHeight}-${lang}`}
                                data={[gasolineTrace, electricityTrace, naturalGasTrace]}
                                layout={plotLayout}
                                config={plotConfig}
                                style={{ width: '100%', height: '100%' }}
                                useResizeHandler={true}
                                onClick={handleChartClick}
                            />
                        </figure>
                    </div>

                    <div className="household-energy-prices-comparison-legend" aria-hidden="true">
                        <div className="household-energy-prices-comparison-legend-inner">
                            <div className="household-energy-prices-comparison-legend-item">
                                <span className="household-energy-prices-comparison-legend-swatch" style={{ backgroundColor: COLORS.gasoline }} />
                                <span className="household-energy-prices-comparison-legend-label">{legendGasoline}</span>
                            </div>
                            <div className="household-energy-prices-comparison-legend-item">
                                <span className="household-energy-prices-comparison-legend-swatch" style={{ backgroundColor: COLORS.electricity }} />
                                <span className="household-energy-prices-comparison-legend-label">{legendElectricity}</span>
                            </div>
                            <div className="household-energy-prices-comparison-legend-item">
                                <span className="household-energy-prices-comparison-legend-swatch" style={{ backgroundColor: COLORS.naturalGas }} />
                                <span className="household-energy-prices-comparison-legend-label">{legendNaturalGas}</span>
                            </div>
                        </div>
                    </div>

                    <div className="household-energy-prices-comparison-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={`${fileSlugBase}.csv`}
                            docx={{
                                filename: `${fileSlugBase}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [3200, 2400, 2400, 2400],
                                fontSize: 18,
                            }}
                            caption={getText('household_energy_prices_comparison_table_caption', lang)}
                            tableAriaLabel={getText('household_energy_prices_comparison_table_caption', lang)}
                            renderCell={(raw, { colIndex }) => {
                                if (colIndex === 0) return String(raw ?? '');
                                if (colIndex === 1) return formatGasoline(raw);
                                return formatMwh(raw);
                            }}
                        />
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default HouseholdEnergyPricesComparison;
