import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getEvSalesRegistrationsData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { joinChartSummary, summarizeByCategory } from '../utils/chartSpokenSummary';
import evSalesBg from '../assets/ev_sales_bg.png';
import { formatLocaleNumber, formatLocalePct } from '../utils/formatLocale';

const COLORS = {
    bars: '#3D7A42',
    line: '#7D962C',
};

const ev_sales_VERTICAL_TICK_ZOOM = 2.85;

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const EvSalesRegistrations = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const windowWidth = useWindowWidth();
    const [viewportZoom, setViewportZoom] = useState(() => {
        if (typeof window === 'undefined') {
            return { pinScale: 1, layoutRatio: 1, cssZoomFactor: 1, dprZoomFactor: 1, screenZoomHint: 1 };
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
        return { pinScale, layoutRatio, cssZoomFactor: 1, dprZoomFactor: 1, screenZoomHint };
    });
    /** null = no focus; [bar point indices, line point indices] */
    const {
        selected: selectedPoints,
        clear,
        togglePoint,
        opacityFor,
    } = usePlotlySelection({ mode: 'points', traceCount: 2, windowWidth });
    const chartRef = useRef(null);
    const zoomBaselineRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const formatNumber = (num, digits = 0) => formatLocaleNumber(num, lang, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });

    const formatPct = (num) => formatLocalePct(num, lang, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });

    useEffect(() => {
        getEvSalesRegistrationsData()
            .then(setResult)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const syncZoom = () => {
            const inner = window.innerWidth;
            const outer = window.outerWidth;
            const dpr = window.devicePixelRatio || 1;
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
            setViewportZoom({ pinScale, layoutRatio, cssZoomFactor, dprZoomFactor, screenZoomHint });
        };
        const rafId = requestAnimationFrame(syncZoom);
        const vv = typeof window !== 'undefined' ? window.visualViewport : null;
        if (vv) {
            vv.addEventListener('resize', syncZoom);
            vv.addEventListener('scroll', syncZoom);
        }
        window.addEventListener('resize', syncZoom);
        return () => {
            cancelAnimationFrame(rafId);
            if (vv) {
                vv.removeEventListener('resize', syncZoom);
                vv.removeEventListener('scroll', syncZoom);
            }
            window.removeEventListener('resize', syncZoom);
        };
    }, []);

    

    const chartRows = useMemo(() => result?.data ?? [], [result]);
    const years = chartRows.map((row) => row.year);
    const barValues = chartRows.map((row) => row.evRegsThousands);
    const lineValues = chartRows.map((row) => row.sharePct);

    const textVars = {
        startYear: result?.chartStartYear ?? 2011,
        endYear: result?.chartEndYear ?? '',
        year: result?.referenceYear ?? '',
        share: result?.referenceRow
            ? Number(result.referenceRow.sharePct).toLocaleString(locale, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
              })
            : '',
        evCount: result?.referenceRow ? formatNumber(result.referenceRow.evRegs) : '',
        multiplier: result?.multiplier ?? '',
    };

    const barsLabel = getText('ev_sales_legend_bars', lang);
    const lineLabel = getText('ev_sales_legend_line', lang);
    const chartTitle = substitute(getText('ev_sales_chart_title', lang), textVars);
    const exportChartTitle = stripHtml(chartTitle);
    const chartDownloadSlug = substitute(getText('ev_sales_download_title', lang), textVars)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    const tableCaption = substitute(getText('ev_sales_table_caption', lang), textVars);

    const tableColumns = useMemo(
        () => [
            { key: 'year', header: getText('ev_sales_table_col_year', lang), align: 'left' },
            { key: 'totalRegs', header: getText('ev_sales_table_col_total', lang), align: 'num' },
            { key: 'evRegs', header: getText('ev_sales_table_col_ev', lang), align: 'num' },
            { key: 'evRegsThousands', header: getText('ev_sales_table_col_ev_thousands', lang), align: 'num' },
            { key: 'sharePct', header: getText('ev_sales_table_col_share', lang), align: 'num' },
        ],
        [lang],
    );

    const zoomEffective = Math.max(
        viewportZoom.pinScale,
        viewportZoom.layoutRatio,
        viewportZoom.cssZoomFactor,
        viewportZoom.dprZoomFactor,
        viewportZoom.screenZoomHint,
    );
    const useVerticalYearTicks = zoomEffective >= ev_sales_VERTICAL_TICK_ZOOM || windowWidth <= 480;
    const tickFontBaseSize = windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15;
    const tickFont = { size: tickFontBaseSize, family: 'Arial, sans-serif' };
    const plotBottomMargin = useVerticalYearTicks
        ? windowWidth <= 480
            ? 88
            : windowWidth <= 768
              ? 78
              : 68
        : windowWidth <= 480
          ? 62
          : 50;
    const plotTopMargin = windowWidth <= 480 ? 56 : 48;
    const plotHeight = windowWidth <= 480 ? 320 : windowWidth <= 768 ? 360 : 400;

    const barPointOpacity = (index) => opacityFor(0, index);

    const linePointOpacity = (index) => opacityFor(1, index);

    const lineStrokeFocused =
        selectedPoints === null || selectedPoints[1].length > 0 || selectedPoints[0].length === 0;

    const barHoverTemplates = years.map(
        (y, i) =>
            `<b>${barsLabel}</b><br>${y}: ${formatNumber(barValues[i])}<br><b>${lineLabel}</b>: ${formatPct(lineValues[i])}<extra></extra>`,
    );
    const lineHoverTemplates = years.map(
        (y, i) =>
            `<b>${lineLabel}</b><br>${y}: ${formatPct(lineValues[i])}<br><b>${barsLabel}</b>: ${formatNumber(barValues[i])}<extra></extra>`,
    );

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${chartDownloadSlug}.png`,
        title: exportChartTitle,
        height: 640,
        legendItems: [
            { label: barsLabel, color: COLORS.bars },
            { label: lineLabel, color: COLORS.line },
        ],
    }),
        [COLORS, barsLabel, chartDownloadSlug, exportChartTitle, lineLabel],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        name: getText('ev_sales_download_chart', lang),
        click: (gd) => downloadChartWithTitle(gd),
    });

    const handleChartClick = (event) => {
        if (!event.points?.length) return;
        let seriesIndex = event.points[0].curveNumber;
        const pointIndex = event.points[0].pointIndex;
        if (seriesIndex === 2) seriesIndex = 0;
        if (seriesIndex !== 0 && seriesIndex !== 1) return;
        togglePoint(seriesIndex, pointIndex);
    };

    if (loading) return <PageStatus lang={lang} loading />;
    if (error) return <PageStatus lang={lang} error={error} />;
    if (!chartRows.length) {
        return <p>{getText('ev_sales_no_data', lang)}</p>;
    }

    const formatShareSpoken = (value) => {
        const formatted = formatLocalePct(value, lang, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
            suffix: false,
        });
        return `${formatted} ${lang === 'en' ? 'percent' : 'pour cent'}`;
    };
    const formatThousands = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return formatLocaleNumber(value, lang, { maximumFractionDigits: 1 });
    };
    const chartSummary = years.length ? joinChartSummary({
        intro: lang === 'en'
            ? `Combined bar and line chart of plug-in electric vehicle registrations and their share of new vehicle registrations from ${textVars.startYear} to ${textVars.endYear}`
            : `Graphique combiné à barres et à lignes des immatriculations de véhicules électriques rechargeables et de leur part des nouvelles immatriculations de ${textVars.startYear} à ${textVars.endYear}`,
        unitNote: lang === 'en'
            ? 'Registration values in thousands of vehicles'
            : 'Valeurs d’immatriculation en milliers de véhicules',
        body: summarizeByCategory({
            categories: years,
            series: [
                { name: barsLabel, values: barValues, format: formatThousands },
                { name: lang === 'en' ? 'Share of new registrations' : 'Part des nouvelles immatriculations', values: lineValues, format: formatShareSpoken },
            ],
            lang,
            newestFirst: true,
        }),
    }) : '';
    const chartRegionLabel = chartSummary ? `${exportChartTitle}. ${chartSummary}` : exportChartTitle;

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-96 ev-sales-ev-sales page-chrome page-chrome--bleed"
            aria-labelledby="ev-sales-chart-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.page-96.ev-sales-ev-sales {
    max-width: none !important;
    overflow-x: visible !important;
}
.ev-sales-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.ev-sales-bullets {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: var(--gc-text);
    line-height: 1.45;
    margin: 0 0 20px 0;
    padding-left: 1.35rem;
}
.ev-sales-bullets li { margin-bottom: 10px; }
.ev-sales-chart-frame {
    margin-bottom: 0;
}
.ev-sales-chart-title {
    color: var(--gc-text);
    margin: 0 0 5px 0;
}
.ev-sales-chart-figure { margin: 0; position: relative; }
.ev-sales-chart {
    width: 100%;
    min-width: 0;
    height: ${plotHeight}px;
    position: relative;
}
.ev-sales-chart > div { width: 100%; height: 100%; }
.ev-sales-legend {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 28px;
    margin-top: 12px;
    font-family: Arial, sans-serif;
    font-size: 15px;
    color: var(--gc-text);
}
.ev-sales-legend-item { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.ev-sales-legend-box { width: 18px; height: 18px; display: inline-block; border-radius: 2px; }
.ev-sales-legend-line { width: 28px; height: 4px; display: inline-block; border-radius: 2px; }
.ev-sales-table-wrapper { display: block; width: 100%; margin-top: 20px; }
@media (max-width: 768px) {
    .ev-sales-bullets { font-size: 18px; }
}
            `}</style>

            <div className="ev-sales-inner">
                <ul className="ev-sales-bullets">
                    <li>
                        {substitute(getText('ev_sales_bullet1_prefix', lang), textVars)}
                        <strong>{substitute(getText('ev_sales_bullet1_bold', lang), textVars)}</strong>
                    </li>
                    <li>
                        {lang === 'fr' ? (
                            <>
                                <strong>
                                    {substitute(getText('ev_sales_bullet2_bold1', lang), textVars)}
                                    {substitute(getText('ev_sales_bullet2_mid', lang), textVars)}
                                </strong>
                                {substitute(getText('ev_sales_bullet2_suffix', lang), textVars)}
                            </>
                        ) : (
                            <>
                                <strong>{substitute(getText('ev_sales_bullet2_bold1', lang), textVars)}</strong>
                                {getText('ev_sales_bullet2_mid', lang)}
                                <strong>{getText('ev_sales_bullet2_bold2', lang)}</strong>
                                {substitute(getText('ev_sales_bullet2_suffix', lang), textVars)}
                            </>
                        )}
                    </li>
                </ul>

                <div className="ev-sales-chart-frame page-chrome-chart-frame">
                    <h2 id="ev-sales-chart-title" className="ev-sales-chart-title page-chrome-chart-title">
                        {chartTitle}
                    </h2>

                    {selectedPoints !== null && <ClearSelectionButton lang={lang} onClick={clear} />}

                    <figure ref={chartRef} className="ev-sales-chart-figure">
                        <div
                            role="region"
                            aria-label={chartRegionLabel}
                            tabIndex="0"
                        >
                            <div aria-hidden="true">
                            <Plot
                                key={`ev-sales-${selectedPoints ? `${selectedPoints[0].join('-')}_${selectedPoints[1].join('-')}` : 'all'}-${useVerticalYearTicks ? 'v' : 'h'}-${plotHeight}`}
                                data={[
                                    {
                                        x: years,
                                        y: barValues,
                                        type: 'bar',
                                        name: barsLabel,
                                        marker: {
                                            color: COLORS.bars,
                                            opacity: years.map((_, i) => barPointOpacity(i)),
                                        },
                                        hovertemplate: barHoverTemplates,
                                        hoveron: 'points+fills',
                                        yaxis: 'y',
                                    },
                                    {
                                        x: years,
                                        y: lineValues,
                                        type: 'scatter',
                                        mode: 'lines+markers',
                                        name: lineLabel,
                                        line: {
                                            color: lineStrokeFocused ? COLORS.line : 'rgba(164, 198, 57, 0.3)',
                                            width: 3,
                                        },
                                        marker: {
                                            color: COLORS.line,
                                            size: 12,
                                            opacity: years.map((_, i) => linePointOpacity(i)),
                                        },
                                        hovertemplate: lineHoverTemplates,
                                        hoveron: 'points',
                                        yaxis: 'y2',
                                    },
                                    {
                                        x: years,
                                        y: barValues,
                                        type: 'scatter',
                                        mode: 'markers',
                                        name: barsLabel,
                                        marker: {
                                            size: 22,
                                            color: COLORS.bars,
                                            opacity: 0,
                                        },
                                        hoverinfo: 'skip',
                                        yaxis: 'y',
                                    },
                                ]}
                                layout={{
                                    showlegend: false,
                                    clickmode: 'event',
                                    dragmode: false,
                                    hovermode: 'closest',
                                    margin: { l: 72, r: 72, t: plotTopMargin, b: plotBottomMargin },
                                    paper_bgcolor: 'rgba(0,0,0,0)',
                                    plot_bgcolor: 'rgba(0,0,0,0)',
                                    images: [
                                        {
                                            source: evSalesBg,
                                            xref: 'paper',
                                            yref: 'paper',
                                            x: 0.5,
                                            y: 0.52,
                                            sizex: 0.92,
                                            sizey: 0.72,
                                            xanchor: 'center',
                                            yanchor: 'middle',
                                            layer: 'below',
                                            sizing: 'contain',
                                            opacity: 0.35,
                                        },
                                    ],
                                    annotations: years.map((year, i) => ({
                                        x: year,
                                        y: barValues[i],
                                        text: `<b>${barValues[i]}</b>`,
                                        showarrow: false,
                                        yanchor: 'bottom',
                                        yshift: 10,
                                        xref: 'x',
                                        yref: 'y',
                                        font: {
                                            family: 'Arial Black, Arial, sans-serif',
                                            size: tickFontBaseSize,
                                            color: '#333333',
                                        },
                                        opacity: barPointOpacity(i),
                                    })),
                                    xaxis: {
                                        type: 'linear',
                                        tickmode: 'array',
                                        tickvals: years,
                                        ticktext: years.map(String),
                                        tickangle: useVerticalYearTicks ? 90 : 0,
                                        showgrid: false,
                                        zeroline: false,
                                        showline: true,
                                        linewidth: 1,
                                        linecolor: '#333',
                                        tickfont: tickFont,
                                        automargin: true,
                                    },
                                    yaxis: {
                                        title: {
                                            text: `<b>${getText('ev_sales_yaxis_left', lang)}</b>`,
                                            font: { size: 15, family: 'Arial, sans-serif', color: '#333' },
                                        },
                                        range: [0, 300],
                                        dtick: 50,
                                        side: 'left',
                                        showgrid: false,
                                        zeroline: false,
                                        tickfont: tickFont,
                                    },
                                    yaxis2: {
                                        range: [0, 16],
                                        dtick: 2,
                                        ticksuffix: lang === 'fr' ? ' %' : '%',
                                        side: 'right',
                                        overlaying: 'y',
                                        showgrid: false,
                                        zeroline: false,
                                        showticklabels: true,
                                        tickfont: tickFont,
                                    },
                                    hoverlabel: {
                                        bgcolor: '#ffffff',
                                        bordercolor: '#333333',
                                        font: { color: '#333333', family: 'Arial, sans-serif' },
                                    },
                                    font: { family: 'Arial, sans-serif' },
                                }}
                                config={plotConfig}
                                onClick={handleChartClick}
                                className="ev-sales-chart"
                                useResizeHandler
                                style={{ width: '100%', height: `${plotHeight}px` }}
                            />
                            </div>
                        </div>
                    </figure>

                    <div className="ev-sales-legend" aria-hidden="true">
                        <div className="ev-sales-legend-item">
                            <span className="ev-sales-legend-box" style={{ backgroundColor: COLORS.bars }} />
                            <span>{barsLabel}</span>
                        </div>
                        <div className="ev-sales-legend-item">
                            <span className="ev-sales-legend-line" style={{ backgroundColor: COLORS.line }} />
                            <span>{lineLabel}</span>
                        </div>
                    </div>

                    <div className="ev-sales-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            label={getText('ev_sales_table_summary', lang)}
                            columns={tableColumns}
                            rows={chartRows}
                            csvFilename={`${chartDownloadSlug}.csv`}
                            docx={{
                                filename: `${chartDownloadSlug}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [900, 2200, 2200, 2200, 2600],
                                fontSize: 18,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                            renderCell={(raw, { colIndex, column }) => {
                                if (colIndex === 0) return String(raw ?? '');
                                if (column?.key === 'sharePct') return formatPct(raw);
                                return formatNumber(raw);
                            }}
                        />
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default EvSalesRegistrations;
