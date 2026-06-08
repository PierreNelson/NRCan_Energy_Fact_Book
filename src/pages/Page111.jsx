import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getPage111Data } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import Page111ProvinceInfographic from '../components/Page111ProvinceInfographic';
import {
    IMAGE_TRIM,
    NATIVE_SIZE,
    OVERLAY_COLORS,
    PCT_SLOTS,
    PROVINCE_ORDER,
} from '../components/Page111ProvinceInfographic.constants';
import page111Bg from '../assets/page111_bg_1.png';

const COLORS = {
    conventional: '#3C95C8',
    oilSands: '#8C8C8C',
};

/** Vertical year ticks from ~300% page zoom (not ~500%). */
const PAGE111_VERTICAL_TICK_ZOOM = 2.85;

const createInitialViewportZoom = () => {
    if (typeof window === 'undefined') {
        return { pinScale: 1, cssZoomFactor: 1, screenZoomHint: 1 };
    }
    const inner = window.innerWidth;
    const outer = window.outerWidth;
    const sw = window.screen?.availWidth ?? window.screen?.width ?? 0;
    let screenZoomHint = 1;
    if (sw > 0 && outer >= sw - 24 && inner > 0) {
        const ratio = sw / inner;
        if (ratio >= 1.75) screenZoomHint = Math.min(ratio, 10);
    }
    return { pinScale: 1, cssZoomFactor: 1, screenZoomHint };
};

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    }
    return hex;
};

const Page111 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isChartTableOpen, setIsChartTableOpen] = useState(false);
    const [isInfographicTableOpen, setIsInfographicTableOpen] = useState(false);
    const [selectedTraceIds, setSelectedTraceIds] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [viewportZoom, setViewportZoom] = useState(createInitialViewportZoom);
    const chartRef = useRef(null);
    const zoomBaselineRef = useRef(null);
    const infographicFigureRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null });
    const yearButtonRef = useRef(null);
    const yearDropdownRef = useRef(null);
    const chartTableTopRef = useRef(null);
    const chartTableScrollRef = useRef(null);
    const chartTableBottomRef = useRef(null);
    const infographicTableTopRef = useRef(null);
    const infographicTableScrollRef = useRef(null);
    const infographicTableBottomRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const pageZoomForLayout = Math.max(
        viewportZoom.cssZoomFactor,
        viewportZoom.pinScale,
        viewportZoom.screenZoomHint,
    );
    const useVerticalYearTicks = pageZoomForLayout >= PAGE111_VERTICAL_TICK_ZOOM;
    const yearTickAngle = useVerticalYearTicks ? 90 : 0;

    const basePlotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotHeight = pageZoomForLayout >= PAGE111_VERTICAL_TICK_ZOOM
        ? Math.min(basePlotHeight, Math.max(260, Math.round(windowWidth * 0.58)))
        : basePlotHeight;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = useVerticalYearTicks
        ? (windowWidth <= 480 ? 88 : windowWidth <= 768 ? 78 : 68)
        : (windowWidth <= 480 ? 62 : windowWidth <= 768 ? 56 : 50);

    const infographicHeight = windowWidth <= 768 ? 400 : 480;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    const formatNumber = (value, digits = 0) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        });
    };

    const formatPct = (value, digits = 1) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        });
    };

    const formatMmbd = (value, digits = 1) => formatNumber(value, digits);

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

    const getProvinceLabel = useCallback(
        (key) => getText(`page111_prov_${key}`, lang),
        [lang],
    );

    useEffect(() => {
        getPage111Data()
            .then(setResult)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const syncViewport = () => {
            setWindowWidth(window.innerWidth);

            const inner = window.innerWidth;
            const outer = window.outerWidth;
            const dpr = window.devicePixelRatio || 1;

            if (zoomBaselineRef.current == null) {
                zoomBaselineRef.current = { outer, inner, dpr };
            } else {
                const baseline = zoomBaselineRef.current;
                if (Math.abs(outer - baseline.outer) > 64) {
                    zoomBaselineRef.current = { outer, inner, dpr };
                }
            }
            const baseline = zoomBaselineRef.current;
            const outerStable = baseline && Math.abs(outer - baseline.outer) <= 64;

            let cssZoomFactor = 1;
            if (baseline && inner > 0 && baseline.inner > 0 && outerStable) {
                cssZoomFactor = Math.max(baseline.inner / inner, inner / baseline.inner);
            }

            const sw = window.screen?.availWidth ?? window.screen?.width ?? 0;
            let screenZoomHint = 1;
            if (sw > 0 && outer >= sw - 24 && inner > 0) {
                const ratio = sw / inner;
                if (ratio >= 1.75) screenZoomHint = Math.min(ratio, 10);
            }

            const vv = window.visualViewport;
            const pinScale = vv?.scale && vv.scale > 0 ? vv.scale : 1;

            setViewportZoom({ pinScale, cssZoomFactor, screenZoomHint });
        };

        syncViewport();
        window.addEventListener('resize', syncViewport);
        const vv = window.visualViewport;
        vv?.addEventListener('resize', syncViewport);
        vv?.addEventListener('scroll', syncViewport);
        return () => {
            window.removeEventListener('resize', syncViewport);
            vv?.removeEventListener('resize', syncViewport);
            vv?.removeEventListener('scroll', syncViewport);
        };
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
        () => bindTableScrollSync(isChartTableOpen, chartTableTopRef, chartTableScrollRef, chartTableBottomRef),
        [isChartTableOpen, windowWidth, result, bindTableScrollSync],
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

    const chartTableRows = useMemo(
        () => (result?.production ? [...result.production].sort((a, b) => b.year - a.year) : []),
        [result],
    );

    const infographicTableRows = useMemo(
        () => (result?.provinces ? [...result.provinces].sort((a, b) => b.year - a.year) : []),
        [result],
    );

    const selectorYears = result?.selectorYears ?? [];
    const selectedYearRow = effectiveSelectedYear != null
        ? result?.production?.find((row) => row.year === effectiveSelectedYear) ?? null
        : null;
    const chartStartYear = result?.chartStartYear ?? 2006;
    const chartEndYear = result?.chartEndYear ?? effectiveSelectedYear;
    const provinceStartYear = result?.provinceStartYear ?? 2016;
    const provinceEndYear = result?.provinceEndYear ?? effectiveSelectedYear;
    const year = effectiveSelectedYear;

    const textVars = {
        year,
        startYear: chartStartYear,
        endYear: chartEndYear,
        provinceStartYear,
        provinceEndYear,
        oilSandsMmbd: selectedYearRow?.oilSandsMmbd != null ? formatMmbd(selectedYearRow.oilSandsMmbd, 1) : '–',
        conventionalMmbd: selectedYearRow?.conventionalMmbd != null ? formatMmbd(selectedYearRow.conventionalMmbd, 1) : '–',
    };

    const selectedProvinceRow = effectiveSelectedYear != null
        ? result?.provinces?.find((row) => row.year === effectiveSelectedYear) ?? null
        : null;

    const provinceOverlayValues = selectedProvinceRow?.provinces ?? null;

    const chartTitle = getText('page111_chart_title', lang);
    const infographicTitleBase = substitute(getText('page111_infographic_title', lang), textVars);

    const chartDownloadSlug = substitute(getText('page111_download_title', lang), textVars)
        .replace(/\s+/g, '_')
        .replace(/–/g, '-');
    const infographicDownloadSlug = substitute(getText('page111_infographic_download_title', lang), textVars)
        .replace(/\s+/g, '_')
        .replace(/–/g, '-');
    const infographicPngSlug = substitute(getText('page111_infographic_png_slug', lang), { year: year ?? '' })
        .replace(/\s+/g, '_');

    const chartTableHeaders = [
        getText('page111_table_col_year', lang),
        getText('page111_table_col_oil_sands_m3', lang),
        getText('page111_table_col_conventional_m3', lang),
        getText('page111_table_col_total_m3', lang),
        getText('page111_table_col_oil_sands_mmbd', lang),
        getText('page111_table_col_conventional_mmbd', lang),
        getText('page111_table_col_total_mmbd', lang),
        getText('page111_table_col_share', lang),
    ];

    const infographicTableHeaders = [
        getText('page111_table_col_year', lang),
        ...PROVINCE_ORDER.map((key) => getText(`page111_table_col_${key}`, lang)),
    ];

    const years = result?.production?.map((row) => row.year) ?? [];
    const yearTicks = years.filter((yearValue) => yearValue % 2 === 0);
    const conventionalValues = result?.production?.map((row) => row.conventionalMmbd) ?? [];
    const oilSandsValues = result?.production?.map((row) => row.oilSandsMmbd) ?? [];
    const totalValues = result?.production?.map((row) => row.totalMmbd) ?? [];

    const conventionalLabel = getText('page111_legend_conventional', lang);
    const oilSandsLabel = getText('page111_legend_oil_sands', lang);
    const totalLabel = getText('page4_total', lang);
    const yAxisTitle = getText('page111_y_axis', lang);

    const conventionalHoverTexts = years.map(
        (yearValue, i) =>
            `<b>${conventionalLabel}</b><br>${yearValue}: ${formatHoverMmbd(conventionalValues[i])}<br><b>${totalLabel}</b>: ${formatHoverMmbd(totalValues[i])}`,
    );
    const oilSandsHoverTexts = years.map(
        (yearValue, i) =>
            `<b>${oilSandsLabel}</b><br>${yearValue}: ${formatHoverMmbd(oilSandsValues[i])}<br><b>${totalLabel}</b>: ${formatHoverMmbd(totalValues[i])}`,
    );

    const conventionalFocused = selectedTraceIds === null || selectedTraceIds.includes(0);
    const oilSandsFocused = selectedTraceIds === null || selectedTraceIds.includes(1);

    const chartYearMin = years.length ? years[0] : 2006;
    const chartYearMax = years.length ? years[years.length - 1] : 2024;

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
        const title = `${chartTitle} (${chartStartYear}–${chartEndYear})`;
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
                    { color: COLORS.conventional, label: conventionalLabel, type: 'box' },
                    { color: COLORS.oilSands, label: oilSandsLabel, type: 'box' },
                ];
                const totalWidth = legendItems.length * 320;
                let x = (canvas.width - totalWidth) / 2 + 20;
                ctx.font = '24px Arial';
                ctx.textAlign = 'left';
                legendItems.forEach((item) => {
                    ctx.fillStyle = item.color;
                    ctx.fillRect(x, legendY - 14, 24, 24);
                    ctx.fillStyle = '#333333';
                    ctx.fillText(item.label, x + 36, legendY + 6);
                    x += 320;
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
        const header = chartTableHeaders.map(csvEscape).join(',');
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
        saveAs(blob, `${chartDownloadSlug}.csv`);
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
                                    text: substitute(getText('page111_table_caption', lang), textVars),
                                    bold: true,
                                    size: 28,
                                }),
                            ],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [900, 1400, 1500, 1200, 1300, 1500, 1200, 1300],
                            rows: [headerRow, ...dataRows],
                        }),
                    ],
                },
            ],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${chartDownloadSlug}.docx`);
    };

    const downloadInfographicCsv = () => {
        const header = infographicTableHeaders.map(csvEscape).join(',');
        const rows = infographicTableRows.map((row) =>
            [
                row.year,
                ...PROVINCE_ORDER.map((key) => formatPct(row.provinces[key]?.sharePct, 1)),
            ].map(csvEscape).join(','),
        );
        const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${infographicDownloadSlug}.csv`);
    };

    const downloadInfographicDocx = async () => {
        const headerRow = new TableRow({
            children: infographicTableHeaders.map(
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
                        ...PROVINCE_ORDER.map((key) => formatPct(row.provinces[key]?.sharePct, 1)),
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
                                    text: substitute(getText('page111_infographic_table_caption', lang), textVars),
                                    bold: true,
                                    size: 28,
                                }),
                            ],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [900, 1100, 1300, 2200, 1100, 1600, 900],
                            rows: [headerRow, ...dataRows],
                        }),
                    ],
                },
            ],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${infographicDownloadSlug}.docx`);
    };

    const downloadInfographicPng = async () => {
        const bgImage = page111Bg;
        const slots = PCT_SLOTS;
        const pctSuffix = lang === 'fr' ? ' %' : '%';
        const native = NATIVE_SIZE;

        const img = new Image();
        img.src = bgImage;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        const scale = 2;
        const layoutEl = infographicFigureRef.current;
        const wrapperEl = layoutEl?.querySelector('.page111-infographic-wrapper');
        const artEl = layoutEl?.querySelector('.page111-infographic-art');
        const namesEl = layoutEl?.querySelector('.page111-province-names');
        const exportGraphicHeight = wrapperEl?.offsetHeight ?? infographicHeight;
        const exportGraphicWidth = wrapperEl?.offsetWidth ?? Math.round(exportGraphicHeight * (native.width / native.height));
        const exportTotalWidth = layoutEl?.offsetWidth ?? (exportGraphicWidth + (namesEl?.offsetWidth ?? 0));
        const trim = IMAGE_TRIM;
        const contentWidthFrac = 1 - trim.left - trim.right;
        const artWidth = artEl?.offsetWidth ?? exportGraphicWidth / contentWidthFrac;
        const artOffsetX = artEl?.offsetLeft ?? (-trim.left / contentWidthFrac) * exportGraphicWidth;
        const graphicHeight = exportGraphicHeight;
        const canvas = document.createElement('canvas');
        canvas.width = exportTotalWidth * scale;
        canvas.height = graphicHeight * scale;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
            img,
            0,
            0,
            img.width,
            img.height,
            artOffsetX * scale,
            0,
            artWidth * scale,
            graphicHeight * scale,
        );

        const pctFont = `bold ${Math.round(artWidth * scale * 0.045)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
        const nameFont = `600 ${Math.round(graphicHeight * scale * 0.036)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
        const labelX = exportTotalWidth * scale;
        const labelColumnWidth = (namesEl?.offsetWidth ?? (lang === 'fr' ? 168 : 152)) * scale;
        const wrapCanvasText = (text, maxWidth) => {
            ctx.font = nameFont;
            const words = text.split(/\s+/);
            const lines = [];
            let current = words[0] ?? '';
            for (let i = 1; i < words.length; i += 1) {
                const next = `${current} ${words[i]}`;
                if (ctx.measureText(next).width <= maxWidth) {
                    current = next;
                } else {
                    lines.push(current);
                    current = words[i];
                }
            }
            if (current) lines.push(current);
            return lines;
        };

        PROVINCE_ORDER.forEach((key) => {
            const slot = slots[key];
            const values = provinceOverlayValues?.[key];
            if (!slot || !values) return;
            const color = OVERLAY_COLORS[key];
            const pctText = values.sharePct != null ? `${formatPct(values.sharePct, 1)}${pctSuffix}` : null;
            const nameText = getProvinceLabel(key);

            if (pctText && pctText !== '–') {
                ctx.fillStyle = color;
                ctx.font = pctFont;
                ctx.textBaseline = 'middle';
                ctx.textAlign = slot.align === 'left' ? 'left' : 'right';
                const x = artOffsetX * scale + (slot.left / 100) * artWidth * scale;
                const y = (slot.top / 100) * graphicHeight * scale;
                ctx.fillText(pctText, x, y);
            }

            if (nameText) {
                ctx.fillStyle = color;
                ctx.font = nameFont;
                ctx.textAlign = 'right';
                const anchorY = (slot.top / 100) * graphicHeight * scale;
                const lines = wrapCanvasText(nameText, labelColumnWidth);
                const lineHeight = Math.round(graphicHeight * scale * 0.036 * 1.2);
                const blockHeight = lineHeight * lines.length;
                let lineY = anchorY - blockHeight / 2 + lineHeight / 2;
                lines.forEach((line) => {
                    ctx.textBaseline = 'middle';
                    ctx.fillText(line, labelX, lineY);
                    lineY += lineHeight;
                });
            }
        });

        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${infographicPngSlug}.png`);
        });
    };

    if (loading) return <p>{lang === 'en' ? 'Loading...' : 'Chargement...'}</p>;
    if (error) return <p>{error}</p>;
    if (!result?.production?.length || !selectedYearRow || !selectedProvinceRow) {
        return <p>{getText('page111_no_data', lang)}</p>;
    }

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-111 page111-canadian-production"
            role="main"
            aria-labelledby="page111-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-111.page111-canadian-production {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.page111-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.page111-title {
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
.page111-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.page111-intro {
    font-family: var(--font-body);
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
    margin: 0 0 24px 0;
    max-width: none;
}
.page111-intro p { margin: 0 0 0.65rem 0; }
.page111-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-sizing: border-box;
    overflow: visible;
}
.page111-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
}
.page111-chart-figure {
    margin: 0;
}
.page111-chart { width: 100%; min-width: 0; height: ${plotHeight}px; position: relative; }
.page111-chart > div { width: 100%; height: 100%; }
.page111-legend {
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
.page111-legend-item { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.page111-legend-box { width: 18px; height: 18px; display: inline-block; border-radius: 2px; }
.page111-infographic-heading {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 28px 0 16px 0;
    text-transform: none;
}
.page111-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.page111-infographic-table-wrapper { margin-bottom: 0; }
.page111-table-wrapper details > summary {
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
.page111-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page111-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page111-table-scrollbar > div { height: 20px; }
.page111-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #ddd;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.page111-table-responsive::-webkit-scrollbar { display: none; }
.page111-table-responsive table { width: max-content !important; min-width: 100%; border-collapse: collapse; }
.page111-table-responsive th, .page111-table-responsive td {
    white-space: nowrap;
    padding: 8px 12px;
    font-family: Arial, sans-serif;
    color: var(--gc-text);
    border: 1px solid #ddd;
}
.page111-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.page111-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.page111-table-wrapper summary:hover, .page111-download-buttons button:hover, .page111-chart-frame button[type="button"]:hover { background-color: #404040 !important; }
.page111-footnotes {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--gc-text);
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
    line-height: 1.65;
}
.page111-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0 0 1rem 0;
}
.page111-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
@media (max-width: 768px) {
    .page111-title { font-size: 37px; }
    .page111-chart-title, .page111-infographic-heading { font-size: 26px; }
    .page111-intro { font-size: 18px; }
}
            `}</style>

            <div className="page111-inner">
                <h1 id="page111-title" className="page111-title">{getText('page111_title', lang)}</h1>

                <div
                    ref={yearDropdownRef}
                    style={{ position: 'relative', marginBottom: '20px', width: '200px' }}
                >
                    <label
                        htmlFor="page111-year-button"
                        style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}
                    >
                        {getText('year_slider_label', lang)}
                    </label>
                    <button
                        ref={yearButtonRef}
                        id="page111-year-button"
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

                <div className="page111-intro">
                    <p>{getText('page111_intro_1', lang)}</p>
                    <p>
                        {substitute(getText('page111_intro_2_prefix', lang), textVars)}
                        <strong>{textVars.oilSandsMmbd}</strong>
                        {getText('page111_intro_2_mid', lang)}
                        <strong>{textVars.conventionalMmbd}</strong>
                        {getText('page111_intro_2_suffix', lang)}
                    </p>
                </div>

                <div className="page111-chart-frame">
                    <h2 className="page111-chart-title">{chartTitle}</h2>

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

                    <figure ref={chartRef} className="page111-chart-figure">
                        <Plot
                            key={`page111-${selectedTraceIds ? selectedTraceIds.join('-') : 'all'}-${useVerticalYearTicks ? 'v' : 'h'}-${plotHeight}`}
                            data={[
                                {
                                    x: years,
                                    y: conventionalValues,
                                    type: 'scatter',
                                    mode: 'lines',
                                    name: conventionalLabel,
                                    line: { color: hexToRgba(COLORS.conventional, conventionalFocused ? 1 : 0.25), width: 0.5 },
                                    fill: 'tozeroy',
                                    fillcolor: hexToRgba(COLORS.conventional, conventionalFocused ? 0.85 : 0.25),
                                    stackgroup: 'production',
                                    hoveron: 'points',
                                    hoverinfo: 'text',
                                    hovertext: conventionalHoverTexts,
                                },
                                {
                                    x: years,
                                    y: oilSandsValues,
                                    type: 'scatter',
                                    mode: 'lines',
                                    name: oilSandsLabel,
                                    line: { color: hexToRgba(COLORS.oilSands, oilSandsFocused ? 1 : 0.25), width: 0.5 },
                                    fill: 'tonexty',
                                    fillcolor: hexToRgba(COLORS.oilSands, oilSandsFocused ? 0.85 : 0.25),
                                    stackgroup: 'production',
                                    hoveron: 'points',
                                    hoverinfo: 'text',
                                    hovertext: oilSandsHoverTexts,
                                },
                            ]}
                            layout={{
                                hoverlabel: {
                                    bgcolor: '#ffffff',
                                    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
                                },
                                hovermode: 'closest',
                                hoverdistance: 40,
                                clickmode: 'event',
                                dragmode: false,
                                xaxis: {
                                    showgrid: false,
                                    zeroline: false,
                                    showline: true,
                                    linewidth: 1,
                                    linecolor: '#333',
                                    tickfont: tickFont,
                                    tickangle: yearTickAngle,
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
                                    range: [0, 6],
                                    dtick: 1,
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
                                        name: getText('page111_download_chart', lang),
                                        icon: {
                                            width: 24,
                                            height: 24,
                                            path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z',
                                        },
                                        click: (gd) => downloadChartPng(gd),
                                    },
                                ],
                            }}
                            className="page111-chart"
                            useResizeHandler
                            onClick={handleChartClick}
                        />
                    </figure>

                    <div className="page111-legend" aria-hidden="true">
                        <div className="page111-legend-item">
                            <span className="page111-legend-box" style={{ backgroundColor: COLORS.conventional }} />
                            <span>{conventionalLabel}</span>
                        </div>
                        <div className="page111-legend-item">
                            <span className="page111-legend-box" style={{ backgroundColor: COLORS.oilSands }} />
                            <span>{oilSandsLabel}</span>
                        </div>
                    </div>

                    <div className="page111-table-wrapper">
                        <details onToggle={(event) => setIsChartTableOpen(event.currentTarget.open)}>
                            <summary role="button" aria-expanded={isChartTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isChartTableOpen ? '▼' : '▶'}</span>
                                {getText('page111_table_summary', lang)}
                                <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                            </summary>
                            <div ref={chartTableTopRef} className="page111-table-scrollbar" aria-hidden="true"><div /></div>
                            <div
                                ref={chartTableScrollRef}
                                className="page111-table-responsive"
                                role="region"
                                aria-labelledby="page111-table-caption"
                                tabIndex={0}
                            >
                                <table className="table table-striped table-hover">
                                    <caption id="page111-table-caption" className="wb-inv">
                                        {substitute(getText('page111_table_caption', lang), textVars)}
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
                            <div ref={chartTableBottomRef} className="page111-table-scrollbar" aria-hidden="true"><div /></div>
                            <div className="page111-download-buttons">
                                <button type="button" onClick={downloadChartCsv}>{getText('page111_download_csv', lang)}</button>
                                <button type="button" onClick={downloadChartDocx}>{getText('page111_download_docx', lang)}</button>
                            </div>
                        </details>
                    </div>
                </div>

                <h2 className="page111-infographic-heading">
                    <span id="fn-province-rf-page111">{infographicTitleBase}</span>
                    <a className="fn-lnk" href="#fn-province-page111" onClick={scrollToElement('fn-province-page111')}>
                        <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>*
                    </a>
                </h2>

                <Page111ProvinceInfographic
                    figureRef={infographicFigureRef}
                    lang={lang}
                    provinceValues={provinceOverlayValues}
                    formatPct={formatPct}
                    getProvinceLabel={getProvinceLabel}
                    ariaLabel={getText('page111_bg_alt', lang)}
                    graphicHeight={infographicHeight}
                />

                <div className="page111-table-wrapper page111-infographic-table-wrapper">
                    <details onToggle={(event) => setIsInfographicTableOpen(event.currentTarget.open)}>
                        <summary role="button" aria-expanded={isInfographicTableOpen}>
                            <span aria-hidden="true" style={{ marginRight: '8px' }}>{isInfographicTableOpen ? '▼' : '▶'}</span>
                            {getText('page111_infographic_table_summary', lang)}
                            <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                        </summary>
                        <div ref={infographicTableTopRef} className="page111-table-scrollbar" aria-hidden="true"><div /></div>
                        <div
                            ref={infographicTableScrollRef}
                            className="page111-table-responsive"
                            role="region"
                            aria-labelledby="page111-infographic-table-caption"
                            tabIndex={0}
                        >
                            <table className="table table-striped table-hover">
                                <caption id="page111-infographic-table-caption" className="wb-inv">
                                    {substitute(getText('page111_infographic_table_caption', lang), textVars)}
                                </caption>
                                <thead>
                                    <tr>
                                        {infographicTableHeaders.map((header) => (
                                            <th key={header} scope="col">{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {infographicTableRows.map((row) => (
                                        <tr key={row.year}>
                                            <th scope="row">{row.year}</th>
                                            {PROVINCE_ORDER.map((key) => (
                                                <td key={key} style={{ textAlign: 'right' }}>
                                                    {formatPct(row.provinces[key]?.sharePct, 1)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div ref={infographicTableBottomRef} className="page111-table-scrollbar" aria-hidden="true"><div /></div>
                        <div className="page111-download-buttons">
                            <button type="button" onClick={downloadInfographicPng}>{getText('page111_download_png', lang)}</button>
                            <button type="button" onClick={downloadInfographicCsv}>{getText('page111_download_csv', lang)}</button>
                            <button type="button" onClick={downloadInfographicDocx}>{getText('page111_download_docx', lang)}</button>
                        </div>
                    </details>
                </div>

                <aside className="wb-fnote page111-footnotes" role="note">
                    <h2 id="fn-page111">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</dt>
                        <dd id="fn-province-page111">
                            <a
                                href="#fn-province-rf-page111"
                                onClick={scrollToElement('fn-province-rf-page111')}
                                className="fn-num"
                                title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}
                            >
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                            </a>
                            {' '}{getText('page111_footnote_other', lang)}
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page111;
