import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import PageFootnotes from '../components/PageFootnotes';
import YearSelect from '../components/YearSelect';
import ClearSelectionButton from '../components/ClearSelectionButton';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useWindowWidth from '../hooks/useWindowWidth';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { downloadInfographicImagePng } from '../utils/downloadInfographicPng';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import hexToRgba from '../utils/hexToRgba';
import { makeScrollToIdHandler } from '../utils/scrollToId';
import AccessibleInfographic from '../components/AccessibleInfographic';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';

import canadaEnergySupplyGlobalBgEn from '../assets/canada_energy_supply_global_bg.svg?raw';
import canadaEnergySupplyGlobalBgFr from '../assets/canada_energy_supply_global_bg_fr.svg?raw';
import { formatLocaleNumber, formatLocalePct } from '../utils/formatLocale';
import { getCanadaEnergySupplyData } from '../utils/dataLoader';

const SOURCE_KEYS = [
    'oil',
    'natural_gas',
    'coal',
    'hydro',
    'other_renewables',
    'biofuels_waste',
    'nuclear',
];
const FOOTNOTE_NUM_BY_KEY = { other_renewables: 3 };
const COLORS = {
    natural_gas: '#30B8C8',
    oil: '#807050',
    nuclear: '#607888',
    biofuels_waste: '#A0A0A0',
    other_renewables: '#98B0A8',
    hydro: '#204098',
    coal: '#68B888',
};

const GLOBAL_SHARE_FIELDS = [
    ['fossil', '81', 'text'],
    ['oil', '30', 'tspan'],
    ['coal', '28', 'tspan'],
    ['naturalGas', '23', 'tspan'],
    ['renewables', '14', 'text'],
    ['nuclear', '5', 'text'],
];

const largestRemainder = (values, target) => {
    const bases = values.map((value) => Math.floor(value));
    let remaining = Math.round(target) - bases.reduce((sum, value) => sum + value, 0);
    const byFraction = values
        .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
        .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
    const rounded = bases.slice();
    let guard = 0;
    while (remaining !== 0 && byFraction.length && guard < 20) {
        const slot = remaining > 0
            ? byFraction[guard % byFraction.length]
            : byFraction[byFraction.length - 1 - (guard % byFraction.length)];
        if (remaining > 0) {
            rounded[slot.index] += 1;
            remaining -= 1;
        } else if (rounded[slot.index] > 0) {
            rounded[slot.index] -= 1;
            remaining += 1;
        }
        guard += 1;
    }
    return rounded;
};

const roundGlobalShares = (world) => {
    const headline = [world?.fossil, world?.renewables, world?.nuclear].map(Number);
    const parts = [world?.oil, world?.coal, world?.naturalGas].map(Number);
    if ([...headline, ...parts].some((value) => !Number.isFinite(value))) return null;
    const [fossil, renewables, nuclear] = largestRemainder(headline, 100);
    const [oil, coal, naturalGas] = largestRemainder(parts, fossil);
    return { fossil, oil, coal, naturalGas, renewables, nuclear };
};

const formatGlobalShare = (value, lang) => (lang === 'fr' ? `${value} %` : `${value}%`);

const applyGlobalShares = (markup, world, lang) => {
    if (!markup || !world) return markup;
    const rounded = roundGlobalShares(world);
    if (!rounded) return markup;
    return GLOBAL_SHARE_FIELDS.reduce((svg, [key, original, tag]) => {
        const shown = lang === 'fr' ? `${original} %` : `${original}%`;
        return svg.replace(`>${shown}</${tag}>`, `>${formatGlobalShare(rounded[key], lang)}</${tag}>`);
    }, markup);
};

const STACKED_LAYOUT_BROWSER_ZOOM = 1.1;
const STACKED_LAYOUT_DETECTED_ZOOM = 1.0 + (STACKED_LAYOUT_BROWSER_ZOOM - 1.0) * 0.25;
const HOVER_LABEL = {
    bgcolor: '#ffffff',
    bordercolor: '#000000',
    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
};

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

const pixelToPaper = (plotEl, xPx, yPx) => {
    const layout = plotEl?._fullLayout;
    if (!layout) return { x: 0.5, y: 0.5 };
    const plotWidth = layout.width - layout.margin.l - layout.margin.r;
    const plotHeight = layout.height - layout.margin.t - layout.margin.b;
    if (!plotWidth || !plotHeight) return { x: 0.5, y: 0.5 };
    return {
        x: (xPx - layout.margin.l) / plotWidth,
        y: 1 - ((yPx - layout.margin.t) / plotHeight),
    };
};

const computeChartDecorations = ({ plotEl, chartEl, slices, textSize, zoomLegendMode }) => {
    if (!plotEl || !chartEl || zoomLegendMode || !slices.length) {
        return { footnoteButtons: [], fnAnnotations: [] };
    }

    const containerRect = chartEl.getBoundingClientRect();
    const sliceTexts = plotEl.querySelectorAll('g.pielayer g.slicetext text, g.trace g.slicetext text');
    const footnoteButtons = [];
    const fnAnnotations = [];

    slices.forEach((slice, index) => {
        const textEl = sliceTexts[index];
        if (!textEl) return;

        const textBox = textEl.getBoundingClientRect();
        if (!textBox.width) return;

        const footnoteNum = FOOTNOTE_NUM_BY_KEY[slice.key];
        if (footnoteNum == null) return;

        const buttonLeft = Math.round(textBox.right - containerRect.left + 2);
        const buttonTop = Math.round(textBox.top - containerRect.top + 1);
        footnoteButtons.push({
            key: slice.key,
            footnoteNum,
            left: buttonLeft,
            top: buttonTop,
        });

        const paperPos = pixelToPaper(plotEl, buttonLeft + 6, buttonTop + 8);
        fnAnnotations.push({
            text: String(footnoteNum),
            showarrow: false,
            x: paperPos.x,
            y: paperPos.y,
            xref: 'paper',
            yref: 'paper',
            xanchor: 'left',
            yanchor: 'middle',
            font: { size: Math.max(10, textSize - 2), color: '#26374a', family: 'Arial, sans-serif' },
        });
    });

    return { footnoteButtons, fnAnnotations };
};

const decorationsEqual = (a, b) => (
    JSON.stringify(a?.footnoteButtons ?? []) === JSON.stringify(b?.footnoteButtons ?? [])
);

const CanadaEnergySupply = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [supplyByYear, setSupplyByYear] = useState([]);
    const [selectedYear, setSelectedYear] = useState(null);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const windowWidth = useWindowWidth();
    const [pageCssZoom, setPageCssZoom] = useState(() => computePageZoomScale(null).pageCssZoom);
    const [zoomLevel, setZoomLevel] = useState(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const [chartDecorations, setChartDecorations] = useState({ footnoteButtons: [], fnAnnotations: [] });
    const zoomBaselineRef = useRef(null);

    const chartRef = useRef(null);
    const infographicImgRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });

    useEffect(() => {
        let cancelled = false;
        getCanadaEnergySupplyData()
            .then((data) => {
                if (cancelled) return;
                const rows = Array.isArray(data) ? data : [];
                setSupplyByYear(rows);
                if (rows.length) setSelectedYear(rows[rows.length - 1].year);
            })
            .catch((err) => {
                console.error('Failed to load Canada energy supply data:', err);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const yearList = useMemo(
        () => supplyByYear.map((row) => row.year).sort((a, b) => b - a),
        [supplyByYear],
    );
    const tableYearLabel = yearList.length <= 1
        ? String(yearList[0] ?? '')
        : `${Math.min(...yearList)}–${Math.max(...yearList)}`;

    const useStackedLayout = pageCssZoom >= STACKED_LAYOUT_DETECTED_ZOOM;
    const textVars = { year: selectedYear ?? '' };
    const yearData = supplyByYear.find((row) => row.year === selectedYear) || null;

    const formatPj = useCallback((value) => formatLocaleNumber(value, lang, { maximumFractionDigits: 0 }), [lang]);

    const formatPct = useCallback((value, digits = 0) => formatLocalePct(value, lang, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }), [lang]);

    const scrollToElement = (id) => makeScrollToIdHandler(id);

    useEffect(() => {
        const syncLayout = () => {
            const viewportScale = window.visualViewport?.scale || 1;
            setZoomLevel(Math.max(viewportScale, window.devicePixelRatio || 1));
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

    const slices = useMemo(() => {
        if (!yearData) return [];
        return SOURCE_KEYS.map((key) => {
            const slice = yearData.slices[key] || {};
            return {
                key,
                pct: slice.pct ?? 0,
                pj: slice.pj ?? 0,
            };
        });
    }, [yearData]);

    const year = selectedYear ?? '';
    const totalPj = yearData?.total ?? 0;
    const chartTitle = substitute(getText('canada_energy_supply_chart_title', lang), textVars);
    const chartTitleBefore = substitute(getText('canada_energy_supply_chart_title_before', lang), textVars);
    const chartTitleAfter = substitute(getText('canada_energy_supply_chart_title_after', lang), textVars);
    const exportChartTitle = stripHtml(chartTitle);
    const fileTitle = substitute(getText('canada_energy_supply_download_title', lang), textVars);
    const chartDownloadSlug = fileTitle.replace(/\s+/g, '_');
    const infographicFileSlug = getText('canada_energy_supply_infographic_download_title', lang).replace(/\s+/g, '_');
    const tableCaption = substitute(getText('canada_energy_supply_table_caption', lang), { year: tableYearLabel });
    const tableDownloadSlug = substitute(getText('canada_energy_supply_download_title', lang), { year: tableYearLabel });
    const bgMarkup = useMemo(
        () => applyGlobalShares(
            lang === 'en' ? canadaEnergySupplyGlobalBgEn : canadaEnergySupplyGlobalBgFr,
            yearData?.world,
            lang,
        ),
        [lang, yearData],
    );

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('canada_energy_supply_table_col_year', lang), align: 'left' },
        { key: 'source', header: getText('canada_energy_supply_table_col_source', lang), align: 'left' },
        { key: 'pj', header: getText('canada_energy_supply_table_col_pj', lang), align: 'num' },
        { key: 'pct', header: getText('canada_energy_supply_table_col_share', lang), align: 'num' },
    ], [lang]);

    const tableRows = useMemo(() => {
        const rows = [];
        [...supplyByYear].sort((a, b) => b.year - a.year).forEach((entry) => {
            SOURCE_KEYS.forEach((key) => {
                const slice = entry.slices[key] || {};
                rows.push({
                    year: entry.year,
                    source: getText(`canada_energy_supply_label_${key}`, lang),
                    pj: slice.pj,
                    pct: slice.pct,
                });
            });
        });
        return rows;
    }, [supplyByYear, lang]);

    const zoomLegendMode = windowWidth <= 1000 || zoomLevel >= 1.75;
    const effectiveSlices = windowWidth > 768 ? selectedSlices : null;
    const pieValues = useMemo(
        () => slices.map((slice) => (slice.pct > 0 ? slice.pct : 0.001)),
        [slices],
    );
    const pieColors = useMemo(() => {
        const baseColors = slices.map((slice) => COLORS[slice.key]);
        if (!effectiveSlices?.length) return baseColors;
        return baseColors.map((color, index) => (
            effectiveSlices.includes(index) ? color : hexToRgba(color, 0.3)
        ));
    }, [slices, effectiveSlices]);
    const labels = useMemo(
        () => slices.map((slice) => getText(`canada_energy_supply_label_${slice.key}`, lang)),
        [slices, lang],
    );

    const getChartSummary = () => {
        if (!slices.length) return '';
        const body = summarizeByCategory({
            categories: labels,
            series: [
                {
                    name: lang === 'en' ? 'Share' : 'Part',
                    values: slices.map((slice) => slice.pct),
                    format: (value) => formatPct(value),
                },
                {
                    name: lang === 'en' ? 'Supply' : 'Offre',
                    values: slices.map((slice) => slice.pj),
                    format: (value) => `${formatPj(value)} PJ`,
                },
            ],
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Pie chart of Canada total energy supply by source for ${year}. Total ${formatPj(totalPj)} PJ`
                : `Graphique circulaire de l'offre totale d'énergie du Canada par source pour ${year}. Total ${formatPj(totalPj)} PJ`,
            unitNote: lang === 'en'
                ? 'Values in percent of total energy supply and petajoules'
                : "Valeurs en pourcentage de l'offre totale d'énergie et en pétajoules",
            body,
        });
    };

    const chartRegionLabel = `${exportChartTitle}. ${getChartSummary()}`;

    const textSize = zoomLegendMode ? 14 : 16;
    const outsideTextSize = 16;
    const piePlotHeight = windowWidth <= 480 ? 360 : windowWidth <= 768 ? 400 : 480;
    const pieSideMargin = windowWidth <= 480 ? 8 : zoomLegendMode ? 24 : 160;

    const pieTrace = useMemo(() => {
        if (!slices.length) return null;
        const outsideLabelTemplate = '%{label}<br>%{text}';
        const zoomLabelTemplate = slices.map((slice) => (slice.pct >= 8 ? '%{text}' : ''));
        return {
            type: 'pie',
            values: pieValues,
            labels,
            hole: 0.55,
            direction: 'clockwise',
            rotation: -20,
            sort: false,
            text: slices.map((slice) => formatPct(slice.pct)),
            texttemplate: zoomLegendMode ? zoomLabelTemplate : outsideLabelTemplate,
            textinfo: zoomLegendMode ? 'percent' : 'label+percent',
            textposition: zoomLegendMode ? 'inside' : 'outside',
            textfont: {
                size: textSize,
                family: 'Arial, sans-serif',
                color: zoomLegendMode ? '#ffffff' : pieColors,
            },
            insidetextfont: zoomLegendMode
                ? { size: textSize, family: 'Arial, sans-serif', color: '#ffffff' }
                : undefined,
            outsidetextfont: { size: outsideTextSize, color: pieColors },
            marker: { colors: pieColors, line: { color: '#ffffff', width: 1 } },
            pull: effectiveSlices?.length
                ? pieValues.map((_, index) => (effectiveSlices.includes(index) ? 0.08 : 0.02))
                : pieValues.map(() => 0.02),
            hovertext: slices.map((slice) => {
                const label = getText(`canada_energy_supply_label_${slice.key}`, lang);
                return `<b>${label}</b><br>${formatPj(slice.pj)} PJ<br>${formatPct(slice.pct)}`;
            }),
            hoverinfo: 'text',
            hoverlabel: HOVER_LABEL,
            automargin: false,
            customdata: slices.map((slice) => slice.key),
        };
    }, [
        slices,
        pieValues,
        labels,
        pieColors,
        zoomLegendMode,
        textSize,
        outsideTextSize,
        effectiveSlices,
        formatPct,
        formatPj,
        lang,
    ]);

    const centerAnnotation = useMemo(() => (totalPj != null ? {
        text: `${getText('canada_energy_supply_center_total', lang)}<br><b>${formatPj(totalPj)}</b><br>PJ`,
        showarrow: false,
        x: 0.5,
        y: 0.5,
        xref: 'paper',
        yref: 'paper',
        font: { size: windowWidth <= 480 ? 14 : 18, color: '#424243', family: 'Arial Black, Arial, sans-serif' },
    } : null), [totalPj, lang, windowWidth, formatPj]);

    const pieLayout = useMemo(() => ({
        showlegend: false,
        margin: {
            t: zoomLegendMode ? 60 : 70,
            b: zoomLegendMode ? 90 : 70,
            l: pieSideMargin,
            r: pieSideMargin,
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        height: piePlotHeight,
        clickmode: 'event',
        dragmode: false,
        annotations: centerAnnotation ? [centerAnnotation] : [],
        uirevision: `canada-energy-supply-${year}`,
    }), [zoomLegendMode, pieSideMargin, piePlotHeight, centerAnnotation, year]);

    const updateChartDecorations = useCallback(() => {
        const chartEl = chartRef.current;
        const plotEl = chartEl?.querySelector('.js-plotly-plot');
        const next = computeChartDecorations({
            plotEl,
            chartEl,
            slices,
            textSize,
            zoomLegendMode,
        });
        setChartDecorations((prev) => (decorationsEqual(prev, next) ? prev : next));
    }, [slices, textSize, zoomLegendMode]);

    useEffect(() => {
        const timer = window.setTimeout(updateChartDecorations, 120);
        window.addEventListener('resize', updateChartDecorations);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('resize', updateChartDecorations);
        };
    }, [updateChartDecorations, year, lang, effectiveSlices, windowWidth, zoomLegendMode]);

    const togglePieSelection = useCallback((sliceIndex) => {
        if (windowWidth <= 768) {
            const now = Date.now();
            const last = lastPieClickRef.current;
            const isDoubleTap = sliceIndex === last.index && now - last.time < 300;
            lastPieClickRef.current = { time: now, index: sliceIndex };
            if (!isDoubleTap) return;
        }
        setSelectedSlices((previous) => {
            if (previous === null) return [sliceIndex];
            if (previous.includes(sliceIndex)) {
                return previous.length <= 1 ? null : previous.filter((item) => item !== sliceIndex);
            }
            return [...previous, sliceIndex];
        });
    }, [windowWidth]);

    const handlePieClick = useCallback((event) => {
        const point = event?.points?.[0];
        if (!point) return;
        const index = point.pointNumber ?? point.pointIndex;
        if (index == null || index < 0) return;
        togglePieSelection(index);
    }, [togglePieSelection]);

    const bindPlotClickHandler = useCallback((graphDiv) => {
        if (!graphDiv?.on) return;
        if (graphDiv._canadaEnergySupplyClick) {
            graphDiv.removeListener('plotly_click', graphDiv._canadaEnergySupplyClick);
        }
        graphDiv._canadaEnergySupplyClick = handlePieClick;
        graphDiv.on('plotly_click', graphDiv._canadaEnergySupplyClick);
    }, [handlePieClick]);

    const hoverTipRef = useRef(null);

    const placeHoverTip = useCallback((graphDiv) => {
        const tip = hoverTipRef.current;
        const figure = chartRef.current;
        const label = graphDiv?.querySelector?.('.hovertext');
        if (!tip || !figure || !label) {
            if (tip) tip.hidden = true;
            return;
        }
        const figRect = figure.getBoundingClientRect();
        const box = label.getBoundingClientRect();
        if (box.width < 2 || box.height < 2) {
            tip.hidden = true;
            return;
        }
        const lines = [];
        label.querySelectorAll('tspan').forEach((node) => {
            const line = node.textContent.trim();
            if (!line || line === lines[lines.length - 1]) return;
            lines.push(line);
        });
        tip.replaceChildren();
        lines.forEach((line, index) => {
            if (index) tip.appendChild(document.createElement('br'));
            if (index === 0) {
                const strong = document.createElement('strong');
                strong.textContent = line;
                tip.appendChild(strong);
            } else {
                tip.appendChild(document.createTextNode(line));
            }
        });
        tip.hidden = false;
        tip.style.left = `${box.left - figRect.left}px`;
        tip.style.top = `${box.top - figRect.top}px`;
        tip.style.width = `${box.width}px`;
        tip.style.height = `${box.height}px`;
    }, []);

    const hideHoverTip = useCallback(() => {
        if (hoverTipRef.current) hoverTipRef.current.hidden = true;
    }, []);

    const onPieInitialized = useCallback((_figure, graphDiv) => {
        bindPlotClickHandler(graphDiv);
        if (!graphDiv?.on) return;
        if (graphDiv._canadaEnergySupplyAfterPlot) {
            graphDiv.removeListener('plotly_afterplot', graphDiv._canadaEnergySupplyAfterPlot);
        }
        graphDiv._canadaEnergySupplyAfterPlot = () => window.requestAnimationFrame(updateChartDecorations);
        graphDiv.on('plotly_afterplot', graphDiv._canadaEnergySupplyAfterPlot);

        if (graphDiv._canadaEnergySupplyHover) {
            graphDiv.removeListener('plotly_hover', graphDiv._canadaEnergySupplyHover);
            graphDiv.removeListener('plotly_unhover', graphDiv._canadaEnergySupplyUnhover);
        }
        graphDiv._canadaEnergySupplyHover = () => placeHoverTip(graphDiv);
        graphDiv._canadaEnergySupplyUnhover = () => hideHoverTip();
        graphDiv.on('plotly_hover', graphDiv._canadaEnergySupplyHover);
        graphDiv.on('plotly_unhover', graphDiv._canadaEnergySupplyUnhover);
    }, [bindPlotClickHandler, hideHoverTip, placeHoverTip, updateChartDecorations]);

    

    const downloadChartImage = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${chartDownloadSlug}.png`,
        title: exportChartTitle,
        width: 1200,
        height: 900,
    }),
        [chartDownloadSlug, exportChartTitle],
    );

    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        const chartEl = chartRef.current;
        if (!plotElement || !window.Plotly) return;
        const exportDecorations = computeChartDecorations({
            plotEl: plotElement,
            chartEl,
            slices,
            textSize,
            zoomLegendMode,
        });
        try {
            await window.Plotly.relayout(plotElement, {
                paper_bgcolor: '#ffffff',
                plot_bgcolor: '#ffffff',
                annotations: [
                    ...(centerAnnotation ? [centerAnnotation] : []),
                    ...exportDecorations.fnAnnotations,
                ],
            });
            await downloadChartImage(plotElement);
        } catch (err) {
            console.warn('Unable to download chart image.', err);
        } finally {
            try {
                await window.Plotly.relayout(plotElement, {
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    annotations: centerAnnotation ? [centerAnnotation] : [],
                });
            } catch (restoreError) {
                console.warn('Unable to restore chart background.', restoreError);
            }
        }
    };

    const downloadChartWithTitleRef = useRef(null);
    downloadChartWithTitleRef.current = downloadChartWithTitle;

    const plotConfig = useMemo(() => buildPngOnlyPlotConfig({
        lang,
        name: getText('canada_energy_supply_download_chart', lang),
        click: (gd) => { downloadChartWithTitleRef.current?.(gd); },
    }), [lang]);

    const downloadInfographicPng = async () => {
        await downloadInfographicImagePng(
            infographicImgRef.current?.getGraphicElement?.() ?? infographicImgRef.current,
            {
                filename: `${infographicFileSlug}.png`,
                scale: 2,
            },
        );
    };

    const renderFootnoteButton = (button) => (
        <a
            key={button.key}
            id={`fn${button.footnoteNum}-rf-canada-energy-supply`}
            className="canada-energy-supply-fn-button fn-lnk"
            href={`#fn${button.footnoteNum}-canada-energy-supply`}
            onClick={scrollToElement(`fn${button.footnoteNum}-canada-energy-supply`)}
            style={{
                left: `${button.left}px`,
                top: `${button.top}px`,
            }}
        >
            <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
            {button.footnoteNum}
        </a>
    );

    const renderZoomLegendItem = (slice) => {
        const footnoteNum = FOOTNOTE_NUM_BY_KEY[slice.key];
        const referrerId = footnoteNum ? `fn${footnoteNum}-rf-canada-energy-supply` : undefined;
        return (
            <span key={slice.key} className="canada-energy-supply-custom-legend-item" id={referrerId}>
                <span className="canada-energy-supply-custom-legend-swatch" style={{ backgroundColor: COLORS[slice.key] }} aria-hidden="true" />
                {getText(`canada_energy_supply_label_${slice.key}`, lang)}
                {footnoteNum != null && (
                    <a className="fn-lnk" href={`#fn${footnoteNum}-canada-energy-supply`} onClick={scrollToElement(`fn${footnoteNum}-canada-energy-supply`)}>
                        <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                        {footnoteNum}
                    </a>
                )}
                {' '}
                {formatPct(slice.pct)}
            </span>
        );
    };

    const pageTitle = getText('canada_energy_supply_title', lang);

    return (
        <PageShell
            tabIndex="-1"
            className="page-content canada-energy-supply page-chrome page-chrome--bleed"
            aria-labelledby="canada-energy-supply-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.canada-energy-supply {
}
.canada-energy-supply-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.canada-energy-supply.page-content h1.canada-energy-supply-title {
    font-size: 41px !important;
    text-transform: none;
}
.canada-energy-supply-intro {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    line-height: 1.55;
    color: var(--gc-text);
    margin: 0 0 16px 0;
}
.canada-energy-supply.page-content p.canada-energy-supply-formula {
    font-family: 'Lato', sans-serif;
    font-size: clamp(18px, 2.2vw, 26px);
    font-weight: bold;
    color: #537290 !important;
    text-align: center;
    margin: 0 0 28px 0;
    line-height: 1.35;
}
.canada-energy-supply-content-row {
    display: flex;
    flex-direction: row;
    width: 100%;
    gap: 28px;
    align-items: flex-start;
}
.canada-energy-supply-chart-column {
    width: 54%;
    min-width: 0;
    box-sizing: border-box;
}
.canada-energy-supply-side-column {
    width: 46%;
    min-width: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
}
.canada-energy-supply-chart-frame {
    margin-bottom: 0;
}
.canada-energy-supply-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 24px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
    line-height: 1.3;
}
.canada-energy-supply-chart-scroll { width: 100%; overflow: hidden; display: flex; justify-content: center; }
.canada-energy-supply-chart {
    width: 100%;
    min-width: 0;
    height: ${piePlotHeight}px;
    position: relative;
    z-index: 1;
    overflow: visible;
}
.canada-energy-supply-chart > div {
    width: 100%;
    height: 100%;
    overflow: visible;
    position: relative;
    z-index: 1;
}
.canada-energy-supply-chart .js-plotly-plot,
.canada-energy-supply-chart .plot-container,
.canada-energy-supply-chart .svg-container { overflow: visible !important; }
.canada-energy-supply-fn-button {
    position: absolute;
    z-index: 3;
    transform: translate(0, 0);
    pointer-events: auto;
}
.canada-energy-supply-chart .hoverlayer {
    visibility: hidden !important;
}
.canada-energy-supply-chart > .canada-energy-supply-hover-tip {
    position: absolute;
    z-index: 5;
    width: auto;
    height: auto;
    overflow: hidden;
    box-sizing: border-box;
    pointer-events: none;
    background: #ffffff;
    border: 1px solid #000000;
    color: #000000;
    font-family: Arial, sans-serif;
    font-size: 14px;
    line-height: 1.25;
    padding: 6px 8px;
    white-space: nowrap;
}
.canada-energy-supply-hover-tip[hidden] {
    display: none !important;
}
.canada-energy-supply-custom-legend {
    position: relative;
    z-index: 60;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px 16px;
    flex-wrap: wrap;
    margin-top: 12px;
    margin-bottom: 8px;
    padding: 0 8px;
    font-family: 'Noto Sans', Arial, sans-serif;
    font-size: 16px;
    line-height: 1.35;
    color: #333333;
}
.canada-energy-supply-custom-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
}
.canada-energy-supply-custom-legend-swatch {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    display: inline-block;
    border-radius: 2px;
    border: 1px solid rgba(0, 0, 0, 0.2);
}
.canada-energy-supply-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.canada-energy-supply-chart-frame button:hover,
.canada-energy-supply-infographic-actions button:hover { background-color: #404040 !important; }
.canada-energy-supply-bullets {
    font-family: var(--font-body);
    font-size: clamp(17px, 2vw, 20px);
    color: var(--gc-text);
    margin: 0 0 20px 0;
    padding-left: 1.25em;
    line-height: 1.5;
}
.canada-energy-supply-bullets li { margin-bottom: 0.75rem; }
.canada-energy-supply-bullets li:last-child { margin-bottom: 0; }
.canada-energy-supply-infographic-section { width: 100%; }
.canada-energy-supply-infographic-figure { margin: 0; width: 100%; }
.canada-energy-supply-bg-image { width: 100%; height: auto; display: block; }
.canada-energy-supply-infographic-actions { margin: 12px 0 0 0; }
.canada-energy-supply-infographic-actions button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.canada-energy-supply-footnotes {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--gc-text);
    margin-top: 24px;
    margin-bottom: 0;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
    line-height: 1.65;
    max-width: 100%;
    box-sizing: border-box;
}
.canada-energy-supply-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 1rem;
}
.canada-energy-supply-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
.canada-energy-supply-footnotes dd p { margin: 0; }
.layout-stacked.canada-energy-supply-content-row { flex-direction: column !important; }
.layout-stacked .canada-energy-supply-chart-column,
.layout-stacked .canada-energy-supply-side-column { width: 100% !important; min-width: 0 !important; }
.layout-stacked .canada-energy-supply-chart-column { margin-bottom: 28px; }
@media (max-width: 768px) {
    .canada-energy-supply.page-content h1.canada-energy-supply-title { font-size: 37px !important; }
    .canada-energy-supply-intro { font-size: 18px; }
    .canada-energy-supply-chart-title { font-size: 22px; }
    .canada-energy-supply-custom-legend { font-size: 16px; }
    .canada-energy-supply-footnotes { font-size: 0.9rem; }
    .canada-energy-supply-footnotes h2 { font-size: 1.2rem; margin-bottom: 0.75rem; }
}
@media (max-width: 480px) {
    .canada-energy-supply-custom-legend {
        font-size: 14px;
        gap: 8px 12px;
        justify-content: flex-start;
    }
}
            `}</style>

            <div className="canada-energy-supply-inner">
                <h1 id="canada-energy-supply-title" className="canada-energy-supply-title page-chrome-title">{pageTitle}</h1>

                <p className="canada-energy-supply-intro">
                    {getText('canada_energy_supply_intro_before', lang)}
                    <span id="fn1-rf-canada-energy-supply">
                        {getText('canada_energy_supply_intro_tes', lang)}
                        <a
                            className="fn-lnk"
                            href="#fn1-canada-energy-supply"
                            onClick={scrollToElement('fn1-canada-energy-supply')}
                        >
                            <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                            1
                        </a>
                    </span>
                    {getText('canada_energy_supply_intro_after', lang)}
                </p>

                <p className="canada-energy-supply-formula" aria-label={getText('canada_energy_supply_formula', lang)}>
                    {getText('canada_energy_supply_formula', lang)}
                </p>

                <YearSelect
                    lang={lang}
                    id="canada-energy-supply-year-select"
                    label={getText('year_slider_label', lang)}
                    years={yearList}
                    value={selectedYear}
                    onChange={(nextYear) => {
                        setSelectedYear(nextYear);
                        setSelectedSlices(null);
                    }}
                />
                <div role="status" className="wb-inv" aria-live="polite">
                    {selectedYear
                        ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${selectedYear}`
                        : ''}
                </div>

                <div className={`canada-energy-supply-content-row ${useStackedLayout ? 'layout-stacked' : ''}`}>
                    <div className="canada-energy-supply-chart-column">
                        <div className="canada-energy-supply-chart-frame page-chrome-chart-frame">
                            <h2 id="canada-energy-supply-chart-title" className="canada-energy-supply-chart-title">
                                <span id="fn2-rf-canada-energy-supply">
                                    {chartTitleBefore}
                                    <a
                                        className="fn-lnk"
                                        href="#fn2-canada-energy-supply"
                                        onClick={scrollToElement('fn2-canada-energy-supply')}
                                    >
                                        <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                                        2
                                    </a>
                                </span>
                                {chartTitleAfter}
                            </h2>

                            {effectiveSlices?.length > 0 && (
                                <ClearSelectionButton lang={lang} onClick={() => setSelectedSlices(null)} />
                            )}

                            <div className="canada-energy-supply-chart-scroll">
                                <figure
                                    ref={chartRef}
                                    className="canada-energy-supply-chart"
                                    role="region"
                                    aria-label={chartRegionLabel}
                                    tabIndex="0"
                                    style={{ margin: 0 }}
                                >
                                    <div aria-hidden="true">
                                        {pieTrace && (
                                            <Plot
                                                key={`canada-energy-supply-pie-${year}-${zoomLegendMode ? 'compact' : 'wide'}-${effectiveSlices ? effectiveSlices.join('-') : 'none'}-${lang}`}
                                                data={[pieTrace]}
                                                layout={pieLayout}
                                                config={plotConfig}
                                                style={{ width: '100%', height: '100%' }}
                                                useResizeHandler
                                                onInitialized={onPieInitialized}
                                                onUpdate={onPieInitialized}
                                            />
                                        )}
                                    </div>
                                    {!zoomLegendMode && chartDecorations.footnoteButtons.map(renderFootnoteButton)}
                                    <div ref={hoverTipRef} className="canada-energy-supply-hover-tip" hidden aria-hidden="true" />
                                </figure>
                            </div>

                            {zoomLegendMode && (
                                <div className="canada-energy-supply-custom-legend" aria-label={lang === 'en' ? 'Chart legend' : 'Légende du graphique'}>
                                    {slices.map((slice) => renderZoomLegendItem(slice))}
                                </div>
                            )}

                            <div className="canada-energy-supply-table-wrapper">
                                <ChartDataTable
                                    lang={lang}
                                    columns={tableColumns}
                                    rows={tableRows}
                                    csvFilename={`${tableDownloadSlug}.csv`}
                                    docx={{
                                        filename: `${tableDownloadSlug}.docx`,
                                        title: tableCaption,
                                        titleAlign: 'center',
                                        columnWidths: [1400, 4200, 1600, 1600],
                                        fontSize: 18,
                                    }}
                                    caption={tableCaption}
                                    tableAriaLabel={tableCaption}
                                    renderCell={(raw, { colIndex }) => {
                                        if (colIndex === 0 || colIndex === 1) return String(raw ?? '');
                                        if (colIndex === 2) return formatPj(raw);
                                        return formatPct(raw);
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="canada-energy-supply-side-column">
                        <ul className="canada-energy-supply-bullets" role="list">
                            <li role="listitem">
                                {substitute(getText('canada_energy_supply_bullet1_before', lang), textVars)}
                                <strong>{formatPct(yearData?.fossilPct)}</strong>
                                {substitute(getText('canada_energy_supply_bullet1_after', lang), textVars)}
                            </li>
                            <li role="listitem">
                                {substitute(getText('canada_energy_supply_bullet2_before', lang), textVars)}
                                <strong>{formatPct(yearData?.renewablesPct, 1)}</strong>
                                {substitute(getText('canada_energy_supply_bullet2_after', lang), textVars)}
                            </li>
                        </ul>

                        <div className="canada-energy-supply-infographic-section">
                            <AccessibleInfographic
                                ref={infographicImgRef}
                                mode="text"
                                as="figure"
                                className="canada-energy-supply-infographic-figure"
                                title={pageTitle}
                                svgMarkup={bgMarkup}
                                imgClassName="canada-energy-supply-bg-image"
                                imgStyle={{ width: '100%', height: 'auto', display: 'block' }}
                                idPrefix={`canada-energy-supply-global-${lang}`}
                            />
                            <div className="canada-energy-supply-infographic-actions">
                                <button type="button" onClick={downloadInfographicPng}>
                                    {getText('canada_energy_supply_download_png', lang)}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <PageFootnotes
                    lang={lang}
                    titleId="fn-canada-energy-supply"
                    className="canada-energy-supply-footnotes"
                    items={[
                        { id: 'fn1-canada-energy-supply', marker: '1', text: getText('canada_energy_supply_footnote1', lang), returnHref: '#fn1-rf-canada-energy-supply' },
                        { id: 'fn2-canada-energy-supply', marker: '2', text: getText('canada_energy_supply_footnote2', lang), returnHref: '#fn2-rf-canada-energy-supply' },
                        { id: 'fn3-canada-energy-supply', marker: '3', text: getText('canada_energy_supply_footnote3', lang), returnHref: '#fn3-rf-canada-energy-supply' },
                    ]}
                />
            </div>
        </PageShell>
    );
};

export default CanadaEnergySupply;
