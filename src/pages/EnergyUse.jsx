import React, { useState, useEffect, useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import FootnoteMarker from '../components/FootnoteMarker';
import ClearSelectionButton from '../components/ClearSelectionButton';
import PageFootnotes from '../components/PageFootnotes';
import YearSelect from '../components/YearSelect';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useWindowWidth from '../hooks/useWindowWidth';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getEnergyUseData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { joinChartSummary, summarizeByCategory } from '../utils/chartSpokenSummary';
import hexToRgba from '../utils/hexToRgba';

import { makeScrollToIdHandler } from '../utils/scrollToId';
const energy_use_PIE_KEYS = ['pie_secondary', 'pie_losses', 'pie_nonenergy', 'pie_noncovered', 'pie_pipeline'];
const energy_use_BAR_KEYS = ['bar_industrial', 'bar_transportation', 'bar_residential', 'bar_commercial', 'bar_agriculture'];
const energy_use_BAR_FIELDS = ['I', 'T', 'R', 'C', 'A'];
const energy_use_PIE_COLORS = ['#fcb340', '#657f9b', '#1f8093', '#6b666a', '#4b4c4d'];
const energy_use_BAR_COLORS = ['#c88d34', '#A687A5', '#7F94AD', '#577F6A', '#50A569'];

const formatPJ = (n, lang) => {
    if (n === undefined || n === null) return '—';
    return Math.round(Number(n)).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');
};

const EnergyUse = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const [data, setData] = useState({ years: [], data: [] });
    const [selectedYear, setSelectedYear] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const [selectedBars, setSelectedBars] = useState(null);
    const chartRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });
    const pieChartRef = useRef(null);
    const barChartRef = useRef(null);

    const zoomLegendMode = windowWidth < 800;

    const scrollToFootnote = makeScrollToIdHandler('fn-asterisk-energy-use');

    const scrollToRef = makeScrollToIdHandler('fn-asterisk-rf-energy-use');

    useEffect(() => {
        getEnergyUseData()
            .then((d) => {
                setData(d);
                if (d.years && d.years.length > 0) {
                    setSelectedYear(d.years[d.years.length - 1]);
                }
            })
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    const row = useMemo(() => {
        if (!data.data || !selectedYear) return null;
        return data.data.find((r) => r.year === selectedYear) || null;
    }, [data.data, selectedYear]);

    const computed = useMemo(() => {
        if (!row) return null;
        const R = Number(row.R);
        const C = Number(row.C);
        const I = Number(row.I);
        const T = Number(row.T);
        const A = Number(row.A);
        const P = Number(row.P);
        const NPC = Number(row.NPC);
        const FK = Number(row.FK);
        const EL = Number(row.EL);
        const TSEU = R + C + I + T + A;
        const TPD = TSEU + P + NPC + FK + EL;
        const barVals = [I, T, R, C, A];
        const barPct = TSEU > 0 ? barVals.map((v) => (v / TSEU) * 100) : [0, 0, 0, 0, 0];
        return {
            TSEU,
            TPD,
            R,
            C,
            I,
            T,
            A,
            P,
            NPC,
            FK,
            EL,
            pieValues: [TSEU, EL, NPC, FK, P],
            barValues: barVals,
            barPct,
        };
    }, [row]);

    const yearsList = useMemo(() => data.years || [], [data.years]);
    const yearsListDesc = useMemo(() => [...yearsList].sort((a, b) => b - a), [yearsList]);
    const hasData = yearsList.length > 0 && computed;

    const pieChartTitle = getText('energy_use_chart_title', lang);
    const barChartTitle = getText('energy_use_bar_chart_title', lang);
    const exportPieChartTitle = stripHtml(
        selectedYear != null ? `${pieChartTitle} ${selectedYear}` : pieChartTitle,
    );
    const exportBarChartTitle = stripHtml(
        selectedYear != null ? `${barChartTitle} ${selectedYear}` : barChartTitle,
    );
    const pieDownloadSlug = exportPieChartTitle.replace(/[^\w\s,-]/g, '').replace(/\s+/g, '_').trim() || 'energy_use_primary_secondary';
    const barDownloadSlug = exportBarChartTitle.replace(/[^\w\s,-]/g, '').replace(/\s+/g, '_').trim() || 'energy_use_secondary_by_sector';

    const pieLabels = useMemo(
        () => energy_use_PIE_KEYS.map((k) => getText('energy_use_' + k, lang)),
        [lang],
    );
    const barLabels = useMemo(
        () => energy_use_BAR_KEYS.map((k) => getText('energy_use_' + k, lang)),
        [lang],
    );

    const pieTableColumns = useMemo(() => {
        const yearLabel = lang === 'en' ? 'Year' : 'Année';
        const totalLabel = lang === 'en' ? 'Total (PJ)' : 'Total (PJ)';
        return [
            { key: 'year', header: yearLabel, align: 'left' },
            ...energy_use_PIE_KEYS.flatMap((k, i) => {
                const base = stripHtml(pieLabels[i]);
                return [
                    { key: `${k}_pj`, header: `${base} (PJ)`, align: 'num' },
                    { key: `${k}_pct`, header: `${base} (%)`, align: 'num' },
                ];
            }),
            { key: 'total', header: totalLabel, align: 'num' },
        ];
    }, [lang, pieLabels]);

    const pieTableRows = useMemo(() => {
        if (!data.data?.length) return [];
        return data.data.map((r) => {
            const R = Number(r.R);
            const C = Number(r.C);
            const I = Number(r.I);
            const T = Number(r.T);
            const A = Number(r.A);
            const TSEU = R + C + I + T + A;
            const P = Number(r.P);
            const NPC = Number(r.NPC);
            const FK = Number(r.FK);
            const EL = Number(r.EL);
            const TPD = TSEU + P + NPC + FK + EL;
            const pieVals = [TSEU, EL, NPC, FK, P];
            const piePcts = TPD > 0 ? pieVals.map((v) => Math.round((v / TPD) * 100)) : [0, 0, 0, 0, 0];
            const out = { year: r.year, total: Math.round(TPD) };
            energy_use_PIE_KEYS.forEach((k, i) => {
                out[`${k}_pj`] = Math.round(pieVals[i]);
                out[`${k}_pct`] = piePcts[i];
            });
            return out;
        });
    }, [data.data]);

    const barTableColumns = useMemo(() => {
        const yearLabel = lang === 'en' ? 'Year' : 'Année';
        const totalLabel = lang === 'en' ? 'Total (PJ)' : 'Total (PJ)';
        return [
            { key: 'year', header: yearLabel, align: 'left' },
            ...energy_use_BAR_KEYS.flatMap((k, i) => {
                const base = stripHtml(barLabels[i]);
                return [
                    { key: `${k}_pj`, header: `${base} (PJ)`, align: 'num' },
                    { key: `${k}_pct`, header: `${base} (%)`, align: 'num' },
                ];
            }),
            { key: 'total', header: totalLabel, align: 'num' },
        ];
    }, [lang, barLabels]);

    const barTableRows = useMemo(() => {
        if (!data.data?.length) return [];
        return data.data.map((r) => {
            const R = Number(r.R);
            const C = Number(r.C);
            const I = Number(r.I);
            const T = Number(r.T);
            const A = Number(r.A);
            const TSEU = R + C + I + T + A;
            const vals = [I, T, R, C, A];
            const pcts = TSEU > 0 ? vals.map((v) => Math.round((v / TSEU) * 100)) : [0, 0, 0, 0, 0];
            const out = { year: r.year, total: Math.round(TSEU) };
            energy_use_BAR_KEYS.forEach((k, i) => {
                out[`${k}_pj`] = Math.round(vals[i]);
                out[`${k}_pct`] = pcts[i];
            });
            return out;
        });
    }, [data.data]);

    const pieCaption = lang === 'en'
        ? `${stripHtml(pieChartTitle)} – Primary breakdown (PJ and %)`
        : `${stripHtml(pieChartTitle)} – Répartition primaire (PJ et %)`;
    const barCaption = lang === 'en'
        ? `${stripHtml(pieChartTitle)} – Secondary energy by sector (PJ and %)`
        : `${stripHtml(pieChartTitle)} – Énergie secondaire par secteur (PJ et %)`;

    const pieChartData = useMemo(() => {
        if (!computed || computed.TPD <= 0) return null;
        const hoverTexts = [];
        computed.pieValues.forEach((val, i) => {
            const pct = computed.TPD > 0 ? (val / computed.TPD) * 100 : 0;
            hoverTexts.push(`<b>${pieLabels[i]}</b><br>${formatPJ(val, lang)} PJ<br>${pct.toFixed(0)}%`);
        });
        return { labels: pieLabels, hoverTexts, colors: energy_use_PIE_COLORS };
    }, [computed, lang, pieLabels]);

    const pieData = useMemo(() => {
        if (!pieChartData || !computed || computed.TPD <= 0) return [];
        const { labels, hoverTexts, colors } = pieChartData;
        const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18;
        const getColors = () => {
            if (selectedSlices === null) return colors;
            return colors.map((c, i) => (selectedSlices.includes(i) ? c : hexToRgba(c, 0.3)));
        };
        return [{
            type: 'pie',
            values: computed.pieValues,
            labels,
            hole: 0.45,
            direction: 'clockwise',
            sort: false,
            texttemplate: windowWidth <= 768 ? '%{percent:.0%}' : '%{label}<br>%{percent:.0%}',
            textinfo: windowWidth <= 768 ? 'percent' : 'label+percent',
            textposition: windowWidth <= 768 ? 'inside' : 'outside',
            textfont: {
                size: textSize,
                family: 'Arial, sans-serif',
                color: windowWidth <= 768 ? '#fff' : getColors(),
            },
            outsidetextfont: { color: getColors() },
            marker: {
                colors: getColors(),
                line: { color: '#fff', width: 2 },
            },
            hovertext: hoverTexts,
            hoverinfo: 'text',
            hoverlabel: { bgcolor: 'white', font: { size: 14, family: 'Arial, sans-serif' } },
            pull: selectedSlices === null
                ? computed.pieValues.map(() => 0.02)
                : computed.pieValues.map((_, i) => (selectedSlices.includes(i) ? 0.08 : 0.02)),
            rotation: 335,
            automargin: true,
        }];
    }, [computed, pieChartData, selectedSlices, windowWidth]);

    const barLabelFontSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18;
    const barTextSize = Math.max(barLabelFontSize, 14);
    const barData = useMemo(() => {
        if (!computed || !computed.barPct) return [];
        return energy_use_BAR_FIELDS.map((field, i) => {
            const isSelected = selectedBars === null || selectedBars.includes(i);
            const color = isSelected ? energy_use_BAR_COLORS[i] : hexToRgba(energy_use_BAR_COLORS[i], 0.3);
            return {
                x: [computed.barPct[i]],
                y: [''],
                name: barLabels[i],
                type: 'bar',
                orientation: 'h',
                marker: { color },
                hoverinfo: 'text',
                hovertext: `<b>${barLabels[i]}</b><br>${Math.round(computed.barPct[i])}%<br>${formatPJ(computed.barValues[i], lang)} PJ`,
                hoverlabel: { bgcolor: 'white', font: { size: 14, family: 'Arial, sans-serif' } },
                text: [Math.round(computed.barPct[i]) + '%'],
                textposition: 'inside',
                insidetextanchor: 'middle',
                textangle: windowWidth <= 768 ? 90 : 0,
                textfont: { size: barTextSize, family: 'Arial, sans-serif', color: '#ffffff' },
            };
        });
    }, [computed, lang, selectedBars, windowWidth, barTextSize, barLabels]);

    const pieLayout = useMemo(() => ({
        showlegend: zoomLegendMode,
        legend: zoomLegendMode ? {
            orientation: 'h',
            y: -0.12,
            x: 0.5,
            xanchor: 'center',
            yanchor: 'top',
            font: { size: 11 },
            itemclick: false,
            itemdoubleclick: false,
        } : undefined,
        margin: {
            t: 60,
            b: zoomLegendMode ? 100 : 60,
            l: windowWidth <= 480 ? 0 : 20,
            r: windowWidth <= 480 ? 0 : 240,
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        autosize: true,
        clickmode: 'event',
        dragmode: false,
    }), [zoomLegendMode, windowWidth]);

    const barLayout = useMemo(() => ({
        barmode: 'stack',
        showlegend: true,
        uniformtext: { mode: 'show', minsize: 14 },
        legend: windowWidth <= 768 ? {
            orientation: 'h',
            y: -0.2,
            x: 0.5,
            xanchor: 'center',
            yanchor: 'top',
            font: { size: barLabelFontSize, family: 'Arial, sans-serif' },
        } : {
            orientation: 'v',
            x: 1.02,
            y: 0.5,
            xanchor: 'left',
            yanchor: 'middle',
            font: { size: barLabelFontSize, family: 'Arial, sans-serif' },
        },
        margin: {
            t: 20,
            b: windowWidth <= 768 ? 80 : 20,
            l: 20,
            r: windowWidth <= 768 ? 20 : 280,
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        xaxis: { range: [0, 100], visible: false, showticklabels: false, fixedrange: true },
        yaxis: { visible: false, showticklabels: false, fixedrange: true },
        autosize: true,
        clickmode: 'event',
        dragmode: false,
    }), [windowWidth, barLabelFontSize]);

    const downloadPieChartWithTitle = useChartPngDownloader(
        pieChartRef,
        () => ({
        filename: `${pieDownloadSlug}.png`,
        title: exportPieChartTitle,
        height: 800,
        legendItems: energy_use_PIE_KEYS.map((k, i) => ({
            label: stripHtml(pieLabels[i]),
            color: energy_use_PIE_COLORS[i],
        })),
    }),
        [energy_use_PIE_COLORS, energy_use_PIE_KEYS, exportPieChartTitle, pieDownloadSlug, pieLabels, stripHtml],
    );

    const downloadBarChartWithTitle = useChartPngDownloader(
        barChartRef,
        () => ({
        filename: `${barDownloadSlug}.png`,
        title: exportBarChartTitle,
        height: 800,
        legendItems: energy_use_BAR_KEYS.map((k, i) => ({
            label: stripHtml(barLabels[i]),
            color: energy_use_BAR_COLORS[i],
        })),
    }),
        [barDownloadSlug, barLabels, energy_use_BAR_COLORS, energy_use_BAR_KEYS, exportBarChartTitle, stripHtml],
    );

    const configPie = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadPieChartWithTitle(gd),
    });
    const configBar = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadBarChartWithTitle(gd),
    });

    const percentWord = lang === 'en' ? 'percent' : 'pour cent';
    const formatShare = (value) => `${Math.round(Number(value))} ${percentWord}`;

    const getPieChartSummary = () => {
        if (!computed || computed.TPD <= 0) return '';
        const shares = computed.pieValues.map((value) => (value / computed.TPD) * 100);
        const body = summarizeByCategory({
            categories: pieLabels.map((label) => stripHtml(label)),
            series: [
                { name: lang === 'en' ? 'Share' : 'Part', values: shares, format: formatShare },
                { name: lang === 'en' ? 'Energy' : 'Énergie', values: computed.pieValues, format: (value) => `${formatPJ(value, lang)} PJ` },
            ],
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Pie chart of primary and secondary energy use by sector for ${selectedYear}. Total ${formatPJ(computed.TPD, lang)} PJ`
                : `Graphique circulaire de la consommation d'énergie primaire et secondaire par secteur pour ${selectedYear}. Total ${formatPJ(computed.TPD, lang)} PJ`,
            body,
        });
    };

    const getBarChartSummary = () => {
        if (!computed || computed.TSEU <= 0) return '';
        const body = summarizeByCategory({
            categories: barLabels.map((label) => stripHtml(label)),
            series: [
                { name: lang === 'en' ? 'Share' : 'Part', values: computed.barPct, format: formatShare },
                { name: lang === 'en' ? 'Energy' : 'Énergie', values: computed.barValues, format: (value) => `${formatPJ(value, lang)} PJ` },
            ],
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Stacked bar chart of secondary energy use by sector for ${selectedYear}. Total ${formatPJ(computed.TSEU, lang)} PJ`
                : `Graphique à barres empilées de la consommation d'énergie secondaire par secteur pour ${selectedYear}. Total ${formatPJ(computed.TSEU, lang)} PJ`,
            body,
        });
    };

    const pieRegionLabel = `${exportPieChartTitle}. ${getPieChartSummary()}`;
    const barRegionLabel = `${exportBarChartTitle}. ${getBarChartSummary()}`;
    const subtitleText = getText('energy_use_subtitle', lang).replace(
        /\{\{year\}\}/g,
        selectedYear != null ? String(selectedYear) : '',
    );

    const renderTableCell = (raw, { colIndex, column }) => {
        if (raw == null || raw === '') return '—';
        if (colIndex === 0) return String(raw);
        if (String(column?.key || '').endsWith('_pct')) return `${raw}%`;
        return formatPJ(raw, lang);
    };

    if (loading) {
        return <PageStatus lang={lang} loading className="energy-use-loading" />;
    }
    if (error) {
        return <PageStatus lang={lang} error={error} className="energy-use-error" />;
    }

    return (
        <PageShell
            className="page-content page-48 energy-use page-chrome page-chrome--bleed"
            aria-labelledby="energy-use-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.page-48.energy-use {
}
.energy-use-inner { padding: 24px 0 32px 0; }
.energy-use-title {
    font-size: 50px;
    color: #C58516;
    margin: 0 0 10px 0;
}
.page-48.page-content p.energy-use-subtitle {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 15px 0;
    line-height: 1.25;
}
.energy-use-bullets { margin: 0 0 24px 0; padding-left: 1.2em; }
.energy-use-bullets li { margin-bottom: 10px; font-family: 'Noto Sans', sans-serif; font-size: 20px; line-height: 1.6; color: var(--gc-text); }
.energy-use-chart-title {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 12px 0;
    text-align: center;
    max-width: 100%;
    overflow-wrap: break-word;
    word-wrap: break-word;
    word-break: break-word;
    white-space: normal;
    box-sizing: border-box;
    padding: 0 8px;
}
.energy-use-chart-title a:not(.fn-lnk) { color: #26374a; text-decoration: underline; }
.energy-use-charts-anchor { width: 100%; padding-left: 0; box-sizing: border-box; }
.energy-use-chart-frame {
    margin-bottom: 24px;
    min-width: 400px;
    min-height: 420px;
}
.energy-use-chart-wrap { display: flex; flex-direction: column; width: 100%; margin-bottom: 0; }
.energy-use-pie-wrap { width: 100%; }
.energy-use-bar-wrap { width: 100%; }
.energy-use-table-wrapper { display: block; width: 100%; margin-top: 12px; }
.energy-use-footnote {
    width: 100%;
    box-sizing: border-box;
    margin-top: 24px;
    font-family: var(--font-body);
    font-size: 1rem;
    line-height: 1.65;
    color: var(--gc-text);
}
.energy-use-loading, .energy-use-error { padding: 24px; font-family: 'Noto Sans', sans-serif; }
.energy-use-pie-wrap .js-plotly-plot .plotly .modebar { right: 20px !important; }
.energy-use-chart-frame details > summary:hover { background-color: #404040 !important; }
.energy-use-chart-frame button[type="button"]:hover,
.energy-use-chart-frame button:hover { background-color: #404040 !important; }
            `}</style>

            <div className="energy-use-inner">
                <h1 id="energy-use-title" className="energy-use-title page-chrome-title">
                    {getText('energy_use_title', lang)}
                </h1>
                <p className="energy-use-subtitle">
                    {subtitleText}
                </p>

                <ul className="energy-use-bullets">
                    <li>{getText('energy_use_bullet1', lang)}</li>
                    <li>{getText('energy_use_bullet2', lang)}</li>
                    <li>{getText('energy_use_bullet3', lang)}</li>
                    <li>{getText('energy_use_bullet4', lang)}</li>
                    <li>
                        {getText('energy_use_bullet5_prefix', lang)}
                        {hasData ? <strong>{formatPJ(computed.TPD, lang)}</strong> : '—'}
                        {getText('energy_use_bullet5_suffix', lang)}
                    </li>
                </ul>

                {hasData ? (
                    <>
                        <YearSelect
                            lang={lang}
                            id="energy-use-year-select"
                            className="energy-use-year-selector"
                            label={getText('year_slider_label', lang)}
                            years={yearsListDesc}
                            value={selectedYear}
                            onChange={setSelectedYear}
                        />
                        <div role="status" className="wb-inv" aria-live="polite">
                            {selectedYear ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${selectedYear}` : ''}
                        </div>

                        <div className="energy-use-charts-anchor">
                            <div className="energy-use-chart-wrap" ref={chartRef}>
                                <div className="energy-use-chart-frame page-chrome-chart-frame">
                                    <p className="energy-use-chart-title" style={{ textAlign: 'center', width: '100%', boxSizing: 'border-box', marginTop: 0, marginBottom: '1rem' }}>
                                        {pieChartTitle}
                                        <FootnoteMarker
                            lang={lang}
                            href="#fn-asterisk-energy-use"
                            id="fn-asterisk-rf-energy-use"
                            marker="*"
                            onClick={scrollToFootnote}
                        />
                                    </p>
                                    <div className="energy-use-pie-wrap" ref={pieChartRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                        {selectedSlices !== null && <ClearSelectionButton lang={lang} onClick={() => setSelectedSlices(null)} />}
                                        <figure
                                            role="region"
                                            aria-label={pieRegionLabel}
                                            tabIndex="0"
                                            style={{ width: '100%', maxWidth: 800, minWidth: 360, minHeight: 380, margin: '0 auto', position: 'relative' }}
                                        >
                                            <div aria-hidden="true">
                                            <Plot
                                                key={selectedYear}
                                                data={pieData}
                                                layout={pieLayout}
                                                config={configPie}
                                                style={{ width: '100%', minWidth: 360, minHeight: 380 }}
                                                useResizeHandler
                                                onClick={(eventData) => {
                                                    if (!eventData.points || eventData.points.length === 0) return;
                                                    const pt = eventData.points[0];
                                                    const idx = pt.pointNumber !== undefined ? pt.pointNumber : pt.pointIndex;
                                                    if (idx === undefined) return;
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
                                                        if (prev.includes(idx)) {
                                                            const next = prev.filter((p) => p !== idx);
                                                            return next.length === 0 ? null : next;
                                                        }
                                                        return [...prev, idx];
                                                    });
                                                }}
                                            />
                                            </div>
                                        </figure>
                                    </div>

                                    {pieTableRows.length > 0 && (
                                        <div className="energy-use-table-wrapper">
                                            <ChartDataTable
                                                lang={lang}
                                                label={lang === 'en' ? 'Chart data table (primary and secondary)' : 'Tableau de données du graphique (primaire et secondaire)'}
                                                columns={pieTableColumns}
                                                rows={pieTableRows}
                                                csvFilename={lang === 'en' ? 'energy_use_primary_secondary.csv' : 'consommation_energie_primaire_secondaire.csv'}
                                                docx={{
                                                    filename: lang === 'en' ? 'energy_use_primary_secondary_table.docx' : 'consommation_energie_primaire_secondaire_tableau.docx',
                                                    title: stripHtml(pieChartTitle),
                                                    titleAlign: 'center',
                                                    columnWidths: pieTableColumns.map((_, i) => (i === 0 ? 1100 : 1150)),
                                                    fontSize: 18,
                                                }}
                                                caption={pieCaption}
                                                tableAriaLabel={pieCaption}
                                                renderCell={renderTableCell}
                                            />
                                        </div>
                                    )}

                                    <p className="energy-use-chart-title" style={{ textAlign: 'center', width: '100%', boxSizing: 'border-box', marginTop: 24, marginBottom: 12 }}>
                                        {barChartTitle}
                                    </p>

                                    <div className="energy-use-bar-wrap" ref={barChartRef} style={{ width: '100%', maxWidth: 1140, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        {selectedBars !== null && <ClearSelectionButton lang={lang} onClick={() => setSelectedBars(null)} />}
                                        <figure
                                            role="region"
                                            aria-label={barRegionLabel}
                                            tabIndex="0"
                                            style={{ width: '100%', minHeight: 250, margin: '0 auto', position: 'relative' }}
                                        >
                                            <div aria-hidden="true">
                                            <Plot
                                                key={selectedYear}
                                                data={barData}
                                                layout={barLayout}
                                                config={configBar}
                                                style={{ width: '100%', minHeight: 250 }}
                                                useResizeHandler
                                                onClick={(eventData) => {
                                                    if (!eventData.points || eventData.points.length === 0) return;
                                                    const pt = eventData.points[0];
                                                    const curveNumber = pt.curveNumber;
                                                    if (curveNumber === undefined) return;
                                                    setSelectedBars((prev) => {
                                                        if (prev === null) return [curveNumber];
                                                        if (prev.includes(curveNumber)) {
                                                            const next = prev.filter((p) => p !== curveNumber);
                                                            return next.length === 0 ? null : next;
                                                        }
                                                        return [...prev, curveNumber];
                                                    });
                                                }}
                                            />
                                            </div>
                                        </figure>
                                    </div>

                                    {barTableRows.length > 0 && (
                                        <div className="energy-use-table-wrapper">
                                            <ChartDataTable
                                                lang={lang}
                                                label={lang === 'en' ? 'Chart data table (secondary by sector)' : 'Tableau de données du graphique (secondaire par secteur)'}
                                                columns={barTableColumns}
                                                rows={barTableRows}
                                                csvFilename={lang === 'en' ? 'energy_use_secondary_by_sector.csv' : 'consommation_energie_secondaire_par_secteur.csv'}
                                                docx={{
                                                    filename: lang === 'en' ? 'energy_use_secondary_by_sector_table.docx' : 'consommation_energie_secondaire_par_secteur_tableau.docx',
                                                    title: stripHtml(pieChartTitle),
                                                    titleAlign: 'center',
                                                    columnWidths: barTableColumns.map((_, i) => (i === 0 ? 1100 : 1150)),
                                                    fontSize: 18,
                                                }}
                                                caption={barCaption}
                                                tableAriaLabel={barCaption}
                                                renderCell={renderTableCell}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <p className="energy-use-no-data" style={{ fontFamily: "'Noto Sans', sans-serif", fontSize: 16 }}>
                        {getText('energy_use_no_data', lang)}
                    </p>
                )}

                {hasData && (
                    <PageFootnotes
                        lang={lang}
                        titleId="fn"
                        className="energy-use-footnote"
                        items={[
                            { id: 'fn-asterisk-energy-use', marker: '*', text: getText('energy_use_footnote', lang), returnHref: '#fn-asterisk-rf-energy-use' },
                        ]}
                    />
                )}
            </div>
        </PageShell>
    );
};

export default EnergyUse;
