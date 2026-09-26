import React, { useState, useEffect, useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import FootnoteMarker from '../components/FootnoteMarker';
import ClearSelectionButton from '../components/ClearSelectionButton';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getInternationalInvestmentData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';

import { makeScrollToIdHandler } from '../utils/scrollToId';
import { formatLocaleNumber } from '../utils/formatLocale';
const international_investment_COLORS = {
    cdia: '#419563',
    fdi: '#2EA3AD',
};

const InternationalInvestment = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const {
        selected: selectedPoints,
        clear: clearSelection,
        onPlotClick: handleChartClick,
    } = usePlotlySelection({ mode: 'points', traceCount: 2, windowWidth });
    const chartRef = useRef(null);

    const scrollToFootnote = makeScrollToIdHandler('fn-asterisk-international-investment');

    const scrollToRef = makeScrollToIdHandler('fn-asterisk-rf-international-investment');

    useEffect(() => {
        getInternationalInvestmentData()
            .then((data) => {
                setPageData(data);
            })
            .catch((err) => {
                console.error('Failed to load international investment data:', err);
                setError(err.message || 'Failed to load data');
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    

    const pageTitle = getText('international_investment_title', lang);
    const chartTitle = getText('international_investment_chart_title', lang);
    const exportPageTitle = stripHtml(pageTitle);
    const exportChartTitle = stripHtml(chartTitle);
    const chartDownloadSlug = lang === 'en' ? 'fdi_investment' : 'ide_investissement';
    const cdiaLabel = getText('international_investment_legend_cdia', lang);
    const fdiLabel = getText('international_investment_legend_fdi', lang);
    const yAxisTitle = getText('international_investment_yaxis', lang);
    const unitHeader = lang === 'en' ? '($ billions)' : '(milliards $)';

    const tableCaption = lang === 'en'
        ? 'Stock of foreign direct investment (FDI) in Canada and Canadian direct investment abroad (CDIA) in the energy industry (billions of dollars)'
        : "Stock d'investissement direct étranger (IDE) au Canada et investissement direct canadien à l'étranger (IDCE) dans le secteur de l'énergie (milliards de dollars)";

    const formatNumber = (val) => {
        if (val == null || Number.isNaN(Number(val))) return '—';
        const num = Number(val);
        const decimals = num < 1 ? 2 : 1;
        return formatLocaleNumber(num, lang, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
    };

    const tableColumns = useMemo(() => [
        { key: 'year', header: lang === 'en' ? 'Year' : 'Année', align: 'left' },
        { key: 'cdia', header: `${cdiaLabel} ${unitHeader}`, align: 'num' },
        { key: 'fdi', header: `${fdiLabel} ${unitHeader}`, align: 'num' },
    ], [lang, cdiaLabel, fdiLabel, unitHeader]);

    const tableRows = useMemo(
        () => pageData.map((yearData) => ({
            year: yearData.year,
            cdia: yearData.cdia_billions ?? ((yearData.cdia || 0) / 1000),
            fdi: yearData.fdi_billions ?? ((yearData.fdi || 0) / 1000),
        })),
        [pageData],
    );

    const bulletValues = useMemo(() => {
        if (pageData.length < 2) return null;
        const latestYear = pageData[pageData.length - 1];
        const prevYear = pageData[pageData.length - 2];
        const fdiLatest = latestYear.fdi_billions ?? ((latestYear.fdi || 0) / 1000);
        const fdiPrev = prevYear.fdi_billions ?? ((prevYear.fdi || 0) / 1000);
        const cdiaLatest = latestYear.cdia_billions ?? ((latestYear.cdia || 0) / 1000);
        const cdiaPrev = prevYear.cdia_billions ?? ((prevYear.cdia || 0) / 1000);
        const fdiGrowth = fdiPrev > 0 ? ((fdiLatest - fdiPrev) / fdiPrev * 100) : 0;
        const cdiaGrowth = cdiaPrev > 0 ? ((cdiaLatest - cdiaPrev) / cdiaPrev * 100) : 0;
        const energyShare = 10;
        const oilGasCdia = Math.round(cdiaLatest * 0.168);
        return {
            year: latestYear.year,
            prevYear: prevYear.year,
            fdi: Math.round(fdiLatest),
            fdiGrowth: fdiGrowth.toFixed(1),
            energyShare,
            cdia: Math.round(cdiaLatest),
            cdiaGrowth: Math.round(cdiaGrowth),
            oilGasCdia,
        };
    }, [pageData]);

    const chartData = useMemo(() => {
        if (pageData.length === 0) return null;

        const years = pageData.map((d) => d.year);
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);

        const tickVals = [];
        for (let y = 2008; y <= maxYear; y += 2) {
            tickVals.push(y);
        }

        const cdiaValues = pageData.map((d) => d.cdia_billions ?? ((d.cdia || 0) / 1000));
        const fdiValues = pageData.map((d) => d.fdi_billions ?? ((d.fdi || 0) / 1000));

        const cdiaHoverText = cdiaValues.map((v, i) => {
            const vFormatted = v < 1 ? v.toFixed(2) : v.toFixed(1);
            return `<b>${getText('international_investment_hover_cdia', lang)}</b><br>${years[i]}: $${vFormatted}B`;
        });

        const fdiHoverText = fdiValues.map((v, i) => {
            const vFormatted = v < 1 ? v.toFixed(2) : v.toFixed(1);
            return `<b>${getText('international_investment_hover_fdi', lang)}</b><br>${years[i]}: $${vFormatted}B`;
        });

        const traces = [
            {
                name: cdiaLabel,
                x: years,
                y: cdiaValues,
                type: 'bar',
                marker: {
                    color: international_investment_COLORS.cdia,
                    opacity: selectedPoints === null ? 1 : years.map((_, i) => (selectedPoints[0]?.includes(i) ? 1 : 0.3)),
                },
                hovertext: cdiaHoverText,
                hoverinfo: 'text',
                hoverlabel: {
                    bgcolor: '#ffffff',
                    bordercolor: '#000000',
                    font: { color: '#000000', size: windowWidth <= 480 ? 12 : 14, family: 'Arial, sans-serif' },
                },
            },
            {
                name: fdiLabel,
                x: years,
                y: fdiValues,
                type: 'bar',
                marker: {
                    color: international_investment_COLORS.fdi,
                    opacity: selectedPoints === null ? 1 : years.map((_, i) => (selectedPoints[1]?.includes(i) ? 1 : 0.3)),
                },
                hovertext: fdiHoverText,
                hoverinfo: 'text',
                hoverlabel: {
                    bgcolor: '#ffffff',
                    bordercolor: '#000000',
                    font: { color: '#000000', size: windowWidth <= 480 ? 12 : 14, family: 'Arial, sans-serif' },
                },
            },
        ];

        return { traces, years, tickVals, minYear, maxYear, cdiaValues, fdiValues };
    }, [pageData, lang, windowWidth, selectedPoints, cdiaLabel, fdiLabel]);

    const formatBillionSR = (val) => {
        const decimals = val < 1 ? 2 : 1;
        return lang === 'en'
            ? `${val.toFixed(decimals)} billion dollars`
            : `${val.toFixed(decimals)} milliards de dollars`;
    };

    const getChartDataSummary = () => {
        if (!pageData || pageData.length === 0) return '';

        const latestYear = pageData[pageData.length - 1];
        const latestYearNum = latestYear.year;
        const latestCDIA = latestYear.cdia_billions ?? ((latestYear.cdia || 0) / 1000);
        const latestFDI = latestYear.fdi_billions ?? ((latestYear.fdi || 0) / 1000);

        if (lang === 'en') {
            return `Grouped bar chart showing stock of foreign direct investment in Canada and Canadian direct investment abroad in the energy industry from ${chartData?.minYear} to ${latestYearNum}. In ${latestYearNum}, Canadian direct investment abroad was approximately ${formatBillionSR(latestCDIA)} and foreign direct investment was approximately ${formatBillionSR(latestFDI)}. Expand the data table below for detailed values.`;
        }
        return `Graphique à barres groupées montrant le stock d'investissement direct étranger au Canada et l'investissement direct canadien à l'étranger dans le secteur de l'énergie de ${chartData?.minYear} à ${latestYearNum}. En ${latestYearNum}, l'investissement direct canadien à l'étranger était d'environ ${formatBillionSR(latestCDIA)} et l'investissement direct étranger était d'environ ${formatBillionSR(latestFDI)}. Développez le tableau de données ci-dessous pour les valeurs détaillées.`;
    };

    const renderTextWithFootnoteLink = (text) => {
        if (!text) return null;
        if (!text.includes('*')) return text;
        const parts = text.split('*');
        return parts.map((part, index) => (
            <React.Fragment key={index}>
                {part}
                {index < parts.length - 1 && (
                    <FootnoteMarker
                            lang={lang}
                            href="#fn-asterisk-international-investment"
                            id="fn-asterisk-rf-international-investment"
                            marker="*"
                            onClick={scrollToFootnote}
                        />
                )}
            </React.Fragment>
        ));
    };

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${chartDownloadSlug}.png`,
        title: exportChartTitle,
        width: 1200,
        height: 600,
        legendItems: [
            { label: cdiaLabel, color: international_investment_COLORS.cdia },
            { label: fdiLabel, color: international_investment_COLORS.fdi },
        ],
    }),
        [cdiaLabel, chartDownloadSlug, exportChartTitle, fdiLabel, international_investment_COLORS],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    if (loading || error) {
        return (
            <PageStatus
                lang={lang}
                loading={loading}
                error={error}
                style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
            />
        );
    }

    if (!chartData) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>No data available. Please refresh the page.</div>;
    }

    return (
        <PageShell
            id="main-content"
            tabIndex="-1"
            className="page-content page-31 international-investment page-chrome page-chrome--bleed"
            aria-label={pageTitle}
            style={{
                backgroundColor: 'white',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                overflowX: 'visible',
                boxSizing: 'border-box',
                ...layoutBleedCssVars(layoutPadding),
            }}
        >
            <style>{`
                .international-investment-container {
                    width: 100%;
                    padding: 15px 0 0 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    flex: 1;
                    overflow: visible;
                }

                .international-investment-chart {
                    width: 100%;
                    height: 400px;
                    position: relative;
                    z-index: 1;
                }

                .international-investment-title {
                    color: #8a7d5a;
                    font-size: 50px;
                }

                .international-investment-subtitle {
                    font-family: 'Noto Sans', sans-serif;
                    color: #332f30;
                    font-size: 20px;
                    margin-bottom: 15px;
                    line-height: 1.5;
                    max-width: 100%;
                }

                .international-investment-bullets {
                    font-family: 'Noto Sans', sans-serif;
                    color: var(--gc-text);
                    font-size: 20px;
                    margin-bottom: 15px;
                    line-height: 1.6;
                    list-style-type: disc;
                    padding-left: 20px;
                }

                .international-investment-bullets li {
                    margin-bottom: 8px;
                }

                .international-investment-bullets li::marker {
                    font-size: 1rem;
                }

                .international-investment-bullets .visual-bold {
                    font-weight: bold;
                }

                .international-investment-chart-title {
                    color: var(--gc-text);
                    margin-bottom: 5px;
                }

                .international-investment-chart-frame {
                    margin-bottom: 0;
                }

                .international-investment-legend {
                    display: flex;
                    justify-content: center;
                    gap: 30px;
                    margin-top: 20px;
                    margin-bottom: 20px;
                    font-family: Arial, sans-serif;
                    position: relative;
                    z-index: 10;
                    background-color: #f5f5f5;
                    padding: 10px 0;
                }

                .international-investment-legend-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .international-investment-legend-color {
                    width: 20px;
                    height: 12px;
                    display: inline-block;
                }

                .international-investment-legend-label {
                    font-size: 18px;
                    color: var(--gc-text);
                }

                .international-investment-table-wrapper {
                    display: block;
                    width: 100%;
                    margin: 0;
                    position: relative;
                    z-index: 10;
                    background-color: #f5f5f5;
                }

                .international-investment-chart-frame button[type="button"]:hover,
                .international-investment-chart-frame button:hover {
                    background-color: #404040 !important;
                }

                @media (max-width: 1536px) {
                    .international-investment-title { font-size: 1.8rem; }
                }

                @media (max-width: 1280px) {
                    .international-investment-title { font-size: 1.6rem; }
                }

                @media (max-width: 1097px) {
                    .international-investment-title { font-size: 1.5rem; }
                    .international-investment-subtitle { font-size: 1.2rem; }
                }

                @media (max-width: 960px) {
                    .international-investment-title { font-size: 1.4rem; }
                    .international-investment-subtitle { font-size: 1.2rem; }
                }

                @media (max-width: 768px) {
                    .international-investment-title {
                        font-size: 37px;
                        text-align: left !important;
                    }
                    .international-investment-subtitle {
                        font-size: 18px;
                        text-align: left !important;
                    }
                    .international-investment-bullets { font-size: 18px; }
                }

                @media (max-width: 640px) {
                    .international-investment-title { font-size: 1.2rem; }
                    .international-investment-subtitle { font-size: 1.2rem; }
                }

                @media (max-width: 480px) {
                    .international-investment-title { font-size: 1.1rem; }
                    .international-investment-subtitle { font-size: 1.2rem; }
                    .international-investment-legend-label { font-size: 14px; }
                }

                @media (max-width: 384px) {
                    .international-investment-title { font-size: 1rem; }
                    .international-investment-subtitle { font-size: 1.2rem; }
                }
            `}</style>

            <div className="international-investment-container">
                <header role="region" aria-label={exportPageTitle}>
                    <h1 className="international-investment-title page-chrome-title" aria-hidden="true">
                        {pageTitle}
                    </h1>
                    <p className="international-investment-subtitle">
                        {getText('international_investment_subtitle', lang)}
                    </p>
                </header>

                {bulletValues && (
                    <ul className="international-investment-bullets" role="list">
                        <li role="listitem" aria-label={lang === 'en'
                            ? `${getText('foreign_control_bullet1_part1', lang)}${getText('foreign_control_bullet1_part2', lang)}${getText('foreign_control_bullet1_part3', lang)}${bulletValues.year}${getText('foreign_control_bullet1_part4', lang)}${bulletValues.fdi}${getText('foreign_control_bullet1_part5', lang)} (+${bulletValues.fdiGrowth}% over the previous year)`
                            : `${getText('foreign_control_bullet1_part1', lang)}${getText('foreign_control_bullet1_part2', lang)}${getText('foreign_control_bullet1_part3', lang)}${bulletValues.fdi}${getText('foreign_control_bullet1_part4', lang)}${getText('foreign_control_bullet1_part5', lang)}${bulletValues.year} (+${bulletValues.fdiGrowth}% par rapport à l'année précédente)`
                        }>
                            <span aria-hidden="true">
                                {lang === 'en' ? (
                                    <>
                                        {getText('foreign_control_bullet1_part1', lang)}
                                        <span className="visual-bold">{getText('foreign_control_bullet1_part2', lang)}</span>
                                        {getText('foreign_control_bullet1_part3', lang)}
                                        {bulletValues.year}
                                        {getText('foreign_control_bullet1_part4', lang)}
                                        <span className="visual-bold">${bulletValues.fdi}{getText('foreign_control_bullet1_part5', lang)}</span>
                                        {' (+'}
                                        {bulletValues.fdiGrowth}
                                        {'% over the previous year).'}
                                    </>
                                ) : (
                                    <>
                                        {getText('foreign_control_bullet1_part1', lang)}
                                        <span className="visual-bold">{getText('foreign_control_bullet1_part2', lang)}</span>
                                        {getText('foreign_control_bullet1_part3', lang)}
                                        <span className="visual-bold">{bulletValues.fdi}{getText('foreign_control_bullet1_part4', lang)}</span>
                                        {getText('foreign_control_bullet1_part5', lang)}
                                        {bulletValues.year}
                                        {' (+'}
                                        {bulletValues.fdiGrowth}
                                        {"% par rapport à l'année précédente)."}
                                    </>
                                )}
                            </span>
                        </li>
                        <li role="listitem" aria-label={`${getText('foreign_control_bullet2_part1', lang)} ${bulletValues.energyShare}${getText('foreign_control_bullet2_part2', lang)}${bulletValues.year}${getText('foreign_control_bullet2_part3', lang)}${bulletValues.prevYear}${getText('foreign_control_bullet2_part4', lang)}`}>
                            <span aria-hidden="true">
                                {getText('foreign_control_bullet2_part1', lang)}
                                <span className="visual-bold">{bulletValues.energyShare}</span>
                                {getText('foreign_control_bullet2_part2', lang)}
                                {bulletValues.year}
                                {getText('foreign_control_bullet2_part3', lang)}
                                {bulletValues.prevYear}
                                {getText('foreign_control_bullet2_part4', lang)}
                            </span>
                        </li>
                        <li role="listitem" aria-label={lang === 'en'
                            ? `${getText('foreign_control_bullet3_part1', lang)}${getText('foreign_control_bullet3_part2', lang)}${getText('foreign_control_bullet3_part3', lang)}${bulletValues.cdia}${getText('foreign_control_bullet3_part4', lang)}${getText('foreign_control_bullet3_part5', lang)}${bulletValues.year}${getText('foreign_control_bullet3_part6', lang)}${bulletValues.cdiaGrowth}${getText('foreign_control_bullet3_part7', lang)}${bulletValues.prevYear}${getText('foreign_control_bullet3_part8', lang)}`
                            : `${getText('foreign_control_bullet3_part1', lang)}${getText('foreign_control_bullet3_part2', lang)}${getText('foreign_control_bullet3_part3', lang)}${bulletValues.cdia}${getText('foreign_control_bullet3_part4', lang)}${getText('foreign_control_bullet3_part5', lang)}${bulletValues.year}${getText('foreign_control_bullet3_part6', lang)}${bulletValues.cdiaGrowth}${getText('foreign_control_bullet3_part7', lang)}${bulletValues.prevYear}${getText('foreign_control_bullet3_part8', lang)}`
                        }>
                            <span aria-hidden="true">
                                {getText('foreign_control_bullet3_part1', lang)}
                                <span className="visual-bold">{getText('foreign_control_bullet3_part2', lang)}</span>
                                {getText('foreign_control_bullet3_part3', lang)}
                                <span className="visual-bold">${bulletValues.cdia}{getText('foreign_control_bullet3_part4', lang)}</span>
                                {getText('foreign_control_bullet3_part5', lang)}
                                {bulletValues.year}
                                {getText('foreign_control_bullet3_part6', lang)}
                                {bulletValues.cdiaGrowth}
                                {getText('foreign_control_bullet3_part7', lang)}
                                {bulletValues.prevYear}
                                {getText('foreign_control_bullet3_part8', lang)}
                            </span>
                        </li>
                        <li role="listitem" aria-label={lang === 'en'
                            ? `${getText('foreign_control_bullet4_part1', lang)}${bulletValues.oilGasCdia}${getText('foreign_control_bullet4_part2', lang)}${getText('foreign_control_bullet4_part3', lang)}${bulletValues.year}${getText('foreign_control_bullet4_part4', lang)}`
                            : `${getText('foreign_control_bullet4_part1', lang)}${bulletValues.oilGasCdia}${getText('foreign_control_bullet4_part2', lang)}${getText('foreign_control_bullet4_part3', lang)}${bulletValues.year}${getText('foreign_control_bullet4_part4', lang)}`
                        }>
                            <span aria-hidden="true">
                                {getText('foreign_control_bullet4_part1', lang)}
                                <span className="visual-bold">${bulletValues.oilGasCdia}{getText('foreign_control_bullet4_part2', lang)}</span>
                                {getText('foreign_control_bullet4_part3', lang)}
                                {bulletValues.year}
                                {getText('foreign_control_bullet4_part4', lang)}
                            </span>
                        </li>
                    </ul>
                )}

                <div className="international-investment-chart-frame page-chrome-chart-frame">
                    <h2 className="international-investment-chart-title page-chrome-chart-title">
                        {renderTextWithFootnoteLink(chartTitle)}
                    </h2>

                    <div
                        role="region"
                        aria-label={getChartDataSummary()}
                        tabIndex="0"
                    >
                        {selectedPoints !== null && (
                            <ClearSelectionButton lang={lang} onClick={clearSelection} />
                        )}
                        <figure
                            ref={chartRef}
                            className="international-investment-chart"
                            style={{ margin: 0, position: 'relative' }}
                        >
                            <div aria-hidden="true">
                                <Plot
                                    data={chartData.traces}
                                    layout={{
                                        barmode: 'group',
                                        hovermode: 'closest',
                                        clickmode: 'event',
                                        dragmode: false,
                                        xaxis: {
                                            tickvals: chartData.tickVals,
                                            showgrid: false,
                                            zeroline: false,
                                            range: [chartData.minYear - 0.5, chartData.maxYear + 0.5],
                                            tickangle: windowWidth <= 640 ? -45 : 0,
                                            tickfont: { size: windowWidth <= 480 ? 10 : 12, family: 'Arial, sans-serif' },
                                            automargin: true,
                                        },
                                        yaxis: {
                                            title: {
                                                text: yAxisTitle,
                                                font: { size: windowWidth <= 768 ? 18 : windowWidth <= 960 ? 20 : 24, family: 'Arial, sans-serif', color: '#58585a' },
                                                standoff: 5,
                                            },
                                            rangemode: 'tozero',
                                            showgrid: false,
                                            showline: true,
                                            linewidth: 1,
                                            linecolor: '#333',
                                            automargin: true,
                                            tickfont: { size: windowWidth <= 480 ? 9 : 11, family: 'Arial, sans-serif' },
                                        },
                                        showlegend: false,
                                        margin: {
                                            l: 0,
                                            r: 0,
                                            t: 40,
                                            b: 60,
                                        },
                                        autosize: true,
                                        bargap: 0.15,
                                        bargroupgap: 0.1,
                                        paper_bgcolor: 'rgba(0,0,0,0)',
                                        plot_bgcolor: 'rgba(0,0,0,0)',
                                    }}
                                    style={{ width: '100%', height: '100%' }}
                                    useResizeHandler={true}
                                    onClick={handleChartClick}
                                    config={plotConfig}
                                />
                            </div>
                        </figure>

                        <div className="international-investment-legend" aria-hidden="true">
                            <div className="international-investment-legend-item">
                                <span className="international-investment-legend-color" style={{ backgroundColor: '#419563' }} />
                                <span className="international-investment-legend-label">CDIA</span>
                            </div>
                            <div className="international-investment-legend-item">
                                <span className="international-investment-legend-color" style={{ backgroundColor: '#2EA3AD' }} />
                                <span className="international-investment-legend-label">FDI</span>
                            </div>
                        </div>

                        <div className="international-investment-table-wrapper">
                            <ChartDataTable
                                lang={lang}
                                columns={tableColumns}
                                rows={tableRows}
                                csvFilename={`${chartDownloadSlug}.csv`}
                                docx={{
                                    filename: `${chartDownloadSlug}.docx`,
                                    title: exportPageTitle,
                                    titleAlign: 'center',
                                    columnWidths: [1800, 3700, 3700],
                                    fontSize: 22,
                                }}
                                caption={tableCaption}
                                tableAriaLabel={tableCaption}
                                renderCell={(raw, { colIndex }) => (
                                    colIndex === 0 ? String(raw ?? '') : formatNumber(raw)
                                )}
                            />
                        </div>
                    </div>
                </div>

                <aside className="wb-fnote" role="note">
                    <h2 id="fn">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt>{lang === 'en' ? 'Footnote *' : 'Note de bas de page *'}</dt>
                        <dd id="fn-asterisk-international-investment" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', width: '100%' }}>
                                <a href="#fn-asterisk-rf-international-investment" onClick={scrollToRef} className="fn-num" title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}>
                                    <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                                </a>
                                <p style={{ margin: 0 }}>{getText('international_investment_footnote', lang)}</p>
                            </div>
                            <p style={{ margin: '10px 0 0 0', paddingLeft: '1.85rem' }}>{getText('international_investment_footnote1', lang)}</p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </PageShell>
    );
};

export default InternationalInvestment;
