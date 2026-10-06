import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useViewportZoom from '../hooks/useViewportZoom';
import useWindowWidth from '../hooks/useWindowWidth';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { saveAs } from 'file-saver';
import { getCanadianElectricityGenerationData } from '../utils/dataLoader';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { joinChartSummary, summarizeByCategory } from '../utils/chartSpokenSummary';
import hexToRgba from '../utils/hexToRgba';
import CanadianElectricityGenerationInfographic from '../components/CanadianElectricityGenerationInfographic';
import { formatLocalePct } from '../utils/formatLocale';
import {
    formatSharePct,
    exportCanadianGenerationInfographicPng,
    getCanadianGenerationProvinceRows,
} from '../components/CanadianElectricityGenerationInfographic.constants';
import { resolveAccessibleInfographicRoot } from '../utils/downloadInfographicPng';

const PIE_KEYS = ['petroleum', 'hydro', 'nuclear', 'other_renewables', 'natural_gas', 'coal'];
const PIE_LABEL_KEYS = {
    petroleum: 'electricity_generation_canada_label_petroleum',
    hydro: 'electricity_generation_canada_label_hydro',
    nuclear: 'electricity_generation_canada_label_nuclear',
    other_renewables: 'electricity_generation_canada_label_other_renewables',
    natural_gas: 'electricity_generation_canada_label_natural_gas',
    coal: 'electricity_generation_canada_label_coal',
};
const PIE_COLORS = ['#8B2942', '#006d3b', '#4a8c5c', '#63ad46', '#DF790C', '#B36109'];
const INFOGRAPHIC_SOURCE_KEYS = ['hydro', 'nuclear', 'wind'];
const INFOGRAPHIC_LABEL_KEYS = {
    hydro: 'electricity_generation_canada_infographic_hydro',
    nuclear: 'electricity_generation_canada_infographic_nuclear',
    wind: 'electricity_generation_canada_infographic_wind',
};

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const CanadianElectricityGeneration = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [pageData, setPageData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const windowWidth = useWindowWidth();
    const { zoomLevel } = useViewportZoom();
    const chartRef = useRef(null);
    const figureRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });

    useEffect(() => {
        getCanadianElectricityGenerationData()
            .then(setPageData)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    const selectedYear = pageData?.latestYear ?? null;
    const national = pageData?.national;
    const infographic = pageData?.infographic;
    const vars = { year: selectedYear ?? '', total: national?.totalTwh != null ? Math.round(national.totalTwh) : '' };
    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const zoomLegendMode = windowWidth <= 1000 || zoomLevel >= 1.75;
    const selectEnabled = windowWidth > 768;
    const effectiveSelectedSlices = selectEnabled ? selectedSlices : null;

    const formatPct = useCallback((value) => {
        if (value == null || value === 'lt0.1' || value === 'lt0.2') return formatSharePct(value, lang);
        return formatLocalePct(value, lang, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
        });
    }, [lang]);

    const formatShareSpoken = (value) => {
        const formatted = formatLocalePct(value, lang, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
            suffix: false,
        });
        return `${formatted} ${lang === 'en' ? 'percent' : 'pour cent'}`;
    };
    const totalTwh = national?.totalTwh != null
        ? Math.round(national.totalTwh).toLocaleString(locale)
        : '';
    const chartTitle = substitute(getText('electricity_generation_canada_chart_title', lang), vars);
    const exportChartTitle = stripHtml(chartTitle);
    const generationTotal = substitute(getText('electricity_generation_canada_generation_total', lang), vars);
    const sectionTitle = getText('electricity_generation_canada_section_title', lang);
    const ariaLabel = substitute(getText('electricity_generation_canada_infographic_aria', lang), vars);
    const fileSlugBase = substitute(getText('electricity_generation_canada_download_title', lang), vars).replace(/\s+/g, '_');
    const tableCaption = substitute(getText('electricity_generation_canada_table_caption', lang), vars);

    const slices = useMemo(() => {
        if (!national?.slices?.length) return [];
        return PIE_KEYS.map((key) => national.slices.find((s) => s.key === key)).filter(Boolean);
    }, [national]);

    const pieValues = slices.map((slice) => {
        const n = typeof slice.pct === 'number' ? slice.pct : 0;
        return n > 0 ? n : 0.001;
    });
    const baseColors = slices.map((_, index) => PIE_COLORS[index] ?? '#999999');
    const pieColors = effectiveSelectedSlices?.length
        ? baseColors.map((color, index) => (effectiveSelectedSlices.includes(index) ? color : hexToRgba(color, 0.3)))
        : baseColors;
    const labels = slices.map((slice) => getText(PIE_LABEL_KEYS[slice.key], lang));
    const chartSummary = slices.length ? joinChartSummary({
        intro: lang === 'en'
            ? `Pie chart of electricity generation in Canada by source for ${selectedYear}. Total ${totalTwh} terawatt hours`
            : `Graphique circulaire de la production d'électricité au Canada par source pour ${selectedYear}. Total ${totalTwh} térawattheures`,
        body: summarizeByCategory({
            categories: labels,
            series: [{
                name: lang === 'en' ? 'Share' : 'Part',
                values: slices.map((slice) => (typeof slice.pct === 'number' ? slice.pct : 0)),
                format: formatShareSpoken,
            }],
            lang,
        }),
    }) : '';
    const chartRegionLabel = chartSummary ? `${exportChartTitle}. ${chartSummary}` : exportChartTitle;
    const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18;
    const outsideTextSize = zoomLegendMode ? 18 : textSize;

    const plotData = useMemo(() => {
        if (!slices.length) return [];
        const pull = effectiveSelectedSlices?.length
            ? pieValues.map((_, index) => (effectiveSelectedSlices.includes(index) ? 0.08 : 0.02))
            : pieValues.map(() => 0.02);
        return [{
            type: 'pie',
            values: pieValues,
            labels,
            hole: 0.55,
            direction: 'clockwise',
            sort: false,
            texttemplate: zoomLegendMode ? '%{percent:.1%}' : '%{label}<br>%{percent:.1%}',
            textinfo: zoomLegendMode ? 'percent' : 'label+percent',
            textposition: zoomLegendMode ? 'inside' : 'outside',
            textfont: { size: textSize, family: 'Arial, sans-serif', color: zoomLegendMode ? '#ffffff' : pieColors },
            outsidetextfont: { size: outsideTextSize, color: pieColors },
            marker: { colors: pieColors, line: { color: '#ffffff', width: 1 } },
            pull,
            hovertext: slices.map((slice) => {
                const label = getText(PIE_LABEL_KEYS[slice.key], lang);
                return `<b>${label}</b><br>${formatPct(slice.pct)}`;
            }),
            hoverinfo: 'text',
            hoverlabel: { bgcolor: '#ffffff', font: { color: '#333333', size: 14, family: 'Arial, sans-serif' } },
            automargin: true,
        }];
    }, [slices, labels, pieValues, pieColors, effectiveSelectedSlices, textSize, outsideTextSize, zoomLegendMode, lang, formatPct]);

    const layout = useMemo(() => ({
        showlegend: false,
        margin: {
            t: zoomLegendMode ? 80 : 95,
            b: zoomLegendMode ? 40 : 80,
            l: windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 220,
            r: windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 220,
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        height: windowWidth <= 480 ? 430 : 520,
        clickmode: 'event',
        dragmode: false,
        annotations: national?.totalTwh != null ? [{
            text: `${getText('electricity_generation_canada_center_total', lang)}<br><b>${Math.round(national.totalTwh).toLocaleString(locale)}</b><br>${getText('electricity_generation_canada_twh_unit', lang)}`,
            showarrow: false,
            x: 0.5,
            y: 0.5,
            xref: 'paper',
            yref: 'paper',
            font: { size: windowWidth <= 480 ? 15 : 20, color: '#424243', family: 'Arial Black, Arial, sans-serif' },
        }] : [],
    }), [national, lang, locale, zoomLegendMode, windowWidth]);

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${fileSlugBase}_chart.png`,
        title: exportChartTitle,
        width: 1200,
        height: 800,
    }),
        [exportChartTitle, fileSlugBase],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const tableColumns = useMemo(() => [
        { key: 'year', header: lang === 'en' ? 'Year' : 'Année', align: 'left' },
        { key: 'source', header: getText('electricity_generation_canada_table_col_source', lang), align: 'left' },
        { key: 'province', header: getText('electricity_generation_canada_table_col_province', lang), align: 'left' },
        { key: 'share', header: getText('electricity_generation_canada_table_col_share', lang), align: 'num' },
    ], [lang]);

    const tableRows = useMemo(() => {
        if (!selectedYear) return [];
        const rows = [];
        slices.forEach((slice) => {
            rows.push({
                year: selectedYear,
                source: getText(PIE_LABEL_KEYS[slice.key], lang),
                province: getText('electricity_generation_canada_canada_label', lang),
                share: formatPct(slice.pct),
            });
        });
        INFOGRAPHIC_SOURCE_KEYS.forEach((sourceKey) => {
            const block = infographic?.sources?.[sourceKey];
            if (!block) return;
            const sourceLabel = getText(INFOGRAPHIC_LABEL_KEYS[sourceKey], lang);
            getCanadianGenerationProvinceRows(sourceKey, block).forEach((row) => {
                rows.push({
                    year: selectedYear,
                    source: sourceLabel,
                    province: getText(`electricity_generation_provincial_prov_${row.key}`, lang),
                    share: formatSharePct(row.value, lang),
                });
            });
        });
        return rows;
    }, [selectedYear, slices, infographic, lang, formatPct]);

    const downloadInfographicPng = async () => {
        const canvas = await exportCanadianGenerationInfographicPng(
            resolveAccessibleInfographicRoot(figureRef.current),
            { scale: 2 },
        );
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${fileSlugBase}_infographic.png`);
        });
    };

    const shellProps = {
        id: 'main-content',
        tabIndex: '-1',
        className: 'page-content page-66 page-chrome page-chrome--bleed',
        'aria-labelledby': 'canadian-electricity-generation-section-title',
        style: { backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) },
    };

    if (loading || error) {
        return (
            <PageShell {...shellProps}>
                <PageStatus lang={lang} loading={loading} error={error} />
            </PageShell>
        );
    }
    if (!selectedYear || !slices.length) {
        return (
            <PageShell {...shellProps}>
                <p>{getText('electricity_generation_canada_no_data', lang)}</p>
            </PageShell>
        );
    }

    return (
        <PageShell {...shellProps}>
            <style>{`
.page-66.page-content { max-width: none !important; overflow-x: visible !important; }
.canadian-electricity-generation-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.canadian-electricity-generation-page-title {
    line-height: 1.25;
    text-transform: none;
    text-align: left;
}
.page-66 p.canadian-electricity-generation-page-subtitle {
    font-family: 'Lato', sans-serif;
    font-size: 39px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 20px 0;
    line-height: 1.15;
    text-transform: none;
    text-align: left;
}
.canadian-electricity-generation-charts-anchor { width: 100%; box-sizing: border-box; }
.canadian-electricity-generation-chart-frame {
    margin-bottom: 0;
}
.canadian-electricity-generation-donut-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    min-height: 480px;
}
.canadian-electricity-generation-donut-figure {
    width: 100%;
    max-width: 800px;
    min-width: 360px;
    min-height: 450px;
    height: 520px;
    margin: 0;
    position: relative;
}
.canadian-electricity-generation-custom-legend {
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
.canadian-electricity-generation-custom-legend-item { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.canadian-electricity-generation-custom-legend-swatch {
    width: 12px;
    height: 12px;
    display: inline-block;
    border-radius: 2px;
    border: 1px solid rgba(0, 0, 0, 0.15);
}
.canadian-electricity-generation-infographic-section { width: 100%; margin-top: 30px; margin-bottom: 0; }
.canadian-electricity-generation-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.canadian-electricity-generation-download-btn {
    padding: 8px 16px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.canadian-electricity-generation-chart-frame button:hover,
.canadian-electricity-generation-download-btn:hover { background-color: #404040 !important; }
.canadian-electricity-generation-table-wrapper { display: block; width: 100%; margin-top: 20px; }
@media (max-width: 768px) {
    .page-66 p.canadian-electricity-generation-page-subtitle { font-size: 35px; }
    .canadian-electricity-generation-donut-figure { height: 430px; min-height: 430px; }
    .canadian-electricity-generation-custom-legend { font-size: 10px; gap: 8px 12px; }
}
            `}</style>

            <div className="canadian-electricity-generation-inner">
                <h1 id="canadian-electricity-generation-section-title" className="canadian-electricity-generation-page-title page-chrome-title">{sectionTitle}</h1>
                <p className="canadian-electricity-generation-page-subtitle">{generationTotal}</p>

                <div className="canadian-electricity-generation-charts-anchor">
                    <div className="canadian-electricity-generation-chart-frame page-chrome-chart-frame">
                        <p className="canadian-electricity-generation-chart-title page-chrome-chart-title">{chartTitle}</p>
                        {effectiveSelectedSlices?.length > 0 && (
                            <ClearSelectionButton lang={lang} onClick={() => setSelectedSlices(null)} />
                        )}
                        <div className="canadian-electricity-generation-donut-wrap" ref={chartRef}>
                            <figure className="canadian-electricity-generation-donut-figure" role="region" aria-label={chartRegionLabel} tabIndex="0">
                                <div aria-hidden="true">
                                <Plot
                                    key={`canadian-electricity-generation-${selectedYear}-${zoomLegendMode ? 'compact' : 'wide'}-${effectiveSelectedSlices ? effectiveSelectedSlices.join('-') : 'none'}`}
                                    data={plotData}
                                    layout={layout}
                                    config={plotConfig}
                                    style={{ width: '100%', minWidth: 360, minHeight: 450, height: '100%' }}
                                    useResizeHandler
                                    onClick={(eventData) => {
                                        if (!selectEnabled || !eventData.points?.length) return;
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
                                <div className="canadian-electricity-generation-custom-legend" aria-label={lang === 'en' ? 'Chart legend' : 'Légende du graphique'}>
                                    {slices.map((slice, index) => (
                                        <span key={slice.key} className="canadian-electricity-generation-custom-legend-item">
                                            <span className="canadian-electricity-generation-custom-legend-swatch" style={{ backgroundColor: PIE_COLORS[index] }} aria-hidden="true" />
                                            <span>{getText(PIE_LABEL_KEYS[slice.key], lang)}</span>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="canadian-electricity-generation-table-wrapper">
                            <ChartDataTable
                                lang={lang}
                                columns={tableColumns}
                                rows={tableRows}
                                csvFilename={`${fileSlugBase}.csv`}
                                docx={{
                                    filename: `${fileSlugBase}.docx`,
                                    title: exportChartTitle,
                                    titleAlign: 'center',
                                    columnWidths: [1200, 3200, 2400, 1800],
                                    fontSize: 22,
                                }}
                                caption={tableCaption}
                                tableAriaLabel={tableCaption}
                            />
                        </div>
                    </div>
                </div>

                <div className="canadian-electricity-generation-infographic-section">
                    <CanadianElectricityGenerationInfographic
                        lang={lang}
                        getText={getText}
                        figureRef={figureRef}
                        ariaLabel={ariaLabel}
                        data={infographic}
                    />
                    <div className="canadian-electricity-generation-download-buttons">
                        <button type="button" className="canadian-electricity-generation-download-btn" onClick={downloadInfographicPng}>
                            {getText('electricity_generation_canada_download_png', lang)}
                        </button>
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default CanadianElectricityGeneration;
