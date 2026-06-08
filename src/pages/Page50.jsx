import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getPage50ResidentialData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import page50Bg1 from '../assets/page50_bg1.png';
import page50Bg2 from '../assets/page50_bg2.png';
import page50Bg3 from '../assets/page50_bg3.png';
import page50Bg4 from '../assets/page50_bg4.png';

/** Earliest year shown in the selector and data table; extend range upward automatically when export includes newer years. */
const PAGE50_MIN_DISPLAY_YEAR = 2022;

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

const Page50 = () => {
    const outlet = useOutletContext();
    const lang = outlet?.lang ?? 'en';
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [imgScale, setImgScale] = useState(1);
    const [pickedYear, setPickedYear] = useState(null);
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const yearDropdownRef = useRef(null);
    const yearButtonRef = useRef(null);

    useEffect(() => {
        getPage50ResidentialData()
            .then((d) => {
                setResult(d);
            })
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target)) setIsYearDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const pad = { left: 0, right: 0 };
    const hasData = result && (result.data?.length > 0 || result.terPct != null || result.euxPct != null || result.swtePct != null || result.eeImprovementPct != null || result.eeSavingsPj != null || result.eeSavingsBillion != null);

    const allYears = useMemo(() => (result?.data ? [...new Set(result.data.map((r) => r.year))].sort((a, b) => a - b) : []), [result]);
    const years = useMemo(() => {
        if (!result?.data?.length) return [];
        return allYears.filter((y) => {
            if (y < PAGE50_MIN_DISPLAY_YEAR) return false;
            const r = result.data.find((x) => x.year === y);
            return r && r.ter != null;
        });
    }, [result, allYears]);

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
                euxPct: euxPctRow,
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

    const downloadTableAsCSV = () => {
        const rowsToExport = tableRowsForTable;
        if (!rowsToExport.length) return;
        const en = lang === 'en';
        const headers = [
            en ? 'Year' : 'Année',
            en ? 'Total residential energy (PJ)' : 'Consommation résidentielle totale (PJ)',
            en ? 'Energy efficiency effect (PJ)' : 'Effet d\'efficacité énergétique (PJ)',
            en ? 'Space heating (PJ)' : 'Chauffage des locaux (PJ)',
            en ? 'Water heating (PJ)' : 'Chauffage de l\'eau (PJ)',
            en ? 'Space and water % of total (%)' : 'Espace et eau % du total (%)',
            en ? 'Change in use since 2000 (%)' : 'Variation depuis 2000 (%)',
            en ? 'Change without EE since 2000 (%)' : 'Variation sans EE depuis 2000 (%)',
            en ? 'EE improvement (%)' : 'Amélioration EE (%)',
            en ? 'EE savings (PJ)' : 'Économies EE (PJ)',
            en ? 'EE savings ($B)' : 'Économies EE (G $)'
        ];
        const rows = rowsToExport.map((r) => [
            r.year,
            r.ter != null ? r.ter : '',
            r.eee != null ? r.eee : '',
            r.space_heating_pj != null ? r.space_heating_pj : '',
            r.water_heating_pj != null ? r.water_heating_pj : '',
            r.swte_pct != null ? r.swte_pct : '',
            r.terPct != null ? r.terPct : '',
            r.euxPct != null ? Math.abs(r.euxPct) : '',
            r.ee_improvement_pct != null ? r.ee_improvement_pct : '',
            r.ee_savings_pj != null ? r.ee_savings_pj : '',
            r.ee_savings_billion != null ? r.ee_savings_billion : ''
        ]);
        const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'page50_residential_metrics.csv' : 'page50_metriques_residentielles.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadTableAsDocx = async () => {
        const rowsToExport = tableRowsForTable;
        if (!rowsToExport.length) return;
        const en = lang === 'en';
        const headers = [
            en ? 'Year' : 'Année',
            en ? 'Total residential energy (PJ)' : 'Consommation résidentielle totale (PJ)',
            en ? 'Energy efficiency effect (PJ)' : 'Effet d\'efficacité énergétique (PJ)',
            en ? 'Space heating (PJ)' : 'Chauffage des locaux (PJ)',
            en ? 'Water heating (PJ)' : 'Chauffage de l\'eau (PJ)',
            en ? 'Space and water % (%)' : 'Espace et eau % (%)',
            en ? 'Change since 2000 (%)' : 'Variation depuis 2000 (%)',
            en ? 'Change without EE (%)' : 'Variation sans EE (%)',
            en ? 'EE improvement (%)' : 'Amélioration EE (%)',
            en ? 'EE savings (PJ)' : 'Économies EE (PJ)',
            en ? 'EE savings ($B)' : 'Économies EE (G $)'
        ];
        const columnWidths = [1200, 2800, 2800, 2200, 2200, 1800, 2200, 2200, 1800, 1800, 1800];
        const headerRow = new TableRow({
            children: headers.map((h) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18 })], alignment: AlignmentType.CENTER })],
                shading: { fill: 'E6E6E6' }
            }))
        });
        const dataRows = rowsToExport.map((r) => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(r.year), size: 20 })], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.ter != null ? String(r.ter) : '–', size: 20 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.eee != null ? String(r.eee) : '–', size: 20 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.space_heating_pj != null ? String(r.space_heating_pj) : '–', size: 20 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.water_heating_pj != null ? String(r.water_heating_pj) : '–', size: 20 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.swte_pct != null ? String(r.swte_pct) : '–', size: 20 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.terPct != null ? String(r.terPct) : '–', size: 20 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.euxPct != null ? String(Math.abs(r.euxPct)) : '–', size: 20 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.ee_improvement_pct != null ? String(r.ee_improvement_pct) : '–', size: 20 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.ee_savings_pj != null ? String(r.ee_savings_pj) : '–', size: 20 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.ee_savings_billion != null ? String(r.ee_savings_billion) : '–', size: 20 })], alignment: AlignmentType.RIGHT })] })
            ]
        }));
        const title = getText('page50_title', lang);
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths, rows: [headerRow, ...dataRows] })
                ]
            }]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'energy_in_daily_lives_table.docx' : 'energie_vies_quotidiennes_tableau.docx');
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-50 page50-main"
            role="main"
            style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', ['--page50-img-scale']: imgScale }}
        >
            <style>{`
.page50-main { width: 100%; margin: 0; padding: 0; font-family: 'Noto Sans', sans-serif; }
.page50-stack {
    width: 100%;
    padding: 0 ${pad.right}px 2rem ${pad.left}px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 0;
}
.page50-title {
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
.page50-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
@media (max-width: 768px) {
    .page50-title { font-size: 37px; }
}
.page50-bullets {
    list-style-type: disc;
    padding-left: 1.25rem;
    margin: 0 0 2rem 0;
}
.page50-bullets li {
    margin-bottom: 1rem;
    font-size: 1.em;
    color: #221e1f;
    line-height: 1.5;
}
.page50-bullets li::marker { color: #221e1f; }
.page50-metrics {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    margin-top: 0;
}
.page50-visual-wrap { display: flex; flex-direction: column; align-items: flex-start; gap: 0.85rem; width: 100%; min-width: 0; }
.page50-visual-img { max-width: 180px; height: auto; object-fit: contain; }
.page50-visual-img-first { max-width: 360px; width: 360px; height: auto; object-fit: contain; }
.page50-visual-img, .page50-visual-img-first {
    transform: scale(var(--page50-img-scale, 1));
    transform-origin: top left;
}
.page50-visual-row { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; min-width: 0; width: 100%; max-width: 100%; }
.page50-visual-row .page50-visual-text { min-width: 0; flex: 1 1 0; max-width: 100%; }
.page50-visual-text {
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
.page50-visual-text .page50-visual-lead { font-weight: bold; color: var(--gc-text); }
.page50-visual-pct { font-size: 2.5rem; font-weight: bold; color: #c8782a; }
.page50-year-dropdown { position: relative; margin-bottom: 20px; width: 200px; }
.page50-year-dropdown label { display: block; font-size: 14px; font-weight: bold; margin-bottom: 5px; }
.page50-year-dropdown button[aria-expanded] {
    width: 100%;
    padding: 10px 15px;
    background-color: #fff;
    border: 1px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    text-align: left;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 16px;
}
.page50-year-dropdown [role="listbox"] {
    position: absolute;
    top: 100%;
    left: 0;
    width: 100%;
    max-height: 300px;
    overflow-y: auto;
    background-color: #fff;
    border: 1px solid #ccc;
    border-radius: 4px;
    z-index: 100;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}
.page50-year-dropdown [role="option"] {
    display: flex;
    align-items: center;
    width: 100%;
    text-align: left;
    padding: 10px 15px;
    cursor: pointer;
    border: none;
    border-bottom: 1px solid #eee;
    background-color: var(--option-bg, #fff);
    font-family: Arial, sans-serif;
}
.page50-data-table-wrapper { margin-top: 50px; }
.page50-data-table { margin-top: 0; margin-bottom: 24px; }
.page50-data-table-wrapper details > summary:hover { background-color: #404040 !important; }
.page50-data-table-wrapper button[type="button"]:hover,
.page50-data-table-wrapper button:hover { background-color: #404040 !important; }
            `}</style>

            <div className="page50-stack">
                <h1 className="page50-title">{getText('page50_title', lang)}</h1>
                <ul className="page50-bullets">
                    <li>{getText('page50_bullet1', lang)}</li>
                    <li>{boldNumbersInBullet(substitute(getText('page50_bullet2', lang), vars))}</li>
                    <li>{boldNumbersInBullet(substitute(getText('page50_bullet3', lang), vars))}</li>
                </ul>

                {hasData && years.length > 0 && (
                    <div ref={yearDropdownRef} className="page50-year-dropdown">
                        <label htmlFor="page50-year-button">
                            {getText('year_slider_label', lang)}
                        </label>
                        <button
                            ref={yearButtonRef}
                            id="page50-year-button"
                            type="button"
                            onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                            aria-expanded={isYearDropdownOpen}
                            aria-haspopup="listbox"
                            aria-label={selectedYear != null ? String(selectedYear) : ''}
                        >
                            <span>{selectedYear}</span>
                            <span aria-hidden="true" style={{ fontSize: '12px' }}>{isYearDropdownOpen ? '▲' : '▼'}</span>
                        </button>
                        {isYearDropdownOpen && (
                            <div role="listbox" aria-label={lang === 'en' ? 'Year' : 'Année'}>
                                {[...years].sort((a, b) => b - a).map((y) => {
                                    const isSelected = y === selectedYear;
                                    return (
                                        <button
                                            key={y}
                                            role="option"
                                            aria-selected={isSelected}
                                            type="button"
                                            onClick={() => {
                                                setPickedYear(y);
                                                setIsYearDropdownOpen(false);
                                                setTimeout(() => yearButtonRef.current?.focus(), 0);
                                            }}
                                            style={{ backgroundColor: isSelected ? '#f0f9ff' : '#fff' }}
                                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isSelected ? '#f0f9ff' : '#f5f5f5'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isSelected ? '#f0f9ff' : '#fff'; }}
                                        >
                                            <span aria-hidden="true" style={{ height: '18px', width: '18px', borderRadius: '50%', border: '1px solid #ccc', marginRight: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
                                                {isSelected && <span style={{ height: '10px', width: '10px', borderRadius: '50%', backgroundColor: '#000' }} />}
                                            </span>
                                            <span style={{ fontSize: '16px', color: '#333' }}>{y}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <div role="status" className="wb-inv" aria-live="polite">
                            {selectedYear != null ? (lang === 'en' ? `Showing data for ${selectedYear}` : `Données affichées pour ${selectedYear}`) : ''}
                        </div>
                    </div>
                )}

                <div className="page50-metrics">
                    {loading && <p>{lang === 'en' ? 'Loading…' : 'Chargement…'}</p>}
                    {error && <p style={{ color: '#c00' }}>{error}</p>}
                    {!loading && !error && !hasData && <p>{getText('page50_no_data', lang)}</p>}
                    {!loading && !error && hasData && (
                        <div className="page50-visual-wrap">
                            <img src={page50Bg1} alt="" className="page50-visual-img page50-visual-img-first" aria-hidden="true" />
                            <div className="page50-visual-row">
                                <img src={terPct != null && terPct < 0 ? page50Bg4 : page50Bg2} alt="" className="page50-visual-img" aria-hidden="true" />
                                <p className="page50-visual-text">
                                    <span className="page50-visual-lead">{terPct != null && terPct < 0 ? getText('page50_visual1_lead_decreased', lang) : getText('page50_visual1_lead', lang)}</span>{' '}
                                    <span className="page50-visual-pct">{terPct != null ? `${terPct < 0 ? Math.abs(terPct) : terPct}%` : '–'}</span>{' '}
                                    {getText('page50_visual1_since', lang)}
                                </p>
                            </div>
                            <div className="page50-visual-row">
                                <img src={page50Bg3} alt="" className="page50-visual-img" aria-hidden="true" />
                                <p className="page50-visual-text">
                                    <span className="page50-visual-lead">{getText('page50_visual2_lead', lang)}</span>{' '}
                                    <span className="page50-visual-pct">{euxPct != null ? `${Math.abs(euxPct)}%` : '–'}</span>{' '}
                                    {getText('page50_visual2_without', lang)}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {hasData && tableRowsForTable.length > 0 && (
                    <div className="page50-data-table-wrapper" style={{ width: '100%' }}>
                    <details
                        className="page50-data-table"
                        open={isTableOpen}
                        onToggle={(e) => setIsTableOpen(e.currentTarget.open)}
                        style={{ width: '100%' }}
                    >
                        <summary
                            role="button"
                            aria-expanded={isTableOpen}
                            style={{
                                cursor: 'pointer',
                                color: '#ffffff',
                                fontWeight: 'bold',
                                padding: '10px',
                                border: '1px solid #404040',
                                backgroundColor: '#8C8C8C',
                                borderRadius: '4px',
                                listStyle: 'none'
                            }}
                        >
                            {isTableOpen ? '▼' : '▶'}
                            {' '}
                            {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                            <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                        </summary>
                        <div className="table-responsive" role="region" tabIndex={0} style={{ marginTop: 12 }}>
                            <table className="table table-striped table-hover">
                                <caption className="wb-inv">
                                    {lang === 'en' ? 'Residential energy metrics by year with units.' : 'Métriques énergétiques résidentielles par année avec unités.'}
                                </caption>
                                <thead>
                                    <tr>
                                        <th scope="col" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Year' : 'Année'}</th>
                                        <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Total residential energy (PJ)' : 'Consommation résidentielle totale (PJ)'}</th>
                                        <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Energy efficiency effect (PJ)' : 'Effet d\'efficacité énergétique (PJ)'}</th>
                                        <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Space heating (PJ)' : 'Chauffage des locaux (PJ)'}</th>
                                        <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Water heating (PJ)' : 'Chauffage de l\'eau (PJ)'}</th>
                                        <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Space and water (%)' : 'Espace et eau % (%)'}</th>
                                        <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Change since 2000 (%)' : 'Variation depuis 2000 (%)'}</th>
                                        <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Change without EE (%)' : 'Variation sans EE (%)'}</th>
                                        <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'EE improvement (%)' : 'Amélioration EE (%)'}</th>
                                        <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'EE savings (PJ)' : 'Économies EE (PJ)'}</th>
                                        <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'EE savings ($B)' : 'Économies EE (G $)'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableRowsForTable.map((r) => (
                                        <tr key={r.year}>
                                            <th scope="row" style={{ border: '1px solid #ddd' }}>{r.year}</th>
                                            <td style={{ border: '1px solid #ddd', textAlign: 'right' }}>{r.ter != null ? r.ter : '–'}</td>
                                            <td style={{ border: '1px solid #ddd', textAlign: 'right' }}>{r.eee != null ? r.eee : '–'}</td>
                                            <td style={{ border: '1px solid #ddd', textAlign: 'right' }}>{r.space_heating_pj != null ? r.space_heating_pj : '–'}</td>
                                            <td style={{ border: '1px solid #ddd', textAlign: 'right' }}>{r.water_heating_pj != null ? r.water_heating_pj : '–'}</td>
                                            <td style={{ border: '1px solid #ddd', textAlign: 'right' }}>{r.swte_pct != null ? `${r.swte_pct}%` : '–'}</td>
                                            <td style={{ border: '1px solid #ddd', textAlign: 'right' }}>{r.terPct != null ? `${r.terPct}%` : '–'}</td>
                                            <td style={{ border: '1px solid #ddd', textAlign: 'right' }}>{r.euxPct != null ? `${Math.abs(r.euxPct)}%` : '–'}</td>
                                            <td style={{ border: '1px solid #ddd', textAlign: 'right' }}>{r.ee_improvement_pct != null ? `${r.ee_improvement_pct}%` : '–'}</td>
                                            <td style={{ border: '1px solid #ddd', textAlign: 'right' }}>{r.ee_savings_pj != null ? r.ee_savings_pj : '–'}</td>
                                            <td style={{ border: '1px solid #ddd', textAlign: 'right' }}>{r.ee_savings_billion != null ? r.ee_savings_billion : '–'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                            <button type="button" onClick={downloadTableAsCSV} style={{ padding: '8px 16px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
                                {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                            </button>
                            <button type="button" onClick={downloadTableAsDocx} style={{ padding: '8px 16px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
                                {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                            </button>
                        </div>
                    </details>
                    </div>
                )}
            </div>
        </main>
    );
};

export default Page50;
