import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import hexToRgba from '../utils/hexToRgba';

const CHART_START_YEAR = 2020;
const CHART_END_YEAR = 2025;
const CHART_END_MONTH = 10;

const COLORS = { ethanol: '#809276', biodiesel: '#333333' };

const HOVER_LABEL = {
    bgcolor: '#ffffff',
    bordercolor: '#000000',
    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
};

const PAGE_ZOOM_VERTICAL_TICK_MIN = 3.55;
const PAGE_ZOOM_VERTICAL_TICK_MAX = 5.45;
const LIKELY_OS_DPR_BASES = [1, 1.25, 1.3333333333333333, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5];

const isZoomRatioInVerticalTickBands = (z) =>
    z >= PAGE_ZOOM_VERTICAL_TICK_MIN && z <= PAGE_ZOOM_VERTICAL_TICK_MAX;

const isBrowserZoomInVerticalTickRange = () => {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    return LIKELY_OS_DPR_BASES.some((b) => isZoomRatioInVerticalTickBands(dpr / b));
};

const isPinchScaleInVerticalTickBands = (s) =>
    typeof s === 'number' && s > 1.02 && isZoomRatioInVerticalTickBands(s);

const ethanolValue = (year, month) => {
    if (year === 2020 && month === 4) return 85;
    const seasonal = 20 * Math.sin(((month - 2) / 12) * 2 * Math.PI);
    let base = 128 + seasonal;
    if (year === 2020 && month < 4) base = 152 - month * 5;
    if (year === 2020 && month > 4) base = 118 + seasonal;
    const noise = ((year * 13 + month * 7) % 11) - 5;
    return Math.round(Math.max(78, Math.min(168, base + noise)));
};

const biodieselValue = (year, month) => {
    const seasonal = 6 * Math.sin((month / 12) * 2 * Math.PI);
    if (year < 2024) {
        let base = 38 + seasonal;
        if (year === 2022 && month <= 3) base = 22;
        const noise = ((year * 11 + month * 5) % 9) - 4;
        return Math.round(Math.max(20, Math.min(55, base + noise)));
    }
    const monthsFrom2024 = (year - 2024) * 12 + month;
    let base = 48 + monthsFrom2024 * 1.35 + seasonal * 2;
    const spike = month === 6 ? 15 : month === 3 ? 10 : 0;
    if (year === 2025 && month >= 6) base += 20;
    const noise = ((year * 17 + month * 3) % 13) - 6;
    return Math.round(Math.max(35, Math.min(148, base + spike + noise)));
};

const buildChartData = () => {
    const rows = [];
    for (let year = CHART_START_YEAR; year <= CHART_END_YEAR; year += 1) {
        const lastMonth = year === CHART_END_YEAR ? CHART_END_MONTH : 12;
        for (let month = 1; month <= lastMonth; month += 1) {
            rows.push({
                refDate: year * 100 + month,
                dateIso: `${year}-${String(month).padStart(2, '0')}-15`,
                ethanol: ethanolValue(year, month),
                biodiesel: biodieselValue(year, month),
            });
        }
    }
    return rows;
};

const canadian_biofuel_production_CHART_DATA = buildChartData();

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const formatMonthRef = (refDate, lang) => {
    const year = Math.floor(refDate / 100);
    const month = refDate % 100;
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString(lang === 'en' ? 'en-CA' : 'fr-CA', { month: 'long', year: 'numeric' });
};

const formatAxisTick = (dateIso, lang) => {
    const d = new Date(dateIso);
    const yy = String(d.getFullYear()).slice(-2);
    if (lang === 'fr') {
        const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juill.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
        return `${months[d.getMonth()]}-${yy}`;
    }
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]}-${yy}`;
};

const CanadianBiofuelProductionPlot = memo(function CanadianBiofuelProductionPlot({
    plotData, plotLayout, chartConfig, plotKey, onChartClick,
}) {
    return (
        <Plot
            key={plotKey}
            data={plotData}
            layout={plotLayout}
            config={chartConfig}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
            onClick={onChartClick}
        />
    );
});

const CanadianBiofuelProduction = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const {
        selected: selectedTraceIds,
        clear: clearSelection,
        toggleSlice,
    } = usePlotlySelection({ mode: 'slices', windowWidth });
    const [xAxisVerticalForPageZoom, setXAxisVerticalForPageZoom] = useState(false);
    const chartRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const textVars = { startYear: CHART_START_YEAR, endYear: CHART_END_YEAR };

    const ethanolLabel = getText('canadian_biofuel_production_legend_ethanol', lang);
    const biodieselLabel = getText('canadian_biofuel_production_legend_biodiesel', lang);
    const chartTitle = substitute(getText('canadian_biofuel_production_chart_title', lang), textVars);
    const exportChartTitle = stripHtml(chartTitle);
    const yAxisTitle = getText('canadian_biofuel_production_yaxis', lang);
    const fileTitle = substitute(getText('canadian_biofuel_production_download_title', lang), textVars);
    const chartDownloadSlug = fileTitle.replace(/\s+/g, '_');
    const tableCaption = substitute(getText('canadian_biofuel_production_table_caption', lang), textVars);

    const tableColumns = useMemo(() => [
        { key: 'date', header: getText('canadian_biofuel_production_table_col_date', lang), align: 'left' },
        { key: 'ethanol', header: `${ethanolLabel} (${yAxisTitle})`, align: 'num' },
        { key: 'biodiesel', header: `${biodieselLabel} (${yAxisTitle})`, align: 'num' },
    ], [lang, ethanolLabel, biodieselLabel, yAxisTitle]);

    const chartData = canadian_biofuel_production_CHART_DATA;
    const tableRows = useMemo(
        () => [...chartData].reverse().map((row) => ({
            date: formatMonthRef(row.refDate, lang),
            ethanol: row.ethanol,
            biodiesel: row.biodiesel,
        })),
        [chartData, lang],
    );

    const xDates = useMemo(() => chartData.map((row) => row.dateIso), [chartData]);
    const ethanolValues = useMemo(() => chartData.map((row) => row.ethanol), [chartData]);
    const biodieselValues = useMemo(() => chartData.map((row) => row.biodiesel), [chartData]);

    const tickVals = useMemo(() => xDates, [xDates]);
    const tickText = useMemo(
        () => chartData.map((row, index) => {
            const month = row.refDate % 100;
            if (month === 1 || month === 4 || month === 7 || month === 10) {
                return formatAxisTick(xDates[index], lang);
            }
            return '';
        }),
        [chartData, xDates, lang],
    );

    const formatVolume = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const plotHeight = windowWidth <= 480 ? 320 : windowWidth <= 768 ? 360 : 400;
    const plotTopMargin = windowWidth <= 480 ? 20 : 16;
    const plotBottomMarginHorizontal = windowWidth <= 480 ? 88 : windowWidth <= 768 ? 78 : 68;
    const plotBottomMarginVertical = windowWidth <= 480 ? 148 : windowWidth <= 768 ? 128 : 108;
    const useVerticalXTicks = xAxisVerticalForPageZoom || windowWidth <= 480;
    const plotBottomMargin = useVerticalXTicks ? plotBottomMarginVertical : plotBottomMarginHorizontal;
    const plotKey = `canadian-biofuel-production-${plotHeight}-${useVerticalXTicks ? 'v' : 'h'}`;
    const tickFont = { size: windowWidth <= 480 ? 11 : windowWidth <= 768 ? 12 : 13, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 15 : 16, family: 'Arial, sans-serif', color: '#58585a' };

    useEffect(() => {
        const syncViewport = () => {
            const s = window.visualViewport?.scale ?? 1;
            const pinchVertical = isPinchScaleInVerticalTickBands(s);
            setXAxisVerticalForPageZoom(pinchVertical || isBrowserZoomInVerticalTickRange());
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

    




    const handleChartClick = useCallback((event) => {
        if (!event?.points?.length) return;
        const traceIndex = event.points[0].curveNumber;
        if (traceIndex !== 0 && traceIndex !== 1) return;
        toggleSlice(traceIndex);
    }, [toggleSlice]);

    const ethanolFocused = selectedTraceIds === null || selectedTraceIds.includes(0);
    const biodieselFocused = selectedTraceIds === null || selectedTraceIds.includes(1);

    const ethanolHoverTemplates = chartData.map(
        (row) => `<b>${ethanolLabel}</b><br>${formatMonthRef(row.refDate, lang)}: ${formatVolume(row.ethanol)}<extra></extra>`,
    );
    const biodieselHoverTemplates = chartData.map(
        (row) => `<b>${biodieselLabel}</b><br>${formatMonthRef(row.refDate, lang)}: ${formatVolume(row.biodiesel)}<extra></extra>`,
    );

    const plotData = [
        {
            x: xDates,
            y: ethanolValues,
            type: 'scatter',
            mode: 'lines',
            name: ethanolLabel,
            line: {
                color: ethanolFocused ? COLORS.ethanol : hexToRgba(COLORS.ethanol, 0.3),
                width: 2.5,
            },
            hovertemplate: ethanolHoverTemplates,
            hoveron: 'points',
        },
        {
            x: xDates,
            y: biodieselValues,
            type: 'scatter',
            mode: 'lines',
            name: biodieselLabel,
            line: {
                color: biodieselFocused ? COLORS.biodiesel : hexToRgba(COLORS.biodiesel, 0.3),
                width: 2.5,
            },
            hovertemplate: biodieselHoverTemplates,
            hoveron: 'points',
        },
    ];

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${chartDownloadSlug}.png`,
        title: exportChartTitle,
        height: 700,
        legendItems: [
            { label: biodieselLabel, color: COLORS.biodiesel },
            { label: ethanolLabel, color: COLORS.ethanol },
        ],
    }),
        [COLORS, biodieselLabel, chartDownloadSlug, ethanolLabel, exportChartTitle],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        name: getText('canadian_biofuel_production_download_png', lang),
        click: (gd) => downloadChartWithTitle(gd),
    });

    const useStackedLayout = windowWidth <= 1200;

    const getChartSummary = () => {
        const body = summarizeByCategory({
            categories: chartData.map((row) => row.dateLabel || row.date || row.x),
            series: [
                { name: getText('canadian_biofuel_production_legend_ethanol', lang), values: ethanolValues, format: (v) => String(v) },
                { name: getText('canadian_biofuel_production_legend_biodiesel', lang), values: biodieselValues, format: (v) => String(v) },
            ],
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Line chart of Canadian biofuel production from ${CHART_START_YEAR} to ${CHART_END_YEAR}`
                : `Graphique linéaire de la production canadienne de biocarburants de ${CHART_START_YEAR} à ${CHART_END_YEAR}`,
            body,
            lang,
        });
    };
    const chartRegionLabel = `${chartTitle}. ${getChartSummary()}`;

    return (
        <PageShell id="main-content"
            tabIndex="-1"
            className="page-content page-93 page-chrome page-chrome--bleed"
            role="main"
            aria-labelledby="canadian-biofuel-production-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.page-93.page-content { max-width: none !important; overflow-x: visible !important; }
.page-93 {
}
.canadian-biofuel-production-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.canadian-biofuel-production-title {
    margin-bottom: 20px;
    line-height: 1.25;
    text-transform: none;
}
.canadian-biofuel-production-content-row {
    display: flex;
    flex-direction: row;
    width: 100%;
    gap: 32px;
    align-items: flex-start;
}
.canadian-biofuel-production-text-column {
    width: 42%;
    min-width: 260px;
    padding-top: 8px;
    box-sizing: border-box;
}
.canadian-biofuel-production-chart-column {
    width: 58%;
    min-width: 0;
}
.canadian-biofuel-production-bullet {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
    margin-bottom: 16px;
}
.canadian-biofuel-production-bullet-list {
    list-style-type: disc;
    padding-left: 24px;
    margin: 0;
}
.canadian-biofuel-production-chart-title {
    color: var(--gc-text);
    line-height: 1.2;
    margin-bottom: 12px;
    text-transform: none;
}
.canadian-biofuel-production-chart { width: 100%; min-width: 0; height: ${plotHeight}px; position: relative; }
.canadian-biofuel-production-chart > div { width: 100%; height: 100%; }
.canadian-biofuel-production-legend {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 18px 28px;
    flex-wrap: wrap;
    margin-top: 12px;
    margin-bottom: 4px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: var(--gc-text);
}
.canadian-biofuel-production-legend-item { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.canadian-biofuel-production-legend-line { width: 28px; height: 0; border-top: 3px solid; display: inline-block; }
.canadian-biofuel-production-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.canadian-biofuel-production-download-buttons button:hover,
.page-93 .data-table-wrapper summary:hover,
.page-93 .data-table-wrapper button:hover { background-color: #404040 !important; }
.page-93 .data-table-wrapper { padding-top: 5px; margin-top: 20px; width: 100%; box-sizing: border-box; }
.page-93 .data-table-wrapper summary {
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    padding: 10px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    list-style: none;
    box-sizing: border-box;
    width: 100%;
    color: #ffffff;
}
.page-93 .data-table-wrapper summary::-webkit-details-marker { display: none; }
.canadian-biofuel-production-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.canadian-biofuel-production-table-scrollbar > div { height: 20px; }
.layout-stacked.canadian-biofuel-production-content-row { flex-direction: column !important; }
.layout-stacked .canadian-biofuel-production-text-column,
.layout-stacked .canadian-biofuel-production-chart-column { width: 100% !important; min-width: 0 !important; }
.layout-stacked .canadian-biofuel-production-text-column { padding-top: 0; margin-bottom: 24px; }
@media (max-width: 1200px) {
    .canadian-biofuel-production-content-row { flex-direction: column; }
    .canadian-biofuel-production-text-column,
    .canadian-biofuel-production-chart-column { width: 100%; }
    .canadian-biofuel-production-text-column { padding-top: 0; margin-bottom: 24px; }
}
@media (max-width: 768px) {
    .canadian-biofuel-production-bullet { font-size: 18px; }
}
@media (max-width: 480px) {
    .canadian-biofuel-production-title { font-size: 28px; }
}
            `}</style>
            <div className="canadian-biofuel-production-inner">
                <h1 id="canadian-biofuel-production-title" className="canadian-biofuel-production-title page-chrome-title">{getText('canadian_biofuel_production_title', lang)}</h1>

                <div className={`canadian-biofuel-production-content-row ${useStackedLayout ? 'layout-stacked' : ''}`}>
                    <aside className="canadian-biofuel-production-text-column" aria-label={getText('canadian_biofuel_production_text_aria', lang)}>
                        <ul className="canadian-biofuel-production-bullet-list">
                            <li className="canadian-biofuel-production-bullet">
                                {getText('canadian_biofuel_production_bullet1_part1', lang)}
                                <strong>{getText('canadian_biofuel_production_bullet1_part2', lang)}</strong>
                            </li>
                            <li className="canadian-biofuel-production-bullet">
                                {getText('canadian_biofuel_production_bullet2_part1', lang)}
                                <strong>{getText('canadian_biofuel_production_bullet2_part2', lang)}</strong>
                                {getText('canadian_biofuel_production_bullet2_part3', lang)}
                                <strong>{getText('canadian_biofuel_production_bullet2_part4', lang)}</strong>
                                {getText('canadian_biofuel_production_bullet2_part5', lang)}
                            </li>
                            <li className="canadian-biofuel-production-bullet">
                                {getText('canadian_biofuel_production_bullet3_part1', lang)}
                                <strong>{getText('canadian_biofuel_production_bullet3_part2', lang)}</strong>
                                {getText('canadian_biofuel_production_bullet3_part3', lang)}
                            </li>
                            <li className="canadian-biofuel-production-bullet">
                                {getText('canadian_biofuel_production_bullet4_part1', lang)}
                                <strong>{getText('canadian_biofuel_production_bullet4_part2', lang)}</strong>
                                {getText('canadian_biofuel_production_bullet4_part3', lang)}
                            </li>
                        </ul>
                    </aside>

                    <div className="canadian-biofuel-production-chart-column">
                        <div className="canadian-biofuel-production-chart-frame page-chrome-chart-frame">
                            <h2 id="canadian-biofuel-production-chart-title" className="canadian-biofuel-production-chart-title page-chrome-chart-title">{chartTitle}</h2>

                            {selectedTraceIds !== null && (
                                <ClearSelectionButton lang={lang} onClick={clearSelection} />
                            )}

                            <figure
                                ref={chartRef}
                                className="canadian-biofuel-production-chart"
                                role="region"
                                aria-label={chartRegionLabel}
                                tabIndex={0}
                                style={{ margin: 0 }}
                            >
                                <CanadianBiofuelProductionPlot
                                    plotKey={plotKey}
                                    plotData={plotData}
                                    plotLayout={{
                                        showlegend: false,
                                        hovermode: 'closest',
                                        hoverlabel: HOVER_LABEL,
                                        clickmode: 'event',
                                        dragmode: false,
                                        margin: { t: plotTopMargin, b: plotBottomMargin, l: 72, r: 24 },
                                        paper_bgcolor: 'rgba(0,0,0,0)',
                                        plot_bgcolor: 'rgba(0,0,0,0)',
                                        autosize: true,
                                        xaxis: {
                                            type: 'date',
                                            tickmode: 'array',
                                            tickvals: tickVals,
                                            ticktext: tickText,
                                            tickangle: useVerticalXTicks ? 90 : -45,
                                            tickfont: tickFont,
                                            ticks: 'inside',
                                            ticklen: 4,
                                            tickwidth: 1,
                                            tickcolor: '#333333',
                                            showgrid: false,
                                            showline: true,
                                            linewidth: 1,
                                            linecolor: '#333',
                                            automargin: true,
                                            fixedrange: true,
                                        },
                                        yaxis: {
                                            title: { text: yAxisTitle, font: axisTitleFont, standoff: 12 },
                                            range: [0, 180],
                                            dtick: 20,
                                            tickfont: tickFont,
                                            showgrid: false,
                                            showline: true,
                                            linewidth: 1,
                                            linecolor: '#333',
                                            zeroline: false,
                                            automargin: true,
                                            fixedrange: true,
                                        },
                                    }}
                                    chartConfig={plotConfig}
                                    plotHeight={plotHeight}
                                    onChartClick={handleChartClick}
                                />
                            </figure>

                            <div className="canadian-biofuel-production-legend" aria-hidden="true">
                                <span className="canadian-biofuel-production-legend-item">
                                    <span className="canadian-biofuel-production-legend-line" style={{ borderColor: COLORS.biodiesel }} />
                                    {biodieselLabel}
                                </span>
                                <span className="canadian-biofuel-production-legend-item">
                                    <span className="canadian-biofuel-production-legend-line" style={{ borderColor: COLORS.ethanol }} />
                                    {ethanolLabel}
                                </span>
                            </div>

                            <ChartDataTable
                                lang={lang}
                                columns={tableColumns}
                                rows={tableRows}
                                csvFilename={`${chartDownloadSlug}.csv`}
                                docx={{
                                    filename: `${chartDownloadSlug}.docx`,
                                    title: exportChartTitle,
                                    titleAlign: 'center',
                                    columnWidths: [3200, 2800, 3200],
                                    fontSize: 22,
                                }}
                                caption={tableCaption}
                                tableAriaLabel={tableCaption}
                                renderCell={(raw, { colIndex }) => (
                                    colIndex === 0 ? String(raw ?? '') : formatVolume(raw)
                                )}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default CanadianBiofuelProduction;
