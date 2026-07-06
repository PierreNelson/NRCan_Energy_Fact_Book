import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';

const REFERENCE_YEAR = 2023;

const PROVINCE_KEYS = ['alta', 'bc_ter', 'atl', 'que', 'ont', 'man', 'sask'];

const PROVINCE_COLORS = {
    alta: '#7A6F4E',
    bc_ter: '#3CA1AF',
    atl: '#CE8003',
    que: '#657f9b',
    ont: '#4b4c4d',
    man: '#1f8093',
    sask: '#9BA88D',
};

/** Hardcoded snapshot data keyed by year (ready for a future year selector). */
const DATA_BY_YEAR = {
    2023: {
        sectorRows: [
            { key: 'residential', energyUse: 612.2, bcfPerDay: 1.59, pct: 20.4 },
            { key: 'commercial', energyUse: 577.9, bcfPerDay: 1.50, pct: 19.3 },
            { key: 'industrial', energyUse: 1755.9, bcfPerDay: 4.56, pct: 58.5 },
            { key: 'transportation', energyUse: 4.4, bcfPerDay: 0.01, pct: 0.1 },
            { key: 'agriculture', energyUse: 50.4, bcfPerDay: 0.13, pct: 1.7 },
        ],
        sectorTotalEnergy: 3000.8,
        sectorTotalBcf: 7.79,
        provinceTotalEnergy: 3001,
        provinces: [
            { key: 'alta', pct: 43.5 },
            { key: 'bc_ter', pct: 8.0 },
            { key: 'atl', pct: 1.0 },
            { key: 'que', pct: 8.3 },
            { key: 'ont', pct: 28.6 },
            { key: 'man', pct: 2.5 },
            { key: 'sask', pct: 8.0 },
        ],
    },
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

const NaturalGasEnergyUse = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [selectedYear] = useState(REFERENCE_YEAR);
    const [isChartTableOpen, setIsChartTableOpen] = useState(false);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [pageCssZoom, setPageCssZoom] = useState(() => computePageZoomScale(null).pageCssZoom);
    const zoomBaselineRef = useRef(null);

    const chartRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });
    const chartTableTopRef = useRef(null);
    const chartTableScrollRef = useRef(null);
    const chartTableBottomRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const useStackedLayout = pageCssZoom >= STACKED_LAYOUT_DETECTED_ZOOM;
    const selectEnabled = windowWidth > 768;
    const effectiveSelectedSlices = selectEnabled ? selectedSlices : null;

    const yearData = DATA_BY_YEAR[selectedYear] ?? DATA_BY_YEAR[REFERENCE_YEAR];
    const textVars = { year: selectedYear };

    const formatPj = useCallback((value, digits = 1) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        });
    }, [locale]);

    const formatPct = useCallback((value, digits = 1) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        const formatted = Number(value).toLocaleString(locale, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        });
        return lang === 'fr' ? `${formatted} %` : `${formatted}%`;
    }, [lang, locale]);

    const formatBcf = useCallback((value, digits = 2) => {
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

    const provinceSlices = useMemo(() => {
        const total = yearData.provinceTotalEnergy;
        return PROVINCE_KEYS.map((key) => {
            const entry = yearData.provinces.find((row) => row.key === key);
            const pct = entry?.pct ?? 0;
            const value = total > 0 ? Number(((total * pct) / 100).toFixed(1)) : 0;
            return { key, pct, value };
        });
    }, [yearData]);

    const chartTitle = substitute(getText('natural_gas_energy_use_chart_title', lang), textVars);
    const fileSlugBase = substitute(getText('natural_gas_energy_use_download_title', lang), textVars)
        .replace(/\s+/g, '_')
        .replace(/–/g, '-');

    const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18;
    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const useCompactLayout = windowWidth <= 768;

    const pieTrace = useMemo(() => {
        if (!provinceSlices.length) return null;
        const labels = provinceSlices.map((slice) => getText(`natural_gas_energy_use_province_${slice.key}`, lang));
        const values = provinceSlices.map((slice) => (slice.value > 0 ? slice.value : 0.001));
        const customdata = provinceSlices.map((slice) => slice.pct);
        const baseColors = provinceSlices.map((slice) => PROVINCE_COLORS[slice.key]);
        const markerColors = effectiveSelectedSlices?.length
            ? baseColors.map((color, index) => (effectiveSelectedSlices.includes(index) ? color : hexToRgba(color, 0.3)))
            : baseColors;
        const labelColors = markerColors;
        const pull = effectiveSelectedSlices?.length
            ? values.map((_, index) => (effectiveSelectedSlices.includes(index) ? 0.08 : 0.02))
            : values.map(() => 0.02);
        const hoverTexts = provinceSlices.map((slice) => {
            const label = getText(`natural_gas_energy_use_province_${slice.key}`, lang);
            return `<b>${label}</b><br>${formatPj(slice.value, 1)} PJ<br>${formatPct(slice.pct, 1)}`;
        });

        return {
            type: 'pie',
            values,
            labels,
            customdata,
            hole: 0.55,
            direction: 'clockwise',
            sort: false,
            texttemplate: useCompactLayout ? '%{customdata:.1f}%' : '%{label}<br>%{customdata:.1f}%',
            textinfo: useCompactLayout ? 'percent' : 'label+percent',
            textposition: useCompactLayout ? 'inside' : 'outside',
            textfont: {
                size: textSize,
                family: 'Arial, sans-serif',
                color: useCompactLayout ? '#ffffff' : labelColors,
            },
            outsidetextfont: { size: textSize, color: labelColors },
            insidetextfont: { color: '#ffffff', size: textSize, family: 'Arial, sans-serif' },
            marker: { colors: markerColors, line: { color: '#ffffff', width: 1 } },
            pull,
            hovertext: hoverTexts,
            hoverinfo: 'text',
            hoverlabel: {
                bgcolor: '#ffffff',
                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
            },
            automargin: true,
        };
    }, [provinceSlices, lang, textSize, useCompactLayout, effectiveSelectedSlices, formatPj, formatPct]);

    const centerTotal = Math.round(yearData.provinceTotalEnergy);
    const centerLabel = getText('natural_gas_energy_use_center_total', lang);
    const centerText = `${centerLabel}<br><b>${formatPj(centerTotal, 0)}</b><br>PJ`;

    const tableTitle = substitute(getText('natural_gas_energy_use_table_title', lang), textVars);

    const summaryFileSlug = lang === 'en'
        ? `natural_gas_energy_use_by_sector_${selectedYear}`
        : `consommation_gaz_naturel_par_secteur_${selectedYear}`;

    const sectorCellFontSize = pageCssZoom >= 4 ? '0.55rem'
        : pageCssZoom >= 3 ? '0.65rem'
        : pageCssZoom >= 2 ? '0.75rem'
        : pageCssZoom >= 1.5 ? '0.85rem'
        : '1rem';

    const centerFontSize = useMemo(() => {
        const base = useCompactLayout
            ? (windowWidth <= 480 ? 14 : windowWidth <= 640 ? 16 : 18)
            : 22;
        if (pageCssZoom >= 5) return Math.min(base, 9);
        if (pageCssZoom >= 4) return Math.min(base, 11);
        if (pageCssZoom >= 3) return Math.min(base, 13);
        if (pageCssZoom >= 2) return Math.min(base, 16);
        if (pageCssZoom >= 1.5) return Math.min(base, 18);
        return base;
    }, [useCompactLayout, windowWidth, pageCssZoom]);

    const plotLayout = useMemo(() => {
        const legendConfig = useCompactLayout ? (
            windowWidth <= 384
                ? { orientation: 'h', y: -0.5, x: 0.5, xanchor: 'center', yanchor: 'top', font: { size: 9 }, itemclick: false, itemdoubleclick: false }
                : windowWidth <= 480
                    ? { orientation: 'h', y: -0.15, x: 0.5, xanchor: 'center', yanchor: 'top', font: { size: 9 }, itemclick: false, itemdoubleclick: false }
                    : windowWidth <= 640
                        ? { orientation: 'h', y: -0.15, x: 0.5, xanchor: 'center', yanchor: 'top', font: { size: 10 }, itemclick: false, itemdoubleclick: false }
                        : { orientation: 'h', y: -0.12, x: 0.5, xanchor: 'center', yanchor: 'top', font: { size: 11 }, itemclick: false, itemdoubleclick: false }
        ) : undefined;

        const margin = useCompactLayout
            ? (windowWidth <= 384 ? { l: 8, r: 8, t: 16, b: 120 } : windowWidth <= 480 ? { l: 8, r: 8, t: 16, b: 100 } : { l: 8, r: 8, t: 16, b: 90 })
            : { l: 40, r: 40, t: 24, b: 40 };

        return {
            showlegend: useCompactLayout,
            legend: legendConfig,
            margin,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            autosize: true,
            clickmode: 'event',
            annotations: [{
                x: 0.5,
                y: 0.5,
                text: centerText,
                showarrow: false,
                xref: 'paper',
                yref: 'paper',
                font: {
                    size: centerFontSize,
                    color: '#424243',
                    family: 'Arial Black, sans-serif',
                },
            }],
        };
    }, [centerText, centerFontSize, useCompactLayout, windowWidth]);

    const chartTableHeaders = useMemo(() => [
        getText('natural_gas_energy_use_table_col_province', lang),
        getText('natural_gas_energy_use_table_col_energy', lang),
        getText('natural_gas_energy_use_table_col_share', lang),
    ], [lang]);

    const chartTableRows = useMemo(
        () => provinceSlices.map((slice) => ({
            key: slice.key,
            label: getText(`natural_gas_energy_use_province_${slice.key}`, lang),
            energyUse: slice.value,
            pct: slice.pct,
        })),
        [provinceSlices, lang],
    );

    const handlePieClick = useCallback(
        (data) => {
            if (!data?.points?.length) return;
            const sliceIndex = data.points[0].pointNumber ?? data.points[0].pointIndex;
            if (sliceIndex === undefined || sliceIndex < 0) return;

            if (windowWidth <= 768) {
                const currentTime = Date.now();
                const lastClick = lastPieClickRef.current;
                const isSameSlice = sliceIndex === lastClick.index && lastClick.index != null;
                const isDoubleTap = isSameSlice && currentTime - lastClick.time < 300;
                lastPieClickRef.current = { time: currentTime, index: sliceIndex };
                if (!isDoubleTap) return;
            }

            setSelectedSlices((prev) => {
                if (prev === null) return [sliceIndex];
                if (prev.includes(sliceIndex)) {
                    const next = prev.filter((index) => index !== sliceIndex);
                    return next.length === 0 ? null : next;
                }
                return [...prev, sliceIndex];
            });
        },
        [windowWidth],
    );

    const downloadChartPng = async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
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
                ctx.fillText(chartTitle, canvas.width / 2, 48);
                ctx.drawImage(img, 0, titleHeight);
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
            [row.label, formatPj(row.energyUse, 1), formatPct(row.pct, 1)].map(csvEscape).join(','),
        );
        saveAs(new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' }), `${fileSlugBase}.csv`);
    };

    const downloadSummaryTableAsCSV = () => {
        const headers = [
            getText('natural_gas_energy_use_summary_col_sector', lang),
            getText('natural_gas_energy_use_summary_col_energy', lang),
            getText('natural_gas_energy_use_summary_col_bcf', lang),
            getText('natural_gas_energy_use_summary_col_share', lang),
        ];
        const rows = yearData.sectorRows.map((row) => [
            getText(`natural_gas_energy_use_sector_${row.key}`, lang),
            formatPj(row.energyUse, 1),
            formatBcf(row.bcfPerDay, 2),
            formatPct(row.pct, 1),
        ]);
        rows.push([
            getText('natural_gas_energy_use_sector_total', lang),
            formatPj(yearData.sectorTotalEnergy, 1),
            formatBcf(yearData.sectorTotalBcf, 2),
            formatPct(100, 0),
        ]);
        const lines = [headers.map(csvEscape).join(',')];
        rows.forEach((row) => lines.push(row.map(csvEscape).join(',')));
        saveAs(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' }), `${summaryFileSlug}.csv`);
    };

    const downloadSummaryTableAsDocx = async () => {
        const headerBg = '423330';
        const headerRow = new TableRow({
            children: [
                getText('natural_gas_energy_use_summary_col_sector', lang),
                getText('natural_gas_energy_use_summary_col_energy', lang),
                getText('natural_gas_energy_use_summary_col_bcf', lang),
                getText('natural_gas_energy_use_summary_col_share', lang),
            ].map((header) =>
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 18, color: 'FFFFFF' })] })],
                    shading: { fill: headerBg },
                }),
            ),
        });
        const bodyRows = [
            ...yearData.sectorRows.map((row) => ({
                label: getText(`natural_gas_energy_use_sector_${row.key}`, lang),
                energyUse: formatPj(row.energyUse, 1),
                bcfPerDay: formatBcf(row.bcfPerDay, 2),
                pct: formatPct(row.pct, 1),
                isTotal: false,
            })),
            {
                label: getText('natural_gas_energy_use_sector_total', lang),
                energyUse: formatPj(yearData.sectorTotalEnergy, 1),
                bcfPerDay: formatBcf(yearData.sectorTotalBcf, 2),
                pct: formatPct(100, 0),
                isTotal: true,
            },
        ];
        const dataRows = bodyRows.map((row, rowIndex) =>
            new TableRow({
                children: [row.label, row.energyUse, row.bcfPerDay, row.pct].map((value, index) =>
                    new TableCell({
                        shading: row.isTotal || index === 0 ? { fill: headerBg } : (rowIndex % 2 === 0 ? { fill: '9E9897' } : undefined),
                        children: [
                            new Paragraph({
                                children: [new TextRun({
                                    text: String(value),
                                    size: 18,
                                    bold: row.isTotal || index === 0,
                                    color: row.isTotal || index === 0 ? 'FFFFFF' : '000000',
                                })],
                                alignment: index === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
                            }),
                        ],
                    }),
                ),
            }),
        );
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: tableTitle, bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [3200, 1800, 1800, 1600],
                        rows: [headerRow, ...dataRows],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), `${summaryFileSlug}.docx`);
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
                        row.label,
                        formatPj(row.energyUse, 1),
                        formatPct(row.pct, 1),
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
                                    text: substitute(getText('natural_gas_energy_use_table_caption', lang), textVars),
                                    bold: true,
                                    size: 28,
                                }),
                            ],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [4200, 2200, 1800],
                            rows: [headerRow, ...dataRows],
                        }),
                    ],
                },
            ],
        });
        saveAs(await Packer.toBlob(doc), `${fileSlugBase}.docx`);
    };

    const chartSummary = lang === 'en'
        ? `Donut chart showing natural gas energy use by province in ${selectedYear}. Total energy use was ${formatPj(centerTotal, 0)} petajoules.`
        : `Graphique en anneau montrant la consommation de gaz naturel par province en ${selectedYear}. La consommation totale était de ${formatPj(centerTotal, 0)} pétajoules.`;

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content natural-gas-energy-use"
            role="main"
            aria-labelledby="natural-gas-energy-use-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.natural-gas-energy-use {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.natural-gas-energy-use-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.natural-gas-energy-use.page-content h1.natural-gas-energy-use-title {
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
.natural-gas-energy-use.page-content h1.natural-gas-energy-use-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.natural-gas-energy-use-content-row {
    display: flex;
    flex-direction: row;
    width: 100%;
    gap: 28px;
    align-items: stretch;
}
.natural-gas-energy-use-table-column {
    width: 42%;
    min-width: 260px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
}
.natural-gas-energy-use-table-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}
.natural-gas-energy-use-table-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow-wrap: break-word;
    word-wrap: break-word;
    line-height: 1.2;
}
.natural-gas-energy-use-summary-table-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
}
.natural-gas-energy-use-chart-column {
    width: 58%;
    min-width: 0;
    box-sizing: border-box;
}
.natural-gas-energy-use-summary-table {
    width: 100%;
    height: 100%;
    border-collapse: collapse;
    font-family: Arial, sans-serif;
    font-size: 0.9rem;
    table-layout: fixed;
}
.natural-gas-energy-use-summary-table th,
.natural-gas-energy-use-summary-table td {
    border: 1px solid #ddd;
    padding: 8px 12px;
    text-align: center;
}
.natural-gas-energy-use-summary-table thead th {
    background-color: #423330;
    color: white;
    font-weight: bold;
    font-size: 1.05rem;
}
.natural-gas-energy-use-summary-table .natural-gas-energy-use-sector-cell {
    text-align: left;
    background-color: #423330;
    color: white;
    font-weight: bold;
    font-size: ${sectorCellFontSize};
    white-space: normal;
    overflow-wrap: anywhere;
    word-wrap: break-word;
    hyphens: auto;
    vertical-align: middle;
    line-height: 1.2;
}
.natural-gas-energy-use-summary-table tbody tr:nth-child(even):not(.natural-gas-energy-use-summary-total-row) {
    background-color: #42333080;
}
.natural-gas-energy-use-summary-table tbody tr:hover:not(.natural-gas-energy-use-summary-total-row) {
    box-shadow: inset 0 0 0 9999px rgba(0, 0, 0, 0.2);
    background-color: transparent;
}
.natural-gas-energy-use-summary-table tbody {
    height: 100%;
}
.natural-gas-energy-use-summary-table tbody tr {
    height: calc(100% / 7);
}
.natural-gas-energy-use-summary-table tbody td {
    vertical-align: middle;
}
.natural-gas-energy-use-summary-total-row td,
.natural-gas-energy-use-summary-total-row th:not(.natural-gas-energy-use-sector-cell) {
    background-color: #423330;
    color: white;
    font-weight: bold;
}
.natural-gas-energy-use-summary-total-row .natural-gas-energy-use-sector-cell {
    background-color: #423330;
    color: white;
}
.natural-gas-energy-use-summary-download-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 15px;
}
.natural-gas-energy-use-summary-download-buttons button {
    padding: 8px 16px;
    background-color: #8c8c8c;
    border: 1px solid #404040;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.natural-gas-energy-use-summary-download-buttons button:hover {
    background-color: #404040 !important;
}
.natural-gas-energy-use-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    box-sizing: border-box;
    overflow: visible;
}
.natural-gas-energy-use-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
}
.natural-gas-energy-use-chart { width: 100%; min-width: 0; height: ${plotHeight}px; position: relative; }
.natural-gas-energy-use-chart > div { width: 100%; height: 100%; }
.natural-gas-energy-use-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.natural-gas-energy-use-table-wrapper details > summary {
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
.natural-gas-energy-use-table-wrapper details > summary::-webkit-details-marker { display: none; }
.natural-gas-energy-use-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.natural-gas-energy-use-table-scrollbar > div { height: 20px; }
.natural-gas-energy-use-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #ddd;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.natural-gas-energy-use-table-responsive::-webkit-scrollbar { display: none; }
.natural-gas-energy-use-table-responsive table { width: max-content !important; min-width: 100%; border-collapse: collapse; }
.natural-gas-energy-use-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.natural-gas-energy-use-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.natural-gas-energy-use-table-wrapper summary:hover,
.natural-gas-energy-use-download-buttons button:hover,
.natural-gas-energy-use-chart-frame button[type="button"]:hover { background-color: #404040 !important; }
.layout-stacked.natural-gas-energy-use-content-row { flex-direction: column !important; }
.layout-stacked .natural-gas-energy-use-table-column,
.layout-stacked .natural-gas-energy-use-chart-column { width: 100% !important; min-width: 0 !important; }
.layout-stacked .natural-gas-energy-use-table-column { margin-bottom: 28px; }
.layout-stacked .natural-gas-energy-use-summary-table tbody tr { height: auto; }
@media (max-width: 768px) {
    .natural-gas-energy-use.page-content h1.natural-gas-energy-use-title { font-size: 37px !important; }
    .natural-gas-energy-use-table-title { font-size: 26px; }
    .natural-gas-energy-use-chart-title { font-size: 26px; }
    .natural-gas-energy-use-summary-table { font-size: 0.75rem; }
    .natural-gas-energy-use-summary-table tbody tr { height: auto; }
}
@media (max-width: 992px) {
    .natural-gas-energy-use-summary-table { font-size: 0.75rem; }
    .natural-gas-energy-use-summary-table th,
    .natural-gas-energy-use-summary-table td { padding: 6px 8px; }
}
            `}</style>

            <div className="natural-gas-energy-use-inner">
                <h1 id="natural-gas-energy-use-title" className="natural-gas-energy-use-title">
                    {getText('natural_gas_energy_use_title', lang)}
                </h1>

                <div className={`natural-gas-energy-use-content-row ${useStackedLayout ? 'layout-stacked' : ''}`}>
                    <section className="natural-gas-energy-use-table-column" aria-labelledby="natural-gas-energy-use-table-title">
                        <div className="natural-gas-energy-use-table-panel">
                            <h2 id="natural-gas-energy-use-table-title" className="natural-gas-energy-use-table-title">
                                {tableTitle}
                            </h2>
                            <div className="natural-gas-energy-use-summary-table-wrap">
                                <table className="natural-gas-energy-use-summary-table">
                                    <colgroup>
                                        <col style={{ width: '34%' }} />
                                        <col style={{ width: '22%' }} />
                                        <col style={{ width: '22%' }} />
                                        <col style={{ width: '22%' }} />
                                    </colgroup>
                                    <caption id="natural-gas-energy-use-summary-caption" className="wb-inv">
                                        {substitute(getText('natural_gas_energy_use_summary_table_caption', lang), textVars)}
                                    </caption>
                                    <thead>
                                        <tr>
                                            <th scope="col">{getText('natural_gas_energy_use_summary_col_sector', lang)}</th>
                                            <th scope="col">{getText('natural_gas_energy_use_summary_col_energy', lang)}</th>
                                            <th scope="col">{getText('natural_gas_energy_use_summary_col_bcf', lang)}</th>
                                            <th scope="col">{getText('natural_gas_energy_use_summary_col_share', lang)}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {yearData.sectorRows.map((row) => (
                                            <tr key={row.key}>
                                                <th scope="row" className="natural-gas-energy-use-sector-cell">
                                                    {getText(`natural_gas_energy_use_sector_${row.key}`, lang)}
                                                </th>
                                                <td>{formatPj(row.energyUse, 1)}</td>
                                                <td>{formatBcf(row.bcfPerDay, 2)}</td>
                                                <td>{formatPct(row.pct, 1)}</td>
                                            </tr>
                                        ))}
                                        <tr className="natural-gas-energy-use-summary-total-row">
                                            <th scope="row" className="natural-gas-energy-use-sector-cell">
                                                {getText('natural_gas_energy_use_sector_total', lang)}
                                            </th>
                                            <td>{formatPj(yearData.sectorTotalEnergy, 1)}</td>
                                            <td>{formatBcf(yearData.sectorTotalBcf, 2)}</td>
                                            <td>{formatPct(100, 0)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div className="natural-gas-energy-use-summary-download-buttons">
                                <button type="button" onClick={downloadSummaryTableAsCSV}>
                                    {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                </button>
                                <button type="button" onClick={downloadSummaryTableAsDocx}>
                                    {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                </button>
                            </div>
                        </div>
                    </section>

                    <section className="natural-gas-energy-use-chart-column" aria-labelledby="natural-gas-energy-use-chart-title">
                        <div className="natural-gas-energy-use-chart-frame">
                            <h2 id="natural-gas-energy-use-chart-title" className="natural-gas-energy-use-chart-title">
                                {chartTitle}
                            </h2>

                            {effectiveSelectedSlices != null && (
                                <div style={{ marginBottom: 8 }}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedSlices(null)}
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

                            <figure ref={chartRef} className="natural-gas-energy-use-chart-figure" style={{ margin: 0 }}>
                                {pieTrace && (
                                    <Plot
                                        key={`natural-gas-energy-use-pie-${selectedYear}-${effectiveSelectedSlices ? effectiveSelectedSlices.join('-') : 'all'}-${plotHeight}`}
                                        data={[pieTrace]}
                                        layout={plotLayout}
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
                                                    name: getText('natural_gas_energy_use_download_chart', lang),
                                                    icon: {
                                                        width: 24,
                                                        height: 24,
                                                        path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z',
                                                    },
                                                    click: (gd) => downloadChartPng(gd),
                                                },
                                            ],
                                        }}
                                        className="natural-gas-energy-use-chart"
                                        useResizeHandler
                                        onClick={handlePieClick}
                                    />
                                )}
                            </figure>

                            <div className="natural-gas-energy-use-table-wrapper">
                                <details onToggle={(event) => setIsChartTableOpen(event.currentTarget.open)}>
                                    <summary role="button" aria-expanded={isChartTableOpen}>
                                        <span aria-hidden="true" style={{ marginRight: '8px' }}>{isChartTableOpen ? '▼' : '▶'}</span>
                                        {getText('natural_gas_energy_use_table_summary', lang)}
                                        <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                                    </summary>
                                    <div ref={chartTableTopRef} className="natural-gas-energy-use-table-scrollbar" aria-hidden="true"><div /></div>
                                    <div
                                        ref={chartTableScrollRef}
                                        className="natural-gas-energy-use-table-responsive"
                                        role="region"
                                        aria-label={chartSummary}
                                        tabIndex={0}
                                    >
                                        <table className="table table-bordered table-striped table-hover">
                                            <caption className="wb-inv">
                                                {substitute(getText('natural_gas_energy_use_table_caption', lang), textVars)}
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
                                                    <tr key={row.key}>
                                                        <th scope="row">{row.label}</th>
                                                        <td style={{ textAlign: 'right' }}>{formatPj(row.energyUse, 1)}</td>
                                                        <td style={{ textAlign: 'right' }}>{formatPct(row.pct, 1)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div ref={chartTableBottomRef} className="natural-gas-energy-use-table-scrollbar" aria-hidden="true"><div /></div>
                                    <div className="natural-gas-energy-use-download-buttons">
                                        <button type="button" onClick={() => downloadChartPng()}>{getText('natural_gas_energy_use_download_chart', lang)}</button>
                                        <button type="button" onClick={downloadChartCsv}>{getText('natural_gas_energy_use_download_csv', lang)}</button>
                                        <button type="button" onClick={downloadChartDocx}>{getText('natural_gas_energy_use_download_docx', lang)}</button>
                                    </div>
                                </details>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
};

export default NaturalGasEnergyUse;
