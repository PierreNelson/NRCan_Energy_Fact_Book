import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getPage96Data } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import page96Bg from '../assets/page96_bg.png';

const COLORS = {
    bars: '#3D7A42',
    line: '#7D962C',
};

const PAGE96_VERTICAL_TICK_ZOOM = 2.85;

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const Page96 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [viewportZoom, setViewportZoom] = useState(() => {
        if (typeof window === 'undefined') {
            return { pinScale: 1, layoutRatio: 1, cssZoomFactor: 1, dprZoomFactor: 1, screenZoomHint: 1 };
        }
        const inner = window.innerWidth;
        const outer = window.outerWidth;
        const vv = window.visualViewport;
        let pinScale = 1;
        let layoutRatio = 1;
        if (vv) {
            pinScale = vv.scale || 1;
            const w = vv.width || inner;
            layoutRatio = w > 0 ? inner / w : 1;
        }
        const sw = window.screen?.availWidth ?? window.screen?.width ?? 0;
        let screenZoomHint = 1;
        if (sw > 0 && outer >= sw - 24 && inner > 0) {
            const ratio = sw / inner;
            if (ratio >= 1.75) screenZoomHint = Math.min(ratio, 10);
        }
        return { pinScale, layoutRatio, cssZoomFactor: 1, dprZoomFactor: 1, screenZoomHint };
    });
    const [isTableOpen, setIsTableOpen] = useState(false);
    /** null = no focus; [bar point indices, line point indices] */
    const [selectedPoints, setSelectedPoints] = useState(null);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
    const zoomBaselineRef = useRef(null);
    const tableTopRef = useRef(null);
    const tableScrollRef = useRef(null);
    const tableBottomRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    const formatNumber = (num, digits = 0) => {
        if (num === undefined || num === null || Number.isNaN(Number(num))) return '\u2014';
        return Number(num).toLocaleString(locale, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        });
    };

    const formatPct = (num) => {
        if (num === undefined || num === null || Number.isNaN(Number(num))) return '\u2014';
        const formatted = Number(num).toLocaleString(locale, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
        });
        return lang === 'fr' ? `${formatted} %` : `${formatted}%`;
    };

    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    useEffect(() => {
        getPage96Data()
            .then(setResult)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const syncZoom = () => {
            const inner = window.innerWidth;
            const outer = window.outerWidth;
            const dpr = window.devicePixelRatio || 1;
            if (zoomBaselineRef.current == null) {
                zoomBaselineRef.current = { outer, inner, dpr };
            } else {
                const b0 = zoomBaselineRef.current;
                if (Math.abs(outer - b0.outer) > 64) {
                    zoomBaselineRef.current = { outer, inner, dpr };
                }
            }
            const b = zoomBaselineRef.current;
            const outerStable = b && Math.abs(outer - b.outer) <= 64;
            let cssZoomFactor = 1;
            if (b && inner > 0 && b.inner > 0 && outerStable) {
                cssZoomFactor = Math.max(b.inner / inner, inner / b.inner);
            }
            let dprZoomFactor = 1;
            if (b && b.dpr > 0 && outerStable) {
                dprZoomFactor = Math.max(b.dpr / dpr, dpr / b.dpr);
            }
            const sw = window.screen?.availWidth ?? window.screen?.width ?? 0;
            let screenZoomHint = 1;
            if (sw > 0 && outer >= sw - 24 && inner > 0) {
                const ratio = sw / inner;
                if (ratio >= 1.75) screenZoomHint = Math.min(ratio, 10);
            }
            const vv = window.visualViewport;
            let pinScale = 1;
            let layoutRatio = 1;
            if (vv) {
                pinScale = vv.scale || 1;
                const w = vv.width || inner;
                layoutRatio = w > 0 ? inner / w : 1;
            }
            setViewportZoom({ pinScale, layoutRatio, cssZoomFactor, dprZoomFactor, screenZoomHint });
        };
        const rafId = requestAnimationFrame(syncZoom);
        const vv = typeof window !== 'undefined' ? window.visualViewport : null;
        if (vv) {
            vv.addEventListener('resize', syncZoom);
            vv.addEventListener('scroll', syncZoom);
        }
        window.addEventListener('resize', syncZoom);
        return () => {
            cancelAnimationFrame(rafId);
            if (vv) {
                vv.removeEventListener('resize', syncZoom);
                vv.removeEventListener('scroll', syncZoom);
            }
            window.removeEventListener('resize', syncZoom);
        };
    }, []);

    const syncTableScroll = useCallback(() => {
        const topScroll = tableTopRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = tableBottomRef.current;
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
        const topScroll = tableTopRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = tableBottomRef.current;
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
        const table = tableScroll.querySelector('table');
        if (table) observer.observe(table);
        observer.observe(tableScroll);
        sync();
        return () => {
            topScroll.removeEventListener('scroll', handleTopScroll);
            tableScroll.removeEventListener('scroll', handleTableScroll);
            bottomScroll.removeEventListener('scroll', handleBottomScroll);
            observer.disconnect();
        };
    }, [isTableOpen, syncTableScroll, windowWidth]);

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
    }, [lang, selectedPoints, result]);

    const chartRows = useMemo(() => result?.data ?? [], [result]);
    const tableRows = useMemo(
        () => [...chartRows].sort((a, b) => b.year - a.year),
        [chartRows],
    );
    const years = chartRows.map((row) => row.year);
    const barValues = chartRows.map((row) => row.evRegsThousands);
    const lineValues = chartRows.map((row) => row.sharePct);

    const textVars = {
        startYear: result?.chartStartYear ?? 2011,
        endYear: result?.chartEndYear ?? 2024,
        year: result?.referenceYear ?? 2024,
        share: result?.referenceRow
            ? Number(result.referenceRow.sharePct).toLocaleString(locale, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
              })
            : '',
        evCount: result?.referenceRow ? formatNumber(result.referenceRow.evRegs) : '',
        multiplier: result?.multiplier ?? 14,
    };

    const barsLabel = getText('page96_legend_bars', lang);
    const lineLabel = getText('page96_legend_line', lang);
    const chartTitle = substitute(getText('page96_chart_title', lang), textVars);
    const chartDownloadSlug = substitute(getText('page96_download_title', lang), textVars)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    const tableHeaders = [
        getText('page96_table_col_year', lang),
        getText('page96_table_col_total', lang),
        getText('page96_table_col_ev', lang),
        getText('page96_table_col_ev_thousands', lang),
        getText('page96_table_col_share', lang),
    ];

    const zoomEffective = Math.max(
        viewportZoom.pinScale,
        viewportZoom.layoutRatio,
        viewportZoom.cssZoomFactor,
        viewportZoom.dprZoomFactor,
        viewportZoom.screenZoomHint,
    );
    const useVerticalYearTicks = zoomEffective >= PAGE96_VERTICAL_TICK_ZOOM || windowWidth <= 480;
    const tickFontBaseSize = windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15;
    const tickFont = { size: tickFontBaseSize, family: 'Arial, sans-serif' };
    const plotBottomMargin = useVerticalYearTicks
        ? windowWidth <= 480
            ? 88
            : windowWidth <= 768
              ? 78
              : 68
        : windowWidth <= 480
          ? 62
          : 50;
    const plotTopMargin = windowWidth <= 480 ? 56 : 48;
    const plotHeight = windowWidth <= 480 ? 320 : windowWidth <= 768 ? 360 : 400;

    const barPointOpacity = (index) => {
        if (selectedPoints === null) return 1;
        if (selectedPoints[0].length === 0) return 0.3;
        return selectedPoints[0].includes(index) ? 1 : 0.3;
    };

    const linePointOpacity = (index) => {
        if (selectedPoints === null) return 1;
        if (selectedPoints[1].length === 0) return 0.3;
        return selectedPoints[1].includes(index) ? 1 : 0.3;
    };

    const lineStrokeFocused =
        selectedPoints === null || selectedPoints[1].length > 0 || selectedPoints[0].length === 0;

    const barHoverTemplates = years.map(
        (y, i) =>
            `<b>${barsLabel}</b><br>${y}: ${formatNumber(barValues[i])}<br><b>${lineLabel}</b>: ${formatPct(lineValues[i])}<extra></extra>`,
    );
    const lineHoverTemplates = years.map(
        (y, i) =>
            `<b>${lineLabel}</b><br>${y}: ${formatPct(lineValues[i])}<br><b>${barsLabel}</b>: ${formatNumber(barValues[i])}<extra></extra>`,
    );

    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        const title = stripHtml(chartTitle);
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
                ctx.font = 'bold 36px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, canvas.width / 2, 48);
                ctx.drawImage(img, 0, titleHeight);
                const legendY = titleHeight + img.height + 36;
                const legendItems = [
                    { color: COLORS.bars, label: barsLabel, type: 'box' },
                    { color: COLORS.line, label: lineLabel, type: 'line' },
                ];
                ctx.font = '24px Arial';
                ctx.textAlign = 'left';
                const totalLegendWidth =
                    legendItems.reduce((acc, item) => acc + ctx.measureText(item.label).width + 56, 0) + 40;
                let x = (canvas.width - totalLegendWidth) / 2;
                legendItems.forEach((item) => {
                    ctx.fillStyle = item.color;
                    if (item.type === 'box') {
                        ctx.fillRect(x, legendY - 14, 24, 24);
                    } else {
                        ctx.fillRect(x, legendY - 4, 24, 4);
                    }
                    ctx.fillStyle = '#333333';
                    ctx.fillText(item.label, x + 36, legendY + 6);
                    x += 36 + ctx.measureText(item.label).width + 40;
                });
                canvas.toBlob((blob) => {
                    if (blob) saveAs(blob, `${chartDownloadSlug}.png`);
                });
            };
            img.src = imgData;
        } catch {
            /* ignore export errors */
        }
    };

    const downloadChartCsv = () => {
        const header = tableHeaders.map(csvEscape).join(',');
        const rows = tableRows.map((row) =>
            [
                row.year,
                row.totalRegs,
                row.evRegs,
                row.evRegsThousands,
                row.sharePct,
            ]
                .map(csvEscape)
                .join(','),
        );
        const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${chartDownloadSlug}.csv`);
    };

    const downloadChartDocx = async () => {
        const headerRow = new TableRow({
            children: tableHeaders.map(
                (header) =>
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 18 })] })],
                        shading: { fill: 'E6E6E6' },
                    }),
            ),
        });
        const dataRows = tableRows.map(
            (row) =>
                new TableRow({
                    children: [
                        row.year,
                        formatNumber(row.totalRegs),
                        formatNumber(row.evRegs),
                        formatNumber(row.evRegsThousands),
                        formatPct(row.sharePct),
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
                                    text: substitute(getText('page96_table_caption', lang), textVars),
                                    bold: true,
                                    size: 28,
                                }),
                            ],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [900, 2200, 2200, 2200, 2600],
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
        let seriesIndex = event.points[0].curveNumber;
        const pointIndex = event.points[0].pointIndex;
        if (seriesIndex === 2) seriesIndex = 0;
        if (seriesIndex !== 0 && seriesIndex !== 1) return;

        if (windowWidth <= 768) {
            const currentTime = Date.now();
            const lastClick = lastClickRef.current;
            const isSamePoint =
                seriesIndex === lastClick.traceIndex && pointIndex === lastClick.pointIndex;
            const isDoubleTap = isSamePoint && currentTime - lastClick.time < 300;
            lastClickRef.current = { time: currentTime, traceIndex: seriesIndex, pointIndex };
            if (!isDoubleTap) return;
        }

        setSelectedPoints((prev) => {
            if (prev === null) {
                const next = [[], []];
                next[seriesIndex] = [pointIndex];
                return next;
            }
            const next = [prev[0] ? [...prev[0]] : [], prev[1] ? [...prev[1]] : []];
            const current = next[seriesIndex];
            if (current.includes(pointIndex)) {
                next[seriesIndex] = current.filter((i) => i !== pointIndex);
            } else {
                next[seriesIndex] = [...current, pointIndex];
            }
            if (next[0].length === 0 && next[1].length === 0) return null;
            return next;
        });
    };

    if (loading) {
        return <p>{lang === 'en' ? 'Loading...' : 'Chargement...'}</p>;
    }
    if (error) {
        return (
            <p>
                {lang === 'en' ? 'Error: ' : 'Erreur : '}
                {error}
            </p>
        );
    }
    if (!chartRows.length) {
        return <p>{getText('page96_no_data', lang)}</p>;
    }

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-96 page96-ev-sales"
            role="main"
            aria-labelledby="page96-chart-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-96.page96-ev-sales {
    max-width: none !important;
    overflow-x: visible !important;
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.page96-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.page96-bullets {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: var(--gc-text);
    line-height: 1.45;
    margin: 0 0 20px 0;
    padding-left: 1.35rem;
}
.page96-bullets li { margin-bottom: 10px; }
.page96-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 0;
    box-sizing: border-box;
    overflow: visible;
}
.page96-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 5px 0;
}
.page96-chart-figure { margin: 0; position: relative; }
.page96-chart {
    width: 100%;
    min-width: 0;
    height: ${plotHeight}px;
    position: relative;
}
.page96-chart > div { width: 100%; height: 100%; }
.page96-legend {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 28px;
    margin-top: 12px;
    font-family: Arial, sans-serif;
    font-size: 15px;
    color: var(--gc-text);
}
.page96-legend-item { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.page96-legend-box { width: 18px; height: 18px; display: inline-block; border-radius: 2px; }
.page96-legend-line { width: 28px; height: 4px; display: inline-block; border-radius: 2px; }
.page96-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.page96-table-wrapper details > summary {
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
.page96-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page96-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page96-table-scrollbar > div { height: 20px; }
.page96-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #ddd;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.page96-table-responsive::-webkit-scrollbar { display: none; }
.page96-table-responsive table { width: max-content !important; min-width: 100%; border-collapse: collapse; }
.page96-table-responsive table.table {
    font-family: var(--font-body);
    color: var(--gc-text);
}
.page96-table-responsive th, .page96-table-responsive td {
    white-space: nowrap;
    padding: 8px 12px;
    font-family: var(--font-body);
    color: var(--gc-text);
    border: 1px solid #ddd;
}
.page96-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.page96-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.page96-table-wrapper summary:hover, .page96-download-buttons button:hover { background-color: #404040 !important; }
@media (max-width: 768px) {
    .page96-bullets { font-size: 18px; }
    .page96-chart-title { font-size: 26px; }
}
            `}</style>

            <div className="page96-inner">
                <ul className="page96-bullets">
                    <li>
                        {substitute(getText('page96_bullet1_prefix', lang), textVars)}
                        <strong>{substitute(getText('page96_bullet1_bold', lang), textVars)}</strong>
                    </li>
                    <li>
                        {lang === 'fr' ? (
                            <>
                                <strong>
                                    {substitute(getText('page96_bullet2_bold1', lang), textVars)}
                                    {substitute(getText('page96_bullet2_mid', lang), textVars)}
                                </strong>
                                {substitute(getText('page96_bullet2_suffix', lang), textVars)}
                            </>
                        ) : (
                            <>
                                <strong>{substitute(getText('page96_bullet2_bold1', lang), textVars)}</strong>
                                {getText('page96_bullet2_mid', lang)}
                                <strong>{getText('page96_bullet2_bold2', lang)}</strong>
                                {substitute(getText('page96_bullet2_suffix', lang), textVars)}
                            </>
                        )}
                    </li>
                </ul>

                <div className="page96-chart-frame">
                    <h2 id="page96-chart-title" className="page96-chart-title">
                        {chartTitle}
                    </h2>

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

                    <figure ref={chartRef} className="page96-chart-figure">
                        <div
                            role="region"
                            aria-label={substitute(getText('page96_chart_aria', lang), textVars)}
                            tabIndex="0"
                        >
                            <Plot
                                key={`page96-${selectedPoints ? `${selectedPoints[0].join('-')}_${selectedPoints[1].join('-')}` : 'all'}-${useVerticalYearTicks ? 'v' : 'h'}-${plotHeight}`}
                                data={[
                                    {
                                        x: years,
                                        y: barValues,
                                        type: 'bar',
                                        name: barsLabel,
                                        marker: {
                                            color: COLORS.bars,
                                            opacity: years.map((_, i) => barPointOpacity(i)),
                                        },
                                        hovertemplate: barHoverTemplates,
                                        hoveron: 'points+fills',
                                        yaxis: 'y',
                                    },
                                    {
                                        x: years,
                                        y: lineValues,
                                        type: 'scatter',
                                        mode: 'lines+markers',
                                        name: lineLabel,
                                        line: {
                                            color: lineStrokeFocused ? COLORS.line : 'rgba(164, 198, 57, 0.3)',
                                            width: 3,
                                        },
                                        marker: {
                                            color: COLORS.line,
                                            size: 12,
                                            opacity: years.map((_, i) => linePointOpacity(i)),
                                        },
                                        hovertemplate: lineHoverTemplates,
                                        hoveron: 'points',
                                        yaxis: 'y2',
                                    },
                                    {
                                        x: years,
                                        y: barValues,
                                        type: 'scatter',
                                        mode: 'markers',
                                        name: barsLabel,
                                        marker: {
                                            size: 22,
                                            color: COLORS.bars,
                                            opacity: 0,
                                        },
                                        hoverinfo: 'skip',
                                        yaxis: 'y',
                                    },
                                ]}
                                layout={{
                                    showlegend: false,
                                    clickmode: 'event',
                                    dragmode: false,
                                    hovermode: 'closest',
                                    margin: { l: 72, r: 72, t: plotTopMargin, b: plotBottomMargin },
                                    paper_bgcolor: 'rgba(0,0,0,0)',
                                    plot_bgcolor: 'rgba(0,0,0,0)',
                                    images: [
                                        {
                                            source: page96Bg,
                                            xref: 'paper',
                                            yref: 'paper',
                                            x: 0.5,
                                            y: 0.52,
                                            sizex: 0.92,
                                            sizey: 0.72,
                                            xanchor: 'center',
                                            yanchor: 'middle',
                                            layer: 'below',
                                            sizing: 'contain',
                                            opacity: 0.35,
                                        },
                                    ],
                                    annotations: years.map((year, i) => ({
                                        x: year,
                                        y: barValues[i],
                                        text: `<b>${barValues[i]}</b>`,
                                        showarrow: false,
                                        yanchor: 'bottom',
                                        yshift: 10,
                                        xref: 'x',
                                        yref: 'y',
                                        font: {
                                            family: 'Arial Black, Arial, sans-serif',
                                            size: tickFontBaseSize,
                                            color: '#333333',
                                        },
                                        opacity: barPointOpacity(i),
                                    })),
                                    xaxis: {
                                        type: 'linear',
                                        tickmode: 'array',
                                        tickvals: years,
                                        ticktext: years.map(String),
                                        tickangle: useVerticalYearTicks ? 90 : 0,
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
                                            text: `<b>${getText('page96_yaxis_left', lang)}</b>`,
                                            font: { size: 15, family: 'Arial, sans-serif', color: '#333' },
                                        },
                                        range: [0, 300],
                                        dtick: 50,
                                        side: 'left',
                                        showgrid: false,
                                        zeroline: false,
                                        tickfont: tickFont,
                                    },
                                    yaxis2: {
                                        range: [0, 16],
                                        dtick: 2,
                                        ticksuffix: lang === 'fr' ? ' %' : '%',
                                        side: 'right',
                                        overlaying: 'y',
                                        showgrid: false,
                                        zeroline: false,
                                        showticklabels: true,
                                        tickfont: tickFont,
                                    },
                                    hoverlabel: {
                                        bgcolor: '#ffffff',
                                        bordercolor: '#333333',
                                        font: { color: '#333333', family: 'Arial, sans-serif' },
                                    },
                                    font: { family: 'Arial, sans-serif' },
                                }}
                                config={{
                                    displayModeBar: true,
                                    displaylogo: false,
                                    responsive: true,
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
                                            name: getText('page96_download_chart', lang),
                                            icon: {
                                                width: 24,
                                                height: 24,
                                                path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z',
                                            },
                                            click: () => downloadChartWithTitle(),
                                        },
                                    ],
                                }}
                                onClick={handleChartClick}
                                className="page96-chart"
                                useResizeHandler
                                style={{ width: '100%', height: `${plotHeight}px` }}
                            />
                        </div>
                    </figure>

                    <div className="page96-legend" aria-hidden="true">
                        <div className="page96-legend-item">
                            <span className="page96-legend-box" style={{ backgroundColor: COLORS.bars }} />
                            <span>{barsLabel}</span>
                        </div>
                        <div className="page96-legend-item">
                            <span className="page96-legend-line" style={{ backgroundColor: COLORS.line }} />
                            <span>{lineLabel}</span>
                        </div>
                    </div>

                    <div className="page96-table-wrapper">
                        <details className="page96-data-table" onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>
                                    {isTableOpen ? '▼' : '▶'}
                                </span>
                                {getText('page96_table_summary', lang)}
                                <span className="wb-inv">
                                    {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                </span>
                            </summary>
                            <div ref={tableTopRef} className="page96-table-scrollbar" aria-hidden="true">
                                <div />
                            </div>
                            <div
                                ref={tableScrollRef}
                                className="page96-table-responsive"
                                role="region"
                                aria-labelledby="page96-table-caption"
                                tabIndex={0}
                            >
                                <table className="table table-striped table-hover">
                                    <caption id="page96-table-caption" className="wb-inv">
                                        {substitute(getText('page96_table_caption', lang), textVars)}
                                    </caption>
                                    <thead>
                                        <tr>
                                            {tableHeaders.map((header) => (
                                                <th key={header} scope="col">
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableRows.map((row) => (
                                            <tr key={row.year}>
                                                <th scope="row">{row.year}</th>
                                                <td style={{ textAlign: 'right' }} aria-label={`${row.year}, ${tableHeaders[1]}: ${formatNumber(row.totalRegs)}`}>
                                                    {formatNumber(row.totalRegs)}
                                                </td>
                                                <td style={{ textAlign: 'right' }} aria-label={`${row.year}, ${tableHeaders[2]}: ${formatNumber(row.evRegs)}`}>
                                                    {formatNumber(row.evRegs)}
                                                </td>
                                                <td style={{ textAlign: 'right' }} aria-label={`${row.year}, ${tableHeaders[3]}: ${formatNumber(row.evRegsThousands)}`}>
                                                    {formatNumber(row.evRegsThousands)}
                                                </td>
                                                <td style={{ textAlign: 'right' }} aria-label={`${row.year}, ${tableHeaders[4]}: ${formatPct(row.sharePct)}`}>
                                                    {formatPct(row.sharePct)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div ref={tableBottomRef} className="page96-table-scrollbar" aria-hidden="true">
                                <div />
                            </div>
                            <div className="page96-download-buttons">
                                <button type="button" onClick={downloadChartCsv}>
                                    {getText('page96_download_csv', lang)}
                                </button>
                                <button type="button" onClick={downloadChartDocx}>
                                    {getText('page96_download_docx', lang)}
                                </button>
                            </div>
                        </details>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Page96;
