import React, { useEffect, useRef, useState } from 'react';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import { exportTableToCsv, exportTableToDocx } from '../utils/exportTableToDocx';
import { stripHtml } from '../utils/stripHtml';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import { getText } from '../utils/translations';
import { getEnergySectorDemographicsData } from '../utils/dataLoader';
import EnergySectorWagesInfographic from '../components/EnergySectorWagesInfographic';
import { BULLET_KEYS, exportWagesInfographicPng } from '../components/EnergySectorWagesInfographic.constants';
import { resolveAccessibleInfographicRoot } from '../utils/downloadInfographicPng';
import { saveAs } from 'file-saver';

const fill = (template, values) => Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value == null ? '—' : String(value)),
    template,
);

const roundHalfUp = (value, digits) => {
    const factor = 10 ** digits;
    return Math.sign(value) * Math.round((Math.abs(value) * factor) + 1e-10) / factor;
};

const formatShare = (value, lang) => {
    if (!Number.isFinite(Number(value))) return '—';
    const rounded = Math.abs(roundHalfUp(Number(value), 0)).toLocaleString(
        lang === 'fr' ? 'fr-CA' : 'en-CA',
        { maximumFractionDigits: 0 },
    );
    return lang === 'fr' ? `${rounded} %` : `${rounded}%`;
};

const formatMoney = (value, lang) => {
    if (!Number.isFinite(Number(value))) return '—';
    const rounded = Math.abs(roundHalfUp(Number(value), 0));
    const text = rounded.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { maximumFractionDigits: 0 });
    return lang === 'fr' ? `${text} $` : `$${text}`;
};

const formatShareHtml = (value, lang) => (
    lang === 'fr' ? formatShare(value, lang).replace(/[\u00a0\u202f ]/g, '&nbsp;') : formatShare(value, lang)
);

const formatMoneyHtml = (value, lang) => (
    lang === 'fr' ? formatMoney(value, lang).replace(/[\u00a0\u202f ]/g, '&nbsp;') : formatMoney(value, lang)
);

const EnergySectorWages = () => {
    const { lang, layoutPadding } = useOutletContext();
    const figureRef = useRef(null);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        let cancelled = false;
        getEnergySectorDemographicsData()
            .then((payload) => {
                if (!cancelled) setStats(payload);
            })
            .catch((err) => {
                console.error('Failed to load energy sector wages:', err);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const text = (key, values) => fill(getText(key, lang), values);
    const year = stats?.year ? String(stats.year) : '';
    const pageTitle = text('energy_sector_wages_title', { year });
    const values = {
        year,
        incomeEnergy: formatMoneyHtml(stats?.incomeEnergy, lang),
        incomeEconomy: formatMoneyHtml(stats?.incomeEconomy, lang),
        current: formatShareHtml(stats?.genderGap, lang),
        baseline: formatShareHtml(stats?.genderGapBaseline, lang),
        income: formatMoneyHtml(stats?.incomeUniversity, lang),
        office: formatShareHtml(stats?.womenOffice, lang),
        trades: formatShareHtml(stats?.menTrades, lang),
        wageTrades: formatShareHtml(stats?.wageTrades, lang),
        wageAdmin: formatShareHtml(stats?.wageAdmin, lang),
    };
    const csvValues = {
        year,
        energy: formatMoney(stats?.incomeEnergy, lang),
        economy: formatMoney(stats?.incomeEconomy, lang),
        current: formatShare(stats?.genderGap, lang),
        baseline: formatShare(stats?.genderGapBaseline, lang),
        income: formatMoney(stats?.incomeUniversity, lang),
        office: formatShare(stats?.womenOffice, lang),
        trades: formatShare(stats?.menTrades, lang),
        tradesWage: formatShare(stats?.wageTrades, lang),
        admin: formatShare(stats?.wageAdmin, lang),
    };

    const bulletHtml = Object.fromEntries(BULLET_KEYS.map((key) => {
        const bulletValues = key === 'occupation_gaps'
            ? { trades: values.wageTrades, admin: values.wageAdmin }
            : key === 'occupations'
                ? { office: values.office, trades: values.trades }
                : values;
        return [key, text(`energy_sector_wages_bullet_${key}`, bulletValues)];
    }));

    const bulletAria = Object.fromEntries(BULLET_KEYS.map((key) => [key, stripHtml(bulletHtml[key])]));

    const tableRows = BULLET_KEYS.map((key) => {
        const rowValues = key === 'occupation_gaps'
            ? { trades: csvValues.tradesWage, admin: csvValues.admin }
            : key === 'occupations'
                ? { office: csvValues.office, trades: csvValues.trades }
                : key === 'wages'
                    ? { energy: csvValues.energy, economy: csvValues.economy }
                    : key === 'gender_gap'
                        ? { year: csvValues.year, current: csvValues.current, baseline: csvValues.baseline }
                        : { income: csvValues.income };
        return {
            key,
            indicator: getText(`energy_sector_wages_csv_${key}`, lang),
            value: fill(getText(`energy_sector_wages_csv_value_${key}`, lang), rowValues),
        };
    });

    const fileSlugBase = text('energy_sector_wages_download_title', { year }).replace(/\s+/g, '_');
    const headers = [getText('energy_sector_wages_csv_col_indicator', lang), getText('energy_sector_wages_csv_col_value', lang)];
    const exportRows = tableRows.map((row) => [row.indicator, row.value]);

    const downloadCsv = () => {
        exportTableToCsv({ filename: fileSlugBase, headers, rows: exportRows });
    };

    const downloadDocx = async () => {
        await exportTableToDocx({
            filename: fileSlugBase,
            title: stripHtml(pageTitle),
            headers,
            rows: exportRows,
            columnWidths: [5200, 3600],
            options: { titleAlign: 'left', fontSize: 18 },
        });
    };

    const downloadPng = async () => {
        const canvas = await exportWagesInfographicPng(resolveAccessibleInfographicRoot(figureRef.current), {
            title: stripHtml(pageTitle),
            scale: 2,
        });
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${fileSlugBase}.png`);
        });
    };

    const bleedVars = layoutBleedCssVars(layoutPadding);

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-chrome page-chrome--bleed page-41 energy-sector-wages-wages"
            aria-labelledby="energy-sector-wages-title"
            style={{ backgroundColor: '#ffffff', ...bleedVars }}
        >
            <style>{`
.energy-sector-wages-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.energy-sector-wages-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 25px;
    line-height: 1.25;
    position: relative;
    padding-bottom: 0.5em;
}
.energy-sector-wages-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.energy-sector-wages-infographic-section { width: 100%; margin-bottom: 28px; }
.energy-sector-wages-download-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 15px;
}
@media (max-width: 768px) {
    .energy-sector-wages-title { font-size: 37px; }
}
            `}</style>

            <div className="energy-sector-wages-inner">
                <h1 id="energy-sector-wages-title" className="energy-sector-wages-title">
                    {pageTitle}
                </h1>

                <div className="energy-sector-wages-infographic-section">
                    <EnergySectorWagesInfographic
                        figureRef={figureRef}
                        bulletHtml={bulletHtml}
                        bulletAria={bulletAria}
                    />

                    <div className="energy-sector-wages-download-buttons chart-data-table-toolbar">
                        <button type="button" className="download-table-btn" onClick={downloadPng}>
                            {getText('energy_sector_wages_download_png', lang)}
                        </button>
                        <button type="button" className="download-table-btn" onClick={downloadCsv}>
                            {getText('energy_sector_wages_download_csv', lang)}
                        </button>
                        <button type="button" className="download-table-btn" onClick={downloadDocx}>
                            {getText('energy_sector_wages_download_docx', lang)}
                        </button>
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default EnergySectorWages;
