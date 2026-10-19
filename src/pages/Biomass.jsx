import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import PageFootnotes from '../components/PageFootnotes';
import ClearSelectionButton from '../components/ClearSelectionButton';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useViewportZoom from '../hooks/useViewportZoom';
import useWindowWidth from '../hooks/useWindowWidth';
import PageShell from '../components/PageShell';
import SafeHtml from '../components/SafeHtml';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { getBiomassData } from '../utils/dataLoader';
import { joinChartSummary, summarizeByCategory } from '../utils/chartSpokenSummary';
import { stripHtml } from '../utils/stripHtml';
import hexToRgba from '../utils/hexToRgba';
import { makeScrollToIdHandler } from '../utils/scrollToId';

import BiomassInfographic from '../components/BiomassInfographic';

const FN_PREFIX = 'biomass';
const biomassFnRefId = (n) => `fn${n}-rf-${FN_PREFIX}`;
const biomassFnDefId = (n) => `fn${n}-${FN_PREFIX}`;
const PIE_KEYS = ['hydro', 'solid_biofuels', 'wind_solar', 'other_biomass'];
const PIE_COLORS = {
    hydro: '#6B6B6B',
    solid_biofuels: '#2F6B3A',
    wind_solar: '#9A9A9A',
    other_biomass: '#8FBC8F',
};
const PIE_LABEL_KEYS = {
    hydro: 'biomass_label_hydro',
    solid_biofuels: 'biomass_label_solid_biofuels',
    wind_solar: 'biomass_label_wind_solar',
    other_biomass: 'biomass_label_other_biomass',
};
const SOLID_BIOFUELS_INDEX = PIE_KEYS.indexOf('solid_biofuels');

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const Biomass = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [biomassData, setBiomassData] = useState(null);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const selectedYear = biomassData?.year ?? null;
    const windowWidth = useWindowWidth();
    const { viewportScale, zoomLevel } = useViewportZoom();
    const chartRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const stackedLayout = viewportScale >= 1.1 || windowWidth <= 1000;
    const zoomLegendMode = windowWidth <= 1000 || zoomLevel >= 1.75;
    const effectiveSelectedSlices = windowWidth > 768 ? selectedSlices : null;

    const formatSharePct = useCallback((value) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        const formatted = Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
        return lang === 'en' ? `${formatted}%` : `${formatted} %`;
    }, [lang, locale]);

    const vars = { year: selectedYear ?? '' };
    const chartTitle = getText('biomass_chart_title', lang);
    const exportChartTitle = stripHtml(chartTitle);
    const formatShareSpoken = (value) => {
        const formatted = Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
        return `${formatted} ${lang === 'en' ? 'percent' : 'pour cent'}`;
    };
    const fileSlugBase = substitute(getText('biomass_download_title', lang), vars).replace(/\s+/g, '_');
    const tableCaption = substitute(getText('biomass_table_caption', lang), vars);

    const scrollToElement = (id) => makeScrollToIdHandler(id);

    useEffect(() => {
        let cancelled = false;
        getBiomassData()
            .then((data) => {
                if (!cancelled) setBiomassData(data);
            })
            .catch(() => {
                if (!cancelled) setBiomassData(null);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const slices = useMemo(() => {
        const yearSlices = biomassData?.slices || [];
        return PIE_KEYS.map((key) => yearSlices.find((slice) => slice.key === key)).filter(Boolean);
    }, [biomassData]);

    const pieValues = slices.map((slice) => {
        const n = typeof slice.pct === 'number' ? slice.pct : 0;
        return n > 0 ? n : 0.001;
    });
    const baseColors = slices.map((slice) => PIE_COLORS[slice.key] ?? '#999999');
    const pieColors = effectiveSelectedSlices?.length
        ? baseColors.map((color, index) => (effectiveSelectedSlices.includes(index) ? color : hexToRgba(color, 0.3)))
        : baseColors;
    const labels = slices.map((slice) => getText(PIE_LABEL_KEYS[slice.key], lang));
    const chartSummary = slices.length ? joinChartSummary({
        intro: lang === 'en'
            ? `Pie chart of renewable energy production shares for ${selectedYear}`
            : `Graphique circulaire des parts de production d'énergie renouvelable pour ${selectedYear}`,
        body: summarizeByCategory({
            categories: labels,
            series: [{
                name: lang === 'en' ? 'Share' : 'Part',
                values: slices.map((slice) => slice.pct),
                format: formatShareSpoken,
            }],
            lang,
        }),
    }) : '';
    const chartRegionLabel = chartSummary ? `${exportChartTitle}. ${chartSummary}` : exportChartTitle;
    const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 16;
    const outsideTextSize = zoomLegendMode ? 16 : textSize;

    const plotData = useMemo(() => {
        if (!slices.length) return [];
        const pull = effectiveSelectedSlices?.length
            ? pieValues.map((_, index) => (effectiveSelectedSlices.includes(index) ? 0.08 : 0.02))
            : pieValues.map((_, index) => (index === SOLID_BIOFUELS_INDEX ? 0.05 : 0.02));
        return [{
            type: 'pie',
            values: pieValues,
            labels,
            direction: 'clockwise',
            sort: false,
            customdata: slices.map((slice) => formatSharePct(slice.pct)),
            texttemplate: zoomLegendMode ? '%{customdata}' : '%{label}<br>%{customdata}',
            textinfo: 'text',
            textposition: zoomLegendMode ? 'inside' : 'outside',
            textfont: { size: textSize, family: 'Arial, sans-serif', color: zoomLegendMode ? '#ffffff' : pieColors },
            outsidetextfont: { size: outsideTextSize, color: pieColors },
            marker: { colors: pieColors, line: { color: '#ffffff', width: 1 } },
            pull,
            hovertext: slices.map((slice) => {
                const label = getText(PIE_LABEL_KEYS[slice.key], lang);
                return `<b>${label}</b><br>${formatSharePct(slice.pct)}`;
            }),
            hoverinfo: 'text',
            hoverlabel: { bgcolor: '#ffffff', font: { color: '#333333', size: 14, family: 'Arial, sans-serif' } },
            automargin: true,
        }];
    }, [slices, labels, pieValues, pieColors, effectiveSelectedSlices, textSize, outsideTextSize, zoomLegendMode, lang, formatSharePct]);

    const layout = useMemo(() => ({
        showlegend: false,
        margin: {
            t: zoomLegendMode ? 40 : 50,
            b: zoomLegendMode ? 24 : 40,
            l: windowWidth <= 480 ? 0 : zoomLegendMode ? 16 : 120,
            r: windowWidth <= 480 ? 0 : zoomLegendMode ? 16 : 120,
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        height: windowWidth <= 480 ? 340 : 380,
        clickmode: 'event',
        dragmode: false,
    }), [zoomLegendMode, windowWidth]);

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${fileSlugBase}.png`,
        title: exportChartTitle,
        width: 1200,
        height: 800,
        legendItems: slices.map((slice) => ({
            label: getText(PIE_LABEL_KEYS[slice.key], lang),
            color: PIE_COLORS[slice.key],
        })),
    }),
        [PIE_COLORS, PIE_LABEL_KEYS, exportChartTitle, fileSlugBase, getText, lang, slices],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('biomass_table_col_year', lang), align: 'left' },
        { key: 'category', header: getText('biomass_table_col_category', lang), align: 'left' },
        { key: 'share', header: getText('biomass_table_col_share', lang), align: 'num' },
    ], [lang]);

    const tableRows = useMemo(
        () =>
            slices.map((slice) => ({
                year: selectedYear,
                category: getText(PIE_LABEL_KEYS[slice.key], lang),
                share: slice.pct,
            })),
        [slices, selectedYear, lang],
    );

    const fallbackBullets = ['biomass_bullet1', 'biomass_bullet2', 'biomass_bullet3', 'biomass_bullet4']
        .map((key) => getText(key, lang));
    const bulletItems = biomassData?.bullets?.[lang]?.length
        ? biomassData.bullets[lang]
        : fallbackBullets;

    return (
        <PageShell tabIndex="-1"
            className="page-content biomass page-chrome page-chrome--bleed"
            aria-labelledby="biomass-main-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.biomass.page-content { max-width: none !important; overflow-x: visible !important; }
.biomass {
}
.biomass-container { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.biomass-title {
    line-height: 1.25;
    text-transform: none;
}
.biomass-split {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    gap: 24px;
    align-items: start;
}
.biomass-split.is-stacked { grid-template-columns: 1fr; }
.biomass-left { min-width: 0; }
.biomass-right { min-width: 0; }
.biomass-bullets {
    margin: 0;
    padding-left: 1.25em;
    font-family: var(--font-body);
    font-size: clamp(16px, 1.8vw, 18px);
    color: var(--gc-text);
    line-height: 1.55;
}
.biomass-bullets li { margin-bottom: 3.9em; }
.biomass-bullets li:last-child { margin-bottom: 0; }
.biomass-split.is-stacked .biomass-bullets li { margin-bottom: 0.85em; }
.biomass-split.is-stacked .biomass-bullets li:last-child { margin-bottom: 0; }
.biomass-infographic {
    position: relative;
    width: 100%;
    container-type: inline-size;
    container-name: biomass-infographic;
}
.biomass-infographic-bg,
.biomass-infographic-bg svg {
    width: 100%;
    height: auto;
    display: block;
}
.biomass-infographic .fn-lnk.biomass-infographic-fn {
    /* Scale with the SVG so gaps stay proportional at browser zoom */
    min-width: 4.2cqw;
    width: 4.2cqw;
    height: 4.2cqw;
    padding: 0;
    font-size: 2.7cqw;
    line-height: 1;
    box-sizing: border-box;
    z-index: 2;
    transform: translateY(-50%);
}
.biomass-infographic-figure { margin: 0 0 16px 0; }
.biomass-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: clamp(18px, 2.2vw, 22px);
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 12px 0;
    text-transform: none;
}
.biomass-chart-frame {
    padding: 16px;
}
.biomass-donut-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    min-height: 340px;
}
.biomass-donut-figure {
    width: 100%;
    max-width: 720px;
    min-width: 280px;
    min-height: 320px;
    height: 380px;
    margin: 0;
    position: relative;
}
.biomass-custom-legend {
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
.biomass-custom-legend-item { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.biomass-custom-legend-swatch {
    width: 12px;
    height: 12px;
    display: inline-block;
    border-radius: 2px;
    border: 1px solid rgba(0, 0, 0, 0.15);
}
.wb-inv {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    border: 0;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
}
@media (max-width: 768px) {
    .biomass-donut-figure { height: 340px; min-height: 340px; }
}
            `}</style>

            <div className="biomass-container">
                <header>
                    <h1 id="biomass-main-title" className="biomass-title page-chrome-title">
                        {getText('biomass_title', lang)}
                    </h1>
                </header>

                <div className={`biomass-split${stackedLayout ? ' is-stacked' : ''}`}>
                    <div className="biomass-left">
                        <ul className="biomass-bullets">
                            {bulletItems.map((html, index) => (
                                <SafeHtml as="li" key={`${lang}-${index}`} html={html} />
                            ))}
                        </ul>
                    </div>

                    <div className="biomass-right">
                        <BiomassInfographic
                            lang={lang}
                            scrollToElement={scrollToElement}
                            oecdShare={biomassData?.oecdShare}
                            canadaShare={biomassData?.canadaShare}
                        />

                        <div className="biomass-chart-frame page-chrome-chart-frame">
                            <h2 className="biomass-chart-title wb-inv">{chartTitle}</h2>
                            {effectiveSelectedSlices?.length > 0 && (
                                <ClearSelectionButton
                                    lang={lang}
                                    label={getText('biomass_clear_selection', lang)}
                                    onClick={() => setSelectedSlices(null)}
                                />
                            )}
                            <div className="biomass-donut-wrap" ref={chartRef}>
                                <figure className="biomass-donut-figure" role="region" aria-label={chartRegionLabel} tabIndex={0}>
                                    <div aria-hidden="true" style={{ width: '100%', height: '100%' }}>
                                    <Plot
                                        key={`biomass-${selectedYear}-${zoomLegendMode ? 'compact' : 'wide'}-${effectiveSelectedSlices ? effectiveSelectedSlices.join('-') : 'none'}`}
                                        data={plotData}
                                        layout={layout}
                                        config={plotConfig}
                                        style={{ width: '100%', minWidth: 280, minHeight: 320, height: '100%' }}
                                        useResizeHandler
                                        onClick={(eventData) => {
                                            if (!eventData.points?.length) return;
                                            const idx = eventData.points[0].pointNumber ?? eventData.points[0].pointIndex;
                                            if (idx == null) return;
                                            if (windowWidth <= 768) {
                                                const now = Date.now();
                                                const last = lastPieClickRef.current;
                                                const doubleTap = idx === last.index && now - last.time < 300;
                                                lastPieClickRef.current = { time: now, index: idx };
                                                if (!doubleTap) return;
                                            }
                                            setSelectedSlices((prev) => {
                                                if (prev === null) return [idx];
                                                if (prev.includes(idx)) return prev.length <= 1 ? null : prev.filter((i) => i !== idx);
                                                return [...prev, idx];
                                            });
                                        }}
                                    />
                                    </div>
                                </figure>
                                {zoomLegendMode && (
                                    <div className="biomass-custom-legend" aria-label={lang === 'en' ? 'Chart legend' : 'Légende du graphique'}>
                                        {slices.map((slice) => (
                                            <span key={slice.key} className="biomass-custom-legend-item">
                                                <span
                                                    className="biomass-custom-legend-swatch"
                                                    style={{ backgroundColor: PIE_COLORS[slice.key] }}
                                                    aria-hidden="true"
                                                />
                                                <span>{getText(PIE_LABEL_KEYS[slice.key], lang)}</span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <ChartDataTable
                                lang={lang}
                                columns={tableColumns}
                                rows={tableRows}
                                csvFilename={`${fileSlugBase}.csv`}
                                docx={{
                                    filename: `${fileSlugBase}.docx`,
                                    title: stripHtml(tableCaption),
                                    titleAlign: 'center',
                                    columnWidths: [1400, 4200, 1800],
                                    fontSize: 22,
                                }}
                                caption={tableCaption}
                                tableAriaLabel={tableCaption}
                                renderCell={(raw, { colIndex }) => (
                                    colIndex === 2 ? formatSharePct(raw) : String(raw ?? '')
                                )}
                            />
                        </div>
                    </div>
                </div>

                <PageFootnotes
                    lang={lang}
                    titleId="fn-biomass"
                    items={[
                        { id: biomassFnDefId(1), marker: '1', text: getText('biomass_footnote1', lang), returnHref: `#${biomassFnRefId(1)}` },
                        { id: biomassFnDefId(2), marker: '2', text: getText('biomass_footnote2', lang), returnHref: `#${biomassFnRefId(2)}` },
                    ]}
                />
            </div>
        </PageShell>
    );
};

export default Biomass;
