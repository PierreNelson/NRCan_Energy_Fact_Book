import React, { useEffect, useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
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

const corporate_income_taxes_YEARS = [2011, 2013, 2015, 2017, 2019, 2021, 2023];
const corporate_income_taxes_CATEGORIES = ['oil_gas', 'petroleum_coal', 'utilities', 'pipelines'];

const corporate_income_taxes_HARDCODED = [
    { year: 2011, oil_gas: 2.5, petroleum_coal: 1.0, utilities: 0.1, pipelines: 0.2 },
    { year: 2013, oil_gas: 2.0, petroleum_coal: 1.2, utilities: 0.1, pipelines: 0.2 },
    { year: 2015, oil_gas: 2.7, petroleum_coal: 2.0, utilities: 0.2, pipelines: 0.3 },
    { year: 2017, oil_gas: 1.0, petroleum_coal: 1.0, utilities: 0.1, pipelines: 0.2 },
    { year: 2019, oil_gas: 1.5, petroleum_coal: 1.0, utilities: 0.2, pipelines: 0.6 },
    { year: 2021, oil_gas: 2.6, petroleum_coal: 1.5, utilities: 0.1, pipelines: 0.3 },
    { year: 2023, oil_gas: 5.3, petroleum_coal: 6.2, utilities: 0.3, pipelines: 0.5 }
];

const corporate_income_taxes_COLORS = {
    oil_gas: '#86754f',
    petroleum_coal: '#2C9EAA',
    utilities: '#005c97',
    pipelines: '#4AA56F'
};

const formatEnergyRevenueNumber = (num, lang) => {
    if (num === undefined || num === null) return '—';
    return Number(num).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
};

const CorporateIncomeTaxes = () => {
    const { lang } = useOutletContext();
    const windowWidth = useWindowWidth();
    const {
        selected: selectedPoints,
        clear: clearSelection,
        onPlotClick: handleChartClick,
    } = usePlotlySelection({
        mode: 'points',
        traceCount: corporate_income_taxes_CATEGORIES.length,
        windowWidth,
    });
    const chartRef = useRef(null);

    const chartTitle = getText('corporate_income_taxes_title', lang);
    const exportChartTitle = stripHtml(chartTitle);
    const yAxisTitle = getText('corporate_income_taxes_yaxis', lang);
    const chartDownloadSlug = lang === 'en'
        ? 'corporate_income_taxes_energy'
        : 'impots_revenu_industries_energetiques';

    const legendLabels = useMemo(
        () => Object.fromEntries(
            corporate_income_taxes_CATEGORIES.map((key) => [
                key,
                getText(`corporate_income_taxes_legend_${key}`, lang),
            ]),
        ),
        [lang],
    );

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('petroleum_employment_table_col_year', lang), align: 'left' },
        ...corporate_income_taxes_CATEGORIES.map((key) => ({
            key,
            header: `${legendLabels[key]} (${yAxisTitle})`,
            align: 'num',
        })),
        { key: 'total', header: `${lang === 'en' ? 'Total' : 'Total'} (${yAxisTitle})`, align: 'num' },
    ], [lang, legendLabels, yAxisTitle]);

    const tableRows = useMemo(
        () => corporate_income_taxes_HARDCODED.map((row) => ({
            ...row,
            total: corporate_income_taxes_CATEGORIES.reduce((sum, key) => sum + row[key], 0),
        })),
        [],
    );

    const getChartSummary = () => {
        const body = summarizeByCategory({
            categories: corporate_income_taxes_YEARS,
            series: corporate_income_taxes_CATEGORIES.map((key) => ({
                name: legendLabels[key],
                values: corporate_income_taxes_HARDCODED.map((row) => row[key]),
                format: (v) => formatEnergyRevenueNumber(v, lang),
            })),
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? 'Stacked bar chart of corporate income taxes paid by energy industries from 2011 to 2023'
                : 'Graphique à barres empilées des impôts sur le revenu des sociétés des industries énergétiques de 2011 à 2023',
            unitNote: lang === 'en' ? 'Values in billions of dollars' : 'Valeurs en milliards de dollars',
            body,
        });
    };

    const chartRegionLabel = `${exportChartTitle}. ${getChartSummary()}`;

    useEffect(() => {
        if (!chartRef?.current) return;
        const plotContainer = chartRef.current;
        const svgElements = plotContainer.querySelectorAll('.main-svg, .svg-container svg');
        svgElements.forEach(svg => svg.setAttribute('aria-hidden', 'true'));
        const modebarButtons = plotContainer.querySelectorAll('.modebar-btn');
        modebarButtons.forEach(btn => {
            const dataTitle = btn.getAttribute('data-title');
            if (dataTitle && (dataTitle.includes('Download') || dataTitle.includes('Télécharger'))) {
                btn.setAttribute('aria-label', dataTitle);
                btn.setAttribute('role', 'button');
                btn.setAttribute('tabindex', '0');
                btn.removeAttribute('aria-hidden');
            } else {
                btn.setAttribute('aria-hidden', 'true');
                btn.setAttribute('tabindex', '-1');
            }
        });
    }, [lang]);

    const chartTraces = useMemo(() => {
        return corporate_income_taxes_CATEGORIES.map((key, traceIndex) => {
            const label = legendLabels[key];
            const yArr = corporate_income_taxes_HARDCODED.map(row => row[key]);
            const hovertext = corporate_income_taxes_HARDCODED.map((row) => {
                const val = row[key];
                const total = corporate_income_taxes_CATEGORIES.reduce((s, k) => s + row[k], 0);
                return `<b>${row.year}</b><br>${label}: ${formatEnergyRevenueNumber(val, lang)} ${lang === 'en' ? '$ billion' : 'milliards de dollars'}<br>${lang === 'en' ? 'Total' : 'Total'}: ${formatEnergyRevenueNumber(total, lang)}`;
            });
            const baseColor = corporate_income_taxes_COLORS[key];
            const markerColor = selectedPoints === null
                ? baseColor
                : yArr.map((_, pointIndex) => {
                    const isSelected = selectedPoints[traceIndex]?.includes(pointIndex);
                    return isSelected ? baseColor : hexToRgba(baseColor, 0.3);
                });
            return {
                type: 'bar',
                orientation: 'v',
                name: label,
                x: corporate_income_taxes_YEARS,
                y: yArr,
                marker: { color: markerColor },
                hovertext,
                hoverinfo: 'text',
                textinfo: 'none'
            };
        });
    }, [lang, legendLabels, selectedPoints]);

    const plotLayout = useMemo(() => ({
        barmode: 'stack',
        showlegend: false,
        clickmode: 'event',
        hovermode: 'closest',
        hoverlabel: {
            bgcolor: '#ffffff',
            font: { color: '#000000', size: 14, family: 'Arial, sans-serif' }
        },
        xaxis: {
            tickvals: corporate_income_taxes_YEARS,
            tickfont: { size: windowWidth <= 480 ? 12 : 16, family: 'Arial, sans-serif' },
            showgrid: false,
            zeroline: false,
            automargin: true
        },
        yaxis: {
            title: { text: yAxisTitle, font: { size: windowWidth <= 480 ? 14 : 18, family: 'Arial, sans-serif' }, standoff: 15 },
            range: [0, 14],
            dtick: 2,
            showgrid: false,
            zeroline: true,
            tickfont: { size: windowWidth <= 480 ? 12 : 16, family: 'Arial, sans-serif' },
            automargin: true
        },
        margin: { l: 80, r: 20, t: 20, b: 60 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        autosize: true
    }), [windowWidth, yAxisTitle]);

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${chartDownloadSlug}.png`,
        title: exportChartTitle,
        height: 500,
        legendItems: corporate_income_taxes_CATEGORIES.map((key) => ({
            label: legendLabels[key],
            color: corporate_income_taxes_COLORS[key],
        })),
    }),
        [chartDownloadSlug, corporate_income_taxes_CATEGORIES, corporate_income_taxes_COLORS, exportChartTitle, legendLabels],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    return (
        <PageShell
            tabIndex="-1"
            className="page-content corporate-income-taxes"
            aria-labelledby="corporate-income-taxes-chart-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.corporate-income-taxes { width: 100%; }
.corporate-income-taxes-container { width: 100%; padding: 15px 0 0 0; display: flex; flex-direction: column; box-sizing: border-box; flex: 1; overflow: visible; }
.corporate-income-taxes-chart-title { font-family: 'Lato', sans-serif; font-size: 29px; font-weight: bold; color: var(--gc-text, #332f30); text-align: center; margin: 0 0 10px 0; }
.corporate-income-taxes-chart-frame { background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-sizing: border-box; overflow: visible; }
.corporate-income-taxes-chart { width: 100%; height: 420px; position: relative; z-index: 1; }
.corporate-income-taxes-chart button[type="button"]:hover,
.corporate-income-taxes-chart button:hover { background-color: #404040 !important; }
.corporate-income-taxes-legend { position: relative; z-index: 10; background-color: #f5f5f5; padding: 10px 0; }
.corporate-income-taxes-legend-color { width: 20px; height: 12px; display: inline-block; }
.corporate-income-taxes-legend-label { font-size: 18px; color: #333333; }
.corporate-income-taxes-table-wrapper { display: block; width: 100%; margin: 20px 0 0 0; }
.corporate-income-taxes-table-wrapper details > summary { display: block; width: 100%; padding: 12px 15px; background-color: #8C8C8C; border: 1px solid #404040; border-radius: 4px; cursor: pointer; font-family: Arial, sans-serif; font-weight: bold; color: #ffffff; list-style: none; }
.corporate-income-taxes-table-wrapper details > summary::-webkit-details-marker { display: none; }
.corporate-income-taxes-table-wrapper details > summary:hover { background-color: #404040 !important; }
.corporate-income-taxes-table-wrapper button[type="button"]:hover,
.corporate-income-taxes-table-wrapper button:hover { background-color: #404040 !important; }
.corporate-income-taxes-table-wrapper .table-responsive { display: block; width: 100%; overflow-x: auto; border: 1px solid #ddd; background: #fff; }
.corporate-income-taxes-table-wrapper .table-responsive table { width: max-content; min-width: 100%; border-collapse: collapse; }
@media (max-width: 768px) {
.corporate-income-taxes-chart-title { font-size: 26px; }
.corporate-income-taxes-legend-label { font-size: 14px; }
}
            `}</style>
            <div className="corporate-income-taxes-container">
                <div className="corporate-income-taxes-chart-frame">
                    <h2 id="corporate-income-taxes-chart-title" className="corporate-income-taxes-chart-title">{chartTitle}</h2>
                    <div role="region" aria-label={chartRegionLabel} tabIndex={0}>
                        {selectedPoints !== null && selectedPoints.length > 0 && (
                                <ClearSelectionButton lang={lang} onClick={clearSelection} />
                            )}
                        <figure ref={chartRef} className="corporate-income-taxes-chart" style={{ margin: 0, position: 'relative' }}>
                            <Plot
                                data={chartTraces}
                                layout={plotLayout}
                                config={plotConfig}
                                style={{ width: '100%', height: '100%' }}
                                useResizeHandler={true}
                                onClick={handleChartClick}
                            />
                        </figure>
                    </div>
                    <HtmlLegend
                        className="corporate-income-taxes-legend"
                        variant="swatch"
                        itemClassName="corporate-income-taxes-legend-item"
                        markerClassName="corporate-income-taxes-legend-color"
                        labelClassName="corporate-income-taxes-legend-label"
                        items={corporate_income_taxes_CATEGORIES.map((key) => ({
                            label: legendLabels[key],
                            color: corporate_income_taxes_COLORS[key],
                        }))}
                    />
                    <div className="corporate-income-taxes-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={`${chartDownloadSlug}.csv`}
                            docx={{
                                filename: `${chartDownloadSlug}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [1200, 2200, 2200, 1400, 1400, 1200],
                                fontSize: 20,
                            }}
                            caption={exportChartTitle}
                            tableAriaLabel={exportChartTitle}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatEnergyRevenueNumber(raw, lang)
                            )}
                        />
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default CorporateIncomeTaxes;
