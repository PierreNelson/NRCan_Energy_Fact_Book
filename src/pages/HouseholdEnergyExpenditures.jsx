import React, { useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { saveAs } from 'file-saver';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { waitForImage } from '../utils/downloadInfographicPng';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { joinChartSummary, summarizeByCategory } from '../utils/chartSpokenSummary';
import householdEnergyExpendituresBg from '../assets/household_energy_expenditures_bg.png';
import hexToRgba from '../utils/hexToRgba';
import HtmlLegend from '../components/HtmlLegend';

const CPI_YEARS = Array.from({ length: 23 }, (_, i) => 2003 + i);

const CPI_DATA = {
    energy: [100, 105, 115, 125, 132, 168, 120, 125, 140, 152, 148, 162, 138, 132, 128, 135, 142, 138, 118, 145, 245, 200, 190],
    total: [100, 102, 104, 106, 109, 111, 114, 116, 119, 122, 125, 128, 131, 134, 137, 140, 143, 146, 149, 153, 161, 164, 166],
    excluding: [99, 101, 103, 105, 107, 109, 112, 114, 116, 119, 122, 125, 128, 130, 133, 136, 139, 141, 144, 148, 155, 159, 161],
};

const COLORS = {
    energy: '#6d6e71',
    total: '#7eb8da',
    excluding: '#7b3f61',
};

const exportEnergyIntensityInfographicPng = async (rowEl, { title, scale = 2 }) => {
    if (!rowEl) return null;

    const exportRoot = rowEl.closest('.household-energy-expenditures-inner');
    const titleEl = exportRoot?.querySelector('#household-energy-expenditures-title');
    const imgEl = rowEl.querySelector('.household-energy-expenditures-bg-image');
    const bulletsEl = rowEl.querySelector('.household-energy-expenditures-top-bullets');
    if (!exportRoot || !titleEl || !imgEl || !bulletsEl) return null;

    const loaded = await waitForImage(imgEl);
    const rootRect = exportRoot.getBoundingClientRect();
    const bulletsBottom = bulletsEl.getBoundingClientRect().bottom;
    const canvasW = Math.ceil(exportRoot.clientWidth);
    const canvasH = Math.ceil(bulletsBottom - rootRect.top + 16);

    const canvas = document.createElement('canvas');
    canvas.width = canvasW * scale;
    canvas.height = canvasH * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const rel = (el) => {
        const box = el.getBoundingClientRect();
        return {
            x: box.left - rootRect.left,
            y: box.top - rootRect.top,
            w: box.width,
            h: box.height,
        };
    };

    const titleBox = rel(titleEl);
    const titleStyle = window.getComputedStyle(titleEl);
    ctx.font = `${titleStyle.fontWeight} ${titleStyle.fontSize} ${titleStyle.fontFamily}`;
    ctx.fillStyle = titleStyle.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, titleBox.x, titleBox.y);

    const imgBox = rel(imgEl);
    ctx.drawImage(loaded, imgBox.x, imgBox.y, imgBox.w, imgBox.h);

    const drawTextSegment = (node) => {
        const raw = node.textContent ?? '';
        if (!raw.trim()) return;
        const range = document.createRange();
        range.selectNodeContents(node);
        const style = window.getComputedStyle(node.nodeType === Node.TEXT_NODE ? node.parentElement : node);
        ctx.fillStyle = style.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        ctx.font = font;
        const rects = Array.from(range.getClientRects());
        if (rects.length <= 1) {
            const rect = rects[0] ?? range.getBoundingClientRect();
            ctx.fillText(raw, rect.left - rootRect.left, rect.top - rootRect.top);
            return;
        }
        const leading = raw.match(/^\s*/)?.[0] ?? '';
        const words = raw.trim().split(/\s+/);
        let wordIndex = 0;
        rects.forEach((rect, rectIndex) => {
            let line = rectIndex === 0 ? leading : '';
            while (wordIndex < words.length) {
                const separator = line && !line.endsWith(' ') ? ' ' : '';
                const candidate = `${line}${separator}${words[wordIndex]}`;
                if (line && ctx.measureText(candidate).width > rect.width + 2) break;
                line = candidate;
                wordIndex += 1;
            }
            if (line) {
                ctx.fillText(line, rect.left - rootRect.left, rect.top - rootRect.top);
            }
        });
    };

    bulletsEl.querySelectorAll('li').forEach((li) => {
        li.childNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                drawTextSegment(node);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                drawTextSegment(node);
            }
        });
    });

    return canvas;
};

const HouseholdEnergyExpenditures = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const {
        selected: selectedPoints,
        clear: clearSelection,
        onPlotClick: handleChartClick,
        opacityFor: markerOpacityFor,
    } = usePlotlySelection({ mode: 'points', traceCount: 3, windowWidth });
    const infographicRef = useRef(null);
    const topRowRef = useRef(null);
    const chartRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const pageTitle = getText('household_energy_expenditures_title', lang);
    const chartTitle = getText('household_energy_expenditures_chart_title', lang);
    const exportChartTitle = stripHtml(chartTitle);
    const chartDownloadSlug = getText('household_energy_expenditures_download_title', lang).replace(/\s+/g, '_');
    const infographicDownloadSlug = getText('household_energy_expenditures_infographic_download_title', lang).replace(/\s+/g, '_');

    const legendEnergy = getText('household_energy_expenditures_legend_energy', lang);
    const legendTotal = getText('household_energy_expenditures_legend_total', lang);
    const legendExcluding = getText('household_energy_expenditures_legend_excluding', lang);
    const yAxisTitle = getText('household_energy_expenditures_yaxis', lang);

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('petroleum_employment_table_col_year', lang), align: 'left' },
        { key: 'energy', header: `${legendEnergy} (2002=100)`, align: 'num' },
        { key: 'total', header: `${legendTotal} (2002=100)`, align: 'num' },
        { key: 'excluding', header: `${legendExcluding} (2002=100)`, align: 'num' },
    ], [lang, legendEnergy, legendTotal, legendExcluding]);

    const tableRows = useMemo(
        () =>
            CPI_YEARS.map((year, index) => ({
                year,
                energy: CPI_DATA.energy[index],
                total: CPI_DATA.total[index],
                excluding: CPI_DATA.excluding[index],
            })),
        [],
    );

    const formatIndex = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const getChartSummary = () => {
        const firstYear = CPI_YEARS[0];
        const lastYear = CPI_YEARS[CPI_YEARS.length - 1];
        const body = summarizeByCategory({
            categories: CPI_YEARS,
            series: [
                { name: legendEnergy, values: CPI_DATA.energy, format: formatIndex },
                { name: legendTotal, values: CPI_DATA.total, format: formatIndex },
                { name: legendExcluding, values: CPI_DATA.excluding, format: formatIndex },
            ],
            lang,
            newestFirst: true,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Line chart of ${legendEnergy}, ${legendTotal}, and ${legendExcluding} from ${firstYear} to ${lastYear}`
                : `Graphique linéaire de ${legendEnergy}, ${legendTotal} et ${legendExcluding} de ${firstYear} à ${lastYear}`,
            unitNote: lang === 'en'
                ? 'Index, 2002 equals 100'
                : 'Indice, 2002 égale 100',
            body,
        });
    };

    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 62 : windowWidth <= 768 ? 56 : 50;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };
    const yTickvals = [90, 110, 130, 150, 170, 190, 210, 230, 250];

    const traceHasSelection = (traceIndex) => selectedPoints?.[traceIndex]?.length > 0;

    const lineColorFor = (traceIndex, baseColor) => {
        if (selectedPoints === null) return baseColor;
        return traceHasSelection(traceIndex) ? baseColor : hexToRgba(baseColor, 0.3);
    };

    

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${chartDownloadSlug}.png`,
        title: exportChartTitle,
        height: 640,
        legendItems: [
            { label: legendEnergy, color: COLORS.energy },
            { label: legendTotal, color: COLORS.total },
            { label: legendExcluding, color: COLORS.excluding, dash: true },
        ],
    }),
        [COLORS, chartDownloadSlug, exportChartTitle, legendEnergy, legendExcluding, legendTotal],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const downloadInfographicPng = async () => {
        const canvas = await exportEnergyIntensityInfographicPng(topRowRef.current, {
            title: stripHtml(pageTitle),
            scale: 2,
        });
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${infographicDownloadSlug}.png`);
        });
    };

    const energyHover = CPI_YEARS.map(
        (y, i) => `<b>${legendEnergy}</b><br>${y}: ${formatIndex(CPI_DATA.energy[i])}<extra></extra>`,
    );
    const totalHover = CPI_YEARS.map(
        (y, i) => `<b>${legendTotal}</b><br>${y}: ${formatIndex(CPI_DATA.total[i])}<extra></extra>`,
    );
    const excludingHover = CPI_YEARS.map(
        (y, i) => `<b>${legendExcluding}</b><br>${y}: ${formatIndex(CPI_DATA.excluding[i])}<extra></extra>`,
    );

    const selectionKey = selectedPoints
        ? selectedPoints.map((arr) => arr.join('-')).join('_')
        : 'all';

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-44 household-energy-expenditures-household-expenditures page-chrome page-chrome--bleed"
            aria-labelledby="household-energy-expenditures-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.page-44.household-energy-expenditures-household-expenditures {
}
.household-energy-expenditures-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.household-energy-expenditures-title {
    font-size: 50px;
    margin: 0 0 24px 0;
    text-transform: none;
}
.household-energy-expenditures-top-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    gap: 28px;
    align-items: stretch;
    margin-bottom: 32px;
}
.household-energy-expenditures-infographic-col {
    min-width: 0;
    display: flex;
    flex-direction: column;
    height: 100%;
}
.household-energy-expenditures-infographic-visual {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
}
.household-energy-expenditures-infographic-figure {
    display: block;
    width: 100%;
    margin: 0;
}
.household-energy-expenditures-bg-image {
    display: block;
    width: 100%;
    height: auto;
    user-select: none;
}
.household-energy-expenditures-infographic-download {
    flex: 0 0 auto;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 15px;
}
.household-energy-expenditures-top-bullets {
    font-family: var(--font-body);
    font-size: 20px;
    color: var(--gc-text);
    line-height: 1.5;
    margin: 0;
    padding-left: 1.25rem;
}
.household-energy-expenditures-top-bullets li { margin-bottom: 0.75rem; }
.household-energy-expenditures-subtitle {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 16px 0;
    line-height: 1.25;
    text-transform: none;
}
.household-energy-expenditures-bottom-bullets {
    font-family: var(--font-body);
    font-size: 20px;
    color: var(--gc-text);
    line-height: 1.5;
    margin: 0 0 24px 0;
    padding-left: 1.25rem;
}
.household-energy-expenditures-bottom-bullets li { margin-bottom: 0.65rem; }
.household-energy-expenditures-chart-frame {
    margin-bottom: 0;
}
.household-energy-expenditures-chart-title {
    color: var(--gc-text);
    margin: 0 0 12px 0;
    text-transform: none;
}
.household-energy-expenditures-chart {
    width: 100%;
    min-width: 0;
    height: ${plotHeight}px;
    position: relative;
}
.household-energy-expenditures-chart > div { width: 100%; height: 100%; }
.household-energy-expenditures-legend {
    gap: 18px 28px;
    margin-top: 12px;
    font-size: 14px;
    color: var(--gc-text);
}
.household-energy-expenditures-table-wrapper { display: block; width: 100%; margin-top: 20px; }
@media (max-width: 768px) {
    .household-energy-expenditures-title { font-size: 37px; }
    .household-energy-expenditures-top-row { grid-template-columns: 1fr; gap: 20px; }
    .household-energy-expenditures-infographic-col { height: auto; }
    .household-energy-expenditures-infographic-visual { flex: 0 0 auto; }
    .household-energy-expenditures-subtitle { font-size: 26px; }
    .household-energy-expenditures-top-bullets,
    .household-energy-expenditures-bottom-bullets { font-size: 18px; }
}
@media (max-width: 480px) {
    .household-energy-expenditures-title { font-size: 28px; }
    .household-energy-expenditures-chart { height: 320px; }
}
            `}</style>

            <div className="household-energy-expenditures-inner">
                <header>
                    <h1 id="household-energy-expenditures-title" className="household-energy-expenditures-title page-chrome-title">
                        {pageTitle}
                    </h1>
                </header>

                <div className="household-energy-expenditures-top-row" ref={topRowRef}>
                    <div className="household-energy-expenditures-infographic-col">
                        <div className="household-energy-expenditures-infographic-visual">
                            <figure
                                ref={infographicRef}
                                className="household-energy-expenditures-infographic-figure"
                                aria-label={getText('household_energy_expenditures_infographic_aria', lang)}
                            >
                                <img src={householdEnergyExpendituresBg} alt="" className="household-energy-expenditures-bg-image" draggable={false} aria-hidden="true" />
                                <figcaption className="wb-inv">{getText('household_energy_expenditures_infographic_aria', lang)}</figcaption>
                            </figure>
                        </div>
                        <div className="household-energy-expenditures-infographic-download">
                            <button type="button" className="download-table-btn" onClick={downloadInfographicPng}>
                                {getText('household_energy_expenditures_download_png', lang)}
                            </button>
                        </div>
                    </div>

                    <ul className="household-energy-expenditures-top-bullets" role="list">
                        <li role="listitem">
                            {getText('household_energy_expenditures_top_bullet1_part1', lang)}
                            <strong>{getText('household_energy_expenditures_top_bullet1_bold', lang)}</strong>
                            {getText('household_energy_expenditures_top_bullet1_part2', lang)}
                        </li>
                        <li role="listitem">
                            {getText('household_energy_expenditures_top_bullet2_part1', lang)}
                            <strong>{getText('household_energy_expenditures_top_bullet2_bold', lang)}</strong>
                            {getText('household_energy_expenditures_top_bullet2_part2', lang)}
                        </li>
                        <li role="listitem">
                            {getText('household_energy_expenditures_top_bullet3_part1', lang)}
                            <strong>{getText('household_energy_expenditures_top_bullet3_bold', lang)}</strong>
                            {getText('household_energy_expenditures_top_bullet3_part2', lang)}
                        </li>
                        <li role="listitem">
                            {getText('household_energy_expenditures_top_bullet4_part1', lang)}
                            <strong>{getText('household_energy_expenditures_top_bullet4_bold', lang)}</strong>
                            {getText('household_energy_expenditures_top_bullet4_part2', lang)}
                            {getText('household_energy_expenditures_top_bullet4_suffix', lang)}
                        </li>
                    </ul>
                </div>

                <section className="household-energy-expenditures-bottom-section" aria-labelledby="household-energy-expenditures-subtitle">
                    <h2 id="household-energy-expenditures-subtitle" className="household-energy-expenditures-subtitle">
                        {getText('household_energy_expenditures_subtitle', lang)}
                    </h2>

                    <ul className="household-energy-expenditures-bottom-bullets" role="list">
                        <li role="listitem">{getText('household_energy_expenditures_bottom_bullet1', lang)}</li>
                        <li role="listitem">{getText('household_energy_expenditures_bottom_bullet2', lang)}</li>
                    </ul>

                    <div className="household-energy-expenditures-chart-frame page-chrome-chart-frame">
                        <h3 className="household-energy-expenditures-chart-title page-chrome-chart-title">{chartTitle}</h3>

                        {selectedPoints !== null && (
                            <ClearSelectionButton lang={lang} onClick={clearSelection} />
                        )}

                        <figure ref={chartRef} style={{ margin: 0 }}>
                            <div role="region" aria-label={`${exportChartTitle}. ${getChartSummary()}`} tabIndex="0">
                                <Plot
                                    key={`household-energy-expenditures-${selectionKey}-${plotHeight}`}
                                    data={[
                                        {
                                            x: CPI_YEARS,
                                            y: CPI_DATA.energy,
                                            type: 'scatter',
                                            mode: 'lines+markers',
                                            name: legendEnergy,
                                            line: { color: lineColorFor(0, COLORS.energy), width: 2.5 },
                                            marker: {
                                                color: COLORS.energy,
                                                size: 7,
                                                opacity: CPI_YEARS.map((_, i) => markerOpacityFor(0, i)),
                                            },
                                            hovertemplate: energyHover,
                                        },
                                        {
                                            x: CPI_YEARS,
                                            y: CPI_DATA.total,
                                            type: 'scatter',
                                            mode: 'lines+markers',
                                            name: legendTotal,
                                            line: { color: lineColorFor(1, COLORS.total), width: 2.5 },
                                            marker: {
                                                color: COLORS.total,
                                                size: 7,
                                                opacity: CPI_YEARS.map((_, i) => markerOpacityFor(1, i)),
                                            },
                                            hovertemplate: totalHover,
                                        },
                                        {
                                            x: CPI_YEARS,
                                            y: CPI_DATA.excluding,
                                            type: 'scatter',
                                            mode: 'lines+markers',
                                            name: legendExcluding,
                                            line: { color: lineColorFor(2, COLORS.excluding), width: 2.5, dash: 'dash' },
                                            marker: {
                                                color: COLORS.excluding,
                                                size: 7,
                                                opacity: CPI_YEARS.map((_, i) => markerOpacityFor(2, i)),
                                            },
                                            hovertemplate: excludingHover,
                                        },
                                    ]}
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
                                            tickvals: CPI_YEARS.filter((y) => y % 2 === 1),
                                            ticktext: CPI_YEARS.filter((y) => y % 2 === 1).map(String),
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
                                            range: [90, 250],
                                            tickmode: 'array',
                                            tickvals: yTickvals,
                                            ticktext: yTickvals.map((v) => formatIndex(v)),
                                            showgrid: true,
                                            gridcolor: '#e0e0e0',
                                            showline: true,
                                            linewidth: 1,
                                            linecolor: '#333',
                                            zeroline: false,
                                            tickfont: tickFont,
                                            automargin: true,
                                        },
                                    }}
                                    config={plotConfig}
                                    className="household-energy-expenditures-chart"
                                    useResizeHandler
                                    onClick={handleChartClick}
                                />
                            </div>
                        </figure>

                        <HtmlLegend
                            className="household-energy-expenditures-legend"
                            variant="line"
                            itemClassName="household-energy-expenditures-legend-item"
                            markerClassName="household-energy-expenditures-legend-line"
                            items={[
                                { label: legendEnergy, color: COLORS.energy },
                                { label: legendTotal, color: COLORS.total },
                                { label: legendExcluding, color: COLORS.excluding, dash: true },
                            ]}
                        />

                        <div className="household-energy-expenditures-table-wrapper">
                            <ChartDataTable
                                lang={lang}
                                columns={tableColumns}
                                rows={tableRows}
                                csvFilename={`${chartDownloadSlug}.csv`}
                                docx={{
                                    filename: `${chartDownloadSlug}.docx`,
                                    title: exportChartTitle,
                                    titleAlign: 'center',
                                    columnWidths: [900, 2400, 2200, 2600],
                                    fontSize: 20,
                                }}
                                caption={getText('household_energy_expenditures_table_caption', lang)}
                                tableAriaLabel={getText('household_energy_expenditures_table_caption', lang)}
                                renderCell={(raw, { colIndex }) => (
                                    colIndex === 0 ? String(raw ?? '') : formatIndex(raw)
                                )}
                            />
                        </div>
                    </div>
                </section>
            </div>
        </PageShell>
    );
};

export default HouseholdEnergyExpenditures;
