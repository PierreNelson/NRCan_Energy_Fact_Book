import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getElectricityGhgSpotlightData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import HtmlLegend from '../components/HtmlLegend';

const TRACE_KEYS = ['coal', 'naturalGas', 'other'];

const COLORS = {
    coal: '#2B5C3F',
    naturalGas: '#5E9348',
    other: '#84962C',
};

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const computeYAxis = (maxTotal) => {
    if (!maxTotal || maxTotal <= 0) {
        return { tickvals: [0, 20, 40, 60, 80, 100, 120, 140], range: [0, 140] };
    }
    const padded = maxTotal * 1.1;
    const step = padded <= 120 ? 20 : 25;
    const axisMax = Math.ceil(padded / step) * step;
    const tickvals = [];
    for (let v = 0; v <= axisMax; v += step) tickvals.push(v);
    return { tickvals, range: [0, axisMax] };
};

const ElectricityGhgSpotlight = () => {
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
    } = usePlotlySelection({ mode: 'points', traceCount: 3, windowWidth });
    const chartRef = useRef(null);

    const markerOpacityFor = (years, traceIndex) => {
        if (selectedPoints === null) return 1;
        return years.map((_, i) => opacityFor(traceIndex, i));
    };

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const formatMt = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const hoverUnit = ' Mt';
    const tableUnitSuffix = getText('ghg_electricity_spotlight_table_unit', lang);

    const formatHoverMt = (value) => {
        const formatted = formatMt(value);
        return formatted === '—' ? formatted : `${formatted}${hoverUnit}`;
    };

    useEffect(() => {
        let cancelled = false;
        getElectricityGhgSpotlightData()
            .then((data) => {
                if (!cancelled) setResult(data);
            })
            .catch((err) => {
                if (!cancelled) setError(err?.message || 'Failed to load data');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const tableRows = useMemo(() => result?.data ?? [], [result]);
    const years = useMemo(() => tableRows.map((row) => row.year), [tableRows]);
    const startYear = result?.startYear;
    const endYear = result?.endYear;
    const baseYear = result?.baseYear;
    const referenceYear = result?.referenceYear;
    const yearTicks = useMemo(() => years.filter((y) => y % 2 === 1), [years]);

    const formatPctDisplay = (value) => {
        const n = Math.abs(Math.round(Number(value)));
        return lang === 'fr' ? `${n} %` : `${n}%`;
    };

    const intro1Bold = result?.totalPctChange != null
        ? (() => {
            const pct = formatPctDisplay(result.totalPctChange);
            if (lang === 'fr') {
                const verb = Number(result.totalPctChange) < 0 ? `diminué de ${pct}` : `augmenté de ${pct}`;
                return verb;
            }
            const verb = Number(result.totalPctChange) < 0 ? `decreased by ${pct}` : `increased by ${pct}`;
            return verb;
        })()
        : getText('ghg_electricity_spotlight_intro1_bold', lang);

    const intro2Bold1 = result?.coalGenSharePct != null
        ? (lang === 'fr'
            ? `${formatPctDisplay(result.coalGenSharePct)} de la production totale d'électricité`
            : `${formatPctDisplay(result.coalGenSharePct)} of generation`)
        : getText('ghg_electricity_spotlight_intro2_bold1', lang);

    const intro2Bold2 = result?.coalGhgSharePct != null
        ? (lang === 'fr' ? formatPctDisplay(result.coalGhgSharePct) : `${formatPctDisplay(result.coalGhgSharePct)} of electricity-related GHG`)
        : getText('ghg_electricity_spotlight_intro2_bold2', lang);

    const textVars = { startYear: startYear ?? '', endYear: endYear ?? '', baseYear: baseYear ?? '', referenceYear: referenceYear ?? '' };
    const intro1Part2 = substitute(getText('ghg_electricity_spotlight_intro1_part2', lang), textVars);
    const intro2Part3 = substitute(getText('ghg_electricity_spotlight_intro2_part3', lang), textVars);

    const coalLabel = getText('ghg_electricity_spotlight_legend_coal', lang);
    const naturalGasLabel = getText('ghg_electricity_spotlight_legend_naturalGas', lang);
    const otherLabel = getText('ghg_electricity_spotlight_legend_other', lang);
    const legendLabels = useMemo(
        () => Object.fromEntries(TRACE_KEYS.map((key) => [key, getText(`ghg_electricity_spotlight_legend_${key}`, lang)])),
        [lang],
    );
    const chartTitle = substitute(getText('ghg_electricity_spotlight_chart_title', lang), textVars);
    const exportChartTitle = stripHtml(chartTitle);
    const yAxisTitle = getText('ghg_electricity_spotlight_yaxis', lang);
    const chartDownloadSlug = `${getText('ghg_electricity_spotlight_download_title', lang)}_${startYear ?? ''}-${endYear ?? ''}`.replace(/\s+/g, '_');
    const tableCaption = substitute(getText('ghg_electricity_spotlight_table_caption', lang), textVars);

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('ghg_electricity_spotlight_table_col_year', lang), align: 'left' },
        { key: 'coal', header: `${coalLabel} ${tableUnitSuffix}`, align: 'num' },
        { key: 'naturalGas', header: `${naturalGasLabel} ${tableUnitSuffix}`, align: 'num' },
        { key: 'other', header: `${otherLabel} ${tableUnitSuffix}`, align: 'num' },
        {
            key: 'total',
            header: `${getText('ghg_electricity_spotlight_table_col_total', lang)} ${tableUnitSuffix}`,
            align: 'num',
        },
    ], [lang, coalLabel, naturalGasLabel, otherLabel, tableUnitSuffix]);

    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 72 : windowWidth <= 768 ? 62 : 50;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    const coalValues = useMemo(() => tableRows.map((row) => row.coal), [tableRows]);
    const naturalGasValues = useMemo(() => tableRows.map((row) => row.naturalGas), [tableRows]);
    const otherValues = useMemo(() => tableRows.map((row) => row.other), [tableRows]);

    const maxTotal = useMemo(
        () => (tableRows.length ? Math.max(...tableRows.map((row) => row.total)) : 0),
        [tableRows],
    );
    const { tickvals: yTickvals, range: yRange } = useMemo(() => computeYAxis(maxTotal), [maxTotal]);

    const coalHoverTexts = years.map(
        (yearValue, i) => `<b>${coalLabel}</b><br>${yearValue}: ${formatHoverMt(coalValues[i])}<extra></extra>`,
    );
    const naturalGasHoverTexts = years.map(
        (yearValue, i) => `<b>${naturalGasLabel}</b><br>${yearValue}: ${formatHoverMt(naturalGasValues[i])}<extra></extra>`,
    );
    const otherHoverTexts = years.map(
        (yearValue, i) => `<b>${otherLabel}</b><br>${yearValue}: ${formatHoverMt(otherValues[i])}<extra></extra>`,
    );

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

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        name: getText('ghg_electricity_spotlight_download_png', lang),
        click: (gd) => downloadChartWithTitle(gd),
    });

    const megatonneWord = lang === 'en' ? 'megatonnes' : 'mégatonnes';
    const formatMtSpoken = (value) => {
        const formatted = formatMt(value);
        if (formatted === '—') return formatted;
        return `${formatted} ${megatonneWord}`;
    };
    const getChartSummary = () => {
        if (!years.length) return '';
        const body = summarizeByCategory({
            categories: years,
            series: [
                { name: coalLabel, values: coalValues, format: formatMtSpoken },
                { name: naturalGasLabel, values: naturalGasValues, format: formatMtSpoken },
                { name: otherLabel, values: otherValues, format: formatMtSpoken },
            ],
            lang,
            newestFirst: true,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Stacked bar chart of electricity GHG emissions from ${startYear ?? years[0]} to ${endYear ?? years[years.length - 1]}`
                : `Graphique à barres empilées des émissions de GES de l'électricité de ${startYear ?? years[0]} à ${endYear ?? years[years.length - 1]}`,
            unitNote: lang === 'en' ? 'Values in megatonnes' : 'Valeurs en mégatonnes',
            body,
            lang,
        });
    };

    const plotData = [
        {
            x: years,
            y: coalValues,
            name: coalLabel,
            type: 'bar',
            marker: {
                color: COLORS.coal,
                opacity: markerOpacityFor(years, 0),
            },
            hovertemplate: coalHoverTexts,
        },
        {
            x: years,
            y: naturalGasValues,
            name: naturalGasLabel,
            type: 'bar',
            marker: {
                color: COLORS.naturalGas,
                opacity: markerOpacityFor(years, 1),
            },
            hovertemplate: naturalGasHoverTexts,
        },
        {
            x: years,
            y: otherValues,
            name: otherLabel,
            type: 'bar',
            marker: {
                color: COLORS.other,
                opacity: markerOpacityFor(years, 2),
            },
            hovertemplate: otherHoverTexts,
        },
    ];

    if (loading) {
        return (
            <PageStatus
                lang={lang}
                loading
                loadingMessage={lang === 'en' ? 'Loading data…' : 'Chargement des données…'}
                className="electricity-ghg-spotlight-loading"
            />
        );
    }
    if (error) {
        return <PageStatus lang={lang} error={error} className="electricity-ghg-spotlight-error" />;
    }
    if (!tableRows.length) {
        return <p className="electricity-ghg-spotlight-error">{lang === 'en' ? 'No data available.' : 'Aucune donnée disponible.'}</p>;
    }

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-71 page-chrome page-chrome--bleed"
            aria-labelledby="electricity-ghg-spotlight-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.page-71 {
}
.electricity-ghg-spotlight-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.electricity-ghg-spotlight-title {
    line-height: 1.25;
    text-transform: none;
}
.electricity-ghg-spotlight-intro {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: #332f30;
    margin: 0 0 16px 0;
    line-height: 1.45;
    max-width: 80ch;
}
.electricity-ghg-spotlight-chart-frame {
    margin-top: 20px;
    margin-bottom: 0;
}
.electricity-ghg-spotlight-chart-title {
    color: var(--gc-text);
    margin: 0 0 12px 0;
    text-transform: none;
}
.electricity-ghg-spotlight-chart { width: 100%; min-width: 0; height: ${plotHeight}px; position: relative; }
.electricity-ghg-spotlight-chart > div { width: 100%; height: 100%; }
.electricity-ghg-spotlight-legend {
    align-items: center;
    gap: 18px 28px;
    margin-top: 12px;
    margin-bottom: 8px;
    font-size: 14px;
    color: var(--gc-text);
}
.electricity-ghg-spotlight-legend-item { white-space: nowrap; }
.electricity-ghg-spotlight-legend-swatch { width: 22px; height: 14px; border: 1px solid rgba(0, 0, 0, 0.12); }
.electricity-ghg-spotlight-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.electricity-ghg-spotlight-loading, .electricity-ghg-spotlight-error {
    font-family: Arial, sans-serif;
    font-size: 16px;
    color: var(--gc-text);
    padding: 24px 0;
}
@media (max-width: 768px) {
    .electricity-ghg-spotlight-intro { font-size: 18px; }
}
            `}</style>

            <div className="electricity-ghg-spotlight-inner">
                <h1 id="electricity-ghg-spotlight-title" className="electricity-ghg-spotlight-title page-chrome-title">{getText('ghg_electricity_spotlight_title', lang)}</h1>

                <p className="electricity-ghg-spotlight-intro">
                    {getText('ghg_electricity_spotlight_intro1_part1', lang)}
                    <strong>{intro1Bold}</strong>
                    {intro1Part2}
                </p>
                <p className="electricity-ghg-spotlight-intro">
                    {getText('ghg_electricity_spotlight_intro2_part1', lang)}
                    <strong>{intro2Bold1}</strong>
                    {getText('ghg_electricity_spotlight_intro2_part2', lang)}
                    <strong>{intro2Bold2}</strong>
                    {intro2Part3}
                    {lang === 'fr' && (
                        <>
                            <strong>{getText('ghg_electricity_spotlight_intro2_bold3', lang)}</strong>
                            {substitute(getText('ghg_electricity_spotlight_intro2_part4', lang), textVars)}
                        </>
                    )}
                </p>

                <div className="electricity-ghg-spotlight-chart-frame page-chrome-chart-frame">
                    <h2 id="electricity-ghg-spotlight-chart-title" className="electricity-ghg-spotlight-chart-title page-chrome-chart-title">{chartTitle}</h2>

                    {selectedPoints !== null && <ClearSelectionButton lang={lang} onClick={clear} />}

                    <figure ref={chartRef} style={{ margin: 0 }}>
                        <div role="region" aria-label={`${exportChartTitle}. ${getChartSummary()}`} tabIndex="0">
                            <div aria-hidden="true">
                            <Plot
                                key={`electricity-ghg-spotlight-${selectedPoints ? selectedPoints.map((t) => t.join('-')).join('_') : 'all'}-${plotHeight}`}
                                data={plotData}
                                layout={{
                                    barmode: 'stack',
                                    showlegend: false,
                                    hoverlabel: {
                                        bgcolor: '#ffffff',
                                        font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
                                    },
                                    hovermode: 'closest',
                                    clickmode: 'event',
                                    dragmode: false,
                                    margin: { t: plotTopMargin, b: plotBottomMargin, l: 60, r: 20 },
                                    paper_bgcolor: 'rgba(0,0,0,0)',
                                    plot_bgcolor: 'rgba(0,0,0,0)',
                                    autosize: true,
                                    height: plotHeight,
                                    bargap: 0.15,
                                    xaxis: {
                                        tickvals: yearTicks,
                                        tickfont: tickFont,
                                        automargin: true,
                                        fixedrange: true,
                                    },
                                    yaxis: {
                                        title: { text: yAxisTitle, font: axisTitleFont, standoff: 12 },
                                        tickvals: yTickvals,
                                        range: yRange,
                                        tickfont: tickFont,
                                        automargin: true,
                                        fixedrange: true,
                                    },
                                }}
                                config={plotConfig}
                                className="electricity-ghg-spotlight-chart"
                                useResizeHandler
                                onClick={handleChartClick}
                            />
                            </div>
                        </div>
                    </figure>

                    <HtmlLegend
                        className="electricity-ghg-spotlight-legend"
                        variant="swatch"
                        itemClassName="electricity-ghg-spotlight-legend-item"
                        markerClassName="electricity-ghg-spotlight-legend-swatch"
                        items={TRACE_KEYS.map((key) => ({
                            label: legendLabels[key],
                            color: COLORS[key],
                        }))}
                    />

                    <div className="electricity-ghg-spotlight-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={`${chartDownloadSlug}.csv`}
                            docx={{
                                filename: `${chartDownloadSlug}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [1200, 1800, 2000, 1600, 1600],
                                fontSize: 22,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatMt(raw)
                            )}
                        />
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default ElectricityGhgSpotlight;
