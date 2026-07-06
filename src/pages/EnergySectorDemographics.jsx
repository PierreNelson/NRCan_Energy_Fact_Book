import React, { useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import EnergySectorDemographicsInfographic from '../components/EnergySectorDemographicsInfographic';
import { BUBBLE_KEYS, exportDemographicsInfographicPng } from '../components/EnergySectorDemographicsInfographic.constants';

const YEAR = '2023';

const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

const EnergySectorDemographics = () => {
    const { lang, layoutPadding } = useOutletContext();
    const figureRef = useRef(null);

    const pageTitle = getText('energy_sector_demographics_title', lang);
    const ariaLabel = getText('energy_sector_demographics_infographic_aria', lang);

    const bubbleHtml = useMemo(
        () => Object.fromEntries(BUBBLE_KEYS.map((key) => [key, getText(`energy_sector_demographics_bubble_${key}`, lang)])),
        [lang],
    );

    const tableRows = useMemo(
        () =>
            BUBBLE_KEYS.map((key) => ({
                key,
                indicator: getText(`energy_sector_demographics_csv_${key}`, lang),
                value: getText(`energy_sector_demographics_csv_value_${key}`, lang),
            })),
        [lang],
    );

    const fileSlugBase = getText('energy_sector_demographics_download_title', lang).replace(/\{\{year\}\}/g, YEAR).replace(/\s+/g, '_');

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

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${fileSlugBase}.docx`);
    };

    const downloadPng = async () => {
        const canvas = await exportDemographicsInfographicPng(figureRef.current, {
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
            className="page-content page-40 energy-sector-demographics-demographics"
            role="main"
            aria-labelledby="energy-sector-demographics-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-40.energy-sector-demographics-demographics {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
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
                        ariaLabel={ariaLabel}
                        bubbleHtml={bubbleHtml}
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
        </main>
    );
};

export default EnergySectorDemographics;
