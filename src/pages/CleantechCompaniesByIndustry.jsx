import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getCleantechCompaniesByIndustryData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import hexToRgba from '../utils/hexToRgba';
import { formatLocaleNumber, formatLocalePct } from '../utils/formatLocale';

const COLORS = {
    renewable_energy: '#006d3b',
    energy_efficiency: '#5EA343',
    biofuels_bioenergy: '#809E33',
    air_env_remediation: '#4f5f56',
    water_wastewater: '#77999C',
    smart_grid_storage: '#519CC8',
    transportation: '#f2652b',
    agriculture_forestry: '#CB850B',
    waste_recycling: '#9b1b5e',
    mining_manufacturing: '#8070a3'
};

const substitute = (text, vars) => Object.keys(vars || {}).reduce((s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')), text || '');

const getPageZoomScale = () => {
    if (typeof window === 'undefined') return 1;
    const viewportScale = window.visualViewport?.scale || 1;
    const deviceScale = window.devicePixelRatio || 1;
    return Math.max(viewportScale, deviceScale);
};

const wrapLabel = (label, key, lang) => {
    const wraps = {
        en: {
            renewable_energy: 'Renewable<br>energy',
            energy_efficiency: 'Energy<br>efficiency',
            biofuels_bioenergy: 'Biofuels,<br>bioenergy and<br>bioproducts',
            air_env_remediation: 'Air, environment<br>and remediation',
            water_wastewater: 'Water and<br>wastewater',
            smart_grid_storage: 'Smart grid and<br>energy storage',
            transportation: 'Transportation',
            agriculture_forestry: 'Agriculture and<br>forestry',
            waste_recycling: 'Waste and<br>recycling',
            mining_manufacturing: 'Mining and<br>manufacturing'
        },
        fr: {
            renewable_energy: 'Énergie<br>renouvelable',
            energy_efficiency: 'Efficacité<br>énergétique',
            biofuels_bioenergy: 'Biocarburants,<br>bioénergie et<br>bioproduits',
            air_env_remediation: 'Air, environnement<br>et restauration',
            water_wastewater: 'Eau et eaux<br>usées',
            smart_grid_storage: 'Réseau intelligent<br>et stockage<br>énergétique',
            transportation: 'Transport',
            agriculture_forestry: 'Agriculture et<br>foresterie',
            waste_recycling: 'Déchets et<br>recyclage',
            mining_manufacturing: 'Mines et industries<br>manufacturières'
        }
    };
    return wraps[lang === 'fr' ? 'fr' : 'en'][key] || label;
};

const CleantechCompaniesByIndustry = () => {
    const { lang } = useOutletContext();
    const [result, setResult] = useState(null);
    const [selectedYear, setSelectedYear] = useState(2025);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const windowWidth = useWindowWidth();
    const {
        selected: selectedBars,
        clear: clearSelection,
        onPlotClick: handleChartClick,
    } = usePlotlySelection({ mode: 'slices', windowWidth });
    const [zoomLevel, setZoomLevel] = useState(getPageZoomScale);
    const chartRef = useRef(null);

    const formatNumber = (value, digits = 0) => formatLocaleNumber(value, lang, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
    const formatPct = (value) => formatLocalePct(value, lang, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });

    useEffect(() => {
        getCleantechCompaniesByIndustryData()
            .then((data) => {
                setResult(data);
                setSelectedYear(data?.years?.includes(2025) ? 2025 : data?.latestYear ?? 2025);
            })
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const onZoom = () => setZoomLevel(getPageZoomScale());
        onZoom();
        window.addEventListener('resize', onZoom);
        window.visualViewport?.addEventListener('resize', onZoom);
        return () => {
            window.removeEventListener('resize', onZoom);
            window.visualViewport?.removeEventListener('resize', onZoom);
        };
    }, []);

    

    const dataRows = result?.data || [];
    const selectedRow = dataRows.find((row) => row.year === selectedYear) || dataRows.find((row) => row.year === 2025) || dataRows[dataRows.length - 1] || null;
    const year = selectedRow?.year ?? 2025;
    const chartTitle = substitute(getText('cleantech_companies_industry_chart_title', lang), { year });
    const exportChartTitle = stripHtml(chartTitle);
    const fileTitle = `${getText('cleantech_companies_industry_download_title', lang)} ${year}`;
    const industries = selectedRow?.industries?.length ? selectedRow.industries : [];
    const labels = industries.map((item) => getText(`cleantech_companies_industry_industry_${item.key}`, lang));
    const xValues = industries.map((item) => item.key);
    const yValues = industries.map((item) => item.pct);
    const barColors = industries.map((item, index) => {
        const base = COLORS[item.key] || '#284162';
        return selectedBars?.length ? (selectedBars.includes(index) ? base : hexToRgba(base, 0.3)) : base;
    });
    const maxPct = Math.max(25, Math.ceil((Math.max(...yValues, 0) + 1) / 5) * 5);
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 18 : 22, family: 'Arial, sans-serif' };
    const highZoomLabels = zoomLevel >= 2.75;
    const xTickText = industries.map((item, index) => {
        const label = highZoomLabels ? labels[index] : wrapLabel(labels[index], item.key, lang);
        if (highZoomLabels) return label;
        return index % 2 === 1 ? `<br><br><br><br>${label}` : label;
    });
    const staggerGuideLines = industries
        .map((item, index) => (!highZoomLabels && index % 2 === 1 ? {
            type: 'line',
            xref: 'x',
            yref: 'paper',
            x0: item.key,
            x1: item.key,
            y0: -0.04,
            y1: -0.38,
            layer: 'above',
            line: { color: '#b8b8b8', width: 1, dash: 'dot' }
        } : null))
        .filter(Boolean);
    const marginBottom = highZoomLabels ? 250 : windowWidth <= 480 ? 245 : windowWidth <= 768 ? 255 : 205;

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('cleantech_companies_industry_col_year', lang), align: 'left' },
        { key: 'industry', header: getText('cleantech_companies_industry_col_industry', lang), align: 'left' },
        { key: 'count', header: getText('cleantech_companies_industry_col_companies', lang), align: 'num' },
        { key: 'pct', header: getText('cleantech_companies_industry_col_share', lang), align: 'num' },
    ], [lang]);

    const tableRows = useMemo(() => industries.map((item) => ({
        year,
        industry: getText(`cleantech_companies_industry_industry_${item.key}`, lang),
        count: item.count,
        pct: item.pct,
    })), [industries, year, lang]);

    const getChartSummary = () => {
        if (!industries.length) return '';
        const body = summarizeByCategory({
            categories: labels,
            series: [
                { name: getText('cleantech_companies_industry_col_companies', lang), values: industries.map((item) => item.count), format: formatNumber },
                { name: getText('cleantech_companies_industry_col_share', lang), values: industries.map((item) => item.pct), format: formatPct },
            ],
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Bar chart of Canadian cleantech companies by industry for ${year}`
                : `Diagramme à bandes des entreprises de technologies propres canadiennes par industrie pour ${year}`,
            unitNote: lang === 'en' ? 'Company counts and share of total (%)' : 'Nombre d\'entreprises et part du total (%)',
            body,
        });
    };

    const barTrace = industries.length ? {
        type: 'bar',
        x: xValues,
        y: yValues,
        marker: { color: barColors },
        hovertext: industries.map((item, index) => `<b>${labels[index]}</b><br>${getText('cleantech_companies_industry_col_companies', lang)}: ${formatNumber(item.count)}<br>${getText('cleantech_companies_industry_col_share', lang)}: ${formatPct(item.pct)}`),
        hoverinfo: 'text',
        hoverlabel: { bgcolor: '#ffffff', font: { color: '#333333', size: 14, family: 'Arial, sans-serif' } }
    } : null;

    const layout = {
        showlegend: false,
        margin: { t: 30, r: 20, b: marginBottom, l: windowWidth <= 480 ? 52 : 70 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12, color: '#333333' },
        height: windowWidth <= 480 ? 500 : 535,
        clickmode: 'event',
        dragmode: false,
        shapes: staggerGuideLines,
        xaxis: {
            type: 'category',
            categoryorder: 'array',
            categoryarray: xValues,
            tickmode: 'array',
            tickvals: xValues,
            ticktext: xTickText,
            tickangle: highZoomLabels ? 90 : 0,
            tickfont: { ...(highZoomLabels ? { ...tickFont, size: Math.max(11, tickFont.size - 2) } : tickFont), color: '#333333' },
            automargin: false,
            showgrid: false,
            zeroline: false,
            showline: true,
            linecolor: '#666666',
            linewidth: 1
        },
        yaxis: {
            title: { text: getText('cleantech_companies_industry_yaxis', lang), font: axisTitleFont, standoff: 8 },
            range: [0, maxPct],
            tickmode: 'array',
            tickvals: Array.from({ length: Math.floor(maxPct / 5) + 1 }, (_, i) => i * 5),
            ticktext: Array.from({ length: Math.floor(maxPct / 5) + 1 }, (_, i) => (lang === 'fr' ? `${i * 5} %` : `${i * 5}%`)),
            tickfont: { ...tickFont, color: '#333333' },
            showgrid: true,
            gridcolor: '#c4c4c4',
            zeroline: false,
            showline: true,
            linecolor: '#666666',
            linewidth: 1
        }
    };

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${fileTitle}.png`,
        title: exportChartTitle,
        width: 1200,
        height: 720,
    }),
        [exportChartTitle, fileTitle],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    if (loading || error) return <PageStatus lang={lang} loading={loading} error={error} />;
    if (!selectedRow) return <p>{getText('cleantech_companies_industry_no_data', lang)}</p>;

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-63 page-chrome"
            aria-labelledby="cleantech-companies-industry-chart-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-63 { width: 100%; }
.cleantech-companies-industry-container { width: 100%; padding: 15px 0 0 0; display: flex; flex-direction: column; box-sizing: border-box; flex: 1; overflow: visible; }
.cleantech-companies-industry-chart-frame { margin-top: 0; }
.cleantech-companies-industry-chart-title { color: var(--gc-text); margin: 0 0 5px 0; text-transform: none; }
.cleantech-companies-industry-chart-scroll { width: 100%; overflow: hidden; }
.cleantech-companies-industry-chart { width: 100%; min-width: 0; height: ${layout.height}px; position: relative; z-index: 1; overflow: visible; }
.cleantech-companies-industry-chart > div { width: 100%; height: 100%; overflow: visible; }
.cleantech-companies-industry-chart .js-plotly-plot,
.cleantech-companies-industry-chart .plot-container,
.cleantech-companies-industry-chart .svg-container { overflow: visible !important; }
.cleantech-companies-industry-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.cleantech-companies-industry-chart-frame button:hover { background-color: #404040 !important; }
            `}</style>
            <div className="cleantech-companies-industry-container">
                <div className="cleantech-companies-industry-chart-frame page-chrome-chart-frame">
                    <h2 id="cleantech-companies-industry-chart-title" className="cleantech-companies-industry-chart-title page-chrome-chart-title">{chartTitle}</h2>
                    {selectedBars?.length > 0 && (
                        <ClearSelectionButton lang={lang} onClick={clearSelection} />
                    )}
                    <div className="cleantech-companies-industry-chart-scroll">
                        <figure ref={chartRef} className="cleantech-companies-industry-chart" role="region" aria-label={`${exportChartTitle}. ${getChartSummary()}`} tabIndex="0" style={{ margin: 0 }}>
                            <div aria-hidden="true">
                                {barTrace && (
                                    <Plot
                                        key={`cleantech-companies-industry-${year}-${selectedBars ? selectedBars.join('-') : 'none'}`}
                                        data={[barTrace]}
                                        layout={layout}
                                        config={plotConfig}
                                        style={{ width: '100%', height: '100%' }}
                                        useResizeHandler
                                        onClick={handleChartClick}
                                    />
                                )}
                            </div>
                        </figure>
                    </div>
                    <div className="cleantech-companies-industry-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={`${fileTitle}.csv`}
                            docx={{
                                filename: `${fileTitle}.docx`,
                                title: exportChartTitle,
                                titleAlign: 'center',
                                columnWidths: [1200, 5200, 1800, 1800],
                                fontSize: 18,
                            }}
                            caption={getText('cleantech_companies_industry_table_caption', lang)}
                            tableAriaLabel={getText('cleantech_companies_industry_table_caption', lang)}
                            renderCell={(raw, { colIndex }) => {
                                if (colIndex === 0 || colIndex === 1) return String(raw ?? '');
                                if (colIndex === 2) return formatNumber(raw);
                                return formatPct(raw);
                            }}
                        />
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default CleantechCompaniesByIndustry;
