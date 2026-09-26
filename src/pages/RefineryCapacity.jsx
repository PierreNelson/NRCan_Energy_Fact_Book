import React, { useEffect, useMemo, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import FootnoteMarker from '../components/FootnoteMarker';
import PageFootnotes from '../components/PageFootnotes';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import { getRefineryCapacityData } from '../utils/dataLoader';
import { stripHtml } from '../utils/stripHtml';
import { saveDocxBlob, Document, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from '../utils/exportTableToDocx';

import { makeScrollToIdHandler } from '../utils/scrollToId';

const RefineryCapacity = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [tableRows, setTableRows] = useState([]);
    const [totalRow, setTotalRow] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);

    useEffect(() => {
        getRefineryCapacityData()
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

    const scrollToFootnote = makeScrollToIdHandler('fn-asterisk-refinery-capacity');

    const scrollToRef = makeScrollToIdHandler('fn-asterisk-rf-refinery-capacity');

    const fmtNum = (n) => {
        if (n == null || Number.isNaN(Number(n))) return '\u2014';
        return Number(n).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { maximumFractionDigits: 0 });
    };

    const pageTitle = getText('osm_refin_cap_title', lang);
    const exportTableTitle = stripHtml(pageTitle);
    const tableCaption = getText('osm_refin_cap_table_caption', lang);
    const csvFilename = lang === 'en' ? 'refinery_capacity_canada.csv' : 'capacite_raffineries_canada.csv';
    const docxFilename = lang === 'en' ? 'refinery_capacity_canada.docx' : 'capacite_raffineries_canada.docx';

    const provHdr = getText('osm_refin_cap_col_province', lang);
    const pr = getText('osm_refin_cap_hdr_petroleum', lang);
    const ap = getText('osm_refin_cap_hdr_asphalt', lang);
    const lu = getText('osm_refin_cap_hdr_lubricant', lang);
    const tot = getText('osm_refin_cap_hdr_total', lang);
    const cnt = getText('osm_refin_cap_sub_count', lang);
    const cap = getText('osm_refin_cap_sub_capacity', lang);

    const tableColumns = useMemo(() => [
        { key: 'province', header: provHdr, align: 'left' },
        { key: 'petCount', header: `${pr} ${cnt}`, align: 'num' },
        { key: 'petCapacity', header: `${pr} ${cap}`, align: 'num' },
        { key: 'aspCount', header: `${ap} ${cnt}`, align: 'num' },
        { key: 'aspCapacity', header: `${ap} ${cap}`, align: 'num' },
        { key: 'lubCount', header: `${lu} ${cnt}`, align: 'num' },
        { key: 'lubCapacity', header: `${lu} ${cap}`, align: 'num' },
        { key: 'totCount', header: `${tot} ${cnt}`, align: 'num' },
        { key: 'totCapacity', header: `${tot} ${cap}`, align: 'num' },
    ], [provHdr, pr, ap, lu, tot, cnt, cap]);

    const chartDataRows = useMemo(() => {
        if (!tableRows.length || !totalRow) return [];
        const toRow = (label, row) => ({
            province: label,
            petCount: row.petroleum?.count ?? null,
            petCapacity: row.petroleum?.capacity ?? null,
            aspCount: row.asphalt?.count ?? null,
            aspCapacity: row.asphalt?.capacity ?? null,
            lubCount: row.lubricant?.count ?? null,
            lubCapacity: row.lubricant?.capacity ?? null,
            totCount: row.total?.count ?? null,
            totCapacity: row.total?.capacity ?? null,
        });
        return [
            ...tableRows.map((row) => toRow(stripHtml(getText(`osm_refin_cap_prov_${row.key}`, lang)), row)),
            toRow(getText('osm_refin_cap_total_label', lang), totalRow),
        ];
    }, [tableRows, totalRow, lang]);

    const downloadTableAsDocx = async () => {
        // Non-flat DOCX: 2-row header with colSpan / rowSpan (matches on-page grouping).
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
                        alignment: AlignmentType.CENTER,
                    }),
                ],
            });

        const subHdr = (text) =>
            new TableCell({
                shading: { fill: subBg },
                children: [
                    new Paragraph({
                        children: [new TextRun({ text, bold: true, size: 22, color: '000000' })],
                        alignment: AlignmentType.CENTER,
                    }),
                ],
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
                                    text: stripHtml(provHdr),
                                    bold: true,
                                    size: 22,
                                    color: 'FFFFFF',
                                }),
                            ],
                            alignment: AlignmentType.LEFT,
                        }),
                    ],
                }),
                hdrGroup(stripHtml(pr)),
                hdrGroup(stripHtml(ap)),
                hdrGroup(stripHtml(lu), 20),
                hdrGroup(stripHtml(tot)),
            ],
        });

        const row2 = new TableRow({
            children: [
                subHdr(cnt),
                subHdr(cap),
                subHdr(cnt),
                subHdr(cap),
                subHdr(cnt),
                subHdr(cap),
                subHdr(cnt),
                subHdr(cap),
            ],
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
                            alignment: AlignmentType.CENTER,
                        }),
                    ],
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
                                color: tc,
                            }),
                        ],
                        alignment: AlignmentType.CENTER,
                    }),
                ],
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
                            alignment: AlignmentType.CENTER,
                        }),
                    ],
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
                                color: tc,
                            }),
                        ],
                        alignment: AlignmentType.CENTER,
                    }),
                ],
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
                                        text: stripHtml(getText(`osm_refin_cap_prov_${row.key}`, lang)),
                                        bold: true,
                                        size: 22,
                                        color: 'FFFFFF',
                                    }),
                                ],
                                alignment: AlignmentType.LEFT,
                            }),
                        ],
                    }),
                    numCell(row.petroleum, isEven, false),
                    capCell(row.petroleum, isEven, false),
                    numCell(row.asphalt, isEven, false),
                    capCell(row.asphalt, isEven, false),
                    numCell(row.lubricant, isEven, false),
                    capCell(row.lubricant, isEven, false),
                    numCell(row.total, isEven, false),
                    capCell(row.total, isEven, false),
                ],
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
                                    text: getText('osm_refin_cap_total_label', lang),
                                    bold: true,
                                    size: 22,
                                    color: 'FFFFFF',
                                }),
                            ],
                            alignment: AlignmentType.LEFT,
                        }),
                    ],
                }),
                numCell(t.petroleum, false, true),
                capCell(t.petroleum, false, true),
                numCell(t.asphalt, false, true),
                capCell(t.asphalt, false, true),
                numCell(t.lubricant, false, true),
                capCell(t.lubricant, false, true),
                numCell(t.total, false, true),
                capCell(t.total, false, true),
            ],
        });

        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: exportTableTitle,
                                    bold: true,
                                    size: 28,
                                }),
                            ],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths,
                            rows: [row1, row2, ...dataRows, totalDataRow],
                        }),
                    ],
                },
            ],
        });
        await saveDocxBlob(docxFilename, doc);
    };

    return (
        <PageShell tabIndex="-1"
            className="page-content page-139 page-chrome page-chrome--bleed"
            aria-labelledby="refinery-capacity-main-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
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
                }
                .refinery-capacity-container {
                    width: 100%;
                    padding: 15px 0 40px 0;
                    box-sizing: border-box;
                }
                .page-139.page-content h1.refinery-capacity-title {
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
                .page-139.page-content h1.refinery-capacity-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }
                .refinery-capacity-subtitle {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    font-weight: bold;
                    color: var(--gc-text);
                    margin: 0 0 20px 0;
                    line-height: 1.5;
                    max-width: 80ch;
                }
                .refinery-capacity-table-wrapper {
                    display: block;
                    width: 100%;
                    margin-top: 20px;
                }
                .refinery-capacity-footnotes {
                    font-family: var(--font-body);
                    font-size: 1rem;
                    color: var(--gc-text);
                    margin-top: 2rem;
                    margin-bottom: 0;
                    line-height: 1.65;
                    max-width: 80ch;
                }
                .refinery-capacity-footnotes dl {
                    margin: 0;
                    padding: 0;
                }
                .refinery-capacity-footnotes dt {
                    float: left;
                    clear: left;
                    width: 1.5em;
                    font-weight: normal;
                }
                .refinery-capacity-footnotes dd {
                    margin-left: 1.5em;
                    margin-bottom: 0.5em;
                }
                .refinery-capacity-footnotes dd p {
                    margin: 0;
                }
                @media (max-width: 768px) {
                    .page-139.page-content h1.refinery-capacity-title {
                        font-size: 37px !important;
                    }
                    .refinery-capacity-subtitle {
                        font-size: 18px;
                    }
                }
            `}</style>

            <div className="refinery-capacity-container">
                <h1 id="refinery-capacity-main-title" className="refinery-capacity-title">
                    {pageTitle}
                </h1>

                <h2 className="refinery-capacity-subtitle">
                    {getText('osm_refin_cap_subtitle_before_star', lang)}
                    <FootnoteMarker
                            lang={lang}
                            href="#fn-asterisk-refinery-capacity"
                            id="fn-asterisk-rf-refinery-capacity"
                            marker="*"
                            onClick={scrollToFootnote}
                        />
                    {getText('osm_refin_cap_subtitle_after_star', lang)}
                </h2>

                <div className="refinery-capacity-table-wrapper">
                    <ChartDataTable
                        lang={lang}
                        label={tableCaption}
                        columns={tableColumns}
                        rows={chartDataRows}
                        csvFilename={csvFilename}
                        defaultOpen
                        caption={tableCaption}
                        tableAriaLabel={getText('osm_refin_cap_table_aria', lang)}
                        onDownloadDocx={downloadTableAsDocx}
                        renderCell={(raw, { colIndex }) => (
                            colIndex === 0 ? String(raw ?? '') : fmtNum(raw)
                        )}
                    />
                </div>

                <PageFootnotes
                    lang={lang}
                    titleId="fn-refinery-capacity"
                    items={[
                        { id: 'fn-asterisk-refinery-capacity', marker: '*', text: getText('osm_refin_cap_footnote', lang), returnHref: '#fn-asterisk-rf-refinery-capacity' },
                    ]}
                />
            </div>
            </>
            )}
        </PageShell>
    );
};

export default RefineryCapacity;
