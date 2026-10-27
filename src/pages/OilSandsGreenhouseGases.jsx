import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import AccessibleInfographic from '../components/AccessibleInfographic';
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
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import { getOilSandsGreenhouseGasesData } from '../utils/dataLoader';
import svgEn from '../assets/oil_sands_greenhouse_gases_bg.svg?raw';
import svgFr from '../assets/oil_sands_greenhouse_gases_bg_fr.svg?raw';
import chartBg from '../assets/oil_sands_greenhouse_gases_chart_bg.png';

const LINE_COLOR = '#3d6d99';

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const replaceSvgText = (markup, id, value) => {
    const safe = String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return markup.replace(
        new RegExp(`(<text\\b[^>]*\\bid="${id}"[^>]*>)[\\s\\S]*?(</text>)`),
        `$1${safe}$2`,
    );
};

const roundTo = (value, digits) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    const factor = 10 ** digits;
    return Math.round(number * factor) / factor;
};

const OilSandsGreenhouseGases = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const [series, setSeries] = useState([]);
    const [stats, setStats] = useState(null);
    const [loadError, setLoadError] = useState(false);
    const {
        selected: selectedPoints,
        clear,
        onPlotClick,
        opacityFor,
    } = usePlotlySelection({ mode: 'points', traceCount: 1, windowWidth });
    const chartRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        getOilSandsGreenhouseGasesData()
            .then((result) => {
                if (cancelled) return;
                setSeries(result?.intensity || []);
                setStats(result);
                setLoadError(!result?.intensity?.length);
            })
            .catch(() => {
                if (!cancelled) setLoadError(true);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const locale = lang === 'fr' ? 'fr-CA' : 'en-CA';
    const formatShare = (value, digits) => {
        const rounded = roundTo(value, digits);
        if (rounded == null) return '';
        const shown = rounded.toLocaleString(locale, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        });
        return lang === 'fr' ? `${shown} %` : `${shown}%`;
    };
    const formatIntensity = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    };

    const years = useMemo(() => series.map((row) => row.year), [series]);
    const intensities = useMemo(() => series.map((row) => row.kgPerBarrel), [series]);
    const startYear = years[0];
    const endYear = years[years.length - 1];
    const yearVars = { startYear, endYear };
    const canadaShareText = stats?.canadaShare != null ? formatShare(stats.canadaShare, 0) : '';
    const globalShareText = stats?.globalShare != null ? formatShare(stats.globalShare, 2) : '';
    const decreaseText = stats?.decreasePct != null ? formatShare(stats.decreasePct, 0) : '';
    const yearRangeText = startYear && endYear
        ? (lang === 'fr' ? `${startYear} à ${endYear},` : `${startYear} to ${endYear},`)
        : '';

    const shareSentence = stats?.canadaShare != null && stats?.globalShare != null
        ? substitute(getText('oil_sands_greenhouse_gases_share', lang), {
            canadaShare: canadaShareText,
            canadaYear: stats.canadaYear,
            globalShare: globalShareText,
            globalYear: stats.globalYear,
        })
        : '';
    const decreaseSentence = stats?.decreasePct != null
        ? substitute(getText('oil_sands_greenhouse_gases_decrease', lang), {
            year: stats.decreaseYear,
            percent: decreaseText,
        })
        : '';
    const resultText = getText('oil_sands_greenhouse_gases_result', lang);
    const resultEmphasis = getText('oil_sands_greenhouse_gases_result_emphasis', lang);
    const emphasisAt = resultText.indexOf(resultEmphasis);

    const legendLabel = getText('oil_sands_greenhouse_gases_legend', lang);
    const chartTitle = substitute(getText('oil_sands_greenhouse_gases_chart_title', lang), yearVars);
    const exportChartTitle = stripHtml(chartTitle);
    const fileSlugBase = lang === 'en'
        ? `oil_sands_emissions_intensity_${startYear}-${endYear}`
        : `intensite_emissions_sables_bitumineux_${startYear}-${endYear}`;

    const svgMarkup = useMemo(() => {
        if (!stats) return '';
        if (lang === 'fr') {
            return [
                ['titre-premiere-ligne', ''],
                ['titre-deuxieme-ligne', ''],
                ['part-emissions-canadiennes', canadaShareText],
                ['annee-canadienne', stats.canadaYear],
                ['part-emissions-mondiales', globalShareText],
                ['annee-mondiale', stats.globalYear],
                ['periode', yearRangeText],
                ['baisse-intensite', decreaseText],
            ].reduce((markup, [id, value]) => replaceSvgText(markup, id, value), svgFr);
        }
        return [
            ['share-of-canadian-ghg', canadaShareText],
            ['canadian-emissions-year', stats.canadaYear],
            ['global-share', globalShareText],
            ['global-emissions-year', stats.globalYear],
            ['year-range', yearRangeText],
            ['reduction-percentage', decreaseText],
        ].reduce((markup, [id, value]) => replaceSvgText(markup, id, value), svgEn);
    }, [lang, stats, canadaShareText, globalShareText, decreaseText, yearRangeText]);

    const infographicLabel = [shareSentence, decreaseSentence].filter(Boolean).join(' ');

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('petroleum_employment_table_col_year', lang), align: 'left' },
        { key: 'kgPerBarrel', header: getText('oil_sands_greenhouse_gases_table_col_intensity', lang), align: 'num' },
    ], [lang]);

    const narrow = windowWidth <= 768;
    const plotBottomMargin = narrow ? 72 : 56;
    const chartHeight = windowWidth <= 480 ? 320 : windowWidth <= 768 ? 360 : 400;
    const tickFont = { size: narrow ? 13 : 15, family: 'Arial, sans-serif', color: '#333' };
    const axisTitleFont = { size: narrow ? 16 : 20, family: 'Arial, sans-serif', color: '#58585a' };
    const xTickvals = [];
    if (years.length) {
        const step = windowWidth <= 480 ? 4 : 2;
        for (let year = startYear; year <= endYear; year += step) xTickvals.push(year);
        if (xTickvals[xTickvals.length - 1] !== endYear) xTickvals.push(endYear);
    }
    const dataMin = intensities.reduce((min, value) => Math.min(min, Number(value) || min), Infinity);
    const dataMax = intensities.reduce((max, value) => Math.max(max, Number(value) || 0), 0);
    const yMin = dataMin >= 70 && dataMax <= 110 ? 70 : Math.floor((dataMin - 2) / 5) * 5;
    const yMax = dataMin >= 70 && dataMax <= 110 ? 110 : Math.ceil((dataMax + 2) / 5) * 5;
    const yTickvals = [];
    for (let value = yMin; value <= yMax; value += 5) yTickvals.push(value);

    const getChartSummary = () => joinChartSummary({
        intro: exportChartTitle,
        unitNote: lang === 'en' ? 'Kilograms of CO2 equivalent per barrel' : 'Kilogrammes d’équivalent CO2 par baril',
        body: summarizeByCategory({
            categories: years,
            series: [{ name: legendLabel, values: intensities, format: formatIntensity }],
            lang,
            newestFirst: true,
        }),
        lang,
    });

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
            filename: `${fileSlugBase}.png`,
            title: exportChartTitle,
            height: 640,
            legendItems: [{ label: legendLabel, color: LINE_COLOR }],
        }),
        [LINE_COLOR, exportChartTitle, fileSlugBase, legendLabel],
    );
    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const chartImages = useMemo(() => ([{
        source: chartBg,
        xref: 'paper',
        yref: 'paper',
        x: 0.5,
        y: 0.5,
        sizex: 0.92,
        sizey: 0.78,
        xanchor: 'center',
        yanchor: 'middle',
        sizing: 'contain',
        layer: 'below',
    }]), []);

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-121 page-chrome page-chrome--bleed"
            aria-labelledby="oil-sands-greenhouse-gases-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
                .oil-sands-greenhouse-gases-container { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
                .page-121.page-content h1.oil-sands-greenhouse-gases-title { font-size: 41px !important; }
                .oil-sands-greenhouse-gases-stage { position: relative; width: 100%; margin: 8px 0 20px 0; container-type: inline-size; }
                .oil-sands-greenhouse-gases-stage .accessible-infographic-svg svg { width: 100%; height: auto; display: block; }
                .oil-sands-greenhouse-gases-result {
                    position: absolute;
                    left: 1.5%;
                    bottom: 3%;
                    width: 44%;
                    margin: 0;
                    z-index: 2;
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 1.55cqw;
                    line-height: 1.35;
                    color: #333;
                }
                .oil-sands-greenhouse-gases-chart { width: 100%; margin: 0; }
                @media (max-width: 768px) {
                    .page-121.page-content h1.oil-sands-greenhouse-gases-title { font-size: 37px !important; }
                    .oil-sands-greenhouse-gases-result {
                        position: relative;
                        left: auto;
                        bottom: auto;
                        width: 100%;
                        margin-top: 12px;
                        font-size: 16px;
                    }
                }
            `}</style>
            <div className="oil-sands-greenhouse-gases-container">
                <h1 id="oil-sands-greenhouse-gases-title" className="oil-sands-greenhouse-gases-title page-chrome-title">
                    {getText('oil_sands_greenhouse_gases_title', lang)}
                </h1>
                {loadError && (
                    <p role="alert">{getText('oil_sands_greenhouse_gases_no_data', lang)}</p>
                )}
                {svgMarkup && (
                    <div className="oil-sands-greenhouse-gases-stage">
                        <AccessibleInfographic
                            mode="text"
                            svgMarkup={svgMarkup}
                            label={infographicLabel}
                        />
                        {resultText && (
                            <p className="oil-sands-greenhouse-gases-result">
                                {emphasisAt >= 0 ? (
                                    <>
                                        {resultText.slice(0, emphasisAt)}
                                        <strong>{resultEmphasis}</strong>
                                        {resultText.slice(emphasisAt + resultEmphasis.length)}
                                    </>
                                ) : resultText}
                            </p>
                        )}
                    </div>
                )}
                {years.length > 0 && (
                    <div className="oil-sands-greenhouse-gases-chart-frame page-chrome-chart-frame">
                        <h2 className="oil-sands-greenhouse-gases-chart-title page-chrome-chart-title">{chartTitle}</h2>
                        {selectedPoints !== null && <ClearSelectionButton lang={lang} onClick={clear} />}
                        <div role="region" aria-label={getChartSummary()} tabIndex="0">
                            <figure ref={chartRef} className="oil-sands-greenhouse-gases-chart">
                                <div aria-hidden="true">
                                    <Plot
                                        data={[{
                                            x: years,
                                            y: intensities,
                                            type: 'scatter',
                                            mode: 'lines+markers',
                                            name: legendLabel,
                                            line: { color: LINE_COLOR, width: 2.5 },
                                            marker: {
                                                color: LINE_COLOR,
                                                size: 8,
                                                opacity: years.map((_, index) => opacityFor(0, index)),
                                            },
                                            hovertemplate: years.map((year, index) => (
                                                `<b>${legendLabel}</b><br>${year}: ${formatIntensity(intensities[index])} kg<extra></extra>`
                                            )),
                                        }]}
                                        layout={{
                                            hoverlabel: {
                                                bgcolor: '#ffffff',
                                                bordercolor: '#cccccc',
                                                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
                                            },
                                            hovermode: 'closest',
                                            clickmode: 'event',
                                            dragmode: false,
                                            showlegend: false,
                                            images: chartImages,
                                            xaxis: {
                                                type: 'linear',
                                                tickmode: 'array',
                                                tickvals: xTickvals,
                                                ticktext: xTickvals.map(String),
                                                range: [startYear - 0.6, endYear + 0.6],
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                ticks: 'inside',
                                                ticklen: 5,
                                                tickwidth: 1,
                                                tickcolor: '#333',
                                                mirror: false,
                                                tickfont: tickFont,
                                                automargin: true,
                                            },
                                            yaxis: {
                                                title: {
                                                    text: getText('oil_sands_greenhouse_gases_yaxis', lang),
                                                    font: axisTitleFont,
                                                    standoff: 8,
                                                },
                                                range: [yMin - 0.4, yMax + 0.4],
                                                tickmode: 'array',
                                                tickvals: yTickvals,
                                                ticktext: yTickvals.map(String),
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                ticks: 'inside',
                                                ticklen: 5,
                                                tickwidth: 1,
                                                tickcolor: '#333',
                                                mirror: false,
                                                tickfont: tickFont,
                                                automargin: true,
                                            },
                                            margin: { l: lang === 'fr' ? 90 : 72, r: 24, t: 16, b: plotBottomMargin },
                                            autosize: true,
                                            paper_bgcolor: 'rgba(0,0,0,0)',
                                            plot_bgcolor: 'rgba(0,0,0,0)',
                                        }}
                                        config={plotConfig}
                                        style={{ width: '100%', height: `${chartHeight}px` }}
                                        useResizeHandler
                                        onClick={onPlotClick}
                                    />
                                </div>
                            </figure>
                        </div>
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={series}
                            csvFilename={`${fileSlugBase}.csv`}
                            docx={{
                                filename: `${fileSlugBase}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [1800, 5400],
                                fontSize: 22,
                            }}
                            caption={substitute(getText('oil_sands_greenhouse_gases_table_caption', lang), yearVars)}
                            tableAriaLabel={substitute(getText('oil_sands_greenhouse_gases_chart_aria', lang), yearVars)}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : formatIntensity(raw)
                            )}
                        />
                    </div>
                )}
            </div>
        </PageShell>
    );
};

export default OilSandsGreenhouseGases;
