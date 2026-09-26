import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import PageFootnotes from '../components/PageFootnotes';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useViewportZoom from '../hooks/useViewportZoom';
import useWindowWidth from '../hooks/useWindowWidth';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getElectricalEnergyUseData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import hexToRgba from '../utils/hexToRgba';

import { makeScrollToIdHandler } from '../utils/scrollToId';
import { formatLocalePct } from '../utils/formatLocale';
const SECTOR_KEYS = ['R', 'C', 'I', 'T', 'A'];
const SECTOR_LABEL_KEYS = {
    R: 'electrical_energy_use_sector_R',
    C: 'electrical_energy_use_sector_C',
    I: 'electrical_energy_use_sector_I',
    T: 'electrical_energy_use_sector_T',
    A: 'electrical_energy_use_sector_A',
};
const PROVINCE_KEYS = ['atl', 'bc_terr', 'alta', 'sask', 'man', 'ont', 'que'];
const PROVINCE_LABEL_KEYS = {
    atl: 'electrical_energy_use_label_atl',
    bc_terr: 'electrical_energy_use_label_bc_terr',
    alta: 'electrical_energy_use_label_alta',
    sask: 'electrical_energy_use_label_sask',
    man: 'electrical_energy_use_label_man',
    ont: 'electrical_energy_use_label_ont',
    que: 'electrical_energy_use_label_que',
};
const PROVINCE_FULL_LABEL_KEYS = {
    atl: 'electrical_energy_use_full_atl',
    bc_terr: 'electrical_energy_use_full_bc_terr',
    alta: 'electrical_energy_use_full_alta',
    sask: 'electrical_energy_use_full_sask',
    man: 'electrical_energy_use_full_man',
    ont: 'electrical_energy_use_full_ont',
    que: 'electrical_energy_use_full_que',
};
const COLORS = {
    atl: '#519CC8',
    bc_terr: '#63ad46',
    alta: '#779E29',
    sask: '#B36109',
    man: '#DF790C',
    ont: '#4f5f56',
    que: '#006d3b',
};

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const ElectricalEnergyUse = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const windowWidth = useWindowWidth();
    const { zoomLevel } = useViewportZoom();

    const chartRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const formatPj = (value, digits = 1) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    };

    const formatPct = (value) => formatLocalePct(value, lang, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });

    const scrollToElement = (id) => makeScrollToIdHandler(id);

    useEffect(() => {
        getElectricalEnergyUseData()
            .then((data) => {
                setResult(data);
                setSelectedYear(data?.latestYear ?? null);
            })
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    

    const dataRows = useMemo(() => result?.data || [], [result]);
    const selectedRow = useMemo(
        () => dataRows.find((row) => row.year === selectedYear) || dataRows[dataRows.length - 1] || null,
        [dataRows, selectedYear],
    );
    const year = selectedRow?.year ?? null;
    const prevRow = year != null ? dataRows.find((row) => row.year === year - 1) : null;
    const direction = prevRow && selectedRow?.total != null && prevRow.total != null && selectedRow.total < prevRow.total
        ? 'fell'
        : 'rose';

    const tableSubtitleAfterFn = substitute(
        getText(direction === 'fell' ? 'electrical_energy_use_table_subtitle_after_fn_fell' : 'electrical_energy_use_table_subtitle_after_fn_rose', lang),
        { total: formatPj(selectedRow?.total), year: year ?? '' },
    );

    const chartTitle = substitute(getText('electrical_energy_use_chart_title', lang), { year: year ?? '' });
    const exportChartTitle = stripHtml(chartTitle);
    const tableFileTitle = substitute(getText('electrical_energy_use_table_download_title', lang), { year: year ?? '' });
    const chartFileTitle = substitute(getText('electrical_energy_use_chart_download_title', lang), { year: year ?? '' });
    const chartTableCaption = substitute(getText('electrical_energy_use_chart_table_caption', lang), { year: year ?? '' });
    const sectorDocxTitle = stripHtml(`${getText('electrical_energy_use_table_subtitle_before_fn', lang)} ${tableSubtitleAfterFn}`);

    const zoomLegendMode = windowWidth <= 1000 || zoomLevel >= 1.75;
    const effectiveSlices = windowWidth > 768 ? selectedSlices : null;

    const slices = useMemo(() => {
        if (!selectedRow?.provinces?.length) return [];
        return PROVINCE_KEYS.map((key) => selectedRow.provinces.find((slice) => slice.key === key)).filter(Boolean);
    }, [selectedRow]);

    const pieValues = slices.map((slice) => (slice.value != null && slice.value > 0 ? slice.value : 0.001));
    const baseColors = slices.map((slice) => COLORS[slice.key]);
    const pieColors = effectiveSlices?.length
        ? baseColors.map((color, index) => (effectiveSlices.includes(index) ? color : hexToRgba(color, 0.3)))
        : baseColors;
    const labels = slices.map((slice) => getText(PROVINCE_LABEL_KEYS[slice.key], lang));
    const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 16;
    const outsideTextSize = zoomLegendMode ? 16 : textSize;
    const hiddenLabelKeys = ['atl'];
    const outsideLabelTemplate = slices.map((slice) => (hiddenLabelKeys.includes(slice.key) ? '' : '%{label}<br>%{percent:.1%}'));
    const zoomLabelTemplate = slices.map((slice) => (hiddenLabelKeys.includes(slice.key) ? '' : '%{percent:.1%}'));
    const atlSlice = slices.find((slice) => slice.key === 'atl');

    const pieTrace = slices.length ? {
        type: 'pie',
        values: pieValues,
        labels,
        hole: 0.55,
        direction: 'clockwise',
        rotation: 0,
        sort: false,
        texttemplate: zoomLegendMode ? zoomLabelTemplate : outsideLabelTemplate,
        textinfo: zoomLegendMode ? 'percent' : 'label+percent',
        textposition: zoomLegendMode ? 'inside' : 'outside',
        textfont: { size: textSize, family: 'Arial, sans-serif', color: zoomLegendMode ? '#ffffff' : pieColors },
        outsidetextfont: { size: outsideTextSize, color: pieColors },
        marker: { colors: pieColors, line: { color: '#ffffff', width: 1 } },
        pull: effectiveSlices?.length
            ? pieValues.map((_, index) => (effectiveSlices.includes(index) ? 0.08 : 0.02))
            : pieValues.map(() => 0.02),
        hovertext: slices.map((slice) => `<b>${getText(PROVINCE_FULL_LABEL_KEYS[slice.key], lang)}</b><br>${formatPj(slice.value)} ${getText('electrical_energy_use_center_pj', lang)}<br>${formatPct(slice.pct)}`),
        hoverinfo: 'text',
        hoverlabel: { bgcolor: '#ffffff', font: { color: '#333333', size: 14, family: 'Arial, sans-serif' } },
        automargin: true,
    } : null;

    const pieLayout = {
        showlegend: false,
        margin: {
            t: zoomLegendMode ? 80 : 95,
            b: zoomLegendMode ? 120 : 80,
            l: windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 200,
            r: windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 200,
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        height: windowWidth <= 480 ? 430 : 520,
        clickmode: 'event',
        dragmode: false,
        annotations: selectedRow?.total != null ? [{
            text: `<b>${getText('electrical_energy_use_center_total', lang)}</b><br><b>${formatPj(selectedRow.total)}</b><br>${getText('electrical_energy_use_center_pj', lang)}`,
            showarrow: false,
            x: 0.5,
            y: 0.5,
            xref: 'paper',
            yref: 'paper',
            font: { size: windowWidth <= 480 ? 15 : 18, color: '#424243', family: 'Arial Black, Arial, sans-serif' },
        }] : [],
    };

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${chartFileTitle}.png`,
        title: exportChartTitle,
        width: 1200,
        height: 800,
    }),
        [chartFileTitle, exportChartTitle],
    );

    const chartConfig = buildPngOnlyPlotConfig({
        lang,
        name: getText('electrical_energy_use_download_png', lang),
        click: (gd) => downloadChartWithTitle(gd),
    });

    const sectorTableCaption = getText('electrical_energy_use_table_caption', lang);

    const sectorTableColumns = useMemo(() => [
        { key: 'sector', header: getText('electrical_energy_use_table_col_sector', lang), align: 'left' },
        { key: 'value', header: getText('electrical_energy_use_table_col_energy', lang), align: 'num' },
        { key: 'pct', header: getText('electrical_energy_use_table_col_share', lang), align: 'num' },
    ], [lang]);

    const sectorTableRows = useMemo(() => {
        if (!selectedRow) return [];
        return [
            ...SECTOR_KEYS.map((key) => {
                const sector = selectedRow.sectors.find((item) => item.key === key);
                return {
                    sector: getText(SECTOR_LABEL_KEYS[key], lang),
                    value: sector?.value,
                    pct: sector?.pct,
                };
            }),
            {
                sector: getText('electrical_energy_use_sector_total', lang),
                value: selectedRow.total,
                pct: 100,
            },
        ];
    }, [selectedRow, lang]);

    const chartTableColumns = useMemo(() => [
        { key: 'year', header: getText('electrical_energy_use_chart_table_col_year', lang), align: 'left' },
        { key: 'region', header: getText('electrical_energy_use_chart_table_col_region', lang), align: 'left' },
        { key: 'value', header: getText('electrical_energy_use_chart_table_col_energy', lang), align: 'num' },
        { key: 'pct', header: getText('electrical_energy_use_chart_table_col_share', lang), align: 'num' },
    ], [lang]);

    const chartTableRows = useMemo(() => {
        if (!selectedRow || !slices.length) return [];
        return slices.map((slice) => ({
            year,
            region: getText(PROVINCE_FULL_LABEL_KEYS[slice.key], lang),
            value: slice.value,
            pct: slice.pct,
        }));
    }, [selectedRow, slices, year, lang]);

    const renderSectorCell = (raw, { colIndex }) => {
        if (colIndex === 0) return String(raw ?? '');
        if (colIndex === 1) return formatPj(raw);
        return formatPct(raw);
    };

    if (loading) return <PageStatus lang={lang} loading className="electricity-energy-use-loading" />;
    if (error) return <PageStatus lang={lang} error={error} className="electricity-energy-use-error" />;
    if (!selectedRow) return <p className="electricity-energy-use-error">{getText('electrical_energy_use_no_data', lang)}</p>;

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-68 electricity-energy-use page-chrome page-chrome--bleed"
            aria-labelledby="electricity-energy-use-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.page-68.electricity-energy-use {
}
.electricity-energy-use-container { width: 100%; padding: 15px 0 0 0; box-sizing: border-box; }
.electricity-energy-use-title {
    line-height: 1.25;
    text-transform: none;
}
.electricity-energy-use-main-row {
    display: flex;
    flex-direction: column;
    gap: 28px;
    align-items: stretch;
    margin-bottom: 24px;
}
.electricity-energy-use-table-col, .electricity-energy-use-chart-col { min-width: 0; width: 100%; }
.electricity-energy-use-table-subtitle {
    font-family: 'Lato', sans-serif;
    font-size: 22px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 16px 0;
    line-height: 1.35;
    text-transform: none;
}
.electricity-energy-use-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 24px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 8px 0;
    text-transform: none;
}
.electricity-energy-use-chart-scroll { width: 100%; overflow: hidden; display: flex; justify-content: center; }
.electricity-energy-use-chart { width: 100%; min-width: 0; height: 520px; position: relative; z-index: 1; overflow: visible; }
.electricity-energy-use-chart > div { width: 100%; height: 100%; overflow: visible; }
.electricity-energy-use-html-pie-label {
    position: absolute;
    z-index: 40;
    font-family: Arial, sans-serif;
    font-size: ${textSize}px;
    line-height: 1.15;
    font-weight: 400;
    text-align: center;
    pointer-events: auto;
}
.electricity-energy-use-atl-label { left: calc(50% - 72px); top: 36px; color: ${COLORS.atl}; }
.electricity-energy-use-custom-legend {
    position: relative;
    z-index: 60;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px 18px;
    flex-wrap: wrap;
    margin-top: 8px;
    margin-bottom: 8px;
    padding: 0 12px;
    font-family: Arial, sans-serif;
    font-size: 11px;
    color: var(--gc-text);
}
.electricity-energy-use-custom-legend-item { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.electricity-energy-use-custom-legend-swatch { width: 12px; height: 12px; display: inline-block; border-radius: 2px; border: 1px solid rgba(0, 0, 0, 0.15); }
.electricity-energy-use-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.electricity-energy-use-footnotes {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--gc-text);
    margin-top: 24px;
    margin-bottom: 0;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
    line-height: 1.65;
    max-width: 100%;
    box-sizing: border-box;
}
.electricity-energy-use-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 1rem;
}
.electricity-energy-use-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
.electricity-energy-use-footnotes dd p { margin: 0; }
.electricity-energy-use-loading, .electricity-energy-use-error {
    font-family: 'Noto Sans', sans-serif;
    font-size: 18px;
    color: var(--gc-text);
    margin: 24px 0;
}
@media (max-width: 768px) {
    .electricity-energy-use-table-subtitle { font-size: 20px; }
    .electricity-energy-use-chart-title { font-size: 22px; }
    .electricity-energy-use-atl-label { left: calc(50% - 58px); top: 40px; }
}
            `}</style>

            <div className="electricity-energy-use-container">
                <h1 id="electricity-energy-use-title" className="electricity-energy-use-title page-chrome-title">{getText('electrical_energy_use_title', lang)}</h1>

                <div className="electricity-energy-use-main-row">
                    <div className="electricity-energy-use-table-col">
                        <h2 className="electricity-energy-use-table-subtitle">
                            {getText('electrical_energy_use_table_subtitle_before_fn', lang)}
                            <a
                                id="fn1-rf-electricity-energy-use"
                                className="fn-lnk"
                                href="#fn1-electricity-energy-use"
                                onClick={scrollToElement('fn1-electricity-energy-use')}
                            >
                                <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>*
                            </a>
                            {tableSubtitleAfterFn}
                        </h2>
                        <ChartDataTable
                            lang={lang}
                            label={sectorTableCaption}
                            columns={sectorTableColumns}
                            rows={sectorTableRows}
                            csvFilename={`${tableFileTitle}.csv`}
                            docx={{
                                filename: `${tableFileTitle}.docx`,
                                title: sectorDocxTitle,
                                titleAlign: 'center',
                                columnWidths: [4200, 2400, 2400],
                                fontSize: 22,
                            }}
                            caption={sectorTableCaption}
                            tableAriaLabel={sectorTableCaption}
                            renderCell={renderSectorCell}
                        />
                    </div>

                    <div className="electricity-energy-use-chart-col">
                        <div className="electricity-energy-use-chart-frame page-chrome-chart-frame">
                            <h2 id="electricity-energy-use-chart-title" className="electricity-energy-use-chart-title">{chartTitle}</h2>
                            {effectiveSlices?.length > 0 && <ClearSelectionButton lang={lang} onClick={() => setSelectedSlices(null)} />}
                            <div className="electricity-energy-use-chart-scroll">
                                <figure ref={chartRef} className="electricity-energy-use-chart" role="region" aria-label={exportChartTitle} tabIndex="0" style={{ margin: 0 }}>
                                    <div aria-hidden="true">
                                        {pieTrace && (
                                            <Plot
                                                key={`electricity-energy-use-pie-${year}-${zoomLegendMode ? 'compact' : 'wide'}-${effectiveSlices ? effectiveSlices.join('-') : 'none'}`}
                                                data={[pieTrace]}
                                                layout={pieLayout}
                                                config={chartConfig}
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
                                                    setSelectedSlices((previous) => {
                                                        if (previous === null) return [index];
                                                        if (previous.includes(index)) {
                                                            return previous.length <= 1 ? null : previous.filter((item) => item !== index);
                                                        }
                                                        return [...previous, index];
                                                    });
                                                }}
                                            />
                                        )}
                                    </div>
                                    {!zoomLegendMode && atlSlice && (
                                        <span id="fn2-rf-electricity-energy-use" className="electricity-energy-use-html-pie-label electricity-energy-use-atl-label">
                                            {getText('electrical_energy_use_label_atl', lang)}
                                            <a className="fn-lnk" href="#fn2-electricity-energy-use" onClick={scrollToElement('fn2-electricity-energy-use')}>
                                                <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>*
                                            </a>
                                            <br />
                                            {formatPct(atlSlice.pct)}
                                        </span>
                                    )}
                                </figure>
                            </div>
                            {zoomLegendMode && (
                                <div className="electricity-energy-use-custom-legend" aria-label={lang === 'en' ? 'Chart legend' : 'Légende du graphique'}>
                                    {slices.map((slice) => (
                                        <span key={slice.key} className="electricity-energy-use-custom-legend-item" id={slice.key === 'atl' ? 'fn2-rf-electricity-energy-use' : undefined}>
                                            <span className="electricity-energy-use-custom-legend-swatch" style={{ backgroundColor: COLORS[slice.key] }} aria-hidden="true" />
                                            <span>{getText(PROVINCE_LABEL_KEYS[slice.key], lang)}</span>
                                            {slice.key === 'atl' && (
                                                <a className="fn-lnk" href="#fn2-electricity-energy-use" onClick={scrollToElement('fn2-electricity-energy-use')}>
                                                    <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>*
                                                </a>
                                            )}
                                            <span>{formatPct(slice.pct)}</span>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="electricity-energy-use-table-wrapper">
                                <ChartDataTable
                                    lang={lang}
                                    columns={chartTableColumns}
                                    rows={chartTableRows}
                                    csvFilename={`${chartFileTitle}.csv`}
                                    docx={{
                                        filename: `${chartFileTitle}.docx`,
                                        title: exportChartTitle,
                                        titleAlign: 'center',
                                        columnWidths: [1200, 4200, 1800, 1800],
                                        fontSize: 20,
                                    }}
                                    caption={chartTableCaption}
                                    tableAriaLabel={chartTableCaption}
                                    renderCell={(raw, { colIndex }) => {
                                        if (colIndex === 0) return String(raw ?? '');
                                        if (colIndex === 1) return String(raw ?? '');
                                        if (colIndex === 2) return formatPj(raw);
                                        return formatPct(raw);
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <PageFootnotes
                    lang={lang}
                    titleId="fn-electricity-energy-use"
                    className="electricity-energy-use-footnotes"
                    items={[
                        { id: 'fn1-electricity-energy-use', marker: '1', text: getText('electrical_energy_use_footnote1', lang), returnHref: '#fn1-rf-electricity-energy-use' },
                        { id: 'fn2-electricity-energy-use', marker: '2', text: getText('electrical_energy_use_footnote2', lang), returnHref: '#fn2-rf-electricity-energy-use' },
                    ]}
                />
            </div>
        </PageShell>
    );
};

export default ElectricalEnergyUse;
