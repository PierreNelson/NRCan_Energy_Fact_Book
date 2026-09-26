import React, { useMemo, useRef } from 'react';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import PageFootnotes from '../components/PageFootnotes';
import { useOutletContext } from 'react-router-dom';
import { saveDocxBlob, Document, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from '../utils/exportTableToDocx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';

import EnergyRddByTechnologyInfographic from '../components/EnergyRddByTechnologyInfographic';
import {
    COLUMN_KEYS,
    ROW_KEYS,
    INFOGRAPHIC_DATA,
    FN_PREFIX,
    exportRddInfographicPng,
} from '../components/EnergyRddByTechnologyInfographic.constants';
import { resolveAccessibleInfographicRoot } from '../utils/downloadInfographicPng';

const EnergyRddByTechnology = () => {
    const { lang, layoutPadding } = useOutletContext();
    const figureRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    const formatMillions = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const pageTitle = getText('energy_rdd_by_technology_title', lang);
    const pageTitleSpoken = lang === 'fr'
        ? pageTitle
            .replace(/\(\$\s*millions\)/gi, 'en millions de dollars')
            .replace(/\(millions\s*de\s*\$\)/gi, 'en millions de dollars')
            .replace(/\$\s*millions/gi, 'millions de dollars')
        : pageTitle.replace(/\(\$\s*millions\)/gi, 'in millions of dollars')
            .replace(/\$\s*millions/gi, 'millions of dollars');

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

        await saveDocxBlob(`${fileSlugBase}.docx`, doc);
    };

    const downloadPng = async () => {
        const canvas = await exportRddInfographicPng(resolveAccessibleInfographicRoot(figureRef.current), {
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
            className="page-content page-36 energy-rdd-by-technology-rdd-tech page-chrome page-chrome--bleed"
            aria-labelledby="energy-rdd-by-technology-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.page-36.energy-rdd-by-technology-rdd-tech {
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
    border-radius: 2px;
    box-sizing: border-box;
}
.energy-rdd-by-technology-title:focus,
.energy-rdd-by-technology-title:focus-visible,
.energy-rdd-by-technology-data-row:focus,
.energy-rdd-by-technology-data-row:focus-visible {
    outline: 3px solid #ffbf47;
    outline-offset: 4px;
}
.energy-rdd-by-technology-infographic-wrapper { width: 100%; margin-bottom: 28px; }
.energy-rdd-by-technology-infographic-figure { margin: 0; width: 100%; }
.energy-rdd-by-technology-infographic-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    max-width: 1040px;
    margin: 0 auto;
    box-sizing: border-box;
}
.energy-rdd-by-technology-header-band,
.energy-rdd-by-technology-colhead-band,
.energy-rdd-by-technology-data-row {
    display: grid;
    grid-template-columns: minmax(56px, 76px) minmax(200px, 1.35fr) repeat(3, minmax(100px, 1fr));
    column-gap: 14px;
    width: 100%;
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
.energy-rdd-by-technology-tech-rows {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.energy-rdd-by-technology-bg2-cell {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: clamp(56px, 7.5vw, 76px);
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 0;
}
.energy-rdd-by-technology-bg2-img {
    display: block;
    width: 100%;
    height: auto;
    max-height: 100%;
    object-fit: contain;
}
.energy-rdd-by-technology-data-row {
    position: relative;
    z-index: 1;
    align-items: center;
    min-height: 72px;
    border-radius: 2px;
}
.energy-rdd-by-technology-data-row--total {
    min-height: 56px;
}
.energy-rdd-by-technology-row-icon {
    min-height: 1px;
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
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.15rem 0.25rem;
    box-sizing: border-box;
    min-width: 0;
}
.energy-rdd-by-technology-row-label .fn-lnk {
    white-space: nowrap;
}
.energy-rdd-by-technology-row-label--total {
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
@media (max-width: 768px) {
    .energy-rdd-by-technology-title { font-size: 26px; }
    .energy-rdd-by-technology-col-label, .energy-rdd-by-technology-row-label { font-size: 16px; }
    .energy-rdd-by-technology-row-label--total { font-size: 20px; }
    .energy-rdd-by-technology-header-band,
    .energy-rdd-by-technology-colhead-band,
    .energy-rdd-by-technology-data-row {
        grid-template-columns: minmax(44px, 56px) minmax(160px, 1.2fr) repeat(3, minmax(72px, 1fr));
        column-gap: 10px;
    }
    .energy-rdd-by-technology-bg2-cell {
        width: clamp(44px, 8vw, 56px);
    }
}
            `}</style>

            <div className="energy-rdd-by-technology-inner">
                <h2
                    id="energy-rdd-by-technology-title"
                    className="energy-rdd-by-technology-title"
                    tabIndex={0}
                    aria-label={pageTitleSpoken}
                >
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

                <PageFootnotes
                    lang={lang}
                    titleId={`fn-${FN_PREFIX}`}
                    className="energy-rdd-by-technology-footnotes"
                    items={[
                        {
                            id: `fn1-${FN_PREFIX}`,
                            marker: '1',
                            text: getText('energy_rdd_by_technology_footnote1', lang),
                            returnHref: `#fn1-rf-${FN_PREFIX}`,
                        },
                        {
                            id: `fn2-${FN_PREFIX}`,
                            marker: '2',
                            text: getText('energy_rdd_by_technology_footnote2', lang),
                            returnHref: `#fn2-rf-${FN_PREFIX}`,
                        },
                        {
                            id: `fn3-${FN_PREFIX}`,
                            marker: '3',
                            text: getText('energy_rdd_by_technology_footnote3', lang),
                            returnHref: `#fn3-rf-${FN_PREFIX}`,
                        },
                        {
                            id: `fn-note-${FN_PREFIX}`,
                            hideMarker: true,
                            hideReturn: true,
                            focusable: true,
                            text: getText('energy_rdd_by_technology_footnote_note', lang),
                        },
                    ]}
                />
            </div>
        </PageShell>
    );
};

export default EnergyRddByTechnology;
