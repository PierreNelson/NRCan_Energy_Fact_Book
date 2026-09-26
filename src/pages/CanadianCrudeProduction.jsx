import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import PageFootnotes from '../components/PageFootnotes';
import ClearSelectionButton from '../components/ClearSelectionButton';
import useWindowWidth from '../hooks/useWindowWidth';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import YearSelect from '../components/YearSelect';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { saveAs } from 'file-saver';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getCanadianCrudeProductionData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import hexToRgba from '../utils/hexToRgba';
import CanadianCrudeProductionInfographic from '../components/CanadianCrudeProductionInfographic';
import {
    PROVINCE_ORDER,
    exportCanadianProductionInfographicPng,
} from '../components/CanadianCrudeProductionInfographic.constants';
import { resolveAccessibleInfographicRoot } from '../utils/downloadInfographicPng';
import { getOtherFootnoteKeys } from '../utils/buildCanadianProductionBarrelSvg';

import { makeScrollToIdHandler } from '../utils/scrollToId';
import { formatLocaleNumber, formatLocalePct } from '../utils/formatLocale';

const COLORS = {
    conventional: '#3C95C8',
    oilSands: '#8C8C8C',
};

/** Vertical year ticks from ~300% page zoom (not ~500%). */
const canadian_production_VERTICAL_TICK_ZOOM = 2.85;

const createInitialViewportZoom = () => {
    if (typeof window === 'undefined') {
        return { pinScale: 1, cssZoomFactor: 1, screenZoomHint: 1 };
    }
    const inner = window.innerWidth;
    const outer = window.outerWidth;
    const sw = window.screen?.availWidth ?? window.screen?.width ?? 0;
    let screenZoomHint = 1;
    if (sw > 0 && outer >= sw - 24 && inner > 0) {
        const ratio = sw / inner;
        if (ratio >= 1.75) screenZoomHint = Math.min(ratio, 10);
    }
    return { pinScale: 1, cssZoomFactor: 1, screenZoomHint };
};

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const CanadianCrudeProduction = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedTraceIds, setSelectedTraceIds] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const windowWidth = useWindowWidth();
    const [viewportZoom, setViewportZoom] = useState(createInitialViewportZoom);
    const chartRef = useRef(null);
    const zoomBaselineRef = useRef(null);
    const infographicFigureRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null });

    const pageZoomForLayout = Math.max(
        viewportZoom.cssZoomFactor,
        viewportZoom.pinScale,
        viewportZoom.screenZoomHint,
    );
    const useVerticalYearTicks = pageZoomForLayout >= canadian_production_VERTICAL_TICK_ZOOM;
    const yearTickAngle = useVerticalYearTicks ? 90 : 0;

    const basePlotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotHeight = pageZoomForLayout >= canadian_production_VERTICAL_TICK_ZOOM
        ? Math.min(basePlotHeight, Math.max(260, Math.round(windowWidth * 0.58)))
        : basePlotHeight;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = useVerticalYearTicks
        ? (windowWidth <= 480 ? 88 : windowWidth <= 768 ? 78 : 68)
        : (windowWidth <= 480 ? 62 : windowWidth <= 768 ? 56 : 50);

    const infographicHeight = windowWidth <= 768 ? 400 : 480;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    const formatNumber = (value, digits = 0) => formatLocaleNumber(value, lang, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });

    const formatPct = (value, digits = 1) => formatLocalePct(value, lang, {
        suffix: false,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });

    const formatMmbd = (value, digits = 1) => formatNumber(value, digits);

    const formatHoverMmbd = (value, digits = 1) => {
        const formatted = formatMmbd(value, digits);
        if (formatted === '—') return formatted;
        return lang === 'fr' ? formatted.replace('.', ',') : formatted;
    };

    const scrollToElement = (id) => makeScrollToIdHandler(id);

    const getProvinceLabel = useCallback(
        (key) => getText(`canadian_production_prov_${key}`, lang),
        [lang],
    );

    useEffect(() => {
        getCanadianCrudeProductionData()
            .then(setResult)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

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
            const pinScale = vv?.scale && vv.scale > 0 ? vv.scale : 1;

            setViewportZoom({ pinScale, cssZoomFactor, screenZoomHint });
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

    const effectiveSelectedYear = useMemo(() => {
        if (!result?.selectorYears?.length) return null;
        if (selectedYear != null && result.selectorYears.includes(selectedYear)) {
            return selectedYear;
        }
        return result.selectorYears[0];
    }, [result, selectedYear]);

    const chartTableRows = result?.production ?? [];

    const infographicTableRows = useMemo(
        () => (result?.provinces ?? []).map((row) => ({
            year: row.year,
            ...Object.fromEntries(
                PROVINCE_ORDER.map((key) => [key, row.provinces?.[key]?.sharePct]),
            ),
        })),
        [result],
    );

    const selectorYears = result?.selectorYears ?? [];
    const selectedYearRow = effectiveSelectedYear != null
        ? result?.production?.find((row) => row.year === effectiveSelectedYear) ?? null
        : null;
    const chartStartYear = result?.chartStartYear ?? 2006;
    const chartEndYear = result?.chartEndYear ?? effectiveSelectedYear;
    const provinceStartYear = result?.provinceStartYear ?? 2016;
    const provinceEndYear = result?.provinceEndYear ?? effectiveSelectedYear;
    const year = effectiveSelectedYear;

    const textVars = {
        year,
        startYear: chartStartYear,
        endYear: chartEndYear,
        provinceStartYear,
        provinceEndYear,
        oilSandsMmbd: selectedYearRow?.oilSandsMmbd != null ? formatMmbd(selectedYearRow.oilSandsMmbd, 1) : '–',
        conventionalMmbd: selectedYearRow?.conventionalMmbd != null ? formatMmbd(selectedYearRow.conventionalMmbd, 1) : '–',
    };

    const selectedProvinceRow = effectiveSelectedYear != null
        ? result?.provinces?.find((row) => row.year === effectiveSelectedYear) ?? null
        : null;

    const provinceOverlayValues = selectedProvinceRow?.provinces ?? null;

    const chartTitle = getText('canadian_production_chart_title', lang);
    const exportChartTitle = stripHtml(`${chartTitle} (${chartStartYear}–${chartEndYear})`);
    const infographicTitleBase = substitute(getText('canadian_production_infographic_title', lang), textVars);

    const chartDownloadSlug = substitute(getText('canadian_production_download_title', lang), textVars)
        .replace(/\s+/g, '_')
        .replace(/–/g, '-');
    const infographicDownloadSlug = substitute(getText('canadian_production_infographic_download_title', lang), textVars)
        .replace(/\s+/g, '_')
        .replace(/–/g, '-');
    const infographicPngSlug = substitute(getText('canadian_production_infographic_png_slug', lang), { year: year ?? '' })
        .replace(/\s+/g, '_');

    const tableCaption = substitute(getText('canadian_production_table_caption', lang), textVars);
    const infographicTableCaption = substitute(
        getText('canadian_production_infographic_table_caption', lang),
        textVars,
    );
    const exportTableTitle = stripHtml(tableCaption);
    const exportInfographicTableTitle = stripHtml(infographicTableCaption);

    const chartTableColumns = useMemo(() => [
        { key: 'year', header: getText('canadian_production_table_col_year', lang), align: 'left' },
        { key: 'oilSandsThousandM3', header: getText('canadian_production_table_col_oil_sands_m3', lang), align: 'num' },
        { key: 'conventionalThousandM3', header: getText('canadian_production_table_col_conventional_m3', lang), align: 'num' },
        { key: 'totalThousandM3', header: getText('canadian_production_table_col_total_m3', lang), align: 'num' },
        { key: 'oilSandsMmbd', header: getText('canadian_production_table_col_oil_sands_mmbd', lang), align: 'num' },
        { key: 'conventionalMmbd', header: getText('canadian_production_table_col_conventional_mmbd', lang), align: 'num' },
        { key: 'totalMmbd', header: getText('canadian_production_table_col_total_mmbd', lang), align: 'num' },
        { key: 'sharePct', header: getText('canadian_production_table_col_share', lang), align: 'num' },
    ], [lang]);

    const infographicColumns = useMemo(() => [
        { key: 'year', header: getText('canadian_production_table_col_year', lang), align: 'left' },
        ...PROVINCE_ORDER.map((key) => ({
            key,
            header: getText(`canadian_production_table_col_${key}`, lang),
            align: 'num',
        })),
    ], [lang]);

    const years = result?.production?.map((row) => row.year) ?? [];
    const yearTicks = years.filter((yearValue) => yearValue % 2 === 0);
    const conventionalValues = result?.production?.map((row) => row.conventionalMmbd) ?? [];
    const oilSandsValues = result?.production?.map((row) => row.oilSandsMmbd) ?? [];
    const totalValues = result?.production?.map((row) => row.totalMmbd) ?? [];

    const conventionalLabel = getText('canadian_production_legend_conventional', lang);
    const oilSandsLabel = getText('canadian_production_legend_oil_sands', lang);
    const totalLabel = getText('primary_energy_production_total', lang);
    const yAxisTitle = getText('canadian_production_y_axis', lang);

    const conventionalHoverTexts = years.map(
        (yearValue, i) =>
            `<b>${conventionalLabel}</b><br>${yearValue}: ${formatHoverMmbd(conventionalValues[i])}<br><b>${totalLabel}</b>: ${formatHoverMmbd(totalValues[i])}`,
    );
    const oilSandsHoverTexts = years.map(
        (yearValue, i) =>
            `<b>${oilSandsLabel}</b><br>${yearValue}: ${formatHoverMmbd(oilSandsValues[i])}<br><b>${totalLabel}</b>: ${formatHoverMmbd(totalValues[i])}`,
    );

    const conventionalFocused = selectedTraceIds === null || selectedTraceIds.includes(0);
    const oilSandsFocused = selectedTraceIds === null || selectedTraceIds.includes(1);

    const chartYearMin = years.length ? years[0] : 2006;
    const chartYearMax = years.length ? years[years.length - 1] : chartStartYear;

    const handleChartClick = useCallback(
        (data) => {
            if (!data?.points?.length) return;
            const traceIndex = data.points[0].curveNumber;
            if (traceIndex === undefined || traceIndex < 0 || traceIndex > 1) return;

            if (windowWidth <= 768) {
                const currentTime = Date.now();
                const lastClick = lastClickRef.current;
                const isSameTrace = traceIndex === lastClick.traceIndex && lastClick.traceIndex != null;
                const isDoubleTap = isSameTrace && currentTime - lastClick.time < 300;
                lastClickRef.current = { time: currentTime, traceIndex };
                if (!isDoubleTap) return;
            }

            setSelectedTraceIds((prev) => {
                if (prev === null) return [traceIndex];
                if (prev.includes(traceIndex)) {
                    const next = prev.filter((t) => t !== traceIndex);
                    return next.length === 0 ? null : next;
                }
                return [...prev, traceIndex];
            });
        },
        [windowWidth],
    );

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${chartDownloadSlug}.png`,
        title: exportChartTitle,
        height: 700,
        legendItems: [
            { label: conventionalLabel, color: COLORS.conventional },
            { label: oilSandsLabel, color: COLORS.oilSands },
        ],
    }),
        [COLORS, chartDownloadSlug, conventionalLabel, exportChartTitle, oilSandsLabel],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        name: getText('canadian_production_download_chart', lang),
        click: (gd) => downloadChartWithTitle(gd),
    });

    const downloadInfographicPng = async () => {
        const canvas = await exportCanadianProductionInfographicPng(
            resolveAccessibleInfographicRoot(infographicFigureRef.current),
            { scale: 2 },
        );
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${infographicPngSlug}.png`);
        });
    };

    const otherFootnoteKeys = getOtherFootnoteKeys(provinceOverlayValues);
    const otherFootnoteText = otherFootnoteKeys.length
        ? (lang === 'en'
            ? `Other: ${otherFootnoteKeys.map((key) => getProvinceLabel(key)).join(', ')}.`
            : `Autres : ${otherFootnoteKeys.map((key) => getProvinceLabel(key)).join(', ')}.`)
        : null;

    if (loading || error) return <PageStatus lang={lang} loading={loading} error={error} />;
    if (!result?.production?.length || !selectedYearRow || !selectedProvinceRow) {
        return <p>{getText('canadian_production_no_data', lang)}</p>;
    }

    const getChartSummary = () => {
        const cats = years;
        const body = summarizeByCategory({
            categories: cats,
            series: [
                { name: conventionalLabel, values: conventionalValues, format: (v) => formatMmbd(v, 1) },
                { name: oilSandsLabel, values: oilSandsValues, format: (v) => formatMmbd(v, 1) },
                { name: totalLabel, values: totalValues, format: (v) => formatMmbd(v, 1) },
            ].filter((ser) => Array.isArray(ser.values)),
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en' ? 'Chart of Canadian crude oil production' : 'Graphique de la production canadienne de pétrole brut',
            body,
            lang,
        });
    };
    const chartRegionLabel = `${stripHtml(chartTitle)}. ${getChartSummary()}`;

    return (
        <PageShell id="main-content"
            tabIndex="-1"
            className="page-content page-111 canadian-crude-production-canadian-production page-chrome page-chrome--bleed"
            role="main"
            aria-labelledby="canadian-crude-production-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.page-111.canadian-crude-production-canadian-production {
}
.canadian-crude-production-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.canadian-crude-production-title {
    margin-bottom: 20px;
    line-height: 1.25;
    text-transform: none;
}
.canadian-crude-production-intro {
    font-family: var(--font-body);
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
    margin: 0 0 24px 0;
    max-width: none;
}
.canadian-crude-production-intro p { margin: 0 0 0.65rem 0; }
.canadian-crude-production-chart-title {
    color: var(--gc-text);
    margin-bottom: 12px;
    text-transform: none;
}
.canadian-crude-production-chart-figure {
    margin: 0;
}
.canadian-crude-production-chart { width: 100%; min-width: 0; height: ${plotHeight}px; position: relative; }
.canadian-crude-production-chart > div { width: 100%; height: 100%; }
.canadian-crude-production-legend {
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
.canadian-crude-production-legend-item { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.canadian-crude-production-legend-box { width: 18px; height: 18px; display: inline-block; border-radius: 2px; }
.canadian-crude-production-infographic-heading {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 28px 0 16px 0;
    text-transform: none;
}
.canadian-crude-production-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.canadian-crude-production-infographic-table-wrapper { margin-bottom: 0; }
.canadian-crude-production-download-buttons { display: flex; gap: 10px; margin: 12px 0 20px; flex-wrap: wrap; }
.canadian-crude-production-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: bold;
    color: #ffffff;
}
.canadian-crude-production-download-buttons button:hover,
.canadian-crude-production-chart-frame button[type="button"]:hover { background-color: #404040 !important; }
.canadian-crude-production-footnotes {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--gc-text);
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
    line-height: 1.65;
}
.canadian-crude-production-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0 0 1rem 0;
}
.canadian-crude-production-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
@media (max-width: 768px) {
    .canadian-crude-production-infographic-heading { font-size: 26px; }
    .canadian-crude-production-intro { font-size: 18px; }
}
            `}</style>

            <div className="canadian-crude-production-inner">
                <h1 id="canadian-crude-production-title" className="canadian-crude-production-title page-chrome-title">{getText('canadian_production_title', lang)}</h1>

                <YearSelect
                    lang={lang}
                    id="canadian-crude-production-year-select"
                    label={getText('year_slider_label', lang)}
                    years={selectorYears}
                    value={year}
                    onChange={setSelectedYear}
                />
                <div role="status" className="wb-inv" aria-live="polite">
                    {year != null ? (lang === 'en' ? `Showing data for ${year}` : `Données affichées pour ${year}`) : ''}
                </div>

                <div className="canadian-crude-production-intro">
                    <p>{getText('canadian_production_intro_1', lang)}</p>
                    <p>
                        {substitute(getText('canadian_production_intro_2_prefix', lang), textVars)}
                        <strong>{textVars.oilSandsMmbd}</strong>
                        {getText('canadian_production_intro_2_mid', lang)}
                        <strong>{textVars.conventionalMmbd}</strong>
                        {getText('canadian_production_intro_2_suffix', lang)}
                    </p>
                </div>

                <div className="canadian-crude-production-chart-frame page-chrome-chart-frame">
                    <h2 className="canadian-crude-production-chart-title page-chrome-chart-title">{chartTitle}</h2>

                    {selectedTraceIds != null && (
                        <ClearSelectionButton lang={lang} onClick={() => setSelectedTraceIds(null)} />
                    )}

                    <figure ref={chartRef} className="canadian-crude-production-chart-figure" role="region" aria-label={chartRegionLabel} tabIndex={0}>
                        <Plot
                            key={`canadian-crude-production-${selectedTraceIds ? selectedTraceIds.join('-') : 'all'}-${useVerticalYearTicks ? 'v' : 'h'}-${plotHeight}`}
                            data={[
                                {
                                    x: years,
                                    y: conventionalValues,
                                    type: 'scatter',
                                    mode: 'lines',
                                    name: conventionalLabel,
                                    line: { color: hexToRgba(COLORS.conventional, conventionalFocused ? 1 : 0.25), width: 0.5 },
                                    fill: 'tozeroy',
                                    fillcolor: hexToRgba(COLORS.conventional, conventionalFocused ? 0.85 : 0.25),
                                    stackgroup: 'production',
                                    hoveron: 'points',
                                    hoverinfo: 'text',
                                    hovertext: conventionalHoverTexts,
                                },
                                {
                                    x: years,
                                    y: oilSandsValues,
                                    type: 'scatter',
                                    mode: 'lines',
                                    name: oilSandsLabel,
                                    line: { color: hexToRgba(COLORS.oilSands, oilSandsFocused ? 1 : 0.25), width: 0.5 },
                                    fill: 'tonexty',
                                    fillcolor: hexToRgba(COLORS.oilSands, oilSandsFocused ? 0.85 : 0.25),
                                    stackgroup: 'production',
                                    hoveron: 'points',
                                    hoverinfo: 'text',
                                    hovertext: oilSandsHoverTexts,
                                },
                            ]}
                            layout={{
                                hoverlabel: {
                                    bgcolor: '#ffffff',
                                    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
                                },
                                hovermode: 'closest',
                                hoverdistance: 40,
                                clickmode: 'event',
                                dragmode: false,
                                xaxis: {
                                    showgrid: false,
                                    zeroline: false,
                                    showline: true,
                                    linewidth: 1,
                                    linecolor: '#333',
                                    tickfont: tickFont,
                                    tickangle: yearTickAngle,
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
                                    range: [0, 6],
                                    dtick: 1,
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
                            className="canadian-crude-production-chart"
                            useResizeHandler
                            onClick={handleChartClick}
                        />
                    </figure>

                    <div className="canadian-crude-production-legend" aria-hidden="true">
                        <div className="canadian-crude-production-legend-item">
                            <span className="canadian-crude-production-legend-box" style={{ backgroundColor: COLORS.conventional }} />
                            <span>{conventionalLabel}</span>
                        </div>
                        <div className="canadian-crude-production-legend-item">
                            <span className="canadian-crude-production-legend-box" style={{ backgroundColor: COLORS.oilSands }} />
                            <span>{oilSandsLabel}</span>
                        </div>
                    </div>

                    <div className="canadian-crude-production-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={chartTableColumns}
                            rows={chartTableRows}
                            csvFilename={`${chartDownloadSlug}.csv`}
                            docx={{
                                filename: `${chartDownloadSlug}.docx`,
                                title: exportTableTitle,
                                titleAlign: 'center',
                                columnWidths: [900, 1400, 1500, 1200, 1300, 1500, 1200, 1300],
                                fontSize: 20,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                            renderCell={(raw, { column, colIndex }) => {
                                if (colIndex === 0) return String(raw ?? '');
                                if (column?.key === 'sharePct') return formatPct(raw, 0);
                                if (String(column?.key || '').endsWith('Mmbd')) return formatMmbd(raw, 1);
                                return formatNumber(raw, 1);
                            }}
                        />
                    </div>
                </div>

                <h2 className="canadian-crude-production-infographic-heading">
                    <span id="fn-province-rf-canadian-crude-production">{infographicTitleBase}</span>
                    {otherFootnoteText ? (
                        <a className="fn-lnk" href="#fn-province-canadian-crude-production" onClick={scrollToElement('fn-province-canadian-crude-production')}>
                            <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>*
                        </a>
                    ) : null}
                </h2>

                <CanadianCrudeProductionInfographic
                    figureRef={infographicFigureRef}
                    lang={lang}
                    provinceValues={provinceOverlayValues}
                    formatPct={formatPct}
                    getProvinceLabel={getProvinceLabel}
                    ariaLabel={getText('canadian_production_bg_alt', lang)}
                    graphicHeight={infographicHeight}
                />

                <div className="canadian-crude-production-download-buttons">
                    <button type="button" onClick={downloadInfographicPng}>
                        {getText('canadian_production_download_png', lang)}
                    </button>
                </div>

                <div className="canadian-crude-production-table-wrapper canadian-crude-production-infographic-table-wrapper">
                    <ChartDataTable
                        lang={lang}
                        columns={infographicColumns}
                        rows={infographicTableRows}
                        csvFilename={`${infographicDownloadSlug}.csv`}
                        docx={{
                            filename: `${infographicDownloadSlug}.docx`,
                            title: exportInfographicTableTitle,
                            titleAlign: 'center',
                            columnWidths: [900, 1100, 1100, 1100, 1100, 1100, 1100, 1100, 1100, 1100],
                            fontSize: 20,
                        }}
                        caption={infographicTableCaption}
                        tableAriaLabel={infographicTableCaption}
                        renderCell={(raw, { colIndex }) => (
                            colIndex === 0 ? String(raw ?? '') : formatPct(raw, 1)
                        )}
                    />
                </div>

                <PageFootnotes
                    lang={lang}
                    titleId="fn-canadian-crude-production"
                    className="canadian-crude-production-footnotes"
                    items={otherFootnoteText ? [{
                        id: 'fn-province-canadian-crude-production',
                        marker: '*',
                        text: otherFootnoteText,
                        returnHref: '#fn-province-rf-canadian-crude-production',
                    }] : []}
                />
            </div>
        </PageShell>
    );
};

export default CanadianCrudeProduction;
