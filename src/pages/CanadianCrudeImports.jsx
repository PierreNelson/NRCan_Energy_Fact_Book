import React, { useCallback, useMemo, useRef } from 'react';
import AccessibleInfographic from '../components/AccessibleInfographic';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import PageShell from '../components/PageShell';
import SafeHtml from '../components/SafeHtml';
import Plot from '../components/LazyPlot';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import usePlotlySelection from '../hooks/usePlotlySelection';
import useWindowWidth from '../hooks/useWindowWidth';
import { useOutletContext } from 'react-router-dom';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { formatLocaleNumber, formatLocalePct } from '../utils/formatLocale';
import { downloadInfographicImagePng, resolveAccessibleInfographicGraphic } from '../utils/downloadInfographicPng';
import { exportTableToCsv, exportTableToDocx } from '../utils/exportTableToDocx';
import hexToRgba from '../utils/hexToRgba';
import barrelEn from '../assets/canadian_crude_oil_imports_barrel.png';
import barrelFr from '../assets/canadian_crude_oil_imports_barrel_fr.png';
import infographicEn from '../assets/canadian_crude_oil_imports_infographic.svg?raw';
import infographicFr from '../assets/canadian_crude_oil_imports_infographic_fr.svg?raw';
import {
    CANADIAN_CRUDE_IMPORT_ROWS,
    ORIGIN_KEYS,
    SHARE_TRACK_COLOR,
    SHARE_VALUE_COLOR,
    STACK_COLORS,
    originTotal,
    summarizeCanadianCrudeImports,
} from './canadianCrudeImportsData';

const LEGEND_ORDER = ['us', 'nigeria', 'iraq', 'other', 'saudi', 'algeria', 'norway'];

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

const loosenSvgText = (markup) => markup
    .replace(/\s+textLength="[^"]*"/g, '')
    .replace(/\s+lengthAdjust="[^"]*"/g, '');

const displayYearSpan = (start, end, lang) => {
    if (start == null || end == null) return '';
    if (start === end) return String(start);
    return lang === 'fr' ? `${start} à ${end}` : `${start} to ${end}`;
};

const fileYearSpan = (start, end) => {
    if (start == null || end == null) return '';
    if (start === end) return String(start);
    return `${start}-${end}`;
};

const CanadianCrudeImports = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const shareChartRef = useRef(null);
    const stackChartRef = useRef(null);
    const infographicRef = useRef(null);

    const summary = useMemo(
        () => summarizeCanadianCrudeImports(CANADIAN_CRUDE_IMPORT_ROWS),
        [],
    );
    const { rows, latest, snapshot, infographic, startYear, endYear } = summary;
    const yearSpan = displayYearSpan(startYear, endYear, lang);
    const fileSpan = fileYearSpan(startYear, endYear);
    const latestYear = latest?.year ?? '';

    const {
        hasSelection: shareHasSelection,
        clear: clearShareSelection,
        onPlotClick: shareOnPlotClick,
        opacityFor: shareOpacityFor,
    } = usePlotlySelection({ mode: 'points', traceCount: 1, windowWidth });

    const {
        selected: stackSelected,
        hasSelection: stackHasSelection,
        clear: clearStackSelection,
        onPlotClick: stackOnPlotClick,
        opacityFor: stackOpacityFor,
    } = usePlotlySelection({ mode: 'points', traceCount: ORIGIN_KEYS.length, windowWidth });

    const originLabel = useCallback((key) => {
        const barKey = `canadian_crude_imports_origin_bar_${key}`;
        const barLabel = getText(barKey, lang);
        if (barLabel !== barKey) return barLabel;
        return getText(`canadian_crude_imports_origin_${key}`, lang);
    }, [lang]);

    const originName = useCallback(
        (key) => getText(`canadian_crude_imports_origin_${key}`, lang),
        [lang],
    );

    const formatPct = useCallback(
        (value) => formatLocalePct(value, lang, { maximumFractionDigits: 0 }),
        [lang],
    );
    const formatVolume = useCallback(
        (value) => formatLocaleNumber(value, lang, { maximumFractionDigits: 0 }),
        [lang],
    );
    const formatMmbd = useCallback(
        (value) => formatLocaleNumber(value, lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
        [lang],
    );

    const shareLabels = snapshot.map((item) => originLabel(item.key));
    const shareValues = snapshot.map((item) => item.pct);
    const onSharePlotClick = useCallback((event) => {
        const point = event?.points?.[0];
        const pointIndex = point?.pointIndex ?? point?.pointNumber;
        if (pointIndex == null || pointIndex < 0) return;
        shareOnPlotClick({ points: [{ curveNumber: 0, pointIndex }] });
    }, [shareOnPlotClick]);

    const shareChartTitle = fill(getText('canadian_crude_imports_share_chart_title', lang), { year: latestYear });
    const stackChartTitle = fill(getText('canadian_crude_imports_chart_title', lang), { yearSpan });
    const shareSlug = fill(getText('canadian_crude_imports_share_csv', lang), { year: latestYear });
    const stackSlug = fill(getText('canadian_crude_imports_csv', lang), { yearSpan: fileSpan });
    const infographicSlug = fill(getText('canadian_crude_imports_infographic_csv', lang), {
        year: infographic?.year ?? latestYear,
    });

    const downloadSharePng = useChartPngDownloader(
        shareChartRef,
        () => ({
            filename: `${shareSlug}.png`,
            title: shareChartTitle,
            height: 420,
            legendItems: snapshot.map((item) => ({
                label: `${formatPct(item.pct)} ${originLabel(item.key)}`,
                color: SHARE_VALUE_COLOR,
            })),
        }),
        [shareSlug, shareChartTitle, snapshot, formatPct, originLabel],
    );
    const downloadStackPng = useChartPngDownloader(
        stackChartRef,
        () => ({
            filename: `${stackSlug}.png`,
            title: stackChartTitle,
            height: 640,
            legendItems: LEGEND_ORDER.map((key) => ({
                label: originName(key),
                color: STACK_COLORS[key],
            })),
        }),
        [stackSlug, stackChartTitle, originName],
    );

    const sharePlotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadSharePng(gd),
    });
    const stackPlotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadStackPng(gd),
    });

    const sharePlotData = [
        {
            type: 'bar',
            orientation: 'h',
            y: shareLabels,
            x: shareLabels.map(() => 100),
            marker: {
                color: snapshot.map((_, index) => hexToRgba(
                    SHARE_TRACK_COLOR,
                    shareOpacityFor(0, index),
                )),
                cornerradius: 18,
                line: { width: 0 },
            },
            hovertemplate: snapshot.map((item) => (
                `<b>${originLabel(item.key)}</b><br>${formatPct(item.pct)}<extra></extra>`
            )),
            showlegend: false,
        },
        {
            type: 'bar',
            orientation: 'h',
            y: shareLabels,
            x: shareValues,
            marker: {
                color: snapshot.map((_, index) => hexToRgba(
                    SHARE_VALUE_COLOR,
                    shareOpacityFor(0, index),
                )),
                cornerradius: 18,
                line: { width: 0 },
            },
            hovertemplate: snapshot.map((item) => (
                `<b>${originLabel(item.key)}</b><br>${formatPct(item.pct)}<extra></extra>`
            )),
            showlegend: false,
        },
    ];

    const years = rows.map((entry) => entry.year);
    const yMax = Math.max(
        800,
        Math.ceil(Math.max(0, ...rows.map((entry) => originTotal(entry))) / 100) * 100,
    );
    const stackPlotData = ORIGIN_KEYS.map((key, traceIndex) => ({
        type: 'bar',
        name: originName(key),
        x: years,
        y: rows.map((entry) => Number(entry[key]) || 0),
        marker: {
            color: years.map((_, index) => hexToRgba(STACK_COLORS[key], stackOpacityFor(traceIndex, index))),
            line: { width: 0 },
        },
        hovertemplate: `<b>${originName(key)}</b><br>%{x}<br>%{y}<extra></extra>`,
    }));

    const barrelSrc = lang === 'fr' ? barrelFr : barrelEn;
    const chartHeight = windowWidth < 768 ? 360 : 420;
    const shareLayout = {
        barmode: 'overlay',
        showlegend: false,
        hovermode: 'closest',
        hoverlabel: HOVER_LABEL,
        clickmode: 'event',
        dragmode: false,
        height: chartHeight,
        margin: { l: 8, r: 8, t: 8, b: 8 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        images: [{
            source: barrelSrc,
            xref: 'paper',
            yref: 'paper',
            x: 0.5,
            y: 0.5,
            sizex: 0.48,
            sizey: 0.96,
            xanchor: 'left',
            yanchor: 'middle',
            sizing: 'contain',
            layer: 'above',
        }],
        annotations: snapshot.map((item, index) => ({
            x: 3,
            y: shareLabels[index],
            text: `<b>${formatPct(item.pct)}  ${originLabel(item.key)}</b>`,
            showarrow: false,
            xanchor: 'left',
            yanchor: 'middle',
            font: {
                family: 'Noto Sans, sans-serif',
                size: 15,
                color: item.pct >= 40 ? '#ffffff' : '#222222',
            },
            opacity: shareOpacityFor(0, index),
        })),
        xaxis: {
            range: [0, 100],
            domain: [0, 0.78],
            visible: false,
            fixedrange: true,
        },
        yaxis: {
            autorange: 'reversed',
            visible: false,
            fixedrange: true,
        },
    };

    const stackLayout = {
        barmode: 'stack',
        showlegend: false,
        hovermode: 'closest',
        hoverlabel: HOVER_LABEL,
        clickmode: 'event',
        dragmode: false,
        height: chartHeight,
        margin: { l: 64, r: 12, t: 8, b: 36 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        xaxis: {
            type: 'category',
            tickvals: years,
            ticktext: years.map(String),
            tickfont: { family: 'Noto Sans, sans-serif', size: 12, color: '#333333' },
            fixedrange: true,
            showgrid: false,
        },
        yaxis: {
            title: {
                text: getText('canadian_crude_imports_yaxis', lang),
                font: { family: 'Noto Sans, sans-serif', size: 13, color: '#333333' },
            },
            range: [0, yMax],
            dtick: 100,
            tickfont: { family: 'Noto Sans, sans-serif', size: 12, color: '#333333' },
            gridcolor: '#d9d9d9',
            fixedrange: true,
            zeroline: false,
        },
    };

    const shareTableRows = snapshot.map((item) => ({
        year: latestYear,
        country: originName(item.key),
        share: formatPct(item.pct),
    }));
    const stackTableRows = rows.flatMap((entry) => ORIGIN_KEYS.map((key) => ({
        year: entry.year,
        origin: originName(key),
        volume: formatVolume(entry[key]),
    })));

    const infographicRows = infographic ? [
        {
            indicator: getText('canadian_crude_imports_infographic_row_us_imports', lang),
            value: formatPct(infographic.usCrudeImportSharePct),
        },
        {
            indicator: getText('canadian_crude_imports_infographic_row_refinery', lang),
            value: formatPct(infographic.usRefineryIntakeSharePct),
        },
        {
            indicator: getText('canadian_crude_imports_infographic_row_exports', lang),
            value: fill(getText('canadian_crude_imports_exports_unit', lang), {
                value: formatMmbd(infographic.exportsToUsMmbd),
            }),
        },
        {
            indicator: getText('canadian_crude_imports_infographic_row_export_share', lang),
            value: formatPct(infographic.canadianExportSharePct),
        },
    ] : [];
    const infographicHeaders = [
        getText('canadian_crude_imports_infographic_col_indicator', lang),
        getText('canadian_crude_imports_infographic_col_value', lang),
    ];
    const infographicExportRows = () => infographicRows.map((item) => [item.indicator, item.value]);
    const infographicTableTitle = fill(getText('canadian_crude_imports_infographic_table_caption', lang), {
        year: infographic?.year ?? latestYear,
    });

    const svgMarkup = useMemo(() => {
        if (!infographic) return lang === 'fr' ? infographicFr : infographicEn;
        const source = lang === 'fr' ? infographicFr : infographicEn;
        const pairs = [
            ['value-63', formatLocaleNumber(infographic.usCrudeImportSharePct, lang, { maximumFractionDigits: 0 })],
            ['value-23', formatLocaleNumber(infographic.usRefineryIntakeSharePct, lang, { maximumFractionDigits: 0 })],
            ['value-39', formatMmbd(infographic.exportsToUsMmbd)],
            ['value-90', formatLocaleNumber(infographic.canadianExportSharePct, lang, { maximumFractionDigits: 0 })],
        ];
        return pairs.reduce(
            (markup, [id, value]) => replaceSvgText(markup, id, value),
            loosenSvgText(source),
        );
    }, [infographic, lang, formatMmbd]);

    const infographicLabel = fill(getText('canadian_crude_imports_infographic_label', lang), {
        year: infographic?.year ?? latestYear,
        usImportShare: formatPct(infographic?.usCrudeImportSharePct),
        refineryShare: formatPct(infographic?.usRefineryIntakeSharePct),
        exports: fill(getText('canadian_crude_imports_exports_unit', lang), {
            value: formatMmbd(infographic?.exportsToUsMmbd),
        }),
        exportShare: formatPct(infographic?.canadianExportSharePct),
    });

    const downloadInfographicPng = async () => {
        await downloadInfographicImagePng(
            resolveAccessibleInfographicGraphic(infographicRef.current),
            { filename: `${infographicSlug}.png`, scale: 2 },
        );
    };

    const legendOpacity = (key) => {
        if (!stackHasSelection) return 1;
        const traceIndex = ORIGIN_KEYS.indexOf(key);
        return stackSelected?.[traceIndex]?.length ? 1 : 0.35;
    };

    return (
        <PageShell
            className="page-content page-116 page-chrome page-chrome--bleed canadian-crude-imports"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <h1 id="canadian-crude-imports-title" className="page-chrome-title">
                {getText('canadian_crude_imports_title', lang)}
            </h1>

            <div className="canadian-crude-imports-columns">
                <div className="canadian-crude-imports-share">
                    <p className="canadian-crude-imports-intro">
                        {fill(getText('canadian_crude_imports_share_intro', lang), { year: latestYear })}
                    </p>
                    <div
                        className="canadian-crude-imports-plot"
                        role="img"
                        aria-label={fill(getText('canadian_crude_imports_share_aria', lang), { year: latestYear })}
                    >
                        <Plot
                            ref={shareChartRef}
                            data={sharePlotData}
                            layout={shareLayout}
                            config={sharePlotConfig}
                            onClick={onSharePlotClick}
                            style={{ width: '100%' }}
                            useResizeHandler
                        />
                    </div>
                    {shareHasSelection ? (
                        <ClearSelectionButton lang={lang} onClick={clearShareSelection} />
                    ) : null}
                    <ChartDataTable
                        lang={lang}
                        columns={[
                            { key: 'year', header: getText('canadian_crude_imports_table_col_year', lang) },
                            { key: 'country', header: getText('canadian_crude_imports_table_col_country', lang) },
                            { key: 'share', header: getText('canadian_crude_imports_table_col_share', lang) },
                        ]}
                        rows={shareTableRows}
                        csvFilename={`${shareSlug}.csv`}
                        docx={{
                            filename: `${shareSlug}.docx`,
                            title: shareChartTitle,
                            titleAlign: 'center',
                            columnWidths: [1400, 4600, 1800],
                            fontSize: 20,
                        }}
                        caption={fill(getText('canadian_crude_imports_share_table_caption', lang), { year: latestYear })}
                        tableAriaLabel={fill(getText('canadian_crude_imports_share_table_caption', lang), { year: latestYear })}
                    />
                </div>

                <div className="canadian-crude-imports-stack">
                    <p className="canadian-crude-imports-intro">
                        {getText('canadian_crude_imports_trend', lang)}
                    </p>
                    <div className="page-chrome-chart-frame">
                        <h2 id="canadian-crude-imports-chart-title" className="page-chrome-chart-title">
                            {stackChartTitle}
                        </h2>
                        <div
                            className="canadian-crude-imports-plot"
                            role="img"
                            aria-label={fill(getText('canadian_crude_imports_chart_aria', lang), { yearSpan })}
                        >
                            <Plot
                                ref={stackChartRef}
                                data={stackPlotData}
                                layout={stackLayout}
                                config={stackPlotConfig}
                                onClick={stackOnPlotClick}
                                style={{ width: '100%' }}
                                useResizeHandler
                            />
                        </div>
                        <ul className="canadian-crude-imports-legend" aria-hidden="true">
                            {LEGEND_ORDER.map((key) => (
                                <li key={key} style={{ opacity: legendOpacity(key) }}>
                                    <span style={{ backgroundColor: STACK_COLORS[key] }} />
                                    {originName(key)}
                                </li>
                            ))}
                        </ul>
                        {stackHasSelection ? (
                            <ClearSelectionButton lang={lang} onClick={clearStackSelection} />
                        ) : null}
                        <ChartDataTable
                            lang={lang}
                            columns={[
                                { key: 'year', header: getText('canadian_crude_imports_table_col_year', lang) },
                                { key: 'origin', header: getText('canadian_crude_imports_table_col_origin', lang) },
                                { key: 'volume', header: getText('canadian_crude_imports_table_col_volume', lang) },
                            ]}
                            rows={stackTableRows}
                            csvFilename={`${stackSlug}.csv`}
                            docx={{
                                filename: `${stackSlug}.docx`,
                                title: stackChartTitle,
                                titleAlign: 'center',
                                columnWidths: [1400, 4200, 2800],
                                fontSize: 20,
                            }}
                            caption={fill(getText('canadian_crude_imports_table_caption', lang), { yearSpan })}
                            tableAriaLabel={fill(getText('canadian_crude_imports_chart_aria', lang), { yearSpan })}
                        />
                    </div>
                </div>
            </div>

            <p className="canadian-crude-imports-infographic-lead">
                <SafeHtml html={fill(getText('canadian_crude_imports_infographic_lead', lang), {
                    year: infographic?.year ?? latestYear,
                })} />
            </p>
            <AccessibleInfographic
                ref={infographicRef}
                mode="text"
                label={infographicLabel}
                svgMarkup={svgMarkup}
                className="canadian-crude-imports-infographic"
            />
            <div className="canadian-crude-imports-download-buttons">
                <button type="button" onClick={downloadInfographicPng}>
                    {getText('canadian_crude_imports_download_png', lang)}
                </button>
                <button
                    type="button"
                    onClick={() => exportTableToDocx({
                        filename: infographicSlug,
                        title: infographicTableTitle,
                        headers: infographicHeaders,
                        rows: infographicExportRows(),
                        columnWidths: [6400, 2400],
                        options: { titleAlign: 'center', fontSize: 20 },
                    })}
                >
                    {getText('canadian_crude_imports_download_docx', lang)}
                </button>
                <button
                    type="button"
                    onClick={() => exportTableToCsv({
                        filename: infographicSlug,
                        headers: infographicHeaders,
                        rows: infographicExportRows(),
                    })}
                >
                    {getText('canadian_crude_imports_download_csv', lang)}
                </button>
            </div>

            <style>{`
                .canadian-crude-imports.page-content h1.page-chrome-title {
                    line-height: 1.25;
                    padding-bottom: 22px !important;
                    margin-bottom: 25px;
                }
                .canadian-crude-imports.page-content h1.page-chrome-title::after {
                    bottom: 2px;
                }
                .canadian-crude-imports-intro,
                .canadian-crude-imports-infographic-lead {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    line-height: 1.55;
                    color: var(--gc-text);
                    margin: 0 0 14px 0;
                }
                .canadian-crude-imports-columns {
                    display: grid;
                    grid-template-columns: minmax(280px, 0.9fr) minmax(320px, 1.15fr);
                    gap: 28px;
                    align-items: start;
                }
                .canadian-crude-imports-plot,
                .canadian-crude-imports-plot .js-plotly-plot,
                .canadian-crude-imports-plot .plot-container,
                .canadian-crude-imports-plot .svg-container {
                    overflow: visible !important;
                }
                .canadian-crude-imports-stack .page-chrome-chart-frame > .data-table-wrapper {
                    margin-top: 20px;
                }
                .canadian-crude-imports-legend {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 6px 16px;
                    list-style: none;
                    margin: 4px 0 0 0;
                    padding: 0;
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 14px;
                    color: #333333;
                }
                .canadian-crude-imports-legend li {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .canadian-crude-imports-legend span {
                    width: 14px;
                    height: 14px;
                    flex: 0 0 14px;
                }
                .canadian-crude-imports-infographic-lead {
                    margin-top: 28px;
                }
                .canadian-crude-imports-infographic svg {
                    width: 100%;
                    height: auto;
                    display: block;
                }
                .canadian-crude-imports-download-buttons {
                    display: flex;
                    gap: 10px;
                    margin: 12px 0 20px;
                    flex-wrap: wrap;
                }
                .canadian-crude-imports-download-buttons button {
                    padding: 8px 16px;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    background: #8C8C8C;
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-size: 14px;
                    font-weight: bold;
                    color: #ffffff;
                }
                .canadian-crude-imports-download-buttons button:hover {
                    background-color: #404040;
                }
                @media (max-width: 768px) {
                    .canadian-crude-imports-columns {
                        grid-template-columns: 1fr;
                    }
                    .canadian-crude-imports.page-content h1.page-chrome-title {
                        font-size: 37px;
                    }
                    .canadian-crude-imports-intro,
                    .canadian-crude-imports-infographic-lead {
                        font-size: 18px;
                    }
                    .canadian-crude-imports-legend {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }
                }
            `}</style>
        </PageShell>
    );
};

export default CanadianCrudeImports;
