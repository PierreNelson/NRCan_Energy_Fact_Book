import React, { useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import FootnoteMarker from '../components/FootnoteMarker';
import ClearSelectionButton from '../components/ClearSelectionButton';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import PageFootnotes from '../components/PageFootnotes';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import hexToRgba from '../utils/hexToRgba';

import { makeScrollToIdHandler } from '../utils/scrollToId';
import { formatLocaleNumber } from '../utils/formatLocale';

const primary_energy_production_COLORS = {
    natural_gas: '#14333E',
    hydro: '#245e7f',
    coal: '#7A7A7A',
    other_renewables: '#339CC1',
    ngls: '#9A9389',
    crude_oil: '#9b8a42',
    uranium: '#1C6B7E',
    nuclear: '#1C6B7E',
};

const PRIMARY_ENERGY_PRODUCTION_ALL_KEYS = [
    'crude_oil',
    'natural_gas',
    'uranium',
    'hydro',
    'coal',
    'ngls',
    'other_renewables',
    'nuclear',
];

const getPrimaryEnergyProductionLabelKey = (key) => {
    const keyMap = {
        natural_gas: 'primary_energy_production_natural_gas',
        hydro: 'primary_energy_production_hydro',
        coal: 'primary_energy_production_coal',
        other_renewables: 'primary_energy_production_other_renewables',
        ngls: 'primary_energy_production_ngls',
        crude_oil: 'primary_energy_production_crude_oil',
        uranium: 'primary_energy_production_uranium',
        nuclear: 'primary_energy_production_nuclear',
    };
    return keyMap[key] || key;
};

const getPrimaryEnergyProductionDisplayLabel = (key, lang) => {
    const label = getText(getPrimaryEnergyProductionLabelKey(key), lang);
    return key === 'other_renewables' ? `${label}*` : label;
};

const formatPrimaryEnergyProductionNumber = (num, lang) =>
    formatLocaleNumber(num, lang, { maximumFractionDigits: 0 });

const primary_energy_production_DATA_INCLUDING_URANIUM = {
    total: 29341,
    sources: [
        { key: 'crude_oil', value: 38 },
        { key: 'natural_gas', value: 26 },
        { key: 'uranium', value: 21 },
        { key: 'hydro', value: 4 },
        { key: 'coal', value: 4 },
        { key: 'ngls', value: 3 },
        { key: 'other_renewables', value: 2 },
    ],
};

const primary_energy_production_DATA_EXCLUDING_URANIUM = {
    total: 23448,
    sources: [
        { key: 'crude_oil', value: 48 },
        { key: 'natural_gas', value: 33 },
        { key: 'hydro', value: 6 },
        { key: 'coal', value: 5 },
        { key: 'ngls', value: 4 },
        { key: 'other_renewables', value: 3 },
        { key: 'nuclear', value: 1 },
    ],
};

const createPrimaryEnergyProductionChartData = (data, selectedSlices, lang, windowWidth) => {
    const labels = data.sources.map((s) => getPrimaryEnergyProductionDisplayLabel(s.key, lang).toUpperCase());
    const values = data.sources.map((s) => s.value);
    const baseColors = data.sources.map((s) => primary_energy_production_COLORS[s.key]);

    const colors = selectedSlices === null
        ? baseColors
        : baseColors.map((color, i) => (selectedSlices.includes(i) ? color : hexToRgba(color, 0.3)));

    const textColors = selectedSlices === null
        ? baseColors
        : baseColors.map((color, i) => (selectedSlices.includes(i) ? color : hexToRgba(color, 0.3)));

    const hoverTexts = data.sources.map((s) => {
        const label = getPrimaryEnergyProductionDisplayLabel(s.key, lang);
        const pjValue = Math.round(data.total * s.value / 100);
        return `<b>${label}</b><br>${formatPrimaryEnergyProductionNumber(pjValue, lang)} PJ<br>${s.value}%`;
    });

    const pullValues = selectedSlices === null
        ? data.sources.map(() => 0.02)
        : data.sources.map((_, i) => (selectedSlices.includes(i) ? 0.08 : 0.02));

    const useCompactLayout = windowWidth <= 768;

    return [{
        type: 'pie',
        values,
        labels,
        texttemplate: useCompactLayout ? '%{percent:.0%}' : '%{label}<br><b>%{percent:.0%}</b>',
        textinfo: useCompactLayout ? 'percent' : 'label+percent',
        textposition: useCompactLayout ? 'inside' : 'outside',
        textfont: {
            size: windowWidth <= 480 ? 11 : windowWidth <= 768 ? 12 : windowWidth <= 1280 ? 15 : 18,
            family: 'Arial, sans-serif',
            color: useCompactLayout ? '#ffffff' : textColors,
        },
        outsidetextfont: {
            color: textColors,
            size: windowWidth <= 480 ? 11 : windowWidth <= 768 ? 12 : windowWidth <= 1280 ? 15 : 18,
            family: 'Arial, sans-serif',
        },
        insidetextfont: {
            color: '#ffffff',
            size: windowWidth <= 480 ? 10 : 12,
            family: 'Arial, sans-serif',
        },
        hovertext: hoverTexts,
        hoverinfo: 'text',
        hoverlabel: {
            bgcolor: '#ffffff',
            font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
        },
        marker: {
            colors,
            line: { color: '#ffffff', width: 2 },
        },
        hole: 0.55,
        direction: 'clockwise',
        rotation: 90,
        sort: false,
        pull: pullValues,
    }];
};

const PrimaryEnergyProduction = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const {
        selected: selectedSlices1,
        clear: clearSelection1,
        onPlotClick: onPieClick1,
        hasSelection: hasSelection1,
    } = usePlotlySelection({ mode: 'slices', windowWidth });
    const {
        selected: selectedSlices2,
        clear: clearSelection2,
        onPlotClick: onPieClick2,
        hasSelection: hasSelection2,
    } = usePlotlySelection({ mode: 'slices', windowWidth });
    const chartRef1 = useRef(null);
    const chartRef2 = useRef(null);

    const formatNumber = (num) => formatLocaleNumber(num, lang, { maximumFractionDigits: 0 });

    const pageTitle = getText('primary_energy_production_title', lang);
    const exportPageTitle = stripHtml(pageTitle);
    const chart1Title = getText('primary_energy_production_chart1_title', lang);
    const chart2Title = getText('primary_energy_production_chart2_title', lang);
    const exportChart1Title = stripHtml(chart1Title);
    const exportChart2Title = stripHtml(chart2Title);
    const downloadSlug = lang === 'en' ? 'primary_energy_production' : 'production_energie_primaire';

    const scrollToFootnote = makeScrollToIdHandler('fn-asterisk-primary-energy-production');

    

    const chart1Data = useMemo(
        () => createPrimaryEnergyProductionChartData(
            primary_energy_production_DATA_INCLUDING_URANIUM,
            selectedSlices1,
            lang,
            windowWidth,
        ),
        [lang, windowWidth, selectedSlices1],
    );
    const chart2Data = useMemo(
        () => createPrimaryEnergyProductionChartData(
            primary_energy_production_DATA_EXCLUDING_URANIUM,
            selectedSlices2,
            lang,
            windowWidth,
        ),
        [lang, windowWidth, selectedSlices2],
    );

    const getChartSummary = (data, title) => {
        const sources = data.sources
            .map((s) => `${getPrimaryEnergyProductionDisplayLabel(s.key, lang)}: ${s.value}%`)
            .join(', ');
        return `${stripHtml(title)}. Total: ${formatNumber(data.total)} PJ. ${sources}`;
    };

    const tableColumns = useMemo(() => [
        { key: 'source', header: lang === 'en' ? 'Source' : 'Source', align: 'left' },
        {
            key: 'including',
            header: lang === 'en' ? 'Including Uranium (%)' : "Incluant l'uranium (%)",
            align: 'num',
        },
        {
            key: 'excluding',
            header: lang === 'en' ? 'Excluding Uranium (%)' : "Excluant l'uranium (%)",
            align: 'num',
        },
    ], [lang]);

    const tableRows = useMemo(() => {
        const sourceRows = PRIMARY_ENERGY_PRODUCTION_ALL_KEYS.map((key) => ({
            source: getPrimaryEnergyProductionDisplayLabel(key, lang),
            including: primary_energy_production_DATA_INCLUDING_URANIUM.sources.find((s) => s.key === key)?.value ?? null,
            excluding: primary_energy_production_DATA_EXCLUDING_URANIUM.sources.find((s) => s.key === key)?.value ?? null,
            isTotal: false,
        }));
        return [
            ...sourceRows,
            {
                source: 'Total (PJ)',
                including: primary_energy_production_DATA_INCLUDING_URANIUM.total,
                excluding: primary_energy_production_DATA_EXCLUDING_URANIUM.total,
                isTotal: true,
            },
        ];
    }, [lang]);

    const tableCaption = lang === 'en'
        ? 'Primary energy production by source, comparing methods including and excluding uranium.'
        : "Production d'énergie primaire par source, comparant les méthodes incluant et excluant l'uranium.";

    const useCompactLayout = windowWidth <= 768;

    const createChartLayout = (data) => ({
        autosize: true,
        showlegend: useCompactLayout,
        legend: useCompactLayout ? {
            orientation: 'h',
            y: -0.15,
            x: 0.5,
            xanchor: 'center',
            yanchor: 'top',
            font: { size: windowWidth <= 480 ? 10 : 12 },
            itemclick: false,
            itemdoubleclick: false,
        } : undefined,
        margin: useCompactLayout
            ? { t: 20, r: 20, b: 100, l: 20 }
            : {
                t: 70,
                r: windowWidth <= 480 ? 40 : windowWidth <= 768 ? 80 : 120,
                b: 70,
                l: windowWidth <= 480 ? 40 : windowWidth <= 768 ? 80 : 120,
            },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        clickmode: 'event',
        dragmode: false,
        annotations: [
            {
                text: `<b>${getText('primary_energy_production_total', lang)}</b>`,
                x: 0.5,
                y: 0.57,
                font: { size: windowWidth <= 480 ? 14 : 16, family: 'Lato, sans-serif', color: '#333' },
                showarrow: false,
                xanchor: 'center',
                yanchor: 'middle',
            },
            {
                text: `<b>${formatNumber(data.total)}</b>`,
                x: 0.5,
                y: 0.48,
                font: { size: windowWidth <= 480 ? 24 : 32, family: 'Lato, sans-serif', color: '#333' },
                showarrow: false,
                xanchor: 'center',
                yanchor: 'middle',
            },
            {
                text: getText('primary_energy_production_pj', lang),
                x: 0.5,
                y: 0.40,
                font: { size: windowWidth <= 480 ? 14 : 16, family: 'Lato, sans-serif', color: '#333' },
                showarrow: false,
                xanchor: 'center',
                yanchor: 'middle',
            },
        ],
    });

    const downloadChart1WithTitle = useChartPngDownloader(
        chartRef1,
        () => ({
        filename: `${downloadSlug}.png`,
        title: exportChart1Title,
        width: 800,
        height: 600,
        legendItems: primary_energy_production_DATA_INCLUDING_URANIUM.sources.map((item) => ({
            label: `${getPrimaryEnergyProductionDisplayLabel(item.key, lang)} ${item.value}%`,
            color: primary_energy_production_COLORS[item.key],
        })),
    }),
        [downloadSlug, exportChart1Title, getPrimaryEnergyProductionDisplayLabel, lang, primary_energy_production_COLORS, primary_energy_production_DATA_INCLUDING_URANIUM],
    );

    const downloadChart2WithTitle = useChartPngDownloader(
        chartRef2,
        () => ({
        filename: `${downloadSlug}.png`,
        title: exportChart2Title,
        width: 800,
        height: 600,
        legendItems: primary_energy_production_DATA_EXCLUDING_URANIUM.sources.map((item) => ({
            label: `${getPrimaryEnergyProductionDisplayLabel(item.key, lang)} ${item.value}%`,
            color: primary_energy_production_COLORS[item.key],
        })),
    }),
        [downloadSlug, exportChart2Title, getPrimaryEnergyProductionDisplayLabel, lang, primary_energy_production_COLORS, primary_energy_production_DATA_EXCLUDING_URANIUM],
    );

    const chart1Config = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChart1WithTitle(gd),
    });

    const chart2Config = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChart2WithTitle(gd),
    });

    return (
        <PageShell
            id="main-content"
            className="page-content page-4 primary-energy-production page-chrome page-chrome--bleed"
            aria-labelledby="primary-energy-production-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
                .primary-energy-production-container {
                    width: 100%;
                    padding: 15px 0 0 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    flex: 1;
                    overflow: visible;
                }

                .primary-energy-production-charts-row {
                    display: block;
                    width: 100%;
                }

                .primary-energy-production-chart-column {
                    width: 100%;
                    max-width: 100%;
                    margin: 0 auto 60px auto;
                    display: block;
                    text-align: center;
                }

                .primary-energy-production-chart-column:last-child {
                    margin-bottom: 0;
                }

                .primary-energy-production-chart-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 20px;
                    font-weight: bold;
                    color: var(--gc-text);
                    text-align: center;
                    margin: 0 0 10px 0;
                    width: 100%;
                }

                .primary-energy-production-chart-wrapper {
                    position: relative;
                    width: 100%;
                    height: 450px;
                }

                .primary-energy-production-chart-wrapper figure {
                    width: 100%;
                    height: 100%;
                    margin: 0;
                    position: relative;
                }

                .primary-energy-production-chart-wrapper .js-plotly-plot {
                    width: 100% !important;
                    margin: 0 auto;
                }

                .primary-energy-production-table-wrapper {
                    display: block;
                    width: 100%;
                    margin: 20px 0 0 0;
                }

                @media (max-width: 768px) {
                    .primary-energy-production-chart-title {
                        font-size: 16px;
                    }
                    .primary-energy-production-chart-wrapper {
                        height: 420px;
                    }
                }

                @media (max-width: 480px) {
                    .primary-energy-production-chart-wrapper {
                        height: 400px;
                    }
                }
            `}</style>

            <div className="primary-energy-production-container">
                <h1 id="primary-energy-production-title" className="primary-energy-production-title page-chrome-title">
                    {pageTitle}
                </h1>

                <div className="primary-energy-production-chart-frame page-chrome-chart-frame">
                    <div className="primary-energy-production-charts-row">
                        <div className="primary-energy-production-chart-column">
                            <h2 className="primary-energy-production-chart-title">
                                {chart1Title}
                                <FootnoteMarker
                            lang={lang}
                            href="#fn-asterisk-primary-energy-production"
                            id="fn-asterisk-rf-primary-energy-production"
                            marker="*"
                            onClick={scrollToFootnote}
                        />
                            </h2>
                            <div
                                role="region"
                                aria-label={getChartSummary(primary_energy_production_DATA_INCLUDING_URANIUM, chart1Title)}
                                tabIndex="0"
                            >
                                <div className="primary-energy-production-chart-wrapper">
                                    {hasSelection1 && <ClearSelectionButton lang={lang} onClick={clearSelection1} />}
                                    <figure ref={chartRef1} style={{ margin: 0, width: '100%', height: '100%', position: 'relative' }}>
                                        <div aria-hidden="true" style={{ width: '100%', height: '100%' }}>
                                            <Plot
                                                key={`pie1-${selectedSlices1 ? selectedSlices1.join('-') : 'none'}`}
                                                data={chart1Data}
                                                layout={createChartLayout(primary_energy_production_DATA_INCLUDING_URANIUM)}
                                                config={chart1Config}
                                                style={{ width: '100%', height: '100%' }}
                                                useResizeHandler
                                                onClick={onPieClick1}
                                            />
                                        </div>
                                    </figure>
                                </div>
                            </div>
                        </div>

                        <div className="primary-energy-production-chart-column">
                            <h2 className="primary-energy-production-chart-title">
                                {chart2Title}
                            </h2>
                            <div
                                role="region"
                                aria-label={getChartSummary(primary_energy_production_DATA_EXCLUDING_URANIUM, chart2Title)}
                                tabIndex="0"
                            >
                                <div className="primary-energy-production-chart-wrapper">
                                    {hasSelection2 && <ClearSelectionButton lang={lang} onClick={clearSelection2} />}
                                    <figure ref={chartRef2} style={{ margin: 0, width: '100%', height: '100%', position: 'relative' }}>
                                        <div aria-hidden="true" style={{ width: '100%', height: '100%' }}>
                                            <Plot
                                                key={`pie2-${selectedSlices2 ? selectedSlices2.join('-') : 'none'}`}
                                                data={chart2Data}
                                                layout={createChartLayout(primary_energy_production_DATA_EXCLUDING_URANIUM)}
                                                config={chart2Config}
                                                style={{ width: '100%', height: '100%' }}
                                                useResizeHandler
                                                onClick={onPieClick2}
                                            />
                                        </div>
                                    </figure>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="primary-energy-production-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={`${downloadSlug}.csv`}
                            docx={{
                                filename: `${downloadSlug}.docx`,
                                title: exportPageTitle,
                                titleAlign: 'center',
                                columnWidths: [4000, 2500, 2500],
                                fontSize: 22,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                            renderCell={(raw, { row, colIndex }) => {
                                if (colIndex === 0) return String(raw ?? '');
                                if (row?.isTotal) return formatNumber(raw);
                                return raw != null ? `${raw}%` : '-';
                            }}
                        />
                    </div>
                </div>

                <PageFootnotes
                    lang={lang}
                    titleId="fn-primary-energy-production"
                    items={[{
                        id: 'fn-asterisk-primary-energy-production',
                        marker: '*',
                        text: getText('primary_energy_production_footnote', lang),
                        returnHref: '#fn-asterisk-rf-primary-energy-production',
                    }]}
                />
            </div>
        </PageShell>
    );
};

export default PrimaryEnergyProduction;
