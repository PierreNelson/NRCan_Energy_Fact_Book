import { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import ChartDataTable from '../components/ChartDataTable';
import FootnoteMarker from '../components/FootnoteMarker';
import ClearSelectionButton from '../components/ClearSelectionButton';
import YearSelect from '../components/YearSelect';
import Plot from '../components/LazyPlot';
import PageStatus from '../components/PageStatus';
import { getSEUByFuelData } from '../utils/dataLoader';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { stripHtml } from '../utils/stripHtml';
import { getText } from '../utils/translations';
import hexToRgba from '../utils/hexToRgba';

import { makeScrollToIdHandler } from '../utils/scrollToId';

const seu_by_fuel_KEYS = ['Ele', 'NG', 'mogas', 'Oil', 'OOP', 'BM', 'OT'];
const seu_by_fuel_LABEL_KEYS = {
    Ele: 'seu_by_fuel_label_electricity',
    NG: 'seu_by_fuel_label_natural_gas',
    mogas: 'seu_by_fuel_label_motor_gasoline',
    Oil: 'seu_by_fuel_label_oil',
    OOP: 'seu_by_fuel_label_other_oil',
    BM: 'seu_by_fuel_label_biomass',
    OT: 'seu_by_fuel_label_other'
};
const seu_by_fuel_COLORS = ['#657f9b', '#CE8003', '#4b4c4d', '#6b666a', '#1f8093', '#A687A5', '#949494'];

const SEUByFuel = () => {
    const { lang } = useOutletContext();
    const [seuData, setSeuData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const chartRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

    useEffect(() => {
        getSEUByFuelData()
            .then((d) => {
                setSeuData(d);
                if (d?.years?.length) setSelectedYear(d.latestYear ?? d.years[d.years.length - 1]);
            })
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const currentRow = useMemo(() => {
        if (!seuData?.data?.length || selectedYear == null) return null;
        return seuData.data.find((r) => r.year === selectedYear) || null;
    }, [seuData, selectedYear]);

    const baseline = useMemo(() => {
        if (!seuData?.data?.length) return null;
        return seuData.data.find((r) => r.year === 2000) || null;
    }, [seuData]);

    const categories = useMemo(() => {
        if (!currentRow || !currentRow.TE || currentRow.TE <= 0) return [];
        return seu_by_fuel_KEYS.map((key) => {
            const value = currentRow[key] ?? 0;
            const pct = Number(((value / currentRow.TE) * 100).toFixed(1));
            return { key, value, pct };
        });
    }, [currentRow]);

    const TE = currentRow ? Math.round(currentRow.TE) : null;
    const TEX = useMemo(() => {
        if (!baseline?.TE || !currentRow?.TE || baseline.TE <= 0) return null;
        return Math.round(((currentRow.TE - baseline.TE) / baseline.TE) * 100);
    }, [baseline, currentRow]);
    const EleX = useMemo(() => {
        if (!baseline?.Ele || !currentRow?.Ele || baseline.Ele <= 0) return null;
        return Math.round(((currentRow.Ele - baseline.Ele) / baseline.Ele) * 100);
    }, [baseline, currentRow]);
    const NGX = useMemo(() => {
        if (!baseline?.NG || !currentRow?.NG || baseline.NG <= 0) return null;
        return Math.round(((currentRow.NG - baseline.NG) / baseline.NG) * 100);
    }, [baseline, currentRow]);

    /** Same pool as the year dropdown (excludes 2000 baseline from chart series). */
    const yearsListFiltered = useMemo(() => {
        if (!seuData?.years?.length) return [];
        return seuData.years.filter((y) => y !== 2000);
    }, [seuData]);

    const yearsListDesc = useMemo(
        () => [...yearsListFiltered].sort((a, b) => b - a),
        [yearsListFiltered]
    );

    /** Chronological columns for the chart data table (all selector years). */
    const selectorYearsAsc = useMemo(
        () => [...yearsListFiltered].sort((a, b) => a - b),
        [yearsListFiltered]
    );

    const chartTitle = useMemo(() => {
        const t = getText('seu_by_fuel_chart_title', lang) || '';
        return selectedYear != null ? t.replace(/\{\{year\}\}/g, String(selectedYear)) : t;
    }, [selectedYear, lang]);
    const exportChartTitle = stripHtml(chartTitle);
    const tableCaption = getText('seu_by_fuel_table_caption', lang);
    const csvFilename = lang === 'en'
        ? 'secondary_energy_use_by_fuel.csv'
        : 'consommation_energie_secondaire_par_source.csv';
    const docxFilename = lang === 'en'
        ? 'secondary_energy_use_by_fuel_table.docx'
        : 'consommation_energie_secondaire_par_source_tableau.docx';

    const tableColumns = useMemo(() => {
        const yearLabel = lang === 'en' ? 'Year' : 'Année';
        const totalLabel = `${getText('seu_by_fuel_total', lang)} (PJ)`;
        return [
            { key: 'year', header: yearLabel, align: 'left' },
            { key: 'te', header: totalLabel, align: 'num' },
            ...seu_by_fuel_KEYS.flatMap((key) => {
                const base = getText(seu_by_fuel_LABEL_KEYS[key], lang);
                return [
                    { key: `${key}_pj`, header: `${base} (PJ)`, align: 'num' },
                    { key: `${key}_pct`, header: `${base} (%)`, align: 'num' },
                ];
            }),
        ];
    }, [lang]);

    /** One row per year (left column = year), fuel PJ/% columns — data-mode ChartDataTable. */
    const tableRows = useMemo(() => {
        if (!seuData?.data?.length || !selectorYearsAsc.length) return [];
        return selectorYearsAsc.map((y) => {
            const row = seuData.data.find((r) => r.year === y);
            const out = { year: y, te: null };
            seu_by_fuel_KEYS.forEach((k) => {
                out[`${k}_pj`] = null;
                out[`${k}_pct`] = null;
            });
            if (!row || !row.TE || row.TE <= 0) return out;
            out.te = Math.round(row.TE);
            seu_by_fuel_KEYS.forEach((key) => {
                const value = row[key] ?? 0;
                out[`${key}_pj`] = Math.round(value);
                out[`${key}_pct`] = Number(((value / row.TE) * 100).toFixed(1));
            });
            return out;
        });
    }, [seuData, selectorYearsAsc]);

    const donutData = useMemo(() => {
        if (!categories.length) return { values: [], labels: [], hoverTexts: [], total: 0 };
        const values = categories.map((c) => c.value);
        const labels = categories.map((c) => getText(seu_by_fuel_LABEL_KEYS[c.key], lang));
        const hoverTexts = categories.map((c) => {
            const label = getText(seu_by_fuel_LABEL_KEYS[c.key], lang);
            return `<b>${label}</b><br>${Math.round(c.value)} PJ<br>${Number(c.pct).toFixed(1)}%`;
        });
        return { values, labels, hoverTexts, total: TE };
    }, [categories, TE, lang]);

    const zoomLegendMode = windowWidth <= 800;
    const selectEnabled = windowWidth > 768;
    const effectiveSelectedSlices = selectEnabled ? selectedSlices : null;

    const plotData = useMemo(() => {
        if (!donutData.values.length) return [];
        const getColors = () => (effectiveSelectedSlices === null ? seu_by_fuel_COLORS : seu_by_fuel_COLORS.map((c, i) => (effectiveSelectedSlices.includes(i) ? c : hexToRgba(c, 0.3))));
        const pull = effectiveSelectedSlices === null ? donutData.values.map(() => 0.02) : donutData.values.map((_, i) => (effectiveSelectedSlices.includes(i) ? 0.08 : 0.02));
        const labelColors = getColors();
        const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18;
        return [{
            type: 'pie',
            values: donutData.values,
            labels: donutData.labels,
            hole: 0.55,
            direction: 'clockwise',
            sort: false,
            texttemplate: windowWidth <= 768 ? '%{percent:.1%}' : '%{label}<br>%{percent:.1%}',
            textinfo: windowWidth <= 768 ? 'percent' : 'label+percent',
            textposition: windowWidth <= 768 ? 'inside' : 'outside',
            textfont: {
                size: textSize,
                family: 'Arial, sans-serif',
                color: windowWidth <= 768 ? '#fff' : labelColors
            },
            outsidetextfont: { size: textSize, color: labelColors },
            marker: {
                colors: getColors(),
                line: { color: '#fff', width: 1 }
            },
            pull,
            hovertext: donutData.hoverTexts,
            hoverinfo: 'text',
            hoverlabel: { bgcolor: '#fff', font: { color: '#333', size: 14 } },
            automargin: true
        }];
    }, [donutData, effectiveSelectedSlices, windowWidth]);

    const layout = useMemo(() => ({
        showlegend: zoomLegendMode,
        legend: zoomLegendMode ? {
            orientation: 'h',
            y: -0.12,
            x: 0.5,
            xanchor: 'center',
            yanchor: 'top',
            font: { size: 11 },
            itemclick: false,
            itemdoubleclick: false
        } : undefined,
        margin: { t: 100, b: zoomLegendMode ? 120 : 80, l: windowWidth <= 480 ? 0 : 20, r: windowWidth <= 480 ? 0 : 240 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { family: 'Arial, sans-serif', size: 12 },
        clickmode: 'event',
        dragmode: false,
        annotations: donutData.total != null ? [{
            text: `${getText('seu_by_fuel_total', lang)}<br><b>${(donutData.total || 0).toLocaleString()}</b><br>PJ`,
            showarrow: false,
            x: 0.5,
            y: 0.5,
            xref: 'paper',
            yref: 'paper',
            font: { size: 22, color: '#424243', family: 'Arial Black, sans-serif' }
        }] : []
    }), [donutData.total, lang, zoomLegendMode, windowWidth]);

    const scrollToFootnote = makeScrollToIdHandler('fn-asterisk-secondary-energy-by-fuel');

    const scrollToRef = makeScrollToIdHandler('fn-asterisk-rf-secondary-energy-by-fuel');

        const downloadChartWithTitle = useChartPngDownloader(
            chartRef,
            () => ({
            filename: `${titleForFile}.png`,
            title: exportChartTitle,
            height: 800,
            legendItems: seu_by_fuel_KEYS.map((key, i) => ({
                label: getText(seu_by_fuel_LABEL_KEYS[key], lang),
                color: seu_by_fuel_COLORS[i],
            })),
        }),
            [exportChartTitle, getText, lang, seu_by_fuel_COLORS, seu_by_fuel_KEYS, seu_by_fuel_LABEL_KEYS, titleForFile],
        );

        const config = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
        name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
    });

    if (loading) {
        return (
            <div className="secondary-energy-by-fuel-root">
                <PageStatus lang={lang} loading className="secondary-energy-by-fuel-loading" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="secondary-energy-by-fuel-root">
                <PageStatus lang={lang} error={error} className="secondary-energy-by-fuel-error" />
            </div>
        );
    }

    if (!seuData) {
        return (
            <div className="secondary-energy-by-fuel-root">
                <p className="secondary-energy-by-fuel-error">{getText('seu_by_fuel_no_data', lang)}</p>
            </div>
        );
    }

    const hasData = currentRow != null && categories.length > 0;

    return (
        <div className="secondary-energy-by-fuel-root">
            <style>{`
.secondary-energy-by-fuel-chart-frame details > summary:hover { background-color: #404040 !important; }
.secondary-energy-by-fuel-chart-frame button[type="button"]:hover,
.secondary-energy-by-fuel-chart-frame button:hover { background-color: #404040 !important; }
            `}</style>
            <ul className="secondary-energy-by-fuel-bullets">
                <li>{getText('seu_by_fuel_bullet1', lang)}</li>
                {hasData && TE != null && (
                    <li>
                        {(getText('seu_by_fuel_bullet2_was', lang) || '').replace(/\{\{year\}\}/g, String(selectedYear))}
                        <strong>{TE.toLocaleString()}</strong>
                        {getText('seu_by_fuel_bullet2_pj', lang)}
                    </li>
                )}
                {hasData && TEX != null && EleX != null && NGX != null && (
                    <li>
                        {getText('seu_by_fuel_bullet3_prefix', lang)}
                        <strong>{TEX >= 0 ? getText('seu_by_fuel_bullet3_increased_word', lang) : getText('seu_by_fuel_bullet3_decreased_word', lang)}</strong>
                        {' '}
                        <strong>{Math.abs(TEX)}%</strong>
                        {getText('seu_by_fuel_bullet3_mid1', lang)}{selectedYear}.{getText('seu_by_fuel_bullet3_mid2', lang)}
                        <strong>{NGX}%</strong>
                        {getText('seu_by_fuel_bullet3_mid3', lang)}
                        <strong>{EleX}%</strong>
                        {getText('seu_by_fuel_bullet3_suffix', lang)}
                    </li>
                )}
            </ul>

            {hasData && yearsListDesc.length > 0 && (
                <>
                    <YearSelect
                        lang={lang}
                        id="seu-by-fuel-year-select"
                        label={getText('year_slider_label', lang)}
                        years={yearsListDesc}
                        value={selectedYear}
                        onChange={setSelectedYear}
                    />
                    <div role="status" className="wb-inv" aria-live="polite">
                        {selectedYear ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${selectedYear}` : ''}
                    </div>
                </>
            )}

            {hasData && (
                <>
                    <div className="secondary-energy-by-fuel-charts-anchor" style={{ width: '100%', boxSizing: 'border-box' }}>
                        <div className="secondary-energy-by-fuel-chart-wrap" ref={chartRef}>
                            <div className="secondary-energy-by-fuel-chart-frame" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <p className="secondary-energy-by-fuel-chart-title" style={{ textAlign: 'center', width: '100%', boxSizing: 'border-box', margin: '0 0 1rem 0' }}>
                                    {chartTitle}
                                    <FootnoteMarker
                            lang={lang}
                            href="#fn-asterisk-secondary-energy-by-fuel"
                            id="fn-asterisk-rf-secondary-energy-by-fuel"
                            marker="*"
                            onClick={scrollToFootnote}
                        />
                                </p>
                                <div className="secondary-energy-by-fuel-donut-wrap" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', minHeight: 480 }}>
                                    {effectiveSelectedSlices !== null && <ClearSelectionButton lang={lang} onClick={() => setSelectedSlices(null)} />}
                                        <figure style={{ width: '100%', maxWidth: 800, minWidth: 360, minHeight: 450, height: 450, margin: 0, position: 'relative' }}>
                                        <Plot
                                            key={selectedYear}
                                            data={plotData}
                                            layout={layout}
                                            config={config}
                                            style={{ width: '100%', minWidth: 360, minHeight: 450, height: 450 }}
                                            useResizeHandler
                                            onClick={(eventData) => {
                                                if (!selectEnabled || !eventData.points?.length) return;
                                                const idx = eventData.points[0].pointNumber ?? eventData.points[0].pointIndex;
                                                if (idx == null) return;
                                                if (windowWidth <= 768) {
                                                    const now = Date.now();
                                                    const last = lastPieClickRef.current;
                                                    const samePoint = idx === last.index;
                                                    const doubleTap = samePoint && (now - last.time < 300);
                                                    lastPieClickRef.current = { time: now, index: idx };
                                                    if (!doubleTap) return;
                                                }
                                                setSelectedSlices((prev) => {
                                                    if (prev === null) return [idx];
                                                    if (prev.includes(idx)) return prev;
                                                    return [...prev, idx];
                                                });
                                            }}
                                        />
                                    </figure>
                                </div>

                            <ChartDataTable
                                lang={lang}
                                columns={tableColumns}
                                rows={tableRows}
                                csvFilename={csvFilename}
                                docx={{
                                    filename: docxFilename,
                                    title: exportChartTitle,
                                    titleAlign: 'center',
                                    columnWidths: tableColumns.map((_, i) => (i === 0 ? 3600 : 2000)),
                                    fontSize: 18,
                                }}
                                caption={tableCaption}
                                tableAriaLabel={tableCaption}
                                renderCell={(raw, { colIndex, column }) => {
                                    if (raw == null || raw === '') return '–';
                                    if (colIndex === 0) return String(raw);
                                    if (String(column?.key || '').endsWith('_pct')) return `${raw}%`;
                                    return String(raw);
                                }}
                            />
                            </div>
                        </div>
                    </div>

                    <aside className="wb-fnote secondary-energy-by-fuel-footnote" role="note">
                        <h2 id="fn">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                        <dl>
                            <dt className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</dt>
                            <dd id="fn-asterisk-secondary-energy-by-fuel">
                                <a href="#fn-asterisk-rf-secondary-energy-by-fuel" onClick={scrollToRef} className="fn-num" title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}>
                                    <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                                </a>
                                {' '}{getText('seu_by_fuel_footnote_other', lang)}
                            </dd>
                            <dd>
                                {getText('seu_by_fuel_footnote_rounding', lang)}
                            </dd>
                        </dl>
                    </aside>
                </>
            )}
        </div>
    );
};

export default SEUByFuel;
