import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import useWindowWidth from '../hooks/useWindowWidth';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageFootnotes from '../components/PageFootnotes';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { getWorldProvedCrudeReservesData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import WorldProvedCrudeReservesInfographic from '../components/WorldProvedCrudeReservesInfographic';
import {
    COUNTRY_LABEL_KEYS,
    COUNTRY_LABEL_FONT,
    exportWorldReservesChartPng,
    HEADLINE_FONT,
    HEADLINE_FONT_MOBILE,
    HEADLINE_SLOT,
    HEADLINE_YEAR_FONT,
    HEADLINE_YEAR_FONT_MOBILE,
    PIE_PERCENT_FONT,
    SLICE_COLORS,
    SLICE_KEYS,
} from '../components/WorldProvedCrudeReservesInfographic.constants';
import hexToRgba from '../utils/hexToRgba';

import { makeScrollToIdHandler } from '../utils/scrollToId';
import { formatLocaleNumber, formatLocalePct } from '../utils/formatLocale';

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (value, key) => value.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '–')),
        text || '',
    );

const WorldProvedCrudeReserves = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const chartRef = useRef(null);
    const infographicFigureRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });

    const formatNumber = (value, digits = 0) => formatLocaleNumber(value, lang, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });

    const formatPct = useCallback((value, digits = 0) => formatLocalePct(value, lang, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }), [lang]);

    const scrollToElement = (id) => makeScrollToIdHandler(id);

    useEffect(() => {
        getWorldProvedCrudeReservesData()
            .then((data) => {
                setResult(data);
                setSelectedYear(data?.reportingYear ?? data?.years?.[0] ?? null);
            })
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    

    const yearData = useMemo(() => {
        if (!result) return null;
        if (selectedYear != null && result.byYear?.[selectedYear]) return result.byYear[selectedYear];
        return {
            reportingYear: result.reportingYear,
            totalBb: result.totalBb,
            oilSandsSharePct: result.oilSandsSharePct,
            slices: result.slices,
        };
    }, [result, selectedYear]);

    const year = yearData?.reportingYear ?? selectedYear ?? '–';
    const textVars = { year, total: formatNumber(yearData?.totalBb, 0) };
    const chartTitle = substitute(getText('world_crude_reserves_chart_title', lang), textVars);
    const exportChartTitle = stripHtml(chartTitle);
    const downloadTitle = substitute(getText('world_crude_reserves_download_title', lang), textVars)
        .replace(/\s+/g, '_')
        .replace(/–/g, '-');
    const exportSlug = getText('world_crude_reserves_export_slug', lang);

    const slices = useMemo(() => {
        if (!yearData?.slices?.length) return [];
        return SLICE_KEYS.map((key) => yearData.slices.find((slice) => slice.key === key)).filter(Boolean);
    }, [yearData]);

    const chartLegendItems = useMemo(
        () => slices.map((slice) => ({
            key: slice.key,
            label: `${getText(COUNTRY_LABEL_KEYS[slice.key], lang)}${slice.key === 'saudi' ? '*' : ''}`,
            color: SLICE_COLORS[slice.key],
            share: formatPct(slice.sharePct, 0),
        })),
        [slices, lang, formatPct],
    );

    const effectiveSlices = windowWidth > 768 ? selectedSlices : null;
    const pieValues = slices.map((slice) => (slice.sharePct > 0 ? slice.sharePct : 0.001));
    const baseColors = slices.map((slice) => SLICE_COLORS[slice.key]);
    const pieColors = effectiveSlices?.length
        ? baseColors.map((color, index) => (effectiveSlices.includes(index) ? color : hexToRgba(color, 0.3)))
        : baseColors;
    const textSize = windowWidth <= 480
        ? PIE_PERCENT_FONT.mobile
        : windowWidth <= 768
            ? PIE_PERCENT_FONT.tablet
            : PIE_PERCENT_FONT.desktop;
    const labelFontSize = windowWidth <= 480
        ? COUNTRY_LABEL_FONT.mobile
        : windowWidth <= 768
            ? COUNTRY_LABEL_FONT.tablet
            : COUNTRY_LABEL_FONT.desktop;

    const pieTrace = slices.length
        ? {
            type: 'pie',
            values: pieValues,
            labels: slices.map(() => ''),
            direction: 'clockwise',
            rotation: 135,
            sort: false,
            texttemplate: '%{percent:.0%}',
            textinfo: 'percent',
            textposition: 'inside',
            textfont: {
                size: textSize,
                family: 'Arial, sans-serif',
                color: slices.map((slice) => (slice.key === 'canada' ? '#ffffff' : '#333333')),
            },
            marker: { colors: pieColors, line: { color: '#ffffff', width: 1 } },
            pull: effectiveSlices?.length
                ? pieValues.map((_, index) => (effectiveSlices.includes(index) ? 0.08 : 0.02))
                : pieValues.map(() => 0.02),
            hovertext: slices.map(
                (slice) => `<b>${getText(COUNTRY_LABEL_KEYS[slice.key], lang)}</b><br>${formatNumber(slice.valueBb, 0)} Bb<br>${formatPct(slice.sharePct, 0)}`,
            ),
            hoverinfo: 'text',
            hoverlabel: { bgcolor: '#ffffff', font: { color: '#333333', size: 14, family: 'Arial, sans-serif' } },
            automargin: false,
        }
        : null;

    const pieLayout = {
        showlegend: false,
        margin: { t: 2, b: 2, l: 2, r: 2 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        autosize: true,
        clickmode: 'event',
        dragmode: false,
    };

    const downloadChartWithTitle = async () => {
        const plotEl = chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotEl) return;
        try {
            const canvas = await exportWorldReservesChartPng(plotEl, {
                chartTitle: exportChartTitle,
                legendItems: chartLegendItems,
            });
            if (!canvas) return;
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `${downloadTitle}.png`;
            link.click();
        } catch (err) {
            console.warn('Unable to download chart image.', err);
        }
    };

    const pieConfig = buildPngOnlyPlotConfig({
        lang,
        click: downloadChartWithTitle,
        name: getText('world_crude_reserves_download_chart', lang),
    });

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('world_crude_reserves_table_col_year', lang), align: 'left' },
        { key: 'country', header: getText('world_crude_reserves_table_col_country', lang), align: 'left' },
        { key: 'reserves', header: getText('world_crude_reserves_table_col_reserves', lang), align: 'num' },
        { key: 'share', header: getText('world_crude_reserves_table_col_share', lang), align: 'num' },
    ], [lang]);

    const tableRows = useMemo(() => {
        if (!result?.byYear || !result.years?.length) return [];
        return result.years.flatMap((dataYear) => {
            const bucket = result.byYear[dataYear];
            const ordered = SLICE_KEYS.map((key) => bucket.slices.find((slice) => slice.key === key)).filter(Boolean);
            return ordered.map((slice) => ({
                year: dataYear,
                country: getText(COUNTRY_LABEL_KEYS[slice.key], lang),
                reserves: slice.valueBb,
                share: slice.sharePct,
            }));
        });
    }, [result, lang]);

    const tableCaption = getText('world_crude_reserves_table_caption', lang);
    const infographicAria = substitute(getText('world_crude_reserves_chart_aria', lang), textVars);

    const headlineValue = substitute(getText('world_crude_reserves_headline_value', lang), textVars);
    const headlineBarrelsWord = getText('world_crude_reserves_headline_barrels_word', lang);
    const headlineYear = substitute(getText('world_crude_reserves_headline_year', lang), textVars);
    const oilSandsPct = formatPct(yearData?.oilSandsSharePct, 0);

    const handlePieClick = (data) => {
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
            if (previous.includes(index)) return previous.length <= 1 ? null : previous.filter((item) => item !== index);
            return [...previous, index];
        });
    };

    if (loading || error) {
        return (
            <PageShell
                tabIndex="-1"
                className="page-content page-109 page-chrome page-chrome--bleed"
                aria-labelledby="world-crude-oil-proved-reserves-title"
                style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
            >
                <PageStatus lang={lang} loading={loading} error={error} />
            </PageShell>
        );
    }
    if (!yearData || !slices.length) {
        return (
            <PageShell
                tabIndex="-1"
                className="page-content page-109 page-chrome page-chrome--bleed"
                aria-labelledby="world-crude-oil-proved-reserves-title"
                style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
            >
                <p>{getText('world_crude_reserves_no_data', lang)}</p>
            </PageShell>
        );
    }

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-109 page-chrome page-chrome--bleed"
            aria-labelledby="world-crude-oil-proved-reserves-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.world-crude-oil-proved-reserves-container {
    width: 100%;
    padding: 15px 0 40px 0;
    box-sizing: border-box;
}
.world-crude-oil-proved-reserves-title {
    margin-bottom: 20px;
    line-height: 1.25;
    text-transform: none;
}
.world-crude-oil-proved-reserves-infographic-section {
    overflow: visible;
    position: relative;
}
.page-109 p.world-crude-oil-proved-reserves-headline-on-art {
    position: absolute;
    z-index: 3;
    margin: 0;
    padding: 0;
    font-family: 'Lato', sans-serif;
    font-weight: bold;
    font-size: ${HEADLINE_FONT};
    line-height: 1.2;
    text-align: left;
    pointer-events: none;
}
.page-109 p.world-crude-oil-proved-reserves-headline-on-art .world-crude-oil-proved-reserves-headline-on-art-year {
    display: block;
    font-weight: bold;
    font-size: ${HEADLINE_YEAR_FONT};
    margin-top: 0;
    color: #000000;
}
.page-109 p.world-crude-oil-proved-reserves-headline-on-art .world-crude-oil-proved-reserves-headline-on-art-value {
    color: #50809a;
}
.page-109 p.world-crude-oil-proved-reserves-headline-on-art .world-crude-oil-proved-reserves-headline-on-art-barrels {
    color: #000000;
}
.world-crude-oil-proved-reserves-chart-host {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: visible;
}
.world-crude-oil-proved-reserves-chart-host > div {
    width: 100%;
    height: 100%;
    overflow: visible;
}
.world-crude-oil-proved-reserves-chart-host .js-plotly-plot,
.world-crude-oil-proved-reserves-chart-host .plot-container,
.world-crude-oil-proved-reserves-chart-host .svg-container {
    overflow: visible !important;
}
.world-crude-oil-proved-reserves-table-wrapper { margin-top: 24px; }
@media (max-width: 768px) {
    .page-109 p.world-crude-oil-proved-reserves-headline-on-art { font-size: ${HEADLINE_FONT_MOBILE}; }
    .page-109 p.world-crude-oil-proved-reserves-headline-on-art .world-crude-oil-proved-reserves-headline-on-art-year { font-size: ${HEADLINE_YEAR_FONT_MOBILE}; }
}
            `}</style>

            <div className="world-crude-oil-proved-reserves-container">
                <h1 id="world-crude-oil-proved-reserves-title" className="world-crude-oil-proved-reserves-title page-chrome-title">{getText('world_crude_reserves_title', lang)}</h1>

                <div className="world-crude-oil-proved-reserves-infographic-section">
                    <p
                        className="world-crude-oil-proved-reserves-headline-on-art"
                        aria-hidden="true"
                        style={{
                            left: `${HEADLINE_SLOT.left}%`,
                            top: `${HEADLINE_SLOT.top}%`,
                        }}
                    >
                        <span className="world-crude-oil-proved-reserves-headline-on-art-value">{headlineValue}</span>
                        {' '}
                        <span className="world-crude-oil-proved-reserves-headline-on-art-barrels">{headlineBarrelsWord}</span>
                        <span className="world-crude-oil-proved-reserves-headline-on-art-year">{headlineYear}</span>
                    </p>
                    <WorldProvedCrudeReservesInfographic
                        figureRef={infographicFigureRef}
                        lang={lang}
                        oilSandsPct={oilSandsPct}
                        oilSandsText={getText('world_crude_reserves_oil_sands_text', lang)}
                        slices={slices}
                        labelFontSize={labelFontSize}
                        getText={getText}
                        onFootnoteClick={scrollToElement}
                        ariaLabel={infographicAria}
                        showClearSelection={effectiveSlices?.length > 0}
                        onClearSelection={() => setSelectedSlices(null)}
                        pieChart={(
                            <div ref={chartRef} className="world-crude-oil-proved-reserves-chart-host" role="img" aria-label={infographicAria}>
                                {pieTrace && (
                                    <Plot
                                        key={`world-crude-oil-proved-reserves-pie-${year}-${effectiveSlices ? effectiveSlices.join('-') : 'none'}`}
                                        data={[pieTrace]}
                                        layout={pieLayout}
                                        config={pieConfig}
                                        style={{ width: '100%', height: '100%' }}
                                        useResizeHandler
                                        onClick={handlePieClick}
                                    />
                                )}
                            </div>
                        )}
                    />
                </div>

                <div className="world-crude-oil-proved-reserves-table-wrapper">
                    <ChartDataTable
                        lang={lang}
                        columns={tableColumns}
                        rows={tableRows}
                        csvFilename={`${exportSlug}.csv`}
                        docx={{
                            filename: `${exportSlug}.docx`,
                            title: exportChartTitle,
                            titleAlign: 'center',
                            columnWidths: [900, 4800, 1600, 1400],
                            fontSize: 18,
                        }}
                        caption={tableCaption}
                        tableAriaLabel={tableCaption}
                        renderCell={(raw, { column }) => {
                            const key = column?.key;
                            if (key === 'year') return String(raw ?? '');
                            if (key === 'country') return String(raw ?? '');
                            if (key === 'reserves') return raw != null ? formatNumber(raw, 0) : '—';
                            if (key === 'share') return raw != null ? formatPct(raw, 0) : '—';
                            return String(raw ?? '');
                        }}
                    />
                </div>

                <PageFootnotes
                    lang={lang}
                    titleId="fn"
                    items={[{
                        id: 'fn-saudi-world-crude-oil-proved-reserves',
                        marker: '*',
                        text: getText('world_crude_reserves_footnote_saudi', lang),
                        returnHref: '#fn-saudi-rf-world-crude-oil-proved-reserves',
                    }]}
                />
            </div>
        </PageShell>
    );
};

export default WorldProvedCrudeReserves;
