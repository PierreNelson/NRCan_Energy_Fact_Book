import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import useWindowWidth from '../hooks/useWindowWidth';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { downloadInfographicImagePng } from '../utils/downloadInfographicPng';
import { prepareInlineSvgMarkup } from '../utils/prefixSvgIds';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { getEnergyAndGhgEmissionsData } from '../utils/dataLoader';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import HtmlLegend from '../components/HtmlLegend';
import bgColumnEn from '../assets/ghg_emissions_intensity_index_bg_column.svg?raw';
import bgColumnFr from '../assets/ghg_emissions_intensity_index_bg_column_fr.svg?raw';
import bgStackedEn from '../assets/ghg_emissions_intensity_index_bg_stacked.svg?raw';
import bgStackedFr from '../assets/ghg_emissions_intensity_index_bg_stacked_fr.svg?raw';
import hexToRgba from '../utils/hexToRgba';

const COLORS = {
    perGdp: '#647C8E',
    perCapita: '#31BDCB',
    perEnergy: '#8C755A',
};

const SERIES_KEYS = ['perGdp', 'perCapita', 'perEnergy'];

const fill = (template, values) => Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)),
    template,
);

const roundHalfUp = (value, digits) => {
    const factor = 10 ** digits;
    return Math.sign(value) * Math.round((Math.abs(value) * factor) + 1e-10) / factor;
};

const formatPercent = (value, lang, digits) => {
    const rounded = roundHalfUp(Number(value), digits);
    const text = Math.abs(rounded).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
    return lang === 'fr' ? `${text} %` : `${text}%`;
};

const formatSignedPercent = (value, lang) => {
    const rounded = roundHalfUp(Number(value), 1);
    const text = Math.abs(rounded).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });
    const signed = `${rounded < 0 ? '-' : ''}${text}`;
    return lang === 'fr' ? `${signed} %` : `${signed}%`;
};

const patchIntensitySvg = (markup, lang, stats) => {
    if (!stats) return markup;
    const year = stats.latest.year;
    const emissions = formatPercent(Math.abs(stats.emissionsChange), lang, 0);
    const gdp = formatPercent(Math.abs(stats.gdpChange), lang, 0);
    const perGdp = formatPercent(Math.abs(stats.perGdpChange), lang, 0);
    const perCapita = formatPercent(Math.abs(stats.perCapitaChange), lang, 1);
    let next = markup
        .replace('2000 and 2023', `2000 and ${year}`)
        .replace('2000 et 2023', `2000 et ${year}`)
        .replace('>7%</text>', `>${emissions}</text>`)
        .replace('>7 %</text>', `>${emissions}</text>`)
        .replace('>56%</text>', `>${gdp}</text>`)
        .replace('>56 %</text>', `>${gdp}</text>`)
        .replace('>39%</text>', `>${perGdp}</text>`)
        .replace('>39 %</text>', `>${perGdp}</text>`)
        .replace('>26.1%</text>', `>${perCapita}</text>`)
        .replace('>26,1 %</text>', `>${perCapita}</text>`);
    if (stats.emissionsChange >= 0) {
        next = next.replace('decreased by', 'increased by').replace('ont diminué de', 'ont augmenté de');
    }
    if (stats.gdpChange < 0) {
        next = next.replace('while GDP increased', 'while GDP decreased').replace('a augmenté de', 'a diminué de');
    }
    if (stats.perGdpChange >= 0) {
        next = next.replace('GHG emissions decreased', 'GHG emissions increased').replace('ont diminué de', 'ont augmenté de');
    }
    return next;
};

const INFOGRAPHIC_BLOCK_KEYS = ['emissions', 'gdp', 'intensity'];

/** Percent boxes for the three infographic statements. Column is the side-by-side graphic; stacked is the wide layout. */
const INFOGRAPHIC_BLOCK_BOXES = {
    column: {
        en: {
            emissions: { left: 0, top: 0, width: 100, height: 33.6 },
            gdp: { left: 0, top: 33.6, width: 100, height: 25.9 },
            intensity: { left: 0, top: 59.5, width: 100, height: 40.5 },
        },
        fr: {
            emissions: { left: 0, top: 0, width: 100, height: 32.8 },
            gdp: { left: 0, top: 32.8, width: 100, height: 23.8 },
            intensity: { left: 0, top: 56.6, width: 100, height: 43.4 },
        },
    },
    stacked: {
        en: {
            emissions: { left: 0, top: 0, width: 33, height: 100 },
            gdp: { left: 33, top: 0, width: 41, height: 100 },
            intensity: { left: 74, top: 0, width: 26, height: 100 },
        },
        fr: {
            emissions: { left: 0, top: 0, width: 34, height: 100 },
            gdp: { left: 34, top: 0, width: 40, height: 100 },
            intensity: { left: 74, top: 0, width: 26, height: 100 },
        },
    },
};

const STACKED_LAYOUT_BROWSER_ZOOM = 1.1;
const STACKED_LAYOUT_DETECTED_ZOOM = 1.0 + (STACKED_LAYOUT_BROWSER_ZOOM - 1.0) * 0.25;

const computePageZoomScale = (baseline) => {
    if (typeof window === 'undefined') return { pageCssZoom: 1, baseline: null };

    const inner = window.innerWidth;
    const outer = window.outerWidth;
    const dpr = window.devicePixelRatio || 1;

    let nextBaseline = baseline;
    if (!nextBaseline) {
        nextBaseline = { outer, inner, dpr };
    } else if (Math.abs(outer - nextBaseline.outer) > 64) {
        nextBaseline = { outer, inner, dpr };
    }

    const outerStable = Math.abs(outer - nextBaseline.outer) <= 64;

    let cssZoomFactor = 1;
    if (nextBaseline.inner > 0 && inner > 0 && outerStable) {
        cssZoomFactor = Math.max(nextBaseline.inner / inner, inner / nextBaseline.inner);
    }

    const vv = window.visualViewport;
    const pinScale = vv?.scale || 1;

    let layoutZoom = 1;
    if (vv?.width > 0 && inner > 0) {
        const inferred = inner / vv.width;
        if (inferred > 1.02 && inferred < 8) layoutZoom = inferred;
    }

    const pageCssZoom = Math.max(pinScale, layoutZoom, cssZoomFactor);
    return { pageCssZoom, baseline: nextBaseline };
};

const GhgEmissionsIntensityIndex = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const [pageCssZoom, setPageCssZoom] = useState(() => computePageZoomScale(null).pageCssZoom);
    const [selectedTraceIds, setSelectedTraceIds] = useState(null);
    const [chartYears, setChartYears] = useState([]);
    const zoomBaselineRef = useRef(null);
    const chartRef = useRef(null);
    const infographicImgRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null });

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const useStackedLayout = pageCssZoom >= STACKED_LAYOUT_DETECTED_ZOOM;

    const formatIndex = (num) => {
        if (num == null || Number.isNaN(Number(num))) return '—';
        const value = Number(num);
        const digits = Number.isInteger(value) ? 0 : 1;
        return value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    };

    useEffect(() => {
        let cancelled = false;
        getEnergyAndGhgEmissionsData()
            .then((data) => {
                if (!cancelled) setChartYears(data.chartYears || []);
            })
            .catch((err) => {
                console.warn('Unable to load indexed GHG emissions.', err);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const years = useMemo(() => chartYears.map((row) => row.year), [chartYears]);
    const seriesValues = useMemo(
        () => Object.fromEntries(SERIES_KEYS.map((key) => [key, chartYears.map((row) => row[key])])),
        [chartYears],
    );
    const indexed = useMemo(() => {
        if (!chartYears.length) return null;
        const base = chartYears.find((row) => row.year === 2000);
        const latest = chartYears[chartYears.length - 1];
        const prior = chartYears.find((row) => row.year === 2019);
        if (!base || !latest || base.canadaTotalKt === 0 || base.gdpMillion === 0) return null;
        const emissionsChange = (latest.canadaTotalKt / base.canadaTotalKt - 1) * 100;
        const gdpChange = (latest.gdpMillion / base.gdpMillion - 1) * 100;
        const stats = {
            base,
            latest,
            emissionsChange,
            gdpChange,
            perGdpChange: latest.perGdp - 100,
            perCapitaChange: latest.perCapita - 100,
            mtVs2019: null,
            pctVs2019: null,
        };
        if (prior && prior.canadaTotalKt) {
            stats.mtVs2019 = (prior.canadaTotalKt - latest.canadaTotalKt) / 1000;
            stats.pctVs2019 = (latest.canadaTotalKt / prior.canadaTotalKt - 1) * 100;
        }
        return stats;
    }, [chartYears]);

    const pageTitle = getText('ghg_emissions_intensity_index_title', lang);
    const yearSpan = {
        start: indexed?.base.year ?? 2000,
        end: indexed?.latest.year ?? '',
    };
    const chartTitle = fill(getText('ghg_emissions_intensity_index_chart_title', lang), yearSpan);
    const exportChartTitle = stripHtml(chartTitle);
    const chartDownloadSlug = getText('ghg_emissions_intensity_index_download_title', lang)
        .replace('2023', String(yearSpan.end))
        .replace(/\s+/g, '_');
    const infographicDownloadSlug = getText('ghg_emissions_intensity_index_infographic_download_title', lang).replace(/\s+/g, '_');
    const yAxisTitle = getText('ghg_emissions_intensity_index_yaxis', lang);

    const legendLabels = {
        perGdp: getText('ghg_emissions_intensity_index_legend_per_gdp', lang),
        perCapita: getText('ghg_emissions_intensity_index_legend_per_capita', lang),
        perEnergy: getText('ghg_emissions_intensity_index_legend_per_energy', lang),
    };

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('ghg_emissions_intensity_index_table_col_year', lang), align: 'left' },
        { key: 'perGdp', header: `${legendLabels.perGdp} (${yAxisTitle})`, align: 'num' },
        { key: 'perCapita', header: `${legendLabels.perCapita} (${yAxisTitle})`, align: 'num' },
        { key: 'perEnergy', header: `${legendLabels.perEnergy} (${yAxisTitle})`, align: 'num' },
    ], [lang, legendLabels.perGdp, legendLabels.perCapita, legendLabels.perEnergy, yAxisTitle]);

    const bgMarkup = lang === 'en'
        ? (useStackedLayout ? bgStackedEn : bgColumnEn)
        : (useStackedLayout ? bgStackedFr : bgColumnFr);
    const preparedInfographicSvg = useMemo(
        () => prepareInlineSvgMarkup(
            patchIntensitySvg(bgMarkup, lang, indexed),
            `ghg-intensity-${useStackedLayout ? 'stacked' : 'column'}-${lang}`,
        ),
        [bgMarkup, lang, useStackedLayout, indexed],
    );
    const infographicBlocks = useMemo(() => {
        const layout = useStackedLayout ? 'stacked' : 'column';
        const boxes = INFOGRAPHIC_BLOCK_BOXES[layout][lang === 'fr' ? 'fr' : 'en'];
        const directionWord = (change) => getText(
            change < 0
                ? 'ghg_emissions_intensity_index_direction_down'
                : 'ghg_emissions_intensity_index_direction_up',
            lang,
        );
        if (!indexed) {
            return INFOGRAPHIC_BLOCK_KEYS.map((key) => ({ key, label: '', box: boxes[key] }));
        }
        const labels = {
            emissions: fill(getText('ghg_emissions_intensity_index_block_emissions', lang), {
                year: indexed.latest.year,
                direction: directionWord(indexed.emissionsChange),
                value: formatPercent(Math.abs(indexed.emissionsChange), lang, 0),
            }),
            gdp: fill(getText('ghg_emissions_intensity_index_block_gdp', lang), {
                direction: directionWord(indexed.gdpChange),
                value: formatPercent(Math.abs(indexed.gdpChange), lang, 0),
            }),
            intensity: fill(getText('ghg_emissions_intensity_index_block_intensity', lang), {
                direction: directionWord(indexed.perGdpChange),
                perGdp: formatPercent(Math.abs(indexed.perGdpChange), lang, 0),
                perCapita: formatPercent(Math.abs(indexed.perCapitaChange), lang, 1),
            }),
        };
        return INFOGRAPHIC_BLOCK_KEYS.map((key) => ({
            key,
            label: labels[key],
            box: boxes[key],
        }));
    }, [lang, useStackedLayout, indexed]);

    const xTickvals = years.filter((y) => y % 2 === 1);
    const yTickvals = useMemo(() => {
        const values = chartYears.flatMap((row) => SERIES_KEYS.map((key) => row[key]));
        if (!values.length) return [55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105];
        const start = Math.floor((Math.min(...values, 100) - 1) / 5) * 5;
        const end = Math.ceil((Math.max(...values, 100) + 1) / 5) * 5;
        const ticks = [];
        for (let tick = start; tick <= end; tick += 5) ticks.push(tick);
        return ticks;
    }, [chartYears]);
    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 62 : windowWidth <= 768 ? 56 : 50;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    const lineColorFor = (traceIndex, baseColor) => {
        if (selectedTraceIds === null) return baseColor;
        return selectedTraceIds.includes(traceIndex) ? baseColor : hexToRgba(baseColor, 0.3);
    };

    useEffect(() => {
        const syncLayout = () => {
            const { pageCssZoom: nextPageCssZoom, baseline } = computePageZoomScale(zoomBaselineRef.current);
            zoomBaselineRef.current = baseline;
            setPageCssZoom(nextPageCssZoom);
        };
        syncLayout();
        window.addEventListener('resize', syncLayout);
        window.visualViewport?.addEventListener('resize', syncLayout);
        window.visualViewport?.addEventListener('scroll', syncLayout);
        return () => {
            window.removeEventListener('resize', syncLayout);
            window.visualViewport?.removeEventListener('resize', syncLayout);
            window.visualViewport?.removeEventListener('scroll', syncLayout);
        };
    }, []);

    

    const downloadInfographicPng = async () => {
        try {
            await downloadInfographicImagePng(
                infographicImgRef.current,
                { filename: `${infographicDownloadSlug}.png`, scale: 2 },
            );
        } catch (err) {
            console.warn('Unable to download infographic image.', err);
        }
    };

        const downloadChartWithTitle = useChartPngDownloader(
            chartRef,
            () => ({
            filename: `${chartDownloadSlug}.png`,
            title: exportChartTitle,
            height: 640,
            legendItems: SERIES_KEYS.map((key) => ({
                label: legendLabels[key],
                color: COLORS[key],
            })),
        }),
            [COLORS, SERIES_KEYS, chartDownloadSlug, exportChartTitle, legendLabels],
        );

    const handleChartClick = useCallback((event) => {
        if (!event?.points?.length) return;
        const traceIndex = event.points[0].curveNumber;
        if (traceIndex === undefined || traceIndex < 0 || traceIndex > 2) return;

        if (windowWidth <= 768) {
            const currentTime = Date.now();
            const lastClick = lastClickRef.current;
            const isSameTrace = traceIndex === lastClick.traceIndex && lastClick.traceIndex != null;
            const isDoubleTap = isSameTrace && currentTime - lastClick.time < 300;
            lastClickRef.current = { time: currentTime, traceIndex };
            if (!isDoubleTap) return;
        }

        setSelectedTraceIds((prev) => {
            if (prev === null) return [traceIndex];
            if (prev.includes(traceIndex)) {
                const next = prev.filter((t) => t !== traceIndex);
                return next.length === 0 ? null : next;
            }
            return [...prev, traceIndex];
        });
    }, [windowWidth]);

    const hoverTemplates = SERIES_KEYS.map((key) => years.map(
        (y, i) => `<b>${legendLabels[key]}</b><br>${y}: ${formatIndex(seriesValues[key][i])}<extra></extra>`,
    ));

    const selectionKey = selectedTraceIds ? selectedTraceIds.join('-') : 'all';

    const getChartSummary = () => {
        if (!years.length) return '';
        const body = summarizeByCategory({
            categories: years,
            series: SERIES_KEYS.map((key) => ({
                name: legendLabels[key],
                values: seriesValues[key],
                format: formatIndex,
            })),
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Line chart of GHG emissions intensity indices from ${years[0]} to ${years[years.length - 1]}`
                : `Graphique linéaire des indices d'intensité des émissions de GES de ${years[0]} à ${years[years.length - 1]}`,
            unitNote: lang === 'en' ? `Index values (${yAxisTitle})` : `Valeurs d'indice (${yAxisTitle})`,
            body,
        });
    };
    const chartRegionLabel = `${exportChartTitle}. ${getChartSummary()}`;


    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    return (
        <PageShell id="main-content"
            tabIndex="-1"
            className="page-content ghg-emissions-intensity-index page-chrome page-chrome--bleed"
            role="main"
            aria-labelledby="ghg-emissions-intensity-index-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.ghg-emissions-intensity-index {
}
.ghg-emissions-intensity-index-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.ghg-emissions-intensity-index.page-content h1.ghg-emissions-intensity-index-title {
    font-size: 41px !important;
    text-transform: none;
}
.ghg-emissions-intensity-index-intro {
    font-family: 'Noto Sans', Arial, sans-serif;
    font-size: 18px;
    line-height: 1.55;
    color: var(--gc-text);
    margin: 0 0 28px 0;
    max-width: 1100px;
}
.ghg-emissions-intensity-index-intro p { margin: 0 0 1rem 0; }
.ghg-emissions-intensity-index-intro p:last-child { margin-bottom: 0; }
.ghg-emissions-intensity-index-content-row {
    display: flex;
    flex-direction: row;
    width: 100%;
    gap: 28px;
    align-items: flex-start;
}
.ghg-emissions-intensity-index-info-column {
    width: 34%;
    min-width: 220px;
    box-sizing: border-box;
}
.ghg-emissions-intensity-index-chart-column {
    width: 66%;
    min-width: 0;
    box-sizing: border-box;
}
.layout-stacked.ghg-emissions-intensity-index-content-row { flex-direction: column !important; }
.layout-stacked .ghg-emissions-intensity-index-info-column,
.layout-stacked .ghg-emissions-intensity-index-chart-column {
    width: 100% !important;
    min-width: 0 !important;
}
.layout-stacked .ghg-emissions-intensity-index-info-column { margin-bottom: 28px; }
.ghg-emissions-intensity-index-figure {
    position: relative;
    margin: 0;
    width: 100%;
}
.ghg-emissions-intensity-index-graphic {
    position: relative;
    width: 100%;
}
.ghg-emissions-intensity-index-bg-image {
    width: 100%;
    height: auto;
    display: block;
}
.ghg-emissions-intensity-index-bg-image svg {
    width: 100%;
    height: auto;
    display: block;
}
.ghg-emissions-intensity-index-block {
    position: absolute;
    box-sizing: border-box;
}
.ghg-emissions-intensity-index-block:focus,
.ghg-emissions-intensity-index-block:focus-visible {
    outline: 3px solid #ffbf47;
    outline-offset: 2px;
}
.ghg-emissions-intensity-index-infographic-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin: 12px 0 0 0;
}
.ghg-emissions-intensity-index-infographic-actions button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: bold;
    color: #ffffff;
    white-space: nowrap;
}
.ghg-emissions-intensity-index-infographic-actions button:hover { background: #404040 !important; }
.ghg-emissions-intensity-index-chart-frame {
    margin-bottom: 0;
}
.ghg-emissions-intensity-index-chart-title {
    color: var(--gc-text);
    margin: 0 0 12px 0;
    text-transform: none;
}
.ghg-emissions-intensity-index-chart {
    width: 100%;
    min-width: 0;
    height: ${plotHeight}px;
    position: relative;
}
.ghg-emissions-intensity-index-chart > div { width: 100%; height: 100%; }
.ghg-emissions-intensity-index-legend {
    gap: 18px 28px;
    margin-top: 12px;
    font-size: 14px;
    color: var(--gc-text);
}
.ghg-emissions-intensity-index-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.ghg-emissions-intensity-index-chart-frame button[type="button"]:hover { background-color: #404040 !important; }
@media (max-width: 768px) {
    .ghg-emissions-intensity-index.page-content h1.ghg-emissions-intensity-index-title { font-size: 37px !important; }
    .ghg-emissions-intensity-index-intro { font-size: 16px; }
}
            `}</style>

            <div className="ghg-emissions-intensity-index-inner">
                <h1 id="ghg-emissions-intensity-index-title" className="ghg-emissions-intensity-index-title page-chrome-title">
                    {pageTitle}
                </h1>

                {indexed && (
                <div className="ghg-emissions-intensity-index-intro">
                    <p>{getText('ghg_emissions_intensity_index_intro_1', lang)}</p>
                    {indexed.mtVs2019 != null && (
                        <p>{fill(getText('ghg_emissions_intensity_index_intro_2', lang), {
                            year: indexed.latest.year,
                            mt: Math.abs(roundHalfUp(indexed.mtVs2019, 0)).toLocaleString(locale),
                            pct: formatSignedPercent(indexed.pctVs2019, lang),
                        })}</p>
                    )}
                </div>
                )}

                {indexed && <div className={`ghg-emissions-intensity-index-content-row ${useStackedLayout ? 'layout-stacked' : ''}`}>
                    <section className="ghg-emissions-intensity-index-info-column">
                        <figure ref={infographicImgRef} className="ghg-emissions-intensity-index-figure">
                            <div className="ghg-emissions-intensity-index-graphic">
                                <div
                                    className="ghg-emissions-intensity-index-bg-image"
                                    aria-hidden="true"
                                    dangerouslySetInnerHTML={{ __html: preparedInfographicSvg }}
                                />
                                {infographicBlocks.map(({ key, label, box }) => (
                                    <div
                                        key={key}
                                        className={`ghg-emissions-intensity-index-block ghg-emissions-intensity-index-block--${key}`}
                                        role="region"
                                        tabIndex={0}
                                        aria-label={label}
                                        data-prose-tab="1"
                                        style={{
                                            left: `${box.left}%`,
                                            top: `${box.top}%`,
                                            width: `${box.width}%`,
                                            height: `${box.height}%`,
                                        }}
                                    />
                                ))}
                            </div>
                        </figure>
                        <div className="ghg-emissions-intensity-index-infographic-actions">
                            <button type="button" onClick={downloadInfographicPng}>
                                {getText('ghg_emissions_intensity_index_download_png', lang)}
                            </button>
                        </div>
                    </section>

                    <section className="ghg-emissions-intensity-index-chart-column" aria-labelledby="ghg-emissions-intensity-index-chart-title">
                        <div className="ghg-emissions-intensity-index-chart-frame page-chrome-chart-frame">
                            <h2 id="ghg-emissions-intensity-index-chart-title" className="ghg-emissions-intensity-index-chart-title page-chrome-chart-title">
                                {chartTitle}
                            </h2>

                            {selectedTraceIds !== null && <ClearSelectionButton lang={lang} onClick={() => setSelectedTraceIds(null)} />}

                            <figure ref={chartRef} style={{ margin: 0 }}>
                                <div role="region" aria-label={chartRegionLabel} tabIndex="0">
                                    <Plot
                                        key={`ghg-emissions-intensity-index-${selectionKey}-${plotHeight}-${useStackedLayout ? 'stacked' : 'column'}`}
                                        data={SERIES_KEYS.map((key, traceIndex) => ({
                                            x: years,
                                            y: seriesValues[key],
                                            type: 'scatter',
                                            mode: 'lines',
                                            name: legendLabels[key],
                                            line: { color: lineColorFor(traceIndex, COLORS[key]), width: 2.5 },
                                            hovertemplate: hoverTemplates[traceIndex],
                                        }))}
                                        layout={{
                                            showlegend: false,
                                            clickmode: 'event',
                                            dragmode: false,
                                            hovermode: 'closest',
                                            hoverlabel: {
                                                bgcolor: '#ffffff',
                                                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
                                            },
                                            margin: { l: 72, r: 24, t: plotTopMargin, b: plotBottomMargin },
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
                                                range: [yTickvals[0], yTickvals[yTickvals.length - 1]],
                                                tickmode: 'array',
                                                tickvals: yTickvals,
                                                ticktext: yTickvals.map(String),
                                                showgrid: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                zeroline: false,
                                                tickfont: tickFont,
                                                automargin: true,
                                            },
                                        }}
                                        config={plotConfig}
                                        className="ghg-emissions-intensity-index-chart"
                                        useResizeHandler
                                        onClick={handleChartClick}
                                    />
                                </div>
                            </figure>

                            <HtmlLegend
                                className="ghg-emissions-intensity-index-legend"
                                variant="line"
                                itemClassName="ghg-emissions-intensity-index-legend-item"
                                markerClassName="ghg-emissions-intensity-index-legend-line"
                                items={SERIES_KEYS.map((key) => ({
                                    label: legendLabels[key],
                                    color: COLORS[key],
                                }))}
                            />

                            <div className="ghg-emissions-intensity-index-table-wrapper">
                                <ChartDataTable
                                    lang={lang}
                                    columns={tableColumns}
                                    rows={chartYears}
                                    csvFilename={`${chartDownloadSlug}.csv`}
                                    docx={{
                                        filename: `${chartDownloadSlug}.docx`,
                                        title: exportChartTitle,
                                        titleAlign: 'center',
                                        columnWidths: [900, 2800, 2800, 2800],
                                        fontSize: 20,
                                    }}
                                    caption={fill(getText('ghg_emissions_intensity_index_table_caption', lang), yearSpan)}
                                    tableAriaLabel={fill(getText('ghg_emissions_intensity_index_table_caption', lang), yearSpan)}
                                    renderCell={(raw, { colIndex }) => (
                                        colIndex === 0 ? String(raw ?? '') : formatIndex(raw)
                                    )}
                                />
                            </div>
                        </div>
                    </section>
                </div>}
            </div>
        </PageShell>
    );
};

export default GhgEmissionsIntensityIndex;
