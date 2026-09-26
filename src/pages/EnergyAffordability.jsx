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
import hexToRgba from '../utils/hexToRgba';

const energy_affordability_REGIONS = ['Can', 'NL', 'PEI', 'NS', 'NB', 'Que', 'Ont', 'Man', 'Sask', 'Alta', 'BC', 'YT', 'NWT', 'Nvt'];

const energy_affordability_DATA = {
    Can: 5.6,
    NL: 13.7,
    PEI: 11.4,
    NS: 12.5,
    NB: 10.7,
    Que: 4.2,
    Ont: 4.8,
    Man: 5.6,
    Sask: 6.9,
    Alta: 7.3,
    BC: 4.9,
    YT: 11.1,
    NWT: 9.5,
    Nvt: 3.7
};

const BAR_COLOR = '#9f346d';

const formatHouseholdEnergyNumber = (num, lang) => {
    if (num === undefined || num === null) return '—';
    return Number(num).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
};

const EnergyAffordability = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const {
        selected: selectedPoints,
        clear,
        onPlotClick,
        isSelected,
    } = usePlotlySelection({ mode: 'points', traceCount: 1, windowWidth });
    const chartRef = useRef(null);

    const chartTitle = getText('energy_affordability_chart_title', lang);
    const exportChartTitle = stripHtml(chartTitle);
    const chartDownloadSlug = lang === 'en' ? 'energy_poverty_rates' : 'taux_pauvrete_energetique';
    const pageTitle = getText('energy_affordability_title', lang);
    const exportPageTitle = stripHtml(pageTitle);

    const regionLabels = useMemo(() => energy_affordability_REGIONS.map(r => getText('energy_affordability_region_' + r, lang)), [lang]);
    const barValues = useMemo(() => energy_affordability_REGIONS.map(r => energy_affordability_DATA[r]), []);

    const tableColumns = useMemo(() => [
        { key: 'geo', header: getText('energy_affordability_table_geo', lang), align: 'left' },
        { key: 'pct', header: getText('energy_affordability_table_pct', lang), align: 'num' },
    ], [lang]);

    const tableRows = useMemo(() => energy_affordability_REGIONS.map((r) => ({
        geo: getText('energy_affordability_region_' + r + '_full', lang),
        pct: energy_affordability_DATA[r],
    })), [lang]);

    const barTrace = useMemo(() => {
        const hovertext = energy_affordability_REGIONS.map((r, i) => {
            const full = getText('energy_affordability_region_' + r + '_full', lang);
            const pct = barValues[i];
            return `<b>${full}</b><br>${chartTitle}: ${formatHouseholdEnergyNumber(pct, lang)}%`;
        });
        const markerColor = selectedPoints === null
            ? BAR_COLOR
            : energy_affordability_REGIONS.map((_, i) => isSelected(0, i) ? BAR_COLOR : hexToRgba(BAR_COLOR, 0.3));
        return {
            type: 'bar',
            orientation: 'h',
            x: barValues,
            y: regionLabels,
            marker: { color: markerColor },
            hovertext,
            hoverinfo: 'text',
            hoverlabel: {
                bgcolor: '#ffffff',
                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' }
            },
            text: barValues.map(v => (lang === 'en' ? v + '%' : v.toLocaleString('fr-CA', { minimumFractionDigits: 1 }) + ' %')),
            textposition: 'outside',
            textfont: { size: windowWidth <= 480 ? 11 : 14, family: 'Arial, sans-serif' },
            insidetextfont: { size: 12, family: 'Arial, sans-serif' }
        };
    }, [lang, barValues, regionLabels, windowWidth, selectedPoints, chartTitle, isSelected]);

    const plotLayout = useMemo(() => ({
        barmode: 'overlay',
        showlegend: false,
        hovermode: 'closest',
        clickmode: 'event',
        dragmode: false,
        xaxis: {
            title: { text: getText('energy_affordability_table_pct', lang), font: { size: windowWidth <= 480 ? 14 : 18, family: 'Arial, sans-serif' }, standoff: 15 },
            range: [0, 15],
            tick0: 0,
            dtick: 1,
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
        margin: { l: 80, r: 60, t: 20, b: 80 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        autosize: true
    }), [lang, windowWidth]);

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${chartDownloadSlug}.png`,
        title: exportChartTitle,
        width: 1000,
        height: 520,
    }),
        [chartDownloadSlug, exportChartTitle],
    );

    const config = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const getChartSummary = () => {
        const parts = energy_affordability_REGIONS.map((r, i) => `${getText('energy_affordability_region_' + r + '_full', lang)}: ${formatHouseholdEnergyNumber(barValues[i], lang)}%`).join(', ');
        return `${exportChartTitle}. ${parts}.`;
    };

    

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-43 page-chrome page-chrome--bleed"
            aria-labelledby="energy-affordability-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.page-43 { width: 100%; }
.energy-affordability-container { width: 100%; padding: 15px 0 0 0; display: flex; flex-direction: column; box-sizing: border-box; flex: 1; overflow: visible; }
.energy-affordability-title {
    font-size: 50px;
    color: #a0346e;
    margin: 0 0 10px 0;
}
.energy-affordability-intro {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 20px;
}
.energy-affordability-chart-title {
    color: var(--gc-text);
    margin: 0 0 15px 0;
}
.energy-affordability-chart { width: 100%; height: 480px; }
.energy-affordability-table-wrapper { display: block; width: 100%; margin: 20px 0 0 0; }
.energy-affordability-footer p {
    margin: 0 0 1rem 0;
    font-family: var(--font-body);
    font-size: 1rem;
    line-height: 1.65;
    color: var(--gc-text);
}
.energy-affordability-footer p:last-child { margin-bottom: 0; }
@media (max-width: 768px) {
    .energy-affordability-title { font-size: 37px; margin-bottom: 10px; }
    .energy-affordability-intro { font-size: 18px; }
    .energy-affordability-chart { height: 420px; }
}
            `}</style>
            <div className="energy-affordability-container">
                <header role="region" aria-label={exportPageTitle}>
                    <h1 id="energy-affordability-title" className="energy-affordability-title page-chrome-title">{pageTitle}</h1>
                </header>
                <p className="energy-affordability-intro" role="region" aria-label={stripHtml(getText('energy_affordability_para1_part1', lang) + getText('energy_affordability_para1_part2', lang) + getText('energy_affordability_para1_part3', lang))}>
                    {getText('energy_affordability_para1_part1', lang)}<strong>{getText('energy_affordability_para1_part2', lang)}</strong>{getText('energy_affordability_para1_part3', lang)}
                </p>
                <p className="energy-affordability-intro" role="region" aria-label={stripHtml(getText('energy_affordability_para2_part1', lang) + getText('energy_affordability_para2_part2', lang) + getText('energy_affordability_para2_part3', lang))}>
                    {getText('energy_affordability_para2_part1', lang)}<strong>{getText('energy_affordability_para2_part2', lang)}</strong>{getText('energy_affordability_para2_part3', lang)}
                </p>
                <p className="energy-affordability-intro" role="region" aria-label={stripHtml(getText('energy_affordability_para3_part1', lang) + getText('energy_affordability_para3_part2', lang) + getText('energy_affordability_para3_part3', lang))}>
                    {getText('energy_affordability_para3_part1', lang)}<strong>{getText('energy_affordability_para3_part2', lang)}</strong>{getText('energy_affordability_para3_part3', lang)}
                </p>
                <div className="energy-affordability-chart-frame page-chrome-chart-frame">
                    <h2 className="energy-affordability-chart-title page-chrome-chart-title">{chartTitle}</h2>
                    <div role="region" aria-label={getChartSummary()} tabIndex="0">
                        <figure ref={chartRef} className="energy-affordability-chart" style={{ margin: 0, position: 'relative' }}>
                            {selectedPoints !== null && <ClearSelectionButton lang={lang} onClick={clear} />}
                            <Plot
                                data={[barTrace]}
                                layout={plotLayout}
                                config={config}
                                style={{ width: '100%', height: '100%' }}
                                useResizeHandler={true}
                                onClick={onPlotClick}
                            />
                        </figure>
                    </div>
                    <div className="energy-affordability-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={`${chartDownloadSlug}.csv`}
                            docx={{
                                filename: `${chartDownloadSlug}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [4000, 2000],
                                fontSize: 22,
                            }}
                            caption={chartTitle}
                            tableAriaLabel={chartTitle}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatHouseholdEnergyNumber(raw, lang)
                            )}
                        />
                    </div>
                </div>
                <aside className="energy-affordability-footer wb-fnote" role="contentinfo">
                    <h2 id="footer-energy-affordability">{getText('energy_affordability_footer_heading', lang)}</h2>
                    <p>{getText('energy_affordability_footer1', lang)}</p>
                    <p>{getText('energy_affordability_footer2', lang)}</p>
                </aside>
            </div>
        </PageShell>
    );
};

export default EnergyAffordability;
