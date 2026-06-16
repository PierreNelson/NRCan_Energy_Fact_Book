import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getPage78Data } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const BAR_KEYS = ['pulping', 'swr', 'firewood', 'pellets'];
const PIE_KEYS = ['industrial', 'electricity', 'residential'];
const BAR_COLORS = {
    pulping: '#2B5C3F',
    swr: '#5E9348',
    firewood: '#A4C639',
    pellets: '#4b4c4d',
};
const PIE_COLORS = {
    industrial: '#2B5C3F',
    electricity: '#A4C639',
    residential: '#5E9348',
};
const PIE_LABEL_KEYS = {
    industrial: 'page78_label_industrial',
    electricity: 'page78_label_electricity',
    residential: 'page78_label_residential',
};
const BAR_LEGEND_KEYS = {
    pulping: 'page78_legend_pulping',
    swr: 'page78_legend_swr',
    firewood: 'page78_legend_firewood',
    pellets: 'page78_legend_pellets',
};

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

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    }
    return hex;
};

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

/** ~400% browser zoom — same DPR band as Page138. */
const PAGE78_VERTICAL_TICK_ZOOM_MIN = 3.55;
const PAGE78_VERTICAL_TICK_ZOOM_MAX = 5.45;
const LIKELY_OS_DPR_BASES = [1, 1.25, 1.3333333333333333, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5];

function isZoomRatioInPage78VerticalBand(z) {
    return z >= PAGE78_VERTICAL_TICK_ZOOM_MIN && z <= PAGE78_VERTICAL_TICK_ZOOM_MAX;
}

function isBrowserZoomInPage78VerticalRange() {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    return LIKELY_OS_DPR_BASES.some((b) => {
        const z = dpr / b;
        return isZoomRatioInPage78VerticalBand(z);
    });
}

function isPinchScaleInPage78VerticalBand(s) {
    return typeof s === 'number' && s > 1.02 && isZoomRatioInPage78VerticalBand(s);
}

const markerOpacityFor = (selectedPoints, length, traceIndex) => {
    if (selectedPoints === null) return 1;
    return Array.from({ length }, (_, i) => (selectedPoints[traceIndex]?.includes(i) ? 1 : 0.3));
};

const Page78 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedBarPoints, setSelectedBarPoints] = useState(null);
    const [selectedPieSlices, setSelectedPieSlices] = useState(null);
    const [isBarTableOpen, setIsBarTableOpen] = useState(false);
    const [isPieTableOpen, setIsPieTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [useVerticalBarTicks, setUseVerticalBarTicks] = useState(false);

    const barChartRef = useRef(null);
    const pieChartRef = useRef(null);
    const barTableTopRef = useRef(null);
    const barTableScrollRef = useRef(null);
    const barTableBottomRef = useRef(null);
    const pieTableTopRef = useRef(null);
    const pieTableScrollRef = useRef(null);
    const pieTableBottomRef = useRef(null);
    const barLastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
    const pieLastClickRef = useRef({ time: 0, index: null });

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    const formatPj = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    useEffect(() => {
        getPage78Data()
            .then(setResult)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const syncViewport = () => {
            setWindowWidth(window.innerWidth);
            const s = window.visualViewport?.scale ?? 1;
            const pinchVertical = isPinchScaleInPage78VerticalBand(s);
            setUseVerticalBarTicks(pinchVertical || isBrowserZoomInPage78VerticalRange());
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

    const tableRows = result?.data || [];
    const years = tableRows.map((row) => row.year);
    const startYear = result?.startYear;
    const endYear = result?.endYear;
    const referenceYear = result?.referenceYear;
    const pieYear = referenceYear;
    const pieRow = pieYear == null ? null : tableRows.find((row) => row.year === pieYear) || null;
    const yearTicks = years.filter((y) => y % 2 === 1);

    const barChartTitle = substitute(getText('page78_bar_chart_title', lang), { year: endYear ?? '' });
    const pieChartTitle = substitute(getText('page78_pie_chart_title', lang), { year: pieYear ?? '' });
    const barFileTitle = `${getText('page78_download_bar_title', lang)}_${startYear}-${endYear}`;
    const pieFileTitle = `${getText('page78_download_pie_title', lang)}_${pieYear ?? ''}`;

    const barPlotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const piePlotHeight = windowWidth <= 480 ? 430 : 520;
    const zoomLegendMode = windowWidth <= 800;
    const pieTextSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 17;

    const setupChartAccessibility = useCallback((chartRef) => {
        if (!chartRef?.current) return;
        const plotContainer = chartRef.current;
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
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            setupChartAccessibility(barChartRef);
            setupChartAccessibility(pieChartRef);
        }, 500);
        const observers = [barChartRef, pieChartRef].map((ref) => {
            if (!ref.current) return null;
            const observer = new MutationObserver(() => setupChartAccessibility(ref));
            observer.observe(ref.current, { childList: true, subtree: true });
            return observer;
        });
        return () => {
            clearTimeout(timer);
            observers.forEach((observer) => observer?.disconnect());
        };
    }, [lang, loading, error, result, setupChartAccessibility]);

    const syncTableScroll = useCallback((topRef, tableRef, bottomRef) => {
        const topScroll = topRef.current;
        const tableScroll = tableRef.current;
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

    const syncBarTableScroll = useCallback(
        () => syncTableScroll(barTableTopRef, barTableScrollRef, barTableBottomRef),
        [syncTableScroll],
    );
    const syncPieTableScroll = useCallback(
        () => syncTableScroll(pieTableTopRef, pieTableScrollRef, pieTableBottomRef),
        [syncTableScroll],
    );

    useEffect(() => {
        const topScroll = barTableTopRef.current;
        const tableScroll = barTableScrollRef.current;
        const bottomScroll = barTableBottomRef.current;
        if (!topScroll || !tableScroll || !bottomScroll || !isBarTableOpen) return;

        const syncFrom = (source) => {
            if (source !== topScroll && topScroll.scrollLeft !== source.scrollLeft) topScroll.scrollLeft = source.scrollLeft;
            if (source !== tableScroll && tableScroll.scrollLeft !== source.scrollLeft) tableScroll.scrollLeft = source.scrollLeft;
            if (source !== bottomScroll && bottomScroll.scrollLeft !== source.scrollLeft) bottomScroll.scrollLeft = source.scrollLeft;
        };

        const handleTopScroll = () => syncFrom(topScroll);
        const handleTableScroll = () => syncFrom(tableScroll);
        const handleBottomScroll = () => syncFrom(bottomScroll);
        const sync = () => window.requestAnimationFrame(syncBarTableScroll);

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
    }, [isBarTableOpen, windowWidth, syncBarTableScroll]);

    useEffect(() => {
        const topScroll = pieTableTopRef.current;
        const tableScroll = pieTableScrollRef.current;
        const bottomScroll = pieTableBottomRef.current;
        if (!topScroll || !tableScroll || !bottomScroll || !isPieTableOpen) return;

        const syncFrom = (source) => {
            if (source !== topScroll && topScroll.scrollLeft !== source.scrollLeft) topScroll.scrollLeft = source.scrollLeft;
            if (source !== tableScroll && tableScroll.scrollLeft !== source.scrollLeft) tableScroll.scrollLeft = source.scrollLeft;
            if (source !== bottomScroll && bottomScroll.scrollLeft !== source.scrollLeft) bottomScroll.scrollLeft = source.scrollLeft;
        };

        const handleTopScroll = () => syncFrom(topScroll);
        const handleTableScroll = () => syncFrom(tableScroll);
        const handleBottomScroll = () => syncFrom(bottomScroll);
        const sync = () => window.requestAnimationFrame(syncPieTableScroll);

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
    }, [isPieTableOpen, windowWidth, syncPieTableScroll]);

    const toggleBarSelection = useCallback((traceIndex, pointIndex) => {
        if (windowWidth <= 768) {
            const currentTime = Date.now();
            const lastClick = barLastClickRef.current;
            const isSamePoint =
                traceIndex === lastClick.traceIndex
                && pointIndex === lastClick.pointIndex
                && lastClick.traceIndex != null;
            const isDoubleTap = isSamePoint && currentTime - lastClick.time < 300;
            barLastClickRef.current = { time: currentTime, traceIndex, pointIndex };
            if (!isDoubleTap) return;
        }

        setSelectedBarPoints((prev) => {
            if (prev === null) {
                const newSelection = BAR_KEYS.map(() => []);
                newSelection[traceIndex].push(pointIndex);
                return newSelection;
            }
            const isSelected = prev[traceIndex]?.includes(pointIndex);
            if (isSelected) {
                const newSelection = prev.map((tracePoints, idx) =>
                    idx === traceIndex ? tracePoints.filter((p) => p !== pointIndex) : [...tracePoints],
                );
                return newSelection.every((arr) => arr.length === 0) ? null : newSelection;
            }
            return prev.map((tracePoints, idx) =>
                idx === traceIndex ? [...tracePoints, pointIndex] : [...tracePoints],
            );
        });
    }, [windowWidth]);

    const togglePieSelection = useCallback((sliceIndex) => {
        if (windowWidth <= 768) {
            const currentTime = Date.now();
            const lastClick = pieLastClickRef.current;
            const isSamePoint = sliceIndex === lastClick.index && lastClick.index != null;
            const isDoubleTap = isSamePoint && currentTime - lastClick.time < 300;
            pieLastClickRef.current = { time: currentTime, index: sliceIndex };
            if (!isDoubleTap) return;
        }

        setSelectedPieSlices((prev) => {
            if (prev === null) return [sliceIndex];
            if (prev.includes(sliceIndex)) {
                const next = prev.filter((i) => i !== sliceIndex);
                return next.length ? next : null;
            }
            return [...prev, sliceIndex];
        });
    }, [windowWidth]);

    const bindPlotClickHandler = useCallback((graphDiv, handler, storageKey) => {
        if (!graphDiv?.on) return;
        if (graphDiv[storageKey]) {
            graphDiv.removeListener('plotly_click', graphDiv[storageKey]);
        }
        graphDiv[storageKey] = handler;
        graphDiv.on('plotly_click', handler);
    }, []);

    const handleBarClick = useCallback((event) => {
        const point = event?.points?.[0];
        if (!point) return;
        const traceIndex = point.curveNumber;
        const pointIndex = point.pointIndex;
        if (traceIndex == null || traceIndex < 0 || traceIndex >= BAR_KEYS.length) return;
        if (pointIndex == null || pointIndex < 0) return;
        toggleBarSelection(traceIndex, pointIndex);
    }, [toggleBarSelection]);

    const handlePieClick = useCallback((event) => {
        const point = event?.points?.[0];
        if (!point) return;
        const sliceIndex = point.pointNumber ?? point.pointIndex;
        if (sliceIndex == null || sliceIndex < 0) return;
        togglePieSelection(sliceIndex);
    }, [togglePieSelection]);

    const onBarInitialized = useCallback(
        (_figure, graphDiv) => bindPlotClickHandler(graphDiv, handleBarClick, '_page78BarClick'),
        [bindPlotClickHandler, handleBarClick],
    );

    const onPieInitialized = useCallback(
        (_figure, graphDiv) => bindPlotClickHandler(graphDiv, handlePieClick, '_page78PieClick'),
        [bindPlotClickHandler, handlePieClick],
    );

    const hoverUnit = lang === 'en' ? ' PJ' : ' PJ';

    const barTraces = BAR_KEYS.map((key, traceIndex) => {
        const label = getText(BAR_LEGEND_KEYS[key], lang);
        const values = tableRows.map((row) => row[key]);
        const opacities = markerOpacityFor(selectedBarPoints, values.length, traceIndex);
        return {
            type: 'bar',
            name: label,
            x: years,
            y: values,
            marker: {
                color: BAR_COLORS[key],
                opacity: opacities,
                line: { width: 0 },
            },
            hovertemplate: `<b>${label}</b><br>%{x}: %{customdata}${hoverUnit}<extra></extra>`,
            customdata: values.map((value) => formatPj(value)),
            hoverlabel: HOVER_LABEL,
        };
    });

    const pieCategories = pieRow?.pieSlices?.length
        ? PIE_KEYS.map((key) => pieRow.pieSlices.find((slice) => slice.key === key)).filter(Boolean)
        : [];
    const effectivePieSlices = windowWidth > 768 ? selectedPieSlices : null;
    const pieBaseColors = pieCategories.map((slice) => PIE_COLORS[slice.key]);
    const pieColors = effectivePieSlices?.length
        ? pieBaseColors.map((color, index) => (effectivePieSlices.includes(index) ? color : hexToRgba(color, 0.3)))
        : pieBaseColors;
    const pieValues = pieCategories.map((slice) => (slice.pj != null && slice.pj > 0 ? slice.pj : 0.001));

    const pieTrace = pieCategories.length ? {
        type: 'pie',
        values: pieValues,
        labels: pieCategories.map((slice) => getText(PIE_LABEL_KEYS[slice.key], lang)),
        customdata: pieCategories.map((slice) => slice.pct),
        hole: 0.55,
        direction: 'clockwise',
        sort: false,
        texttemplate: windowWidth <= 768 ? '%{customdata:.0f}%' : '%{label}<br>%{customdata:.0f}%',
        textinfo: windowWidth <= 768 ? 'percent' : 'label+percent',
        textposition: windowWidth <= 768 ? 'inside' : 'outside',
        textfont: { size: pieTextSize, family: 'Arial, sans-serif', color: windowWidth <= 768 ? '#ffffff' : pieColors },
        outsidetextfont: { size: pieTextSize, color: pieColors },
        marker: { colors: pieColors, line: { color: '#ffffff', width: 1 } },
        pull: effectivePieSlices?.length
            ? pieValues.map((_, index) => (effectivePieSlices.includes(index) ? 0.08 : 0.02))
            : pieValues.map(() => 0.02),
        hovertext: pieCategories.map((slice) => {
            const label = getText(PIE_LABEL_KEYS[slice.key], lang);
            return `<b>${label}</b><br>${formatPj(slice.pj)} PJ<br>${slice.pct ?? '—'}%`;
        }),
        hoverinfo: 'text',
        hoverlabel: HOVER_LABEL,
        automargin: true,
    } : null;

    const barBottomMargin = useVerticalBarTicks
        ? windowWidth <= 480
            ? 88
            : windowWidth <= 768
              ? 78
              : 68
        : windowWidth <= 480
          ? 72
          : 62;

    const barLayout = {
        barmode: 'stack',
        showlegend: false,
        hoverlabel: HOVER_LABEL,
        hovermode: 'closest',
        margin: { t: 20, b: barBottomMargin, l: 70, r: 20 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        height: barPlotHeight,
        xaxis: {
            type: 'category',
            tickmode: 'array',
            tickvals: yearTicks,
            ticktext: yearTicks.map(String),
            tickfont: tickFont,
            tickangle: useVerticalBarTicks ? 90 : 0,
            automargin: true,
            showline: true,
            linecolor: '#333',
            linewidth: 1,
            mirror: false,
            showgrid: false,
        },
        yaxis: {
            title: { text: getText('page78_yaxis', lang), font: axisTitleFont, standoff: 12 },
            range: [0, 600],
            dtick: 100,
            tickfont: tickFont,
            showline: true,
            linecolor: '#333',
            linewidth: 1,
            mirror: false,
            showgrid: false,
        },
        clickmode: 'event',
        dragmode: windowWidth <= 768 ? false : 'zoom',
    };

    const pieLayout = {
        showlegend: zoomLegendMode,
        legend: zoomLegendMode ? {
            orientation: 'h',
            y: -0.12,
            x: 0.5,
            xanchor: 'center',
            yanchor: 'top',
            font: { size: 11 },
            itemclick: false,
            itemdoubleclick: false,
        } : undefined,
        margin: {
            t: 20,
            b: zoomLegendMode ? 120 : 70,
            l: windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 80,
            r: windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 190,
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        height: piePlotHeight,
        clickmode: 'event',
        dragmode: false,
        annotations: pieRow?.total != null ? [{
            text: `${getText('page78_center_total', lang)}<br><b>${formatPj(pieRow.total)}</b><br>PJ`,
            showarrow: false,
            x: 0.5,
            y: 0.5,
            xref: 'paper',
            yref: 'paper',
            font: { size: windowWidth <= 480 ? 15 : 20, color: '#424243', family: 'Arial Black, sans-serif' },
        }] : [],
    };

    const downloadChartPng = async (plotRef, title, filename) => {
        const plotEl = plotRef.current?.querySelector('.js-plotly-plot');
        if (!plotEl || !window.Plotly) return;
        try {
            await window.Plotly.relayout(plotEl, { paper_bgcolor: '#ffffff', plot_bgcolor: '#ffffff' });
            const imgData = await window.Plotly.toImage(plotEl, { format: 'png', width: 1200, height: 800, scale: 2 });
            await window.Plotly.relayout(plotEl, { paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)' });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                const titleHeight = 70;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#26374a';
                ctx.font = 'bold 24px "Noto Sans", Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(stripHtml(title), canvas.width / 2, 44);
                ctx.drawImage(img, 0, titleHeight);
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = `${filename}.png`;
                link.click();
            };
            img.src = imgData;
        } catch (err) {
            console.warn('Unable to download Page 78 chart image.', err);
        }
    };

    const barTableHeaders = [
        getText('page78_table_col_year', lang),
        ...BAR_KEYS.map((key) => `${getText(BAR_LEGEND_KEYS[key], lang)} (PJ)`),
        getText('page78_table_col_total', lang),
    ];

    const pieTableHeaders = [
        getText('page78_table_col_year', lang),
        getText('page78_table_col_total', lang),
        ...PIE_KEYS.map((key) => `${getText(PIE_LABEL_KEYS[key], lang)} (PJ)`),
        ...PIE_KEYS.map((key) => `${getText(PIE_LABEL_KEYS[key], lang)} (%)`),
    ];

    const barTableCells = (row) => [
        row.year,
        ...BAR_KEYS.map((key) => formatPj(row[key])),
        formatPj(row.barTotal),
    ];

    const pieTableCells = (row) => [
        row.year,
        formatPj(row.total),
        ...PIE_KEYS.map((key) => formatPj(row[key])),
        ...PIE_KEYS.map((key) => {
            const slice = row.pieSlices?.find((item) => item.key === key);
            return slice?.pct != null ? `${slice.pct}` : '—';
        }),
    ];

    const downloadBarCsv = () => {
        const rows = tableRows.map((row) => barTableCells(row));
        const csv = [barTableHeaders.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
        saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${barFileTitle}.csv`);
    };

    const downloadPieCsv = () => {
        const rows = tableRows.map((row) => pieTableCells(row));
        const csv = [pieTableHeaders.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
        saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${pieFileTitle}.csv`);
    };

    const downloadBarDocx = async () => {
        const headerRow = new TableRow({
            children: barTableHeaders.map((header) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 22 })], alignment: AlignmentType.CENTER })],
                shading: { fill: 'E6E6E6' },
            })),
        });
        const dataRows = tableRows.map((row) => new TableRow({
            children: barTableCells(row).map((cell, index) => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: String(cell), size: 22 })],
                    alignment: index === 0 ? AlignmentType.CENTER : AlignmentType.RIGHT,
                })],
            })),
        }));
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: substitute(getText('page78_table_caption_bar', lang), { startYear, endYear }), bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [1200, 1800, 2000, 1800, 1800, 1600],
                        rows: [headerRow, ...dataRows],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), `${barFileTitle}.docx`);
    };

    const downloadPieDocx = async () => {
        const headerRow = new TableRow({
            children: pieTableHeaders.map((header) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 22 })], alignment: AlignmentType.CENTER })],
                shading: { fill: 'E6E6E6' },
            })),
        });
        const dataRows = tableRows.map((row) => new TableRow({
            children: pieTableCells(row).map((cell, index) => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: String(cell), size: 22 })],
                    alignment: index === 0 ? AlignmentType.CENTER : AlignmentType.RIGHT,
                })],
            })),
        }));
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: substitute(getText('page78_table_caption_pie', lang), { startYear, endYear }), bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [1000, 1200, 1500, 1500, 1500, 1100, 1100, 1100],
                        rows: [headerRow, ...dataRows],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), `${pieFileTitle}.docx`);
    };

    const barChartConfig = {
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        modeBarButtonsToRemove: MODEBAR_REMOVE,
        modeBarButtonsToAdd: [{
            name: getText('page78_download_bar_png', lang),
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: () => downloadChartPng(barChartRef, barChartTitle, barFileTitle),
        }],
    };

    const pieChartConfig = {
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        modeBarButtonsToRemove: MODEBAR_REMOVE,
        modeBarButtonsToAdd: [{
            name: getText('page78_download_pie_png', lang),
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: () => downloadChartPng(pieChartRef, pieChartTitle, pieFileTitle),
        }],
    };

    const renderDataTable = ({
        captionId,
        caption,
        isOpen,
        setIsOpen,
        topRef,
        tableRef,
        bottomRef,
        headers,
        rows,
        onCsv,
        onDocx,
    }) => (
        <div className="page78-table-wrapper">
            <details className="page78-data-table" open={isOpen} onToggle={(e) => setIsOpen(e.currentTarget.open)}>
                <summary>
                    {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                </summary>
                <p id={captionId} className="wb-inv">{caption}</p>
                <div ref={topRef} className="page78-table-scrollbar" aria-hidden="true"><div /></div>
                <div ref={tableRef} className="page78-table-responsive" role="region" aria-labelledby={captionId}>
                    <table className="table table-striped table-hover">
                        <thead>
                            <tr>
                                {headers.map((header) => <th key={header} scope="col">{header}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.year}>
                                    {row.cells.map((cell, index) => (
                                        <td key={`${row.year}-${index}`}>{cell}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div ref={bottomRef} className="page78-table-scrollbar" aria-hidden="true"><div /></div>
                <div className="page78-download-buttons">
                    <button type="button" onClick={onCsv}>{getText('page78_download_csv', lang)}</button>
                    <button type="button" onClick={onDocx}>{getText('page78_download_docx', lang)}</button>
                </div>
            </details>
        </div>
    );

    if (loading) {
        return <p className="page78-loading">{lang === 'en' ? 'Loading data…' : 'Chargement des données…'}</p>;
    }
    if (error) {
        return <p className="page78-error" role="alert">{error}</p>;
    }
    if (!tableRows.length || !pieRow) {
        return <p className="page78-error">{lang === 'en' ? 'No data available.' : 'Aucune donnée disponible.'}</p>;
    }

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-78"
            role="main"
            aria-labelledby="page78-title"
            style={{
                paddingLeft: layoutPadding?.left || 55,
                paddingRight: layoutPadding?.right || 15,
            }}
        >
            <style>{`
.page78-container { width: 100%; padding: 15px 0 0 0; box-sizing: border-box; }
.page78-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 25px;
    line-height: 1.25;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: none;
}
.page78-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.page78-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 0;
    box-sizing: border-box;
    overflow: visible;
}
.page78-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
}
.page78-chart-scroll { width: 100%; overflow: visible; position: relative; }
.page78-chart { width: 100%; min-width: 0; position: relative; z-index: 1; overflow: visible; }
.page78-chart > div { width: 100%; height: 100%; overflow: visible; }
.page78-chart .js-plotly-plot,
.page78-chart .plot-container,
.page78-chart .svg-container { overflow: visible !important; pointer-events: auto !important; }
.page78-clear-selection {
    padding: 6px 12px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: #fff;
    margin-bottom: 8px;
}
.page78-legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 18px 28px;
    margin-top: 16px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: var(--gc-text);
}
.page78-legend-item { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.page78-legend-swatch { width: 22px; height: 14px; display: inline-block; border: 1px solid rgba(0, 0, 0, 0.12); }
.page78-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.page78-table-wrapper details > summary {
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
.page78-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page78-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page78-table-scrollbar > div { height: 20px; }
.page78-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #ddd;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.page78-table-responsive::-webkit-scrollbar { display: none; }
.page78-table-responsive table { width: max-content !important; min-width: 100%; border-collapse: collapse; }
.page78-table-responsive table.table { font-family: var(--font-body); color: var(--gc-text); }
.page78-table-responsive th, .page78-table-responsive td {
    white-space: nowrap;
    padding: 8px 12px;
    font-family: var(--font-body);
    color: var(--gc-text);
    border: 1px solid #ddd;
}
.page78-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.page78-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.page78-chart-frame button:hover,
.page78-table-wrapper summary:hover,
.page78-download-buttons button:hover { background-color: #404040 !important; }
.page78-loading, .page78-error {
    font-family: 'Noto Sans', sans-serif;
    font-size: 18px;
    color: var(--gc-text);
    margin: 24px 0;
}
@media (max-width: 768px) {
    .page78-title { font-size: 37px; }
    .page78-chart-title { font-size: 26px; }
}
            `}</style>

            <div className="page78-container">
                <h1 id="page78-title" className="page78-title">{getText('page78_title', lang)}</h1>

                <div className="page78-chart-frame" style={{ marginBottom: 24 }}>
                    <h2 id="page78-bar-chart-title" className="page78-chart-title">{barChartTitle}</h2>
                    {selectedBarPoints && (
                        <button type="button" className="page78-clear-selection" onClick={() => setSelectedBarPoints(null)}>
                            {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                        </button>
                    )}
                    <div className="page78-chart-scroll">
                        <div ref={barChartRef} className="page78-chart" role="img" aria-label={barChartTitle}>
                            <Plot
                                key={`page78-bar-${useVerticalBarTicks ? 'v' : 'h'}-${barPlotHeight}`}
                                data={barTraces}
                                layout={barLayout}
                                config={barChartConfig}
                                useResizeHandler
                                style={{ width: '100%', height: '100%' }}
                                onInitialized={onBarInitialized}
                                onUpdate={onBarInitialized}
                            />
                        </div>
                    </div>
                    <div className="page78-legend" aria-hidden="false">
                        {BAR_KEYS.map((key) => (
                            <span key={key} className="page78-legend-item">
                                <span className="page78-legend-swatch" style={{ backgroundColor: BAR_COLORS[key] }} />
                                {getText(BAR_LEGEND_KEYS[key], lang)}
                            </span>
                        ))}
                    </div>
                    {renderDataTable({
                        captionId: 'page78-bar-table-caption',
                        caption: substitute(getText('page78_table_caption_bar', lang), { startYear, endYear }),
                        isOpen: isBarTableOpen,
                        setIsOpen: setIsBarTableOpen,
                        topRef: barTableTopRef,
                        tableRef: barTableScrollRef,
                        bottomRef: barTableBottomRef,
                        headers: barTableHeaders,
                        rows: tableRows.map((row) => ({ year: row.year, cells: barTableCells(row) })),
                        onCsv: downloadBarCsv,
                        onDocx: downloadBarDocx,
                    })}
                </div>

                <div className="page78-chart-frame">
                    <h2 id="page78-pie-chart-title" className="page78-chart-title">{pieChartTitle}</h2>
                    {selectedPieSlices && (
                        <button type="button" className="page78-clear-selection" onClick={() => setSelectedPieSlices(null)}>
                            {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                        </button>
                    )}
                    <div className="page78-chart-scroll">
                        <div ref={pieChartRef} className="page78-chart" role="img" aria-label={pieChartTitle}>
                            {pieTrace && (
                                <Plot
                                    key={`page78-pie-${pieYear}-${zoomLegendMode ? 'compact' : 'wide'}-${effectivePieSlices ? effectivePieSlices.join('-') : 'none'}`}
                                    data={[pieTrace]}
                                    layout={pieLayout}
                                    config={pieChartConfig}
                                    useResizeHandler
                                    style={{ width: '100%', height: '100%' }}
                                    onInitialized={onPieInitialized}
                                    onUpdate={onPieInitialized}
                                />
                            )}
                        </div>
                    </div>
                    {!zoomLegendMode && (
                        <div className="page78-legend" aria-hidden="false">
                            {PIE_KEYS.map((key) => (
                                <span key={key} className="page78-legend-item">
                                    <span className="page78-legend-swatch" style={{ backgroundColor: PIE_COLORS[key] }} />
                                    {getText(PIE_LABEL_KEYS[key], lang)}
                                </span>
                            ))}
                        </div>
                    )}
                    {renderDataTable({
                        captionId: 'page78-pie-table-caption',
                        caption: substitute(getText('page78_table_caption_pie', lang), { startYear, endYear }),
                        isOpen: isPieTableOpen,
                        setIsOpen: setIsPieTableOpen,
                        topRef: pieTableTopRef,
                        tableRef: pieTableScrollRef,
                        bottomRef: pieTableBottomRef,
                        headers: pieTableHeaders,
                        rows: tableRows.map((row) => ({ year: row.year, cells: pieTableCells(row) })),
                        onCsv: downloadPieCsv,
                        onDocx: downloadPieDocx,
                    })}
                </div>
            </div>
        </main>
    );
};

export default Page78;
