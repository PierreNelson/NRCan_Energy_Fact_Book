import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import FootnoteMarker from '../components/FootnoteMarker';
import ClearSelectionButton from '../components/ClearSelectionButton';
import PageFootnotes from '../components/PageFootnotes';
import usePlotlySelection from '../hooks/usePlotlySelection';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import PageStatus from '../components/PageStatus';
import largestSolarProjectsBg from '../assets/largest_solar_projects_bg.png';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getLargestSolarProjectsData } from '../utils/dataLoader';
import { stripHtml } from '../utils/stripHtml';
import { getText } from '../utils/translations';
import { joinChartSummary, summarizeByCategory } from '../utils/chartSpokenSummary';

import { makeScrollToIdHandler } from '../utils/scrollToId';
const PROJECT_PROV_COLORS = {
    ab: '#709735',
    on: '#4b4c4d',
};
const LEGEND_KEYS = ['ab', 'on'];

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

const tokenizeLabelForWrap = (text) => {
    if (!text) return [];
    const tokens = [];
    const re = /(\([^)]*\))|\S+/g;
    let match;
    while ((match = re.exec(text)) !== null) {
        tokens.push(match[0]);
    }
    return tokens;
};

const wrapTickLabel = (text, maxLength) => {
    if (!text || text.length <= maxLength) return text;
    const tokens = tokenizeLabelForWrap(text);
    const lines = [];
    let currentLine = '';
    tokens.forEach((token) => {
        const candidate = currentLine ? `${currentLine} ${token}` : token;
        if (candidate.length > maxLength && currentLine) {
            lines.push(currentLine);
            currentLine = token;
        } else {
            currentLine = candidate;
        }
    });
    if (currentLine) lines.push(currentLine);
    return lines.join('<br>');
};

const largest_solar_projects_PROJ_WRAP_ZOOM = 2.5;
const largest_solar_projects_PROJ_WRAP_DEEP_ZOOM = 3.25;

const createInitialViewportZoom = () => {
    if (typeof window === 'undefined') {
        return { pinScale: 1, layoutRatio: 1, cssZoomFactor: 1, dprZoomFactor: 1, screenZoomHint: 1, outerInnerZoom: 1 };
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
    const outerInnerZoom = inner > 0 ? outer / inner : 1;
    return { pinScale, layoutRatio, cssZoomFactor: 1, dprZoomFactor: 1, screenZoomHint, outerInnerZoom };
};

const LargestSolarProjects = () => {
    const { lang } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const {
        selected: selectedPoints,
        clear: clearSelection,
        onPlotClick: handleChartClick,
    } = usePlotlySelection({ mode: 'slices', windowWidth });
    const [viewportZoom, setViewportZoom] = useState(createInitialViewportZoom);

    const chartRef = useRef(null);
    const zoomBaselineRef = useRef(null);
    const clickHandlerRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const tickFont = useMemo(() => ({ size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' }), [windowWidth]);

    const getLegendLabel = useCallback((key) => getText(`largest_solar_projects_legend_${key}`, lang), [lang]);

    const formatMw = useCallback((value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    }, [locale]);

    const scrollToFootnote = makeScrollToIdHandler('fn-asterisk-largest-solar-projects');

    const scrollToRef = makeScrollToIdHandler('fn-asterisk-rf-largest-solar-projects');

    useEffect(() => {
        getLargestSolarProjectsData()
            .then(setResult)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const syncZoom = () => {
            const inner = window.innerWidth;
            const outer = window.outerWidth;
            const dpr = window.devicePixelRatio || 1;
            setWindowWidth(inner);
            if (zoomBaselineRef.current == null) {
                zoomBaselineRef.current = { outer, inner, dpr };
            } else {
                const b0 = zoomBaselineRef.current;
                if (Math.abs(outer - b0.outer) > 64) {
                    zoomBaselineRef.current = { outer, inner, dpr };
                }
            }
            const b = zoomBaselineRef.current;
            const outerStable = b && Math.abs(outer - b.outer) <= 64;
            let cssZoomFactor = 1;
            if (b && inner > 0 && b.inner > 0 && outerStable) {
                cssZoomFactor = Math.max(b.inner / inner, inner / b.inner);
            }
            let dprZoomFactor = 1;
            if (b && b.dpr > 0 && outerStable) {
                dprZoomFactor = Math.max(b.dpr / dpr, dpr / b.dpr);
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
            setViewportZoom({
                pinScale,
                layoutRatio,
                cssZoomFactor,
                dprZoomFactor,
                screenZoomHint,
                outerInnerZoom: inner > 0 ? outer / inner : 1,
            });
        };
        syncZoom();
        const vv = window.visualViewport;
        vv?.addEventListener('resize', syncZoom);
        vv?.addEventListener('scroll', syncZoom);
        window.addEventListener('resize', syncZoom);
        return () => {
            vv?.removeEventListener('resize', syncZoom);
            vv?.removeEventListener('scroll', syncZoom);
            window.removeEventListener('resize', syncZoom);
        };
    }, []);

    

    const projects = useMemo(() => result?.projects ?? [], [result]);
    const referenceYear = result?.referenceYear;

    const zoomEffective = Math.max(
        viewportZoom.pinScale,
        viewportZoom.layoutRatio,
        viewportZoom.cssZoomFactor,
        viewportZoom.dprZoomFactor,
        viewportZoom.screenZoomHint,
    );
    const useWrapLabels = zoomEffective >= largest_solar_projects_PROJ_WRAP_ZOOM || windowWidth <= 480;
    const labelMaxLength = zoomEffective >= largest_solar_projects_PROJ_WRAP_DEEP_ZOOM ? 14 : 20;

    const projLabels = useMemo(() => projects.map((row) => row.facility), [projects]);
    const projValues = useMemo(() => projects.map((row) => row.capacity), [projects]);
    const projTickText = useMemo(() => {
        if (!useWrapLabels) return projLabels;
        return projLabels.map((label) => wrapTickLabel(label, labelMaxLength));
    }, [projLabels, useWrapLabels, labelMaxLength]);

    const projRightMargin = 70;
    const projLeftMargin = useMemo(() => {
        const labels = useWrapLabels ? projTickText : projLabels;
        const fontSize = tickFont.size;
        const charPx = fontSize * 0.58;
        const minMargin = windowWidth <= 480 ? 72 : 88;
        const maxLineWidth = Math.max(
            0,
            ...labels.flatMap((label) =>
                String(label).split('<br>').map((line) => line.replace(/<[^>]*>/g, '').length * charPx),
            ),
        );
        return Math.max(minMargin, Math.ceil(maxLineWidth + 8));
    }, [useWrapLabels, projTickText, projLabels, tickFont.size, windowWidth]);

    const projColumnHeaderStyle = {
        gridTemplateColumns: `${projLeftMargin}px 1fr`,
        marginRight: projRightMargin,
    };

    const projRowHeight = windowWidth <= 480 ? 24 : 28;
    const projPlotHeight = useMemo(
        () => Math.max(480, projects.length * projRowHeight + 80),
        [projects.length, projRowHeight],
    );

    const projXMax = useMemo(() => {
        const max = Math.max(...projValues, 0);
        return Math.ceil(max * 1.15 / 50) * 50;
    }, [projValues]);

    const barOpacityFor = useCallback((pointIndex) => {
        if (selectedPoints === null) return 1;
        return selectedPoints.includes(pointIndex) ? 1 : 0.3;
    }, [selectedPoints]);

    const barLabelFontSize = windowWidth <= 480 ? 12 : 14;
    const barLabelFont = useMemo(() => ({
        size: barLabelFontSize,
        color: '#58585a',
        family: 'Arial, sans-serif',
    }), [barLabelFontSize]);

    const projBaseColors = useMemo(
        () => projects.map((row) => PROJECT_PROV_COLORS[row.provKey] || '#666666'),
        [projects],
    );

    const projPlotData = useMemo(() => [{
        type: 'bar',
        orientation: 'h',
        y: projLabels,
        x: projValues,
        customdata: projValues.map((v) => formatMw(v)),
        marker: {
            color: projBaseColors,
            opacity: projects.map((_, i) => barOpacityFor(i)),
            line: { width: 0 },
        },
        text: projValues.map((v) => formatMw(v)),
        textposition: 'outside',
        textfont: barLabelFont,
        outsidetextfont: barLabelFont,
        cliponaxis: false,
        hovertemplate: '<b>%{y}</b><br>%{customdata} MW<extra></extra>',
    }], [projLabels, projValues, projects, projBaseColors, barLabelFont, barOpacityFor, formatMw]);

    const projPlotLayout = useMemo(() => ({
        showlegend: false,
        hovermode: 'closest',
        hoverlabel: HOVER_LABEL,
        clickmode: 'event',
        dragmode: false,
        height: projPlotHeight,
        xaxis: {
            range: [0, projXMax],
            showgrid: false,
            showline: true,
            linewidth: 1,
            linecolor: '#333',
            tickfont: tickFont,
            fixedrange: true,
            automargin: false,
            showticklabels: false,
            title: { text: '' },
        },
        yaxis: {
            type: 'category',
            categoryorder: 'array',
            categoryarray: projLabels,
            tickmode: 'array',
            tickvals: projLabels,
            ticktext: useWrapLabels ? projTickText : projLabels,
            autorange: 'reversed',
            showgrid: false,
            tickfont: tickFont,
            fixedrange: true,
            automargin: false,
            side: 'left',
            ticklabelposition: 'outside',
            title: { text: '' },
        },
        margin: { l: projLeftMargin, r: projRightMargin, t: 8, b: 40 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        autosize: true,
    }), [projXMax, projLabels, projTickText, tickFont, projPlotHeight, useWrapLabels, projLeftMargin, projRightMargin]);

    useEffect(() => { clickHandlerRef.current = handleChartClick; });

    const bindPlotClickHandler = useCallback((graphDiv) => {
        if (!graphDiv?.on) return;
        if (graphDiv._largestSolarProjectsClick) {
            graphDiv.removeListener('plotly_click', graphDiv._largestSolarProjectsClick);
        }
        const handler = (event) => clickHandlerRef.current?.(event);
        graphDiv._largestSolarProjectsClick = handler;
        graphDiv.on('plotly_click', handler);
    }, []);

    const onPlotReady = useCallback(
        (_figure, graphDiv) => bindPlotClickHandler(graphDiv),
        [bindPlotClickHandler],
    );

    const chartTitleSuffix = substitute(getText('largest_solar_projects_chart_title_suffix', lang), { year: referenceYear ?? '' });
    const chartTitleFull = `${stripHtml(getText('largest_solar_projects_chart_title', lang))}*${stripHtml(chartTitleSuffix)}`;
    const chartSummary = projects.length ? joinChartSummary({
        intro: lang === 'en'
            ? 'Bar chart of the largest solar projects'
            : 'Graphique à barres des principales installations solaires',
        unitNote: lang === 'en' ? 'Values in megawatts' : 'Valeurs en mégawatts',
        body: summarizeByCategory({
            categories: projLabels,
            series: [
                { name: lang === 'en' ? 'Capacity' : 'Capacité', values: projValues, format: formatMw },
                {
                    name: lang === 'en' ? 'Province' : 'Province',
                    values: projects.map((row) => (row.provKey ? getLegendLabel(row.provKey) : '—')),
                },
            ],
            lang,
        }),
    }) : '';
    const chartRegionLabel = chartSummary ? `${chartTitleFull}. ${chartSummary}` : chartTitleFull;
    const tableCaption = substitute(getText('largest_solar_projects_table_caption', lang), { year: referenceYear ?? '' });
    const downloadSlug = lang === 'en' ? 'largest_solar_projects' : 'principales_installations_solaires';

    const tableColumns = useMemo(() => [
        { key: 'facility', header: getText('largest_solar_projects_table_col_facility', lang), align: 'left' },
        { key: 'capacity', header: getText('largest_solar_projects_table_col_capacity', lang), align: 'num' },
    ], [lang]);

    const downloadChartWithLegend = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${downloadSlug}.png`,
        title: chartTitleFull,
        width: 1000,
        height: projPlotHeight,
        legendItems: LEGEND_KEYS.map((key) => ({
            color: PROJECT_PROV_COLORS[key],
            label: getLegendLabel(key),
        })),
    }),
        [LEGEND_KEYS, PROJECT_PROV_COLORS, chartTitleFull, downloadSlug, getLegendLabel, projPlotHeight],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        name: getText('largest_solar_projects_download_png', lang),
        click: (gd) => downloadChartWithLegend(gd),
    });

    if (loading) {
        return (
            <PageStatus
                lang={lang}
                loading
                loadingMessage={lang === 'en' ? 'Loading data…' : 'Chargement des données…'}
                className="largest-solar-projects-loading"
            />
        );
    }
    if (error) {
        return <PageStatus lang={lang} error={error} className="largest-solar-projects-error" />;
    }
    if (!projects.length) {
        return <p className="largest-solar-projects-error">{lang === 'en' ? 'No data available.' : 'Aucune donnée disponible.'}</p>;
    }

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-84"
            role="main"
            aria-labelledby="largest-solar-projects-chart-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-84 { width: 100%; }
.largest-solar-projects-container { width: 100%; padding: 15px 0 40px 0; display: flex; flex-direction: column; box-sizing: border-box; }
.largest-solar-projects-chart-frame { background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 24px; box-sizing: border-box; overflow: visible; }
.largest-solar-projects-chart-title { font-family: 'Lato', sans-serif; font-size: 29px; font-weight: bold; color: var(--gc-text); text-align: center; margin: 0 0 12px 0; text-transform: none; }
.largest-solar-projects-chart-title .fn-lnk { color: #26374a; }
.largest-solar-projects-chart-bg-wrapper {
    position: relative;
    width: 100%;
}
.largest-solar-projects-bg-layer {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
}
.largest-solar-projects-bg-image {
    display: block;
    width: 100%;
    height: auto;
    max-height: 100%;
    flex-shrink: 0;
}
.largest-solar-projects-chart-overlay { position: relative; z-index: 1; width: 100%; }
.largest-solar-projects-chart-scroll { width: 100%; overflow: visible; position: relative; }
.largest-solar-projects-chart { width: 100%; min-width: 0; position: relative; z-index: 1; overflow: visible; }
.largest-solar-projects-chart > div { width: 100%; height: 100%; overflow: visible; }
.largest-solar-projects-chart .js-plotly-plot,
.largest-solar-projects-chart .plot-container,
.largest-solar-projects-chart .svg-container { overflow: visible !important; pointer-events: auto !important; }
.largest-solar-projects-chart .js-plotly-plot .plotly .modebar { right: 4px !important; top: 2px !important; }
.largest-solar-projects-column-headers {
    display: grid;
    align-items: flex-end;
    font-family: Arial, sans-serif;
    font-size: 16px;
    font-weight: bold;
    color: #58585a;
    margin-bottom: 4px;
    padding: 0;
    box-sizing: border-box;
}
.largest-solar-projects-column-headers span:first-child { text-align: right; padding-right: 2px; box-sizing: border-box; }
.largest-solar-projects-column-headers span:last-child { text-align: right; box-sizing: border-box; }
.largest-solar-projects-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 18px 28px; margin-top: 16px; font-family: Arial, sans-serif; font-size: 14px; color: var(--gc-text); }
.largest-solar-projects-legend-item { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.largest-solar-projects-legend-swatch { width: 22px; height: 14px; display: inline-block; border: 1px solid rgba(0, 0, 0, 0.12); }
.largest-solar-projects-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.largest-solar-projects-chart-frame button:hover { background-color: #404040 !important; }
.largest-solar-projects-footnotes { font-family: var(--font-body); font-size: 1rem; color: var(--gc-text); margin-top: 24px; margin-bottom: 0; padding-top: 12px; border-top: 1px solid #e0e0e0; line-height: 1.65; max-width: 100%; box-sizing: border-box; }
.largest-solar-projects-footnotes h2 { font-family: var(--font-heading); font-size: 1.4rem; font-weight: 700; color: var(--gc-text); margin-top: 0; margin-bottom: 1rem; }
.largest-solar-projects-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
.largest-solar-projects-loading, .largest-solar-projects-error { font-family: 'Noto Sans', sans-serif; font-size: 18px; color: var(--gc-text); margin: 24px 0; }
@media (max-width: 768px) {
    .largest-solar-projects-chart-title { font-size: 26px; }
    .largest-solar-projects-footnotes { font-size: 0.9rem; }
    .largest-solar-projects-footnotes h2 { font-size: 1.2rem; margin-bottom: 0.75rem; }
    .largest-solar-projects-column-headers { font-size: 14px; }
}
            `}</style>

            <div className="largest-solar-projects-container">
                <div className="largest-solar-projects-chart-frame">
                    <h2 id="largest-solar-projects-chart-title" className="largest-solar-projects-chart-title">
                        {getText('largest_solar_projects_chart_title', lang)}
                        <FootnoteMarker
                            lang={lang}
                            href="#fn-asterisk-largest-solar-projects"
                            id="fn-asterisk-rf-largest-solar-projects"
                            marker="*"
                            onClick={scrollToFootnote}
                        />
                        {chartTitleSuffix}
                    </h2>

                    {selectedPoints !== null && (
                        <ClearSelectionButton lang={lang} onClick={clearSelection} />
                    )}

                    <div className="largest-solar-projects-chart-bg-wrapper" style={{ minHeight: projPlotHeight }}>
                        <div className="largest-solar-projects-bg-layer" aria-hidden="true">
                            <img src={largestSolarProjectsBg} alt="" className="largest-solar-projects-bg-image" draggable={false} />
                        </div>
                        <div className="largest-solar-projects-chart-overlay">
                            <div className="largest-solar-projects-column-headers" style={projColumnHeaderStyle} aria-hidden="true">
                                <span>{getText('largest_solar_projects_table_col_facility', lang)}</span>
                                <span>{getText('largest_solar_projects_table_col_capacity', lang)}</span>
                            </div>

                            <div className="largest-solar-projects-chart-scroll">
                                <figure
                                    ref={chartRef}
                                    className="largest-solar-projects-chart"
                                    style={{ height: projPlotHeight, margin: 0 }}
                                    role="region"
                                    aria-label={chartRegionLabel}
                                    tabIndex={0}
                                >
                                    <div aria-hidden="true" style={{ width: '100%', height: '100%' }}>
                                    <Plot
                                        key={`largest-solar-projects-${useWrapLabels ? 'wrap' : 'plain'}-${Math.round(zoomEffective * 100)}-${projPlotHeight}-${projLeftMargin}`}
                                        data={projPlotData}
                                        layout={projPlotLayout}
                                        config={plotConfig}
                                        style={{ width: '100%', height: '100%' }}
                                        useResizeHandler
                                        onInitialized={onPlotReady}
                                        onUpdate={onPlotReady}
                                    />
                                    </div>
                                </figure>
                            </div>
                        </div>
                    </div>

                    <div className="largest-solar-projects-legend">
                        {LEGEND_KEYS.map((key) => (
                            <span key={key} className="largest-solar-projects-legend-item">
                                <span className="largest-solar-projects-legend-swatch" style={{ backgroundColor: PROJECT_PROV_COLORS[key] }} />
                                {getLegendLabel(key)}
                            </span>
                        ))}
                    </div>

                    <div className="largest-solar-projects-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            className="largest-solar-projects-data-table"
                            columns={tableColumns}
                            rows={projects}
                            csvFilename={`${downloadSlug}.csv`}
                            docx={{
                                filename: `${downloadSlug}.docx`,
                                title: chartTitleFull,
                                titleAlign: 'center',
                                columnWidths: [5200, 2200],
                                fontSize: 22,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatMw(raw)
                            )}
                        />
                    </div>
                </div>

                <PageFootnotes
                    lang={lang}
                    className="largest-solar-projects-footnotes"
                    items={[
                        { id: 'fn-asterisk-largest-solar-projects', marker: '*', text: getText('largest_solar_projects_footnote', lang), returnHref: '#fn-asterisk-rf-largest-solar-projects' },
                    ]}
                />
            </div>
        </main>
    );
};

export default LargestSolarProjects;
