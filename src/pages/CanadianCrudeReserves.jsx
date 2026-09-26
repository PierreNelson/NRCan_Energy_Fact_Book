import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import FootnoteMarker from '../components/FootnoteMarker';
import ClearSelectionButton from '../components/ClearSelectionButton';
import PageFootnotes from '../components/PageFootnotes';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { saveAs } from 'file-saver';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getCanadianCrudeReservesData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { makeScrollToIdHandler } from '../utils/scrollToId';

import CanadianCrudeReservesInfographic from '../components/CanadianCrudeReservesInfographic';
import canadianCrudeReservesBg from '../assets/canadian_crude_reserves_bg.png';
import { OVERLAY_COLORS, LABEL_SLOTS, VALUE_SLOTS } from '../components/CanadianCrudeReservesInfographic.constants';

const BAR_COLOR = '#4a8eb8';
const LINE_COLOR = '#7D962C';

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const CanadianCrudeReserves = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const windowWidth = useWindowWidth();
    const {
        selected: selectedPoints,
        clear: clearSelection,
        onPlotClick: handleChartClick,
    } = usePlotlySelection({ mode: 'points', traceCount: 2, windowWidth });
    const chartRef = useRef(null);
    const infographicFigureRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const formatInt = (n) =>
        n == null || Number.isNaN(n)
            ? '\u2014'
            : Math.round(n).toLocaleString(locale);

    const formatReserve = (value, digits = 0) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        });
    };

    const scrollToElement = (id) => makeScrollToIdHandler(id);

    useEffect(() => {
        getCanadianCrudeReservesData()
            .then(setResult)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    const chartData = useMemo(() => result?.wells ?? [], [result]);
    const reserves = result?.reserves;
    const startYear = result?.startYear ?? 2000;
    const endYear = result?.endYear ?? startYear;
    const yearRangeSuffix = startYear === endYear ? ` (${startYear})` : ` (${startYear}-${endYear})`;

    const textVars = { year: reserves?.reportingYear ?? '', startYear, endYear };

    const fileSlugBase =
        lang === 'en'
            ? `western_canada_oil_wells_completed_${startYear}-${endYear}`
            : `puits_petrole_ouest_canada_${startYear}-${endYear}`;

    const infographicPngSlug = getText('petroleum_reserves_infographic_png_slug', lang);

    const years = useMemo(() => chartData.map((d) => d.year), [chartData]);
    const counts = useMemo(() => chartData.map((d) => d.wellsCompleted), [chartData]);
    const depths = useMemo(() => chartData.map((d) => d.avgDepthM), [chartData]);

    const legendBars = getText('petroleum_reserves_legend_bars', lang);
    const legendLine = getText('petroleum_reserves_legend_line', lang);
    const yCount = getText('petroleum_reserves_yaxis_count', lang);
    const yDepth = getText('petroleum_reserves_yaxis_depth', lang);
    const chartTitle = getText('petroleum_reserves_chart_title', lang);
    const exportTitleWithRange = `${stripHtml(chartTitle)}${yearRangeSuffix}`;

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('petroleum_employment_table_col_year', lang), align: 'left' },
        { key: 'wellsCompleted', header: getText('petroleum_reserves_table_col_count', lang), align: 'num' },
        { key: 'avgDepthM', header: getText('petroleum_reserves_table_col_depth', lang), align: 'num' },
    ], [lang]);

    const tableCaption = substitute(getText('petroleum_reserves_table_caption', lang), textVars);

    const plotBottomMargin = windowWidth <= 480 ? 100 : windowWidth <= 768 ? 88 : 72;
    const plotTopMargin = windowWidth <= 480 ? 56 : 48;
    const chartHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 440;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = {
        size: windowWidth <= 768 ? 18 : 22,
        family: 'Arial, sans-serif',
        color: '#58585a',
    };

    const maxCount = counts.length ? Math.max(...counts) : 12000;
    const yCountMax = Math.ceil(maxCount / 2000) * 2000 || 12000;
    const maxDepth = depths.length ? Math.max(...depths) : 3000;
    const yDepthMax = Math.ceil(maxDepth / 500) * 500 || 3000;

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${fileSlugBase}.png`,
        title: exportTitleWithRange,
        height: 700,
        legendItems: [
            { label: legendBars, color: BAR_COLOR },
            { label: legendLine, color: LINE_COLOR },
        ],
    }),
        [BAR_COLOR, LINE_COLOR, exportTitleWithRange, fileSlugBase, legendBars, legendLine],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const downloadInfographicPng = async () => {
        const img = new Image();
        img.src = canadianCrudeReservesBg;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        const scale = 3;
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const overlayLang = lang === 'fr' ? 'fr' : 'en';
        const labelSlots = LABEL_SLOTS[overlayLang];
        const valueSlots = VALUE_SLOTS;

        const drawLabel = (text, slot, fontSizeRatio = 0.032) => {
            if (!text) return;
            ctx.fillStyle = OVERLAY_COLORS.label;
            ctx.font = `bold ${Math.round(canvas.width * fontSizeRatio)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
            ctx.textBaseline = 'middle';
            const align = slot.align ?? 'left';
            ctx.textAlign = align;
            const x = (slot.left / 100) * canvas.width;
            const y = (slot.top / 100) * canvas.height;
            ctx.fillText(text, x, y);
        };

        const drawValue = (text, slot, color, fontSizeRatio = 0.085) => {
            if (!text || text === '–') return;
            ctx.fillStyle = color;
            const ratio = slot.size === 'sm' ? 0.032 : fontSizeRatio;
            ctx.font = `bold ${Math.round(canvas.width * ratio)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
            ctx.textBaseline = 'middle';
            const align = slot.align ?? 'center';
            ctx.textAlign = align;
            const x = (slot.left / 100) * canvas.width;
            const y = (slot.top / 100) * canvas.height;
            ctx.fillText(text, x, y);
        };

        drawLabel(getText('petroleum_reserves_label_canada_total', lang), labelSlots.canada_total, overlayLang === 'fr' ? 0.028 : 0.032);
        drawValue(formatReserve(reserves?.totalBb, 0), valueSlots.total_bb, OVERLAY_COLORS.total_bb);
        drawLabel(`${getText('petroleum_reserves_label_conventional', lang)}**`, labelSlots.conventional, overlayLang === 'fr' ? 0.028 : 0.032);
        drawValue(formatReserve(reserves?.conventionalBb, 0), valueSlots.conventional_bb, OVERLAY_COLORS.conventional_bb);
        drawLabel(getText('petroleum_reserves_label_oil_sands', lang), labelSlots.oil_sands, overlayLang === 'fr' ? 0.028 : 0.032);
        drawValue(formatReserve(reserves?.oilSandsBb, 0), valueSlots.oil_sands_bb, OVERLAY_COLORS.oil_sands_bb);
        drawLabel(getText('petroleum_reserves_label_mining', lang), labelSlots.mining, overlayLang === 'fr' ? 0.028 : 0.032);
        drawValue(formatReserve(reserves?.miningBb, 0), valueSlots.mining_bb, OVERLAY_COLORS.mining_bb);
        drawLabel(getText('petroleum_reserves_label_insitu', lang), labelSlots.insitu, overlayLang === 'fr' ? 0.028 : 0.032);
        drawValue(formatReserve(reserves?.insituBb, 0), valueSlots.insitu_bb, OVERLAY_COLORS.insitu_bb);

        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${infographicPngSlug}.png`);
        });
    };

    const countHoverTemplates = years.map(
        (yr, i) => `<b>${legendBars}</b><br>${yr}: ${formatInt(counts[i])}<extra></extra>`,
    );
    const depthHoverTemplates = years.map(
        (yr, i) => `<b>${legendLine}</b><br>${yr}: ${formatInt(depths[i])} m<extra></extra>`,
    );

    const barMarkerOpacity =
        selectedPoints === null ? 1 : years.map((_, i) => (selectedPoints[0]?.includes(i) ? 1 : 0.3));
    const lineMarkerOpacity =
        selectedPoints === null ? 1 : years.map((_, i) => (selectedPoints[1]?.includes(i) ? 1 : 0.3));
    const lineStrokeOpacity =
        selectedPoints === null || (selectedPoints[1] && selectedPoints[1].length > 0) ? 1 : 0.3;

    if (loading || error) return <PageStatus lang={lang} loading={loading} error={error} />;
    if (!reserves || !chartData.length) return <p>{getText('petroleum_reserves_no_data', lang)}</p>;

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-110 canadian-crude-reserves page-chrome page-chrome--bleed"
            aria-labelledby="canadian-crude-reserves-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.page-110.page-content {
    max-width: none !important;
    overflow-x: visible !important;
}
.page-110.canadian-crude-reserves {
}
.canadian-crude-reserves-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.canadian-crude-reserves-title {
    margin-bottom: 20px;
    line-height: 1.25;
    text-transform: none;
}
.canadian-crude-reserves-section-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 8px 0;
    text-transform: none;
}
.canadian-crude-reserves-units {
    font-family: var(--font-body);
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
    margin: 0 0 16px 0;
}
.canadian-crude-reserves-infographic-actions { margin: 0 0 28px 0; }
.canadian-crude-reserves-infographic-actions button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.canadian-crude-reserves-infographic-actions button:hover { background: #404040; }
.canadian-crude-reserves-chart-frame {
    margin-bottom: 24px;
}
.canadian-crude-reserves-chart-title {
    color: var(--gc-text);
    margin-bottom: 12px;
    text-transform: none;
}
.canadian-crude-reserves-chart { width: 100%; position: relative; min-height: 0; }
.canadian-crude-reserves-legend {
    display: flex;
    justify-content: center;
    margin: 20px 0;
    font-family: 'Noto Sans', sans-serif;
}
.canadian-crude-reserves-legend-inner { display: flex; flex-wrap: wrap; gap: 15px 40px; justify-content: center; }
.canadian-crude-reserves-legend-item { display: flex; align-items: center; gap: 10px; }
.canadian-crude-reserves-legend-swatch-bar { width: 22px; height: 14px; background-color: ${BAR_COLOR}; }
.canadian-crude-reserves-legend-line {
    width: 28px; height: 0; border-top: 3px solid ${LINE_COLOR}; position: relative;
}
.canadian-crude-reserves-legend-line::after {
    content: ''; position: absolute; width: 8px; height: 8px;
    background: ${LINE_COLOR}; left: 10px; top: -5px;
}
.canadian-crude-reserves-legend-label { font-size: 18px; color: var(--gc-text); }
.canadian-crude-reserves-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.canadian-crude-reserves-footnotes {
    font-family: var(--font-body); font-size: 1rem; color: var(--gc-text);
    margin-top: 24px; padding-top: 12px; border-top: 1px solid #e0e0e0; line-height: 1.65;
}
.canadian-crude-reserves-footnotes h2 {
    font-family: var(--font-heading); font-size: 1.4rem; font-weight: 700; margin: 0 0 1rem 0;
}
.canadian-crude-reserves-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
@media (max-width: 768px) {
    .canadian-crude-reserves-section-title { font-size: 26px; }
    .canadian-crude-reserves-units { font-size: 18px; }
}
            `}</style>

            <div className="canadian-crude-reserves-inner">
                <h1 id="canadian-crude-reserves-title" className="canadian-crude-reserves-title page-chrome-title">{getText('petroleum_reserves_title', lang)}</h1>

                <h2 id="canadian-crude-reserves-infographic-title" className="canadian-crude-reserves-section-title">
                    {getText('petroleum_reserves_infographic_title', lang)}
                    <FootnoteMarker
                            lang={lang}
                            href="#fn-asterisk-canadian-crude-reserves"
                            id="fn-asterisk-rf-canadian-crude-reserves"
                            marker="*"
                            onClick={scrollToElement('fn-asterisk-canadian-crude-reserves')}
                        />
                </h2>
                <p className="canadian-crude-reserves-units">{substitute(getText('petroleum_reserves_infographic_units', lang), textVars)}</p>

                <CanadianCrudeReservesInfographic
                    figureRef={infographicFigureRef}
                    lang={lang}
                    overlayValues={reserves}
                    formatReserve={formatReserve}
                    getText={getText}
                    onFootnoteClick={scrollToElement}
                    ariaLabel={getText('petroleum_reserves_bg_alt', lang)}
                />

                <div className="canadian-crude-reserves-infographic-actions">
                    <button type="button" onClick={downloadInfographicPng}>{getText('petroleum_reserves_download_png', lang)}</button>
                </div>

                <div className="canadian-crude-reserves-chart-frame page-chrome-chart-frame">
                    <h2 id="canadian-crude-reserves-chart-title" className="canadian-crude-reserves-chart-title page-chrome-chart-title">{chartTitle}</h2>

                    <div className="canadian-crude-reserves-chart-block">
                        <div role="region" aria-label={getText('petroleum_reserves_chart_aria', lang)} tabIndex="0">
                            {selectedPoints !== null && (
                                <ClearSelectionButton lang={lang} onClick={clearSelection} />
                            )}
                            <figure ref={chartRef} className="canadian-crude-reserves-chart" style={{ margin: 0 }}>
                                <div aria-hidden="true">
                                    <Plot
                                        data={[
                                            {
                                                name: legendBars,
                                                x: years,
                                                y: counts,
                                                type: 'bar',
                                                marker: { color: BAR_COLOR, opacity: barMarkerOpacity },
                                                hovertemplate: countHoverTemplates,
                                            },
                                            {
                                                name: legendLine,
                                                x: years,
                                                y: depths,
                                                type: 'scatter',
                                                mode: 'lines+markers',
                                                line: { color: LINE_COLOR, width: 3, opacity: lineStrokeOpacity },
                                                marker: { color: LINE_COLOR, size: 6, opacity: lineMarkerOpacity },
                                                yaxis: 'y2',
                                                hovertemplate: depthHoverTemplates,
                                            },
                                        ]}
                                        layout={{
                                            autosize: true,
                                            hoverlabel: {
                                                bgcolor: '#ffffff',
                                                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
                                            },
                                            hovermode: 'closest',
                                            clickmode: 'event',
                                            dragmode: false,
                                            bargap: 0.2,
                                            margin: {
                                                l: windowWidth <= 480 ? 52 : 64,
                                                r: windowWidth <= 480 ? 52 : 64,
                                                t: plotTopMargin,
                                                b: plotBottomMargin,
                                            },
                                            paper_bgcolor: 'rgba(0,0,0,0)',
                                            plot_bgcolor: 'rgba(0,0,0,0)',
                                            showlegend: false,
                                            xaxis: {
                                                title: {
                                                    text: getText('petroleum_employment_table_col_year', lang),
                                                    font: axisTitleFont,
                                                    standoff: 8,
                                                },
                                                tickmode: 'linear',
                                                dtick: 2,
                                                tickfont: tickFont,
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                range: [startYear - 1, endYear + 1],
                                                automargin: true,
                                            },
                                            yaxis: {
                                                title: { text: yCount, font: axisTitleFont, standoff: 8 },
                                                range: [0, yCountMax * 1.1],
                                                tick0: 0,
                                                dtick: 2000,
                                                tickfont: tickFont,
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                side: 'left',
                                                automargin: true,
                                            },
                                            yaxis2: {
                                                title: { text: yDepth, font: axisTitleFont, standoff: 8 },
                                                range: [0, yDepthMax * 1.1],
                                                tick0: 0,
                                                dtick: 500,
                                                tickfont: tickFont,
                                                overlaying: 'y',
                                                side: 'right',
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                automargin: true,
                                            },
                                        }}
                                        config={plotConfig}
                                        style={{ width: '100%', height: `${chartHeight}px` }}
                                        useResizeHandler
                                        onClick={handleChartClick}
                                    />
                                </div>
                            </figure>
                        </div>

                        <div className="canadian-crude-reserves-legend" aria-hidden="true">
                            <div className="canadian-crude-reserves-legend-inner">
                                <div className="canadian-crude-reserves-legend-item">
                                    <span className="canadian-crude-reserves-legend-swatch-bar" />
                                    <span className="canadian-crude-reserves-legend-label">{legendBars}</span>
                                </div>
                                <div className="canadian-crude-reserves-legend-item">
                                    <span className="canadian-crude-reserves-legend-line" />
                                    <span className="canadian-crude-reserves-legend-label">{legendLine}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="canadian-crude-reserves-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            label={getText('petroleum_reserves_table_summary', lang)}
                            columns={tableColumns}
                            rows={chartData}
                            csvFilename={`${fileSlugBase}.csv`}
                            docx={{
                                filename: `${fileSlugBase}.docx`,
                                title: exportTitleWithRange,
                                titleAlign: 'center',
                                columnWidths: [2000, 3200, 3200],
                                fontSize: 22,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={getText('petroleum_reserves_table_summary', lang)}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatInt(raw)
                            )}
                        />
                    </div>
                </div>

                <PageFootnotes
                    lang={lang}
                    titleId="fn-canadian-crude-reserves"
                    className="canadian-crude-reserves-footnotes"
                    items={[
                        { id: 'fn-asterisk-canadian-crude-reserves', marker: '*', text: getText('petroleum_reserves_footnote_asterisk', lang), returnHref: '#fn-asterisk-rf-canadian-crude-reserves' },
                        { id: 'fn-dagger-canadian-crude-reserves', marker: '**', text: getText('petroleum_reserves_footnote_dagger', lang), returnHref: '#fn-dagger-rf-canadian-crude-reserves-infographic' },
                    ]}
                />
            </div>
        </PageShell>
    );
};

export default CanadianCrudeReserves;
