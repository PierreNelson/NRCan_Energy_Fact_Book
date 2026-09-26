import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import Plot from '../components/LazyPlot';
import PageStatus from '../components/PageStatus';
import YearSelect from '../components/YearSelect';
import { getIndustrialEnergyUseData, industrialEnergyUseRowHasCompleteData } from '../utils/dataLoader';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { stripHtml } from '../utils/stripHtml';
import { getText } from '../utils/translations';
import hexToRgba from '../utils/hexToRgba';

import { makeScrollToIdHandler } from '../utils/scrollToId';
import { formatLocaleNumber } from '../utils/formatLocale';

const PIE_ORDER = ['NG', 'DFOx', 'SGPC', 'WWPL', 'Other_x', 'Ele'];
const TABLE_ORDER = ['Ele', 'NG', 'DFOx', 'SGPC', 'WWPL', 'Other_x'];
const LABEL_KEYS = {
    Ele: 'industrial_sector_energy_label_electricity',
    NG: 'industrial_sector_energy_label_natural_gas',
    DFOx: 'industrial_sector_energy_label_diesel_fuel_oil',
    SGPC: 'industrial_sector_energy_label_still_gas_petroleum_coke',
    WWPL: 'industrial_sector_energy_label_wood_waste',
    Other_x: 'industrial_sector_energy_label_other'
};
const COLORS = {
    Ele: '#4b4c4d',
    NG: '#D28004',
    DFOx: '#A687A5',
    SGPC: '#6b87a6',
    WWPL: '#1f8c9b',
    Other_x: '#949494'
};
const MIN_DISPLAY_YEAR = 2022;

const substitute = (text, vars) => Object.keys(vars || {}).reduce((s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '–')), text || '');

const IndustrialSectorEnergy = () => {
    const outlet = useOutletContext();
    const lang = outlet?.lang ?? 'en';
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const chartRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });

    const formatNumber = (num, digits = 0) => formatLocaleNumber(num, lang, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
    const formatFlexible = (num, maxDigits = 1) => formatLocaleNumber(num, lang, {
        maximumFractionDigits: maxDigits,
    });
    const scrollToElement = (id) => makeScrollToIdHandler(id);

    useEffect(() => {
        getIndustrialEnergyUseData()
            .then((d) => {
                setResult(d);
                const available = (d?.years || []).filter((y) => y >= MIN_DISPLAY_YEAR);
                if (available.length) setSelectedYear(Math.max(...available));
            })
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    

    const dataRows = result?.data || [];
    const years = [...new Set(dataRows.filter(industrialEnergyUseRowHasCompleteData).map((r) => r.year))]
        .filter((y) => y >= MIN_DISPLAY_YEAR)
        .sort((a, b) => b - a);
    const selectedRow = selectedYear == null ? null : dataRows.find((r) => r.year === selectedYear) || null;
    const chartTitle = substitute(getText('industrial_sector_energy_chart_title', lang), { year: selectedYear ?? '' });
    const exportChartTitle = stripHtml(chartTitle);
    const tableCaption = getText('industrial_sector_energy_table_caption', lang);

    const tableColumns = useMemo(() => [
        { key: 'year', header: lang === 'en' ? 'Year' : 'Année', align: 'left' },
        { key: 'teu', header: lang === 'en' ? 'Total (PJ)' : 'Total (PJ)', align: 'num' },
        ...TABLE_ORDER.flatMap((key) => {
            const label = getText(LABEL_KEYS[key], lang);
            return [
                { key: `${key}_pj`, header: `${label} (PJ)`, align: 'num' },
                { key: `${key}_pct`, header: `${label} (%)`, align: 'num' },
            ];
        }),
        {
            key: 'change_since_2000_pct',
            header: lang === 'en' ? 'Change since 2000 (%)' : 'Variation depuis 2000 (%)',
            align: 'num',
        },
        {
            key: 'ee_improvement_pct',
            header: lang === 'en' ? 'Energy efficiency improvement (%)' : 'Amélioration de l’efficacité énergétique (%)',
            align: 'num',
        },
        {
            key: 'ee_savings_pj',
            header: lang === 'en' ? 'Energy savings (PJ)' : 'Économies d’énergie (PJ)',
            align: 'num',
        },
        {
            key: 'ee_savings_billion',
            header: lang === 'en' ? 'Energy cost savings ($ billion)' : 'Économies de coûts énergétiques (milliards de dollars)',
            align: 'num',
        },
    ], [lang]);

    const tableRows = useMemo(() => {
        const rows = (result?.data || [])
            .filter((r) => r.year >= MIN_DISPLAY_YEAR && industrialEnergyUseRowHasCompleteData(r))
            .sort((a, b) => a.year - b.year);
        return rows.map((row) => {
            const out = {
                year: row.year,
                teu: row.teu ?? null,
                change_since_2000_pct: row.change_since_2000_pct ?? null,
                ee_improvement_pct: row.ee_improvement_pct ?? null,
                ee_savings_pj: row.ee_savings_pj ?? null,
                ee_savings_billion: row.ee_savings_billion ?? null,
            };
            TABLE_ORDER.forEach((key) => {
                const slice = row.slices?.find((s) => s.key === key);
                out[`${key}_pj`] = slice?.pj ?? null;
                out[`${key}_pct`] = slice?.pct ?? null;
            });
            return out;
        });
    }, [result]);

    const yearRange = tableRows.length ? `${tableRows[0].year}-${tableRows[tableRows.length - 1].year}` : '';
    const tableFileTitle = stripHtml(lang === 'en'
        ? `Canada's secondary energy use by fuel type ${yearRange}`
        : `Consommation d'énergie secondaire du Canada par source d'énergie ${yearRange}`);
    const pngFileTitle = stripHtml(lang === 'en'
        ? `Canada's secondary energy use by fuel type ${selectedYear ?? ''}`
        : `Consommation d'énergie secondaire du Canada par source d'énergie ${selectedYear ?? ''}`);

    const pieCategories = selectedRow?.slices?.length ? PIE_ORDER.map((key) => selectedRow.slices.find((s) => s.key === key)).filter(Boolean) : [];
    const zoomLegendMode = windowWidth <= 800;
    const effectiveSlices = windowWidth > 768 ? selectedSlices : null;
    const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 17;
    const pieValues = pieCategories.map((s) => (s.pj != null && s.pj > 0 ? s.pj : 0.001));
    const pieBaseColors = pieCategories.map((s) => COLORS[s.key]);
    const pieColors = effectiveSlices?.length
        ? pieBaseColors.map((c, i) => (effectiveSlices.includes(i) ? c : hexToRgba(c, 0.3)))
        : pieBaseColors;
    const pieTrace = selectedRow?.teu && pieCategories.length ? {
        type: 'pie',
        values: pieValues,
        labels: pieCategories.map((s) => getText(LABEL_KEYS[s.key], lang)),
        customdata: pieCategories.map((s) => s.pct),
        hole: 0.55,
        direction: 'clockwise',
        sort: false,
        texttemplate: windowWidth <= 768 ? '%{customdata:.0f}%' : '%{label}<br>%{customdata:.0f}%',
        textinfo: windowWidth <= 768 ? 'percent' : 'label+percent',
        textposition: windowWidth <= 768 ? 'inside' : 'outside',
        textfont: { size: textSize, family: 'Arial, sans-serif', color: windowWidth <= 768 ? '#ffffff' : pieColors },
        outsidetextfont: { size: textSize, color: pieColors },
        marker: { colors: pieColors, line: { color: '#ffffff', width: 1 } },
        pull: effectiveSlices?.length ? pieValues.map((_, i) => (effectiveSlices.includes(i) ? 0.08 : 0.02)) : pieValues.map(() => 0.02),
        hovertext: pieCategories.map((s) => `<b>${getText(LABEL_KEYS[s.key], lang)}</b><br>${formatFlexible(s.pj, 1)} PJ<br>${formatFlexible(s.pct, 1)}%`),
        hoverinfo: 'text',
        hoverlabel: { bgcolor: '#ffffff', font: { color: '#333333', size: 14, family: 'Arial, sans-serif' } },
        automargin: true
    } : null;

    const layout = {
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
        margin: {
            t: 105,
            b: zoomLegendMode ? 120 : 70,
            l: windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 80,
            r: windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 190
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        height: windowWidth <= 480 ? 430 : 520,
        clickmode: 'event',
        dragmode: false,
        annotations: selectedRow?.teu != null ? [{
            text: `${getText('industrial_sector_energy_center_total', lang)}<br><b>${formatNumber(selectedRow.teu)}</b><br>PJ`,
            showarrow: false,
            x: 0.5,
            y: 0.5,
            xref: 'paper',
            yref: 'paper',
            font: { size: windowWidth <= 480 ? 15 : 20, color: '#424243', family: 'Arial Black, sans-serif' }
        }] : []
    };

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => {
        const filename = `${pngFileTitle.replace(/[^\w\s,-]/g, '').replace(/\s+/g, '_').trim() || 'chart'}.png`;
        return {
            filename,
            title: pngFileTitle || exportChartTitle,
            height: 800,
            legendItems: PIE_ORDER.map((key) => ({
                label: getText(LABEL_KEYS[key], lang),
                color: COLORS[key],
            })),
        };
    },
        [COLORS, LABEL_KEYS, PIE_ORDER, exportChartTitle, getText, lang, pngFileTitle],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const renderBulletTwo = () => {
        const pct = selectedRow?.change_since_2000_pct;
        const key = pct != null && pct < 0 ? 'industrial_sector_energy_bullet2_bold_decreased' : 'industrial_sector_energy_bullet2_bold';
        return (
            <>
                {substitute(getText('industrial_sector_energy_bullet2_prefix', lang), { year: selectedYear ?? '–' })}
                <strong>{substitute(getText(key, lang), { pct: pct != null ? Math.abs(pct) : '–' })}</strong>
            </>
        );
    };

    if (loading || error) return <PageStatus lang={lang} loading={loading} error={error} />;
    if (!result?.data?.length || !selectedRow) return <p>{getText('industrial_sector_energy_no_data', lang)}</p>;

    return (
        <main id="main-content" tabIndex="-1" className="page-content page-53" role="main" aria-labelledby="industrial-sector-energy-chart-title" style={{ backgroundColor: '#ffffff' }}>
            <style>{`
.page-53 { width: 100%; }
.industrial-sector-energy-container { width: 100%; padding: 15px 0 0 0; display: flex; flex-direction: column; box-sizing: border-box; flex: 1; overflow: visible; }
.industrial-sector-energy-bullets { font-family: 'Noto Sans', sans-serif; font-size: 20px; color: var(--gc-text); line-height: 1.45; margin: 0 0 20px 0; padding-left: 1.35rem; max-width: 78ch; }
.industrial-sector-energy-bullets li { margin-bottom: 10px; }
.industrial-sector-energy-year-dropdown { position: relative; margin-bottom: 20px; width: 200px; font-family: Arial, sans-serif; }
.industrial-sector-energy-year-dropdown label { display: block; font-size: 14px; font-weight: bold; margin-bottom: 5px; }
.industrial-sector-energy-year-dropdown button[aria-expanded] { width: 100%; padding: 10px 15px; background-color: #fff; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; font-weight: bold; text-align: left; display: flex; justify-content: space-between; align-items: center; font-size: 16px; color: #333; }
.industrial-sector-energy-year-dropdown [role="listbox"] { position: absolute; top: 100%; left: 0; width: 100%; max-height: 300px; overflow-y: auto; background-color: #fff; border: 1px solid #ccc; border-radius: 4px; z-index: 100; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
.industrial-sector-energy-year-dropdown [role="option"] { display: flex; align-items: center; width: 100%; text-align: left; padding: 10px 15px; cursor: pointer; border: none; border-bottom: 1px solid #eee; background-color: #fff; font-family: Arial, sans-serif; }
.industrial-sector-energy-chart-frame { background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-top: 0; margin-bottom: 20px; box-sizing: border-box; overflow: visible; }
.section-four-page .page-53 .industrial-sector-energy-chart-frame { padding-bottom: 20px !important; margin-bottom: 20px !important; }
.industrial-sector-energy-chart-title { font-family: 'Lato', sans-serif; font-size: 29px; font-weight: bold; color: var(--gc-text); text-align: center; margin: 0 0 5px 0; }
.industrial-sector-energy-chart-scroll { width: 100%; overflow: hidden; display: flex; justify-content: center; }
.industrial-sector-energy-chart { width: 100%; min-width: 0; height: 520px; position: relative; z-index: 1; overflow: visible; flex-shrink: 0; }
.industrial-sector-energy-chart > div { width: 100%; height: 100%; overflow: visible; }
.industrial-sector-energy-chart .js-plotly-plot,
.industrial-sector-energy-chart .plot-container,
.industrial-sector-energy-chart .svg-container { overflow: visible !important; }
.industrial-sector-energy-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.industrial-sector-energy-chart-frame button:hover { background-color: #404040 !important; }
.industrial-sector-energy-footnotes { font-family: var(--font-body); font-size: 1rem; color: var(--gc-text); margin-top: 24px; margin-bottom: 0; padding-top: 12px; border-top: 1px solid #e0e0e0; line-height: 1.65; max-width: 100%; box-sizing: border-box; }
.industrial-sector-energy-footnotes h2 { font-family: var(--font-heading); font-size: 1.4rem; font-weight: 700; color: var(--gc-text); margin-top: 0; margin-bottom: 1rem; }
.industrial-sector-energy-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
@media (max-width: 768px) {
    .page-53 { border-right: none !important; }
    .industrial-sector-energy-bullets { font-size: 18px; }
    .industrial-sector-energy-chart-title { font-size: 26px; }
    .industrial-sector-energy-footnotes { font-size: 0.9rem; }
    .industrial-sector-energy-footnotes h2 { font-size: 1.2rem; margin-bottom: 0.75rem; }
}
@media (max-width: 480px) {
    .industrial-sector-energy-chart { height: 430px; }
}
            `}</style>
            <div className="industrial-sector-energy-container">
                <ul className="industrial-sector-energy-bullets">
                    <li><strong>{getText('industrial_sector_energy_bullet1_bold', lang)}</strong>{getText('industrial_sector_energy_bullet1_text', lang)}</li>
                    <li>{renderBulletTwo()}</li>
                    <li>
                        {getText('industrial_sector_energy_bullet3_prefix', lang)}
                        <strong>{substitute(getText('industrial_sector_energy_bullet3_mid1', lang), { improvement: formatFlexible(selectedRow.ee_improvement_pct, 0) })}</strong>
                        {getText('industrial_sector_energy_bullet3_mid2', lang)}
                        <strong>{substitute(getText('industrial_sector_energy_bullet3_mid3', lang), { pj: formatFlexible(selectedRow.ee_savings_pj, 0) })}</strong>
                        {getText('industrial_sector_energy_bullet3_mid4', lang)}
                        <strong>{substitute(getText('industrial_sector_energy_bullet3_mid5', lang), { billion: formatNumber(selectedRow.ee_savings_billion, 1) })}</strong>
                        {substitute(getText('industrial_sector_energy_bullet3_suffix', lang), { year: selectedYear })}
                    </li>
                </ul>

                <YearSelect
                    lang={lang}
                    id="industrial-sector-energy-year-select"
                    className="industrial-sector-energy-year-dropdown"
                    label={getText('year_slider_label', lang)}
                    years={years}
                    value={selectedYear ?? ''}
                    onChange={(y) => {
                        setSelectedYear(y);
                        setSelectedSlices(null);
                    }}
                />
                <div role="status" className="wb-inv" aria-live="polite">
                    {selectedYear != null ? (lang === 'en' ? `Showing data for ${selectedYear}` : `Données affichées pour ${selectedYear}`) : ''}
                </div>

                <div className="industrial-sector-energy-chart-frame">
                    <h2 id="industrial-sector-energy-chart-title" className="industrial-sector-energy-chart-title">
                        {chartTitle}
                        <sup id="fn-other-rf-industrial-sector-energy">
                            <a className="fn-lnk" href="#fn-other-industrial-sector-energy" onClick={scrollToElement('fn-other-industrial-sector-energy')}>
                                <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>*
                            </a>
                        </sup>
                    </h2>
                    {effectiveSlices?.length > 0 && <ClearSelectionButton lang={lang} onClick={() => setSelectedSlices(null)} />}
                    <div className="industrial-sector-energy-chart-scroll">
                        <figure ref={chartRef} className="industrial-sector-energy-chart" role="region" aria-label={exportChartTitle} tabIndex="0" style={{ margin: 0 }}>
                            <div aria-hidden="true">
                                {pieTrace && (
                                    <Plot
                                        key={`industrial-sector-energy-${selectedYear}-${effectiveSlices ? effectiveSlices.join('-') : 'none'}`}
                                        data={[pieTrace]}
                                        layout={layout}
                                        config={plotConfig}
                                        style={{ width: '100%', height: '100%' }}
                                        useResizeHandler
                                        onClick={(data) => {
                                            const point = data.points?.[0];
                                            const index = point && (point.pointNumber !== undefined ? point.pointNumber : point.pointIndex);
                                            if (index == null) return;
                                            if (windowWidth <= 768) {
                                                const now = Date.now();
                                                const last = lastPieClickRef.current;
                                                const isDoubleTap = index === last.index && now - last.time < 300;
                                                lastPieClickRef.current = { time: now, index };
                                                if (!isDoubleTap) return;
                                            }
                                            setSelectedSlices((prev) => {
                                                if (prev === null) return [index];
                                                if (prev.includes(index)) return prev.length <= 1 ? null : prev.filter((i) => i !== index);
                                                return [...prev, index];
                                            });
                                        }}
                                    />
                                )}
                            </div>
                        </figure>
                    </div>
                    <div className="industrial-sector-energy-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={`${tableFileTitle}.csv`}
                            docx={{
                                filename: `${tableFileTitle}.docx`,
                                title: tableFileTitle,
                                titleAlign: 'center',
                                columnWidths: tableColumns.map((_, i) => (i === 0 ? 700 : i === 1 ? 1100 : 1200)),
                                fontSize: 16,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                            renderCell={(raw, { colIndex, column }) => {
                                if (raw == null || raw === '') return '–';
                                if (colIndex === 0) return String(raw);
                                const key = String(column?.key || '');
                                if (key.endsWith('_pct') || key === 'change_since_2000_pct' || key === 'ee_improvement_pct') {
                                    const digits = key === 'ee_improvement_pct' ? 0 : key.endsWith('_pct') && key !== 'change_since_2000_pct' ? 1 : undefined;
                                    if (key === 'change_since_2000_pct') return `${raw}%`;
                                    if (key === 'ee_improvement_pct') return `${formatFlexible(raw, 0)}%`;
                                    return `${formatFlexible(raw, digits ?? 1)}%`;
                                }
                                if (key === 'ee_savings_billion') return formatNumber(raw, 1);
                                if (key === 'ee_savings_pj') return formatFlexible(raw, 0);
                                if (key === 'teu' || key.endsWith('_pj')) return formatFlexible(raw, 2);
                                return String(raw);
                            }}
                        />
                    </div>
                </div>

                <aside className="wb-fnote industrial-sector-energy-footnotes" role="note">
                    <h2 id="fn">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</dt>
                        <dd id="fn-other-industrial-sector-energy">
                            <a href="#fn-other-rf-industrial-sector-energy" onClick={scrollToElement('fn-other-rf-industrial-sector-energy')} className="fn-num" title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}>
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                            </a>
                            {' '}{getText('industrial_sector_energy_footnote_other', lang)}
                        </dd>
                        <dd>{getText('industrial_sector_energy_footnote_rounding', lang)}</dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default IndustrialSectorEnergy;
