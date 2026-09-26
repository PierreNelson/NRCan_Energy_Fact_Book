import React, { useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
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
import HtmlLegend from '../components/HtmlLegend';
import hexToRgba from '../utils/hexToRgba';

const PEP_REGIONS = ['BC', 'Alta', 'Sask', 'Man', 'Ont', 'Que', 'NL', 'Territories', 'Maritimes'];
const SOURCES_INCLUDING = ['coal', 'crude_oil', 'natural_gas', 'ngls', 'hydro', 'uranium', 'other_renewables'];
const SOURCES_EXCLUDING = ['coal', 'crude_oil', 'natural_gas', 'ngls', 'hydro', 'nuclear', 'other_renewables'];

const DOC_COLUMN_WIDTHS = [2200, 1400, 1400, 1400, 1400, 1400, 1400, 1400, 1600];

const primary_energy_by_region_HARDCODED = {
    year: 2023,
    regions: {
        BC: { coal: 20, crude_oil: 380, natural_gas: 1850, ngls: 120, hydro: 1050, uranium: 0, other_renewables: 580 },
        Alta: { coal: 380, crude_oil: 7200, natural_gas: 5800, ngls: 950, hydro: 90, uranium: 0, other_renewables: 580 },
        Sask: { coal: 220, crude_oil: 5200, natural_gas: 1150, ngls: 280, hydro: 180, uranium: 6200, other_renewables: 390 },
        Man: { coal: 0, crude_oil: 40, natural_gas: 10, ngls: 0, hydro: 1050, uranium: 0, other_renewables: 200 },
        Ont: { coal: 0, crude_oil: 0, natural_gas: 80, ngls: 0, hydro: 800, uranium: 2100, other_renewables: 420 },
        Que: { coal: 0, crude_oil: 0, natural_gas: 0, ngls: 0, hydro: 1850, uranium: 0, other_renewables: 180 },
        NL: { coal: 0, crude_oil: 1250, natural_gas: 420, ngls: 90, hydro: 380, uranium: 0, other_renewables: 20 },
        Territories: { coal: 0, crude_oil: 0, natural_gas: 0, ngls: 0, hydro: 30, uranium: 0, other_renewables: 5 },
        Maritimes: { coal: 180, crude_oil: 220, natural_gas: 90, ngls: 20, hydro: 60, uranium: 0, other_renewables: 140 }
    }
};

const COLORS = {
    coal: '#7A7A7A',
    crude_oil: '#9b8a42',
    natural_gas: '#3A9FC8',
    ngls: '#9A9389',
    hydro: '#245e7f',
    uranium: '#1C6B7E',
    nuclear: '#1C6B7E',
    other_renewables: '#857650'
};

const formatProductionByRegionNumber = (num, lang) => {
    if (num === undefined || num === null) return '—';
    return Math.round(num).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');
};

const sourceDataKey = (sourceKey) => (sourceKey === 'nuclear' ? 'uranium' : sourceKey);

const sourceLabelKey = (sourceKey) => (
    sourceKey === 'uranium'
        ? 'primary_energy_production_uranium'
        : `primary_energy_production_${sourceKey}`
);

const PrimaryEnergyByRegion = () => {
    const { lang, layoutPadding } = useOutletContext();
    const pageData = primary_energy_by_region_HARDCODED;
    const windowWidth = useWindowWidth();
    const {
        selected: selectedPoints1,
        clear: clearSelection1,
        onPlotClick: handleChart1Click,
        isSelected: isSelected1,
        hasSelection: hasSelection1,
    } = usePlotlySelection({ mode: 'points', traceCount: SOURCES_INCLUDING.length, windowWidth });
    const {
        selected: selectedPoints2,
        clear: clearSelection2,
        onPlotClick: handleChart2Click,
        isSelected: isSelected2,
        hasSelection: hasSelection2,
    } = usePlotlySelection({ mode: 'points', traceCount: SOURCES_EXCLUDING.length, windowWidth });
    const chartRef1 = useRef(null);
    const chartRef2 = useRef(null);

    const downloadPngLabel = lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG';

    const regionLabels = useMemo(() =>
        PEP_REGIONS.map(r => getText(`primary_energy_by_region_region_${r}`, lang)),
        [lang]
    );

    const chart1Traces = useMemo(() => {
        if (!pageData || !pageData.regions || Object.keys(pageData.regions).length === 0) return [];
        return SOURCES_INCLUDING.map((sourceKey, traceIndex) => {
            const sourceLabel = getText(sourceLabelKey(sourceKey), lang);
            const xArr = PEP_REGIONS.map(region => pageData.regions[region]?.[sourceKey] ?? 0);
            const hovertext = PEP_REGIONS.map((region, i) => {
                const val = xArr[i];
                const regionLabelFull = getText(`primary_energy_by_region_region_${region}_full`, lang);
                return `<b>${regionLabelFull}</b><br>${sourceLabel}: ${formatProductionByRegionNumber(val, lang)} PJ`;
            });
            const baseColor = COLORS[sourceKey];
            const markerColor = selectedPoints1 === null
                ? baseColor
                : xArr.map((_, pointIndex) => (
                    isSelected1(traceIndex, pointIndex) ? baseColor : hexToRgba(baseColor, 0.3)
                ));
            return {
                type: 'bar',
                orientation: 'h',
                name: sourceLabel,
                x: xArr,
                y: regionLabels,
                marker: { color: markerColor },
                hovertext,
                hoverinfo: 'text',
                textinfo: 'none'
            };
        });
    }, [pageData, lang, regionLabels, selectedPoints1, isSelected1]);

    const chart2Traces = useMemo(() => {
        if (!pageData || !pageData.regions || Object.keys(pageData.regions).length === 0) return [];
        return SOURCES_EXCLUDING.map((sourceKey, traceIndex) => {
            const dataKey = sourceDataKey(sourceKey);
            const sourceLabel = getText(`primary_energy_production_${sourceKey}`, lang);
            const xArr = PEP_REGIONS.map(region => pageData.regions[region]?.[dataKey] ?? 0);
            const hovertext = PEP_REGIONS.map((region, i) => {
                const val = xArr[i];
                const regionLabelFull = getText(`primary_energy_by_region_region_${region}_full`, lang);
                return `<b>${regionLabelFull}</b><br>${sourceLabel}: ${formatProductionByRegionNumber(val, lang)} PJ`;
            });
            const baseColor = COLORS[sourceKey];
            const markerColor = selectedPoints2 === null
                ? baseColor
                : xArr.map((_, pointIndex) => (
                    isSelected2(traceIndex, pointIndex) ? baseColor : hexToRgba(baseColor, 0.3)
                ));
            return {
                type: 'bar',
                orientation: 'h',
                name: sourceLabel,
                x: xArr,
                y: regionLabels,
                marker: { color: markerColor },
                hovertext,
                hoverinfo: 'text',
                textinfo: 'none'
            };
        });
    }, [pageData, lang, regionLabels, selectedPoints2, isSelected2]);

    

    const xMax = useMemo(() => {
        if (!pageData?.regions) return 16000;
        let total = 0;
        PEP_REGIONS.forEach(region => {
            const r = pageData.regions[region];
            if (!r) return;
            const sum = SOURCES_INCLUDING.reduce((acc, s) => acc + (r[s] || 0), 0);
            if (sum > total) total = sum;
        });
        return Math.max(16000, Math.ceil(total / 2000) * 2000);
    }, [pageData]);

    const sourceLabelFor = (sourceKey) => getText(sourceLabelKey(sourceKey), lang);

    const getChartSummary = (sources) => {
        if (!pageData?.regions) return '';
        const year = pageData.year;
        const categories = PEP_REGIONS.map((region) =>
            getText(`primary_energy_by_region_region_${region}_full`, lang),
        );
        const body = summarizeByCategory({
            categories,
            series: sources.map((sourceKey) => {
                const dataKey = sourceDataKey(sourceKey);
                return {
                    name: sourceLabelFor(sourceKey),
                    values: PEP_REGIONS.map((region) => pageData.regions[region]?.[dataKey] ?? 0),
                    format: (v) => `${formatProductionByRegionNumber(v, lang)} PJ`,
                };
            }),
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Horizontal stacked bar chart of primary energy production by region for ${year}`
                : `Graphique à barres empilées horizontales de la production d'énergie primaire par région pour ${year}`,
            unitNote: lang === 'en' ? 'Values in petajoules' : 'Valeurs en pétajoules',
            body,
        });
    };

    const chart1Title = stripHtml(getText('primary_energy_by_region_chart1_title', lang));
    const chart2Title = stripHtml(getText('primary_energy_by_region_chart2_title', lang));
    const pageTitle = stripHtml(getText('primary_energy_by_region_title', lang));
    const chart1RegionLabel = `${chart1Title}. ${getChartSummary(SOURCES_INCLUDING)}`;
    const chart2RegionLabel = `${chart2Title}. ${getChartSummary(SOURCES_EXCLUDING)}`;

    const regionColHeader = lang === 'en' ? 'Region' : 'Région';
    const totalColHeader = lang === 'en' ? 'Total (PJ)' : 'Total (PJ)';
    const unitSuffix = ` (${getText('primary_energy_by_region_xaxis', lang)})`;

    const tableColumns1 = useMemo(() => [
        { key: 'region', header: regionColHeader, align: 'left' },
        ...SOURCES_INCLUDING.map((s) => ({
            key: s,
            header: `${getText(sourceLabelKey(s), lang)}${unitSuffix}`,
            align: 'num',
        })),
        { key: 'total', header: totalColHeader, align: 'num' },
    ], [lang, regionColHeader, totalColHeader, unitSuffix]);

    const tableColumns2 = useMemo(() => [
        { key: 'region', header: regionColHeader, align: 'left' },
        ...SOURCES_EXCLUDING.map((s) => ({
            key: s,
            header: `${getText(`primary_energy_production_${s}`, lang)}${unitSuffix}`,
            align: 'num',
        })),
        { key: 'total', header: totalColHeader, align: 'num' },
    ], [lang, regionColHeader, totalColHeader, unitSuffix]);

    const tableRows1 = useMemo(() => {
        if (!pageData?.regions) return [];
        return PEP_REGIONS.map((region) => {
            const r = pageData.regions[region] || {};
            const row = { region: getText(`primary_energy_by_region_region_${region}`, lang) };
            let total = 0;
            SOURCES_INCLUDING.forEach((s) => {
                const v = r[s] ?? 0;
                row[s] = v;
                total += v;
            });
            row.total = total;
            return row;
        });
    }, [pageData, lang]);

    const tableRows2 = useMemo(() => {
        if (!pageData?.regions) return [];
        return PEP_REGIONS.map((region) => {
            const r = pageData.regions[region] || {};
            const row = { region: getText(`primary_energy_by_region_region_${region}`, lang) };
            let total = 0;
            SOURCES_EXCLUDING.forEach((s) => {
                const v = (s === 'nuclear' ? r.uranium : r[s]) ?? 0;
                row[s] = v;
                total += v;
            });
            row.total = total;
            return row;
        });
    }, [pageData, lang]);

    const slugIncluding = lang === 'en' ? 'primary_energy_by_region_including' : 'production_energie_par_region_incluant';
    const slugExcluding = lang === 'en' ? 'primary_energy_by_region_excluding' : 'production_energie_par_region_excluant';
    const pngSlug = lang === 'en' ? 'primary_energy_by_region' : 'production_energie_par_region';

    const plotLayout = (xMaxVal) => ({
        barmode: 'stack',
        showlegend: false,
        clickmode: 'event',
        hovermode: 'closest',
        hoverlabel: {
            bgcolor: '#ffffff',
            font: { color: '#000000', size: 14, family: 'Arial, sans-serif' }
        },
        xaxis: {
            title: { text: getText('primary_energy_by_region_xaxis', lang), font: { size: windowWidth <= 480 ? 14 : 18, family: 'Arial, sans-serif' }, standoff: 15 },
            range: [0, xMaxVal],
            tick0: 0,
            dtick: 2000,
            showgrid: true,
            zeroline: true,
            tickfont: { size: windowWidth <= 480 ? 12 : 16, family: 'Arial, sans-serif' },
            automargin: true
        },
        yaxis: {
            autorange: 'reversed',
            showgrid: false,
            tickfont: { size: windowWidth <= 480 ? 12 : 16, family: 'Arial, sans-serif' },
            automargin: true
        },
        margin: { l: 80, r: 20, t: 20, b: 80 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        autosize: true
    });

    const downloadChart1Png = useChartPngDownloader(
        chartRef1,
        () => ({
        filename: `${pngSlug}.png`,
        title: chart1Title,
        height: 500,
        legendItems: SOURCES_INCLUDING.map((key) => ({
            label: getText(sourceLabelKey(key), lang),
            color: COLORS[key],
        })),
    }),
        [COLORS, SOURCES_INCLUDING, chart1Title, getText, lang, pngSlug, sourceLabelKey],
    );

    const downloadChart2Png = useChartPngDownloader(
        chartRef2,
        () => ({
        filename: `${pngSlug}.png`,
        title: chart2Title,
        height: 500,
        legendItems: SOURCES_EXCLUDING.map((key) => ({
            label: getText(`primary_energy_production_${key}`, lang),
            color: COLORS[key],
        })),
    }),
        [COLORS, SOURCES_EXCLUDING, chart2Title, getText, lang, pngSlug],
    );

    const plotConfig1 = buildPngOnlyPlotConfig({
        lang,
        name: downloadPngLabel,
        click: (gd) => downloadChart1Png(gd),
    });

    const plotConfig2 = buildPngOnlyPlotConfig({
        lang,
        name: downloadPngLabel,
        click: (gd) => downloadChart2Png(gd),
    });

    const hasData = pageData?.regions && Object.keys(pageData.regions).length > 0;

    const renderNumericCell = (raw, { colIndex }) => (
        colIndex === 0 ? String(raw ?? '') : formatProductionByRegionNumber(raw, lang)
    );

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-5 page-chrome page-chrome--bleed"
            aria-labelledby="primary-energy-by-region-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.page-5 { width: 100%; }
.primary-energy-by-region-container { width: 100%; padding: 15px 0 0 0; display: flex; flex-direction: column; box-sizing: border-box; flex: 1; overflow: visible; }
.primary-energy-by-region-chart { width: 100%; height: 420px; position: relative; z-index: 1; }
.primary-energy-by-region-chart button[type="button"]:hover,
.primary-energy-by-region-chart button:hover,
.primary-energy-by-region-chart-frame button[type="button"]:hover,
.primary-energy-by-region-chart-frame button:hover { background-color: #404040 !important; }
.primary-energy-by-region-legend { position: relative; z-index: 10; background-color: #f5f5f5; padding: 10px 0; }
.primary-energy-by-region-legend-color { width: 20px; height: 12px; display: inline-block; }
.primary-energy-by-region-legend-label { font-size: 18px; color: #333333; }
.primary-energy-by-region-no-data { font-family: 'Noto Sans', sans-serif; font-size: 18px; color: #555; padding: 24px; text-align: center; }
.primary-energy-by-region-table-wrapper { display: block; width: 100%; margin: 20px 0 0 0; }
@media (max-width: 768px) {
.primary-energy-by-region-legend-label { font-size: 14px; }
}
            `}</style>
            <div className="primary-energy-by-region-container">
                <header>
                    <h1 id="primary-energy-by-region-title" className="primary-energy-by-region-title page-chrome-title">{getText('primary_energy_by_region_title', lang)}</h1>
                </header>

                <div className="primary-energy-by-region-chart-frame page-chrome-chart-frame">
                    <h2 className="primary-energy-by-region-chart-title page-chrome-chart-title">{getText('primary_energy_by_region_chart1_title', lang)}</h2>
                    {hasData ? (
                        <>
                            <div role="region" aria-label={chart1RegionLabel} tabIndex="0">
                                {hasSelection1 && <ClearSelectionButton lang={lang} onClick={clearSelection1} />}
                                    <figure ref={chartRef1} className="primary-energy-by-region-chart" style={{ margin: 0, position: 'relative' }}>
                                        <Plot
                                            data={chart1Traces}
                                            layout={plotLayout(xMax)}
                                            config={plotConfig1}
                                            style={{ width: '100%', height: '100%' }}
                                            useResizeHandler={true}
                                            onClick={handleChart1Click}
                                        />
                                </figure>
                            </div>
                            <HtmlLegend
                                className="primary-energy-by-region-legend"
                                variant="swatch"
                                itemClassName="primary-energy-by-region-legend-item"
                                markerClassName="primary-energy-by-region-legend-color"
                                labelClassName="primary-energy-by-region-legend-label"
                                items={SOURCES_INCLUDING.map((key) => ({
                                    label: getText(`primary_energy_production_${key}`, lang),
                                    color: COLORS[key],
                                }))}
                            />
                            <div className="primary-energy-by-region-table-wrapper">
                                <ChartDataTable
                                    lang={lang}
                                    columns={tableColumns1}
                                    rows={tableRows1}
                                    csvFilename={`${slugIncluding}.csv`}
                                    docx={{
                                        filename: `${slugIncluding}.docx`,
                                        title: `${pageTitle} – ${chart1Title}`,
                                        titleAlign: 'center',
                                        columnWidths: DOC_COLUMN_WIDTHS,
                                        fontSize: 22,
                                    }}
                                    caption={chart1Title}
                                    tableAriaLabel={chart1Title}
                                    renderCell={renderNumericCell}
                                />
                            </div>
                        </>
                    ) : (
                        <p className="primary-energy-by-region-no-data">{lang === 'en' ? 'No data available.' : 'Aucune donnée disponible.'}</p>
                    )}
                </div>

                <div className="primary-energy-by-region-chart-frame page-chrome-chart-frame">
                    <h2 className="primary-energy-by-region-chart-title page-chrome-chart-title">{getText('primary_energy_by_region_chart2_title', lang)}</h2>
                    {hasData ? (
                        <>
                            <div role="region" aria-label={chart2RegionLabel} tabIndex="0">
                                {hasSelection2 && <ClearSelectionButton lang={lang} onClick={clearSelection2} />}
                                    <figure ref={chartRef2} className="primary-energy-by-region-chart" style={{ margin: 0, position: 'relative' }}>
                                        <Plot
                                            data={chart2Traces}
                                            layout={plotLayout(xMax)}
                                            config={plotConfig2}
                                            style={{ width: '100%', height: '100%' }}
                                            useResizeHandler={true}
                                            onClick={handleChart2Click}
                                        />
                                </figure>
                            </div>
                            <HtmlLegend
                                className="primary-energy-by-region-legend"
                                variant="swatch"
                                itemClassName="primary-energy-by-region-legend-item"
                                markerClassName="primary-energy-by-region-legend-color"
                                labelClassName="primary-energy-by-region-legend-label"
                                items={SOURCES_EXCLUDING.map((key) => ({
                                    label: getText(`primary_energy_production_${key}`, lang),
                                    color: COLORS[key],
                                }))}
                            />
                            <div className="primary-energy-by-region-table-wrapper">
                                <ChartDataTable
                                    lang={lang}
                                    columns={tableColumns2}
                                    rows={tableRows2}
                                    csvFilename={`${slugExcluding}.csv`}
                                    docx={{
                                        filename: `${slugExcluding}.docx`,
                                        title: `${pageTitle} – ${chart2Title}`,
                                        titleAlign: 'center',
                                        columnWidths: DOC_COLUMN_WIDTHS,
                                        fontSize: 22,
                                    }}
                                    caption={chart2Title}
                                    tableAriaLabel={chart2Title}
                                    renderCell={renderNumericCell}
                                />
                            </div>
                        </>
                    ) : (
                        <p className="primary-energy-by-region-no-data">{lang === 'en' ? 'No data available.' : 'Aucune donnée disponible.'}</p>
                    )}
                </div>
            </div>
        </PageShell>
    );
};

export default PrimaryEnergyByRegion;
