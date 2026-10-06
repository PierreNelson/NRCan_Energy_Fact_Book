import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import {
    REFERENCE_YEAR,
    PRODUCTION_KEYS,
    DEMAND_KEYS,
    PRODUCTION_COLORS,
    DEMAND_COLORS,
    DATA_BY_YEAR,
    DOC_COLUMN_WIDTHS,
} from './GlobalHydrogenProductionDemand.constants';
import hexToRgba from '../utils/hexToRgba';
import { formatLocaleNumber, formatLocalePct } from '../utils/formatLocale';

const STACKED_LAYOUT_BROWSER_ZOOM = 1.1;
const STACKED_LAYOUT_DETECTED_ZOOM = 1.0 + (STACKED_LAYOUT_BROWSER_ZOOM - 1.0) * 0.25;


const HOVER_LABEL = {
    bgcolor: '#ffffff',
    bordercolor: '#000000',
    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
};

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const digitCount = (value) => {
    const n = Number(value);
    if (Number.isNaN(n)) return 0;
    return Number.isInteger(n) || Math.abs(n - Math.round(n)) < 1e-9 ? 0 : 1;
};

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

const GlobalHydrogenProductionDemand = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [selectedYear] = useState(REFERENCE_YEAR);
    const windowWidth = useWindowWidth();
    const {
        selected: selectedProductionSlices,
        clear: clearProductionSelection,
        onPlotClick: handleProductionClick,
    } = usePlotlySelection({ mode: 'slices', windowWidth });
    const {
        selected: selectedDemandSlices,
        clear: clearDemandSelection,
        onPlotClick: handleDemandClick,
    } = usePlotlySelection({ mode: 'slices', windowWidth });
    const [pageCssZoom, setPageCssZoom] = useState(() => computePageZoomScale(null).pageCssZoom);
    const zoomBaselineRef = useRef(null);

    const productionChartRef = useRef(null);
    const demandChartRef = useRef(null);

    const useStackedLayout = pageCssZoom >= STACKED_LAYOUT_DETECTED_ZOOM;
    // Inside labels + HTML legend: narrow viewports or when charts stack at 110%+ zoom.
    const zoomLegendMode = windowWidth <= 768 || useStackedLayout;
    const textVars = { year: selectedYear };
    const yearData = DATA_BY_YEAR[selectedYear] ?? DATA_BY_YEAR[REFERENCE_YEAR];
    const totalMt = yearData?.totalMt ?? 0;

    const formatMt = useCallback((value, digits) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        const resolvedDigits = digits == null ? digitCount(value) : digits;
        return formatLocaleNumber(value, lang, {
            minimumFractionDigits: resolvedDigits,
            maximumFractionDigits: resolvedDigits,
        });
    }, [lang]);

    const formatPct = useCallback((value, digits) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        const resolvedDigits = digits == null ? digitCount(value) : digits;
        return formatLocalePct(value, lang, {
            minimumFractionDigits: resolvedDigits,
            maximumFractionDigits: resolvedDigits,
        });
    }, [lang]);

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

    const productionSlices = useMemo(() => {
        if (!yearData) return [];
        return PRODUCTION_KEYS.map((key) => {
            const pct = yearData.production?.[key] ?? 0;
            const mt = (totalMt * pct) / 100;
            return { key, pct, mt };
        });
    }, [yearData, totalMt]);

    const demandSlices = useMemo(() => {
        if (!yearData) return [];
        return DEMAND_KEYS.map((key) => {
            const pct = yearData.demand?.[key] ?? 0;
            const mt = (totalMt * pct) / 100;
            return { key, pct, mt };
        });
    }, [yearData, totalMt]);

    const productionChartTitle = substitute(
        getText('global_hydrogen_production_demand_production_chart_title', lang),
        textVars,
    );
    const demandChartTitle = substitute(
        getText('global_hydrogen_production_demand_demand_chart_title', lang),
        textVars,
    );
    const productionDownloadTitle = substitute(
        getText('global_hydrogen_production_demand_production_download_title', lang),
        textVars,
    );
    const demandDownloadTitle = substitute(
        getText('global_hydrogen_production_demand_demand_download_title', lang),
        textVars,
    );
    const productionFileSlug = productionDownloadTitle.replace(/\s+/g, '_').replace(/–/g, '-');
    const demandFileSlug = demandDownloadTitle.replace(/\s+/g, '_').replace(/–/g, '-');

    // Shared column helper for both production and demand ChartDataTables (data-mode).
    const tableColumns = useMemo(() => [
        { key: 'label', header: getText('global_hydrogen_production_demand_col_category', lang), align: 'left' },
        { key: 'pct', header: getText('global_hydrogen_production_demand_col_share', lang), align: 'num' },
        { key: 'mt', header: getText('global_hydrogen_production_demand_col_mt', lang), align: 'num' },
    ], [lang]);

    const productionTableRows = useMemo(
        () => productionSlices.map((slice) => ({
            key: slice.key,
            label: getText(`global_hydrogen_production_demand_production_${slice.key}`, lang),
            pct: slice.pct,
            mt: slice.mt,
        })),
        [productionSlices, lang],
    );

    const demandTableRows = useMemo(
        () => demandSlices.map((slice) => ({
            key: slice.key,
            label: getText(`global_hydrogen_production_demand_demand_${slice.key}`, lang),
            pct: slice.pct,
            mt: slice.mt,
        })),
        [demandSlices, lang],
    );

    const renderTableCell = useCallback((raw, { colIndex }) => {
        if (colIndex === 0) return String(raw ?? '');
        if (colIndex === 1) return formatPct(raw);
        return formatMt(raw);
    }, [formatPct, formatMt]);

    // Keep pie % labels at least 14px (WCAG-friendly / GC secondary text floor).
    const textSize = windowWidth <= 480 ? 14 : windowWidth <= 768 ? 14 : 16;
    const plotHeight = useStackedLayout
        ? (windowWidth <= 480 ? 400 : windowWidth <= 768 ? 480 : 560)
        : (windowWidth <= 480 ? 360 : windowWidth <= 768 ? 420 : 520);
    const pieSideMargin = zoomLegendMode
        ? (windowWidth <= 480 ? 8 : 16)
        : (windowWidth <= 1100 ? 28 : 48);
    const pieTopMargin = zoomLegendMode ? 24 : 110;
    const pieBottomMargin = zoomLegendMode ? 24 : 90;

    const pieDomain = useMemo(() => (
        zoomLegendMode
            ? { x: [0.05, 0.95], y: [0.05, 0.95] }
            : { x: [0.16, 0.84], y: [0.06, 0.72] }
    ), [zoomLegendMode]);
    const pieCenterY = (pieDomain.y[0] + pieDomain.y[1]) / 2;

    const buildPieTrace = useCallback((slices, colorsMap, labelPrefix, selectedSlices) => {
        if (!slices.length) return null;
        const labels = slices.map((slice) => getText(`${labelPrefix}${slice.key}`, lang));
        const values = slices.map((slice) => (slice.pct > 0 ? slice.pct : 0.001));
        const customdata = slices.map((slice) => formatPct(slice.pct));
        const baseColors = slices.map((slice) => colorsMap[slice.key]);
        const markerColors = selectedSlices?.length
            ? baseColors.map((color, index) => (selectedSlices.includes(index) ? color : hexToRgba(color, 0.3)))
            : baseColors;
        const pull = selectedSlices?.length
            ? values.map((_, index) => (selectedSlices.includes(index) ? 0.08 : 0.02))
            : values.map(() => 0.02);
        const hoverTexts = slices.map((slice) => {
            const label = getText(`${labelPrefix}${slice.key}`, lang);
            return `<b>${label}</b><br>${formatMt(slice.mt)} Mt<br>${formatPct(slice.pct)}`;
        });

        return {
            type: 'pie',
            values,
            labels,
            customdata,
            hole: 0.55,
            direction: 'clockwise',
            sort: false,
            texttemplate: zoomLegendMode ? '%{customdata}' : '%{label}<br>%{customdata}',
            textinfo: zoomLegendMode ? 'percent' : 'label+percent',
            textposition: zoomLegendMode ? 'inside' : 'outside',
            textfont: {
                size: textSize,
                family: 'Arial, sans-serif',
                color: zoomLegendMode ? '#ffffff' : markerColors,
            },
            outsidetextfont: { size: textSize, color: markerColors },
            insidetextfont: { color: '#ffffff', size: textSize, family: 'Arial, sans-serif' },
            marker: { colors: markerColors, line: { color: '#ffffff', width: 1 } },
            pull,
            hovertext: hoverTexts,
            hoverinfo: 'text',
            hoverlabel: HOVER_LABEL,
            automargin: false,
            domain: pieDomain,
        };
    }, [lang, formatPct, formatMt, textSize, zoomLegendMode, pieDomain]);

    const productionTrace = useMemo(
        () => buildPieTrace(
            productionSlices,
            PRODUCTION_COLORS,
            'global_hydrogen_production_demand_production_',
            selectedProductionSlices,
        ),
        [buildPieTrace, productionSlices, selectedProductionSlices],
    );

    const demandTrace = useMemo(
        () => buildPieTrace(
            demandSlices,
            DEMAND_COLORS,
            'global_hydrogen_production_demand_demand_',
            selectedDemandSlices,
        ),
        [buildPieTrace, demandSlices, selectedDemandSlices],
    );

    const centerAnnotation = useMemo(() => ({
        text: `<b>${formatMt(totalMt, 0)}</b><br>Mt`,
        showarrow: false,
        x: 0.5,
        y: pieCenterY,
        xref: 'paper',
        yref: 'paper',
        font: {
            size: windowWidth <= 480 ? 15 : 20,
            color: '#424243',
            family: 'Arial Black, Arial, sans-serif',
        },
    }), [totalMt, windowWidth, formatMt, pieCenterY]);

    const plotLayout = useMemo(() => ({
        showlegend: false,
        margin: {
            t: pieTopMargin,
            b: pieBottomMargin,
            l: pieSideMargin,
            r: pieSideMargin,
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        height: plotHeight,
        autosize: true,
        clickmode: 'event',
        dragmode: false,
        annotations: [centerAnnotation],
        uirevision: `global-hydrogen-${selectedYear}`,
    }), [pieTopMargin, pieBottomMargin, pieSideMargin, plotHeight, centerAnnotation, selectedYear]);

    const downloadProductionPng = useChartPngDownloader(
        productionChartRef,
        () => ({
        filename: `${productionFileSlug}.png`,
        title: stripHtml(productionChartTitle),
        height: 800,
    }),
        [productionChartTitle, productionFileSlug, stripHtml],
    );

    const downloadDemandPng = useChartPngDownloader(
        demandChartRef,
        () => ({
        filename: `${demandFileSlug}.png`,
        title: stripHtml(demandChartTitle),
        height: 800,
    }),
        [demandChartTitle, demandFileSlug, stripHtml],
    );

    const productionChartConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadProductionPng(gd),
        name: getText('global_hydrogen_production_demand_download_png', lang),
    });

    const demandChartConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadDemandPng(gd),
        name: getText('global_hydrogen_production_demand_download_png', lang),
    });

    useEffect(() => {
        const setupAccessibility = (chartRef) => {
            const plotContainer = chartRef.current;
            if (!plotContainer) return undefined;
            const setup = () => {
                plotContainer.querySelectorAll('.main-svg, .svg-container svg').forEach((svg) => {
                    svg.setAttribute('aria-hidden', 'true');
                });
                plotContainer.querySelectorAll('.modebar-btn').forEach((btn) => {
                    const dataTitle = btn.getAttribute('data-title');
                    if (dataTitle && (dataTitle.includes('Download') || /télécharger|charger/i.test(dataTitle))) {
                        btn.setAttribute('aria-label', dataTitle);
                        btn.setAttribute('role', 'button');
                        btn.setAttribute('tabindex', '0');
                        btn.removeAttribute('aria-hidden');
                    } else {
                        btn.setAttribute('aria-hidden', 'true');
                        btn.setAttribute('tabindex', '-1');
                    }
                });
            };
            const timer = setTimeout(setup, 500);
            const observer = new MutationObserver(setup);
            observer.observe(plotContainer, { childList: true, subtree: true });
            return () => {
                clearTimeout(timer);
                observer.disconnect();
            };
        };
        const cleanProduction = setupAccessibility(productionChartRef);
        const cleanDemand = setupAccessibility(demandChartRef);
        return () => {
            cleanProduction?.();
            cleanDemand?.();
        };
    }, [lang, selectedYear, selectedProductionSlices, selectedDemandSlices, zoomLegendMode]);

    const renderZoomLegendItem = (slice, colorsMap) => (
        <span key={slice.key} className="global-hydrogen-production-demand-custom-legend-item">
            <span
                className="global-hydrogen-production-demand-custom-legend-swatch"
                style={{ backgroundColor: colorsMap[slice.key] }}
                aria-hidden="true"
            />
            {slice.label}
            {' '}
            {formatPct(slice.pct)}
        </span>
    );

    const renderChartColumn = ({
        kind,
        chartTitle,
        chartRef,
        pieTrace,
        chartConfig,
        onPieClick,
        selectedSlices,
        onClearSelection,
        tableCaptionKey,
        tableRows,
        fileSlug,
        downloadTitle,
        colorsMap,
        chartRegionLabel,
    }) => {
        const tableCaption = substitute(getText(tableCaptionKey, lang), textVars);
        return (
        <section
            className={`global-hydrogen-production-demand-chart-column${useStackedLayout ? '' : ' global-hydrogen-production-demand-chart-column-side'}`}
            aria-labelledby={`global-hydrogen-production-demand-${kind}-chart-title`}
        >
            <div className={useStackedLayout
                ? 'global-hydrogen-production-demand-chart-panel'
                : 'global-hydrogen-production-demand-chart-frame'}
            >
                <h2
                    id={`global-hydrogen-production-demand-${kind}-chart-title`}
                    className="global-hydrogen-production-demand-chart-title page-chrome-chart-title"
                >
                    {chartTitle}
                </h2>

                {selectedSlices != null ? (
                    <ClearSelectionButton lang={lang} onClick={onClearSelection} />
                ) : (
                    <div className="global-hydrogen-production-demand-clear-selection-spacer" aria-hidden="true" />
                )}

                <figure
                    ref={chartRef}
                    className="global-hydrogen-production-demand-chart"
                    role="region"
                    aria-label={chartRegionLabel}
                    tabIndex={0}
                    style={{ margin: 0, height: `${plotHeight}px` }}
                >
                    <div aria-hidden="true">
                    {pieTrace && (
                        <Plot
                            key={`global-hydrogen-${kind}-${selectedYear}-${selectedSlices ? selectedSlices.join('-') : 'all'}-${zoomLegendMode ? 'compact' : 'wide'}-${lang}`}
                            data={[pieTrace]}
                            layout={plotLayout}
                            config={chartConfig}
                            style={{ width: '100%', height: `${plotHeight}px` }}
                            useResizeHandler
                            onClick={onPieClick}
                        />
                    )}
                    </div>
                </figure>

                {zoomLegendMode && (
                    <div
                        className="global-hydrogen-production-demand-custom-legend"
                        aria-label={lang === 'en' ? 'Chart legend' : 'Légende du graphique'}
                    >
                        {tableRows.map((slice) => renderZoomLegendItem(slice, colorsMap))}
                    </div>
                )}

                <div className="global-hydrogen-production-demand-table-wrapper">
                    <ChartDataTable
                        lang={lang}
                        columns={tableColumns}
                        rows={tableRows}
                        csvFilename={`${fileSlug}.csv`}
                        docx={{
                            filename: `${fileSlug}.docx`,
                            title: stripHtml(downloadTitle),
                            titleAlign: 'center',
                            columnWidths: DOC_COLUMN_WIDTHS,
                            fontSize: 20,
                        }}
                        caption={tableCaption}
                        tableAriaLabel={tableCaption}
                        renderCell={renderTableCell}
                    />
                </div>
            </div>
        </section>
        );
    };

    const formatShareSpoken = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        const digits = digitCount(value);
        const formatted = formatLocalePct(value, lang, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
            suffix: false,
        });
        return `${formatted} ${lang === 'en' ? 'percent' : 'pour cent'}`;
    };
    const formatMtSpoken = (value) => {
        const formatted = formatMt(value);
        if (formatted === '–' || formatted === '—') return formatted;
        return `${formatted} ${lang === 'en' ? 'megatonnes' : 'mégatonnes'}`;
    };
    const buildPieRegionLabel = (slices, labelPrefix, chartTitle, intro) => {
        const summary = joinChartSummary({
            intro,
            unitNote: lang === 'en'
                ? 'Values in megatonnes and percent of total'
                : 'Valeurs en mégatonnes et en pourcentage du total',
            body: summarizeByCategory({
                categories: slices.map((slice) => getText(`${labelPrefix}${slice.key}`, lang)),
                series: [
                    { name: lang === 'en' ? 'Amount' : 'Quantité', values: slices.map((slice) => slice.mt), format: formatMtSpoken },
                    { name: lang === 'en' ? 'Share' : 'Part', values: slices.map((slice) => slice.pct), format: formatShareSpoken },
                ],
                lang,
            }),
        });
        return `${stripHtml(chartTitle)}. ${summary}`;
    };
    const productionRegionLabel = buildPieRegionLabel(
        productionSlices,
        'global_hydrogen_production_demand_production_',
        productionChartTitle,
        lang === 'en'
            ? `Pie chart of global hydrogen production by energy source for ${selectedYear}`
            : `Graphique circulaire de la production mondiale d'hydrogène par source d'énergie pour ${selectedYear}`,
    );
    const demandRegionLabel = buildPieRegionLabel(
        demandSlices,
        'global_hydrogen_production_demand_demand_',
        demandChartTitle,
        lang === 'en'
            ? `Pie chart of global hydrogen demand by end use for ${selectedYear}`
            : `Graphique circulaire de la demande mondiale d'hydrogène par utilisation finale pour ${selectedYear}`,
    );

    return (
        <PageShell id="main-content"
            tabIndex="-1"
            className="page-content global-hydrogen-production-demand page-chrome page-chrome--bleed"
            role="main"
            aria-labelledby="global-hydrogen-production-demand-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.global-hydrogen-production-demand {
}
.global-hydrogen-production-demand-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.global-hydrogen-production-demand-bullets {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: var(--gc-text);
    margin: 0 0 28px 0;
    padding-left: 1.25em;
    line-height: 1.55;
}
.global-hydrogen-production-demand-bullets li { margin-bottom: 0.75rem; }
.global-hydrogen-production-demand-bullets li:last-child { margin-bottom: 0; }
.global-hydrogen-production-demand-content-row {
    display: flex;
    flex-direction: row;
    width: 100%;
    gap: 24px;
    align-items: stretch;
}
.global-hydrogen-production-demand-chart-column {
    width: 50%;
    min-width: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
}
.global-hydrogen-production-demand-chart-column-side {
    background-color: #f5f5f5;
    padding: 20px 16px;
    border-radius: 8px;
}
.global-hydrogen-production-demand-chart-frame {
    display: flex;
    flex-direction: column;
    flex: 1;
    box-sizing: border-box;
    overflow: visible;
}
.global-hydrogen-production-demand-chart-panel {
    display: flex;
    flex-direction: column;
    flex: 1;
    box-sizing: border-box;
    overflow: visible;
}
.global-hydrogen-production-demand-chart-title {
    color: var(--gc-text);
    margin: 0 0 12px 0;
    line-height: 1.2;
    text-transform: none;
    min-height: 2.4em;
}
.global-hydrogen-production-demand-clear-selection-spacer {
    min-height: 32px;
    margin-bottom: 8px;
}
.global-hydrogen-production-demand-chart {
    width: 100%;
    min-width: 0;
    position: relative;
    overflow: visible;
}
.global-hydrogen-production-demand-chart > div { width: 100%; height: 100%; overflow: visible; }
.global-hydrogen-production-demand-chart .js-plotly-plot,
.global-hydrogen-production-demand-chart .plot-container,
.global-hydrogen-production-demand-chart .svg-container {
    overflow: visible !important;
}
.global-hydrogen-production-demand-chart .main-svg {
    overflow: visible !important;
}
.global-hydrogen-production-demand-custom-legend {
    position: relative;
    z-index: 60;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px 16px;
    flex-wrap: wrap;
    margin-top: 12px;
    margin-bottom: 8px;
    padding: 0 8px;
    font-family: 'Noto Sans', Arial, sans-serif;
    font-size: 16px;
    line-height: 1.35;
    color: var(--gc-text);
}
.global-hydrogen-production-demand-custom-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
}
.global-hydrogen-production-demand-custom-legend-swatch {
    width: 14px;
    height: 14px;
    display: inline-block;
    flex-shrink: 0;
    border-radius: 2px;
    border: 1px solid rgba(0, 0, 0, 0.15);
}
.global-hydrogen-production-demand-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.layout-stacked.global-hydrogen-production-demand-content-row { flex-direction: column !important; }
.layout-stacked .global-hydrogen-production-demand-chart-column {
    width: 100% !important;
    min-width: 0 !important;
}
.layout-stacked .global-hydrogen-production-demand-chart-column-side {
    background-color: transparent;
    padding: 0;
}
.layout-stacked .global-hydrogen-production-demand-chart-column + .global-hydrogen-production-demand-chart-column {
    margin-top: 28px;
}
.wb-inv {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    border: 0;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
}
@media (max-width: 768px) {
    .global-hydrogen-production-demand-bullets { font-size: 18px; }
}
            `}</style>

            <div className="global-hydrogen-production-demand-inner">
                <span id="global-hydrogen-production-demand-title" className="wb-inv">
                    {getText('global_hydrogen_production_demand_title', lang)}
                </span>

                <ul className="global-hydrogen-production-demand-bullets">
                    <li>
                        {getText('global_hydrogen_production_demand_bullet1_pre', lang)}
                        <strong>{getText('global_hydrogen_production_demand_bullet1_bold1', lang)}</strong>
                        {getText('global_hydrogen_production_demand_bullet1_mid1', lang)}
                        <strong>{getText('global_hydrogen_production_demand_bullet1_bold2', lang)}</strong>
                        {getText('global_hydrogen_production_demand_bullet1_mid2', lang)}
                        <strong>{getText('global_hydrogen_production_demand_bullet1_bold3', lang)}</strong>
                        {getText('global_hydrogen_production_demand_bullet1_post', lang)}
                    </li>
                    <li>
                        {getText('global_hydrogen_production_demand_bullet2_pre', lang)}
                        <strong>{getText('global_hydrogen_production_demand_bullet2_bold1', lang)}</strong>
                        {getText('global_hydrogen_production_demand_bullet2_mid1', lang)}
                        <strong>{getText('global_hydrogen_production_demand_bullet2_bold2', lang)}</strong>
                        {getText('global_hydrogen_production_demand_bullet2_mid2', lang)}
                        <strong>{getText('global_hydrogen_production_demand_bullet2_bold3', lang)}</strong>
                        {getText('global_hydrogen_production_demand_bullet2_post', lang)}
                    </li>
                </ul>

                <div className={`global-hydrogen-production-demand-content-row ${useStackedLayout ? 'layout-stacked' : ''}`}>
                    {renderChartColumn({
                        kind: 'production',
                        chartTitle: productionChartTitle,
                        chartRef: productionChartRef,
                        pieTrace: productionTrace,
                        chartConfig: productionChartConfig,
                        onPieClick: handleProductionClick,
                        selectedSlices: selectedProductionSlices,
                        onClearSelection: clearProductionSelection,
                        tableCaptionKey: 'global_hydrogen_production_demand_production_table_caption',
                        tableRows: productionTableRows,
                        fileSlug: productionFileSlug,
                        downloadTitle: productionDownloadTitle,
                        colorsMap: PRODUCTION_COLORS,
                        chartRegionLabel: productionRegionLabel,
                    })}
                    {renderChartColumn({
                        kind: 'demand',
                        chartTitle: demandChartTitle,
                        chartRef: demandChartRef,
                        pieTrace: demandTrace,
                        chartConfig: demandChartConfig,
                        onPieClick: handleDemandClick,
                        selectedSlices: selectedDemandSlices,
                        onClearSelection: clearDemandSelection,
                        tableCaptionKey: 'global_hydrogen_production_demand_demand_table_caption',
                        tableRows: demandTableRows,
                        fileSlug: demandFileSlug,
                        downloadTitle: demandDownloadTitle,
                        colorsMap: DEMAND_COLORS,
                        chartRegionLabel: demandRegionLabel,
                    })}
                </div>
            </div>
        </PageShell>
    );
};

export default GlobalHydrogenProductionDemand;
