import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getOilSandsProductionData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import Page113OilSandsInfographic from '../components/Page113OilSandsInfographic';
import { OVERLAY_COLORS, OVERLAY_SLOTS } from '../components/Page113OilSandsInfographic.constants';
import page113BgEn from '../assets/page113_bg.png';
import page113BgFr from '../assets/page113_bg_fr.png';

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const Page113 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [isInfographicTableOpen, setIsInfographicTableOpen] = useState(false);
    const [selectedYear, setSelectedYear] = useState(null);
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const figureRef = useRef(null);
    const yearButtonRef = useRef(null);
    const yearDropdownRef = useRef(null);
    const tableTopRef = useRef(null);
    const tableScrollRef = useRef(null);
    const tableBottomRef = useRef(null);
    const infographicTableTopRef = useRef(null);
    const infographicTableScrollRef = useRef(null);
    const infographicTableBottomRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const formatNumber = (value, digits = 0) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        });
    };

    const formatPct = (value, digits = 0) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        });
    };

    const formatPctDisplay = (value, digits = 0) => {
        const formatted = formatPct(value, digits);
        if (formatted === '–') return formatted;
        return lang === 'fr' ? `${formatted} %` : `${formatted}%`;
    };

    const formatMmbd = (value, digits = 1) => formatNumber(value, digits);

    const formatMmbdDisplay = (value, digits = 1) => {
        const formatted = formatMmbd(value, digits);
        if (formatted === '–') return formatted;
        return lang === 'fr' ? formatted.replace('.', ',') : formatted;
    };

    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    useEffect(() => {
        getOilSandsProductionData()
            .then(setResult)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const effectiveSelectedYear = useMemo(() => {
        if (!result?.selectorYears?.length) return null;
        if (selectedYear != null && result.selectorYears.includes(selectedYear)) {
            return selectedYear;
        }
        return result.selectorYears[0];
    }, [result, selectedYear]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target)) {
                setIsYearDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const syncTableScroll = useCallback((topRef, scrollRef, bottomRef) => {
        const topScroll = topRef.current;
        const tableScroll = scrollRef.current;
        const bottomScroll = bottomRef.current;
        if (!topScroll || !tableScroll || !bottomScroll) return;
        const table = tableScroll.querySelector('table');
        if (!table) return;
        [topScroll.firstElementChild, bottomScroll.firstElementChild].forEach((spacer) => {
            if (spacer) spacer.style.width = `${table.offsetWidth}px`;
        });
        const shouldShow = table.offsetWidth > tableScroll.clientWidth;
        topScroll.style.display = shouldShow ? 'block' : 'none';
        bottomScroll.style.display = shouldShow ? 'block' : 'none';
    }, []);

    const bindTableScrollSync = useCallback((isOpen, topRef, scrollRef, bottomRef) => {
        const topScroll = topRef.current;
        const tableScroll = scrollRef.current;
        const bottomScroll = bottomRef.current;
        if (!topScroll || !tableScroll || !bottomScroll || !isOpen) return undefined;
        const syncFrom = (source) => {
            if (source !== topScroll && topScroll.scrollLeft !== source.scrollLeft) topScroll.scrollLeft = source.scrollLeft;
            if (source !== tableScroll && tableScroll.scrollLeft !== source.scrollLeft) tableScroll.scrollLeft = source.scrollLeft;
            if (source !== bottomScroll && bottomScroll.scrollLeft !== source.scrollLeft) bottomScroll.scrollLeft = source.scrollLeft;
        };
        const handleTopScroll = () => syncFrom(topScroll);
        const handleTableScroll = () => syncFrom(tableScroll);
        const handleBottomScroll = () => syncFrom(bottomScroll);
        const sync = () => window.requestAnimationFrame(() => syncTableScroll(topRef, scrollRef, bottomRef));
        topScroll.addEventListener('scroll', handleTopScroll);
        tableScroll.addEventListener('scroll', handleTableScroll);
        bottomScroll.addEventListener('scroll', handleBottomScroll);
        const observer = new ResizeObserver(sync);
        const tableEl = tableScroll.querySelector('table');
        if (tableEl) observer.observe(tableEl);
        observer.observe(tableScroll);
        sync();
        return () => {
            topScroll.removeEventListener('scroll', handleTopScroll);
            tableScroll.removeEventListener('scroll', handleTableScroll);
            bottomScroll.removeEventListener('scroll', handleBottomScroll);
            observer.disconnect();
        };
    }, [syncTableScroll]);

    useEffect(
        () => bindTableScrollSync(isTableOpen, tableTopRef, tableScrollRef, tableBottomRef),
        [isTableOpen, windowWidth, result, bindTableScrollSync],
    );

    useEffect(
        () => bindTableScrollSync(
            isInfographicTableOpen,
            infographicTableTopRef,
            infographicTableScrollRef,
            infographicTableBottomRef,
        ),
        [isInfographicTableOpen, windowWidth, result, bindTableScrollSync],
    );

    const chartTableRows = useMemo(
        () => (result?.production ? [...result.production].sort((a, b) => b.year - a.year) : []),
        [result],
    );
    const selectorYears = result?.selectorYears ?? [];
    const selectedRow = effectiveSelectedYear != null
        ? result?.production?.find((row) => row.year === effectiveSelectedYear) ?? null
        : null;
    const year = selectedRow?.year ?? effectiveSelectedYear ?? null;
    const startYear = result?.startYear ?? 2000;
    const endYear = result?.endYear ?? year;
    const textVars = {
        year,
        startYear,
        endYear,
        sharePct: selectedRow?.sharePct != null ? formatPct(selectedRow.sharePct, 0) : '–',
        oilSandsMmbd: selectedRow?.oilSandsMmbd != null ? formatMmbd(selectedRow.oilSandsMmbd, 1) : '–',
    };

    const totalCapexBn = selectedRow?.cumulativeCapexBn != null
        ? Math.round(Number(selectedRow.cumulativeCapexBn))
        : null;
    const refYearCapexBn = selectedRow?.annualCapexM != null
        ? Math.round(Number(selectedRow.annualCapexM) / 100) / 10
        : null;

    const overlayValues = selectedRow
        ? {
            reservesPct: selectedRow.provedReservesPct,
            productionSharePct: selectedRow.sharePct,
            oilSandsMmbd: selectedRow.oilSandsMmbd,
            year: selectedRow.year,
        }
        : null;

    const fileSlugBase = substitute(getText('page113_download_title', lang), textVars)
        .replace(/\s+/g, '_')
        .replace(/–/g, '-');
    const infographicPngSlug = substitute(getText('page113_infographic_png_slug', lang), { year: year ?? '' })
        .replace(/\s+/g, '_');
    const infographicDownloadTitle = substitute(getText('page113_infographic_download_title', lang), textVars)
        .replace(/\s+/g, '_')
        .replace(/–/g, '-');

    const infographicHeaders = [
        getText('page113_table_col_year', lang),
        getText('page113_infographic_table_col_reserves', lang),
        getText('page113_infographic_table_col_production_share', lang),
        getText('page113_infographic_table_col_production_mmbd', lang),
    ];

    const formatInfographicCell = (value, format) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return format === 'pct' ? formatPct(value, 0) : formatMmbd(value, 1);
    };

    const infographicTableRows = chartTableRows.map((row) => ({
        year: row.year,
        reservesPct: formatInfographicCell(row.provedReservesPct, 'pct'),
        sharePct: formatInfographicCell(row.sharePct, 'pct'),
        oilSandsMmbd: formatInfographicCell(row.oilSandsMmbd, 'mmbd'),
    }));

    const tableHeaders = [
        getText('page113_table_col_year', lang),
        getText('page113_table_col_oil_sands_m3', lang),
        getText('page113_table_col_conventional_m3', lang),
        getText('page113_table_col_total_m3', lang),
        getText('page113_table_col_oil_sands_mmbd', lang),
        getText('page113_table_col_conventional_mmbd', lang),
        getText('page113_table_col_total_mmbd', lang),
        getText('page113_table_col_share', lang),
    ];

    const downloadCsv = () => {
        const header = tableHeaders.map(csvEscape).join(',');
        const rows = chartTableRows.map((row) =>
            [
                row.year,
                formatNumber(row.oilSandsThousandM3, 1),
                formatNumber(row.conventionalThousandM3, 1),
                formatNumber(row.totalThousandM3, 1),
                formatMmbd(row.oilSandsMmbd, 1),
                formatMmbd(row.conventionalMmbd, 1),
                formatMmbd(row.totalMmbd, 1),
                formatPct(row.sharePct, 0),
            ].map(csvEscape).join(','),
        );
        const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${fileSlugBase}.csv`);
    };

    const downloadDocx = async () => {
        const headerRow = new TableRow({
            children: tableHeaders.map(
                (header) =>
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 18 })] })],
                        shading: { fill: 'E6E6E6' },
                    }),
            ),
        });
        const dataRows = chartTableRows.map(
            (row) =>
                new TableRow({
                    children: [
                        row.year,
                        formatNumber(row.oilSandsThousandM3, 1),
                        formatNumber(row.conventionalThousandM3, 1),
                        formatNumber(row.totalThousandM3, 1),
                        formatMmbd(row.oilSandsMmbd, 1),
                        formatMmbd(row.conventionalMmbd, 1),
                        formatMmbd(row.totalMmbd, 1),
                        formatPct(row.sharePct, 0),
                    ].map((value, index) =>
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: String(value), size: 18 })],
                                    alignment: index === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
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
                            children: [
                                new TextRun({
                                    text: substitute(getText('page113_table_caption', lang), textVars),
                                    bold: true,
                                    size: 28,
                                }),
                            ],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [900, 1300, 1300, 1300, 1200, 1200, 1200, 1100],
                            rows: [headerRow, ...dataRows],
                        }),
                    ],
                },
            ],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${fileSlugBase}.docx`);
    };

    const downloadInfographicCsv = () => {
        if (!infographicTableRows.length) return;
        const rows = infographicTableRows.map((row) => [
            row.year,
            row.reservesPct,
            row.sharePct,
            row.oilSandsMmbd,
        ]);
        const blob = new Blob(
            [[infographicHeaders.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n')],
            { type: 'text/csv;charset=utf-8;' },
        );
        saveAs(blob, `${infographicDownloadTitle}.csv`);
    };

    const downloadInfographicDocx = async () => {
        if (!infographicTableRows.length) return;
        const headerRow = new TableRow({
            children: infographicHeaders.map(
                (header) =>
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 18 })] })],
                        shading: { fill: 'E6E6E6' },
                    }),
            ),
        });
        const dataRows = infographicTableRows.map(
            (row) =>
                new TableRow({
                    children: [
                        row.year,
                        row.reservesPct,
                        row.sharePct,
                        row.oilSandsMmbd,
                    ].map((value, index) =>
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: String(value), size: 18 })],
                                    alignment: index === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
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
                            children: [
                                new TextRun({
                                    text: substitute(getText('page113_infographic_table_caption', lang), textVars),
                                    bold: true,
                                    size: 28,
                                }),
                            ],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [900, 1800, 1800, 1600],
                            rows: [headerRow, ...dataRows],
                        }),
                    ],
                },
            ],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${infographicDownloadTitle}.docx`);
    };

    const downloadInfographicPng = async () => {
        const bgImage = lang === 'fr' ? page113BgFr : page113BgEn;
        const overlayLang = lang === 'fr' ? 'fr' : 'en';
        const slots = OVERLAY_SLOTS[overlayLang];

        const img = new Image();
        img.src = bgImage;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        const scale = 3;
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const pctSuffix = lang === 'fr' ? ' %' : '%';
        const drawText = (text, slot, { color, font }) => {
            if (!text || text === '–') return;
            ctx.fillStyle = color;
            ctx.font = font;
            ctx.textBaseline = 'middle';
            ctx.textAlign = slot.align ?? 'right';
            const x = (slot.left / 100) * canvas.width;
            const y = (slot.top / 100) * canvas.height;
            ctx.fillText(text, x, y);
        };

        const pctFont = `bold ${Math.round(canvas.width * 0.0735)}px "Times New Roman", Times, serif`;
        const captionFont = `bold ${Math.round(canvas.width * 0.027)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;

        if (overlayValues?.reservesPct != null && !Number.isNaN(Number(overlayValues.reservesPct))) {
            drawText(
                `${formatPct(overlayValues.reservesPct, 0)}${pctSuffix}`,
                slots.reserves_pct,
                { color: OVERLAY_COLORS.reserves_pct, font: pctFont },
            );
        }
        drawText(
            `${formatPct(overlayValues?.productionSharePct, 0)}${pctSuffix}`,
            slots.production_pct,
            { color: OVERLAY_COLORS.production_pct, font: pctFont },
        );
        drawText(String(overlayValues?.year ?? ''), slots.production_year, {
            color: OVERLAY_COLORS.production_year,
            font: captionFont,
        });
        drawText(formatMmbd(overlayValues?.oilSandsMmbd, 1), slots.production_mmbd, {
            color: OVERLAY_COLORS.production_mmbd,
            font: captionFont,
        });

        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${infographicPngSlug}.png`);
        });
    };

    if (loading) return <p>{lang === 'en' ? 'Loading...' : 'Chargement...'}</p>;
    if (error) return <p>{error}</p>;
    if (!result?.production?.length || !selectedRow) return <p>{getText('page113_no_data', lang)}</p>;

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-113 page113-oil-sands"
            role="main"
            aria-labelledby="page113-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-113.page113-oil-sands {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.page113-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.page113-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 20px 0;
    line-height: 1.25;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: none;
}
.page113-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.page113-capex {
    font-family: var(--font-body);
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
    margin: 0 0 24px 0;
    max-width: none;
}
.page113-section-title {
    font-family: 'Lato', sans-serif;
    font-size: 28px;
    font-weight: bold;
    color: #423330;
    margin: 0 0 16px 0;
    text-transform: none;
}
.page113-text {
    font-family: var(--font-body);
    line-height: 1.5;
    color: var(--gc-text);
    margin-bottom: 28px;
    max-width: none;
}
.page113-text ul {
    margin: 0;
    padding-left: 1.25rem;
}
.page113-text li {
    margin-bottom: 0.65rem;
    font-family: var(--font-body);
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
}
.page113-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.page113-section-title--after-infographic { margin-top: 28px !important; }
.page113-table-wrapper details > summary {
    display: block;
    width: 100%;
    padding: 12px 15px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    color: #ffffff;
    font-family: Arial, sans-serif;
    font-weight: bold;
    cursor: pointer;
    list-style: none;
}
.page113-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page113-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page113-table-scrollbar > div { height: 20px; }
.page113-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #ddd;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.page113-table-responsive::-webkit-scrollbar { display: none; }
.page113-table-responsive table { width: max-content !important; min-width: 100%; border-collapse: collapse; }
.page113-table-responsive th, .page113-table-responsive td {
    white-space: nowrap;
    padding: 8px 12px;
    font-family: Arial, sans-serif;
    color: var(--gc-text);
    border: 1px solid #ddd;
}
.page113-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.page113-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.page113-table-wrapper summary:hover, .page113-download-buttons button:hover { background-color: #404040 !important; }
@media (max-width: 768px) {
    .page113-title { font-size: 37px; }
    .page113-section-title { font-size: 24px; }
    .page113-text li, .page113-capex { font-size: 18px; }
}
            `}</style>

            <div className="page113-inner">
                <h1 id="page113-title" className="page113-title">{getText('page113_title', lang)}</h1>

                <div
                    ref={yearDropdownRef}
                    style={{ position: 'relative', marginBottom: '20px', width: '200px' }}
                >
                    <label
                        htmlFor="page113-year-button"
                        style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}
                    >
                        {getText('year_slider_label', lang)}
                    </label>
                    <button
                        ref={yearButtonRef}
                        id="page113-year-button"
                        type="button"
                        onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                        aria-expanded={isYearDropdownOpen}
                        aria-haspopup="listbox"
                        aria-label={year != null ? String(year) : ''}
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
                        <span>{year ?? ''}</span>
                        <span aria-hidden="true" style={{ fontSize: '12px' }}>{isYearDropdownOpen ? '▲' : '▼'}</span>
                    </button>
                    {isYearDropdownOpen && (
                        <div
                            role="listbox"
                            aria-label={getText('year_slider_label', lang)}
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
                            {selectorYears.map((optionYear) => {
                                const isSelected = optionYear === effectiveSelectedYear;
                                return (
                                    <button
                                        key={optionYear}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        onClick={() => {
                                            setSelectedYear(optionYear);
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
                                            e.currentTarget.style.backgroundColor = isSelected ? '#e0f2fe' : '#f5f5f5';
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
                                        <span style={{ fontSize: '16px', color: '#000000' }}>{optionYear}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <div role="status" className="wb-inv" aria-live="polite">
                        {year != null ? (lang === 'en' ? `Showing data for ${year}` : `Données affichées pour ${year}`) : ''}
                    </div>
                </div>

                <p className="page113-capex">
                    {lang === 'en' ? (
                        <>
                            {getText('page113_capex_intro', lang)}
                            <strong>{formatNumber(totalCapexBn, 0)}</strong>
                            {getText('page113_capex_mid', lang)}
                            <strong>{formatNumber(refYearCapexBn, 1)}</strong>
                            {getText('page113_capex_end', lang)}
                            {year}
                        </>
                    ) : (
                        <>
                            {getText('page113_capex_intro', lang)}
                            <strong>{formatNumber(totalCapexBn, 0)}</strong>
                            {getText('page113_capex_mid', lang)}
                            <strong>{formatNumber(refYearCapexBn, 1).replace('.', ',')}</strong>
                            {getText('page113_capex_end', lang)}
                            {year}
                        </>
                    )}
                </p>

                <Page113OilSandsInfographic
                    figureRef={figureRef}
                    lang={lang}
                    overlayValues={overlayValues}
                    formatPct={formatPct}
                    formatMmbd={formatMmbd}
                    getText={getText}
                    ariaLabel={getText('page113_bg_alt', lang)}
                />

                <div className="page113-table-wrapper page113-infographic-table-wrapper">
                    <details onToggle={(event) => setIsInfographicTableOpen(event.currentTarget.open)}>
                        <summary role="button" aria-expanded={isInfographicTableOpen}>
                            <span aria-hidden="true" style={{ marginRight: '8px' }}>{isInfographicTableOpen ? '▼' : '▶'}</span>
                            {getText('page113_infographic_table_summary', lang)}
                            <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                        </summary>
                        <div ref={infographicTableTopRef} className="page113-table-scrollbar" aria-hidden="true"><div /></div>
                        <div
                            ref={infographicTableScrollRef}
                            className="page113-table-responsive"
                            role="region"
                            aria-labelledby="page113-infographic-table-caption"
                            tabIndex={0}
                        >
                            <table className="table table-striped table-hover">
                                <caption id="page113-infographic-table-caption" className="wb-inv">
                                    {substitute(getText('page113_infographic_table_caption', lang), textVars)}
                                </caption>
                                <thead>
                                    <tr>
                                        {infographicHeaders.map((header) => (
                                            <th key={header} scope="col">{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {infographicTableRows.map((row) => (
                                        <tr key={row.year}>
                                            <th scope="row">{row.year}</th>
                                            <td style={{ textAlign: 'right' }}>{row.reservesPct}</td>
                                            <td style={{ textAlign: 'right' }}>{row.sharePct}</td>
                                            <td style={{ textAlign: 'right' }}>{row.oilSandsMmbd}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div ref={infographicTableBottomRef} className="page113-table-scrollbar" aria-hidden="true"><div /></div>
                        <div className="page113-download-buttons">
                            <button type="button" onClick={downloadInfographicPng}>{getText('page113_download_png', lang)}</button>
                            <button type="button" onClick={downloadInfographicCsv}>{getText('page113_download_csv', lang)}</button>
                            <button type="button" onClick={downloadInfographicDocx}>{getText('page113_download_docx', lang)}</button>
                        </div>
                    </details>
                </div>

                <h2 className="page113-section-title page113-section-title--after-infographic">{getText('page113_upgrading_title', lang)}</h2>
                <div className="page113-text">
                    <ul>
                        <li>{substitute(getText('page113_bullet_1', lang), textVars)}</li>
                        <li>
                            {substitute(getText('page113_bullet_2_prefix', lang), textVars)}
                            <strong>{formatPctDisplay(selectedRow?.upgradingPct, 0)}</strong>
                            {getText('page113_bullet_2_suffix', lang)}
                        </li>
                        <li>{substitute(getText('page113_bullet_3', lang), textVars)}</li>
                        <li>
                            {getText('page113_bullet_4_prefix', lang)}
                            <strong>{formatMmbdDisplay(selectedRow?.upgradingCapacityMmbd, 1)}</strong>
                            {getText('page113_bullet_4_suffix', lang)}
                        </li>
                        <li>{getText('page113_bullet_5', lang)}</li>
                    </ul>
                </div>

                <div className="page113-table-wrapper">
                    <details onToggle={(event) => setIsTableOpen(event.currentTarget.open)}>
                        <summary role="button" aria-expanded={isTableOpen}>
                            <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                            {getText('page113_table_summary', lang)}
                            <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                        </summary>
                        <div ref={tableTopRef} className="page113-table-scrollbar" aria-hidden="true"><div /></div>
                        <div
                            ref={tableScrollRef}
                            className="page113-table-responsive"
                            role="region"
                            aria-labelledby="page113-table-caption"
                            tabIndex={0}
                        >
                            <table className="table table-striped table-hover">
                                <caption id="page113-table-caption" className="wb-inv">
                                    {substitute(getText('page113_table_caption', lang), textVars)}
                                </caption>
                                <thead>
                                    <tr>
                                        {tableHeaders.map((header) => (
                                            <th key={header} scope="col">{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {chartTableRows.map((row) => (
                                        <tr key={row.year}>
                                            <th scope="row">{row.year}</th>
                                            <td style={{ textAlign: 'right' }}>{formatNumber(row.oilSandsThousandM3, 1)}</td>
                                            <td style={{ textAlign: 'right' }}>{formatNumber(row.conventionalThousandM3, 1)}</td>
                                            <td style={{ textAlign: 'right' }}>{formatNumber(row.totalThousandM3, 1)}</td>
                                            <td style={{ textAlign: 'right' }}>{formatMmbd(row.oilSandsMmbd, 1)}</td>
                                            <td style={{ textAlign: 'right' }}>{formatMmbd(row.conventionalMmbd, 1)}</td>
                                            <td style={{ textAlign: 'right' }}>{formatMmbd(row.totalMmbd, 1)}</td>
                                            <td style={{ textAlign: 'right' }}>{formatPct(row.sharePct, 0)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div ref={tableBottomRef} className="page113-table-scrollbar" aria-hidden="true"><div /></div>
                        <div className="page113-download-buttons">
                            <button type="button" onClick={downloadCsv}>{getText('page113_download_csv', lang)}</button>
                            <button type="button" onClick={downloadDocx}>{getText('page113_download_docx', lang)}</button>
                        </div>
                    </details>
                </div>
            </div>
        </main>
    );
};

export default Page113;
