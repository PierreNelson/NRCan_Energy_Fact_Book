import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { getWesternCanadaGasWellCompletionsData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';

const BAR_COLOR = '#4a8eb8';
const LINE_COLOR = '#e07020';

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const WesternCanadaGasWellCompletions = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [chartData, setChartData] = useState([]);
    const [startYear, setStartYear] = useState(2000);
    const [endYear, setEndYear] = useState(2000);

    useEffect(() => {
        let cancelled = false;
        getWesternCanadaGasWellCompletionsData()
            .then((result) => {
                if (cancelled || !result) return;
                setChartData(result.rows);
                setStartYear(result.startYear);
                setEndYear(result.endYear);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, []);
    const windowWidth = useWindowWidth();
    const {
        selected: selectedPoints,
        clear,
        onPlotClick,
        opacityFor,
    } = usePlotlySelection({ mode: 'points', traceCount: 2, windowWidth });
    const chartRef = useRef(null);

    const formatInt = (n) =>
        n == null || Number.isNaN(n)
            ? '\u2014'
            : Math.round(n).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');

    const years = useMemo(() => chartData.map((d) => d.year), [chartData]);
    const counts = useMemo(() => chartData.map((d) => d.count), [chartData]);
    const depths = useMemo(() => chartData.map((d) => d.depth), [chartData]);
    const textVars = { startYear, endYear };
    const yearRangeSuffix = startYear === endYear ? ` (${startYear})` : ` (${startYear}-${endYear})`;

    const legendBars = getText('western_canada_gas_well_completions_legend_bars', lang);
    const legendLine = getText('western_canada_gas_well_completions_legend_line', lang);
    const yCount = getText('western_canada_gas_well_completions_yaxis_count', lang);
    const yDepth = getText('western_canada_gas_well_completions_yaxis_depth', lang);

    const chartTitle = getText('western_canada_gas_well_completions_title', lang);
    const exportChartTitle = `${stripHtml(chartTitle)}${yearRangeSuffix}`;
    const chartDownloadSlug =
        lang === 'en'
            ? `western_canada_natural_gas_wells_${startYear}-${endYear}`
            : `puits_gaz_naturel_ouest_canada_${startYear}-${endYear}`;

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('petroleum_employment_table_col_year', lang), align: 'left' },
        { key: 'count', header: getText('western_canada_gas_well_completions_table_col_count', lang), align: 'num' },
        { key: 'depth', header: getText('western_canada_gas_well_completions_table_col_depth', lang), align: 'num' },
    ], [lang]);

    const getChartSummary = () => {
        const body = summarizeByCategory({
            categories: years,
            series: [
                { name: legendBars, values: counts, format: formatInt },
                { name: legendLine, values: depths, format: (v) => `${formatInt(v)} m` },
            ],
            lang,
            newestFirst: true,
        });
        return joinChartSummary({
            intro: substitute(getText('western_canada_gas_well_completions_chart_aria', lang), textVars),
            unitNote: lang === 'en' ? 'Well counts as integers; depth in metres' : 'Nombre de puits en entiers; profondeur en mètres',
            body,
            lang,
        });
    };

    const finiteDepths = depths.filter((value) => Number.isFinite(value));
    const maxDepth = finiteDepths.length ? Math.max(...finiteDepths) : 3000;
    const yDepthMax = Math.ceil(maxDepth / 500) * 500 || 3000;

    const plotBottomMargin = windowWidth <= 480 ? 100 : windowWidth <= 768 ? 88 : 72;
    const plotTopMargin = windowWidth <= 480 ? 56 : 48;
    const chartHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 440;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = {
        size: windowWidth <= 768 ? 18 : 22,
        family: 'Arial, sans-serif',
        color: '#58585a'
    };

        const downloadChartWithTitle = useChartPngDownloader(
            chartRef,
            () => ({
            filename: `${chartDownloadSlug}.png`,
            title: exportChartTitle,
            height: 700,
            legendItems: [
                { label: legendBars, color: BAR_COLOR },
                { label: legendLine, color: LINE_COLOR },
            ],
        }),
            [BAR_COLOR, LINE_COLOR, chartDownloadSlug, exportChartTitle, legendBars, legendLine],
        );

    const countHoverTemplates = years.map(
        (yr, i) => `<b>${legendBars}</b><br>${yr}: ${formatInt(counts[i])}<extra></extra>`
    );
    const depthHoverTemplates = years.map(
        (yr, i) => `<b>${legendLine}</b><br>${yr}: ${formatInt(depths[i])} m<extra></extra>`
    );

    const barMarkerOpacity =
        selectedPoints === null
            ? 1
            : years.map((_, i) => opacityFor(0, i));
    const lineMarkerOpacity =
        selectedPoints === null
            ? 1
            : years.map((_, i) => opacityFor(1, i));
    const lineStrokeOpacity =
        selectedPoints === null || (selectedPoints[1] && selectedPoints[1].length > 0) ? 1 : 0.3;

    


    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    return (
        <PageShell tabIndex="-1"
            className="page-content page-126 page-chrome page-chrome--bleed"
            aria-labelledby="western-canada-gas-well-completions-chart-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
                .page-126.page-content {
                    max-width: none !important;
                    overflow-x: visible !important;
                }
                .page-126 {
                }
                .western-canada-gas-well-completions-container {
                    width: 100%;
                    padding: 15px 0 40px 0;
                    box-sizing: border-box;
                }
                .western-canada-gas-well-completions-chart-frame {
                    margin-bottom: 24px;
                }
                .western-canada-gas-well-completions-chart-title {
                    color: var(--gc-text);
                    margin: 0 0 12px 0;
                }
                .western-canada-gas-well-completions-chart-block {
                    display: flex;
                    flex-direction: column;
                    align-items: stretch;
                    width: 100%;
                }
                .western-canada-gas-well-completions-chart {
                    width: 100%;
                    position: relative;
                    min-height: 0;
                    flex-shrink: 0;
                }
                .western-canada-gas-well-completions-legend {
                    display: flex;
                    justify-content: center;
                    margin-top: 20px;
                    margin-bottom: 20px;
                    font-family: 'Noto Sans', sans-serif;
                    padding: 10px 20px;
                }
                .western-canada-gas-well-completions-legend-inner {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 15px 40px;
                    justify-content: center;
                }
                .western-canada-gas-well-completions-legend-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .western-canada-gas-well-completions-legend-swatch-bar {
                    width: 22px;
                    height: 14px;
                    flex-shrink: 0;
                    background-color: ${BAR_COLOR};
                }
                .western-canada-gas-well-completions-legend-line {
                    width: 28px;
                    height: 0;
                    border-top: 3px solid ${LINE_COLOR};
                    position: relative;
                    flex-shrink: 0;
                }
                .western-canada-gas-well-completions-legend-line::after {
                    content: '';
                    position: absolute;
                    width: 8px;
                    height: 8px;
                    background: ${LINE_COLOR};
                    left: 10px;
                    top: -5px;
                }
                .western-canada-gas-well-completions-legend-label {
                    font-size: 18px;
                    color: var(--gc-text);
                }
                .western-canada-gas-well-completions-narrative {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    line-height: 1.6;
                    color: var(--gc-text);
                    margin: 4px 0 0 0;
                }
                .western-canada-gas-well-completions-table-wrapper {
                    display: block;
                    width: 100%;
                    margin-top: 20px;
                    margin-bottom: 0;
                }
                @media (max-width: 768px) {
                    .western-canada-gas-well-completions-legend { flex-wrap: wrap; gap: 20px; }
                    .western-canada-gas-well-completions-legend-label { font-size: 16px; }
                }
                @media (max-width: 480px) {
                    .western-canada-gas-well-completions-legend-label { font-size: 14px; }
                }
            `}</style>

            <div className="western-canada-gas-well-completions-container">
                <div className="western-canada-gas-well-completions-chart-frame page-chrome-chart-frame">
                    <h2 id="western-canada-gas-well-completions-chart-title" className="western-canada-gas-well-completions-chart-title page-chrome-chart-title">
                        {chartTitle}
                    </h2>

                    <div className="western-canada-gas-well-completions-chart-block">
                        <div role="region" aria-label={`${exportChartTitle}. ${getChartSummary()}`} tabIndex="0">
                            {selectedPoints !== null && <ClearSelectionButton lang={lang} onClick={clear} />}
                            <figure ref={chartRef} className="western-canada-gas-well-completions-chart" style={{ margin: 0 }}>
                                <div aria-hidden="true">
                                    <Plot
                                        data={[
                                            {
                                                name: legendBars,
                                                x: years,
                                                y: counts,
                                                type: 'bar',
                                                marker: { color: BAR_COLOR, opacity: barMarkerOpacity },
                                                hovertemplate: countHoverTemplates
                                            },
                                            {
                                                name: legendLine,
                                                x: years,
                                                y: depths,
                                                type: 'scatter',
                                                mode: 'lines+markers',
                                                line: {
                                                    color: LINE_COLOR,
                                                    width: 3,
                                                    opacity: lineStrokeOpacity
                                                },
                                                marker: { color: LINE_COLOR, size: 6, opacity: lineMarkerOpacity },
                                                yaxis: 'y2',
                                                hovertemplate: depthHoverTemplates
                                            }
                                        ]}
                                        layout={{
                                            autosize: true,
                                            hoverlabel: {
                                                bgcolor: '#ffffff',
                                                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' }
                                            },
                                            hovermode: 'closest',
                                            clickmode: 'event',
                                            dragmode: false,
                                            bargap: 0.2,
                                            margin: {
                                                l: windowWidth <= 480 ? 52 : 64,
                                                r: windowWidth <= 480 ? 52 : 64,
                                                t: plotTopMargin,
                                                b: plotBottomMargin
                                            },
                                            paper_bgcolor: 'rgba(0,0,0,0)',
                                            plot_bgcolor: 'rgba(0,0,0,0)',
                                            showlegend: false,
                                            xaxis: {
                                                title: {
                                                    text: getText('petroleum_employment_table_col_year', lang),
                                                    font: axisTitleFont,
                                                    standoff: 8
                                                },
                                                tickmode: 'linear',
                                                dtick: 2,
                                                tickfont: tickFont,
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                range: [1999, 2025],
                                                automargin: true
                                            },
                                            yaxis: {
                                                title: { text: yCount, font: axisTitleFont, standoff: 8 },
                                                range: [0, 18000],
                                                tick0: 0,
                                                dtick: 2000,
                                                tickfont: tickFont,
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                side: 'left',
                                                automargin: true
                                            },
                                            yaxis2: {
                                                title: { text: yDepth, font: axisTitleFont, standoff: 8 },
                                                range: [0, yDepthMax * 1.1],
                                                tick0: 0,
                                                dtick: 500,
                                                tickfont: tickFont,
                                                overlaying: 'y',
                                                side: 'right',
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                automargin: true
                                            }
                                        }}
                                        config={plotConfig}
                                        style={{ width: '100%', height: `${chartHeight}px` }}
                                        useResizeHandler
                                        onClick={onPlotClick}
                                    />
                                </div>
                            </figure>
                        </div>

                        <div className="western-canada-gas-well-completions-legend" aria-hidden="true">
                            <div className="western-canada-gas-well-completions-legend-inner">
                                <div className="western-canada-gas-well-completions-legend-item">
                                    <span className="western-canada-gas-well-completions-legend-swatch-bar" />
                                    <span className="western-canada-gas-well-completions-legend-label">{legendBars}</span>
                                </div>
                                <div className="western-canada-gas-well-completions-legend-item">
                                    <span className="western-canada-gas-well-completions-legend-line" />
                                    <span className="western-canada-gas-well-completions-legend-label">{legendLine}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <p className="western-canada-gas-well-completions-narrative">
                        {getText('western_canada_gas_well_completions_footnote', lang)}
                    </p>

                    <div className="western-canada-gas-well-completions-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={chartData}
                            csvFilename={`${chartDownloadSlug}.csv`}
                            docx={{
                                filename: `${chartDownloadSlug}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [2000, 3200, 3200],
                                fontSize: 22,
                            }}
                            caption={substitute(getText('western_canada_gas_well_completions_table_caption', lang), textVars)}
                            tableAriaLabel={substitute(getText('western_canada_gas_well_completions_table_caption', lang), textVars)}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatInt(raw)
                            )}
                        />
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default WesternCanadaGasWellCompletions;
