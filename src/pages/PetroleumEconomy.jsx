import React, { useCallback, useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import PageFootnotes from '../components/PageFootnotes';
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
import { stripHtml } from '../utils/stripHtml';
import { joinChartSummary, summarizeByCategory } from '../utils/chartSpokenSummary';
import { formatLocaleNumber, formatLocalePct } from '../utils/formatLocale';
import hexToRgba from '../utils/hexToRgba';
import worldIcon from '../assets/petroleum_economy_world_icon.png';
import {
    PETROLEUM_ECONOMY_ROWS,
    summarizePetroleumEconomy,
} from './petroleumEconomyData';

const WEDGE_COLOR = '#403030';
const REST_COLOR = '#e8e8d8';
const SLICE_COLORS = {
    petroleum: WEDGE_COLOR,
    rest: REST_COLOR,
};
const LEGEND_COLORS = {
    direct: '#508098',
    indirect: '#80a0b8',
};

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

function ordinalParts(n, lang) {
    const value = Number(n);
    if (lang === 'fr') {
        return { num: String(value), suffix: value === 1 ? 'er' : 'e' };
    }
    const mod100 = value % 100;
    const mod10 = value % 10;
    let suffix = 'th';
    if (mod100 < 11 || mod100 > 13) {
        if (mod10 === 1) suffix = 'st';
        else if (mod10 === 2) suffix = 'nd';
        else if (mod10 === 3) suffix = 'rd';
    }
    return { num: String(value), suffix };
}

const PetroleumEconomy = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const chartRef = useRef(null);
    const {
        selected: selectedSlices,
        clear: clearSelection,
        onPlotClick,
        hasSelection,
    } = usePlotlySelection({ mode: 'slices', windowWidth });

    // Newest year in the rows. A future year selector should replace displayYear;
    // slice labels are rebuilt from that year's values so they stay with each wedge.
    const summary = summarizePetroleumEconomy(PETROLEUM_ECONOMY_ROWS);
    const current = summary.latest;
    const displayYear = current?.year;

    const formatJobs = useCallback(
        (value) => formatLocaleNumber(value, lang, { maximumFractionDigits: 0 }),
        [lang],
    );
    const formatPct = useCallback((value, digits = 1) => formatLocalePct(value, lang, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }), [lang]);
    const formatBillions = useCallback((value, digits = 1) => substitute(
        getText('petroleum_economy_amount_billion', lang),
        {
            value: formatLocaleNumber(value, lang, {
                minimumFractionDigits: digits,
                maximumFractionDigits: digits,
            }),
        },
    ), [lang]);

    const yearVars = { year: displayYear };
    const fileYearSpan = summary.startYear === summary.endYear
        ? String(summary.endYear ?? '')
        : `${summary.startYear}-${summary.endYear}`;
    const captionYearSpan = summary.startYear === summary.endYear
        ? String(summary.endYear ?? '')
        : (lang === 'fr' ? `${summary.startYear} à ${summary.endYear}` : `${summary.startYear} to ${summary.endYear}`);

    const chartTitle = substitute(getText('petroleum_economy_chart_title', lang), yearVars);
    const exportChartTitle = stripHtml(chartTitle);
    const fileSlug = substitute(getText('petroleum_economy_download_title', lang), { yearSpan: fileYearSpan });

    const sliceMeta = !current ? [] : [
        {
            key: 'petroleum',
            label: getText('petroleum_economy_slice_petroleum', lang),
            pct: current.totalPct,
            billions: current.totalBillions,
        },
        {
            key: 'rest',
            label: getText('petroleum_economy_legend_gdp', lang),
            pct: current.restPct,
            billions: null,
        },
    ];

    const calloutText = current
        ? `${formatPct(current.totalPct)}<br>${getText('petroleum_economy_or', lang)}<br><b>${formatBillions(current.totalBillions)}</b>`
        : '';

    const pieTrace = !sliceMeta.length ? null : (() => {
        const values = sliceMeta.map((slice) => (slice.pct > 0 ? slice.pct : 0.001));
        const baseColors = sliceMeta.map((slice) => SLICE_COLORS[slice.key]);
        const markerColors = hasSelection
            ? baseColors.map((color, index) => (
                selectedSlices.includes(index) ? color : hexToRgba(color, 0.3)
            ))
            : baseColors;
        // Outside text is tied to the displayed year's slice values, so a later
        // year selector moves each label with its wedge the way other pie pages do.
        const text = sliceMeta.map((_, index) => (index === 0 ? calloutText : ''));
        const hovertext = sliceMeta.map((slice) => {
            if (slice.key === 'petroleum') {
                const directLine = `${getText('petroleum_economy_legend_direct', lang)}: ${formatPct(current.directPct)} (${formatBillions(current.directBillions)})`;
                const indirectLine = `${getText('petroleum_economy_legend_indirect', lang)}: ${formatPct(current.indirectPct)} (${formatBillions(current.indirectBillions)})`;
                return `<b>${slice.label}</b><br>${formatPct(slice.pct)}<br>${formatBillions(slice.billions)}<br>${directLine}<br>${indirectLine}`;
            }
            return `<b>${slice.label}</b><br>${formatPct(slice.pct)}`;
        });
        return {
            type: 'pie',
            values,
            labels: sliceMeta.map((slice) => slice.label),
            text,
            texttemplate: sliceMeta.map((_, index) => (index === 0 ? '%{text}' : '')),
            textinfo: 'text',
            textposition: 'outside',
            textfont: {
                size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 15 : 18,
                family: 'Arial, sans-serif',
                color: '#221e1f',
            },
            outsidetextfont: {
                size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 15 : 18,
                family: 'Arial, sans-serif',
                color: '#221e1f',
            },
            sort: false,
            direction: 'clockwise',
            rotation: 0,
            hole: 0,
            automargin: true,
            marker: {
                colors: markerColors,
                line: { color: '#ffffff', width: 1 },
            },
            pull: hasSelection
                ? values.map((_, index) => (selectedSlices.includes(index) ? 0.06 : 0))
                : values.map(() => 0),
            hovertext,
            hoverinfo: 'text',
            hoverlabel: {
                bgcolor: '#ffffff',
                bordercolor: '#000000',
                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
            },
        };
    })();

    const plotLayout = useMemo(() => ({
        showlegend: false,
        clickmode: 'event',
        dragmode: false,
        autosize: true,
        margin: { t: 36, b: 16, l: 8, r: 8 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        height: windowWidth <= 480 ? 300 : 360,
    }), [windowWidth]);

    const chartSummary = !current ? '' : joinChartSummary({
        intro: lang === 'en'
            ? `Pie chart of petroleum's share of Canada's nominal GDP in ${displayYear}`
            : `Graphique circulaire de la part du pétrole dans le PIB nominal du Canada en ${displayYear}`,
        body: summarizeByCategory({
            categories: sliceMeta.map((slice) => slice.label),
            series: [
                {
                    name: lang === 'en' ? 'Share' : 'Part',
                    values: sliceMeta.map((slice) => slice.pct),
                    format: (value) => formatPct(value),
                },
                {
                    name: lang === 'en' ? 'Value' : 'Valeur',
                    values: sliceMeta.map((slice) => slice.billions),
                    format: (value) => (value == null ? '' : formatBillions(value)),
                },
            ],
            lang,
        }),
    });

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
            filename: `${fileSlug}.png`,
            title: exportChartTitle,
            height: 720,
            legendItems: sliceMeta.map((slice) => ({
                label: slice.label,
                color: SLICE_COLORS[slice.key],
            })),
        }),
        [exportChartTitle, fileSlug, sliceMeta],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('petroleum_economy_table_col_year', lang), align: 'left' },
        { key: 'category', header: getText('petroleum_economy_table_col_category', lang), align: 'left' },
        { key: 'share', header: getText('petroleum_economy_table_col_share', lang), align: 'num' },
        { key: 'value', header: getText('petroleum_economy_table_col_value', lang), align: 'num' },
    ], [lang]);

    const tableRows = summary.rows.flatMap((row) => {
        const labels = {
            direct: getText('petroleum_economy_legend_direct', lang),
            indirect: getText('petroleum_economy_legend_indirect', lang),
            rest: getText('petroleum_economy_legend_gdp', lang),
        };
        return [
            { year: row.year, category: labels.direct, share: row.directPct, value: row.directBillions },
            { year: row.year, category: labels.indirect, share: row.indirectPct, value: row.indirectBillions },
            { year: row.year, category: labels.rest, share: row.restPct, value: null },
        ];
    });

    const tableCaption = substitute(getText('petroleum_economy_table_caption', lang), { yearSpan: captionYearSpan });

    if (!current) return null;

    const legendDim = (index) => hasSelection && !selectedSlices.includes(index);
    const oilRank = ordinalParts(current.oilRank, lang);
    const gasRank = ordinalParts(current.gasRank, lang);
    const wholePct = (value) => formatPct(value, 0);
    const wholeBillions = (value) => formatBillions(value, 0);

    return (
        <PageShell
            className="page-content page-104 page-chrome page-chrome--bleed"
            aria-labelledby="petroleum-economy-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
                .petroleum-economy-layout {
                    display: grid;
                    grid-template-columns: minmax(0, 1.2fr) minmax(260px, 0.8fr);
                    gap: 28px 36px;
                    align-items: start;
                }
                .petroleum-economy-chart-title,
                .petroleum-economy-employment-title {
                    text-align: left;
                    margin-bottom: 8px;
                }
                .petroleum-economy-subtitle,
                .petroleum-economy-legend,
                .petroleum-economy-bullets,
                .petroleum-economy-jobs,
                .petroleum-economy-jobs-heading,
                .petroleum-economy-total,
                .petroleum-economy-indigenous,
                .petroleum-economy-rank {
                    font-family: var(--font-body);
                    font-size: 20px;
                    line-height: 1.5;
                    color: var(--gc-text);
                }
                .petroleum-economy-subtitle {
                    font-weight: 600;
                    margin: 0 0 8px 0;
                }
                .petroleum-economy-pie-row {
                    display: flex;
                    align-items: center;
                    gap: 8px 18px;
                }
                .petroleum-economy-chart {
                    flex: 1 1 240px;
                    min-width: 0;
                    margin: 0;
                    overflow: visible;
                }
                .petroleum-economy-chart .js-plotly-plot,
                .petroleum-economy-chart .plot-container,
                .petroleum-economy-chart .svg-container {
                    overflow: visible !important;
                }
                .petroleum-economy-legend {
                    flex: 0 1 240px;
                    margin: 0;
                    padding: 0;
                    list-style: none;
                }
                .petroleum-economy-legend li {
                    margin: 0 0 12px 0;
                }
                .petroleum-economy-legend-name,
                .petroleum-economy-legend-value {
                    display: block;
                    font-weight: 700;
                    line-height: 1.3;
                }
                .petroleum-economy-legend li.is-dim { opacity: 0.35; }
                .petroleum-economy-chart:focus-visible {
                    outline: 3px solid #ffbf47;
                    outline-offset: 4px;
                }
                .petroleum-economy-bullets {
                    margin: 18px 0 0 0;
                    padding-left: 1.2em;
                }
                .petroleum-economy-bullets li { margin: 0 0 10px 0; }
                .petroleum-economy-bullets strong { font-weight: 700; }
                .petroleum-economy-jobs-heading {
                    font-weight: 700;
                    margin: 0 0 8px 0;
                }
                .petroleum-economy-jobs-heading.indirect { color: #508098; margin-top: 0; }
                .petroleum-economy-jobs {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                }
                .petroleum-economy-jobs li {
                    display: flex;
                    justify-content: space-between;
                    gap: 16px;
                    margin: 0 0 6px 0;
                    line-height: 1.3;
                }
                .petroleum-economy-jobs span:last-child {
                    font-variant-numeric: tabular-nums;
                    white-space: nowrap;
                }
                .petroleum-economy-total {
                    font-weight: 700;
                    margin: 0;
                }
                .petroleum-economy-lower {
                    display: flex;
                    align-items: stretch;
                    gap: 16px;
                    margin-top: 14px;
                }
                .petroleum-economy-lower-main {
                    flex: 1 1 auto;
                    min-width: 0;
                }
                .petroleum-economy-lower .petroleum-economy-total {
                    margin-bottom: 14px;
                }
                .petroleum-economy-indigenous {
                    flex: 0 0 148px;
                    width: 148px;
                    margin: 0;
                    box-sizing: border-box;
                    background: #8a827c;
                    color: #ffffff;
                    padding: 18px 12px;
                    display: flex;
                    align-items: center;
                    min-height: 148px;
                }
                .petroleum-economy-ranks {
                    flex: 1 1 auto;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    min-width: 0;
                }
                .petroleum-economy-world-icon {
                    width: 88px;
                    height: auto;
                    flex: 0 0 auto;
                }
                .petroleum-economy-rank {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin: 0 0 8px 0;
                }
                .petroleum-economy-rank:last-child { margin-bottom: 0; }
                .petroleum-economy-rank-num {
                    color: #2f6f9f;
                    font-family: var(--font-heading);
                    font-size: 39px;
                    font-weight: 700;
                    line-height: 1;
                }
                .petroleum-economy-rank-num sup {
                    font-size: 0.42em;
                    margin-left: 1px;
                }
                @media (max-width: 860px) {
                    .petroleum-economy-layout { grid-template-columns: 1fr; }
                    .petroleum-economy-pie-row { flex-direction: column; align-items: stretch; }
                    .petroleum-economy-legend { flex-basis: auto; }
                }
                @media (max-width: 768px) {
                    .petroleum-economy-subtitle,
                    .petroleum-economy-legend,
                    .petroleum-economy-bullets,
                    .petroleum-economy-jobs,
                    .petroleum-economy-jobs-heading,
                    .petroleum-economy-total,
                    .petroleum-economy-indigenous,
                    .petroleum-economy-rank {
                        font-size: 18px;
                    }
                    .petroleum-economy-rank-num { font-size: 35px; }
                }
            `}</style>

            <h1 id="petroleum-economy-title" className="page-chrome-title">
                {getText('petroleum_economy_title', lang)}
            </h1>

            <div className="petroleum-economy-layout">
                <div>
                    <div className="page-chrome-chart-frame">
                        <h2 className="page-chrome-chart-title petroleum-economy-chart-title">
                            {chartTitle}
                        </h2>
                        <p className="petroleum-economy-subtitle">
                            {getText('petroleum_economy_chart_subtitle', lang)}
                        </p>
                        {hasSelection && (
                            <ClearSelectionButton lang={lang} onClick={clearSelection} />
                        )}
                        <div className="petroleum-economy-pie-row">
                            <figure
                                ref={chartRef}
                                className="petroleum-economy-chart"
                                role="region"
                                aria-label={chartSummary || substitute(getText('petroleum_economy_chart_aria', lang), yearVars)}
                                tabIndex="0"
                            >
                                <div aria-hidden="true">
                                    {pieTrace && (
                                        <Plot
                                            key={`petroleum-economy-${displayYear}-${hasSelection ? selectedSlices.join('-') : 'all'}`}
                                            data={[pieTrace]}
                                            layout={plotLayout}
                                            config={plotConfig}
                                            style={{ width: '100%', height: `${plotLayout.height}px` }}
                                            useResizeHandler
                                            onClick={onPlotClick}
                                        />
                                    )}
                                </div>
                            </figure>
                            <ul className="petroleum-economy-legend" aria-label={getText('petroleum_economy_chart_subtitle', lang)}>
                                <li className={legendDim(1) ? 'is-dim' : undefined}>
                                    <span className="petroleum-economy-legend-name">
                                        {getText('petroleum_economy_legend_gdp', lang)}
                                    </span>
                                </li>
                                <li className={legendDim(0) ? 'is-dim' : undefined} style={{ color: LEGEND_COLORS.direct }}>
                                    <span className="petroleum-economy-legend-name">
                                        {getText('petroleum_economy_legend_direct', lang)}
                                    </span>
                                    <span className="petroleum-economy-legend-value">
                                        {formatPct(current.directPct)} ({formatBillions(current.directBillions)})
                                    </span>
                                </li>
                                <li className={legendDim(0) ? 'is-dim' : undefined} style={{ color: LEGEND_COLORS.indirect }}>
                                    <span className="petroleum-economy-legend-name">
                                        {getText('petroleum_economy_legend_indirect', lang)}
                                    </span>
                                    <span className="petroleum-economy-legend-value">
                                        {formatPct(current.indirectPct)} ({formatBillions(current.indirectBillions)})
                                    </span>
                                </li>
                            </ul>
                        </div>
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={`${fileSlug}.csv`}
                            docx={{
                                filename: `${fileSlug}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [1200, 3200, 1600, 3400],
                                fontSize: 20,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                            renderCell={(raw, { colIndex }) => {
                                if (colIndex === 2) return formatPct(raw);
                                if (colIndex === 3) return raw == null ? '—' : formatBillions(raw);
                                return String(raw ?? '');
                            }}
                        />
                    </div>
                    <ul className="petroleum-economy-bullets">
                        <li>
                            <SafeHtml html={substitute(getText('petroleum_economy_capex', lang), {
                                year: displayYear,
                                amount: wholeBillions(current.capitalExpendituresBillions),
                            })} />
                        </li>
                        <li>
                            <SafeHtml html={substitute(getText('petroleum_economy_ghg', lang), {
                                pct: wholePct(current.ghgSharePct),
                            })} />
                        </li>
                        <li>
                            <SafeHtml html={substitute(getText('petroleum_economy_exports', lang), {
                                year: displayYear,
                                amount: wholeBillions(current.exportsBillions),
                                share: wholePct(current.exportsSharePct),
                            })} />
                        </li>
                    </ul>
                </div>

                <div>
                    <h2 className="page-chrome-chart-title petroleum-economy-employment-title">
                        {substitute(getText('petroleum_economy_employment_title', lang), yearVars)}
                    </h2>
                    <p className="petroleum-economy-jobs-heading">
                        {substitute(getText('petroleum_economy_direct_jobs', lang), { count: formatJobs(current.directJobs) })}
                    </p>
                    <ul className="petroleum-economy-jobs">
                        {current.jobs.map((job) => (
                            <li key={job.key}>
                                <span>{getText(`petroleum_economy_job_${job.key}`, lang)}</span>
                                <span>{formatJobs(job.count)}</span>
                            </li>
                        ))}
                    </ul>
                    <div className="petroleum-economy-lower">
                        <div className="petroleum-economy-lower-main">
                        <p className="petroleum-economy-jobs-heading indirect">
                            {substitute(getText('petroleum_economy_indirect_jobs', lang), { count: formatJobs(current.indirectJobs) })}
                        </p>
                        <p className="petroleum-economy-total">
                            {substitute(getText('petroleum_economy_total_jobs', lang), { count: formatJobs(current.totalJobs) })}
                        </p>
                        <div className="petroleum-economy-ranks">
                            <img
                                src={worldIcon}
                                alt=""
                                aria-hidden="true"
                                className="petroleum-economy-world-icon"
                            />
                            <div>
                                <p className="petroleum-economy-rank">
                                    <span className="petroleum-economy-rank-num">
                                        {oilRank.num}<sup>{oilRank.suffix}</sup>
                                    </span>
                                    <span>{getText('petroleum_economy_oil_rank', lang)}</span>
                                </p>
                                <p className="petroleum-economy-rank">
                                    <span className="petroleum-economy-rank-num">
                                        {gasRank.num}<sup>{gasRank.suffix}</sup>
                                    </span>
                                    <span>{getText('petroleum_economy_gas_rank', lang)}</span>
                                </p>
                            </div>
                        </div>
                        </div>
                        <p className="petroleum-economy-indigenous">
                            {substitute(getText('petroleum_economy_indigenous', lang), { count: formatJobs(current.indigenousJobs) })}
                        </p>
                    </div>
                </div>
            </div>

            <PageFootnotes
                lang={lang}
                titleId="fn-petroleum-economy"
                items={[{
                    id: 'fn-petroleum-economy-rounding',
                    text: getText('petroleum_economy_footnote', lang),
                    hideMarker: true,
                }]}
            />
        </PageShell>
    );
};

export default PetroleumEconomy;
