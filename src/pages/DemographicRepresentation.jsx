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

const CATEGORY_KEYS = [
    'women',
    'women_trades',
    'women_office',
    'immigrants',
    'indigenous',
    'visible_minorities',
    'high_school_plus',
    'university_plus',
    'age_55_plus',
];

const demographic_representation_DATA = {
    women: { energy: 24, all: 48 },
    women_trades: { energy: 7, all: 9 },
    women_office: { energy: 65, all: 68 },
    immigrants: { energy: 17, all: 25 },
    indigenous: { energy: 6, all: 4 },
    visible_minorities: { energy: 21, all: 26 },
    high_school_plus: { energy: 75, all: 66 },
    university_plus: { energy: 33, all: 32 },
    age_55_plus: { energy: 21, all: 24 },
};

const COLORS = {
    energy: '#1B99BB',
    all: '#9f346d',
};

const formatDemographicsPct = (value, lang) => {
    if (value == null || Number.isNaN(Number(value))) return '—';
    const formatted = Number(value).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
    return lang === 'fr' ? `${formatted} %` : `${formatted}%`;
};

/** Horizontal inset from plot left to first legend symbol (matches Plotly legend swatch padding). */
const LEGEND_SYMBOL_INSET_PX = 17;

const getLegendTitleX = (plotWidthPx) => LEGEND_SYMBOL_INSET_PX / Math.max(plotWidthPx, 320);

/** Gap between legend title and swatch row (~8px at typical chart heights). */
const LEGEND_TITLE_TO_ITEMS_GAP = 0.014;

const buildLegendTitleAnnotation = (legendSettings, titleX) => ({
    xref: 'paper',
    yref: 'paper',
    x: titleX,
    y: legendSettings.y + LEGEND_TITLE_TO_ITEMS_GAP,
    xanchor: 'left',
    yanchor: 'bottom',
    text: `<b>${legendSettings.legendTitle}</b>`,
    showarrow: false,
    font: {
        size: legendSettings.fontSize,
        family: 'Arial, sans-serif',
        color: '#333333',
    },
});

/** Vertical category ticks from ~300% page zoom (Ctrl+/pinch), matching GHG emissions sector and spotlight. */
const demographic_representation_VERTICAL_TICK_ZOOM = 2.85;
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
        return z >= demographic_representation_VERTICAL_TICK_ZOOM && z <= 5.45;
    });
}

const DemographicRepresentation = () => {
    const { lang } = useOutletContext();
    const windowWidth = useWindowWidth();
    const [viewportZoom, setViewportZoom] = useState(createInitialViewportZoom);
    const zoomBaselineRef = useRef(null);
    const {
        selected: selectedPoints,
        clear: clearSelection,
        onPlotClick: handleChartClick,
    } = usePlotlySelection({ mode: 'points', traceCount: 2, windowWidth });
    const chartRef = useRef(null);

    const chartTitle = getText('demographic_representation_chart_title', lang);
    const exportChartTitle = stripHtml(chartTitle);
    const chartDownloadSlug = getText('demographic_representation_download_title', lang).replace(/\s+/g, '_');

    const categoryLabelsFull = useMemo(
        () => CATEGORY_KEYS.map((key) => getText(`demographic_representation_cat_${key}_full`, lang)),
        [lang],
    );

    const categoryTickLabels = useMemo(
        () => CATEGORY_KEYS.map((key) => getText(`demographic_representation_cat_${key}_tick`, lang)),
        [lang],
    );

    const energyValues = useMemo(() => CATEGORY_KEYS.map((key) => demographic_representation_DATA[key].energy), []);
    const allValues = useMemo(() => CATEGORY_KEYS.map((key) => demographic_representation_DATA[key].all), []);

    const tableColumns = useMemo(() => [
        { key: 'group', header: getText('demographic_representation_table_group', lang), align: 'left' },
        { key: 'energy', header: getText('demographic_representation_table_energy', lang), align: 'num' },
        { key: 'all', header: getText('demographic_representation_table_all', lang), align: 'num' },
    ], [lang]);

    const tableRows = useMemo(
        () => CATEGORY_KEYS.map((key, i) => ({
            group: categoryLabelsFull[i],
            energy: demographic_representation_DATA[key].energy,
            all: demographic_representation_DATA[key].all,
        })),
        [categoryLabelsFull],
    );

    const pageZoomForLayout = Math.max(
        viewportZoom.pinScale,
        viewportZoom.layoutRatio,
        viewportZoom.cssZoomFactor,
        viewportZoom.screenZoomHint,
    );
    const pinVertical =
        viewportZoom.pinScale > 1.02 && viewportZoom.pinScale >= demographic_representation_VERTICAL_TICK_ZOOM;
    const useVerticalXLabels =
        pageZoomForLayout >= demographic_representation_VERTICAL_TICK_ZOOM ||
        pinVertical ||
        isBrowserZoomInVerticalTickRange();
    const xTickText = useVerticalXLabels ? categoryLabelsFull : categoryTickLabels;
    const xTickAngle = useVerticalXLabels ? 90 : 0;
    const xTickFontSize = useVerticalXLabels
        ? windowWidth <= 480
            ? 9
            : 10
        : windowWidth <= 480
          ? 10
          : 12;
    const yTickFontSize = windowWidth <= 480 ? 9 : 11;

    const legendSettings = useMemo(() => {
        const legendTitle = getText('demographic_representation_legend_title', lang);
        if (windowWidth <= 480) {
            return { y: -0.44, fontSize: 11, margin: useVerticalXLabels ? 320 : 230, legendTitle };
        }
        if (windowWidth <= 768) {
            return { y: -0.40, fontSize: 12, margin: useVerticalXLabels ? 310 : 225, legendTitle };
        }
        if (windowWidth <= 1097) {
            return { y: -0.36, fontSize: 14, margin: useVerticalXLabels ? 300 : 215, legendTitle };
        }
        return { y: -0.34, fontSize: 14, margin: useVerticalXLabels ? 290 : 210, legendTitle };
    }, [windowWidth, useVerticalXLabels, lang]);

    const chartHeight = useVerticalXLabels ? (windowWidth <= 768 ? 560 : 580) : windowWidth <= 768 ? 480 : 540;
    const plotAreaWidthPx = Math.max(windowWidth - 70, 320);

    const legendTitleAnnotation = useMemo(
        () => buildLegendTitleAnnotation(legendSettings, getLegendTitleX(plotAreaWidthPx)),
        [legendSettings, plotAreaWidthPx],
    );

    const energyTrace = useMemo(
        () => ({
            type: 'bar',
            name: getText('demographic_representation_legend_energy', lang),
            x: CATEGORY_KEYS,
            y: energyValues,
            marker: {
                color: CATEGORY_KEYS.map((_, index) =>
                    selectedPoints === null
                        ? COLORS.energy
                        : hexToRgba(COLORS.energy, selectedPoints[0]?.includes(index) ? 1 : 0.3),
                ),
            },
            hovertext: CATEGORY_KEYS.map(
                (key, i) =>
                    `<b>${categoryLabelsFull[i]}</b><br>${getText('demographic_representation_legend_energy', lang)}: ${formatDemographicsPct(energyValues[i], lang)}`,
            ),
            hoverinfo: 'text',
            hoverlabel: {
                bgcolor: '#ffffff',
                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
            },
        }),
        [lang, categoryLabelsFull, energyValues, selectedPoints],
    );

    const allTrace = useMemo(
        () => ({
            type: 'bar',
            name: getText('demographic_representation_legend_all', lang),
            x: CATEGORY_KEYS,
            y: allValues,
            marker: {
                color: CATEGORY_KEYS.map((_, index) =>
                    selectedPoints === null
                        ? COLORS.all
                        : hexToRgba(COLORS.all, selectedPoints[1]?.includes(index) ? 1 : 0.3),
                ),
            },
            hovertext: CATEGORY_KEYS.map(
                (key, i) =>
                    `<b>${categoryLabelsFull[i]}</b><br>${getText('demographic_representation_legend_all', lang)}: ${formatDemographicsPct(allValues[i], lang)}`,
            ),
            hoverinfo: 'text',
            hoverlabel: {
                bgcolor: '#ffffff',
                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
            },
        }),
        [lang, categoryLabelsFull, allValues, selectedPoints],
    );

    const plotLayout = useMemo(
        () => ({
            barmode: 'group',
            bargap: 0.15,
            bargroupgap: 0.08,
            hovermode: 'closest',
            clickmode: 'event',
            dragmode: false,
            xaxis: {
                type: 'category',
                categoryorder: 'array',
                categoryarray: CATEGORY_KEYS,
                tickmode: 'array',
                tickvals: CATEGORY_KEYS,
                ticktext: xTickText,
                showgrid: false,
                zeroline: false,
                tickangle: xTickAngle,
                tickfont: { size: xTickFontSize, family: 'Arial, sans-serif' },
                automargin: false,
            },
            yaxis: {
                range: [0, 100],
                dtick: 10,
                ticksuffix: lang === 'fr' ? ' %' : '%',
                showgrid: false,
                showline: true,
                linewidth: 1,
                linecolor: '#333',
                zeroline: true,
                tickfont: { size: yTickFontSize, family: 'Arial, sans-serif' },
                automargin: true,
            },
            legend: {
                orientation: 'h',
                x: 0,
                xanchor: 'left',
                y: legendSettings.y,
                yanchor: 'top',
                font: { size: legendSettings.fontSize, family: 'Arial, sans-serif' },
                title: { text: '' },
                traceorder: 'normal',
                itemclick: false,
                itemdoubleclick: false,
            },
            annotations: [legendTitleAnnotation],
            showlegend: true,
            margin: { l: 50, r: 20, t: 20, b: legendSettings.margin },
            height: chartHeight,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            autosize: true,
        }),
        [lang, xTickText, xTickAngle, xTickFontSize, yTickFontSize, legendSettings, legendTitleAnnotation, chartHeight],
    );

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${chartDownloadSlug}.png`,
        title: exportChartTitle,
        height: chartHeight,
        width: 1100,
    }),
        [chartDownloadSlug, chartHeight, exportChartTitle],
    );

    const getChartSummary = () => {
        const parts = CATEGORY_KEYS.map(
            (key, i) =>
                `${categoryLabelsFull[i]}: ${getText('demographic_representation_legend_energy', lang)} ${formatDemographicsPct(energyValues[i], lang)}, ${getText('demographic_representation_legend_all', lang)} ${formatDemographicsPct(allValues[i], lang)}`,
        ).join('; ');
        return `${exportChartTitle}. ${parts}.`;
    };

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
            className="page-content page-42"
            aria-labelledby="demographic-representation-chart-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-42 { width: 100%; }
.demographic-representation-container { width: 100%; padding: 15px 0 0 0; display: flex; flex-direction: column; box-sizing: border-box; flex: 1; overflow: visible; }
.demographic-representation-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-sizing: border-box;
    overflow: visible;
}
.demographic-representation-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 15px 0;
    text-align: center;
    text-transform: none;
}
.demographic-representation-chart { width: 100%; height: ${chartHeight}px; position: relative; z-index: 1; }
.demographic-representation-table-wrapper { display: block; width: 100%; margin: 20px 0 0 0; }
.demographic-representation-chart-frame button[type="button"]:hover { background-color: #404040 !important; }
@media (max-width: 768px) {
    .demographic-representation-chart-title { font-size: 26px; }
}
            `}</style>

            <div className="demographic-representation-container">
                <div className="demographic-representation-chart-frame">
                    <h1 className="wb-inv">{exportChartTitle}</h1>
                    <h2 id="demographic-representation-chart-title" className="demographic-representation-chart-title">
                        {chartTitle}
                    </h2>

                    <div role="region" aria-label={getChartSummary()} tabIndex="0">
                        {selectedPoints !== null && (
                            <ClearSelectionButton lang={lang} onClick={clearSelection} />
                        )}
                        <figure ref={chartRef} className="demographic-representation-chart" style={{ margin: 0, position: 'relative', height: chartHeight }}>
                            <Plot
                                key={`demographic-representation-${useVerticalXLabels ? 'v' : 'h'}-${chartHeight}-${lang}`}
                                data={[energyTrace, allTrace]}
                                layout={plotLayout}
                                config={plotConfig}
                                style={{ width: '100%', height: '100%' }}
                                useResizeHandler={true}
                                onClick={handleChartClick}
                            />
                        </figure>
                    </div>

                    <div className="demographic-representation-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={`${chartDownloadSlug}.csv`}
                            docx={{
                                filename: `${chartDownloadSlug}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [4800, 2400, 2400],
                                fontSize: 22,
                            }}
                            caption={getText('demographic_representation_table_caption', lang)}
                            tableAriaLabel={getText('demographic_representation_table_caption', lang)}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatDemographicsPct(raw, lang)
                            )}
                        />
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default DemographicRepresentation;
