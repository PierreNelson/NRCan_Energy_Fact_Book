import React, { useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import HtmlLegend from '../components/HtmlLegend';

const START_YEAR = 2000;
const END_YEAR = 2024;

const TRACE_KEYS = [
    'passengerCars',
    'passengerLightTrucks',
    'passengerAviation',
    'freightTrucks',
    'freightAviation',
    'other',
];

const COLORS = {
    passengerCars: '#2B5C3F',
    passengerLightTrucks: '#5E9348',
    passengerAviation: '#84962C',
    freightTrucks: '#657f9b',
    freightAviation: '#4b4c4d',
    other: '#DF790C',
};


const HOVER_LABEL = {
    bgcolor: '#ffffff',
    bordercolor: '#000000',
    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
};

/** Hardcoded until data pipeline is available — approximates GHG spotlight: Transportation reference trends. */
const buildTransportationGhgChartData = () => {
    const rows = [];
    for (let year = START_YEAR; year <= END_YEAR; year += 1) {
        const progress = (year - START_YEAR) / (END_YEAR - START_YEAR);
        let total;
        if (year <= 2019) {
            total = Math.round(141 + ((year - START_YEAR) / 19) * 29);
        } else if (year === 2020) {
            total = 145;
        } else if (year === 2021) {
            total = 148;
        } else if (year === 2022) {
            total = 151;
        } else if (year === 2023) {
            total = 153;
        } else {
            total = 155;
        }

        const passScale = year === 2020 ? 0.84 : year === 2021 ? 0.9 : year >= 2022 ? 0.94 + (year - 2022) * 0.02 : 1;

        const passengerCars = Math.round(total * (0.44 - progress * 0.13) * passScale);
        const passengerLightTrucks = Math.round(total * (0.16 + progress * 0.12) * passScale);
        const passengerAviation = Math.round(total * (0.08 - progress * 0.01) * passScale);
        const freightTrucks = Math.round(total * (0.17 + progress * 0.06));
        const freightAviation = Math.round(total * (0.06 + progress * 0.015));
        let other = total - passengerCars - passengerLightTrucks - passengerAviation - freightTrucks - freightAviation;
        if (other < 3) other = 3;

        rows.push({
            year,
            passengerCars,
            passengerLightTrucks,
            passengerAviation,
            freightTrucks,
            freightAviation,
            other,
            total: passengerCars + passengerLightTrucks + passengerAviation + freightTrucks + freightAviation + other,
        });
    }
    return rows;
};

const ghg_transportation_spotlight_CHART_DATA = buildTransportationGhgChartData();

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const TransportationGhgSpotlight = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const {
        selected: selectedPoints,
        clear,
        onPlotClick: handleChartClick,
        opacityFor,
    } = usePlotlySelection({ mode: 'points', traceCount: TRACE_KEYS.length, windowWidth });

    const chartRef = useRef(null);

    const markerOpacityFor = (length, traceIndex) => {
        if (selectedPoints === null) return 1;
        return Array.from({ length }, (_, i) => opacityFor(traceIndex, i));
    };

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const textVars = { startYear: START_YEAR, endYear: END_YEAR };

    const formatMt = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const hoverUnit = ' Mt';

    const tableRows = ghg_transportation_spotlight_CHART_DATA;
    const years = useMemo(() => tableRows.map((row) => row.year), [tableRows]);
    const yearTicks = useMemo(() => years.filter((y) => y % 2 === 0), [years]);

    const chartTitle = substitute(getText('ghg_transportation_spotlight_chart_title', lang), textVars);
    const exportChartTitle = stripHtml(chartTitle);
    const yAxisTitle = getText('ghg_transportation_spotlight_yaxis', lang);
    const chartDownloadSlug = `${getText('ghg_transportation_spotlight_download_title', lang)}_${START_YEAR}-${END_YEAR}`.replace(/\s+/g, '_');
    const tableCaption = substitute(getText('ghg_transportation_spotlight_table_caption', lang), textVars);
    const tableUnitSuffix = getText('ghg_transportation_spotlight_table_unit', lang);

    const legendLabels = useMemo(
        () => Object.fromEntries(TRACE_KEYS.map((key) => [key, getText(`ghg_transportation_spotlight_legend_${key}`, lang)])),
        [lang],
    );

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('ghg_transportation_spotlight_table_col_year', lang), align: 'left' },
        ...TRACE_KEYS.map((key) => ({
            key,
            header: `${legendLabels[key]} ${tableUnitSuffix}`,
            align: 'num',
        })),
        {
            key: 'total',
            header: `${getText('ghg_transportation_spotlight_table_col_total', lang)} ${tableUnitSuffix}`,
            align: 'num',
        },
    ], [lang, legendLabels, tableUnitSuffix]);

    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 72 : windowWidth <= 768 ? 62 : 50;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    

        const downloadChartWithTitle = useChartPngDownloader(
            chartRef,
            () => ({
            filename: `${chartDownloadSlug}.png`,
            title: exportChartTitle,
            height: 700,
            legendItems: TRACE_KEYS.map((key) => ({
                label: legendLabels[key],
                color: COLORS[key],
            })),
        }),
            [COLORS, TRACE_KEYS, chartDownloadSlug, exportChartTitle, legendLabels],
        );

    const plotData = TRACE_KEYS.map((key, traceIndex) => {
        const label = legendLabels[key];
        const values = tableRows.map((row) => row[key]);
        return {
            x: years,
            y: values,
            name: label,
            type: 'bar',
            marker: {
                color: COLORS[key],
                opacity: markerOpacityFor(values.length, traceIndex),
                line: { width: 0 },
            },
            hovertemplate: values.map(
                (value, i) => `<b>${label}</b><br>${years[i]}: ${formatMt(value)}${hoverUnit}<extra></extra>`,
            ),
            hoverlabel: HOVER_LABEL,
        };
    });

    const getChartSummary = () => {
        if (!years.length) return '';
        const body = summarizeByCategory({
            categories: years,
            series: TRACE_KEYS.map((key) => ({
                name: legendLabels[key],
                values: tableRows.map((row) => row[key]),
                format: formatMt,
            })),
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Stacked bar chart of transportation GHG emissions from ${START_YEAR} to ${END_YEAR}`
                : `Graphique à barres empilées des émissions de GES des transports de ${START_YEAR} à ${END_YEAR}`,
            unitNote: lang === 'en' ? 'Values in Mt' : 'Valeurs en Mt',
            body,
            lang,
        });
    };


    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
        name: getText('ghg_transportation_spotlight_download_png', lang),
    });

    return (
        <PageShell tabIndex="-1"
            className="page-content page-97 page-chrome page-chrome--bleed"
            aria-labelledby="transportation-ghg-spotlight-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.page-97 {
}
.transportation-ghg-spotlight-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.transportation-ghg-spotlight-title {
    line-height: 1.25;
    text-transform: none;
}
.transportation-ghg-spotlight-chart-frame {
    margin-bottom: 0;
}
.transportation-ghg-spotlight-chart-title {
    color: var(--gc-text);
    margin: 0 0 12px 0;
    text-transform: none;
}
.transportation-ghg-spotlight-chart { width: 100%; min-width: 0; height: ${plotHeight}px; position: relative; }
.transportation-ghg-spotlight-chart > div { width: 100%; height: 100%; }
.transportation-ghg-spotlight-legend {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 28px;
    margin: 12px auto 8px;
    font-size: 14px;
    color: var(--gc-text);
}
.transportation-ghg-spotlight-legend-item { align-items: flex-start; line-height: 1.3; }
.transportation-ghg-spotlight-legend-swatch { width: 22px; height: 14px; margin-top: 2px; border: 1px solid rgba(0, 0, 0, 0.12); }
.transportation-ghg-spotlight-bullet {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: #332f30;
    margin: 28px 0 0 0;
    padding-left: 1.25rem;
    line-height: 1.45;
}
.transportation-ghg-spotlight-bullet li { margin: 0; }
.transportation-ghg-spotlight-table-wrapper { display: block; width: 100%; margin-top: 20px; }
@media (max-width: 768px) {
    .transportation-ghg-spotlight-bullet { font-size: 18px; }
    .transportation-ghg-spotlight-legend { grid-template-columns: 1fr; max-width: 100%; }
}
            `}</style>

            <div className="transportation-ghg-spotlight-inner">
                <h1 id="transportation-ghg-spotlight-title" className="transportation-ghg-spotlight-title page-chrome-title">{getText('ghg_transportation_spotlight_title', lang)}</h1>

                <div className="transportation-ghg-spotlight-chart-frame page-chrome-chart-frame">
                    <h2 id="transportation-ghg-spotlight-chart-title" className="transportation-ghg-spotlight-chart-title page-chrome-chart-title">{chartTitle}</h2>

                    {selectedPoints !== null && <ClearSelectionButton lang={lang} onClick={clear} />}

                    <figure ref={chartRef} style={{ margin: 0 }}>
                        <div role="region" aria-label={`${exportChartTitle}. ${getChartSummary()}`} tabIndex="0">
                            <Plot
                                key={`transportation-ghg-spotlight-${selectedPoints ? selectedPoints.map((t) => t.join('-')).join('_') : 'all'}-${plotHeight}`}
                                data={plotData}
                                layout={{
                                    barmode: 'stack',
                                    showlegend: false,
                                    hoverlabel: HOVER_LABEL,
                                    hovermode: 'closest',
                                    clickmode: 'event',
                                    dragmode: false,
                                    margin: { t: plotTopMargin, b: plotBottomMargin, l: 72, r: 20 },
                                    paper_bgcolor: 'rgba(0,0,0,0)',
                                    plot_bgcolor: 'rgba(0,0,0,0)',
                                    autosize: true,
                                    height: plotHeight,
                                    bargap: 0.15,
                                    xaxis: {
                                        type: 'category',
                                        tickmode: 'array',
                                        tickvals: yearTicks,
                                        ticktext: yearTicks.map(String),
                                        tickfont: tickFont,
                                        automargin: true,
                                        fixedrange: true,
                                    },
                                    yaxis: {
                                        title: { text: yAxisTitle, font: axisTitleFont, standoff: 12 },
                                        range: [0, 200],
                                        dtick: 50,
                                        tickfont: tickFont,
                                        automargin: true,
                                        fixedrange: true,
                                    },
                                }}
                                config={plotConfig}
                                className="transportation-ghg-spotlight-chart"
                                useResizeHandler
                                onClick={handleChartClick}
                            />
                        </div>
                    </figure>

                    <HtmlLegend
                        className="transportation-ghg-spotlight-legend"
                        variant="swatch"
                        itemClassName="transportation-ghg-spotlight-legend-item"
                        markerClassName="transportation-ghg-spotlight-legend-swatch"
                        items={TRACE_KEYS.map((key) => ({
                            label: legendLabels[key],
                            color: COLORS[key],
                        }))}
                    />

                    <div className="transportation-ghg-spotlight-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={`${chartDownloadSlug}.csv`}
                            docx={{
                                filename: `${chartDownloadSlug}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [900, 1500, 1800, 2200, 1500, 2000, 1100, 1200],
                                fontSize: 20,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatMt(raw)
                            )}
                        />
                    </div>
                </div>

                <ul className="transportation-ghg-spotlight-bullet" aria-label={getText('ghg_transportation_spotlight_bullet_aria', lang)}>
                    <li>
                        <strong>{getText('ghg_transportation_spotlight_bullet_bold1', lang)}</strong>
                        {getText('ghg_transportation_spotlight_bullet_part1', lang)}
                        <strong>{getText('ghg_transportation_spotlight_bullet_bold2', lang)}</strong>
                        {getText('ghg_transportation_spotlight_bullet_part2', lang)}
                    </li>
                </ul>
            </div>
        </PageShell>
    );
};

export default TransportationGhgSpotlight;
