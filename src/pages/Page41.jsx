import React, { useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import Page41WagesInfographic, {
    BULLET_KEYS,
    exportPage41InfographicPng,
} from '../components/Page41WagesInfographic';

const YEAR = '2023';

const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

const Page41 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const figureRef = useRef(null);

    const pageTitle = getText('page41_title', lang);
    const ariaLabel = getText('page41_infographic_aria', lang);

    const bulletHtml = useMemo(
        () => Object.fromEntries(BULLET_KEYS.map((key) => [key, getText(`page41_bullet_${key}`, lang)])),
        [lang],
    );

    const bulletAria = useMemo(
        () => Object.fromEntries(BULLET_KEYS.map((key) => [key, stripHtml(getText(`page41_bullet_${key}`, lang))])),
        [lang],
    );

    const tableRows = useMemo(
        () =>
            BULLET_KEYS.map((key) => ({
                key,
                indicator: getText(`page41_csv_${key}`, lang),
                value: getText(`page41_csv_value_${key}`, lang),
            })),
        [lang],
    );

    const fileSlugBase = getText('page41_download_title', lang).replace(/\{\{year\}\}/g, YEAR).replace(/\s+/g, '_');

    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const downloadCsv = () => {
        const headers = [getText('page41_csv_col_indicator', lang), getText('page41_csv_col_value', lang)];
        const rows = tableRows.map((row) => [row.indicator, row.value]);
        const blob = new Blob(
            [[headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n')],
            { type: 'text/csv;charset=utf-8;' },
        );
        saveAs(blob, `${fileSlugBase}.csv`);
    };

    const downloadDocx = async () => {
        const headerRow = new TableRow({
            children: [getText('page41_csv_col_indicator', lang), getText('page41_csv_col_value', lang)].map(
                (header) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: header, bold: true, size: 18 })],
                            }),
                        ],
                        shading: { fill: 'E6E6E6' },
                    }),
            ),
        });

        const dataRows = tableRows.map(
            (row) =>
                new TableRow({
                    children: [row.indicator, row.value].map(
                        (value) =>
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

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${fileSlugBase}.docx`);
    };

    const downloadPng = async () => {
        const canvas = await exportPage41InfographicPng(figureRef.current, {
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
            className="page-content page-41 page41-wages"
            role="main"
            aria-labelledby="page41-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-41.page41-wages {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.page41-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.page41-title {
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
.page41-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.page41-infographic-section { width: 100%; margin-bottom: 28px; }
.page41-download-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 15px;
}
.page41-download-btn {
    padding: 8px 16px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.page41-download-btn:hover { background-color: #404040 !important; }
@media (max-width: 768px) {
    .page41-title { font-size: 37px; }
}
            `}</style>

            <div className="page41-inner">
                <h1 id="page41-title" className="page41-title">
                    {pageTitle}
                </h1>

                <div className="page41-infographic-section">
                    <Page41WagesInfographic
                        figureRef={figureRef}
                        ariaLabel={ariaLabel}
                        bulletHtml={bulletHtml}
                        bulletAria={bulletAria}
                    />

                    <div className="page41-download-buttons">
                        <button type="button" className="page41-download-btn" onClick={downloadPng}>
                            {getText('page41_download_png', lang)}
                        </button>
                        <button type="button" className="page41-download-btn" onClick={downloadCsv}>
                            {getText('page41_download_csv', lang)}
                        </button>
                        <button type="button" className="page41-download-btn" onClick={downloadDocx}>
                            {getText('page41_download_docx', lang)}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Page41;
