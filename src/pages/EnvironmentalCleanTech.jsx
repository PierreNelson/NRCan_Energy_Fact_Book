import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getEnvironmentalCleanTechData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import environmentalCleanTechnologyBg from '../assets/environmental_clean_technology_bg.svg';

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

const EnvironmentalCleanTech = () => {
    const { lang } = useOutletContext();
    const [data, setData] = useState({ snapshots: [], years: [], tmx: null });
    const [selectedYear, setSelectedYear] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const yearDropdownRef = useRef(null);
    const yearButtonRef = useRef(null);
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

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

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target)) {
                setIsYearDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
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
    const fileSlugBase = `${getText('environmental_clean_tech_download_title', lang)}_${tableVars.startYear}-${tableVars.endYear}`;

    const tableHeaders = useMemo(() => [
        getText('environmental_clean_tech_table_col_year', lang),
        getText('environmental_clean_tech_table_col_gdp_billions', lang),
        getText('environmental_clean_tech_table_col_gdp_pct', lang),
        getText('environmental_clean_tech_table_col_jobs', lang),
        getText('environmental_clean_tech_table_col_jobs_pct', lang),
        getText('environmental_clean_tech_table_col_exports', lang),
        getText('environmental_clean_tech_table_col_clean_gdp_pct', lang),
        getText('environmental_clean_tech_table_col_clean_jobs', lang),
    ], [lang]);

    const tableRows = useMemo(() => [...(data.snapshots || [])]
        .sort((a, b) => b.year - a.year)
        .map((row) => ({
            year: row.year,
            gdpBillions: formatNum(row.gdp_billions),
            gdpPct: formatNum(row.gdp_pct),
            jobs: formatInt(row.eco_jobs_total),
            jobsPct: formatNum(row.jobs_pct),
            exportsBillions: formatNum(row.eco_exports_billions),
            cleanGdpPct: formatNum(row.clean_energy_gdp_pct),
            cleanJobs: formatInt(row.eco_jobs_clean_energy),
        })), [data.snapshots, formatInt, formatNum]);

    const downloadBtnStyle = {
        padding: '8px 16px',
        backgroundColor: '#8C8C8C',
        border: '1px solid #404040',
        borderRadius: '4px',
        cursor: 'pointer',
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        color: '#ffffff',
        fontSize: '14px',
    };

    const syncTableScroll = useCallback(() => {
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = bottomScrollRef.current;
        if (!topScroll || !tableScroll || !bottomScroll) return;
        const table = tableScroll.querySelector('table');
        if (!table) return;
        [topScroll.firstElementChild, bottomScroll.firstElementChild].forEach((spacer) => {
            if (spacer) spacer.style.width = `${table.offsetWidth}px`;
        });
        const shouldShow = table.offsetWidth > tableScroll.clientWidth;
        topScroll.style.display = shouldShow ? 'block' : 'none';
        bottomScroll.style.display = shouldShow ? 'block' : 'none';
    }, []);

    useEffect(() => {
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = bottomScrollRef.current;
        if (!topScroll || !tableScroll || !bottomScroll || !isTableOpen) return;

        const syncFrom = (source) => {
            if (source !== topScroll && topScroll.scrollLeft !== source.scrollLeft) topScroll.scrollLeft = source.scrollLeft;
            if (source !== tableScroll && tableScroll.scrollLeft !== source.scrollLeft) tableScroll.scrollLeft = source.scrollLeft;
            if (source !== bottomScroll && bottomScroll.scrollLeft !== source.scrollLeft) bottomScroll.scrollLeft = source.scrollLeft;
        };

        const handleTopScroll = () => syncFrom(topScroll);
        const handleTableScroll = () => syncFrom(tableScroll);
        const handleBottomScroll = () => syncFrom(bottomScroll);
        const sync = () => window.requestAnimationFrame(syncTableScroll);

        topScroll.addEventListener('scroll', handleTopScroll);
        tableScroll.addEventListener('scroll', handleTableScroll);
        bottomScroll.addEventListener('scroll', handleBottomScroll);
        const observer = new ResizeObserver(sync);
        const tableEl = tableScroll.querySelector('table');
        if (tableEl) observer.observe(tableEl);
        observer.observe(tableScroll);
        sync();

        return () => {
            topScroll.removeEventListener('scroll', handleTopScroll);
            tableScroll.removeEventListener('scroll', handleTableScroll);
            bottomScroll.removeEventListener('scroll', handleBottomScroll);
            observer.disconnect();
        };
    }, [isTableOpen, windowWidth, syncTableScroll]);

    const downloadCsv = () => {
        const header = tableHeaders.map(csvEscape).join(',');
        const rows = tableRows.map((row) => [
            row.year,
            row.gdpBillions,
            row.gdpPct,
            row.jobs,
            row.jobsPct,
            row.exportsBillions,
            row.cleanGdpPct,
            row.cleanJobs,
        ].map(csvEscape).join(','));
        const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${fileSlugBase}.csv`);
    };

    const downloadDocx = async () => {
        const headerRow = new TableRow({
            children: tableHeaders.map(
                (header) =>
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 20 })], alignment: AlignmentType.CENTER })],
                        shading: { fill: 'E6E6E6' },
                    }),
            ),
        });
        const dataRows = tableRows.map(
            (row) =>
                new TableRow({
                    children: [
                        row.year,
                        row.gdpBillions,
                        row.gdpPct,
                        row.jobs,
                        row.jobsPct,
                        row.exportsBillions,
                        row.cleanGdpPct,
                        row.cleanJobs,
                    ].map((value, index) =>
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: String(value), size: 20 })],
                                    alignment: index === 0 ? AlignmentType.CENTER : AlignmentType.RIGHT,
                                }),
                            ],
                        }),
                    ),
                }),
        );
        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: stripHtml(tableCaption), bold: true, size: 28 })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [900, 1600, 1300, 1500, 1300, 1600, 1500, 1500],
                            rows: [headerRow, ...dataRows],
                        }),
                    ],
                },
            ],
        });
        saveAs(await Packer.toBlob(doc), `${fileSlugBase}.docx`);
    };

    if (loading) {
        return (
            <div className="environmental-clean-technology-loading">
                {lang === 'en' ? 'Loading...' : 'Chargement...'}
            </div>
        );
    }
    if (error) {
        return (
            <div className="environmental-clean-technology-error">
                {lang === 'en' ? 'Error: ' : 'Erreur : '}{error}
            </div>
        );
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
                .environmental-clean-technology-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
                .environmental-clean-technology-table-scrollbar > div { height: 20px; }
                .environmental-clean-technology-table-responsive {
                    display: block;
                    width: 100%;
                    overflow-x: auto;
                    border: 1px solid #ddd;
                    background: #fff;
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                }
                .environmental-clean-technology-table-responsive::-webkit-scrollbar { display: none; }
                .environmental-clean-technology-table-responsive table {
                    width: max-content !important;
                    min-width: 100%;
                    border-collapse: collapse;
                }
                .environmental-clean-technology-table-responsive th,
                .environmental-clean-technology-table-responsive td {
                    white-space: nowrap;
                }
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
                    <div
                        ref={yearDropdownRef}
                        style={{
                            position: 'relative',
                            marginBottom: '20px',
                            width: '200px'
                        }}
                    >
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>
                            {getText('year_slider_label', lang)}
                        </label>

                        <button
                            ref={yearButtonRef}
                            onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                            aria-expanded={isYearDropdownOpen}
                            style={{
                                width: '100%',
                                padding: '10px 15px',
                                backgroundColor: '#fff',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                textAlign: 'left',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '16px'
                            }}
                        >
                            <span>{selectedYear || (yearsList.length ? yearsList[yearsList.length - 1] : '...')}</span>
                            <span aria-hidden="true" style={{ fontSize: '12px' }}>{isYearDropdownOpen ? '▲' : '▼'}</span>
                        </button>

                        {isYearDropdownOpen && yearsList.length > 0 && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                width: '100%',
                                maxHeight: '300px',
                                overflowY: 'auto',
                                backgroundColor: '#fff',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                zIndex: 100,
                                boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                            }}>
                                {[...yearsList].sort((a, b) => b - a).map((y) => {
                                    const isSelected = selectedYear === y;
                                    return (
                                        <button
                                            key={y}
                                            type="button"
                                            aria-pressed={isSelected}
                                            aria-label={y.toString()}
                                            onClick={() => {
                                                setSelectedYear(y);
                                                setIsYearDropdownOpen(false);
                                                setTimeout(() => {
                                                    yearButtonRef.current?.focus();
                                                }, 0);
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                width: '100%',
                                                textAlign: 'left',
                                                padding: '10px 15px',
                                                cursor: 'pointer',
                                                border: 'none',
                                                borderBottom: '1px solid #eee',
                                                backgroundColor: isSelected ? '#f0f9ff' : '#fff',
                                                fontFamily: 'Arial, sans-serif'
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f5f5f5'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isSelected ? '#f0f9ff' : '#fff'; }}
                                        >
                                            <span
                                                aria-hidden="true"
                                                style={{
                                                    height: '18px',
                                                    width: '18px',
                                                    borderRadius: '50%',
                                                    border: '1px solid #ccc',
                                                    marginRight: '10px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    backgroundColor: '#fff'
                                                }}
                                            >
                                                {isSelected && (
                                                    <span style={{
                                                        height: '10px',
                                                        width: '10px',
                                                        borderRadius: '50%',
                                                        backgroundColor: '#000'
                                                    }} />
                                                )}
                                            </span>
                                            <span aria-hidden="true" style={{ fontSize: '16px', color: '#333' }}>
                                                {y}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div role="status" className="wb-inv" aria-live="polite">
                            {selectedYear ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${selectedYear}` : ''}
                        </div>
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

                <div className="environmental-clean-technology-bg-wrap" role="img" aria-label={getText('environmental_clean_tech_bg_alt', lang)}>
                    <img
                        src={environmentalCleanTechnologyBg}
                        alt=""
                        aria-hidden="true"
                        style={{ minHeight: '320px', width: '100%' }}
                    />
                </div>

                <p className="environmental-clean-technology-tsx">
                    {getText('environmental_clean_tech_tsx_intro', lang)} <strong>{formatInt(tmxCount)}</strong> {getText('environmental_clean_tech_tsx_companies', lang)} <strong>${formatNum(tmxMcap)} {lang === 'en' ? 'billion' : 'milliards de dollars'}</strong>. {getText('environmental_clean_tech_tsx_of_these', lang)} <strong>{formatInt(tmxCanCount)}</strong> {getText('environmental_clean_tech_tsx_headquartered', lang)} <strong>${formatNum(tmxCanMcap)} {lang === 'en' ? 'billion' : 'milliards de dollars'}</strong> {getText('environmental_clean_tech_tsx_as_of', lang)}
                </p>

                {tableRows.length > 0 && (
                    <details className="data-table-wrapper" onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                        <summary role="button" aria-expanded={isTableOpen}>
                            <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                            {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                            <span className="wb-inv">
                                {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                            </span>
                        </summary>
                        <div ref={topScrollRef} className="environmental-clean-technology-table-scrollbar" aria-hidden="true"><div /></div>
                        <div
                            ref={tableScrollRef}
                            className="environmental-clean-technology-table-responsive"
                            role="region"
                            aria-label={lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                            tabIndex={0}
                        >
                            <table className="table table-bordered table-striped table-hover">
                                <caption className="wb-inv">{tableCaption}</caption>
                                <thead>
                                    <tr>
                                        {tableHeaders.map((header, index) => (
                                            <th
                                                key={header}
                                                scope="col"
                                                style={{
                                                    fontWeight: 'bold',
                                                    textAlign: 'center',
                                                    whiteSpace: 'nowrap',
                                                    verticalAlign: 'bottom',
                                                    ...(index === 0
                                                        ? {
                                                            position: 'sticky',
                                                            left: 0,
                                                            backgroundColor: '#f8f9fa',
                                                            zIndex: 2,
                                                            borderRight: '2px solid #dee2e6',
                                                        }
                                                        : {}),
                                                }}
                                            >
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableRows.map((row) => (
                                        <tr key={row.year}>
                                            <th
                                                scope="row"
                                                style={{
                                                    position: 'sticky',
                                                    left: 0,
                                                    zIndex: 1,
                                                    fontWeight: 'bold',
                                                    borderRight: '2px solid #dee2e6',
                                                    backgroundColor: '#fff',
                                                    textAlign: 'center',
                                                }}
                                            >
                                                {row.year}
                                            </th>
                                            <td style={{ textAlign: 'right' }}>{row.gdpBillions}</td>
                                            <td style={{ textAlign: 'right' }}>{row.gdpPct}</td>
                                            <td style={{ textAlign: 'right' }}>{row.jobs}</td>
                                            <td style={{ textAlign: 'right' }}>{row.jobsPct}</td>
                                            <td style={{ textAlign: 'right' }}>{row.exportsBillions}</td>
                                            <td style={{ textAlign: 'right' }}>{row.cleanGdpPct}</td>
                                            <td style={{ textAlign: 'right' }}>{row.cleanJobs}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div ref={bottomScrollRef} className="environmental-clean-technology-table-scrollbar" aria-hidden="true"><div /></div>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                            <button type="button" onClick={downloadCsv} style={downloadBtnStyle}>
                                {getText('environmental_clean_tech_download_csv', lang)}
                            </button>
                            <button type="button" onClick={downloadDocx} style={downloadBtnStyle}>
                                {getText('environmental_clean_tech_download_docx', lang)}
                            </button>
                        </div>
                    </details>
                )}
            </div>
        </main>
    );
};

export default EnvironmentalCleanTech;
