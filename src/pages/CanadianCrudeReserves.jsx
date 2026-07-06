import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getCanadianCrudeReservesData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import CanadianCrudeReservesInfographic from '../components/CanadianCrudeReservesInfographic';
import canadianCrudeReservesBg from '../assets/canadian_crude_reserves_bg.png';
import { OVERLAY_COLORS, LABEL_SLOTS, VALUE_SLOTS } from '../components/CanadianCrudeReservesInfographic.constants';

const BAR_COLOR = '#4a8eb8';
const LINE_COLOR = '#7D962C';

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const CanadianCrudeReserves = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const chartRef = useRef(null);
    const infographicFigureRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    const formatInt = (n) =>
        n == null || Number.isNaN(n)
            ? '\u2014'
            : Math.round(n).toLocaleString(locale);

    const formatReserve = (value, digits = 0) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        });
    };

    const scrollToElement = (id) => (event) => {
        event?.preventDefault();
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    useEffect(() => {
        getCanadianCrudeReservesData()
            .then(setResult)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

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
        if (!topScroll || !tableScroll || !bottomScroll || !isTableOpen) return undefined;

        const syncFrom = (source) => {
            if (source !== topScroll && topScroll.scrollLeft !== source.scrollLeft) topScroll.scrollLeft = source.scrollLeft;
            if (source !== tableScroll && tableScroll.scrollLeft !== source.scrollLeft) tableScroll.scrollLeft = source.scrollLeft;
            if (source !== bottomScroll && bottomScroll.scrollLeft !== source.scrollLeft) bottomScroll.scrollLeft = source.scrollLeft;
        };

        const handleTop = () => syncFrom(topScroll);
        const handleTable = () => syncFrom(tableScroll);
        const handleBottom = () => syncFrom(bottomScroll);
        const sync = () => window.requestAnimationFrame(syncTableScroll);

        topScroll.addEventListener('scroll', handleTop);
        tableScroll.addEventListener('scroll', handleTable);
        bottomScroll.addEventListener('scroll', handleBottom);
        const observer = new ResizeObserver(sync);
        const tableEl = tableScroll.querySelector('table');
        if (tableEl) observer.observe(tableEl);
        observer.observe(tableScroll);
        sync();

        return () => {
            topScroll.removeEventListener('scroll', handleTop);
            tableScroll.removeEventListener('scroll', handleTable);
            bottomScroll.removeEventListener('scroll', handleBottom);
            observer.disconnect();
        };
    }, [isTableOpen, windowWidth, result, syncTableScroll]);

    const chartData = useMemo(() => result?.wells ?? [], [result]);
    const chartTableRows = useMemo(() => [...chartData].sort((a, b) => b.year - a.year), [chartData]);
    const reserves = result?.reserves;
    const startYear = result?.startYear ?? 2000;
    const endYear = result?.endYear ?? startYear;
    const yearRangeSuffix = startYear === endYear ? ` (${startYear})` : ` (${startYear}-${endYear})`;

    const textVars = { year: reserves?.reportingYear ?? '', startYear, endYear };

    const fileSlugBase =
        lang === 'en'
            ? `western_canada_oil_wells_completed_${startYear}-${endYear}`
            : `puits_petrole_ouest_canada_${startYear}-${endYear}`;

    const infographicPngSlug = getText('petroleum_reserves_infographic_png_slug', lang);

    const years = useMemo(() => chartData.map((d) => d.year), [chartData]);
    const counts = useMemo(() => chartData.map((d) => d.wellsCompleted), [chartData]);
    const depths = useMemo(() => chartData.map((d) => d.avgDepthM), [chartData]);

    const legendBars = getText('petroleum_reserves_legend_bars', lang);
    const legendLine = getText('petroleum_reserves_legend_line', lang);
    const yCount = getText('petroleum_reserves_yaxis_count', lang);
    const yDepth = getText('petroleum_reserves_yaxis_depth', lang);
    const chartTitle = getText('petroleum_reserves_chart_title', lang);
    const exportTitleWithRange = `${stripHtml(chartTitle)}${yearRangeSuffix}`;

    const plotBottomMargin = windowWidth <= 480 ? 100 : windowWidth <= 768 ? 88 : 72;
    const plotTopMargin = windowWidth <= 480 ? 56 : 48;
    const chartHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 440;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = {
        size: windowWidth <= 768 ? 18 : 22,
        family: 'Arial, sans-serif',
        color: '#58585a',
    };

    const maxCount = counts.length ? Math.max(...counts) : 12000;
    const yCountMax = Math.ceil(maxCount / 2000) * 2000 || 12000;
    const maxDepth = depths.length ? Math.max(...depths) : 3000;
    const yDepthMax = Math.ceil(maxDepth / 500) * 500 || 3000;

    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        try {
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
                const titleHeight = 96;
                const legendHeight = 52;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight + legendHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 32px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(exportTitleWithRange, canvas.width / 2, 48);
                ctx.drawImage(img, 0, titleHeight);
                const legendY = titleHeight + img.height + 30;
                const items = [
                    { label: legendBars, color: BAR_COLOR, isLine: false },
                    { label: legendLine, color: LINE_COLOR, isLine: true },
                ];
                const totalW = items.reduce((acc, it) => acc + ctx.measureText(it.label).width + 50, 0) + 40;
                let xPos = (canvas.width - totalW) / 2;
                items.forEach((it) => {
                    if (it.isLine) {
                        ctx.strokeStyle = it.color;
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.moveTo(xPos, legendY);
                        ctx.lineTo(xPos + 28, legendY);
                        ctx.stroke();
                    } else {
                        ctx.fillStyle = it.color;
                        ctx.fillRect(xPos, legendY - 8, 24, 14);
                    }
                    ctx.fillStyle = '#333333';
                    ctx.font = '20px Arial';
                    ctx.textAlign = 'left';
                    ctx.fillText(it.label, xPos + 34, legendY + 6);
                    xPos += 34 + ctx.measureText(it.label).width + 36;
                });
                canvas.toBlob((blob) => {
                    if (blob) saveAs(blob, `${fileSlugBase}.png`);
                });
            };
            img.src = imgData;
        } catch (err) {
            console.error('Error downloading chart:', err);
        }
    };

    const downloadTableAsCSV = () => {
        const headers = [
            getText('petroleum_employment_table_col_year', lang),
            getText('petroleum_reserves_table_col_count', lang),
            getText('petroleum_reserves_table_col_depth', lang),
        ];
        const rows = chartTableRows.map((d) => [d.year, Math.round(d.wellsCompleted), Math.round(d.avgDepthM)]);
        const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
        saveAs(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), `${fileSlugBase}.csv`);
    };

    const downloadTableAsDocx = async () => {
        const yCol = getText('petroleum_employment_table_col_year', lang);
        const cCol = getText('petroleum_reserves_table_col_count', lang);
        const dCol = getText('petroleum_reserves_table_col_depth', lang);
        const headerRow = new TableRow({
            children: [yCol, cCol, dCol].map(
                (h) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: h, bold: true, size: 22 })],
                                alignment: AlignmentType.CENTER,
                            }),
                        ],
                        shading: { fill: 'E6E6E6' },
                    }),
            ),
        });
        const dataRows = chartTableRows.map(
            (d) =>
                new TableRow({
                    children: [
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: String(d.year), size: 22 })],
                                    alignment: AlignmentType.CENTER,
                                }),
                            ],
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: formatInt(d.wellsCompleted), size: 22 })],
                                    alignment: AlignmentType.CENTER,
                                }),
                            ],
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: formatInt(d.avgDepthM), size: 22 })],
                                    alignment: AlignmentType.CENTER,
                                }),
                            ],
                        }),
                    ],
                }),
        );
        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: exportTitleWithRange, bold: true, size: 28 })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [2000, 3200, 3200],
                            rows: [headerRow, ...dataRows],
                        }),
                    ],
                },
            ],
        });
        saveAs(await Packer.toBlob(doc), `${fileSlugBase}.docx`);
    };

    const downloadInfographicPng = async () => {
        const img = new Image();
        img.src = canadianCrudeReservesBg;
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

        const overlayLang = lang === 'fr' ? 'fr' : 'en';
        const labelSlots = LABEL_SLOTS[overlayLang];
        const valueSlots = VALUE_SLOTS;

        const drawLabel = (text, slot, fontSizeRatio = 0.032) => {
            if (!text) return;
            ctx.fillStyle = OVERLAY_COLORS.label;
            ctx.font = `bold ${Math.round(canvas.width * fontSizeRatio)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
            ctx.textBaseline = 'middle';
            const align = slot.align ?? 'left';
            ctx.textAlign = align;
            const x = (slot.left / 100) * canvas.width;
            const y = (slot.top / 100) * canvas.height;
            ctx.fillText(text, x, y);
        };

        const drawValue = (text, slot, color, fontSizeRatio = 0.085) => {
            if (!text || text === '–') return;
            ctx.fillStyle = color;
            const ratio = slot.size === 'sm' ? 0.032 : fontSizeRatio;
            ctx.font = `bold ${Math.round(canvas.width * ratio)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
            ctx.textBaseline = 'middle';
            const align = slot.align ?? 'center';
            ctx.textAlign = align;
            const x = (slot.left / 100) * canvas.width;
            const y = (slot.top / 100) * canvas.height;
            ctx.fillText(text, x, y);
        };

        drawLabel(getText('petroleum_reserves_label_canada_total', lang), labelSlots.canada_total, overlayLang === 'fr' ? 0.028 : 0.032);
        drawValue(formatReserve(reserves?.totalBb, 0), valueSlots.total_bb, OVERLAY_COLORS.total_bb);
        drawLabel(`${getText('petroleum_reserves_label_conventional', lang)}**`, labelSlots.conventional, overlayLang === 'fr' ? 0.028 : 0.032);
        drawValue(formatReserve(reserves?.conventionalBb, 0), valueSlots.conventional_bb, OVERLAY_COLORS.conventional_bb);
        drawLabel(getText('petroleum_reserves_label_oil_sands', lang), labelSlots.oil_sands, overlayLang === 'fr' ? 0.028 : 0.032);
        drawValue(formatReserve(reserves?.oilSandsBb, 0), valueSlots.oil_sands_bb, OVERLAY_COLORS.oil_sands_bb);
        drawLabel(getText('petroleum_reserves_label_mining', lang), labelSlots.mining, overlayLang === 'fr' ? 0.028 : 0.032);
        drawValue(formatReserve(reserves?.miningBb, 0), valueSlots.mining_bb, OVERLAY_COLORS.mining_bb);
        drawLabel(getText('petroleum_reserves_label_insitu', lang), labelSlots.insitu, overlayLang === 'fr' ? 0.028 : 0.032);
        drawValue(formatReserve(reserves?.insituBb, 0), valueSlots.insitu_bb, OVERLAY_COLORS.insitu_bb);

        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${infographicPngSlug}.png`);
        });
    };

    const countHoverTemplates = years.map(
        (yr, i) => `<b>${legendBars}</b><br>${yr}: ${formatInt(counts[i])}<extra></extra>`,
    );
    const depthHoverTemplates = years.map(
        (yr, i) => `<b>${legendLine}</b><br>${yr}: ${formatInt(depths[i])} m<extra></extra>`,
    );

    const barMarkerOpacity =
        selectedPoints === null ? 1 : years.map((_, i) => (selectedPoints[0]?.includes(i) ? 1 : 0.3));
    const lineMarkerOpacity =
        selectedPoints === null ? 1 : years.map((_, i) => (selectedPoints[1]?.includes(i) ? 1 : 0.3));
    const lineStrokeOpacity =
        selectedPoints === null || (selectedPoints[1] && selectedPoints[1].length > 0) ? 1 : 0.3;

    if (loading) return <p>{lang === 'en' ? 'Loading...' : 'Chargement...'}</p>;
    if (error) return <p>{error}</p>;
    if (!reserves || !chartData.length) return <p>{getText('petroleum_reserves_no_data', lang)}</p>;

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-110"
            role="main"
            aria-labelledby="canadian-crude-reserves-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-110.page-content {
    max-width: none !important;
    overflow-x: visible !important;
}
.page-110 {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.canadian-crude-reserves-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.canadian-crude-reserves-title {
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
.canadian-crude-reserves-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.canadian-crude-reserves-section-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 8px 0;
    text-transform: none;
}
.canadian-crude-reserves-units {
    font-family: var(--font-body);
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
    margin: 0 0 16px 0;
}
.canadian-crude-reserves-infographic-actions { margin: 0 0 28px 0; }
.canadian-crude-reserves-infographic-actions button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.canadian-crude-reserves-infographic-actions button:hover { background: #404040; }
.canadian-crude-reserves-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 24px;
    box-sizing: border-box;
}
.canadian-crude-reserves-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
}
.canadian-crude-reserves-chart { width: 100%; position: relative; min-height: 0; }
.canadian-crude-reserves-legend {
    display: flex;
    justify-content: center;
    margin: 20px 0;
    font-family: 'Noto Sans', sans-serif;
}
.canadian-crude-reserves-legend-inner { display: flex; flex-wrap: wrap; gap: 15px 40px; justify-content: center; }
.canadian-crude-reserves-legend-item { display: flex; align-items: center; gap: 10px; }
.canadian-crude-reserves-legend-swatch-bar { width: 22px; height: 14px; background-color: ${BAR_COLOR}; }
.canadian-crude-reserves-legend-line {
    width: 28px; height: 0; border-top: 3px solid ${LINE_COLOR}; position: relative;
}
.canadian-crude-reserves-legend-line::after {
    content: ''; position: absolute; width: 8px; height: 8px;
    background: ${LINE_COLOR}; left: 10px; top: -5px;
}
.canadian-crude-reserves-legend-label { font-size: 18px; color: var(--gc-text); }
.canadian-crude-reserves-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.canadian-crude-reserves-table-wrapper details > summary {
    display: block; width: 100%; padding: 12px 15px;
    background-color: #8C8C8C; border: 1px solid #404040; border-radius: 4px;
    cursor: pointer; font-family: Arial, sans-serif; font-weight: bold; color: #ffffff; list-style: none;
}
.canadian-crude-reserves-table-wrapper details > summary::-webkit-details-marker { display: none; }
.canadian-crude-reserves-table-wrapper details > summary:hover { background-color: #404040; }
.canadian-crude-reserves-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.canadian-crude-reserves-table-scrollbar > div { height: 20px; }
.canadian-crude-reserves-table-responsive {
    display: block; width: 100%; overflow-x: auto; border: 1px solid #ddd; background: #fff; margin-top: 10px;
    scrollbar-width: none; -ms-overflow-style: none;
}
.canadian-crude-reserves-table-responsive::-webkit-scrollbar { display: none; }
.canadian-crude-reserves-table-responsive table { width: max-content !important; min-width: 100%; border-collapse: collapse; }
.canadian-crude-reserves-table-responsive th, .canadian-crude-reserves-table-responsive td {
    white-space: nowrap; padding: 8px 12px; font-family: Arial, sans-serif; color: var(--gc-text); border: 1px solid #ddd;
}
.canadian-crude-reserves-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.canadian-crude-reserves-download-buttons button {
    padding: 8px 16px; border: 1px solid #404040; border-radius: 4px;
    background: #8C8C8C; cursor: pointer; font-family: Arial, sans-serif; font-weight: bold; color: #ffffff;
}
.canadian-crude-reserves-download-buttons button:hover { background: #404040; }
.canadian-crude-reserves-footnotes {
    font-family: var(--font-body); font-size: 1rem; color: var(--gc-text);
    margin-top: 24px; padding-top: 12px; border-top: 1px solid #e0e0e0; line-height: 1.65;
}
.canadian-crude-reserves-footnotes h2 {
    font-family: var(--font-heading); font-size: 1.4rem; font-weight: 700; margin: 0 0 1rem 0;
}
.canadian-crude-reserves-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
@media (max-width: 768px) {
    .canadian-crude-reserves-title { font-size: 37px; }
    .canadian-crude-reserves-section-title, .canadian-crude-reserves-chart-title { font-size: 26px; }
    .canadian-crude-reserves-units { font-size: 18px; }
}
            `}</style>

            <div className="canadian-crude-reserves-inner">
                <h1 id="canadian-crude-reserves-title" className="canadian-crude-reserves-title">{getText('petroleum_reserves_title', lang)}</h1>

                <h2 id="canadian-crude-reserves-infographic-title" className="canadian-crude-reserves-section-title">
                    {getText('petroleum_reserves_infographic_title', lang)}
                    <span id="fn-asterisk-rf-canadian-crude-reserves" style={{ verticalAlign: 'super', fontSize: '0.75em', lineHeight: '0' }}>
                        <a className="fn-lnk" href="#fn-asterisk-canadian-crude-reserves" onClick={scrollToElement('fn-asterisk-canadian-crude-reserves')}>
                            <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                            <span aria-hidden="true">*</span>
                        </a>
                    </span>
                </h2>
                <p className="canadian-crude-reserves-units">{substitute(getText('petroleum_reserves_infographic_units', lang), textVars)}</p>

                <CanadianCrudeReservesInfographic
                    figureRef={infographicFigureRef}
                    lang={lang}
                    overlayValues={reserves}
                    formatReserve={formatReserve}
                    getText={getText}
                    onFootnoteClick={scrollToElement}
                    ariaLabel={getText('petroleum_reserves_bg_alt', lang)}
                />

                <div className="canadian-crude-reserves-infographic-actions">
                    <button type="button" onClick={downloadInfographicPng}>{getText('petroleum_reserves_download_png', lang)}</button>
                </div>

                <div className="canadian-crude-reserves-chart-frame">
                    <h2 id="canadian-crude-reserves-chart-title" className="canadian-crude-reserves-chart-title">{chartTitle}</h2>

                    <div className="canadian-crude-reserves-chart-block">
                        <div role="region" aria-label={getText('petroleum_reserves_chart_aria', lang)} tabIndex="0">
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
                            <figure ref={chartRef} className="canadian-crude-reserves-chart" style={{ margin: 0 }}>
                                <div aria-hidden="true">
                                    <Plot
                                        data={[
                                            {
                                                name: legendBars,
                                                x: years,
                                                y: counts,
                                                type: 'bar',
                                                marker: { color: BAR_COLOR, opacity: barMarkerOpacity },
                                                hovertemplate: countHoverTemplates,
                                            },
                                            {
                                                name: legendLine,
                                                x: years,
                                                y: depths,
                                                type: 'scatter',
                                                mode: 'lines+markers',
                                                line: { color: LINE_COLOR, width: 3, opacity: lineStrokeOpacity },
                                                marker: { color: LINE_COLOR, size: 6, opacity: lineMarkerOpacity },
                                                yaxis: 'y2',
                                                hovertemplate: depthHoverTemplates,
                                            },
                                        ]}
                                        layout={{
                                            autosize: true,
                                            hoverlabel: {
                                                bgcolor: '#ffffff',
                                                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
                                            },
                                            hovermode: 'closest',
                                            clickmode: 'event',
                                            dragmode: false,
                                            bargap: 0.2,
                                            margin: {
                                                l: windowWidth <= 480 ? 52 : 64,
                                                r: windowWidth <= 480 ? 52 : 64,
                                                t: plotTopMargin,
                                                b: plotBottomMargin,
                                            },
                                            paper_bgcolor: 'rgba(0,0,0,0)',
                                            plot_bgcolor: 'rgba(0,0,0,0)',
                                            showlegend: false,
                                            xaxis: {
                                                title: {
                                                    text: getText('petroleum_employment_table_col_year', lang),
                                                    font: axisTitleFont,
                                                    standoff: 8,
                                                },
                                                tickmode: 'linear',
                                                dtick: 2,
                                                tickfont: tickFont,
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                range: [startYear - 1, endYear + 1],
                                                automargin: true,
                                            },
                                            yaxis: {
                                                title: { text: yCount, font: axisTitleFont, standoff: 8 },
                                                range: [0, yCountMax * 1.1],
                                                tick0: 0,
                                                dtick: 2000,
                                                tickfont: tickFont,
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                side: 'left',
                                                automargin: true,
                                            },
                                            yaxis2: {
                                                title: { text: yDepth, font: axisTitleFont, standoff: 8 },
                                                range: [0, yDepthMax * 1.1],
                                                tick0: 0,
                                                dtick: 500,
                                                tickfont: tickFont,
                                                overlaying: 'y',
                                                side: 'right',
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                automargin: true,
                                            },
                                        }}
                                        config={{
                                            displayModeBar: true,
                                            displaylogo: false,
                                            responsive: true,
                                            scrollZoom: false,
                                            modeBarButtonsToRemove: [
                                                'toImage', 'select2d', 'lasso2d', 'zoom2d', 'pan2d',
                                                'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d',
                                            ],
                                            modeBarButtonsToAdd: [
                                                {
                                                    name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
                                                    icon: {
                                                        width: 24, height: 24,
                                                        path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z',
                                                    },
                                                    click: (gd) => downloadChartWithTitle(gd),
                                                },
                                            ],
                                        }}
                                        style={{ width: '100%', height: `${chartHeight}px` }}
                                        useResizeHandler
                                        onClick={(data) => {
                                            if (!data.points?.length) return;
                                            const clickedPoint = data.points[0];
                                            const traceIndex = clickedPoint.curveNumber;
                                            const pointIndex = clickedPoint.pointIndex;
                                            if (traceIndex === undefined || pointIndex === undefined) return;

                                            if (windowWidth <= 768) {
                                                const currentTime = Date.now();
                                                const lastClick = lastClickRef.current;
                                                const isSamePoint =
                                                    traceIndex === lastClick.traceIndex && pointIndex === lastClick.pointIndex;
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
                                                        idx === traceIndex
                                                            ? tracePoints.filter((p) => p !== pointIndex)
                                                            : [...tracePoints],
                                                    );
                                                    return next.every((arr) => arr.length === 0) ? null : next;
                                                }
                                                return prev.map((tracePoints, idx) =>
                                                    idx === traceIndex ? [...tracePoints, pointIndex] : [...tracePoints],
                                                );
                                            });
                                        }}
                                    />
                                </div>
                            </figure>
                        </div>

                        <div className="canadian-crude-reserves-legend" aria-hidden="true">
                            <div className="canadian-crude-reserves-legend-inner">
                                <div className="canadian-crude-reserves-legend-item">
                                    <span className="canadian-crude-reserves-legend-swatch-bar" />
                                    <span className="canadian-crude-reserves-legend-label">{legendBars}</span>
                                </div>
                                <div className="canadian-crude-reserves-legend-item">
                                    <span className="canadian-crude-reserves-legend-line" />
                                    <span className="canadian-crude-reserves-legend-label">{legendLine}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="canadian-crude-reserves-table-wrapper">
                        <details onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                {getText('petroleum_reserves_table_summary', lang)}
                                <span className="wb-inv">
                                    {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                </span>
                            </summary>
                            <div ref={topScrollRef} className="canadian-crude-reserves-table-scrollbar" aria-hidden="true"><div /></div>
                            <div
                                ref={tableScrollRef}
                                className="canadian-crude-reserves-table-responsive"
                                role="region"
                                aria-label={getText('petroleum_reserves_table_summary', lang)}
                                tabIndex="0"
                            >
                                <table className="table table-bordered table-striped table-hover">
                                    <caption className="wb-inv">{substitute(getText('petroleum_reserves_table_caption', lang), textVars)}</caption>
                                    <thead>
                                        <tr>
                                            <th scope="col" style={{ fontWeight: 'bold', textAlign: 'center' }}>
                                                {getText('petroleum_employment_table_col_year', lang)}
                                            </th>
                                            <th scope="col" style={{ fontWeight: 'bold', textAlign: 'center' }}>
                                                {getText('petroleum_reserves_table_col_count', lang)}
                                            </th>
                                            <th scope="col" style={{ fontWeight: 'bold', textAlign: 'center' }}>
                                                {getText('petroleum_reserves_table_col_depth', lang)}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {chartTableRows.map((d) => (
                                            <tr key={d.year}>
                                                <td style={{ textAlign: 'center' }}>{d.year}</td>
                                                <td style={{ textAlign: 'center' }}>{formatInt(d.wellsCompleted)}</td>
                                                <td style={{ textAlign: 'center' }}>{formatInt(d.avgDepthM)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div ref={bottomScrollRef} className="canadian-crude-reserves-table-scrollbar" aria-hidden="true"><div /></div>
                            <div className="canadian-crude-reserves-download-buttons">
                                <button type="button" onClick={downloadTableAsCSV}>{getText('petroleum_reserves_download_csv', lang)}</button>
                                <button type="button" onClick={downloadTableAsDocx}>{getText('petroleum_reserves_download_docx', lang)}</button>
                            </div>
                        </details>
                    </div>
                </div>

                <aside className="wb-fnote canadian-crude-reserves-footnotes" role="note">
                    <h2 id="fn-canadian-crude-reserves">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</dt>
                        <dd id="fn-asterisk-canadian-crude-reserves">
                            <a
                                href="#fn-asterisk-rf-canadian-crude-reserves"
                                onClick={scrollToElement('fn-asterisk-rf-canadian-crude-reserves')}
                                className="fn-num"
                                title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}
                            >
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                            </a>
                            {' '}{getText('petroleum_reserves_footnote_asterisk', lang)}
                        </dd>
                        <dd id="fn-dagger-canadian-crude-reserves">
                            <a
                                href="#fn-dagger-rf-canadian-crude-reserves-infographic"
                                onClick={scrollToElement('fn-dagger-rf-canadian-crude-reserves-infographic')}
                                className="fn-num"
                                title={lang === 'en' ? 'Return to footnote ** referrer' : 'Retour à la référence de la note de bas de page **'}
                            >
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>**
                            </a>
                            {' '}{getText('petroleum_reserves_footnote_dagger', lang)}
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default CanadianCrudeReserves;
