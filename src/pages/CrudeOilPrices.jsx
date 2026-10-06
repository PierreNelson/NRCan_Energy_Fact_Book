import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useWindowWidth from '../hooks/useWindowWidth';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import { getCrudeOilPricesData } from '../utils/dataLoader';
import hexToRgba from '../utils/hexToRgba';

const COLORS = {
    differential: '#949494',
    wti: '#0061A6',
    wcs: '#7C9E33',
};

const CHART_START = 201501;

const substitute = (template, vars) =>
    template.replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const formatMonthRef = (refDate, lang) => {
    const year = Math.floor(refDate / 100);
    const month = refDate % 100;
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString(lang === 'en' ? 'en-CA' : 'fr-CA', { month: 'short', year: 'numeric' });
};

const CrudeOilPrices = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [selectedTraceIds, setSelectedTraceIds] = useState(null);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null });

    const formatPrice = (num) => {
        if (num === undefined || num === null || Number.isNaN(num)) return '\u2014';
        return Number(num).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    const formatFx = (num) => {
        if (num === undefined || num === null || Number.isNaN(num)) return '\u2014';
        return Number(num).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4,
        });
    };

    useEffect(() => {
        let cancelled = false;
        getCrudeOilPricesData()
            .then((data) => {
                if (!cancelled) {
                    setResult(data);
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err.message || String(err));
                    setLoading(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    

    const chartRows = useMemo(() => result?.chartData?.filter((row) => row.refDate >= CHART_START) || [], [result]);
    const chartTableRows = useMemo(
        () => [...chartRows].sort((a, b) => b.refDate - a.refDate),
        [chartRows],
    );
    const chartStartYear = result?.chartStartYear ?? 2015;
    const chartEndYear = result?.chartEndYear ?? 2025;

    const xDates = useMemo(() => chartRows.map((row) => row.dateLabel), [chartRows]);
    const wtiValues = useMemo(() => chartRows.map((row) => row.wti), [chartRows]);
    const wcsValues = useMemo(() => chartRows.map((row) => row.wcsUsd), [chartRows]);
    const diffValues = useMemo(() => chartRows.map((row) => row.differential), [chartRows]);

    const diffLabel = getText('crude_prices_legend_differential', lang);
    const wtiLabel = getText('crude_prices_legend_wti', lang);
    const wcsLabel = getText('crude_prices_legend_wcs', lang);
    const yAxisTitle = getText('crude_prices_yaxis_label', lang);
    const chartTitle = getText('crude_prices_chart_title', lang);
    const exportChartTitle = `${stripHtml(chartTitle)} (${chartStartYear}-${chartEndYear})`;
    const textVars = { startYear: chartStartYear, endYear: chartEndYear };
    const tableCaption = substitute(getText('crude_prices_table_caption', lang), textVars);

    const fileSlugBase =
        lang === 'en'
            ? `wti_and_wcs_prices_${chartStartYear}-${chartEndYear}`
            : `prix_du_wti_et_wcs_${chartStartYear}-${chartEndYear}`;

    const tableColumns = useMemo(() => [
        { key: 'date', header: getText('crude_prices_table_col_date', lang), align: 'left' },
        { key: 'wti', header: getText('crude_prices_table_col_wti', lang), align: 'num' },
        { key: 'wcsCad', header: getText('crude_prices_table_col_wcs_cad', lang), align: 'num' },
        { key: 'usdCad', header: getText('crude_prices_table_col_usd_cad', lang), align: 'num' },
        { key: 'wcsUsd', header: getText('crude_prices_table_col_wcs_usd', lang), align: 'num' },
        { key: 'differential', header: getText('crude_prices_table_col_differential', lang), align: 'num' },
    ], [lang]);

    const tableRows = useMemo(
        () =>
            chartTableRows.map((row) => ({
                date: formatMonthRef(row.refDate, lang),
                wti: row.wti,
                wcsCad: row.wcsCad,
                usdCad: row.usdCad,
                wcsUsd: row.wcsUsd,
                differential: row.differential,
            })),
        [chartTableRows, lang],
    );

    const yearTicks = useMemo(() => {
        const ticks = [];
        for (let year = chartStartYear; year <= chartEndYear; year += 1) {
            ticks.push(`${year}-01-01`);
        }
        return ticks;
    }, [chartStartYear, chartEndYear]);

    const plotBottomMargin = windowWidth <= 480 ? 72 : windowWidth <= 768 ? 62 : 50;
    const plotTopMargin = windowWidth <= 480 ? 56 : 48;
    const chartHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 400 : 480;
    const tickFont = { size: windowWidth <= 480 ? 12 : windowWidth <= 768 ? 14 : 16, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    const hoverPrice = (label, values) =>
        values.map((val, i) => {
            const row = chartRows[i];
            const dateText = formatMonthRef(row.refDate, lang);
            const formatted = lang === 'en' ? `$${formatPrice(val)}` : `${formatPrice(val)} $`;
            return `<b>${label}</b><br>${dateText}: ${formatted}<extra></extra>`;
        });

    const diffFocused = selectedTraceIds === null || selectedTraceIds.includes(0);
    const diffFillColor = hexToRgba(COLORS.differential, diffFocused ? 0.85 : 0.25);
    const wtiFocused = selectedTraceIds === null || selectedTraceIds.includes(2);
    const wcsFocused = selectedTraceIds === null || selectedTraceIds.includes(1);

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${fileSlugBase}.png`,
        title: exportChartTitle,
        height: 700,
        legendItems: [
            { label: diffLabel, color: COLORS.differential },
            { label: wtiLabel, color: COLORS.wti },
            { label: wcsLabel, color: COLORS.wcs },
        ],
    }),
        [COLORS, diffLabel, exportChartTitle, fileSlugBase, wcsLabel, wtiLabel],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        name: getText('crude_prices_download_chart', lang),
        click: (gd) => downloadChartWithTitle(gd),
    });

    const getChartSummary = () => {
        if (!chartRows.length) return '';
        // Monthly series is long; summarize last observation per year for SR.
        const lastByYear = new Map();
        chartRows.forEach((row) => {
            lastByYear.set(Math.floor(row.refDate / 100), row);
        });
        const years = [...lastByYear.keys()].sort((a, b) => a - b);
        const body = summarizeByCategory({
            categories: years,
            series: [
                { name: diffLabel, values: years.map((y) => lastByYear.get(y).differential), format: formatPrice },
                { name: wcsLabel, values: years.map((y) => lastByYear.get(y).wcsUsd), format: formatPrice },
                { name: wtiLabel, values: years.map((y) => lastByYear.get(y).wti), format: formatPrice },
            ],
            lang,
            newestFirst: true,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Line chart of WTI and WCS crude oil prices and the differential from ${chartStartYear} to ${chartEndYear}`
                : `Graphique linéaire des prix du pétrole brut WTI et WCS et de l'écart de ${chartStartYear} à ${chartEndYear}`,
            unitNote: lang === 'en'
                ? `Values in ${yAxisTitle}. Year-end values summarized`
                : `Valeurs en ${yAxisTitle}. Valeurs de fin d'année résumées`,
            body,
        });
    };

    const chartRegionLabel = `${exportChartTitle}. ${getChartSummary()}`;

    if (loading || error) {
        return (
            <PageShell
                tabIndex="-1"
                className="page-content page-117 crude-oil-prices-crude-prices page-chrome page-chrome--bleed"
                aria-labelledby="crude-oil-prices-title"
                style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
            >
                <PageStatus lang={lang} loading={loading} error={error} />
            </PageShell>
        );
    }
    if (!chartRows.length) {
        return (
            <PageShell
                tabIndex="-1"
                className="page-content page-117 crude-oil-prices-crude-prices page-chrome page-chrome--bleed"
                aria-labelledby="crude-oil-prices-title"
                style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
            >
                <p>{getText('crude_prices_no_data', lang)}</p>
            </PageShell>
        );
    }

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-117 crude-oil-prices-crude-prices page-chrome page-chrome--bleed"
            aria-labelledby="crude-oil-prices-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.page-117.crude-oil-prices-crude-prices {
}
.crude-oil-prices-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.crude-oil-prices-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 24px 0;
    line-height: 1.25;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: none;
}
.crude-oil-prices-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.page-117 p.crude-oil-prices-subtitle {
    font-family: 'Lato', sans-serif;
    font-size: 28px;
    font-weight: bold;
    color: #423330;
    margin: 0 0 15px 0;
    text-transform: none;
}
.crude-oil-prices-text {
    font-family: var(--font-body);
    line-height: 1.5;
    color: var(--gc-text);
    margin-bottom: 28px;
    max-width: none;
}
.crude-oil-prices-text ul {
    margin: 0 0 1rem 0;
    padding-left: 1.25rem;
}
.crude-oil-prices-text li {
    margin-bottom: 0.65rem;
    font-family: var(--font-body);
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
}
.crude-oil-prices-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-top: 8px;
    box-sizing: border-box;
    overflow: visible;
}
.crude-oil-prices-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
}
.crude-oil-prices-chart { width: 100%; min-width: 0; height: ${chartHeight}px; position: relative; }
.crude-oil-prices-chart > div { width: 100%; height: 100%; }
.crude-oil-prices-legend {
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
.crude-oil-prices-legend-item { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.crude-oil-prices-legend-box { width: 18px; height: 18px; display: inline-block; border-radius: 2px; }
.crude-oil-prices-legend-line { width: 28px; height: 0; border-top: 3px solid; display: inline-block; }
.crude-oil-prices-table-wrapper { display: block; width: 100%; margin-top: 20px; }
@media (max-width: 768px) {
    .crude-oil-prices-title { font-size: 37px; }
    .page-117 p.crude-oil-prices-subtitle { font-size: 28px; }
    .crude-oil-prices-chart-title { font-size: 26px; }
    .crude-oil-prices-text li { font-size: 18px; }
}
@media (max-width: 480px) {
    .crude-oil-prices-chart { height: 320px; }
}
            `}</style>

            <div className="crude-oil-prices-inner">
                <header>
                    <h1 id="crude-oil-prices-title" className="crude-oil-prices-title">{getText('crude_prices_title', lang)}</h1>
                </header>

                <div className="crude-oil-prices-text">
                    <p className="crude-oil-prices-subtitle">{getText('crude_prices_subtitle_wti_wcs', lang)}</p>
                    <ul>
                        <li>{getText('crude_prices_bullet_wti', lang)}</li>
                        <li>{getText('crude_prices_bullet_wcs', lang)}</li>
                    </ul>

                    <p className="crude-oil-prices-subtitle">{getText('crude_prices_subtitle_differential', lang)}</p>
                    <ul>
                        <li>{getText('crude_prices_bullet_diff_quality', lang)}</li>
                        <li>{getText('crude_prices_bullet_diff_history', lang)}</li>
                        <li>{getText('crude_prices_bullet_pandemic', lang)}</li>
                        <li>{getText('crude_prices_paragraph_recovery', lang)}</li>
                    </ul>
                </div>

                <div className="crude-oil-prices-chart-frame">
                    <h2 id="crude-oil-prices-chart-title" className="crude-oil-prices-chart-title">{chartTitle}</h2>

                    {selectedTraceIds !== null && (
                        <ClearSelectionButton lang={lang} onClick={() => setSelectedTraceIds(null)} />
                    )}

                    <figure ref={chartRef} style={{ margin: 0 }}>
                        <div role="region" aria-label={chartRegionLabel} tabIndex="0">
                            <div aria-hidden="true">
                            <Plot
                                key={`crude-oil-prices-${selectedTraceIds ? selectedTraceIds.join('-') : 'all'}`}
                                data={[
                                    {
                                        x: xDates,
                                        y: diffValues,
                                        type: 'scatter',
                                        mode: 'lines',
                                        name: diffLabel,
                                        line: { color: diffFillColor, width: 0.5 },
                                        fill: 'tozeroy',
                                        fillcolor: diffFillColor,
                                        hovertemplate: hoverPrice(diffLabel, diffValues),
                                    },
                                    {
                                        x: xDates,
                                        y: wcsValues,
                                        type: 'scatter',
                                        mode: 'lines',
                                        name: wcsLabel,
                                        line: { color: hexToRgba(COLORS.wcs, wcsFocused ? 1 : 0.3), width: 2.5 },
                                        hovertemplate: hoverPrice(wcsLabel, wcsValues),
                                    },
                                    {
                                        x: xDates,
                                        y: wtiValues,
                                        type: 'scatter',
                                        mode: 'lines',
                                        name: wtiLabel,
                                        line: { color: hexToRgba(COLORS.wti, wtiFocused ? 1 : 0.3), width: 2.5 },
                                        hovertemplate: hoverPrice(wtiLabel, wtiValues),
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
                                        ticktext: yearTicks.map((d) => String(parseInt(d.slice(0, 4), 10))),
                                        automargin: true,
                                    },
                                    yaxis: {
                                        title: { text: yAxisTitle, font: axisTitleFont, standoff: 12 },
                                        showgrid: false,
                                        showline: true,
                                        linewidth: 1,
                                        linecolor: '#333',
                                        zeroline: false,
                                        tickfont: tickFont,
                                        range: [0, 120],
                                        dtick: 20,
                                        automargin: true,
                                    },
                                    showlegend: false,
                                    margin: { l: 70, r: 24, t: plotTopMargin, b: plotBottomMargin },
                                    autosize: true,
                                    paper_bgcolor: 'rgba(0,0,0,0)',
                                    plot_bgcolor: 'rgba(0,0,0,0)',
                                    height: chartHeight,
                                }}
                                config={plotConfig}
                                className="crude-oil-prices-chart"
                                useResizeHandler
                                onClick={(data) => {
                                    if (!data.points || data.points.length === 0) return;
                                    const traceIndex = data.points[0].curveNumber;
                                    if (traceIndex === undefined || traceIndex < 0 || traceIndex > 2) return;
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
                                }}
                            />
                            </div>
                        </div>
                    </figure>

                    <div className="crude-oil-prices-legend" aria-hidden="true">
                        <div className="crude-oil-prices-legend-item">
                            <span className="crude-oil-prices-legend-box" style={{ backgroundColor: COLORS.differential }} />
                            <span>{diffLabel}</span>
                        </div>
                        <div className="crude-oil-prices-legend-item">
                            <span className="crude-oil-prices-legend-line" style={{ borderColor: COLORS.wti }} />
                            <span>{wtiLabel}</span>
                        </div>
                        <div className="crude-oil-prices-legend-item">
                            <span className="crude-oil-prices-legend-line" style={{ borderColor: COLORS.wcs }} />
                            <span>{wcsLabel}</span>
                        </div>
                    </div>

                    <div className="crude-oil-prices-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={`${fileSlugBase}.csv`}
                            docx={{
                                filename: `${fileSlugBase}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [1800, 1400, 1400, 1400, 1400, 1400],
                                fontSize: 18,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={getText('crude_prices_table_aria', lang)}
                            renderCell={(raw, { colIndex }) => {
                                if (colIndex === 0) return String(raw ?? '');
                                if (colIndex === 3) return formatFx(raw);
                                return formatPrice(raw);
                            }}
                        />
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default CrudeOilPrices;
