import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import YearSelect from '../components/YearSelect';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import { getRetailGasolinePricesData } from '../utils/dataLoader';

const TRACE_COUNT = 4;
const COLORS = ['#3E2B26', '#6296B1', '#F48C36', '#2F414B'];
const LOCATION_KEYS = ['canada', 'vancouver', 'calgary', 'toronto', 'montreal', 'halifax'];
/**
 * Ctrl+ page zoom is not exposed on `visualViewport.scale` on desktop; infer zoom from
 * `devicePixelRatio` / common OS scale. Use one continuous ratio band so ~400% cannot fall
 * in the gap between separate 400% / 500% windows (that gap hid 400% while 500% still matched).
 */
const PAGE_ZOOM_VERTICAL_TICK_MIN = 3.55;
const PAGE_ZOOM_VERTICAL_TICK_MAX = 5.45;
const LIKELY_OS_DPR_BASES = [1, 1.25, 1.3333333333333333, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5];

function isZoomRatioInVerticalTickBands(z) {
    return z >= PAGE_ZOOM_VERTICAL_TICK_MIN && z <= PAGE_ZOOM_VERTICAL_TICK_MAX;
}

function isBrowserZoomInVerticalTickRange() {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    return LIKELY_OS_DPR_BASES.some((b) => {
        const z = dpr / b;
        return isZoomRatioInVerticalTickBands(z);
    });
}

function isPinchScaleInVerticalTickBands(s) {
    return typeof s === 'number' && s > 1.02 && isZoomRatioInVerticalTickBands(s);
}

const RetailGasolinePrices = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const [gasolineData, setGasolineData] = useState({ years: [], dataByYear: {} });
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(null);
    const {
        selected: selectedPoints,
        clear,
        onPlotClick,
        opacityFor,
    } = usePlotlySelection({ mode: 'points', traceCount: TRACE_COUNT, windowWidth });
    const [xAxisVerticalForPageZoom, setXAxisVerticalForPageZoom] = useState(false);
    const chartRef = useRef(null);

    const yearsDesc = useMemo(() => gasolineData.years || [], [gasolineData.years]);
    const yearsAsc = useMemo(() => [...yearsDesc].sort((a, b) => a - b), [yearsDesc]);
    const dataByYear = useMemo(() => gasolineData.dataByYear || {}, [gasolineData.dataByYear]);
    const yearSpanLabel = yearsAsc.length
        ? `${yearsAsc[0]}\u2013${yearsAsc[yearsAsc.length - 1]}`
        : '';

    const slugifyExport = (s) =>
        stripHtml(s)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'retail-gasoline-prices';

    const formatCplLocale = (n) => {
        if (n === undefined || n === null || Number.isNaN(Number(n))) return '\u2014';
        return Math.round(Number(n)).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');
    };

    const legendCrude = getText('kal_gas_prices_legend_crude', lang);
    const legendRefining = getText('kal_gas_prices_legend_refining', lang);
    const legendMarketing = getText('kal_gas_prices_legend_marketing', lang);
    const legendTaxes = getText('kal_gas_prices_legend_taxes', lang);
    const legendLabels = [legendCrude, legendRefining, legendMarketing, legendTaxes];

    const locationLabels = LOCATION_KEYS.map((k) => getText(`kal_gas_prices_loc_${k}`, lang));

    const chartTitleText = getText('kal_gas_prices_chart_title', lang).replace('{year}', String(selectedYear));
    const exportChartTitle = stripHtml(chartTitleText);
    const docHeading = stripHtml(getText('kal_gas_prices_doc_heading', lang).replace('{span}', yearSpanLabel));

    const cplSuffix = getText('kal_gas_prices_table_hdr_cpl_suffix', lang);
    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('petroleum_employment_table_col_year', lang), align: 'left' },
        { key: 'locationLabel', header: getText('kal_gas_prices_table_col_location', lang), align: 'left' },
        { key: 'crude', header: `${legendCrude}${cplSuffix}`, align: 'num' },
        { key: 'refining', header: `${legendRefining}${cplSuffix}`, align: 'num' },
        { key: 'marketing', header: `${legendMarketing}${cplSuffix}`, align: 'num' },
        { key: 'taxes', header: `${legendTaxes}${cplSuffix}`, align: 'num' },
        { key: 'total', header: `${getText('kal_gas_prices_table_col_total', lang)}${cplSuffix}`, align: 'num' },
    ], [lang, legendCrude, legendRefining, legendMarketing, legendTaxes, cplSuffix]);

    const tableFileSlug = `${slugifyExport(getText('kal_gas_prices_export_slug_table', lang))}${yearsAsc.length ? `-${yearsAsc[0]}-${yearsAsc[yearsAsc.length - 1]}` : ''}`;
    const pngFileSlug = `${slugifyExport(getText('kal_gas_prices_export_slug_chart', lang))}-${selectedYear ?? 'year'}`;

    const yearBundle = selectedYear != null ? dataByYear[selectedYear] : null;

    const flatTableRows = useMemo(() => {
        const rows = [];
        yearsDesc.forEach((yr) => {
            const b = dataByYear[yr];
            if (!b) return;
            LOCATION_KEYS.forEach((locKey) => {
                const d = b[locKey];
                if (!d) return;
                const total = d.crude + d.refining + d.marketing + d.taxes;
                rows.push({
                    year: yr,
                    locKey,
                    locationLabel: getText(`kal_gas_prices_loc_${locKey}`, lang),
                    ...d,
                    total
                });
            });
        });
        return rows;
    }, [lang, yearsDesc, dataByYear]);

    const crudeY = yearBundle ? LOCATION_KEYS.map((k) => yearBundle[k]?.crude) : [];
    const refiningY = yearBundle ? LOCATION_KEYS.map((k) => yearBundle[k]?.refining) : [];
    const marketingY = yearBundle ? LOCATION_KEYS.map((k) => yearBundle[k]?.marketing) : [];
    const taxesY = yearBundle ? LOCATION_KEYS.map((k) => yearBundle[k]?.taxes) : [];

    const plotBottomMarginHorizontal = windowWidth <= 480 ? 100 : windowWidth <= 768 ? 88 : 76;
    const plotBottomMarginVertical = windowWidth <= 480 ? 148 : windowWidth <= 768 ? 128 : 108;
    const plotBottomMargin = xAxisVerticalForPageZoom ? plotBottomMarginVertical : plotBottomMarginHorizontal;
    const plotTopMargin = windowWidth <= 480 ? 56 : 48;
    const chartHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = {
        size: windowWidth <= 768 ? 18 : 22,
        family: 'Arial, sans-serif',
        color: '#58585a'
    };

        const downloadChartWithTitle = useChartPngDownloader(
            chartRef,
            () => ({
            filename: `${pngFileSlug}.png`,
            title: exportChartTitle,
            height: 640,
            legendItems: legendLabels.map((label, idx) => ({ label, color: COLORS[idx] })),
        }),
            [COLORS, exportChartTitle, legendLabels, pngFileSlug],
        );

    const barOpacityFor = (traceIdx) => {
        if (selectedPoints === null) return 1;
        return locationLabels.map((_, i) => opacityFor(traceIdx, i));
    };

    const chartAria = (() => {
        if (!yearBundle) {
            return getText('kal_gas_prices_chart_aria', lang).replace('{year}', String(selectedYear));
        }
        const totalLabel = getText('kal_gas_prices_table_col_total', lang);
        const totals = LOCATION_KEYS.map((k) => {
            const d = yearBundle[k];
            if (!d) return null;
            return d.crude + d.refining + d.marketing + d.taxes;
        });
        const body = summarizeByCategory({
            categories: locationLabels,
            series: [
                { name: legendCrude, values: crudeY, format: formatCplLocale },
                { name: legendRefining, values: refiningY, format: formatCplLocale },
                { name: legendMarketing, values: marketingY, format: formatCplLocale },
                { name: legendTaxes, values: taxesY, format: formatCplLocale },
                { name: totalLabel, values: totals, format: formatCplLocale },
            ],
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Stacked bar chart of average regular gasoline price by city for ${selectedYear}`
                : `Graphique à barres empilées du prix moyen de l'essence ordinaire par ville pour ${selectedYear}`,
            unitNote: lang === 'en' ? 'Values in cents per litre' : 'Valeurs en cents le litre',
            body,
        });
    })();
    const chartRegionLabel = `${stripHtml(chartTitleText)}. ${chartAria}`;

    const plotData = [
        {
            x: locationLabels,
            y: crudeY,
            type: 'bar',
            name: legendCrude,
            marker: { color: COLORS[0], opacity: barOpacityFor(0) },
            hovertemplate: locationLabels.map(
                (loc, i) => `<b>${legendCrude}</b><br>${loc}: ${formatCplLocale(crudeY[i])} cpl<extra></extra>`
            )
        },
        {
            x: locationLabels,
            y: refiningY,
            type: 'bar',
            name: legendRefining,
            marker: { color: COLORS[1], opacity: barOpacityFor(1) },
            hovertemplate: locationLabels.map(
                (loc, i) => `<b>${legendRefining}</b><br>${loc}: ${formatCplLocale(refiningY[i])} cpl<extra></extra>`
            )
        },
        {
            x: locationLabels,
            y: marketingY,
            type: 'bar',
            name: legendMarketing,
            marker: { color: COLORS[2], opacity: barOpacityFor(2) },
            hovertemplate: locationLabels.map(
                (loc, i) => `<b>${legendMarketing}</b><br>${loc}: ${formatCplLocale(marketingY[i])} cpl<extra></extra>`
            )
        },
        {
            x: locationLabels,
            y: taxesY,
            type: 'bar',
            name: legendTaxes,
            marker: { color: COLORS[3], opacity: barOpacityFor(3) },
            hovertemplate: locationLabels.map(
                (loc, i) => `<b>${legendTaxes}</b><br>${loc}: ${formatCplLocale(taxesY[i])} cpl<extra></extra>`
            )
        }
    ];

    useEffect(() => {
        getRetailGasolinePricesData()
            .then((payload) => {
                setGasolineData(payload);
                if (payload.years?.length) {
                    setSelectedYear(payload.years[0]);
                }
            })
            .catch((err) => console.error('RetailGasolinePrices data load failed:', err))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const syncViewport = () => {
            const s = window.visualViewport?.scale ?? 1;
            const pinchVertical = isPinchScaleInVerticalTickBands(s);
            setXAxisVerticalForPageZoom(pinchVertical || isBrowserZoomInVerticalTickRange());
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

    


    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd), name: lang === 'en',
    });

    return (
        <PageShell tabIndex="-1"
            className="page-content page-138 page-chrome page-chrome--bleed"
            aria-labelledby="retail-gasoline-prices-main-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            {loading && (
                <p style={{ padding: '24px', fontFamily: 'Arial, sans-serif' }}>
                    {lang === 'en' ? 'Loading…' : 'Chargement…'}
                </p>
            )}
            {!loading && yearBundle && (
            <>
            <style>{`
                .page-138.page-content {
                    max-width: none !important;
                    overflow-x: visible !important;
                }
                .page-138 {
                }
                .retail-gasoline-prices-container {
                    width: 100%;
                    padding: 15px 0 40px 0;
                    box-sizing: border-box;
                }
                .page-138.page-content h1.retail-gasoline-prices-title {
                    font-size: 41px !important;
                }
                .retail-gasoline-prices-chart-title {
                    color: var(--gc-text);
                    margin: 16px 0 12px 0;
                }
                .retail-gasoline-prices-chart-block {
                    display: flex;
                    flex-direction: column;
                    align-items: stretch;
                    width: 100%;
                }
                .retail-gasoline-prices-chart {
                    width: 100%;
                    flex-shrink: 0;
                    position: relative;
                    min-height: 0;
                }
                .retail-gasoline-prices-legend {
                    display: flex;
                    justify-content: center;
                    margin-top: 20px;
                    margin-bottom: 20px;
                    font-family: 'Noto Sans', sans-serif;
                    padding: 10px 20px;
                }
                .retail-gasoline-prices-legend-inner {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 15px 28px;
                    justify-content: center;
                }
                .retail-gasoline-prices-legend-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .retail-gasoline-prices-legend-swatch {
                    width: 22px;
                    height: 14px;
                    flex-shrink: 0;
                }
                .retail-gasoline-prices-legend-label {
                    font-size: 18px;
                    color: var(--gc-text);
                }
                .retail-gasoline-prices-table-wrapper {
                    display: block;
                    width: 100%;
                    margin-top: 20px;
                    margin-bottom: 0;
                }
                @media (max-width: 768px) {
                    .page-138.page-content h1.retail-gasoline-prices-title {
                        font-size: 37px !important;
                    }
                    .retail-gasoline-prices-legend-label { font-size: 16px; }
                }
                @media (max-width: 480px) {
                    .retail-gasoline-prices-legend-label { font-size: 14px; }
                }
            `}</style>

            <div className="retail-gasoline-prices-container">
                <h1 id="retail-gasoline-prices-main-title" className="retail-gasoline-prices-title page-chrome-title">
                    {getText('kal_gas_prices_title', lang)}
                </h1>

                <div className="retail-gasoline-prices-chart-frame page-chrome-chart-frame">
                    <YearSelect
                        lang={lang}
                        id="retail-gasoline-prices-year-select"
                        label={getText('year_slider_label', lang)}
                        years={yearsDesc}
                        value={selectedYear}
                        onChange={(y) => {
                            setSelectedYear(y);
                            clear();
                        }}
                    />
                        <div role="status" className="wb-inv" aria-live="polite">
                            {lang === 'en' ? 'Showing data for' : 'Données affichées pour'} {selectedYear}
                        </div>

                    <h2 id="retail-gasoline-prices-chart-title" className="retail-gasoline-prices-chart-title page-chrome-chart-title">
                        {chartTitleText}
                    </h2>

                    <div className="retail-gasoline-prices-chart-block">
                        <div role="region" aria-label={chartRegionLabel} tabIndex="0">
                            {selectedPoints !== null && <ClearSelectionButton lang={lang} onClick={clear} />}
                            <figure ref={chartRef} className="retail-gasoline-prices-chart" style={{ margin: 0 }}>
                                <div aria-hidden="true">
                                    <Plot
                                        data={plotData}
                                        layout={{
                                            barmode: 'stack',
                                            bargap: 0.22,
                                            hoverlabel: {
                                                bgcolor: '#ffffff',
                                                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' }
                                            },
                                            hovermode: 'closest',
                                            clickmode: 'event',
                                            dragmode: false,
                                            xaxis: {
                                                type: 'category',
                                                categoryorder: 'array',
                                                categoryarray: locationLabels,
                                                tickangle: xAxisVerticalForPageZoom ? 90 : 0,
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                tickfont: tickFont,
                                                automargin: true
                                            },
                                            yaxis: {
                                                title: {
                                                    text: getText('kal_gas_prices_yaxis', lang),
                                                    font: axisTitleFont,
                                                    standoff: 8
                                                },
                                                range: [0, 200],
                                                dtick: 20,
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                tickfont: tickFont,
                                                automargin: true
                                            },
                                            showlegend: false,
                                            margin: { l: 58, r: 18, t: plotTopMargin, b: plotBottomMargin },
                                            autosize: true,
                                            paper_bgcolor: 'rgba(0,0,0,0)',
                                            plot_bgcolor: 'rgba(0,0,0,0)'
                                        }}
                                        config={plotConfig}
                                        style={{ width: '100%', height: `${chartHeight}px` }}
                                        useResizeHandler={true}
                                        onClick={onPlotClick}
                                    />
                                </div>
                            </figure>
                        </div>

                        <div className="retail-gasoline-prices-legend" aria-hidden="true">
                            <div className="retail-gasoline-prices-legend-inner">
                                {legendLabels.map((label, idx) => (
                                    <div key={label} className="retail-gasoline-prices-legend-item">
                                        <span
                                            className="retail-gasoline-prices-legend-swatch"
                                            style={{ backgroundColor: COLORS[idx] }}
                                        />
                                        <span className="retail-gasoline-prices-legend-label">{label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="retail-gasoline-prices-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={flatTableRows}
                            csvFilename={`${tableFileSlug}.csv`}
                            docx={{
                                filename: `${tableFileSlug}.docx`,
                                title: docHeading,
                                titleAlign: 'center',
                                columnWidths: [700, 1200, 900, 900, 900, 900, 900],
                                fontSize: 20,
                            }}
                            caption={getText('kal_gas_prices_table_caption', lang)}
                            tableAriaLabel={getText('kal_gas_prices_table_caption', lang)}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 || colIndex === 1
                                    ? String(raw ?? '')
                                    : formatCplLocale(raw)
                            )}
                        />
                    </div>
                </div>
            </div>
            </>
            )}
        </PageShell>
    );
};

export default RetailGasolinePrices;
