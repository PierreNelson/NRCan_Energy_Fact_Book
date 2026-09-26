import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import PageFootnotes from '../components/PageFootnotes';
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
import hexToRgba from '../utils/hexToRgba';

import { makeScrollToIdHandler } from '../utils/scrollToId';

const BAR_KEYS = [
    'total',
    'activity',
    'structure',
    'service_level',
    'weather',
    'energy_efficiency',
    'other',
];

const energy_use_factors_DATA = {
    total: 1225,
    activity: 2591,
    structure: -486,
    service_level: 159,
    weather: -43,
    energy_efficiency: -1103,
    other: 108,
};

const COLORS = {
    total: '#CE8003',
    factor: '#4b4c4d',
};

const OPERATORS = ['=', '+', '+', '+', '+', '+'];

const energy_use_factors_VERTICAL_TICK_ZOOM = 2.5;
const energy_use_factors_OPERATOR_OVERLAP_ZOOM = 4.0;
const LIKELY_OS_DPR_BASES = [1, 1.25, 1.3333333333333333, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5];

const WRAPPED_CATEGORY_LABELS = {
    en: {
        total: 'Total change<br>in energy use',
        activity: 'Activity<br>effect',
        structure: 'Structure<br>effect',
        service_level: 'Service level<br>effect',
        weather: 'Weather<br>effect',
        energy_efficiency: 'Energy<br>efficiency<br>effect',
        other: 'Other',
    },
    fr: {
        total: "Variation globale<br>de la consommation<br>d'énergie",
        activity: "Effet de<br>l'activité",
        structure: 'Effet de<br>la structure',
        service_level: 'Effet du niveau<br>de service',
        weather: 'Effet des conditions<br>météorologiques',
        energy_efficiency: "Effet de<br>l'efficacité<br>énergétique",
        other: 'Autres',
    },
};

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
        return z >= energy_use_factors_VERTICAL_TICK_ZOOM && z <= 6.0;
    });
};

const EnergyUseFactors = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const [viewportZoom, setViewportZoom] = useState(createInitialViewportZoom);
    const {
        selected: selectedBars,
        clear,
        onPlotClick: handleChartClick,
        opacityFor,
        isSelected,
    } = usePlotlySelection({ mode: 'points', traceCount: 1, windowWidth });
    const chartRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const formatPj = (num) => {
        if (num == null || Number.isNaN(Number(num))) return '—';
        return Math.round(Number(num)).toLocaleString(locale);
    };

    const categoryLabels = useMemo(
        () => BAR_KEYS.map((key) => getText(`energy_use_factors_cat_${key}`, lang)),
        [lang],
    );

    const values = useMemo(() => BAR_KEYS.map((key) => energy_use_factors_DATA[key]), []);

    const baseColors = useMemo(
        () => BAR_KEYS.map((key) => (key === 'total' ? COLORS.total : COLORS.factor)),
        [],
    );

    const chartTitle = getText('energy_use_factors_chart_title', lang);
    const exportChartTitle = stripHtml(chartTitle);
    const chartDownloadSlug = getText('energy_use_factors_download_title', lang).replace(/\s+/g, '_');
    const yAxisTitle = getText('energy_use_factors_yaxis', lang);

    const tableColumns = useMemo(() => [
        { key: 'factor', header: getText('energy_use_factors_table_col_factor', lang), align: 'left' },
        { key: 'value', header: `${yAxisTitle} (PJ)`, align: 'num' },
    ], [lang, yAxisTitle]);

    const tableRows = useMemo(
        () => BAR_KEYS.map((key, i) => ({
            factor: categoryLabels[i],
            value: values[i],
        })),
        [categoryLabels, values],
    );

    const getChartSummary = () => {
        if (!categoryLabels.length) return '';
        const body = summarizeByCategory({
            categories: categoryLabels,
            series: [{ name: yAxisTitle, values, format: (v) => `${formatPj(v)} PJ` }],
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? 'Bar chart of factors contributing to the change in energy use'
                : "Diagramme à barres des facteurs contribuant à la variation de la consommation d'énergie",
            unitNote: lang === 'en' ? 'Values in PJ' : 'Valeurs en PJ',
            body,
        });
    };

    const overlayLang = lang === 'fr' ? 'fr' : 'en';
    const wrappedCategoryLabels = useMemo(
        () => BAR_KEYS.map((key) => WRAPPED_CATEGORY_LABELS[overlayLang][key]),
        [overlayLang],
    );

    const pageZoomForLayout = Math.max(
        viewportZoom.pinScale,
        viewportZoom.layoutRatio,
        viewportZoom.cssZoomFactor,
        viewportZoom.screenZoomHint,
    );
    const pinVertical =
        viewportZoom.pinScale > 1.02 && viewportZoom.pinScale >= energy_use_factors_VERTICAL_TICK_ZOOM;
    const useVerticalXLabels =
        pageZoomForLayout >= energy_use_factors_VERTICAL_TICK_ZOOM ||
        pinVertical ||
        isBrowserZoomInVerticalTickRange() ||
        windowWidth <= 480;

    const xTickText = useVerticalXLabels ? categoryLabels : wrappedCategoryLabels;
    const xTickAngle = useVerticalXLabels ? 90 : 0;
    const xTickFontSize = useVerticalXLabels
        ? windowWidth <= 480
            ? 12
            : 13
        : windowWidth <= 480
          ? 12
          : 14;

    const plotHeight = useVerticalXLabels
        ? windowWidth <= 480
            ? 500
            : windowWidth <= 768
              ? 540
              : 560
        : windowWidth <= 480
          ? 480
          : windowWidth <= 768
            ? 520
            : 540;
    const plotBottomMargin = useVerticalXLabels
        ? windowWidth <= 480
            ? 130
            : 110
        : windowWidth <= 480
          ? 155
          : windowWidth <= 768
            ? 145
            : 135;

    const barGap = useMemo(() => {
        if (pageZoomForLayout >= energy_use_factors_OPERATOR_OVERLAP_ZOOM) return 0.52;
        if (pageZoomForLayout >= 3) return 0.38;
        if (pageZoomForLayout >= energy_use_factors_VERTICAL_TICK_ZOOM) return 0.30;
        return 0.22;
    }, [pageZoomForLayout]);

    const operatorFontSize = useMemo(() => {
        const base = windowWidth <= 768 ? 18 : 22;
        if (pageZoomForLayout >= 5) return Math.max(11, Math.round(base * 0.5));
        if (pageZoomForLayout >= energy_use_factors_OPERATOR_OVERLAP_ZOOM) return Math.max(12, Math.round(base * 0.62));
        if (pageZoomForLayout >= 3) return Math.round(base * 0.85);
        return base;
    }, [pageZoomForLayout, windowWidth]);

    const barLabelFontSize = windowWidth <= 768 ? 12 : 14;
    const barLabelFont = {
        size: barLabelFontSize,
        color: '#333333',
        family: 'Arial, sans-serif',
    };

    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };
    const yTickFont = { size: windowWidth <= 480 ? 11 : windowWidth <= 768 ? 12 : 13, family: 'Arial, sans-serif' };

    const yTickvals = [-1500, -1000, -500, 0, 500, 1000, 1500, 2000, 2500, 3000, 3500];
    const yTicktext = yTickvals.map((v) => formatPj(v));

    const barOpacityFor = (pointIndex) => opacityFor(0, pointIndex);

    const barColorFor = (pointIndex, baseColor) => {
        if (selectedBars === null) return baseColor;
        return isSelected(0, pointIndex) ? baseColor : hexToRgba(baseColor, 0.3);
    };

    const operatorAnnotations = useMemo(
        () =>
            OPERATORS.map((text, i) => ({
                x: i + 0.5,
                y: 0,
                xref: 'x',
                yref: 'y',
                text,
                showarrow: false,
                font: {
                    family: 'Arial, sans-serif',
                    size: operatorFontSize,
                    color: '#347cba',
                },
                xanchor: 'center',
                yanchor: 'middle',
            })),
        [operatorFontSize],
    );

    const scrollToFootnote = makeScrollToIdHandler('fn-asterisk-energy-use-factors');

    const scrollToRef = makeScrollToIdHandler('fn-asterisk-rf-energy-use-factors');


    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${chartDownloadSlug}.png`,
        title: exportChartTitle,
        height: 680,
    }),
        [chartDownloadSlug, exportChartTitle],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const hoverTemplates = categoryLabels.map(
        (label, i) => `<b>${label}</b><br>${formatPj(values[i])} PJ<extra></extra>`,
    );

    const bulletKeys = ['activity', 'structure', 'service_level', 'energy_efficiency'];

    useEffect(() => {
        const syncViewportZoom = () => {
            setViewportZoom(createInitialViewportZoom());
        };
        syncViewportZoom();
        window.addEventListener('resize', syncViewportZoom);
        window.visualViewport?.addEventListener('resize', syncViewportZoom);
        window.visualViewport?.addEventListener('scroll', syncViewportZoom);
        return () => {
            window.removeEventListener('resize', syncViewportZoom);
            window.visualViewport?.removeEventListener('resize', syncViewportZoom);
            window.visualViewport?.removeEventListener('scroll', syncViewportZoom);
        };
    }, []);

    

    return (
        <PageShell tabIndex="-1"
            className="page-content page-56 energy-use-factors-energy-factors page-chrome page-chrome--bleed"
            aria-labelledby="energy-use-factors-chart-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.page-56.energy-use-factors-energy-factors {
}
.energy-use-factors-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.energy-use-factors-bullets {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: var(--gc-text);
    line-height: 1.5;
    margin: 0 0 24px 0;
    padding-left: 1.25rem;
    max-width: none;
}
.energy-use-factors-bullets li { margin-bottom: 0.65rem; }
.energy-use-factors-chart-frame {
    margin-top: 0;
    margin-bottom: 0;
}
.energy-use-factors-chart-title {
    color: var(--gc-text);
    margin: 0 0 12px 0;
    text-transform: none;
}
.energy-use-factors-chart {
    width: 100%;
    min-width: 0;
    height: ${plotHeight}px;
    position: relative;
}
.energy-use-factors-chart > div { width: 100%; height: 100%; }
.energy-use-factors-chart .xaxislayer-above path.domain,
.energy-use-factors-chart .xaxislayer-below path.domain {
    stroke: transparent !important;
    stroke-width: 0 !important;
}
.energy-use-factors-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.energy-use-factors-footnotes {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--gc-text);
    margin-top: 24px;
    margin-bottom: 0;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
    line-height: 1.65;
    max-width: 100%;
    box-sizing: border-box;
}
.energy-use-factors-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 1rem;
}
.energy-use-factors-footnotes dd {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-left: 0;
    margin-bottom: 0;
}
@media (max-width: 768px) {
    .energy-use-factors-bullets { font-size: 18px; }
    .energy-use-factors-footnotes { font-size: 0.9rem; }
    .energy-use-factors-footnotes h2 { font-size: 1.2rem; margin-bottom: 0.75rem; }
}
            `}</style>

            <div className="energy-use-factors-inner">
                <ul className="energy-use-factors-bullets" role="list">
                    {bulletKeys.map((key) => (
                        <li key={key} role="listitem">
                            <strong>{getText(`energy_use_factors_bullet_${key}_bold`, lang)}</strong>
                            {getText(`energy_use_factors_bullet_${key}_text`, lang)}
                        </li>
                    ))}
                </ul>

                <div className="energy-use-factors-chart-frame page-chrome-chart-frame">
                    <h2 id="energy-use-factors-chart-title" className="energy-use-factors-chart-title page-chrome-chart-title">
                        {chartTitle}
                        <sup id="fn-asterisk-rf-energy-use-factors">
                            <a className="fn-lnk" href="#fn-asterisk-energy-use-factors" onClick={scrollToFootnote}>
                                <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                                <span aria-hidden="true">*</span>
                            </a>
                        </sup>
                    </h2>

                    {selectedBars !== null && <ClearSelectionButton lang={lang} onClick={clear} />}

                    <figure ref={chartRef} style={{ margin: 0 }}>
                        <div role="region" aria-label={`${exportChartTitle}. ${getChartSummary()}`} tabIndex="0">
                            <Plot
                                key={`energy-use-factors-${selectedBars ? selectedBars.map((t) => t.join('-')).join('_') : 'all'}-${useVerticalXLabels ? 'v' : 'h'}-${plotHeight}-${barGap.toFixed(2)}-${operatorFontSize}`}
                                data={[
                                    {
                                        x: BAR_KEYS,
                                        y: values,
                                        type: 'bar',
                                        name: yAxisTitle,
                                        marker: {
                                            color: baseColors.map((color, i) => barColorFor(i, color)),
                                            opacity: values.map((_, i) => barOpacityFor(i)),
                                            line: { width: 0 },
                                        },
                                        text: values.map((v) => formatPj(v)),
                                        textposition: 'outside',
                                        textfont: barLabelFont,
                                        outsidetextfont: barLabelFont,
                                        insidetextfont: barLabelFont,
                                        uniformtext: { mode: 'show', minsize: barLabelFontSize },
                                        constraintext: 'none',
                                        cliponaxis: false,
                                        hovertemplate: hoverTemplates,
                                    },
                                ]}
                                layout={{
                                    showlegend: false,
                                    bargap: barGap,
                                    clickmode: 'event',
                                    dragmode: false,
                                    hovermode: 'closest',
                                    hoverlabel: {
                                        bgcolor: '#ffffff',
                                        font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
                                    },
                                    margin: { l: 72, r: 24, t: 20, b: plotBottomMargin },
                                    paper_bgcolor: 'rgba(0,0,0,0)',
                                    plot_bgcolor: 'rgba(0,0,0,0)',
                                    height: plotHeight,
                                    autosize: true,
                                    annotations: operatorAnnotations,
                                    xaxis: {
                                        type: 'category',
                                        categoryorder: 'array',
                                        categoryarray: BAR_KEYS,
                                        tickmode: 'array',
                                        tickvals: BAR_KEYS,
                                        ticktext: xTickText,
                                        showgrid: false,
                                        zeroline: false,
                                        showline: false,
                                        linewidth: 0,
                                        linecolor: 'rgba(0,0,0,0)',
                                        mirror: false,
                                        tickfont: { size: xTickFontSize, family: 'Arial, sans-serif' },
                                        tickangle: xTickAngle,
                                        automargin: true,
                                    },
                                    yaxis: {
                                        title: { text: yAxisTitle, font: axisTitleFont, standoff: 12 },
                                        range: [-1500, 3500],
                                        tickmode: 'array',
                                        tickvals: yTickvals,
                                        ticktext: yTicktext,
                                        showgrid: true,
                                        gridcolor: '#e0e0e0',
                                        showline: true,
                                        linewidth: 1,
                                        linecolor: '#333333',
                                        zeroline: false,
                                        tickfont: yTickFont,
                                        automargin: true,
                                    },
                                }}
                                config={plotConfig}
                                className="energy-use-factors-chart"
                                useResizeHandler
                                onClick={handleChartClick}
                            />
                        </div>
                    </figure>

                    <div className="energy-use-factors-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={`${chartDownloadSlug}.csv`}
                            docx={{
                                filename: `${chartDownloadSlug}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [5200, 2200],
                                fontSize: 20,
                            }}
                            caption={getText('energy_use_factors_table_caption', lang)}
                            tableAriaLabel={getText('energy_use_factors_table_caption', lang)}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatPj(raw)
                            )}
                        />
                    </div>
                </div>

                <PageFootnotes
                    lang={lang}
                    className="energy-use-factors-footnotes"
                    items={[
                        { id: 'fn-asterisk-energy-use-factors', marker: '*', text: getText('energy_use_factors_footnote', lang), returnHref: '#fn-asterisk-rf-energy-use-factors' },
                    ]}
                />
            </div>
        </PageShell>
    );
};

export default EnergyUseFactors;
