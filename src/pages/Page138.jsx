import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const TRACE_COUNT = 4;
const COLORS = ['#3E2B26', '#6296B1', '#F48C36', '#2F414B'];
const LOCATION_KEYS = ['canada', 'vancouver', 'calgary', 'toronto', 'montreal', 'halifax'];
const YEARS_DESC = [2024, 2023, 2022];
const YEARS_ASC = [...YEARS_DESC].sort((a, b) => a - b);
const YEAR_SPAN_LABEL = `${YEARS_ASC[0]}\u2013${YEARS_ASC[YEARS_ASC.length - 1]}`;
/**
 * Ctrl+ page zoom is not exposed on `visualViewport.scale` on desktop; infer zoom from
 * `devicePixelRatio` / common OS scale. Use one continuous ratio band so ~400% cannot fall
 * in the gap between separate 400% / 500% windows (that gap hid 400% while 500% still matched).
 */
const PAGE_ZOOM_VERTICAL_TICK_MIN = 3.55;
const PAGE_ZOOM_VERTICAL_TICK_MAX = 5.45;
const LIKELY_OS_DPR_BASES = [1, 1.25, 1.3333333333333333, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5];

function isZoomRatioInVerticalTickBands(z) {
    return z >= PAGE_ZOOM_VERTICAL_TICK_MIN && z <= PAGE_ZOOM_VERTICAL_TICK_MAX;
}

function isBrowserZoomInVerticalTickRange() {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    return LIKELY_OS_DPR_BASES.some((b) => {
        const z = dpr / b;
        return isZoomRatioInVerticalTickBands(z);
    });
}

function isPinchScaleInVerticalTickBands(s) {
    return typeof s === 'number' && s > 1.02 && isZoomRatioInVerticalTickBands(s);
}

const DATA_BY_YEAR = {
    2024: {
        canada: { crude: 66, refining: 31, marketing: 9, taxes: 54 },
        vancouver: { crude: 62, refining: 49, marketing: 9, taxes: 66 },
        calgary: { crude: 61, refining: 29, marketing: 11, taxes: 52 },
        toronto: { crude: 63, refining: 30, marketing: 9, taxes: 59 },
        montreal: { crude: 72, refining: 32, marketing: 8, taxes: 59 },
        halifax: { crude: 72, refining: 21, marketing: 8, taxes: 68 }
    },
    2023: {
        canada: { crude: 64, refining: 30, marketing: 9, taxes: 53 },
        vancouver: { crude: 60, refining: 47, marketing: 9, taxes: 64 },
        calgary: { crude: 59, refining: 28, marketing: 11, taxes: 51 },
        toronto: { crude: 61, refining: 29, marketing: 9, taxes: 57 },
        montreal: { crude: 70, refining: 31, marketing: 8, taxes: 58 },
        halifax: { crude: 70, refining: 20, marketing: 8, taxes: 66 }
    },
    2022: {
        canada: { crude: 63, refining: 29, marketing: 8, taxes: 51 },
        vancouver: { crude: 58, refining: 45, marketing: 9, taxes: 62 },
        calgary: { crude: 58, refining: 27, marketing: 10, taxes: 50 },
        toronto: { crude: 60, refining: 28, marketing: 8, taxes: 56 },
        montreal: { crude: 68, refining: 30, marketing: 8, taxes: 56 },
        halifax: { crude: 68, refining: 19, marketing: 8, taxes: 64 }
    }
};

const Page138 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [selectedYear, setSelectedYear] = useState(2024);
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const [xAxisVerticalForPageZoom, setXAxisVerticalForPageZoom] = useState(false);
    const chartRef = useRef(null);
    const yearDropdownRef = useRef(null);
    const yearButtonRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);

    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    const slugifyExport = (s) =>
        stripHtml(s)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'retail-gasoline-prices';

    const formatCpl = (n) => {
        if (n === undefined || n === null || Number.isNaN(Number(n))) return '\u2014';
        return Math.round(Number(n));
    };

    const formatCplLocale = (n) => {
        if (n === undefined || n === null || Number.isNaN(Number(n))) return '\u2014';
        return Math.round(Number(n)).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');
    };

    const legendCrude = getText('page138_legend_crude', lang);
    const legendRefining = getText('page138_legend_refining', lang);
    const legendMarketing = getText('page138_legend_marketing', lang);
    const legendTaxes = getText('page138_legend_taxes', lang);
    const legendLabels = [legendCrude, legendRefining, legendMarketing, legendTaxes];

    const locationLabels = LOCATION_KEYS.map((k) => getText(`page138_loc_${k}`, lang));

    const chartTitleText = getText('page138_chart_title', lang).replace('{year}', String(selectedYear));
    const exportChartTitle = stripHtml(chartTitleText);
    const docHeading = stripHtml(getText('page138_doc_heading', lang).replace('{span}', YEAR_SPAN_LABEL));

    const cplSuffix = getText('page138_table_hdr_cpl_suffix', lang);
    const tableHeaders = [
        getText('page106_table_col_year', lang),
        getText('page138_table_col_location', lang),
        `${legendCrude}${cplSuffix}`,
        `${legendRefining}${cplSuffix}`,
        `${legendMarketing}${cplSuffix}`,
        `${legendTaxes}${cplSuffix}`,
        `${getText('page138_table_col_total', lang)}${cplSuffix}`
    ];

    const tableFileSlug = `${slugifyExport(getText('page138_export_slug_table', lang))}-${YEARS_ASC[0]}-${YEARS_ASC[YEARS_ASC.length - 1]}`;
    const pngFileSlug = `${slugifyExport(getText('page138_export_slug_chart', lang))}-${selectedYear}`;

    const yearBundle = DATA_BY_YEAR[selectedYear] || DATA_BY_YEAR[2024];

    const flatTableRows = useMemo(() => {
        const rows = [];
        YEARS_DESC.forEach((yr) => {
            const b = DATA_BY_YEAR[yr];
            if (!b) return;
            LOCATION_KEYS.forEach((locKey) => {
                const d = b[locKey];
                const total = d.crude + d.refining + d.marketing + d.taxes;
                rows.push({
                    year: yr,
                    locKey,
                    locationLabel: getText(`page138_loc_${locKey}`, lang),
                    ...d,
                    total
                });
            });
        });
        return rows;
    }, [lang]);

    const crudeY = LOCATION_KEYS.map((k) => yearBundle[k].crude);
    const refiningY = LOCATION_KEYS.map((k) => yearBundle[k].refining);
    const marketingY = LOCATION_KEYS.map((k) => yearBundle[k].marketing);
    const taxesY = LOCATION_KEYS.map((k) => yearBundle[k].taxes);

    const plotBottomMarginHorizontal = windowWidth <= 480 ? 100 : windowWidth <= 768 ? 88 : 76;
    const plotBottomMarginVertical = windowWidth <= 480 ? 148 : windowWidth <= 768 ? 128 : 108;
    const plotBottomMargin = xAxisVerticalForPageZoom ? plotBottomMarginVertical : plotBottomMarginHorizontal;
    const plotTopMargin = windowWidth <= 480 ? 56 : 48;
    const chartHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = {
        size: windowWidth <= 768 ? 18 : 22,
        family: 'Arial, sans-serif',
        color: '#58585a'
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target)) {
                setIsYearDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const syncViewport = () => {
            setWindowWidth(window.innerWidth);
            const s = window.visualViewport?.scale ?? 1;
            const pinchVertical = isPinchScaleInVerticalTickBands(s);
            setXAxisVerticalForPageZoom(pinchVertical || isBrowserZoomInVerticalTickRange());
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
    }, [lang, selectedPoints, selectedYear]);

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
    }, [isTableOpen, flatTableRows.length, lang]);

    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        const title = exportChartTitle;
        try {
            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 1200,
                height: 640,
                scale: 2
            });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                const titleHeight = 96;
                const legendHeight = 64;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight + legendHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 32px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, canvas.width / 2, 48);
                ctx.drawImage(img, 0, titleHeight);
                const legendY = titleHeight + img.height + 28;
                const items = legendLabels.map((label, idx) => ({ label, color: COLORS[idx] }));
                const gap = 28;
                let totalW = 0;
                items.forEach((it) => {
                    ctx.font = '18px Arial';
                    totalW += 28 + gap + ctx.measureText(it.label).width + gap;
                });
                let xPos = (canvas.width - totalW) / 2;
                items.forEach((it) => {
                    ctx.fillStyle = it.color;
                    ctx.fillRect(xPos, legendY - 10, 22, 14);
                    ctx.fillStyle = '#333333';
                    ctx.font = '18px Arial';
                    ctx.textAlign = 'left';
                    ctx.fillText(it.label, xPos + 28, legendY + 4);
                    xPos += 28 + gap + ctx.measureText(it.label).width + gap;
                });
                canvas.toBlob((blob) => {
                    if (blob) saveAs(blob, `${pngFileSlug}.png`);
                });
            };
            img.src = imgData;
        } catch (err) {
            console.error('Error downloading chart:', err);
        }
    };

    const downloadTableAsCSV = () => {
        const lines = [tableHeaders.join(',')];
        flatTableRows.forEach((r) => {
            lines.push(
                [
                    r.year,
                    `"${r.locationLabel.replace(/"/g, '""')}"`,
                    formatCpl(r.crude),
                    formatCpl(r.refining),
                    formatCpl(r.marketing),
                    formatCpl(r.taxes),
                    formatCpl(r.total)
                ].join(',')
            );
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${tableFileSlug}.csv`);
    };

    const downloadTableAsDocx = async () => {
        const headerRow = new TableRow({
            children: tableHeaders.map(
                (cell) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: cell, bold: true, size: 20 })],
                                alignment: AlignmentType.CENTER
                            })
                        ],
                        shading: { fill: 'E6E6E6' }
                    })
            )
        });
        const dataRows = flatTableRows.map(
            (r) =>
                new TableRow({
                    children: [
                        String(r.year),
                        r.locationLabel,
                        String(formatCpl(r.crude)),
                        String(formatCpl(r.refining)),
                        String(formatCpl(r.marketing)),
                        String(formatCpl(r.taxes)),
                        String(formatCpl(r.total))
                    ].map(
                        (val) =>
                            new TableCell({
                                children: [
                                    new Paragraph({
                                        children: [new TextRun({ text: val, size: 20 })],
                                        alignment: AlignmentType.CENTER
                                    })
                                ]
                            })
                    )
                })
        );
        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: docHeading, bold: true, size: 28 })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 }
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [700, 1200, 900, 900, 900, 900, 900],
                            rows: [headerRow, ...dataRows]
                        })
                    ]
                }
            ]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${tableFileSlug}.docx`);
    };

    const barOpacityFor = (traceIdx) => {
        if (selectedPoints === null) return 1;
        return locationLabels.map((_, i) => (selectedPoints[traceIdx]?.includes(i) ? 1 : 0.3));
    };

    const chartAria = getText('page138_chart_aria', lang).replace('{year}', String(selectedYear));

    const plotData = [
        {
            x: locationLabels,
            y: crudeY,
            type: 'bar',
            name: legendCrude,
            marker: { color: COLORS[0], opacity: barOpacityFor(0) },
            hovertemplate: locationLabels.map(
                (loc, i) => `<b>${legendCrude}</b><br>${loc}: ${formatCplLocale(crudeY[i])} cpl<extra></extra>`
            )
        },
        {
            x: locationLabels,
            y: refiningY,
            type: 'bar',
            name: legendRefining,
            marker: { color: COLORS[1], opacity: barOpacityFor(1) },
            hovertemplate: locationLabels.map(
                (loc, i) => `<b>${legendRefining}</b><br>${loc}: ${formatCplLocale(refiningY[i])} cpl<extra></extra>`
            )
        },
        {
            x: locationLabels,
            y: marketingY,
            type: 'bar',
            name: legendMarketing,
            marker: { color: COLORS[2], opacity: barOpacityFor(2) },
            hovertemplate: locationLabels.map(
                (loc, i) => `<b>${legendMarketing}</b><br>${loc}: ${formatCplLocale(marketingY[i])} cpl<extra></extra>`
            )
        },
        {
            x: locationLabels,
            y: taxesY,
            type: 'bar',
            name: legendTaxes,
            marker: { color: COLORS[3], opacity: barOpacityFor(3) },
            hovertemplate: locationLabels.map(
                (loc, i) => `<b>${legendTaxes}</b><br>${loc}: ${formatCplLocale(taxesY[i])} cpl<extra></extra>`
            )
        }
    ];

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-138"
            role="main"
            aria-labelledby="page138-main-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
                .page-138.page-content {
                    max-width: none !important;
                    overflow-x: visible !important;
                }
                .page-138 {
                    margin-left: -${layoutPadding?.left || 55}px;
                    margin-right: -${layoutPadding?.right || 15}px;
                    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
                    padding-left: ${layoutPadding?.left || 55}px;
                    padding-right: ${layoutPadding?.right || 15}px;
                }
                .page138-container {
                    width: 100%;
                    padding: 15px 0 40px 0;
                    box-sizing: border-box;
                }
                .page-138.page-content h1.page138-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 41px !important;
                    font-weight: bold;
                    color: var(--gc-text);
                    margin-top: 0;
                    margin-bottom: 25px;
                    position: relative;
                    padding-bottom: 0.5em;
                    line-height: 1.2;
                }
                .page-138.page-content h1.page138-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }
                .page138-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    box-sizing: border-box;
                    overflow: visible;
                }
                .page138-chart-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: var(--gc-text);
                    text-align: center;
                    margin: 16px 0 12px 0;
                }
                .page138-chart-block {
                    display: flex;
                    flex-direction: column;
                    align-items: stretch;
                    width: 100%;
                }
                .page138-chart {
                    width: 100%;
                    flex-shrink: 0;
                    position: relative;
                    min-height: 0;
                }
                .page138-legend {
                    display: flex;
                    justify-content: center;
                    margin-top: 20px;
                    margin-bottom: 20px;
                    font-family: 'Noto Sans', sans-serif;
                    padding: 10px 20px;
                }
                .page138-legend-inner {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 15px 28px;
                    justify-content: center;
                }
                .page138-legend-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .page138-legend-swatch {
                    width: 22px;
                    height: 14px;
                    flex-shrink: 0;
                }
                .page138-legend-label {
                    font-size: 18px;
                    color: var(--gc-text);
                }
                .page138-table-wrapper {
                    display: block;
                    width: 100%;
                    margin-top: 20px;
                    margin-bottom: 0;
                }
                .page138-table-wrapper details > summary {
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
                .page138-table-wrapper details > summary::-webkit-details-marker {
                    display: none;
                }
                .page138-table-wrapper details > summary:hover {
                    background-color: #404040 !important;
                }
                button.page138-clear-selection:hover {
                    background-color: #404040 !important;
                }
                .page138-table-wrapper .table-responsive {
                    display: block;
                    width: 100%;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    border: 1px solid #ddd;
                    background: #fff;
                    margin-top: 10px;
                }
                .page138-table-wrapper .table-responsive table th,
                .page138-table-wrapper .table-responsive table td {
                    white-space: nowrap;
                    padding: 8px 12px;
                    font-family: var(--font-body);
                    color: var(--gc-text);
                }
                .page138-download-buttons {
                    display: flex;
                    gap: 10px;
                    margin-top: 15px;
                    flex-wrap: wrap;
                }
                .page138-download-buttons button {
                    padding: 8px 16px;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    background: #8C8C8C;
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    color: #ffffff;
                }
                .page138-download-buttons button:hover {
                    background: #404040 !important;
                }
                @media (max-width: 768px) {
                    .page-138.page-content h1.page138-title {
                        font-size: 37px !important;
                    }
                    .page138-chart-title { font-size: 26px; }
                    .page138-legend-label { font-size: 16px; }
                }
                @media (max-width: 480px) {
                    .page138-legend-label { font-size: 14px; }
                }
            `}</style>

            <div className="page138-container">
                <h1 id="page138-main-title" className="page138-title">
                    {getText('page138_title', lang)}
                </h1>

                <div className="page138-chart-frame">
                    <div
                        ref={yearDropdownRef}
                        className="page138-year-dropdown"
                        style={{ position: 'relative', marginBottom: '20px', width: '200px' }}
                    >
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>
                            {getText('year_slider_label', lang)}
                        </label>
                        <button
                            ref={yearButtonRef}
                            type="button"
                            onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                            aria-expanded={isYearDropdownOpen}
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
                                fontFamily: 'Arial, sans-serif'
                            }}
                        >
                            <span>{selectedYear}</span>
                            <span aria-hidden="true" style={{ fontSize: '12px' }}>
                                {isYearDropdownOpen ? '▲' : '▼'}
                            </span>
                        </button>
                        {isYearDropdownOpen && (
                            <div
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
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                                }}
                            >
                                {YEARS_DESC.map((y) => {
                                    const isSelected = selectedYear === y;
                                    return (
                                        <button
                                            key={y}
                                            type="button"
                                            aria-pressed={isSelected}
                                            aria-label={String(y)}
                                            onClick={() => {
                                                setSelectedYear(y);
                                                setSelectedPoints(null);
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
                                                fontFamily: 'Arial, sans-serif'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#f5f5f5';
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
                                                    backgroundColor: '#fff'
                                                }}
                                            >
                                                {isSelected && (
                                                    <span
                                                        style={{
                                                            height: '10px',
                                                            width: '10px',
                                                            borderRadius: '50%',
                                                            backgroundColor: '#000'
                                                        }}
                                                    />
                                                )}
                                            </span>
                                            <span aria-hidden="true" style={{ fontSize: '16px', color: '#333' }}>
                                                {y}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <div role="status" className="wb-inv" aria-live="polite">
                            {lang === 'en' ? 'Showing data for' : 'Données affichées pour'} {selectedYear}
                        </div>
                    </div>

                    <h2 id="page138-chart-title" className="page138-chart-title">
                        {chartTitleText}
                    </h2>

                    <div className="page138-chart-block">
                        <div role="region" aria-label={chartAria} tabIndex="0">
                            {selectedPoints !== null && (
                                <div style={{ marginBottom: 8 }}>
                                    <button
                                        type="button"
                                        className="page138-clear-selection"
                                        onClick={() => setSelectedPoints(null)}
                                        style={{
                                            padding: '6px 12px',
                                            backgroundColor: '#8C8C8C',
                                            border: '1px solid #404040',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontFamily: 'Arial, sans-serif',
                                            fontSize: 14,
                                            color: '#fff'
                                        }}
                                    >
                                        {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                                    </button>
                                </div>
                            )}
                            <figure ref={chartRef} className="page138-chart" style={{ margin: 0 }}>
                                <div aria-hidden="true">
                                    <Plot
                                        data={plotData}
                                        layout={{
                                            barmode: 'stack',
                                            bargap: 0.22,
                                            hoverlabel: {
                                                bgcolor: '#ffffff',
                                                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' }
                                            },
                                            hovermode: 'closest',
                                            clickmode: 'event',
                                            dragmode: false,
                                            xaxis: {
                                                type: 'category',
                                                categoryorder: 'array',
                                                categoryarray: locationLabels,
                                                tickangle: xAxisVerticalForPageZoom ? 90 : 0,
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                tickfont: tickFont,
                                                automargin: true
                                            },
                                            yaxis: {
                                                title: {
                                                    text: getText('page138_yaxis', lang),
                                                    font: axisTitleFont,
                                                    standoff: 8
                                                },
                                                range: [0, 200],
                                                dtick: 20,
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                tickfont: tickFont,
                                                automargin: true
                                            },
                                            showlegend: false,
                                            margin: { l: 58, r: 18, t: plotTopMargin, b: plotBottomMargin },
                                            autosize: true,
                                            paper_bgcolor: 'rgba(0,0,0,0)',
                                            plot_bgcolor: 'rgba(0,0,0,0)'
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
                                                'toImage'
                                            ],
                                            modeBarButtonsToAdd: [
                                                {
                                                    name:
                                                        lang === 'en'
                                                            ? 'Download chart as PNG'
                                                            : 'Télécharger le graphique en PNG',
                                                    icon: {
                                                        width: 24,
                                                        height: 24,
                                                        path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z'
                                                    },
                                                    click: (gd) => downloadChartWithTitle(gd)
                                                }
                                            ]
                                        }}
                                        style={{ width: '100%', height: `${chartHeight}px` }}
                                        useResizeHandler={true}
                                        onClick={(data) => {
                                            if (!data.points || data.points.length === 0) return;
                                            const clickedPoint = data.points[0];
                                            const traceIndex = clickedPoint.curveNumber;
                                            const pointIndex = clickedPoint.pointIndex;
                                            if (traceIndex === undefined || pointIndex === undefined) return;

                                            if (windowWidth <= 768) {
                                                const currentTime = Date.now();
                                                const lastClick = lastClickRef.current;
                                                const isSamePoint =
                                                    traceIndex === lastClick.traceIndex &&
                                                    pointIndex === lastClick.pointIndex;
                                                const isDoubleTap = isSamePoint && currentTime - lastClick.time < 300;
                                                lastClickRef.current = {
                                                    time: currentTime,
                                                    traceIndex,
                                                    pointIndex
                                                };
                                                if (!isDoubleTap) return;
                                            }

                                            setSelectedPoints((prev) => {
                                                if (prev === null) {
                                                    const next = Array.from({ length: TRACE_COUNT }, () => []);
                                                    next[traceIndex].push(pointIndex);
                                                    return next;
                                                }
                                                const isSelected = prev[traceIndex]?.includes(pointIndex);
                                                if (isSelected) {
                                                    const next = prev.map((tracePoints, idx) =>
                                                        idx === traceIndex
                                                            ? tracePoints.filter((p) => p !== pointIndex)
                                                            : [...tracePoints]
                                                    );
                                                    return next.every((arr) => arr.length === 0) ? null : next;
                                                }
                                                return prev.map((tracePoints, idx) =>
                                                    idx === traceIndex ? [...tracePoints, pointIndex] : [...tracePoints]
                                                );
                                            });
                                        }}
                                    />
                                </div>
                            </figure>
                        </div>

                        <div className="page138-legend" aria-hidden="true">
                            <div className="page138-legend-inner">
                                {legendLabels.map((label, idx) => (
                                    <div key={label} className="page138-legend-item">
                                        <span
                                            className="page138-legend-swatch"
                                            style={{ backgroundColor: COLORS[idx] }}
                                        />
                                        <span className="page138-legend-label">{label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="page138-table-wrapper">
                        <details onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>
                                    {isTableOpen ? '▼' : '▶'}
                                </span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">
                                    {lang === 'en'
                                        ? ' Press Enter to open or close.'
                                        : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                </span>
                            </summary>

                            <div
                                ref={topScrollRef}
                                style={{
                                    width: '100%',
                                    overflowX: 'auto',
                                    overflowY: 'hidden',
                                    marginTop: '10px',
                                    display: windowWidth <= 768 ? 'none' : 'block'
                                }}
                                aria-hidden="true"
                            >
                                <div style={{ height: '20px' }} />
                            </div>

                            <div
                                ref={tableScrollRef}
                                className="table-responsive"
                                role="region"
                                aria-label={lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                tabIndex="0"
                            >
                                <table className="table table-bordered table-striped table-hover">
                                    <caption className="wb-inv">{getText('page138_table_caption', lang)}</caption>
                                    <thead>
                                        <tr>
                                            {tableHeaders.map((hdr) => (
                                                <th key={hdr} scope="col" style={{ fontWeight: 'bold', textAlign: 'center' }}>
                                                    {hdr}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {flatTableRows.map((r) => (
                                            <tr key={`${r.year}-${r.locKey}`}>
                                                <td style={{ textAlign: 'center' }}>{r.year}</td>
                                                <td style={{ textAlign: 'center' }}>{r.locationLabel}</td>
                                                <td style={{ textAlign: 'center' }}>{formatCplLocale(r.crude)}</td>
                                                <td style={{ textAlign: 'center' }}>{formatCplLocale(r.refining)}</td>
                                                <td style={{ textAlign: 'center' }}>{formatCplLocale(r.marketing)}</td>
                                                <td style={{ textAlign: 'center' }}>{formatCplLocale(r.taxes)}</td>
                                                <td style={{ textAlign: 'center' }}>{formatCplLocale(r.total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="page138-download-buttons">
                                <button type="button" onClick={downloadTableAsCSV}>
                                    {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                </button>
                                <button type="button" onClick={() => downloadTableAsDocx()}>
                                    {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                </button>
                            </div>
                        </details>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Page138;
