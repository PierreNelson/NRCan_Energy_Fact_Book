import React, { useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import EnergyRddByTechnologyInfographic from '../components/EnergyRddByTechnologyInfographic';
import {
    COLUMN_KEYS,
    ROW_KEYS,
    INFOGRAPHIC_DATA,
    exportRddInfographicPng,
} from '../components/EnergyRddByTechnologyInfographic.constants';

const EnergyRddByTechnology = () => {
    const { lang, layoutPadding } = useOutletContext();
    const figureRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    const scrollToElement = (id) => (event) => {
        event?.preventDefault();
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const formatMillions = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const pageTitle = getText('energy_rdd_by_technology_title', lang);
    const ariaLabel = getText('energy_rdd_by_technology_infographic_aria', lang);

    const columnLabels = useMemo(
        () => Object.fromEntries(COLUMN_KEYS.map((key) => [key, getText(`energy_rdd_by_technology_col_${key}`, lang)])),
        [lang],
    );

    const rowLabels = useMemo(
        () => Object.fromEntries(ROW_KEYS.map((key) => [key, getText(`energy_rdd_by_technology_row_${key}`, lang)])),
        [lang],
    );

    const totalLabel = getText('energy_rdd_by_technology_row_total', lang);

    const tableHeaders = [
        getText('energy_rdd_by_technology_table_col_area', lang),
        ...COLUMN_KEYS.map((key) => getText(`energy_rdd_by_technology_table_col_${key}`, lang)),
    ];

    const tableRows = useMemo(
        () => [
            ...ROW_KEYS.map((key) => ({
                key,
                label: rowLabels[key],
                values: INFOGRAPHIC_DATA[key],
                isTotal: false,
            })),
            {
                key: 'total',
                label: totalLabel,
                values: INFOGRAPHIC_DATA.total,
                isTotal: true,
            },
        ],
        [rowLabels, totalLabel],
    );

    const fileSlugBase = getText('energy_rdd_by_technology_download_title', lang).replace(/\s+/g, '_');

    const downloadCsv = () => {
        const header = tableHeaders.map(csvEscape).join(',');
        const rows = tableRows.map((row) =>
            [row.label, ...COLUMN_KEYS.map((key) => formatMillions(row.values[key]))].map(csvEscape).join(','),
        );
        const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${fileSlugBase}.csv`);
    };

    const downloadDocx = async () => {
        const headerRow = new TableRow({
            children: tableHeaders.map(
                (header, index) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: header, bold: true, size: 18 })],
                                alignment: index === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
                            }),
                        ],
                        shading: { fill: 'E6E6E6' },
                    }),
            ),
        });

        const dataRows = tableRows.map((row) =>
            new TableRow({
                children: [
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: row.label,
                                        bold: row.isTotal,
                                        size: 18,
                                    }),
                                ],
                            }),
                        ],
                    }),
                    ...COLUMN_KEYS.map((key) =>
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: formatMillions(row.values[key]),
                                            bold: row.isTotal,
                                            size: 18,
                                        }),
                                    ],
                                    alignment: AlignmentType.RIGHT,
                                }),
                            ],
                        }),
                    ),
                ],
            }),
        );

        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: stripHtml(pageTitle), bold: true, size: 28 })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: getText('energy_rdd_by_technology_table_unit_row', lang),
                                    italics: true,
                                    size: 18,
                                }),
                            ],
                            spacing: { after: 200 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [4200, 1800, 2200, 1600],
                            rows: [headerRow, ...dataRows],
                        }),
                    ],
                },
            ],
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${fileSlugBase}.docx`);
    };

    const downloadPng = async () => {
        const canvas = await exportRddInfographicPng(figureRef.current, {
            title: stripHtml(pageTitle),
            scale: 2,
        });
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${fileSlugBase}.png`);
        });
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-36 energy-rdd-by-technology-rdd-tech"
            role="main"
            aria-labelledby="energy-rdd-by-technology-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-36.energy-rdd-by-technology-rdd-tech {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.energy-rdd-by-technology-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.energy-rdd-by-technology-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 24px 0;
    text-transform: none;
    line-height: 1.25;
}
.energy-rdd-by-technology-infographic-wrapper { width: 100%; margin-bottom: 28px; }
.energy-rdd-by-technology-infographic-figure { margin: 0; width: 100%; }
.energy-rdd-by-technology-infographic-grid {
    display: grid;
    grid-template-columns: minmax(56px, 76px) minmax(200px, 1.35fr) repeat(3, minmax(100px, 1fr));
    grid-template-rows: auto auto repeat(3, minmax(72px, auto)) minmax(56px, auto);
    gap: 10px 14px;
    width: 100%;
    max-width: 1040px;
    margin: 0 auto;
    box-sizing: border-box;
}
.energy-rdd-by-technology-corner { min-height: 4px; }
.energy-rdd-by-technology-bg1-cell {
    grid-column: 3 / -1;
    display: flex;
    align-items: flex-end;
    justify-content: center;
}
.energy-rdd-by-technology-bg1-img {
    display: block;
    width: 100%;
    max-width: 550px;
    height: auto;
}
.energy-rdd-by-technology-bg2-cell {
    grid-row: 3 / 6;
    grid-column: 1;
    display: flex;
    align-items: center;
    justify-content: center;
}
.energy-rdd-by-technology-bg2-img {
    display: block;
    width: 100%;
    height: auto;
    object-fit: contain;
}
.energy-rdd-by-technology-col-label {
    font-family: 'Lato', sans-serif;
    font-size: 18px;
    font-weight: bold;
    color: #332f30;
    line-height: 1.25;
    text-align: center;
    text-transform: none;
}
.energy-rdd-by-technology-row-label {
    font-family: 'Lato', sans-serif;
    font-size: 18px;
    font-weight: bold;
    color: #332f30;
    line-height: 1.25;
    text-transform: none;
    align-self: center;
}
.energy-rdd-by-technology-row-label .fn-lnk {
    white-space: nowrap;
}
.energy-rdd-by-technology-row-label--total {
    grid-column: 2;
    font-size: clamp(24px, 2.8vw, 30px);
}
.energy-rdd-by-technology-cell-value {
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(28px, 3.6vw, 40px);
    font-weight: bold;
    color: #857550;
    text-align: center;
    min-width: 0;
}
.energy-rdd-by-technology-cell-value--total {
    font-size: clamp(32px, 4vw, 44px);
}
.energy-rdd-by-technology-download-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 15px;
    max-width: 1040px;
}
.energy-rdd-by-technology-download-btn {
    padding: 8px 16px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.energy-rdd-by-technology-download-btn:hover { background-color: #404040 !important; }
.energy-rdd-by-technology-footnotes {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--gc-text);
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
    line-height: 1.65;
}
.energy-rdd-by-technology-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0 0 1rem 0;
}
.energy-rdd-by-technology-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
.energy-rdd-by-technology-footnotes dd p { margin: 0; }
@media (max-width: 768px) {
    .energy-rdd-by-technology-title { font-size: 26px; }
    .energy-rdd-by-technology-col-label, .energy-rdd-by-technology-row-label { font-size: 16px; }
    .energy-rdd-by-technology-row-label--total { font-size: 20px; }
    .energy-rdd-by-technology-infographic-grid {
        grid-template-columns: minmax(44px, 56px) minmax(160px, 1.2fr) repeat(3, minmax(72px, 1fr));
        gap: 8px 10px;
    }
}
            `}</style>

            <div className="energy-rdd-by-technology-inner">
                <h2 id="energy-rdd-by-technology-title" className="energy-rdd-by-technology-title">
                    {pageTitle}
                </h2>

                <div className="energy-rdd-by-technology-infographic-wrapper">
                    <EnergyRddByTechnologyInfographic
                        figureRef={figureRef}
                        lang={lang}
                        columnLabels={columnLabels}
                        rowLabels={rowLabels}
                        totalLabel={totalLabel}
                        formatMillions={formatMillions}
                        scrollToElement={scrollToElement}
                        ariaLabel={ariaLabel}
                    />

                    <div className="energy-rdd-by-technology-download-buttons">
                        <button type="button" className="energy-rdd-by-technology-download-btn" onClick={downloadCsv}>
                            {getText('energy_rdd_by_technology_download_csv', lang)}
                        </button>
                        <button type="button" className="energy-rdd-by-technology-download-btn" onClick={downloadDocx}>
                            {getText('energy_rdd_by_technology_download_docx', lang)}
                        </button>
                        <button type="button" className="energy-rdd-by-technology-download-btn" onClick={downloadPng}>
                            {getText('energy_rdd_by_technology_download_png', lang)}
                        </button>
                    </div>
                </div>

                <aside className="wb-fnote energy-rdd-by-technology-footnotes" role="note">
                    <h2 id="fn-energy-rdd-by-technology">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</dt>
                        <dt>{lang === 'en' ? 'Footnote 1' : 'Note de bas de page 1'}</dt>
                        <dd id="fn1-energy-rdd-by-technology">
                            <a
                                href="#fn1-rf-energy-rdd-by-technology"
                                onClick={scrollToElement('fn1-rf-energy-rdd-by-technology')}
                                className="fn-num"
                                title={
                                    lang === 'en'
                                        ? 'Return to footnote 1 referrer'
                                        : 'Retour à la référence de la note de bas de page 1'
                                }
                            >
                                <span className="wb-inv">
                                    {lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}
                                </span>
                                1
                            </a>
                            <p>{getText('energy_rdd_by_technology_footnote1', lang)}</p>
                        </dd>
                        <dt>{lang === 'en' ? 'Footnote 2' : 'Note de bas de page 2'}</dt>
                        <dd id="fn2-energy-rdd-by-technology">
                            <a
                                href="#fn2-rf-energy-rdd-by-technology"
                                onClick={scrollToElement('fn2-rf-energy-rdd-by-technology')}
                                className="fn-num"
                                title={
                                    lang === 'en'
                                        ? 'Return to footnote 2 referrer'
                                        : 'Retour à la référence de la note de bas de page 2'
                                }
                            >
                                <span className="wb-inv">
                                    {lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}
                                </span>
                                2
                            </a>
                            <p>{getText('energy_rdd_by_technology_footnote2', lang)}</p>
                        </dd>
                        <dt>{lang === 'en' ? 'Footnote 3' : 'Note de bas de page 3'}</dt>
                        <dd id="fn3-energy-rdd-by-technology">
                            <a
                                href="#fn3-rf-energy-rdd-by-technology"
                                onClick={scrollToElement('fn3-rf-energy-rdd-by-technology')}
                                className="fn-num"
                                title={
                                    lang === 'en'
                                        ? 'Return to footnote 3 referrer'
                                        : 'Retour à la référence de la note de bas de page 3'
                                }
                            >
                                <span className="wb-inv">
                                    {lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}
                                </span>
                                3
                            </a>
                            <p>{getText('energy_rdd_by_technology_footnote3', lang)}</p>
                        </dd>
                        <dt className="wb-inv">{lang === 'en' ? 'Note' : 'Remarque'}</dt>
                        <dd id="fn-note-energy-rdd-by-technology">
                            <p>{getText('energy_rdd_by_technology_footnote_note', lang)}</p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default EnergyRddByTechnology;
