import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import { getOilSandsGreenhouseGasesData } from '../utils/dataLoader';

const LINE_COLOR = '#1e3a5f';

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

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
    const formatWholePercent = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        const n = Math.round(Number(value));
        return lang === 'fr' ? `${n} %` : `${n}%`;
    };
    const formatGlobalShare = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        const n = (Math.round(Number(value) * 10) / 10).toLocaleString(locale, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
        });
        return lang === 'fr' ? `${n} %` : `${n}%`;
    };
    const formatCanadaShare = (value) => formatWholePercent(value);
    const formatIntensity = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    };

    const years = useMemo(() => series.map((row) => row.year), [series]);
    const intensities = useMemo(() => series.map((row) => row.kgPerBarrel), [series]);
    const startYear = years[0];
    const endYear = years[years.length - 1];
    const yearVars = { startYear, endYear };

    const shareText = stats?.canadaShare != null && stats?.globalShare != null
        ? substitute(getText('oil_sands_greenhouse_gases_share', lang), {
            canadaShare: formatCanadaShare(stats.canadaShare),
            canadaYear: stats.canadaYear,
            globalShare: formatGlobalShare(stats.globalShare),
            globalYear: stats.globalYear,
        })
        : '';
    const decreaseText = stats?.decreasePct != null
        ? substitute(getText('oil_sands_greenhouse_gases_decrease', lang), {
            year: stats.decreaseYear,
            percent: formatWholePercent(stats.decreasePct),
        })
        : '';

    const legendLabel = getText('oil_sands_greenhouse_gases_legend', lang);
    const chartTitle = substitute(getText('oil_sands_greenhouse_gases_chart_title', lang), yearVars);
    const exportChartTitle = stripHtml(chartTitle);
    const fileSlugBase = lang === 'en'
        ? `oil_sands_emissions_intensity_${startYear}-${endYear}`
        : `intensite_emissions_sables_bitumineux_${startYear}-${endYear}`;

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('petroleum_employment_table_col_year', lang), align: 'left' },
        { key: 'kgPerBarrel', header: getText('oil_sands_greenhouse_gases_table_col_intensity', lang), align: 'num' },
    ], [lang]);

    const plotBottomMargin = windowWidth <= 480 ? 88 : windowWidth <= 768 ? 76 : 64;
    const chartHeight = windowWidth <= 480 ? 320 : windowWidth <= 768 ? 360 : 400;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 18 : 22, family: 'Arial, sans-serif', color: '#58585a' };
    const xTickvals = [];
    if (years.length) {
        for (let year = startYear; year <= endYear; year += 2) xTickvals.push(year);
        if (xTickvals[xTickvals.length - 1] !== endYear) xTickvals.push(endYear);
    }
    const maxIntensity = intensities.reduce((max, value) => Math.max(max, Number(value) || 0), 0);
    const yMax = Math.max(20, Math.ceil((maxIntensity * 1.1) / 20) * 20);

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
                .oil-sands-greenhouse-gases-body {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    color: #332f30;
                    line-height: 1.5;
                    margin: 0 0 16px 0;
                    max-width: 80ch;
                }
                .oil-sands-greenhouse-gases-cloud {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    width: fit-content;
                    margin: 8px 0 20px 0;
                }
                .oil-sands-greenhouse-gases-cloud svg { width: 140px; height: 88px; }
                .oil-sands-greenhouse-gases-cloud-value {
                    margin-top: 4px;
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 32px;
                    font-weight: 700;
                    color: #1e3a5f;
                }
                .oil-sands-greenhouse-gases-chart-title { color: var(--gc-text); margin: 0 0 12px 0; }
                .oil-sands-greenhouse-gases-chart { width: 100%; position: relative; }
                @media (max-width: 768px) {
                    .page-121.page-content h1.oil-sands-greenhouse-gases-title { font-size: 37px !important; }
                    .oil-sands-greenhouse-gases-body { font-size: 18px; }
                }
            `}</style>
            <div className="oil-sands-greenhouse-gases-container">
                <h1 id="oil-sands-greenhouse-gases-title" className="oil-sands-greenhouse-gases-title page-chrome-title">
                    {getText('oil_sands_greenhouse_gases_title', lang)}
                </h1>
                {shareText && <p className="oil-sands-greenhouse-gases-body">{shareText}</p>}
                {stats?.decreasePct != null && (
                    <div className="oil-sands-greenhouse-gases-cloud">
                        <svg viewBox="0 0 140 88" role="img" aria-label={getText('oil_sands_greenhouse_gases_cloud_label', lang)}>
                            <path
                                d="M34 62c-12 0-20-8-20-18 0-9 7-16 16-17 2-12 13-20 26-20 10 0 18 5 22 13 3-2 7-3 11-3 12 0 21 8 21 19 0 1 0 3-1 4 8 2 14 9 14 17 0 10-8 18-19 18H34z"
                                fill="#d7e6f2"
                                stroke="#1e3a5f"
                                strokeWidth="2"
                            />
                            <text x="70" y="50" textAnchor="middle" fontFamily="Noto Sans, Arial, sans-serif" fontSize="16" fontWeight="700" fill="#1e3a5f">CO₂</text>
                        </svg>
                        <div className="oil-sands-greenhouse-gases-cloud-value" aria-hidden="true">
                            ↓ {formatWholePercent(stats.decreasePct)}
                        </div>
                    </div>
                )}
                {decreaseText && <p className="oil-sands-greenhouse-gases-body">{decreaseText}</p>}
                {loadError && (
                    <p className="oil-sands-greenhouse-gases-body" role="alert">
                        {getText('oil_sands_greenhouse_gases_no_data', lang)}
                    </p>
                )}
                {years.length > 0 && (
                    <div className="oil-sands-greenhouse-gases-chart-frame page-chrome-chart-frame">
                        <h2 className="oil-sands-greenhouse-gases-chart-title page-chrome-chart-title">{chartTitle}</h2>
                        <div role="region" aria-label={getChartSummary()} tabIndex="0">
                            {selectedPoints !== null && <ClearSelectionButton lang={lang} onClick={clear} />}
                            <figure ref={chartRef} className="oil-sands-greenhouse-gases-chart" style={{ margin: 0 }}>
                                <div aria-hidden="true">
                                    <Plot
                                        data={[{
                                            x: years,
                                            y: intensities,
                                            type: 'scatter',
                                            mode: 'lines+markers',
                                            name: legendLabel,
                                            line: { color: LINE_COLOR, width: 2 },
                                            marker: {
                                                color: LINE_COLOR,
                                                size: 7,
                                                opacity: years.map((_, index) => opacityFor(0, index)),
                                            },
                                            hovertemplate: years.map((year, index) => (
                                                `<b>${legendLabel}</b><br>${year}: ${formatIntensity(intensities[index])} kg<extra></extra>`
                                            )),
                                        }]}
                                        layout={{
                                            hovermode: 'closest',
                                            clickmode: 'event',
                                            dragmode: false,
                                            showlegend: false,
                                            xaxis: {
                                                type: 'linear',
                                                tickmode: 'array',
                                                tickvals: xTickvals,
                                                ticktext: xTickvals.map(String),
                                                range: [startYear - 0.5, endYear + 0.5],
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                tickfont: tickFont,
                                                automargin: true,
                                            },
                                            yaxis: {
                                                title: {
                                                    text: getText('oil_sands_greenhouse_gases_yaxis', lang),
                                                    font: axisTitleFont,
                                                    standoff: 8,
                                                },
                                                range: [0, yMax],
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                tickfont: tickFont,
                                                automargin: true,
                                            },
                                            margin: { l: 70, r: 18, t: 24, b: plotBottomMargin },
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
                                columnWidths: [2000, 5000],
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
