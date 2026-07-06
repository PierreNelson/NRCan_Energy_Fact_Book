import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';

const ROW_KEYS = ['level1', 'level2', 'level3'];

const INPUT_BY_KEY = {
    level1: '120 V',
    level2: '208/240 V',
    level3: '480 V',
};

const HEADER_GREY = '48484A';
const ROW_ODD_FILL = 'B8BEAD';
const ROW_EVEN_FILL = 'fefefe';

const ElectricVehicleCharging = () => {
    const { lang, layoutPadding } = useOutletContext();

    const pageTitle = getText('electric_vehicle_charging_title', lang);
    const tableCaption = getText('electric_vehicle_charging_table_caption', lang);
    const fileSlug = getText('electric_vehicle_charging_download_title', lang);

    const tableHeaders = useMemo(() => [
        getText('electric_vehicle_charging_col_charger', lang),
        getText('electric_vehicle_charging_col_input', lang),
        getText('electric_vehicle_charging_col_outlet', lang),
        getText('electric_vehicle_charging_col_charging_time', lang),
        getText('electric_vehicle_charging_col_range', lang),
        getText('electric_vehicle_charging_col_uses', lang),
    ], [lang]);

    const tableRows = useMemo(() => ROW_KEYS.map((key) => ({
        key,
        charger: getText(`electric_vehicle_charging_row_${key}_charger`, lang),
        input: INPUT_BY_KEY[key],
        outlet: getText(`electric_vehicle_charging_row_${key}_outlet`, lang),
        chargingTime: getText(`electric_vehicle_charging_row_${key}_charging_time`, lang),
        range: getText(`electric_vehicle_charging_row_${key}_range`, lang),
        uses: getText(`electric_vehicle_charging_row_${key}_uses`, lang),
    })), [lang]);

    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const scrollToElement = (id) => (event) => {
        event?.preventDefault();
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const downloadCsv = () => {
        const header = tableHeaders.map(csvEscape).join(',');
        const rows = tableRows.map((row) => [
            row.charger,
            row.input,
            row.outlet,
            row.chargingTime,
            row.range,
            row.uses,
        ].map(csvEscape).join(','));
        saveAs(new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' }), `${fileSlug}.csv`);
    };

    const downloadDocx = async () => {
        const headerRow = new TableRow({
            children: tableHeaders.map((header) => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: header, bold: true, size: 20, color: 'FFFFFF' })],
                    alignment: AlignmentType.CENTER,
                })],
                shading: { fill: HEADER_GREY },
            })),
        });
        const dataRows = tableRows.map((row, index) => {
            const fill = index % 2 === 0 ? ROW_ODD_FILL : ROW_EVEN_FILL;
            const values = [row.charger, row.input, row.outlet, row.chargingTime, row.range, row.uses];
            return new TableRow({
                children: values.map((value, colIndex) => new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({
                            text: value,
                            size: 20,
                            bold: colIndex === 0,
                            color: colIndex === 0 ? 'FFFFFF' : undefined,
                        })],
                        alignment: colIndex === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
                    })],
                    shading: { fill: colIndex === 0 ? HEADER_GREY : fill },
                })),
            });
        });
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: pageTitle, bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [1600, 900, 2600, 1600, 1800, 2600],
                        rows: [headerRow, ...dataRows],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), `${fileSlug}.docx`);
    };

    const wrapCanvasText = (ctx, text, maxWidth) => {
        const words = String(text).split(' ');
        const lines = [];
        let current = '';
        words.forEach((word) => {
            const test = current ? `${current} ${word}` : word;
            if (ctx.measureText(test).width > maxWidth && current) {
                lines.push(current);
                current = word;
            } else {
                current = test;
            }
        });
        if (current) lines.push(current);
        return lines;
    };

    const downloadPng = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const colWidths = [150, 90, 220, 140, 170, 220];
        const tableWidth = colWidths.reduce((sum, w) => sum + w, 0);
        const headerHeight = 56;
        const rowHeight = 72;
        const titleHeight = 80;
        const tableHeight = headerHeight + tableRows.length * rowHeight;
        canvas.width = tableWidth + 40;
        canvas.height = titleHeight + tableHeight + 40;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 28px Lato, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(pageTitle, canvas.width / 2, 48);

        const startX = 20;
        let y = titleHeight;
        ctx.fillStyle = `#${HEADER_GREY}`;
        ctx.fillRect(startX, y, tableWidth, headerHeight);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Arial, sans-serif';
        ctx.textAlign = 'center';
        tableHeaders.forEach((header, index) => {
            const x = startX + colWidths.slice(0, index).reduce((sum, w) => sum + w, 0);
            const lines = wrapCanvasText(ctx, header, colWidths[index] - 12);
            lines.forEach((line, lineIndex) => {
                ctx.fillText(line, x + colWidths[index] / 2, y + 22 + lineIndex * 16);
            });
        });
        y += headerHeight;

        tableRows.forEach((row, rowIndex) => {
            const fill = rowIndex % 2 === 0 ? `#${ROW_ODD_FILL}` : `#${ROW_EVEN_FILL}`;
            ctx.fillStyle = fill;
            ctx.fillRect(startX + colWidths[0], y, tableWidth - colWidths[0], rowHeight);
            ctx.fillStyle = `#${HEADER_GREY}`;
            ctx.fillRect(startX, y, colWidths[0], rowHeight);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 13px Arial, sans-serif';
            ctx.textAlign = 'center';
            const chargerLines = wrapCanvasText(ctx, row.charger, colWidths[0] - 12);
            chargerLines.forEach((line, lineIndex) => {
                ctx.fillText(line, startX + colWidths[0] / 2, y + 24 + lineIndex * 16);
            });
            const values = [row.input, row.outlet, row.chargingTime, row.range, row.uses];
            ctx.fillStyle = '#000000';
            ctx.font = '13px Arial, sans-serif';
            values.forEach((value, colIndex) => {
                const x = startX + colWidths.slice(0, colIndex + 1).reduce((sum, w) => sum + w, 0);
                const lines = wrapCanvasText(ctx, value, colWidths[colIndex + 1] - 12);
                lines.forEach((line, lineIndex) => {
                    ctx.textAlign = 'left';
                    ctx.fillText(line, x + 8, y + 24 + lineIndex * 16);
                });
            });
            y += rowHeight;
        });

        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${fileSlug}.png`);
        });
    };

    const downloadBtnStyle = {
        padding: '8px 16px',
        backgroundColor: '#8C8C8C',
        border: '1px solid #404040',
        borderRadius: '4px',
        cursor: 'pointer',
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        color: '#ffffff',
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-98"
            role="main"
            aria-labelledby="electric-vehicle-charging-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-98.page-content { max-width: none !important; overflow-x: visible !important; }
.page-98 {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.electric-vehicle-charging-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.electric-vehicle-charging-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 25px;
    line-height: 1.25;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: none;
}
.electric-vehicle-charging-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.electric-vehicle-charging-intro {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: #332f30;
    margin: 0 0 24px 0;
    line-height: 1.45;
}
.electric-vehicle-charging-table-wrapper {
    width: 100%;
    margin-bottom: 0;
}
.electric-vehicle-charging-table-wrapper table {
    width: 100% !important;
    min-width: 100% !important;
    max-width: 100% !important;
    table-layout: fixed;
}
.electric-vehicle-charging-table-wrapper .table-responsive {
    overflow-x: auto;
    width: 100%;
}
.electric-vehicle-charging-comparison-table {
    width: 100%;
    border-collapse: collapse;
    font-family: Arial, sans-serif;
    font-size: 0.95rem;
    margin-bottom: 0;
}
.electric-vehicle-charging-comparison-table th,
.electric-vehicle-charging-comparison-table td {
    border: 1px solid #ddd;
    padding: 10px 12px;
    vertical-align: middle;
    white-space: normal;
    overflow-wrap: break-word;
    word-break: break-word;
    hyphens: auto;
}
.electric-vehicle-charging-comparison-table thead th {
    background-color: #48484A;
    color: #ffffff;
    font-weight: bold;
    text-align: center;
}
.electric-vehicle-charging-comparison-table thead th .fn-lnk {
    color: var(--gc-text);
    background-color: #ffffff;
    border-color: #6f6f6f;
}
.electric-vehicle-charging-comparison-table tbody th[scope="row"] {
    background-color: #48484A;
    color: #ffffff;
    font-weight: bold;
    text-align: center;
}
.electric-vehicle-charging-comparison-table tbody tr:nth-child(odd) td { background-color: #B8BEAD; }
.electric-vehicle-charging-comparison-table tbody tr:nth-child(even) td { background-color: #fefefe; }
.electric-vehicle-charging-comparison-table tbody tr td { text-align: left; }
.electric-vehicle-charging-comparison-table tbody tr:hover td {
    box-shadow: inset 0 0 0 9999px rgba(0, 0, 0, 0.12);
}
.electric-vehicle-charging-comparison-table tbody tr:hover th[scope="row"] {
    box-shadow: inset 0 0 0 9999px rgba(255, 255, 255, 0.08);
}
.electric-vehicle-charging-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.electric-vehicle-charging-download-buttons button:hover { background-color: #404040 !important; }
.electric-vehicle-charging-footnotes {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--gc-text);
    margin-top: 24px;
    margin-bottom: 0;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
    line-height: 1.65;
}
.electric-vehicle-charging-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 1rem;
}
.electric-vehicle-charging-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
.electric-vehicle-charging-footnotes dd p { margin: 0; }
@media (max-width: 992px) {
    .electric-vehicle-charging-comparison-table {
        font-size: 0.8rem;
    }
    .electric-vehicle-charging-comparison-table th,
    .electric-vehicle-charging-comparison-table td {
        padding: 6px 8px;
    }
}
@media (max-width: 768px) {
    .electric-vehicle-charging-title { font-size: 37px; }
    .electric-vehicle-charging-intro { font-size: 18px; }
}
            `}</style>

            <div className="electric-vehicle-charging-inner">
                <h1 id="electric-vehicle-charging-title" className="electric-vehicle-charging-title">{pageTitle}</h1>

                <p className="electric-vehicle-charging-intro">
                    {getText('electric_vehicle_charging_intro_part1', lang)}
                    <strong>{getText('electric_vehicle_charging_intro_bold1', lang)}</strong>
                    {getText('electric_vehicle_charging_intro_part2', lang)}
                    <strong>{getText('electric_vehicle_charging_intro_bold2', lang)}</strong>
                    {getText('electric_vehicle_charging_intro_part3', lang)}
                    <strong>{getText('electric_vehicle_charging_intro_bold3', lang)}</strong>
                    {getText('electric_vehicle_charging_intro_part4', lang)}
                    <strong>{getText('electric_vehicle_charging_intro_bold4', lang)}</strong>
                    {getText('electric_vehicle_charging_intro_part5', lang)}
                    <strong>{getText('electric_vehicle_charging_intro_bold5', lang)}</strong>
                    {getText('electric_vehicle_charging_intro_part6', lang)}
                </p>

                <div className="electric-vehicle-charging-table-wrapper">
                    <div className="table-responsive" role="region" aria-label={tableCaption} tabIndex={0}>
                        <table className="electric-vehicle-charging-comparison-table">
                            <caption className="wb-inv">{tableCaption}</caption>
                            <thead>
                                <tr>
                                    <th scope="col">{tableHeaders[0]}</th>
                                    <th scope="col">{tableHeaders[1]}</th>
                                    <th scope="col">{tableHeaders[2]}</th>
                                    <th scope="col">
                                        {tableHeaders[3]}
                                        <span id="fn-asterisk-rf-electric-vehicle-charging" style={{ verticalAlign: 'super', fontSize: '0.75em' }}>
                                            <a className="fn-lnk" href="#fn-asterisk-electric-vehicle-charging" onClick={scrollToElement('fn-asterisk-electric-vehicle-charging')}>
                                                <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                                                <span aria-hidden="true">*</span>
                                            </a>
                                        </span>
                                    </th>
                                    <th scope="col">
                                        {tableHeaders[4]}
                                        <span aria-hidden="true" style={{ verticalAlign: 'super', fontSize: '0.75em' }}>*</span>
                                    </th>
                                    <th scope="col">{tableHeaders[5]}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableRows.map((row) => (
                                    <tr key={row.key}>
                                        <th scope="row">{row.charger}</th>
                                        <td>{row.input}</td>
                                        <td>{row.outlet}</td>
                                        <td>{row.chargingTime}</td>
                                        <td>{row.range}</td>
                                        <td>{row.uses}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="electric-vehicle-charging-download-buttons">
                    <button type="button" onClick={downloadCsv} style={downloadBtnStyle}>
                        {getText('electric_vehicle_charging_download_csv', lang)}
                    </button>
                    <button type="button" onClick={downloadDocx} style={downloadBtnStyle}>
                        {getText('electric_vehicle_charging_download_docx', lang)}
                    </button>
                    <button type="button" onClick={downloadPng} style={downloadBtnStyle}>
                        {getText('electric_vehicle_charging_download_png', lang)}
                    </button>
                </div>

                <aside className="wb-fnote electric-vehicle-charging-footnotes" role="note">
                    <h2>{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnote' : 'Note de bas de page'}</dt>
                        <dd id="fn-asterisk-electric-vehicle-charging">
                            <a
                                href="#fn-asterisk-rf-electric-vehicle-charging"
                                onClick={scrollToElement('fn-asterisk-rf-electric-vehicle-charging')}
                                className="fn-num"
                                title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}
                            >
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                            </a>
                            {' '}
                            <p>{getText('electric_vehicle_charging_footnote', lang)}</p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default ElectricVehicleCharging;
