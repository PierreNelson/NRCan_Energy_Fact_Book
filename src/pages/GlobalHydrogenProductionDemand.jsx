import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import {
    REFERENCE_YEAR,
    PRODUCTION_KEYS,
    DEMAND_KEYS,
    PRODUCTION_COLORS,
    DEMAND_COLORS,
    DATA_BY_YEAR,
    DOC_COLUMN_WIDTHS,
} from './GlobalHydrogenProductionDemand.constants';

const STACKED_LAYOUT_BROWSER_ZOOM = 1.1;
const STACKED_LAYOUT_DETECTED_ZOOM = 1.0 + (STACKED_LAYOUT_BROWSER_ZOOM - 1.0) * 0.25;

const MODEBAR_REMOVE = [
    'pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d',
    'autoScale2d', 'resetScale2d', 'toImage', 'hoverClosestCartesian',
    'hoverCompareCartesian', 'toggleSpikelines',
];

const HOVER_LABEL = {
    bgcolor: '#ffffff',
    bordercolor: '#000000',
    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
};

const DOWNLOAD_ICON = {
    width: 24,
    height: 24,
    path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z',
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

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const stripHtml = (value) => String(value || '').replace(/<[^>]*>/g, '');

const digitCount = (value) => {
    const n = Number(value);
    if (Number.isNaN(n)) return 0;
    return Number.isInteger(n) || Math.abs(n - Math.round(n)) < 1e-9 ? 0 : 1;
};

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

const GlobalHydrogenProductionDemand = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [selectedYear] = useState(REFERENCE_YEAR);
    const [selectedProductionSlices, setSelectedProductionSlices] = useState(null);
    const [selectedDemandSlices, setSelectedDemandSlices] = useState(null);
    const [isProductionTableOpen, setIsProductionTableOpen] = useState(false);
    const [isDemandTableOpen, setIsDemandTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [pageCssZoom, setPageCssZoom] = useState(() => computePageZoomScale(null).pageCssZoom);
    const zoomBaselineRef = useRef(null);

    const productionChartRef = useRef(null);
    const demandChartRef = useRef(null);
    const lastProductionClickRef = useRef({ time: 0, index: null });
    const lastDemandClickRef = useRef({ time: 0, index: null });

    const productionTableTopRef = useRef(null);
    const productionTableScrollRef = useRef(null);
    const productionTableBottomRef = useRef(null);
    const demandTableTopRef = useRef(null);
    const demandTableScrollRef = useRef(null);
    const demandTableBottomRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const useStackedLayout = pageCssZoom >= STACKED_LAYOUT_DETECTED_ZOOM;
    // Inside labels + HTML legend: narrow viewports or when charts stack at 110%+ zoom.
    const zoomLegendMode = windowWidth <= 768 || useStackedLayout;
    const textVars = { year: selectedYear };
    const yearData = DATA_BY_YEAR[selectedYear] ?? DATA_BY_YEAR[REFERENCE_YEAR];
    const totalMt = yearData?.totalMt ?? 0;

    const formatMt = useCallback((value, digits) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        const resolvedDigits = digits == null ? digitCount(value) : digits;
        return Number(value).toLocaleString(locale, {
            minimumFractionDigits: resolvedDigits,
            maximumFractionDigits: resolvedDigits,
        });
    }, [locale]);

    const formatPct = useCallback((value, digits) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        const resolvedDigits = digits == null ? digitCount(value) : digits;
        const formatted = Number(value).toLocaleString(locale, {
            minimumFractionDigits: resolvedDigits,
            maximumFractionDigits: resolvedDigits,
        });
        return lang === 'fr' ? `${formatted} %` : `${formatted}%`;
    }, [lang, locale]);

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
        () => bindTableScrollSync(
            isProductionTableOpen,
            productionTableTopRef,
            productionTableScrollRef,
            productionTableBottomRef,
        ),
        [isProductionTableOpen, windowWidth, bindTableScrollSync, lang],
    );

    useEffect(
        () => bindTableScrollSync(
            isDemandTableOpen,
            demandTableTopRef,
            demandTableScrollRef,
            demandTableBottomRef,
        ),
        [isDemandTableOpen, windowWidth, bindTableScrollSync, lang],
    );

    const productionSlices = useMemo(() => {
        if (!yearData) return [];
        return PRODUCTION_KEYS.map((key) => {
            const pct = yearData.production?.[key] ?? 0;
            const mt = (totalMt * pct) / 100;
            return { key, pct, mt };
        });
    }, [yearData, totalMt]);

    const demandSlices = useMemo(() => {
        if (!yearData) return [];
        return DEMAND_KEYS.map((key) => {
            const pct = yearData.demand?.[key] ?? 0;
            const mt = (totalMt * pct) / 100;
            return { key, pct, mt };
        });
    }, [yearData, totalMt]);

    const productionChartTitle = substitute(
        getText('global_hydrogen_production_demand_production_chart_title', lang),
        textVars,
    );
    const demandChartTitle = substitute(
        getText('global_hydrogen_production_demand_demand_chart_title', lang),
        textVars,
    );
    const productionDownloadTitle = substitute(
        getText('global_hydrogen_production_demand_production_download_title', lang),
        textVars,
    );
    const demandDownloadTitle = substitute(
        getText('global_hydrogen_production_demand_demand_download_title', lang),
        textVars,
    );
    const productionFileSlug = productionDownloadTitle.replace(/\s+/g, '_').replace(/–/g, '-');
    const demandFileSlug = demandDownloadTitle.replace(/\s+/g, '_').replace(/–/g, '-');

    const tableHeaders = useMemo(() => [
        getText('global_hydrogen_production_demand_col_category', lang),
        getText('global_hydrogen_production_demand_col_share', lang),
        getText('global_hydrogen_production_demand_col_mt', lang),
    ], [lang]);

    const productionTableRows = useMemo(
        () => productionSlices.map((slice) => ({
            key: slice.key,
            label: getText(`global_hydrogen_production_demand_production_${slice.key}`, lang),
            pct: slice.pct,
            mt: slice.mt,
        })),
        [productionSlices, lang],
    );

    const demandTableRows = useMemo(
        () => demandSlices.map((slice) => ({
            key: slice.key,
            label: getText(`global_hydrogen_production_demand_demand_${slice.key}`, lang),
            pct: slice.pct,
            mt: slice.mt,
        })),
        [demandSlices, lang],
    );

    // Keep pie % labels at least 14px (WCAG-friendly / GC secondary text floor).
    const textSize = windowWidth <= 480 ? 14 : windowWidth <= 768 ? 14 : 16;
    const plotHeight = useStackedLayout
        ? (windowWidth <= 480 ? 400 : windowWidth <= 768 ? 480 : 560)
        : (windowWidth <= 480 ? 360 : windowWidth <= 768 ? 420 : 520);
    const pieSideMargin = zoomLegendMode
        ? (windowWidth <= 480 ? 8 : 16)
        : (windowWidth <= 1100 ? 28 : 48);
    const pieTopMargin = zoomLegendMode ? 24 : 110;
    const pieBottomMargin = zoomLegendMode ? 24 : 90;

    const pieDomain = useMemo(() => (
        zoomLegendMode
            ? { x: [0.05, 0.95], y: [0.05, 0.95] }
            : { x: [0.16, 0.84], y: [0.06, 0.72] }
    ), [zoomLegendMode]);
    const pieCenterY = (pieDomain.y[0] + pieDomain.y[1]) / 2;

    const buildPieTrace = useCallback((slices, colorsMap, labelPrefix, selectedSlices) => {
        if (!slices.length) return null;
        const labels = slices.map((slice) => getText(`${labelPrefix}${slice.key}`, lang));
        const values = slices.map((slice) => (slice.pct > 0 ? slice.pct : 0.001));
        const customdata = slices.map((slice) => formatPct(slice.pct));
        const baseColors = slices.map((slice) => colorsMap[slice.key]);
        const markerColors = selectedSlices?.length
            ? baseColors.map((color, index) => (selectedSlices.includes(index) ? color : hexToRgba(color, 0.3)))
            : baseColors;
        const pull = selectedSlices?.length
            ? values.map((_, index) => (selectedSlices.includes(index) ? 0.08 : 0.02))
            : values.map(() => 0.02);
        const hoverTexts = slices.map((slice) => {
            const label = getText(`${labelPrefix}${slice.key}`, lang);
            return `<b>${label}</b><br>${formatMt(slice.mt)} Mt<br>${formatPct(slice.pct)}`;
        });

        return {
            type: 'pie',
            values,
            labels,
            customdata,
            hole: 0.55,
            direction: 'clockwise',
            sort: false,
            texttemplate: zoomLegendMode ? '%{customdata}' : '%{label}<br>%{customdata}',
            textinfo: zoomLegendMode ? 'percent' : 'label+percent',
            textposition: zoomLegendMode ? 'inside' : 'outside',
            textfont: {
                size: textSize,
                family: 'Arial, sans-serif',
                color: zoomLegendMode ? '#ffffff' : markerColors,
            },
            outsidetextfont: { size: textSize, color: markerColors },
            insidetextfont: { color: '#ffffff', size: textSize, family: 'Arial, sans-serif' },
            marker: { colors: markerColors, line: { color: '#ffffff', width: 1 } },
            pull,
            hovertext: hoverTexts,
            hoverinfo: 'text',
            hoverlabel: HOVER_LABEL,
            automargin: false,
            domain: pieDomain,
        };
    }, [lang, formatPct, formatMt, textSize, zoomLegendMode, pieDomain]);

    const productionTrace = useMemo(
        () => buildPieTrace(
            productionSlices,
            PRODUCTION_COLORS,
            'global_hydrogen_production_demand_production_',
            selectedProductionSlices,
        ),
        [buildPieTrace, productionSlices, selectedProductionSlices],
    );

    const demandTrace = useMemo(
        () => buildPieTrace(
            demandSlices,
            DEMAND_COLORS,
            'global_hydrogen_production_demand_demand_',
            selectedDemandSlices,
        ),
        [buildPieTrace, demandSlices, selectedDemandSlices],
    );

    const centerAnnotation = useMemo(() => ({
        text: `<b>${formatMt(totalMt, 0)}</b><br>Mt`,
        showarrow: false,
        x: 0.5,
        y: pieCenterY,
        xref: 'paper',
        yref: 'paper',
        font: {
            size: windowWidth <= 480 ? 15 : 20,
            color: '#424243',
            family: 'Arial Black, Arial, sans-serif',
        },
    }), [totalMt, windowWidth, formatMt, pieCenterY]);

    const plotLayout = useMemo(() => ({
        showlegend: false,
        margin: {
            t: pieTopMargin,
            b: pieBottomMargin,
            l: pieSideMargin,
            r: pieSideMargin,
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        height: plotHeight,
        autosize: true,
        clickmode: 'event',
        dragmode: false,
        annotations: [centerAnnotation],
        uirevision: `global-hydrogen-${selectedYear}`,
    }), [pieTopMargin, pieBottomMargin, pieSideMargin, plotHeight, centerAnnotation, selectedYear]);

    const toggleSliceSelection = useCallback((setSelected, lastClickRef, sliceIndex) => {
        if (windowWidth <= 768) {
            const now = Date.now();
            const last = lastClickRef.current;
            const isSameSlice = sliceIndex === last.index && last.index != null;
            const isDoubleTap = isSameSlice && now - last.time < 300;
            lastClickRef.current = { time: now, index: sliceIndex };
            if (!isDoubleTap) return;
        }
        setSelected((prev) => {
            if (prev === null) return [sliceIndex];
            if (prev.includes(sliceIndex)) {
                const next = prev.filter((index) => index !== sliceIndex);
                return next.length === 0 ? null : next;
            }
            return [...prev, sliceIndex];
        });
    }, [windowWidth]);

    const handleProductionClick = useCallback((event) => {
        const point = event?.points?.[0];
        if (!point) return;
        const index = point.pointNumber ?? point.pointIndex;
        if (index == null || index < 0) return;
        toggleSliceSelection(setSelectedProductionSlices, lastProductionClickRef, index);
    }, [toggleSliceSelection]);

    const handleDemandClick = useCallback((event) => {
        const point = event?.points?.[0];
        if (!point) return;
        const index = point.pointNumber ?? point.pointIndex;
        if (index == null || index < 0) return;
        toggleSliceSelection(setSelectedDemandSlices, lastDemandClickRef, index);
    }, [toggleSliceSelection]);

    const downloadChartPng = useCallback(async (chartRef, title, fileSlug, plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        const exportTitle = stripHtml(title);
        try {
            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 1200,
                height: 800,
                scale: 2,
            });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                const titleHeight = 80;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 32px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(exportTitle, canvas.width / 2, 48);
                ctx.drawImage(img, 0, titleHeight);
                canvas.toBlob((blob) => {
                    if (blob) saveAs(blob, `${fileSlug}.png`);
                });
            };
            img.src = imgData;
        } catch {
            /* ignore export errors */
        }
    }, []);

    const downloadChartCsv = useCallback((rows, fileSlug) => {
        const header = tableHeaders.map(csvEscape).join(',');
        const body = rows.map((row) =>
            [row.label, formatPct(row.pct), formatMt(row.mt)].map(csvEscape).join(','),
        );
        saveAs(new Blob([[header, ...body].join('\n')], { type: 'text/csv;charset=utf-8;' }), `${fileSlug}.csv`);
    }, [tableHeaders, formatPct, formatMt]);

    const downloadChartDocx = useCallback(async (rows, title, fileSlug) => {
        const headerRow = new TableRow({
            children: tableHeaders.map((header) =>
                new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({ text: header, bold: true, size: 18 })],
                        alignment: AlignmentType.CENTER,
                    })],
                    shading: { fill: 'E6E6E6' },
                }),
            ),
        });
        const dataRows = rows.map((row) =>
            new TableRow({
                children: [row.label, formatPct(row.pct), formatMt(row.mt)].map((value, index) =>
                    new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({ text: String(value), size: 18 })],
                            alignment: index === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
                        })],
                    }),
                ),
            }),
        );
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: stripHtml(title), bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: DOC_COLUMN_WIDTHS,
                        rows: [headerRow, ...dataRows],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), `${fileSlug}.docx`);
    }, [tableHeaders, formatPct, formatMt]);

    const productionChartConfig = {
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        modeBarButtonsToRemove: MODEBAR_REMOVE,
        modeBarButtonsToAdd: [{
            name: getText('global_hydrogen_production_demand_download_png', lang),
            icon: DOWNLOAD_ICON,
            click: (gd) => {
                downloadChartPng(productionChartRef, productionChartTitle, productionFileSlug, gd);
            },
        }],
    };

    const demandChartConfig = {
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        modeBarButtonsToRemove: MODEBAR_REMOVE,
        modeBarButtonsToAdd: [{
            name: getText('global_hydrogen_production_demand_download_png', lang),
            icon: DOWNLOAD_ICON,
            click: (gd) => {
                downloadChartPng(demandChartRef, demandChartTitle, demandFileSlug, gd);
            },
        }],
    };

    useEffect(() => {
        const setupAccessibility = (chartRef) => {
            const plotContainer = chartRef.current;
            if (!plotContainer) return undefined;
            const setup = () => {
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
                    } else {
                        btn.setAttribute('aria-hidden', 'true');
                        btn.setAttribute('tabindex', '-1');
                    }
                });
            };
            const timer = setTimeout(setup, 500);
            const observer = new MutationObserver(setup);
            observer.observe(plotContainer, { childList: true, subtree: true });
            return () => {
                clearTimeout(timer);
                observer.disconnect();
            };
        };
        const cleanProduction = setupAccessibility(productionChartRef);
        const cleanDemand = setupAccessibility(demandChartRef);
        return () => {
            cleanProduction?.();
            cleanDemand?.();
        };
    }, [lang, selectedYear, selectedProductionSlices, selectedDemandSlices, zoomLegendMode]);

    const downloadBtnStyle = {
        padding: '8px 16px',
        border: '1px solid #404040',
        borderRadius: '4px',
        background: '#8C8C8C',
        cursor: 'pointer',
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#ffffff',
        whiteSpace: 'nowrap',
    };

    const renderZoomLegendItem = (slice, colorsMap) => (
        <span key={slice.key} className="global-hydrogen-production-demand-custom-legend-item">
            <span
                className="global-hydrogen-production-demand-custom-legend-swatch"
                style={{ backgroundColor: colorsMap[slice.key] }}
                aria-hidden="true"
            />
            {slice.label}
            {' '}
            {formatPct(slice.pct)}
        </span>
    );

    const renderChartColumn = ({
        kind,
        chartTitle,
        chartRef,
        pieTrace,
        chartConfig,
        onPieClick,
        selectedSlices,
        onClearSelection,
        isTableOpen,
        setIsTableOpen,
        tableTopRef,
        tableScrollRef,
        tableBottomRef,
        tableCaptionKey,
        tableRows,
        fileSlug,
        downloadTitle,
        colorsMap,
    }) => (
        <section
            className={`global-hydrogen-production-demand-chart-column${useStackedLayout ? '' : ' global-hydrogen-production-demand-chart-column-side'}`}
            aria-labelledby={`global-hydrogen-production-demand-${kind}-chart-title`}
        >
            <div className={useStackedLayout
                ? 'global-hydrogen-production-demand-chart-panel'
                : 'global-hydrogen-production-demand-chart-frame'}
            >
                <h2
                    id={`global-hydrogen-production-demand-${kind}-chart-title`}
                    className="global-hydrogen-production-demand-chart-title"
                >
                    {chartTitle}
                </h2>

                {selectedSlices != null ? (
                    <button
                        type="button"
                        className="global-hydrogen-production-demand-clear-selection"
                        onClick={onClearSelection}
                    >
                        {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                    </button>
                ) : (
                    <div className="global-hydrogen-production-demand-clear-selection-spacer" aria-hidden="true" />
                )}

                <figure
                    ref={chartRef}
                    className="global-hydrogen-production-demand-chart"
                    role="region"
                    aria-label={chartTitle}
                    tabIndex={0}
                    style={{ margin: 0, height: `${plotHeight}px` }}
                >
                    {pieTrace && (
                        <Plot
                            key={`global-hydrogen-${kind}-${selectedYear}-${selectedSlices ? selectedSlices.join('-') : 'all'}-${zoomLegendMode ? 'compact' : 'wide'}-${lang}`}
                            data={[pieTrace]}
                            layout={plotLayout}
                            config={chartConfig}
                            style={{ width: '100%', height: `${plotHeight}px` }}
                            useResizeHandler
                            onClick={onPieClick}
                        />
                    )}
                </figure>

                {zoomLegendMode && (
                    <div
                        className="global-hydrogen-production-demand-custom-legend"
                        aria-label={lang === 'en' ? 'Chart legend' : 'Légende du graphique'}
                    >
                        {tableRows.map((slice) => renderZoomLegendItem(slice, colorsMap))}
                    </div>
                )}

                <div className="global-hydrogen-production-demand-table-wrapper">
                    <details onToggle={(event) => setIsTableOpen(event.currentTarget.open)}>
                        <summary role="button" aria-expanded={isTableOpen}>
                            <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                            {getText('global_hydrogen_production_demand_table_summary', lang)}
                            <span className="wb-inv">
                                {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                            </span>
                        </summary>
                        <div ref={tableTopRef} className="global-hydrogen-production-demand-table-scrollbar" aria-hidden="true"><div /></div>
                        <div
                            ref={tableScrollRef}
                            className="global-hydrogen-production-demand-table-responsive"
                            role="region"
                            aria-label={substitute(getText(tableCaptionKey, lang), textVars)}
                            tabIndex={0}
                        >
                            <table className="table table-bordered table-striped table-hover global-hydrogen-production-demand-data-table">
                                <caption className="wb-inv">
                                    {substitute(getText(tableCaptionKey, lang), textVars)}
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
                                        <tr key={row.key}>
                                            <th scope="row">{row.label}</th>
                                            <td style={{ textAlign: 'right' }}>{formatPct(row.pct)}</td>
                                            <td style={{ textAlign: 'right' }}>{formatMt(row.mt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div ref={tableBottomRef} className="global-hydrogen-production-demand-table-scrollbar" aria-hidden="true"><div /></div>
                        <div className="global-hydrogen-production-demand-download-buttons">
                            <button
                                type="button"
                                style={downloadBtnStyle}
                                onClick={() => downloadChartCsv(tableRows, fileSlug)}
                            >
                                {getText('global_hydrogen_production_demand_download_csv', lang)}
                            </button>
                            <button
                                type="button"
                                style={downloadBtnStyle}
                                onClick={() => downloadChartDocx(tableRows, downloadTitle, fileSlug)}
                            >
                                {getText('global_hydrogen_production_demand_download_docx', lang)}
                            </button>
                        </div>
                    </details>
                </div>
            </div>
        </section>
    );

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content global-hydrogen-production-demand"
            role="main"
            aria-labelledby="global-hydrogen-production-demand-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.global-hydrogen-production-demand {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.global-hydrogen-production-demand-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.global-hydrogen-production-demand-bullets {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: var(--gc-text);
    margin: 0 0 28px 0;
    padding-left: 1.25em;
    line-height: 1.55;
}
.global-hydrogen-production-demand-bullets li { margin-bottom: 0.75rem; }
.global-hydrogen-production-demand-bullets li:last-child { margin-bottom: 0; }
.global-hydrogen-production-demand-content-row {
    display: flex;
    flex-direction: row;
    width: 100%;
    gap: 24px;
    align-items: stretch;
}
.global-hydrogen-production-demand-chart-column {
    width: 50%;
    min-width: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
}
.global-hydrogen-production-demand-chart-column-side {
    background-color: #f5f5f5;
    padding: 20px 16px;
    border-radius: 8px;
}
.global-hydrogen-production-demand-chart-frame {
    display: flex;
    flex-direction: column;
    flex: 1;
    box-sizing: border-box;
    overflow: visible;
}
.global-hydrogen-production-demand-chart-panel {
    display: flex;
    flex-direction: column;
    flex: 1;
    box-sizing: border-box;
    overflow: visible;
}
.global-hydrogen-production-demand-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    line-height: 1.2;
    text-transform: none;
    min-height: 2.4em;
}
.global-hydrogen-production-demand-clear-selection {
    padding: 6px 12px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: #fff;
    margin-bottom: 8px;
    width: fit-content;
    align-self: flex-start;
    min-height: 32px;
    box-sizing: border-box;
}
.global-hydrogen-production-demand-clear-selection-spacer {
    min-height: 32px;
    margin-bottom: 8px;
}
.global-hydrogen-production-demand-chart {
    width: 100%;
    min-width: 0;
    position: relative;
    overflow: visible;
}
.global-hydrogen-production-demand-chart > div { width: 100%; height: 100%; overflow: visible; }
.global-hydrogen-production-demand-chart .js-plotly-plot,
.global-hydrogen-production-demand-chart .plot-container,
.global-hydrogen-production-demand-chart .svg-container {
    overflow: visible !important;
}
.global-hydrogen-production-demand-chart .main-svg {
    overflow: visible !important;
}
.global-hydrogen-production-demand-custom-legend {
    position: relative;
    z-index: 60;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px 16px;
    flex-wrap: wrap;
    margin-top: 12px;
    margin-bottom: 8px;
    padding: 0 8px;
    font-family: 'Noto Sans', Arial, sans-serif;
    font-size: 16px;
    line-height: 1.35;
    color: var(--gc-text);
}
.global-hydrogen-production-demand-custom-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
}
.global-hydrogen-production-demand-custom-legend-swatch {
    width: 14px;
    height: 14px;
    display: inline-block;
    flex-shrink: 0;
    border-radius: 2px;
    border: 1px solid rgba(0, 0, 0, 0.15);
}
.global-hydrogen-production-demand-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.global-hydrogen-production-demand-table-wrapper details > summary {
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
    box-sizing: border-box;
}
.global-hydrogen-production-demand-table-wrapper details > summary::-webkit-details-marker { display: none; }
.global-hydrogen-production-demand-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.global-hydrogen-production-demand-table-scrollbar > div { height: 20px; }
.global-hydrogen-production-demand-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #ddd;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.global-hydrogen-production-demand-table-responsive::-webkit-scrollbar { display: none; }
.global-hydrogen-production-demand-table-responsive table { width: max-content !important; min-width: 100%; border-collapse: collapse; }
.global-hydrogen-production-demand-data-table {
    font-family: var(--font-body);
    font-size: 14px;
    color: #000000;
}
.global-hydrogen-production-demand-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.global-hydrogen-production-demand-download-buttons button:hover,
.global-hydrogen-production-demand-clear-selection:hover,
.global-hydrogen-production-demand-table-wrapper summary:hover { background-color: #404040 !important; }
.layout-stacked.global-hydrogen-production-demand-content-row { flex-direction: column !important; }
.layout-stacked .global-hydrogen-production-demand-chart-column {
    width: 100% !important;
    min-width: 0 !important;
}
.layout-stacked .global-hydrogen-production-demand-chart-column-side {
    background-color: transparent;
    padding: 0;
}
.layout-stacked .global-hydrogen-production-demand-chart-column + .global-hydrogen-production-demand-chart-column {
    margin-top: 28px;
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
    .global-hydrogen-production-demand-bullets { font-size: 18px; }
    .global-hydrogen-production-demand-chart-title { font-size: 26px; }
}
            `}</style>

            <div className="global-hydrogen-production-demand-inner">
                <span id="global-hydrogen-production-demand-title" className="wb-inv">
                    {getText('global_hydrogen_production_demand_title', lang)}
                </span>

                <ul className="global-hydrogen-production-demand-bullets">
                    <li>
                        {getText('global_hydrogen_production_demand_bullet1_pre', lang)}
                        <strong>{getText('global_hydrogen_production_demand_bullet1_bold1', lang)}</strong>
                        {getText('global_hydrogen_production_demand_bullet1_mid1', lang)}
                        <strong>{getText('global_hydrogen_production_demand_bullet1_bold2', lang)}</strong>
                        {getText('global_hydrogen_production_demand_bullet1_mid2', lang)}
                        <strong>{getText('global_hydrogen_production_demand_bullet1_bold3', lang)}</strong>
                        {getText('global_hydrogen_production_demand_bullet1_post', lang)}
                    </li>
                    <li>
                        {getText('global_hydrogen_production_demand_bullet2_pre', lang)}
                        <strong>{getText('global_hydrogen_production_demand_bullet2_bold1', lang)}</strong>
                        {getText('global_hydrogen_production_demand_bullet2_mid1', lang)}
                        <strong>{getText('global_hydrogen_production_demand_bullet2_bold2', lang)}</strong>
                        {getText('global_hydrogen_production_demand_bullet2_mid2', lang)}
                        <strong>{getText('global_hydrogen_production_demand_bullet2_bold3', lang)}</strong>
                        {getText('global_hydrogen_production_demand_bullet2_post', lang)}
                    </li>
                </ul>

                <div className={`global-hydrogen-production-demand-content-row ${useStackedLayout ? 'layout-stacked' : ''}`}>
                    {renderChartColumn({
                        kind: 'production',
                        chartTitle: productionChartTitle,
                        chartRef: productionChartRef,
                        pieTrace: productionTrace,
                        chartConfig: productionChartConfig,
                        onPieClick: handleProductionClick,
                        selectedSlices: selectedProductionSlices,
                        onClearSelection: () => setSelectedProductionSlices(null),
                        isTableOpen: isProductionTableOpen,
                        setIsTableOpen: setIsProductionTableOpen,
                        tableTopRef: productionTableTopRef,
                        tableScrollRef: productionTableScrollRef,
                        tableBottomRef: productionTableBottomRef,
                        tableCaptionKey: 'global_hydrogen_production_demand_production_table_caption',
                        tableRows: productionTableRows,
                        fileSlug: productionFileSlug,
                        downloadTitle: productionDownloadTitle,
                        colorsMap: PRODUCTION_COLORS,
                    })}
                    {renderChartColumn({
                        kind: 'demand',
                        chartTitle: demandChartTitle,
                        chartRef: demandChartRef,
                        pieTrace: demandTrace,
                        chartConfig: demandChartConfig,
                        onPieClick: handleDemandClick,
                        selectedSlices: selectedDemandSlices,
                        onClearSelection: () => setSelectedDemandSlices(null),
                        isTableOpen: isDemandTableOpen,
                        setIsTableOpen: setIsDemandTableOpen,
                        tableTopRef: demandTableTopRef,
                        tableScrollRef: demandTableScrollRef,
                        tableBottomRef: demandTableBottomRef,
                        tableCaptionKey: 'global_hydrogen_production_demand_demand_table_caption',
                        tableRows: demandTableRows,
                        fileSlug: demandFileSlug,
                        downloadTitle: demandDownloadTitle,
                        colorsMap: DEMAND_COLORS,
                    })}
                </div>
            </div>
        </main>
    );
};

export default GlobalHydrogenProductionDemand;
