import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useWindowWidth from '../hooks/useWindowWidth';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import {
    UPSTREAM_PRICE_ROWS,
    summarizeUpstreamPrices,
} from './upstreamPricesData';

const COLORS = {
    henry: '#1f6cab',
    dawn: '#f15a22',
    aeco: '#7cb342',
};

const TRACE_KEYS = ['henry', 'dawn', 'aeco'];

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const monthDate = (year, month) => new Date(year, month - 1, 1);

const UpstreamPrices = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const chartRef = useRef(null);
    const frameRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null });
    const [selectedTraces, setSelectedTraces] = useState(null);
    const [listBox, setListBox] = useState(null);
    const sideBySide = windowWidth > 900;

    useEffect(() => {
        const frame = frameRef.current;
        if (!frame || !sideBySide) {
            setListBox(null);
            return undefined;
        }
        const measure = () => {
            const summary = frame.querySelector('summary');
            if (!summary) return;
            const frameRect = frame.getBoundingClientRect();
            const summaryRect = summary.getBoundingClientRect();
            const padTop = parseFloat(getComputedStyle(frame).paddingTop) || 0;
            setListBox({
                height: Math.round(summaryRect.bottom - frameRect.top),
                paddingTop: padTop,
            });
        };
        const observer = new ResizeObserver(measure);
        observer.observe(frame);
        measure();
        return () => observer.disconnect();
    }, [sideBySide, lang]);

    const locale = lang === 'fr' ? 'fr-CA' : 'en-CA';
    const narrow = windowWidth <= 768;
    // Swap this for the pipeline series later. Years below are read from the rows.
    const priceRows = UPSTREAM_PRICE_ROWS;
    const { startYear, endYear, aecoAverages } = useMemo(
        () => summarizeUpstreamPrices(priceRows),
        [priceRows],
    );
    const yearVars = { startYear, endYear };

    const formatPrice = (value) => Number(value).toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    const formatAverage = (value) => (
        lang === 'fr' ? `${formatPrice(value)} $/MMBtu` : `$${formatPrice(value)}/MMBtu`
    );
    const formatMonth = (year, month) => monthDate(year, month).toLocaleDateString(locale, {
        month: 'short',
        year: 'numeric',
    });

    const henryLabel = getText('upstream_prices_legend_henry', lang);
    const dawnLabel = getText('upstream_prices_legend_dawn', lang);
    const aecoLabel = getText('upstream_prices_legend_aeco', lang);
    const seriesLabels = [henryLabel, dawnLabel, aecoLabel];
    const chartTitle = substitute(getText('upstream_prices_chart_title', lang), yearVars);
    const exportChartTitle = stripHtml(chartTitle);
    const fileSlugBase = lang === 'fr'
        ? `prix_au_comptant_mensuels_moyens_gaz_naturel_${startYear}-${endYear}`
        : `monthly_average_natural_gas_spot_prices_${startYear}-${endYear}`;

    const xDates = useMemo(
        () => priceRows.map((row) => monthDate(row.year, row.month).toISOString().slice(0, 10)),
        [priceRows],
    );
    const yearTicks = useMemo(() => {
        const ticks = [];
        for (let year = startYear; year <= endYear; year += 1) {
            ticks.push(`${year}-01-01`);
        }
        return ticks;
    }, [startYear, endYear]);

    const tableColumns = useMemo(() => [
        { key: 'date', header: getText('upstream_prices_table_col_date', lang), align: 'left' },
        { key: 'henry', header: henryLabel, align: 'num' },
        { key: 'dawn', header: dawnLabel, align: 'num' },
        { key: 'aeco', header: aecoLabel, align: 'num' },
    ], [lang, henryLabel, dawnLabel, aecoLabel]);

    const tableRows = useMemo(
        () => [...priceRows].reverse().map((row) => ({
            date: formatMonth(row.year, row.month),
            henry: row.henry,
            dawn: row.dawn,
            aeco: row.aeco,
        })),
        // formatMonth depends on locale, which follows lang
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [priceRows, lang],
    );

    const focused = (index) => selectedTraces === null || selectedTraces.includes(index);

    const hoverFor = (label, key) => priceRows.map((row) => {
        const price = lang === 'fr' ? `${formatPrice(row[key])} $` : `$${formatPrice(row[key])}`;
        return `<b>${label}</b><br>${formatMonth(row.year, row.month)}: ${price}<extra></extra>`;
    });

    const calloutFont = { size: narrow ? 11 : 13, color: '#333333', family: 'Arial, sans-serif' };
    const shapes = [
        {
            type: 'circle',
            xref: 'x',
            yref: 'y',
            x0: '2008-02-01',
            x1: '2008-11-01',
            y0: 8,
            y1: 16.2,
            line: { color: '#6e6e6e', width: 1.5, dash: 'dot' },
            fillcolor: 'rgba(0,0,0,0)',
        },
        {
            type: 'circle',
            xref: 'x',
            yref: 'y',
            x0: '2013-12-01',
            x1: '2014-04-01',
            y0: 14.2,
            y1: 22.2,
            line: { color: '#6e6e6e', width: 1.5, dash: 'dot' },
            fillcolor: 'rgba(0,0,0,0)',
        },
        {
            type: 'circle',
            xref: 'x',
            yref: 'y',
            x0: '2021-10-01',
            x1: '2022-10-01',
            y0: 6.2,
            y1: 13.2,
            line: { color: '#6e6e6e', width: 1.5, dash: 'dot' },
            fillcolor: 'rgba(0,0,0,0)',
        },
    ];
    const annotations = [
        {
            x: '2009-02-01',
            y: 15.4,
            text: getText('upstream_prices_callout_shale', lang),
            showarrow: false,
            xanchor: 'left',
            yanchor: 'middle',
            align: 'left',
            font: calloutFont,
        },
        {
            x: '2014-02-01',
            y: 23.6,
            text: getText('upstream_prices_callout_vortex', lang),
            showarrow: false,
            xanchor: 'center',
            yanchor: 'bottom',
            align: 'center',
            font: calloutFont,
        },
        {
            x: '2022-11-01',
            y: 14.6,
            text: getText('upstream_prices_callout_ukraine', lang),
            showarrow: false,
            xanchor: 'left',
            yanchor: 'middle',
            align: 'left',
            font: calloutFont,
        },
    ];

    const getChartSummary = () => {
        const years = [];
        for (let year = startYear; year <= endYear; year += 1) years.push(year);
        const mean = (year, key) => {
            const rows = priceRows.filter((row) => row.year === year);
            return rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
        };
        return joinChartSummary({
            intro: exportChartTitle,
            unitNote: getText('upstream_prices_yaxis', lang),
            body: summarizeByCategory({
                categories: years,
                series: TRACE_KEYS.map((key, index) => ({
                    name: seriesLabels[index],
                    values: years.map((year) => mean(year, key)),
                    format: formatPrice,
                })),
                lang,
                newestFirst: true,
            }),
            lang,
        });
    };

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
            filename: `${fileSlugBase}.png`,
            title: exportChartTitle,
            height: 700,
            legendItems: TRACE_KEYS.map((key, index) => ({
                label: seriesLabels[index],
                color: COLORS[key],
            })),
        }),
        [exportChartTitle, fileSlugBase, seriesLabels],
    );
    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const onPlotClick = (event) => {
        const traceIndex = event?.points?.[0]?.curveNumber;
        if (traceIndex == null || traceIndex < 0 || traceIndex > 2) return;
        if (windowWidth <= 768) {
            const now = Date.now();
            const last = lastClickRef.current;
            const isDoubleTap = traceIndex === last.traceIndex && now - last.time < 300;
            lastClickRef.current = { time: now, traceIndex };
            if (!isDoubleTap) return;
        }
        setSelectedTraces((prev) => {
            if (prev === null) return [traceIndex];
            if (prev.includes(traceIndex)) {
                const next = prev.filter((index) => index !== traceIndex);
                return next.length ? next : null;
            }
            return [...prev, traceIndex];
        });
    };

    const chartHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 400 : 460;
    const tickFont = { size: narrow ? 11 : 13, family: 'Arial, sans-serif', color: '#333' };
    const axisTitleFont = { size: narrow ? 13 : 15, family: 'Arial, sans-serif', color: '#333' };

    const averageLabel = (row) => substitute(
        getText(row.startYear === row.endYear
            ? 'upstream_prices_average_year'
            : 'upstream_prices_average_range', lang),
        { startYear: row.startYear, endYear: row.endYear },
    );

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-129 page-chrome page-chrome--bleed"
            aria-labelledby="upstream-prices-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
                .upstream-prices-container { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
                .upstream-prices-intro {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 18px;
                    line-height: 1.45;
                    color: #333;
                    margin: 0 0 28px 0;
                }
                .upstream-prices-layout {
                    display: grid;
                    grid-template-columns: minmax(250px, 340px) minmax(0, 1fr);
                    gap: 28px;
                    align-items: start;
                }
                .upstream-prices-aeco {
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                }
                .upstream-prices-aeco.is-matched .upstream-prices-aeco-list {
                    flex: 1;
                    justify-content: space-between;
                }
                .upstream-prices-aeco-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 26px;
                    font-weight: 700;
                    color: #333;
                    margin: 0 0 16px 0;
                }
                .upstream-prices-aeco-list {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .upstream-prices-aeco.is-matched .upstream-prices-aeco-list { gap: 0; }
                .upstream-prices-aeco-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    gap: 16px;
                    margin: 0;
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 16px;
                    color: #333;
                }
                .upstream-prices-aeco-value {
                    font-weight: 700;
                    font-size: 20px;
                    white-space: nowrap;
                }
                .upstream-prices-chart { width: 100%; margin: 0; }
                .upstream-prices-legend {
                    display: flex;
                    justify-content: center;
                    flex-wrap: wrap;
                    gap: 22px;
                    margin: 8px 0 4px 0;
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 15px;
                    color: #333;
                }
                .upstream-prices-legend-item { display: flex; align-items: center; gap: 8px; }
                .upstream-prices-legend-swatch {
                    width: 28px;
                    height: 3px;
                    border-radius: 2px;
                    display: inline-block;
                }
                @media (max-width: 900px) {
                    .upstream-prices-layout { grid-template-columns: 1fr; }
                }
            `}</style>
            <div className="upstream-prices-container">
                <h1 id="upstream-prices-title" className="page-chrome-title">
                    {getText('upstream_prices_title', lang)}
                </h1>
                <p className="upstream-prices-intro">{getText('upstream_prices_intro', lang)}</p>
                <div className="upstream-prices-layout">
                    <section
                        aria-labelledby="upstream-prices-aeco-title"
                        className={`upstream-prices-aeco${listBox ? ' is-matched' : ''}`}
                        style={listBox ? { height: `${listBox.height}px`, paddingTop: `${listBox.paddingTop}px` } : undefined}
                    >
                        <h2 id="upstream-prices-aeco-title" className="upstream-prices-aeco-title">
                            {getText('upstream_prices_aeco_title', lang)}
                        </h2>
                        <ul className="upstream-prices-aeco-list">
                            {aecoAverages.map((row) => (
                                <li key={row.id} className="upstream-prices-aeco-row">
                                    <span>{averageLabel(row)}</span>
                                    <span className="upstream-prices-aeco-value">{formatAverage(row.value)}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                    <div className="page-chrome-chart-frame" ref={frameRef}>
                        <h2 className="page-chrome-chart-title">{chartTitle}</h2>
                        {selectedTraces !== null && (
                            <ClearSelectionButton lang={lang} onClick={() => setSelectedTraces(null)} />
                        )}
                        <div role="region" aria-label={getChartSummary()} tabIndex="0">
                            <figure ref={chartRef} className="upstream-prices-chart">
                                <div aria-hidden="true">
                                    <Plot
                                        data={TRACE_KEYS.map((key, index) => ({
                                            x: xDates,
                                            y: priceRows.map((row) => row[key]),
                                            type: 'scatter',
                                            mode: 'lines',
                                            name: seriesLabels[index],
                                            line: { color: COLORS[key], width: 2 },
                                            opacity: focused(index) ? 1 : 0.25,
                                            hovertemplate: hoverFor(seriesLabels[index], key),
                                        }))}
                                        layout={{
                                            hoverlabel: {
                                                bgcolor: '#ffffff',
                                                bordercolor: '#cccccc',
                                                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
                                            },
                                            hovermode: 'closest',
                                            clickmode: 'event',
                                            dragmode: false,
                                            showlegend: false,
                                            shapes,
                                            annotations,
                                            xaxis: {
                                                type: 'date',
                                                tickmode: 'array',
                                                tickvals: yearTicks,
                                                ticktext: yearTicks.map((stamp) => stamp.slice(0, 4)),
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                ticks: 'inside',
                                                ticklen: 4,
                                                tickwidth: 1,
                                                tickcolor: '#333',
                                                tickfont: tickFont,
                                                automargin: true,
                                            },
                                            yaxis: {
                                                title: {
                                                    text: getText('upstream_prices_yaxis', lang),
                                                    font: axisTitleFont,
                                                    standoff: 8,
                                                },
                                                range: [0, 26],
                                                dtick: 5,
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                ticks: 'inside',
                                                ticklen: 4,
                                                tickwidth: 1,
                                                tickcolor: '#333',
                                                tickfont: tickFont,
                                                automargin: true,
                                            },
                                            margin: { l: narrow ? 64 : 72, r: narrow ? 12 : 16, t: 12, b: narrow ? 48 : 40 },
                                            autosize: true,
                                            paper_bgcolor: 'rgba(0,0,0,0)',
                                            plot_bgcolor: 'rgba(0,0,0,0)',
                                        }}
                                        config={plotConfig}
                                        style={{ width: '100%', height: `${chartHeight}px` }}
                                        useResizeHandler
                                        onClick={onPlotClick}
                                    />
                                </div>
                            </figure>
                        </div>
                        <div className="upstream-prices-legend" aria-hidden="true">
                            {TRACE_KEYS.map((key, index) => (
                                <div key={key} className="upstream-prices-legend-item">
                                    <span className="upstream-prices-legend-swatch" style={{ backgroundColor: COLORS[key] }} />
                                    <span>{seriesLabels[index]}</span>
                                </div>
                            ))}
                        </div>
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={`${fileSlugBase}.csv`}
                            docx={{
                                filename: `${fileSlugBase}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [2200, 2100, 2100, 2400],
                                fontSize: 20,
                            }}
                            caption={substitute(getText('upstream_prices_table_caption', lang), yearVars)}
                            tableAriaLabel={substitute(getText('upstream_prices_chart_aria', lang), yearVars)}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatPrice(raw)
                            )}
                        />
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default UpstreamPrices;
