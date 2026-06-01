import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getText } from '../utils/translations';
import { getPage117Data } from '../utils/dataLoader';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const COLORS = {
    differential: '#949494',
    wti: '#0061A6',
    wcs: '#7C9E33',
};

const CHART_START = 201501;

const substitute = (template, vars) =>
    template.replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const formatMonthRef = (refDate, lang) => {
    const year = Math.floor(refDate / 100);
    const month = refDate % 100;
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString(lang === 'en' ? 'en-CA' : 'fr-CA', { month: 'short', year: 'numeric' });
};

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    }
    return hex;
};

const Page117 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedTraceIds, setSelectedTraceIds] = useState(null);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null });
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);

    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    const formatPrice = (num) => {
        if (num === undefined || num === null || Number.isNaN(num)) return '\u2014';
        return Number(num).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    const formatFx = (num) => {
        if (num === undefined || num === null || Number.isNaN(num)) return '\u2014';
        return Number(num).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4,
        });
    };

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        getPage117Data()
            .then((data) => {
                if (!cancelled) {
                    setResult(data);
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err.message || String(err));
                    setLoading(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
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
    }, [lang, selectedTraceIds, result]);

    useEffect(() => {
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;
        if (!topScroll || !tableScroll) return;
        let isSyncingTop = false;
        let isSyncingTable = false;
        const syncTopToTable = () => {
            if (isSyncingTable) return;
            isSyncingTop = true;
            tableScroll.scrollLeft = topScroll.scrollLeft;
            requestAnimationFrame(() => {
                isSyncingTop = false;
            });
        };
        const syncTableToTop = () => {
            if (isSyncingTop) return;
            isSyncingTable = true;
            topScroll.scrollLeft = tableScroll.scrollLeft;
            requestAnimationFrame(() => {
                isSyncingTable = false;
            });
        };
        const updateTopScrollWidth = () => {
            const table = tableScroll.querySelector('table');
            if (table && topScroll.firstChild) {
                topScroll.firstChild.style.width = `${table.scrollWidth}px`;
            }
        };
        topScroll.addEventListener('scroll', syncTopToTable);
        tableScroll.addEventListener('scroll', syncTableToTop);
        updateTopScrollWidth();
        const resizeObserver = new ResizeObserver(updateTopScrollWidth);
        const table = tableScroll.querySelector('table');
        if (table) resizeObserver.observe(table);
        return () => {
            topScroll.removeEventListener('scroll', syncTopToTable);
            tableScroll.removeEventListener('scroll', syncTableToTop);
            resizeObserver.disconnect();
        };
    }, [isTableOpen, result]);

    const chartRows = useMemo(() => result?.chartData?.filter((row) => row.refDate >= CHART_START) || [], [result]);
    const chartTableRows = useMemo(
        () => [...chartRows].sort((a, b) => b.refDate - a.refDate),
        [chartRows],
    );
    const chartStartYear = result?.chartStartYear ?? 2015;
    const chartEndYear = result?.chartEndYear ?? 2025;

    const xDates = useMemo(() => chartRows.map((row) => row.dateLabel), [chartRows]);
    const wtiValues = useMemo(() => chartRows.map((row) => row.wti), [chartRows]);
    const wcsValues = useMemo(() => chartRows.map((row) => row.wcsUsd), [chartRows]);
    const diffValues = useMemo(() => chartRows.map((row) => row.differential), [chartRows]);

    const diffLabel = getText('page117_legend_differential', lang);
    const wtiLabel = getText('page117_legend_wti', lang);
    const wcsLabel = getText('page117_legend_wcs', lang);
    const yAxisTitle = getText('page117_yaxis_label', lang);
    const chartTitle = getText('page117_chart_title', lang);
    const textVars = { startYear: chartStartYear, endYear: chartEndYear };

    const fileSlugBase =
        lang === 'en'
            ? `wti_and_wcs_prices_${chartStartYear}-${chartEndYear}`
            : `prix_du_wti_et_wcs_${chartStartYear}-${chartEndYear}`;

    const yearTicks = useMemo(() => {
        const ticks = [];
        for (let year = chartStartYear; year <= chartEndYear; year += 1) {
            ticks.push(`${year}-01-01`);
        }
        return ticks;
    }, [chartStartYear, chartEndYear]);

    const plotBottomMargin = windowWidth <= 480 ? 72 : windowWidth <= 768 ? 62 : 50;
    const plotTopMargin = windowWidth <= 480 ? 56 : 48;
    const chartHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 400 : 480;
    const tickFont = { size: windowWidth <= 480 ? 12 : windowWidth <= 768 ? 14 : 16, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    const hoverPrice = (label, values) =>
        values.map((val, i) => {
            const row = chartRows[i];
            const dateText = formatMonthRef(row.refDate, lang);
            const formatted = lang === 'en' ? `$${formatPrice(val)}` : `${formatPrice(val)} $`;
            return `<b>${label}</b><br>${dateText}: ${formatted}<extra></extra>`;
        });

    const diffFocused = selectedTraceIds === null || selectedTraceIds.includes(0);
    const diffFillColor = hexToRgba(COLORS.differential, diffFocused ? 0.85 : 0.25);
    const wtiFocused = selectedTraceIds === null || selectedTraceIds.includes(2);
    const wcsFocused = selectedTraceIds === null || selectedTraceIds.includes(1);

    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement) return;
        const title = `${stripHtml(chartTitle)} (${chartStartYear}-${chartEndYear})`;
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
                    { color: COLORS.differential, label: diffLabel, type: 'box' },
                    { color: COLORS.wti, label: wtiLabel, type: 'line' },
                    { color: COLORS.wcs, label: wcsLabel, type: 'line' },
                ];
                const totalWidth = legendItems.length * 220;
                let x = (canvas.width - totalWidth) / 2 + 20;
                ctx.font = '24px Arial';
                ctx.textAlign = 'left';
                legendItems.forEach((item) => {
                    if (item.type === 'box') {
                        ctx.fillStyle = item.color;
                        ctx.fillRect(x, legendY - 14, 24, 24);
                    } else {
                        ctx.strokeStyle = item.color;
                        ctx.lineWidth = 4;
                        ctx.beginPath();
                        ctx.moveTo(x, legendY);
                        ctx.lineTo(x + 28, legendY);
                        ctx.stroke();
                    }
                    ctx.fillStyle = '#333333';
                    ctx.fillText(item.label, x + 36, legendY + 6);
                    x += 220;
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
            getText('page117_table_col_date', lang),
            getText('page117_table_col_wti', lang),
            getText('page117_table_col_wcs_cad', lang),
            getText('page117_table_col_usd_cad', lang),
            getText('page117_table_col_wcs_usd', lang),
            getText('page117_table_col_differential', lang),
        ];
        const rows = chartTableRows.map((row) => [
            formatMonthRef(row.refDate, lang),
            row.wti,
            row.wcsCad ?? '',
            row.usdCad ?? '',
            row.wcsUsd,
            row.differential,
        ]);
        const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${fileSlugBase}.csv`);
    };

    const downloadDocx = async () => {
        const unitText = getText('page117_yaxis_label', lang);
        const headerRow = new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: getText('page117_table_col_date', lang), bold: true, size: 18 })] })],
                    shading: { fill: 'E6E6E6' },
                }),
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: `${getText('page117_table_col_wti', lang)} (${unitText})`, bold: true, size: 18 })],
                            alignment: AlignmentType.CENTER,
                        }),
                    ],
                    shading: { fill: 'E6E6E6' },
                }),
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: getText('page117_table_col_wcs_cad', lang), bold: true, size: 18 })],
                            alignment: AlignmentType.CENTER,
                        }),
                    ],
                    shading: { fill: 'E6E6E6' },
                }),
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: getText('page117_table_col_usd_cad', lang), bold: true, size: 18 })],
                            alignment: AlignmentType.CENTER,
                        }),
                    ],
                    shading: { fill: 'E6E6E6' },
                }),
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: `${getText('page117_table_col_wcs_usd', lang)} (${unitText})`, bold: true, size: 18 })],
                            alignment: AlignmentType.CENTER,
                        }),
                    ],
                    shading: { fill: 'E6E6E6' },
                }),
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: `${getText('page117_table_col_differential', lang)} (${unitText})`, bold: true, size: 18 })],
                            alignment: AlignmentType.CENTER,
                        }),
                    ],
                    shading: { fill: 'E6E6E6' },
                }),
            ],
        });
        const dataRows = chartTableRows.map(
            (row) =>
                new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatMonthRef(row.refDate, lang), size: 18 })] })] }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatPrice(row.wti), size: 18 })], alignment: AlignmentType.RIGHT })] }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatPrice(row.wcsCad), size: 18 })], alignment: AlignmentType.RIGHT })] }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatFx(row.usdCad), size: 18 })], alignment: AlignmentType.RIGHT })] }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatPrice(row.wcsUsd), size: 18 })], alignment: AlignmentType.RIGHT })] }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatPrice(row.differential), size: 18 })], alignment: AlignmentType.RIGHT })] }),
                    ],
                }),
        );
        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: `${stripHtml(chartTitle)} (${chartStartYear}-${chartEndYear})`, bold: true, size: 28 })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [1800, 1400, 1400, 1400, 1400, 1400],
                            rows: [headerRow, ...dataRows],
                        }),
                    ],
                },
            ],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${fileSlugBase}.docx`);
    };

    if (loading) return <p>{lang === 'en' ? 'Loading...' : 'Chargement...'}</p>;
    if (error) return <p>{error}</p>;
    if (!chartRows.length) return <p>{getText('page117_no_data', lang)}</p>;

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-117 page117-crude-prices"
            role="main"
            aria-labelledby="page117-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-117.page117-crude-prices {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.page117-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.page117-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 24px 0;
    line-height: 1.25;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: none;
}
.page117-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.page-117 p.page117-subtitle {
    font-family: 'Lato', sans-serif;
    font-size: 28px;
    font-weight: bold;
    color: #423330;
    margin: 0 0 15px 0;
    text-transform: none;
}
.page117-text {
    font-family: var(--font-body);
    line-height: 1.5;
    color: var(--gc-text);
    margin-bottom: 28px;
    max-width: none;
}
.page117-text ul {
    margin: 0 0 1rem 0;
    padding-left: 1.25rem;
}
.page117-text li {
    margin-bottom: 0.65rem;
    font-family: var(--font-body);
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
}
.page117-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-top: 8px;
    box-sizing: border-box;
    overflow: visible;
}
.page117-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
}
.page117-chart { width: 100%; min-width: 0; height: ${chartHeight}px; position: relative; }
.page117-chart > div { width: 100%; height: 100%; }
.page117-legend {
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
.page117-legend-item { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.page117-legend-box { width: 18px; height: 18px; display: inline-block; border-radius: 2px; }
.page117-legend-line { width: 28px; height: 0; border-top: 3px solid; display: inline-block; }
.page117-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.page117-table-wrapper details > summary {
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
.page117-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page117-table-wrapper details > summary::marker { display: none; content: ''; }
.page117-table-wrapper details > summary:hover { background-color: #404040 !important; }
.page117-table-wrapper .table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch;
    border: 1px solid #ddd;
    background: #fff;
}
.page117-table-wrapper .table-responsive table {
    width: max-content !important;
    min-width: 100%;
    border-collapse: collapse;
}
.page117-table-wrapper .table-responsive table th,
.page117-table-wrapper .table-responsive table td {
    white-space: nowrap;
    padding: 8px 12px;
    font-family: var(--font-body);
    color: var(--gc-text);
}
.page117-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.page117-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.page117-download-buttons button:hover,
.page117-table-wrapper details > summary:hover,
.page117-chart-frame button[type="button"]:hover {
    background: #404040 !important;
}
@media (max-width: 768px) {
    .page117-title { font-size: 37px; }
    .page-117 p.page117-subtitle { font-size: 28px; }
    .page117-chart-title { font-size: 26px; }
    .page117-text li { font-size: 18px; }
}
@media (max-width: 480px) {
    .page117-chart { height: 320px; }
}
            `}</style>

            <div className="page117-inner">
                <header>
                    <h1 id="page117-title" className="page117-title">{getText('page117_title', lang)}</h1>
                </header>

                <div className="page117-text">
                    <p className="page117-subtitle">{getText('page117_subtitle_wti_wcs', lang)}</p>
                    <ul>
                        <li>{getText('page117_bullet_wti', lang)}</li>
                        <li>{getText('page117_bullet_wcs', lang)}</li>
                    </ul>

                    <p className="page117-subtitle">{getText('page117_subtitle_differential', lang)}</p>
                    <ul>
                        <li>{getText('page117_bullet_diff_quality', lang)}</li>
                        <li>{getText('page117_bullet_diff_history', lang)}</li>
                        <li>{getText('page117_bullet_pandemic', lang)}</li>
                        <li>{getText('page117_paragraph_recovery', lang)}</li>
                    </ul>
                </div>

                <div className="page117-chart-frame">
                    <h2 id="page117-chart-title" className="page117-chart-title">{chartTitle}</h2>

                    {selectedTraceIds !== null && (
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
                                marginBottom: 8,
                            }}
                        >
                            {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                        </button>
                    )}

                    <figure ref={chartRef} style={{ margin: 0 }}>
                        <div aria-hidden="true">
                            <Plot
                                key={`page117-${selectedTraceIds ? selectedTraceIds.join('-') : 'all'}`}
                                data={[
                                    {
                                        x: xDates,
                                        y: diffValues,
                                        type: 'scatter',
                                        mode: 'lines',
                                        name: diffLabel,
                                        line: { color: diffFillColor, width: 0.5 },
                                        fill: 'tozeroy',
                                        fillcolor: diffFillColor,
                                        hovertemplate: hoverPrice(diffLabel, diffValues),
                                    },
                                    {
                                        x: xDates,
                                        y: wcsValues,
                                        type: 'scatter',
                                        mode: 'lines',
                                        name: wcsLabel,
                                        line: { color: hexToRgba(COLORS.wcs, wcsFocused ? 1 : 0.3), width: 2.5 },
                                        hovertemplate: hoverPrice(wcsLabel, wcsValues),
                                    },
                                    {
                                        x: xDates,
                                        y: wtiValues,
                                        type: 'scatter',
                                        mode: 'lines',
                                        name: wtiLabel,
                                        line: { color: hexToRgba(COLORS.wti, wtiFocused ? 1 : 0.3), width: 2.5 },
                                        hovertemplate: hoverPrice(wtiLabel, wtiValues),
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
                                        ticktext: yearTicks.map((d) => String(parseInt(d.slice(0, 4), 10))),
                                        automargin: true,
                                    },
                                    yaxis: {
                                        title: { text: yAxisTitle, font: axisTitleFont, standoff: 12 },
                                        showgrid: false,
                                        showline: true,
                                        linewidth: 1,
                                        linecolor: '#333',
                                        zeroline: false,
                                        tickfont: tickFont,
                                        range: [0, 120],
                                        dtick: 20,
                                        automargin: true,
                                    },
                                    showlegend: false,
                                    margin: { l: 70, r: 24, t: plotTopMargin, b: plotBottomMargin },
                                    autosize: true,
                                    paper_bgcolor: 'rgba(0,0,0,0)',
                                    plot_bgcolor: 'rgba(0,0,0,0)',
                                    height: chartHeight,
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
                                            name: getText('page117_download_chart', lang),
                                            icon: {
                                                width: 24,
                                                height: 24,
                                                path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z',
                                            },
                                            click: (gd) => downloadChartWithTitle(gd),
                                        },
                                    ],
                                }}
                                className="page117-chart"
                                useResizeHandler
                                onClick={(data) => {
                                    if (!data.points || data.points.length === 0) return;
                                    const traceIndex = data.points[0].curveNumber;
                                    if (traceIndex === undefined || traceIndex < 0 || traceIndex > 2) return;
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
                                }}
                            />
                        </div>
                    </figure>

                    <div className="page117-legend" aria-hidden="true">
                        <div className="page117-legend-item">
                            <span className="page117-legend-box" style={{ backgroundColor: COLORS.differential }} />
                            <span>{diffLabel}</span>
                        </div>
                        <div className="page117-legend-item">
                            <span className="page117-legend-line" style={{ borderColor: COLORS.wti }} />
                            <span>{wtiLabel}</span>
                        </div>
                        <div className="page117-legend-item">
                            <span className="page117-legend-line" style={{ borderColor: COLORS.wcs }} />
                            <span>{wcsLabel}</span>
                        </div>
                    </div>

                    <div className="page117-table-wrapper">
                        <details onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '\u25BC' : '\u25B6'}</span>
                                {getText('page117_table_summary', lang)}
                                <span className="wb-inv">{getText('page117_table_toggle_sr', lang)}</span>
                            </summary>

                            <div
                                ref={topScrollRef}
                                style={{
                                    width: '100%',
                                    overflowX: 'auto',
                                    overflowY: 'hidden',
                                    marginBottom: '0px',
                                    display: windowWidth <= 768 ? 'none' : 'block',
                                }}
                                aria-hidden="true"
                            >
                                <div style={{ height: '20px' }} />
                            </div>
                            <div
                                ref={tableScrollRef}
                                className="table-responsive"
                                role="region"
                                tabIndex="0"
                                aria-label={getText('page117_table_aria', lang)}
                            >
                                <table className="table table-striped table-hover" style={{ marginTop: '15px' }}>
                                    <caption className="wb-inv">
                                        {substitute(getText('page117_table_caption', lang), textVars)}
                                    </caption>
                                    <thead>
                                        <tr>
                                            <th scope="col" style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f0f0f0' }}>
                                                {getText('page117_table_col_date', lang)}
                                            </th>
                                            <th scope="col" style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f0f0f0', textAlign: 'right' }}>
                                                {getText('page117_table_col_wti', lang)}
                                            </th>
                                            <th scope="col" style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f0f0f0', textAlign: 'right' }}>
                                                {getText('page117_table_col_wcs_cad', lang)}
                                            </th>
                                            <th scope="col" style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f0f0f0', textAlign: 'right' }}>
                                                {getText('page117_table_col_usd_cad', lang)}
                                            </th>
                                            <th scope="col" style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f0f0f0', textAlign: 'right' }}>
                                                {getText('page117_table_col_wcs_usd', lang)}
                                            </th>
                                            <th scope="col" style={{ border: '1px solid #ddd', padding: '10px', backgroundColor: '#f0f0f0', textAlign: 'right' }}>
                                                {getText('page117_table_col_differential', lang)}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {chartTableRows.map((row) => (
                                            <tr key={row.refDate}>
                                                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{formatMonthRef(row.refDate, lang)}</td>
                                                <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{formatPrice(row.wti)}</td>
                                                <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{formatPrice(row.wcsCad)}</td>
                                                <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{formatFx(row.usdCad)}</td>
                                                <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{formatPrice(row.wcsUsd)}</td>
                                                <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{formatPrice(row.differential)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="page117-download-buttons">
                                <button type="button" onClick={downloadCsv}>{getText('page117_download_csv', lang)}</button>
                                <button type="button" onClick={downloadDocx}>{getText('page117_download_docx', lang)}</button>
                            </div>
                        </details>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Page117;
