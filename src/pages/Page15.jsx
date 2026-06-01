import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';

const PAGE15_CAT_ORDER = [
    'coal',
    'crude',
    'rpp',
    'gas',
    'ngl',
    'uranium',
    'electricity',
    'biofuels',
    'other',
];

/** Fixed download basename: canadas-global-energy-trade-{min}-{max} */
const PAGE15_EXPORT_FILE_BASE = 'canadas-global-energy-trade';

const PAGE15_COLORS = {
    coal: '#6B4423',
    crude: '#2A9BA7',
    rpp: '#1B4F72',
    gas: '#8B1538',
    ngl: '#D87118',
    uranium: '#699933',
    electricity: '#A48A13',
    biofuels: '#D81B60',
    other: '#7f8c8d',
};

const PAGE15_DATA = [
    {
        year: 2017,
        totalExp: 169,
        totalImp: 71,
        exp_coal: 8.45,
        imp_coal: 7.1,
        exp_crude: 81.12,
        imp_crude: 14.2,
        exp_rpp: 25.35,
        imp_rpp: 21.3,
        exp_gas: 16.9,
        imp_gas: 8.52,
        exp_ngl: 11.83,
        imp_ngl: 3.55,
        exp_uranium: 4.225,
        imp_uranium: 0.568,
        exp_electricity: 9.295,
        imp_electricity: 7.1,
        exp_biofuels: 3.38,
        imp_biofuels: 2.84,
        exp_other: 8.45,
        imp_other: 5.822,
    },
    {
        year: 2018,
        totalExp: 171,
        totalImp: 71,
        exp_coal: 8.55,
        imp_coal: 7.1,
        exp_crude: 82.08,
        imp_crude: 14.2,
        exp_rpp: 25.65,
        imp_rpp: 21.3,
        exp_gas: 17.1,
        imp_gas: 8.52,
        exp_ngl: 11.97,
        imp_ngl: 3.55,
        exp_uranium: 4.275,
        imp_uranium: 0.568,
        exp_electricity: 9.405,
        imp_electricity: 7.1,
        exp_biofuels: 3.42,
        imp_biofuels: 2.84,
        exp_other: 8.55,
        imp_other: 5.822,
    },
    {
        year: 2019,
        totalExp: 186,
        totalImp: 69,
        exp_coal: 9.3,
        imp_coal: 6.9,
        exp_crude: 89.28,
        imp_crude: 13.8,
        exp_rpp: 27.9,
        imp_rpp: 20.7,
        exp_gas: 18.6,
        imp_gas: 8.28,
        exp_ngl: 13.02,
        imp_ngl: 3.45,
        exp_uranium: 4.65,
        imp_uranium: 0.552,
        exp_electricity: 10.23,
        imp_electricity: 6.9,
        exp_biofuels: 3.72,
        imp_biofuels: 2.76,
        exp_other: 9.3,
        imp_other: 5.658,
    },
    {
        year: 2020,
        totalExp: 182,
        totalImp: 64,
        exp_coal: 9.1,
        imp_coal: 6.4,
        exp_crude: 87.36,
        imp_crude: 12.8,
        exp_rpp: 27.3,
        imp_rpp: 19.2,
        exp_gas: 18.2,
        imp_gas: 7.68,
        exp_ngl: 12.74,
        imp_ngl: 3.2,
        exp_uranium: 4.55,
        imp_uranium: 0.512,
        exp_electricity: 10.01,
        imp_electricity: 6.4,
        exp_biofuels: 3.64,
        imp_biofuels: 2.56,
        exp_other: 9.1,
        imp_other: 5.248,
    },
    {
        year: 2021,
        totalExp: 191,
        totalImp: 66,
        exp_coal: 9.55,
        imp_coal: 6.6,
        exp_crude: 91.68,
        imp_crude: 13.2,
        exp_rpp: 28.65,
        imp_rpp: 19.8,
        exp_gas: 19.1,
        imp_gas: 7.92,
        exp_ngl: 13.37,
        imp_ngl: 3.3,
        exp_uranium: 4.775,
        imp_uranium: 0.528,
        exp_electricity: 10.505,
        imp_electricity: 6.6,
        exp_biofuels: 3.82,
        imp_biofuels: 2.64,
        exp_other: 9.55,
        imp_other: 5.412,
    },
    {
        year: 2022,
        totalExp: 189,
        totalImp: 57,
        exp_coal: 9.45,
        imp_coal: 5.7,
        exp_crude: 90.72,
        imp_crude: 11.4,
        exp_rpp: 28.35,
        imp_rpp: 17.1,
        exp_gas: 18.9,
        imp_gas: 6.84,
        exp_ngl: 13.23,
        imp_ngl: 2.85,
        exp_uranium: 4.725,
        imp_uranium: 0.456,
        exp_electricity: 10.395,
        imp_electricity: 5.7,
        exp_biofuels: 3.78,
        imp_biofuels: 2.28,
        exp_other: 9.45,
        imp_other: 4.674,
    },
    {
        year: 2023,
        totalExp: 195,
        totalImp: 58,
        exp_coal: 9.75,
        imp_coal: 5.8,
        exp_crude: 93.6,
        imp_crude: 11.6,
        exp_rpp: 29.25,
        imp_rpp: 17.4,
        exp_gas: 19.5,
        imp_gas: 6.96,
        exp_ngl: 13.65,
        imp_ngl: 2.9,
        exp_uranium: 4.875,
        imp_uranium: 0.464,
        exp_electricity: 10.725,
        imp_electricity: 5.8,
        exp_biofuels: 3.9,
        imp_biofuels: 2.32,
        exp_other: 9.75,
        imp_other: 4.756,
    },
    {
        year: 2024,
        totalExp: 208,
        totalImp: 56,
        exp_coal: 10.4,
        imp_coal: 5.6,
        exp_crude: 99.84,
        imp_crude: 11.2,
        exp_rpp: 31.2,
        imp_rpp: 16.8,
        exp_gas: 20.8,
        imp_gas: 6.72,
        exp_ngl: 14.56,
        imp_ngl: 2.8,
        exp_uranium: 5.2,
        imp_uranium: 0.448,
        exp_electricity: 11.44,
        imp_electricity: 5.6,
        exp_biofuels: 4.16,
        imp_biofuels: 2.24,
        exp_other: 10.4,
        imp_other: 4.592,
    },
];

const stripHtml = (text) =>
    text ? String(text).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

const Page15 = () => {
    const { lang } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [selectedSegments, setSelectedSegments] = useState(null);
    const lastClickRef = useRef({ time: 0, curveNumber: null, pointIndex: null });
    const chartRef = useRef(null);
    /** Slot the chart flex column actually occupies — drives Plotly layout.width (fixes overflow when responsive is off). */
    const chartSlotRef = useRef(null);
    const calloutsRef = useRef(null);
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [arrowMetrics, setArrowMetrics] = useState(null);
    /** Measured width of .page15-chart-main (not window.innerWidth — excludes callout column + padding). */
    const [plotSlotWidth, setPlotSlotWidth] = useState(null);
    /** Pinch / mobile visualViewport.scale only (often stays 1 during desktop Ctrl+ zoom). */
    const [viewportScale, setViewportScale] = useState(1);
    /**
     * Zoom factor for layout tweaks: max(visualViewport.scale, inferred desktop zoom).
     * Desktop browser zoom does not raise visualViewport.scale in most browsers; we infer from
     * screen width vs innerWidth when the layout viewport is unusually narrow (not media queries).
     */
    const [effectiveZoom, setEffectiveZoom] = useState(1);

    const years = useMemo(() => PAGE15_DATA.map((r) => r.year), []);

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useLayoutEffect(() => {
        const el = chartSlotRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const measure = () => {
            const w = el.getBoundingClientRect().width;
            if (!(w > 0)) return;
            const rounded = Math.max(160, Math.floor(w));
            setPlotSlotWidth((prev) => (prev === rounded ? prev : rounded));
        };
        measure();
        const ro = new ResizeObserver(() => {
            requestAnimationFrame(measure);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        const vv = window.visualViewport;
        const syncPinch = () => setViewportScale(vv && vv.scale > 0 ? vv.scale : 1);
        const syncEffective = () => {
            const iw = window.innerWidth;
            const pinch = vv && vv.scale > 0 ? vv.scale : 1;
            let z = pinch;
            /** Browsers that shrink vv on Ctrl+ zoom (not all do). */
            if (vv && vv.width > 0 && iw > 0) {
                const layoutZoom = iw / vv.width;
                if (layoutZoom > 1.02 && layoutZoom < 8) {
                    z = Math.max(z, layoutZoom);
                }
            }
            /** Many browsers keep vv.width ≈ iw during page zoom; infer from screen vs layout when (~) maximized. */
            const sw = window.screen?.width ?? 0;
            const avail = window.screen?.availWidth ?? 0;
            const ow = window.outerWidth;
            if (sw >= 1024 && iw > 0 && avail > 0 && ow >= avail * 0.88 && iw < sw * 0.92) {
                const inferredFull = sw / iw;
                if (inferredFull > 1.12 && inferredFull < 4) {
                    z = Math.max(z, inferredFull);
                }
            }
            if (pinch <= 1.02) {
                if (sw >= 1024 && iw > 0 && iw < 560) {
                    const inferred = sw / iw;
                    if (inferred > 1.12) z = Math.min(6, Math.max(z, inferred));
                }
            }
            setEffectiveZoom(z);
        };
        syncPinch();
        syncEffective();
        if (vv) {
            vv.addEventListener('resize', syncPinch);
            vv.addEventListener('scroll', syncPinch);
            vv.addEventListener('resize', syncEffective);
            vv.addEventListener('scroll', syncEffective);
        }
        window.addEventListener('resize', syncEffective);
        return () => {
            if (vv) {
                vv.removeEventListener('resize', syncPinch);
                vv.removeEventListener('scroll', syncPinch);
                vv.removeEventListener('resize', syncEffective);
                vv.removeEventListener('scroll', syncEffective);
            }
            window.removeEventListener('resize', syncEffective);
        };
    }, []);

    const page15YearRange = useMemo(() => ({ min: 2017, max: 2024 }), []);

    const page15ExportStem = useMemo(
        () => `${PAGE15_EXPORT_FILE_BASE}-${page15YearRange.min}-${page15YearRange.max}`,
        [page15YearRange.min, page15YearRange.max]
    );

    const formatBillions = useCallback(
        (n) => (lang === 'fr' ? Number(n).toLocaleString('fr-CA') : Number(n).toLocaleString('en-CA')),
        [lang]
    );

    /** Category rows per year, then a total row for that year (on-page table + DOCX). */
    const tableRowsWithTotals = useMemo(() => {
        const rows = [];
        for (const r of PAGE15_DATA) {
            for (const key of PAGE15_CAT_ORDER) {
                rows.push({
                    rowKind: 'category',
                    year: r.year,
                    categoryKey: key,
                    categoryLabel: getText(`page15_cat_${key}`, lang),
                    exports: r[`exp_${key}`],
                    imports: r[`imp_${key}`],
                });
            }
            rows.push({
                rowKind: 'total',
                year: r.year,
                categoryKey: 'total',
                categoryLabel: getText('page15_table_row_total', lang),
                exports: r.totalExp,
                imports: r.totalImp,
            });
        }
        return rows;
    }, [lang]);

    const syncCalloutArrows = useCallback(() => {
        const calloutsEl = calloutsRef.current;
        const gd = chartRef.current?.querySelector('.js-plotly-plot');
        if (!calloutsEl || !gd?._fullLayout?.yaxis) return;
        const ya = gd._fullLayout.yaxis;
        const yMin = ya.range[0];
        const yMax = ya.range[1];
        if (yMax === yMin) return;
        const h = ya._length;
        if (typeof h !== 'number' || h <= 0) return;
        const zeroFromPlotTop = h * (yMax - 0) / (yMax - yMin);
        const plotAreaOffsetTop = typeof ya._offset === 'number' ? ya._offset : 0;
        const zeroFromCalloutsTop = Math.min(Math.max(zeroFromPlotTop, 8), Math.max(h - 8, 8));
        setArrowMetrics({
            zeroFromCalloutsTop,
            plotAreaMarginTop: plotAreaOffsetTop,
            plotAreaHeight: h,
        });
    }, []);

    const downloadChartWithTitle = useCallback(async () => {
        const plotElement = chartRef?.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        try {
            const title = stripHtml(getText('page15_chart_title', lang));
            const imgData = await window.Plotly.toImage(plotElement, { format: 'png', width: 1200, height: 720, scale: 2 });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                const titleHeight = 56;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 22px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, canvas.width / 2, 36);
                ctx.drawImage(img, 0, titleHeight);
                canvas.toBlob((blob) => {
                    if (blob) saveAs(blob, `${page15ExportStem}.png`);
                });
            };
            img.src = imgData;
        } catch (e) {
            console.error(e);
        }
    }, [lang, page15ExportStem]);

    const downloadTableAsCSV = useCallback(() => {
        const yLabel = getText('page15_table_year', lang);
        const expS = getText('page15_table_csv_exp_suffix', lang);
        const impS = getText('page15_table_csv_imp_suffix', lang);
        const headers = [
            yLabel,
            ...PAGE15_CAT_ORDER.flatMap((key) => {
                const cat = getText(`page15_cat_${key}`, lang);
                return [`"${cat} — ${expS}"`, `"${cat} — ${impS}"`];
            }),
            `"${getText('page15_table_total_exports', lang)}"`,
            `"${getText('page15_table_total_imports', lang)}"`,
        ];
        const lines = [
            headers.join(','),
            ...PAGE15_DATA.map((row) => {
                const cells = [
                    row.year,
                    ...PAGE15_CAT_ORDER.flatMap((key) => [formatBillions(row[`exp_${key}`]), formatBillions(row[`imp_${key}`])]),
                    formatBillions(row.totalExp),
                    formatBillions(row.totalImp),
                ];
                return cells.join(',');
            }),
        ];
        const csv = lines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${page15ExportStem}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    }, [lang, page15ExportStem, formatBillions]);

    const downloadTableAsDocx = useCallback(async () => {
        const heading = stripHtml(getText('page15_title', lang));
        const yLabel = getText('page15_table_year', lang);
        const cLabel = getText('page15_table_category', lang);
        const eLabel = getText('page15_table_exports_b', lang);
        const iLabel = getText('page15_table_imports_b', lang);
        const headerShade = { fill: 'E6E6E6' };
        const headerCells = [
            new TableCell({
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: yLabel, bold: true, size: 22 })],
                        alignment: AlignmentType.CENTER,
                    }),
                ],
                shading: headerShade,
            }),
            new TableCell({
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: cLabel, bold: true, size: 22 })],
                        alignment: AlignmentType.CENTER,
                    }),
                ],
                shading: headerShade,
            }),
            new TableCell({
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: eLabel, bold: true, size: 22 })],
                        alignment: AlignmentType.CENTER,
                    }),
                ],
                shading: headerShade,
            }),
            new TableCell({
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: iLabel, bold: true, size: 22 })],
                        alignment: AlignmentType.CENTER,
                    }),
                ],
                shading: headerShade,
            }),
        ];
        const dataRows = tableRowsWithTotals.map((row) => {
            const bold = row.rowKind === 'total';
            const cell = (text, align, isBold) =>
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text, bold: isBold, size: 22 })],
                            alignment: align,
                        }),
                    ],
                });
            return new TableRow({
                children: [
                    cell(String(row.year), AlignmentType.CENTER, bold),
                    cell(row.categoryLabel, AlignmentType.LEFT, bold),
                    cell(formatBillions(row.exports), AlignmentType.RIGHT, bold),
                    cell(formatBillions(row.imports), AlignmentType.RIGHT, bold),
                ],
            });
        });
        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: heading, bold: true, size: 28 })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [1200, 4000, 2200, 2200],
                            rows: [new TableRow({ children: headerCells }), ...dataRows],
                        }),
                    ],
                },
            ],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${page15ExportStem}.docx`);
    }, [lang, page15ExportStem, tableRowsWithTotals, formatBillions]);

    const plotConfig = useMemo(
        () => ({
            displayModeBar: true,
            displaylogo: false,
            responsive: false,
            scrollZoom: false,
            doubleClick: false,
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
                    click: () => {
                        downloadChartWithTitle();
                    },
                },
            ],
        }),
        [lang, downloadChartWithTitle]
    );

    const plotBundle = useMemo(() => {
        const segKey = (curveNumber, pointIndex) => `${curveNumber}:${pointIndex}`;
        const barOpacityForTrace = (curveNumber) =>
            years.map((_, pointIndex) =>
                selectedSegments === null || selectedSegments.has(segKey(curveNumber, pointIndex)) ? 1 : 0.35
            );

        const traces = [];
        let curveNumber = 0;
        for (const key of PAGE15_CAT_ORDER) {
            const color = PAGE15_COLORS[key];
            traces.push({
                type: 'bar',
                x: years,
                y: PAGE15_DATA.map((r) => r[`exp_${key}`]),
                name: getText(`page15_cat_${key}`, lang),
                legendgroup: key,
                marker: { color, opacity: barOpacityForTrace(curveNumber), line: { width: 0 } },
                stackgroup: 'exp',
                hovertemplate:
                    lang === 'fr'
                        ? `<b>%{x}</b><br>${getText(`page15_cat_${key}`, lang)}<br>%{y:.2f} Md$<extra></extra>`
                        : `<b>%{x}</b><br>${getText(`page15_cat_${key}`, lang)}<br>$%{y:.2f}B<extra></extra>`,
            });
            curveNumber += 1;
        }
        for (const key of PAGE15_CAT_ORDER) {
            const color = PAGE15_COLORS[key];
            traces.push({
                type: 'bar',
                x: years,
                y: PAGE15_DATA.map((r) => -r[`imp_${key}`]),
                name: getText(`page15_cat_${key}`, lang),
                legendgroup: key,
                showlegend: false,
                marker: { color, opacity: barOpacityForTrace(curveNumber), line: { width: 0 } },
                stackgroup: 'imp',
                hovertemplate:
                    lang === 'fr'
                        ? `<b>%{x}</b><br>${getText(`page15_cat_${key}`, lang)}<br>%{customdata:.2f} Md$<extra></extra>`
                        : `<b>%{x}</b><br>${getText(`page15_cat_${key}`, lang)}<br>$%{customdata:.2f}B<extra></extra>`,
                customdata: PAGE15_DATA.map((r) => r[`imp_${key}`]),
            });
            curveNumber += 1;
        }

        const yMinAxis = -92;
        const yMaxAxis = 232;
        const yTickStep = 20;
        const yTickVals = [];
        for (let v = Math.ceil(yMinAxis / yTickStep) * yTickStep; v <= yMaxAxis + 1e-9; v += yTickStep) {
            yTickVals.push(v);
        }
        const yTickText = yTickVals.map((v) => (v < 0 ? String(Math.abs(v)) : String(v)));

        const baseAxisTickPx = windowWidth <= 480 ? 12 : 16;
        /** ~400% zoom: smaller ticks/labels to reduce overlap; ~500% zoom: one step smaller again. */
        const axisTickFontSize =
            effectiveZoom >= 5
                ? (windowWidth <= 480 ? 8 : 9)
                : effectiveZoom >= 4
                  ? (windowWidth <= 480 ? 9 : 10)
                  : baseAxisTickPx;
        const axisTicksNormalWeight = effectiveZoom >= 4;
        const axisTickFont = {
            size: axisTickFontSize,
            family: 'Arial, sans-serif',
            color: '#000000',
            ...(axisTicksNormalWeight ? { weight: 'normal' } : {}),
        };
        const barTotalsMatchAxisTicks = effectiveZoom >= 4;
        const barTotalFontSize =
            effectiveZoom >= 5 ? Math.max(8, axisTickFontSize - 1) : axisTickFontSize;
        const annotations = PAGE15_DATA.map((r) => {
            const expText = lang === 'fr' ? `${r.totalExp} $` : `$${r.totalExp}`;
            const impText = lang === 'fr' ? `${r.totalImp} $` : `$${r.totalImp}`;
            const bold2019 = r.year === 2019;
            const bold2024 = r.year === 2024;
            const expSize = barTotalsMatchAxisTicks
                ? barTotalFontSize
                : bold2019 || bold2024
                  ? 13
                  : 12;
            const impSize = barTotalsMatchAxisTicks ? barTotalFontSize : r.year === 2017 ? 13 : 12;
            return [
                {
                    x: r.year,
                    y: r.totalExp + 6,
                    text: expText,
                    showarrow: false,
                    font: {
                        family: 'Arial, sans-serif',
                        size: expSize,
                        color: '#000000',
                        ...(axisTicksNormalWeight ? { weight: 'normal' } : {}),
                    },
                },
                {
                    x: r.year,
                    y: -r.totalImp - 6,
                    text: impText,
                    showarrow: false,
                    font: {
                        family: 'Arial, sans-serif',
                        size: impSize,
                        color: '#000000',
                        ...(axisTicksNormalWeight ? { weight: 'normal' } : {}),
                    },
                },
            ];
        }).flat();
        const baseYTitlePx = windowWidth <= 480 ? 14 : 18;
        const yTitleFontSize =
            effectiveZoom >= 5
                ? Math.max(9, baseYTitlePx - 6)
                : effectiveZoom >= 4
                  ? Math.max(10, baseYTitlePx - 4)
                  : baseYTitlePx;
        const legendFontSize = windowWidth <= 640 ? 11 : windowWidth <= 900 ? 12 : axisTickFontSize;
        /** Smooth functions of width avoid staircase jumps at zoom breakpoints (overlap vs huge gap). */
        const wPlot = Math.max(340, windowWidth);
        const bottomMargin = Math.round(
            Math.min(318, Math.max(228, 168 + 118000 / wPlot))
        );
        const legendBlend = Math.min(1, Math.max(0, (1280 - wPlot) / (1280 - 380)));
        const legendY = -0.21 - 0.22 * legendBlend;
        const plotHeight =
            windowWidth <= 400 ? 520 : windowWidth <= 640 ? 560 : windowWidth <= 900 ? 600 : windowWidth <= 1100 ? 620 : 640;
        /** Match the flex chart column; default guesses callouts + frame padding until ResizeObserver runs. */
        const layoutWidth = plotSlotWidth ?? Math.max(200, windowWidth - 220);

        const layout = {
            autosize: false,
            width: layoutWidth,
            barmode: 'relative',
            bargap: 0.22,
            clickmode: 'event',
            hoverlabel: {
                bgcolor: '#ffffff',
                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
            },
            xaxis: {
                type: 'linear',
                tickmode: 'array',
                tickvals: years,
                ticktext: years.map(String),
                tickfont: { ...axisTickFont },
                showgrid: false,
                zeroline: false,
                automargin: true,
            },
            yaxis: {
                range: [yMinAxis, yMaxAxis],
                tickmode: 'array',
                tickvals: yTickVals,
                ticktext: yTickText,
                tickfont: { ...axisTickFont },
                gridcolor: '#dddddd',
                zeroline: true,
                zerolinewidth: 2,
                zerolinecolor: '#000000',
                automargin: true,
                title: {
                    text: getText('page15_yaxis_title', lang),
                    font: {
                        size: yTitleFontSize,
                        family: 'Arial, sans-serif',
                        color: '#000000',
                        ...(axisTicksNormalWeight ? { weight: 'normal' } : {}),
                    },
                    standoff: 15,
                },
            },
            legend: {
                orientation: 'h',
                y: legendY,
                yanchor: 'top',
                x: 0.5,
                xanchor: 'center',
                font: { size: legendFontSize, family: 'Arial, sans-serif', color: '#000000' },
                traceorder: 'normal',
            },
            margin: { l: 58, r: 8, t: 24, b: bottomMargin },
            height: plotHeight,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: '#fafafa',
            showlegend: true,
            annotations,
            hovermode: 'closest',
        };

        return { data: traces, layout };
    }, [lang, years, selectedSegments, windowWidth, effectiveZoom, plotSlotWidth]);

    useEffect(() => {
        if (!chartRef?.current) return;
        const plotContainer = chartRef.current;
        const setup = () => {
            const svgElements = plotContainer.querySelectorAll('.main-svg, .svg-container svg');
            svgElements.forEach((svg) => svg.setAttribute('aria-hidden', 'true'));
            const modebarButtons = plotContainer.querySelectorAll('.modebar-btn');
            modebarButtons.forEach((btn) => {
                const dataTitle = btn.getAttribute('data-title');
                if (dataTitle && (dataTitle.includes('Download') || dataTitle.includes('Télécharger'))) {
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
        const t = setTimeout(setup, 500);
        const observer = new MutationObserver(setup);
        observer.observe(plotContainer, { childList: true, subtree: true });
        return () => {
            clearTimeout(t);
            observer.disconnect();
        };
    }, [lang]);

    useEffect(() => {
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;
        if (!topScroll || !tableScroll || !isTableOpen) return;
        const syncTopToTable = () => {
            const table = tableScroll.querySelector('table');
            if (table && topScroll.firstChild) {
                topScroll.firstChild.style.width = `${table.scrollWidth}px`;
            }
        };
        const handleTop = () => {
            tableScroll.scrollLeft = topScroll.scrollLeft;
        };
        const handleTable = () => {
            topScroll.scrollLeft = tableScroll.scrollLeft;
        };
        topScroll.addEventListener('scroll', handleTop);
        tableScroll.addEventListener('scroll', handleTable);
        syncTopToTable();
        const ro = new ResizeObserver(() => window.requestAnimationFrame(syncTopToTable));
        const tableEl = tableScroll.querySelector('table');
        if (tableEl) ro.observe(tableEl);
        ro.observe(tableScroll);
        return () => {
            topScroll.removeEventListener('scroll', handleTop);
            tableScroll.removeEventListener('scroll', handleTable);
            ro.disconnect();
        };
    }, [isTableOpen, windowWidth, tableRowsWithTotals.length]);

    const scheduleArrowSync = useCallback(() => {
        requestAnimationFrame(() => {
            setTimeout(syncCalloutArrows, 0);
        });
    }, [syncCalloutArrows]);

    useLayoutEffect(() => {
        scheduleArrowSync();
        window.addEventListener('resize', scheduleArrowSync);
        const node = chartRef.current;
        const ro =
            typeof ResizeObserver !== 'undefined' && node
                ? new ResizeObserver(() => scheduleArrowSync())
                : null;
        if (node && ro) ro.observe(node);
        return () => {
            window.removeEventListener('resize', scheduleArrowSync);
            ro?.disconnect();
        };
    }, [
        scheduleArrowSync,
        plotBundle.layout?.height,
        plotBundle.layout?.width,
        windowWidth,
        effectiveZoom,
        selectedSegments,
        lang,
        plotSlotWidth,
    ]);

    const showCalloutBrackets = Boolean(arrowMetrics && arrowMetrics.plotAreaHeight > 50);
    const vvForLayout = Math.min(Math.max(effectiveZoom, 1), 4);
    /** Positive = move modebar down (clear subtitle); avoid negative values that pull it into the title line. */
    const modebarTranslateYPx = effectiveZoom >= 4 ? 6 : 4;
    /** Vertical when zoomed or narrow layout (≤560px catches ~400% zoom on typical desktop widths). */
    const useVerticalCalloutLabels =
        effectiveZoom >= 4 || windowWidth <= 560 || viewportScale >= 1.55;
    /**
     * Short callout copy matches vertical/narrow/high-zoom; imports bracket must use calloutImportsKey (not hardcoded).
     * Width ≤640: short text whenever horizontal wrap would show long clipped strings.
     * effectiveZoom ≳1.45: ~140%+ page zoom (see syncEffective: vv ratio, screen/inner when maximized).
     */
    const useShortCalloutLabels =
        useVerticalCalloutLabels || windowWidth <= 640 || effectiveZoom >= 1.45;
    const calloutExportsKey = useShortCalloutLabels ? 'page15_callout_exports_500' : 'page15_callout_exports';
    const calloutImportsKey = useShortCalloutLabels ? 'page15_callout_imports_500' : 'page15_callout_imports';
    const modebarScale = Math.min(1, 1.25 / vvForLayout);

    /** One word per line in vertical callouts (matches imports wrapping); only short keys + vertical. */
    const page15CalloutDisplayText = useCallback(
        (key) => {
            const raw = getText(key, lang);
            if (!useVerticalCalloutLabels || !useShortCalloutLabels) return raw;
            if (key === 'page15_callout_exports_500') {
                return lang === 'fr' ? 'Exportations\nénergétiques\ndu Canada' : "Canada's\nenergy\nexports";
            }
            if (key === 'page15_callout_imports_500') {
                return lang === 'fr' ? 'Importations\nénergétiques\ndu Canada' : "Canada's\nenergy\nimports";
            }
            return raw;
        },
        [lang, useVerticalCalloutLabels, useShortCalloutLabels]
    );

    const handleChartClick = (data) => {
        if (!data.points?.length) return;
        const pt = data.points[0];
        const pointIndex = pt.pointIndex;
        const curveNumber = pt.curveNumber;
        if (pointIndex == null || curveNumber == null) return;

        const key = `${curveNumber}:${pointIndex}`;

        if (windowWidth <= 768) {
            const now = Date.now();
            const last = lastClickRef.current;
            const sameSeg =
                pointIndex === last.pointIndex && curveNumber === last.curveNumber;
            const doubleTap = sameSeg && now - last.time < 300;
            lastClickRef.current = { time: now, pointIndex, curveNumber };
            if (!doubleTap) return;
        }

        setSelectedSegments((prev) => {
            if (prev === null) return new Set([key]);
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
                return next.size === 0 ? null : next;
            }
            next.add(key);
            return next;
        });
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-15"
            role="main"
            aria-labelledby="page15-heading"
            style={{
                backgroundColor: 'white',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',
                boxSizing: 'border-box',
            }}
        >
            <style>{`
.page-15 { width: 100%; }
/* Plotly SVG often ignores font.weight; force normal tick labels at ≥400% zoom (see data-page15-high-zoom). */
.page-content.page-15[data-page15-high-zoom="true"] .js-plotly-plot .plotly g.xtick text,
.page-content.page-15[data-page15-high-zoom="true"] .js-plotly-plot .plotly g.ytick text,
.page-content.page-15[data-page15-high-zoom="true"] .js-plotly-plot .plotly g.xtick tspan,
.page-content.page-15[data-page15-high-zoom="true"] .js-plotly-plot .plotly g.ytick tspan {
    font-weight: normal !important;
}
.page15-container { width: 100%; padding: 15px 0 0 0; box-sizing: border-box; }
.page15-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    padding-bottom: 20px;
    padding-right: max(20px, 2vw);
    border-radius: 8px;
    margin-bottom: 20px;
    box-sizing: border-box;
    overflow: visible;
}
@media (max-width: 560px) {
    .page15-chart-frame {
        padding-right: max(14px, 3vw);
    }
}
.page15-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 5px 0;
    padding-left: 15px;
}
.page15-chart-subtitle {
    font-family: 'Noto Sans', sans-serif;
    font-size: clamp(16px, 2.4vw, 20px);
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 15px 0;
}
.page15-chart-row {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    flex-wrap: nowrap;
    gap: 2px;
    width: 100%;
    min-height: 0;
    overflow: visible;
    margin-bottom: 0;
}
.page15-chart-main {
    flex: 1 1 auto;
    min-width: 0;
    position: relative;
}
.page15-callouts {
    font-family: 'Noto Sans', sans-serif;
    line-height: 1.35;
    color: var(--gc-text);
    box-sizing: border-box;
}
/* Callout font: viewport width only (browser zoom narrows the layout viewport). Aligns with Plotly tickfont: 16px >480px, 12px ≤480px; one step smaller when very narrow. */
.page-content.page-15 .page15-callouts {
    font-size: 16px;
}
@media (max-width: 480px) {
    .page-content.page-15 .page15-callouts {
        font-size: 12px;
    }
}
@media (max-width: 400px) {
    .page-content.page-15 .page15-callouts {
        font-size: 11px;
    }
}
.page15-callouts--brackets {
    flex: 0 1 auto;
    width: min(32%, 7.75rem);
    min-width: 6.5rem;
    max-width: 9rem;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 0 0 0 1px;
    overflow: hidden;
}
/* Tight column: max-content was inflating width and adding a huge gap before labels. */
.page15-callouts--brackets.page15-callouts--vertical-labels {
    overflow: visible;
    width: auto;
    min-width: 2.5rem;
    max-width: 4rem;
    flex: 0 0 auto;
    flex-shrink: 0;
    padding: 0 2px 0 0;
    box-sizing: border-box;
}
.page15-callout-split {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    gap: clamp(2px, 0.5vw, 6px);
    min-height: 0;
}
.page15-callout-split--exports { flex-shrink: 0; }
.page15-callout-split--imports {
    flex: 1;
    min-height: 56px;
}
.page15-bracket {
    position: relative;
    width: 12px;
    flex-shrink: 0;
    align-self: stretch;
}
.page15-bracket-line--up {
    position: absolute;
    right: 0;
    top: 6px;
    bottom: 5px;
    width: var(--page15-bracket-line, 2px);
    background: #222;
}
.page15-bracket-cap--up {
    position: absolute;
    right: -2px;
    top: 0;
    width: 0;
    height: 0;
    border-left: 3px solid transparent;
    border-right: 3px solid transparent;
    border-bottom: 6px solid #222;
}
.page15-bracket-line--down {
    position: absolute;
    right: 0;
    top: 5px;
    bottom: 6px;
    width: var(--page15-bracket-line, 2px);
    background: #222;
}
.page15-bracket-cap--down {
    position: absolute;
    right: -2px;
    bottom: 0;
    width: 0;
    height: 0;
    border-left: 3px solid transparent;
    border-right: 3px solid transparent;
    border-top: 6px solid #222;
}
.page15-callout-label {
    margin: 0;
    flex: 1;
    align-self: flex-start;
    padding-top: 1px;
    font-size: inherit;
    line-height: 1.25;
    word-break: normal;
    overflow-wrap: normal;
    hyphens: manual;
}
/* Beat .page-content p { font-size: 20px }; size comes from .page15-callouts media queries above. */
.page-content.page-15 .page15-callouts .page15-callout-label {
    font-size: inherit;
    line-height: 1.35;
}
.page-content.page-15 .page15-callouts .page15-callout-simple {
    font-size: inherit;
    line-height: 1.35;
}
.page15-callouts--vertical-labels .page15-callout-label {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    align-self: center;
    max-height: none;
    overflow: visible;
    flex: 0 0 auto;
    padding-top: 0;
    padding-right: 0;
    margin: 0;
    letter-spacing: 0.01em;
    white-space: pre-line;
}
.page15-callouts--vertical-labels .page15-callout-split {
    gap: 0;
}
.page15-callouts--vertical-labels .page15-bracket {
    width: 8px;
    flex-shrink: 0;
}
.page15-callouts--simple {
    flex: 0 1 auto;
    width: min(30%, 7rem);
    min-width: 6.25rem;
    max-width: 8.5rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 4px 0 12px 0;
    overflow: hidden;
}
.page15-callouts--simple.page15-callouts--vertical-labels {
    overflow: visible;
    min-width: 2.5rem;
    max-width: 4rem;
    width: auto;
    flex-shrink: 0;
    padding: 2px 2px 8px 0;
}
.page15-callouts--vertical-labels.page15-callouts--simple .page15-callout-simple {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    min-height: 0;
    max-height: none;
    overflow: visible;
    font-size: inherit;
    line-height: 1.2;
}
.page15-callouts--vertical-labels.page15-callouts--simple .page15-callout-arrow {
    display: inline;
    margin-bottom: 0;
}
.page15-callout-simple { min-height: 1.5em; }
.page15-callout-arrow {
    font-size: 1.25em;
    line-height: 1;
    display: block;
    margin-bottom: 2px;
}
.page15-map-wrap { width: 100%; position: relative; min-height: 400px; }
.page15-map-wrap .js-plotly-plot .plotly .modebar {
    top: -14px !important;
    right: 4px !important;
    left: auto !important;
    transform: translateY(var(--page15-modebar-translate-y, 0px)) scale(var(--page15-modebar-scale, 1));
    transform-origin: top right;
}
.page15-table-wrapper {
    display: block;
    width: 100%;
    margin: 0 0 48px 0;
    clear: both;
    position: relative;
}
.page15-table-wrapper details > summary {
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
.page15-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page15-table-wrapper details > summary:hover { background-color: #404040 !important; }
.page15-table-wrapper button[type="button"]:hover,
.page15-table-wrapper button:hover,
.page15-chart-frame button[type="button"]:hover,
.page15-chart-frame button:hover { background-color: #404040 !important; }
.page15-table-wrapper .table-responsive { display: block; width: 100%; overflow-x: auto; border: 1px solid #ddd; background: #fff; }
.page15-table-wrapper .table-responsive table { width: max-content; min-width: 100%; border-collapse: collapse; }
.page15-summary {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: #332f30;
    line-height: 1.5;
    margin-top: 8px;
}
.page15-summary--below-frame {
    margin-top: 50px;
    margin-bottom: 0;
    clear: both;
}
@media (max-width: 900px) {
    .page15-chart-title { font-size: clamp(22px, 4.5vw, 26px); }
}
@media (max-width: 768px) {
    .page15-chart-title { font-size: 26px; }
    .page15-chart-subtitle { font-size: 18px; }
    .page15-summary { font-size: 18px; }
}
            `}</style>
            <div className="page15-container">
                <div className="page15-chart-frame">
                    <h1 id="page15-heading" className="page15-chart-title">
                        {getText('page15_chart_title', lang)}
                    </h1>
                    <p className="page15-chart-subtitle">{getText('page15_chart_subtitle', lang)}</p>
                    {selectedSegments !== null && (
                        <div style={{ marginBottom: 8, textAlign: 'center' }}>
                            <button
                                type="button"
                                onClick={() => setSelectedSegments(null)}
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
                    <div
                        className="page15-chart-row"
                        style={{
                            '--page15-modebar-scale': String(modebarScale),
                            '--page15-modebar-translate-y': `${modebarTranslateYPx}px`,
                            '--page15-bracket-line': vvForLayout >= 2.2 ? '1.5px' : '2px',
                        }}
                    >
                        <div
                            ref={chartSlotRef}
                            className="page15-map-wrap page15-chart-main"
                            role="region"
                            aria-label={getText('page15_chart_aria', lang)}
                            tabIndex="0"
                            style={{ minHeight: plotBundle.layout.height }}
                        >
                            <figure ref={chartRef} style={{ margin: 0, position: 'relative', width: '100%' }}>
                                <Plot
                                    data={plotBundle.data}
                                    layout={plotBundle.layout}
                                    config={plotConfig}
                                    style={{ width: '100%' }}
                                    onClick={handleChartClick}
                                    onInitialized={scheduleArrowSync}
                                    onAfterPlot={scheduleArrowSync}
                                />
                            </figure>
                        </div>
                        <div
                            ref={calloutsRef}
                            className={[
                                showCalloutBrackets ? 'page15-callouts page15-callouts--brackets' : 'page15-callouts page15-callouts--simple',
                                useVerticalCalloutLabels ? 'page15-callouts--vertical-labels' : '',
                            ]
                                .filter(Boolean)
                                .join(' ')}
                            style={
                                arrowMetrics?.plotAreaHeight != null
                                    ? {
                                          marginTop: arrowMetrics.plotAreaMarginTop ?? 0,
                                          height: arrowMetrics.plotAreaHeight,
                                          maxHeight: arrowMetrics.plotAreaHeight,
                                          alignSelf: 'flex-start',
                                      }
                                    : { alignSelf: 'flex-start' }
                            }
                        >
                            {showCalloutBrackets ? (
                                <>
                                    <div
                                        className="page15-callout-split page15-callout-split--exports"
                                        style={{ height: arrowMetrics.zeroFromCalloutsTop }}
                                    >
                                        <div className="page15-bracket" aria-hidden="true">
                                            <span className="page15-bracket-line page15-bracket-line--up" />
                                            <span className="page15-bracket-cap page15-bracket-cap--up" />
                                        </div>
                                        <p className="page15-callout-label">{page15CalloutDisplayText(calloutExportsKey)}</p>
                                    </div>
                                    <div className="page15-callout-split page15-callout-split--imports">
                                        <div className="page15-bracket" aria-hidden="true">
                                            <span className="page15-bracket-line page15-bracket-line--down" />
                                            <span className="page15-bracket-cap page15-bracket-cap--down" />
                                        </div>
                                        <p className="page15-callout-label">{page15CalloutDisplayText(calloutImportsKey)}</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="page15-callout-simple">
                                        <span className="page15-callout-arrow" aria-hidden="true">
                                            ↑
                                        </span>
                                        {page15CalloutDisplayText(calloutExportsKey)}
                                    </div>
                                    <div className="page15-callout-simple">
                                        <span className="page15-callout-arrow" aria-hidden="true">
                                            ↓
                                        </span>
                                        {page15CalloutDisplayText(calloutImportsKey)}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="page15-table-wrapper">
                        <details onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">
                                    {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                </span>
                            </summary>
                            <div
                                ref={topScrollRef}
                                style={{
                                    width: '100%',
                                    overflowX: 'auto',
                                    overflowY: 'hidden',
                                    marginBottom: 0,
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
                                style={{ borderTop: 'none', padding: '15px' }}
                                tabIndex="0"
                            >
                                <table className="table table-striped table-hover">
                                    <caption className="wb-inv">{stripHtml(getText('page15_chart_title', lang))}</caption>
                                    <thead>
                                        <tr>
                                            <th scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd' }}>
                                                {getText('page15_table_year', lang)}
                                            </th>
                                            <th scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd' }}>
                                                {getText('page15_table_category', lang)}
                                            </th>
                                            <th
                                                scope="col"
                                                style={{
                                                    fontWeight: 'bold',
                                                    padding: '10px',
                                                    border: '1px solid #ddd',
                                                    textAlign: 'right',
                                                }}
                                            >
                                                {getText('page15_table_exports_b', lang)}
                                            </th>
                                            <th
                                                scope="col"
                                                style={{
                                                    fontWeight: 'bold',
                                                    padding: '10px',
                                                    border: '1px solid #ddd',
                                                    textAlign: 'right',
                                                }}
                                            >
                                                {getText('page15_table_imports_b', lang)}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableRowsWithTotals.map((row, idx) => {
                                            const isTotal = row.rowKind === 'total';
                                            const w = isTotal ? 'bold' : 'normal';
                                            return (
                                                <tr key={`${row.year}-${row.categoryKey}-${idx}`}>
                                                    <td
                                                        style={{
                                                            padding: '8px',
                                                            border: '1px solid #ddd',
                                                            textAlign: 'center',
                                                            fontWeight: w,
                                                        }}
                                                    >
                                                        {row.year}
                                                    </td>
                                                    <th
                                                        scope="row"
                                                        style={{ fontWeight: 'bold', padding: '8px', border: '1px solid #ddd' }}
                                                    >
                                                        {row.categoryLabel}
                                                    </th>
                                                    <td
                                                        style={{
                                                            padding: '8px',
                                                            border: '1px solid #ddd',
                                                            textAlign: 'right',
                                                            fontWeight: w,
                                                        }}
                                                    >
                                                        {formatBillions(row.exports)}
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: '8px',
                                                            border: '1px solid #ddd',
                                                            textAlign: 'right',
                                                            fontWeight: w,
                                                        }}
                                                    >
                                                        {formatBillions(row.imports)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '15px' }}>
                                    <button
                                        type="button"
                                        onClick={downloadTableAsCSV}
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: '#8C8C8C',
                                            border: '1px solid #404040',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontFamily: 'Arial, sans-serif',
                                            fontWeight: 'bold',
                                            color: '#ffffff',
                                        }}
                                    >
                                        {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={downloadTableAsDocx}
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: '#8C8C8C',
                                            border: '1px solid #404040',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontFamily: 'Arial, sans-serif',
                                            fontWeight: 'bold',
                                            color: '#ffffff',
                                        }}
                                    >
                                        {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                    </button>
                                </div>
                            </div>
                        </details>
                    </div>
                </div>
                <p className="page15-summary page15-summary--below-frame">
                    {getText('page15_summary_before', lang)}
                    <strong>{getText('page15_summary_bold_exp', lang)}</strong>
                    {getText('page15_summary_mid', lang)}
                    <strong>{getText('page15_summary_bold_imp', lang)}</strong>
                    {getText('page15_summary_after', lang)}
                </p>
            </div>
        </main>
    );
};

export default Page15;
