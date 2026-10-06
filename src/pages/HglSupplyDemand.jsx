import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import PageFootnotes from '../components/PageFootnotes';
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
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import AccessibleInfographic from '../components/AccessibleInfographic';
import hglBgEn from '../assets/hgl_supply_demand_bg.svg?raw';
import hglBgFr from '../assets/hgl_supply_demand_bg_fr.svg?raw';
import hexToRgba from '../utils/hexToRgba';

import { makeScrollToIdHandler } from '../utils/scrollToId';
import { formatLocalePct } from '../utils/formatLocale';

const REFERENCE_YEAR = 2025;
const PROVINCE_KEYS = ['alberta', 'bc', 'saskatchewan'];

const SPOKEN_PROVINCE = {
    alberta: { en: 'Alberta', fr: 'Alberta' },
    bc: { en: 'British Columbia', fr: 'Colombie-Britannique' },
    saskatchewan: { en: 'Saskatchewan', fr: 'Saskatchewan' },
};
const PROVINCE_COLORS = {
    alberta: '#3e2f2c',
    bc: '#6896ba',
    saskatchewan: '#e88143',
};
const DATA_BY_YEAR = {
    2025: {
        productionTotalMbd: 806.8,
        propaneMbd: 338.1,
        butaneMbd: 228.1,
        ethaneMbd: 240.5,
        exportsMbd: 275.1,
        importsMbd: 108.4,
        plantTotalMbd: 761,
        provinces: {
            alberta: 84,
            bc: 15,
            saskatchewan: 2,
        },
    },
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

    return { pageCssZoom: Math.max(pinScale, layoutZoom, cssZoomFactor), baseline: nextBaseline };
};

const HglSupplyDemand = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [selectedYear] = useState(REFERENCE_YEAR);
    const [selectedKeys, setSelectedKeys] = useState(null);
    const windowWidth = useWindowWidth();
    const [pageCssZoom, setPageCssZoom] = useState(() => computePageZoomScale(null).pageCssZoom);
    const zoomBaselineRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, key: null });
    const chartRef = useRef(null);
    const infographicImgRef = useRef(null);

    const useStackedLayout = pageCssZoom >= STACKED_LAYOUT_DETECTED_ZOOM;
    const zoomLegendMode = windowWidth <= 768 || useStackedLayout;
    const effectiveSelectedKeys = windowWidth > 768 ? selectedKeys : null;

    const yearData = DATA_BY_YEAR[selectedYear] || DATA_BY_YEAR[REFERENCE_YEAR];
    const textVars = { year: selectedYear };
    const chartTitle = substitute(getText('hgl_supply_demand_chart_title', lang), textVars);
    const exportChartTitle = stripHtml(chartTitle);
    const fileSlugBase = substitute(getText('hgl_supply_demand_download_title', lang), textVars).replace(/\s+/g, '_');
    const bgMarkup = lang === 'en' ? hglBgEn : hglBgFr;
    const tableCaption = substitute(getText('hgl_supply_demand_table_caption', lang), textVars);

    const scrollToFootnote = makeScrollToIdHandler('fn-asterisk-hgl-supply-demand');

    const formatPct = (value) => formatLocalePct(value, lang, { maximumFractionDigits: 0 });

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

    const slices = useMemo(() => {
        const provinces = yearData.provinces || {};
        return PROVINCE_KEYS.map((key) => ({
            key,
            pct: provinces[key],
        })).filter((slice) => slice.pct != null);
    }, [yearData]);

    const pieValues = slices.map((slice) => {
        const n = typeof slice.pct === 'number' ? slice.pct : 0;
        return n > 0 ? n : 0.001;
    });
    const baseColors = slices.map((slice) => PROVINCE_COLORS[slice.key] ?? '#999999');
    const selectedIndexes = effectiveSelectedKeys?.length
        ? slices.map((slice, index) => (effectiveSelectedKeys.includes(slice.key) ? index : -1)).filter((i) => i >= 0)
        : null;
    const pieColors = selectedIndexes?.length
        ? baseColors.map((color, index) => (selectedIndexes.includes(index) ? color : hexToRgba(color, 0.3)))
        : baseColors;
    const labels = slices.map((slice) => getText(`hgl_supply_demand_label_${slice.key}`, lang));
    const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 16;
    const outsideTextSize = zoomLegendMode ? 16 : textSize;

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('hgl_supply_demand_table_col_year', lang), align: 'left' },
        { key: 'province', header: getText('hgl_supply_demand_table_col_province', lang), align: 'left' },
        { key: 'share', header: getText('hgl_supply_demand_table_col_share', lang), align: 'num' },
    ], [lang]);

    const tableRows = useMemo(
        () =>
            slices.map((slice) => ({
                year: selectedYear,
                province: getText(`hgl_supply_demand_label_${slice.key}`, lang),
                share: slice.pct,
            })),
        [slices, selectedYear, lang],
    );

    const plotData = useMemo(() => {
        if (!slices.length) return [];
        const pull = selectedIndexes?.length
            ? pieValues.map((_, index) => (selectedIndexes.includes(index) ? 0.08 : 0.02))
            : pieValues.map(() => 0.02);
        return [{
            type: 'pie',
            values: pieValues,
            labels,
            direction: 'clockwise',
            sort: false,
            texttemplate: zoomLegendMode ? '%{percent:.0%}' : '%{label}<br>%{percent:.0%}',
            textinfo: zoomLegendMode ? 'percent' : 'label+percent',
            textposition: zoomLegendMode ? 'inside' : 'outside',
            textfont: { size: textSize, family: 'Arial, sans-serif', color: zoomLegendMode ? '#ffffff' : pieColors },
            outsidetextfont: { size: outsideTextSize, color: pieColors },
            marker: { colors: pieColors, line: { color: '#ffffff', width: 1 } },
            pull,
            hovertext: slices.map((slice) => {
                const label = getText(`hgl_supply_demand_label_${slice.key}`, lang);
                return `<b>${label}</b><br>${formatPct(slice.pct)}`;
            }),
            hoverinfo: 'text',
            hoverlabel: { bgcolor: '#ffffff', font: { color: '#333333', size: 14, family: 'Arial, sans-serif' } },
            automargin: true,
        }];
    }, [slices, labels, pieValues, pieColors, selectedIndexes, textSize, outsideTextSize, zoomLegendMode, lang]);

    const layout = useMemo(() => ({
        showlegend: false,
        margin: {
            t: zoomLegendMode ? 40 : 50,
            b: zoomLegendMode ? 24 : 40,
            l: windowWidth <= 480 ? 0 : zoomLegendMode ? 16 : 100,
            r: windowWidth <= 480 ? 0 : zoomLegendMode ? 16 : 100,
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        height: windowWidth <= 480 ? 360 : 400,
        clickmode: 'event',
        dragmode: false,
    }), [zoomLegendMode, windowWidth]);

        const downloadChartWithTitle = useChartPngDownloader(
            chartRef,
            () => ({
            filename: `${fileSlugBase}.png`,
            title: exportChartTitle,
            height: 640,
            legendItems: slices.map((slice) => ({
                label: getText(`hgl_supply_demand_label_${slice.key}`, lang),
                color: PROVINCE_COLORS[slice.key],
            })),
        }),
            [PROVINCE_COLORS, exportChartTitle, fileSlugBase, getText, lang, slices],
        );

        const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const formatShareSpoken = (value) => {
        const formatted = formatLocalePct(value, lang, {
            maximumFractionDigits: 0,
            suffix: false,
        });
        return `${formatted} ${lang === 'en' ? 'percent' : 'pour cent'}`;
    };
    const spokenProvince = (key) => SPOKEN_PROVINCE[key]?.[lang === 'fr' ? 'fr' : 'en'] || key;

    const getChartSummary = () => {
        const body = summarizeByCategory({
            categories: slices.map((slice) => spokenProvince(slice.key)),
            series: [{ name: lang === 'en' ? 'Share' : 'Part', values: slices.map((s) => s.pct), format: formatShareSpoken }],
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Donut chart of hydrocarbon gas liquids supply by province for ${selectedYear}`
                : `Graphique en anneau de l'offre de liquides de gaz d'hydrocarbures par province pour ${selectedYear}`,
            body,
        });
    };

    const downloadInfographicPng = async () => {
        await downloadInfographicImagePng(
            infographicImgRef.current?.getGraphicElement?.() ?? infographicImgRef.current,
            { filename: `${fileSlugBase}_infographic.png`, scale: 2 },
        );
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

    const handlePieClick = (eventData) => {
        if (!eventData.points?.length) return;
        const point = eventData.points[0];
        const idx = point.pointNumber ?? point.pointIndex;
        const key = slices[idx]?.key;
        if (!key) return;
        if (windowWidth <= 768) {
            const now = Date.now();
            const last = lastPieClickRef.current;
            const doubleTap = key === last.key && now - last.time < 300;
            lastPieClickRef.current = { time: now, key };
            if (!doubleTap) return;
        }
        setSelectedKeys((prev) => {
            if (prev === null) return [key];
            if (prev.includes(key)) return prev.length <= 1 ? null : prev.filter((k) => k !== key);
            return [...prev, key];
        });
    };

    const renderSubtitle = () => {
        const raw = substitute(getText('hgl_supply_demand_subtitle', lang), textVars);
        const parts = raw.split('*');
        return (
            <p className="hgl-supply-demand-subtitle">
                {parts[0]}
                <span
                    id="fn-asterisk-rf-hgl-supply-demand"
                    style={{ verticalAlign: 'super', fontSize: '0.75em', lineHeight: '0', marginLeft: '0.15em' }}
                >
                    <a href="#fn-asterisk-hgl-supply-demand" onClick={scrollToFootnote} className="fn-lnk">
                        <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                        <span aria-hidden="true">*</span>
                    </a>
                </span>
                {parts.slice(1).join('*')}
            </p>
        );
    };

    return (
        <PageShell tabIndex="-1"
            className="page-content hgl-supply-demand page-133 page-chrome page-chrome--bleed"
            aria-labelledby="hgl-supply-demand-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.hgl-supply-demand {
}
.hgl-supply-demand-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.hgl-supply-demand.page-content .hgl-supply-demand-title {
    font-size: 50px;
    color: #423330;
    text-transform: none;
    line-height: 1.25;
}
.page-133 p.hgl-supply-demand-subtitle {
    font-family: 'Lato', sans-serif;
    font-size: 39px;
    font-weight: bold;
    color: #423330;
    margin: 0 0 15px 0;
    text-transform: none;
}
.hgl-supply-demand-split {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
    gap: 28px;
    align-items: start;
}
.hgl-supply-demand-split.is-stacked { grid-template-columns: 1fr; }
.hgl-supply-demand-left,
.hgl-supply-demand-right { min-width: 0; }
.hgl-supply-demand-infographic-figure { margin: 0; width: 100%; }
.hgl-supply-demand-bg-image { width: 100%; height: auto; display: block; }
.hgl-supply-demand-infographic-downloads {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 15px;
}
.hgl-supply-demand-infographic-downloads button:hover { background-color: #404040 !important; }
.hgl-supply-demand-chart-frame {
    padding: 16px;
    margin-bottom: 0;
}
.hgl-supply-demand-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 22px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 12px 0;
    text-transform: none;
    line-height: 1.25;
}
.hgl-supply-demand-donut-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
}
.hgl-supply-demand-donut-figure {
    width: 100%;
    max-width: 720px;
    min-width: 280px;
    min-height: 360px;
    height: 420px;
    margin: 0;
}
.hgl-supply-demand-custom-legend {
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
    color: var(--gc-text);
}
.hgl-supply-demand-custom-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
}
.hgl-supply-demand-custom-legend-swatch {
    width: 14px;
    height: 14px;
    display: inline-block;
    flex-shrink: 0;
    border-radius: 2px;
    border: 1px solid rgba(0, 0, 0, 0.15);
}
.hgl-supply-demand-table-wrapper { display: block; width: 100%; margin-top: 12px; }
@media (max-width: 768px) {
    .hgl-supply-demand.page-content .hgl-supply-demand-title { font-size: 37px; }
    .page-133 p.hgl-supply-demand-subtitle { font-size: 35px; }
    .hgl-supply-demand-donut-figure { height: 360px; min-height: 360px; }
    .hgl-supply-demand-chart-title { font-size: 20px; }
}
            `}</style>

            <div className="hgl-supply-demand-inner">
                <h1 id="hgl-supply-demand-title" className="hgl-supply-demand-title page-chrome-title">
                    {getText('hgl_supply_demand_title', lang)}
                </h1>
                {renderSubtitle()}

                <div className={`hgl-supply-demand-split${useStackedLayout ? ' is-stacked' : ''}`}>
                    <div className="hgl-supply-demand-left">
                        <AccessibleInfographic
                            ref={infographicImgRef}
                            mode="text"
                            as="figure"
                            className="hgl-supply-demand-infographic-figure"
                            title={getText('hgl_supply_demand_title', lang)}
                            svgMarkup={bgMarkup}
                            imgClassName="hgl-supply-demand-bg-image"
                            imgStyle={{ width: '100%', height: 'auto', display: 'block' }}
                            idPrefix={`hgl-supply-demand-${lang}`}
                        />
                        <div className="hgl-supply-demand-infographic-downloads">
                            <button type="button" onClick={downloadInfographicPng} style={downloadBtnStyle}>
                                {getText('hgl_supply_demand_download_infographic_png', lang)}
                            </button>
                        </div>
                    </div>

                    <div className="hgl-supply-demand-right">
                        <div className="hgl-supply-demand-chart-frame page-chrome-chart-frame">
                            <h2 className="hgl-supply-demand-chart-title">{chartTitle}</h2>
                            {effectiveSelectedKeys?.length > 0 && (
                                <ClearSelectionButton lang={lang} onClick={() => setSelectedKeys(null)} />
                            )}
                            <div className="hgl-supply-demand-donut-wrap" ref={chartRef}>
                                <figure
                                    className="hgl-supply-demand-donut-figure"
                                    role="region"
                                    aria-label={`${exportChartTitle}. ${getChartSummary()}`}
                                    tabIndex={0}
                                >
                                    <div aria-hidden="true">
                                    <Plot
                                        key={`hgl-${selectedYear}-${zoomLegendMode ? 'compact' : 'wide'}-${effectiveSelectedKeys ? effectiveSelectedKeys.join('-') : 'none'}`}
                                        data={plotData}
                                        layout={layout}
                                        config={plotConfig}
                                        style={{ width: '100%', minWidth: 280, minHeight: 360, height: '100%' }}
                                        useResizeHandler
                                        onClick={handlePieClick}
                                    />
                                    </div>
                                </figure>
                                {zoomLegendMode && (
                                    <div
                                        className="hgl-supply-demand-custom-legend"
                                        aria-label={lang === 'en' ? 'Chart legend' : 'Légende du graphique'}
                                    >
                                        {slices.map((slice) => (
                                            <span key={slice.key} className="hgl-supply-demand-custom-legend-item">
                                                <span
                                                    className="hgl-supply-demand-custom-legend-swatch"
                                                    style={{ backgroundColor: PROVINCE_COLORS[slice.key] }}
                                                    aria-hidden="true"
                                                />
                                                <span>
                                                    {getText(`hgl_supply_demand_label_${slice.key}`, lang)}
                                                    {' '}
                                                    {formatPct(slice.pct)}
                                                </span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="hgl-supply-demand-table-wrapper">
                                <ChartDataTable
                                    lang={lang}
                                    columns={tableColumns}
                                    rows={tableRows}
                                    csvFilename={`${fileSlugBase}.csv`}
                                    docx={{
                                        filename: `${fileSlugBase}.docx`,
                                        title: exportChartTitle,
                                        titleAlign: 'center',
                                        columnWidths: [1400, 4200, 1800],
                                        fontSize: 22,
                                    }}
                                    caption={tableCaption}
                                    tableAriaLabel={tableCaption}
                                    renderCell={(raw, { colIndex }) => (
                                        colIndex === 2 ? formatPct(raw) : String(raw ?? '')
                                    )}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <PageFootnotes
                    lang={lang}
                    titleId="fn-hgl-supply-demand"
                    items={[
                        { id: 'fn-asterisk-hgl-supply-demand', marker: '*', text: getText('hgl_supply_demand_footnote', lang), returnHref: '#fn-asterisk-rf-hgl-supply-demand' },
                    ]}
                />
            </div>
        </PageShell>
    );
};

export default HglSupplyDemand;
