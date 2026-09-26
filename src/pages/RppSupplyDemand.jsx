import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import PageFootnotes from '../components/PageFootnotes';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useViewportZoom from '../hooks/useViewportZoom';
import useWindowWidth from '../hooks/useWindowWidth';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { saveAs } from 'file-saver';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getRppSupplyDemandData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import RppSupplyDemandInfographic, { OVERLAY_SLOTS, SUPPLY_KEYS, TEXT_COLORS } from '../components/RppSupplyDemandInfographic';
import rppSupplyDemandBgEn from '../assets/rpp_supply_demand_bg.png';
import rppSupplyDemandBgFr from '../assets/rpp_supply_demand_bg_fr.png';
import hexToRgba from '../utils/hexToRgba';

import { makeScrollToIdHandler } from '../utils/scrollToId';
import { formatLocaleNumber, formatLocalePct } from '../utils/formatLocale';

const substitute = (text, vars) => Object.keys(vars || {}).reduce(
    (value, key) => value.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '–')),
    text || '',
);

const PRODUCT_ORDER = [
    'motor_gasoline',
    'distillate',
    'still_gas',
    'jet',
    'coke',
    'asphalt',
    'residual',
    'other',
];

const PRODUCT_LABEL_KEYS = {
    motor_gasoline: 'rpp_refinery_input_product_motor_gasoline',
    distillate: 'rpp_refinery_input_product_distillate',
    still_gas: 'rpp_refinery_input_product_still_gas',
    jet: 'rpp_refinery_input_product_jet',
    coke: 'rpp_refinery_input_product_coke',
    residual: 'rpp_refinery_input_product_residual',
    asphalt: 'rpp_refinery_input_product_asphalt',
    other: 'rpp_refinery_input_product_other',
};

const PRODUCT_COLORS = {
    motor_gasoline: '#56433A',
    distillate: '#479CCD',
    still_gas: '#E77218',
    jet: '#1E4A6F',
    coke: '#7A7A7A',
    asphalt: '#A5916F',
    residual: '#2A9D8F',
    other: '#776240',
};

const SUPPLY_TABLE_KEYS = [
    'net_production',
    'exports',
    'imports',
    'domestic_consumption',
    'refinery_input',
];

const SUPPLY_LABEL_KEYS = {
    net_production: 'rpp_refinery_input_supply_net_production',
    exports: 'rpp_refinery_input_supply_exports',
    imports: 'rpp_refinery_input_supply_imports',
    domestic_consumption: 'rpp_refinery_input_supply_domestic',
    refinery_input: 'rpp_refinery_input_supply_refinery',
};

const RppSupplyDemand = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
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
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
    });
    const scrollToElement = (id) => makeScrollToIdHandler(id);

    useEffect(() => {
        getRppSupplyDemandData()
            .then(setResult)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    

    const selectedRow = result?.referenceYear != null
        ? result.data?.find((row) => row.year === result.referenceYear)
            || result.data?.find((row) => row.year === result.latestYear)
            || result.data?.[result.data.length - 1]
            || null
        : result?.data?.[result.data.length - 1] || null;
    const year = selectedRow?.year ?? result?.referenceYear ?? result?.latestYear ?? null;
    const yearLabel = year ?? '–';
    const textVars = { year: yearLabel };

    const productSlices = useMemo(() => (
        selectedRow
            ? PRODUCT_ORDER.map((key) => {
                const match = selectedRow.products.find((p) => p.key === key);
                return { key, pct: match?.pct ?? null };
            }).filter((slice) => slice.pct != null)
            : []
    ), [selectedRow]);

    const pageTitle = substitute(getText('rpp_refinery_input_title', lang), textVars);
    const chartTitleBase = substitute(getText('rpp_refinery_input_chart_title', lang), textVars);
    const exportChartTitle = stripHtml(chartTitleBase);
    const supplyDownloadTitle = substitute(getText('rpp_refinery_input_download_supply_title', lang), textVars);
    const productDownloadTitle = substitute(getText('rpp_refinery_input_download_products_title', lang), textVars);
    const supplySlug = stripHtml(supplyDownloadTitle).replace(/\s+/g, '_');
    const productSlug = stripHtml(productDownloadTitle).replace(/\s+/g, '_');
    const infographicPngSlug = substitute(getText('rpp_refinery_input_infographic_png_slug', lang), textVars)
        .replace(/\s+/g, '_');
    const supplyCaption = substitute(getText('rpp_refinery_input_supply_table_caption', lang), textVars);
    const productCaption = substitute(getText('rpp_refinery_input_table_caption', lang), textVars);
    const yearHeader = lang === 'en' ? 'Year' : 'Année';
    const descriptionHeader = lang === 'en' ? 'Description' : 'Description';
    const shareHeader = lang === 'en' ? 'Share (%)' : 'Part (%)';
    const unitMmbd = getText('rpp_refinery_input_unit_mmbd', lang);
    const unitBl = getText('rpp_refinery_input_unit_bl', lang);

    const zoomLegendMode = windowWidth <= 1000 || zoomLevel >= 1.75;
    const effectiveSlices = windowWidth > 768 ? selectedSlices : null;
    const pieValues = productSlices.map((slice) => (slice.pct > 0 ? slice.pct : 0.001));
    const baseColors = productSlices.map((slice) => PRODUCT_COLORS[slice.key]);
    const pieColors = effectiveSlices?.length
        ? baseColors.map((color, index) => (effectiveSlices.includes(index) ? color : hexToRgba(color, 0.3)))
        : baseColors;
    const labels = productSlices.map((slice) => getText(PRODUCT_LABEL_KEYS[slice.key], lang));
    const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18;
    const outsideTextSize = zoomLegendMode ? 18 : textSize;
    const outsideLabelTemplate = productSlices.map(() => '%{label}<br>%{percent:.1%}');
    const zoomLabelTemplate = productSlices.map(() => '%{percent:.1%}');

    const supplyTableColumns = useMemo(() => [
        { key: 'year', header: yearHeader, align: 'left' },
        { key: 'description', header: descriptionHeader, align: 'left' },
        { key: 'mmbd', header: unitMmbd, align: 'num' },
        { key: 'billionL', header: unitBl, align: 'num' },
    ], [yearHeader, descriptionHeader, unitMmbd, unitBl]);

    const supplyTableRows = useMemo(() => (
        selectedRow
            ? SUPPLY_TABLE_KEYS.map((key) => ({
                year: yearLabel,
                description: getText(SUPPLY_LABEL_KEYS[key], lang),
                mmbd: selectedRow.supply[key]?.mmbd,
                billionL: selectedRow.supply[key]?.billion_l,
            }))
            : []
    ), [selectedRow, yearLabel, lang]);

    const productTableColumns = useMemo(() => [
        { key: 'year', header: yearHeader, align: 'left' },
        { key: 'description', header: descriptionHeader, align: 'left' },
        { key: 'pct', header: shareHeader, align: 'num' },
    ], [yearHeader, descriptionHeader, shareHeader]);

    const productTableRows = useMemo(() => (
        productSlices.map((slice) => ({
            year: yearLabel,
            description: getText(PRODUCT_LABEL_KEYS[slice.key], lang),
            pct: slice.pct,
        }))
    ), [productSlices, yearLabel, lang]);

    const pieTrace = productSlices.length ? {
        type: 'pie',
        values: pieValues,
        labels,
        hole: 0.55,
        direction: 'clockwise',
        rotation: 90,
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
        hovertext: productSlices.map((slice) => `<b>${getText(PRODUCT_LABEL_KEYS[slice.key], lang)}</b><br>${formatPct(slice.pct)}`),
        hoverinfo: 'text',
        hoverlabel: { bgcolor: '#ffffff', font: { color: '#333333', size: 14, family: 'Arial, sans-serif' } },
        automargin: true,
    } : null;

    const layout = {
        showlegend: false,
        margin: {
            t: zoomLegendMode ? 80 : 95,
            b: zoomLegendMode ? 120 : 80,
            l: windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 220,
            r: windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 220,
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        height: windowWidth <= 480 ? 430 : 520,
        clickmode: 'event',
        dragmode: false,
    };

        const downloadChartWithTitle = useChartPngDownloader(
            chartRef,
            () => ({
            filename: `${productSlug}.png`,
            title: exportChartTitle,
            height: 800,
            legendItems: productSlices.map((slice) => ({
                label: getText(PRODUCT_LABEL_KEYS[slice.key], lang),
                color: PRODUCT_COLORS[slice.key],
            })),
        }),
            [PRODUCT_COLORS, PRODUCT_LABEL_KEYS, exportChartTitle, getText, lang, productSlices, productSlug],
        );

        const config = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
        name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
    });

    const getChartSummary = () => {
        if (!productSlices.length) return '';
        const body = summarizeByCategory({
            categories: labels,
            series: [{ name: shareHeader, values: productSlices.map((s) => s.pct), format: formatPct }],
            lang,
        });
        return joinChartSummary({
            intro: exportChartTitle,
            body,
            lang,
        });
    };

    const downloadInfographicPng = async () => {
        if (!selectedRow?.supply) return;
        const bgImage = lang === 'fr' ? rppSupplyDemandBgFr : rppSupplyDemandBgEn;
        const overlayLang = lang === 'fr' ? 'fr' : 'en';
        const slots = OVERLAY_SLOTS[overlayLang];

        const img = new Image();
        img.src = bgImage;
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

        const rateFont = `bold ${Math.round(canvas.width * 0.0255)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
        const volumeFont = `600 ${Math.round(canvas.width * 0.0195)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;

        SUPPLY_KEYS.forEach((key) => {
            const data = selectedRow.supply[key];
            const slot = slots[key];
            if (!data || !slot) return;

            const drawText = (text, position, color, font, align = 'right') => {
                if (text == null || text === '–') return;
                ctx.fillStyle = color;
                ctx.font = font;
                ctx.textBaseline = 'middle';
                const x = (position.left / 100) * canvas.width;
                const y = (position.top / 100) * canvas.height;
                ctx.textAlign = align;
                ctx.fillText(String(text), x, y);
            };

            drawText(formatNumber(data.mmbd, 1), slot.rate, TEXT_COLORS[key], rateFont, 'right');
            drawText(formatNumber(data.billion_l, 0), slot.volume, TEXT_COLORS[key], volumeFont, 'left');
        });

        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${infographicPngSlug}.png`);
        });
    };

    const downloadBtnStyle = {
        padding: '8px 16px',
        backgroundColor: '#8C8C8C',
        border: '1px solid #404040',
        borderRadius: '4px',
        cursor: 'pointer',
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        color: '#ffffff',
    };

    const infographicAria = selectedRow
        ? Object.keys(SUPPLY_LABEL_KEYS).map((key) => {
            const supply = selectedRow.supply[key];
            return `${getText(SUPPLY_LABEL_KEYS[key], lang)}: ${formatNumber(supply?.mmbd, 1)} ${unitMmbd}, ${formatNumber(supply?.billion_l, 0)} ${unitBl}`;
        }).join('; ')
        : '';

    if (loading || error) return <PageStatus lang={lang} loading={loading} error={error} />;
    if (!selectedRow) return <p>{getText('rpp_refinery_input_no_data', lang)}</p>;

    return (
        <PageShell tabIndex="-1"
            className="page-content page-136 rpp-supply-demand-rpp-supply page-chrome page-chrome--bleed"
            aria-labelledby="rpp-supply-demand-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.page-136.rpp-supply-demand-rpp-supply {
}
.rpp-supply-demand-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.rpp-supply-demand-title {
    margin: 0 0 24px 0;
    line-height: 1.25;
    text-transform: none;
}
.rpp-supply-demand-infographic-figure {
    width: 100%;
    max-width: none;
    margin: 0 0 16px 0;
}
.rpp-supply-demand-infographic-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin: 0 0 28px 0;
}
.rpp-supply-demand-infographic-actions button:hover { background-color: #404040 !important; }
.rpp-supply-demand-supply-table-wrapper { margin-bottom: 28px; }
.rpp-supply-demand-chart-frame {
    margin-top: 0;
}
.rpp-supply-demand-chart-title {
    color: var(--gc-text);
    margin: 0 0 8px 0;
    text-transform: none;
}
.rpp-supply-demand-chart-scroll { width: 100%; overflow: hidden; display: flex; justify-content: center; }
.rpp-supply-demand-custom-legend {
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
.rpp-supply-demand-custom-legend-item { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.rpp-supply-demand-custom-legend-swatch {
    width: 12px;
    height: 12px;
    display: inline-block;
    border-radius: 2px;
    border: 1px solid rgba(0, 0, 0, 0.15);
}
.rpp-supply-demand-chart {
    width: 100%;
    min-width: 0;
    height: 520px;
    position: relative;
    z-index: 1;
    overflow: visible;
}
.rpp-supply-demand-chart > div { width: 100%; height: 100%; overflow: visible; }
.rpp-supply-demand-chart .js-plotly-plot,
.rpp-supply-demand-chart .plot-container,
.rpp-supply-demand-chart .svg-container { overflow: visible !important; }
.rpp-supply-demand-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.rpp-supply-demand-footnotes {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--gc-text);
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
    line-height: 1.65;
}
.rpp-supply-demand-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0 0 1rem 0;
}
.rpp-supply-demand-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
@media (max-width: 768px) {
    .rpp-supply-demand-chart { height: 430px; }
    .rpp-supply-demand-custom-legend { font-size: 10px; gap: 8px 12px; }
}
            `}</style>

            <div className="rpp-supply-demand-inner">
                <h1 id="rpp-supply-demand-title" className="rpp-supply-demand-title page-chrome-title">{pageTitle}</h1>

                <RppSupplyDemandInfographic
                    lang={lang}
                    supply={selectedRow.supply}
                    formatNumber={formatNumber}
                    getText={getText}
                    ariaLabel={infographicAria}
                />

                <div className="rpp-supply-demand-infographic-actions">
                    <button type="button" onClick={downloadInfographicPng} style={downloadBtnStyle}>
                        {getText('rpp_refinery_input_download_infographic_png', lang)}
                    </button>
                </div>

                <div className="rpp-supply-demand-table-wrapper rpp-supply-demand-supply-table-wrapper">
                    <ChartDataTable
                        lang={lang}
                        label={getText('rpp_refinery_input_supply_table_summary', lang)}
                        columns={supplyTableColumns}
                        rows={supplyTableRows}
                        csvFilename={`${supplySlug}.csv`}
                        docx={{
                            filename: `${supplySlug}.docx`,
                            title: stripHtml(supplyDownloadTitle),
                            titleAlign: 'center',
                            columnWidths: [900, 4800, 1400, 1600],
                            fontSize: 18,
                        }}
                        caption={supplyCaption}
                        tableAriaLabel={supplyCaption}
                        renderCell={(raw, { colIndex }) => {
                            if (colIndex === 2) return raw != null ? formatNumber(raw, 1) : '—';
                            if (colIndex === 3) return raw != null ? formatNumber(raw, 0) : '—';
                            return String(raw ?? '');
                        }}
                    />
                </div>

                <div className="rpp-supply-demand-chart-frame page-chrome-chart-frame">
                    <h2 id="rpp-supply-demand-chart-title" className="rpp-supply-demand-chart-title page-chrome-chart-title">
                        <span id="fn-products-rf-rpp-supply-demand">{chartTitleBase}</span>
                        <a className="fn-lnk" href="#fn-products-rpp-supply-demand" onClick={scrollToElement('fn-products-rpp-supply-demand')}>
                            <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>*
                        </a>
                    </h2>
                    {effectiveSlices?.length > 0 && <ClearSelectionButton lang={lang} onClick={() => setSelectedSlices(null)} />}
                    <div className="rpp-supply-demand-chart-scroll">
                        <figure ref={chartRef} className="rpp-supply-demand-chart" role="region" aria-label={`${exportChartTitle}. ${getChartSummary()}`} tabIndex="0" style={{ margin: 0 }}>
                            <div aria-hidden="true">
                                {pieTrace && (
                                    <Plot
                                        key={`rpp-supply-demand-${year}-${effectiveSlices ? effectiveSlices.join('-') : 'none'}`}
                                        data={[pieTrace]}
                                        layout={layout}
                                        config={config}
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
                                                if (previous.includes(index)) {
                                                    return previous.length <= 1 ? null : previous.filter((item) => item !== index);
                                                }
                                                return [...previous, index];
                                            });
                                        }}
                                    />
                                )}
                            </div>
                        </figure>
                    </div>
                    {zoomLegendMode && (
                        <div className="rpp-supply-demand-custom-legend" aria-label={lang === 'en' ? 'Chart legend' : 'Légende du graphique'}>
                            {productSlices.map((slice) => (
                                <span key={slice.key} className="rpp-supply-demand-custom-legend-item">
                                    <span className="rpp-supply-demand-custom-legend-swatch" style={{ backgroundColor: PRODUCT_COLORS[slice.key] }} aria-hidden="true" />
                                    <span>{getText(PRODUCT_LABEL_KEYS[slice.key], lang)}</span>
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="rpp-supply-demand-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={productTableColumns}
                            rows={productTableRows}
                            csvFilename={`${productSlug}.csv`}
                            docx={{
                                filename: `${productSlug}.docx`,
                                title: stripHtml(productDownloadTitle),
                                titleAlign: 'center',
                                columnWidths: [900, 5600, 1300],
                                fontSize: 18,
                            }}
                            caption={productCaption}
                            tableAriaLabel={productCaption}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 2 ? formatPct(raw) : String(raw ?? '')
                            )}
                        />
                    </div>
                </div>

                <PageFootnotes
                    lang={lang}
                    titleId="fn-rpp-supply-demand"
                    className="rpp-supply-demand-footnotes"
                    items={[
                        { id: 'fn-products-rpp-supply-demand', marker: '*', text: getText('rpp_refinery_input_footnote_products', lang), returnHref: '#fn-products-rf-rpp-supply-demand' },
                    ]}
                />
            </div>
        </PageShell>
    );
};

export default RppSupplyDemand;
