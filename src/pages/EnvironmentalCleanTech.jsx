import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import ChartDataTable from '../components/ChartDataTable';
import PageStatus from '../components/PageStatus';
import YearSelect from '../components/YearSelect';
import { getEnvironmentalCleanTechData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import environmentalCleanTechnologyBg from '../assets/environmental_clean_technology_bg.svg';
import AccessibleInfographic from '../components/AccessibleInfographic';

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const EnvironmentalCleanTech = () => {
    const { lang } = useOutletContext();
    const [data, setData] = useState({ snapshots: [], years: [], tmx: null });
    const [selectedYear, setSelectedYear] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    useEffect(() => {
        getEnvironmentalCleanTechData()
            .then((d) => {
                setData(d);
                if (d.years && d.years.length > 0) {
                    setSelectedYear(d.years[d.years.length - 1]);
                }
            })
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    const formatNum = useCallback((n, decimals = 1) => {
        if (n === undefined || n === null) return '—';
        return Number(n).toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }, [locale]);

    const formatInt = useCallback((n) => {
        if (n === undefined || n === null) return '—';
        return Math.round(Number(n)).toLocaleString(locale);
    }, [locale]);

    const yearsList = data.years || [];
    const yearsListDesc = useMemo(() => [...yearsList].sort((a, b) => b - a), [yearsList]);
    const snap = data.snapshots?.find((s) => s.year === selectedYear) || data.snapshots?.[data.snapshots.length - 1];
    const year = selectedYear ?? snap?.year ?? 2023;
    const gdpEco = snap?.gdp_billions ?? null;
    const gdpPct = snap?.gdp_pct ?? null;
    const jobsEco = snap?.eco_jobs_total ?? null;
    const jobsPct = snap?.jobs_pct ?? null;
    const exportsEco = snap?.eco_exports_billions ?? null;
    const cleanEnergyGdpPct = snap?.clean_energy_gdp_pct ?? null;
    const cleanEnergyJobs = snap?.eco_jobs_clean_energy ?? null;
    const tmx = data.tmx;
    const tmxCount = tmx?.count ?? null;
    const tmxMcap = tmx?.mcap_total ?? null;
    const tmxCanCount = tmx?.can_count ?? null;
    const tmxCanMcap = tmx?.can_mcap ?? null;

    const tableVars = {
        startYear: data.startYear ?? '',
        endYear: data.endYear ?? '',
    };
    const tableCaption = substitute(getText('environmental_clean_tech_table_caption', lang), tableVars);
    const exportTableTitle = stripHtml(tableCaption);
    const fileSlugBase = `${getText('environmental_clean_tech_download_title', lang)}_${tableVars.startYear}-${tableVars.endYear}`;

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('environmental_clean_tech_table_col_year', lang), align: 'left' },
        { key: 'gdpBillions', header: getText('environmental_clean_tech_table_col_gdp_billions', lang), align: 'num' },
        { key: 'gdpPct', header: getText('environmental_clean_tech_table_col_gdp_pct', lang), align: 'num' },
        { key: 'jobs', header: getText('environmental_clean_tech_table_col_jobs', lang), align: 'num' },
        { key: 'jobsPct', header: getText('environmental_clean_tech_table_col_jobs_pct', lang), align: 'num' },
        { key: 'exportsBillions', header: getText('environmental_clean_tech_table_col_exports', lang), align: 'num' },
        { key: 'cleanGdpPct', header: getText('environmental_clean_tech_table_col_clean_gdp_pct', lang), align: 'num' },
        { key: 'cleanJobs', header: getText('environmental_clean_tech_table_col_clean_jobs', lang), align: 'num' },
    ], [lang]);

    const tableRows = useMemo(() => [...(data.snapshots || [])]
        .map((row) => ({
            year: row.year,
            gdpBillions: row.gdp_billions,
            gdpPct: row.gdp_pct,
            jobs: row.eco_jobs_total,
            jobsPct: row.jobs_pct,
            exportsBillions: row.eco_exports_billions,
            cleanGdpPct: row.clean_energy_gdp_pct,
            cleanJobs: row.eco_jobs_clean_energy,
        })), [data.snapshots]);

    if (loading) {
        return <PageStatus lang={lang} loading className="environmental-clean-technology-loading" />;
    }
    if (error) {
        return <PageStatus lang={lang} error={error} className="environmental-clean-technology-error" />;
    }

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-61"
            role="main"
            aria-labelledby="environmental-clean-technology-title"
            style={{ backgroundColor: '#fff' }}
        >
            <style>{`
                .page-61 { width: 100%; }
                .environmental-clean-technology-container {
                    width: 100%;
                    padding: 15px 0 0 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    flex: 1;
                    overflow: visible;
                }
                .environmental-clean-technology-stats-row {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: space-between;
                    gap: 24px;
                    margin-bottom: 12px;
                }
                .environmental-clean-technology-stats-block {
                    flex: 1;
                    min-width: 260px;
                }
                .environmental-clean-technology-heading {
                    font-family: 'Lato', sans-serif;
                    font-size: 22px;
                    font-weight: bold;
                    color: #332f30;
                    margin: 0 0 12px 0;
                }
                .environmental-clean-technology-stat {
                    margin-bottom: 8px;
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 18px;
                    color: #332f30;
                }
                .environmental-clean-technology-stat-value {
                    font-weight: bold;
                    color: #819476;
                    font-size: 24px;
                }
                .environmental-clean-technology-bg-wrap {
                    width: 100%;
                    min-height: 280px;
                    background-color: transparent;
                    background-size: cover;
                    background-position: center;
                    margin: 0 0 24px 0;
                    border-radius: 8px;
                    overflow: hidden;
                }
                .environmental-clean-technology-bg-wrap img {
                    width: 100%;
                    height: 100%;
                    min-height: 280px;
                    object-fit: cover;
                    object-position: center;
                    display: block;
                    vertical-align: bottom;
                }
                .environmental-clean-technology-tsx {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    color: #332f30;
                    line-height: 1.5;
                    margin-bottom: 0;
                }
                .environmental-clean-technology-tsx strong { color: #819476; }
                .environmental-clean-technology-year-selector {
                    display: flex;
                    align-items: center;
                    margin-bottom: 15px;
                    margin-top: 0;
                }
                .page-61 .data-table-wrapper {
                    padding-top: 5px;
                    margin-top: 20px;
                    width: 100%;
                    box-sizing: border-box;
                }
                .page-61 .data-table-wrapper summary {
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    padding: 10px;
                    background-color: #8C8C8C;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    list-style: none;
                    box-sizing: border-box;
                    width: 100%;
                    color: #ffffff;
                }
                .page-61 .data-table-wrapper summary::-webkit-details-marker { display: none; }
                .page-61 .data-table-wrapper summary:hover,
                .page-61 .data-table-wrapper button:hover { background-color: #404040 !important; }
                @media (max-width: 768px) {
                    .environmental-clean-technology-stats-row { flex-direction: column; }
                    .environmental-clean-technology-heading { font-size: 20px; }
                    .environmental-clean-technology-stat-value { font-size: 20px; }
                    .environmental-clean-technology-tsx { font-size: 18px; }
                }
            `}</style>

            <div className="environmental-clean-technology-container">
                <h1 id="environmental-clean-technology-title" className="wb-inv">
                    {getText('environmental_clean_tech_title', lang)}
                </h1>

                <div className="environmental-clean-technology-year-selector">
                    <YearSelect
                        lang={lang}
                        id="environmental-clean-tech-year-select"
                        className="environmental-clean-technology-year-select"
                        label={getText('year_slider_label', lang)}
                        years={yearsListDesc}
                        value={selectedYear || (yearsList.length ? yearsList[yearsList.length - 1] : '')}
                        onChange={setSelectedYear}
                    />
                    <div role="status" className="wb-inv" aria-live="polite">
                        {selectedYear ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${selectedYear}` : ''}
                    </div>
                </div>

                <div className="environmental-clean-technology-stats-row">
                    <div className="environmental-clean-technology-stats-block">
                        <p className="environmental-clean-technology-heading">
                            {getText('environmental_clean_tech_heading', lang)} ({year}):
                        </p>
                        <p className="environmental-clean-technology-stat">
                            <span className="environmental-clean-technology-stat-value">${formatNum(gdpEco)} {lang === 'en' ? 'billion' : 'milliards de dollars'}</span> {getText('environmental_clean_tech_gdp_of', lang)} ({formatNum(gdpPct)}% {getText('environmental_clean_tech_gdp_pct_of_total', lang)}).
                        </p>
                        <p className="environmental-clean-technology-stat">
                            <span className="environmental-clean-technology-stat-value">{formatInt(jobsEco)} {lang === 'en' ? 'jobs' : 'emplois'}</span> {getText('environmental_clean_tech_jobs_representing', lang)} <strong>{formatNum(jobsPct)}%</strong> {getText('environmental_clean_tech_jobs_pct_economy', lang)}.
                        </p>
                        <p className="environmental-clean-technology-stat">
                            <span className="environmental-clean-technology-stat-value">${formatNum(exportsEco)} {lang === 'en' ? 'billion' : 'milliards de dollars'}</span> {getText('environmental_clean_tech_in_exports', lang)}.
                        </p>
                    </div>
                    <div className="environmental-clean-technology-stats-block">
                        <p className="environmental-clean-technology-heading">
                            {getText('environmental_clean_tech_of_this_clean_energy', lang)}
                        </p>
                        <p className="environmental-clean-technology-stat">
                            <span className="environmental-clean-technology-stat-value">{formatNum(cleanEnergyGdpPct)}%</span> {getText('environmental_clean_tech_of_canada_gdp', lang)}.
                        </p>
                        <p className="environmental-clean-technology-stat">
                            {getText('environmental_clean_tech_and_employed', lang)} <span className="environmental-clean-technology-stat-value">{formatInt(cleanEnergyJobs)}</span> {getText('environmental_clean_tech_people', lang)}
                        </p>
                    </div>
                </div>

                <AccessibleInfographic
                    mode="image"
                    decorative
                    as="div"
                    className="environmental-clean-technology-bg-wrap"
                    src={environmentalCleanTechnologyBg}
                    imgStyle={{ minHeight: '320px', width: '100%' }}
                />

                <p className="environmental-clean-technology-tsx">
                    {getText('environmental_clean_tech_tsx_intro', lang)} <strong>{formatInt(tmxCount)}</strong> {getText('environmental_clean_tech_tsx_companies', lang)} <strong>${formatNum(tmxMcap)} {lang === 'en' ? 'billion' : 'milliards de dollars'}</strong>. {getText('environmental_clean_tech_tsx_of_these', lang)} <strong>{formatInt(tmxCanCount)}</strong> {getText('environmental_clean_tech_tsx_headquartered', lang)} <strong>${formatNum(tmxCanMcap)} {lang === 'en' ? 'billion' : 'milliards de dollars'}</strong> {getText('environmental_clean_tech_tsx_as_of', lang)}
                </p>

                {tableRows.length > 0 && (
                    <ChartDataTable
                        lang={lang}
                        columns={tableColumns}
                        rows={tableRows}
                        csvFilename={`${fileSlugBase}.csv`}
                        docx={{
                            filename: `${fileSlugBase}.docx`,
                            title: exportTableTitle,
                            titleAlign: 'center',
                            columnWidths: [900, 1600, 1300, 1500, 1300, 1600, 1500, 1500],
                            fontSize: 20,
                        }}
                        caption={tableCaption}
                        tableAriaLabel={tableCaption}
                        renderCell={(raw, { colIndex }) => {
                            if (colIndex === 0) return String(raw ?? '');
                            if (colIndex === 3 || colIndex === 7) return formatInt(raw);
                            return formatNum(raw);
                        }}
                    />
                )}
            </div>
        </main>
    );
};

export default EnvironmentalCleanTech;
