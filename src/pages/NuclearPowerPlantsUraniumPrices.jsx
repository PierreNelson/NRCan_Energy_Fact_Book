import React, { useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import FootnoteMarker from '../components/FootnoteMarker';
import ClearSelectionButton from '../components/ClearSelectionButton';
import PageFootnotes from '../components/PageFootnotes';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import { parseColumnHeader } from '../utils/chartDataTableCellNav';
import { exportTableToCsv, exportTableToDocx } from '../utils/exportTableToDocx';
import hexToRgba from '../utils/hexToRgba';

import { makeScrollToIdHandler } from '../utils/scrollToId';

const NUCLEAR_FACILITIES = [
    { key: 'darlington', facilityEn: 'Darlington', provinceKey: 'ontario', outputMw: 3736, units: 4 },
    { key: 'bruce_b', facilityEn: 'Bruce B', provinceKey: 'ontario', outputMw: 3507, units: 4 },
    { key: 'bruce_a', facilityEn: 'Bruce A', provinceKey: 'ontario', outputMw: 3437, units: 4 },
    { key: 'pickering_b', facilityEn: 'Pickering B', provinceKey: 'ontario', outputMw: 2160, units: 4 },
    { key: 'point_lepreau', facilityEn: 'Point Lepreau', provinceKey: 'nb', outputMw: 705, units: 1 },
];

const URANIUM_PRICE_DATA = [
    { year: 1996, spot: 15.2, foreignPurchases: 14.5 },
    { year: 1997, spot: 12.5, foreignPurchases: 13.0 },
    { year: 1998, spot: 11.8, foreignPurchases: 12.2 },
    { year: 1999, spot: 10.2, foreignPurchases: 11.5 },
    { year: 2000, spot: 9.8, foreignPurchases: 11.0 },
    { year: 2001, spot: 10.5, foreignPurchases: 11.2 },
    { year: 2002, spot: 10.8, foreignPurchases: 11.5 },
    { year: 2003, spot: 11.2, foreignPurchases: 12.0 },
    { year: 2004, spot: 20.3, foreignPurchases: 16.5 },
    { year: 2005, spot: 29.5, foreignPurchases: 24.0 },
    { year: 2006, spot: 41.8, foreignPurchases: 35.0 },
    { year: 2007, spot: 84.5, foreignPurchases: 42.0 },
    { year: 2008, spot: 44.5, foreignPurchases: 50.5 },
    { year: 2009, spot: 36.5, foreignPurchases: 48.0 },
    { year: 2010, spot: 45.8, foreignPurchases: 52.0 },
    { year: 2011, spot: 55.2, foreignPurchases: 55.5 },
    { year: 2012, spot: 49.0, foreignPurchases: 54.0 },
    { year: 2013, spot: 38.5, foreignPurchases: 51.0 },
    { year: 2014, spot: 35.8, foreignPurchases: 48.5 },
    { year: 2015, spot: 35.2, foreignPurchases: 46.0 },
    { year: 2016, spot: 26.8, foreignPurchases: 42.0 },
    { year: 2017, spot: 22.0, foreignPurchases: 38.5 },
    { year: 2018, spot: 24.5, foreignPurchases: 37.0 },
    { year: 2019, spot: 26.0, foreignPurchases: 36.0 },
    { year: 2020, spot: 29.5, foreignPurchases: 35.5 },
    { year: 2021, spot: 32.8, foreignPurchases: 35.0 },
    { year: 2022, spot: 48.5, foreignPurchases: 42.0 },
    { year: 2023, spot: 55.0, foreignPurchases: 48.0 },
    { year: 2024, spot: 72.0, foreignPurchases: 55.0 },
];

const CHART_COLORS = { spot: '#333333', foreign: '#809276' };

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

const NuclearPowerPlantsUraniumPrices = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const {
        selected: selectedTraceIds,
        clear: clearSelection,
        toggleSlice,
    } = usePlotlySelection({ mode: 'slices', windowWidth });

    const chartRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const formatMw = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const formatPrice = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    };

    const scrollToElement = (id) => makeScrollToIdHandler(id);

    

    const facilitiesRows = useMemo(
        () =>
            NUCLEAR_FACILITIES.map((row) => ({
                facility: row.facilityEn,
                province: getText(`nuclear_power_plants_uranium_prices_province_${row.provinceKey}`, lang),
                outputMw: row.outputMw,
                units: row.units,
            })),
        [lang],
    );

    const years = useMemo(() => URANIUM_PRICE_DATA.map((row) => row.year), []);
    const spotValues = useMemo(() => URANIUM_PRICE_DATA.map((row) => row.spot), []);
    const foreignValues = useMemo(() => URANIUM_PRICE_DATA.map((row) => row.foreignPurchases), []);
    const chartYearStart = years[0];
    const chartYearEnd = years[years.length - 1];
    const chartYearVars = { startYear: chartYearStart, endYear: chartYearEnd };

    const spotLabel = getText('nuclear_power_plants_uranium_prices_legend_spot', lang);
    const foreignLabel = getText('nuclear_power_plants_uranium_prices_legend_foreign', lang);
    const chartTitle = getText('nuclear_power_plants_uranium_prices_chart_title', lang);
    const exportChartTitle = stripHtml(chartTitle);
    const priceUnit = getText('nuclear_power_plants_uranium_prices_yaxis', lang);
    const priceUnitSpoken = parseColumnHeader(
        getText('nuclear_power_plants_uranium_prices_chart_table_col_spot', lang),
    ).unitSpoken || priceUnit;
    const facilitiesTitle = getText('nuclear_power_plants_uranium_prices_facilities_title', lang);
    const facilitiesCaption = getText('nuclear_power_plants_uranium_prices_facilities_caption', lang);
    const facilitiesFileSlug = getText('nuclear_power_plants_uranium_prices_facilities_csv_slug', lang).replace(/\.csv$/i, '');
    const chartFileSlug = substitute(getText('nuclear_power_plants_uranium_prices_chart_file_slug', lang), chartYearVars);
    const chartDocxTitle = `${substitute(getText('nuclear_power_plants_uranium_prices_chart_docx_title', lang), chartYearVars)}*`;
    const chartTableCaption = getText('nuclear_power_plants_uranium_prices_chart_table_caption', lang);
    const chartTableSummary = getText('nuclear_power_plants_uranium_prices_chart_table_summary', lang);

    const facilitiesColumns = useMemo(() => [
        { key: 'facility', header: getText('nuclear_power_plants_uranium_prices_facilities_col_facility', lang), align: 'left' },
        { key: 'province', header: getText('nuclear_power_plants_uranium_prices_facilities_col_province', lang), align: 'left' },
        { key: 'outputMw', header: getText('nuclear_power_plants_uranium_prices_facilities_col_output', lang), align: 'num' },
        { key: 'units', header: getText('nuclear_power_plants_uranium_prices_facilities_col_units', lang), align: 'num' },
    ], [lang]);

    const facilitiesExportRows = facilitiesRows.map((row) => [
        row.facility,
        row.province,
        formatMw(row.outputMw),
        String(row.units),
    ]);

    const downloadFacilitiesCsv = () => {
        exportTableToCsv({
            filename: `${facilitiesFileSlug}.csv`,
            headers: facilitiesColumns.map((column) => column.header),
            rows: facilitiesExportRows,
        });
    };

    const downloadFacilitiesDocx = () => {
        exportTableToDocx({
            filename: `${facilitiesFileSlug}.docx`,
            title: facilitiesTitle,
            headers: facilitiesColumns.map((column) => column.header),
            rows: facilitiesExportRows,
            columnWidths: [3200, 2400, 3200, 1400],
            options: { titleAlign: 'center', fontSize: 22 },
        });
    };

    const chartTableColumns = useMemo(() => [
        { key: 'year', header: getText('nuclear_power_plants_uranium_prices_chart_table_col_year', lang), align: 'left' },
        { key: 'spot', header: getText('nuclear_power_plants_uranium_prices_chart_table_col_spot', lang), align: 'num' },
        { key: 'foreignPurchases', header: getText('nuclear_power_plants_uranium_prices_chart_table_col_foreign', lang), align: 'num' },
    ], [lang]);

    const tickFont = { size: windowWidth <= 480 ? 12 : 14, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 480 ? 13 : 15, family: 'Arial, sans-serif', color: '#333333' };
    const plotHeight = windowWidth <= 480 ? 320 : windowWidth <= 768 ? 360 : 400;
    const yearTicks = years.filter((year) => year % 2 === 0);

    const spotFocused = selectedTraceIds === null || selectedTraceIds.includes(0);
    const foreignFocused = selectedTraceIds === null || selectedTraceIds.includes(1);

    const spotHoverTemplates = years.map(
        (y, i) => `<b>${spotLabel}</b><br>${y}: ${formatPrice(spotValues[i])} ${priceUnit}<extra></extra>`,
    );
    const foreignHoverTemplates = years.map(
        (y, i) => `<b>${foreignLabel}</b><br>${y}: ${formatPrice(foreignValues[i])} ${priceUnit}<extra></extra>`,
    );

    const handleChartClick = (event) => {
        if (!event?.points?.length) return;
        const traceIndex = event.points[0].curveNumber;
        if (traceIndex !== 0 && traceIndex !== 1) return;
        toggleSlice(traceIndex);
    };

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${chartFileSlug}.png`,
        title: `${exportChartTitle}*`,
        height: 640,
        legendItems: [
            { label: spotLabel, color: CHART_COLORS.spot },
            { label: foreignLabel, color: CHART_COLORS.foreign },
        ],
    }),
        [CHART_COLORS, chartFileSlug, exportChartTitle, foreignLabel, spotLabel],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        name: getText('nuclear_power_plants_uranium_prices_download_png', lang),
        click: (gd) => downloadChartWithTitle(gd),
    });

    const plotData = [
        {
            x: years,
            y: spotValues,
            type: 'scatter',
            mode: 'lines',
            name: spotLabel,
            line: {
                color: spotFocused ? CHART_COLORS.spot : hexToRgba(CHART_COLORS.spot, 0.3),
                width: 3,
            },
            hovertemplate: spotHoverTemplates,
            hoveron: 'points',
        },
        {
            x: years,
            y: foreignValues,
            type: 'scatter',
            mode: 'lines',
            name: foreignLabel,
            line: {
                color: foreignFocused ? CHART_COLORS.foreign : hexToRgba(CHART_COLORS.foreign, 0.3),
                width: 3,
            },
            hovertemplate: foreignHoverTemplates,
            hoveron: 'points',
        },
    ];

    const plotLayout = {
        showlegend: false,
        hovermode: 'closest',
        hoverlabel: HOVER_LABEL,
        clickmode: 'event',
        dragmode: false,
        height: plotHeight,
        margin: { l: 72, r: 24, t: 24, b: windowWidth <= 480 ? 72 : 56 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        xaxis: {
            showgrid: false,
            zeroline: false,
            showline: true,
            linewidth: 1,
            linecolor: '#333333',
            tickfont: tickFont,
            tickmode: 'array',
            tickvals: yearTicks,
            ticktext: yearTicks.map(String),
            range: [1995.5, 2024.5],
            automargin: true,
        },
        yaxis: {
            title: { text: priceUnit, font: axisTitleFont, standoff: 12 },
            showgrid: false,
            zeroline: false,
            showline: true,
            linewidth: 1,
            linecolor: '#333333',
            tickfont: tickFont,
            range: [0, 100],
            dtick: 10,
            automargin: true,
        },
        autosize: true,
    };

    const getChartSummary = () => {
        const body = summarizeByCategory({
            categories: years,
            series: [
                { name: spotLabel, values: spotValues, format: formatPrice },
                { name: foreignLabel, values: foreignValues, format: formatPrice },
            ],
            lang,
            newestFirst: true,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Line chart of uranium prices from ${chartYearStart} to ${chartYearEnd}`
                : `Graphique linéaire des prix de l'uranium de ${chartYearStart} à ${chartYearEnd}`,
            unitNote: lang === 'en' ? `Values in ${priceUnitSpoken}` : `Valeurs en ${priceUnitSpoken}`,
            body,
        });
    };
    const chartRegionLabel = `${exportChartTitle}. ${getChartSummary()}`;

    return (
        <PageShell id="main-content"
            tabIndex="-1"
            className="page-content page-90 page-chrome page-chrome--bleed"
            role="main"
            aria-labelledby="nuclear-power-plants-uranium-prices-facilities-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.page-90.page-content { max-width: none !important; overflow-x: visible !important; }
.page-90 {
}
.nuclear-power-plants-uranium-prices-container { width: 100%; padding: 15px 0 0 0; box-sizing: border-box; }
.nuclear-power-plants-uranium-prices-facilities-title { text-align: left; }
.nuclear-power-plants-uranium-prices-sector-table {
    width: 100%;
    border-collapse: collapse;
    font-family: Arial, sans-serif;
    font-size: 0.95rem;
    table-layout: fixed;
}
.nuclear-power-plants-uranium-prices-sector-table th,
.nuclear-power-plants-uranium-prices-sector-table td {
    border: 1px solid #ddd;
    padding: 10px 12px;
    text-align: center;
    vertical-align: middle;
}
.nuclear-power-plants-uranium-prices-sector-table thead th {
    background-color: #48484A;
    color: #ffffff;
    font-weight: bold;
}
.nuclear-power-plants-uranium-prices-sector-table tbody tr:nth-child(odd) { background-color: #B8BEAD; }
.nuclear-power-plants-uranium-prices-sector-table tbody tr:nth-child(even) { background-color: #fefefe; }
.nuclear-power-plants-uranium-prices-sector-table tbody tr th[scope="row"] {
    text-align: left;
    font-weight: bold;
    color: inherit;
    background-color: inherit;
}
.nuclear-power-plants-uranium-prices-sector-table tbody tr:hover {
    box-shadow: inset 0 0 0 9999px rgba(0, 0, 0, 0.12);
}
.nuclear-power-plants-uranium-prices-table-wrapper { display: block; width: 100%; margin-top: 0; margin-bottom: 0; }
.nuclear-power-plants-uranium-prices-chart-frame {
    margin-top: 28px;
    margin-bottom: 0;
}
.nuclear-power-plants-uranium-prices-chart-title {
    color: var(--gc-text);
    margin: 0 0 12px 0;
    text-transform: none;
}
.nuclear-power-plants-uranium-prices-chart-title .fn-lnk { color: #26374a; }
.nuclear-power-plants-uranium-prices-chart { width: 100%; min-width: 0; position: relative; z-index: 1; overflow: visible; }
.nuclear-power-plants-uranium-prices-chart > div { width: 100%; height: 100%; overflow: visible; }
.nuclear-power-plants-uranium-prices-legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 14px 24px;
    margin-top: 16px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: var(--gc-text);
}
.nuclear-power-plants-uranium-prices-legend-item { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.nuclear-power-plants-uranium-prices-legend-line { width: 28px; height: 4px; display: inline-block; }
.nuclear-power-plants-uranium-prices-chart-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.nuclear-power-plants-uranium-prices-footnotes {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--gc-text);
    margin-top: 24px;
    margin-bottom: 0;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
    line-height: 1.65;
}
.nuclear-power-plants-uranium-prices-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 1rem;
}
.nuclear-power-plants-uranium-prices-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
.nuclear-power-plants-uranium-prices-footnotes dd p { margin: 0; }
            `}</style>

            <div className="nuclear-power-plants-uranium-prices-container">
                <h1 id="nuclear-power-plants-uranium-prices-facilities-title" className="nuclear-power-plants-uranium-prices-facilities-title page-chrome-title">{facilitiesTitle}</h1>

                <div className="nuclear-power-plants-uranium-prices-table-wrapper table-responsive">
                    <table className="nuclear-power-plants-uranium-prices-sector-table" aria-label={facilitiesCaption}>
                        <caption className="wb-inv">{facilitiesCaption}</caption>
                        <colgroup>
                            <col style={{ width: '28%' }} />
                            <col style={{ width: '22%' }} />
                            <col style={{ width: '32%' }} />
                            <col style={{ width: '18%' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                {facilitiesColumns.map((column) => (
                                    <th key={column.key} scope="col">{column.header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {facilitiesRows.map((row) => (
                                <tr key={row.facility}>
                                    <th scope="row">{row.facility}</th>
                                    <td>{row.province}</td>
                                    <td>{formatMw(row.outputMw)}</td>
                                    <td>{row.units}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="chart-data-table-toolbar">
                        <button type="button" className="download-table-btn" onClick={downloadFacilitiesCsv}>
                            {getText('nuclear_power_plants_uranium_prices_download_csv', lang)}
                        </button>
                        <button type="button" className="download-table-btn" onClick={downloadFacilitiesDocx}>
                            {getText('nuclear_power_plants_uranium_prices_download_docx', lang)}
                        </button>
                    </div>
                </div>

                <div className="nuclear-power-plants-uranium-prices-chart-frame page-chrome-chart-frame">
                    <h2 id="nuclear-power-plants-uranium-prices-chart-title" className="nuclear-power-plants-uranium-prices-chart-title page-chrome-chart-title">
                        {chartTitle}
                        <FootnoteMarker
                            lang={lang}
                            href="#fn-asterisk-nuclear-power-plants-uranium-prices"
                            id="fn-asterisk-rf-nuclear-power-plants-uranium-prices"
                            marker="*"
                            onClick={scrollToElement('fn-asterisk-nuclear-power-plants-uranium-prices')}
                        />
                    </h2>

                    {selectedTraceIds !== null && (
                        <ClearSelectionButton lang={lang} onClick={clearSelection} />
                    )}

                    <figure ref={chartRef} className="nuclear-power-plants-uranium-prices-chart" role="region" aria-label={chartRegionLabel} tabIndex={0} style={{ margin: 0 }}>
                        <div aria-hidden="true">
                            <Plot
                                key={`nuclear-power-plants-uranium-prices-${selectedTraceIds ? selectedTraceIds.join('-') : 'all'}-${plotHeight}`}
                                data={plotData}
                                layout={plotLayout}
                                config={plotConfig}
                                style={{ width: '100%', height: '100%' }}
                                useResizeHandler
                                onClick={handleChartClick}
                            />
                        </div>
                    </figure>

                    <div className="nuclear-power-plants-uranium-prices-legend" aria-hidden="true">
                        <span className="nuclear-power-plants-uranium-prices-legend-item">
                            <span className="nuclear-power-plants-uranium-prices-legend-line" style={{ backgroundColor: CHART_COLORS.spot }} />
                            {spotLabel}
                        </span>
                        <span className="nuclear-power-plants-uranium-prices-legend-item">
                            <span className="nuclear-power-plants-uranium-prices-legend-line" style={{ backgroundColor: CHART_COLORS.foreign }} />
                            {foreignLabel}
                        </span>
                    </div>

                    <div className="nuclear-power-plants-uranium-prices-chart-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            label={chartTableSummary}
                            columns={chartTableColumns}
                            rows={URANIUM_PRICE_DATA}
                            csvFilename={`${chartFileSlug}.csv`}
                            docx={{
                                filename: `${chartFileSlug}.docx`,
                                title: chartDocxTitle,
                                titleAlign: 'center',
                                columnWidths: [1200, 3600, 3600],
                                fontSize: 22,
                            }}
                            caption={chartTableCaption}
                            tableAriaLabel={chartTableCaption}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatPrice(raw)
                            )}
                        />
                    </div>
                </div>

                <PageFootnotes
                    lang={lang}
                    className="nuclear-power-plants-uranium-prices-footnotes"
                    items={[
                        { id: 'fn-asterisk-nuclear-power-plants-uranium-prices', marker: '*', text: getText('nuclear_power_plants_uranium_prices_footnote', lang), returnHref: '#fn-asterisk-rf-nuclear-power-plants-uranium-prices' },
                    ]}
                />
            </div>
        </PageShell>
    );
};

export default NuclearPowerPlantsUraniumPrices;
