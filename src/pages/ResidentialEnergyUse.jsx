import React, { useState, useEffect, useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import FootnoteMarker from '../components/FootnoteMarker';
import ClearSelectionButton from '../components/ClearSelectionButton';
import PageFootnotes from '../components/PageFootnotes';
import YearSelect from '../components/YearSelect';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getResidentialEnergyUseData, residentialEnergyUseRowHasCompleteData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import hexToRgba from '../utils/hexToRgba';

import { makeScrollToIdHandler } from '../utils/scrollToId';

const REU_BY_TYPE_ORDER = ['space_heating', 'water_heating', 'appliances', 'lighting', 'space_cooling'];
const REU_BY_TYPE_COLORS = ['#CE8003', '#4b4c4d', '#6b666a', '#1f8093', '#A687A5'];
const SOURCE_ORDER = ['natural_gas', 'electricity', 'heating_oil', 'wood', 'other'];
const SOURCE_COLORS = ['#CE8003', '#4b4c4d', '#A687A5', '#1f8093', '#949494'];
const residential_daily_lives_CHART_HEIGHT = 420;
/** Fixed margins so all three pies use the same plot area (same size). Large enough for chart 2's labels at 100% and high zoom. */
const residential_daily_lives_CHART_MARGIN = { t: 165, b: 55, l: 245, r: 245 };
/** Min width so pie doesn't shrink when viewport is narrow at high zoom. Wrapper keeps chart centered. */
const residential_daily_lives_CHART_MIN_WIDTH = 800;
/** Earliest year in the year selector and in chart data tables; newer years appear automatically from data. */
const residential_daily_lives_MIN_DISPLAY_YEAR = 2022;

const wrapLabel = (text) => {
    if (!text || text.length <= 14) return text;
    const firstSpace = text.indexOf(' ');
    if (firstSpace > 0 && firstSpace < text.length - 1) return text.slice(0, firstSpace) + '<br>' + text.slice(firstSpace + 1);
    if (text.length > 18) return text.slice(0, 18) + '<br>' + text.slice(18);
    return text;
};

const getReuLabelKey = (key) => {
    const m = { space_heating: 'residential_daily_lives_label_space_heating', water_heating: 'residential_daily_lives_label_water_heating', appliances: 'residential_daily_lives_label_appliances', lighting: 'residential_daily_lives_label_lighting', space_cooling: 'residential_daily_lives_label_space_cooling' };
    return m[key] || key;
};

const getSourceLabelKey = (key) => {
    const m = { natural_gas: 'residential_daily_lives_label_natural_gas', electricity: 'residential_daily_lives_label_electricity', heating_oil: 'residential_daily_lives_label_heating_oil', wood: 'residential_daily_lives_label_wood', other: 'residential_daily_lives_label_other' };
    return m[key] || key;
};

const getSourceLabel = (key, lang) => getText(getSourceLabelKey(key), lang);

const buildPieTrace = (categories, labelKeyFn, colors, totalVal, textSize, lang, labelOverrideFn, selectedSlices) => {
    if (!categories.length) return null;
    const getLabel = (c) => (labelOverrideFn ? labelOverrideFn(c) : getText(labelKeyFn(c.key), lang));
    const values = categories.map((c) => (c.value > 0 ? c.value : 0.001));
    const labels = categories.map((c) => {
        const raw = getLabel(c);
        if (c.key === 'space_heating' || c.key === 'water_heating') {
            const match = raw.match(/^(\S+)\s+(.*)$/);
            return match ? `${match[1]}<br>${match[2]}` : raw;
        }
        return wrapLabel(raw);
    });
    const hoverTexts = categories.map((c) => {
        const label = getLabel(c);
        return `<b>${label}</b><br>${Number(c.value).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { maximumFractionDigits: 1 })} PJ<br>${Number(c.pct).toFixed(1)}%`;
    });
    const baseColors = colors.slice(0, values.length);
    const effectiveColors = selectedSlices && selectedSlices.length > 0
        ? baseColors.map((c, i) => (selectedSlices.includes(i) ? c : hexToRgba(c, 0.3)))
        : baseColors;
    const pull = selectedSlices && selectedSlices.length > 0
        ? values.map((_, i) => (selectedSlices.includes(i) ? 0.08 : 0.02))
        : values.map(() => 0.02);
    return {
        values,
        labels,
        hoverTexts,
        customdata: categories.map((c) => c.pct),
        total: totalVal,
        texttemplate: '%{label}<br>%{customdata:.1f}%',
        textinfo: 'label+percent',
        textposition: 'outside',
        textfont: { size: textSize, family: 'Arial, sans-serif', color: effectiveColors },
        outsidetextfont: { size: textSize, color: effectiveColors },
        marker: { colors: effectiveColors, line: { color: '#fff', width: 1 } },
        pull,
        hovertext: hoverTexts,
        hoverinfo: 'text',
        hoverlabel: { bgcolor: '#fff', font: { color: '#333', size: 14 } },
    };
};

const ResidentialEnergyUse = () => {
    const { lang = 'en', layoutPadding } = useOutletContext() ?? {};
    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const windowWidth = useWindowWidth();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pickedYear, setPickedYear] = useState(null);
    const {
        selected: selectedSlices1,
        clear: clearSelection1,
        onPlotClick: onPieClick1,
    } = usePlotlySelection({ mode: 'slices', windowWidth });
    const {
        selected: selectedSlices2,
        clear: clearSelection2,
        onPlotClick: onPieClick2,
    } = usePlotlySelection({ mode: 'slices', windowWidth });
    const {
        selected: selectedSlices3,
        clear: clearSelection3,
        onPlotClick: onPieClick3,
    } = usePlotlySelection({ mode: 'slices', windowWidth });
    const chartRef1 = useRef(null);
    const chartRef2 = useRef(null);
    const chartRef3 = useRef(null);

    useEffect(() => {
        getResidentialEnergyUseData()
            .then((d) => {
                setResult(d);
            })
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    const years = useMemo(() => {
        if (!result?.data?.length) return [];
        return [...new Set(result.data.filter(residentialEnergyUseRowHasCompleteData).map((r) => r.year))]
            .filter((y) => y !== 2000 && y >= residential_daily_lives_MIN_DISPLAY_YEAR)
            .sort((a, b) => b - a);
    }, [result]);

    const selectedYear = pickedYear != null && years.includes(pickedYear) ? pickedYear : (years[0] ?? null);

    const selectedRow = useMemo(() => (result?.data && selectedYear != null ? result.data.find((r) => r.year === selectedYear) : null), [result, selectedYear]);

    const reuByTypeCategories = useMemo(() => {
        if (!selectedRow?.reuByType) return [];
        const total = selectedRow.reuByType.total ?? 0;
        return REU_BY_TYPE_ORDER.map((key) => {
            const value = selectedRow.reuByType[key] ?? 0;
            const pct = total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0;
            return { key, value, pct };
        });
    }, [selectedRow]);

    const waterHeatingCategories = useMemo(() => {
        if (!selectedRow?.waterHeating) return [];
        const wh = selectedRow.waterHeating;
        const total = wh.total ?? SOURCE_ORDER.reduce((sum, k) => sum + (Number(wh[k]) || 0), 0);
        return SOURCE_ORDER.map((key) => {
            const value = wh[key] ?? 0;
            const pct = total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0;
            return { key, value, pct };
        });
    }, [selectedRow]);

    const spaceHeatingCategories = useMemo(() => {
        if (!selectedRow?.spaceHeating) return [];
        const sh = selectedRow.spaceHeating;
        const total = sh.total ?? SOURCE_ORDER.reduce((sum, k) => sum + (Number(sh[k]) || 0), 0);
        return SOURCE_ORDER.map((key) => {
            const value = sh[key] ?? 0;
            const pct = total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0;
            return { key, value, pct };
        });
    }, [selectedRow]);

    const table1AllYearsRows = useMemo(() => {
        if (!result?.data?.length) return [];
        return [...result.data].filter((r) => residentialEnergyUseRowHasCompleteData(r) && r.year !== 2000 && r.year >= residential_daily_lives_MIN_DISPLAY_YEAR).map((r) => {
            const reu = r.reuByType || {};
            const total = reu.total ?? 0;
            const row = { year: r.year, total };
            REU_BY_TYPE_ORDER.forEach((key) => {
                row[key] = reu[key] ?? 0;
            });
            return row;
        });
    }, [result]);

    const table2AllYearsRows = useMemo(() => {
        if (!result?.data?.length) return [];
        return [...result.data].filter((r) => residentialEnergyUseRowHasCompleteData(r) && r.year !== 2000 && r.year >= residential_daily_lives_MIN_DISPLAY_YEAR).map((r) => {
            const wh = r.waterHeating || {};
            const total = wh.total ?? SOURCE_ORDER.reduce((sum, k) => sum + (Number(wh[k]) || 0), 0);
            const row = { year: r.year, total };
            SOURCE_ORDER.forEach((key) => {
                row[key] = wh[key] ?? 0;
            });
            return row;
        });
    }, [result]);

    const table3AllYearsRows = useMemo(() => {
        if (!result?.data?.length) return [];
        return [...result.data].filter((r) => residentialEnergyUseRowHasCompleteData(r) && r.year !== 2000 && r.year >= residential_daily_lives_MIN_DISPLAY_YEAR).map((r) => {
            const sh = r.spaceHeating || {};
            const total = sh.total ?? SOURCE_ORDER.reduce((sum, k) => sum + (Number(sh[k]) || 0), 0);
            const row = { year: r.year, total };
            SOURCE_ORDER.forEach((key) => {
                row[key] = sh[key] ?? 0;
            });
            return row;
        });
    }, [result]);

    const table1Columns = useMemo(() => [
        { key: 'year', header: lang === 'en' ? 'Year' : 'Année', align: 'left' },
        ...REU_BY_TYPE_ORDER.map((k) => ({
            key: k,
            header: `${getText(getReuLabelKey(k), lang)} (PJ)`,
            align: 'num',
        })),
        { key: 'total', header: lang === 'en' ? 'Total (PJ)' : 'Total (PJ)', align: 'num' },
    ], [lang]);

    const table2Columns = useMemo(() => [
        { key: 'year', header: lang === 'en' ? 'Year' : 'Année', align: 'left' },
        ...SOURCE_ORDER.map((k) => ({
            key: k,
            header: `${getSourceLabel(k, lang)} (PJ)`,
            align: 'num',
        })),
        { key: 'total', header: lang === 'en' ? 'Total (PJ)' : 'Total (PJ)', align: 'num' },
    ], [lang]);

    const table3Columns = useMemo(() => [
        { key: 'year', header: lang === 'en' ? 'Year' : 'Année', align: 'left' },
        ...SOURCE_ORDER.map((k) => ({
            key: k,
            header: `${getSourceLabel(k, lang)} (PJ)`,
            align: 'num',
        })),
        { key: 'total', header: lang === 'en' ? 'Total (PJ)' : 'Total (PJ)', align: 'num' },
    ], [lang]);

    const formatTableCell = (raw, { colIndex }) => {
        if (raw == null || raw === '') return '–';
        if (colIndex === 0) return String(raw);
        return Number(raw).toLocaleString(locale, { maximumFractionDigits: 2 });
    };

    const chart1Title = useMemo(() => {
        const t = getText('residential_daily_lives_chart1_title', lang) || '';
        return selectedYear != null ? t.replace(/\{\{year\}\}/g, String(selectedYear)) : t;
    }, [selectedYear, lang]);
    const chart2Title = useMemo(() => {
        const t = getText('residential_daily_lives_chart2_title', lang) || '';
        return selectedYear != null ? t.replace(/\{\{year\}\}/g, String(selectedYear)) : t;
    }, [selectedYear, lang]);
    const chart3Title = useMemo(() => {
        const t = getText('residential_daily_lives_chart3_title', lang) || '';
        return selectedYear != null ? t.replace(/\{\{year\}\}/g, String(selectedYear)) : t;
    }, [selectedYear, lang]);

    const exportChart1Title = stripHtml(chart1Title.replace(/\*$/g, ''));
    const exportChart2Title = stripHtml(chart2Title);
    const exportChart3Title = stripHtml(chart3Title);

    const chart1Slug = lang === 'en' ? 'residential_energy_by_type' : 'consommation_residentielle_par_type';
    const chart2Slug = lang === 'en' ? 'water_heating_by_source' : 'chauffage_eau_par_source';
    const chart3Slug = lang === 'en' ? 'space_heating_by_source' : 'chauffage_locaux_par_source';

    const scrollToFootnote = makeScrollToIdHandler('fn-asterisk-residential-energy-use');

    const selectEnabled = windowWidth > 768;
    const effectiveSlices1 = selectEnabled ? selectedSlices1 : null;
    const effectiveSlices2 = selectEnabled ? selectedSlices2 : null;
    const effectiveSlices3 = selectEnabled ? selectedSlices3 : null;

    const downloadChart1WithTitle = useChartPngDownloader(
        chartRef1,
        () => ({
        filename: `${chart1Slug}.png`,
        title: exportChart1Title,
        height: 800,
    }),
        [chart1Slug, exportChart1Title],
    );
    const downloadChart2WithTitle = useChartPngDownloader(
        chartRef2,
        () => ({
        filename: `${chart2Slug}.png`,
        title: exportChart2Title,
        height: 800,
    }),
        [chart2Slug, exportChart2Title],
    );
    const downloadChart3WithTitle = useChartPngDownloader(
        chartRef3,
        () => ({
        filename: `${chart3Slug}.png`,
        title: exportChart3Title,
        height: 800,
    }),
        [chart3Slug, exportChart3Title],
    );

    const config1 = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChart1WithTitle(gd),
    });
    const config2 = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChart2WithTitle(gd),
    });
    const config3 = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChart3WithTitle(gd),
    });

    const hasData = result && result.data?.length > 0;
    const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18;

    const plot1Trace = reuByTypeCategories.length
        ? buildPieTrace(reuByTypeCategories, getReuLabelKey, REU_BY_TYPE_COLORS, selectedRow?.reuByType?.total, textSize, lang, undefined, effectiveSlices1)
        : null;
    const plot1Data = plot1Trace ? [{ ...plot1Trace, type: 'pie', hole: 0.55, direction: 'clockwise', sort: false, automargin: false }] : [];

    const plot2Trace = waterHeatingCategories.length
        ? buildPieTrace(waterHeatingCategories, getSourceLabelKey, SOURCE_COLORS, selectedRow?.waterHeating?.total, textSize, lang, (c) => getSourceLabel(c.key, lang), effectiveSlices2)
        : null;
    const plot2Data = plot2Trace ? [{ ...plot2Trace, type: 'pie', hole: 0.55, direction: 'clockwise', sort: false, automargin: false }] : [];

    const plot3Trace = spaceHeatingCategories.length
        ? buildPieTrace(spaceHeatingCategories, getSourceLabelKey, SOURCE_COLORS, selectedRow?.spaceHeating?.total, textSize, lang, (c) => getSourceLabel(c.key, lang), effectiveSlices3)
        : null;
    const plot3Data = plot3Trace ? [{ ...plot3Trace, type: 'pie', hole: 0.55, direction: 'clockwise', sort: false, automargin: false }] : [];

    const layout1 = useMemo(() => ({
        height: residential_daily_lives_CHART_HEIGHT,
        showlegend: false,
        margin: residential_daily_lives_CHART_MARGIN,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        clickmode: 'event',
        annotations: selectedRow?.reuByType?.total != null ? [{
            text: `${lang === 'en' ? 'Total' : 'Total'}<br>${Number(selectedRow.reuByType.total).toLocaleString(locale, { maximumFractionDigits: 0 })} PJ`,
            showarrow: false,
            x: 0.5,
            y: 0.5,
            font: { size: 18, color: '#424243', family: 'Arial Black, sans-serif' },
            xref: 'paper',
            yref: 'paper',
        }] : [],
    }), [selectedRow, lang, locale]);

    const waterHeatingTotalDisplay = useMemo(() => {
        const wh = selectedRow?.waterHeating;
        if (!wh) return null;
        return wh.total ?? SOURCE_ORDER.reduce((sum, k) => sum + (Number(wh[k]) || 0), 0);
    }, [selectedRow]);
    const spaceHeatingTotalDisplay = useMemo(() => {
        const sh = selectedRow?.spaceHeating;
        if (!sh) return null;
        return sh.total ?? SOURCE_ORDER.reduce((sum, k) => sum + (Number(sh[k]) || 0), 0);
    }, [selectedRow]);

    const layout2 = useMemo(() => ({
        height: residential_daily_lives_CHART_HEIGHT,
        showlegend: false,
        margin: residential_daily_lives_CHART_MARGIN,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        clickmode: 'event',
        annotations: waterHeatingTotalDisplay != null ? [{
            text: `${lang === 'en' ? 'Total' : 'Total'}<br>${Number(waterHeatingTotalDisplay).toLocaleString(locale, { maximumFractionDigits: 0 })} PJ`,
            showarrow: false,
            x: 0.5,
            y: 0.5,
            font: { size: 18, color: '#424243', family: 'Arial Black, sans-serif' },
            xref: 'paper',
            yref: 'paper',
        }] : [],
    }), [waterHeatingTotalDisplay, lang, locale]);

    const layout3 = useMemo(() => ({
        height: residential_daily_lives_CHART_HEIGHT,
        showlegend: false,
        margin: residential_daily_lives_CHART_MARGIN,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        clickmode: 'event',
        annotations: spaceHeatingTotalDisplay != null ? [{
            text: `${lang === 'en' ? 'Total' : 'Total'}<br>${Number(spaceHeatingTotalDisplay).toLocaleString(locale, { maximumFractionDigits: 0 })} PJ`,
            showarrow: false,
            x: 0.5,
            y: 0.5,
            font: { size: 18, color: '#424243', family: 'Arial Black, sans-serif' },
            xref: 'paper',
            yref: 'paper',
        }] : [],
    }), [spaceHeatingTotalDisplay, lang, locale]);

    const table1Caption = getText('residential_daily_lives_table_caption_by_type', lang);
    const table2Caption = getText('residential_daily_lives_table_caption_water', lang);
    const table3Caption = getText('residential_daily_lives_table_caption_space', lang);

    const sourceColumnWidths = [800, ...SOURCE_ORDER.map(() => 1500), 1500];
    const typeColumnWidths = [800, ...REU_BY_TYPE_ORDER.map(() => 1500), 1500];

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-51 residential-energy-use page-chrome page-chrome--bleed"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
                .residential-energy-use-container { width: 100%; padding: 15px 0 0 0; display: flex; flex-direction: column; box-sizing: border-box; flex: 1; overflow: visible; }
                .section-four-page .page-51 .residential-energy-use-chart-frame-before-footnote { padding-bottom: 20px !important; margin-bottom: 20px !important; }
                .residential-energy-use-chart-title { font-family: var(--font-body); font-size: 20px; font-weight: bold; color: var(--gc-text); margin: 0 0 12px 0; text-align: center; max-width: 100%; overflow-wrap: break-word; word-wrap: break-word; word-break: break-word; white-space: normal; box-sizing: border-box; padding: 0 8px; }
                .residential-energy-use-chart-title a:not(.fn-lnk) { color: var(--gc-link); text-decoration: underline; }
                .residential-energy-use-footnote { margin-top: 24px; margin-bottom: 0; }
                @media (max-width: 768px) { .residential-energy-use-chart-title { font-size: 18px; } }
            `}</style>
            <div className="residential-energy-use-container">
                {loading && <p>{lang === 'en' ? 'Loading…' : 'Chargement…'}</p>}
                {error && <p style={{ color: '#c00' }}>{error}</p>}
                {!loading && !error && !hasData && <p>{getText('residential_daily_lives_no_data', lang)}</p>}
                {!loading && !error && hasData && (
                    <>
                        <YearSelect
                            lang={lang}
                            id="residential-energy-use-year-button"
                            label={getText('year_slider_label', lang)}
                            years={years}
                            value={selectedYear}
                            onChange={setPickedYear}
                        />
                        <div role="status" className="wb-inv" aria-live="polite">
                            {selectedYear != null ? (lang === 'en' ? `Showing data for ${selectedYear}` : `Données affichées pour ${selectedYear}`) : ''}
                        </div>

                        <div className="residential-energy-use-chart-frame page-chrome-chart-frame residential-energy-use-chart-frame-before-footnote">
                            <p className="residential-energy-use-chart-title" style={{ textAlign: 'center', width: '100%', boxSizing: 'border-box', margin: '0 0 1rem 0' }}>
                                {chart1Title}
                                <FootnoteMarker
                            lang={lang}
                            href="#fn-asterisk-residential-energy-use"
                            id="fn-asterisk-rf-residential-energy-use"
                            marker="*"
                            onClick={scrollToFootnote}
                        />
                            </p>
                            {effectiveSlices1 != null && effectiveSlices1.length > 0 && <ClearSelectionButton lang={lang} onClick={clearSelection1} />}
                            <div style={{ width: '100%', overflow: 'hidden', display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                                <div ref={chartRef1} role="region" aria-label={exportChart1Title} tabIndex={0} style={{ position: 'relative', overflow: 'visible', minWidth: residential_daily_lives_CHART_MIN_WIDTH, width: '100%', maxWidth: '100%', flexShrink: 0 }}>
                                    <figure style={{ width: '100%', height: residential_daily_lives_CHART_HEIGHT, margin: 0, overflow: 'visible' }}>
                                        <Plot
                                            key={selectedYear}
                                            data={plot1Data}
                                            layout={layout1}
                                            config={config1}
                                            style={{ width: '100%', height: residential_daily_lives_CHART_HEIGHT }}
                                            useResizeHandler
                                            onClick={onPieClick1}
                                        />
                                    </figure>
                                </div>
                            </div>
                            <ChartDataTable
                                lang={lang}
                                columns={table1Columns}
                                rows={table1AllYearsRows}
                                csvFilename={`${chart1Slug}.csv`}
                                docx={{
                                    filename: `${chart1Slug}.docx`,
                                    title: exportChart1Title,
                                    titleAlign: 'center',
                                    columnWidths: typeColumnWidths,
                                    fontSize: 20,
                                }}
                                caption={table1Caption}
                                tableAriaLabel={table1Caption}
                                renderCell={formatTableCell}
                            />
                        </div>

                        <div className="residential-energy-use-chart-frame page-chrome-chart-frame">
                            <p className="residential-energy-use-chart-title" style={{ textAlign: 'center', width: '100%', boxSizing: 'border-box', margin: '0 0 1rem 0' }}>{chart2Title}</p>
                            {effectiveSlices2 != null && effectiveSlices2.length > 0 && <ClearSelectionButton lang={lang} onClick={clearSelection2} />}
                            <div style={{ width: '100%', overflow: 'hidden', display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                                <div ref={chartRef2} role="region" aria-label={exportChart2Title} tabIndex={0} style={{ position: 'relative', overflow: 'visible', minWidth: residential_daily_lives_CHART_MIN_WIDTH, width: '100%', maxWidth: '100%', flexShrink: 0 }}>
                                    <figure style={{ width: '100%', height: residential_daily_lives_CHART_HEIGHT, margin: 0, overflow: 'visible' }}>
                                        <Plot
                                            key={selectedYear}
                                            data={plot2Data}
                                            layout={layout2}
                                            config={config2}
                                            style={{ width: '100%', height: residential_daily_lives_CHART_HEIGHT }}
                                            useResizeHandler
                                            onClick={onPieClick2}
                                        />
                                    </figure>
                                </div>
                            </div>
                            <ChartDataTable
                                lang={lang}
                                columns={table2Columns}
                                rows={table2AllYearsRows}
                                csvFilename={`${chart2Slug}.csv`}
                                docx={{
                                    filename: `${chart2Slug}.docx`,
                                    title: exportChart2Title,
                                    titleAlign: 'center',
                                    columnWidths: sourceColumnWidths,
                                    fontSize: 20,
                                }}
                                caption={table2Caption}
                                tableAriaLabel={table2Caption}
                                renderCell={formatTableCell}
                            />
                        </div>

                        <div className="residential-energy-use-chart-frame page-chrome-chart-frame">
                            <p className="residential-energy-use-chart-title" style={{ textAlign: 'center', width: '100%', boxSizing: 'border-box', margin: '0 0 1rem 0' }}>{chart3Title}</p>
                            {effectiveSlices3 != null && effectiveSlices3.length > 0 && <ClearSelectionButton lang={lang} onClick={clearSelection3} />}
                            <div style={{ width: '100%', overflow: 'hidden', display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                                <div ref={chartRef3} role="region" aria-label={exportChart3Title} tabIndex={0} style={{ position: 'relative', overflow: 'visible', minWidth: residential_daily_lives_CHART_MIN_WIDTH, width: '100%', maxWidth: '100%', flexShrink: 0 }}>
                                    <figure style={{ width: '100%', height: residential_daily_lives_CHART_HEIGHT, margin: 0, overflow: 'visible' }}>
                                        <Plot
                                            key={selectedYear}
                                            data={plot3Data}
                                            layout={layout3}
                                            config={config3}
                                            style={{ width: '100%', height: residential_daily_lives_CHART_HEIGHT }}
                                            useResizeHandler
                                            onClick={onPieClick3}
                                        />
                                    </figure>
                                </div>
                            </div>
                            <ChartDataTable
                                lang={lang}
                                columns={table3Columns}
                                rows={table3AllYearsRows}
                                csvFilename={`${chart3Slug}.csv`}
                                docx={{
                                    filename: `${chart3Slug}.docx`,
                                    title: exportChart3Title,
                                    titleAlign: 'center',
                                    columnWidths: sourceColumnWidths,
                                    fontSize: 20,
                                }}
                                caption={table3Caption}
                                tableAriaLabel={table3Caption}
                                renderCell={formatTableCell}
                            />
                        </div>

                        <PageFootnotes
                            lang={lang}
                            titleId="fn-residential-energy-use"
                            className="residential-energy-use-footnote"
                            items={[{
                                id: 'fn-asterisk-residential-energy-use',
                                marker: '*',
                                text: getText('residential_daily_lives_footnote_rounding', lang),
                                returnHref: '#fn-asterisk-rf-residential-energy-use',
                            }]}
                        />
                    </>
                )}
            </div>
        </PageShell>
    );
};

export default ResidentialEnergyUse;
