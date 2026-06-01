import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';

const START_YEAR = '2019';
const END_YEAR = '2024';
const TRACE_KEYS = ['federalExcl', 'federalCcus', 'ptExcl', 'ptCcus'];
const TRACE_COUNT = TRACE_KEYS.length;

/** Hardcoded public energy RD&D expenditures ($ million). */
const DATA = [
    { period: '2019-20', federalExcl: 745, federalCcus: 20, ptExcl: 255, ptCcus: 60 },
    { period: '2020-21', federalExcl: 810, federalCcus: 30, ptExcl: 330, ptCcus: 15 },
    { period: '2021-22', federalExcl: 950, federalCcus: 55, ptExcl: 365, ptCcus: 50 },
    { period: '2022-23', federalExcl: 1025, federalCcus: 45, ptExcl: 420, ptCcus: 15 },
    { period: '2023-24', federalExcl: 1410, federalCcus: 65, ptExcl: 365, ptCcus: 40 },
];

const COLORS = {
    federalExcl: '#48A36C',
    federalCcus: '#0061A6',
    ptExcl: '#857550',
    ptCcus: '#6097b6',
};

const Page35 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
    const tableTopRef = useRef(null);
    const tableScrollRef = useRef(null);
    const tableBottomRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    const scrollToElement = (id) => (event) => {
        event?.preventDefault();
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const formatMillions = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const periods = DATA.map((row) => row.period);

    const traceValues = useMemo(
        () => Object.fromEntries(TRACE_KEYS.map((key) => [key, DATA.map((row) => row[key])])),
        [],
    );

    const totalValues = useMemo(
        () => DATA.map((row) => TRACE_KEYS.reduce((sum, key) => sum + row[key], 0)),
        [],
    );

    const chartTitle = getText('page35_chart_title', lang);
    const yAxisTitle = getText('page35_y_axis', lang);
    const totalLabel = getText('page35_legend_total', lang);
    const traceLabels = Object.fromEntries(
        TRACE_KEYS.map((key) => [key, getText(`page35_legend_${key}`, lang)]),
    );

    const fileSlugBase = getText('page35_download_title', lang)
        .replace(/\{\{startYear\}\}/g, START_YEAR)
        .replace(/\{\{endYear\}\}/g, END_YEAR)
        .replace(/\s+/g, '_')
        .replace(/–/g, '-');

    const tableRows = useMemo(() => [...DATA].reverse(), []);

    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };
    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 62 : windowWidth <= 768 ? 56 : 50;

    const buildHoverTemplates = (key, values) =>
        periods.map(
            (period, i) =>
                `<b>${traceLabels[key]}</b><br>${period}: ${formatMillions(values[i])}<br><b>${totalLabel}</b>: ${formatMillions(totalValues[i])}<extra></extra>`,
        );

    const opacityForTrace = (traceIndex) => {
        if (selectedPoints === null) return 1;
        return periods.map((_, pointIndex) =>
            selectedPoints[traceIndex]?.includes(pointIndex) ? 1 : 0.3,
        );
    };

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

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
                if (dataTitle && (dataTitle.includes('Download') || /charger/i.test(dataTitle))) {
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
        [isTableOpen, windowWidth, bindTableScrollSync],
    );

    const downloadChartPng = async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement) return;
        const title = `${stripHtml(chartTitle)} (${START_YEAR}–${END_YEAR})`;
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
                const legendHeight = 72;
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
                const legendItems = TRACE_KEYS.map((key) => ({
                    color: COLORS[key],
                    label: traceLabels[key],
                }));
                const totalWidth = legendItems.reduce((acc, item) => acc + ctx.measureText(item.label).width + 44, 0);
                let x = (canvas.width - totalWidth) / 2;
                ctx.font = '20px Arial';
                ctx.textAlign = 'left';
                legendItems.forEach((item) => {
                    ctx.fillStyle = item.color;
                    ctx.fillRect(x, legendY - 12, 22, 14);
                    ctx.fillStyle = '#333333';
                    ctx.fillText(item.label, x + 30, legendY);
                    x += 30 + ctx.measureText(item.label).width + 24;
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

    const downloadCsv = () => {
        const headers = [
            getText('page35_table_col_period', lang),
            ...TRACE_KEYS.map((key) => getText(`page35_table_col_${key}`, lang)),
            getText('page35_table_col_total', lang),
        ];
        const rows = tableRows.map((row) => [
            row.period,
            ...TRACE_KEYS.map((key) => formatMillions(row[key])),
            formatMillions(TRACE_KEYS.reduce((sum, key) => sum + row[key], 0)),
        ]);
        const blob = new Blob(
            [[headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n')],
            { type: 'text/csv;charset=utf-8;' },
        );
        saveAs(blob, `${fileSlugBase}.csv`);
    };

    const downloadDocx = async () => {
        const unitRow = new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: '', bold: true, size: 18 })] })],
                }),
                new TableCell({
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({ text: getText('page35_table_unit_row', lang), bold: true, size: 18 })],
                        }),
                    ],
                    columnSpan: TRACE_COUNT + 1,
                }),
            ],
        });
        const headerRow = new TableRow({
            children: [
                getText('page35_table_col_period', lang),
                ...TRACE_KEYS.map((key) => getText(`page35_table_col_${key}`, lang)),
                getText('page35_table_col_total', lang),
            ].map((header, index) =>
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 18 })] })],
                    shading: { fill: 'E6E6E6' },
                    ...(index > 0 ? {} : {}),
                }),
            ),
        });
        const dataRows = tableRows.map((row) => {
            const total = TRACE_KEYS.reduce((sum, key) => sum + row[key], 0);
            return new TableRow({
                children: [
                    row.period,
                    ...TRACE_KEYS.map((key) => formatMillions(row[key])),
                    formatMillions(total),
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
            });
        });
        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: getText('page35_table_caption', lang)
                                        .replace('{{startYear}}', START_YEAR)
                                        .replace('{{endYear}}', END_YEAR),
                                    bold: true,
                                    size: 28,
                                }),
                            ],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [1200, 1800, 1600, 1800, 1600, 1200],
                            rows: [unitRow, headerRow, ...dataRows],
                        }),
                    ],
                },
            ],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${fileSlugBase}.docx`);
    };

    const handleChartClick = (data) => {
        if (!data?.points?.length) return;
        const traceIndex = data.points[0].curveNumber;
        const pointIndex = data.points[0].pointIndex;
        if (traceIndex === undefined || pointIndex === undefined || traceIndex < 0 || traceIndex >= TRACE_COUNT) return;

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
                const next = Array.from({ length: TRACE_COUNT }, () => []);
                next[traceIndex].push(pointIndex);
                return next;
            }
            if (prev[traceIndex]?.includes(pointIndex)) {
                const next = prev.map((tracePoints, idx) =>
                    idx === traceIndex ? tracePoints.filter((p) => p !== pointIndex) : [...tracePoints],
                );
                return next.every((arr) => arr.length === 0) ? null : next;
            }
            return prev.map((tracePoints, idx) =>
                idx === traceIndex ? [...tracePoints, pointIndex] : [...tracePoints],
            );
        });
    };

    const tableHeaders = [
        getText('page35_table_col_period', lang),
        ...TRACE_KEYS.map((key) => getText(`page35_table_col_${key}`, lang)),
        getText('page35_table_col_total', lang),
    ];

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-35 page35-rdd"
            role="main"
            aria-label={chartTitle}
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-35.page35-rdd {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.page35-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.page35-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-sizing: border-box;
    overflow: visible;
}
.page35-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
}
.page35-chart-figure { margin: 0; }
.page35-chart { width: 100%; min-width: 0; height: ${plotHeight}px; position: relative; }
.page35-chart > div { width: 100%; height: 100%; }
.page35-legend {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 14px 24px;
    flex-wrap: wrap;
    margin-top: 10px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: var(--gc-text);
}
.page35-legend-item { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.page35-legend-box { width: 18px; height: 14px; display: inline-block; border-radius: 2px; }
.page35-body {
    font-family: var(--font-body);
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
    margin: 50px 0 24px 0;
    max-width: none;
}
.page35-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.page35-table-wrapper details > summary {
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
.page35-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page35-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page35-table-scrollbar > div { height: 20px; }
.page35-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #ddd;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.page35-table-responsive::-webkit-scrollbar { display: none; }
.page35-table-responsive table { width: max-content !important; min-width: 100%; border-collapse: collapse; }
.page35-table-responsive table.table {
    font-family: var(--font-body);
    color: var(--gc-text);
}
.page35-table-responsive th, .page35-table-responsive td {
    white-space: nowrap;
    padding: 8px 12px;
    font-family: var(--font-body);
    color: var(--gc-text);
    border: 1px solid #ddd;
}
.page35-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.page35-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.page35-table-wrapper summary:hover, .page35-download-buttons button:hover, .page35-chart-frame button[type="button"]:hover { background-color: #404040 !important; }
.page35-footnotes {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--gc-text);
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
    line-height: 1.65;
}
.page35-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0 0 1rem 0;
}
.page35-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
@media (max-width: 768px) {
    .page35-chart-title { font-size: 26px; }
    .page35-body { font-size: 18px; }
    .page35-legend { font-size: 13px; }
}
            `}</style>

            <div className="page35-inner">
                <div className="page35-chart-frame">
                    <h2 id="page35-chart-title" className="page35-chart-title">
                        {chartTitle}
                        <span id="fn-asterisk-rf-page35" style={{ verticalAlign: 'super', fontSize: '0.75em', lineHeight: '0' }}>
                            <a className="fn-lnk" href="#fn-asterisk-page35" onClick={scrollToElement('fn-asterisk-page35')}>
                                <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                                <span aria-hidden="true">*</span>
                            </a>
                        </span>
                    </h2>

                    {selectedPoints != null && (
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

                    <figure ref={chartRef} className="page35-chart-figure">
                        <Plot
                            data={TRACE_KEYS.map((key, traceIndex) => ({
                                x: periods,
                                y: traceValues[key],
                                type: 'bar',
                                name: traceLabels[key],
                                marker: {
                                    color: COLORS[key],
                                    opacity: opacityForTrace(traceIndex),
                                },
                                hovertemplate: buildHoverTemplates(key, traceValues[key]),
                            }))}
                            layout={{
                                barmode: 'stack',
                                bargap: 0.22,
                                hoverlabel: {
                                    bgcolor: '#ffffff',
                                    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
                                },
                                hovermode: 'closest',
                                clickmode: 'event',
                                dragmode: false,
                                xaxis: {
                                    type: 'category',
                                    categoryorder: 'array',
                                    categoryarray: periods,
                                    showgrid: false,
                                    zeroline: false,
                                    showline: true,
                                    linewidth: 1,
                                    linecolor: '#333',
                                    tickfont: tickFont,
                                    automargin: true,
                                },
                                yaxis: {
                                    title: {
                                        text: yAxisTitle,
                                        font: axisTitleFont,
                                        standoff: 12,
                                    },
                                    range: [0, 2000],
                                    dtick: 200,
                                    showgrid: false,
                                    showline: true,
                                    linewidth: 1,
                                    linecolor: '#333',
                                    zeroline: false,
                                    tickfont: tickFont,
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
                                        name: getText('page35_download_chart', lang),
                                        icon: {
                                            width: 24,
                                            height: 24,
                                            path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z',
                                        },
                                        click: (gd) => downloadChartPng(gd),
                                    },
                                ],
                            }}
                            className="page35-chart"
                            useResizeHandler
                            onClick={handleChartClick}
                        />
                    </figure>

                    <div className="page35-legend" aria-hidden="true">
                        {TRACE_KEYS.map((key) => (
                            <div key={key} className="page35-legend-item">
                                <span className="page35-legend-box" style={{ backgroundColor: COLORS[key] }} />
                                <span>{traceLabels[key]}</span>
                            </div>
                        ))}
                    </div>

                    <div className="page35-table-wrapper">
                        <details onToggle={(event) => setIsTableOpen(event.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                {getText('page35_table_summary', lang)}
                                <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                            </summary>
                            <div ref={tableTopRef} className="page35-table-scrollbar" aria-hidden="true"><div /></div>
                            <div
                                ref={tableScrollRef}
                                className="page35-table-responsive"
                                role="region"
                                aria-labelledby="page35-chart-table-caption"
                                tabIndex={0}
                            >
                                <table className="table table-striped table-hover">
                                    <caption id="page35-chart-table-caption" className="wb-inv">
                                        {getText('page35_table_caption', lang)
                                            .replace('{{startYear}}', START_YEAR)
                                            .replace('{{endYear}}', END_YEAR)}
                                    </caption>
                                    <thead>
                                        <tr>
                                            {tableHeaders.map((header) => (
                                                <th key={header} scope="col">{header}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableRows.map((row) => (
                                            <tr key={row.period}>
                                                <th scope="row">{row.period}</th>
                                                {TRACE_KEYS.map((key) => (
                                                    <td key={key} style={{ textAlign: 'right' }}>{formatMillions(row[key])}</td>
                                                ))}
                                                <td style={{ textAlign: 'right' }}>
                                                    {formatMillions(TRACE_KEYS.reduce((sum, key) => sum + row[key], 0))}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div ref={tableBottomRef} className="page35-table-scrollbar" aria-hidden="true"><div /></div>
                            <div className="page35-download-buttons">
                                <button type="button" onClick={downloadCsv}>{getText('page35_download_csv', lang)}</button>
                                <button type="button" onClick={downloadDocx}>{getText('page35_download_docx', lang)}</button>
                            </div>
                        </details>
                    </div>
                </div>

                <p className="page35-body">{getText('page35_body', lang)}</p>

                <aside className="wb-fnote page35-footnotes" role="note">
                    <h2 id="fn-page35">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</dt>
                        <dd id="fn-asterisk-page35">
                            <a
                                href="#fn-asterisk-rf-page35"
                                onClick={scrollToElement('fn-asterisk-rf-page35')}
                                className="fn-num"
                                title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}
                            >
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                            </a>
                            {' '}{getText('page35_footnote_asterisk', lang)}
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page35;
