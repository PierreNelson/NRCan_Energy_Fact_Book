import React, { useEffect, useMemo, useRef, useState } from 'react';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import { saveDocxBlob, Document, Table, TableRow, TableCell, Paragraph, TextRun, WidthType } from '../utils/exportTableToDocx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import { prepareInlineSvgMarkup } from '../utils/prefixSvgIds';
import { downloadInfographicImagePng } from '../utils/downloadInfographicPng';
import energyAndGhgEmissionsBgEn from '../assets/energy_and_ghg_emissions_bg.svg?raw';
import energyAndGhgEmissionsBgFr from '../assets/energy_and_ghg_emissions_bg_fr.svg?raw';
import { getEnergyAndGhgEmissionsData } from '../utils/dataLoader';

const fill = (template, values) => Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)),
    template,
);

const roundHalfUp = (value, digits) => {
    const factor = 10 ** digits;
    return Math.sign(value) * Math.round((Math.abs(value) * factor) + 1e-10) / factor;
};

const formatShare = (value, lang) => {
    const rounded = Math.abs(roundHalfUp(Number(value), 0)).toLocaleString(
        lang === 'fr' ? 'fr-CA' : 'en-CA',
        { maximumFractionDigits: 0 },
    );
    return lang === 'fr' ? `${rounded} %` : `${rounded}%`;
};

const patchEnergyGhgSvg = (markup, lang, highlights) => {
    if (!highlights?.global || !highlights?.canada) return markup;
    const globalShare = formatShare(highlights.global.share, lang);
    const canadaShare = formatShare(highlights.canada.share, lang);
    if (lang === 'fr') {
        return markup
            .replace('En 2023,', `En ${highlights.global.year},`)
            .replace('78 %', globalShare)
            .replace('environ 81 %', `environ ${canadaShare}`);
    }
    return markup
        .replace('In 2023,', `In ${highlights.global.year},`)
        .replace('78%', globalShare)
        .replace('about 81%', `about ${canadaShare}`);
};

const INFO_COLUMN_WIDTHS = [5200, 3600];

const TEXT_BLOCK_KEYS = ['global', 'includes', 'canada', 'challenges'];

/** Percent boxes over the four text regions (EN canvas 990×596, FR 834×543). */
const TEXT_BLOCK_BOXES = {
    en: {
        global: { left: 0, top: 14, width: 50, height: 30 },
        includes: { left: 0, top: 58, width: 48, height: 22 },
        canada: { left: 56.5, top: 2, width: 42.5, height: 24 },
        challenges: { left: 56, top: 28, width: 43, height: 30 },
    },
    fr: {
        global: { left: 0, top: 18, width: 56, height: 27 },
        includes: { left: 0, top: 62, width: 46, height: 32 },
        canada: { left: 57, top: 1, width: 42, height: 25 },
        challenges: { left: 55, top: 27, width: 44, height: 36 },
    },
};

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const EnergyAndGhgEmissions = () => {
    const { lang, layoutPadding } = useOutletContext();
    const infographicRef = useRef(null);
    const [highlights, setHighlights] = useState(null);

    useEffect(() => {
        let cancelled = false;
        getEnergyAndGhgEmissionsData()
            .then((data) => {
                if (!cancelled) setHighlights(data);
            })
            .catch((err) => {
                console.warn('Unable to load energy and GHG emissions.', err);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const pageTitle = getText('energy_and_ghg_emissions_title', lang);
    const svgMarkup = lang === 'en' ? energyAndGhgEmissionsBgEn : energyAndGhgEmissionsBgFr;
    const preparedSvg = useMemo(
        () => prepareInlineSvgMarkup(
            patchEnergyGhgSvg(svgMarkup, lang, highlights),
            `energy-and-ghg-${lang}`,
        ),
        [lang, svgMarkup, highlights],
    );
    const shareText = useMemo(() => {
        if (!highlights?.global || !highlights?.canada) return null;
        const globalShare = formatShare(highlights.global.share, lang);
        const canadaShare = formatShare(highlights.canada.share, lang);
        return {
            globalShare,
            canadaShare,
            globalLabel: fill(getText('energy_and_ghg_emissions_block_global', lang), {
                year: highlights.global.year,
                share: globalShare,
            }),
            canadaLabel: fill(getText('energy_and_ghg_emissions_block_canada', lang), {
                share: canadaShare,
            }),
        };
    }, [highlights, lang]);
    const textBlocks = useMemo(() => {
        const boxes = lang === 'fr' ? TEXT_BLOCK_BOXES.fr : TEXT_BLOCK_BOXES.en;
        return TEXT_BLOCK_KEYS.map((key) => ({
            key,
            label: key === 'global'
                ? shareText?.globalLabel
                : key === 'canada'
                    ? shareText?.canadaLabel
                    : getText(`energy_and_ghg_emissions_block_${key}`, lang),
            box: boxes[key],
        }));
    }, [lang, shareText]);
    const fileTitle = getText('energy_and_ghg_emissions_download_title', lang);

    const tableRows = shareText ? [
        {
            key: 'global_share',
            indicator: fill(getText('energy_and_ghg_emissions_csv_global_share', lang), {
                year: highlights.global.year,
            }),
            value: shareText.globalShare,
        },
        {
            key: 'canada_share',
            indicator: fill(getText('energy_and_ghg_emissions_csv_canada_share', lang), {
                year: highlights.canada.year,
                share: shareText.canadaShare,
            }),
            value: shareText.canadaShare,
        },
    ] : [];

    const downloadInfographicPng = async () => {
        try {
            await downloadInfographicImagePng(
                infographicRef.current,
                { filename: `${fileTitle}.png`, scale: 2 },
            );
        } catch (err) {
            console.warn('Unable to download infographic image.', err);
        }
    };

    const downloadCsv = () => {
        const headers = [
            getText('energy_and_ghg_emissions_csv_col_indicator', lang),
            getText('energy_and_ghg_emissions_csv_col_value', lang),
        ];
        const sections = [
            headers.map(csvEscape).join(','),
            ...tableRows.map((row) => [row.indicator, row.value].map(csvEscape).join(',')),
        ];
        const blob = new Blob([sections.join('\n')], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${fileTitle}.csv`);
    };

    const downloadDocx = async () => {
        const headerRow = new TableRow({
            children: [
                getText('energy_and_ghg_emissions_csv_col_indicator', lang),
                getText('energy_and_ghg_emissions_csv_col_value', lang),
            ].map((header) => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: header, bold: true, size: 18 })],
                })],
                shading: { fill: 'E6E6E6' },
            })),
        });

        const dataRows = tableRows.map((row) => new TableRow({
            children: [row.indicator, row.value].map((value) => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: value, size: 18 })],
                })],
            })),
        }));

        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: pageTitle, bold: true, size: 28 })],
                        spacing: { after: 300 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: INFO_COLUMN_WIDTHS,
                        rows: [headerRow, ...dataRows],
                    }),
                ],
            }],
        });
        await saveDocxBlob(`${fileTitle}.docx`, doc);
    };

    return (
        <PageShell tabIndex="-1"
            className="page-content energy-and-ghg-emissions page-chrome page-chrome--bleed"
            aria-labelledby="energy-and-ghg-emissions-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.energy-and-ghg-emissions {
}
.energy-and-ghg-emissions-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.energy-and-ghg-emissions.page-content h1.energy-and-ghg-emissions-title {
    font-family: 'Lato', sans-serif;
    font-size: 50px !important;
    font-weight: bold;
    color: #245e7f;
    margin-top: 0;
    margin-bottom: 25px;
    position: relative;
    padding-bottom: 0.5em;
    line-height: 1.2;
    text-transform: none;
}
.energy-and-ghg-emissions.page-content h1.energy-and-ghg-emissions-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.energy-and-ghg-emissions-figure {
    position: relative;
    margin: 0;
    width: 100%;
}
.energy-and-ghg-emissions-graphic {
    position: relative;
    width: 100%;
}
.energy-and-ghg-emissions-bg-image {
    width: 100%;
    height: auto;
    display: block;
}
.energy-and-ghg-emissions-bg-image svg {
    width: 100%;
    height: auto;
    display: block;
}
.energy-and-ghg-emissions-block {
    position: absolute;
    box-sizing: border-box;
    border-radius: 4px;
}
.energy-and-ghg-emissions-block:focus,
.energy-and-ghg-emissions-block:focus-visible {
    outline: 3px solid #ffbf47;
    outline-offset: 2px;
}
.energy-and-ghg-emissions-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin: 15px 0 20px 0;
    align-items: center;
}
.energy-and-ghg-emissions-actions button {
    appearance: none;
    -webkit-appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    height: 36px;
    padding: 0 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    background-color: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: bold;
    line-height: 1;
    color: #ffffff;
    text-align: center;
    white-space: nowrap;
    box-sizing: border-box;
}
.energy-and-ghg-emissions-actions button:hover {
    background: #404040 !important;
    background-color: #404040 !important;
}
.wb-inv {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    border: 0;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
}
@media (max-width: 768px) {
    .energy-and-ghg-emissions.page-content h1.energy-and-ghg-emissions-title { font-size: 37px !important; }
}
            `}</style>

            <div className="energy-and-ghg-emissions-inner">
                <h1 id="energy-and-ghg-emissions-title" className="energy-and-ghg-emissions-title">
                    {pageTitle}
                </h1>

                {shareText && <figure ref={infographicRef} className="energy-and-ghg-emissions-figure">
                    <div className="energy-and-ghg-emissions-graphic">
                        <div
                            className="energy-and-ghg-emissions-bg-image"
                            aria-hidden="true"
                            dangerouslySetInnerHTML={{ __html: preparedSvg }}
                        />
                        {textBlocks.map(({ key, label, box }) => (
                            <div
                                key={key}
                                className={`energy-and-ghg-emissions-block energy-and-ghg-emissions-block--${key}`}
                                role="region"
                                tabIndex={0}
                                aria-label={label}
                                data-prose-tab="1"
                                style={{
                                    left: `${box.left}%`,
                                    top: `${box.top}%`,
                                    width: `${box.width}%`,
                                    height: `${box.height}%`,
                                }}
                            />
                        ))}
                    </div>
                </figure>}

                <div className="energy-and-ghg-emissions-actions">
                    <button type="button" onClick={downloadInfographicPng}>
                        {getText('energy_and_ghg_emissions_download_png', lang)}
                    </button>
                    <button type="button" onClick={downloadCsv}>
                        {getText('energy_and_ghg_emissions_download_csv', lang)}
                    </button>
                    <button type="button" onClick={downloadDocx}>
                        {getText('energy_and_ghg_emissions_download_docx', lang)}
                    </button>
                </div>
            </div>
        </PageShell>
    );
};

export default EnergyAndGhgEmissions;
