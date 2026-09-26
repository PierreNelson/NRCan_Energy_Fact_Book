import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { saveAs } from 'file-saver';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import hexToRgba from '../utils/hexToRgba';
import CanadianCoalSupplyDemandInfographic from '../components/CanadianCoalSupplyDemandInfographic';
import {
    exportCanadianCoalSupplyDemandInfographicPng,
    INFOGRAPHIC_DATA,
} from '../components/CanadianCoalSupplyDemandInfographic.constants';
import { resolveAccessibleInfographicRoot } from '../utils/downloadInfographicPng';

const REFERENCE_YEAR = 2024;

const TRADE_DATA = [
    { year: 2005, exports: 28, imports: 21 },
    { year: 2006, exports: 28, imports: 21 },
    { year: 2007, exports: 31, imports: 18 },
    { year: 2008, exports: 31, imports: 21 },
    { year: 2009, exports: 27, imports: 13 },
    { year: 2010, exports: 33, imports: 9 },
    { year: 2011, exports: 34, imports: 9 },
    { year: 2012, exports: 35, imports: 10 },
    { year: 2013, exports: 39, imports: 9 },
    { year: 2014, exports: 34, imports: 8 },
    { year: 2015, exports: 30, imports: 8 },
    { year: 2016, exports: 30, imports: 6 },
    { year: 2017, exports: 31, imports: 7 },
    { year: 2018, exports: 34, imports: 8 },
    { year: 2019, exports: 37, imports: 8 },
    { year: 2020, exports: 32, imports: 6 },
    { year: 2021, exports: 32, imports: 6 },
    { year: 2022, exports: 36, imports: 5 },
    { year: 2023, exports: 39, imports: 6 },
    { year: 2024, exports: 36, imports: 5 },
    { year: 2025, exports: 37, imports: 5 },
];

const COLORS = {
    exports: '#7D962C',
    imports: '#3B95C9',
};

const STACKED_LAYOUT_BROWSER_ZOOM = 1.1;
const STACKED_LAYOUT_DETECTED_ZOOM = 1.0 + (STACKED_LAYOUT_BROWSER_ZOOM - 1.0) * 0.25;

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const computePageZoomScale = (baseline) => {
    if (typeof window === 'undefined') return { pageCssZoom: 1, baseline: null };

    const inner = window.innerWidth;
    const outer = window.outerWidth;
    const dpr = window.devicePixelRatio || 1;

    let nextBaseline = baseline;
    if (!nextBaseline) {
        nextBaseline = { outer, inner, dpr };
    } else if (Math.abs(outer - nextBaseline.outer) > 64) {
        nextBaseline = { outer, inner, dpr };
    }

    const outerStable = Math.abs(outer - nextBaseline.outer) <= 64;

    let cssZoomFactor = 1;
    if (nextBaseline.inner > 0 && inner > 0 && outerStable) {
        cssZoomFactor = Math.max(nextBaseline.inner / inner, inner / nextBaseline.inner);
    }

    const vv = window.visualViewport;
    const pinScale = vv?.scale || 1;

    let layoutZoom = 1;
    if (vv?.width > 0 && inner > 0) {
        const inferred = inner / vv.width;
        if (inferred > 1.02 && inferred < 8) layoutZoom = inferred;
    }

    const pageCssZoom = Math.max(pinScale, layoutZoom, cssZoomFactor);

    return { pageCssZoom, baseline: nextBaseline };
};

const CanadianCoalSupplyDemand = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const {
        selected: selectedTraceIds,
        clear: clearSelection,
        toggleSlice,
    } = usePlotlySelection({ mode: 'slices', windowWidth });
    const [pageCssZoom, setPageCssZoom] = useState(() => computePageZoomScale(null).pageCssZoom);
    const zoomBaselineRef = useRef(null);

    const chartRef = useRef(null);
    const infographicFigureRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const useStackedLayout = pageCssZoom >= STACKED_LAYOUT_DETECTED_ZOOM;

    const formatMt = useCallback((value, digits = 0) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return `${Number(value).toLocaleString(locale, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        })} Mt`;
    }, [locale]);

    const formatMtPlain = useCallback((value, digits = 0) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        });
    }, [locale]);

    useEffect(() => {
        const syncLayout = () => {
            const { pageCssZoom: nextPageCssZoom, baseline } = computePageZoomScale(zoomBaselineRef.current);
            zoomBaselineRef.current = baseline;
            setPageCssZoom(nextPageCssZoom);
        };
        syncLayout();
        window.addEventListener('resize', syncLayout);
        window.visualViewport?.addEventListener('resize', syncLayout);
        window.visualViewport?.addEventListener('scroll', syncLayout);
        return () => {
            window.removeEventListener('resize', syncLayout);
            window.visualViewport?.removeEventListener('resize', syncLayout);
            window.visualViewport?.removeEventListener('scroll', syncLayout);
        };
    }, []);

    const startYear = TRADE_DATA[0]?.year ?? 2005;
    const endYear = TRADE_DATA[TRADE_DATA.length - 1]?.year ?? 2025;
    const textVars = { year: REFERENCE_YEAR, startYear, endYear, metallurgicalPct: 82, tradeYear: endYear };

    const years = TRADE_DATA.map((row) => row.year);
    const yearTicks = years.filter((yearValue) => yearValue % 2 === 0);
    const exportValues = TRADE_DATA.map((row) => row.exports);
    const importValues = TRADE_DATA.map((row) => row.imports);
    const latestExports = exportValues[exportValues.length - 1];
    const latestImports = importValues[importValues.length - 1];

    const exportsLabel = getText('canadian_coal_supply_demand_legend_exports', lang);
    const importsLabel = getText('canadian_coal_supply_demand_legend_imports', lang);
    const chartTitle = getText('canadian_coal_supply_demand_chart_title', lang);
    const exportChartTitle = stripHtml(`${chartTitle} (${startYear}–${endYear})`);
    const yAxisTitle = getText('canadian_coal_supply_demand_y_axis', lang);
    const tableCaption = substitute(getText('canadian_coal_supply_demand_table_caption', lang), textVars);

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('canadian_coal_supply_demand_table_col_year', lang), align: 'left' },
        { key: 'exports', header: getText('canadian_coal_supply_demand_table_col_exports', lang), align: 'num' },
        { key: 'imports', header: getText('canadian_coal_supply_demand_table_col_imports', lang), align: 'num' },
    ], [lang]);

    const exportsHoverTexts = years.map(
        (yearValue, i) => `<b>${exportsLabel}</b><br>${yearValue}: ${formatMtPlain(exportValues[i])} Mt<extra></extra>`,
    );
    const importsHoverTexts = years.map(
        (yearValue, i) => `<b>${importsLabel}</b><br>${yearValue}: ${formatMtPlain(importValues[i])} Mt<extra></extra>`,
    );

    const exportsFocused = selectedTraceIds === null || selectedTraceIds.includes(0);
    const importsFocused = selectedTraceIds === null || selectedTraceIds.includes(1);

    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };
    const plotHeight = windowWidth <= 480 ? 300 : windowWidth <= 768 ? 340 : 380;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 62 : windowWidth <= 768 ? 56 : 50;

    const fileSlugBase = substitute(getText('canadian_coal_supply_demand_download_title', lang), textVars)
        .replace(/\s+/g, '_')
        .replace(/–/g, '-');
    const infographicPngSlug = substitute(getText('canadian_coal_supply_demand_infographic_png_slug', lang), textVars)
        .replace(/\s+/g, '_');

    const electricityLabel = substitute(getText('canadian_coal_supply_demand_electricity_text', lang), {
        value: formatMtPlain(INFOGRAPHIC_DATA.electricityMt, 1),
    });
    const metallurgicalLabel = getText('canadian_coal_supply_demand_metallurgical_text', lang);

    const legendExportsText = substitute(getText('canadian_coal_supply_demand_legend_exports_value', lang), {
        value: formatMtPlain(latestExports, 0),
    });
    const legendImportsText = substitute(getText('canadian_coal_supply_demand_legend_imports_value', lang), {
        value: formatMtPlain(latestImports, 0),
    });

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
            { label: legendExportsText, color: COLORS.exports },
            { label: legendImportsText, color: COLORS.imports },
        ],
    }),
        [COLORS, exportChartTitle, fileSlugBase, legendExportsText, legendImportsText],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        name: getText('canadian_coal_supply_demand_download_chart', lang),
        click: (gd) => downloadChartWithTitle(gd),
    });

    const downloadInfographicPng = async () => {
        const canvas = await exportCanadianCoalSupplyDemandInfographicPng(
            resolveAccessibleInfographicRoot(infographicFigureRef.current),
            { scale: 3 },
        );
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${infographicPngSlug}.png`);
        });
    };

    const getChartSummary = () => {
        const body = summarizeByCategory({
            categories: years,
            series: [
                { name: exportsLabel, values: exportValues, format: (v) => `${formatMtPlain(v, 0)} Mt` },
                { name: importsLabel, values: importValues, format: (v) => `${formatMtPlain(v, 0)} Mt` },
            ],
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Line chart showing Canadian coal exports and imports from ${startYear} to ${endYear}`
                : `Graphique linéaire montrant les exportations et importations canadiennes de charbon de ${startYear} à ${endYear}`,
            body,
            lang,
        });
    };
    const chartRegionLabel = `${stripHtml(chartTitle)}. ${getChartSummary()}`;

    return (
        <PageShell id="main-content"
            tabIndex="-1"
            className="page-content canadian-coal-supply-demand page-chrome page-chrome--bleed"
            role="main"
            aria-labelledby="canadian-coal-supply-demand-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.canadian-coal-supply-demand {
}
.canadian-coal-supply-demand-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.canadian-coal-supply-demand-title {
    text-transform: none;
}
.canadian-coal-supply-demand-content-row {
    display: flex;
    flex-direction: row;
    width: 100%;
    gap: 28px;
    align-items: flex-start;
}
.canadian-coal-supply-demand-domestic-column {
    width: 38%;
    min-width: 240px;
    box-sizing: border-box;
}
.canadian-coal-supply-demand-trade-column {
    width: 62%;
    min-width: 0;
    box-sizing: border-box;
}
.canadian-coal-supply-demand-section-title {
    font-family: 'Lato', sans-serif;
    font-size: 28px;
    font-weight: bold;
    color: #423330;
    margin: 0 0 16px 0;
    text-transform: none;
}
.canadian-coal-supply-demand-chart-title {
    color: var(--gc-text);
    margin-bottom: 12px;
    text-transform: none;
}
.canadian-coal-supply-demand-chart-figure { margin: 0; }
.canadian-coal-supply-demand-chart { width: 100%; min-width: 0; height: ${plotHeight}px; position: relative; }
.canadian-coal-supply-demand-chart > div { width: 100%; height: 100%; }
.canadian-coal-supply-demand-legend {
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
.canadian-coal-supply-demand-legend-item { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.canadian-coal-supply-demand-legend-line {
    width: 28px;
    height: 0;
    border-top: 4px solid;
    display: inline-block;
}
.canadian-coal-supply-demand-legend-square {
    width: 18px;
    height: 14px;
    display: inline-block;
    flex-shrink: 0;
}
.canadian-coal-supply-demand-trade-note {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
    margin: 24px 0 0 0;
}
.canadian-coal-supply-demand-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.canadian-coal-supply-demand-infographic-actions { margin: 12px 0 0 0; }
.canadian-coal-supply-demand-infographic-actions button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.canadian-coal-supply-demand-infographic-actions button:hover,
.canadian-coal-supply-demand-chart-frame button[type="button"]:hover { background-color: #404040 !important; }
.layout-stacked.canadian-coal-supply-demand-content-row { flex-direction: column !important; }
.layout-stacked .canadian-coal-supply-demand-domestic-column,
.layout-stacked .canadian-coal-supply-demand-trade-column { width: 100% !important; min-width: 0 !important; }
.layout-stacked .canadian-coal-supply-demand-domestic-column { margin-bottom: 28px; }
@media (max-width: 768px) {
    .canadian-coal-supply-demand-section-title { font-size: 24px; }
    .canadian-coal-supply-demand-trade-note { font-size: 18px; }
}
            `}</style>

            <div className="canadian-coal-supply-demand-inner">
                <h1 id="canadian-coal-supply-demand-title" className="canadian-coal-supply-demand-title page-chrome-title">
                    {substitute(getText('canadian_coal_supply_demand_section_domestic', lang), textVars)}
                </h1>

                <div className={`canadian-coal-supply-demand-content-row ${useStackedLayout ? 'layout-stacked' : ''}`}>
                    <section className="canadian-coal-supply-demand-domestic-column" aria-labelledby="canadian-coal-supply-demand-title">
                        <CanadianCoalSupplyDemandInfographic
                            lang={lang}
                            useStackedLayout={useStackedLayout}
                            figureRef={infographicFigureRef}
                            formatMt={(value) => formatMt(value, 0)}
                            totalMt={INFOGRAPHIC_DATA.totalMt}
                            electricityLabel={electricityLabel}
                            metallurgicalLabel={metallurgicalLabel}
                            ariaLabel={getText('canadian_coal_supply_demand_bg_alt', lang)}
                        />

                        <div className="canadian-coal-supply-demand-infographic-actions">
                            <button type="button" onClick={downloadInfographicPng}>
                                {getText('canadian_coal_supply_demand_download_png', lang)}
                            </button>
                        </div>
                    </section>

                    <section className="canadian-coal-supply-demand-trade-column" aria-labelledby="canadian-coal-supply-demand-chart-title">
                        <div className="canadian-coal-supply-demand-chart-frame page-chrome-chart-frame">
                            <h3 id="canadian-coal-supply-demand-chart-title" className="canadian-coal-supply-demand-chart-title page-chrome-chart-title">{chartTitle}</h3>

                            {selectedTraceIds != null && (
                                <ClearSelectionButton lang={lang} onClick={clearSelection} />
                            )}

                            <figure ref={chartRef} className="canadian-coal-supply-demand-chart-figure" role="region" aria-label={chartRegionLabel} tabIndex={0}>
                                <Plot
                                    key={`canadian-coal-supply-demand-${selectedTraceIds ? selectedTraceIds.join('-') : 'all'}-${plotHeight}`}
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
                                            range: [0, 45],
                                            dtick: 5,
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
                                    className="canadian-coal-supply-demand-chart"
                                    useResizeHandler
                                    onClick={handleChartClick}
                                />
                            </figure>

                            <div className="canadian-coal-supply-demand-legend" aria-hidden="true">
                                <div className="canadian-coal-supply-demand-legend-item">
                                    <span className="canadian-coal-supply-demand-legend-square" style={{ backgroundColor: COLORS.exports }} />
                                    <span>{legendExportsText}</span>
                                </div>
                                <div className="canadian-coal-supply-demand-legend-item">
                                    <span className="canadian-coal-supply-demand-legend-square" style={{ backgroundColor: COLORS.imports }} />
                                    <span>{legendImportsText}</span>
                                </div>
                            </div>

                            <div className="canadian-coal-supply-demand-table-wrapper">
                                <ChartDataTable
                                    lang={lang}
                                    columns={tableColumns}
                                    rows={TRADE_DATA}
                                    csvFilename={`${fileSlugBase}.csv`}
                                    docx={{
                                        filename: `${fileSlugBase}.docx`,
                                        title: exportChartTitle,
                                        titleAlign: 'center',
                                        columnWidths: [900, 1800, 1800],
                                        fontSize: 20,
                                    }}
                                    caption={tableCaption}
                                    tableAriaLabel={tableCaption}
                                    renderCell={(raw, { colIndex }) => (
                                        colIndex === 0 ? String(raw ?? '') : formatMtPlain(raw, 0)
                                    )}
                                />
                            </div>
                        </div>

                        <p className="canadian-coal-supply-demand-trade-note">
                            {substitute(getText('canadian_coal_supply_demand_trade_note', lang), textVars)}
                        </p>
                    </section>
                </div>
            </div>
        </PageShell>
    );
};

export default CanadianCoalSupplyDemand;
