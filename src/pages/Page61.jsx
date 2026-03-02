import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getEnvironmentalCleanTechData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import page61Bg from '../assets/page61_bg.svg';

const Page61 = () => {
    const { lang } = useOutletContext();
    const [data, setData] = useState({ snapshots: [], years: [], tmx: null });
    const [selectedYear, setSelectedYear] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
    const yearDropdownRef = useRef(null);
    const yearButtonRef = useRef(null);

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

    const formatNum = (n, decimals = 1) => {
        if (n === undefined || n === null) return '—';
        return Number(n).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    };
    const formatInt = (n) => {
        if (n === undefined || n === null) return '—';
        return Math.round(Number(n)).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');
    };

    const yearsList = data.years || [];
    const snap = data.snapshots?.find((s) => s.year === selectedYear) || data.snapshots?.[data.snapshots.length - 1];
    const year = selectedYear ?? snap?.year ?? 2023;
    const gdpEco = snap?.gdp_billions ?? 80.8;
    const gdpPct = 3.0; // Hardcoded until a source for Canada total GDP is available for all years
    const jobsEco = snap?.eco_jobs_total ?? 354300;
    const jobsPct = snap?.jobs_pct ?? 1.7;
    const exportsEco = snap?.eco_exports_billions ?? 19.7;
    const cleanEnergyGdpPct = snap?.clean_energy_gdp_pct ?? 1.5;
    const cleanEnergyJobs = snap?.eco_jobs_clean_energy ?? 115006;
    const tmx = data.tmx;
    const tmxCount = tmx?.count ?? 85;
    const tmxMcap = tmx?.mcap_total ?? 42.1;
    const tmxCanCount = tmx?.can_count ?? 79;
    const tmxCanMcap = tmx?.can_mcap ?? 35.9;

    if (loading) {
        return (
            <div className="page61-loading">
                {lang === 'en' ? 'Loading...' : 'Chargement...'}
            </div>
        );
    }
    if (error) {
        return (
            <div className="page61-error">
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
            aria-labelledby="page61-title"
            style={{ backgroundColor: '#fff' }}
        >
            <style>{`
                .page-61 { width: 100%; }
                .page61-container {
                    width: 100%;
                    padding: 15px 0 0 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    flex: 1;
                    overflow: visible;
                }
                .page61-stats-row {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: space-between;
                    gap: 24px;
                    margin-bottom: 12px;
                }
                .page61-stats-block {
                    flex: 1;
                    min-width: 260px;
                }
                .page61-heading {
                    font-family: 'Lato', sans-serif;
                    font-size: 22px;
                    font-weight: bold;
                    color: #332f30;
                    margin: 0 0 12px 0;
                }
                .page61-stat {
                    margin-bottom: 8px;
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 18px;
                    color: #332f30;
                }
                .page61-stat-value {
                    font-weight: bold;
                    color: #819476;
                    font-size: 24px;
                }
                .page61-bg-wrap {
                    width: 100%;
                    min-height: 280px;
                    background-color: transparent;
                    background-size: cover;
                    background-position: center;
                    margin: 0 0 24px 0;
                    border-radius: 8px;
                    overflow: hidden;
                }
                .page61-bg-wrap img {
                    width: 100%;
                    height: 100%;
                    min-height: 280px;
                    object-fit: cover;
                    object-position: center;
                    display: block;
                    vertical-align: bottom;
                }
                .page61-tsx {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    color: #332f30;
                    line-height: 1.5;
                    max-width: 80ch;
                }
                .page61-tsx strong { color: #819476; }
                .page61-year-selector {
                    display: flex;
                    align-items: center;
                    margin-bottom: 15px;
                    margin-top: 0;
                }
                .page61-year-label {
                    font-weight: bold;
                    margin-right: 15px;
                    font-size: 20px;
                    font-family: 'Noto Sans', sans-serif;
                    white-space: nowrap;
                }
                .page61-year-selector .custom-dropdown {
                    position: relative;
                    display: inline-block;
                }
                .page61-year-selector .dropdown-button {
                    padding: 8px 35px 8px 12px;
                    font-size: 18px;
                    font-family: 'Noto Sans', sans-serif;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    background-color: #fff;
                    cursor: pointer;
                    min-width: 100px;
                    text-align: left;
                    position: relative;
                }
                .page61-year-selector .dropdown-button:hover {
                    border-color: #007bff;
                }
                .page61-year-selector .dropdown-button:focus {
                    outline: 2px solid #005fcc;
                    outline-offset: 2px;
                    border-color: #007bff;
                }
                .page61-year-selector .dropdown-arrow {
                    position: absolute;
                    right: 10px;
                    top: 50%;
                    transform: translateY(-50%);
                    font-size: 10px;
                    pointer-events: none;
                }
                .page61-year-selector .dropdown-list {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    width: 100%;
                    margin: 0;
                    padding: 0;
                    list-style: none;
                    border: 1px solid #ccc;
                    border-top: none;
                    border-radius: 0 0 4px 4px;
                    background-color: #fff;
                    max-height: 200px;
                    overflow-y: auto;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    z-index: 1000;
                }
                .page61-year-selector .dropdown-list:focus {
                    outline: 2px solid #005fcc;
                    outline-offset: -2px;
                }
                .page61-year-selector .dropdown-option {
                    padding: 8px 12px;
                    cursor: pointer;
                    border-bottom: 1px solid #eee;
                }
                .page61-year-selector .dropdown-option:last-child {
                    border-bottom: none;
                }
                .page61-year-selector .dropdown-option.focused {
                    background-color: #005fcc;
                    color: #fff;
                }
                .page61-year-selector .dropdown-option.selected {
                    font-weight: bold;
                }
                .page61-year-selector .dropdown-option:hover {
                    background-color: #005fcc;
                    color: #fff;
                }
                @media (max-width: 768px) {
                    .page61-stats-row { flex-direction: column; }
                    .page61-heading { font-size: 20px; }
                    .page61-stat-value { font-size: 20px; }
                    .page61-tsx { font-size: 18px; }
                }
            `}</style>

            <div className="page61-container">
                <h1 id="page61-title" className="wb-inv">
                    {getText('page61_title', lang)}
                </h1>

                <div className="page61-year-selector">
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

                <div className="page61-stats-row">
                    <div className="page61-stats-block">
                        <p className="page61-heading">
                            {getText('page61_heading', lang)} ({year}):
                        </p>
                        <p className="page61-stat">
                            <span className="page61-stat-value">${formatNum(gdpEco)} {lang === 'en' ? 'billion' : 'milliards de dollars'}</span> {getText('page61_gdp_of', lang)} ({formatNum(gdpPct)}% {getText('page61_gdp_pct_of_total', lang)}).
                        </p>
                        <p className="page61-stat">
                            <span className="page61-stat-value">{formatInt(jobsEco)} {lang === 'en' ? 'jobs' : 'emplois'}</span> {getText('page61_jobs_representing', lang)} <strong>{formatNum(jobsPct)}%</strong> {getText('page61_jobs_pct_economy', lang)}.
                        </p>
                        <p className="page61-stat">
                            <span className="page61-stat-value">${formatNum(exportsEco)} {lang === 'en' ? 'billion' : 'milliards de dollars'}</span> {getText('page61_in_exports', lang)}.
                        </p>
                    </div>
                    <div className="page61-stats-block">
                        <p className="page61-heading">
                            {getText('page61_of_this_clean_energy', lang)}
                        </p>
                        <p className="page61-stat">
                            <span className="page61-stat-value">{formatNum(cleanEnergyGdpPct)}%</span> {getText('page61_of_canada_gdp', lang)}.
                        </p>
                        <p className="page61-stat">
                            {getText('page61_and_employed', lang)} <span className="page61-stat-value">{formatInt(cleanEnergyJobs)}</span> {getText('page61_people', lang)}
                        </p>
                    </div>
                </div>

                <div className="page61-bg-wrap" role="img" aria-label={getText('page61_bg_alt', lang)}>
                    <img
                        src={page61Bg}
                        alt=""
                        aria-hidden="true"
                        style={{ minHeight: '320px', width: '100%' }}
                    />
                </div>

                <p className="page61-tsx">
                    {getText('page61_tsx_intro', lang)} <strong>{formatInt(tmxCount)}</strong> {getText('page61_tsx_companies', lang)} <strong>${formatNum(tmxMcap)} {lang === 'en' ? 'billion' : 'milliards de dollars'}</strong>. {getText('page61_tsx_of_these', lang)} <strong>{formatInt(tmxCanCount)}</strong> {getText('page61_tsx_headquartered', lang)} <strong>${formatNum(tmxCanMcap)} {lang === 'en' ? 'billion' : 'milliards de dollars'}</strong> {getText('page61_tsx_as_of', lang)}
                </p>
            </div>
        </main>
    );
};

export default Page61;
