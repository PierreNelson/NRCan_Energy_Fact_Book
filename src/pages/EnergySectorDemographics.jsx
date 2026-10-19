import React, { useEffect, useMemo, useRef, useState } from 'react';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import { saveDocxBlob, Document, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from '../utils/exportTableToDocx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import { getEnergySectorDemographicsData } from '../utils/dataLoader';
import EnergySectorDemographicsInfographic from '../components/EnergySectorDemographicsInfographic';
import { BUBBLE_KEYS, exportDemographicsInfographicPng } from '../components/EnergySectorDemographicsInfographic.constants';
import { resolveAccessibleInfographicRoot } from '../utils/downloadInfographicPng';
import demographicsBgEn from '../assets/energy_sector_demographics_bg.svg?raw';
import demographicsBgFr from '../assets/energy_sector_demographics_bg_fr.svg?raw';

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

const formatShareHtml = (value, lang) => (
    lang === 'fr' ? formatShare(value, lang).replace(/[\u00a0\u202f ]/g, '&nbsp;') : formatShare(value, lang)
);

const EDUCATION_WORDS = {
    en: { 75: 'three-quarters', 50: 'half', 25: 'a quarter', 67: 'two-thirds' },
    fr: { 75: 'trois-quarts', 50: 'la moitié', 25: 'un quart', 67: 'les deux tiers' },
};

const educationPhrase = (value, lang) => {
    if (!Number.isFinite(Number(value))) return '—';
    const rounded = Math.abs(roundHalfUp(Number(value), 0));
    const share = formatShare(value, lang);
    const words = EDUCATION_WORDS[lang][rounded];
    return words ? `${words} (${share})` : share;
};

const patchDemographicsSvg = (markup, lang, stats) => {
    if (!stats) return markup;
    const year = String(stats.year);
    const women = formatShare(stats.women, lang);
    const indigenous = formatShare(stats.indigenous, lang);
    const education = educationPhrase(stats.educationMore, lang);
    const credential = formatShare(stats.educationCredential, lang);
    const age = formatShare(stats.age55, lang);
    const ageBaseline = formatShare(stats.age55Baseline, lang);
    const minority = formatShare(stats.visibleMinority, lang);
    const minorityBaseline = formatShare(stats.visibleMinorityBaseline, lang);
    const immigrant = formatShare(stats.immigrantEnergy, lang);
    const economy = formatShare(stats.immigrantEconomy, lang);
    if (lang === 'fr') {
        return markup
            .replace('Presque trois-quarts (75 %)', `Presque ${education}`)
            .replace('21 %. </tspan>', `${age}. </tspan>`)
            .replace('17 % en 2009.', `${ageBaseline} en 2009.`)
            .replace('>21 %</tspan><tspan> de</', `>${minority}</tspan><tspan> de</`)
            .replace('>17 %</tspan><tspan> en 2', `>${minorityBaseline}</tspan><tspan> en 2`)
            .replace('>17 %</tspan><tspan> des ', `>${immigrant}</tspan><tspan> des `)
            .replace('contre 25 %', `contre ${economy}`)
            .replace('>24 %</tspan>', `>${women}</tspan>`)
            .replace('>6 %</tspan>', `>${indigenous}</tspan>`)
            .replace('>57 %</tspan>', `>${credential}</tspan>`)
            .replaceAll('2023', year);
    }
    return markup
        .replace('Nearly three-quarters (75%)', `Nearly ${education}`)
        .replace('stood at 21%', `stood at ${age}`)
        .replace('up from 17%', `up from ${ageBaseline}`)
        .replace('>21%</tspan><tspan> of t', `>${minority}</tspan><tspan> of t`)
        .replace('>17%</tspan><tspan> in 2', `>${minorityBaseline}</tspan><tspan> in 2`)
        .replace('>17%</tspan><tspan> of e', `>${immigrant}</tspan><tspan> of e`)
        .replace('25% in the total', `${economy} in the total`)
        .replace('>24%</tspan>', `>${women}</tspan>`)
        .replace('>6%</tspan>', `>${indigenous}</tspan>`)
        .replace('>57%</tspan>', `>${credential}</tspan>`)
        .replaceAll('2023', year);
};

const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

const EnergySectorDemographics = () => {
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
                console.error('Failed to load energy sector demographics:', err);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const imageSrc = useMemo(() => {
        if (!stats) return null;
        const markup = patchDemographicsSvg(
            lang === 'fr' ? demographicsBgFr : demographicsBgEn,
            lang,
            stats,
        );
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    }, [lang, stats]);

    const text = (key, values) => fill(getText(key, lang), values);
    const share = (value) => formatShare(stats ? value : null, lang);
    const shareHtml = (value) => formatShareHtml(stats ? value : null, lang);
    const year = stats?.year ? String(stats.year) : '';
    const pageTitle = text('energy_sector_demographics_title', { year });
    const phrase = stats ? educationPhrase(stats.educationMore, lang) : '—';
    const phraseHtml = lang === 'fr' ? phrase.replace(/[\u00a0\u202f ]/g, '&nbsp;') : phrase;

    const labels = !stats ? null : Object.fromEntries(BUBBLE_KEYS.map((key) => {
        const values = {
            women: { share: shareHtml(stats.women) },
            indigenous: { share: shareHtml(stats.indigenous) },
            education: { educationPhrase: phraseHtml, credential: shareHtml(stats.educationCredential) },
            aging: { year, current: shareHtml(stats.age55), baseline: shareHtml(stats.age55Baseline) },
            diversity: { year, current: shareHtml(stats.visibleMinority), baseline: shareHtml(stats.visibleMinorityBaseline) },
            immigrants: { energy: shareHtml(stats.immigrantEnergy), economy: shareHtml(stats.immigrantEconomy) },
        };
        return [
            key,
            fill(getText(`energy_sector_demographics_bubble_${key}`, lang), values[key]).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+([.,;:!?])/g, '$1').replace(/\s+/g, ' ').trim(),
        ];
    }));

    const tableValues = {
        women: { share: share(stats?.women) },
        indigenous: { share: share(stats?.indigenous) },
        education: { more: share(stats?.educationMore), credential: share(stats?.educationCredential) },
        aging: { year, current: share(stats?.age55), baseline: share(stats?.age55Baseline) },
        diversity: { year, current: share(stats?.visibleMinority), baseline: share(stats?.visibleMinorityBaseline) },
        immigrants: { energy: share(stats?.immigrantEnergy), economy: share(stats?.immigrantEconomy) },
    };
    const tableRows = BUBBLE_KEYS.map((key) => ({
        key,
        indicator: getText(`energy_sector_demographics_csv_${key}`, lang),
        value: text(`energy_sector_demographics_csv_value_${key}`, tableValues[key]),
    }));

    const fileSlugBase = text('energy_sector_demographics_download_title', { year }).replace(/\s+/g, '_');

    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const downloadCsv = () => {
        const headers = [getText('energy_sector_demographics_csv_col_indicator', lang), getText('energy_sector_demographics_csv_col_value', lang)];
        const rows = tableRows.map((row) => [row.indicator, row.value]);
        const blob = new Blob(
            [[headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n')],
            { type: 'text/csv;charset=utf-8;' },
        );
        saveAs(blob, `${fileSlugBase}.csv`);
    };

    const downloadDocx = async () => {
        const headerRow = new TableRow({
            children: [
                getText('energy_sector_demographics_csv_col_indicator', lang),
                getText('energy_sector_demographics_csv_col_value', lang),
            ].map(
                (header, index) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: header, bold: true, size: 18 })],
                                alignment: index === 0 ? AlignmentType.LEFT : AlignmentType.LEFT,
                            }),
                        ],
                        shading: { fill: 'E6E6E6' },
                    }),
            ),
        });

        const dataRows = tableRows.map(
            (row) =>
                new TableRow({
                    children: [row.indicator, row.value].map((value) =>
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: value, size: 18 })],
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
                            children: [new TextRun({ text: stripHtml(pageTitle), bold: true, size: 28 })],
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [5200, 3600],
                            rows: [headerRow, ...dataRows],
                        }),
                    ],
                },
            ],
        });

        await saveDocxBlob(`${fileSlugBase}.docx`, doc);
    };

    const downloadPng = async () => {
        const canvas = await exportDemographicsInfographicPng(resolveAccessibleInfographicRoot(figureRef.current), {
            title: stripHtml(pageTitle),
            scale: 2,
        });
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${fileSlugBase}.png`);
        });
    };

    return (
        <PageShell tabIndex="-1"
            className="page-content page-40 energy-sector-demographics-demographics page-chrome page-chrome--bleed"
            aria-labelledby="energy-sector-demographics-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.page-40.energy-sector-demographics-demographics {
}
.energy-sector-demographics-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.energy-sector-demographics-title {
    font-family: 'Lato', sans-serif;
    font-size: 50px;
    font-weight: bold;
    color: #a0346e;
    margin: 0 0 24px 0;
    line-height: 1.2;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: none;
}
.energy-sector-demographics-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.energy-sector-demographics-infographic-section { width: 100%; margin-bottom: 28px; }
.energy-sector-demographics-infographic-figure { margin: 0; width: 100%; }
.energy-sector-demographics-download-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 15px;
}
.energy-sector-demographics-download-btn {
    padding: 8px 16px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.energy-sector-demographics-download-btn:hover { background-color: #404040 !important; }
@media (max-width: 768px) {
    .energy-sector-demographics-title { font-size: 37px; }
}
@media (max-width: 480px) {
    .energy-sector-demographics-title { font-size: 28px; }
}
            `}</style>

            <div className="energy-sector-demographics-inner">
                <h1 id="energy-sector-demographics-title" className="energy-sector-demographics-title">
                    {pageTitle}
                </h1>

                <div className="energy-sector-demographics-infographic-section">
                    <EnergySectorDemographicsInfographic
                        figureRef={figureRef}
                        lang={lang}
                        imageSrc={imageSrc}
                        labels={labels}
                    />

                    <div className="energy-sector-demographics-download-buttons">
                        <button type="button" className="energy-sector-demographics-download-btn" onClick={downloadPng}>
                            {getText('energy_sector_demographics_download_png', lang)}
                        </button>
                        <button type="button" className="energy-sector-demographics-download-btn" onClick={downloadCsv}>
                            {getText('energy_sector_demographics_download_csv', lang)}
                        </button>
                        <button type="button" className="energy-sector-demographics-download-btn" onClick={downloadDocx}>
                            {getText('energy_sector_demographics_download_docx', lang)}
                        </button>
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default EnergySectorDemographics;
