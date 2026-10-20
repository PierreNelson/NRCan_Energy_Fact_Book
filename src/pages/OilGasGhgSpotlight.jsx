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
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import HtmlLegend from '../components/HtmlLegend';
import { getOilGasGhgSpotlightData, getGhgNarrativeStats } from '../utils/dataLoader';

const TRACE_COUNT = 4;
const COLORS = ['#5c4033', '#6097b6', '#DF793A', '#1e3a5f'];

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const oilSandsPhraseKey = (ratio) => {
    if (ratio >= 4.5) return 'ghg_oilgas_spotlight_sands_more_than_quadrupled';
    if (ratio >= 4) return 'ghg_oilgas_spotlight_sands_quadrupled';
    if (ratio >= 3.5) return 'ghg_oilgas_spotlight_sands_nearly_quadrupled';
    if (ratio >= 2.75) return 'ghg_oilgas_spotlight_sands_tripled';
    if (ratio >= 2.25) return 'ghg_oilgas_spotlight_sands_more_than_doubled';
    if (ratio >= 1.75) return 'ghg_oilgas_spotlight_sands_doubled';
    return null;
};

const OilGasGhgSpotlight = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const [chartRows, setChartRows] = useState([]);
    const [narrativeStats, setNarrativeStats] = useState(null);
    const [loadError, setLoadError] = useState(false);
    const {
        selected: selectedPoints,
        clear,
        onPlotClick,
        opacityFor,
    } = usePlotlySelection({ mode: 'points', traceCount: TRACE_COUNT, windowWidth });
    const chartRef = useRef(null);

    const formatMtLocale = (num) => {
        if (num === undefined || num === null || Number.isNaN(Number(num))) return '\u2014';
        const v = Math.round(Number(num) * 10) / 10;
        return v.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    };

    const stats = narrativeStats ?? {
        baseYear: 2000,
        endYear: 2023,
        oilGasSpotlightTotalPct: null,
        oilSandsRatio: null,
        convGasPct: null,
    };

    const formatPctDisplay = (value) => {
        const n = Math.abs(Math.round(Number(value)));
        return lang === 'fr' ? `${n} %` : `${n}%`;
    };

    const years = useMemo(() => chartRows.map((r) => Number(r.year)), [chartRows]);
    const startYear = years[0] ?? stats.baseYear;
    const endYear = years[years.length - 1] ?? stats.endYear;
    const yearVars = { startYear, endYear };

    const para1Highlight = stats.oilGasSpotlightTotalPct != null
        ? (() => {
            const n = formatPctDisplay(stats.oilGasSpotlightTotalPct);
            if (lang === 'fr') {
                const verb = Number(stats.oilGasSpotlightTotalPct) < 0 ? `ont diminué de ${n}` : `ont augmenté de ${n}`;
                return `${verb} entre ${startYear} et ${endYear}`;
            }
            const verb = Number(stats.oilGasSpotlightTotalPct) < 0 ? `gone down ${n}` : `gone up ${n}`;
            return `have ${verb} between ${startYear} and ${endYear}`;
        })()
        : getText('ghg_oilgas_spotlight_para1b', lang);

    const para2HighlightSand = stats.oilSandsRatio != null
        ? (() => {
            const r = Number(stats.oilSandsRatio);
            if (!Number.isFinite(r)) return getText('ghg_oilgas_spotlight_para2b', lang);
            const phraseKey = oilSandsPhraseKey(r);
            if (phraseKey) return getText(phraseKey, lang);
            const pct = Math.round((r - 1) * 100);
            return lang === 'fr' ? `ont augmenté de ${formatPctDisplay(pct)}` : `increased ${formatPctDisplay(pct)}`;
        })()
        : getText('ghg_oilgas_spotlight_para2b', lang);

    const para2HighlightConvGas = stats.convGasPct != null
        ? (() => {
            const n = formatPctDisplay(stats.convGasPct);
            if (lang === 'fr') {
                return Number(stats.convGasPct) < 0 ? `ont diminué de ${n}` : `ont augmenté de ${n}`;
            }
            return Number(stats.convGasPct) < 0 ? `decreased by ${n}` : `increased by ${n}`;
        })()
        : getText('ghg_oilgas_spotlight_para2d', lang);

    const para1Text = `${getText('ghg_oilgas_spotlight_para1a', lang)}${para1Highlight}${getText('ghg_oilgas_spotlight_para1c', lang)}`;
    const para2Text = `${getText('ghg_oilgas_spotlight_para2a', lang)}${para2HighlightSand}${getText('ghg_oilgas_spotlight_para2c', lang)}${para2HighlightConvGas}${getText('ghg_oilgas_spotlight_para2e', lang)}`;

    const oilSands = useMemo(() => chartRows.map((r) => r.oil_sands), [chartRows]);
    const naturalGas = useMemo(() => chartRows.map((r) => r.natural_gas), [chartRows]);
    const conventionalOil = useMemo(() => chartRows.map((r) => r.conventional_oil), [chartRows]);
    const other = useMemo(() => chartRows.map((r) => r.other), [chartRows]);

    const legendOilSands = getText('ghg_oilgas_spotlight_legend_oil_sands', lang);
    const legendNaturalGas = getText('ghg_oilgas_spotlight_legend_natural_gas', lang);
    const legendConventional = getText('ghg_oilgas_spotlight_legend_conventional', lang);
    const legendOther = getText('ghg_oilgas_spotlight_legend_other', lang);
    const legendLabels = [legendOilSands, legendNaturalGas, legendConventional, legendOther];

    const chartTitle = substitute(getText('ghg_oilgas_spotlight_chart_title', lang), yearVars);
    const exportChartTitle = stripHtml(chartTitle);
    const quantityHdrSuffix = getText('ghg_oilgas_spotlight_table_hdr_quantity_suffix', lang);

    const fileSlugBase =
        lang === 'en'
            ? `oil_gas_sector_ghg_emissions_canada_${startYear}-${endYear}`
            : `emissions_ges_petrole_gaz_canada_${startYear}-${endYear}`;

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('petroleum_employment_table_col_year', lang), align: 'left' },
        { key: 'oil_sands', header: `${legendOilSands}${quantityHdrSuffix}`, align: 'num' },
        { key: 'natural_gas', header: `${legendNaturalGas}${quantityHdrSuffix}`, align: 'num' },
        { key: 'conventional_oil', header: `${legendConventional}${quantityHdrSuffix}`, align: 'num' },
        { key: 'other', header: `${legendOther}${quantityHdrSuffix}`, align: 'num' },
        {
            key: 'total',
            header: `${getText('ghg_oilgas_spotlight_table_col_total', lang)}${quantityHdrSuffix}`,
            align: 'num',
        },
    ], [lang, legendOilSands, legendNaturalGas, legendConventional, legendOther, quantityHdrSuffix]);

    const tableRows = useMemo(
        () =>
            chartRows.map((r) => ({
                ...r,
                total:
                    Number(r.oil_sands) +
                    Number(r.natural_gas) +
                    Number(r.conventional_oil) +
                    Number(r.other),
            })),
        [chartRows],
    );

    const plotBottomMargin = windowWidth <= 480 ? 88 : windowWidth <= 768 ? 76 : 64;
    const plotTopMargin = windowWidth <= 480 ? 56 : 48;
    const chartHeight = windowWidth <= 480 ? 320 : windowWidth <= 768 ? 360 : 400;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = {
        size: windowWidth <= 768 ? 18 : 22,
        family: 'Arial, sans-serif',
        color: '#58585a'
    };

    const xTickvals = [];
    if (years.length) {
        for (let y = startYear; y <= endYear; y += 2) xTickvals.push(y);
        if (xTickvals[xTickvals.length - 1] !== endYear) xTickvals.push(endYear);
    }
    const stackedMax = years.reduce(
        (max, _, index) => Math.max(
            max,
            Number(oilSands[index] || 0)
                + Number(naturalGas[index] || 0)
                + Number(conventionalOil[index] || 0)
                + Number(other[index] || 0),
        ),
        0,
    );
    const yMax = Math.max(50, Math.ceil((stackedMax * 1.1) / 50) * 50);

    const getChartSummary = () => {
        const body = summarizeByCategory({
            categories: years,
            series: [
                { name: legendOilSands, values: oilSands, format: formatMtLocale },
                { name: legendNaturalGas, values: naturalGas, format: formatMtLocale },
                { name: legendConventional, values: conventionalOil, format: formatMtLocale },
                { name: legendOther, values: other, format: formatMtLocale },
            ],
            lang,
            newestFirst: true,
        });
        return joinChartSummary({
            intro: exportChartTitle,
            unitNote: lang === 'en' ? 'Values in Mt' : 'Valeurs en Mt',
            body,
            lang,
        });
    };

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${fileSlugBase}.png`,
        title: exportChartTitle,
        height: 640,
        legendItems: legendLabels.map((label, idx) => ({ label, color: COLORS[idx] })),
    }),
        [COLORS, exportChartTitle, fileSlugBase, legendLabels],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const barOpacityFor = (traceIdx) => {
        if (selectedPoints === null) return 1;
        return years.map((_, i) => opacityFor(traceIdx, i));
    };

    const plotData =
        years.length === 0
            ? []
            : [
                  {
                      x: years,
                      y: oilSands,
                      type: 'bar',
                      name: legendOilSands,
                      marker: { color: COLORS[0], opacity: barOpacityFor(0) },
                      hovertemplate: years.map(
                          (y, i) =>
                              `<b>${legendOilSands}</b><br>${y}: ${formatMtLocale(oilSands[i])} Mt<extra></extra>`
                      )
                  },
                  {
                      x: years,
                      y: naturalGas,
                      type: 'bar',
                      name: legendNaturalGas,
                      marker: { color: COLORS[1], opacity: barOpacityFor(1) },
                      hovertemplate: years.map(
                          (y, i) =>
                              `<b>${legendNaturalGas}</b><br>${y}: ${formatMtLocale(naturalGas[i])} Mt<extra></extra>`
                      )
                  },
                  {
                      x: years,
                      y: conventionalOil,
                      type: 'bar',
                      name: legendConventional,
                      marker: { color: COLORS[2], opacity: barOpacityFor(2) },
                      hovertemplate: years.map(
                          (y, i) =>
                              `<b>${legendConventional}</b><br>${y}: ${formatMtLocale(conventionalOil[i])} Mt<extra></extra>`
                      )
                  },
                  {
                      x: years,
                      y: other,
                      type: 'bar',
                      name: legendOther,
                      marker: { color: COLORS[3], opacity: barOpacityFor(3) },
                      hovertemplate: years.map(
                          (y, i) => `<b>${legendOther}</b><br>${y}: ${formatMtLocale(other[i])} Mt<extra></extra>`
                      )
                  }
              ];

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [rows, stats] = await Promise.all([
                    getOilGasGhgSpotlightData(),
                    getGhgNarrativeStats(),
                ]);
                if (!cancelled) {
                    setChartRows(rows);
                    setNarrativeStats(stats);
                    setLoadError(!rows || rows.length === 0);
                }
            } catch {
                if (!cancelled) {
                    setChartRows([]);
                    setLoadError(true);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    

    return (
        <PageShell tabIndex="-1"
            className="page-content page-132 page-chrome page-chrome--bleed"
            aria-labelledby="ghg-spotlight-oil-gas-main-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
                .page-132.page-content {
                    max-width: none !important;
                    overflow-x: visible !important;
                }
                .ghg-spotlight-oil-gas-container {
                    width: 100%;
                    padding: 15px 0 40px 0;
                    box-sizing: border-box;
                }
                .page-132.page-content h1.ghg-spotlight-oil-gas-title {
                    font-size: 41px !important;
                }
                .ghg-spotlight-oil-gas-body {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    color: #332f30;
                    line-height: 1.5;
                    margin: 0 0 16px 0;
                    max-width: 80ch;
                }
                .ghg-spotlight-oil-gas-body .visual-bold {
                    font-weight: 700;
                }
                .ghg-spotlight-oil-gas-chart-title {
                    color: var(--gc-text);
                    margin: 0 0 12px 0;
                }
                .ghg-spotlight-oil-gas-chart-block {
                    display: flex;
                    flex-direction: column;
                    align-items: stretch;
                    width: 100%;
                }
                .ghg-spotlight-oil-gas-chart {
                    width: 100%;
                    flex-shrink: 0;
                    position: relative;
                    min-height: 0;
                }
                .ghg-spotlight-oil-gas-legend {
                    gap: 15px 28px;
                    margin-top: 20px;
                    margin-bottom: 20px;
                    font-family: 'Noto Sans', sans-serif;
                    padding: 10px 20px;
                }
                .ghg-spotlight-oil-gas-legend-swatch {
                    width: 22px;
                    height: 14px;
                    flex-shrink: 0;
                }
                .ghg-spotlight-oil-gas-legend-label {
                    font-size: 18px;
                    color: var(--gc-text);
                }
                .ghg-spotlight-oil-gas-table-wrapper {
                    display: block;
                    width: 100%;
                    margin-top: 20px;
                    margin-bottom: 0;
                }
                .ghg-spotlight-oil-gas-chart-frame button[type="button"]:hover {
                    background-color: #404040 !important;
                }
                @media (max-width: 768px) {
                    .page-132.page-content h1.ghg-spotlight-oil-gas-title {
                        font-size: 37px !important;
                    }
                    .ghg-spotlight-oil-gas-body { font-size: 18px; }
                    .ghg-spotlight-oil-gas-legend-label { font-size: 16px; }
                }
                @media (max-width: 480px) {
                    .ghg-spotlight-oil-gas-legend-label { font-size: 14px; }
                }
            `}</style>

            <div className="ghg-spotlight-oil-gas-container">
                <h1 id="ghg-spotlight-oil-gas-main-title" className="ghg-spotlight-oil-gas-title page-chrome-title">
                    {getText('ghg_oilgas_spotlight_title', lang)}
                </h1>

                <p className="ghg-spotlight-oil-gas-body" aria-label={para1Text}>
                    {getText('ghg_oilgas_spotlight_para1a', lang)}
                    <span className="visual-bold">{para1Highlight}</span>
                    {getText('ghg_oilgas_spotlight_para1c', lang)}
                </p>
                <p className="ghg-spotlight-oil-gas-body" aria-label={para2Text}>
                    {getText('ghg_oilgas_spotlight_para2a', lang)}
                    <span className="visual-bold">{para2HighlightSand}</span>
                    {getText('ghg_oilgas_spotlight_para2c', lang)}
                    <span className="visual-bold">{para2HighlightConvGas}</span>
                    {getText('ghg_oilgas_spotlight_para2e', lang)}
                </p>

                {loadError && (
                    <p className="ghg-spotlight-oil-gas-body" role="alert">
                        {lang === 'en'
                            ? 'Chart data could not be loaded.'
                            : 'Les données du graphique n’ont pas pu être chargées.'}
                    </p>
                )}

                <div className="ghg-spotlight-oil-gas-chart-frame page-chrome-chart-frame">
                    <h2 id="ghg-spotlight-oil-gas-chart-title" className="ghg-spotlight-oil-gas-chart-title page-chrome-chart-title">
                        {chartTitle}
                    </h2>

                    <div className="ghg-spotlight-oil-gas-chart-block">
                        <div role="region" aria-label={getChartSummary()} tabIndex="0">
                            {selectedPoints !== null && (
                                <ClearSelectionButton lang={lang} onClick={clear} />
                            )}
                            <figure ref={chartRef} className="ghg-spotlight-oil-gas-chart" style={{ margin: 0 }}>
                                {years.length > 0 && (
                                    <div aria-hidden="true">
                                        <Plot
                                            data={plotData}
                                            layout={{
                                                barmode: 'stack',
                                                bargap: 0.22,
                                                hoverlabel: {
                                                    bgcolor: '#ffffff',
                                                    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' }
                                                },
                                                hovermode: 'closest',
                                                clickmode: 'event',
                                                dragmode: false,
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
                                                    range: [startYear - 0.5, endYear + 0.5],
                                                    automargin: true
                                                },
                                                yaxis: {
                                                    title: {
                                                        text: getText('ghg_oilgas_spotlight_yaxis', lang),
                                                        font: axisTitleFont,
                                                        standoff: 8
                                                    },
                                                    range: [0, yMax],
                                                    dtick: 50,
                                                    showgrid: false,
                                                    zeroline: false,
                                                    showline: true,
                                                    linewidth: 1,
                                                    linecolor: '#333',
                                                    tickfont: tickFont,
                                                    automargin: true
                                                },
                                                showlegend: false,
                                                margin: { l: 58, r: 18, t: plotTopMargin, b: plotBottomMargin },
                                                autosize: true,
                                                paper_bgcolor: 'rgba(0,0,0,0)',
                                                plot_bgcolor: 'rgba(0,0,0,0)'
                                            }}
                                            config={plotConfig}
                                            style={{ width: '100%', height: `${chartHeight}px` }}
                                            useResizeHandler={true}
                                            onClick={onPlotClick}
                                        />
                                    </div>
                                )}
                            </figure>
                        </div>

                        <HtmlLegend
                            className="ghg-spotlight-oil-gas-legend"
                            variant="swatch"
                            itemClassName="ghg-spotlight-oil-gas-legend-item"
                            markerClassName="ghg-spotlight-oil-gas-legend-swatch"
                            labelClassName="ghg-spotlight-oil-gas-legend-label"
                            items={legendLabels.map((label, idx) => ({
                                label,
                                color: COLORS[idx],
                            }))}
                        />
                    </div>

                    <div className="ghg-spotlight-oil-gas-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={`${fileSlugBase}.csv`}
                            docx={{
                                filename: `${fileSlugBase}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [900, 1100, 1100, 1100, 900, 900],
                                fontSize: 20,
                            }}
                            caption={substitute(getText('ghg_oilgas_spotlight_table_caption', lang), yearVars)}
                            tableAriaLabel={substitute(getText('ghg_oilgas_spotlight_table_caption', lang), yearVars)}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatMtLocale(raw)
                            )}
                        />
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default OilGasGhgSpotlight;
