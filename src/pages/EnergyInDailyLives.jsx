import React, { useState, useEffect, useMemo } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import YearSelect from '../components/YearSelect';
import { useOutletContext } from 'react-router-dom';
import { getResidentialSectorOverviewData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import energyInDailyLivesBg1 from '../assets/energy_in_daily_lives_bg1.png';
import energyInDailyLivesBg2 from '../assets/energy_in_daily_lives_bg2.png';
import energyInDailyLivesBg3 from '../assets/energy_in_daily_lives_bg3.png';
import energyInDailyLivesBg4 from '../assets/energy_in_daily_lives_bg4.png';

/** Earliest year shown in the selector and data table; extend range upward automatically when export includes newer years. */
const energy_in_daily_lives_MIN_DISPLAY_YEAR = 2022;

const PCT_KEYS = new Set(['swte_pct', 'terPct', 'euxPct', 'ee_improvement_pct']);

const substitute = (str, vars) => {
    if (!str || typeof str !== 'string') return str;
    return Object.keys(vars || {}).reduce((s, k) => s.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(vars[k] ?? '–')), str);
};

const boldNumbersInBullet = (str) => {
    if (!str || typeof str !== 'string') return str;
    const re = /(\d+\s*%|–\s*%|\d+(?:[.,]\d+)?\s*PJ|\$?[\d.,]+\s*(?:billion|milliards(?:\s+de\s+dollars)?))/gi;
    const parts = [];
    let lastIndex = 0;
    let match;
    const s = str;
    re.lastIndex = 0;
    while ((match = re.exec(s)) !== null) {
        parts.push(s.slice(lastIndex, match.index));
        parts.push(<strong key={match.index}>{match[1]}</strong>);
        lastIndex = match.index + match[1].length;
    }
    parts.push(s.slice(lastIndex));
    return parts;
};

const EnergyInDailyLives = () => {
    const { lang = 'en', layoutPadding } = useOutletContext() ?? {};
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [imgScale, setImgScale] = useState(1);
    const [pickedYear, setPickedYear] = useState(null);

    useEffect(() => {
        getResidentialSectorOverviewData()
            .then((d) => {
                setResult(d);
            })
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    const hasData = result && (result.data?.length > 0 || result.terPct != null || result.euxPct != null || result.swtePct != null || result.eeImprovementPct != null || result.eeSavingsPj != null || result.eeSavingsBillion != null);

    const allYears = useMemo(() => (result?.data ? [...new Set(result.data.map((r) => r.year))].sort((a, b) => a - b) : []), [result]);
    const years = useMemo(() => {
        if (!result?.data?.length) return [];
        return allYears.filter((y) => {
            if (y < energy_in_daily_lives_MIN_DISPLAY_YEAR) return false;
            const r = result.data.find((x) => x.year === y);
            return r && r.ter != null;
        });
    }, [result, allYears]);
    const yearsDesc = useMemo(() => [...years].sort((a, b) => b - a), [years]);

    const selectedYear = pickedYear != null && years.includes(pickedYear) ? pickedYear : (years.length > 0 ? years[years.length - 1] : null);

    useEffect(() => {
        const updateScale = () => {
            const scale = typeof window !== 'undefined' && window.visualViewport?.scale ? window.visualViewport.scale : 1;
            setImgScale(scale > 0 ? 1 / scale : 1);
        };
        updateScale();
        if (typeof window === 'undefined') return;
        const vv = window.visualViewport;
        if (vv) {
            vv.addEventListener('resize', updateScale);
            vv.addEventListener('scroll', updateScale);
            return () => {
                vv.removeEventListener('resize', updateScale);
                vv.removeEventListener('scroll', updateScale);
            };
        }
    }, []);
    const base2000 = useMemo(() => result?.data?.find((r) => r.year === 2000) ?? null, [result]);
    const selectedRow = useMemo(() => (result?.data && selectedYear != null ? result.data.find((r) => r.year === selectedYear) : null), [result, selectedYear]);

    const terPct = useMemo(() => {
        if (!base2000 || !selectedRow || base2000.ter == null || base2000.ter <= 0 || selectedRow.ter == null) return null;
        return Math.round(((selectedRow.ter - base2000.ter) / base2000.ter) * 100);
    }, [base2000, selectedRow]);
    const euxPct = useMemo(() => {
        if (!base2000 || !selectedRow || base2000.eux == null || base2000.eux <= 0 || selectedRow.eux == null) return null;
        return Math.round(((selectedRow.eux - base2000.eux) / base2000.eux) * 100);
    }, [base2000, selectedRow]);
    const swtePct = useMemo(() => (selectedRow?.swte_pct != null ? selectedRow.swte_pct : (selectedRow?.sweu != null && selectedRow?.ter > 0 ? Math.round((selectedRow.sweu / selectedRow.ter) * 100) : null)), [selectedRow]);
    const latestWithEe = useMemo(() => (result?.data ? [...result.data].reverse().find((r) => r.ee_improvement_pct != null && r.ee_savings_pj != null) : null), [result]);
    const eeImprovementPct = selectedRow?.ee_improvement_pct ?? latestWithEe?.ee_improvement_pct ?? result?.eeImprovementPct ?? null;
    const eeSavingsPj = selectedRow?.ee_savings_pj ?? latestWithEe?.ee_savings_pj ?? result?.eeSavingsPj ?? null;
    const eeSavingsBillion = selectedRow?.ee_savings_billion ?? latestWithEe?.ee_savings_billion ?? result?.eeSavingsBillion ?? null;
    const eeEndYear = selectedYear ?? latestWithEe?.year ?? result?.eeEndYear ?? null;

    const vars = hasData && result ? {
        swtePct,
        eeImprovementPct,
        eeEndYear,
        eeSavingsPj: eeSavingsPj != null ? Math.round(eeSavingsPj) : '–',
        eeSavingsBillion: eeSavingsBillion != null ? eeSavingsBillion : '–'
    } : {};

    const tableRows = useMemo(() => {
        if (!result?.data?.length) return [];
        return result.data.map((r) => {
            const terPctRow = base2000 && base2000.ter > 0 && r.ter != null ? Math.round(((r.ter - base2000.ter) / base2000.ter) * 100) : null;
            const euxPctRow = base2000 && base2000.eux != null && base2000.eux > 0 && r.eux != null ? Math.round(((r.eux - base2000.eux) / base2000.eux) * 100) : null;
            const swte = r.swte_pct != null ? r.swte_pct : (r.sweu != null && r.ter > 0 ? Math.round((r.sweu / r.ter) * 100) : null);
            return {
                year: r.year,
                ter: r.ter,
                eee: r.eee,
                space_heating_pj: r.space_heating_pj,
                water_heating_pj: r.water_heating_pj,
                swte_pct: swte,
                terPct: terPctRow,
                euxPct: euxPctRow != null ? Math.abs(euxPctRow) : null,
                ee_improvement_pct: r.ee_improvement_pct,
                ee_savings_pj: r.ee_savings_pj,
                ee_savings_billion: r.ee_savings_billion
            };
        });
    }, [result, base2000]);

    /** Same years and order as the year selector (not every row in raw `result.data`). */
    const tableRowsForTable = useMemo(() => {
        if (!years.length) return [];
        return years.map((y) => tableRows.find((r) => r.year === y)).filter(Boolean);
    }, [tableRows, years]);

    const pageTitle = getText('energy_in_daily_lives_title', lang);
    const exportTableTitle = stripHtml(pageTitle);
    const tableCaption = lang === 'en'
        ? 'Residential energy metrics by year with units.'
        : 'Métriques énergétiques résidentielles par année avec unités.';
    const chartDownloadSlug = lang === 'en'
        ? 'energy_in_daily_lives_residential_metrics'
        : 'energy_in_daily_lives_metriques_residentielles';
    const docxFilename = lang === 'en'
        ? 'energy_in_daily_lives_table.docx'
        : 'energie_vies_quotidiennes_tableau.docx';

    const tableColumns = useMemo(() => [
        { key: 'year', header: lang === 'en' ? 'Year' : 'Année', align: 'left' },
        { key: 'ter', header: lang === 'en' ? 'Total residential energy (PJ)' : 'Consommation résidentielle totale (PJ)', align: 'num' },
        { key: 'eee', header: lang === 'en' ? 'Energy efficiency effect (PJ)' : 'Effet d\'efficacité énergétique (PJ)', align: 'num' },
        { key: 'space_heating_pj', header: lang === 'en' ? 'Space heating (PJ)' : 'Chauffage des locaux (PJ)', align: 'num' },
        { key: 'water_heating_pj', header: lang === 'en' ? 'Water heating (PJ)' : 'Chauffage de l\'eau (PJ)', align: 'num' },
        { key: 'swte_pct', header: lang === 'en' ? 'Space and water (%)' : 'Espace et eau % (%)', align: 'num' },
        { key: 'terPct', header: lang === 'en' ? 'Change since 2000 (%)' : 'Variation depuis 2000 (%)', align: 'num' },
        { key: 'euxPct', header: lang === 'en' ? 'Change without EE (%)' : 'Variation sans EE (%)', align: 'num' },
        { key: 'ee_improvement_pct', header: lang === 'en' ? 'EE improvement (%)' : 'Amélioration EE (%)', align: 'num' },
        { key: 'ee_savings_pj', header: lang === 'en' ? 'EE savings (PJ)' : 'Économies EE (PJ)', align: 'num' },
        { key: 'ee_savings_billion', header: lang === 'en' ? 'EE savings ($B)' : 'Économies EE (G $)', align: 'num' },
    ], [lang]);

    const formatCell = (raw, { column }) => {
        if (raw == null || raw === '') return '–';
        const key = typeof column === 'string' ? null : column?.key;
        if (key === 'year') return String(raw);
        if (key && PCT_KEYS.has(key)) return `${raw}%`;
        return String(raw);
    };

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-50 energy-in-daily-lives-main page-chrome page-chrome--bleed"
            aria-labelledby="energy-in-daily-lives-title"
            style={{
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
                ['--energy-in-daily-lives-img-scale']: imgScale,
                ...layoutBleedCssVars(layoutPadding),
            }}
        >
            <style>{`
.energy-in-daily-lives-main { width: 100%; margin: 0; padding: 0; font-family: 'Noto Sans', sans-serif; }
.energy-in-daily-lives-stack {
    width: 100%;
    padding: 0 0 2rem 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 0;
}
.energy-in-daily-lives-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 25px;
    line-height: 1.25;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: uppercase;
}
.energy-in-daily-lives-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
@media (max-width: 768px) {
    .energy-in-daily-lives-title { font-size: 37px; }
}
.energy-in-daily-lives-bullets {
    list-style-type: disc;
    padding-left: 1.25rem;
    margin: 0 0 2rem 0;
}
.energy-in-daily-lives-bullets li {
    margin-bottom: 1rem;
    font-size: 1.em;
    color: #221e1f;
    line-height: 1.5;
}
.energy-in-daily-lives-bullets li::marker { color: #221e1f; }
.energy-in-daily-lives-metrics {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    margin-top: 0;
}
.energy-in-daily-lives-visual-wrap { display: flex; flex-direction: column; align-items: flex-start; gap: 0.85rem; width: 100%; min-width: 0; }
.energy-in-daily-lives-visual-img { max-width: 180px; height: auto; object-fit: contain; }
.energy-in-daily-lives-visual-img-first { max-width: 360px; width: 360px; height: auto; object-fit: contain; }
.energy-in-daily-lives-visual-img, .energy-in-daily-lives-visual-img-first {
    transform: scale(var(--energy-in-daily-lives-img-scale, 1));
    transform-origin: top left;
}
.energy-in-daily-lives-visual-row { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; min-width: 0; width: 100%; max-width: 100%; }
.energy-in-daily-lives-visual-row .energy-in-daily-lives-visual-text { min-width: 0; flex: 1 1 0; max-width: 100%; }
.energy-in-daily-lives-visual-text {
    display: block;
    font-size: 1.25rem;
    color: #333;
    line-height: 1.4;
    overflow-wrap: anywhere;
    word-wrap: break-word;
    word-break: break-word;
    max-width: 100%;
    box-sizing: border-box;
    margin: 0;
}
.energy-in-daily-lives-visual-text .energy-in-daily-lives-visual-lead { font-weight: bold; color: var(--gc-text); }
.energy-in-daily-lives-visual-pct { font-size: 2.5rem; font-weight: bold; color: #c8782a; }
.energy-in-daily-lives-table-wrapper { margin-top: 50px; width: 100%; }
            `}</style>

            <div className="energy-in-daily-lives-stack">
                <h1 id="energy-in-daily-lives-title" className="energy-in-daily-lives-title">{pageTitle}</h1>
                <ul className="energy-in-daily-lives-bullets">
                    <li>{getText('energy_in_daily_lives_bullet1', lang)}</li>
                    <li>{boldNumbersInBullet(substitute(getText('energy_in_daily_lives_bullet2', lang), vars))}</li>
                    <li>{boldNumbersInBullet(substitute(getText('energy_in_daily_lives_bullet3', lang), vars))}</li>
                </ul>

                {hasData && years.length > 0 && (
                    <>
                        <YearSelect
                            lang={lang}
                            id="energy-in-daily-lives-year-button"
                            className="energy-in-daily-lives-year-dropdown"
                            label={getText('year_slider_label', lang)}
                            years={yearsDesc}
                            value={selectedYear}
                            onChange={setPickedYear}
                        />
                        <div role="status" className="wb-inv" aria-live="polite">
                            {selectedYear != null ? (lang === 'en' ? `Showing data for ${selectedYear}` : `Données affichées pour ${selectedYear}`) : ''}
                        </div>
                    </>
                )}

                <div className="energy-in-daily-lives-metrics">
                    {loading && <p>{lang === 'en' ? 'Loading…' : 'Chargement…'}</p>}
                    {error && <p style={{ color: '#c00' }}>{error}</p>}
                    {!loading && !error && !hasData && <p>{getText('energy_in_daily_lives_no_data', lang)}</p>}
                    {!loading && !error && hasData && (
                        <div className="energy-in-daily-lives-visual-wrap">
                            <img src={energyInDailyLivesBg1} alt="" className="energy-in-daily-lives-visual-img energy-in-daily-lives-visual-img-first" aria-hidden="true" />
                            <div className="energy-in-daily-lives-visual-row">
                                <img src={terPct != null && terPct < 0 ? energyInDailyLivesBg4 : energyInDailyLivesBg2} alt="" className="energy-in-daily-lives-visual-img" aria-hidden="true" />
                                <p className="energy-in-daily-lives-visual-text">
                                    <span className="energy-in-daily-lives-visual-lead">{terPct != null && terPct < 0 ? getText('energy_in_daily_lives_visual1_lead_decreased', lang) : getText('energy_in_daily_lives_visual1_lead', lang)}</span>{' '}
                                    <span className="energy-in-daily-lives-visual-pct">{terPct != null ? `${terPct < 0 ? Math.abs(terPct) : terPct}%` : '–'}</span>{' '}
                                    {getText('energy_in_daily_lives_visual1_since', lang)}
                                </p>
                            </div>
                            <div className="energy-in-daily-lives-visual-row">
                                <img src={energyInDailyLivesBg3} alt="" className="energy-in-daily-lives-visual-img" aria-hidden="true" />
                                <p className="energy-in-daily-lives-visual-text">
                                    <span className="energy-in-daily-lives-visual-lead">{getText('energy_in_daily_lives_visual2_lead', lang)}</span>{' '}
                                    <span className="energy-in-daily-lives-visual-pct">{euxPct != null ? `${Math.abs(euxPct)}%` : '–'}</span>{' '}
                                    {getText('energy_in_daily_lives_visual2_without', lang)}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {hasData && tableRowsForTable.length > 0 && (
                    <div className="energy-in-daily-lives-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRowsForTable}
                            csvFilename={`${chartDownloadSlug}.csv`}
                            docx={{
                                filename: docxFilename,
                                title: exportTableTitle,
                                titleAlign: 'center',
                                columnWidths: [1200, 2800, 2800, 2200, 2200, 1800, 2200, 2200, 1800, 1800, 1800],
                                fontSize: 20,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                            renderCell={formatCell}
                        />
                    </div>
                )}
            </div>
        </PageShell>
    );
};

export default EnergyInDailyLives;
