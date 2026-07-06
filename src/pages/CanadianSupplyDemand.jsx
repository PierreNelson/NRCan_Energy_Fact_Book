import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import CanadianSupplyDemandInfographic from '../components/CanadianSupplyDemandInfographic';
import {
    drawInfographicOverlays,
    NATIVE_SIZE,
    OVERLAY_COLORS,
    OVERLAY_SLOTS,
} from '../components/CanadianSupplyDemandInfographic.constants';
import canadianSupplyDemandBgEn from '../assets/canadian_supply_demand_bg.png';
import canadianSupplyDemandBgFr from '../assets/canadian_supply_demand_bg_fr.png';

const REFERENCE_YEAR = 2024;

/** Hardcoded snapshot values for the infographic (2024). */
const INFOGRAPHIC_DATA = {
    production: 5.1,
    exports: 4.1,
    imports: 0.7,
    refinery: 1.7,
};

/** Hardcoded trade time series (MMb/d). */
const TRADE_DATA = [
    { year: 2008, exports: 1.9, imports: 0.9 },
    { year: 2009, exports: 1.9, imports: 0.9 },
    { year: 2010, exports: 1.9, imports: 0.8 },
    { year: 2011, exports: 2.1, imports: 0.8 },
    { year: 2012, exports: 2.3, imports: 0.75 },
    { year: 2013, exports: 2.6, imports: 0.75 },
    { year: 2014, exports: 2.8, imports: 0.7 },
    { year: 2015, exports: 3.0, imports: 0.75 },
    { year: 2016, exports: 3.0, imports: 0.75 },
    { year: 2017, exports: 3.4, imports: 0.7 },
    { year: 2018, exports: 3.6, imports: 0.65 },
    { year: 2019, exports: 3.7, imports: 0.7 },
    { year: 2020, exports: 3.6, imports: 0.6 },
    { year: 2021, exports: 3.8, imports: 0.5 },
    { year: 2022, exports: 3.9, imports: 0.5 },
    { year: 2023, exports: 4.0, imports: 0.5 },
    { year: 2024, exports: 4.3, imports: 0.55 },
];

const COLORS = {
    exports: '#7D962C',
    imports: '#3B95C9',
};

const INFOGRAPHIC_ROW_KEYS = ['production', 'exports', 'imports', 'refinery'];

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    }
    return hex;
};

const CanadianSupplyDemand = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [isChartTableOpen, setIsChartTableOpen] = useState(false);
    const [isInfographicTableOpen, setIsInfographicTableOpen] = useState(false);
    const [selectedTraceIds, setSelectedTraceIds] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const chartRef = useRef(null);
    const infographicFigureRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null });
    const chartTableTopRef = useRef(null);
    const chartTableScrollRef = useRef(null);
    const chartTableBottomRef = useRef(null);
    const infographicTableTopRef = useRef(null);
    const infographicTableScrollRef = useRef(null);
    const infographicTableBottomRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const formatMmbd = (value, digits = 1) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        });
    };

    const formatHoverMmbd = (value, digits = 1) => {
        const formatted = formatMmbd(value, digits);
        if (formatted === '–') return formatted;
        return lang === 'fr' ? formatted.replace('.', ',') : formatted;
    };

    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const scrollToElement = (id) => (event) => {
        event?.preventDefault();
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
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
        () => bindTableScrollSync(isChartTableOpen, chartTableTopRef, chartTableScrollRef, chartTableBottomRef),
        [isChartTableOpen, windowWidth, bindTableScrollSync],
    );

    useEffect(
        () => bindTableScrollSync(
            isInfographicTableOpen,
            infographicTableTopRef,
            infographicTableScrollRef,
            infographicTableBottomRef,
        ),
        [isInfographicTableOpen, windowWidth, bindTableScrollSync],
    );

    const chartTableRows = useMemo(
        () => [...TRADE_DATA].sort((a, b) => b.year - a.year),
        [],
    );

    const startYear = TRADE_DATA[0]?.year ?? 2008;
    const endYear = TRADE_DATA[TRADE_DATA.length - 1]?.year ?? 2024;
    const textVars = { year: REFERENCE_YEAR, startYear, endYear };

    const years = TRADE_DATA.map((row) => row.year);
    const yearTicks = years.filter((yearValue) => yearValue % 2 === 0);
    const exportValues = TRADE_DATA.map((row) => row.exports);
    const importValues = TRADE_DATA.map((row) => row.imports);
    const chartYearMin = years[0];
    const chartYearMax = years[years.length - 1];

    const exportsLabel = getText('canadian_supply_demand_legend_exports', lang);
    const importsLabel = getText('canadian_supply_demand_legend_imports', lang);
    const chartTitle = getText('canadian_supply_demand_chart_title', lang);
    const yAxisTitle = getText('canadian_supply_demand_y_axis', lang);

    const exportsHoverTexts = years.map(
        (yearValue, i) => `<b>${exportsLabel}</b><br>${yearValue}: ${formatHoverMmbd(exportValues[i])}<extra></extra>`,
    );
    const importsHoverTexts = years.map(
        (yearValue, i) => `<b>${importsLabel}</b><br>${yearValue}: ${formatHoverMmbd(importValues[i])}<extra></extra>`,
    );

    const exportsFocused = selectedTraceIds === null || selectedTraceIds.includes(0);
    const importsFocused = selectedTraceIds === null || selectedTraceIds.includes(1);

    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };
    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 62 : windowWidth <= 768 ? 56 : 50;

    const fileSlugBase = substitute(getText('canadian_supply_demand_download_title', lang), textVars)
        .replace(/\s+/g, '_')
        .replace(/–/g, '-');
    const infographicPngSlug = substitute(getText('canadian_supply_demand_infographic_png_slug', lang), textVars)
        .replace(/\s+/g, '_');
    const infographicDownloadTitle = substitute(getText('canadian_supply_demand_infographic_download_title', lang), textVars)
        .replace(/\s+/g, '_')
        .replace(/–/g, '-');

    const infographicTableRows = INFOGRAPHIC_ROW_KEYS.map((key) => ({
        key,
        label: getText(`canadian_supply_demand_infographic_row_${key}`, lang),
        value: formatMmbd(INFOGRAPHIC_DATA[key], 1),
    }));

    const chartTableHeaders = [
        getText('canadian_supply_demand_table_col_year', lang),
        getText('canadian_supply_demand_table_col_exports', lang),
        getText('canadian_supply_demand_table_col_imports', lang),
    ];

    const infographicHeaders = [
        getText('canadian_supply_demand_infographic_table_col_indicator', lang),
        getText('canadian_supply_demand_infographic_table_col_value', lang),
    ];

    const handleChartClick = useCallback(
        (data) => {
            if (!data?.points?.length) return;
            const traceIndex = data.points[0].curveNumber;
            if (traceIndex === undefined || traceIndex < 0 || traceIndex > 1) return;

            if (windowWidth <= 768) {
                const currentTime = Date.now();
                const lastClick = lastClickRef.current;
                const isSameTrace = traceIndex === lastClick.traceIndex && lastClick.traceIndex != null;
                const isDoubleTap = isSameTrace && currentTime - lastClick.time < 300;
                lastClickRef.current = { time: currentTime, traceIndex };
                if (!isDoubleTap) return;
            }

            setSelectedTraceIds((prev) => {
                if (prev === null) return [traceIndex];
                if (prev.includes(traceIndex)) {
                    const next = prev.filter((t) => t !== traceIndex);
                    return next.length === 0 ? null : next;
                }
                return [...prev, traceIndex];
            });
        },
        [windowWidth],
    );

    const downloadChartPng = async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement) return;
        const title = `${chartTitle} (${startYear}–${endYear})`;
        try {
            if (!window.Plotly) return;
            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 1200,
                height: 700,
                scale: 2,
            });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                const titleHeight = 100;
                const legendHeight = 56;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight + legendHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 36px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, canvas.width / 2, 48);
                ctx.drawImage(img, 0, titleHeight);
                const legendY = titleHeight + img.height + 36;
                const legendItems = [
                    { color: COLORS.exports, label: exportsLabel, type: 'line' },
                    { color: COLORS.imports, label: importsLabel, type: 'line' },
                ];
                const totalWidth = legendItems.length * 320;
                let x = (canvas.width - totalWidth) / 2 + 20;
                ctx.font = '24px Arial';
                ctx.textAlign = 'left';
                legendItems.forEach((item) => {
                    ctx.strokeStyle = item.color;
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.moveTo(x, legendY);
                    ctx.lineTo(x + 28, legendY);
                    ctx.stroke();
                    ctx.fillStyle = '#333333';
                    ctx.fillText(item.label, x + 36, legendY + 6);
                    x += 320;
                });
                canvas.toBlob((blob) => {
                    if (blob) saveAs(blob, `${fileSlugBase}.png`);
                });
            };
            img.src = imgData;
        } catch {
            /* ignore export errors */
        }
    };

    const downloadChartCsv = () => {
        const header = chartTableHeaders.map(csvEscape).join(',');
        const rows = chartTableRows.map((row) =>
            [row.year, formatMmbd(row.exports, 1), formatMmbd(row.imports, 1)].map(csvEscape).join(','),
        );
        const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${fileSlugBase}.csv`);
    };

    const downloadChartDocx = async () => {
        const headerRow = new TableRow({
            children: chartTableHeaders.map(
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
                        formatMmbd(row.exports, 1),
                        formatMmbd(row.imports, 1),
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
                                    text: substitute(getText('canadian_supply_demand_table_caption', lang), textVars),
                                    bold: true,
                                    size: 28,
                                }),
                            ],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [900, 1800, 1800],
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
        const rows = infographicTableRows.map((row) => [row.label, row.value]);
        const blob = new Blob(
            [[infographicHeaders.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n')],
            { type: 'text/csv;charset=utf-8;' },
        );
        saveAs(blob, `${infographicDownloadTitle}.csv`);
    };

    const downloadInfographicDocx = async () => {
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
                    children: [row.label, row.value].map((value, index) =>
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
                                    text: substitute(getText('canadian_supply_demand_infographic_table_caption', lang), textVars),
                                    bold: true,
                                    size: 28,
                                }),
                            ],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [4200, 1600],
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
        const bgImage = lang === 'fr' ? canadianSupplyDemandBgFr : canadianSupplyDemandBgEn;
        const overlayLang = lang === 'fr' ? 'fr' : 'en';
        const slots = OVERLAY_SLOTS[overlayLang];
        const native = NATIVE_SIZE[overlayLang];

        const img = new Image();
        img.src = bgImage;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        const scale = 3;
        const canvas = document.createElement('canvas');
        canvas.width = native.width * scale;
        canvas.height = native.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        drawInfographicOverlays(ctx, {
            slots,
            values: INFOGRAPHIC_DATA,
            formatValue: (value) => formatMmbd(value, 1),
            colors: OVERLAY_COLORS,
            width: canvas.width,
            height: canvas.height,
        });

        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${infographicPngSlug}.png`);
        });
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-112 canadian-supply-demand-supply-demand"
            role="main"
            aria-labelledby="canadian-supply-demand-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-112.canadian-supply-demand-supply-demand {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.canadian-supply-demand-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.canadian-supply-demand-title {
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
.canadian-supply-demand-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.canadian-supply-demand-section-title {
    font-family: 'Lato', sans-serif;
    font-size: 28px;
    font-weight: bold;
    color: #423330;
    margin: 28px 0 16px 0;
    text-transform: none;
}
.canadian-supply-demand-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-sizing: border-box;
    overflow: visible;
}
.canadian-supply-demand-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
}
.canadian-supply-demand-chart-figure { margin: 0; }
.canadian-supply-demand-chart { width: 100%; min-width: 0; height: ${plotHeight}px; position: relative; }
.canadian-supply-demand-chart > div { width: 100%; height: 100%; }
.canadian-supply-demand-legend {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 18px 28px;
    flex-wrap: wrap;
    margin-top: 10px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: var(--gc-text);
}
.canadian-supply-demand-legend-item { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.canadian-supply-demand-legend-line {
    width: 28px;
    height: 0;
    border-top: 4px solid;
    display: inline-block;
}
.canadian-supply-demand-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.canadian-supply-demand-infographic-table-wrapper { margin-bottom: 0; }
.canadian-supply-demand-table-wrapper details > summary {
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
.canadian-supply-demand-table-wrapper details > summary::-webkit-details-marker { display: none; }
.canadian-supply-demand-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.canadian-supply-demand-table-scrollbar > div { height: 20px; }
.canadian-supply-demand-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #ddd;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.canadian-supply-demand-table-responsive::-webkit-scrollbar { display: none; }
.canadian-supply-demand-table-responsive table { width: max-content !important; min-width: 100%; border-collapse: collapse; }
.canadian-supply-demand-table-responsive table.table {
    font-family: var(--font-body);
    color: var(--gc-text);
}
.canadian-supply-demand-table-responsive th, .canadian-supply-demand-table-responsive td {
    white-space: nowrap;
    padding: 8px 12px;
    font-family: var(--font-body);
    color: var(--gc-text);
    border: 1px solid #ddd;
}
.canadian-supply-demand-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.canadian-supply-demand-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.canadian-supply-demand-table-wrapper summary:hover, .canadian-supply-demand-download-buttons button:hover, .canadian-supply-demand-chart-frame button[type="button"]:hover { background-color: #404040 !important; }
.canadian-supply-demand-footnotes {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--gc-text);
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
    line-height: 1.65;
}
.canadian-supply-demand-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0 0 1rem 0;
}
.canadian-supply-demand-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
@media (max-width: 768px) {
    .canadian-supply-demand-title { font-size: 37px; }
    .canadian-supply-demand-section-title { font-size: 24px; }
    .canadian-supply-demand-chart-title { font-size: 26px; }
}
            `}</style>

            <div className="canadian-supply-demand-inner">
                <h1 id="canadian-supply-demand-title" className="canadian-supply-demand-title">
                    {getText('canadian_supply_demand_title', lang)}
                    <span id="fn-asterisk-rf-canadian-supply-demand" style={{ verticalAlign: 'super', fontSize: '0.75em', lineHeight: '0' }}>
                        <a className="fn-lnk" href="#fn-asterisk-canadian-supply-demand" onClick={scrollToElement('fn-asterisk-canadian-supply-demand')}>
                            <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                            <span aria-hidden="true">*</span>
                        </a>
                    </span>
                    {' '}({REFERENCE_YEAR})
                </h1>

                <CanadianSupplyDemandInfographic
                    figureRef={infographicFigureRef}
                    lang={lang}
                    overlayValues={INFOGRAPHIC_DATA}
                    formatMmbd={formatMmbd}
                    getText={getText}
                    ariaLabel={getText('canadian_supply_demand_bg_alt', lang)}
                />

                <div className="canadian-supply-demand-table-wrapper canadian-supply-demand-infographic-table-wrapper">
                    <details onToggle={(event) => setIsInfographicTableOpen(event.currentTarget.open)}>
                        <summary role="button" aria-expanded={isInfographicTableOpen}>
                            <span aria-hidden="true" style={{ marginRight: '8px' }}>{isInfographicTableOpen ? '▼' : '▶'}</span>
                            {getText('canadian_supply_demand_infographic_table_summary', lang)}
                            <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                        </summary>
                        <div ref={infographicTableTopRef} className="canadian-supply-demand-table-scrollbar" aria-hidden="true"><div /></div>
                        <div
                            ref={infographicTableScrollRef}
                            className="canadian-supply-demand-table-responsive"
                            role="region"
                            aria-labelledby="canadian-supply-demand-infographic-table-caption"
                            tabIndex={0}
                        >
                            <table className="table table-striped table-hover">
                                <caption id="canadian-supply-demand-infographic-table-caption" className="wb-inv">
                                    {substitute(getText('canadian_supply_demand_infographic_table_caption', lang), textVars)}
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
                                        <tr key={row.key}>
                                            <th scope="row">{row.label}</th>
                                            <td style={{ textAlign: 'right' }}>{row.value}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div ref={infographicTableBottomRef} className="canadian-supply-demand-table-scrollbar" aria-hidden="true"><div /></div>
                        <div className="canadian-supply-demand-download-buttons">
                            <button type="button" onClick={downloadInfographicPng}>{getText('canadian_supply_demand_download_png', lang)}</button>
                            <button type="button" onClick={downloadInfographicCsv}>{getText('canadian_supply_demand_download_csv', lang)}</button>
                            <button type="button" onClick={downloadInfographicDocx}>{getText('canadian_supply_demand_download_docx', lang)}</button>
                        </div>
                    </details>
                </div>

                <h2 className="canadian-supply-demand-section-title">{getText('canadian_supply_demand_section_trade', lang)}</h2>

                <div className="canadian-supply-demand-chart-frame">
                    <h3 className="canadian-supply-demand-chart-title">{chartTitle}</h3>

                    {selectedTraceIds != null && (
                        <div style={{ marginBottom: 8 }}>
                            <button
                                type="button"
                                onClick={() => setSelectedTraceIds(null)}
                                style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#8C8C8C',
                                    border: '1px solid #404040',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontFamily: 'Arial, sans-serif',
                                    fontSize: 14,
                                    color: '#fff',
                                }}
                            >
                                {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                            </button>
                        </div>
                    )}

                    <figure ref={chartRef} className="canadian-supply-demand-chart-figure">
                        <Plot
                            key={`canadian-supply-demand-${selectedTraceIds ? selectedTraceIds.join('-') : 'all'}-${plotHeight}`}
                            data={[
                                {
                                    x: years,
                                    y: exportValues,
                                    type: 'scatter',
                                    mode: 'lines',
                                    name: exportsLabel,
                                    line: { color: hexToRgba(COLORS.exports, exportsFocused ? 1 : 0.25), width: 2.5 },
                                    hovertemplate: exportsHoverTexts,
                                },
                                {
                                    x: years,
                                    y: importValues,
                                    type: 'scatter',
                                    mode: 'lines',
                                    name: importsLabel,
                                    line: { color: hexToRgba(COLORS.imports, importsFocused ? 1 : 0.25), width: 2.5 },
                                    hovertemplate: importsHoverTexts,
                                },
                            ]}
                            layout={{
                                hoverlabel: {
                                    bgcolor: '#ffffff',
                                    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
                                },
                                hovermode: 'closest',
                                clickmode: 'event',
                                dragmode: false,
                                xaxis: {
                                    showgrid: false,
                                    zeroline: false,
                                    showline: true,
                                    linewidth: 1,
                                    linecolor: '#333',
                                    tickfont: tickFont,
                                    tickmode: 'array',
                                    tickvals: yearTicks,
                                    ticktext: yearTicks.map(String),
                                    range: [chartYearMin, chartYearMax],
                                    automargin: true,
                                },
                                yaxis: {
                                    title: {
                                        text: yAxisTitle,
                                        font: axisTitleFont,
                                        standoff: 12,
                                    },
                                    showgrid: false,
                                    showline: true,
                                    linewidth: 1,
                                    linecolor: '#333',
                                    zeroline: false,
                                    tickfont: tickFont,
                                    range: [0, 4.5],
                                    dtick: 0.5,
                                    automargin: true,
                                },
                                showlegend: false,
                                margin: { l: 70, r: 24, t: plotTopMargin, b: plotBottomMargin },
                                autosize: true,
                                paper_bgcolor: 'rgba(0,0,0,0)',
                                plot_bgcolor: 'rgba(0,0,0,0)',
                            }}
                            style={{ width: '100%', height: `${plotHeight}px` }}
                            config={{
                                displayModeBar: true,
                                displaylogo: false,
                                responsive: true,
                                scrollZoom: false,
                                modeBarButtonsToRemove: [
                                    'pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d',
                                    'autoScale2d', 'resetScale2d', 'toImage',
                                ],
                                modeBarButtonsToAdd: [
                                    {
                                        name: getText('canadian_supply_demand_download_chart', lang),
                                        icon: {
                                            width: 24,
                                            height: 24,
                                            path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z',
                                        },
                                        click: (gd) => downloadChartPng(gd),
                                    },
                                ],
                            }}
                            className="canadian-supply-demand-chart"
                            useResizeHandler
                            onClick={handleChartClick}
                        />
                    </figure>

                    <div className="canadian-supply-demand-legend" aria-hidden="true">
                        <div className="canadian-supply-demand-legend-item">
                            <span className="canadian-supply-demand-legend-line" style={{ borderColor: COLORS.exports }} />
                            <span>{exportsLabel}</span>
                        </div>
                        <div className="canadian-supply-demand-legend-item">
                            <span className="canadian-supply-demand-legend-line" style={{ borderColor: COLORS.imports }} />
                            <span>{importsLabel}</span>
                        </div>
                    </div>

                    <div className="canadian-supply-demand-table-wrapper">
                        <details onToggle={(event) => setIsChartTableOpen(event.currentTarget.open)}>
                            <summary role="button" aria-expanded={isChartTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isChartTableOpen ? '▼' : '▶'}</span>
                                {getText('canadian_supply_demand_table_summary', lang)}
                                <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                            </summary>
                            <div ref={chartTableTopRef} className="canadian-supply-demand-table-scrollbar" aria-hidden="true"><div /></div>
                            <div
                                ref={chartTableScrollRef}
                                className="canadian-supply-demand-table-responsive"
                                role="region"
                                aria-labelledby="canadian-supply-demand-chart-table-caption"
                                tabIndex={0}
                            >
                                <table className="table table-striped table-hover">
                                    <caption id="canadian-supply-demand-chart-table-caption" className="wb-inv">
                                        {substitute(getText('canadian_supply_demand_table_caption', lang), textVars)}
                                    </caption>
                                    <thead>
                                        <tr>
                                            {chartTableHeaders.map((header) => (
                                                <th key={header} scope="col">{header}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {chartTableRows.map((row) => (
                                            <tr key={row.year}>
                                                <th scope="row">{row.year}</th>
                                                <td style={{ textAlign: 'right' }}>{formatMmbd(row.exports, 1)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatMmbd(row.imports, 1)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div ref={chartTableBottomRef} className="canadian-supply-demand-table-scrollbar" aria-hidden="true"><div /></div>
                            <div className="canadian-supply-demand-download-buttons">
                                <button type="button" onClick={downloadChartCsv}>{getText('canadian_supply_demand_download_csv', lang)}</button>
                                <button type="button" onClick={downloadChartDocx}>{getText('canadian_supply_demand_download_docx', lang)}</button>
                            </div>
                        </details>
                    </div>
                </div>

                <aside className="wb-fnote canadian-supply-demand-footnotes" role="note">
                    <h2 id="fn-canadian-supply-demand">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</dt>
                        <dd id="fn-asterisk-canadian-supply-demand">
                            <a
                                href="#fn-asterisk-rf-canadian-supply-demand"
                                onClick={scrollToElement('fn-asterisk-rf-canadian-supply-demand')}
                                className="fn-num"
                                title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}
                            >
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                            </a>
                            {' '}{getText('canadian_supply_demand_footnote_asterisk', lang)}
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default CanadianSupplyDemand;
