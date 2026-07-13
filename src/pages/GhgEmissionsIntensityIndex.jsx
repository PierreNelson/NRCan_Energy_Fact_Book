import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import bgColumnEn from '../assets/ghg_emissions_intensity_index_bg_column.svg';
import bgColumnFr from '../assets/ghg_emissions_intensity_index_bg_column_fr.svg';
import bgStackedEn from '../assets/ghg_emissions_intensity_index_bg_stacked.svg';
import bgStackedFr from '../assets/ghg_emissions_intensity_index_bg_stacked_fr.svg';

/* Hardcoded indexed series (2000=100) pending pipeline sources. */
const GHG_EMISSIONS_INTENSITY_INDEX_DATA = [
    { year: 2000, perGdp: 100, perCapita: 100, perEnergy: 100 },
    { year: 2001, perGdp: 98, perCapita: 99.5, perEnergy: 100.5 },
    { year: 2002, perGdp: 96, perCapita: 99, perEnergy: 101 },
    { year: 2003, perGdp: 94.5, perCapita: 98.5, perEnergy: 101.2 },
    { year: 2004, perGdp: 93, perCapita: 98.2, perEnergy: 101.1 },
    { year: 2005, perGdp: 91, perCapita: 98, perEnergy: 101 },
    { year: 2006, perGdp: 88.5, perCapita: 96, perEnergy: 100 },
    { year: 2007, perGdp: 87, perCapita: 94, perEnergy: 99.5 },
    { year: 2008, perGdp: 85, perCapita: 91, perEnergy: 99 },
    { year: 2009, perGdp: 84, perCapita: 88, perEnergy: 98.5 },
    { year: 2010, perGdp: 82, perCapita: 87, perEnergy: 98 },
    { year: 2011, perGdp: 80, perCapita: 86.5, perEnergy: 97.5 },
    { year: 2012, perGdp: 78.5, perCapita: 86, perEnergy: 97 },
    { year: 2013, perGdp: 77, perCapita: 85.5, perEnergy: 96.5 },
    { year: 2014, perGdp: 76, perCapita: 85.2, perEnergy: 96.2 },
    { year: 2015, perGdp: 75, perCapita: 85, perEnergy: 96 },
    { year: 2016, perGdp: 72.5, perCapita: 83, perEnergy: 95 },
    { year: 2017, perGdp: 71, perCapita: 81, perEnergy: 94.5 },
    { year: 2018, perGdp: 69.5, perCapita: 79, perEnergy: 94 },
    { year: 2019, perGdp: 68, perCapita: 77, perEnergy: 93 },
    { year: 2020, perGdp: 65, perCapita: 74, perEnergy: 92 },
    { year: 2021, perGdp: 62.5, perCapita: 72.5, perEnergy: 91 },
    { year: 2022, perGdp: 61, perCapita: 72, perEnergy: 90.2 },
    { year: 2023, perGdp: 59.5, perCapita: 71.5, perEnergy: 89.5 },
];

const COLORS = {
    perGdp: '#647C8E',
    perCapita: '#31BDCB',
    perEnergy: '#8C755A',
};

const SERIES_KEYS = ['perGdp', 'perCapita', 'perEnergy'];
const DOC_COLUMN_WIDTHS = [900, 2800, 2800, 2800];

const STACKED_LAYOUT_BROWSER_ZOOM = 1.1;
const STACKED_LAYOUT_DETECTED_ZOOM = 1.0 + (STACKED_LAYOUT_BROWSER_ZOOM - 1.0) * 0.25;

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    }
    return hex;
};

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const waitForImage = (img) =>
    new Promise((resolve, reject) => {
        if (img.complete && img.naturalWidth > 0) {
            resolve(img);
            return;
        }
        img.onload = () => resolve(img);
        img.onerror = reject;
    });

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

const GhgEmissionsIntensityIndex = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [pageCssZoom, setPageCssZoom] = useState(() => computePageZoomScale(null).pageCssZoom);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedTraceIds, setSelectedTraceIds] = useState(null);
    const zoomBaselineRef = useRef(null);
    const chartRef = useRef(null);
    const infographicImgRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null });
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const useStackedLayout = pageCssZoom >= STACKED_LAYOUT_DETECTED_ZOOM;
    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    const formatIndex = (num) => {
        if (num == null || Number.isNaN(Number(num))) return '—';
        const value = Number(num);
        const digits = Number.isInteger(value) ? 0 : 1;
        return value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    };

    const years = useMemo(() => GHG_EMISSIONS_INTENSITY_INDEX_DATA.map((r) => r.year), []);
    const seriesValues = useMemo(
        () => Object.fromEntries(SERIES_KEYS.map((key) => [key, GHG_EMISSIONS_INTENSITY_INDEX_DATA.map((r) => r[key])])),
        [],
    );
    const tableRowsDesc = useMemo(() => [...GHG_EMISSIONS_INTENSITY_INDEX_DATA].reverse(), []);

    const pageTitle = getText('ghg_emissions_intensity_index_title', lang);
    const chartTitle = getText('ghg_emissions_intensity_index_chart_title', lang);
    const exportChartTitle = stripHtml(chartTitle);
    const chartDownloadSlug = getText('ghg_emissions_intensity_index_download_title', lang).replace(/\s+/g, '_');
    const infographicDownloadSlug = getText('ghg_emissions_intensity_index_infographic_download_title', lang).replace(/\s+/g, '_');
    const yAxisTitle = getText('ghg_emissions_intensity_index_yaxis', lang);

    const legendLabels = {
        perGdp: getText('ghg_emissions_intensity_index_legend_per_gdp', lang),
        perCapita: getText('ghg_emissions_intensity_index_legend_per_capita', lang),
        perEnergy: getText('ghg_emissions_intensity_index_legend_per_energy', lang),
    };

    const tableHeaders = [
        getText('ghg_emissions_intensity_index_table_col_year', lang),
        `${legendLabels.perGdp} (${yAxisTitle})`,
        `${legendLabels.perCapita} (${yAxisTitle})`,
        `${legendLabels.perEnergy} (${yAxisTitle})`,
    ];

    const bgImage = lang === 'en'
        ? (useStackedLayout ? bgStackedEn : bgColumnEn)
        : (useStackedLayout ? bgStackedFr : bgColumnFr);

    const xTickvals = years.filter((y) => y % 2 === 1);
    const yTickvals = [55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105];
    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 62 : windowWidth <= 768 ? 56 : 50;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    const lineColorFor = (traceIndex, baseColor) => {
        if (selectedTraceIds === null) return baseColor;
        return selectedTraceIds.includes(traceIndex) ? baseColor : hexToRgba(baseColor, 0.3);
    };

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

    useEffect(() => {
        if (!chartRef.current) return undefined;
        const setupChartAccessibility = () => {
            const plotContainer = chartRef.current;
            if (!plotContainer) return;
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
    }, [lang, selectedTraceIds, useStackedLayout]);

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

        const handleTopScroll = () => syncFrom(topScroll);
        const handleTableScroll = () => syncFrom(tableScroll);
        const handleBottomScroll = () => syncFrom(bottomScroll);
        const sync = () => window.requestAnimationFrame(syncTableScroll);

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
    }, [isTableOpen, windowWidth, useStackedLayout, syncTableScroll]);

    const downloadInfographicPng = async () => {
        const imgEl = infographicImgRef.current;
        if (!imgEl) return;
        try {
            const loaded = await waitForImage(imgEl);
            const scale = 2;
            const canvas = document.createElement('canvas');
            canvas.width = loaded.naturalWidth * scale;
            canvas.height = loaded.naturalHeight * scale;
            const ctx = canvas.getContext('2d');
            ctx.scale(scale, scale);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, loaded.naturalWidth, loaded.naturalHeight);
            ctx.drawImage(loaded, 0, 0, loaded.naturalWidth, loaded.naturalHeight);
            canvas.toBlob((blob) => {
                if (blob) saveAs(blob, `${infographicDownloadSlug}.png`);
            });
        } catch (err) {
            console.warn('Unable to download infographic image.', err);
        }
    };

    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
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
                const titleHeight = 110;
                const legendHeight = 72;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight + legendHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 28px Arial';
                ctx.textAlign = 'center';
                const maxTitleWidth = canvas.width - 80;
                const words = exportChartTitle.split(' ');
                const lines = [];
                let line = '';
                words.forEach((word) => {
                    const test = line ? `${line} ${word}` : word;
                    if (ctx.measureText(test).width > maxTitleWidth && line) {
                        lines.push(line);
                        line = word;
                    } else {
                        line = test;
                    }
                });
                if (line) lines.push(line);
                lines.forEach((textLine, index) => {
                    ctx.fillText(textLine, canvas.width / 2, 40 + index * 32);
                });
                ctx.drawImage(img, 0, titleHeight);
                const legendY = titleHeight + img.height + 40;
                const legendItems = SERIES_KEYS.map((key) => ({ color: COLORS[key], label: legendLabels[key] }));
                ctx.font = '18px Arial';
                ctx.textAlign = 'left';
                const totalLegendWidth =
                    legendItems.reduce((acc, item) => acc + ctx.measureText(item.label).width + 56, 0) + 40;
                let x = (canvas.width - totalLegendWidth) / 2;
                legendItems.forEach((item) => {
                    ctx.strokeStyle = item.color;
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.moveTo(x, legendY);
                    ctx.lineTo(x + 28, legendY);
                    ctx.stroke();
                    ctx.fillStyle = '#333333';
                    ctx.fillText(item.label, x + 36, legendY + 6);
                    x += 36 + ctx.measureText(item.label).width + 40;
                });
                canvas.toBlob((blob) => {
                    if (blob) saveAs(blob, `${chartDownloadSlug}.png`);
                });
            };
            img.src = imgData;
        } catch (err) {
            console.error('Error downloading chart:', err);
        }
    };

    const downloadTableAsCSV = () => {
        const lines = [tableHeaders.map(csvEscape).join(',')];
        tableRowsDesc.forEach((row) => {
            lines.push([
                row.year,
                formatIndex(row.perGdp),
                formatIndex(row.perCapita),
                formatIndex(row.perEnergy),
            ].map(csvEscape).join(','));
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${chartDownloadSlug}.csv`);
    };

    const downloadTableAsDocx = async () => {
        const headerRow = new TableRow({
            children: tableHeaders.map(
                (cell) => new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({ text: cell, bold: true, size: 20 })],
                        alignment: AlignmentType.CENTER,
                    })],
                    shading: { fill: 'E6E6E6' },
                }),
            ),
        });
        const dataRows = tableRowsDesc.map(
            (row) => new TableRow({
                children: [row.year, formatIndex(row.perGdp), formatIndex(row.perCapita), formatIndex(row.perEnergy)].map(
                    (val, index) => new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({ text: String(val), size: 20 })],
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
                        children: [new TextRun({ text: exportChartTitle, bold: true, size: 28 })],
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
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${chartDownloadSlug}.docx`);
    };

    const handleChartClick = useCallback((event) => {
        if (!event?.points?.length) return;
        const traceIndex = event.points[0].curveNumber;
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
    }, [windowWidth]);

    const hoverTemplates = SERIES_KEYS.map((key) => years.map(
        (y, i) => `<b>${legendLabels[key]}</b><br>${y}: ${formatIndex(seriesValues[key][i])}<extra></extra>`,
    ));

    const selectionKey = selectedTraceIds ? selectedTraceIds.join('-') : 'all';

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content ghg-emissions-intensity-index"
            role="main"
            aria-labelledby="ghg-emissions-intensity-index-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.ghg-emissions-intensity-index {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.ghg-emissions-intensity-index-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.ghg-emissions-intensity-index.page-content h1.ghg-emissions-intensity-index-title {
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
.ghg-emissions-intensity-index.page-content h1.ghg-emissions-intensity-index-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.ghg-emissions-intensity-index-intro {
    font-family: 'Noto Sans', Arial, sans-serif;
    font-size: 18px;
    line-height: 1.55;
    color: var(--gc-text);
    margin: 0 0 28px 0;
    max-width: 1100px;
}
.ghg-emissions-intensity-index-intro p { margin: 0 0 1rem 0; }
.ghg-emissions-intensity-index-intro p:last-child { margin-bottom: 0; }
.ghg-emissions-intensity-index-content-row {
    display: flex;
    flex-direction: row;
    width: 100%;
    gap: 28px;
    align-items: flex-start;
}
.ghg-emissions-intensity-index-info-column {
    width: 34%;
    min-width: 220px;
    box-sizing: border-box;
}
.ghg-emissions-intensity-index-chart-column {
    width: 66%;
    min-width: 0;
    box-sizing: border-box;
}
.layout-stacked.ghg-emissions-intensity-index-content-row { flex-direction: column !important; }
.layout-stacked .ghg-emissions-intensity-index-info-column,
.layout-stacked .ghg-emissions-intensity-index-chart-column {
    width: 100% !important;
    min-width: 0 !important;
}
.layout-stacked .ghg-emissions-intensity-index-info-column { margin-bottom: 28px; }
.ghg-emissions-intensity-index-figure { margin: 0; width: 100%; }
.ghg-emissions-intensity-index-bg-image {
    width: 100%;
    height: auto;
    display: block;
}
.ghg-emissions-intensity-index-infographic-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin: 12px 0 0 0;
}
.ghg-emissions-intensity-index-infographic-actions button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: bold;
    color: #ffffff;
    white-space: nowrap;
}
.ghg-emissions-intensity-index-infographic-actions button:hover { background: #404040 !important; }
.ghg-emissions-intensity-index-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    box-sizing: border-box;
    overflow: visible;
}
.ghg-emissions-intensity-index-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
}
.ghg-emissions-intensity-index-chart {
    width: 100%;
    min-width: 0;
    height: ${plotHeight}px;
    position: relative;
}
.ghg-emissions-intensity-index-chart > div { width: 100%; height: 100%; }
.ghg-emissions-intensity-index-legend {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 18px 28px;
    margin-top: 12px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: var(--gc-text);
}
.ghg-emissions-intensity-index-legend-item { display: inline-flex; align-items: center; gap: 8px; }
.ghg-emissions-intensity-index-legend-line { width: 28px; height: 0; border-top: 3px solid; display: inline-block; }
.ghg-emissions-intensity-index-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.ghg-emissions-intensity-index-table-wrapper details > summary {
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
.ghg-emissions-intensity-index-table-wrapper details > summary::-webkit-details-marker { display: none; }
.ghg-emissions-intensity-index-table-wrapper details > summary:hover,
.ghg-emissions-intensity-index-chart-frame button[type="button"]:hover { background-color: #404040 !important; }
.ghg-emissions-intensity-index-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.ghg-emissions-intensity-index-table-scrollbar > div { height: 20px; }
.ghg-emissions-intensity-index-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #ddd;
    background: #fff;
    padding: 15px;
    box-sizing: border-box;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.ghg-emissions-intensity-index-table-responsive::-webkit-scrollbar { display: none; }
.ghg-emissions-intensity-index-table-responsive table { width: max-content; min-width: 100%; border-collapse: collapse; }
.ghg-emissions-intensity-index-table-responsive th,
.ghg-emissions-intensity-index-table-responsive td {
    padding: 8px 12px;
    border: 1px solid #ddd;
    font-family: Arial, sans-serif;
    color: var(--gc-text);
    white-space: nowrap;
}
.ghg-emissions-intensity-index-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.ghg-emissions-intensity-index-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.ghg-emissions-intensity-index-download-buttons button:hover { background: #404040 !important; }
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
    .ghg-emissions-intensity-index.page-content h1.ghg-emissions-intensity-index-title { font-size: 37px !important; }
    .ghg-emissions-intensity-index-chart-title { font-size: 26px; }
    .ghg-emissions-intensity-index-intro { font-size: 16px; }
}
            `}</style>

            <div className="ghg-emissions-intensity-index-inner">
                <h1 id="ghg-emissions-intensity-index-title" className="ghg-emissions-intensity-index-title">
                    {pageTitle}
                </h1>

                <div className="ghg-emissions-intensity-index-intro">
                    <p>{getText('ghg_emissions_intensity_index_intro_1', lang)}</p>
                    <p>{getText('ghg_emissions_intensity_index_intro_2', lang)}</p>
                </div>

                <div className={`ghg-emissions-intensity-index-content-row ${useStackedLayout ? 'layout-stacked' : ''}`}>
                    <section className="ghg-emissions-intensity-index-info-column">
                        <figure
                            className="ghg-emissions-intensity-index-figure"
                            aria-label={getText('ghg_emissions_intensity_index_infographic_aria', lang)}
                        >
                            <img
                                ref={infographicImgRef}
                                className="ghg-emissions-intensity-index-bg-image"
                                src={bgImage}
                                alt={getText('ghg_emissions_intensity_index_infographic_aria', lang)}
                                draggable={false}
                            />
                        </figure>
                        <div className="ghg-emissions-intensity-index-infographic-actions">
                            <button type="button" onClick={downloadInfographicPng}>
                                {getText('ghg_emissions_intensity_index_download_png', lang)}
                            </button>
                        </div>
                    </section>

                    <section className="ghg-emissions-intensity-index-chart-column" aria-labelledby="ghg-emissions-intensity-index-chart-title">
                        <div className="ghg-emissions-intensity-index-chart-frame">
                            <h2 id="ghg-emissions-intensity-index-chart-title" className="ghg-emissions-intensity-index-chart-title">
                                {chartTitle}
                            </h2>

                            {selectedTraceIds !== null && (
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

                            <figure ref={chartRef} style={{ margin: 0 }}>
                                <div role="region" aria-label={getText('ghg_emissions_intensity_index_chart_aria', lang)} tabIndex="0">
                                    <Plot
                                        key={`ghg-emissions-intensity-index-${selectionKey}-${plotHeight}-${useStackedLayout ? 'stacked' : 'column'}`}
                                        data={SERIES_KEYS.map((key, traceIndex) => ({
                                            x: years,
                                            y: seriesValues[key],
                                            type: 'scatter',
                                            mode: 'lines',
                                            name: legendLabels[key],
                                            line: { color: lineColorFor(traceIndex, COLORS[key]), width: 2.5 },
                                            hovertemplate: hoverTemplates[traceIndex],
                                        }))}
                                        layout={{
                                            showlegend: false,
                                            clickmode: 'event',
                                            dragmode: false,
                                            hovermode: 'closest',
                                            hoverlabel: {
                                                bgcolor: '#ffffff',
                                                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
                                            },
                                            margin: { l: 72, r: 24, t: plotTopMargin, b: plotBottomMargin },
                                            paper_bgcolor: 'rgba(0,0,0,0)',
                                            plot_bgcolor: 'rgba(0,0,0,0)',
                                            height: plotHeight,
                                            autosize: true,
                                            xaxis: {
                                                type: 'linear',
                                                tickmode: 'array',
                                                tickvals: xTickvals,
                                                ticktext: xTickvals.map(String),
                                                showgrid: false,
                                                zeroline: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                tickfont: tickFont,
                                                automargin: true,
                                            },
                                            yaxis: {
                                                title: { text: yAxisTitle, font: axisTitleFont, standoff: 12 },
                                                range: [55, 105],
                                                tickmode: 'array',
                                                tickvals: yTickvals,
                                                ticktext: yTickvals.map(String),
                                                showgrid: false,
                                                showline: true,
                                                linewidth: 1,
                                                linecolor: '#333',
                                                zeroline: false,
                                                tickfont: tickFont,
                                                automargin: true,
                                            },
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
                                                    name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
                                                    icon: {
                                                        width: 24,
                                                        height: 24,
                                                        path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z',
                                                    },
                                                    click: (gd) => downloadChartWithTitle(gd),
                                                },
                                            ],
                                        }}
                                        className="ghg-emissions-intensity-index-chart"
                                        useResizeHandler
                                        onClick={handleChartClick}
                                    />
                                </div>
                            </figure>

                            <div className="ghg-emissions-intensity-index-legend" aria-hidden="true">
                                {SERIES_KEYS.map((key) => (
                                    <div key={key} className="ghg-emissions-intensity-index-legend-item">
                                        <span className="ghg-emissions-intensity-index-legend-line" style={{ borderColor: COLORS[key] }} />
                                        <span>{legendLabels[key]}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="ghg-emissions-intensity-index-table-wrapper">
                                <details onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                                    <summary role="button" aria-expanded={isTableOpen}>
                                        <span aria-hidden="true" style={{ marginRight: '8px' }}>
                                            {isTableOpen ? '▼' : '▶'}
                                        </span>
                                        {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                        <span className="wb-inv">
                                            {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                        </span>
                                    </summary>
                                    <div ref={topScrollRef} className="ghg-emissions-intensity-index-table-scrollbar" aria-hidden="true">
                                        <div />
                                    </div>
                                    <div ref={tableScrollRef} className="ghg-emissions-intensity-index-table-responsive" role="region" tabIndex="0">
                                        <table className="table table-striped table-hover">
                                            <caption className="wb-inv">{getText('ghg_emissions_intensity_index_table_caption', lang)}</caption>
                                            <thead>
                                                <tr>
                                                    {tableHeaders.map((hdr) => (
                                                        <th
                                                            key={hdr}
                                                            scope="col"
                                                            style={{
                                                                fontWeight: 'bold',
                                                                textAlign: hdr === tableHeaders[0] ? 'left' : 'center',
                                                            }}
                                                        >
                                                            {hdr}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tableRowsDesc.map((row) => (
                                                    <tr key={row.year}>
                                                        <th scope="row" style={{ fontWeight: 'bold' }}>{row.year}</th>
                                                        <td style={{ textAlign: 'center' }}>{formatIndex(row.perGdp)}</td>
                                                        <td style={{ textAlign: 'center' }}>{formatIndex(row.perCapita)}</td>
                                                        <td style={{ textAlign: 'center' }}>{formatIndex(row.perEnergy)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div className="ghg-emissions-intensity-index-download-buttons">
                                            <button type="button" onClick={downloadTableAsCSV}>
                                                {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                            </button>
                                            <button type="button" onClick={downloadTableAsDocx}>
                                                {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                            </button>
                                        </div>
                                    </div>
                                    <div ref={bottomScrollRef} className="ghg-emissions-intensity-index-table-scrollbar" aria-hidden="true">
                                        <div />
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

export default GhgEmissionsIntensityIndex;
