import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getGHGEmissionsData, getGhgNarrativeStats } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import HtmlLegend from '../components/HtmlLegend';
import { formatLocaleNumber } from '../utils/formatLocale';

const COLORS = {
    oil_gas: '#819892',
    heavy_industry: '#54A2AB',
    transportation: '#214897',
    buildings: '#647c8f',
    electricity: '#2D9FA9',
    waste_others: '#48A36C',
    agriculture: '#857550',
};

const SERIES_CONFIG = [
    { id: 'oil_gas', key: 'oil_gas', labelKey: 'ghg_emissions_by_sector_legend_oil_gas' },
    { id: 'heavy_industry', key: 'heavy_industry', labelKey: 'ghg_emissions_by_sector_legend_heavy_industry' },
    { id: 'transportation', key: 'transportation', labelKey: 'ghg_emissions_by_sector_legend_transportation' },
    { id: 'buildings', key: 'buildings', labelKey: 'ghg_emissions_by_sector_legend_buildings' },
    { id: 'electricity', key: 'electricity', labelKey: 'ghg_emissions_by_sector_legend_electricity' },
    { id: 'waste_others', key: 'waste_others', labelKey: 'ghg_emissions_by_sector_legend_waste_others' },
    { id: 'agriculture', key: 'agriculture', labelKey: 'ghg_emissions_by_sector_legend_agriculture' },
];

const TRACE_COUNT = SERIES_CONFIG.length;

const GhgEmissionsBySector = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const [pageData, setPageData] = useState([]);
    const [narrativeStats, setNarrativeStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const {
        selected: selectedPoints,
        clear,
        onPlotClick,
        opacityFor,
    } = usePlotlySelection({ mode: 'points', traceCount: TRACE_COUNT, windowWidth });
    const chartRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        Promise.all([getGHGEmissionsData(), getGhgNarrativeStats()])
            .then(([data, stats]) => {
                if (cancelled) return;
                setPageData(data);
                setNarrativeStats(stats);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('Failed to load GHG emissions data:', err);
                setError(err.message || 'Failed to load data');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    

    const years = useMemo(() => pageData.map((d) => d.year), [pageData]);
    const minYear = years.length ? Math.min(...years) : null;
    const maxYear = years.length ? Math.max(...years) : null;

    const chartTitle = minYear != null && maxYear != null
        ? `${getText('ghg_emissions_by_sector_chart_title_prefix', lang)}${minYear}${lang === 'en' ? '–' : '-'}${maxYear}`
        : getText('ghg_emissions_by_sector_title', lang);
    const exportChartTitle = stripHtml(chartTitle);
    const yAxisTitle = getText('ghg_emissions_by_sector_yaxis', lang);

    const fileSlugBase =
        lang === 'en' ? 'ghg_emissions_by_sector' : 'emissions_ges_par_secteur';

    const unitHdrSuffix = lang === 'en' ? ' (Mt CO₂ eq)' : ' (Mt éq. CO₂)';
    const yearHeader = lang === 'en' ? 'Year' : 'Année';

    const seriesLabels = useMemo(
        () => SERIES_CONFIG.map((s) => stripHtml(getText(s.labelKey, lang))),
        [lang],
    );

    const tableColumns = useMemo(
        () => [
            { key: 'year', header: yearHeader, align: 'left' },
            ...SERIES_CONFIG.map((s, i) => ({
                key: s.key,
                header: `${seriesLabels[i]}${unitHdrSuffix}`,
                align: 'num',
            })),
        ],
        [seriesLabels, unitHdrSuffix, yearHeader],
    );

    const tableCaption =
        lang === 'en'
            ? 'GHG emissions by Canadian economic sector (megatonnes of CO2 equivalent)'
            : "Émissions de GES par secteur économique canadien (mégatonnes d'équivalent CO2)";

    const formatNumber = (val) => formatLocaleNumber(val, lang, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });

    const stats = narrativeStats ?? {
        baseYear: 2000,
        endYear: 2023,
        electricityPct: null,
        oilGasEmissionsPct: null,
        heavyIndustryPct: null,
        crudeProductionPct: null,
    };

    const formatPctDisplay = (value) => {
        const n = Math.abs(Math.round(Number(value)));
        return lang === 'fr' ? `${n} %` : `${n}%`;
    };

    const emissionsChangeShort = (pct) => {
        const n = formatPctDisplay(pct);
        if (lang === 'fr') {
            return Number(pct) < 0 ? `diminué de ${n}` : `augmenté de ${n}`;
        }
        return Number(pct) < 0 ? `decreased ${n}` : `increased ${n}`;
    };

    const yearRangePrefix =
        lang === 'fr'
            ? `Entre ${stats.baseYear} et ${stats.endYear}`
            : `Between ${stats.baseYear} and ${stats.endYear}`;

    const bullet1Prefix = lang === 'fr' ? `${yearRangePrefix}, les ` : `${yearRangePrefix}, `;
    const bullet1Highlight =
        stats.electricityPct != null
            ? (() => {
                const n = formatPctDisplay(stats.electricityPct);
                if (lang === 'fr') {
                    const verb =
                        Number(stats.electricityPct) < 0
                            ? `ont connu une baisse de ${n}`
                            : `ont augmenté de ${n}`;
                    return `émissions provenant de la production d'électricité ${verb}`;
                }
                const verb =
                    Number(stats.electricityPct) < 0 ? `decreased ${n}` : `increased ${n}`;
                return `emissions from electricity production ${verb}`;
            })()
            : getText('ghg_emissions_by_sector_bullet1_part2', lang);
    const bullet1Text = `${bullet1Prefix}${bullet1Highlight}${getText('ghg_emissions_by_sector_bullet1_part3', lang)}`;

    const bullet2Highlight =
        stats.oilGasEmissionsPct != null
            ? emissionsChangeShort(stats.oilGasEmissionsPct)
            : getText('ghg_emissions_by_sector_bullet2_part2', lang);
    const bullet2ProductionPct =
        stats.crudeProductionPct != null ? formatPctDisplay(stats.crudeProductionPct) : null;
    const bullet2Text =
        bullet2ProductionPct != null
            ? `${getText('ghg_emissions_by_sector_bullet2_part1', lang)}${bullet2Highlight}${getText('ghg_emissions_by_sector_bullet2_part3a', lang)}${bullet2ProductionPct}${getText('ghg_emissions_by_sector_bullet2_part3b', lang)}`
            : `${getText('ghg_emissions_by_sector_bullet2_part1', lang)}${bullet2Highlight}${getText('ghg_emissions_by_sector_bullet2_part3', lang)}`;

    const bullet3Highlight =
        stats.heavyIndustryPct != null
            ? (() => {
                const n = formatPctDisplay(stats.heavyIndustryPct);
                if (lang === 'fr') {
                    return Number(stats.heavyIndustryPct) < 0
                        ? `ont diminué de près de ${n}`
                        : `ont augmenté de ${n}`;
                }
                return Number(stats.heavyIndustryPct) < 0
                    ? `have decreased by nearly ${n}`
                    : `have increased by ${n}`;
            })()
            : getText('ghg_emissions_by_sector_bullet3_part2', lang);
    const bullet3Text = `${getText('ghg_emissions_by_sector_bullet3_part1', lang)}${bullet3Highlight}${getText('ghg_emissions_by_sector_bullet3_part3', lang)}`;

    const tickVals = useMemo(() => {
        if (minYear == null || maxYear == null) return [];
        const vals = [];
        const tickStart = minYear % 2 === 0 ? minYear : minYear + 1;
        for (let y = tickStart; y <= maxYear; y += 2) vals.push(y);
        return vals;
    }, [minYear, maxYear]);

    const getSeriesValues = (key) => pageData.map((d) => d[key] || 0);

    const getChartSummary = () => {
        if (!years.length) return '';
        const body = summarizeByCategory({
            categories: years,
            series: SERIES_CONFIG.map((s, i) => ({
                name: seriesLabels[i],
                values: getSeriesValues(s.key),
                format: formatNumber,
            })),
            lang,
        });
        return joinChartSummary({
            intro:
                lang === 'en'
                    ? `Stacked bar chart showing GHG emissions by Canadian economic sector from ${minYear} to ${maxYear}`
                    : `Graphique à barres empilées montrant les émissions de GES par secteur économique canadien de ${minYear} à ${maxYear}`,
            unitNote: lang === 'en' ? 'Values in Mt CO₂ eq' : 'Valeurs en Mt éq. CO₂',
            body,
            lang,
        });
    };

        const downloadChartWithTitle = useChartPngDownloader(
            chartRef,
            () => ({
            filename: `${fileSlugBase}_chart.png`,
            title: exportChartTitle,
            height: 600,
            legendItems: SERIES_CONFIG.map((s, i) => ({
                label: seriesLabels[i],
                color: COLORS[s.id],
            })),
        }),
            [COLORS, SERIES_CONFIG, exportChartTitle, fileSlugBase, seriesLabels],
        );

    const isColumnFormat = windowWidth <= 1400;
    const chartMarginLeft = 60;
    const chartMarginRight = isColumnFormat ? 0 : 15;
    const chartHeight = windowWidth <= 480 ? 300 : 350;

    if (loading || error) return <PageStatus lang={lang} loading={loading} error={error} />;
    if (pageData.length === 0) {
        return (
            <div
                className="ghg-emissions-empty"
                style={{ padding: '24px 20px', marginTop: '32px' }}
                role="region"
                aria-label={lang === 'en' ? 'GHG emissions chart' : 'Graphique des émissions de GES'}
            >
                {lang === 'en' ? 'No data available.' : 'Aucune donnée disponible.'}
            </div>
        );
    }


    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-20 page-chrome page-chrome--bleed"
            aria-labelledby="ghg-emissions-chart-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
                .page-20.page-content {
                    width: 100%;
                    max-width: none !important;
                    overflow-x: visible !important;
                    box-sizing: border-box;
                }
                .ghg-emissions-container {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    min-height: 100%;
                    padding: 20px 0 40px 0;
                    box-sizing: border-box;
                }
                .ghg-emissions-content-row {
                    display: flex;
                    flex-direction: row;
                    flex: 1;
                    width: 100%;
                    overflow: visible;
                    gap: 40px;
                }
                .ghg-emissions-chart-column { width: 55%; min-width: 0; }
                .ghg-emissions-text-column {
                    width: 45%;
                    padding-top: 30px;
                    padding-left: 30px;
                    padding-right: 0;
                    box-sizing: border-box;
                    min-width: 300px;
                }
                .ghg-emissions-chart-title {
                    color: var(--gc-text);
                    line-height: 1.2;
                    max-width: 100%;
                    margin: 0 0 12px 0;
                }
                .ghg-emissions-chart-wrapper {
                    position: relative;
                    width: 100%;
                    margin: 0;
                }
                .ghg-emissions-chart {
                    width: 100%;
                    height: ${chartHeight}px;
                }
                .ghg-emissions-legend {
                    gap: 15px;
                    margin-top: 15px;
                    cursor: default;
                    width: 100%;
                    box-sizing: border-box;
                }
                .ghg-emissions-legend-item {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 18px;
                    color: var(--gc-text);
                    cursor: default;
                    user-select: none;
                }
                .ghg-emissions-legend-color {
                    width: 15px;
                    height: 15px;
                }
                .ghg-emissions-table-wrapper {
                    display: block;
                    width: 100%;
                    margin: 0;
                }
                .ghg-emissions-bullet {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                }
                .ghg-emissions-chart-frame button[type="button"]:hover,
                .ghg-emissions-chart-wrapper button[type="button"]:hover {
                    background-color: #404040 !important;
                }
                .layout-stacked {
                    flex-direction: column !important;
                    height: auto !important;
                    align-items: center !important;
                }
                .layout-stacked .ghg-emissions-chart-column {
                    width: 100% !important;
                    height: auto !important;
                    max-height: none !important;
                    margin-bottom: 30px !important;
                    overflow: visible !important;
                }
                .layout-stacked .ghg-emissions-text-column {
                    width: 100% !important;
                    padding-left: 0 !important;
                    padding-right: 0 !important;
                    padding-top: 0 !important;
                    margin-top: 20px !important;
                }
                @media (max-width: 1400px) {
                    .ghg-emissions-content-row { flex-direction: column; }
                    .ghg-emissions-chart-column { width: 100%; margin-bottom: 30px; }
                    .ghg-emissions-text-column { width: 100%; padding-top: 0; padding-left: 0; }
                }
                @media (max-width: 768px) {
                    .ghg-emissions-legend-item { font-size: 16px; }
                    .ghg-emissions-bullet { font-size: 18px; }
                }
                @media (max-width: 640px) {
                    .ghg-emissions-legend {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                    }
                }
            `}</style>

            <div className="ghg-emissions-container">
                <div className={`ghg-emissions-content-row ${isTableOpen ? 'layout-stacked' : ''}`}>
                    <div className="ghg-emissions-chart-column">
                        <div className="ghg-emissions-chart-frame page-chrome-chart-frame">
                            <h2 id="ghg-emissions-chart-title" className="ghg-emissions-chart-title page-chrome-chart-title" tabIndex="0">
                                {chartTitle}
                            </h2>

                            <div role="region" aria-label={`${exportChartTitle}. ${getChartSummary()}`} tabIndex="0">
                                <figure ref={chartRef} className="ghg-emissions-chart-wrapper">
                                    {selectedPoints !== null && <ClearSelectionButton lang={lang} onClick={clear} />}
                                    <Plot
                                        data={SERIES_CONFIG.map((series, idx) => ({
                                            name: seriesLabels[idx],
                                            x: years,
                                            y: getSeriesValues(series.key),
                                            type: 'bar',
                                            marker: {
                                                color: COLORS[series.id],
                                                opacity:
                                                    selectedPoints === null
                                                        ? 1
                                                        : years.map((_, i) => opacityFor(idx, i)),
                                            },
                                            hovertemplate: years.map(
                                                (y, i) =>
                                                    `<b>${seriesLabels[idx]}</b><br>${y}: ${formatNumber(getSeriesValues(series.key)[i])} Mt<extra></extra>`,
                                            ),
                                        }))}
                                        layout={{
                                            barmode: 'stack',
                                            hoverlabel: { bgcolor: '#ffffff' },
                                            showlegend: false,
                                            clickmode: 'event',
                                            dragmode: false,
                                            xaxis: {
                                                tickvals: tickVals,
                                                automargin: true,
                                                tickangle: windowWidth <= 400 ? +90 : 'auto',
                                            },
                                            yaxis: {
                                                title: { text: yAxisTitle },
                                                automargin: true,
                                            },
                                            margin: { l: chartMarginLeft, r: chartMarginRight, t: 30, b: 10 },
                                            autosize: true,
                                            bargap: 0.2,
                                            paper_bgcolor: 'rgba(0,0,0,0)',
                                            plot_bgcolor: 'rgba(0,0,0,0)',
                                            height: chartHeight,
                                        }}
                                        className="ghg-emissions-chart"
                                        useResizeHandler={true}
                                        onClick={onPlotClick}
                                        config={plotConfig}
                                    />
                                </figure>
                            </div>

                            <HtmlLegend
                                className="ghg-emissions-legend"
                                variant="swatch"
                                itemClassName="ghg-emissions-legend-item"
                                markerClassName="ghg-emissions-legend-color"
                                items={SERIES_CONFIG.map((item, i) => ({
                                    label: seriesLabels[i],
                                    color: COLORS[item.id],
                                }))}
                            />
                        </div>

                        <div
                            className="ghg-emissions-table-wrapper"
                            onToggle={(e) => {
                                if (e.target instanceof HTMLDetailsElement) {
                                    setIsTableOpen(e.target.open);
                                }
                            }}
                        >
                            <ChartDataTable
                                lang={lang}
                                columns={tableColumns}
                                rows={pageData}
                                csvFilename={`${fileSlugBase}_data.csv`}
                                docx={{
                                    filename: `${fileSlugBase}_table.docx`,
                                    title: exportChartTitle,
                                    titleAlign: 'center',
                                    columnWidths: [1000, 1400, 1400, 1400, 1200, 1200, 1400, 1200],
                                    fontSize: 22,
                                }}
                                caption={tableCaption}
                                tableAriaLabel={tableCaption}
                                renderCell={(raw, { colIndex }) =>
                                    colIndex === 0 ? String(raw ?? '') : formatNumber(raw)
                                }
                            />
                        </div>
                    </div>

                    <aside className="ghg-emissions-text-column">
                        <ul style={{ listStyleType: 'disc', paddingLeft: '20px', margin: '0', color: '#333' }}>
                            <li
                                className="ghg-emissions-bullet"
                                style={{ marginBottom: '20px', lineHeight: '1.4', marginTop: '20px' }}
                                aria-label={bullet1Text}
                            >
                                <span aria-hidden="true">
                                    {bullet1Prefix}
                                    <strong>{bullet1Highlight}</strong>
                                    {getText('ghg_emissions_by_sector_bullet1_part3', lang)}
                                </span>
                            </li>

                            <li
                                className="ghg-emissions-bullet"
                                style={{ marginBottom: '20px', lineHeight: '1.4' }}
                                aria-label={bullet2Text}
                            >
                                <span aria-hidden="true">
                                    {getText('ghg_emissions_by_sector_bullet2_part1', lang)}
                                    <strong>{bullet2Highlight}</strong>
                                    {bullet2ProductionPct != null ? (
                                        <>
                                            {getText('ghg_emissions_by_sector_bullet2_part3a', lang)}
                                            <strong>{bullet2ProductionPct}</strong>
                                            {getText('ghg_emissions_by_sector_bullet2_part3b', lang)}
                                        </>
                                    ) : (
                                        getText('ghg_emissions_by_sector_bullet2_part3', lang)
                                    )}
                                </span>
                            </li>

                            <li
                                className="ghg-emissions-bullet"
                                style={{ marginBottom: '2px', lineHeight: '1.4' }}
                                aria-label={bullet3Text}
                            >
                                <span aria-hidden="true">
                                    {getText('ghg_emissions_by_sector_bullet3_part1', lang)}
                                    <strong>{bullet3Highlight}</strong>
                                    {getText('ghg_emissions_by_sector_bullet3_part3', lang)}
                                </span>
                            </li>
                        </ul>
                    </aside>
                </div>
            </div>
        </PageShell>
    );
};

export default GhgEmissionsBySector;
