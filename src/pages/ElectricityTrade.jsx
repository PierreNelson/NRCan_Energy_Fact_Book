import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import FootnoteMarker from '../components/FootnoteMarker';
import PageFootnotes from '../components/PageFootnotes';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getElectricityTradeData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import hexToRgba from '../utils/hexToRgba';
import { makeScrollToIdHandler } from '../utils/scrollToId';

import ElectricityTradeInfographic from '../components/ElectricityTradeInfographic';

const COLORS = {
    exports: '#8DBE45',
    imports: '#5D91B4',
    net: '#F16532',
};

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const ElectricityTrade = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const {
        selected: selectedPoints,
        clear,
        onPlotClick: handleChartClick,
        opacityFor,
        hasSelection,
    } = usePlotlySelection({ mode: 'points', traceCount: 3, windowWidth });
    const chartRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const formatTwh = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    };

    const scrollToFootnote = makeScrollToIdHandler('fn-asterisk-electricity-trade-us');

    const scrollToRef = makeScrollToIdHandler('fn-asterisk-rf-electricity-trade-us');

    useEffect(() => {
        getElectricityTradeData()
            .then(setResult)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    

    const pageData = useMemo(() => result?.data ?? [], [result]);
    const referenceYear = result?.referenceYear ?? null;
    const referenceRow = result?.referenceRow ?? null;
    const chartStartYear = result?.chartStartYear ?? null;
    const chartEndYear = result?.chartEndYear ?? referenceYear;

    const years = useMemo(() => pageData.map((row) => row.year), [pageData]);
    const exportValues = useMemo(() => pageData.map((row) => row.exports), [pageData]);
    const importValues = useMemo(() => pageData.map((row) => row.imports), [pageData]);
    const netValues = useMemo(() => pageData.map((row) => row.net), [pageData]);

    const yAxisMax = useMemo(() => {
        if (!pageData.length) return 80;
        const peak = Math.max(...pageData.flatMap((row) => [row.exports, row.imports, row.net]));
        return Math.ceil((peak + 5) / 10) * 10;
    }, [pageData]);

    const exportsLabel = getText('electricity_trade_us_legend_exports', lang);
    const importsLabel = getText('electricity_trade_us_legend_imports', lang);
    const netLabel = getText('electricity_trade_us_legend_net', lang);
    const chartTitle = substitute(getText('electricity_trade_us_chart_title', lang), {
        startYear: chartStartYear ?? '',
        endYear: chartEndYear ?? '',
    });
    const exportChartTitle = stripHtml(chartTitle);
    const yearRangeLabel = chartStartYear && chartEndYear ? `${chartStartYear}–${chartEndYear}` : '';
    const fileTitle = yearRangeLabel
        ? `${getText('electricity_trade_us_download_title', lang)} ${yearRangeLabel}`
        : getText('electricity_trade_us_download_title', lang);
    const yAxisTitle = getText('electricity_trade_us_yaxis', lang);
    const pageTitle = substitute(getText('electricity_trade_us_title', lang), { year: referenceYear ?? '' });
    const tableCaption = substitute(getText('electricity_trade_us_table_caption', lang), {
        startYear: chartStartYear ?? '',
        endYear: chartEndYear ?? '',
    });
    const infographicAria = referenceRow
        ? substitute(getText('electricity_trade_us_infographic_aria', lang), {
            year: referenceRow.year,
            exports: formatTwh(referenceRow.exports),
            imports: formatTwh(referenceRow.imports),
        })
        : getText('electricity_trade_us_infographic_aria', lang);
    const exportsInfographicValue = referenceRow
        ? `${formatTwh(referenceRow.exports)} ${getText('electricity_trade_us_twh_unit', lang)}`
        : '';
    const importsInfographicValue = referenceRow
        ? `${formatTwh(referenceRow.imports)} ${getText('electricity_trade_us_twh_unit', lang)}`
        : '';

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('electricity_trade_us_col_year', lang), align: 'left' },
        { key: 'exports', header: `${exportsLabel} (${yAxisTitle})`, align: 'num' },
        { key: 'imports', header: `${importsLabel} (${yAxisTitle})`, align: 'num' },
        { key: 'net', header: `${netLabel} (${yAxisTitle})`, align: 'num' },
    ], [lang, exportsLabel, importsLabel, netLabel, yAxisTitle]);

    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };
    const plotHeight = windowWidth <= 480 ? 360 : windowWidth <= 768 ? 400 : 460;
    const xTickvals = years.filter((y) => y % 2 === 0);

    const traceHasSelection = (traceIndex) => selectedPoints?.[traceIndex]?.length > 0;

    const barOpacityFor = (traceIndex, pointIndex) => {
        if (selectedPoints === null) return 1;
        if (!traceHasSelection(traceIndex)) return 0.3;
        return opacityFor(traceIndex, pointIndex);
    };

    const lineOpacityFor = (pointIndex) => {
        if (selectedPoints === null) return 1;
        if (!traceHasSelection(2)) return 0.3;
        return opacityFor(2, pointIndex);
    };

    const lineColorFor = () => {
        if (selectedPoints === null) return COLORS.net;
        return traceHasSelection(2) ? COLORS.net : hexToRgba(COLORS.net, 0.3);
    };

    const exportsHover = years.map(
        (y, i) => `<b>${exportsLabel}</b><br>${y}: ${formatTwh(exportValues[i])}<extra></extra>`,
    );
    const importsHover = years.map(
        (y, i) => `<b>${importsLabel}</b><br>${y}: ${formatTwh(importValues[i])}<extra></extra>`,
    );
    const netHover = years.map(
        (y, i) => `<b>${netLabel}</b><br>${y}: ${formatTwh(netValues[i])}<extra></extra>`,
    );

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${fileTitle}.png`,
        title: exportChartTitle,
        height: 680,
        legendItems: [
            { label: exportsLabel, color: COLORS.exports },
            { label: importsLabel, color: COLORS.imports },
            { label: netLabel, color: COLORS.net },
        ],
    }),
        [COLORS, exportChartTitle, exportsLabel, fileTitle, importsLabel, netLabel],
    );


    const selectionKey = selectedPoints
        ? selectedPoints.map((arr) => arr.join('-')).join('_')
        : 'all';

    const config = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-65 electricity-trade-us page-chrome page-chrome--bleed"
            aria-labelledby="electricity-trade-us-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.page-65.electricity-trade-us { width: 100%; }
.electricity-trade-us-container { width: 100%; padding: 15px 0 0 0; display: flex; flex-direction: column; box-sizing: border-box; flex: 1; overflow: visible; }
.electricity-trade-us-title { line-height: 1.25; text-transform: none; }
.electricity-trade-us-subtitle { font-family: 'Noto Sans', sans-serif; font-size: 20px; color: #332f30; margin: 0 0 20px 0; line-height: 1.45; white-space: nowrap; }
.electricity-trade-us-subtitle--with-infographic { margin-bottom: -60px; }
.electricity-trade-us-chart-frame { margin-top: 0; }
.electricity-trade-us-chart-title { color: var(--gc-text); margin: 0 0 12px 0; text-transform: none; }
.electricity-trade-us-chart-title .fn-lnk { color: #26374a; }
.electricity-trade-us-chart-scroll { width: 100%; overflow: hidden; }
.electricity-trade-us-chart { width: 100%; min-width: 0; height: ${plotHeight}px; position: relative; z-index: 1; overflow: visible; }
.electricity-trade-us-chart > div { width: 100%; height: 100%; overflow: visible; }
.electricity-trade-us-chart .js-plotly-plot,
.electricity-trade-us-chart .plot-container,
.electricity-trade-us-chart .svg-container { overflow: visible !important; }
.electricity-trade-us-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.electricity-trade-us-chart-frame button:hover { background-color: #404040 !important; }
.electricity-trade-us-loading, .electricity-trade-us-error { font-family: 'Noto Sans', sans-serif; font-size: 18px; color: var(--gc-text); margin: 24px 0; }
.electricity-trade-us-footnotes { font-family: var(--font-body); font-size: 1rem; color: var(--gc-text); margin-top: 24px; margin-bottom: 0; padding-top: 12px; border-top: 1px solid #e0e0e0; line-height: 1.65; max-width: 100%; box-sizing: border-box; }
.electricity-trade-us-footnotes h2 { font-family: var(--font-heading); font-size: 1.4rem; font-weight: 700; color: var(--gc-text); margin-top: 0; margin-bottom: 1rem; }
.electricity-trade-us-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
@media (max-width: 768px) {
    .electricity-trade-us-subtitle { font-size: 18px; white-space: normal; }
    .electricity-trade-us-footnotes { font-size: 0.9rem; }
    .electricity-trade-us-footnotes h2 { font-size: 1.2rem; margin-bottom: 0.75rem; }
}
            `}</style>

            <div className="electricity-trade-us-container">
                <h1 id="electricity-trade-us-title" className="electricity-trade-us-title page-chrome-title">{pageTitle}</h1>
                <p className={`electricity-trade-us-subtitle${!loading && !error && referenceRow ? ' electricity-trade-us-subtitle--with-infographic' : ''}`}>{getText('electricity_trade_us_subtitle', lang)}</p>

                {loading && <p className="electricity-trade-us-loading">{lang === 'en' ? 'Loading data…' : 'Chargement des données…'}</p>}
                {error && <p className="electricity-trade-us-error" role="alert">{error}</p>}
                {!loading && !error && !pageData.length && (
                    <p className="electricity-trade-us-error">{lang === 'en' ? 'No data available.' : 'Aucune donnée disponible.'}</p>
                )}

                {!loading && !error && referenceRow && (
                <ElectricityTradeInfographic
                    lang={lang}
                    getText={getText}
                    ariaLabel={infographicAria}
                    exportsValue={exportsInfographicValue}
                    importsValue={importsInfographicValue}
                />
                )}

                {!loading && !error && pageData.length > 0 && (
                <div className="electricity-trade-us-chart-frame page-chrome-chart-frame">
                    <h2 id="electricity-trade-us-chart-title" className="electricity-trade-us-chart-title page-chrome-chart-title">
                        {chartTitle}
                        <FootnoteMarker
                            lang={lang}
                            href="#fn-asterisk-electricity-trade-us"
                            id="fn-asterisk-rf-electricity-trade-us"
                            marker="*"
                            onClick={scrollToFootnote}
                        />
                    </h2>

                    {hasSelection && <ClearSelectionButton lang={lang} onClick={clear} />}

                    <div className="electricity-trade-us-chart-scroll">
                        <figure ref={chartRef} className="electricity-trade-us-chart" role="region" aria-label={chartTitle} tabIndex="0" style={{ margin: 0 }}>
                            <div aria-hidden="true">
                                <Plot
                                    key={`electricity-trade-us-${selectionKey}-${plotHeight}`}
                                    data={[
                                        {
                                            x: years,
                                            y: exportValues,
                                            type: 'bar',
                                            name: exportsLabel,
                                            marker: {
                                                color: COLORS.exports,
                                                opacity: years.map((_, i) => barOpacityFor(0, i)),
                                            },
                                            hovertemplate: exportsHover,
                                        },
                                        {
                                            x: years,
                                            y: importValues,
                                            type: 'bar',
                                            name: importsLabel,
                                            marker: {
                                                color: COLORS.imports,
                                                opacity: years.map((_, i) => barOpacityFor(1, i)),
                                            },
                                            hovertemplate: importsHover,
                                        },
                                        {
                                            x: years,
                                            y: netValues,
                                            type: 'scatter',
                                            mode: 'lines+markers',
                                            name: netLabel,
                                            line: { color: lineColorFor(), width: 2.5 },
                                            marker: {
                                                color: COLORS.net,
                                                size: 7,
                                                opacity: years.map((_, i) => lineOpacityFor(i)),
                                            },
                                            hovertemplate: netHover,
                                        },
                                    ]}
                                    layout={{
                                        barmode: 'group',
                                        bargap: 0.15,
                                        bargroupgap: 0.08,
                                        hoverlabel: {
                                            bgcolor: '#ffffff',
                                            font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
                                        },
                                        hovermode: 'closest',
                                        clickmode: 'event',
                                        dragmode: false,
                                        showlegend: true,
                                        legend: {
                                            orientation: 'h',
                                            x: 0.5,
                                            xanchor: 'center',
                                            y: -0.18,
                                            yanchor: 'top',
                                            font: { size: 13, family: 'Arial, sans-serif' },
                                        },
                                        xaxis: {
                                            type: 'category',
                                            tickmode: 'array',
                                            tickvals: xTickvals,
                                            ticktext: xTickvals.map(String),
                                            showgrid: false,
                                            showline: true,
                                            linewidth: 1,
                                            linecolor: '#333',
                                            tickfont: tickFont,
                                            automargin: true,
                                        },
                                        yaxis: {
                                            title: {
                                                text: yAxisTitle,
                                                font: axisTitleFont,
                                                standoff: 12,
                                            },
                                            range: [0, yAxisMax],
                                            dtick: 10,
                                            showgrid: true,
                                            gridcolor: '#cccccc',
                                            gridwidth: 1,
                                            zeroline: true,
                                            tickfont: tickFont,
                                            automargin: true,
                                        },
                                        margin: {
                                            l: 70,
                                            r: 20,
                                            t: 20,
                                            b: windowWidth <= 480 ? 90 : 80,
                                        },
                                        paper_bgcolor: 'rgba(0,0,0,0)',
                                        plot_bgcolor: 'rgba(0,0,0,0)',
                                        autosize: true,
                                    }}
                                    config={config}
                                    style={{ width: '100%', height: '100%' }}
                                    useResizeHandler
                                    onClick={handleChartClick}
                                />
                            </div>
                        </figure>
                    </div>

                    <div className="electricity-trade-us-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={pageData}
                            csvFilename={`${fileTitle}.csv`}
                            docx={{
                                filename: `${fileTitle}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [900, 2800, 2800, 2800],
                                fontSize: 20,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatTwh(raw)
                            )}
                        />
                    </div>
                </div>
                )}

                {!loading && !error && pageData.length > 0 && (
                <PageFootnotes
                    lang={lang}
                    className="electricity-trade-us-footnotes"
                    items={[
                        { id: 'fn-asterisk-electricity-trade-us', marker: '*', text: getText('electricity_trade_us_footnote', lang), returnHref: '#fn-asterisk-rf-electricity-trade-us' },
                    ]}
                />
                )}
            </div>
        </PageShell>
    );
};

export default ElectricityTrade;
