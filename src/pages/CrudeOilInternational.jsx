import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const CANADA_CAPSULE = '#423330';

const DATA_BY_YEAR = {
    2020: {
        production: {
            total: 84.5,
            items: [
                { key: 'usa', pct: 20 },
                { key: 'russia', pct: 12 },
                { key: 'saudi', pct: 11 },
                { key: 'canada', pct: 6 },
                { key: 'iraq', pct: 5 }
            ]
        },
        exports: {
            total: 41.2,
            items: [
                { key: 'saudi', pct: 16 },
                { key: 'russia', pct: 11 },
                { key: 'canada', pct: 8 },
                { key: 'usa', pct: 9 },
                { key: 'iraq', pct: 7 }
            ]
        }
    },
    2021: {
        production: {
            total: 85.8,
            items: [
                { key: 'usa', pct: 20 },
                { key: 'russia', pct: 12 },
                { key: 'saudi', pct: 11 },
                { key: 'canada', pct: 6 },
                { key: 'iraq', pct: 5 }
            ]
        },
        exports: {
            total: 42.5,
            items: [
                { key: 'saudi', pct: 15 },
                { key: 'russia', pct: 12 },
                { key: 'canada', pct: 8 },
                { key: 'usa', pct: 9 },
                { key: 'iraq', pct: 7 }
            ]
        }
    },
    2022: {
        production: {
            total: 87.1,
            items: [
                { key: 'usa', pct: 19 },
                { key: 'russia', pct: 12 },
                { key: 'saudi', pct: 11 },
                { key: 'canada', pct: 7 },
                { key: 'iraq', pct: 5 }
            ]
        },
        exports: {
            total: 43.9,
            items: [
                { key: 'saudi', pct: 15 },
                { key: 'russia', pct: 12 },
                { key: 'canada', pct: 9 },
                { key: 'usa', pct: 9 },
                { key: 'iraq', pct: 7 }
            ]
        }
    },
    2023: {
        production: {
            total: 88.4,
            items: [
                { key: 'usa', pct: 19 },
                { key: 'russia', pct: 12 },
                { key: 'saudi', pct: 11 },
                { key: 'canada', pct: 7 },
                { key: 'iraq', pct: 5 }
            ]
        },
        exports: {
            total: 45.3,
            items: [
                { key: 'saudi', pct: 15 },
                { key: 'russia', pct: 12 },
                { key: 'canada', pct: 9 },
                { key: 'usa', pct: 9 },
                { key: 'iraq', pct: 7 }
            ]
        }
    },
    2024: {
        production: {
            total: 89.2,
            items: [
                { key: 'usa', pct: 19 },
                { key: 'russia', pct: 12 },
                { key: 'saudi', pct: 11 },
                { key: 'canada', pct: 7 },
                { key: 'iraq', pct: 5 }
            ]
        },
        exports: {
            total: 46.0,
            items: [
                { key: 'saudi', pct: 15 },
                { key: 'russia', pct: 12 },
                { key: 'canada', pct: 9 },
                { key: 'usa', pct: 9 },
                { key: 'iraq', pct: 7 }
            ]
        }
    }
};

const YEARS_DESC = [2024, 2023, 2022, 2021, 2020];
const YEARS_ASC = [2020, 2021, 2022, 2023, 2024];
const PRODUCTION_COLUMN_KEYS = ['usa', 'russia', 'saudi', 'canada', 'iraq'];
const EXPORT_COLUMN_KEYS = ['saudi', 'russia', 'canada', 'usa', 'iraq'];

const pctForCountry = (items, key) => {
    const it = items.find((i) => i.key === key);
    return it != null ? Math.round(it.pct) : '';
};

const CrudeOilInternational = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [year, setYear] = useState(2024);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpenProd, setIsTableOpenProd] = useState(false);
    const [isTableOpenExp, setIsTableOpenExp] = useState(false);
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);

    const yearDropdownRef = useRef(null);
    const yearButtonRef = useRef(null);
    const prodDetailsRef = useRef(null);
    const expDetailsRef = useRef(null);
    const prodTopScrollRef = useRef(null);
    const prodTableScrollRef = useRef(null);
    const expTopScrollRef = useRef(null);
    const expTableScrollRef = useRef(null);

    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    const scrollToFootnote = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-crude-oil-international')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const scrollToRef = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-rf-crude-oil-international')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const formatVolume = (n) =>
        n.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    const yearBundle = DATA_BY_YEAR[year] || DATA_BY_YEAR[2024];
    const production = yearBundle.production;
    const exportsBlock = yearBundle.exports;

    const productionRows = useMemo(
        () =>
            production.items.map((row, index) => ({
                ...row,
                rank: index + 1,
                name: getText(`crude_oil_international_country_${row.key}`, lang),
                pctRounded: Math.round(row.pct)
            })),
        [production.items, lang]
    );

    const exportRows = useMemo(
        () =>
            exportsBlock.items.map((row, index) => ({
                ...row,
                rank: index + 1,
                name: getText(`crude_oil_international_country_${row.key}`, lang),
                pctRounded: Math.round(row.pct)
            })),
        [exportsBlock.items, lang]
    );

    const productionAria =
        lang === 'en'
            ? `World crude oil production ranking for ${year}: ${productionRows.map((r) => `Rank ${r.rank}, ${r.name}, ${r.pctRounded} percent`).join('. ')}.`
            : `Classement de la production mondiale de pétrole brut pour ${year}: ${productionRows.map((r) => `Rang ${r.rank}, ${r.name}, ${r.pctRounded} pour cent`).join('. ')}.`;

    const exportsAria =
        lang === 'en'
            ? `World crude oil exports ranking for ${year}: ${exportRows.map((r) => `Rank ${r.rank}, ${r.name}, ${r.pctRounded} percent`).join('. ')}.`
            : `Classement des exportations mondiales de pétrole brut pour ${year}: ${exportRows.map((r) => `Rang ${r.rank}, ${r.name}, ${r.pctRounded} pour cent`).join('. ')}.`;

    const productionHistoricalRows = useMemo(
        () =>
            YEARS_ASC.map((y) => {
                const b = DATA_BY_YEAR[y].production;
                return {
                    year: y,
                    total: b.total,
                    pcts: PRODUCTION_COLUMN_KEYS.map((k) => pctForCountry(b.items, k))
                };
            }),
        []
    );

    const exportHistoricalRows = useMemo(
        () =>
            YEARS_ASC.map((y) => {
                const b = DATA_BY_YEAR[y].exports;
                return {
                    year: y,
                    total: b.total,
                    pcts: EXPORT_COLUMN_KEYS.map((k) => pctForCountry(b.items, k))
                };
            }),
        []
    );

    const yearSpanLabel = `${YEARS_ASC[0]}\u2013${YEARS_ASC[YEARS_ASC.length - 1]}`;

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target)) {
                setIsYearDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (isTableOpenProd && prodDetailsRef.current) {
            setTimeout(() => prodDetailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }
    }, [isTableOpenProd]);

    useEffect(() => {
        if (isTableOpenExp && expDetailsRef.current) {
            setTimeout(() => expDetailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }
    }, [isTableOpenExp]);

    useEffect(() => {
        const topScroll = prodTopScrollRef.current;
        const tableScroll = prodTableScrollRef.current;
        if (!topScroll || !tableScroll) return;

        const syncScrollbars = () => {
            const table = tableScroll.querySelector('table');
            if (!table) return;
            const scrollWidth = table.offsetWidth;
            const containerWidth = tableScroll.clientWidth;
            const topSpacer = topScroll.firstElementChild;
            if (topSpacer) topSpacer.style.width = `${scrollWidth}px`;
            topScroll.style.display = scrollWidth > containerWidth ? 'block' : 'none';
            if (scrollWidth > containerWidth) topScroll.style.opacity = '1';
        };

        const handleTopScroll = () => {
            if (tableScroll.scrollLeft !== topScroll.scrollLeft) tableScroll.scrollLeft = topScroll.scrollLeft;
        };
        const handleTableScroll = () => {
            if (topScroll.scrollLeft !== tableScroll.scrollLeft) topScroll.scrollLeft = tableScroll.scrollLeft;
        };

        topScroll.addEventListener('scroll', handleTopScroll);
        tableScroll.addEventListener('scroll', handleTableScroll);
        const observer = new ResizeObserver(() => window.requestAnimationFrame(syncScrollbars));
        const tableElement = tableScroll.querySelector('table');
        if (tableElement) observer.observe(tableElement);
        observer.observe(tableScroll);
        syncScrollbars();

        return () => {
            topScroll.removeEventListener('scroll', handleTopScroll);
            tableScroll.removeEventListener('scroll', handleTableScroll);
            observer.disconnect();
        };
    }, [isTableOpenProd, windowWidth]);

    useEffect(() => {
        const topScroll = expTopScrollRef.current;
        const tableScroll = expTableScrollRef.current;
        if (!topScroll || !tableScroll) return;

        const syncScrollbars = () => {
            const table = tableScroll.querySelector('table');
            if (!table) return;
            const scrollWidth = table.offsetWidth;
            const containerWidth = tableScroll.clientWidth;
            const topSpacer = topScroll.firstElementChild;
            if (topSpacer) topSpacer.style.width = `${scrollWidth}px`;
            topScroll.style.display = scrollWidth > containerWidth ? 'block' : 'none';
            if (scrollWidth > containerWidth) topScroll.style.opacity = '1';
        };

        const handleTopScroll = () => {
            if (tableScroll.scrollLeft !== topScroll.scrollLeft) tableScroll.scrollLeft = topScroll.scrollLeft;
        };
        const handleTableScroll = () => {
            if (topScroll.scrollLeft !== tableScroll.scrollLeft) topScroll.scrollLeft = tableScroll.scrollLeft;
        };

        topScroll.addEventListener('scroll', handleTopScroll);
        tableScroll.addEventListener('scroll', handleTableScroll);
        const observer = new ResizeObserver(() => window.requestAnimationFrame(syncScrollbars));
        const tableElement = tableScroll.querySelector('table');
        if (tableElement) observer.observe(tableElement);
        observer.observe(tableScroll);
        syncScrollbars();

        return () => {
            topScroll.removeEventListener('scroll', handleTopScroll);
            tableScroll.removeEventListener('scroll', handleTableScroll);
            observer.disconnect();
        };
    }, [isTableOpenExp, windowWidth]);

    const downloadProductionCSV = () => {
        const yCol = getText('crude_oil_international_table_col_year', lang);
        const tCol = getText('crude_oil_international_table_col_total', lang);
        const headers = [
            yCol,
            tCol,
            ...PRODUCTION_COLUMN_KEYS.map((k) => `${stripHtml(getText(`crude_oil_international_country_${k}`, lang))} (%)`)
        ];
        const rows = productionHistoricalRows.map((row) => [
            row.year,
            formatVolume(row.total),
            ...row.pcts.map((p) => (p === '' ? '' : String(p)))
        ]);
        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, lang === 'en' ? 'crude_oil_world_production.csv' : 'production_mondiale_petrole_brut.csv');
    };

    const downloadProductionDocx = async () => {
        const title = stripHtml(getText('crude_oil_international_production_label', lang));
        const yCol = getText('crude_oil_international_table_col_year', lang);
        const tCol = getText('crude_oil_international_table_col_total', lang);
        const countryHeaders = PRODUCTION_COLUMN_KEYS.map(
            (k) => `${stripHtml(getText(`crude_oil_international_country_${k}`, lang))} (%)`
        );
        const headerRow = new TableRow({
            children: [yCol, tCol, ...countryHeaders].map(
                (header) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: header, bold: true, size: 22 })],
                                alignment: AlignmentType.CENTER
                            })
                        ],
                        shading: { fill: 'E6E6E6' }
                    })
            )
        });
        const dataRows = productionHistoricalRows.map(
            (row) =>
                new TableRow({
                    children: [
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: String(row.year), size: 22 })],
                                    alignment: AlignmentType.CENTER
                                })
                            ]
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: formatVolume(row.total), size: 22 })],
                                    alignment: AlignmentType.CENTER
                                })
                            ]
                        }),
                        ...row.pcts.map(
                            (p) =>
                                new TableCell({
                                    children: [
                                        new Paragraph({
                                            children: [
                                                new TextRun({ text: p === '' ? '\u2014' : String(p), size: 22 })
                                            ],
                                            alignment: AlignmentType.CENTER
                                        })
                                    ]
                                })
                        )
                    ]
                })
        );
        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: `${title} (${yearSpanLabel})`, bold: true, size: 28 })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 }
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [1200, 1600, ...PRODUCTION_COLUMN_KEYS.map(() => 1280)],
                            rows: [headerRow, ...dataRows]
                        })
                    ]
                }
            ]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'crude_oil_world_production.docx' : 'production_mondiale_petrole_brut.docx');
    };

    const downloadExportsCSV = () => {
        const yCol = getText('crude_oil_international_table_col_year', lang);
        const tCol = getText('crude_oil_international_table_col_total', lang);
        const headers = [
            yCol,
            tCol,
            ...EXPORT_COLUMN_KEYS.map((k) => `${stripHtml(getText(`crude_oil_international_country_${k}`, lang))} (%)`)
        ];
        const rows = exportHistoricalRows.map((row) => [
            row.year,
            formatVolume(row.total),
            ...row.pcts.map((p) => (p === '' ? '' : String(p)))
        ]);
        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, lang === 'en' ? 'crude_oil_world_exports.csv' : 'exportations_mondiales_petrole_brut.csv');
    };

    const downloadExportsDocx = async () => {
        const title = stripHtml(getText('crude_oil_international_exports_label', lang));
        const yCol = getText('crude_oil_international_table_col_year', lang);
        const tCol = getText('crude_oil_international_table_col_total', lang);
        const countryHeaders = EXPORT_COLUMN_KEYS.map(
            (k) => `${stripHtml(getText(`crude_oil_international_country_${k}`, lang))} (%)`
        );
        const headerRow = new TableRow({
            children: [yCol, tCol, ...countryHeaders].map(
                (header) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: header, bold: true, size: 22 })],
                                alignment: AlignmentType.CENTER
                            })
                        ],
                        shading: { fill: 'E6E6E6' }
                    })
            )
        });
        const dataRows = exportHistoricalRows.map(
            (row) =>
                new TableRow({
                    children: [
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: String(row.year), size: 22 })],
                                    alignment: AlignmentType.CENTER
                                })
                            ]
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: formatVolume(row.total), size: 22 })],
                                    alignment: AlignmentType.CENTER
                                })
                            ]
                        }),
                        ...row.pcts.map(
                            (p) =>
                                new TableCell({
                                    children: [
                                        new Paragraph({
                                            children: [
                                                new TextRun({ text: p === '' ? '\u2014' : String(p), size: 22 })
                                            ],
                                            alignment: AlignmentType.CENTER
                                        })
                                    ]
                                })
                        )
                    ]
                })
        );
        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: `${title} (${yearSpanLabel})`, bold: true, size: 28 })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 }
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [1200, 1600, ...EXPORT_COLUMN_KEYS.map(() => 1280)],
                            rows: [headerRow, ...dataRows]
                        })
                    ]
                }
            ]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'crude_oil_world_exports.docx' : 'exportations_mondiales_petrole_brut.docx');
    };

    const renderCapsuleRows = (rows) =>
        rows.map((row, index) => {
            const isCanada = row.key === 'canada';
            const maxPct = rows[0]?.pct || 1;
            const rawRatio = maxPct > 0 ? row.pct / maxPct : 1;
            const barWidthPct = 62 + 18 * rawRatio;
            return (
                <div
                    key={`${row.key}-${index}`}
                    className={`crude-oil-international-capsule-row ${isCanada ? 'crude-oil-international-capsule-row-canada' : ''}`}
                >
                    <div className="crude-oil-international-capsule-bar-wrap">
                        <div className="crude-oil-international-capsule-bar" style={{ width: `${barWidthPct}%` }}>
                            <span className="crude-oil-international-capsule-bar-text">
                                {row.rank} {row.name}
                            </span>
                        </div>
                    </div>
                    <div className="crude-oil-international-capsule-connector" />
                    <div className="crude-oil-international-capsule-pill">
                        <span className="crude-oil-international-capsule-pill-text">{row.pctRounded}%</span>
                    </div>
                </div>
            );
        });

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-108"
            role="main"
            aria-labelledby="crude-oil-international-main-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
                .page-108.page-content {
                    max-width: none !important;
                    overflow-x: visible !important;
                }

                .page-108 {
                    margin-left: -${layoutPadding?.left || 55}px;
                    margin-right: -${layoutPadding?.right || 15}px;
                    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
                    padding-left: ${layoutPadding?.left || 55}px;
                    padding-right: ${layoutPadding?.right || 15}px;
                }

                .crude-oil-international-container {
                    width: 100%;
                    padding: 15px 0 40px 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                }

                .crude-oil-international-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 50px;
                    font-weight: bold;
                    color: #423330;
                    margin-top: 0;
                    margin-bottom: 25px;
                    position: relative;
                    padding-bottom: 0.5em;
                }

                .crude-oil-international-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }

                /* Must beat .page-content p in index.css (higher specificity) */
                .page-108 p.crude-oil-international-subtitle {
                    font-family: 'Lato', sans-serif;
                    font-size: 39px;
                    font-weight: bold;
                    color: #423330;
                    margin: 0 0 15px 0;
                }

                .crude-oil-international-content-wrapper {
                    display: flex;
                    flex-direction: column;
                    gap: 30px;
                    margin-top: 20px;
                    align-items: stretch;
                }

                .crude-oil-international-chart-section {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    width: 100%;
                }

                .crude-oil-international-content-wrapper.layout-stacked .crude-oil-international-chart-section {
                    width: 100% !important;
                }

                .crude-oil-international-content-wrapper.layout-stacked .crude-oil-international-chart-container {
                    width: 100% !important;
                    max-width: 1280px !important;
                    margin-left: auto !important;
                    margin-right: auto !important;
                }

                .crude-oil-international-content-wrapper.layout-stacked .crude-oil-international-chart-section .data-table-wrapper {
                    margin-top: 30px;
                    width: 100% !important;
                }

                .crude-oil-international-content-wrapper.layout-stacked .crude-oil-international-chart-section .data-table-wrapper summary {
                    width: 100% !important;
                    white-space: normal;
                }

                .crude-oil-international-chart-section .data-table-wrapper {
                    padding-top: 5px;
                    margin-top: 20px;
                    margin-bottom: 0;
                    width: 100%;
                    box-sizing: border-box;
                }

                .crude-oil-international-chart-section .data-table-wrapper summary {
                    width: 100%;
                }

                .page-108 .data-table-wrapper summary {
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    padding: 10px;
                    background-color: #8C8C8C;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    list-style: none;
                    box-sizing: border-box;
                    width: 100%;
                    color: #ffffff;
                }

                .page-108 .data-table-wrapper summary::-webkit-details-marker {
                    display: none;
                }

                .page-108 .data-table-wrapper summary:hover {
                    background-color: #404040 !important;
                }

                .page-108 .data-table-wrapper button:hover {
                    background-color: #404040 !important;
                }

                .crude-oil-international-graphic-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: #000000;
                    margin: 0 0 10px 0;
                    text-align: left;
                    width: 100%;
                }

                .crude-oil-international-chart-container {
                    position: relative;
                    width: 100%;
                    max-width: 1280px;
                    margin-left: auto;
                    margin-right: auto;
                }

                @media (max-width: 1280px) {
                    .crude-oil-international-chart-container {
                        max-width: 100% !important;
                    }
                }

                .crude-oil-international-capsule-graphic {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    width: 100%;
                    font-family: 'Noto Sans', sans-serif;
                }

                .crude-oil-international-capsule-row {
                    display: flex;
                    align-items: center;
                    min-height: 52px;
                    gap: 0;
                    min-width: 0;
                }

                .crude-oil-international-capsule-bar-wrap {
                    flex: 0 0 28%;
                    min-width: 0;
                    display: flex;
                    align-items: center;
                }

                .crude-oil-international-capsule-bar {
                    min-height: 44px;
                    min-width: 82px;
                    border-radius: 999px;
                    background-color: #d1d1d1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    padding: 10px 12px;
                    font-size: clamp(13px, 1.5vw, 15px);
                    color: #333;
                    box-sizing: border-box;
                    width: 100%;
                    max-width: 100%;
                }

                .crude-oil-international-capsule-bar .crude-oil-international-capsule-bar-text {
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    word-break: break-word;
                    white-space: normal;
                    line-height: 1.3;
                }

                .crude-oil-international-capsule-row-canada .crude-oil-international-capsule-bar {
                    background-color: ${CANADA_CAPSULE};
                    color: #fff;
                }

                .crude-oil-international-capsule-connector {
                    flex: 1 1 0;
                    min-width: 10px;
                    height: 2px;
                    background-color: #b0b0b0;
                }

                .crude-oil-international-capsule-row-canada .crude-oil-international-capsule-connector {
                    background-color: ${CANADA_CAPSULE};
                }

                .crude-oil-international-capsule-pill {
                    flex: 0 0 64px;
                    height: 36px;
                    min-width: 64px;
                    border-radius: 999px;
                    border: 1px solid #b0b0b0;
                    background-color: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 15px;
                    color: #333;
                    box-sizing: border-box;
                }

                .crude-oil-international-capsule-row-canada .crude-oil-international-capsule-pill {
                    border-width: 2px;
                    border-color: ${CANADA_CAPSULE};
                    font-weight: bold;
                    font-size: 16px;
                }

                @media (max-width: 768px) {
                    .crude-oil-international-title { font-size: 37px; }
                    .page-108 p.crude-oil-international-subtitle { font-size: 35px; }
                    .crude-oil-international-graphic-title { font-size: 26px; }
                    .page-108 .data-table-wrapper summary { font-size: 18px; }
                }
            `}</style>

            <div className="crude-oil-international-container">
                <header>
                    <h1 id="crude-oil-international-main-title" className="crude-oil-international-title">
                        {getText('crude_oil_international_title', lang)}
                    </h1>
                    <p className="crude-oil-international-subtitle">{getText('crude_oil_international_subtitle', lang)}</p>
                </header>

                <>
                    <div
                        ref={yearDropdownRef}
                        style={{
                            position: 'relative',
                            marginBottom: '20px',
                            width: '200px'
                        }}
                    >
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>
                            {getText('year_slider_label', lang)}
                        </label>
                        <button
                            ref={yearButtonRef}
                            type="button"
                            onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                            aria-expanded={isYearDropdownOpen}
                            style={{
                                width: '100%',
                                padding: '10px 15px',
                                backgroundColor: '#fff',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                textAlign: 'left',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '16px'
                            }}
                        >
                            <span>{year}</span>
                            <span aria-hidden="true" style={{ fontSize: '12px' }}>
                                {isYearDropdownOpen ? '▲' : '▼'}
                            </span>
                        </button>
                        {isYearDropdownOpen && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    width: '100%',
                                    maxHeight: '300px',
                                    overflowY: 'auto',
                                    backgroundColor: '#fff',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    zIndex: 100,
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                                }}
                            >
                                {YEARS_DESC.map((y) => {
                                    const isSelected = year === y;
                                    return (
                                        <button
                                            key={y}
                                            type="button"
                                            aria-pressed={isSelected}
                                            aria-label={String(y)}
                                            onClick={() => {
                                                setYear(y);
                                                setIsYearDropdownOpen(false);
                                                setTimeout(() => yearButtonRef.current?.focus(), 0);
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                width: '100%',
                                                textAlign: 'left',
                                                padding: '10px 15px',
                                                cursor: 'pointer',
                                                border: 'none',
                                                borderBottom: '1px solid #eee',
                                                backgroundColor: isSelected ? '#f0f9ff' : '#fff',
                                                fontFamily: 'Arial, sans-serif'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#f5f5f5';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = isSelected ? '#f0f9ff' : '#fff';
                                            }}
                                        >
                                            <span
                                                aria-hidden="true"
                                                style={{
                                                    height: '18px',
                                                    width: '18px',
                                                    borderRadius: '50%',
                                                    border: '1px solid #ccc',
                                                    marginRight: '10px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    backgroundColor: '#fff'
                                                }}
                                            >
                                                {isSelected && (
                                                    <span
                                                        style={{
                                                            height: '10px',
                                                            width: '10px',
                                                            borderRadius: '50%',
                                                            backgroundColor: '#000'
                                                        }}
                                                    />
                                                )}
                                            </span>
                                            <span aria-hidden="true" style={{ fontSize: '16px', color: '#333' }}>
                                                {y}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <div role="status" className="wb-inv" aria-live="polite">
                            {year
                                ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${year}`
                                : ''}
                        </div>
                    </div>

                    <div className="crude-oil-international-content-wrapper layout-stacked">
                        <div className="crude-oil-international-chart-section">
                            <h3 className="crude-oil-international-graphic-title">
                                <span aria-hidden="true">
                                    {getText('crude_oil_international_production_label', lang)}
                                    <span
                                        id="fn-asterisk-rf-crude-oil-international"
                                        style={{ verticalAlign: 'super', fontSize: '0.75em', lineHeight: '0', marginLeft: '0.15em' }}
                                    >
                                        <a href="#fn-asterisk-crude-oil-international" onClick={scrollToFootnote} className="fn-lnk">
                                            <span className="wb-inv">
                                                {lang === 'en' ? 'Footnote ' : 'Note de bas de page '}
                                            </span>
                                            <span aria-hidden="true">*</span>
                                        </a>
                                    </span>
                                    {' \u2013 '}
                                    {formatVolume(production.total)} {getText('crude_oil_international_unit_rate', lang)} ({year})
                                </span>
                            </h3>

                            <div className="crude-oil-international-chart-container" role="region" aria-label={productionAria} tabIndex="0">
                                <div className="crude-oil-international-capsule-graphic" aria-hidden="true">
                                    {renderCapsuleRows(productionRows)}
                                </div>
                            </div>

                            <details
                                ref={prodDetailsRef}
                                className="data-table-wrapper"
                                onToggle={(e) => setIsTableOpenProd(e.currentTarget.open)}
                            >
                                <summary role="button" aria-expanded={isTableOpenProd}>
                                    <span aria-hidden="true" style={{ marginRight: '8px' }}>
                                        {isTableOpenProd ? '▼' : '▶'}
                                    </span>
                                    {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                    <span className="wb-inv">
                                        {lang === 'en'
                                            ? ' Press Enter to open or close.'
                                            : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                    </span>
                                </summary>

                                <div
                                    ref={prodTopScrollRef}
                                    style={{
                                        width: '100%',
                                        overflowX: 'auto',
                                        overflowY: 'hidden',
                                        marginBottom: '0px',
                                        marginTop: '10px',
                                        display: windowWidth <= 768 ? 'none' : 'block'
                                    }}
                                    aria-hidden="true"
                                >
                                    <div style={{ height: '20px' }} />
                                </div>

                                <div
                                    ref={prodTableScrollRef}
                                    className="table-responsive"
                                    role="region"
                                    aria-label={lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                    tabIndex="0"
                                >
                                    <table className="table table-bordered table-striped table-hover">
                                        <caption className="wb-inv">{getText('crude_oil_international_table_caption_production', lang)}</caption>
                                        <thead>
                                            <tr>
                                                <th
                                                    scope="col"
                                                    style={{
                                                        position: 'sticky',
                                                        left: 0,
                                                        backgroundColor: '#f8f9fa',
                                                        zIndex: 2,
                                                        fontWeight: 'bold',
                                                        textAlign: 'center',
                                                        minWidth: '80px',
                                                        borderRight: '2px solid #dee2e6'
                                                    }}
                                                >
                                                    {getText('crude_oil_international_table_col_year', lang)}
                                                </th>
                                                <th
                                                    scope="col"
                                                    style={{
                                                        fontWeight: 'bold',
                                                        textAlign: 'center',
                                                        whiteSpace: 'nowrap',
                                                        verticalAlign: 'bottom'
                                                    }}
                                                >
                                                    {getText('crude_oil_international_table_col_total', lang)}
                                                </th>
                                                {PRODUCTION_COLUMN_KEYS.map((k) => (
                                                    <th
                                                        key={k}
                                                        scope="col"
                                                        style={{
                                                            fontWeight: 'bold',
                                                            textAlign: 'center',
                                                            whiteSpace: 'nowrap',
                                                            verticalAlign: 'bottom'
                                                        }}
                                                    >
                                                        {getText(`crude_oil_international_country_${k}`, lang)} (%)
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {productionHistoricalRows.map((row) => (
                                                <tr key={row.year}>
                                                    <th
                                                        scope="row"
                                                        style={{
                                                            position: 'sticky',
                                                            left: 0,
                                                            zIndex: 1,
                                                            fontWeight: 'bold',
                                                            textAlign: 'center',
                                                            borderRight: '2px solid #dee2e6'
                                                        }}
                                                    >
                                                        {row.year}
                                                    </th>
                                                    <td style={{ textAlign: 'center' }}>{formatVolume(row.total)}</td>
                                                    {row.pcts.map((p, idx) => (
                                                        <td key={PRODUCTION_COLUMN_KEYS[idx]} style={{ textAlign: 'center' }}>
                                                            {p === '' ? '\u2014' : p}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                                    <button
                                        type="button"
                                        onClick={downloadProductionCSV}
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: '#8C8C8C',
                                            border: '1px solid #404040',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontFamily: 'Arial, sans-serif',
                                            fontWeight: 'bold',
                                            color: '#ffffff'
                                        }}
                                    >
                                        {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => downloadProductionDocx()}
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: '#8C8C8C',
                                            border: '1px solid #404040',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontFamily: 'Arial, sans-serif',
                                            fontWeight: 'bold',
                                            color: '#ffffff'
                                        }}
                                    >
                                        {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                    </button>
                                </div>
                            </details>
                        </div>

                        <div className="crude-oil-international-chart-section">
                            <h3 className="crude-oil-international-graphic-title">
                                <span aria-hidden="true">
                                    {getText('crude_oil_international_exports_label', lang)}
                                    <span
                                        style={{ verticalAlign: 'super', fontSize: '0.75em', lineHeight: '0', marginLeft: '0.15em' }}
                                    >
                                        <a href="#fn-asterisk-crude-oil-international" onClick={scrollToFootnote} className="fn-lnk">
                                            <span className="wb-inv">
                                                {lang === 'en' ? 'Footnote ' : 'Note de bas de page '}
                                            </span>
                                            <span aria-hidden="true">*</span>
                                        </a>
                                    </span>
                                    {' \u2013 '}
                                    {formatVolume(exportsBlock.total)} {getText('crude_oil_international_unit_rate', lang)} ({year})
                                </span>
                            </h3>

                            <div className="crude-oil-international-chart-container" role="region" aria-label={exportsAria} tabIndex="0">
                                <div className="crude-oil-international-capsule-graphic" aria-hidden="true">
                                    {renderCapsuleRows(exportRows)}
                                </div>
                            </div>

                            <details
                                ref={expDetailsRef}
                                className="data-table-wrapper"
                                onToggle={(e) => setIsTableOpenExp(e.currentTarget.open)}
                            >
                                <summary role="button" aria-expanded={isTableOpenExp}>
                                    <span aria-hidden="true" style={{ marginRight: '8px' }}>
                                        {isTableOpenExp ? '▼' : '▶'}
                                    </span>
                                    {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                    <span className="wb-inv">
                                        {lang === 'en'
                                            ? ' Press Enter to open or close.'
                                            : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                    </span>
                                </summary>

                                <div
                                    ref={expTopScrollRef}
                                    style={{
                                        width: '100%',
                                        overflowX: 'auto',
                                        overflowY: 'hidden',
                                        marginBottom: '0px',
                                        marginTop: '10px',
                                        display: windowWidth <= 768 ? 'none' : 'block'
                                    }}
                                    aria-hidden="true"
                                >
                                    <div style={{ height: '20px' }} />
                                </div>

                                <div
                                    ref={expTableScrollRef}
                                    className="table-responsive"
                                    role="region"
                                    aria-label={lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                    tabIndex="0"
                                >
                                    <table className="table table-bordered table-striped table-hover">
                                        <caption className="wb-inv">{getText('crude_oil_international_table_caption_exports', lang)}</caption>
                                        <thead>
                                            <tr>
                                                <th
                                                    scope="col"
                                                    style={{
                                                        position: 'sticky',
                                                        left: 0,
                                                        backgroundColor: '#f8f9fa',
                                                        zIndex: 2,
                                                        fontWeight: 'bold',
                                                        textAlign: 'center',
                                                        minWidth: '80px',
                                                        borderRight: '2px solid #dee2e6'
                                                    }}
                                                >
                                                    {getText('crude_oil_international_table_col_year', lang)}
                                                </th>
                                                <th
                                                    scope="col"
                                                    style={{
                                                        fontWeight: 'bold',
                                                        textAlign: 'center',
                                                        whiteSpace: 'nowrap',
                                                        verticalAlign: 'bottom'
                                                    }}
                                                >
                                                    {getText('crude_oil_international_table_col_total', lang)}
                                                </th>
                                                {EXPORT_COLUMN_KEYS.map((k) => (
                                                    <th
                                                        key={k}
                                                        scope="col"
                                                        style={{
                                                            fontWeight: 'bold',
                                                            textAlign: 'center',
                                                            whiteSpace: 'nowrap',
                                                            verticalAlign: 'bottom'
                                                        }}
                                                    >
                                                        {getText(`crude_oil_international_country_${k}`, lang)} (%)
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {exportHistoricalRows.map((row) => (
                                                <tr key={row.year}>
                                                    <th
                                                        scope="row"
                                                        style={{
                                                            position: 'sticky',
                                                            left: 0,
                                                            zIndex: 1,
                                                            fontWeight: 'bold',
                                                            textAlign: 'center',
                                                            borderRight: '2px solid #dee2e6'
                                                        }}
                                                    >
                                                        {row.year}
                                                    </th>
                                                    <td style={{ textAlign: 'center' }}>{formatVolume(row.total)}</td>
                                                    {row.pcts.map((p, idx) => (
                                                        <td key={EXPORT_COLUMN_KEYS[idx]} style={{ textAlign: 'center' }}>
                                                            {p === '' ? '\u2014' : p}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                                    <button
                                        type="button"
                                        onClick={downloadExportsCSV}
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: '#8C8C8C',
                                            border: '1px solid #404040',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontFamily: 'Arial, sans-serif',
                                            fontWeight: 'bold',
                                            color: '#ffffff'
                                        }}
                                    >
                                        {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => downloadExportsDocx()}
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: '#8C8C8C',
                                            border: '1px solid #404040',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontFamily: 'Arial, sans-serif',
                                            fontWeight: 'bold',
                                            color: '#ffffff'
                                        }}
                                    >
                                        {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                    </button>
                                </div>
                            </details>
                        </div>
                    </div>
                </>

                <aside className="wb-fnote" role="note" style={{ marginTop: '20px', marginBottom: 0 }}>
                    <h2 id="fn-crude-oil-international">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt>{lang === 'en' ? 'Footnote *' : 'Note de bas de page *'}</dt>
                        <dd id="fn-asterisk-crude-oil-international" style={{ marginBottom: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', width: '100%' }}>
                                <a
                                    href="#fn-asterisk-rf-crude-oil-international"
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
                                <p style={{ margin: 0 }}>{getText('crude_oil_international_footnote', lang)}</p>
                            </div>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default CrudeOilInternational;
