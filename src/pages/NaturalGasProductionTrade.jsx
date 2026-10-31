import React, { useCallback, useMemo, useRef } from 'react';
import { saveAs } from 'file-saver';
import AccessibleInfographic from '../components/AccessibleInfographic';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import PageShell from '../components/PageShell';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import usePlotlySelection from '../hooks/usePlotlySelection';
import useWindowWidth from '../hooks/useWindowWidth';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import { formatLocaleNumber, formatLocalePct } from '../utils/formatLocale';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { resolveAccessibleInfographicGraphic, svgElementToCanvas } from '../utils/downloadInfographicPng';
import hexToRgba from '../utils/hexToRgba';
import infographicEn from '../assets/natural_gas_production_trade.svg?raw';
import infographicFr from '../assets/natural_gas_production_trade_fr.svg?raw';
import { summarizeNaturalGasProductionTrade } from './naturalGasProductionTradeData';

const CANADA_COLOR = '#e81820';
const US_COLOR = '#0070a0';
const EXPORT_COLOR = '#90c838';
const IMPORT_COLOR = '#6098b0';
const PROVINCE_COLORS = {
    alta: '#3e342c',
    bc: '#5aaad4',
    sask: '#e87722',
    other: '#8fce4a',
};

const HOVER_LABEL = {
    bgcolor: '#ffffff',
    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
};

const fill = (template, vars) => String(template || '').replace(
    /\{\{(\w+)\}\}/g,
    (_, key) => (vars[key] != null ? String(vars[key]) : ''),
);

const replaceSvgText = (markup, id, value) => {
    const safe = String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return markup.replace(
        new RegExp(`(<text\\b[^>]*\\bid="${id}"[^>]*>)[\\s\\S]*?(</text>)`),
        `$1${safe}$2`,
    );
};

const NaturalGasProductionTrade = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const bundle = useMemo(() => summarizeNaturalGasProductionTrade(), []);
    const {
        production,
        trade,
        provinces,
        provinceKeys,
        latestYear,
        yearSpan,
        provinceYear,
        tradeYear,
    } = bundle;

    const productionChartRef = useRef(null);
    const provinceChartRef = useRef(null);
    const tradeChartRef = useRef(null);
    const figureRef = useRef(null);

    const {
        selected: productionSelected,
        clear: clearProduction,
        onPlotClick: onProductionClick,
        opacityFor: productionOpacity,
        hasSelection: productionHasSelection,
    } = usePlotlySelection({ mode: 'points', traceCount: 2, windowWidth });
    const {
        selected: tradeSelected,
        clear: clearTrade,
        onPlotClick: onTradeClick,
        opacityFor: tradeOpacity,
        hasSelection: tradeHasSelection,
    } = usePlotlySelection({ mode: 'points', traceCount: 2, windowWidth });
    const {
        selected: provinceSelected,
        clear: clearProvince,
        onPlotClick: onProvinceClick,
        hasSelection: provinceHasSelection,
    } = usePlotlySelection({ mode: 'slices', windowWidth });

    const textVars = { year: provinceYear.year, yearSpan, latestYear };
    const formatVol = useCallback((value, digits) => formatLocaleNumber(value, lang, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }), [lang]);
    const formatPct = useCallback((value) => formatLocalePct(value, lang, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    }), [lang]);

    const productionTitle = getText('natural_gas_production_trade_production_title', lang);
    const provinceTitle = fill(getText('natural_gas_production_trade_province_title', lang), textVars);
    const tradeTitle = getText('natural_gas_production_trade_trade_title', lang);
    const yAxis = getText('natural_gas_production_trade_yaxis', lang);
    const canadaLabel = getText('natural_gas_production_trade_legend_canada', lang);
    const usLabel = getText('natural_gas_production_trade_legend_us', lang);
    const exportsLabel = getText('natural_gas_production_trade_legend_exports', lang);
    const importsLabel = getText('natural_gas_production_trade_legend_imports', lang);
    const unitBcfd = getText('natural_gas_production_trade_unit_bcfd', lang);
    const unitBcmd = getText('natural_gas_production_trade_unit_bcmd', lang);
    const provinceLabel = useCallback(
        (key) => getText(`natural_gas_production_trade_province_${key}`, lang),
        [lang],
    );

    const compact = windowWidth <= 768;
    const chartHeight = compact ? 300 : 340;
    const pieTextSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18;

    const productionSlug = fill(getText('natural_gas_production_trade_production_slug', lang), textVars);
    const provinceSlug = fill(getText('natural_gas_production_trade_province_slug', lang), textVars);
    const tradeSlug = fill(getText('natural_gas_production_trade_trade_slug', lang), textVars);
    const calloutSlug = fill(getText('natural_gas_production_trade_callout_slug', lang), textVars);

    const lineLayout = (range, dtick) => ({
        autosize: true,
        height: chartHeight,
        hovermode: 'closest',
        hoverlabel: HOVER_LABEL,
        clickmode: 'event',
        dragmode: false,
        showlegend: false,
        margin: { l: compact ? 56 : 72, r: 16, t: 8, b: compact ? 36 : 44 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        xaxis: {
            tickmode: 'linear',
            tick0: production[0].year,
            dtick: 2,
            range: [production[0].year - 0.5, production[production.length - 1].year + 0.5],
            tickfont: { size: compact ? 12 : 14, family: 'Arial, sans-serif', color: '#333' },
            showgrid: false,
            zeroline: false,
            showline: true,
            linewidth: 1,
            linecolor: '#555',
            automargin: true,
        },
        yaxis: {
            title: {
                text: yAxis,
                font: { size: compact ? 13 : 15, family: 'Arial, sans-serif', color: '#333' },
                standoff: 8,
            },
            range,
            tick0: 0,
            dtick,
            tickfont: { size: compact ? 12 : 14, family: 'Arial, sans-serif', color: '#333' },
            showgrid: false,
            zeroline: false,
            showline: true,
            linewidth: 1,
            linecolor: '#555',
            automargin: true,
        },
    });

    const lineTrace = (rows, key, name, color, selected, opacityFor, traceIndex, digits) => {
        const anyOnTrace = selected?.[traceIndex]?.length > 0;
        const lineOpacity = selected == null || anyOnTrace ? 1 : 0.3;
        return {
            x: rows.map((row) => row.year),
            y: rows.map((row) => row[key]),
            type: 'scatter',
            mode: 'lines+markers',
            name,
            line: { color, width: 3, opacity: lineOpacity },
            marker: {
                color,
                size: 7,
                opacity: rows.map((_, index) => opacityFor(traceIndex, index)),
            },
            hovertemplate: rows.map((row) => (
                `<b>${name}</b><br>${row.year}: ${formatVol(row[key], digits)} ${unitBcfd}<extra></extra>`
            )),
            hoverlabel: HOVER_LABEL,
        };
    };

    const productionData = [
        lineTrace(production, 'canadaBcfd', canadaLabel, CANADA_COLOR, productionSelected, productionOpacity, 0, 1),
        lineTrace(production, 'usBcfd', usLabel, US_COLOR, productionSelected, productionOpacity, 1, 1),
    ];
    const tradeData = [
        lineTrace(trade, 'exportsBcfd', exportsLabel, EXPORT_COLOR, tradeSelected, tradeOpacity, 0, 1),
        lineTrace(trade, 'importsBcfd', importsLabel, IMPORT_COLOR, tradeSelected, tradeOpacity, 1, 1),
    ];

    const pieSlices = provinceYear.slices;
    const pieColors = pieSlices.map((slice, index) => {
        const color = PROVINCE_COLORS[slice.key];
        if (!provinceSelected?.length) return color;
        return provinceSelected.includes(index) ? color : hexToRgba(color, 0.3);
    });
    const pieLabels = pieSlices.map((slice) => provinceLabel(slice.key));
    const pieTrace = {
        type: 'pie',
        labels: pieLabels,
        values: pieSlices.map((slice) => slice.pct),
        customdata: pieSlices.map((slice) => slice.pct),
        hole: 0.58,
        sort: false,
        direction: 'clockwise',
        rotation: 204,
        texttemplate: compact ? '%{customdata:.1f}%' : '%{label}<br>%{customdata:.1f}%',
        textinfo: compact ? 'percent' : 'label+percent',
        textposition: compact ? 'inside' : 'outside',
        textfont: {
            family: 'Arial, sans-serif',
            size: pieTextSize,
            color: compact ? '#ffffff' : pieColors,
        },
        outsidetextfont: { family: 'Arial, sans-serif', size: pieTextSize, color: pieColors },
        insidetextfont: { family: 'Arial, sans-serif', size: pieTextSize, color: '#ffffff' },
        marker: { colors: pieColors, line: { color: '#ffffff', width: 2 } },
        pull: pieSlices.map((_, index) => (provinceSelected?.includes(index) ? 0.06 : 0)),
        hovertext: pieSlices.map((slice) => (
            `<b>${provinceLabel(slice.key)}</b><br>${formatVol(slice.bcfd, 2)} ${unitBcfd}<br>${formatPct(slice.pct)}`
        )),
        hoverinfo: 'text',
        hoverlabel: HOVER_LABEL,
        automargin: true,
    };
    const pieLayout = {
        autosize: true,
        height: compact ? 340 : 420,
        showlegend: false,
        clickmode: 'event',
        dragmode: false,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { l: compact ? 16 : 40, r: compact ? 16 : 40, t: 24, b: 24 },
        hoverlabel: HOVER_LABEL,
        annotations: [{
            text: `${getText('natural_gas_production_trade_center_total', lang)}<br><b>${formatVol(provinceYear.totalBcfd, 1)}</b> ${unitBcfd}<br>(${formatVol(provinceYear.totalBcmd, 2)} ${unitBcmd})`,
            showarrow: false,
            x: 0.5,
            y: 0.5,
            xref: 'paper',
            yref: 'paper',
            font: { family: 'Arial, sans-serif', size: compact ? 13 : 16, color: '#333' },
        }],
    };

    const downloadProduction = useChartPngDownloader(
        productionChartRef,
        () => ({
            filename: `${productionSlug}.png`,
            title: productionTitle,
            height: 700,
            legendItems: [
                { label: canadaLabel, color: CANADA_COLOR },
                { label: usLabel, color: US_COLOR },
            ],
        }),
        [canadaLabel, productionSlug, productionTitle, usLabel],
    );
    const downloadProvince = useChartPngDownloader(
        provinceChartRef,
        () => ({
            filename: `${provinceSlug}.png`,
            title: provinceTitle,
            height: 760,
            legendItems: provinceKeys.map((key) => ({
                label: provinceLabel(key),
                color: PROVINCE_COLORS[key],
            })),
        }),
        [provinceKeys, provinceLabel, provinceSlug, provinceTitle],
    );
    const downloadTrade = useChartPngDownloader(
        tradeChartRef,
        () => ({
            filename: `${tradeSlug}.png`,
            title: tradeTitle,
            height: 700,
            legendItems: [
                { label: exportsLabel, color: EXPORT_COLOR },
                { label: importsLabel, color: IMPORT_COLOR },
            ],
        }),
        [exportsLabel, importsLabel, tradeSlug, tradeTitle],
    );

    const productionConfig = buildPngOnlyPlotConfig({ lang, click: (gd) => downloadProduction(gd) });
    const provinceConfig = buildPngOnlyPlotConfig({ lang, click: (gd) => downloadProvince(gd) });
    const tradeConfig = buildPngOnlyPlotConfig({ lang, click: (gd) => downloadTrade(gd) });

    const yearHeader = getText('natural_gas_production_trade_col_year', lang);
    const productionRows = production.map((row) => ({
        year: row.year,
        canadaBcfd: formatVol(row.canadaBcfd, 1),
        usBcfd: formatVol(row.usBcfd, 1),
        canadaBcmd: formatVol(row.canadaBcmd, 2),
        usBcmd: formatVol(row.usBcmd, 2),
    }));
    const provinceRows = provinces.flatMap((yearRow) => yearRow.slices.map((slice) => ({
        year: yearRow.year,
        province: provinceLabel(slice.key),
        share: formatPct(slice.pct),
        bcfd: formatVol(slice.bcfd, 2),
        bcmd: formatVol(slice.bcmd, 2),
    })));
    const tradeRows = trade.map((row) => ({
        year: row.year,
        exportsBcfd: formatVol(row.exportsBcfd, 1),
        importsBcfd: formatVol(row.importsBcfd, 1),
        exportsBcmd: formatVol(row.exportsBcmd, 2),
        importsBcmd: formatVol(row.importsBcmd, 2),
    }));

    const svgMarkup = useMemo(() => {
        const source = lang === 'fr' ? infographicFr : infographicEn;
        const pairs = [
            ['exports-bcfd', formatVol(tradeYear.exportsBcfd, 1)],
            ['imports-bcfd', formatVol(tradeYear.importsBcfd, 1)],
            ['exports-bcmd', formatVol(tradeYear.exportsBcmd, 2)],
            ['imports-bcmd', formatVol(tradeYear.importsBcmd, 2)],
        ];
        return pairs.reduce((markup, [id, value]) => replaceSvgText(markup, id, value), source);
    }, [formatVol, lang, tradeYear]);

    const downloadCallout = async () => {
        const svg = resolveAccessibleInfographicGraphic(figureRef.current);
        if (!svg) return;
        const canvas = await svgElementToCanvas(svg, { scale: 2 });
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (blob) saveAs(blob, `${calloutSlug}.png`);
    };

    const legendOpacity = (selected, traceIndex) => {
        if (selected == null) return 1;
        return selected[traceIndex]?.length ? 1 : 0.3;
    };

    const calloutLabel = fill(getText('natural_gas_production_trade_callout_label', lang), {
        year: tradeYear.year,
        exportsBcfd: formatVol(tradeYear.exportsBcfd, 1),
        exportsBcmd: formatVol(tradeYear.exportsBcmd, 2),
        importsBcfd: formatVol(tradeYear.importsBcfd, 1),
        importsBcmd: formatVol(tradeYear.importsBcmd, 2),
        unitBcfd,
        unitBcmd,
    });

    return (
        <PageShell
            className="page-content page-127 natural-gas-production-trade page-chrome page-chrome--bleed"
            aria-labelledby="natural-gas-production-trade-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
                .natural-gas-production-trade.page-content {
                    max-width: none !important;
                    overflow-x: visible !important;
                }
                .ngpt-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 32px 24px;
                    align-items: stretch;
                }
                .ngpt-panel {
                    display: flex;
                    flex-direction: column;
                    min-width: 0;
                }
                .ngpt-panel > .page-chrome-chart-title {
                    min-height: 2.6em;
                }
                .ngpt-plot { width: 100%; position: relative; }
                .ngpt-panel .clear-selection {
                    align-self: flex-start;
                    margin: 0 0 8px;
                }
                .ngpt-legend {
                    display: flex;
                    justify-content: center;
                    flex-wrap: wrap;
                    gap: 8px 28px;
                    margin: 8px 0 0;
                    padding: 0;
                    list-style: none;
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 16px;
                    color: #333;
                }
                .ngpt-legend-line {
                    display: inline-block;
                    width: 28px;
                    height: 4px;
                    margin-right: 8px;
                    vertical-align: middle;
                }
                .ngpt-actions { margin-top: auto; }
                .ngpt-callout-figure { margin: 0 auto; width: min(100%, 420px); }
                .ngpt-callout-figure .accessible-infographic-svg svg { width: 100%; height: auto; display: block; }
                .ngpt-download {
                    margin-top: 20px;
                    padding: 8px 16px;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    background: #8c8c8c;
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-size: 14px;
                    font-weight: bold;
                    color: #ffffff;
                }
                .ngpt-download:hover, .ngpt-download:focus-visible { background: #404040; }
                @media (max-width: 900px) {
                    .ngpt-grid { grid-template-columns: 1fr; }
                    .ngpt-panel > .page-chrome-chart-title { min-height: 0; }
                }
            `}</style>

            <div className="ngpt-grid">
                <section className="ngpt-panel">
                    <h1 id="natural-gas-production-trade-title" className="page-chrome-chart-title">
                        {productionTitle}
                    </h1>
                    {productionHasSelection ? <ClearSelectionButton lang={lang} onClick={clearProduction} /> : null}
                    <div
                        className="ngpt-plot"
                        role="img"
                        aria-label={fill(getText('natural_gas_production_trade_production_aria', lang), textVars)}
                    >
                        <figure ref={productionChartRef} style={{ margin: 0 }}>
                            <Plot
                                data={productionData}
                                layout={lineLayout([0, 120], 20)}
                                config={productionConfig}
                                onClick={onProductionClick}
                                style={{ width: '100%', height: `${chartHeight}px` }}
                                useResizeHandler
                            />
                        </figure>
                    </div>
                    <ul className="ngpt-legend" aria-hidden="true">
                        <li style={{ opacity: legendOpacity(productionSelected, 0) }}>
                            <span className="ngpt-legend-line" style={{ background: CANADA_COLOR }} />
                            {canadaLabel}
                        </li>
                        <li style={{ opacity: legendOpacity(productionSelected, 1) }}>
                            <span className="ngpt-legend-line" style={{ background: US_COLOR }} />
                            {usLabel}
                        </li>
                    </ul>
                    <div className="ngpt-actions">
                    <ChartDataTable
                        lang={lang}
                        columns={[
                            { key: 'year', header: yearHeader },
                            { key: 'canadaBcfd', header: `${canadaLabel} (${unitBcfd})` },
                            { key: 'usBcfd', header: `${usLabel} (${unitBcfd})` },
                            { key: 'canadaBcmd', header: `${canadaLabel} (${unitBcmd})` },
                            { key: 'usBcmd', header: `${usLabel} (${unitBcmd})` },
                        ]}
                        rows={productionRows}
                        csvFilename={`${productionSlug}.csv`}
                        docx={{
                            filename: `${productionSlug}.docx`,
                            title: productionTitle,
                            titleAlign: 'center',
                            columnWidths: [1400, 2000, 2400, 2000, 2400],
                            fontSize: 20,
                        }}
                        caption={fill(getText('natural_gas_production_trade_production_caption', lang), textVars)}
                        tableAriaLabel={fill(getText('natural_gas_production_trade_production_caption', lang), textVars)}
                    />
                    </div>
                </section>

                <section className="ngpt-panel">
                    <h2 className="page-chrome-chart-title">{provinceTitle}</h2>
                    {provinceHasSelection ? <ClearSelectionButton lang={lang} onClick={clearProvince} /> : null}
                    <div
                        className="ngpt-plot"
                        role="img"
                        aria-label={fill(getText('natural_gas_production_trade_province_aria', lang), textVars)}
                    >
                        <figure ref={provinceChartRef} style={{ margin: 0 }}>
                            <Plot
                                key={`natural-gas-province-${provinceYear.year}-${provinceSelected ? provinceSelected.join('-') : 'all'}`}
                                data={[pieTrace]}
                                layout={pieLayout}
                                config={provinceConfig}
                                onClick={onProvinceClick}
                                style={{ width: '100%' }}
                                useResizeHandler
                            />
                        </figure>
                    </div>
                    <div className="ngpt-actions">
                    <ChartDataTable
                        lang={lang}
                        columns={[
                            { key: 'year', header: yearHeader },
                            { key: 'province', header: getText('natural_gas_production_trade_col_province', lang) },
                            { key: 'share', header: getText('natural_gas_production_trade_col_share', lang) },
                            { key: 'bcfd', header: `${getText('natural_gas_production_trade_col_production', lang)} (${unitBcfd})` },
                            { key: 'bcmd', header: `${getText('natural_gas_production_trade_col_production', lang)} (${unitBcmd})` },
                        ]}
                        rows={provinceRows}
                        csvFilename={`${provinceSlug}.csv`}
                        docx={{
                            filename: `${provinceSlug}.docx`,
                            title: provinceTitle,
                            titleAlign: 'center',
                            columnWidths: [1200, 2000, 1400, 2200, 2200],
                            fontSize: 20,
                        }}
                        caption={fill(getText('natural_gas_production_trade_province_caption', lang), textVars)}
                        tableAriaLabel={fill(getText('natural_gas_production_trade_province_caption', lang), textVars)}
                    />
                    </div>
                </section>

                <section className="ngpt-panel">
                    <h2 className="page-chrome-chart-title">{tradeTitle}</h2>
                    {tradeHasSelection ? <ClearSelectionButton lang={lang} onClick={clearTrade} /> : null}
                    <div
                        className="ngpt-plot"
                        role="img"
                        aria-label={fill(getText('natural_gas_production_trade_trade_aria', lang), textVars)}
                    >
                        <figure ref={tradeChartRef} style={{ margin: 0 }}>
                            <Plot
                                data={tradeData}
                                layout={lineLayout([0, 12], 2)}
                                config={tradeConfig}
                                onClick={onTradeClick}
                                style={{ width: '100%', height: `${chartHeight}px` }}
                                useResizeHandler
                            />
                        </figure>
                    </div>
                    <ul className="ngpt-legend" aria-hidden="true">
                        <li style={{ opacity: legendOpacity(tradeSelected, 0) }}>
                            <span className="ngpt-legend-line" style={{ background: EXPORT_COLOR }} />
                            {exportsLabel}
                        </li>
                        <li style={{ opacity: legendOpacity(tradeSelected, 1) }}>
                            <span className="ngpt-legend-line" style={{ background: IMPORT_COLOR }} />
                            {importsLabel}
                        </li>
                    </ul>
                    <div className="ngpt-actions">
                    <ChartDataTable
                        lang={lang}
                        columns={[
                            { key: 'year', header: yearHeader },
                            { key: 'exportsBcfd', header: `${exportsLabel} (${unitBcfd})` },
                            { key: 'importsBcfd', header: `${importsLabel} (${unitBcfd})` },
                            { key: 'exportsBcmd', header: `${exportsLabel} (${unitBcmd})` },
                            { key: 'importsBcmd', header: `${importsLabel} (${unitBcmd})` },
                        ]}
                        rows={tradeRows}
                        csvFilename={`${tradeSlug}.csv`}
                        docx={{
                            filename: `${tradeSlug}.docx`,
                            title: tradeTitle,
                            titleAlign: 'center',
                            columnWidths: [1400, 2000, 2000, 2000, 2000],
                            fontSize: 20,
                        }}
                        caption={fill(getText('natural_gas_production_trade_trade_caption', lang), textVars)}
                        tableAriaLabel={fill(getText('natural_gas_production_trade_trade_caption', lang), textVars)}
                    />
                    </div>
                </section>

                <section className="ngpt-panel">
                    <AccessibleInfographic
                        ref={figureRef}
                        mode="text"
                        className="ngpt-callout-figure"
                        idPrefix={lang === 'fr' ? 'natural-gas-trade-fr' : 'natural-gas-trade-en'}
                        label={calloutLabel}
                        svgMarkup={svgMarkup}
                    />
                    <div className="ngpt-actions">
                        <button type="button" className="ngpt-download" onClick={downloadCallout}>
                            {getText('natural_gas_production_trade_download_png', lang)}
                        </button>
                    </div>
                </section>
            </div>
        </PageShell>
    );
};

export default NaturalGasProductionTrade;
