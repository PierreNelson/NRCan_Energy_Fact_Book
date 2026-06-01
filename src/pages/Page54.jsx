import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';

const START_YEAR = 2000;
const END_YEAR = 2022;
const INCLUDING_START = 8000;
const INCLUDING_END = 9200;
const EXCLUDING_START = 8000;
const EXCLUDING_END = 10303;
const SAVINGS_PJ = 1103;

const COLORS = {
    excluding: '#CE8003',
    including: '#4b4c4d',
};

const PAGE54_DATA = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => {
    const year = START_YEAR + i;
    const t = i / (END_YEAR - START_YEAR);
    return {
        year,
        including: Math.round(INCLUDING_START + t * (INCLUDING_END - INCLUDING_START)),
        excluding: Math.round(EXCLUDING_START + t * (EXCLUDING_END - EXCLUDING_START)),
    };
});

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    }
    return hex;
};

const Page54 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const chartRef = useRef(null);
    const chartMainRef = useRef(null);
    const calloutRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    const formatPj = (num) => {
        if (num == null || Number.isNaN(Number(num))) return '—';
        return Math.round(Number(num)).toLocaleString(locale);
    };

    const years = useMemo(() => PAGE54_DATA.map((r) => r.year), []);
    const includingValues = useMemo(() => PAGE54_DATA.map((r) => r.including), []);
    const excludingValues = useMemo(() => PAGE54_DATA.map((r) => r.excluding), []);
    const tableRowsDesc = useMemo(() => [...PAGE54_DATA].reverse(), []);

    const yTickvals = [6000, 7000, 8000, 9000, 10000, 11000];
    const yTicktext = yTickvals.map((v) => Math.round(v).toLocaleString(locale));

    const legendExcluding = getText('page54_legend_excluding', lang);
    const legendIncluding = getText('page54_legend_including', lang);

    const chartTitle = getText('page54_chart_title', lang);
    const exportChartTitle = stripHtml(chartTitle);
    const chartDownloadSlug = getText('page54_download_title', lang).replace(/\s+/g, '_');

    const yAxisTitle = getText('page54_yaxis', lang);
    const tableHeaders = [
        getText('page106_table_col_year', lang),
        `${legendIncluding} (PJ)`,
        `${legendExcluding} (PJ)`,
        getText('page54_table_col_savings', lang),
    ];

    const xTickvals = years.filter((y) => y % 2 === 0);

    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 62 : windowWidth <= 768 ? 56 : 50;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    const traceHasSelection = (traceIndex) => selectedPoints?.[traceIndex]?.length > 0;

    const markerOpacityFor = (traceIndex, pointIndex) => {
        if (selectedPoints === null) return 1;
        return selectedPoints[traceIndex]?.includes(pointIndex) ? 1 : 0.3;
    };

    const lineColorFor = (traceIndex, baseColor) => {
        if (selectedPoints === null) return baseColor;
        return traceHasSelection(traceIndex) ? baseColor : hexToRgba(baseColor, 0.3);
    };

    const updateCalloutLayout = useCallback(() => {
        const gd = chartRef.current?.querySelector('.js-plotly-plot');
        const main = chartMainRef.current;
        const callout = calloutRef.current;
        if (!gd?._fullLayout || !main || !callout) return;

        const lastIdx = years.length - 1;
        const xax = gd._fullLayout.xaxis;
        const yax = gd._fullLayout.yaxis;
        const xPx = xax.l2p(END_YEAR) + xax._offset;
        const yExcludingPx = yax.l2p(excludingValues[lastIdx]) + yax._offset;
        const yIncludingPx = yax.l2p(includingValues[lastIdx]) + yax._offset;

        const mainRect = main.getBoundingClientRect();
        const gdRect = gd.getBoundingClientRect();
        const relLeft = gdRect.left - mainRect.left + xPx + 6;
        const top = gdRect.top - mainRect.top + Math.min(yExcludingPx, yIncludingPx);
        const height = Math.max(Math.abs(yIncludingPx - yExcludingPx), 20);

        callout.style.top = `${top}px`;
        callout.style.left = `${relLeft}px`;
        callout.style.height = `${height}px`;
        callout.style.visibility = 'visible';
    }, [excludingValues, includingValues, years.length]);

    useEffect(() => {
        const onResize = () => {
            setWindowWidth(window.innerWidth);
            window.requestAnimationFrame(updateCalloutLayout);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [updateCalloutLayout]);

    useEffect(() => {
        window.requestAnimationFrame(updateCalloutLayout);
    }, [plotHeight, selectedPoints, lang, updateCalloutLayout]);

    useEffect(() => {
        const main = chartMainRef.current;
        if (!main) return;
        const observer = new ResizeObserver(() => {
            window.requestAnimationFrame(updateCalloutLayout);
        });
        observer.observe(main);
        return () => observer.disconnect();
    }, [updateCalloutLayout]);

    useEffect(() => {
        if (!chartRef.current) return;
        const setupChartAccessibility = () => {
            const plotContainer = chartRef.current;
            if (!plotContainer) return;
            plotContainer.querySelectorAll('.main-svg, .svg-container svg').forEach((svg) => {
                svg.setAttribute('aria-hidden', 'true');
            });
            plotContainer.querySelectorAll('.modebar-btn').forEach((btn) => {
                const dataTitle = btn.getAttribute('data-title');
                if (dataTitle && (dataTitle.includes('Download') || /télécharger|charger/i.test(dataTitle))) {
                    btn.setAttribute('aria-label', dataTitle);
                    btn.setAttribute('role', 'button');
                    btn.setAttribute('tabindex', '0');
                    btn.removeAttribute('aria-hidden');
                    btn.onkeydown = (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            btn.click();
                        }
                    };
                } else {
                    btn.setAttribute('aria-hidden', 'true');
                    btn.setAttribute('tabindex', '-1');
                }
            });
        };
        const timer = setTimeout(setupChartAccessibility, 500);
        const observer = new MutationObserver(setupChartAccessibility);
        observer.observe(chartRef.current, { childList: true, subtree: true });
        return () => {
            clearTimeout(timer);
            observer.disconnect();
        };
    }, [lang, selectedPoints]);

    const syncTableScroll = useCallback(() => {
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = bottomScrollRef.current;
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

    useEffect(() => {
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = bottomScrollRef.current;
        if (!topScroll || !tableScroll || !bottomScroll || !isTableOpen) return;

        const syncFrom = (source) => {
            if (source !== topScroll && topScroll.scrollLeft !== source.scrollLeft) topScroll.scrollLeft = source.scrollLeft;
            if (source !== tableScroll && tableScroll.scrollLeft !== source.scrollLeft) tableScroll.scrollLeft = source.scrollLeft;
            if (source !== bottomScroll && bottomScroll.scrollLeft !== source.scrollLeft) bottomScroll.scrollLeft = source.scrollLeft;
        };

        const handleTopScroll = () => syncFrom(topScroll);
        const handleTableScroll = () => syncFrom(tableScroll);
        const handleBottomScroll = () => syncFrom(bottomScroll);
        const sync = () => window.requestAnimationFrame(syncTableScroll);

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
    }, [isTableOpen, windowWidth, syncTableScroll]);

    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        try {
            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 1200,
                height: 640,
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
                ctx.font = 'bold 32px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(exportChartTitle, canvas.width / 2, 48);
                ctx.drawImage(img, 0, titleHeight);
                const legendY = titleHeight + img.height + 36;
                const legendItems = [
                    { color: COLORS.excluding, label: legendExcluding, type: 'line' },
                    { color: COLORS.including, label: legendIncluding, type: 'line' },
                ];
                ctx.font = '20px Arial';
                ctx.textAlign = 'left';
                const totalLegendWidth =
                    legendItems.reduce((acc, item) => acc + ctx.measureText(item.label).width + 56, 0) + 40;
                let x = (canvas.width - totalLegendWidth) / 2;
                legendItems.forEach((item) => {
                    ctx.strokeStyle = item.color;
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.moveTo(x, legendY);
                    ctx.lineTo(x + 28, legendY);
                    ctx.stroke();
                    ctx.fillStyle = '#333333';
                    ctx.fillText(item.label, x + 36, legendY + 6);
                    x += 36 + ctx.measureText(item.label).width + 40;
                });
                canvas.toBlob((blob) => {
                    if (blob) saveAs(blob, `${chartDownloadSlug}.png`);
                });
            };
            img.src = imgData;
        } catch (err) {
            console.error('Error downloading chart:', err);
        }
    };

    const downloadTableAsCSV = () => {
        const lines = [tableHeaders.map((h) => `"${h.replace(/"/g, '""')}"`).join(',')];
        tableRowsDesc.forEach((row) => {
            lines.push(
                [row.year, row.including, row.excluding, row.excluding - row.including]
                    .map((v) => (typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v))
                    .join(','),
            );
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${chartDownloadSlug}.csv`);
    };

    const downloadTableAsDocx = async () => {
        const headerRow = new TableRow({
            children: tableHeaders.map(
                (cell) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: cell, bold: true, size: 20 })],
                                alignment: AlignmentType.CENTER,
                            }),
                        ],
                        shading: { fill: 'E6E6E6' },
                    }),
            ),
        });
        const dataRows = tableRowsDesc.map(
            (row) =>
                new TableRow({
                    children: [row.year, formatPj(row.including), formatPj(row.excluding), formatPj(row.excluding - row.including)].map(
                        (val, index) =>
                            new TableCell({
                                children: [
                                    new Paragraph({
                                        children: [new TextRun({ text: String(val), size: 20 })],
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
                            children: [new TextRun({ text: exportChartTitle, bold: true, size: 28 })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [900, 2800, 2800, 1600],
                            rows: [headerRow, ...dataRows],
                        }),
                    ],
                },
            ],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${chartDownloadSlug}.docx`);
    };

    const handleChartClick = (event) => {
        if (!event.points?.length) return;
        const traceIndex = event.points[0].curveNumber;
        const pointIndex = event.points[0].pointIndex;
        if (traceIndex === undefined || traceIndex < 0 || traceIndex > 1) return;

        if (windowWidth <= 768) {
            const currentTime = Date.now();
            const lastClick = lastClickRef.current;
            const isSamePoint = traceIndex === lastClick.traceIndex && pointIndex === lastClick.pointIndex;
            const isDoubleTap = isSamePoint && currentTime - lastClick.time < 300;
            lastClickRef.current = { time: currentTime, traceIndex, pointIndex };
            if (!isDoubleTap) return;
        }

        setSelectedPoints((prev) => {
            if (prev === null) {
                const next = [[], []];
                next[traceIndex].push(pointIndex);
                return next;
            }
            const isSelected = prev[traceIndex]?.includes(pointIndex);
            if (isSelected) {
                const next = prev.map((tracePoints, idx) =>
                    idx === traceIndex ? tracePoints.filter((p) => p !== pointIndex) : [...tracePoints],
                );
                return next.every((arr) => arr.length === 0) ? null : next;
            }
            return prev.map((tracePoints, idx) => (idx === traceIndex ? [...tracePoints, pointIndex] : [...tracePoints]));
        });
    };

    const excludingHover = years.map(
        (y, i) => `<b>${legendExcluding}</b><br>${y}: ${formatPj(excludingValues[i])} PJ<extra></extra>`,
    );
    const includingHover = years.map(
        (y, i) => `<b>${legendIncluding}</b><br>${y}: ${formatPj(includingValues[i])} PJ<extra></extra>`,
    );

    const savingsLabel = getText('page54_savings_label', lang);
    const savingsValue = formatPj(SAVINGS_PJ);

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-54 page54-efficiency-trends"
            role="main"
            aria-labelledby="page54-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-54.page54-efficiency-trends {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.page54-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.page54-title {
    font-family: 'Lato', sans-serif;
    font-size: 50px;
    font-weight: bold;
    color: #C58516;
    margin: 0 0 10px 0;
    line-height: 1.2;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: none;
}
.page54-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.page-54.page-content p.page54-subtitle {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 15px 0;
    line-height: 1.25;
    text-transform: none;
}
.page54-bullets {
    font-family: var(--font-body);
    font-size: 20px;
    color: var(--gc-text);
    line-height: 1.5;
    margin: 0 0 28px 0;
    padding-left: 1.25rem;
    max-width: none;
}
.page54-bullets li { margin-bottom: 0.65rem; }
.page54-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-top: 8px;
    box-sizing: border-box;
    overflow: visible;
}
.page54-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
}
.page54-chart-row {
    width: 100%;
}
.page54-chart-main {
    position: relative;
    width: 100%;
    min-width: 0;
}
.page54-chart {
    width: 100%;
    min-width: 0;
    height: ${plotHeight}px;
    position: relative;
}
.page54-chart > div { width: 100%; height: 100%; }
.page54-savings-callout {
    position: absolute;
    display: flex;
    align-items: stretch;
    gap: 6px;
    max-width: 170px;
    pointer-events: none;
    z-index: 2;
    visibility: hidden;
}
.page54-savings-bracket {
    flex-shrink: 0;
    width: 18px;
    height: 100%;
    color: #333;
}
.page54-savings-bracket path {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
}
.page54-savings-text {
    font-family: 'Lato', sans-serif;
    line-height: 1.25;
    display: flex;
    flex-direction: column;
    justify-content: center;
}
.page54-savings-label {
    font-size: 15px;
    font-weight: bold;
    color: #333;
    margin: 0 0 4px 0;
}
.page54-savings-value {
    font-family: 'Lato', serif;
    font-size: 19px;
    font-weight: bold;
    color: #C58516;
    margin: 0;
}
.page54-legend {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 18px 28px;
    margin-top: 12px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: var(--gc-text);
}
.page54-legend-item { display: inline-flex; align-items: center; gap: 8px; }
.page54-legend-line { width: 28px; height: 0; border-top: 3px solid; display: inline-block; }
.page54-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.page54-table-wrapper details > summary {
    display: block;
    width: 100%;
    padding: 12px 15px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
    list-style: none;
}
.page54-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page54-table-wrapper details > summary:hover,
.page54-chart-frame button[type="button"]:hover { background-color: #404040 !important; }
.page54-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page54-table-scrollbar > div { height: 20px; }
.page54-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #ddd;
    background: #fff;
    padding: 15px;
    box-sizing: border-box;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.page54-table-responsive::-webkit-scrollbar { display: none; }
.page54-table-responsive table { width: max-content; min-width: 100%; border-collapse: collapse; }
.page54-table-responsive th,
.page54-table-responsive td {
    padding: 8px 12px;
    border: 1px solid #ddd;
    font-family: Arial, sans-serif;
    color: var(--gc-text);
    white-space: nowrap;
}
.page54-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.page54-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.page54-download-buttons button:hover { background: #404040 !important; }
@media (max-width: 768px) {
    .page-54.page-content p.page54-subtitle { font-size: 37px; }
    .page54-bullets { font-size: 18px; }
    .page54-chart-title { font-size: 26px; }
    .page54-savings-callout { max-width: 130px; }
    .page54-savings-label { font-size: 13px; }
    .page54-savings-value { font-size: 16px; }
    .page54-savings-bracket { width: 14px; }
}
@media (max-width: 480px) {
    .page54-chart { height: 320px; }
    .page54-savings-callout { max-width: 110px; }
}
            `}</style>

            <div className="page54-inner">
                <header>
                    <h1 id="page54-title" className="page54-title">{getText('page54_title', lang)}</h1>
                </header>

                <p className="page54-subtitle">{getText('page54_subtitle', lang)}</p>

                <ul className="page54-bullets">
                    <li>
                        <strong>{getText('page54_bullet1_bold', lang)}</strong>
                        {getText('page54_bullet1_text', lang)}
                    </li>
                    <li>
                        <strong>{getText('page54_bullet2_bold', lang)}</strong>
                        {getText('page54_bullet2_text', lang)}
                    </li>
                    <li>
                        <strong>{getText('page54_bullet3_bold', lang)}</strong>
                        {getText('page54_bullet3_text', lang)}
                    </li>
                    <li>
                        <strong>{getText('page54_bullet4_bold1', lang)}</strong>
                        {getText('page54_bullet4_text', lang)}
                        <strong>{getText('page54_bullet4_bold2', lang)}</strong>
                        {getText('page54_bullet4_suffix', lang)}
                    </li>
                    <li>
                        <strong>{getText('page54_bullet5_bold1', lang)}</strong>
                        {getText('page54_bullet5_text', lang)}
                        <strong>{getText('page54_bullet5_bold2', lang)}</strong>
                        {getText('page54_bullet5_suffix', lang)}
                    </li>
                    <li>
                        <strong>{getText('page54_bullet6_bold1', lang)}</strong>
                        {getText('page54_bullet6_text1', lang)}
                        <strong>{getText('page54_bullet6_bold2', lang)}</strong>
                        {getText('page54_bullet6_text2', lang)}
                        <strong>{getText('page54_bullet6_bold3', lang)}</strong>
                        {getText('page54_bullet6_suffix', lang)}
                    </li>
                </ul>

                <div className="page54-chart-frame">
                    <h2 className="page54-chart-title">{chartTitle}</h2>

                    {selectedPoints !== null && (
                        <div style={{ marginBottom: 8 }}>
                            <button
                                type="button"
                                onClick={() => setSelectedPoints(null)}
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

                    <div className="page54-chart-row">
                        <div className="page54-chart-main" ref={chartMainRef}>
                            <figure ref={chartRef} style={{ margin: 0 }}>
                                <div
                                    role="region"
                                    aria-label={getText('page54_chart_aria', lang)}
                                    tabIndex="0"
                                >
                                    <Plot
                                        key={`page54-${selectedPoints ? `${selectedPoints[0].join('-')}_${selectedPoints[1].join('-')}` : 'all'}-${plotHeight}`}
                                        data={[
                                            {
                                                x: years,
                                                y: excludingValues,
                                                type: 'scatter',
                                                mode: 'lines+markers',
                                                name: legendExcluding,
                                                line: {
                                                    color: lineColorFor(0, COLORS.excluding),
                                                    width: 2.5,
                                                },
                                                marker: {
                                                    color: COLORS.excluding,
                                                    size: 8,
                                                    opacity: years.map((_, i) => markerOpacityFor(0, i)),
                                                },
                                                hovertemplate: excludingHover,
                                            },
                                            {
                                                x: years,
                                                y: includingValues,
                                                type: 'scatter',
                                                mode: 'lines+markers',
                                                name: legendIncluding,
                                                line: {
                                                    color: lineColorFor(1, COLORS.including),
                                                    width: 2.5,
                                                },
                                                marker: {
                                                    color: COLORS.including,
                                                    size: 8,
                                                    opacity: years.map((_, i) => markerOpacityFor(1, i)),
                                                },
                                                hovertemplate: includingHover,
                                            },
                                        ]}
                                        layout={{
                                            showlegend: false,
                                            clickmode: 'event',
                                            dragmode: false,
                                            hovermode: 'closest',
                                            hoverlabel: {
                                                bgcolor: '#ffffff',
                                                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
                                            },
                                            margin: { l: 72, r: 130, t: plotTopMargin, b: plotBottomMargin },
                                            paper_bgcolor: 'rgba(0,0,0,0)',
                                            plot_bgcolor: 'rgba(0,0,0,0)',
                                            height: plotHeight,
                                            autosize: true,
                                            xaxis: {
                                                type: 'linear',
                                                tickmode: 'array',
                                                tickvals: xTickvals,
                                                ticktext: xTickvals.map(String),
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                tickfont: tickFont,
                                                automargin: true,
                                            },
                                            yaxis: {
                                                title: { text: yAxisTitle, font: axisTitleFont, standoff: 12 },
                                                range: [6000, 11000],
                                                tickmode: 'array',
                                                tickvals: yTickvals,
                                                ticktext: yTicktext,
                                                showgrid: true,
                                                gridcolor: '#e0e0e0',
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                zeroline: false,
                                                tickfont: tickFont,
                                                automargin: true,
                                                separatethousands: true,
                                            },
                                        }}
                                        config={{
                                            displayModeBar: true,
                                            displaylogo: false,
                                            responsive: true,
                                            scrollZoom: false,
                                            modeBarButtonsToRemove: [
                                                'pan2d',
                                                'select2d',
                                                'lasso2d',
                                                'zoom2d',
                                                'zoomIn2d',
                                                'zoomOut2d',
                                                'autoScale2d',
                                                'resetScale2d',
                                                'toImage',
                                            ],
                                            modeBarButtonsToAdd: [
                                                {
                                                    name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
                                                    icon: {
                                                        width: 24,
                                                        height: 24,
                                                        path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z',
                                                    },
                                                    click: (gd) => downloadChartWithTitle(gd),
                                                },
                                            ],
                                        }}
                                        className="page54-chart"
                                        useResizeHandler
                                        onClick={handleChartClick}
                                        onInitialized={updateCalloutLayout}
                                    />
                                </div>
                            </figure>

                            <aside
                                ref={calloutRef}
                                className="page54-savings-callout"
                                aria-label={`${savingsLabel} ${savingsValue} PJ`}
                            >
                                <svg className="page54-savings-bracket" viewBox="0 0 18 100" preserveAspectRatio="none" aria-hidden="true">
                                    <path d="M 2 0 C 16 25, 16 75, 2 100" />
                                </svg>
                                <div className="page54-savings-text">
                                    <p className="page54-savings-label">{savingsLabel}</p>
                                    <p className="page54-savings-value">{savingsValue} PJ</p>
                                </div>
                            </aside>
                        </div>
                    </div>

                    <div className="page54-legend" aria-hidden="true">
                        <div className="page54-legend-item">
                            <span className="page54-legend-line" style={{ borderColor: COLORS.excluding }} />
                            <span>{legendExcluding}</span>
                        </div>
                        <div className="page54-legend-item">
                            <span className="page54-legend-line" style={{ borderColor: COLORS.including }} />
                            <span>{legendIncluding}</span>
                        </div>
                    </div>

                    <div className="page54-table-wrapper">
                        <details onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>
                                    {isTableOpen ? '▼' : '▶'}
                                </span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">
                                    {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                </span>
                            </summary>
                            <div ref={topScrollRef} className="page54-table-scrollbar" aria-hidden="true">
                                <div />
                            </div>
                            <div ref={tableScrollRef} className="page54-table-responsive" role="region" tabIndex="0">
                                <table className="table table-striped table-hover">
                                    <caption className="wb-inv">{getText('page54_table_caption', lang)}</caption>
                                    <thead>
                                        <tr>
                                            {tableHeaders.map((hdr) => (
                                                <th key={hdr} scope="col" style={{ fontWeight: 'bold', textAlign: hdr === tableHeaders[0] ? 'left' : 'center' }}>
                                                    {hdr}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableRowsDesc.map((row) => (
                                            <tr key={row.year}>
                                                <th scope="row" style={{ fontWeight: 'bold' }}>{row.year}</th>
                                                <td style={{ textAlign: 'center' }}>{formatPj(row.including)}</td>
                                                <td style={{ textAlign: 'center' }}>{formatPj(row.excluding)}</td>
                                                <td style={{ textAlign: 'center' }}>{formatPj(row.excluding - row.including)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="page54-download-buttons">
                                    <button type="button" onClick={downloadTableAsCSV}>
                                        {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                    </button>
                                    <button type="button" onClick={downloadTableAsDocx}>
                                        {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                    </button>
                                </div>
                            </div>
                            <div ref={bottomScrollRef} className="page54-table-scrollbar" aria-hidden="true">
                                <div />
                            </div>
                        </details>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Page54;
