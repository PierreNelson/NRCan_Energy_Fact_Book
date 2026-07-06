import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';

const CANADA_CAPSULE = '#819476';

const electricityInternationalContextCountryLabel = (key, lang) => getText(`electricity_international_context_country_${key}`, lang);

const DATA_BY_YEAR = {
    2020: {
        production: {
            total: 28500,
            items: [
                { key: 'china', pct: 31 },
                { key: 'usa', pct: 16 },
                { key: 'india', pct: 6 },
                { key: 'russia', pct: 4 },
                { key: 'japan', pct: 3 },
            ],
            canada: { rank: 7, pct: 2 },
        },
        exports: {
            total: 780,
            items: [
                { key: 'france', pct: 9 },
                { key: 'germany', pct: 7 },
                { key: 'canada', pct: 6 },
                { key: 'laos', pct: 5 },
                { key: 'sweden', pct: 4 },
            ],
        },
    },
    2021: {
        production: {
            total: 29200,
            items: [
                { key: 'china', pct: 31 },
                { key: 'usa', pct: 15 },
                { key: 'india', pct: 7 },
                { key: 'russia', pct: 4 },
                { key: 'japan', pct: 3 },
            ],
            canada: { rank: 7, pct: 2 },
        },
        exports: {
            total: 795,
            items: [
                { key: 'france', pct: 9 },
                { key: 'germany', pct: 7 },
                { key: 'canada', pct: 6 },
                { key: 'laos', pct: 5 },
                { key: 'sweden', pct: 4 },
            ],
        },
    },
    2022: {
        production: {
            total: 29900,
            items: [
                { key: 'china', pct: 32 },
                { key: 'usa', pct: 15 },
                { key: 'india', pct: 7 },
                { key: 'russia', pct: 4 },
                { key: 'japan', pct: 3 },
            ],
            canada: { rank: 7, pct: 2 },
        },
        exports: {
            total: 805,
            items: [
                { key: 'france', pct: 9 },
                { key: 'germany', pct: 7 },
                { key: 'canada', pct: 6 },
                { key: 'laos', pct: 5 },
                { key: 'sweden', pct: 4 },
            ],
        },
    },
    2023: {
        production: {
            total: 30122,
            items: [
                { key: 'china', pct: 32 },
                { key: 'usa', pct: 15 },
                { key: 'india', pct: 7 },
                { key: 'russia', pct: 4 },
                { key: 'japan', pct: 3 },
            ],
            canada: { rank: 7, pct: 2 },
        },
        exports: {
            total: 820,
            items: [
                { key: 'france', pct: 9 },
                { key: 'germany', pct: 7 },
                { key: 'canada', pct: 6 },
                { key: 'laos', pct: 5 },
                { key: 'sweden', pct: 4 },
            ],
        },
    },
    2024: {
        production: {
            total: 30350,
            items: [
                { key: 'china', pct: 32 },
                { key: 'usa', pct: 15 },
                { key: 'india', pct: 7 },
                { key: 'russia', pct: 4 },
                { key: 'japan', pct: 3 },
            ],
            canada: { rank: 7, pct: 2 },
        },
        exports: {
            total: 828,
            items: [
                { key: 'france', pct: 9 },
                { key: 'germany', pct: 7 },
                { key: 'canada', pct: 6 },
                { key: 'laos', pct: 5 },
                { key: 'sweden', pct: 4 },
            ],
        },
    },
};

const YEARS_DESC = [2024, 2023, 2022, 2021, 2020];
const YEARS_ASC = [2020, 2021, 2022, 2023, 2024];
const PRODUCTION_COLUMN_KEYS = ['china', 'usa', 'india', 'russia', 'japan', 'canada'];
const EXPORT_COLUMN_KEYS = ['france', 'germany', 'canada', 'laos', 'sweden'];

const pctForCountry = (items, key) => {
    const it = items.find((i) => i.key === key);
    return it != null ? Math.round(it.pct) : '';
};

const pctForProductionCanada = (bundle) => Math.round(bundle.canada.pct);

const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

const drawRoundedRect = (ctx, x, y, w, h, r) => {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
};

const exportCapsuleInfographicPng = ({ title, rows, filename }) => {
    const scale = 2;
    const W = 1000;
    const pad = 32;
    const titleH = 64;
    const rowH = 44;
    const rowGap = 10;
    const H = pad + titleH + pad + rows.length * (rowH + rowGap) + pad;

    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 26px Lato, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, pad, pad, W - pad * 2);

    const barWrapW = W * 0.28;
    const pillW = 64;
    const startY = pad + titleH + pad;

    rows.forEach((row, index) => {
        const y = startY + index * (rowH + rowGap);
        if (row.isEllipsis) {
            ctx.fillStyle = '#333333';
            ctx.font = 'bold 20px "Noto Sans", sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('...', pad, y + rowH / 2 - 10);
            return;
        }

        const maxPct = rows.find((r) => !r.isEllipsis)?.pct || 1;
        const ratio = maxPct > 0 ? row.pct / maxPct : 1;
        const barW = Math.max(82, barWrapW * (0.62 + 0.18 * ratio));
        const isCanada = row.isCanada;
        const barColor = isCanada ? CANADA_CAPSULE : '#d1d1d1';
        const textColor = isCanada ? '#ffffff' : '#333333';
        const connectorColor = isCanada ? CANADA_CAPSULE : '#b0b0b0';
        const pillBorder = isCanada ? CANADA_CAPSULE : '#b0b0b0';

        ctx.fillStyle = barColor;
        drawRoundedRect(ctx, pad, y + (rowH - 44) / 2, barW, 44, 22);
        ctx.fill();

        ctx.fillStyle = textColor;
        ctx.font = `${isCanada ? 'bold ' : ''}15px "Noto Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${row.rank} ${row.name}`, pad + barW / 2, y + rowH / 2);

        const connX = pad + barW;
        const connW = W - pad - barW - pillW - pad;
        ctx.strokeStyle = connectorColor;
        ctx.lineWidth = isCanada ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(connX, y + rowH / 2);
        ctx.lineTo(connX + connW, y + rowH / 2);
        ctx.stroke();

        const pillX = W - pad - pillW;
        const pillY = y + (rowH - 36) / 2;
        ctx.fillStyle = '#ffffff';
        drawRoundedRect(ctx, pillX, pillY, pillW, 36, 18);
        ctx.fill();
        ctx.strokeStyle = pillBorder;
        ctx.lineWidth = isCanada ? 2 : 1;
        drawRoundedRect(ctx, pillX, pillY, pillW, 36, 18);
        ctx.stroke();

        ctx.fillStyle = '#333333';
        ctx.font = `${isCanada ? 'bold 16px' : '15px'} "Noto Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`${row.pctRounded}%`, pillX + pillW / 2, y + rowH / 2);
    });

    canvas.toBlob((blob) => {
        if (blob) saveAs(blob, filename);
    });
};

const ElectricityInternationalContext = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [year, setYear] = useState(YEARS_DESC[0]);
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
    const prodBottomScrollRef = useRef(null);
    const expTopScrollRef = useRef(null);
    const expTableScrollRef = useRef(null);
    const expBottomScrollRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const yearBundle = DATA_BY_YEAR[year] || DATA_BY_YEAR[YEARS_DESC[0]];
    const production = yearBundle.production;
    const exportsBlock = yearBundle.exports;
    const yearSpanLabel = `${YEARS_ASC[0]}\u2013${YEARS_ASC[YEARS_ASC.length - 1]}`;
    const yearSpanFile = `${YEARS_ASC[0]}-${YEARS_ASC[YEARS_ASC.length - 1]}`;

    const downloadFilename = (slugKey, yearSuffix = yearSpanFile) => {
        const slug = getText(slugKey, lang);
        const match = slug.match(/^(.+)\.(csv|docx|png)$/);
        if (!match) return slug;
        return `${match[1]} ${yearSuffix}.${match[2]}`;
    };

    const formatTwh = (n) =>
        Math.round(n).toLocaleString(locale, { maximumFractionDigits: 0 });

    const productionRows = useMemo(
        () =>
            production.items.map((row, index) => ({
                ...row,
                rank: index + 1,
                name: electricityInternationalContextCountryLabel(row.key, lang),
                pctRounded: Math.round(row.pct),
            })),
        [production.items, lang],
    );

    const exportRows = useMemo(
        () =>
            exportsBlock.items.map((row, index) => ({
                ...row,
                rank: index + 1,
                name: electricityInternationalContextCountryLabel(row.key, lang),
                pctRounded: Math.round(row.pct),
            })),
        [exportsBlock.items, lang],
    );

    const productionGraphicTitle = `${stripHtml(getText('electricity_international_context_production_label', lang))} \u2013 ${formatTwh(production.total)} ${getText('electricity_international_context_unit', lang)} (${year})`;
    const exportsGraphicTitle = `${stripHtml(getText('electricity_international_context_exports_label', lang))} \u2013 ${formatTwh(exportsBlock.total)} ${getText('electricity_international_context_unit', lang)} (${year})`;

    const productionAria =
        lang === 'en'
            ? `World electricity production ranking for ${year}: ${productionRows.map((r) => `Rank ${r.rank}, ${r.name}, ${r.pctRounded} percent`).join('. ')}. Rank ${production.canada.rank}, ${electricityInternationalContextCountryLabel('canada', lang)}, ${Math.round(production.canada.pct)} percent.`
            : `Classement de la production mondiale d'électricité pour ${year}: ${productionRows.map((r) => `Rang ${r.rank}, ${r.name}, ${r.pctRounded} pour cent`).join('. ')}. Rang ${production.canada.rank}, ${electricityInternationalContextCountryLabel('canada', lang)}, ${Math.round(production.canada.pct)} pour cent.`;

    const exportsAria =
        lang === 'en'
            ? `World electricity exports ranking for ${year}: ${exportRows.map((r) => `Rank ${r.rank}, ${r.name}, ${r.pctRounded} percent`).join('. ')}.`
            : `Classement des exportations mondiales d'électricité pour ${year}: ${exportRows.map((r) => `Rang ${r.rank}, ${r.name}, ${r.pctRounded} pour cent`).join('. ')}.`;

    const productionHistoricalRows = useMemo(
        () =>
            YEARS_DESC.map((y) => {
                const b = DATA_BY_YEAR[y].production;
                return {
                    year: y,
                    total: b.total,
                    pcts: [
                        ...PRODUCTION_COLUMN_KEYS.slice(0, -1).map((k) => pctForCountry(b.items, k)),
                        pctForProductionCanada(b),
                    ],
                };
            }),
        [],
    );

    const exportHistoricalRows = useMemo(
        () =>
            YEARS_DESC.map((y) => {
                const b = DATA_BY_YEAR[y].exports;
                return {
                    year: y,
                    total: b.total,
                    pcts: EXPORT_COLUMN_KEYS.map((k) => pctForCountry(b.items, k)),
                };
            }),
        [],
    );

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

    const syncTableScroll = (topRef, tableRef, bottomRef, isOpen) => {
        const topScroll = topRef.current;
        const tableScroll = tableRef.current;
        const bottomScroll = bottomRef.current;
        if (!topScroll || !tableScroll || !bottomScroll || !isOpen) return;

        const syncScrollbars = () => {
            const table = tableScroll.querySelector('table');
            if (!table) return;
            const scrollWidth = table.offsetWidth;
            const containerWidth = tableScroll.clientWidth;
            [topScroll.firstElementChild, bottomScroll.firstElementChild].forEach((spacer) => {
                if (spacer) spacer.style.width = `${scrollWidth}px`;
            });
            const shouldShow = scrollWidth > containerWidth;
            topScroll.style.display = shouldShow ? 'block' : 'none';
            bottomScroll.style.display = shouldShow ? 'block' : 'none';
        };

        const syncFrom = (source) => {
            if (source !== topScroll && topScroll.scrollLeft !== source.scrollLeft) topScroll.scrollLeft = source.scrollLeft;
            if (source !== tableScroll && tableScroll.scrollLeft !== source.scrollLeft) tableScroll.scrollLeft = source.scrollLeft;
            if (source !== bottomScroll && bottomScroll.scrollLeft !== source.scrollLeft) bottomScroll.scrollLeft = source.scrollLeft;
        };

        const handleTopScroll = () => syncFrom(topScroll);
        const handleTableScroll = () => syncFrom(tableScroll);
        const handleBottomScroll = () => syncFrom(bottomScroll);

        topScroll.addEventListener('scroll', handleTopScroll);
        tableScroll.addEventListener('scroll', handleTableScroll);
        bottomScroll.addEventListener('scroll', handleBottomScroll);
        const observer = new ResizeObserver(() => window.requestAnimationFrame(syncScrollbars));
        const tableElement = tableScroll.querySelector('table');
        if (tableElement) observer.observe(tableElement);
        observer.observe(tableScroll);
        syncScrollbars();

        return () => {
            topScroll.removeEventListener('scroll', handleTopScroll);
            tableScroll.removeEventListener('scroll', handleTableScroll);
            bottomScroll.removeEventListener('scroll', handleBottomScroll);
            observer.disconnect();
        };
    };

    useEffect(() => syncTableScroll(prodTopScrollRef, prodTableScrollRef, prodBottomScrollRef, isTableOpenProd), [isTableOpenProd, windowWidth]);
    useEffect(() => syncTableScroll(expTopScrollRef, expTableScrollRef, expBottomScrollRef, isTableOpenExp), [isTableOpenExp, windowWidth]);

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

    const downloadProductionCSV = () => {
        const headers = [
            getText('electricity_international_context_table_col_year', lang),
            getText('electricity_international_context_table_col_total', lang),
            ...PRODUCTION_COLUMN_KEYS.map((k) => `${stripHtml(electricityInternationalContextCountryLabel(k, lang))} (%)`),
        ];
        const rows = productionHistoricalRows.map((row) => [
            row.year,
            formatTwh(row.total),
            ...row.pcts.map((p) => (p === '' ? '' : String(p))),
        ]);
        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        saveAs(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), downloadFilename('electricity_international_context_production_csv_slug'));
    };

    const downloadProductionDocx = async () => {
        const title = stripHtml(getText('electricity_international_context_production_label', lang));
        const headers = [
            getText('electricity_international_context_table_col_year', lang),
            getText('electricity_international_context_table_col_total', lang),
            ...PRODUCTION_COLUMN_KEYS.map((k) => `${stripHtml(electricityInternationalContextCountryLabel(k, lang))} (%)`),
        ];
        const headerRow = new TableRow({
            children: headers.map(
                (header) =>
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 22 })], alignment: AlignmentType.CENTER })],
                        shading: { fill: 'E6E6E6' },
                    }),
            ),
        });
        const dataRows = productionHistoricalRows.map(
            (row) =>
                new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(row.year), size: 22 })], alignment: AlignmentType.CENTER })] }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatTwh(row.total), size: 22 })], alignment: AlignmentType.CENTER })] }),
                        ...row.pcts.map(
                            (p) =>
                                new TableCell({
                                    children: [new Paragraph({ children: [new TextRun({ text: p === '' ? '\u2014' : String(p), size: 22 })], alignment: AlignmentType.CENTER })],
                                }),
                        ),
                    ],
                }),
        );
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: `${title} (${yearSpanLabel})`, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [1200, 1800, ...PRODUCTION_COLUMN_KEYS.map(() => 1200)],
                        rows: [headerRow, ...dataRows],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), downloadFilename('electricity_international_context_production_docx_slug'));
    };

    const downloadExportsCSV = () => {
        const headers = [
            getText('electricity_international_context_table_col_year', lang),
            getText('electricity_international_context_table_col_total', lang),
            ...EXPORT_COLUMN_KEYS.map((k) => `${stripHtml(electricityInternationalContextCountryLabel(k, lang))} (%)`),
        ];
        const rows = exportHistoricalRows.map((row) => [
            row.year,
            formatTwh(row.total),
            ...row.pcts.map((p) => (p === '' ? '' : String(p))),
        ]);
        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        saveAs(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), downloadFilename('electricity_international_context_exports_csv_slug'));
    };

    const downloadExportsDocx = async () => {
        const title = stripHtml(getText('electricity_international_context_exports_label', lang));
        const headers = [
            getText('electricity_international_context_table_col_year', lang),
            getText('electricity_international_context_table_col_total', lang),
            ...EXPORT_COLUMN_KEYS.map((k) => `${stripHtml(electricityInternationalContextCountryLabel(k, lang))} (%)`),
        ];
        const headerRow = new TableRow({
            children: headers.map(
                (header) =>
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 22 })], alignment: AlignmentType.CENTER })],
                        shading: { fill: 'E6E6E6' },
                    }),
            ),
        });
        const dataRows = exportHistoricalRows.map(
            (row) =>
                new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(row.year), size: 22 })], alignment: AlignmentType.CENTER })] }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatTwh(row.total), size: 22 })], alignment: AlignmentType.CENTER })] }),
                        ...row.pcts.map(
                            (p) =>
                                new TableCell({
                                    children: [new Paragraph({ children: [new TextRun({ text: p === '' ? '\u2014' : String(p), size: 22 })], alignment: AlignmentType.CENTER })],
                                }),
                        ),
                    ],
                }),
        );
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: `${title} (${yearSpanLabel})`, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [1200, 1800, ...EXPORT_COLUMN_KEYS.map(() => 1280)],
                        rows: [headerRow, ...dataRows],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), downloadFilename('electricity_international_context_exports_docx_slug'));
    };

    const downloadProductionPng = () => {
        const rows = [
            ...productionRows.map((row) => ({ ...row, isCanada: false, pct: row.pctRounded })),
            { isEllipsis: true },
            {
                rank: production.canada.rank,
                name: electricityInternationalContextCountryLabel('canada', lang),
                pct: production.canada.pct,
                pctRounded: Math.round(production.canada.pct),
                isCanada: true,
            },
        ];
        exportCapsuleInfographicPng({
            title: productionGraphicTitle,
            rows,
            filename: downloadFilename('electricity_international_context_production_png_slug', year),
        });
    };

    const downloadExportsPng = () => {
        exportCapsuleInfographicPng({
            title: exportsGraphicTitle,
            rows: exportRows.map((row) => ({ ...row, isCanada: row.key === 'canada', pct: row.pctRounded })),
            filename: downloadFilename('electricity_international_context_exports_png_slug', year),
        });
    };

    const renderCapsuleRow = (row, maxPct) => {
        const isCanada = row.key === 'canada' || row.isCanada;
        const rawRatio = maxPct > 0 ? row.pct / maxPct : 1;
        const barWidthPct = 62 + 18 * rawRatio;
        return (
            <div key={`${row.rank}-${row.name}`} className={`electricity-international-context-capsule-row ${isCanada ? 'electricity-international-context-capsule-row-canada' : ''}`}>
                <div className="electricity-international-context-capsule-bar-wrap">
                    <div className="electricity-international-context-capsule-bar" style={{ width: `${barWidthPct}%` }}>
                        <span className="electricity-international-context-capsule-bar-text">{row.rank} {row.name}</span>
                    </div>
                </div>
                <div className="electricity-international-context-capsule-connector" />
                <div className="electricity-international-context-capsule-pill">
                    <span className="electricity-international-context-capsule-pill-text">{row.pctRounded}%</span>
                </div>
            </div>
        );
    };

    const renderProductionCapsules = () => {
        const maxPct = productionRows[0]?.pct || 1;
        return (
            <>
                {productionRows.map((row) => renderCapsuleRow(row, maxPct))}
                <div className="electricity-international-context-capsule-row electricity-international-context-capsule-ellipsis" aria-hidden="true"><span>...</span></div>
                {renderCapsuleRow(
                    {
                        rank: production.canada.rank,
                        name: electricityInternationalContextCountryLabel('canada', lang),
                        pct: production.canada.pct,
                        pctRounded: Math.round(production.canada.pct),
                        isCanada: true,
                    },
                    maxPct,
                )}
            </>
        );
    };

    const renderExportCapsules = () => {
        const maxPct = exportRows[0]?.pct || 1;
        return exportRows.map((row) => renderCapsuleRow(row, maxPct));
    };

    const renderDataTable = ({
        isOpen,
        setIsOpen,
        detailsRef,
        topRef,
        tableRef,
        bottomRef,
        captionKey,
        columnKeys,
        historicalRows,
        onCsv,
        onDocx,
    }) => (
        <details ref={detailsRef} className="data-table-wrapper" onToggle={(e) => setIsOpen(e.currentTarget.open)}>
            <summary role="button" aria-expanded={isOpen}>
                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isOpen ? '▼' : '▶'}</span>
                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
            </summary>
            <div ref={topRef} className="electricity-international-context-table-scrollbar" aria-hidden="true"><div /></div>
            <div ref={tableRef} className="table-responsive" role="region" aria-label={lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'} tabIndex={0}>
                <table className="table table-bordered table-striped table-hover">
                    <caption className="wb-inv">{getText(captionKey, lang)}</caption>
                    <thead>
                        <tr>
                            <th scope="col" style={{ position: 'sticky', left: 0, backgroundColor: '#f8f9fa', zIndex: 2, fontWeight: 'bold', textAlign: 'center', minWidth: '80px', borderRight: '2px solid #dee2e6' }}>
                                {getText('electricity_international_context_table_col_year', lang)}
                            </th>
                            <th scope="col" style={{ fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
                                {getText('electricity_international_context_table_col_total', lang)}
                            </th>
                            {columnKeys.map((k) => (
                                <th key={k} scope="col" style={{ fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
                                    {electricityInternationalContextCountryLabel(k, lang)} (%)
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {historicalRows.map((row) => (
                            <tr key={row.year}>
                                <th scope="row" style={{ position: 'sticky', left: 0, zIndex: 1, fontWeight: 'bold', textAlign: 'center', borderRight: '2px solid #dee2e6' }}>{row.year}</th>
                                <td style={{ textAlign: 'center' }}>{formatTwh(row.total)}</td>
                                {row.pcts.map((p, idx) => (
                                    <td key={columnKeys[idx]} style={{ textAlign: 'center' }}>{p === '' ? '\u2014' : p}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div ref={bottomRef} className="electricity-international-context-table-scrollbar" aria-hidden="true"><div /></div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                <button type="button" onClick={onCsv} style={downloadBtnStyle}>{lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}</button>
                <button type="button" onClick={onDocx} style={downloadBtnStyle}>{lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}</button>
            </div>
        </details>
    );

    return (
        <main id="main-content" tabIndex="-1" className="page-content page-64" role="main" aria-labelledby="electricity-international-context-main-title" style={{ backgroundColor: '#ffffff' }}>
            <style>{`
.page-64.page-content { max-width: none !important; overflow-x: visible !important; }
.page-64 {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.electricity-international-context-container { width: 100%; padding: 15px 0 40px 0; display: flex; flex-direction: column; box-sizing: border-box; }
.electricity-international-context-title { font-family: 'Lato', sans-serif; font-size: 41px; font-weight: bold; color: var(--gc-text); margin-top: 0; margin-bottom: 25px; position: relative; padding-bottom: 0.5em; text-transform: none; }
.electricity-international-context-title::after { content: ''; position: absolute; left: 0; bottom: 0.2em; width: 72px; height: 6px; background-color: var(--gc-red); }
.page-64 p.electricity-international-context-subtitle { font-family: 'Lato', sans-serif; font-size: 39px; font-weight: bold; color: var(--gc-text); margin: 0 0 15px 0; text-transform: none; }
.electricity-international-context-content-wrapper { display: flex; flex-direction: column; gap: 30px; margin-top: 20px; }
.electricity-international-context-chart-section { width: 100%; display: flex; flex-direction: column; align-items: flex-start; }
.electricity-international-context-graphic-title { font-family: 'Lato', sans-serif; font-size: 29px; font-weight: bold; color: #000000; margin: 0 0 10px 0; text-align: left; width: 100%; text-transform: none; }
.electricity-international-context-chart-container { position: relative; width: 100%; max-width: 1280px; margin-left: auto; margin-right: auto; }
.electricity-international-context-capsule-graphic { display: flex; flex-direction: column; gap: 8px; width: 100%; font-family: 'Noto Sans', sans-serif; }
.electricity-international-context-capsule-row { display: flex; align-items: center; min-height: 52px; gap: 0; min-width: 0; }
.electricity-international-context-capsule-bar-wrap { flex: 0 0 28%; min-width: 0; display: flex; align-items: center; }
.electricity-international-context-capsule-bar { min-height: 44px; min-width: 82px; border-radius: 999px; background-color: #d1d1d1; display: flex; align-items: center; justify-content: center; text-align: center; padding: 10px 12px; font-size: clamp(13px, 1.5vw, 15px); color: #333; box-sizing: border-box; width: 100%; max-width: 100%; }
.electricity-international-context-capsule-bar-text { word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; white-space: normal; line-height: 1.3; }
.electricity-international-context-capsule-row-canada .electricity-international-context-capsule-bar { background-color: ${CANADA_CAPSULE}; color: #fff; font-weight: bold; }
.electricity-international-context-capsule-connector { flex: 1 1 0; min-width: 10px; height: 2px; background-color: #b0b0b0; }
.electricity-international-context-capsule-row-canada .electricity-international-context-capsule-connector { background-color: ${CANADA_CAPSULE}; }
.electricity-international-context-capsule-pill { flex: 0 0 64px; height: 36px; min-width: 64px; border-radius: 999px; border: 1px solid #b0b0b0; background-color: #fff; display: flex; align-items: center; justify-content: center; font-size: 15px; color: #333; box-sizing: border-box; }
.electricity-international-context-capsule-row-canada .electricity-international-context-capsule-pill { border-width: 2px; border-color: ${CANADA_CAPSULE}; font-weight: bold; font-size: 16px; }
.electricity-international-context-capsule-ellipsis { min-height: 28px; padding-left: 4%; color: #333; font-size: 18px; font-weight: bold; }
.electricity-international-context-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.electricity-international-context-chart-section .data-table-wrapper { padding-top: 5px; margin-top: 20px; width: 100%; box-sizing: border-box; }
.page-64 .data-table-wrapper summary { cursor: pointer; font-family: Arial, sans-serif; font-weight: bold; padding: 10px; background-color: #8C8C8C; border: 1px solid #404040; border-radius: 4px; list-style: none; box-sizing: border-box; width: 100%; color: #ffffff; }
.page-64 .data-table-wrapper summary::-webkit-details-marker { display: none; }
.page-64 .data-table-wrapper summary:hover, .page-64 .data-table-wrapper button:hover { background-color: #404040 !important; }
.electricity-international-context-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.electricity-international-context-table-scrollbar > div { height: 20px; }
@media (max-width: 768px) {
    .electricity-international-context-title { font-size: 37px; }
    .page-64 p.electricity-international-context-subtitle { font-size: 35px; }
    .electricity-international-context-graphic-title { font-size: 26px; }
}
            `}</style>

            <div className="electricity-international-context-container">
                <header>
                    <h1 id="electricity-international-context-main-title" className="electricity-international-context-title">{getText('electricity_international_context_title', lang)}</h1>
                    <p className="electricity-international-context-subtitle">{getText('electricity_international_context_subtitle', lang)}</p>
                </header>

                <div
                    ref={yearDropdownRef}
                    style={{
                        position: 'relative',
                        marginBottom: '20px',
                        width: '200px',
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
                            fontSize: '16px',
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
                                boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
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
                                            fontFamily: 'Arial, sans-serif',
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
                                                backgroundColor: '#fff',
                                            }}
                                        >
                                            {isSelected && (
                                                <span
                                                    style={{
                                                        height: '10px',
                                                        width: '10px',
                                                        borderRadius: '50%',
                                                        backgroundColor: '#000',
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

                <div className="electricity-international-context-content-wrapper layout-stacked">
                    <div className="electricity-international-context-chart-section">
                        <h3 className="electricity-international-context-graphic-title">{productionGraphicTitle}</h3>
                        <div className="electricity-international-context-chart-container" role="region" aria-label={productionAria} tabIndex="0">
                            <div className="electricity-international-context-capsule-graphic" aria-hidden="true">{renderProductionCapsules()}</div>
                        </div>
                        <div className="electricity-international-context-download-buttons">
                            <button type="button" onClick={downloadProductionPng} style={downloadBtnStyle}>{getText('electricity_international_context_download_png', lang)}</button>
                        </div>
                        {renderDataTable({
                            isOpen: isTableOpenProd,
                            setIsOpen: setIsTableOpenProd,
                            detailsRef: prodDetailsRef,
                            topRef: prodTopScrollRef,
                            tableRef: prodTableScrollRef,
                            bottomRef: prodBottomScrollRef,
                            captionKey: 'electricity_international_context_table_caption_production',
                            columnKeys: PRODUCTION_COLUMN_KEYS,
                            historicalRows: productionHistoricalRows,
                            onCsv: downloadProductionCSV,
                            onDocx: downloadProductionDocx,
                        })}
                    </div>

                    <div className="electricity-international-context-chart-section">
                        <h3 className="electricity-international-context-graphic-title">{exportsGraphicTitle}</h3>
                        <div className="electricity-international-context-chart-container" role="region" aria-label={exportsAria} tabIndex="0">
                            <div className="electricity-international-context-capsule-graphic" aria-hidden="true">{renderExportCapsules()}</div>
                        </div>
                        <div className="electricity-international-context-download-buttons">
                            <button type="button" onClick={downloadExportsPng} style={downloadBtnStyle}>{getText('electricity_international_context_download_png', lang)}</button>
                        </div>
                        {renderDataTable({
                            isOpen: isTableOpenExp,
                            setIsOpen: setIsTableOpenExp,
                            detailsRef: expDetailsRef,
                            topRef: expTopScrollRef,
                            tableRef: expTableScrollRef,
                            bottomRef: expBottomScrollRef,
                            captionKey: 'electricity_international_context_table_caption_exports',
                            columnKeys: EXPORT_COLUMN_KEYS,
                            historicalRows: exportHistoricalRows,
                            onCsv: downloadExportsCSV,
                            onDocx: downloadExportsDocx,
                        })}
                    </div>
                </div>
            </div>
        </main>
    );
};

export default ElectricityInternationalContext;
