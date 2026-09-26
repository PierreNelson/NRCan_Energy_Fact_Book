import React, { useEffect, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import PageStatus from '../components/PageStatus';
import useViewportZoom from '../hooks/useViewportZoom';
import useWindowWidth from '../hooks/useWindowWidth';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getCleantechCompaniesByRegionData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import hexToRgba from '../utils/hexToRgba';

import { makeScrollToIdHandler } from '../utils/scrollToId';
import { formatLocaleNumber, formatLocalePct } from '../utils/formatLocale';

const REGION_KEYS = ['terr', 'atl', 'que', 'ont', 'man', 'sask', 'alta', 'bc'];
const LABEL_KEYS = {
    terr: 'cleantech_companies_geo_label_terr',
    atl: 'cleantech_companies_geo_label_atl',
    que: 'cleantech_companies_geo_label_que',
    ont: 'cleantech_companies_geo_label_ont',
    man: 'cleantech_companies_geo_label_man',
    sask: 'cleantech_companies_geo_label_sask',
    alta: 'cleantech_companies_geo_label_alta',
    bc: 'cleantech_companies_geo_label_bc'
};
const FULL_LABEL_KEYS = {
    terr: 'cleantech_companies_geo_full_terr',
    atl: 'cleantech_companies_geo_full_atl',
    que: 'cleantech_companies_geo_full_que',
    ont: 'cleantech_companies_geo_full_ont',
    man: 'cleantech_companies_geo_full_man',
    sask: 'cleantech_companies_geo_full_sask',
    alta: 'cleantech_companies_geo_full_alta',
    bc: 'cleantech_companies_geo_full_bc'
};
const COLORS = {
    terr: '#6D9BA2',
    atl: '#519CC8',
    que: '#006d3b',
    ont: '#4f5f56',
    man: '#DF790C',
    sask: '#B36109',
    alta: '#779E29',
    bc: '#63ad46'
};

const substitute = (text, vars) => Object.keys(vars || {}).reduce((s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')), text || '');

const CleantechCompaniesByRegion = () => {
    const { lang } = useOutletContext();
    const [result, setResult] = useState(null);
    const [selectedYear, setSelectedYear] = useState(2025);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const windowWidth = useWindowWidth();
    const { zoomLevel } = useViewportZoom();
    const chartRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });

    const formatNumber = (value, digits = 0) => formatLocaleNumber(value, lang, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
    const formatPct = (value) => formatLocalePct(value, lang, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });
    const scrollToElement = (id) => makeScrollToIdHandler(id);

    useEffect(() => {
        getCleantechCompaniesByRegionData()
            .then((data) => {
                setResult(data);
                setSelectedYear(data?.years?.includes(2025) ? 2025 : data?.latestYear ?? 2025);
            })
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    

    const dataRows = result?.data || [];
    const selectedRow = dataRows.find((row) => row.year === selectedYear) || dataRows.find((row) => row.year === 2025) || dataRows[dataRows.length - 1] || null;
    const year = selectedRow?.year ?? 2025;
    const chartTitle = substitute(getText('cleantech_companies_geo_chart_title', lang), { year });
    const exportChartTitle = stripHtml(chartTitle);
    const fileTitle = `${getText('cleantech_companies_geo_download_title', lang)} ${year}`;
    const zoomLegendMode = windowWidth <= 1000 || zoomLevel >= 1.75;
    const effectiveSlices = windowWidth > 768 ? selectedSlices : null;
    const slices = selectedRow?.slices?.length ? REGION_KEYS.map((key) => selectedRow.slices.find((slice) => slice.key === key)).filter(Boolean) : [];
    const pieValues = slices.map((slice) => (slice.count != null && slice.count > 0 ? slice.count : 0.001));
    const baseColors = slices.map((slice) => COLORS[slice.key]);
    const pieColors = effectiveSlices?.length
        ? baseColors.map((color, index) => (effectiveSlices.includes(index) ? color : hexToRgba(color, 0.3)))
        : baseColors;
    const labels = slices.map((slice) => getText(LABEL_KEYS[slice.key], lang));
    const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18;
    const outsideTextSize = zoomLegendMode ? 18 : textSize;
    const hiddenLabelKeys = ['terr', 'atl'];
    const outsideLabelTemplate = slices.map((slice) => (hiddenLabelKeys.includes(slice.key) ? '' : '%{label}<br>%{percent:.1%}'));
    const zoomLabelTemplate = slices.map((slice) => (slice.key === 'terr' ? '' : '%{percent:.1%}'));
    const terrSlice = slices.find((slice) => slice.key === 'terr');
    const atlSlice = slices.find((slice) => slice.key === 'atl');

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
        pull: effectiveSlices?.length ? pieValues.map((_, index) => (effectiveSlices.includes(index) ? 0.08 : 0.02)) : pieValues.map(() => 0.02),
        hovertext: slices.map((slice) => `<b>${getText(FULL_LABEL_KEYS[slice.key], lang)}</b><br>${formatNumber(slice.count)} ${getText('cleantech_companies_geo_center_companies', lang)}<br>${formatPct(slice.pct)}`),
        hoverinfo: 'text',
        hoverlabel: { bgcolor: '#ffffff', font: { color: '#333333', size: 14, family: 'Arial, sans-serif' } },
        automargin: true
    } : null;

    const layout = {
        showlegend: false,
        margin: {
            t: zoomLegendMode ? 80 : 95,
            b: zoomLegendMode ? 120 : 80,
            l: windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 220,
            r: windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 220
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        height: windowWidth <= 480 ? 430 : 520,
        clickmode: 'event',
        dragmode: false,
        annotations: selectedRow?.total != null ? [
            {
                text: `${getText('cleantech_companies_geo_center_total', lang)}<br><b>${formatNumber(selectedRow.total)}</b><br>${getText('cleantech_companies_geo_center_companies', lang)}`,
                showarrow: false,
                x: 0.5,
                y: 0.5,
                xref: 'paper',
                yref: 'paper',
                font: { size: windowWidth <= 480 ? 15 : 20, color: '#424243', family: 'Arial Black, Arial, sans-serif' }
            }
        ] : []
    };

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${fileTitle}.png`,
        title: exportChartTitle,
        height: 800,
        legendItems: slices.map((slice) => ({
            label: getText(LABEL_KEYS[slice.key], lang),
            color: COLORS[slice.key],
        })),
    }),
        [COLORS, LABEL_KEYS, exportChartTitle, fileTitle, getText, lang, slices],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const tableColumns = [
        { key: 'year', header: lang === 'en' ? 'Year' : 'Année', align: 'left' },
        { key: 'region', header: lang === 'en' ? 'Region' : 'Région', align: 'left' },
        { key: 'count', header: lang === 'en' ? 'Companies' : 'Entreprises', align: 'num' },
        { key: 'pct', header: lang === 'en' ? 'Share (%)' : 'Part (%)', align: 'num' }
    ];
    const tableRows = selectedRow ? slices.map((slice) => ({
        year,
        region: getText(FULL_LABEL_KEYS[slice.key], lang),
        count: slice.count,
        pct: slice.pct
    })) : [];
    const tableCaption = getText('cleantech_companies_geo_table_caption', lang);

    if (loading || error) return <PageStatus lang={lang} loading={loading} error={error} />;
    if (!selectedRow) return <p>{getText('cleantech_companies_geo_no_data', lang)}</p>;

    return (
        <main id="main-content" tabIndex="-1" className="page-content page-62" role="main" aria-labelledby="cleantech-companies-title" style={{ backgroundColor: '#ffffff' }}>
            <style>{`
.page-62 { width: 100%; }
.cleantech-companies-container { width: 100%; padding: 15px 0 0 0; display: flex; flex-direction: column; box-sizing: border-box; flex: 1; overflow: visible; }
.cleantech-companies-title { font-family: 'Lato', sans-serif; font-size: 41px; font-weight: bold; color: var(--gc-text); margin-top: 0; margin-bottom: 25px; line-height: 1.25; position: relative; padding-bottom: 0.5em; text-transform: uppercase; }
.cleantech-companies-title::after { content: ''; position: absolute; left: 0; bottom: 0.2em; width: 72px; height: 6px; background-color: var(--gc-red); }
.cleantech-companies-subtitle { font-family: 'Noto Sans', sans-serif; font-size: 20px; color: #332f30; margin: 0 0 20px 0; line-height: 1.45; }
.cleantech-companies-chart-frame { background-color: #f5f5f5; padding: 20px; padding-bottom: 20px; border-radius: 8px; margin-top: 0; margin-bottom: 20px; box-sizing: border-box; overflow: visible; }
.cleantech-companies-chart-title { font-family: 'Lato', sans-serif; font-size: 29px; font-weight: bold; color: var(--gc-text); text-align: center; margin: 0 0 5px 0; text-transform: none; }
.cleantech-companies-chart-scroll { width: 100%; overflow: hidden; display: flex; justify-content: center; }
.cleantech-companies-chart { width: 100%; min-width: 0; height: 520px; position: relative; z-index: 1; overflow: visible; flex-shrink: 0; }
.cleantech-companies-chart > div { width: 100%; height: 100%; overflow: visible; }
.cleantech-companies-chart .js-plotly-plot,
.cleantech-companies-chart .plot-container,
.cleantech-companies-chart .svg-container { overflow: visible !important; }
.cleantech-companies-html-pie-label { position: absolute; z-index: 40; font-family: Arial, sans-serif; font-size: ${textSize}px; line-height: 1.15; font-weight: 400; text-align: center; pointer-events: auto; }
.cleantech-companies-terr-label { left: calc(50% + 8px); top: 36px; color: ${COLORS.terr}; }
.cleantech-companies-terr-label::before { content: ''; position: absolute; left: -8px; top: 12px; width: 2px; height: 46px; background: #000; }
.cleantech-companies-terr-label::after { content: ''; position: absolute; left: -8px; top: 12px; width: 12px; height: 2px; background: #000; }
.cleantech-companies-atl-label { left: calc(50% + 80px); top: 72px; color: ${COLORS.atl}; }
.cleantech-companies-custom-legend { position: relative; z-index: 60; display: flex; justify-content: center; align-items: center; gap: 12px 18px; flex-wrap: wrap; margin-top: 8px; margin-bottom: 8px; padding: 0 12px; font-family: Arial, sans-serif; font-size: 11px; color: var(--gc-text); pointer-events: auto; }
.cleantech-companies-custom-legend-item { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.cleantech-companies-custom-legend-swatch { width: 12px; height: 12px; display: inline-block; border-radius: 2px; border: 1px solid rgba(0, 0, 0, 0.15); }
.cleantech-companies-custom-legend .fn-lnk { position: relative; z-index: 70; pointer-events: auto; }
.cleantech-companies-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.cleantech-companies-footnotes { font-family: var(--font-body); font-size: 1rem; color: var(--gc-text); margin-top: 24px; margin-bottom: 0; padding-top: 12px; border-top: 1px solid #e0e0e0; line-height: 1.65; max-width: 100%; box-sizing: border-box; }
.cleantech-companies-footnotes h2 { font-family: var(--font-heading); font-size: 1.4rem; font-weight: 700; color: var(--gc-text); margin-top: 0; margin-bottom: 1rem; }
.cleantech-companies-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
@media (max-width: 768px) {
    .cleantech-companies-title { font-size: 37px; }
    .cleantech-companies-subtitle { font-size: 18px; }
    .cleantech-companies-chart-title { font-size: 26px; }
    .cleantech-companies-footnotes { font-size: 0.9rem; }
    .cleantech-companies-footnotes h2 { font-size: 1.2rem; margin-bottom: 0.75rem; }
    .cleantech-companies-terr-label { left: calc(50% + 6px); top: 40px; }
    .cleantech-companies-terr-label::before { height: 42px; }
    .cleantech-companies-atl-label { left: calc(50% + 58px); top: 74px; }
}
@media (max-width: 480px) {
    .cleantech-companies-chart { height: 430px; }
    .cleantech-companies-custom-legend { font-size: 10px; gap: 8px 12px; }
    .cleantech-companies-terr-label { left: calc(50% + 4px); top: 44px; }
    .cleantech-companies-terr-label::before { height: 36px; }
    .cleantech-companies-atl-label { left: calc(50% + 42px); top: 76px; }
}
            `}</style>
            <div className="cleantech-companies-container">
                <h1 id="cleantech-companies-title" className="cleantech-companies-title">{getText('cleantech_companies_geo_title', lang)}</h1>
                <p className="cleantech-companies-subtitle">
                    {getText('cleantech_companies_geo_subtitle_prefix', lang)}
                    <strong>{formatNumber(selectedRow.total)}</strong>
                    {getText('cleantech_companies_geo_subtitle_mid', lang)}
                </p>
                <div className="cleantech-companies-chart-frame">
                    <h2 id="cleantech-companies-chart-title" className="cleantech-companies-chart-title">{chartTitle}</h2>
                    {effectiveSlices?.length > 0 && (
                        <ClearSelectionButton lang={lang} onClick={() => setSelectedSlices(null)} />
                    )}
                    <div className="cleantech-companies-chart-scroll">
                        <figure ref={chartRef} className="cleantech-companies-chart" role="region" aria-label={chartTitle} tabIndex="0" style={{ margin: 0 }}>
                            <div aria-hidden="true">
                                {pieTrace && (
                                    <Plot
                                        key={`cleantech-companies-${year}-${effectiveSlices ? effectiveSlices.join('-') : 'none'}`}
                                        data={[pieTrace]}
                                        layout={layout}
                                        config={plotConfig}
                                        style={{ width: '100%', height: '100%' }}
                                        useResizeHandler
                                        onClick={(data) => {
                                            const point = data.points?.[0];
                                            const index = point && (point.pointNumber !== undefined ? point.pointNumber : point.pointIndex);
                                            if (index == null) return;
                                            if (windowWidth <= 768) {
                                                const now = Date.now();
                                                const last = lastPieClickRef.current;
                                                const isDoubleTap = index === last.index && now - last.time < 300;
                                                lastPieClickRef.current = { time: now, index };
                                                if (!isDoubleTap) return;
                                            }
                                            setSelectedSlices((previous) => {
                                                if (previous === null) return [index];
                                                if (previous.includes(index)) return previous.length <= 1 ? null : previous.filter((item) => item !== index);
                                                return [...previous, index];
                                            });
                                        }}
                                    />
                                )}
                            </div>
                            {terrSlice && (
                                <span className="cleantech-companies-html-pie-label cleantech-companies-terr-label" aria-hidden="true">
                                    {getText('cleantech_companies_geo_label_terr', lang)}<br />
                                    {formatPct(terrSlice.pct)}
                                </span>
                            )}
                            {!zoomLegendMode && atlSlice && (
                                <span id="fn-atl-rf-cleantech-companies" className="cleantech-companies-html-pie-label cleantech-companies-atl-label">
                                    {getText('cleantech_companies_geo_label_atl', lang)}
                                    <a className="fn-lnk" href="#fn-atl-cleantech-companies" onClick={scrollToElement('fn-atl-cleantech-companies')}>
                                        <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>*
                                    </a>
                                    <br />
                                    {formatPct(atlSlice.pct)}
                                </span>
                            )}
                        </figure>
                    </div>
                    {zoomLegendMode && (
                        <div className="cleantech-companies-custom-legend" aria-label={lang === 'en' ? 'Chart legend' : 'Légende du graphique'}>
                            {slices.map((slice) => (
                                <span key={slice.key} className="cleantech-companies-custom-legend-item" id={slice.key === 'atl' ? 'fn-atl-rf-cleantech-companies' : undefined}>
                                    <span className="cleantech-companies-custom-legend-swatch" style={{ backgroundColor: COLORS[slice.key] }} aria-hidden="true" />
                                    <span>{getText(LABEL_KEYS[slice.key], lang)}</span>
                                    {slice.key === 'atl' && (
                                        <a className="fn-lnk" href="#fn-atl-cleantech-companies" onClick={scrollToElement('fn-atl-cleantech-companies')}>
                                            <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>*
                                        </a>
                                    )}
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="cleantech-companies-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={`${fileTitle}.csv`}
                            docx={{
                                filename: `${fileTitle}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [1200, 4200, 1800, 1800],
                                fontSize: 18,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                            renderCell={(raw, { colIndex }) => {
                                if (colIndex === 2) return formatNumber(raw);
                                if (colIndex === 3) return formatPct(raw);
                                return String(raw ?? '');
                            }}
                        />
                    </div>
                </div>
                <aside className="wb-fnote cleantech-companies-footnotes" role="note">
                    <h2 id="fn-cleantech-companies">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</dt>
                        <dd id="fn-atl-cleantech-companies">
                            <a href="#fn-atl-rf-cleantech-companies" onClick={scrollToElement('fn-atl-rf-cleantech-companies')} className="fn-num" title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}>
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                            </a>
                            {' '}{getText('cleantech_companies_geo_footnote_atl', lang)}
                        </dd>
                        <dd>{getText('cleantech_companies_geo_footnote_rounding', lang)}</dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default CleantechCompaniesByRegion;
