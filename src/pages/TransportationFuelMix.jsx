import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useViewportZoom from '../hooks/useViewportZoom';
import useWindowWidth from '../hooks/useWindowWidth';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { joinChartSummary, summarizeByCategory } from '../utils/chartSpokenSummary';
import hexToRgba from '../utils/hexToRgba';

import { makeScrollToIdHandler } from '../utils/scrollToId';
import { formatLocalePct } from '../utils/formatLocale';

const DATA_YEAR = 2025;

const FUEL_KEYS = ['diesel', 'ethanol', 'heavy_fuel_oil', 'aviation', 'other', 'motor_gasoline'];
const FOOTNOTE_NUM_BY_KEY = { ethanol: 1, other: 2 };

const LABEL_KEYS = {
    motor_gasoline: 'transportation_fuel_mix_label_motor_gasoline',
    diesel: 'transportation_fuel_mix_label_diesel',
    ethanol: 'transportation_fuel_mix_label_ethanol',
    heavy_fuel_oil: 'transportation_fuel_mix_label_heavy_fuel_oil',
    aviation: 'transportation_fuel_mix_label_aviation',
    other: 'transportation_fuel_mix_label_other',
};

const COLORS = {
    motor_gasoline: '#3d6b4f',
    diesel: '#6B9B4E',
    ethanol: '#A4C639',
    heavy_fuel_oil: '#DF790C',
    aviation: '#4b4c4d',
    other: '#519CC8',
};

/** Hardcoded until data pipeline is available — transportation sector fuel mix reference values (2023). */
const HARDCODED_DATA = [
    {
        year: DATA_YEAR,
        total: 2647,
        slices: {
            motor_gasoline: { pct: 53 },
            diesel: { pct: 28 },
            ethanol: { pct: 4 },
            heavy_fuel_oil: { pct: 1 },
            aviation: { pct: 12 },
            other: { pct: 2 },
        },
    },
];


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

const pixelToPaper = (plotEl, xPx, yPx) => {
    const layout = plotEl._fullLayout;
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

        const buttonLeft = textBox.right - containerRect.left + 2;
        const buttonTop = textBox.top - containerRect.top + 1;
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

const TransportationFuelMix = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [selectedYear] = useState(DATA_YEAR);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const windowWidth = useWindowWidth();
    const { zoomLevel } = useViewportZoom();
    const [chartDecorations, setChartDecorations] = useState({ footnoteButtons: [], fnAnnotations: [] });

    const chartRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const textVars = { year: selectedYear };

    const formatPj = useCallback((value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    }, [locale]);

    const formatPct = (value) => formatLocalePct(value, lang, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });

    const scrollToElement = (id) => makeScrollToIdHandler(id);

    const currentRow = useMemo(
        () => HARDCODED_DATA.find((row) => row.year === selectedYear) || HARDCODED_DATA[0],
        [selectedYear],
    );

    const slices = useMemo(() => {
        if (!currentRow) return [];
        return FUEL_KEYS.map((key) => {
            const pct = currentRow.slices[key]?.pct ?? 0;
            const pj = Math.round((currentRow.total * pct) / 100);
            return { key, pct, pj };
        });
    }, [currentRow]);

    const year = currentRow?.year ?? DATA_YEAR;
    const totalPj = currentRow?.total ?? 0;

    const chartTitle = substitute(getText('transportation_fuel_mix_chart_title', lang), textVars);
    const exportChartTitle = stripHtml(chartTitle);
    const fileSlug = substitute(getText('transportation_fuel_mix_download_title', lang), textVars).replace(/\s+/g, '_');
    const tableCaption = substitute(getText('transportation_fuel_mix_table_caption', lang), textVars);

    const zoomLegendMode = windowWidth <= 1000 || zoomLevel >= 1.75;
    const effectiveSlices = windowWidth > 768 ? selectedSlices : null;
    const pieValues = slices.map((slice) => (slice.pj > 0 ? slice.pj : 0.001));
    const baseColors = slices.map((slice) => COLORS[slice.key]);
    const pieColors = effectiveSlices?.length
        ? baseColors.map((color, index) => (effectiveSlices.includes(index) ? color : hexToRgba(color, 0.3)))
        : baseColors;
    const labels = slices.map((slice) => getText(LABEL_KEYS[slice.key], lang));

    const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 17;
    const outsideTextSize = zoomLegendMode ? 18 : textSize;

    const outsideLabelTemplate = slices.map(() => '%{label}<br>%{percent:.0%}');
    const zoomLabelTemplate = slices.map(() => '%{percent:.0%}');

    const pieTrace = slices.length ? {
        type: 'pie',
        values: pieValues,
        labels,
        hole: 0.55,
        direction: 'clockwise',
        rotation: 0,
        sort: false,
        texttemplate: zoomLegendMode ? zoomLabelTemplate : outsideLabelTemplate,
        textinfo: zoomLegendMode ? 'percent' : 'label+percent',
        textposition: zoomLegendMode ? 'inside' : 'outside',
        textfont: { size: textSize, family: 'Arial, sans-serif', color: zoomLegendMode ? '#ffffff' : pieColors },
        outsidetextfont: { size: outsideTextSize, color: pieColors },
        marker: { colors: pieColors, line: { color: '#ffffff', width: 1 } },
        pull: effectiveSlices?.length
            ? pieValues.map((_, index) => (effectiveSlices.includes(index) ? 0.08 : 0.02))
            : pieValues.map(() => 0.02),
        hovertext: slices.map((slice) => {
            const label = getText(LABEL_KEYS[slice.key], lang);
            return `<b>${label}</b><br>${formatPj(slice.pj)} PJ<br>${formatPct(slice.pct)}`;
        }),
        hoverinfo: 'text',
        hoverlabel: HOVER_LABEL,
        automargin: true,
    } : null;

    const piePlotHeight = windowWidth <= 480 ? 430 : 520;
    const pieSideMargin = windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 240;

    const centerAnnotation = useMemo(() => totalPj != null ? {
        text: `${getText('transportation_fuel_mix_center_total', lang)}<br><b>${formatPj(totalPj)}</b><br>PJ`,
        showarrow: false,
        x: 0.5,
        y: 0.5,
        xref: 'paper',
        yref: 'paper',
        font: { size: windowWidth <= 480 ? 15 : 20, color: '#424243', family: 'Arial Black, Arial, sans-serif' },
    } : null, [totalPj, lang, windowWidth, formatPj]);

    const pieLayout = {
        showlegend: false,
        margin: {
            t: zoomLegendMode ? 80 : 95,
            b: zoomLegendMode ? 120 : 95,
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
    };

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
        if (graphDiv._transportationFuelMixClick) {
            graphDiv.removeListener('plotly_click', graphDiv._transportationFuelMixClick);
        }
        graphDiv._transportationFuelMixClick = handlePieClick;
        graphDiv.on('plotly_click', graphDiv._transportationFuelMixClick);
    }, [handlePieClick]);

    const onPieInitialized = useCallback((_figure, graphDiv) => {
        bindPlotClickHandler(graphDiv);
        if (!graphDiv?.on) return;
        if (graphDiv._transportationFuelMixAfterPlot) {
            graphDiv.removeListener('plotly_afterplot', graphDiv._transportationFuelMixAfterPlot);
        }
        graphDiv._transportationFuelMixAfterPlot = () => window.requestAnimationFrame(updateChartDecorations);
        graphDiv.on('plotly_afterplot', graphDiv._transportationFuelMixAfterPlot);
    }, [bindPlotClickHandler, updateChartDecorations]);

    

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('transportation_fuel_mix_table_col_year', lang), align: 'left' },
        { key: 'total', header: getText('transportation_fuel_mix_table_col_total', lang), align: 'num' },
        ...FUEL_KEYS.map((key) => ({
            key: `${key}_pj`,
            header: `${getText(LABEL_KEYS[key], lang)} (PJ)`,
            align: 'num',
        })),
        ...FUEL_KEYS.map((key) => ({
            key: `${key}_pct`,
            header: `${getText(LABEL_KEYS[key], lang)} (%)`,
            align: 'num',
        })),
    ], [lang]);

    const tableRows = useMemo(() => {
        if (!currentRow) return [];
        const row = { year, total: totalPj };
        slices.forEach((slice) => {
            row[`${slice.key}_pj`] = slice.pj;
            row[`${slice.key}_pct`] = slice.pct;
        });
        return [row];
    }, [currentRow, year, totalPj, slices]);

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${fileSlug}.png`,
        title: exportChartTitle,
        width: 1200,
        height: 900,
        legendItems: slices.map((slice) => ({
            label: getText(LABEL_KEYS[slice.key], lang),
            color: COLORS[slice.key],
        })),
    }),
        [COLORS, LABEL_KEYS, exportChartTitle, fileSlug, getText, lang, slices],
    );

    const chartConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
        name: getText('transportation_fuel_mix_download_png', lang),
    });

    const renderFootnoteButton = (button) => (
        <a
            key={button.key}
            id={`fn${button.footnoteNum}-rf-transportation-fuel-mix`}
            className="transportation-fuel-mix-fn-button fn-lnk"
            href={`#fn${button.footnoteNum}-transportation-fuel-mix`}
            onClick={scrollToElement(`fn${button.footnoteNum}-transportation-fuel-mix`)}
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
        const referrerId = footnoteNum ? `fn${footnoteNum}-rf-transportation-fuel-mix` : undefined;
        return (
            <span key={slice.key} className="transportation-fuel-mix-custom-legend-item" id={referrerId}>
                <span className="transportation-fuel-mix-custom-legend-swatch" style={{ backgroundColor: COLORS[slice.key] }} aria-hidden="true" />
                {getText(LABEL_KEYS[slice.key], lang)}
                {footnoteNum != null && (
                    <a className="fn-lnk" href={`#fn${footnoteNum}-transportation-fuel-mix`} onClick={scrollToElement(`fn${footnoteNum}-transportation-fuel-mix`)}>
                        <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                        {footnoteNum}
                    </a>
                )}
                {' '}
                {formatPct(slice.pct)}
            </span>
        );
    };

    const formatShareSpoken = (value) => {
        const formatted = formatLocalePct(value, lang, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
            suffix: false,
        });
        return `${formatted} ${lang === 'en' ? 'percent' : 'pour cent'}`;
    };
    const energyUnit = lang === 'en' ? 'petajoules' : 'pétajoules';
    const pieChartSummary = slices.length ? joinChartSummary({
        intro: lang === 'en'
            ? `Donut chart of the transportation sector fuel mix for ${year}. Total ${formatPj(totalPj)} ${energyUnit}`
            : `Graphique en anneau du bouquet énergétique du secteur des transports pour ${year}. Total ${formatPj(totalPj)} ${energyUnit}`,
        unitNote: lang === 'en'
            ? 'Values in petajoules and percent of transportation energy use'
            : "Valeurs en pétajoules et en pourcentage de la consommation d'énergie des transports",
        body: summarizeByCategory({
            categories: labels,
            series: [
                { name: lang === 'en' ? 'Energy use' : 'Consommation', values: slices.map((slice) => slice.pj), format: (value) => `${formatPj(value)} ${energyUnit}` },
                { name: lang === 'en' ? 'Share' : 'Part', values: slices.map((slice) => slice.pct), format: formatShareSpoken },
            ],
            lang,
        }),
    }) : '';
    const chartRegionLabel = pieChartSummary ? `${exportChartTitle}. ${pieChartSummary}` : exportChartTitle;

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-95 page-chrome page-chrome--bleed"
            aria-labelledby="transportation-fuel-mix-chart-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.page-95.page-content { max-width: none !important; overflow-x: visible !important; }
.page-95 {
}
.transportation-fuel-mix-container { width: 100%; padding: 15px 0 0 0; box-sizing: border-box; }
.transportation-fuel-mix-chart-frame {
    margin-bottom: 0;
}
.transportation-fuel-mix-chart-title {
    color: var(--gc-text);
    margin: 0 0 12px 0;
    text-transform: none;
}
.transportation-fuel-mix-chart-scroll { width: 100%; overflow: hidden; display: flex; justify-content: center; }
.transportation-fuel-mix-chart {
    width: 100%;
    min-width: 0;
    height: ${piePlotHeight}px;
    position: relative;
    z-index: 1;
    overflow: visible;
}
.transportation-fuel-mix-chart > div { width: 100%; height: 100%; overflow: visible; }
.transportation-fuel-mix-chart .js-plotly-plot,
.transportation-fuel-mix-chart .plot-container,
.transportation-fuel-mix-chart .svg-container { overflow: visible !important; }
.transportation-fuel-mix-fn-button {
    position: absolute;
    z-index: 2;
    transform: translate(0, 0);
    pointer-events: auto;
}
.transportation-fuel-mix-custom-legend {
    position: relative;
    z-index: 60;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px 18px;
    flex-wrap: wrap;
    margin-top: 8px;
    margin-bottom: 8px;
    padding: 0 12px;
    font-family: Arial, sans-serif;
    font-size: 11px;
    color: var(--gc-text);
}
.transportation-fuel-mix-custom-legend-item { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.transportation-fuel-mix-custom-legend-swatch { width: 12px; height: 12px; display: inline-block; border-radius: 2px; border: 1px solid rgba(0, 0, 0, 0.15); }
.transportation-fuel-mix-bullets {
    font-family: var(--font-body);
    font-size: clamp(17px, 2vw, 20px);
    color: var(--gc-text);
    line-height: 1.55;
    margin: 36px 0 28px 0;
    padding-left: 1.25rem;
}
.transportation-fuel-mix-bullets li { margin-bottom: 0.85rem; }
.transportation-fuel-mix-bullets li:last-child { margin-bottom: 0; }
.transportation-fuel-mix-bullets strong { font-weight: bold; }
.transportation-fuel-mix-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.transportation-fuel-mix-footnotes {
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
.transportation-fuel-mix-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 1rem;
}
.transportation-fuel-mix-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
.transportation-fuel-mix-footnotes dd p { margin: 0; }
.transportation-fuel-mix-footnotes .transportation-fuel-mix-rounding-note { margin: 0; font-size: 1rem; }
            `}</style>

            <div className="transportation-fuel-mix-container">
                <div className="transportation-fuel-mix-chart-frame page-chrome-chart-frame">
                    <h2 id="transportation-fuel-mix-chart-title" className="transportation-fuel-mix-chart-title page-chrome-chart-title">{chartTitle}</h2>
                    {effectiveSlices?.length > 0 && <ClearSelectionButton lang={lang} onClick={() => setSelectedSlices(null)} />}
                    <div className="transportation-fuel-mix-chart-scroll">
                        <figure
                            ref={chartRef}
                            className="transportation-fuel-mix-chart"
                            role="region"
                            aria-label={chartRegionLabel}
                            tabIndex="0"
                            style={{ margin: 0 }}
                        >
                            <div aria-hidden="true">
                                {pieTrace && (
                                    <Plot
                                        key={`transportation-fuel-mix-pie-${year}-${zoomLegendMode ? 'compact' : 'wide'}-${effectiveSlices ? effectiveSlices.join('-') : 'none'}-${chartDecorations.footnoteButtons.length}`}
                                        data={[pieTrace]}
                                        layout={pieLayout}
                                        config={chartConfig}
                                        style={{ width: '100%', height: '100%' }}
                                        useResizeHandler
                                        onInitialized={onPieInitialized}
                                        onUpdate={onPieInitialized}
                                    />
                                )}
                            </div>
                            {!zoomLegendMode && chartDecorations.footnoteButtons.map(renderFootnoteButton)}
                        </figure>
                    </div>
                    {zoomLegendMode && (
                        <div className="transportation-fuel-mix-custom-legend" aria-label={lang === 'en' ? 'Chart legend' : 'Légende du graphique'}>
                            {slices.map((slice) => renderZoomLegendItem(slice))}
                        </div>
                    )}

                    <div className="transportation-fuel-mix-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={`${fileSlug}.csv`}
                            docx={{
                                filename: `${fileSlug}.docx`,
                                title: stripHtml(tableCaption),
                                titleAlign: 'center',
                                columnWidths: [900, 1100, 1300, 1300, 1300, 1300, 1300, 1300, 900, 900, 900, 900, 900, 900],
                                fontSize: 22,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                            renderCell={(raw, { colIndex, column }) => {
                                if (colIndex === 0) return String(raw ?? '');
                                if (column?.key === 'total' || String(column?.key || '').endsWith('_pj')) {
                                    return formatPj(raw);
                                }
                                if (String(column?.key || '').endsWith('_pct')) {
                                    return formatPct(raw);
                                }
                                return String(raw ?? '');
                            }}
                        />
                    </div>
                </div>

                <ul className="transportation-fuel-mix-bullets" aria-label={getText('transportation_fuel_mix_bullets_aria', lang)}>
                    <li>
                        {getText('transportation_fuel_mix_bullet1_part1', lang)}
                        <strong>{getText('transportation_fuel_mix_bullet1_bold', lang)}</strong>
                        {getText('transportation_fuel_mix_bullet1_part2', lang)}
                    </li>
                    <li>
                        {getText('transportation_fuel_mix_bullet2_part1', lang)}
                        <strong>{getText('transportation_fuel_mix_bullet2_bold1', lang)}</strong>
                        {getText('transportation_fuel_mix_bullet2_part2', lang)}
                        <strong>{getText('transportation_fuel_mix_bullet2_bold2', lang)}</strong>
                        {getText('transportation_fuel_mix_bullet2_part3', lang)}
                    </li>
                    <li>
                        {getText('transportation_fuel_mix_bullet3_part1', lang)}
                        <strong>{getText('transportation_fuel_mix_bullet3_bold1', lang)}</strong>
                        {getText('transportation_fuel_mix_bullet3_part2', lang)}
                        <strong>{getText('transportation_fuel_mix_bullet3_bold2', lang)}</strong>
                        {getText('transportation_fuel_mix_bullet3_part3', lang)}
                        <strong>{getText('transportation_fuel_mix_bullet3_bold3', lang)}</strong>
                        {getText('transportation_fuel_mix_bullet3_part4', lang)}
                    </li>
                </ul>

                <aside className="wb-fnote transportation-fuel-mix-footnotes" role="note">
                    <h2 id="fn-transportation-fuel-mix">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</dt>
                        <dt>{lang === 'en' ? 'Footnote 1' : 'Note de bas de page 1'}</dt>
                        <dd id="fn1-transportation-fuel-mix">
                            <a
                                href="#fn1-rf-transportation-fuel-mix"
                                onClick={scrollToElement('fn1-rf-transportation-fuel-mix')}
                                className="fn-num"
                                title={lang === 'en' ? 'Return to footnote 1 referrer' : 'Retour à la référence de la note de bas de page 1'}
                            >
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>
                                1
                            </a>
                            <p>{getText('transportation_fuel_mix_footnote1', lang)}</p>
                        </dd>
                        <dt>{lang === 'en' ? 'Footnote 2' : 'Note de bas de page 2'}</dt>
                        <dd id="fn2-transportation-fuel-mix">
                            <a
                                href="#fn2-rf-transportation-fuel-mix"
                                onClick={scrollToElement('fn2-rf-transportation-fuel-mix')}
                                className="fn-num"
                                title={lang === 'en' ? 'Return to footnote 2 referrer' : 'Retour à la référence de la note de bas de page 2'}
                            >
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>
                                2
                            </a>
                            <p>{getText('transportation_fuel_mix_footnote2', lang)}</p>
                        </dd>
                    </dl>
                    <p className="transportation-fuel-mix-rounding-note">{getText('transportation_fuel_mix_footnote_rounding', lang)}</p>
                </aside>
            </div>
        </PageShell>
    );
};

export default TransportationFuelMix;
