import React, { useState, useEffect, useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import useWindowWidth from '../hooks/useWindowWidth';
import YearSelect from '../components/YearSelect';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import PageStatus from '../components/PageStatus';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getCommercialInstitutionalEnergyUseData, commercialInstitutionalEnergyUseRowHasCompleteData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { joinChartSummary, summarizeByCategory } from '../utils/chartSpokenSummary';
import { stripHtml } from '../utils/stripHtml';
import hexToRgba from '../utils/hexToRgba';
import commercialInstitutionalEnergyBg1 from '../assets/commercial_institutional_energy_bg1.png';
import commercialInstitutionalEnergyBg2 from '../assets/commercial_institutional_energy_bg2.png';
import commercialInstitutionalEnergyBg3 from '../assets/commercial_institutional_energy_bg3.png';
import commercialInstitutionalEnergyBg4 from '../assets/commercial_institutional_energy_bg4.png';
import commercialInstitutionalEnergyBg5 from '../assets/commercial_institutional_energy_bg5.png';
import commercialInstitutionalEnergyBg6 from '../assets/commercial_institutional_energy_bg6.png';

const CIEU_SLICE_ORDER = ['sh', 'ae', 'lt', 'wh', 'am', 'sc'];
const CIEU_COLORS = ['#CE8003', '#4b4c4d', '#6b5b95', '#6b666a', '#1f8093', '#7db8d4'];
/** Fixed filename for CSV/DOCX/PNG (no year). */
const commercial_institutional_TABLE_FILENAME_BASE = 'commercial_institutional_energy_by_end_use';
/** Earliest year in the year selector and in chart data tables; newer years appear automatically from data. */
const commercial_institutional_MIN_DISPLAY_YEAR = 2022;

const substitute = (str, vars) => {
    if (!str || typeof str !== 'string') return str;
    return Object.keys(vars || {}).reduce((s, k) => s.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(vars[k] ?? '–')), str);
};

const boldNumbersInBullet = (str) => {
    if (!str || typeof str !== 'string') return str;
    const re = /(\d+\s*%|–\s*%|\d+(?:[.,]\d+)?\s*PJ|\$?[\d.,]+\s*(?:billion|milliards(?:\s+de\s+dollars)?))/gi;
    const parts = [];
    let lastIndex = 0;
    let match;
    const s = str;
    re.lastIndex = 0;
    while ((match = re.exec(s)) !== null) {
        parts.push(s.slice(lastIndex, match.index));
        parts.push(<strong key={match.index}>{match[1]}</strong>);
        lastIndex = match.index + match[1].length;
    }
    parts.push(s.slice(lastIndex));
    return parts;
};

const getSliceLabelKey = (key) => {
    const m = {
        sh: 'commercial_institutional_label_space_heating',
        wh: 'commercial_institutional_label_water_heating',
        ae: 'commercial_institutional_label_auxiliary_equipment',
        am: 'commercial_institutional_label_auxiliary_motors',
        lt: 'commercial_institutional_label_lighting',
        sc: 'commercial_institutional_label_space_cooling',
    };
    return m[key] || key;
};

const CommercialInstitutionalEnergyUse = () => {
    const outlet = useOutletContext();
    const lang = outlet?.lang ?? 'en';
    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const windowWidth = useWindowWidth();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pickedYear, setPickedYear] = useState(null);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const chartRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });

    useEffect(() => {
        getCommercialInstitutionalEnergyUseData()
            .then((d) => {
                setResult(d ?? null);
            })
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    const pad = { left: 0, right: 0 };
    const years = useMemo(() => {
        if (!result?.data?.length) return [];
        return [...new Set(result.data.filter(commercialInstitutionalEnergyUseRowHasCompleteData).map((r) => r.year))]
            .filter((y) => y !== 2000 && y >= commercial_institutional_MIN_DISPLAY_YEAR)
            .sort((a, b) => b - a);
    }, [result]);

    const selectedYear = pickedYear != null && years.includes(pickedYear) ? pickedYear : (years[0] ?? null);

    const selectedRow = useMemo(() => (result?.data && selectedYear != null ? result.data.find((r) => r.year === selectedYear) : null), [result, selectedYear]);
    const latestWithEe = useMemo(() => {
        if (!result?.data?.length) return null;
        const filtered = result.data.filter((r) => commercialInstitutionalEnergyUseRowHasCompleteData(r) && r.year !== 2000 && r.year >= commercial_institutional_MIN_DISPLAY_YEAR);
        return [...filtered].reverse().find((r) => r.ee_improvement_pct != null && r.ee_savings_pj != null) || filtered[filtered.length - 1] || null;
    }, [result]);

    const orderedSlices = useMemo(() => {
        if (!selectedRow?.slices?.length) return [];
        return CIEU_SLICE_ORDER.map((k) => selectedRow.slices.find((s) => s.key === k)).filter(Boolean);
    }, [selectedRow]);

    const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18;
    const selectEnabled = windowWidth > 768;
    const effectiveSlices = selectEnabled ? selectedSlices : null;
    const pieTrace = useMemo(() => {
        if (!orderedSlices.length || orderedSlices.length !== 6) return null;
        const total = selectedRow?.teu;
        if (total == null || total <= 0) return null;
        const values = orderedSlices.map((s) => (s.pj != null && s.pj > 0 ? s.pj : 0.001));
        const labels = orderedSlices.map((s) => getText(getSliceLabelKey(s.key), lang));
        const customdata = orderedSlices.map((s) => s.pct);
        const hoverTexts = orderedSlices.map((s) => {
            const label = getText(getSliceLabelKey(s.key), lang);
            return `<b>${label}</b><br>${Number(s.pj).toLocaleString(locale, { maximumFractionDigits: 1 })} PJ<br>${Number(s.pct).toFixed(1)}%`;
        });
        const baseColors = CIEU_COLORS.slice(0, values.length);
        const effectiveColors = effectiveSlices && effectiveSlices.length > 0
            ? baseColors.map((c, i) => (effectiveSlices.includes(i) ? c : hexToRgba(c, 0.3)))
            : baseColors;
        const pull = effectiveSlices && effectiveSlices.length > 0
            ? values.map((_, i) => (effectiveSlices.includes(i) ? 0.08 : 0.02))
            : values.map(() => 0.02);
        return {
            type: 'pie',
            values,
            labels,
            customdata,
            hole: 0.55,
            textinfo: 'label+percent',
            textposition: 'outside',
            texttemplate: '%{label}<br>%{customdata:.1f}%',
            textfont: { size: textSize, family: 'Arial, sans-serif', color: effectiveColors },
            outsidetextfont: { size: textSize, color: effectiveColors },
            marker: { colors: effectiveColors, line: { color: '#fff', width: 1 } },
            pull,
            direction: 'clockwise',
            sort: false,
            hovertext: hoverTexts,
            hoverinfo: 'text',
            hoverlabel: { bgcolor: 'white', font: { color: '#333', size: 14, family: 'Arial, sans-serif' } },
        };
    }, [selectedRow, orderedSlices, lang, locale, textSize, effectiveSlices]);

    const chartTitle = substitute(getText('commercial_institutional_chart_title', lang), { year: selectedYear ?? '' });
    const exportChartTitle = stripHtml(chartTitle);
    const formatShare = (value) => `${Number(value).toFixed(1)} ${lang === 'en' ? 'percent' : 'pour cent'}`;
    const formatEnergy = (value) => `${Math.round(Number(value)).toLocaleString(locale)} PJ`;
    const pieChartSummary = !orderedSlices.length || selectedRow?.teu == null ? '' : joinChartSummary({
        intro: lang === 'en'
            ? `Pie chart of commercial and institutional energy use by end use for ${selectedYear}. Total ${formatEnergy(selectedRow.teu)}`
            : `Graphique circulaire de la consommation d'énergie des secteurs commercial et institutionnel par utilisation finale pour ${selectedYear}. Total ${formatEnergy(selectedRow.teu)}`,
        body: summarizeByCategory({
            categories: orderedSlices.map((slice) => getText(getSliceLabelKey(slice.key), lang)),
            series: [
                { name: lang === 'en' ? 'Share' : 'Part', values: orderedSlices.map((slice) => slice.pct), format: formatShare },
                { name: lang === 'en' ? 'Energy' : 'Énergie', values: orderedSlices.map((slice) => slice.pj), format: formatEnergy },
            ],
            lang,
        }),
    });
    const chartRegionLabel = `${exportChartTitle}. ${pieChartSummary}`;
    const teuFormatted = selectedRow?.teu != null ? Math.round(Number(selectedRow.teu)).toLocaleString(locale, { maximumFractionDigits: 0 }) : '–';
    const compactCenterLabel = windowWidth <= 480;
    const centerLabel = compactCenterLabel ? 'Total' : getText('commercial_institutional_center_total', lang);
    const centerText = compactCenterLabel ? centerLabel : `${centerLabel}<br>${teuFormatted} PJ`;

    const tableAllYearsRows = useMemo(() => {
        const data = result?.data;
        if (!Array.isArray(data) || data.length === 0) return [];
        return [...data]
            .filter((r) => commercialInstitutionalEnergyUseRowHasCompleteData(r) && r.year !== 2000 && r.year >= commercial_institutional_MIN_DISPLAY_YEAR)
            .sort((a, b) => a.year - b.year)
            .map((r) => {
                const row = {
                    year: r.year,
                    total: r.teu,
                    chEuPct: r.chEuPct != null ? r.chEuPct : null,
                    chEuWeiPct: r.chEuWeiPct != null ? r.chEuWeiPct : null,
                    eiPct: r.eiPct != null ? r.eiPct : null,
                    ee_improvement_pct: r.ee_improvement_pct != null ? r.ee_improvement_pct : null,
                    ee_savings_pj: r.ee_savings_pj != null ? r.ee_savings_pj : null,
                    ee_savings_billion: r.ee_savings_billion != null ? r.ee_savings_billion : null,
                };
                CIEU_SLICE_ORDER.forEach((k) => {
                    const slice = r.slices?.find((s) => s.key === k);
                    row[k] = slice?.pj != null ? slice.pj : null;
                });
                return row;
            });
    }, [result]);

    const tableColumns = useMemo(() => [
        { key: 'year', header: lang === 'en' ? 'Year' : 'Année', align: 'left' },
        ...CIEU_SLICE_ORDER.map((k) => ({
            key: k,
            header: `${getText(getSliceLabelKey(k), lang)} (PJ)`,
            align: 'num',
        })),
        { key: 'total', header: lang === 'en' ? 'Total (PJ)' : 'Total (PJ)', align: 'num' },
        { key: 'chEuPct', header: lang === 'en' ? 'Change since 2000 (%)' : 'Variation depuis 2000 (%)', align: 'num' },
        { key: 'chEuWeiPct', header: lang === 'en' ? 'Change without EE (%)' : 'Variation sans EE (%)', align: 'num' },
        { key: 'eiPct', header: lang === 'en' ? 'Change in energy intensity (%)' : 'Variation de l\'intensité énergétique (%)', align: 'num' },
        { key: 'ee_improvement_pct', header: lang === 'en' ? 'EE improvement (%)' : 'Amélioration EE (%)', align: 'num' },
        { key: 'ee_savings_pj', header: lang === 'en' ? 'EE savings (PJ)' : 'Économies EE (PJ)', align: 'num' },
        { key: 'ee_savings_billion', header: lang === 'en' ? 'EE savings ($B)' : 'Économies EE (G $)', align: 'num' },
    ], [lang]);

    const tableColumnWidths = useMemo(
        () => [800, ...CIEU_SLICE_ORDER.map(() => 1500), 1500, 1800, 1800, 2200, 1600, 1400, 1400],
        [],
    );

    const formatTableCell = (raw, { column, colIndex }) => {
        if (raw == null || raw === '') return '–';
        if (colIndex === 0 || column?.key === 'year') return String(raw);
        if (column?.key === 'ee_improvement_pct') return `${raw}%`;
        if (CIEU_SLICE_ORDER.includes(column?.key) || column?.key === 'total' || column?.key === 'ee_savings_pj') {
            const n = Number(raw);
            if (Number.isNaN(n)) return '–';
            if (column?.key === 'ee_savings_pj' && n === Math.round(n)) return String(raw);
            return n.toLocaleString(locale, { maximumFractionDigits: 2 });
        }
        return String(raw);
    };

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${commercial_institutional_TABLE_FILENAME_BASE}.png`,
        title: exportChartTitle,
        height: 800,
    }),
        [commercial_institutional_TABLE_FILENAME_BASE, exportChartTitle],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const layout = useMemo(() => ({
        showlegend: false,
        margin: { t: 120, b: 60, l: 80, r: 80 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        height: 520,
        clickmode: 'event',
        annotations: selectedRow?.teu != null ? [{
            text: centerText,
            showarrow: false,
            x: 0.5,
            y: 0.5,
            font: { size: compactCenterLabel ? 16 : 18, color: '#424243', family: 'Arial Black, sans-serif' },
            xref: 'paper',
            yref: 'paper',
        }] : [],
    }), [selectedRow, centerText, compactCenterLabel]);

    if (loading || error) {
        return (
            <PageStatus
                lang={lang}
                loading={loading}
                error={error}
                className="commercial-institutional-energy-main"
                style={{ padding: `0 ${pad.right}px 2rem ${pad.left}px` }}
            />
        );
    }

    if (!result?.data?.length) {
        return (
            <div className="commercial-institutional-energy-main" style={{ padding: `0 ${pad.right}px 2rem ${pad.left}px` }}>
                <p>{getText('commercial_institutional_no_data', lang)}</p>
            </div>
        );
    }

    return (
        <div className="commercial-institutional-energy-main">
            <style>{`
.commercial-institutional-energy-main { width: 100%; margin: 0; padding: 0; font-family: 'Noto Sans', sans-serif; }
.commercial-institutional-energy-stack { width: 100%; padding: 0 ${pad.right}px 2rem ${pad.left}px; box-sizing: border-box; display: flex; flex-direction: column; gap: 0; }
.commercial-institutional-energy-chart-frame { background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-sizing: border-box; overflow: visible; }
.commercial-institutional-energy-chart-title { font-family: 'Noto Sans', sans-serif; font-size: 20px; font-weight: bold; color: var(--gc-text, #333); margin: 0 0 12px 0; text-align: center; }
.commercial-institutional-energy-chart { width: 100%; height: 520px; position: relative; z-index: 1; }
.commercial-institutional-energy-visual-narrative-wrap { display: flex; flex-direction: column; align-items: flex-start; width: 100%; gap: 0.85rem; }
.commercial-institutional-energy-visual-img { max-width: 180px; height: auto; object-fit: contain; }
.commercial-institutional-energy-visual-img-first { max-width: 360px; width: 360px; height: auto; object-fit: contain; }
.commercial-institutional-energy-visual-narrative-wrap .commercial-institutional-energy-visual-row { margin: 0; padding: 0; width: 100%; }
.commercial-institutional-energy-visual-row { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; min-width: 0; max-width: 100%; }
.commercial-institutional-energy-visual-narrative-wrap .commercial-institutional-energy-visual-row .commercial-institutional-energy-visual-text { min-width: 0; flex: 1 1 0; max-width: 100%; margin: 0 !important; padding: 0 !important; }
.commercial-institutional-energy-visual-text { display: block; font-size: 1.25rem; color: #333; line-height: 1.4; overflow-wrap: anywhere; word-wrap: break-word; word-break: break-word; max-width: 100%; box-sizing: border-box; margin: 0; }
.commercial-institutional-energy-visual-text .commercial-institutional-energy-visual-lead { font-weight: bold; color: var(--gc-text, #26374a); }
.commercial-institutional-energy-visual-pct { font-size: 2.5rem; font-weight: bold; color: #c8782a; }
.commercial-institutional-energy-narrative { margin-top: 1.25rem; margin-bottom: 0; }
.commercial-institutional-energy-narrative p { margin: 0; font-size: 1.2rem; color: #333; line-height: 1.6; }
.commercial-institutional-energy-chart-frame details > summary:hover { background-color: #404040 !important; }
.commercial-institutional-energy-chart-frame button[type="button"]:hover,
.commercial-institutional-energy-chart-frame button:hover { background-color: #404040 !important; }
            `}</style>

            <div className="commercial-institutional-energy-stack">
                    <YearSelect
                        lang={lang}
                        id="commercial-institutional-energy-year-select"
                        className="commercial-institutional-energy-year-dropdown"
                        label={getText('year_slider_label', lang)}
                        years={years}
                        value={selectedYear}
                        onChange={setPickedYear}
                    />
                    <div role="status" className="wb-inv" aria-live="polite">
                        {selectedYear != null ? (lang === 'en' ? `Showing data for ${selectedYear}` : `Données affichées pour ${selectedYear}`) : ''}
                    </div>

                    <div className="commercial-institutional-energy-chart-frame">
                        <h3 className="commercial-institutional-energy-chart-title">{chartTitle}</h3>
                        {effectiveSlices != null && effectiveSlices.length > 0 && (
                            <ClearSelectionButton lang={lang} onClick={() => setSelectedSlices(null)} />
                        )}
                        <div className="commercial-institutional-energy-chart" ref={chartRef} role="region" aria-label={chartRegionLabel} tabIndex={0}>
                            {pieTrace ? (
                                <div aria-hidden="true">
                                <Plot
                                    key={selectedYear}
                                    data={[pieTrace]}
                                    layout={layout}
                                    config={plotConfig}
                                    style={{ width: '100%', height: '100%' }}
                                    useResizeHandler
                                    onClick={(data) => {
                                        const pt = data.points?.[0];
                                        const idx = pt && (pt.pointNumber !== undefined ? pt.pointNumber : pt.pointIndex);
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
                                            if (prev.includes(idx)) return prev.length <= 1 ? null : prev.filter((i) => i !== idx);
                                            return [...prev, idx];
                                        });
                                    }}
                                />
                                </div>
                            ) : (
                                <p style={{ padding: '2rem', textAlign: 'center', color: '#555' }}>
                                    {lang === 'en' ? 'No chart data for the selected year.' : 'Aucune donnée pour l\'année sélectionnée.'}
                                </p>
                            )}
                        </div>
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableAllYearsRows}
                            csvFilename={`${commercial_institutional_TABLE_FILENAME_BASE}.csv`}
                            docx={{
                                filename: `${commercial_institutional_TABLE_FILENAME_BASE}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: tableColumnWidths,
                                fontSize: 20,
                            }}
                            caption={chartTitle}
                            tableAriaLabel={chartTitle}
                            renderCell={formatTableCell}
                        />
                    </div>

                    {selectedRow && (
                        <>
                            <div className="commercial-institutional-energy-visual-narrative-wrap">
                                <img src={commercialInstitutionalEnergyBg1} alt="" className="commercial-institutional-energy-visual-img commercial-institutional-energy-visual-img-first" aria-hidden="true" />
                                <div className="commercial-institutional-energy-visual-row">
                                    <img src={selectedRow.chEuPct != null && selectedRow.chEuPct < 0 ? commercialInstitutionalEnergyBg6 : commercialInstitutionalEnergyBg2} alt="" className="commercial-institutional-energy-visual-img" aria-hidden="true" />
                                    <p className="commercial-institutional-energy-visual-text" style={{ margin: 0, padding: 0, lineHeight: 1.2 }}>
                                        {selectedRow.chEuPct != null ? (
                                            <span className="commercial-institutional-energy-visual-lead">
                                                {getText(selectedRow.chEuPct < 0 ? 'commercial_institutional_narrative_1_prefix_dec' : 'commercial_institutional_narrative_1_prefix_inc', lang)}
                                                <span className="commercial-institutional-energy-visual-pct">{Math.abs(selectedRow.chEuPct)}%</span>
                                                {substitute(getText('commercial_institutional_narrative_1_suffix', lang), { year: selectedYear })}
                                            </span>
                                        ) : (
                                            <span className="commercial-institutional-energy-visual-lead">{substitute(getText('commercial_institutional_narrative_1', lang), { year: selectedYear })}</span>
                                        )}
                                    </p>
                                </div>
                                <div className="commercial-institutional-energy-visual-row">
                                    <img src={commercialInstitutionalEnergyBg3} alt="" className="commercial-institutional-energy-visual-img" aria-hidden="true" />
                                    <p className="commercial-institutional-energy-visual-text" style={{ margin: 0, padding: 0, lineHeight: 1.2 }}>
                                        <span className="commercial-institutional-energy-visual-lead">{getText('commercial_institutional_narrative_1_but', lang)}</span>
                                        {selectedRow.chEuWeiPct != null && <> <span className="commercial-institutional-energy-visual-pct">{selectedRow.chEuWeiPct}%</span></>}
                                        {' '}{getText('commercial_institutional_narrative_1_without', lang)}
                                    </p>
                                </div>
                                <div className="commercial-institutional-energy-visual-row">
                                    <img src={selectedRow.eiPct != null && selectedRow.eiPct > 0 ? commercialInstitutionalEnergyBg4 : commercialInstitutionalEnergyBg5} alt="" className="commercial-institutional-energy-visual-img" aria-hidden="true" />
                                    <p className="commercial-institutional-energy-visual-text" style={{ margin: 0, padding: 0, lineHeight: 1.2 }}>
                                        <span className="commercial-institutional-energy-visual-lead">
                                            {getText(selectedRow.eiPct != null && selectedRow.eiPct > 0 ? 'commercial_institutional_narrative_2_increased' : 'commercial_institutional_narrative_2', lang)}
                                            {selectedRow.eiPct != null && <> <span className="commercial-institutional-energy-visual-pct">{substitute(getText('commercial_institutional_narrative_2_by', lang), { pct: Math.abs(selectedRow.eiPct) })}</span></>}
                                        </span>
                                    </p>
                                </div>
                            </div>
                            <div className="commercial-institutional-energy-narrative">
                                <p>
                                    {boldNumbersInBullet(substitute(getText('commercial_institutional_narrative_3', lang), {
                                        improvement: selectedRow.ee_improvement_pct ?? latestWithEe?.ee_improvement_pct ?? '–',
                                        pj: (selectedRow.ee_savings_pj ?? latestWithEe?.ee_savings_pj) != null ? Number(selectedRow.ee_savings_pj ?? latestWithEe?.ee_savings_pj).toLocaleString(locale, { maximumFractionDigits: 0 }) : '–',
                                        billion: (selectedRow.ee_savings_billion ?? latestWithEe?.ee_savings_billion) != null ? Number(selectedRow.ee_savings_billion ?? latestWithEe?.ee_savings_billion).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '–',
                                        year: selectedYear
                                    }))}
                                </p>
                            </div>
                        </>
                    )}
            </div>
        </div>
    );
};

export default CommercialInstitutionalEnergyUse;
