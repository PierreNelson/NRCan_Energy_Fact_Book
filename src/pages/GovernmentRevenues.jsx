import React, { useEffect, useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import FootnoteMarker from '../components/FootnoteMarker';
import ClearSelectionButton from '../components/ClearSelectionButton';
import PageFootnotes from '../components/PageFootnotes';
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

import { makeScrollToIdHandler } from '../utils/scrollToId';

const government_revenues_CATEGORIES = ['land_sales', 'income_taxes', 'royalties'];

const government_revenues_DONUT = { land_sales: 0.4, income_taxes: 6.9, royalties: 17.2 };
const government_revenues_TOTAL = 24.4;

const government_revenues_TABLE_DATA = [
    { year: 2011, land_sales: 0.2, income_taxes: 3.5, royalties: 12.0 },
    { year: 2013, land_sales: 0.2, income_taxes: 4.0, royalties: 14.0 },
    { year: 2015, land_sales: 0.2, income_taxes: 3.0, royalties: 11.0 },
    { year: 2017, land_sales: 0.3, income_taxes: 4.5, royalties: 15.0 },
    { year: 2019, land_sales: 0.4, income_taxes: 5.5, royalties: 16.0 },
    { year: 2021, land_sales: 0.4, income_taxes: 7.0, royalties: 18.0 },
    { year: 2023, land_sales: 0.5, income_taxes: 9.0, royalties: 22.0 },
];

const government_revenues_COLORS = { land_sales: '#689F38', income_taxes: '#3CA1AF', royalties: '#7A6F4E' };

const formatTradeBalanceNumber = (num, lang) => {
    if (num === undefined || num === null) return '—';
    return Number(num).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
};

const GovernmentRevenues = () => {
    const { lang } = useOutletContext();
    const windowWidth = useWindowWidth();
    const {
        selected: selectedSlices,
        clear: clearSelection,
        onPlotClick: handleChartClick,
    } = usePlotlySelection({ mode: 'slices', windowWidth });
    const chartRef = useRef(null);

    const scrollToFootnote = makeScrollToIdHandler('fn-asterisk-government-revenues');

    const scrollToRef = makeScrollToIdHandler('fn-asterisk-rf-government-revenues');

    const chartTitle = getText('government_revenues_chart_title', lang);
    const exportChartTitle = stripHtml(chartTitle);
    const chartDownloadSlug = lang === 'en' ? 'government_energy_revenue' : 'recettes_publiques_energie';
    const tableFilenameBase = lang === 'en' ? 'government_revenues' : 'recettes_publiques';
    const uom = getText('government_revenues_table_uom', lang);
    const totalLabel = getText('government_revenues_total_label', lang);

    const categoryLabels = useMemo(
        () => Object.fromEntries(
            government_revenues_CATEGORIES.map((k) => [k, getText(`government_revenues_${k}`, lang)]),
        ),
        [lang],
    );

    const tableColumns = useMemo(() => [
        { key: 'year', header: lang === 'en' ? 'Year' : 'Année', align: 'left' },
        ...government_revenues_CATEGORIES.map((k) => ({
            key: k,
            header: `${categoryLabels[k]} (${uom})`,
            align: 'num',
        })),
        { key: 'total', header: `${totalLabel} (${uom})`, align: 'num' },
        ...government_revenues_CATEGORIES.map((k) => ({
            key: `${k}_pct`,
            header: `${categoryLabels[k]} (%)`,
            align: 'num',
        })),
    ], [lang, categoryLabels, uom, totalLabel]);

    const tableRows = useMemo(() => government_revenues_TABLE_DATA.map((row) => {
        const vals = government_revenues_CATEGORIES.map((k) => row[k]);
        const total = vals.reduce((a, b) => a + b, 0);
        const next = { year: row.year, total };
        government_revenues_CATEGORIES.forEach((k, i) => {
            next[k] = vals[i];
            next[`${k}_pct`] = total > 0 ? (vals[i] / total) * 100 : 0;
        });
        return next;
    }), []);

    useEffect(() => {
        if (!chartRef?.current) return;
        const plotContainer = chartRef.current;
        const svgElements = plotContainer.querySelectorAll('.main-svg, .svg-container svg');
        svgElements.forEach((svg) => svg.setAttribute('aria-hidden', 'true'));
        const modebarButtons = plotContainer.querySelectorAll('.modebar-btn');
        modebarButtons.forEach((btn) => {
            const dataTitle = btn.getAttribute('data-title');
            if (dataTitle && (dataTitle.includes('Download') || /télécharger|charger/i.test(dataTitle))) {
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

    const donutLabels = useMemo(() => government_revenues_CATEGORIES.map((k) => categoryLabels[k]), [categoryLabels]);
    const donutValues = useMemo(() => government_revenues_CATEGORIES.map((k) => government_revenues_DONUT[k]), []);
    const totalFormatted = useMemo(
        () => (lang === 'en'
            ? `$${government_revenues_TOTAL}`
            : `${government_revenues_TOTAL.toLocaleString('fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} $`),
        [lang],
    );

    const pieData = useMemo(() => {
        const hovertext = government_revenues_CATEGORIES.map((k, i) => {
            const v = donutValues[i];
            const pct = Math.round((v / government_revenues_TOTAL) * 100);
            return `${donutLabels[i]}: ${formatTradeBalanceNumber(v, lang)} ${uom}, ${pct}%`;
        });
        const colors = government_revenues_CATEGORIES.map((k) => government_revenues_COLORS[k]);
        const textColors = selectedSlices === null
            ? colors
            : colors.map((c, i) => (selectedSlices.includes(i) ? c : hexToRgba(c, 0.3)));
        const markerColors = selectedSlices === null
            ? colors
            : colors.map((c, i) => (selectedSlices.includes(i) ? c : hexToRgba(c, 0.3)));
        const useCompactLayout = windowWidth <= 768;
        const pullValues = selectedSlices === null
            ? donutValues.map(() => 0.02)
            : donutValues.map((_, i) => (selectedSlices.includes(i) ? 0.08 : 0.02));
        const texttemplate = useCompactLayout
            ? '%{percent:.0%}'
            : (lang === 'en' ? '%{label}<br>$%{value:.1f}, %{percent:.0%}' : '%{label}<br>%{value:.1f} $, %{percent:.0%}');
        return [{
            type: 'pie',
            values: donutValues,
            labels: donutLabels,
            hole: 0.5,
            direction: 'clockwise',
            sort: false,
            texttemplate,
            textinfo: useCompactLayout ? 'percent' : 'label+value+percent',
            textposition: useCompactLayout ? 'inside' : 'outside',
            textfont: {
                size: windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18,
                family: 'Arial, sans-serif',
                color: useCompactLayout ? '#ffffff' : textColors,
            },
            outsidetextfont: {
                size: windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18,
                family: 'Arial, sans-serif',
                color: textColors,
            },
            insidetextfont: { color: '#ffffff', size: windowWidth <= 480 ? 10 : 12, family: 'Arial, sans-serif' },
            hoverinfo: 'text',
            hovertext,
            hoverlabel: {
                bgcolor: '#ffffff',
                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
            },
            marker: {
                colors: markerColors,
                line: { color: '#ffffff', width: 2 },
            },
            pull: pullValues,
        }];
    }, [lang, donutLabels, donutValues, windowWidth, selectedSlices, uom]);

    const plotLayout = useMemo(() => {
        const compact = windowWidth <= 768;
        const margin = compact
            ? (windowWidth <= 384 ? { l: 0, r: 0, t: 10, b: 80 } : windowWidth <= 480 ? { l: 0, r: 0, t: 10, b: 70 } : windowWidth <= 640 ? { l: 0, r: 0, t: 10, b: 60 } : { l: 0, r: 0, t: 10, b: 10 })
            : { l: 40, r: 40, t: 80, b: 80 };
        const legendConfig = compact ? (
            windowWidth <= 384 ? { orientation: 'h', y: -0.50, x: 0.5, xanchor: 'center', yanchor: 'top', font: { size: 9 }, itemclick: false, itemdoubleclick: false }
            : windowWidth <= 480 ? { orientation: 'h', y: -0.15, x: 0.5, xanchor: 'center', yanchor: 'top', font: { size: 9 }, itemclick: false, itemdoubleclick: false }
            : windowWidth <= 640 ? { orientation: 'h', y: -0.15, x: 0.6, xanchor: 'center', yanchor: 'top', font: { size: 10 }, itemclick: false, itemdoubleclick: false }
            : { orientation: 'v', y: 0.5, x: 1.05, xanchor: 'left', yanchor: 'middle', font: { size: 10 }, itemclick: false, itemdoubleclick: false }
        ) : undefined;
        return {
            showlegend: compact,
            legend: legendConfig,
            margin,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            autosize: true,
            clickmode: 'event',
            annotations: [
                { x: 0.5, y: 0.55, text: totalLabel, showarrow: false, font: { size: 14, family: 'Arial, sans-serif', color: 'var(--gc-text, #333)' } },
                { x: 0.5, y: 0.45, text: totalFormatted, showarrow: false, font: { size: 22, family: 'Arial, sans-serif', color: 'var(--gc-text, #333)' } },
            ],
        };
    }, [totalLabel, totalFormatted, windowWidth]);

        const downloadChartWithTitle = useChartPngDownloader(
            chartRef,
            () => ({
            filename: `${chartDownloadSlug}.png`,
            title: exportChartTitle,
            height: 500,
            legendItems: government_revenues_CATEGORIES.map((k) => ({
                label: categoryLabels[k],
                color: government_revenues_COLORS[k],
            })),
        }),
            [categoryLabels, chartDownloadSlug, exportChartTitle, government_revenues_CATEGORIES, government_revenues_COLORS],
        );

        const config = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const getChartSummary = () => {
        const unit = lang === 'fr' ? 'milliards de dollars' : 'billions of dollars';
        const amount = (num) => `${formatTradeBalanceNumber(num, lang)} ${unit}`;
        const spokenTitle = exportChartTitle
            .replace(/\s*\(\s*\$\s*billions?\s*\)/i, ', billions of dollars')
            .replace(/\s*\(\s*milliards de dollars\s*\)/i, ', milliards de dollars');
        const parts = government_revenues_CATEGORIES.map((k, i) => (
            `${donutLabels[i]}: ${amount(donutValues[i])}`
        )).join(', ');
        return `${spokenTitle}. ${totalLabel}: ${amount(government_revenues_TOTAL)}. ${parts}.`;
    };

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-16"
            aria-labelledby="government-revenues-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-16 { width: 100%; }
.government-revenues-container { width: 100%; display: flex; flex-direction: column; min-height: 100%; box-sizing: border-box; }
.government-revenues-header { padding-top: 20px; padding-bottom: 20px; }
.government-revenues-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 25px;
    line-height: 1.2;
    position: relative;
    padding-bottom: 0.5em;
}
.government-revenues-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.government-revenues-intro {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 20px;
}
.government-revenues-content-row {
    display: flex;
    flex-direction: row;
    flex: 1;
    width: 100%;
    overflow: visible;
    gap: 40px;
}
.government-revenues-chart-column { width: 55%; }
.government-revenues-text-column {
    width: 45%;
    padding-top: 30px;
    padding-left: 30px;
    padding-right: 0;
    box-sizing: border-box;
    min-width: 300px;
}
.government-revenues-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-sizing: border-box;
}
.government-revenues-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    line-height: 1.2;
    margin: 0 0 15px 0;
    text-align: center;
}
.government-revenues-chart { width: 100%; height: 340px; }
.government-revenues-chart .lazy-plot-host,
.government-revenues-chart .lazy-plot-inner { width: 100%; height: 100%; }
.government-revenues-chart button[type="button"]:hover,
.government-revenues-chart button:hover,
.government-revenues-chart-frame button[type="button"]:hover,
.government-revenues-chart-frame button:hover { background-color: #404040 !important; }
.government-revenues-bullet {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
    margin-bottom: 15px;
}
.government-revenues-table-wrapper { display: block; width: 100%; margin: 20px 0 0 0; }
.government-revenues-table-wrapper button[type="button"]:hover,
.government-revenues-table-wrapper button:hover { background-color: #404040 !important; }
.government-revenues-footnote {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--gc-text);
    margin-top: 2rem;
    margin-bottom: 0;
}
@media (max-width: 1400px) {
    .government-revenues-content-row { flex-direction: column; }
    .government-revenues-chart-column { width: 100%; margin-bottom: 30px; }
    .government-revenues-text-column { width: 100%; padding-top: 0; padding-left: 0; }
}
@media (max-width: 768px) {
    .government-revenues-title { font-size: 37px; }
    .government-revenues-chart-title { font-size: 26px; }
    .government-revenues-intro { font-size: 18px; }
    .government-revenues-bullet { font-size: 18px; }
    .government-revenues-chart { height: 300px; }
}
            `}</style>
            <div className="government-revenues-container">
                <header className="government-revenues-header">
                    <h1 id="government-revenues-title" className="government-revenues-title">{getText('government_revenues_title', lang)}</h1>
                </header>
                <p className="government-revenues-intro" role="region" aria-label={stripHtml(getText('government_revenues_intro', lang))}>
                    {getText('government_revenues_intro', lang)}
                </p>
                <div className="government-revenues-content-row">
                    <div className="government-revenues-chart-column">
                        <div className="government-revenues-chart-frame">
                            <h2 className="government-revenues-chart-title">
                                {chartTitle}
                                <FootnoteMarker
                            lang={lang}
                            href="#fn-asterisk-government-revenues"
                            id="fn-asterisk-rf-government-revenues"
                            marker="*"
                            onClick={scrollToFootnote}
                        />
                            </h2>
                            <div role="region" aria-label={getChartSummary()} tabIndex="0">
                                <figure ref={chartRef} className="government-revenues-chart" style={{ margin: 0, position: 'relative' }}>
                                    {selectedSlices !== null && selectedSlices.length > 0 && (
                                        <ClearSelectionButton lang={lang} onClick={clearSelection} />
                                    )}
                                    <Plot
                                        key={selectedSlices ? selectedSlices.join('-') : 'none'}
                                        data={pieData}
                                        layout={plotLayout}
                                        config={config}
                                        style={{ width: '100%', height: '100%' }}
                                        useResizeHandler={true}
                                        onClick={handleChartClick}
                                    />
                                </figure>
                            </div>
                            <div className="government-revenues-table-wrapper">
                                <ChartDataTable
                                    lang={lang}
                                    columns={tableColumns}
                                    rows={tableRows}
                                    csvFilename={`${tableFilenameBase}.csv`}
                                    docx={{
                                        filename: `${tableFilenameBase}.docx`,
                                        title: exportChartTitle,
                                        titleAlign: 'center',
                                        columnWidths: [900, 1400, 1400, 1400, 1200, 1100, 1100, 1100],
                                        fontSize: 20,
                                    }}
                                    caption={exportChartTitle}
                                    tableAriaLabel={exportChartTitle}
                                    renderCell={(raw, { colIndex, column }) => {
                                        if (colIndex === 0) return String(raw ?? '');
                                        const formatted = formatTradeBalanceNumber(raw, lang);
                                        return column?.key === 'total'
                                            ? <strong>{formatted}</strong>
                                            : formatted;
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                    <aside className="government-revenues-text-column">
                        <ul style={{ listStyleType: 'disc', paddingLeft: '24px', margin: 0 }}>
                            <li className="government-revenues-bullet">
                                {getText('government_revenues_bullet1_part1', lang)}<strong>{getText('government_revenues_bullet1_part2', lang)}</strong>{getText('government_revenues_bullet1_part3', lang)}<strong>{getText('government_revenues_bullet1_part4', lang)}</strong>{getText('government_revenues_bullet1_part5', lang)}
                            </li>
                            <li className="government-revenues-bullet">
                                {getText('government_revenues_bullet2_part1', lang)}<strong>{getText('government_revenues_bullet2_part2', lang)}</strong>{getText('government_revenues_bullet2_part3', lang)}<strong>{getText('government_revenues_bullet2_part4', lang)}</strong>{getText('government_revenues_bullet2_part5', lang)}
                            </li>
                        </ul>
                    </aside>
                </div>
                <PageFootnotes
                    lang={lang}
                    titleId="fn"
                    className="government-revenues-footnote"
                    items={[
                        { id: 'fn-asterisk-government-revenues', marker: '*', text: getText('government_revenues_footnote', lang), returnHref: '#fn-asterisk-rf-government-revenues' },
                    ]}
                />
            </div>
        </PageShell>
    );
};

export default GovernmentRevenues;
