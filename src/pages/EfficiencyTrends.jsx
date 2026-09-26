import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
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
import HtmlLegend from '../components/HtmlLegend';
import hexToRgba from '../utils/hexToRgba';

const START_YEAR = 2000;
const END_YEAR = 2022;
const INCLUDING_START = 8000;
const INCLUDING_END = 9200;
const EXCLUDING_START = 8000;
const EXCLUDING_END = 10303;
const SAVINGS_PJ = 1103;

const COLORS = {
    excluding: '#CE8003',
    including: '#4b4c4d',
};

const efficiency_trends_DATA = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => {
    const year = START_YEAR + i;
    const t = i / (END_YEAR - START_YEAR);
    return {
        year,
        including: Math.round(INCLUDING_START + t * (INCLUDING_END - INCLUDING_START)),
        excluding: Math.round(EXCLUDING_START + t * (EXCLUDING_END - EXCLUDING_START)),
    };
});

const EfficiencyTrends = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const {
        selected: selectedPoints,
        clear,
        onPlotClick: handleChartClick,
        opacityFor,
    } = usePlotlySelection({ mode: 'points', traceCount: 2, windowWidth });
    const chartRef = useRef(null);
    const chartMainRef = useRef(null);
    const calloutRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const formatPj = (num) => {
        if (num == null || Number.isNaN(Number(num))) return '—';
        return Math.round(Number(num)).toLocaleString(locale);
    };

    const years = useMemo(() => efficiency_trends_DATA.map((r) => r.year), []);
    const includingValues = useMemo(() => efficiency_trends_DATA.map((r) => r.including), []);
    const excludingValues = useMemo(() => efficiency_trends_DATA.map((r) => r.excluding), []);

    const tableRows = useMemo(
        () => efficiency_trends_DATA.map((r) => ({
            ...r,
            savings: r.excluding - r.including,
        })),
        [],
    );

    const yTickvals = [6000, 7000, 8000, 9000, 10000, 11000];
    const yTicktext = yTickvals.map((v) => Math.round(v).toLocaleString(locale));

    const legendExcluding = getText('efficiency_trends_legend_excluding', lang);
    const legendIncluding = getText('efficiency_trends_legend_including', lang);

    const chartTitle = getText('efficiency_trends_chart_title', lang);
    const exportChartTitle = stripHtml(chartTitle);
    const chartDownloadSlug = getText('efficiency_trends_download_title', lang).replace(/\s+/g, '_');

    const yAxisTitle = getText('efficiency_trends_yaxis', lang);
    const savingsColHeader = getText('efficiency_trends_table_col_savings', lang);

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('petroleum_employment_table_col_year', lang), align: 'left' },
        { key: 'including', header: `${legendIncluding} (PJ)`, align: 'num' },
        { key: 'excluding', header: `${legendExcluding} (PJ)`, align: 'num' },
        { key: 'savings', header: savingsColHeader, align: 'num' },
    ], [lang, legendIncluding, legendExcluding, savingsColHeader]);

    const getChartSummary = () => {
        const body = summarizeByCategory({
            categories: years,
            series: [
                { name: legendIncluding, values: includingValues, format: (v) => `${formatPj(v)} PJ` },
                { name: legendExcluding, values: excludingValues, format: (v) => `${formatPj(v)} PJ` },
            ],
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Line chart of energy use with and without efficiency improvements from ${START_YEAR} to ${END_YEAR}`
                : `Graphique linéaire de la consommation d'énergie avec et sans gains d'efficacité de ${START_YEAR} à ${END_YEAR}`,
            unitNote: lang === 'en' ? 'Values in PJ' : 'Valeurs en PJ',
            body,
        });
    };

    const xTickvals = years.filter((y) => y % 2 === 0);

    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 62 : windowWidth <= 768 ? 56 : 50;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    const traceHasSelection = (traceIndex) => selectedPoints?.[traceIndex]?.length > 0;

    const markerOpacityFor = (traceIndex, pointIndex) => opacityFor(traceIndex, pointIndex);

    const lineColorFor = (traceIndex, baseColor) => {
        if (selectedPoints === null) return baseColor;
        return traceHasSelection(traceIndex) ? baseColor : hexToRgba(baseColor, 0.3);
    };

    const updateCalloutLayout = useCallback(() => {
        const gd = chartRef.current?.querySelector('.js-plotly-plot');
        const main = chartMainRef.current;
        const callout = calloutRef.current;
        if (!gd?._fullLayout || !main || !callout) return;

        const lastIdx = years.length - 1;
        const xax = gd._fullLayout.xaxis;
        const yax = gd._fullLayout.yaxis;
        const xPx = xax.l2p(END_YEAR) + xax._offset;
        const yExcludingPx = yax.l2p(excludingValues[lastIdx]) + yax._offset;
        const yIncludingPx = yax.l2p(includingValues[lastIdx]) + yax._offset;

        const mainRect = main.getBoundingClientRect();
        const gdRect = gd.getBoundingClientRect();
        const relLeft = gdRect.left - mainRect.left + xPx + 6;
        const top = gdRect.top - mainRect.top + Math.min(yExcludingPx, yIncludingPx);
        const height = Math.max(Math.abs(yIncludingPx - yExcludingPx), 20);

        callout.style.top = `${top}px`;
        callout.style.left = `${relLeft}px`;
        callout.style.height = `${height}px`;
        callout.style.visibility = 'visible';
    }, [excludingValues, includingValues, years.length]);

    useEffect(() => {
        const onResize = () => {
            window.requestAnimationFrame(updateCalloutLayout);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [updateCalloutLayout]);

    useEffect(() => {
        window.requestAnimationFrame(updateCalloutLayout);
    }, [plotHeight, selectedPoints, lang, updateCalloutLayout]);

    useEffect(() => {
        const main = chartMainRef.current;
        if (!main) return;
        const observer = new ResizeObserver(() => {
            window.requestAnimationFrame(updateCalloutLayout);
        });
        observer.observe(main);
        return () => observer.disconnect();
    }, [updateCalloutLayout]);

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${chartDownloadSlug}.png`,
        title: exportChartTitle,
        height: 640,
        legendItems: [
            { label: legendExcluding, color: COLORS.excluding },
            { label: legendIncluding, color: COLORS.including },
        ],
    }),
        [COLORS, chartDownloadSlug, exportChartTitle, legendExcluding, legendIncluding],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const excludingHover = years.map(
        (y, i) => `<b>${legendExcluding}</b><br>${y}: ${formatPj(excludingValues[i])} PJ<extra></extra>`,
    );
    const includingHover = years.map(
        (y, i) => `<b>${legendIncluding}</b><br>${y}: ${formatPj(includingValues[i])} PJ<extra></extra>`,
    );

    const savingsLabel = getText('efficiency_trends_savings_label', lang);
    const savingsValue = formatPj(SAVINGS_PJ);

    

    return (
        <PageShell tabIndex="-1"
            className="page-content page-54 efficiency-trends-efficiency-trends page-chrome page-chrome--bleed"
            aria-labelledby="efficiency-trends-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.page-54.efficiency-trends-efficiency-trends {
}
.efficiency-trends-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.efficiency-trends-title {
    font-size: 50px;
    color: #C58516;
    margin: 0 0 10px 0;
    text-transform: none;
}
.page-54.page-content p.efficiency-trends-subtitle {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 15px 0;
    line-height: 1.25;
    text-transform: none;
}
.efficiency-trends-bullets {
    font-family: var(--font-body);
    font-size: 20px;
    color: var(--gc-text);
    line-height: 1.5;
    margin: 0 0 28px 0;
    padding-left: 1.25rem;
    max-width: none;
}
.efficiency-trends-bullets li { margin-bottom: 0.65rem; }
.efficiency-trends-chart-frame {
    margin-top: 8px;
}
.efficiency-trends-chart-title {
    color: var(--gc-text);
    margin: 0 0 12px 0;
    text-transform: none;
}
.efficiency-trends-chart-row {
    width: 100%;
}
.efficiency-trends-chart-main {
    position: relative;
    width: 100%;
    min-width: 0;
}
.efficiency-trends-chart {
    width: 100%;
    min-width: 0;
    height: ${plotHeight}px;
    position: relative;
}
.efficiency-trends-chart > div { width: 100%; height: 100%; }
.efficiency-trends-savings-callout {
    position: absolute;
    display: flex;
    align-items: stretch;
    gap: 6px;
    max-width: 170px;
    pointer-events: none;
    z-index: 2;
    visibility: hidden;
}
.efficiency-trends-savings-bracket {
    flex-shrink: 0;
    width: 18px;
    height: 100%;
    color: #333;
}
.efficiency-trends-savings-bracket path {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
}
.efficiency-trends-savings-text {
    font-family: 'Lato', sans-serif;
    line-height: 1.25;
    display: flex;
    flex-direction: column;
    justify-content: center;
}
.efficiency-trends-savings-label {
    font-size: 15px;
    font-weight: bold;
    color: #333;
    margin: 0 0 4px 0;
}
.efficiency-trends-savings-value {
    font-family: 'Lato', serif;
    font-size: 19px;
    font-weight: bold;
    color: #C58516;
    margin: 0;
}
.efficiency-trends-legend {
    gap: 18px 28px;
    margin-top: 12px;
    font-size: 14px;
    color: var(--gc-text);
}
.efficiency-trends-table-wrapper { display: block; width: 100%; margin-top: 20px; }
@media (max-width: 768px) {
    .page-54.page-content p.efficiency-trends-subtitle { font-size: 37px; }
    .efficiency-trends-bullets { font-size: 18px; }
    .efficiency-trends-savings-callout { max-width: 130px; }
    .efficiency-trends-savings-label { font-size: 13px; }
    .efficiency-trends-savings-value { font-size: 16px; }
    .efficiency-trends-savings-bracket { width: 14px; }
}
@media (max-width: 480px) {
    .efficiency-trends-chart { height: 320px; }
    .efficiency-trends-savings-callout { max-width: 110px; }
}
            `}</style>

            <div className="efficiency-trends-inner">
                <header>
                    <h1 id="efficiency-trends-title" className="efficiency-trends-title page-chrome-title">{getText('efficiency_trends_title', lang)}</h1>
                </header>

                <p className="efficiency-trends-subtitle">{getText('efficiency_trends_subtitle', lang)}</p>

                <ul className="efficiency-trends-bullets">
                    <li>
                        <strong>{getText('efficiency_trends_bullet1_bold', lang)}</strong>
                        {getText('efficiency_trends_bullet1_text', lang)}
                    </li>
                    <li>
                        <strong>{getText('efficiency_trends_bullet2_bold', lang)}</strong>
                        {getText('efficiency_trends_bullet2_text', lang)}
                    </li>
                    <li>
                        <strong>{getText('efficiency_trends_bullet3_bold', lang)}</strong>
                        {getText('efficiency_trends_bullet3_text', lang)}
                    </li>
                    <li>
                        <strong>{getText('efficiency_trends_bullet4_bold1', lang)}</strong>
                        {getText('efficiency_trends_bullet4_text', lang)}
                        <strong>{getText('efficiency_trends_bullet4_bold2', lang)}</strong>
                        {getText('efficiency_trends_bullet4_suffix', lang)}
                    </li>
                    <li>
                        <strong>{getText('efficiency_trends_bullet5_bold1', lang)}</strong>
                        {getText('efficiency_trends_bullet5_text', lang)}
                        <strong>{getText('efficiency_trends_bullet5_bold2', lang)}</strong>
                        {getText('efficiency_trends_bullet5_suffix', lang)}
                    </li>
                    <li>
                        <strong>{getText('efficiency_trends_bullet6_bold1', lang)}</strong>
                        {getText('efficiency_trends_bullet6_text1', lang)}
                        <strong>{getText('efficiency_trends_bullet6_bold2', lang)}</strong>
                        {getText('efficiency_trends_bullet6_text2', lang)}
                        <strong>{getText('efficiency_trends_bullet6_bold3', lang)}</strong>
                        {getText('efficiency_trends_bullet6_suffix', lang)}
                    </li>
                </ul>

                <div className="efficiency-trends-chart-frame page-chrome-chart-frame">
                    <h2 className="efficiency-trends-chart-title page-chrome-chart-title">{chartTitle}</h2>

                    {selectedPoints !== null && <ClearSelectionButton lang={lang} onClick={clear} />}

                    <div className="efficiency-trends-chart-row">
                        <div className="efficiency-trends-chart-main" ref={chartMainRef}>
                            <figure ref={chartRef} style={{ margin: 0 }}>
                                <div
                                    role="region"
                                    aria-label={`${exportChartTitle}. ${getChartSummary()}`}
                                    tabIndex="0"
                                >
                                    <Plot
                                        key={`efficiency-trends-${selectedPoints ? `${selectedPoints[0].join('-')}_${selectedPoints[1].join('-')}` : 'all'}-${plotHeight}`}
                                        data={[
                                            {
                                                x: years,
                                                y: excludingValues,
                                                type: 'scatter',
                                                mode: 'lines+markers',
                                                name: legendExcluding,
                                                line: {
                                                    color: lineColorFor(0, COLORS.excluding),
                                                    width: 2.5,
                                                },
                                                marker: {
                                                    color: COLORS.excluding,
                                                    size: 8,
                                                    opacity: years.map((_, i) => markerOpacityFor(0, i)),
                                                },
                                                hovertemplate: excludingHover,
                                            },
                                            {
                                                x: years,
                                                y: includingValues,
                                                type: 'scatter',
                                                mode: 'lines+markers',
                                                name: legendIncluding,
                                                line: {
                                                    color: lineColorFor(1, COLORS.including),
                                                    width: 2.5,
                                                },
                                                marker: {
                                                    color: COLORS.including,
                                                    size: 8,
                                                    opacity: years.map((_, i) => markerOpacityFor(1, i)),
                                                },
                                                hovertemplate: includingHover,
                                            },
                                        ]}
                                        layout={{
                                            showlegend: false,
                                            clickmode: 'event',
                                            dragmode: false,
                                            hovermode: 'closest',
                                            hoverlabel: {
                                                bgcolor: '#ffffff',
                                                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
                                            },
                                            margin: { l: 72, r: 130, t: plotTopMargin, b: plotBottomMargin },
                                            paper_bgcolor: 'rgba(0,0,0,0)',
                                            plot_bgcolor: 'rgba(0,0,0,0)',
                                            height: plotHeight,
                                            autosize: true,
                                            xaxis: {
                                                type: 'linear',
                                                tickmode: 'array',
                                                tickvals: xTickvals,
                                                ticktext: xTickvals.map(String),
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                tickfont: tickFont,
                                                automargin: true,
                                            },
                                            yaxis: {
                                                title: { text: yAxisTitle, font: axisTitleFont, standoff: 12 },
                                                range: [6000, 11000],
                                                tickmode: 'array',
                                                tickvals: yTickvals,
                                                ticktext: yTicktext,
                                                showgrid: true,
                                                gridcolor: '#e0e0e0',
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                zeroline: false,
                                                tickfont: tickFont,
                                                automargin: true,
                                                separatethousands: true,
                                            },
                                        }}
                                        config={plotConfig}
                                        className="efficiency-trends-chart"
                                        useResizeHandler
                                        onClick={handleChartClick}
                                        onInitialized={updateCalloutLayout}
                                    />
                                </div>
                            </figure>

                            <aside
                                ref={calloutRef}
                                className="efficiency-trends-savings-callout"
                                aria-label={`${savingsLabel} ${savingsValue} PJ`}
                            >
                                <svg className="efficiency-trends-savings-bracket" viewBox="0 0 18 100" preserveAspectRatio="none" aria-hidden="true">
                                    <path d="M 2 0 C 16 25, 16 75, 2 100" />
                                </svg>
                                <div className="efficiency-trends-savings-text">
                                    <p className="efficiency-trends-savings-label">{savingsLabel}</p>
                                    <p className="efficiency-trends-savings-value">{savingsValue} PJ</p>
                                </div>
                            </aside>
                        </div>
                    </div>

                    <HtmlLegend
                        className="efficiency-trends-legend"
                        variant="line"
                        itemClassName="efficiency-trends-legend-item"
                        markerClassName="efficiency-trends-legend-line"
                        items={[
                            { label: legendExcluding, color: COLORS.excluding },
                            { label: legendIncluding, color: COLORS.including },
                        ]}
                    />

                    <div className="efficiency-trends-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={`${chartDownloadSlug}.csv`}
                            docx={{
                                filename: `${chartDownloadSlug}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [900, 2800, 2800, 1600],
                                fontSize: 20,
                            }}
                            caption={getText('efficiency_trends_table_caption', lang)}
                            tableAriaLabel={getText('efficiency_trends_table_caption', lang)}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatPj(raw)
                            )}
                        />
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default EfficiencyTrends;
