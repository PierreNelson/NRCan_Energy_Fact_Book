import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import energyTradeBgEn from '../assets/energy_trade_bg.svg';
import energyTradeBgFr from '../assets/energy_trade_bg_fr.svg';

const REFERENCE_YEAR = 2025;
const TABLE_MIN_WIDTH_PX = 560;
const SCROLLBAR_PX = 20;

const COMMODITY_KEYS = ['crude_oil', 'natural_gas', 'electricity', 'coal'];
const METRIC_KEYS = ['exportsDestined', 'productionExported', 'usImports', 'usConsumption'];

/* SVG viewBox 893×545. Equal-height rows centered on measured icon midlines. */
const SVG_HEIGHT = 545;
const FIRST_ICON_CENTER = 411;
const LAST_ICON_CENTER = 529;
const ROW_COUNT = 4;
const ROW_HEIGHT_PX = (LAST_ICON_CENTER - FIRST_ICON_CENTER) / (ROW_COUNT - 1);
const ROW_TOP_PX = FIRST_ICON_CENTER - ROW_HEIGHT_PX / 2;
const ROW_BOUNDS = Array.from({ length: ROW_COUNT + 1 }, (_, index) => ROW_TOP_PX + index * ROW_HEIGHT_PX);
const HEADER_HEIGHT_PX = 86;
const HEADER_BOTTOM_PX = ROW_BOUNDS[0];
const HEADER_TOP_PX = HEADER_BOTTOM_PX - HEADER_HEIGHT_PX;
const TABLE_CONTENT_HEIGHT_PX = HEADER_HEIGHT_PX + ROW_COUNT * ROW_HEIGHT_PX;
/* Just right of widest icon (flame ~x359); keep right edge near 98.7%. */
const OVERLAY_LEFT_PCT = 41.4;
const OVERLAY_WIDTH_PCT = 57.3;
const pct = (px) => `${((px / SVG_HEIGHT) * 100).toFixed(3)}%`;
const OVERLAY_TOP = pct(HEADER_TOP_PX);
const OVERLAY_HEIGHT = pct(TABLE_CONTENT_HEIGHT_PX);
const HEADER_FLEX = `${((HEADER_HEIGHT_PX / TABLE_CONTENT_HEIGHT_PX) * 100).toFixed(3)}%`;

const INFO_COLUMN_WIDTHS = [5000, 2000, 2200];
const COMMODITY_COLUMN_WIDTHS = [1600, 1900, 1900, 1900, 1900];

const INFO_METRICS = [
    { labelKey: 'energy_trade_info_energy_exports', valueKey: 'energyExportsBillion', unitKey: 'energy_trade_unit_billion_dollars' },
    { labelKey: 'energy_trade_info_goods_share', valueKey: 'goodsExportsShare', unitKey: 'energy_trade_unit_percent' },
    { labelKey: 'energy_trade_info_oil_gas_exports', valueKey: 'oilGasExportsBillion', unitKey: 'energy_trade_unit_billion_dollars' },
    { labelKey: 'energy_trade_info_oil_gas_us_share', valueKey: 'oilGasToUsShare', unitKey: 'energy_trade_unit_percent' },
    { labelKey: 'energy_trade_info_countries', valueKey: 'destinationCountries', unitKey: 'energy_trade_unit_countries' },
    { labelKey: 'energy_trade_info_us_share', valueKey: 'usEnergyExportShare', unitKey: 'energy_trade_unit_percent' },
    { labelKey: 'energy_trade_info_us_value', valueKey: 'usEnergyExportBillion', unitKey: 'energy_trade_unit_billion_dollars' },
];

const DATA_BY_YEAR = {
    2025: {
        infographic: {
            energyExportsBillion: 197.8,
            goodsExportsShare: 27,
            oilGasExportsBillion: 182,
            oilGasToUsShare: 89,
            destinationCountries: 137,
            usEnergyExportShare: 85,
            usEnergyExportBillion: 168.9,
        },
        rows: {
            crude_oil: { exportsDestined: 90, productionExported: 82, usImports: 63, usConsumption: 23 },
            natural_gas: { exportsDestined: 97, productionExported: 45, usImports: '>99', usConsumption: 9 },
            electricity: { exportsDestined: 100, productionExported: 6, usImports: 81, usConsumption: 1 },
            coal: { exportsDestined: 1, productionExported: 2, usImports: 19, usConsumption: 0.1 },
        },
    },
};

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const waitForImage = (img) =>
    new Promise((resolve, reject) => {
        if (img.complete && img.naturalWidth > 0) {
            resolve(img);
            return;
        }
        img.onload = () => resolve(img);
        img.onerror = reject;
    });

const formatCell = (value, lang) => {
    if (value == null) return '–';
    if (typeof value === 'string') return value;
    if (Number.isInteger(value)) {
        return Number(value).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { maximumFractionDigits: 0 });
    }
    return Number(value).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });
};

const formatPercentDownload = (value, lang) => {
    const formatted = formatCell(value, lang);
    if (formatted === '–' || String(formatted).endsWith('%')) return formatted;
    return `${formatted}%`;
};

const EnergyTrade = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [selectedYear] = useState(REFERENCE_YEAR);
    const [windowWidth, setWindowWidth] = useState(
        typeof window !== 'undefined' ? window.innerWidth : 1200,
    );

    const figureRef = useRef(null);
    const infographicImgRef = useRef(null);
    const tableTopRef = useRef(null);
    const tableScrollRef = useRef(null);
    const tableBottomRef = useRef(null);
    const tableInnerRef = useRef(null);

    const syncTableScroll = useCallback(() => {
        const topScroll = tableTopRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = tableBottomRef.current;
        const tableInner = tableInnerRef.current;
        if (!topScroll || !tableScroll || !bottomScroll || !tableInner) return;

        const contentWidth = Math.max(tableInner.scrollWidth, TABLE_MIN_WIDTH_PX);
        [topScroll.firstElementChild, bottomScroll.firstElementChild].forEach((spacer) => {
            if (spacer) spacer.style.width = `${contentWidth}px`;
        });
        const shouldShow = contentWidth > tableScroll.clientWidth + 1;
        topScroll.style.display = shouldShow ? 'block' : 'none';
        bottomScroll.style.display = shouldShow ? 'block' : 'none';
    }, []);

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        const topScroll = tableTopRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = tableBottomRef.current;
        const tableInner = tableInnerRef.current;
        if (!topScroll || !tableScroll || !bottomScroll || !tableInner) return undefined;

        const syncFrom = (source) => {
            if (source !== topScroll && topScroll.scrollLeft !== source.scrollLeft) {
                topScroll.scrollLeft = source.scrollLeft;
            }
            if (source !== tableScroll && tableScroll.scrollLeft !== source.scrollLeft) {
                tableScroll.scrollLeft = source.scrollLeft;
            }
            if (source !== bottomScroll && bottomScroll.scrollLeft !== source.scrollLeft) {
                bottomScroll.scrollLeft = source.scrollLeft;
            }
        };

        const handleTopScroll = () => syncFrom(topScroll);
        const handleTableScroll = () => syncFrom(tableScroll);
        const handleBottomScroll = () => syncFrom(bottomScroll);
        const scheduleSync = () => window.requestAnimationFrame(syncTableScroll);

        topScroll.addEventListener('scroll', handleTopScroll);
        tableScroll.addEventListener('scroll', handleTableScroll);
        bottomScroll.addEventListener('scroll', handleBottomScroll);

        /* Observe content + viewport only — never mutate observed sizes in a feedback loop. */
        const observer = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(scheduleSync)
            : null;
        observer?.observe(tableInner);
        observer?.observe(tableScroll);
        scheduleSync();

        const imgEl = infographicImgRef.current;
        const onImgLoad = () => scheduleSync();
        imgEl?.addEventListener('load', onImgLoad);
        if (imgEl?.complete) scheduleSync();

        return () => {
            topScroll.removeEventListener('scroll', handleTopScroll);
            tableScroll.removeEventListener('scroll', handleTableScroll);
            bottomScroll.removeEventListener('scroll', handleBottomScroll);
            imgEl?.removeEventListener('load', onImgLoad);
            observer?.disconnect();
        };
    }, [lang, selectedYear, windowWidth, syncTableScroll]);

    const textVars = { year: selectedYear };
    const yearData = DATA_BY_YEAR[selectedYear] ?? DATA_BY_YEAR[REFERENCE_YEAR];
    const bgImage = lang === 'en' ? energyTradeBgEn : energyTradeBgFr;
    const pageTitle = substitute(getText('energy_trade_title', lang), textVars);
    const fileTitle = substitute(getText('energy_trade_download_title', lang), textVars);
    const tableCaption = substitute(getText('energy_trade_table_caption', lang), textVars);

    const metricHeaders = METRIC_KEYS.map((key) => getText(`energy_trade_col_${key}`, lang));
    const tableRows = COMMODITY_KEYS.map((key) => ({
        key,
        label: getText(`energy_trade_row_${key}`, lang),
        values: METRIC_KEYS.map((metric) => yearData.rows[key][metric]),
    }));

    const infographicRows = INFO_METRICS.map((metric) => ({
        label: getText(metric.labelKey, lang),
        value: formatCell(yearData.infographic[metric.valueKey], lang),
        unit: getText(metric.unitKey, lang),
    }));

    const downloadInfographicPng = async () => {
        const imgEl = infographicImgRef.current;
        const figureEl = figureRef.current;
        if (!imgEl || !figureEl) return;
        try {
            const loaded = await waitForImage(imgEl);
            const scale = 2;
            const canvas = document.createElement('canvas');
            canvas.width = loaded.naturalWidth * scale;
            canvas.height = loaded.naturalHeight * scale;
            const ctx = canvas.getContext('2d');
            ctx.scale(scale, scale);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, loaded.naturalWidth, loaded.naturalHeight);
            ctx.drawImage(loaded, 0, 0, loaded.naturalWidth, loaded.naturalHeight);

            const ox = loaded.naturalWidth * (OVERLAY_LEFT_PCT / 100);
            const ow = loaded.naturalWidth * (OVERLAY_WIDTH_PCT / 100);
            const yScale = loaded.naturalHeight / SVG_HEIGHT;
            const headers = metricHeaders;
            const colW = ow / headers.length;

            const headerY = HEADER_TOP_PX * yScale;
            const headerH = HEADER_HEIGHT_PX * yScale;
            ctx.fillStyle = '#49494b';
            ctx.fillRect(ox, headerY, ow, headerH);
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.max(9, headerH * 0.16)}px "Noto Sans", Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            headers.forEach((header, index) => {
                const words = header.split(' ');
                const lines = [];
                let line = '';
                words.forEach((word) => {
                    const test = line ? `${line} ${word}` : word;
                    if (ctx.measureText(test).width > colW - 8 && line) {
                        lines.push(line);
                        line = word;
                    } else {
                        line = test;
                    }
                });
                if (line) lines.push(line);
                const lineHeight = Math.max(10, headerH * 0.18);
                const startY = headerY + headerH / 2 - ((lines.length - 1) * lineHeight) / 2;
                lines.forEach((textLine, lineIndex) => {
                    ctx.fillText(textLine, ox + colW * index + colW / 2, startY + lineIndex * lineHeight, colW - 6);
                });
            });

            tableRows.forEach((row, rowIndex) => {
                const ry = ROW_BOUNDS[rowIndex] * yScale;
                const rowH = (ROW_BOUNDS[rowIndex + 1] - ROW_BOUNDS[rowIndex]) * yScale;
                row.values.forEach((value, colIndex) => {
                    const cx = ox + colW * colIndex;
                    ctx.fillStyle = colIndex % 2 === 0 ? '#b2bac9' : '#ffffff';
                    ctx.fillRect(cx, ry, colW, rowH);
                    ctx.strokeStyle = '#8a93a3';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(cx, ry + rowH);
                    ctx.lineTo(cx + colW, ry + rowH);
                    ctx.stroke();
                    ctx.fillStyle = '#333333';
                    ctx.font = `bold ${Math.max(11, rowH * 0.45)}px "Noto Sans", Arial, sans-serif`;
                    ctx.fillText(formatCell(value, lang), cx + colW / 2, ry + rowH / 2, colW - 6);
                });
            });

            canvas.toBlob((blob) => {
                if (blob) saveAs(blob, `${fileTitle}.png`);
            });
        } catch (err) {
            console.warn('Unable to download infographic image.', err);
        }
    };

    const downloadCsv = () => {
        const percentUnit = getText('energy_trade_unit_percent', lang);
        const sections = [
            [csvEscape(getText('energy_trade_info_section', lang))],
            [
                csvEscape(getText('energy_trade_info_col_indicator', lang)),
                csvEscape(getText('energy_trade_info_col_value', lang)),
                csvEscape(getText('energy_trade_info_col_unit', lang)),
            ].join(','),
            ...infographicRows.map((row) => [row.label, row.value, row.unit].map(csvEscape).join(',')),
            '',
            [csvEscape(getText('energy_trade_table_section', lang))],
            [
                csvEscape(getText('energy_trade_col_commodity', lang)),
                ...metricHeaders.map(csvEscape),
                csvEscape(getText('energy_trade_info_col_unit', lang)),
            ].join(','),
            ...tableRows.map((row) => [
                csvEscape(row.label),
                ...row.values.map((value) => csvEscape(formatPercentDownload(value, lang))),
                csvEscape(percentUnit),
            ].join(',')),
        ];
        const blob = new Blob([sections.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${fileTitle}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadDocx = async () => {
        const percentUnit = getText('energy_trade_unit_percent', lang);
        const infoHeaders = [
            getText('energy_trade_info_col_indicator', lang),
            getText('energy_trade_info_col_value', lang),
            getText('energy_trade_info_col_unit', lang),
        ];
        const infoHeader = new TableRow({
            children: infoHeaders.map((header) => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: header, bold: true, size: 16, color: 'FFFFFF' })],
                    alignment: AlignmentType.CENTER,
                })],
                shading: { fill: '49494B' },
            })),
        });
        const infoRows = infographicRows.map((row) => new TableRow({
            children: [row.label, row.value, row.unit].map((cell, colIndex) => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: String(cell), size: 18, bold: colIndex === 0 })],
                    alignment: colIndex === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
                })],
                shading: { fill: colIndex % 2 === 0 ? 'FFFFFF' : 'B2BAC9' },
            })),
        }));

        const commodityHeaders = [
            getText('energy_trade_col_commodity', lang),
            ...metricHeaders,
            getText('energy_trade_info_col_unit', lang),
        ];
        const tableHeader = new TableRow({
            children: commodityHeaders.map((header) => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: header, bold: true, size: 16, color: 'FFFFFF' })],
                    alignment: AlignmentType.CENTER,
                })],
                shading: { fill: '49494B' },
            })),
        });
        const commodityRows = tableRows.map((row) => new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: row.label, bold: true, size: 18 })] })],
                    shading: { fill: 'FFFFFF' },
                }),
                ...row.values.map((value, colIndex) => new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({ text: formatPercentDownload(value, lang), size: 18 })],
                        alignment: AlignmentType.CENTER,
                    })],
                    shading: { fill: colIndex % 2 === 0 ? 'B2BAC9' : 'FFFFFF' },
                })),
                new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({ text: percentUnit, size: 18 })],
                        alignment: AlignmentType.CENTER,
                    })],
                    shading: { fill: 'B2BAC9' },
                }),
            ],
        }));

        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: fileTitle, bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                    }),
                    new Paragraph({
                        children: [new TextRun({ text: getText('energy_trade_info_section', lang), bold: true, size: 22 })],
                        spacing: { after: 160 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: INFO_COLUMN_WIDTHS,
                        rows: [infoHeader, ...infoRows],
                    }),
                    new Paragraph({
                        children: [new TextRun({ text: getText('energy_trade_table_section', lang), bold: true, size: 22 })],
                        spacing: { before: 300, after: 160 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [...COMMODITY_COLUMN_WIDTHS, 1200],
                        rows: [tableHeader, ...commodityRows],
                    }),
                ],
            }],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${fileTitle}.docx`);
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content energy-trade"
            role="main"
            aria-labelledby="energy-trade-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.energy-trade {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.energy-trade-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.energy-trade.page-content h1.energy-trade-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px !important;
    font-weight: bold;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 25px;
    position: relative;
    padding-bottom: 0.5em;
    line-height: 1.2;
    text-transform: none;
}
.energy-trade.page-content h1.energy-trade-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.energy-trade-figure {
    position: relative;
    width: 100%;
    margin: 0 0 ${16 + SCROLLBAR_PX}px 0;
    overflow: visible;
    padding: 0;
}
.energy-trade-bg-image {
    width: 100%;
    height: auto;
    display: block;
}
.energy-trade-table-shell {
    position: absolute;
    left: ${OVERLAY_LEFT_PCT}%;
    width: ${OVERLAY_WIDTH_PCT}%;
    top: ${OVERLAY_TOP};
    height: ${OVERLAY_HEIGHT};
    z-index: 2;
    box-sizing: border-box;
}
.energy-trade-table-scrollbar {
    position: absolute;
    left: 0;
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    margin: 0;
    padding: 0;
    display: none;
    box-sizing: border-box;
    line-height: 0;
}
.energy-trade-table-scrollbar-top {
    /* Flush to the top edge of the table shell. */
    bottom: 100%;
    top: auto;
}
.energy-trade-table-scrollbar-bottom {
    /* Flush to the bottom edge of the table shell. */
    top: 100%;
    bottom: auto;
}
.energy-trade-table-scrollbar > div {
    /* Width spacer only — height comes from the native scrollbar. */
    height: 1px;
}
.energy-trade-table-scroll {
    position: absolute;
    inset: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.energy-trade-table-scroll::-webkit-scrollbar {
    display: none;
}
.energy-trade-table-inner {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    min-width: ${TABLE_MIN_WIDTH_PX}px;
    width: max(100%, ${TABLE_MIN_WIDTH_PX}px);
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    font-family: 'Noto Sans', Arial, sans-serif;
    font-weight: 700;
}
.energy-trade-overlay-header,
.energy-trade-overlay-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    box-sizing: border-box;
    width: 100%;
    flex-shrink: 0;
}
.energy-trade-overlay-header {
    flex-basis: ${HEADER_FLEX};
    height: ${HEADER_FLEX};
    background-color: #49494b;
    color: #ffffff;
    font-size: clamp(9px, 0.95vw, 12px);
    overflow: hidden;
}
.energy-trade-overlay-header > span,
.energy-trade-overlay-row > span {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px 4px;
    line-height: 1.1;
    box-sizing: border-box;
    overflow: hidden;
    text-align: center;
}
.energy-trade-overlay-row {
    flex: 1 1 0;
    min-height: 0;
    font-size: clamp(10px, 1.05vw, 13px);
    color: #333333;
    border-bottom: 1px solid #8a93a3;
}
.energy-trade-overlay-col-accent {
    background-color: #b2bac9;
}
.energy-trade-overlay-col-base {
    background-color: #ffffff;
}
.energy-trade-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin: 0 0 20px 0;
    align-items: center;
}
.energy-trade-actions button {
    appearance: none;
    -webkit-appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    height: 36px;
    padding: 0 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    background-color: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: bold;
    line-height: 1;
    color: #ffffff;
    text-align: center;
    white-space: nowrap;
    box-sizing: border-box;
}
.energy-trade-actions button:hover {
    background: #404040 !important;
    background-color: #404040 !important;
}
.wb-inv {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    border: 0;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
}
@media (max-width: 768px) {
    .energy-trade.page-content h1.energy-trade-title { font-size: 37px !important; }
}
            `}</style>

            <div className="energy-trade-inner">
                <h1 id="energy-trade-title" className="energy-trade-title">{pageTitle}</h1>

                <figure
                    ref={figureRef}
                    className="energy-trade-figure"
                    aria-label={getText('energy_trade_infographic_aria', lang)}
                >
                    <img
                        ref={infographicImgRef}
                        className="energy-trade-bg-image"
                        src={bgImage}
                        alt={getText('energy_trade_infographic_aria', lang)}
                    />
                    <div className="wb-inv">{tableCaption}</div>
                    <div className="energy-trade-table-shell">
                        <div
                            ref={tableTopRef}
                            className="energy-trade-table-scrollbar energy-trade-table-scrollbar-top"
                            aria-hidden="true"
                        >
                            <div />
                        </div>
                        <div
                            ref={tableScrollRef}
                            className="energy-trade-table-scroll"
                            role="region"
                            aria-label={tableCaption}
                            tabIndex={0}
                        >
                            <div ref={tableInnerRef} className="energy-trade-table-inner">
                                <div className="energy-trade-overlay-header" role="row">
                                    {metricHeaders.map((header) => (
                                        <span key={header} role="columnheader">{header}</span>
                                    ))}
                                </div>
                                {tableRows.map((row) => (
                                    <div
                                        key={row.key}
                                        className="energy-trade-overlay-row"
                                        role="row"
                                        aria-label={row.label}
                                    >
                                        {row.values.map((value, colIndex) => (
                                            <span
                                                key={`${row.key}-${colIndex}`}
                                                role="cell"
                                                className={colIndex % 2 === 0 ? 'energy-trade-overlay-col-accent' : 'energy-trade-overlay-col-base'}
                                            >
                                                {formatCell(value, lang)}
                                            </span>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div
                            ref={tableBottomRef}
                            className="energy-trade-table-scrollbar energy-trade-table-scrollbar-bottom"
                            aria-hidden="true"
                        >
                            <div />
                        </div>
                    </div>
                </figure>

                <div className="energy-trade-actions">
                    <button type="button" onClick={downloadInfographicPng}>
                        {getText('energy_trade_download_png', lang)}
                    </button>
                    <button type="button" onClick={downloadCsv}>
                        {lang === 'en' ? 'Download as CSV' : 'Télécharger en CSV'}
                    </button>
                    <button type="button" onClick={downloadDocx}>
                        {lang === 'en' ? 'Download as DOCX' : 'Télécharger en DOCX'}
                    </button>
                </div>
            </div>
        </main>
    );
};

export default EnergyTrade;
