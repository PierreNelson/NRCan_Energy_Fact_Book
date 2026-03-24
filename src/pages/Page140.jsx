import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const COUNTRY_KEY_MAP = {
    usa: 'page108_country_usa',
    russia: 'page108_country_russia',
    canada: 'page108_country_canada',
    china: 'page122_country_china',
    australia: 'page122_country_australia',
    india: 'page140_country_india',
    indonesia: 'page140_country_indonesia'
};

const DATA_BY_YEAR = {
    2020: {
        reserves: {
            total: 1128.0,
            top: [
                { key: 'usa', pct: 23 },
                { key: 'russia', pct: 15 },
                { key: 'china', pct: 13 },
                { key: 'australia', pct: 12 },
                { key: 'india', pct: 10 }
            ],
            canada: { rank: 20, pct: 1.2 }
        },
        production: {
            total: 7.85,
            top: [
                { key: 'china', pct: 48 },
                { key: 'india', pct: 11 },
                { key: 'indonesia', pct: 10 },
                { key: 'australia', pct: 6 },
                { key: 'usa', pct: 6 }
            ],
            canada: { rank: 15, pct: 0.4 }
        },
        exports: {
            total: 1.22,
            top: [
                { key: 'indonesia', pct: 35 },
                { key: 'australia', pct: 24 },
                { key: 'russia', pct: 13 },
                { key: 'usa', pct: 7 }
            ],
            canada: { rank: 9, pct: 1.7 }
        }
    },
    2021: {
        reserves: {
            total: 1142.3,
            top: [
                { key: 'usa', pct: 22 },
                { key: 'russia', pct: 15 },
                { key: 'china', pct: 13 },
                { key: 'australia', pct: 13 },
                { key: 'india', pct: 11 }
            ],
            canada: { rank: 20, pct: 1.1 }
        },
        production: {
            total: 8.05,
            top: [
                { key: 'china', pct: 49 },
                { key: 'india', pct: 11 },
                { key: 'indonesia', pct: 10 },
                { key: 'australia', pct: 5 },
                { key: 'usa', pct: 5 }
            ],
            canada: { rank: 15, pct: 0.4 }
        },
        exports: {
            total: 1.32,
            top: [
                { key: 'indonesia', pct: 36 },
                { key: 'australia', pct: 24 },
                { key: 'russia', pct: 12 },
                { key: 'usa', pct: 7 }
            ],
            canada: { rank: 9, pct: 1.8 }
        }
    },
    2022: {
        reserves: {
            total: 1154.1,
            top: [
                { key: 'usa', pct: 22 },
                { key: 'russia', pct: 14 },
                { key: 'china', pct: 13 },
                { key: 'australia', pct: 13 },
                { key: 'india', pct: 11 }
            ],
            canada: { rank: 19, pct: 1.1 }
        },
        production: {
            total: 8.35,
            top: [
                { key: 'china', pct: 49 },
                { key: 'india', pct: 12 },
                { key: 'indonesia', pct: 9 },
                { key: 'australia', pct: 5 },
                { key: 'usa', pct: 5 }
            ],
            canada: { rank: 14, pct: 0.5 }
        },
        exports: {
            total: 1.38,
            top: [
                { key: 'indonesia', pct: 36 },
                { key: 'australia', pct: 24 },
                { key: 'russia', pct: 12 },
                { key: 'usa', pct: 7 }
            ],
            canada: { rank: 8, pct: 1.9 }
        }
    },
    2023: {
        reserves: {
            total: 1166.0,
            top: [
                { key: 'usa', pct: 21 },
                { key: 'russia', pct: 14 },
                { key: 'china', pct: 13 },
                { key: 'australia', pct: 13 },
                { key: 'india', pct: 11 }
            ],
            canada: { rank: 19, pct: 1 }
        },
        production: {
            total: 8.55,
            top: [
                { key: 'china', pct: 49 },
                { key: 'india', pct: 12 },
                { key: 'indonesia', pct: 9 },
                { key: 'australia', pct: 5 },
                { key: 'usa', pct: 5 }
            ],
            canada: { rank: 14, pct: 0.5 }
        },
        exports: {
            total: 1.42,
            top: [
                { key: 'indonesia', pct: 37 },
                { key: 'australia', pct: 24 },
                { key: 'russia', pct: 12 },
                { key: 'usa', pct: 7 }
            ],
            canada: { rank: 8, pct: 2 }
        }
    },
    2024: {
        reserves: {
            total: 1169.5,
            top: [
                { key: 'usa', pct: 21 },
                { key: 'russia', pct: 14 },
                { key: 'china', pct: 13 },
                { key: 'australia', pct: 13 },
                { key: 'india', pct: 11 }
            ],
            canada: { rank: 19, pct: 1 }
        },
        production: {
            total: 8.8,
            top: [
                { key: 'china', pct: 50 },
                { key: 'india', pct: 12 },
                { key: 'indonesia', pct: 9 },
                { key: 'australia', pct: 5 },
                { key: 'usa', pct: 5 }
            ],
            canada: { rank: 14, pct: 0.5 }
        },
        exports: {
            total: 1.5,
            top: [
                { key: 'indonesia', pct: 37 },
                { key: 'australia', pct: 24 },
                { key: 'russia', pct: 12 },
                { key: 'usa', pct: 7 }
            ],
            canada: { rank: 8, pct: 2 }
        }
    }
};

const YEAR_KEYS = Object.keys(DATA_BY_YEAR)
    .map(Number)
    .sort((a, b) => a - b);
const YEARS_ASC = YEAR_KEYS;
const YEARS_DESC = [...YEAR_KEYS].reverse();
const PAGE140_DEFAULT_YEAR = YEAR_KEYS[YEAR_KEYS.length - 1];

const RESERVES_COLUMN_KEYS = ['usa', 'russia', 'china', 'australia', 'india', 'canada'];
const PRODUCTION_COLUMN_KEYS = ['china', 'india', 'indonesia', 'australia', 'usa', 'canada'];
const EXPORT_COLUMN_KEYS = ['indonesia', 'australia', 'russia', 'usa', 'canada'];

const countryName = (key, lang) => getText(COUNTRY_KEY_MAP[key], lang);

const pctFromReservesBundle = (bundle, key) => {
    if (key === 'canada') return bundle.canada.pct;
    const it = bundle.top.find((i) => i.key === key);
    return it != null ? it.pct : '';
};

const pctFromProdExportsTop = (bundle, key) => {
    if (key === 'canada') return bundle.canada.pct;
    const it = bundle.top.find((i) => i.key === key);
    return it != null ? it.pct : '';
};

const formatCapsulePct = (pct, lang) => {
    const dec = pct % 1 === 0 ? 0 : 1;
    return Number(pct).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec
    });
};

const pctWithUnit = (pct, lang) => {
    const s = formatCapsulePct(pct, lang);
    return lang === 'en' ? `${s}%` : `${s}\u00a0%`;
};

const formatBt = (n, lang) =>
    n.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

const tablePctCell = (v, lang) => {
    if (v === '' || v == null) return '\u2014';
    return formatCapsulePct(v, lang);
};

const Page140 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [year, setYear] = useState(PAGE140_DEFAULT_YEAR);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpenRes, setIsTableOpenRes] = useState(false);
    const [isTableOpenProd, setIsTableOpenProd] = useState(false);
    const [isTableOpenExp, setIsTableOpenExp] = useState(false);
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);

    const yearDropdownRef = useRef(null);
    const yearButtonRef = useRef(null);
    const resDetailsRef = useRef(null);
    const prodDetailsRef = useRef(null);
    const expDetailsRef = useRef(null);
    const resTopScrollRef = useRef(null);
    const resTableScrollRef = useRef(null);
    const prodTopScrollRef = useRef(null);
    const prodTableScrollRef = useRef(null);
    const expTopScrollRef = useRef(null);
    const expTableScrollRef = useRef(null);

    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    const yearBundle = DATA_BY_YEAR[year] || DATA_BY_YEAR[2024];
    const reservesBlock = yearBundle.reserves;
    const productionBlock = yearBundle.production;
    const exportsBlock = yearBundle.exports;

    const yearSpanLabel = `${YEARS_ASC[0]}\u2013${YEARS_ASC[YEARS_ASC.length - 1]}`;

    const reservesHistoricalRows = useMemo(
        () =>
            YEARS_ASC.map((y) => {
                const b = DATA_BY_YEAR[y].reserves;
                return {
                    year: y,
                    total: b.total,
                    pcts: RESERVES_COLUMN_KEYS.map((k) => pctFromReservesBundle(b, k))
                };
            }),
        []
    );

    const productionHistoricalRows = useMemo(
        () =>
            YEARS_ASC.map((y) => {
                const b = DATA_BY_YEAR[y].production;
                return {
                    year: y,
                    total: b.total,
                    pcts: PRODUCTION_COLUMN_KEYS.map((k) => pctFromProdExportsTop(b, k))
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
                    pcts: EXPORT_COLUMN_KEYS.map((k) => pctFromProdExportsTop(b, k))
                };
            }),
        []
    );

    const reservesAria = useMemo(() => {
        const bundle = DATA_BY_YEAR[year].reserves;
        const parts = bundle.top.map((row, i) => {
            const r = i + 1;
            const nm = countryName(row.key, lang);
            return lang === 'en'
                ? `Rank ${r}, ${nm}, ${formatCapsulePct(row.pct, lang)} percent`
                : `Rang ${r}, ${nm}, ${formatCapsulePct(row.pct, lang)} pour cent`;
        });
        parts.push(
            lang === 'en'
                ? `Rank ${bundle.canada.rank}, Canada, ${formatCapsulePct(bundle.canada.pct, lang)} percent`
                : `Rang ${bundle.canada.rank}, Canada, ${formatCapsulePct(bundle.canada.pct, lang)} pour cent`
        );
        return (
            (lang === 'en' ? `World proved coal reserves ranking for ${year}: ` : `Classement des réserves prouvées de charbon pour ${year} : `) +
            parts.join('. ') +
            '.'
        );
    }, [lang, year]);

    const productionAria = useMemo(() => {
        const bundle = DATA_BY_YEAR[year].production;
        const parts = bundle.top.map((row, i) => {
            const r = i + 1;
            const nm = countryName(row.key, lang);
            return lang === 'en'
                ? `Rank ${r}, ${nm}, ${formatCapsulePct(row.pct, lang)} percent`
                : `Rang ${r}, ${nm}, ${formatCapsulePct(row.pct, lang)} pour cent`;
        });
        parts.push(
            lang === 'en'
                ? `Rank ${bundle.canada.rank}, Canada, ${formatCapsulePct(bundle.canada.pct, lang)} percent`
                : `Rang ${bundle.canada.rank}, Canada, ${formatCapsulePct(bundle.canada.pct, lang)} pour cent`
        );
        return (
            (lang === 'en' ? `World coal production ranking for ${year}: ` : `Classement de la production mondiale de charbon pour ${year} : `) +
            parts.join('. ') +
            '.'
        );
    }, [lang, year]);

    const exportsAria = useMemo(() => {
        const bundle = DATA_BY_YEAR[year].exports;
        const parts = bundle.top.map((row, i) => {
            const r = i + 1;
            const nm = countryName(row.key, lang);
            return lang === 'en'
                ? `Rank ${r}, ${nm}, ${formatCapsulePct(row.pct, lang)} percent`
                : `Rang ${r}, ${nm}, ${formatCapsulePct(row.pct, lang)} pour cent`;
        });
        parts.push(
            lang === 'en'
                ? `Rank ${bundle.canada.rank}, Canada, ${formatCapsulePct(bundle.canada.pct, lang)} percent`
                : `Rang ${bundle.canada.rank}, Canada, ${formatCapsulePct(bundle.canada.pct, lang)} pour cent`
        );
        return (
            (lang === 'en' ? `World coal exports ranking for ${year}: ` : `Classement des exportations mondiales de charbon pour ${year} : `) +
            parts.join('. ') +
            '.'
        );
    }, [lang, year]);

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
        if (isTableOpenRes && resDetailsRef.current) {
            setTimeout(() => resDetailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        }
    }, [isTableOpenRes]);

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
        const topScroll = resTopScrollRef.current;
        const tableScroll = resTableScrollRef.current;
        if (!topScroll || !tableScroll) return undefined;

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
    }, [isTableOpenRes, windowWidth]);

    useEffect(() => {
        const topScroll = prodTopScrollRef.current;
        const tableScroll = prodTableScrollRef.current;
        if (!topScroll || !tableScroll) return undefined;

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
        if (!topScroll || !tableScroll) return undefined;

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

    const downloadReservesCSV = () => {
        const yCol = getText('page108_table_col_year', lang);
        const tCol = getText('page140_table_col_total', lang);
        const headers = [
            yCol,
            tCol,
            ...RESERVES_COLUMN_KEYS.map((k) => `${stripHtml(countryName(k, lang))} (%)`)
        ];
        const rows = reservesHistoricalRows.map((row) => [
            row.year,
            formatBt(row.total, lang),
            ...row.pcts.map((p) => (p === '' ? '' : formatCapsulePct(p, lang)))
        ]);
        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, lang === 'en' ? 'world_coal_proved_reserves.csv' : 'reserves_prouvees_charbon.csv');
    };

    const downloadReservesDocx = async () => {
        const title = stripHtml(getText('page140_doc_title_reserves', lang));
        const yCol = getText('page108_table_col_year', lang);
        const tCol = getText('page140_table_col_total', lang);
        const countryHeaders = RESERVES_COLUMN_KEYS.map((k) => `${stripHtml(countryName(k, lang))} (%)`);
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
        const dataRows = reservesHistoricalRows.map(
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
                                    children: [new TextRun({ text: formatBt(row.total, lang), size: 22 })],
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
                                                new TextRun({
                                                    text: p === '' ? '\u2014' : formatCapsulePct(p, lang),
                                                    size: 22
                                                })
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
                            columnWidths: [1200, 1600, ...RESERVES_COLUMN_KEYS.map(() => 1280)],
                            rows: [headerRow, ...dataRows]
                        })
                    ]
                }
            ]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'world_coal_proved_reserves.docx' : 'reserves_prouvees_charbon.docx');
    };

    const downloadProductionCSV = () => {
        const yCol = getText('page108_table_col_year', lang);
        const tCol = getText('page140_table_col_total', lang);
        const headers = [
            yCol,
            tCol,
            ...PRODUCTION_COLUMN_KEYS.map((k) => `${stripHtml(countryName(k, lang))} (%)`)
        ];
        const rows = productionHistoricalRows.map((row) => [
            row.year,
            formatBt(row.total, lang),
            ...row.pcts.map((p) => (p === '' ? '' : formatCapsulePct(p, lang)))
        ]);
        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, lang === 'en' ? 'world_coal_production.csv' : 'production_mondiale_charbon.csv');
    };

    const downloadProductionDocx = async () => {
        const title = stripHtml(getText('page140_doc_title_production', lang));
        const yCol = getText('page108_table_col_year', lang);
        const tCol = getText('page140_table_col_total', lang);
        const countryHeaders = PRODUCTION_COLUMN_KEYS.map((k) => `${stripHtml(countryName(k, lang))} (%)`);
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
                                    children: [new TextRun({ text: formatBt(row.total, lang), size: 22 })],
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
                                                new TextRun({
                                                    text: p === '' ? '\u2014' : formatCapsulePct(p, lang),
                                                    size: 22
                                                })
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
        saveAs(blob, lang === 'en' ? 'world_coal_production.docx' : 'production_mondiale_charbon.docx');
    };

    const downloadExportsCSV = () => {
        const yCol = getText('page108_table_col_year', lang);
        const tCol = getText('page140_table_col_total', lang);
        const headers = [
            yCol,
            tCol,
            ...EXPORT_COLUMN_KEYS.map((k) => `${stripHtml(countryName(k, lang))} (%)`)
        ];
        const rows = exportHistoricalRows.map((row) => [
            row.year,
            formatBt(row.total, lang),
            ...row.pcts.map((p) => (p === '' ? '' : formatCapsulePct(p, lang)))
        ]);
        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const suffix = lang === 'en' ? 'world_coal_exports' : 'exportations_mondiales_charbon';
        saveAs(blob, `${suffix}_${year}.csv`);
    };

    const downloadExportsDocx = async () => {
        const title = stripHtml(getText('page140_doc_title_exports', lang));
        const yCol = getText('page108_table_col_year', lang);
        const tCol = getText('page140_table_col_total', lang);
        const countryHeaders = EXPORT_COLUMN_KEYS.map((k) => `${stripHtml(countryName(k, lang))} (%)`);
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
                                    children: [new TextRun({ text: formatBt(row.total, lang), size: 22 })],
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
                                                new TextRun({
                                                    text: p === '' ? '\u2014' : formatCapsulePct(p, lang),
                                                    size: 22
                                                })
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
        saveAs(
            blob,
            lang === 'en' ? 'world_coal_exports.docx' : 'exportations_mondiales_charbon.docx'
        );
    };

    const renderCapsuleRow = (rank, key, pct, maxPct, isCanada) => {
        const rawRatio = maxPct > 0 ? pct / maxPct : 1;
        const barWidthPct = 62 + 18 * rawRatio;
        const name = countryName(key, lang);
        return (
            <div
                key={`${key}-${rank}-${isCanada ? 'ca' : 'top'}-${year}`}
                className={`page108-capsule-row ${isCanada ? 'page108-capsule-row-canada' : ''}`}
            >
                <div className="page108-capsule-bar-wrap">
                    <div className="page108-capsule-bar" style={{ width: `${barWidthPct}%` }}>
                        <span className="page108-capsule-bar-text">
                            {rank} {name}
                        </span>
                    </div>
                </div>
                <div className="page108-capsule-connector" />
                <div className="page108-capsule-pill">
                    <span className="page108-capsule-pill-text">{pctWithUnit(pct, lang)}</span>
                </div>
            </div>
        );
    };

    const renderCapsuleBlock = (topRows, canadaRow) => {
        const maxPct = topRows[0]?.pct || 1;
        const els = topRows.map((row, index) =>
            renderCapsuleRow(index + 1, row.key, row.pct, maxPct, false)
        );
        els.push(
            <div key="ellipsis" className="page108-capsule-row page140-capsule-ellipsis" aria-hidden="true">
                <span>...</span>
            </div>
        );
        els.push(renderCapsuleRow(canadaRow.rank, 'canada', canadaRow.pct, maxPct, true));
        return els;
    };

    const renderDetailsTable = (
        captionKey,
        columnKeys,
        historicalRows,
        detailsRef,
        isOpen,
        setOpen,
        topScrollRef,
        tableScrollRef,
        downloadCsv,
        downloadDocx
    ) => (
        <details
            ref={detailsRef}
            className="data-table-wrapper"
            onToggle={(e) => setOpen(e.currentTarget.open)}
        >
            <summary role="button" aria-expanded={isOpen}>
                <span aria-hidden="true" style={{ marginRight: '8px' }}>
                    {isOpen ? '▼' : '▶'}
                </span>
                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                <span className="wb-inv">
                    {lang === 'en'
                        ? ' Press Enter to open or close.'
                        : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                </span>
            </summary>

            <div
                ref={topScrollRef}
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
                ref={tableScrollRef}
                className="table-responsive"
                role="region"
                aria-label={lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                tabIndex="0"
            >
                <table className="table table-bordered table-striped table-hover">
                    <caption className="wb-inv">{getText(captionKey, lang)}</caption>
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
                                {getText('page108_table_col_year', lang)}
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
                                {getText('page140_table_col_total', lang)}
                            </th>
                            {columnKeys.map((k) => (
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
                                    {countryName(k, lang)} (%)
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {historicalRows.map((row) => (
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
                                <td style={{ textAlign: 'center' }}>{formatBt(row.total, lang)}</td>
                                {row.pcts.map((p, idx) => (
                                    <td key={columnKeys[idx]} style={{ textAlign: 'center' }}>
                                        {tablePctCell(p, lang)}
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
                    onClick={downloadCsv}
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
                    onClick={() => downloadDocx()}
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
    );

    const billionTonnes = getText('page140_billion_tonnes', lang);

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-108 page140-coal-international"
            role="main"
            aria-labelledby="page140-main-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
                .page-108.page140-coal-international {
                    margin-left: -${layoutPadding?.left || 55}px;
                    margin-right: -${layoutPadding?.right || 15}px;
                    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
                    padding-left: ${layoutPadding?.left || 55}px;
                    padding-right: ${layoutPadding?.right || 15}px;
                }
                .page140-capsule-ellipsis {
                    display: flex;
                    align-items: center;
                    min-height: 40px;
                    padding-left: 12%;
                    font-size: 22px;
                    color: #333;
                    font-family: 'Noto Sans', sans-serif;
                }
            `}</style>

            <div className="page108-container">
                <header>
                    <h1 id="page140-main-title" className="page108-title">
                        {getText('page140_title', lang)}
                    </h1>
                    <p className="page108-subtitle">{getText('page140_subtitle', lang)}</p>
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

                    <div className="page108-content-wrapper layout-stacked">
                        <div className="page108-chart-section">
                            <h3 className="page108-graphic-title">
                                <span aria-hidden="true">
                                    {getText('page140_reserves_kicker', lang)}
                                    {' \u2013 '}
                                    <strong>
                                        {formatBt(reservesBlock.total, lang)} {billionTonnes}
                                    </strong>
                                    {' '}
                                    ({year})
                                </span>
                            </h3>
                            <div className="page108-chart-container" role="region" aria-label={reservesAria} tabIndex="0">
                                <div className="page108-capsule-graphic" aria-hidden="true">
                                    {renderCapsuleBlock(reservesBlock.top, reservesBlock.canada)}
                                </div>
                            </div>
                            {renderDetailsTable(
                                'page140_table_caption_reserves',
                                RESERVES_COLUMN_KEYS,
                                reservesHistoricalRows,
                                resDetailsRef,
                                isTableOpenRes,
                                setIsTableOpenRes,
                                resTopScrollRef,
                                resTableScrollRef,
                                downloadReservesCSV,
                                downloadReservesDocx
                            )}
                        </div>

                        <div className="page108-chart-section">
                            <h3 className="page108-graphic-title">
                                <span aria-hidden="true">
                                    {getText('page140_production_kicker', lang)}
                                    {' \u2013 '}
                                    <strong>
                                        {formatBt(productionBlock.total, lang)} {billionTonnes}
                                    </strong>
                                    {' '}
                                    ({year})
                                </span>
                            </h3>
                            <div className="page108-chart-container" role="region" aria-label={productionAria} tabIndex="0">
                                <div className="page108-capsule-graphic" aria-hidden="true">
                                    {renderCapsuleBlock(productionBlock.top, productionBlock.canada)}
                                </div>
                            </div>
                            {renderDetailsTable(
                                'page140_table_caption_production',
                                PRODUCTION_COLUMN_KEYS,
                                productionHistoricalRows,
                                prodDetailsRef,
                                isTableOpenProd,
                                setIsTableOpenProd,
                                prodTopScrollRef,
                                prodTableScrollRef,
                                downloadProductionCSV,
                                downloadProductionDocx
                            )}
                        </div>

                        <div className="page108-chart-section">
                            <h3 className="page108-graphic-title">
                                <span aria-hidden="true">
                                    {getText('page140_exports_kicker', lang)}
                                    {' \u2013 '}
                                    <strong>
                                        {formatBt(exportsBlock.total, lang)} {billionTonnes}
                                    </strong>
                                    {' '}
                                    ({year})
                                </span>
                            </h3>
                            <div className="page108-chart-container" role="region" aria-label={exportsAria} tabIndex="0">
                                <div className="page108-capsule-graphic" aria-hidden="true">
                                    {renderCapsuleBlock(exportsBlock.top, exportsBlock.canada)}
                                </div>
                            </div>
                            {renderDetailsTable(
                                'page140_table_caption_exports',
                                EXPORT_COLUMN_KEYS,
                                exportHistoricalRows,
                                expDetailsRef,
                                isTableOpenExp,
                                setIsTableOpenExp,
                                expTopScrollRef,
                                expTableScrollRef,
                                downloadExportsCSV,
                                downloadExportsDocx
                            )}
                        </div>
                    </div>
                </>
            </div>
        </main>
    );
};

export default Page140;
