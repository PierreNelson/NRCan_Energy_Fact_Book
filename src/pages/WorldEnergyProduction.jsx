import React, { useState, useEffect, useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import YearSelect from '../components/YearSelect';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import { useOutletContext } from 'react-router-dom';
import { getWorldEnergyProductionData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';

const world_energy_production_COUNTRY_NAME_MAP = {
    'china': 'world_energy_production_country_china',
    'united_states': 'world_energy_production_country_united_states',
    'india': 'world_energy_production_country_india',
    'canada': 'world_energy_production_country_canada',
    'indonesia': 'world_energy_production_country_indonesia',
    'australia': 'world_energy_production_country_australia',
    'brazil': 'world_energy_production_country_brazil',
    'norway': 'world_energy_production_country_norway',
    'mexico': 'world_energy_production_country_mexico',
    'south_africa': 'world_energy_production_country_south_africa',
    'colombia': 'world_energy_production_country_colombia',
    'united_kingdom': 'world_energy_production_country_united_kingdom',
    'egypt': 'world_energy_production_country_egypt',
    'argentina': 'world_energy_production_country_argentina',
};

const RANKING_RESOURCES = [
    'crude_oil',
    'uranium',
    'hydroelectricity',
    'electricity',
    'coal',
    'natural_gas',
];

const RANKING_RESOURCE_NAME_KEYS = {
    crude_oil: 'world_energy_production_crude_oil',
    uranium: 'world_energy_production_uranium',
    hydroelectricity: 'world_energy_production_hydroelectricity',
    electricity: 'world_energy_production_electricity',
    coal: 'world_energy_production_coal',
    natural_gas: 'world_energy_production_natural_gas',
};

const rankingsData = [
    { resource: 'world_energy_production_crude_oil', reserves: 4, production: 4, exports: 3 },
    { resource: 'world_energy_production_uranium', reserves: 3, production: 2, exports: 2 },
    { resource: 'world_energy_production_hydroelectricity', reserves: 4, production: 3, exports: '-' },
    { resource: 'world_energy_production_electricity', reserves: 8, production: 7, exports: 3 },
    { resource: 'world_energy_production_coal', reserves: 19, production: 14, exports: 8 },
    { resource: 'world_energy_production_natural_gas', reserves: 10, production: 5, exports: 6 },
];

const WorldEnergyProduction = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [year, setYear] = useState(null);
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const chartRef = useRef(null);

    const minYear = useMemo(() => (pageData.length > 0 ? pageData[0].year : 2007), [pageData]);
    const maxYear = useMemo(() => (pageData.length > 0 ? pageData[pageData.length - 1].year : 2023), [pageData]);

    const yearsList = useMemo(() => pageData.map((d) => d.year), [pageData]);
    const yearsDescending = useMemo(
        () => [...yearsList].sort((a, b) => b - a),
        [yearsList]
    );

    useEffect(() => {
        getWorldEnergyProductionData()
            .then((data) => {
                setPageData(data);
                if (data && data.length > 0) {
                    setYear(data[data.length - 1].year);
                }
            })
            .catch((err) => {
                console.error('Failed to load world energy production data:', err);
                setError(err.message || 'Failed to load data');
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    

    const currentYearData = useMemo(() => {
        if (!year || pageData.length === 0) return null;
        return pageData.find((d) => d.year === year);
    }, [year, pageData]);

    const topProducers = useMemo(() => {
        if (!currentYearData) return [];

        const allCountries = Object.keys(world_energy_production_COUNTRY_NAME_MAP)
            .map((key) => {
                const pct = currentYearData[`${key}_pct`];
                if (pct === undefined || pct === null) return null;
                return {
                    key,
                    nameKey: world_energy_production_COUNTRY_NAME_MAP[key],
                    name: getText(world_energy_production_COUNTRY_NAME_MAP[key], lang),
                    pct,
                    pctRounded: Math.round(pct),
                };
            })
            .filter((c) => c !== null);

        return allCountries.sort((a, b) => b.pct - a.pct).slice(0, 6);
    }, [currentYearData, lang]);

    const rankingAria = lang === 'en'
        ? `Top ${topProducers.length} energy producers in ${year}: ${topProducers.map((p, i) => `Number ${i + 1}, ${p.name}, ${p.pctRounded} percent`).join('. ')}.`
        : `Les ${topProducers.length} principaux producteurs d'énergie en ${year}: ${topProducers.map((p, i) => `Numéro ${i + 1}, ${p.name}, ${p.pctRounded} pour cent`).join('. ')}.`;

    const dynamicColumns = useMemo(() => {
        if (!pageData || pageData.length === 0) return [];

        const uniqueCountries = new Set();

        pageData.forEach((yearRow) => {
            const yearCountries = Object.keys(world_energy_production_COUNTRY_NAME_MAP)
                .map((key) => ({
                    key,
                    pct: yearRow[`${key}_pct`] || 0,
                }))
                .sort((a, b) => b.pct - a.pct)
                .slice(0, 6);

            yearCountries.forEach((c) => uniqueCountries.add(c.key));
        });

        return Array.from(uniqueCountries);
    }, [pageData]);

    const canadaGrowth = currentYearData?.canada_growth_since_2005 || 42;
    const worldGrowth = currentYearData?.world_growth_since_2005 || 34;

    const rankingsYearData = useMemo(() => {
        const years = [];
        for (let y = 2007; y <= 2024; y++) {
            years.push({
                year: y,
                crude_oil_reserves: 4,
                crude_oil_production: 4,
                crude_oil_exports: 3,
                uranium_reserves: 3,
                uranium_production: 2,
                uranium_exports: 2,
                hydroelectricity_reserves: 4,
                hydroelectricity_production: 3,
                hydroelectricity_exports: '-',
                electricity_reserves: 8,
                electricity_production: 7,
                electricity_exports: 3,
                coal_reserves: 19,
                coal_production: 14,
                coal_exports: 8,
                natural_gas_reserves: 10,
                natural_gas_production: 5,
                natural_gas_exports: 6,
            });
        }
        return years;
    }, []);

    const yearColHeader = lang === 'en' ? 'Year' : 'Année';
    const producersCaption = lang === 'en'
        ? 'Historical top energy producers data, percentage of world total'
        : 'Données historiques des principaux producteurs d\'énergie, pourcentage du total mondial';
    const rankingsCaption = lang === 'en'
        ? 'Global energy rankings for Canada by resource type and year'
        : 'Classements énergétiques mondiaux du Canada par type de ressource et année';

    const producersChartTitle = stripHtml(getText('world_energy_production_chart_title', lang));
    const rankingsChartTitle = stripHtml(getText('world_energy_production_rankings_title', lang));
    const producersDownloadSlug = lang === 'en' ? 'energy_production_data' : 'donnees_production_energie';
    const rankingsDownloadSlug = lang === 'en' ? 'canada_energy_rankings' : 'classements_energie_canada';

    const producersTableColumns = useMemo(() => [
        { key: 'year', header: yearColHeader, align: 'left' },
        ...dynamicColumns.map((key) => ({
            key,
            header: `${getText(world_energy_production_COUNTRY_NAME_MAP[key], lang)} (%)`,
            align: 'num',
        })),
    ], [lang, yearColHeader, dynamicColumns]);

    const producersTableRows = useMemo(() => pageData.map((d) => {
        const row = { year: d.year };
        dynamicColumns.forEach((key) => {
            const val = d[`${key}_pct`];
            row[key] = val != null && val !== '' ? Math.round(val) : null;
        });
        return row;
    }), [pageData, dynamicColumns]);

    const rankingsTableColumns = useMemo(() => [
        { key: 'year', header: yearColHeader, align: 'left' },
        ...RANKING_RESOURCES.flatMap((r) => {
            const resourceName = stripHtml(getText(RANKING_RESOURCE_NAME_KEYS[r], lang));
            return [
                {
                    key: `${r}_reserves`,
                    header: `${resourceName} - ${getText('world_energy_production_rankings_header_reserves', lang)}`,
                    align: 'num',
                },
                {
                    key: `${r}_production`,
                    header: `${resourceName} - ${getText('world_energy_production_rankings_header_production', lang)}`,
                    align: 'num',
                },
                {
                    key: `${r}_exports`,
                    header: `${resourceName} - ${getText('world_energy_production_rankings_header_exports', lang)}`,
                    align: 'num',
                },
            ];
        }),
    ], [lang, yearColHeader]);

    const pageShellStyle = { backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) };

    if (loading || error) {
        return (
            <PageShell
                tabIndex="-1"
                className="energy-production-main page-chrome page-chrome--bleed"
                style={pageShellStyle}
            >
                <PageStatus
                    lang={lang}
                    loading={loading}
                    error={error}
                    style={loading
                        ? { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }
                        : { padding: '20px' }}
                />
            </PageShell>
        );
    }

    return (
        <PageShell
            tabIndex="-1"
            className="energy-production-main page-chrome page-chrome--bleed"
            style={pageShellStyle}
        >
            <style>{`
                .energy-production-main {
                    padding: 0;
                    background-color: #fff;
                    overflow-x: hidden;
                }

                .energy-production-container {
                    padding-top: 20px;
                    padding-bottom: 30px;
                    width: 100%;
                    box-sizing: border-box;
                }

                .energy-production-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 50px;
                    font-weight: bold;
                    margin-top: 0;
                    margin-bottom: 25px;
                    color: #245e7f;
                    margin: 0 0 10px 0;
                    line-height: 1.2;
                    position: relative;
                    padding-bottom: 0.5em;
                }

                .energy-production-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }

                .energy-production-subtitle {
                    font-family: 'Lato', sans-serif;
                    font-size: 39px;
                    font-weight: bold;
                    color: #58585a;
                    margin: 0 0 15px 0;
                }

                .energy-production-narrative {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    line-height: 1.6;
                    color: var(--gc-text);
                    margin-bottom: 20px;
                }

                .energy-production-narrative strong {
                    font-weight: bold;
                }

                .energy-production-content-wrapper {
                    display: flex;
                    flex-direction: row;
                    gap: 30px;
                    margin-top: 20px;
                    align-items: stretch;
                }

                .energy-production-chart-section {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                }

                .energy-production-rankings-section {
                    flex: 0 0 auto;
                    min-width: 0;
                    max-width: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                }

                .energy-production-chart-section .data-table-wrapper,
                .energy-production-rankings-section .data-table-wrapper {
                    padding-top: 5px;
                    margin-top: 20px;
                    margin-bottom: 0;
                    width: 100%;
                    box-sizing: border-box;
                }

                .energy-production-chart-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: #000000;
                    margin: 0 0 10px 0;
                    text-align: left;
                    width: 100%;
                }

                .energy-production-rankings-title {
                    font-family: 'Lato', sans-serif;
                    font-size: clamp(18px, 2.5vw, 29px);
                    font-weight: bold;
                    color: #000000;
                    margin: 0 0 clamp(20px, 3vw, 40px) 0;
                    text-align: left;
                    width: 100%;
                    white-space: normal;
                }

                .static-rankings-scroll-container {
                    display: block;
                    width: 100%;
                    overflow-x: auto !important;
                    -webkit-overflow-scrolling: touch;
                    border: 1px solid #ddd;
                    background: #fff;
                }

                .energy-production-rankings-table {
                    width: max-content !important;
                    min-width: 100%;
                    border-collapse: collapse;
                    font-family: 'Noto Sans', sans-serif;
                    font-size: clamp(14px, 1.5vw, 20px);
                }

                .energy-production-rankings-table thead th {
                    background-color: #49494b !important;
                    color: white !important;
                    padding: 8px 15px;
                    text-align: center;
                    font-weight: bold;
                    white-space: nowrap;
                }

                .energy-production-rankings-table td {
                    padding: 12px 15px;
                    text-align: center;
                    border: 1px solid #ddd;
                    white-space: nowrap;
                }

                .energy-production-rankings-table.table-striped > tbody > tr:nth-of-type(odd) > * {
                    --bs-table-bg-type: #b2bac9;
                    background-color: #b2bac9 !important;
                }

                .energy-production-rankings-table.table-striped > tbody > tr:nth-of-type(even) > * {
                    --bs-table-bg-type: #ffffff;
                    background-color: #ffffff !important;
                }

                .energy-production-rankings-table .resource-cell {
                    text-align: left;
                    font-weight: bold;
                    color: #49494b;
                    white-space: nowrap;
                }

                .custom-chart-container {
                    position: relative;
                    width: 100%;
                    max-width: 380px;
                    margin-left: auto;
                    margin-right: auto;
                }

                .energy-production-capsule-graphic {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    width: 100%;
                    font-family: 'Noto Sans', sans-serif;
                }

                .energy-production-capsule-row {
                    display: flex;
                    align-items: center;
                    min-height: 52px;
                    gap: 0;
                    min-width: 0;
                }

                .energy-production-capsule-bar-wrap {
                    flex: 0 0 28%;
                    min-width: 0;
                    display: flex;
                    align-items: center;
                }

                .energy-production-capsule-bar {
                    min-height: 44px;
                    min-width: 82px;
                    border-radius: 999px;
                    background-color: #d1d1d1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    padding: 10px 12px;
                    font-size: clamp(13px, 1.5vw, 15px);
                    color: #333;
                    box-sizing: border-box;
                    width: 100%;
                    max-width: 100%;
                }

                .energy-production-capsule-bar .energy-production-capsule-bar-text {
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    word-break: break-word;
                    white-space: normal;
                    line-height: 1.3;
                }

                .energy-production-capsule-row-canada .energy-production-capsule-bar {
                    background-color: var(--gc-accent);
                    color: #fff;
                }

                .energy-production-capsule-connector {
                    flex: 1 1 0;
                    min-width: 10px;
                    height: 2px;
                    background-color: #b0b0b0;
                }

                .energy-production-capsule-row-canada .energy-production-capsule-connector {
                    background-color: var(--gc-accent);
                }

                .energy-production-capsule-pill {
                    flex: 0 0 64px;
                    height: 36px;
                    min-width: 64px;
                    border-radius: 999px;
                    border: 1px solid #b0b0b0;
                    background-color: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 15px;
                    color: #333;
                    box-sizing: border-box;
                }

                .energy-production-capsule-row-canada .energy-production-capsule-pill {
                    border-width: 2px;
                    border-color: var(--gc-accent);
                    font-weight: bold;
                    font-size: 16px;
                }

                .layout-stacked {
                    flex-direction: column !important;
                }

                .layout-stacked .energy-production-chart-section {
                    width: 100% !important;
                }

                .layout-stacked .custom-chart-container {
                    width: 100% !important;
                    max-width: 1280px !important;
                    margin: 0 auto !important;
                }

                .layout-stacked .energy-production-rankings-section {
                    width: 100% !important;
                    max-width: 1280px !important;
                    margin-left: auto !important;
                    margin-right: auto !important;
                    margin-top: 30px;
                }

                .layout-stacked .energy-production-chart-section .data-table-wrapper,
                .layout-stacked .energy-production-rankings-section .data-table-wrapper {
                    margin-top: 30px;
                    width: 100% !important;
                }

                @media (max-width: 1280px) {
                    .energy-production-content-wrapper {
                        flex-direction: column;
                    }
                    .energy-production-rankings-section {
                        flex: 1;
                        width: 100%;
                    }
                    .energy-production-chart-section {
                        width: 100%;
                    }
                    .custom-chart-container {
                        max-width: 100% !important;
                        width: 100% !important;
                    }
                }

                @media (max-width: 768px) {
                    .energy-production-title {
                        font-size: 37px;
                    }
                    .energy-production-subtitle {
                        font-size: 35px;
                    }
                    .energy-production-narrative {
                        font-size: 18px;
                    }
                    .energy-production-chart-title,
                    .energy-production-rankings-title {
                        font-size: 26px;
                    }
                    .energy-production-rankings-table {
                        font-size: 18px;
                    }
                }
            `}</style>

            <div className="energy-production-container">
                <header>
                    <h1 className="energy-production-title">
                        {getText('world_energy_production_title', lang)}
                    </h1>
                    <p className="energy-production-subtitle">
                        {getText('world_energy_production_subtitle', lang)}
                    </p>
                </header>

                <p className="energy-production-narrative">
                    {getText('world_energy_production_narrative_part1', lang)}{year}{getText('world_energy_production_narrative_part2', lang)}
                    <strong>{Math.round(canadaGrowth)}{getText('world_energy_production_narrative_part3', lang)}</strong>
                    {getText('world_energy_production_narrative_part4', lang)}
                    <strong>{Math.round(worldGrowth)}{getText('world_energy_production_narrative_part5', lang)}</strong>
                    {getText('world_energy_production_narrative_part6', lang)}
                </p>

                <YearSelect
                    lang={lang}
                    id="world-energy-production-year-select"
                    label={getText('year_slider_label', lang)}
                    years={yearsDescending}
                    value={year}
                    onChange={setYear}
                />

                    <div role="status" className="wb-inv" aria-live="polite">
                        {year ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${year}` : ''}
                    </div>

                <div className="energy-production-content-wrapper layout-stacked">
                    <div className="energy-production-chart-section">
                        <h3 className="energy-production-chart-title" tabIndex="0">
                            {getText('world_energy_production_chart_title', lang)}
                            <br />
                            {getText('world_energy_production_chart_subtitle', lang)}
                            {year}
                        </h3>

                        <div
                            className="custom-chart-container"
                            ref={chartRef}
                            role="img"
                            aria-label={rankingAria}
                            tabIndex="0"
                        >
                            <div className="energy-production-capsule-graphic" aria-hidden="true">
                                {topProducers.map((producer, index) => {
                                    const isCanada = producer.key === 'canada';
                                    const maxPct = topProducers[0]?.pct || 1;
                                    const rawRatio = maxPct > 0 ? producer.pct / maxPct : 1;
                                    const barWidthPct = 62 + 18 * rawRatio;
                                    return (
                                        <div
                                            key={producer.key}
                                            className={`energy-production-capsule-row ${isCanada ? 'energy-production-capsule-row-canada' : ''}`}
                                        >
                                            <div className="energy-production-capsule-bar-wrap">
                                                <div
                                                    className="energy-production-capsule-bar"
                                                    style={{ width: `${barWidthPct}%` }}
                                                >
                                                    <span className="energy-production-capsule-bar-text">{index + 1} {producer.name}</span>
                                                </div>
                                            </div>
                                            <div className="energy-production-capsule-connector" />
                                            <div className="energy-production-capsule-pill">
                                                <span className="energy-production-capsule-pill-text">{producer.pctRounded}%</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <ChartDataTable
                            lang={lang}
                            columns={producersTableColumns}
                            rows={producersTableRows}
                            csvFilename={`${producersDownloadSlug}.csv`}
                            docx={{
                                filename: `${producersDownloadSlug}.docx`,
                                title: `${producersChartTitle} (${minYear}-${maxYear})`,
                                titleAlign: 'center',
                                columnWidths: [1200, ...dynamicColumns.map(() => 1300)],
                                fontSize: 22,
                            }}
                            caption={producersCaption}
                            tableAriaLabel={producersCaption}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0
                                    ? String(raw ?? '')
                                    : (raw == null || raw === '' ? '-' : String(raw))
                            )}
                        />
                    </div>

                    <div className="energy-production-rankings-section">
                        <h3 className="energy-production-rankings-title">{getText('world_energy_production_rankings_title', lang)}, {year}</h3>

                        <div className="static-rankings-scroll-container">
                            <table className="energy-production-rankings-table table table-striped table-hover">
                                <caption className="wb-inv">
                                    {lang === 'en'
                                        ? `Global energy rankings for Canada, ${year}`
                                        : `Classements énergétiques mondiaux du Canada, ${year}`}
                                </caption>
                                <thead>
                                    <tr>
                                        <th scope="col"></th>
                                        <th scope="col">{getText('world_energy_production_rankings_header_reserves', lang)}</th>
                                        <th scope="col">{getText('world_energy_production_rankings_header_production', lang)}</th>
                                        <th scope="col">{getText('world_energy_production_rankings_header_exports', lang)}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rankingsData.map((row, idx) => (
                                        <tr key={idx}>
                                            <th scope="row" className="resource-cell">{getText(row.resource, lang)}</th>
                                            <td>{row.reserves}</td>
                                            <td>{row.production}</td>
                                            <td>{row.exports}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <ChartDataTable
                            lang={lang}
                            columns={rankingsTableColumns}
                            rows={rankingsYearData}
                            csvFilename={`${rankingsDownloadSlug}.csv`}
                            docx={{
                                filename: `${rankingsDownloadSlug}.docx`,
                                title: `${rankingsChartTitle} (2007-2024)`,
                                titleAlign: 'center',
                                columnWidths: [800, ...RANKING_RESOURCES.flatMap(() => [500, 500, 500])],
                                fontSize: 18,
                            }}
                            caption={rankingsCaption}
                            tableAriaLabel={rankingsCaption}
                            renderCell={(raw, { colIndex }) => (
                                colIndex === 0 ? String(raw ?? '') : String(raw ?? '-')
                            )}
                        />
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default WorldEnergyProduction;
