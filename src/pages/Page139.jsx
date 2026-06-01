import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import { getPage139RefineryCapacityData } from '../utils/dataLoader';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const Page139 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [tableRows, setTableRows] = useState([]);
    const [totalRow, setTotalRow] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);

    useEffect(() => {
        getPage139RefineryCapacityData()
            .then(({ tableRows: rows, totalRow: total }) => {
                if (!rows?.length || !total) {
                    setLoadError('no_data');
                } else {
                    setTableRows(rows);
                    setTotalRow(total);
                }
            })
            .catch((err) => setLoadError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    const scrollToFootnote = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-page139')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const scrollToRef = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-rf-page139')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    const fmtNum = (n) => {
        if (n == null || Number.isNaN(Number(n))) return '\u2014';
        return Number(n).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { maximumFractionDigits: 0 });
    };

    const cellPair = (pair) => {
        if (!pair || pair.count == null) {
            return (
                <>
                    <td>{'\u2014'}</td>
                    <td>{'\u2014'}</td>
                </>
            );
        }
        return (
            <>
                <td>{fmtNum(pair.count)}</td>
                <td>{fmtNum(pair.capacity)}</td>
            </>
        );
    };

    const downloadTableAsCSV = () => {
        const prov = getText('page139_col_province', lang);
        const pr = getText('page139_hdr_petroleum', lang);
        const ap = getText('page139_hdr_asphalt', lang);
        const lu = getText('page139_hdr_lubricant', lang);
        const tot = getText('page139_hdr_total', lang);
        const cnt = getText('page139_sub_count', lang);
        const cap = getText('page139_sub_capacity', lang);
        const headers = [
            prov,
            `${pr} ${cnt}`,
            `${pr} ${cap}`,
            `${ap} ${cnt}`,
            `${ap} ${cap}`,
            `${lu} ${cnt}`,
            `${lu} ${cap}`,
            `${tot} ${cnt}`,
            `${tot} ${cap}`
        ];
        const pairVals = (pair) =>
            pair && pair.count != null ? [fmtNum(pair.count), fmtNum(pair.capacity)] : ['\u2014', '\u2014'];
        const lines = [headers.join(',')];
        tableRows.forEach((row) => {
            lines.push(
                [
                    stripHtml(getText(`page139_prov_${row.key}`, lang)),
                    ...pairVals(row.petroleum),
                    ...pairVals(row.asphalt),
                    ...pairVals(row.lubricant),
                    ...pairVals(row.total)
                ].join(',')
            );
        });
        const t = totalRow;
        lines.push(
            [
                getText('page139_total_label', lang),
                ...pairVals(t.petroleum),
                ...pairVals(t.asphalt),
                ...pairVals(t.lubricant),
                ...pairVals(t.total)
            ].join(',')
        );
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, lang === 'en' ? 'refinery_capacity_canada.csv' : 'capacite_raffineries_canada.csv');
    };

    const downloadTableAsDocx = async () => {
        // Match on-page table: header/province/total #423330; subhead & zebra ≈ #42333080 on white
        const headerBg = '423330';
        const totalBg = '423330';
        const zebra = '9E9897';
        const subBg = '9E9897';
        const provinceColW = 1400;
        const dataColW = 1000;
        const columnWidths = [provinceColW, ...Array(8).fill(dataColW)];

        const hdrGroup = (label, fontSize = 22) =>
            new TableCell({
                columnSpan: 2,
                shading: { fill: headerBg },
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: label, bold: true, size: fontSize, color: 'FFFFFF' })],
                        alignment: AlignmentType.CENTER
                    })
                ]
            });

        const subHdr = (text) =>
            new TableCell({
                shading: { fill: subBg },
                children: [
                    new Paragraph({
                        children: [new TextRun({ text, bold: true, size: 22, color: '000000' })],
                        alignment: AlignmentType.CENTER
                    })
                ]
            });

        const row1 = new TableRow({
            children: [
                new TableCell({
                    rowSpan: 2,
                    shading: { fill: headerBg },
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: stripHtml(getText('page139_col_province', lang)),
                                    bold: true,
                                    size: 22,
                                    color: 'FFFFFF'
                                })
                            ],
                            alignment: AlignmentType.LEFT
                        })
                    ]
                }),
                hdrGroup(stripHtml(getText('page139_hdr_petroleum', lang))),
                hdrGroup(stripHtml(getText('page139_hdr_asphalt', lang))),
                hdrGroup(stripHtml(getText('page139_hdr_lubricant', lang)), 20),
                hdrGroup(stripHtml(getText('page139_hdr_total', lang)))
            ]
        });

        const row2 = new TableRow({
            children: [
                subHdr(getText('page139_sub_count', lang)),
                subHdr(getText('page139_sub_capacity', lang)),
                subHdr(getText('page139_sub_count', lang)),
                subHdr(getText('page139_sub_capacity', lang)),
                subHdr(getText('page139_sub_count', lang)),
                subHdr(getText('page139_sub_capacity', lang)),
                subHdr(getText('page139_sub_count', lang)),
                subHdr(getText('page139_sub_capacity', lang))
            ]
        });

        const numCell = (pair, isEven, isTotal) => {
            const tc = isTotal ? 'FFFFFF' : '000000';
            const sh = isTotal ? totalBg : isEven ? zebra : undefined;
            if (!pair || pair.count == null) {
                return new TableCell({
                    shading: sh ? { fill: sh } : undefined,
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: '\u2014', size: 22, color: tc })],
                            alignment: AlignmentType.CENTER
                        })
                    ]
                });
            }
            return new TableCell({
                shading: sh ? { fill: sh } : undefined,
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: fmtNum(pair.count),
                                size: 22,
                                bold: isTotal,
                                color: tc
                            })
                        ],
                        alignment: AlignmentType.CENTER
                    })
                ]
            });
        };

        const capCell = (pair, isEven, isTotal) => {
            const tc = isTotal ? 'FFFFFF' : '000000';
            const sh = isTotal ? totalBg : isEven ? zebra : undefined;
            if (!pair || pair.count == null) {
                return new TableCell({
                    shading: sh ? { fill: sh } : undefined,
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: '\u2014', size: 22, color: tc })],
                            alignment: AlignmentType.CENTER
                        })
                    ]
                });
            }
            return new TableCell({
                shading: sh ? { fill: sh } : undefined,
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: fmtNum(pair.capacity),
                                size: 22,
                                bold: isTotal,
                                color: tc
                            })
                        ],
                        alignment: AlignmentType.CENTER
                    })
                ]
            });
        };

        const dataRows = tableRows.map((row, index) => {
            const isEven = (index + 1) % 2 === 0;
            return new TableRow({
                children: [
                    new TableCell({
                        shading: { fill: headerBg },
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: stripHtml(getText(`page139_prov_${row.key}`, lang)),
                                        bold: true,
                                        size: 22,
                                        color: 'FFFFFF'
                                    })
                                ],
                                alignment: AlignmentType.LEFT
                            })
                        ]
                    }),
                    numCell(row.petroleum, isEven, false),
                    capCell(row.petroleum, isEven, false),
                    numCell(row.asphalt, isEven, false),
                    capCell(row.asphalt, isEven, false),
                    numCell(row.lubricant, isEven, false),
                    capCell(row.lubricant, isEven, false),
                    numCell(row.total, isEven, false),
                    capCell(row.total, isEven, false)
                ]
            });
        });

        const t = totalRow;
        const totalDataRow = new TableRow({
            children: [
                new TableCell({
                    shading: { fill: headerBg },
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: getText('page139_total_label', lang),
                                    bold: true,
                                    size: 22,
                                    color: 'FFFFFF'
                                })
                            ],
                            alignment: AlignmentType.LEFT
                        })
                    ]
                }),
                numCell(t.petroleum, false, true),
                capCell(t.petroleum, false, true),
                numCell(t.asphalt, false, true),
                capCell(t.asphalt, false, true),
                numCell(t.lubricant, false, true),
                capCell(t.lubricant, false, true),
                numCell(t.total, false, true),
                capCell(t.total, false, true)
            ]
        });

        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: stripHtml(getText('page139_title', lang)),
                                    bold: true,
                                    size: 28
                                })
                            ],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 }
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths,
                            rows: [row1, row2, ...dataRows, totalDataRow]
                        })
                    ]
                }
            ]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'refinery_capacity_canada.docx' : 'capacite_raffineries_canada.docx');
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-139"
            role="main"
            aria-labelledby="page139-main-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            {loading && (
                <p style={{ padding: '24px', fontFamily: 'Arial, sans-serif' }}>
                    {lang === 'en' ? 'Loading…' : 'Chargement…'}
                </p>
            )}
            {!loading && loadError && (
                <p style={{ padding: '24px', fontFamily: 'Arial, sans-serif', color: '#a00' }} role="alert">
                    {lang === 'en'
                        ? 'Refinery capacity data could not be loaded. Run the osm_refin_cap pipeline refresh and export.'
                        : 'Les données sur la capacité de raffinage n’ont pas pu être chargées. Exécutez l’actualisation et l’exportation du pipeline osm_refin_cap.'}
                </p>
            )}
            {!loading && !loadError && totalRow && (
            <>
            <style>{`
                .page-139.page-content {
                    max-width: none !important;
                    overflow-x: visible !important;
                }
                .page-139 {
                    margin-left: -${layoutPadding?.left || 55}px;
                    margin-right: -${layoutPadding?.right || 15}px;
                    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
                    padding-left: ${layoutPadding?.left || 55}px;
                    padding-right: ${layoutPadding?.right || 15}px;
                }
                .page139-container {
                    width: 100%;
                    padding: 15px 0 40px 0;
                    box-sizing: border-box;
                }
                .page-139.page-content h1.page139-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 41px !important;
                    font-weight: bold;
                    color: var(--gc-text);
                    margin-top: 0;
                    margin-bottom: 25px;
                    position: relative;
                    padding-bottom: 0.5em;
                    line-height: 1.2;
                }
                .page-139.page-content h1.page139-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }
                .page139-subtitle {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    font-weight: bold;
                    color: var(--gc-text);
                    margin: 0 0 20px 0;
                    line-height: 1.5;
                    max-width: 80ch;
                }
                .page139-table-wrapper {
                    width: 100%;
                    margin-top: 20px;
                }
                .page139-table-wrapper table {
                    width: 100% !important;
                    min-width: 100% !important;
                    max-width: 100% !important;
                    table-layout: auto;
                }
                .page139-table-wrapper .table-responsive {
                    overflow-x: auto;
                    width: 100%;
                }
                .page139-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-family: Arial, sans-serif;
                    font-size: 0.9rem;
                }
                .page139-table th,
                .page139-table td {
                    border: 1px solid #ddd;
                    padding: 8px 12px;
                    text-align: center;
                }
                .page139-table thead th {
                    background-color: #423330;
                    color: white;
                    font-weight: bold;
                    font-size: 1.05rem;
                }
                .page139-table thead tr.subhead th {
                    background-color: #42333080;
                    color: #000000;
                    font-size: 0.95rem;
                }
                .page139-table .province-cell {
                    text-align: left;
                    background-color: #423330;
                    color: white;
                    font-weight: bold;
                    font-size: 1rem;
                    white-space: normal;
                    min-width: 140px;
                    vertical-align: middle;
                    line-height: 1.2;
                }
                .page139-table .total-row td,
                .page139-table .total-row th:not(.province-cell) {
                    background-color: #423330;
                    color: white;
                    font-weight: bold;
                }
                .page139-table .total-row .province-cell {
                    background-color: #423330;
                    color: white;
                }
                .page139-table tbody tr:nth-child(even):not(.total-row) {
                    background-color: #42333080;
                }
                .page139-table tbody tr:hover:not(.total-row) {
                    box-shadow: inset 0 0 0 9999px rgba(0, 0, 0, 0.2);
                    background-color: transparent;
                }
                .page139-download-buttons {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                    margin-top: 15px;
                }
                .page139-download-btn {
                    padding: 8px 16px;
                    background-color: #8c8c8c;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    color: #ffffff;
                }
                .page139-download-btn:hover {
                    background-color: #404040 !important;
                }
                .page139-footnotes {
                    font-family: var(--font-body);
                    font-size: 1rem;
                    color: var(--gc-text);
                    margin-top: 2rem;
                    margin-bottom: 0;
                    line-height: 1.65;
                    max-width: 80ch;
                }
                .page139-footnotes dl {
                    margin: 0;
                    padding: 0;
                }
                .page139-footnotes dt {
                    float: left;
                    clear: left;
                    width: 1.5em;
                    font-weight: normal;
                }
                .page139-footnotes dd {
                    margin-left: 1.5em;
                    margin-bottom: 0.5em;
                }
                .page139-footnotes dd p {
                    margin: 0;
                }
                @media (max-width: 992px) {
                    .page139-table {
                        font-size: 0.75rem;
                    }
                    .page139-table th,
                    .page139-table td {
                        padding: 4px 6px;
                    }
                }
                @media (max-width: 768px) {
                    .page-139.page-content h1.page139-title {
                        font-size: 37px !important;
                    }
                    .page139-subtitle {
                        font-size: 18px;
                    }
                }
            `}</style>

            <div className="page139-container">
                <h1 id="page139-main-title" className="page139-title">
                    {getText('page139_title', lang)}
                </h1>

                <h2 className="page139-subtitle">
                    {getText('page139_subtitle_before_star', lang)}
                    <span id="fn-asterisk-rf-page139" style={{ verticalAlign: 'super', fontSize: '0.75em', lineHeight: '0' }}>
                        <a href="#fn-asterisk-page139" onClick={scrollToFootnote} className="fn-lnk">
                            <span className="wb-inv">
                                {lang === 'en' ? 'Footnote ' : 'Note de bas de page '}
                            </span>
                            <span aria-hidden="true">*</span>
                        </a>
                    </span>
                    {getText('page139_subtitle_after_star', lang)}
                </h2>

                <div className="page139-table-wrapper">
                    <div className="table-responsive" role="region" aria-label={getText('page139_table_aria', lang)}>
                        <table className="page139-table">
                            <caption className="wb-inv">{getText('page139_table_caption', lang)}</caption>
                            <thead>
                                <tr>
                                    <th scope="col" rowSpan={2} className="province-cell">
                                        {getText('page139_col_province', lang)}
                                    </th>
                                    <th scope="colgroup" colSpan={2}>
                                        {getText('page139_hdr_petroleum', lang)}
                                    </th>
                                    <th scope="colgroup" colSpan={2}>
                                        {getText('page139_hdr_asphalt', lang)}
                                    </th>
                                    <th scope="colgroup" colSpan={2}>
                                        {getText('page139_hdr_lubricant', lang)}
                                    </th>
                                    <th scope="colgroup" colSpan={2}>
                                        {getText('page139_hdr_total', lang)}
                                    </th>
                                </tr>
                                <tr className="subhead">
                                    <th scope="col">{getText('page139_sub_count', lang)}</th>
                                    <th scope="col">{getText('page139_sub_capacity', lang)}</th>
                                    <th scope="col">{getText('page139_sub_count', lang)}</th>
                                    <th scope="col">{getText('page139_sub_capacity', lang)}</th>
                                    <th scope="col">{getText('page139_sub_count', lang)}</th>
                                    <th scope="col">{getText('page139_sub_capacity', lang)}</th>
                                    <th scope="col">{getText('page139_sub_count', lang)}</th>
                                    <th scope="col">{getText('page139_sub_capacity', lang)}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableRows.map((row) => (
                                    <tr key={row.key}>
                                        <th scope="row" className="province-cell">
                                            {getText(`page139_prov_${row.key}`, lang)}
                                        </th>
                                        {cellPair(row.petroleum)}
                                        {cellPair(row.asphalt)}
                                        {cellPair(row.lubricant)}
                                        {cellPair(row.total)}
                                    </tr>
                                ))}
                                <tr className="total-row">
                                    <th scope="row" className="province-cell">
                                        {getText('page139_total_label', lang)}
                                    </th>
                                    {cellPair(totalRow.petroleum)}
                                    {cellPair(totalRow.asphalt)}
                                    {cellPair(totalRow.lubricant)}
                                    {cellPair(totalRow.total)}
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="page139-download-buttons">
                        <button type="button" className="page139-download-btn" onClick={downloadTableAsCSV}>
                            {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                        </button>
                        <button type="button" className="page139-download-btn" onClick={() => downloadTableAsDocx()}>
                            {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                        </button>
                    </div>
                </div>

                <aside className="wb-fnote" role="note">
                    <h2 id="fn-page139">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt>{lang === 'en' ? 'Footnote *' : 'Note de bas de page *'}</dt>
                        <dd id="fn-asterisk-page139">
                            <a
                                href="#fn-asterisk-rf-page139"
                                onClick={scrollToRef}
                                className="fn-num"
                                title={
                                    lang === 'en'
                                        ? 'Return to footnote * referrer'
                                        : 'Retour à la référence de la note de bas de page *'
                                }
                            >
                                <span className="wb-inv">
                                    {lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}
                                </span>
                                *
                            </a>
                            <p>{getText('page139_footnote', lang)}</p>
                        </dd>
                    </dl>
                </aside>
            </div>
            </>
            )}
        </main>
    );
};

export default Page139;
