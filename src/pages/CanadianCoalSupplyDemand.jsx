import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import CanadianCoalSupplyDemandInfographic from '../components/CanadianCoalSupplyDemandInfographic';
import {
    exportCanadianCoalSupplyDemandInfographicPng,
    INFOGRAPHIC_DATA,
} from '../components/CanadianCoalSupplyDemandInfographic.constants';

const REFERENCE_YEAR = 2024;

const TRADE_DATA = [
    { year: 2005, exports: 28, imports: 21 },
    { year: 2006, exports: 28, imports: 21 },
    { year: 2007, exports: 31, imports: 18 },
    { year: 2008, exports: 31, imports: 21 },
    { year: 2009, exports: 27, imports: 13 },
    { year: 2010, exports: 33, imports: 9 },
    { year: 2011, exports: 34, imports: 9 },
    { year: 2012, exports: 35, imports: 10 },
    { year: 2013, exports: 39, imports: 9 },
    { year: 2014, exports: 34, imports: 8 },
    { year: 2015, exports: 30, imports: 8 },
    { year: 2016, exports: 30, imports: 6 },
    { year: 2017, exports: 31, imports: 7 },
    { year: 2018, exports: 34, imports: 8 },
    { year: 2019, exports: 37, imports: 8 },
    { year: 2020, exports: 32, imports: 6 },
    { year: 2021, exports: 32, imports: 6 },
    { year: 2022, exports: 36, imports: 5 },
    { year: 2023, exports: 39, imports: 6 },
    { year: 2024, exports: 36, imports: 5 },
    { year: 2025, exports: 37, imports: 5 },
];

const COLORS = {
    exports: '#7D962C',
    imports: '#3B95C9',
};

const STACKED_LAYOUT_BROWSER_ZOOM = 1.1;
const STACKED_LAYOUT_DETECTED_ZOOM = 1.0 + (STACKED_LAYOUT_BROWSER_ZOOM - 1.0) * 0.25;

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    }
    return hex;
};

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const computePageZoomScale = (baseline) => {
    if (typeof window === 'undefined') return { pageCssZoom: 1, baseline: null };

    const inner = window.innerWidth;
    const outer = window.outerWidth;
    const dpr = window.devicePixelRatio || 1;

    let nextBaseline = baseline;
    if (!nextBaseline) {
        nextBaseline = { outer, inner, dpr };
    } else if (Math.abs(outer - nextBaseline.outer) > 64) {
        nextBaseline = { outer, inner, dpr };
    }

    const outerStable = Math.abs(outer - nextBaseline.outer) <= 64;

    let cssZoomFactor = 1;
    if (nextBaseline.inner > 0 && inner > 0 && outerStable) {
        cssZoomFactor = Math.max(nextBaseline.inner / inner, inner / nextBaseline.inner);
    }

    const vv = window.visualViewport;
    const pinScale = vv?.scale || 1;

    let layoutZoom = 1;
    if (vv?.width > 0 && inner > 0) {
        const inferred = inner / vv.width;
        if (inferred > 1.02 && inferred < 8) layoutZoom = inferred;
    }

    const pageCssZoom = Math.max(pinScale, layoutZoom, cssZoomFactor);

    return { pageCssZoom, baseline: nextBaseline };
};

const CanadianCoalSupplyDemand = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [isChartTableOpen, setIsChartTableOpen] = useState(false);
    const [selectedTraceIds, setSelectedTraceIds] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [pageCssZoom, setPageCssZoom] = useState(() => computePageZoomScale(null).pageCssZoom);
    const zoomBaselineRef = useRef(null);

    const chartRef = useRef(null);
    const infographicFigureRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null });
    const chartTableTopRef = useRef(null);
    const chartTableScrollRef = useRef(null);
    const chartTableBottomRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const useStackedLayout = pageCssZoom >= STACKED_LAYOUT_DETECTED_ZOOM;

    const formatMt = useCallback((value, digits = 0) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return `${Number(value).toLocaleString(locale, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        })} Mt`;
    }, [locale]);

    const formatMtPlain = useCallback((value, digits = 0) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        });
    }, [locale]);

    useEffect(() => {
        const syncLayout = () => {
            setWindowWidth(window.innerWidth);
            const { pageCssZoom: nextPageCssZoom, baseline } = computePageZoomScale(zoomBaselineRef.current);
            zoomBaselineRef.current = baseline;
            setPageCssZoom(nextPageCssZoom);
        };
        syncLayout();
        window.addEventListener('resize', syncLayout);
        window.visualViewport?.addEventListener('resize', syncLayout);
        window.visualViewport?.addEventListener('scroll', syncLayout);
        return () => {
            window.removeEventListener('resize', syncLayout);
            window.visualViewport?.removeEventListener('resize', syncLayout);
            window.visualViewport?.removeEventListener('scroll', syncLayout);
        };
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

    const chartTableRows = useMemo(
        () => [...TRADE_DATA].sort((a, b) => b.year - a.year),
        [],
    );

    const startYear = TRADE_DATA[0]?.year ?? 2005;
    const endYear = TRADE_DATA[TRADE_DATA.length - 1]?.year ?? 2025;
    const textVars = { year: REFERENCE_YEAR, startYear, endYear, metallurgicalPct: 82, tradeYear: endYear };

    const years = TRADE_DATA.map((row) => row.year);
    const yearTicks = years.filter((yearValue) => yearValue % 2 === 0);
    const exportValues = TRADE_DATA.map((row) => row.exports);
    const importValues = TRADE_DATA.map((row) => row.imports);
    const latestExports = exportValues[exportValues.length - 1];
    const latestImports = importValues[importValues.length - 1];

    const exportsLabel = getText('canadian_coal_supply_demand_legend_exports', lang);
    const importsLabel = getText('canadian_coal_supply_demand_legend_imports', lang);
    const chartTitle = getText('canadian_coal_supply_demand_chart_title', lang);
    const yAxisTitle = getText('canadian_coal_supply_demand_y_axis', lang);

    const exportsHoverTexts = years.map(
        (yearValue, i) => `<b>${exportsLabel}</b><br>${yearValue}: ${formatMtPlain(exportValues[i])} Mt<extra></extra>`,
    );
    const importsHoverTexts = years.map(
        (yearValue, i) => `<b>${importsLabel}</b><br>${yearValue}: ${formatMtPlain(importValues[i])} Mt<extra></extra>`,
    );

    const exportsFocused = selectedTraceIds === null || selectedTraceIds.includes(0);
    const importsFocused = selectedTraceIds === null || selectedTraceIds.includes(1);

    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };
    const plotHeight = windowWidth <= 480 ? 300 : windowWidth <= 768 ? 340 : 380;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 62 : windowWidth <= 768 ? 56 : 50;

    const fileSlugBase = substitute(getText('canadian_coal_supply_demand_download_title', lang), textVars)
        .replace(/\s+/g, '_')
        .replace(/–/g, '-');
    const infographicPngSlug = substitute(getText('canadian_coal_supply_demand_infographic_png_slug', lang), textVars)
        .replace(/\s+/g, '_');

    const electricityLabel = substitute(getText('canadian_coal_supply_demand_electricity_text', lang), {
        value: formatMtPlain(INFOGRAPHIC_DATA.electricityMt, 1),
    });
    const metallurgicalLabel = getText('canadian_coal_supply_demand_metallurgical_text', lang);

    const chartTableHeaders = [
        getText('canadian_coal_supply_demand_table_col_year', lang),
        getText('canadian_coal_supply_demand_table_col_exports', lang),
        getText('canadian_coal_supply_demand_table_col_imports', lang),
    ];

    const legendExportsText = substitute(getText('canadian_coal_supply_demand_legend_exports_value', lang), {
        value: formatMtPlain(latestExports, 0),
    });
    const legendImportsText = substitute(getText('canadian_coal_supply_demand_legend_imports_value', lang), {
        value: formatMtPlain(latestImports, 0),
    });

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
                    { color: COLORS.exports, label: legendExportsText },
                    { color: COLORS.imports, label: legendImportsText },
                ];
                const totalWidth = legendItems.length * 420;
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
                    x += 420;
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
            [row.year, formatMtPlain(row.exports, 0), formatMtPlain(row.imports, 0)].map(csvEscape).join(','),
        );
        saveAs(new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' }), `${fileSlugBase}.csv`);
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
                        formatMtPlain(row.exports, 0),
                        formatMtPlain(row.imports, 0),
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
                                    text: substitute(getText('canadian_coal_supply_demand_table_caption', lang), textVars),
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
        saveAs(await Packer.toBlob(doc), `${fileSlugBase}.docx`);
    };

    const downloadInfographicPng = async () => {
        const canvas = await exportCanadianCoalSupplyDemandInfographicPng(infographicFigureRef.current, { scale: 3 });
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${infographicPngSlug}.png`);
        });
    };

    const chartSummary = lang === 'en'
        ? `Line chart showing Canadian coal exports and imports from ${startYear} to ${endYear}. Exports in ${endYear} were ${formatMtPlain(latestExports, 0)} million tonnes and imports were ${formatMtPlain(latestImports, 0)} million tonnes.`
        : `Graphique linéaire montrant les exportations et importations canadiennes de charbon de ${startYear} à ${endYear}. Les exportations en ${endYear} étaient de ${formatMtPlain(latestExports, 0)} millions de tonnes et les importations de ${formatMtPlain(latestImports, 0)} millions de tonnes.`;

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content canadian-coal-supply-demand"
            role="main"
            aria-labelledby="canadian-coal-supply-demand-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.canadian-coal-supply-demand {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.canadian-coal-supply-demand-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.canadian-coal-supply-demand.page-content h1.canadian-coal-supply-demand-title {
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
.canadian-coal-supply-demand.page-content h1.canadian-coal-supply-demand-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.canadian-coal-supply-demand-content-row {
    display: flex;
    flex-direction: row;
    width: 100%;
    gap: 28px;
    align-items: flex-start;
}
.canadian-coal-supply-demand-domestic-column {
    width: 38%;
    min-width: 240px;
    box-sizing: border-box;
}
.canadian-coal-supply-demand-trade-column {
    width: 62%;
    min-width: 0;
    box-sizing: border-box;
}
.canadian-coal-supply-demand-section-title {
    font-family: 'Lato', sans-serif;
    font-size: 28px;
    font-weight: bold;
    color: #423330;
    margin: 0 0 16px 0;
    text-transform: none;
}
.canadian-coal-supply-demand-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-sizing: border-box;
    overflow: visible;
}
.canadian-coal-supply-demand-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
}
.canadian-coal-supply-demand-chart-figure { margin: 0; }
.canadian-coal-supply-demand-chart { width: 100%; min-width: 0; height: ${plotHeight}px; position: relative; }
.canadian-coal-supply-demand-chart > div { width: 100%; height: 100%; }
.canadian-coal-supply-demand-legend {
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
.canadian-coal-supply-demand-legend-item { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.canadian-coal-supply-demand-legend-line {
    width: 28px;
    height: 0;
    border-top: 4px solid;
    display: inline-block;
}
.canadian-coal-supply-demand-legend-square {
    width: 18px;
    height: 14px;
    display: inline-block;
    flex-shrink: 0;
}
.canadian-coal-supply-demand-trade-note {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
    margin: 24px 0 0 0;
}
.canadian-coal-supply-demand-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.canadian-coal-supply-demand-infographic-actions { margin: 12px 0 0 0; }
.canadian-coal-supply-demand-infographic-actions button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.canadian-coal-supply-demand-table-wrapper details > summary {
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
.canadian-coal-supply-demand-table-wrapper details > summary::-webkit-details-marker { display: none; }
.canadian-coal-supply-demand-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.canadian-coal-supply-demand-table-scrollbar > div { height: 20px; }
.canadian-coal-supply-demand-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #ddd;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.canadian-coal-supply-demand-table-responsive::-webkit-scrollbar { display: none; }
.canadian-coal-supply-demand-table-responsive table { width: max-content !important; min-width: 100%; border-collapse: collapse; }
.canadian-coal-supply-demand-table-responsive th,
.canadian-coal-supply-demand-table-responsive td {
    white-space: nowrap;
}
.canadian-coal-supply-demand-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.canadian-coal-supply-demand-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.canadian-coal-supply-demand-table-wrapper summary:hover,
.canadian-coal-supply-demand-infographic-actions button:hover,
.canadian-coal-supply-demand-download-buttons button:hover,
.canadian-coal-supply-demand-chart-frame button[type="button"]:hover { background-color: #404040 !important; }
.layout-stacked.canadian-coal-supply-demand-content-row { flex-direction: column !important; }
.layout-stacked .canadian-coal-supply-demand-domestic-column,
.layout-stacked .canadian-coal-supply-demand-trade-column { width: 100% !important; min-width: 0 !important; }
.layout-stacked .canadian-coal-supply-demand-domestic-column { margin-bottom: 28px; }
@media (max-width: 768px) {
    .canadian-coal-supply-demand.page-content h1.canadian-coal-supply-demand-title { font-size: 37px !important; }
    .canadian-coal-supply-demand-section-title { font-size: 24px; }
    .canadian-coal-supply-demand-chart-title { font-size: 26px; }
    .canadian-coal-supply-demand-trade-note { font-size: 18px; }
}
            `}</style>

            <div className="canadian-coal-supply-demand-inner">
                <h1 id="canadian-coal-supply-demand-title" className="canadian-coal-supply-demand-title">
                    {substitute(getText('canadian_coal_supply_demand_section_domestic', lang), textVars)}
                </h1>

                <div className={`canadian-coal-supply-demand-content-row ${useStackedLayout ? 'layout-stacked' : ''}`}>
                    <section className="canadian-coal-supply-demand-domestic-column" aria-labelledby="canadian-coal-supply-demand-title">
                        <CanadianCoalSupplyDemandInfographic
                            lang={lang}
                            useStackedLayout={useStackedLayout}
                            figureRef={infographicFigureRef}
                            formatMt={(value) => formatMt(value, 0)}
                            totalMt={INFOGRAPHIC_DATA.totalMt}
                            electricityLabel={electricityLabel}
                            metallurgicalLabel={metallurgicalLabel}
                            ariaLabel={getText('canadian_coal_supply_demand_bg_alt', lang)}
                        />

                        <div className="canadian-coal-supply-demand-infographic-actions">
                            <button type="button" onClick={downloadInfographicPng}>
                                {getText('canadian_coal_supply_demand_download_png', lang)}
                            </button>
                        </div>
                    </section>

                    <section className="canadian-coal-supply-demand-trade-column" aria-labelledby="canadian-coal-supply-demand-chart-title">
                        <div className="canadian-coal-supply-demand-chart-frame">
                            <h3 id="canadian-coal-supply-demand-chart-title" className="canadian-coal-supply-demand-chart-title">{chartTitle}</h3>

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

                            <figure ref={chartRef} className="canadian-coal-supply-demand-chart-figure">
                                <Plot
                                    key={`canadian-coal-supply-demand-${selectedTraceIds ? selectedTraceIds.join('-') : 'all'}-${plotHeight}`}
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
                                            range: [0, 45],
                                            dtick: 5,
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
                                                name: getText('canadian_coal_supply_demand_download_chart', lang),
                                                icon: {
                                                    width: 24,
                                                    height: 24,
                                                    path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z',
                                                },
                                                click: (gd) => downloadChartPng(gd),
                                            },
                                        ],
                                    }}
                                    className="canadian-coal-supply-demand-chart"
                                    useResizeHandler
                                    onClick={handleChartClick}
                                />
                            </figure>

                            <div className="canadian-coal-supply-demand-legend" aria-hidden="true">
                                <div className="canadian-coal-supply-demand-legend-item">
                                    <span className="canadian-coal-supply-demand-legend-square" style={{ backgroundColor: COLORS.exports }} />
                                    <span>{legendExportsText}</span>
                                </div>
                                <div className="canadian-coal-supply-demand-legend-item">
                                    <span className="canadian-coal-supply-demand-legend-square" style={{ backgroundColor: COLORS.imports }} />
                                    <span>{legendImportsText}</span>
                                </div>
                            </div>

                            <div className="canadian-coal-supply-demand-table-wrapper">
                                <details onToggle={(event) => setIsChartTableOpen(event.currentTarget.open)}>
                                    <summary role="button" aria-expanded={isChartTableOpen}>
                                        <span aria-hidden="true" style={{ marginRight: '8px' }}>{isChartTableOpen ? '▼' : '▶'}</span>
                                        {getText('canadian_coal_supply_demand_table_summary', lang)}
                                        <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                                    </summary>
                                    <div ref={chartTableTopRef} className="canadian-coal-supply-demand-table-scrollbar" aria-hidden="true"><div /></div>
                                    <div
                                        ref={chartTableScrollRef}
                                        className="canadian-coal-supply-demand-table-responsive"
                                        role="region"
                                        aria-label={chartSummary}
                                        tabIndex={0}
                                    >
                                        <table className="table table-bordered table-striped table-hover">
                                            <caption className="wb-inv">
                                                {substitute(getText('canadian_coal_supply_demand_table_caption', lang), textVars)}
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
                                                        <td style={{ textAlign: 'right' }}>{formatMtPlain(row.exports, 0)}</td>
                                                        <td style={{ textAlign: 'right' }}>{formatMtPlain(row.imports, 0)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div ref={chartTableBottomRef} className="canadian-coal-supply-demand-table-scrollbar" aria-hidden="true"><div /></div>
                                    <div className="canadian-coal-supply-demand-download-buttons">
                                        <button type="button" onClick={() => downloadChartPng()}>{getText('canadian_coal_supply_demand_download_chart', lang)}</button>
                                        <button type="button" onClick={downloadChartCsv}>{getText('canadian_coal_supply_demand_download_csv', lang)}</button>
                                        <button type="button" onClick={downloadChartDocx}>{getText('canadian_coal_supply_demand_download_docx', lang)}</button>
                                    </div>
                                </details>
                            </div>
                        </div>

                        <p className="canadian-coal-supply-demand-trade-note">
                            {substitute(getText('canadian_coal_supply_demand_trade_note', lang), textVars)}
                        </p>
                    </section>
                </div>
            </div>
        </main>
    );
};

export default CanadianCoalSupplyDemand;
