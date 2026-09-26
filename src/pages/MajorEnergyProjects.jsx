import React, { useState, useEffect, useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
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
import { getMajorProjectsData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';

const COLORS = {
    oil_gas_value: '#857550',
    electricity_value: '#224397',
    other_value: '#2B9FAB',
    oil_gas_projects: '#AC9316',
    electricity_projects: '#8E9195',
    other_projects: '#EE6F2B',
};

const MajorEnergyProjects = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const [pageData, setPageData] = useState({ yearlyData: [], summary: {} });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const {
        selected: selectedPoints,
        clear: clearSelection,
        onPlotClick,
    } = usePlotlySelection({ mode: 'points', traceCount: 3, windowWidth });
    const chartRef = useRef(null);

    const handleChartClick = (data) => {
        const seriesIndex = data?.points?.[0]?.curveNumber;
        if (seriesIndex == null || seriesIndex >= 3) return;
        onPlotClick(data);
    };

    const oilGasLabel = getText('major_energy_projects_legend_oil_gas', lang);
    const electricityLabel = getText('major_energy_projects_legend_electricity', lang);
    const otherLabel = getText('major_energy_projects_legend_other', lang);
    const valueLegendTitle = getText('major_energy_projects_legend_value', lang);
    const projectsLegendTitle = getText('major_energy_projects_legend_projects', lang);
    const chartDownloadSlug = lang === 'en' ? 'major_energy_projects' : 'grands_projets_energetiques';

    useEffect(() => {
        getMajorProjectsData()
            .then((data) => {
                setPageData(data);
            })
            .catch((err) => {
                console.error('Failed to load major projects data:', err);
                setError(err.message || 'Failed to load data');
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    

    const formatBillion = (val) => {
        if (lang === 'en') {
            return `$${Math.round(val)}B`;
        }
        return `${Math.round(val)} G$`;
    };

    const formatBillionSR = (val) => (
        lang === 'en'
            ? `${Math.round(val)} billion dollars`
            : `${Math.round(val)} milliards de dollars`
    );

    const tableColumns = useMemo(() => [
        { key: 'year', header: lang === 'en' ? 'Year' : 'Année', align: 'left' },
        {
            key: 'oil_gas_value',
            header: lang === 'en' ? 'Oil and gas value ($ billions)' : 'Valeur pétrole et gaz (milliards $)',
            align: 'num',
        },
        {
            key: 'oil_gas_projects',
            header: lang === 'en' ? 'Oil and gas projects' : 'Projets pétrole et gaz',
            align: 'num',
        },
        {
            key: 'electricity_value',
            header: lang === 'en' ? 'Electricity value ($ billions)' : 'Valeur électricité (milliards $)',
            align: 'num',
        },
        {
            key: 'electricity_projects',
            header: lang === 'en' ? 'Electricity projects' : 'Projets électricité',
            align: 'num',
        },
        {
            key: 'other_value',
            header: lang === 'en' ? 'Other value ($ billions)' : 'Valeur autres (milliards $)',
            align: 'num',
        },
        {
            key: 'other_projects',
            header: lang === 'en' ? 'Other projects' : 'Projets autres',
            align: 'num',
        },
        {
            key: 'total_value',
            header: lang === 'en' ? 'Total value ($ billions)' : 'Valeur totale (milliards $)',
            align: 'num',
        },
        {
            key: 'total_projects',
            header: lang === 'en' ? 'Total projects' : 'Total projets',
            align: 'num',
        },
    ], [lang]);

    const downloadChartWithTitleOptionsRef = useRef({});
    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => downloadChartWithTitleOptionsRef.current,
        [],
    );

    if (loading) return <PageStatus lang={lang} loading style={{ padding: '20px', textAlign: 'center' }} />;
    if (error) return <PageStatus lang={lang} error={error} style={{ padding: '20px' }} />;
    if (!pageData.yearlyData || pageData.yearlyData.length === 0) {
        return <div style={{ padding: '20px' }}>No data available.</div>;
    }

    const years = pageData.yearlyData.map((d) => d.year);
    const minYear = years.length > 0 ? Math.min(...years) : 2021;
    const maxYear = years.length > 0 ? Math.max(...years) : 2024;
    const latestYear = maxYear;
    const latestData = pageData.yearlyData.find((d) => d.year === latestYear) || {};
    const summary = pageData.summary || {};

    const chartTitle = `${getText('major_energy_projects_chart_title_prefix', lang)}${minYear} ${lang === 'en' ? 'to' : 'à'} ${maxYear}`;
    const exportChartTitle = stripHtml(chartTitle);
    const pageTitle = getText('major_energy_projects_title', lang);
    const exportPageTitle = stripHtml(pageTitle);

    const tableCaption = lang === 'en'
        ? 'Major energy projects data by year (values in billions of dollars, project counts)'
        : 'Données des grands projets énergétiques par année (valeurs en milliards de dollars, nombre de projets)';

    const getChartSummary = () => {
        const latestD = pageData.yearlyData.find((d) => d.year === maxYear) || {};
        if (lang === 'en') {
            return `Combo chart showing trends in major energy projects from ${minYear} to ${maxYear}. Stacked bars show project value in billions of dollars, lines show number of projects. In ${maxYear}, oil and gas projects were valued at ${formatBillionSR(latestD.oil_gas_value)}, electricity at ${formatBillionSR(latestD.electricity_value)}, and other at ${formatBillionSR(latestD.other_value)}. Expand the data table below for detailed values.`;
        }
        return `Graphique combiné montrant les tendances des grands projets énergétiques de ${minYear} à ${maxYear}. Les barres empilées montrent la valeur des projets en milliards de dollars, les lignes montrent le nombre de projets. En ${maxYear}, les projets de pétrole et gaz étaient évalués à ${formatBillionSR(latestD.oil_gas_value)}, l'électricité à ${formatBillionSR(latestD.electricity_value)}, et autres à ${formatBillionSR(latestD.other_value)}. Développez le tableau de données ci-dessous pour les valeurs détaillées.`;
    };

    downloadChartWithTitleOptionsRef.current = ({
        filename: `${chartDownloadSlug}.png`,
        title: exportChartTitle,
        height: 700,
        legendItems: [
            { label: `${oilGasLabel} (${valueLegendTitle})`, color: COLORS.oil_gas_value },
            { label: `${electricityLabel} (${valueLegendTitle})`, color: COLORS.electricity_value },
            { label: `${otherLabel} (${valueLegendTitle})`, color: COLORS.other_value },
            { label: `${oilGasLabel} (${projectsLegendTitle})`, color: COLORS.oil_gas_projects, dash: true },
            { label: `${electricityLabel} (${projectsLegendTitle})`, color: COLORS.electricity_projects, dash: true },
            { label: `${otherLabel} (${projectsLegendTitle})`, color: COLORS.other_projects, dash: true },
        ],
    });

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const bullet1AriaLabel = lang === 'en'
        ? `In ${latestYear}, there were ${summary.planned_projects || 231} planned (announced, under review, or approved) energy projects worth ${formatBillionSR(summary.planned_value || 351)}, and ${summary.construction_projects || 109} energy projects under construction worth ${formatBillionSR(summary.construction_value || 159)}.`
        : `En ${latestYear}, il y avait ${summary.planned_projects || 231} projets énergétiques planifiés (annoncés, en cours d'examen ou approuvés) d'une valeur de ${formatBillionSR(summary.planned_value || 351)}, et ${summary.construction_projects || 109} projets énergétiques en construction d'une valeur de ${formatBillionSR(summary.construction_value || 159)}.`;

    const bullet2AriaLabel = lang === 'en'
        ? `Oil and gas projects accounted for the largest portion of project value at ${formatBillionSR(latestData.oil_gas_value || 296)}, while there were more electricity projects overall at ${latestData.electricity_projects || 188}.`
        : `Les projets de pétrole et gaz représentaient la plus grande part de la valeur des projets à ${formatBillionSR(latestData.oil_gas_value || 296)}, tandis qu'il y avait plus de projets d'électricité au total à ${latestData.electricity_projects || 188}.`;

    const bullet3AriaLabel = lang === 'en'
        ? `There were ${summary.clean_tech_projects || 215} clean technology projects valued at ${formatBillionSR(summary.clean_tech_value || 194)}.`
        : `Il y avait ${summary.clean_tech_projects || 215} projets de technologies propres d'une valeur de ${formatBillionSR(summary.clean_tech_value || 194)}.`;

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-28 page-chrome page-chrome--bleed"
            aria-labelledby="major-projects-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
    .page-28 {
        width: 100%;
    }

    .major-projects-container {
        padding-top: 30px;
        padding-bottom: 40px;
        width: 100%;
        box-sizing: border-box;
    }

    .major-projects-content-row {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        gap: 40px;
        align-items: flex-start;
    }

    .major-projects-left-column {
        flex: 2;
        min-width: 0;
        order: 0;
    }

    .major-projects-right-column {
        flex: 1;
        min-width: 280px;
        max-width: 350px;
        order: 1;
    }

    .major-projects-data-table-section {
        width: 100%;
        order: 2;
    }

    .major-projects-bullets {
        margin: 0 0 20px 0;
        padding-left: 20px;
    }

    .major-projects-bullets li {
        font-family: 'Noto Sans', sans-serif;
        font-size: 20px;
        line-height: 1.6;
        margin-bottom: 20px;
        color: var(--gc-text);
    }

    .major-projects-sidebar {
        background-color: #aa9c7a;
        padding: 20px;
        border-radius: 3px;
        font-family: 'Noto Sans', sans-serif;
        font-size: 20px;
        line-height: 1.6;
        color: var(--gc-text);
    }

    .major-projects-sidebar-title {
        font-family: 'Lato', sans-serif;
        font-weight: bold;
        font-size: 29px;
        margin-bottom: 10px;
    }

    .major-projects-sidebar p {
        margin: 0 0 10px 0;
    }

    .major-projects-chart {
        position: relative;
        width: 100%;
        margin-top: 20px;
    }

    .major-projects-chart .js-plotly-plot {
        height: 500px !important;
    }

    .major-projects-chart .modebar {
        transform: translateY(-100%) !important;
    }

    .major-projects-chart-title {
        padding: 0 10px;
        word-wrap: break-word;
        overflow-wrap: break-word;
        white-space: normal;
        color: var(--gc-text);
        width: 100%;
        box-sizing: border-box;
    }

    .major-projects-custom-legend {
        display: flex;
        justify-content: center;
        gap: 40px;
        margin-top: 15px;
        flex-wrap: wrap;
    }

    .major-projects-legend-group {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
    }

    .major-projects-legend-group-title {
        font-family: Arial, sans-serif;
        font-size: 0.85rem;
        font-weight: bold;
        margin-bottom: 5px;
        color: var(--gc-text);
    }

    .major-projects-legend-items {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .major-projects-legend-item {
        display: flex;
        align-items: center;
        font-family: Arial, sans-serif;
        font-size: 0.8rem;
        color: var(--gc-text);
    }

    .major-projects-legend-color {
        width: 20px;
        height: 12px;
        margin-right: 6px;
        display: inline-block;
    }

    .major-projects-legend-line {
        width: 20px;
        height: 2px;
        margin-right: 6px;
        display: inline-block;
        border-top: 2px dotted;
    }

    .major-projects-chart-frame {
        margin-bottom: 0;
    }

    .major-projects-chart-frame button[type="button"]:hover,
    .major-projects-chart-frame button:hover {
        background-color: #404040 !important;
    }

    @media (max-width: 1280px) {
        .major-projects-content-row {
            flex-direction: column;
            gap: 0;
        }
        .major-projects-left-column {
            order: 0;
            width: 100%;
        }
        .major-projects-chart-frame {
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
            padding-bottom: 10px;
        }
        .major-projects-data-table-section {
            order: 1;
            background-color: #f5f5f5;
            padding: 20px;
            padding-top: 10px;
            border-bottom-left-radius: 8px;
            border-bottom-right-radius: 8px;
        }
        .major-projects-right-column {
            max-width: 100%;
            width: 100%;
            order: 2;
            margin-top: 40px;
        }
        .major-projects-chart .js-plotly-plot {
            height: 450px !important;
        }
    }

    @media (max-width: 960px) {
        .major-projects-chart .js-plotly-plot {
            height: 400px !important;
        }
    }

    @media (max-width: 768px) {
        .major-projects-bullets li {
            font-size: 18px;
        }
        .major-projects-sidebar {
            font-size: 18px;
        }
        .major-projects-sidebar-title {
            font-size: 26px;
        }
        .major-projects-custom-legend {
            flex-direction: column;
            gap: 15px;
            align-items: flex-start;
        }
        .major-projects-chart .js-plotly-plot {
            height: 350px !important;
        }
    }

    @media (max-width: 480px) {
        .major-projects-title {
            font-size: 1.4rem;
        }
        .major-projects-chart .js-plotly-plot {
            height: 300px !important;
        }
    }
`}</style>

            <div className="major-projects-container">
                <header role="region" aria-label={exportPageTitle}>
                    <h1 id="major-projects-title" className="major-projects-title page-chrome-title">
                        {pageTitle}
                    </h1>
                </header>

                <div className="major-projects-content-row">
                    <div className="major-projects-left-column">
                        <ul className="major-projects-bullets">
                            <li aria-label={bullet1AriaLabel}>
                                <span aria-hidden="true">
                                    {getText('major_energy_projects_bullet1_part1', lang)}
                                    <strong>{latestYear}</strong>
                                    {getText('major_energy_projects_bullet1_part2', lang)}
                                    <strong>{summary.planned_projects || 231}</strong>
                                    {getText('major_energy_projects_bullet1_part3', lang)}
                                    <strong>{formatBillion(summary.planned_value || 351)}</strong>
                                    {getText('major_energy_projects_bullet1_part4', lang)}
                                    <strong>{summary.construction_projects || 109}</strong>
                                    {getText('major_energy_projects_bullet1_part5', lang)}
                                    <strong>{formatBillion(summary.construction_value || 159)}</strong>
                                    {getText('major_energy_projects_bullet1_part6', lang)}
                                </span>
                            </li>
                            <li aria-label={bullet2AriaLabel}>
                                <span aria-hidden="true">
                                    {getText('major_energy_projects_bullet2_part1', lang)}
                                    <strong>{formatBillion(latestData.oil_gas_value || 296)}</strong>
                                    {getText('major_energy_projects_bullet2_part2', lang)}
                                    <strong>{latestData.electricity_projects || 188}</strong>
                                    {getText('major_energy_projects_bullet2_part3', lang)}
                                </span>
                            </li>
                            <li aria-label={bullet3AriaLabel}>
                                <span aria-hidden="true">
                                    {getText('major_energy_projects_bullet3_part1', lang)}
                                    <strong>{summary.clean_tech_projects || 215}</strong>
                                    {getText('major_energy_projects_bullet3_part2', lang)}
                                    <strong>{formatBillion(summary.clean_tech_value || 194)}</strong>
                                    {getText('major_energy_projects_bullet3_part3', lang)}
                                </span>
                            </li>
                        </ul>

                        <div className="major-projects-chart-frame page-chrome-chart-frame">
                            <h2 className="major-projects-chart-title page-chrome-chart-title" aria-hidden="true">{chartTitle}</h2>
                            <div className="major-projects-chart" style={{ position: 'relative' }}>
                                <div
                                    role="region"
                                    aria-label={`${exportChartTitle}. ${getChartSummary()}`}
                                    tabIndex="0"
                                >
                                    {selectedPoints !== null && (
                                        <ClearSelectionButton lang={lang} onClick={clearSelection} />
                                    )}
                                    <figure ref={chartRef} style={{ margin: 0, position: 'relative' }}>
                                        <div aria-hidden="true">
                                            <Plot
                                                data={[
                                                    {
                                                        name: oilGasLabel,
                                                        x: years,
                                                        y: pageData.yearlyData.map((d) => d.oil_gas_value),
                                                        type: 'bar',
                                                        marker: {
                                                            color: COLORS.oil_gas_value,
                                                            opacity: selectedPoints === null
                                                                ? 1
                                                                : years.map((_, i) => (selectedPoints[0]?.includes(i) ? 1 : 0.3)),
                                                        },
                                                        customdata: pageData.yearlyData.map((d) => d.total_value),
                                                        hovertemplate: `<b>${oilGasLabel}</b><br>%{x}: $%{y:.1f}B<br>${lang === 'en' ? 'Total value' : 'Valeur totale'}: $%{customdata:.1f}B<extra></extra>`,
                                                        yaxis: 'y',
                                                        legendgroup: 'value',
                                                    },
                                                    {
                                                        name: electricityLabel,
                                                        x: years,
                                                        y: pageData.yearlyData.map((d) => d.electricity_value),
                                                        type: 'bar',
                                                        marker: {
                                                            color: COLORS.electricity_value,
                                                            opacity: selectedPoints === null
                                                                ? 1
                                                                : years.map((_, i) => (selectedPoints[1]?.includes(i) ? 1 : 0.3)),
                                                        },
                                                        customdata: pageData.yearlyData.map((d) => d.total_value),
                                                        hovertemplate: `<b>${electricityLabel}</b><br>%{x}: $%{y:.1f}B<br>${lang === 'en' ? 'Total value' : 'Valeur totale'}: $%{customdata:.1f}B<extra></extra>`,
                                                        yaxis: 'y',
                                                        legendgroup: 'value',
                                                    },
                                                    {
                                                        name: otherLabel,
                                                        x: years,
                                                        y: pageData.yearlyData.map((d) => d.other_value),
                                                        type: 'bar',
                                                        marker: {
                                                            color: COLORS.other_value,
                                                            opacity: selectedPoints === null
                                                                ? 1
                                                                : years.map((_, i) => (selectedPoints[2]?.includes(i) ? 1 : 0.3)),
                                                        },
                                                        customdata: pageData.yearlyData.map((d) => d.total_value),
                                                        hovertemplate: `<b>${otherLabel}</b><br>%{x}: $%{y:.1f}B<br>${lang === 'en' ? 'Total value' : 'Valeur totale'}: $%{customdata:.1f}B<extra></extra>`,
                                                        yaxis: 'y',
                                                        legendgroup: 'value',
                                                    },
                                                    {
                                                        name: `${oilGasLabel} (${lang === 'en' ? 'projects' : 'projets'})`,
                                                        x: years,
                                                        y: pageData.yearlyData.map((d) => d.oil_gas_projects),
                                                        type: 'scatter',
                                                        mode: 'lines+markers',
                                                        line: { color: COLORS.oil_gas_projects, width: 2, dash: 'dot' },
                                                        marker: { color: COLORS.oil_gas_projects, size: 6 },
                                                        customdata: pageData.yearlyData.map((d) => d.total_projects),
                                                        hovertemplate: `<b>${oilGasLabel}</b><br>%{x}: %{y} ${lang === 'en' ? 'projects' : 'projets'}<br>${lang === 'en' ? 'Total projects' : 'Projets totaux'}: %{customdata}<extra></extra>`,
                                                        yaxis: 'y2',
                                                        legendgroup: 'projects',
                                                    },
                                                    {
                                                        name: `${electricityLabel} (${lang === 'en' ? 'projects' : 'projets'})`,
                                                        x: years,
                                                        y: pageData.yearlyData.map((d) => d.electricity_projects),
                                                        type: 'scatter',
                                                        mode: 'lines+markers',
                                                        line: { color: COLORS.electricity_projects, width: 2, dash: 'dot' },
                                                        marker: { color: COLORS.electricity_projects, size: 6 },
                                                        customdata: pageData.yearlyData.map((d) => d.total_projects),
                                                        hovertemplate: `<b>${electricityLabel}</b><br>%{x}: %{y} ${lang === 'en' ? 'projects' : 'projets'}<br>${lang === 'en' ? 'Total projects' : 'Projets totaux'}: %{customdata}<extra></extra>`,
                                                        yaxis: 'y2',
                                                        legendgroup: 'projects',
                                                    },
                                                    {
                                                        name: `${otherLabel} (${lang === 'en' ? 'projects' : 'projets'})`,
                                                        x: years,
                                                        y: pageData.yearlyData.map((d) => d.other_projects),
                                                        type: 'scatter',
                                                        mode: 'lines+markers',
                                                        line: { color: COLORS.other_projects, width: 2, dash: 'dot' },
                                                        marker: { color: COLORS.other_projects, size: 6 },
                                                        customdata: pageData.yearlyData.map((d) => d.total_projects),
                                                        hovertemplate: `<b>${otherLabel}</b><br>%{x}: %{y} ${lang === 'en' ? 'projects' : 'projets'}<br>${lang === 'en' ? 'Total projects' : 'Projets totaux'}: %{customdata}<extra></extra>`,
                                                        yaxis: 'y2',
                                                        legendgroup: 'projects',
                                                    },
                                                ]}
                                                layout={{
                                                    barmode: 'stack',
                                                    showlegend: false,
                                                    clickmode: 'event',
                                                    dragmode: false,
                                                    title: { text: '', font: { size: 1 } },
                                                    margin: { l: 60, r: 60, t: 50, b: 40 },
                                                    xaxis: {
                                                        tickvals: years,
                                                        tickangle: 0,
                                                        title: '',
                                                    },
                                                    yaxis: {
                                                        title: {
                                                            text: `<b>${getText('major_energy_projects_yaxis_left', lang)}</b>`,
                                                            font: { size: 16, family: 'Arial, sans-serif', color: '#333' },
                                                        },
                                                        side: 'left',
                                                        rangemode: 'tozero',
                                                    },
                                                    yaxis2: {
                                                        title: {
                                                            text: `<b>${getText('major_energy_projects_yaxis_right', lang)}</b>`,
                                                            font: { size: 16, family: 'Arial, sans-serif', color: '#333' },
                                                        },
                                                        side: 'right',
                                                        overlaying: 'y',
                                                        rangemode: 'tozero',
                                                    },
                                                    hoverlabel: {
                                                        bgcolor: '#ffffff',
                                                        bordercolor: '#333333',
                                                        font: { color: '#333333', family: 'Arial, sans-serif' },
                                                    },
                                                    font: { family: 'Arial, sans-serif' },
                                                    paper_bgcolor: 'rgba(0,0,0,0)',
                                                    plot_bgcolor: 'rgba(0,0,0,0)',
                                                }}
                                                config={plotConfig}
                                                onClick={handleChartClick}
                                                useResizeHandler={true}
                                                style={{ width: '100%', height: windowWidth <= 480 ? '400px' : '500px' }}
                                            />
                                        </div>
                                    </figure>
                                </div>

                                <div className="major-projects-custom-legend" aria-hidden="true">
                                    <div className="major-projects-legend-group">
                                        <div className="major-projects-legend-group-title">{valueLegendTitle}</div>
                                        <div className="major-projects-legend-items">
                                            <div className="major-projects-legend-item">
                                                <span className="major-projects-legend-color" style={{ backgroundColor: COLORS.oil_gas_value }} />
                                                <span>{oilGasLabel}</span>
                                            </div>
                                            <div className="major-projects-legend-item">
                                                <span className="major-projects-legend-color" style={{ backgroundColor: COLORS.electricity_value }} />
                                                <span>{electricityLabel}</span>
                                            </div>
                                            <div className="major-projects-legend-item">
                                                <span className="major-projects-legend-color" style={{ backgroundColor: COLORS.other_value }} />
                                                <span>{otherLabel}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="major-projects-legend-group">
                                        <div className="major-projects-legend-group-title">{projectsLegendTitle}</div>
                                        <div className="major-projects-legend-items">
                                            <div className="major-projects-legend-item">
                                                <span className="major-projects-legend-line" style={{ borderColor: COLORS.oil_gas_projects }} />
                                                <span>{oilGasLabel}</span>
                                            </div>
                                            <div className="major-projects-legend-item">
                                                <span className="major-projects-legend-line" style={{ borderColor: COLORS.electricity_projects }} />
                                                <span>{electricityLabel}</span>
                                            </div>
                                            <div className="major-projects-legend-item">
                                                <span className="major-projects-legend-line" style={{ borderColor: COLORS.other_projects }} />
                                                <span>{otherLabel}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <aside className="major-projects-right-column">
                        <div className="major-projects-sidebar">
                            <h3 className="major-projects-sidebar-title">{getText('major_energy_projects_sidebar_title', lang)}</h3>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {getText('major_energy_projects_sidebar_content', lang).split(/<br\s*\/?>/i).map((para, idx) => {
                                    if (!para.trim()) return null;
                                    let audioLabel = stripHtml(para);
                                    if (lang === 'en') {
                                        audioLabel = audioLabel.replace(/\$(\d+) million/g, '$1 million dollars');
                                    }
                                    let visualHtml = para;
                                    if (lang === 'en') {
                                        visualHtml = visualHtml.replace(/(\$\d+ million)/g, '<strong>$1</strong>');
                                    } else {
                                        visualHtml = visualHtml.replace(/(\d+ millions de dollars)/g, '<strong>$1</strong>');
                                    }

                                    return (
                                        <li
                                            key={idx}
                                            style={{ marginBottom: '10px', lineHeight: '1.6', fontFamily: 'Arial, sans-serif', color: '#333' }}
                                            aria-label={audioLabel}
                                        >
                                            <span
                                                aria-hidden="true"
                                                dangerouslySetInnerHTML={{ __html: visualHtml }}
                                            />
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </aside>

                    <div className="major-projects-data-table-section">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={pageData.yearlyData}
                            csvFilename={`${chartDownloadSlug}.csv`}
                            docx={{
                                filename: `${chartDownloadSlug}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [1000, 1100, 1000, 1100, 1000, 1100, 1000, 1100, 1000],
                                fontSize: 20,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                        />
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default MajorEnergyProjects;
