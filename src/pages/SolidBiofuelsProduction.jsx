import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import useWindowWidth from '../hooks/useWindowWidth';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getSolidBiofuelsProductionData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import { formatLocalePct } from '../utils/formatLocale';
import hexToRgba from '../utils/hexToRgba';

const BAR_KEYS = ['pulping', 'swr', 'firewood', 'pellets'];
const PIE_KEYS = ['industrial', 'electricity', 'residential'];
const BAR_COLORS = {
    pulping: '#2B5C3F',
    swr: '#5E9348',
    firewood: '#A4C639',
    pellets: '#4b4c4d',
};
const PIE_COLORS = {
    industrial: '#2B5C3F',
    electricity: '#A4C639',
    residential: '#5E9348',
};
const PIE_LABEL_KEYS = {
    industrial: 'solid_biofuels_label_industrial',
    electricity: 'solid_biofuels_label_electricity',
    residential: 'solid_biofuels_label_residential',
};
const BAR_LEGEND_KEYS = {
    pulping: 'solid_biofuels_legend_pulping',
    swr: 'solid_biofuels_legend_swr',
    firewood: 'solid_biofuels_legend_firewood',
    pellets: 'solid_biofuels_legend_pellets',
};


const HOVER_LABEL = {
    bgcolor: '#ffffff',
    bordercolor: '#000000',
    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
};

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

/** ~400% browser zoom — same DPR band as retail prices chart. */
const solid_biofuels_VERTICAL_TICK_ZOOM_MIN = 3.55;
const solid_biofuels_VERTICAL_TICK_ZOOM_MAX = 5.45;
const LIKELY_OS_DPR_BASES = [1, 1.25, 1.3333333333333333, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5];

function isZoomRatioInSolidBiofuelsProductionVerticalBand(z) {
    return z >= solid_biofuels_VERTICAL_TICK_ZOOM_MIN && z <= solid_biofuels_VERTICAL_TICK_ZOOM_MAX;
}

function isBrowserZoomInSolidBiofuelsProductionVerticalRange() {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    return LIKELY_OS_DPR_BASES.some((b) => {
        const z = dpr / b;
        return isZoomRatioInSolidBiofuelsProductionVerticalBand(z);
    });
}

function isPinchScaleInSolidBiofuelsProductionVerticalBand(s) {
    return typeof s === 'number' && s > 1.02 && isZoomRatioInSolidBiofuelsProductionVerticalBand(s);
}

const markerOpacityFor = (selectedPoints, length, traceIndex) => {
    if (selectedPoints === null) return 1;
    return Array.from({ length }, (_, i) => (selectedPoints[traceIndex]?.includes(i) ? 1 : 0.3));
};

const SolidBiofuelsProduction = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedBarPoints, setSelectedBarPoints] = useState(null);
    const [selectedPieSlices, setSelectedPieSlices] = useState(null);
    const windowWidth = useWindowWidth();
    const [useVerticalBarTicks, setUseVerticalBarTicks] = useState(false);

    const barChartRef = useRef(null);
    const pieChartRef = useRef(null);
    const barLastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
    const pieLastClickRef = useRef({ time: 0, index: null });

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    const formatPj = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const formatPct = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return String(value);
    };

    const formatShareSpoken = (value) => {
        const formatted = formatLocalePct(value, lang, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 1,
            suffix: false,
        });
        return `${formatted} ${lang === 'en' ? 'percent' : 'pour cent'}`;
    };

    useEffect(() => {
        getSolidBiofuelsProductionData()
            .then(setResult)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const syncViewport = () => {
            const s = window.visualViewport?.scale ?? 1;
            const pinchVertical = isPinchScaleInSolidBiofuelsProductionVerticalBand(s);
            setUseVerticalBarTicks(pinchVertical || isBrowserZoomInSolidBiofuelsProductionVerticalRange());
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

    const tableRows = result?.data || [];
    const years = tableRows.map((row) => row.year);
    const startYear = result?.startYear;
    const endYear = result?.endYear;
    const referenceYear = result?.referenceYear;
    const pieYear = referenceYear;
    const pieRow = pieYear == null ? null : tableRows.find((row) => row.year === pieYear) || null;
    const yearTicks = years.filter((y) => y % 2 === 1);

    const barChartTitle = substitute(getText('solid_biofuels_bar_chart_title', lang), { year: endYear ?? '' });
    const pieChartTitle = substitute(getText('solid_biofuels_pie_chart_title', lang), { year: pieYear ?? '' });
    const exportBarChartTitle = stripHtml(barChartTitle);
    const exportPieChartTitle = stripHtml(pieChartTitle);
    const barFileTitle = `${getText('solid_biofuels_download_bar_title', lang)}_${startYear}-${endYear}`;
    const pieFileTitle = `${getText('solid_biofuels_download_pie_title', lang)}_${pieYear ?? ''}`;
    const barCaption = substitute(getText('solid_biofuels_table_caption_bar', lang), { startYear, endYear });
    const pieCaption = substitute(getText('solid_biofuels_table_caption_pie', lang), { startYear, endYear });

    const barTableColumns = useMemo(() => [
        { key: 'year', header: getText('solid_biofuels_table_col_year', lang), align: 'left' },
        ...BAR_KEYS.map((key) => ({
            key,
            header: `${getText(BAR_LEGEND_KEYS[key], lang)} (PJ)`,
            align: 'num',
        })),
        { key: 'barTotal', header: getText('solid_biofuels_table_col_total', lang), align: 'num' },
    ], [lang]);

    const pieTableColumns = useMemo(() => [
        { key: 'year', header: getText('solid_biofuels_table_col_year', lang), align: 'left' },
        { key: 'total', header: getText('solid_biofuels_table_col_total', lang), align: 'num' },
        ...PIE_KEYS.map((key) => ({
            key,
            header: `${getText(PIE_LABEL_KEYS[key], lang)} (PJ)`,
            align: 'num',
        })),
        ...PIE_KEYS.map((key) => ({
            key: `${key}_pct`,
            header: `${getText(PIE_LABEL_KEYS[key], lang)} (%)`,
            align: 'num',
        })),
    ], [lang]);

    const pieTableRows = useMemo(() => tableRows.map((row) => {
        const next = {
            year: row.year,
            total: row.total,
            industrial: row.industrial,
            electricity: row.electricity,
            residential: row.residential,
        };
        PIE_KEYS.forEach((key) => {
            const slice = row.pieSlices?.find((item) => item.key === key);
            next[`${key}_pct`] = slice?.pct ?? null;
        });
        return next;
    }), [tableRows]);

    const barPlotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const piePlotHeight = windowWidth <= 480 ? 430 : 520;
    const zoomLegendMode = windowWidth <= 800;
    const pieTextSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 17;

    const toggleBarSelection = useCallback((traceIndex, pointIndex) => {
        if (windowWidth <= 768) {
            const currentTime = Date.now();
            const lastClick = barLastClickRef.current;
            const isSamePoint =
                traceIndex === lastClick.traceIndex
                && pointIndex === lastClick.pointIndex
                && lastClick.traceIndex != null;
            const isDoubleTap = isSamePoint && currentTime - lastClick.time < 300;
            barLastClickRef.current = { time: currentTime, traceIndex, pointIndex };
            if (!isDoubleTap) return;
        }

        setSelectedBarPoints((prev) => {
            if (prev === null) {
                const newSelection = BAR_KEYS.map(() => []);
                newSelection[traceIndex].push(pointIndex);
                return newSelection;
            }
            const isSelected = prev[traceIndex]?.includes(pointIndex);
            if (isSelected) {
                const newSelection = prev.map((tracePoints, idx) =>
                    idx === traceIndex ? tracePoints.filter((p) => p !== pointIndex) : [...tracePoints],
                );
                return newSelection.every((arr) => arr.length === 0) ? null : newSelection;
            }
            return prev.map((tracePoints, idx) =>
                idx === traceIndex ? [...tracePoints, pointIndex] : [...tracePoints],
            );
        });
    }, [windowWidth]);

    const togglePieSelection = useCallback((sliceIndex) => {
        if (windowWidth <= 768) {
            const currentTime = Date.now();
            const lastClick = pieLastClickRef.current;
            const isSamePoint = sliceIndex === lastClick.index && lastClick.index != null;
            const isDoubleTap = isSamePoint && currentTime - lastClick.time < 300;
            pieLastClickRef.current = { time: currentTime, index: sliceIndex };
            if (!isDoubleTap) return;
        }

        setSelectedPieSlices((prev) => {
            if (prev === null) return [sliceIndex];
            if (prev.includes(sliceIndex)) {
                const next = prev.filter((i) => i !== sliceIndex);
                return next.length ? next : null;
            }
            return [...prev, sliceIndex];
        });
    }, [windowWidth]);

    const bindPlotClickHandler = useCallback((graphDiv, handler, storageKey) => {
        if (!graphDiv?.on) return;
        if (graphDiv[storageKey]) {
            graphDiv.removeListener('plotly_click', graphDiv[storageKey]);
        }
        graphDiv[storageKey] = handler;
        graphDiv.on('plotly_click', handler);
    }, []);

    const handleBarClick = useCallback((event) => {
        const point = event?.points?.[0];
        if (!point) return;
        const traceIndex = point.curveNumber;
        const pointIndex = point.pointIndex;
        if (traceIndex == null || traceIndex < 0 || traceIndex >= BAR_KEYS.length) return;
        if (pointIndex == null || pointIndex < 0) return;
        toggleBarSelection(traceIndex, pointIndex);
    }, [toggleBarSelection]);

    const handlePieClick = useCallback((event) => {
        const point = event?.points?.[0];
        if (!point) return;
        const sliceIndex = point.pointNumber ?? point.pointIndex;
        if (sliceIndex == null || sliceIndex < 0) return;
        togglePieSelection(sliceIndex);
    }, [togglePieSelection]);

    const onBarInitialized = useCallback(
        (_figure, graphDiv) => bindPlotClickHandler(graphDiv, handleBarClick, '_solidBiofuelsBarClick'),
        [bindPlotClickHandler, handleBarClick],
    );

    const onPieInitialized = useCallback(
        (_figure, graphDiv) => bindPlotClickHandler(graphDiv, handlePieClick, '_solidBiofuelsPieClick'),
        [bindPlotClickHandler, handlePieClick],
    );

    const hoverUnit = lang === 'en' ? ' PJ' : ' PJ';

    const barTraces = BAR_KEYS.map((key, traceIndex) => {
        const label = getText(BAR_LEGEND_KEYS[key], lang);
        const values = tableRows.map((row) => row[key]);
        const opacities = markerOpacityFor(selectedBarPoints, values.length, traceIndex);
        return {
            type: 'bar',
            name: label,
            x: years,
            y: values,
            marker: {
                color: BAR_COLORS[key],
                opacity: opacities,
                line: { width: 0 },
            },
            hovertemplate: `<b>${label}</b><br>%{x}: %{customdata}${hoverUnit}<extra></extra>`,
            customdata: values.map((value) => formatPj(value)),
            hoverlabel: HOVER_LABEL,
        };
    });

    const pieCategories = pieRow?.pieSlices?.length
        ? PIE_KEYS.map((key) => pieRow.pieSlices.find((slice) => slice.key === key)).filter(Boolean)
        : [];
    const effectivePieSlices = windowWidth > 768 ? selectedPieSlices : null;
    const pieBaseColors = pieCategories.map((slice) => PIE_COLORS[slice.key]);
    const pieColors = effectivePieSlices?.length
        ? pieBaseColors.map((color, index) => (effectivePieSlices.includes(index) ? color : hexToRgba(color, 0.3)))
        : pieBaseColors;
    const pieValues = pieCategories.map((slice) => (slice.pj != null && slice.pj > 0 ? slice.pj : 0.001));

    const pieTrace = pieCategories.length ? {
        type: 'pie',
        values: pieValues,
        labels: pieCategories.map((slice) => getText(PIE_LABEL_KEYS[slice.key], lang)),
        customdata: pieCategories.map((slice) => slice.pct),
        hole: 0.55,
        direction: 'clockwise',
        sort: false,
        texttemplate: windowWidth <= 768 ? '%{customdata:.0f}%' : '%{label}<br>%{customdata:.0f}%',
        textinfo: windowWidth <= 768 ? 'percent' : 'label+percent',
        textposition: windowWidth <= 768 ? 'inside' : 'outside',
        textfont: { size: pieTextSize, family: 'Arial, sans-serif', color: windowWidth <= 768 ? '#ffffff' : pieColors },
        outsidetextfont: { size: pieTextSize, color: pieColors },
        marker: { colors: pieColors, line: { color: '#ffffff', width: 1 } },
        pull: effectivePieSlices?.length
            ? pieValues.map((_, index) => (effectivePieSlices.includes(index) ? 0.08 : 0.02))
            : pieValues.map(() => 0.02),
        hovertext: pieCategories.map((slice) => {
            const label = getText(PIE_LABEL_KEYS[slice.key], lang);
            return `<b>${label}</b><br>${formatPj(slice.pj)} PJ<br>${slice.pct ?? '—'}%`;
        }),
        hoverinfo: 'text',
        hoverlabel: HOVER_LABEL,
        automargin: true,
    } : null;

    const barBottomMargin = useVerticalBarTicks
        ? windowWidth <= 480
            ? 88
            : windowWidth <= 768
              ? 78
              : 68
        : windowWidth <= 480
          ? 72
          : 62;

    const barLayout = {
        barmode: 'stack',
        showlegend: false,
        hoverlabel: HOVER_LABEL,
        hovermode: 'closest',
        margin: { t: 20, b: barBottomMargin, l: 70, r: 20 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        height: barPlotHeight,
        xaxis: {
            type: 'category',
            tickmode: 'array',
            tickvals: yearTicks,
            ticktext: yearTicks.map(String),
            tickfont: tickFont,
            tickangle: useVerticalBarTicks ? 90 : 0,
            automargin: true,
            showline: true,
            linecolor: '#333',
            linewidth: 1,
            mirror: false,
            showgrid: false,
            fixedrange: true,
        },
        yaxis: {
            title: { text: getText('solid_biofuels_yaxis', lang), font: axisTitleFont, standoff: 12 },
            range: [0, 600],
            dtick: 100,
            tickfont: tickFont,
            showline: true,
            linecolor: '#333',
            linewidth: 1,
            mirror: false,
            showgrid: false,
            fixedrange: true,
        },
        clickmode: 'event',
        dragmode: false,
    };

    const pieLayout = {
        showlegend: zoomLegendMode,
        legend: zoomLegendMode ? {
            orientation: 'h',
            y: -0.12,
            x: 0.5,
            xanchor: 'center',
            yanchor: 'top',
            font: { size: 11 },
            itemclick: false,
            itemdoubleclick: false,
        } : undefined,
        margin: {
            t: 20,
            b: zoomLegendMode ? 120 : 70,
            l: windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 80,
            r: windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 190,
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        height: piePlotHeight,
        clickmode: 'event',
        dragmode: false,
        annotations: pieRow?.total != null ? [{
            text: `${getText('solid_biofuels_center_total', lang)}<br><b>${formatPj(pieRow.total)}</b><br>PJ`,
            showarrow: false,
            x: 0.5,
            y: 0.5,
            xref: 'paper',
            yref: 'paper',
            font: { size: windowWidth <= 480 ? 15 : 20, color: '#424243', family: 'Arial Black, sans-serif' },
        }] : [],
    };

        const downloadBarChartWithTitle = useChartPngDownloader(
            barChartRef,
            () => ({
            filename: `${barFileTitle}.png`,
            title: exportBarChartTitle,
            height: 800,
            legendItems: BAR_KEYS.map((key) => ({
                label: getText(BAR_LEGEND_KEYS[key], lang),
                color: BAR_COLORS[key],
            })),
        }),
            [BAR_COLORS, BAR_KEYS, BAR_LEGEND_KEYS, barFileTitle, exportBarChartTitle, getText, lang],
        );

        const downloadPieChartWithTitle = useChartPngDownloader(
            pieChartRef,
            () => ({
            filename: `${pieFileTitle}.png`,
            title: exportPieChartTitle,
            height: 800,
            legendItems: PIE_KEYS.map((key) => ({
                label: getText(PIE_LABEL_KEYS[key], lang),
                color: PIE_COLORS[key],
            })),
        }),
            [PIE_COLORS, PIE_KEYS, PIE_LABEL_KEYS, exportPieChartTitle, getText, lang, pieFileTitle],
        );

        const barChartConfig = buildPngOnlyPlotConfig({
            lang,
            click: (gd) => downloadBarChartWithTitle(gd),
            name: getText('solid_biofuels_download_bar_png', lang),
        });

        const pieChartConfig = buildPngOnlyPlotConfig({
            lang,
            click: (gd) => downloadPieChartWithTitle(gd),
            name: getText('solid_biofuels_download_pie_png', lang),
        });

    if (loading) {
        return (
            <PageStatus
                lang={lang}
                loading
                loadingMessage={lang === 'en' ? 'Loading data…' : 'Chargement des données…'}
                className="solid-biofuels-loading"
            />
        );
    }
    if (error) {
        return <PageStatus lang={lang} error={error} className="solid-biofuels-error" />;
    }
    if (!tableRows.length || !pieRow) {
        return <p className="solid-biofuels-error">{lang === 'en' ? 'No data available.' : 'Aucune donnée disponible.'}</p>;
    }

    const getChartSummary = () => {
        const body = summarizeByCategory({
            categories: years,
            series: BAR_KEYS.map((key) => ({
                name: getText(BAR_LEGEND_KEYS[key], lang),
                values: tableRows.map((row) => row[key]),
                format: formatPj,
            })),
            lang,
            newestFirst: true,
        });
        const pieBody = summarizeByCategory({
            categories: pieCategories.map((slice) => getText(PIE_LABEL_KEYS[slice.key], lang)),
            series: [
                {
                    name: lang === 'en' ? 'Energy' : 'Énergie',
                    values: pieCategories.map((slice) => slice.pj),
                    format: formatPj,
                },
                {
                    name: lang === 'en' ? 'Share' : 'Part',
                    values: pieCategories.map((slice) => slice.pct),
                    format: formatShareSpoken,
                },
            ],
            lang,
        });
        return {
            bar: joinChartSummary({
                intro: exportBarChartTitle,
                unitNote: lang === 'en' ? 'Values in petajoules' : 'Valeurs en pétajoules',
                body,
                lang,
            }),
            pie: joinChartSummary({
                intro: exportPieChartTitle,
                unitNote: lang === 'en' ? 'Energy values in petajoules' : 'Valeurs énergétiques en pétajoules',
                body: pieBody,
                lang,
            }),
        };
    };
    const summaries = getChartSummary();
    const barRegionLabel = summaries.bar;
    const pieRegionLabel = summaries.pie;

    return (
        <PageShell id="main-content"
            tabIndex="-1"
            className="page-content page-78 page-chrome page-chrome--bleed"
            role="main"
            aria-labelledby="solid-biofuels-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.page-78.page-content { max-width: none !important; overflow-x: visible !important; }
.page-78 {
}
.solid-biofuels-container { width: 100%; padding: 15px 0 0 0; box-sizing: border-box; }
.solid-biofuels-title {
    line-height: 1.25;
    text-transform: none;
}
.solid-biofuels-chart-frame {
    margin-bottom: 0;
}
.solid-biofuels-chart-title {
    color: var(--gc-text);
    margin-bottom: 12px;
    text-transform: none;
}
.solid-biofuels-chart-scroll { width: 100%; overflow: visible; position: relative; }
.solid-biofuels-chart { width: 100%; min-width: 0; position: relative; z-index: 1; overflow: visible; }
.solid-biofuels-chart > div { width: 100%; height: 100%; overflow: visible; }
.solid-biofuels-chart .js-plotly-plot,
.solid-biofuels-chart .plot-container,
.solid-biofuels-chart .svg-container { overflow: visible !important; pointer-events: auto !important; }
.solid-biofuels-legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 18px 28px;
    margin-top: 16px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: var(--gc-text);
}
.solid-biofuels-legend-item { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.solid-biofuels-legend-swatch { width: 22px; height: 14px; display: inline-block; border: 1px solid rgba(0, 0, 0, 0.12); }
.solid-biofuels-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.solid-biofuels-chart-frame button:hover { background-color: #404040 !important; }
.solid-biofuels-loading, .solid-biofuels-error {
    font-family: 'Noto Sans', sans-serif;
    font-size: 18px;
    color: var(--gc-text);
    margin: 24px 0;
}
            `}</style>

            <div className="solid-biofuels-container">
                <h1 id="solid-biofuels-title" className="solid-biofuels-title page-chrome-title">{getText('solid_biofuels_title', lang)}</h1>

                <div className="solid-biofuels-chart-frame page-chrome-chart-frame" style={{ marginBottom: 24 }}>
                    <h2 id="solid-biofuels-bar-chart-title" className="solid-biofuels-chart-title page-chrome-chart-title">{barChartTitle}</h2>
                    {selectedBarPoints && <ClearSelectionButton lang={lang} onClick={() => setSelectedBarPoints(null)} />}
                    <div className="solid-biofuels-chart-scroll">
                        <div ref={barChartRef} className="solid-biofuels-chart" role="region" aria-label={barRegionLabel} tabIndex={0}>
                            <div aria-hidden="true" style={{ width: '100%', height: '100%' }}>
                            <Plot
                                key={`solid-biofuels-bar-${useVerticalBarTicks ? 'v' : 'h'}-${barPlotHeight}`}
                                data={barTraces}
                                layout={barLayout}
                                config={barChartConfig}
                                useResizeHandler
                                style={{ width: '100%', height: '100%' }}
                                onInitialized={onBarInitialized}
                                onUpdate={onBarInitialized}
                            />
                            </div>
                        </div>
                    </div>
                    <div className="solid-biofuels-legend" aria-hidden="false">
                        {BAR_KEYS.map((key) => (
                            <span key={key} className="solid-biofuels-legend-item">
                                <span className="solid-biofuels-legend-swatch" style={{ backgroundColor: BAR_COLORS[key] }} />
                                {getText(BAR_LEGEND_KEYS[key], lang)}
                            </span>
                        ))}
                    </div>
                    <div className="solid-biofuels-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={barTableColumns}
                            rows={tableRows}
                            csvFilename={`${barFileTitle}.csv`}
                            docx={{
                                filename: `${barFileTitle}.docx`,
                                title: barCaption,
                                titleAlign: 'center',
                                columnWidths: [1200, 1800, 2000, 1800, 1800, 1600],
                                fontSize: 22,
                            }}
                            caption={barCaption}
                            tableAriaLabel={barCaption}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatPj(raw)
                            )}
                        />
                    </div>
                </div>

                <div className="solid-biofuels-chart-frame page-chrome-chart-frame">
                    <h2 id="solid-biofuels-pie-chart-title" className="solid-biofuels-chart-title page-chrome-chart-title">{pieChartTitle}</h2>
                    {selectedPieSlices && <ClearSelectionButton lang={lang} onClick={() => setSelectedPieSlices(null)} />}
                    <div className="solid-biofuels-chart-scroll">
                        <div ref={pieChartRef} className="solid-biofuels-chart" role="region" aria-label={pieRegionLabel} tabIndex={0}>
                            <div aria-hidden="true" style={{ width: '100%', height: '100%' }}>
                            {pieTrace && (
                                <Plot
                                    key={`solid-biofuels-pie-${pieYear}-${zoomLegendMode ? 'compact' : 'wide'}-${effectivePieSlices ? effectivePieSlices.join('-') : 'none'}`}
                                    data={[pieTrace]}
                                    layout={pieLayout}
                                    config={pieChartConfig}
                                    useResizeHandler
                                    style={{ width: '100%', height: '100%' }}
                                    onInitialized={onPieInitialized}
                                    onUpdate={onPieInitialized}
                                />
                            )}
                            </div>
                        </div>
                    </div>
                    {!zoomLegendMode && (
                        <div className="solid-biofuels-legend" aria-hidden="false">
                            {PIE_KEYS.map((key) => (
                                <span key={key} className="solid-biofuels-legend-item">
                                    <span className="solid-biofuels-legend-swatch" style={{ backgroundColor: PIE_COLORS[key] }} />
                                    {getText(PIE_LABEL_KEYS[key], lang)}
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="solid-biofuels-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={pieTableColumns}
                            rows={pieTableRows}
                            csvFilename={`${pieFileTitle}.csv`}
                            docx={{
                                filename: `${pieFileTitle}.docx`,
                                title: pieCaption,
                                titleAlign: 'center',
                                columnWidths: [1000, 1200, 1500, 1500, 1500, 1100, 1100, 1100],
                                fontSize: 22,
                            }}
                            caption={pieCaption}
                            tableAriaLabel={pieCaption}
                            renderCell={(raw, { column, colIndex }) => {
                                if (colIndex === 0) return String(raw ?? '');
                                if (String(column?.key || '').endsWith('_pct')) return formatPct(raw);
                                return formatPj(raw);
                            }}
                        />
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default SolidBiofuelsProduction;
