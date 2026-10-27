import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import FootnoteMarker from '../components/FootnoteMarker';
import ClearSelectionButton from '../components/ClearSelectionButton';
import PageFootnotes from '../components/PageFootnotes';
import useWindowWidth from '../hooks/useWindowWidth';
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

import { makeScrollToIdHandler } from '../utils/scrollToId';
import { formatLocalePct } from '../utils/formatLocale';
import { exportTableToCsv, exportTableToDocx } from '../utils/exportTableToDocx';
import { getNaturalGasLiquidsEnergyUseData } from '../utils/dataLoader';

const PROVINCE_KEYS = ['alta', 'bc_ter', 'atl', 'que', 'ont', 'man', 'sask'];

const SPOKEN_PROVINCE = {
    alta: { en: 'Alberta', fr: 'Alberta' },
    bc_ter: { en: 'British Columbia and the territories', fr: 'Colombie-Britannique et les territoires' },
    atl: { en: 'Atlantic provinces', fr: 'Provinces de l\'Atlantique' },
    que: { en: 'Quebec', fr: 'Québec' },
    ont: { en: 'Ontario', fr: 'Ontario' },
    man: { en: 'Manitoba', fr: 'Manitoba' },
    sask: { en: 'Saskatchewan', fr: 'Saskatchewan' },
};

const PROVINCE_COLORS = {
    alta: '#7A6F4E',
    bc_ter: '#3CA1AF',
    atl: '#CE8003',
    que: '#657f9b',
    ont: '#4b4c4d',
    man: '#1f8093',
    sask: '#949494',
};

const STACKED_LAYOUT_BROWSER_ZOOM = 1.1;
const STACKED_LAYOUT_DETECTED_ZOOM = 1.0 + (STACKED_LAYOUT_BROWSER_ZOOM - 1.0) * 0.25;

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

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

const NaturalGasLiquidsEnergyUse = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [bundle, setBundle] = useState(null);
    const [loadState, setLoadState] = useState('loading');
    const [selectedSlices, setSelectedSlices] = useState(null);
    const windowWidth = useWindowWidth();
    const [pageCssZoom, setPageCssZoom] = useState(() => computePageZoomScale(null).pageCssZoom);
    const zoomBaselineRef = useRef(null);

    const chartRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const useStackedLayout = pageCssZoom >= STACKED_LAYOUT_DETECTED_ZOOM;
    const selectEnabled = windowWidth > 768;
    const effectiveSelectedSlices = selectEnabled ? selectedSlices : null;

    const yearData = bundle ?? {
        year: '',
        sectorRows: [],
        sectorTotalEnergy: 0,
        provinceTotalEnergy: 0,
        provinces: [],
    };
    const selectedYear = yearData.year;
    const textVars = { year: selectedYear };

    useEffect(() => {
        let cancelled = false;
        getNaturalGasLiquidsEnergyUseData()
            .then((data) => {
                if (cancelled) return;
                const ready = data?.sectorRows?.length === 5 && data?.provinces?.length === 7;
                setBundle(ready ? data : null);
                setLoadState(ready ? 'ready' : 'empty');
            })
            .catch(() => {
                if (!cancelled) setLoadState('empty');
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const formatPj = (value, digits = 1) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        });
    };

    const formatPct = (value, digits = 1) => formatLocalePct(value, lang, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });

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

    const provinceSlices = useMemo(() => (
        PROVINCE_KEYS.map((key) => {
            const entry = yearData.provinces.find((row) => row.key === key);
            return { key, pct: entry?.pct ?? 0, value: entry?.value ?? 0 };
        })
    ), [yearData]);

    const chartTitle = substitute(getText('natural_gas_liquids_energy_use_chart_title', lang), textVars);
    const exportChartTitle = stripHtml(chartTitle);
    const fileSlugBase = substitute(getText('natural_gas_liquids_energy_use_download_title', lang), textVars)
        .replace(/\s+/g, '_')
        .replace(/–/g, '-');

    const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18;
    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const useCompactLayout = windowWidth <= 768;

    const pieTrace = useMemo(() => {
        if (!provinceSlices.length) return null;
        const labels = provinceSlices.map((slice) => getText(`natural_gas_liquids_energy_use_province_${slice.key}`, lang));
        const values = provinceSlices.map((slice) => (slice.value > 0 ? slice.value : 0.001));
        const customdata = provinceSlices.map((slice) => slice.pct);
        const baseColors = provinceSlices.map((slice) => PROVINCE_COLORS[slice.key]);
        const markerColors = effectiveSelectedSlices?.length
            ? baseColors.map((color, index) => (effectiveSelectedSlices.includes(index) ? color : hexToRgba(color, 0.3)))
            : baseColors;
        const labelColors = markerColors;
        const pull = effectiveSelectedSlices?.length
            ? values.map((_, index) => (effectiveSelectedSlices.includes(index) ? 0.08 : 0.02))
            : values.map(() => 0.02);
        const hoverTexts = provinceSlices.map((slice) => {
            const label = getText(`natural_gas_liquids_energy_use_province_${slice.key}`, lang);
            return `<b>${label}</b><br>${formatPj(slice.value, 1)} PJ<br>${formatPct(slice.pct, 1)}`;
        });

        return {
            type: 'pie',
            values,
            labels,
            customdata,
            hole: 0.55,
            direction: 'clockwise',
            sort: false,
            texttemplate: useCompactLayout ? '%{customdata:.1f}%' : '%{label}<br>%{customdata:.1f}%',
            textinfo: useCompactLayout ? 'percent' : 'label+percent',
            textposition: useCompactLayout ? 'inside' : 'outside',
            textfont: {
                size: textSize,
                family: 'Arial, sans-serif',
                color: useCompactLayout ? '#ffffff' : labelColors,
            },
            outsidetextfont: { size: textSize, color: labelColors },
            insidetextfont: { color: '#ffffff', size: textSize, family: 'Arial, sans-serif' },
            marker: { colors: markerColors, line: { color: '#ffffff', width: 1 } },
            pull,
            hovertext: hoverTexts,
            hoverinfo: 'text',
            hoverlabel: {
                bgcolor: '#ffffff',
                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
            },
            automargin: true,
        };
    }, [provinceSlices, lang, textSize, useCompactLayout, effectiveSelectedSlices, locale]);

    const centerTotal = Math.round(yearData.provinceTotalEnergy);
    const centerLabel = getText('natural_gas_liquids_energy_use_center_total', lang);
    const centerText = `${centerLabel}<br><b>${formatPj(centerTotal, 0)}</b><br>PJ`;

    const scrollToFootnote = makeScrollToIdHandler('fn-asterisk-natural-gas-liquids-energy-use');

    const scrollToRef = makeScrollToIdHandler('fn-asterisk-rf-natural-gas-liquids-energy-use');

    const tableTitle = substitute(getText('natural_gas_liquids_energy_use_table_title', lang), {
        ...textVars,
        total: formatPj(yearData.sectorTotalEnergy, 0),
    });
    const summaryCaption = substitute(getText('natural_gas_liquids_energy_use_summary_table_caption', lang), textVars);
    const chartTableCaption = substitute(getText('natural_gas_liquids_energy_use_table_caption', lang), textVars);
    const summaryFileSlug = lang === 'en'
        ? `natural_gas_liquids_energy_use_by_sector_${selectedYear}`
        : `utilisation_lgn_par_secteur_${selectedYear}`;

    const sectorCellFontSize = pageCssZoom >= 4 ? '0.55rem'
        : pageCssZoom >= 3 ? '0.65rem'
        : pageCssZoom >= 2 ? '0.75rem'
        : pageCssZoom >= 1.5 ? '0.85rem'
        : '1rem';
    const exportSummaryTitle = stripHtml(tableTitle);

    const centerFontSize = useMemo(() => {
        const base = useCompactLayout
            ? (windowWidth <= 480 ? 14 : windowWidth <= 640 ? 16 : 18)
            : 22;
        if (pageCssZoom >= 5) return Math.min(base, 9);
        if (pageCssZoom >= 4) return Math.min(base, 11);
        if (pageCssZoom >= 3) return Math.min(base, 13);
        if (pageCssZoom >= 2) return Math.min(base, 16);
        if (pageCssZoom >= 1.5) return Math.min(base, 18);
        return base;
    }, [useCompactLayout, windowWidth, pageCssZoom]);

    const plotLayout = useMemo(() => {
        const legendConfig = useCompactLayout ? (
            windowWidth <= 384
                ? { orientation: 'h', y: -0.5, x: 0.5, xanchor: 'center', yanchor: 'top', font: { size: 9 }, itemclick: false, itemdoubleclick: false }
                : windowWidth <= 480
                    ? { orientation: 'h', y: -0.15, x: 0.5, xanchor: 'center', yanchor: 'top', font: { size: 9 }, itemclick: false, itemdoubleclick: false }
                    : windowWidth <= 640
                        ? { orientation: 'h', y: -0.15, x: 0.5, xanchor: 'center', yanchor: 'top', font: { size: 10 }, itemclick: false, itemdoubleclick: false }
                        : { orientation: 'h', y: -0.12, x: 0.5, xanchor: 'center', yanchor: 'top', font: { size: 11 }, itemclick: false, itemdoubleclick: false }
        ) : undefined;

        const margin = useCompactLayout
            ? (windowWidth <= 384 ? { l: 8, r: 8, t: 16, b: 120 } : windowWidth <= 480 ? { l: 8, r: 8, t: 16, b: 100 } : { l: 8, r: 8, t: 16, b: 90 })
            : { l: 40, r: 40, t: 24, b: 40 };

        return {
            showlegend: useCompactLayout,
            legend: legendConfig,
            margin,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            autosize: true,
            clickmode: 'event',
            annotations: [{
                x: 0.5,
                y: 0.5,
                text: centerText,
                showarrow: false,
                xref: 'paper',
                yref: 'paper',
                font: {
                    size: centerFontSize,
                    color: '#424243',
                    family: 'Arial Black, sans-serif',
                },
            }],
        };
    }, [centerText, centerFontSize, useCompactLayout, windowWidth]);

    const sectorTableColumns = useMemo(() => [
        { key: 'sector', header: getText('natural_gas_liquids_energy_use_summary_col_sector', lang), align: 'left' },
        { key: 'energyUse', header: getText('natural_gas_liquids_energy_use_summary_col_energy', lang), align: 'num' },
        { key: 'pct', header: getText('natural_gas_liquids_energy_use_summary_col_share', lang), align: 'num' },
    ], [lang]);

    const sectorTableRows = useMemo(() => [
        ...yearData.sectorRows.map((row) => ({
            sector: getText(`natural_gas_liquids_energy_use_sector_${row.key}`, lang),
            energyUse: row.energyUse,
            pct: row.pct,
            isTotal: false,
        })),
        {
            sector: getText('natural_gas_liquids_energy_use_sector_total', lang),
            energyUse: yearData.sectorTotalEnergy,
            pct: 100,
            isTotal: true,
        },
    ], [yearData, lang]);

    const chartTableColumns = useMemo(() => [
        { key: 'province', header: getText('natural_gas_liquids_energy_use_table_col_province', lang), align: 'left' },
        { key: 'energyUse', header: getText('natural_gas_liquids_energy_use_table_col_energy', lang), align: 'num' },
        { key: 'pct', header: getText('natural_gas_liquids_energy_use_table_col_share', lang), align: 'num' },
    ], [lang]);

    const chartTableRows = useMemo(
        () => provinceSlices.map((slice) => ({
            province: getText(`natural_gas_liquids_energy_use_province_${slice.key}`, lang),
            energyUse: slice.value,
            pct: slice.pct,
        })),
        [provinceSlices, lang],
    );

    const handlePieClick = (data) => {
        if (!data?.points?.length) return;
        const sliceIndex = data.points[0].pointNumber ?? data.points[0].pointIndex;
        if (sliceIndex === undefined || sliceIndex < 0) return;

        if (windowWidth <= 768) {
            const currentTime = Date.now();
            const lastClick = lastPieClickRef.current;
            const isSameSlice = sliceIndex === lastClick.index && lastClick.index != null;
            const isDoubleTap = isSameSlice && currentTime - lastClick.time < 300;
            lastPieClickRef.current = { time: currentTime, index: sliceIndex };
            if (!isDoubleTap) return;
        }

        setSelectedSlices((prev) => {
            if (prev === null) return [sliceIndex];
            if (prev.includes(sliceIndex)) {
                const next = prev.filter((index) => index !== sliceIndex);
                return next.length === 0 ? null : next;
            }
            return [...prev, sliceIndex];
        });
    };

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${fileSlugBase}.png`,
        title: exportChartTitle,
        width: 1200,
        height: 800,
        legendItems: provinceSlices.map((slice) => ({
            label: getText(`natural_gas_liquids_energy_use_province_${slice.key}`, lang),
            color: PROVINCE_COLORS[slice.key],
        })),
    }),
        [PROVINCE_COLORS, exportChartTitle, fileSlugBase, getText, lang, provinceSlices],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        name: getText('natural_gas_liquids_energy_use_download_chart', lang),
        click: (gd) => downloadChartWithTitle(gd),
    });

    const formatShareSpoken = (value) => {
        const formatted = formatLocalePct(value, lang, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
            suffix: false,
        });
        return `${formatted} ${lang === 'en' ? 'percent' : 'pour cent'}`;
    };
    const spokenProvince = (key) => SPOKEN_PROVINCE[key]?.[lang === 'fr' ? 'fr' : 'en'] || key;

    const getChartSummary = () => {
        if (!provinceSlices.length) return '';
        const body = summarizeByCategory({
            categories: provinceSlices.map((slice) => spokenProvince(slice.key)),
            series: [
                { name: lang === 'en' ? 'Energy use' : "Consommation d'énergie", values: provinceSlices.map((slice) => slice.value), format: (v) => `${formatPj(v, 1)} PJ` },
                { name: lang === 'en' ? 'Share' : 'Part', values: provinceSlices.map((slice) => slice.pct), format: formatShareSpoken },
            ],
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Donut chart showing natural gas liquids energy use by province in ${selectedYear}`
                : `Graphique en anneau montrant la consommation d'énergie tirée des liquides de gaz naturel par province en ${selectedYear}`,
            unitNote: lang === 'en'
                ? `Total energy use was ${formatPj(centerTotal, 0)} petajoules`
                : `La consommation totale était de ${formatPj(centerTotal, 0)} pétajoules`,
            body,
            lang,
        });
    };
    const chartRegionLabel = `${exportChartTitle}. ${getChartSummary()}`;

    const renderSectorCell = (raw, { colIndex, row }) => {
        if (colIndex === 0) return String(raw ?? '');
        if (colIndex === 1) return formatPj(raw, 1);
        return formatPct(raw, row?.isTotal ? 0 : 1);
    };

    const sectorExportRows = () => sectorTableRows.map((row) => [
        renderSectorCell(row.sector, { colIndex: 0, row }),
        renderSectorCell(row.energyUse, { colIndex: 1, row }),
        renderSectorCell(row.pct, { colIndex: 2, row }),
    ]);

    const renderChartCell = (raw, { colIndex }) => {
        if (colIndex === 0) return String(raw ?? '');
        if (colIndex === 1) return formatPj(raw, 1);
        return formatPct(raw, 1);
    };

    return (
        <PageShell id="main-content"
            tabIndex="-1"
            className="page-content natural-gas-liquids-energy-use page-chrome page-chrome--bleed"
            role="main"
            aria-labelledby="natural-gas-liquids-energy-use-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.natural-gas-liquids-energy-use {
}
.natural-gas-liquids-energy-use-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.natural-gas-liquids-energy-use-title {
    text-transform: none;
}
.natural-gas-liquids-energy-use-content-row {
    display: flex;
    flex-direction: row;
    width: 100%;
    gap: 28px;
    align-items: stretch;
}
.natural-gas-liquids-energy-use-table-column {
    width: 42%;
    min-width: 260px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
}
.natural-gas-liquids-energy-use-table-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}
.natural-gas-liquids-energy-use-table-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow-wrap: break-word;
    word-wrap: break-word;
    line-height: 1.2;
}
.natural-gas-liquids-energy-use-summary-table-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
}
.natural-gas-liquids-energy-use-summary-table {
    width: 100%;
    height: 100%;
    border-collapse: collapse;
    font-family: Arial, sans-serif;
    font-size: 0.9rem;
    table-layout: fixed;
}
.natural-gas-liquids-energy-use-summary-table th,
.natural-gas-liquids-energy-use-summary-table td {
    border: 1px solid #ddd;
    padding: 8px 12px;
    text-align: center;
}
.natural-gas-liquids-energy-use-summary-table thead th {
    background-color: #423330;
    color: white;
    font-weight: bold;
    font-size: 1.05rem;
}
.natural-gas-liquids-energy-use-summary-table .natural-gas-liquids-energy-use-sector-cell {
    text-align: left;
    background-color: #423330;
    color: white;
    font-weight: bold;
    font-size: ${sectorCellFontSize};
    white-space: normal;
    overflow-wrap: anywhere;
    word-wrap: break-word;
    hyphens: auto;
    vertical-align: middle;
    line-height: 1.2;
}
.natural-gas-liquids-energy-use-summary-table tbody tr:nth-child(even):not(.natural-gas-liquids-energy-use-summary-total-row) {
    background-color: #42333080;
}
.natural-gas-liquids-energy-use-summary-table tbody tr:hover:not(.natural-gas-liquids-energy-use-summary-total-row) {
    box-shadow: inset 0 0 0 9999px rgba(0, 0, 0, 0.2);
    background-color: transparent;
}
.natural-gas-liquids-energy-use-summary-table tbody {
    height: 100%;
}
.natural-gas-liquids-energy-use-summary-table tbody tr {
    height: calc(100% / 7);
}
.natural-gas-liquids-energy-use-summary-table tbody td {
    vertical-align: middle;
}
.natural-gas-liquids-energy-use-summary-total-row td,
.natural-gas-liquids-energy-use-summary-total-row th:not(.natural-gas-liquids-energy-use-sector-cell) {
    background-color: #423330;
    color: white;
    font-weight: bold;
}
.natural-gas-liquids-energy-use-summary-total-row .natural-gas-liquids-energy-use-sector-cell {
    background-color: #423330;
    color: white;
}
.natural-gas-liquids-energy-use-summary-download-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 15px;
}
.natural-gas-liquids-energy-use-summary-download-buttons button {
    padding: 8px 16px;
    background-color: #8c8c8c;
    border: 1px solid #404040;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.natural-gas-liquids-energy-use-summary-download-buttons button:hover {
    background-color: #404040 !important;
}
.natural-gas-liquids-energy-use-chart-column {
    width: 58%;
    min-width: 0;
    box-sizing: border-box;
}
.natural-gas-liquids-energy-use-chart-title {
    color: var(--gc-text);
    margin-bottom: 12px;
    text-transform: none;
}
.natural-gas-liquids-energy-use-chart { width: 100%; min-width: 0; height: ${plotHeight}px; position: relative; }
.natural-gas-liquids-energy-use-chart > div { width: 100%; height: 100%; }
.natural-gas-liquids-energy-use-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.natural-gas-liquids-energy-use-chart-frame button[type="button"]:hover { background-color: #404040 !important; }
.layout-stacked.natural-gas-liquids-energy-use-content-row { flex-direction: column !important; }
.layout-stacked .natural-gas-liquids-energy-use-table-column,
.layout-stacked .natural-gas-liquids-energy-use-chart-column { width: 100% !important; min-width: 0 !important; }
.layout-stacked .natural-gas-liquids-energy-use-table-column { margin-bottom: 28px; }
.layout-stacked .natural-gas-liquids-energy-use-summary-table tbody tr { height: auto; }
@media (max-width: 768px) {
    .natural-gas-liquids-energy-use-table-title { font-size: 26px; }
    .natural-gas-liquids-energy-use-summary-table { font-size: 0.75rem; }
    .natural-gas-liquids-energy-use-summary-table tbody tr { height: auto; }
}
@media (max-width: 992px) {
    .natural-gas-liquids-energy-use-summary-table { font-size: 0.75rem; }
    .natural-gas-liquids-energy-use-summary-table th,
    .natural-gas-liquids-energy-use-summary-table td { padding: 6px 8px; }
}
            `}</style>

            <div className="natural-gas-liquids-energy-use-inner">
                <h1 id="natural-gas-liquids-energy-use-title" className="natural-gas-liquids-energy-use-title page-chrome-title">
                    {getText('natural_gas_liquids_energy_use_title', lang)}
                </h1>

                {loadState === 'empty' && (
                    <p>{getText('natural_gas_liquids_energy_use_no_data', lang)}</p>
                )}
                {loadState === 'ready' && (
                <div className={`natural-gas-liquids-energy-use-content-row ${useStackedLayout ? 'layout-stacked' : ''}`}>
                    <section className="natural-gas-liquids-energy-use-table-column" aria-labelledby="natural-gas-liquids-energy-use-table-title">
                        <div className="natural-gas-liquids-energy-use-table-panel">
                            <h2 id="natural-gas-liquids-energy-use-table-title" className="natural-gas-liquids-energy-use-table-title">
                                {tableTitle}
                            </h2>
                            <div className="natural-gas-liquids-energy-use-summary-table-wrap">
                                <table className="natural-gas-liquids-energy-use-summary-table">
                                    <colgroup>
                                        <col style={{ width: '44%' }} />
                                        <col style={{ width: '28%' }} />
                                        <col style={{ width: '28%' }} />
                                    </colgroup>
                                    <caption id="natural-gas-liquids-energy-use-summary-caption" className="wb-inv">
                                        {summaryCaption}
                                    </caption>
                                    <thead>
                                        <tr>
                                            <th scope="col">{getText('natural_gas_liquids_energy_use_summary_col_sector', lang)}</th>
                                            <th scope="col">
                                                {getText('natural_gas_liquids_energy_use_summary_col_energy', lang)}
                                                <FootnoteMarker
                                                    lang={lang}
                                                    href="#fn-asterisk-natural-gas-liquids-energy-use"
                                                    id="fn-asterisk-rf-natural-gas-liquids-energy-use"
                                                    marker="*"
                                                    onClick={scrollToFootnote}
                                                />
                                            </th>
                                            <th scope="col">{getText('natural_gas_liquids_energy_use_summary_col_share', lang)}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {yearData.sectorRows.map((row) => (
                                            <tr key={row.key}>
                                                <th scope="row" className="natural-gas-liquids-energy-use-sector-cell">
                                                    {getText(`natural_gas_liquids_energy_use_sector_${row.key}`, lang)}
                                                </th>
                                                <td>{formatPj(row.energyUse, 1)}</td>
                                                <td>{formatPct(row.pct, 1)}</td>
                                            </tr>
                                        ))}
                                        <tr className="natural-gas-liquids-energy-use-summary-total-row">
                                            <th scope="row" className="natural-gas-liquids-energy-use-sector-cell">
                                                {getText('natural_gas_liquids_energy_use_sector_total', lang)}
                                            </th>
                                            <td>{formatPj(yearData.sectorTotalEnergy, 1)}</td>
                                            <td>{formatPct(100, 0)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div className="natural-gas-liquids-energy-use-summary-download-buttons">
                                <button
                                    type="button"
                                    onClick={() => exportTableToCsv({
                                        filename: summaryFileSlug,
                                        headers: sectorTableColumns.map((col) => col.header),
                                        rows: sectorExportRows(),
                                    })}
                                >
                                    {getText('natural_gas_liquids_energy_use_download_csv', lang)}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => exportTableToDocx({
                                        filename: summaryFileSlug,
                                        title: exportSummaryTitle,
                                        headers: sectorTableColumns.map((col) => col.header),
                                        rows: sectorExportRows(),
                                        columnWidths: [4200, 2200, 2200],
                                        options: { titleAlign: 'center', fontSize: 18 },
                                    })}
                                >
                                    {getText('natural_gas_liquids_energy_use_download_docx', lang)}
                                </button>
                            </div>
                        </div>
                    </section>

                    <section className="natural-gas-liquids-energy-use-chart-column" aria-labelledby="natural-gas-liquids-energy-use-chart-title">
                        <div className="natural-gas-liquids-energy-use-chart-frame page-chrome-chart-frame">
                            <h2 id="natural-gas-liquids-energy-use-chart-title" className="natural-gas-liquids-energy-use-chart-title page-chrome-chart-title">
                                {chartTitle}
                            </h2>

                            {effectiveSelectedSlices != null && (
                                <ClearSelectionButton lang={lang} onClick={() => setSelectedSlices(null)} />
                            )}

                            <figure ref={chartRef} className="natural-gas-liquids-energy-use-chart-figure" role="region" aria-label={chartRegionLabel} tabIndex={0} style={{ margin: 0 }}>
                                <div aria-hidden="true">
                                {pieTrace && (
                                    <Plot
                                        key={`natural-gas-liquids-energy-use-pie-${selectedYear}-${effectiveSelectedSlices ? effectiveSelectedSlices.join('-') : 'all'}-${plotHeight}`}
                                        data={[pieTrace]}
                                        layout={plotLayout}
                                        style={{ width: '100%', height: `${plotHeight}px` }}
                                        config={plotConfig}
                                        className="natural-gas-liquids-energy-use-chart"
                                        useResizeHandler
                                        onClick={handlePieClick}
                                    />
                                )}
                                </div>
                            </figure>

                            <div className="natural-gas-liquids-energy-use-table-wrapper">
                                <ChartDataTable
                                    lang={lang}
                                    columns={chartTableColumns}
                                    rows={chartTableRows}
                                    csvFilename={`${fileSlugBase}.csv`}
                                    docx={{
                                        filename: `${fileSlugBase}.docx`,
                                        title: exportChartTitle,
                                        titleAlign: 'center',
                                        columnWidths: [4200, 2200, 1800],
                                        fontSize: 18,
                                    }}
                                    caption={chartTableCaption}
                                    tableAriaLabel={chartTableCaption}
                                    renderCell={renderChartCell}
                                />
                            </div>
                        </div>
                    </section>
                </div>
                )}

                <PageFootnotes
                    lang={lang}
                    titleId="fn-natural-gas-liquids-energy-use"
                    items={[
                        { id: 'fn-asterisk-natural-gas-liquids-energy-use', marker: '*', text: getText('natural_gas_liquids_energy_use_summary_footnote', lang), returnHref: '#fn-asterisk-rf-natural-gas-liquids-energy-use' },
                    ]}
                />
            </div>
        </PageShell>
    );
};

export default NaturalGasLiquidsEnergyUse;
