import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import householdEnergyExpendituresBg from '../assets/household_energy_expenditures_bg.png';

const CPI_YEARS = Array.from({ length: 23 }, (_, i) => 2003 + i);

const CPI_DATA = {
    energy: [100, 105, 115, 125, 132, 168, 120, 125, 140, 152, 148, 162, 138, 132, 128, 135, 142, 138, 118, 145, 245, 200, 190],
    total: [100, 102, 104, 106, 109, 111, 114, 116, 119, 122, 125, 128, 131, 134, 137, 140, 143, 146, 149, 153, 161, 164, 166],
    excluding: [99, 101, 103, 105, 107, 109, 112, 114, 116, 119, 122, 125, 128, 130, 133, 136, 139, 141, 144, 148, 155, 159, 161],
};

const COLORS = {
    energy: '#6d6e71',
    total: '#7eb8da',
    excluding: '#7b3f61',
};

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    }
    return hex;
};

const exportEnergyIntensityInfographicPng = async (rowEl, { title, scale = 2 }) => {
    if (!rowEl) return null;

    const exportRoot = rowEl.closest('.household-energy-expenditures-inner');
    const titleEl = exportRoot?.querySelector('#household-energy-expenditures-title');
    const imgEl = rowEl.querySelector('.household-energy-expenditures-bg-image');
    const bulletsEl = rowEl.querySelector('.household-energy-expenditures-top-bullets');
    if (!exportRoot || !titleEl || !imgEl || !bulletsEl) return null;

    const waitForImage = (img) =>
        new Promise((resolve, reject) => {
            if (img.complete && img.naturalWidth > 0) {
                resolve(img);
                return;
            }
            img.onload = () => resolve(img);
            img.onerror = reject;
        });

    const loaded = await waitForImage(imgEl);
    const rootRect = exportRoot.getBoundingClientRect();
    const bulletsBottom = bulletsEl.getBoundingClientRect().bottom;
    const canvasW = Math.ceil(exportRoot.clientWidth);
    const canvasH = Math.ceil(bulletsBottom - rootRect.top + 16);

    const canvas = document.createElement('canvas');
    canvas.width = canvasW * scale;
    canvas.height = canvasH * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const rel = (el) => {
        const box = el.getBoundingClientRect();
        return {
            x: box.left - rootRect.left,
            y: box.top - rootRect.top,
            w: box.width,
            h: box.height,
        };
    };

    const titleBox = rel(titleEl);
    const titleStyle = window.getComputedStyle(titleEl);
    ctx.font = `${titleStyle.fontWeight} ${titleStyle.fontSize} ${titleStyle.fontFamily}`;
    ctx.fillStyle = titleStyle.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, titleBox.x, titleBox.y);

    const imgBox = rel(imgEl);
    ctx.drawImage(loaded, imgBox.x, imgBox.y, imgBox.w, imgBox.h);

    const drawTextSegment = (node) => {
        const raw = node.textContent ?? '';
        if (!raw.trim()) return;
        const range = document.createRange();
        range.selectNodeContents(node);
        const style = window.getComputedStyle(node.nodeType === Node.TEXT_NODE ? node.parentElement : node);
        ctx.fillStyle = style.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        ctx.font = font;
        const rects = Array.from(range.getClientRects());
        if (rects.length <= 1) {
            const rect = rects[0] ?? range.getBoundingClientRect();
            ctx.fillText(raw, rect.left - rootRect.left, rect.top - rootRect.top);
            return;
        }
        const leading = raw.match(/^\s*/)?.[0] ?? '';
        const words = raw.trim().split(/\s+/);
        let wordIndex = 0;
        rects.forEach((rect, rectIndex) => {
            let line = rectIndex === 0 ? leading : '';
            while (wordIndex < words.length) {
                const separator = line && !line.endsWith(' ') ? ' ' : '';
                const candidate = `${line}${separator}${words[wordIndex]}`;
                if (line && ctx.measureText(candidate).width > rect.width + 2) break;
                line = candidate;
                wordIndex += 1;
            }
            if (line) {
                ctx.fillText(line, rect.left - rootRect.left, rect.top - rootRect.top);
            }
        });
    };

    bulletsEl.querySelectorAll('li').forEach((li) => {
        li.childNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                drawTextSegment(node);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                drawTextSegment(node);
            }
        });
    });

    return canvas;
};

const HouseholdEnergyExpenditures = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const infographicRef = useRef(null);
    const topRowRef = useRef(null);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    const pageTitle = getText('household_energy_expenditures_title', lang);
    const chartTitle = getText('household_energy_expenditures_chart_title', lang);
    const exportChartTitle = stripHtml(chartTitle);
    const chartDownloadSlug = getText('household_energy_expenditures_download_title', lang).replace(/\s+/g, '_');
    const infographicDownloadSlug = getText('household_energy_expenditures_infographic_download_title', lang).replace(/\s+/g, '_');

    const legendEnergy = getText('household_energy_expenditures_legend_energy', lang);
    const legendTotal = getText('household_energy_expenditures_legend_total', lang);
    const legendExcluding = getText('household_energy_expenditures_legend_excluding', lang);
    const yAxisTitle = getText('household_energy_expenditures_yaxis', lang);

    const tableHeaders = [
        getText('petroleum_employment_table_col_year', lang),
        `${legendEnergy} (2002=100)`,
        `${legendTotal} (2002=100)`,
        `${legendExcluding} (2002=100)`,
    ];

    const tableRowsDesc = useMemo(
        () =>
            [...CPI_YEARS].reverse().map((year, reverseIndex) => {
                const index = CPI_YEARS.length - 1 - reverseIndex;
                return {
                    year,
                    energy: CPI_DATA.energy[index],
                    total: CPI_DATA.total[index],
                    excluding: CPI_DATA.excluding[index],
                };
            }),
        [],
    );

    const formatIndex = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 62 : windowWidth <= 768 ? 56 : 50;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };
    const yTickvals = [90, 110, 130, 150, 170, 190, 210, 230, 250];

    const traceHasSelection = (traceIndex) => selectedPoints?.[traceIndex]?.length > 0;

    const markerOpacityFor = (traceIndex, pointIndex) => {
        if (selectedPoints === null) return 1;
        return selectedPoints[traceIndex]?.includes(pointIndex) ? 1 : 0.3;
    };

    const lineColorFor = (traceIndex, baseColor) => {
        if (selectedPoints === null) return baseColor;
        return traceHasSelection(traceIndex) ? baseColor : hexToRgba(baseColor, 0.3);
    };

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
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = bottomScrollRef.current;
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
    }, [isTableOpen, windowWidth, syncTableScroll]);

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
    }, [lang, selectedPoints]);

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
                const titleHeight = 100;
                const legendHeight = 56;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight + legendHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 32px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(exportChartTitle, canvas.width / 2, 48);
                ctx.drawImage(img, 0, titleHeight);
                const legendY = titleHeight + img.height + 36;
                const legendItems = [
                    { color: COLORS.energy, label: legendEnergy, dashed: false },
                    { color: COLORS.total, label: legendTotal, dashed: false },
                    { color: COLORS.excluding, label: legendExcluding, dashed: true },
                ];
                ctx.font = '20px Arial';
                ctx.textAlign = 'left';
                const totalLegendWidth =
                    legendItems.reduce((acc, item) => acc + ctx.measureText(item.label).width + 56, 0) + 40;
                let x = (canvas.width - totalLegendWidth) / 2;
                legendItems.forEach((item) => {
                    ctx.strokeStyle = item.color;
                    ctx.lineWidth = 4;
                    if (item.dashed) {
                        ctx.setLineDash([8, 6]);
                    } else {
                        ctx.setLineDash([]);
                    }
                    ctx.beginPath();
                    ctx.moveTo(x, legendY);
                    ctx.lineTo(x + 28, legendY);
                    ctx.stroke();
                    ctx.setLineDash([]);
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
        const lines = [tableHeaders.map((h) => `"${h.replace(/"/g, '""')}"`).join(',')];
        tableRowsDesc.forEach((row) => {
            lines.push([row.year, row.energy, row.total, row.excluding].join(','));
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${chartDownloadSlug}.csv`);
    };

    const downloadTableAsDocx = async () => {
        const headerRow = new TableRow({
            children: tableHeaders.map(
                (cell) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: cell, bold: true, size: 20 })],
                                alignment: AlignmentType.CENTER,
                            }),
                        ],
                        shading: { fill: 'E6E6E6' },
                    }),
            ),
        });
        const dataRows = tableRowsDesc.map(
            (row) =>
                new TableRow({
                    children: [row.year, formatIndex(row.energy), formatIndex(row.total), formatIndex(row.excluding)].map(
                        (val, index) =>
                            new TableCell({
                                children: [
                                    new Paragraph({
                                        children: [new TextRun({ text: String(val), size: 20 })],
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
                            children: [new TextRun({ text: exportChartTitle, bold: true, size: 28 })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [900, 2400, 2200, 2600],
                            rows: [headerRow, ...dataRows],
                        }),
                    ],
                },
            ],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${chartDownloadSlug}.docx`);
    };

    const downloadInfographicPng = async () => {
        const canvas = await exportEnergyIntensityInfographicPng(topRowRef.current, {
            title: stripHtml(pageTitle),
            scale: 2,
        });
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${infographicDownloadSlug}.png`);
        });
    };

    const handleChartClick = (event) => {
        if (!event.points?.length) return;
        const traceIndex = event.points[0].curveNumber;
        const pointIndex = event.points[0].pointIndex;
        if (traceIndex === undefined || traceIndex < 0 || traceIndex > 2) return;

        if (windowWidth <= 768) {
            const currentTime = Date.now();
            const lastClick = lastClickRef.current;
            const isSamePoint = traceIndex === lastClick.traceIndex && pointIndex === lastClick.pointIndex;
            const isDoubleTap = isSamePoint && currentTime - lastClick.time < 300;
            lastClickRef.current = { time: currentTime, traceIndex, pointIndex };
            if (!isDoubleTap) return;
        }

        setSelectedPoints((prev) => {
            if (prev === null) {
                const next = [[], [], []];
                next[traceIndex].push(pointIndex);
                return next;
            }
            const isSelected = prev[traceIndex]?.includes(pointIndex);
            if (isSelected) {
                const next = prev.map((tracePoints, idx) =>
                    idx === traceIndex ? tracePoints.filter((p) => p !== pointIndex) : [...tracePoints],
                );
                return next.every((arr) => arr.length === 0) ? null : next;
            }
            return prev.map((tracePoints, idx) => (idx === traceIndex ? [...tracePoints, pointIndex] : [...tracePoints]));
        });
    };

    const energyHover = CPI_YEARS.map(
        (y, i) => `<b>${legendEnergy}</b><br>${y}: ${formatIndex(CPI_DATA.energy[i])}<extra></extra>`,
    );
    const totalHover = CPI_YEARS.map(
        (y, i) => `<b>${legendTotal}</b><br>${y}: ${formatIndex(CPI_DATA.total[i])}<extra></extra>`,
    );
    const excludingHover = CPI_YEARS.map(
        (y, i) => `<b>${legendExcluding}</b><br>${y}: ${formatIndex(CPI_DATA.excluding[i])}<extra></extra>`,
    );

    const selectionKey = selectedPoints
        ? selectedPoints.map((arr) => arr.join('-')).join('_')
        : 'all';

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-44 household-energy-expenditures-household-expenditures"
            role="main"
            aria-labelledby="household-energy-expenditures-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-44.household-energy-expenditures-household-expenditures {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.household-energy-expenditures-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.household-energy-expenditures-title {
    font-family: 'Lato', sans-serif;
    font-size: 50px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 24px 0;
    line-height: 1.2;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: none;
}
.household-energy-expenditures-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.household-energy-expenditures-top-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    gap: 28px;
    align-items: stretch;
    margin-bottom: 32px;
}
.household-energy-expenditures-infographic-col {
    min-width: 0;
    display: flex;
    flex-direction: column;
    height: 100%;
}
.household-energy-expenditures-infographic-visual {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
}
.household-energy-expenditures-infographic-figure {
    display: block;
    width: 100%;
    margin: 0;
}
.household-energy-expenditures-bg-image {
    display: block;
    width: 100%;
    height: auto;
    user-select: none;
}
.household-energy-expenditures-infographic-download {
    flex: 0 0 auto;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 15px;
}
.household-energy-expenditures-download-btn {
    padding: 8px 16px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.household-energy-expenditures-download-btn:hover { background-color: #404040 !important; }
.household-energy-expenditures-top-bullets {
    font-family: var(--font-body);
    font-size: 20px;
    color: var(--gc-text);
    line-height: 1.5;
    margin: 0;
    padding-left: 1.25rem;
}
.household-energy-expenditures-top-bullets li { margin-bottom: 0.75rem; }
.household-energy-expenditures-subtitle {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 16px 0;
    line-height: 1.25;
    text-transform: none;
}
.household-energy-expenditures-bottom-bullets {
    font-family: var(--font-body);
    font-size: 20px;
    color: var(--gc-text);
    line-height: 1.5;
    margin: 0 0 24px 0;
    padding-left: 1.25rem;
}
.household-energy-expenditures-bottom-bullets li { margin-bottom: 0.65rem; }
.household-energy-expenditures-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    box-sizing: border-box;
    overflow: visible;
}
.household-energy-expenditures-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
}
.household-energy-expenditures-chart {
    width: 100%;
    min-width: 0;
    height: ${plotHeight}px;
    position: relative;
}
.household-energy-expenditures-chart > div { width: 100%; height: 100%; }
.household-energy-expenditures-legend {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 18px 28px;
    margin-top: 12px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: var(--gc-text);
}
.household-energy-expenditures-legend-item { display: inline-flex; align-items: center; gap: 8px; }
.household-energy-expenditures-legend-line {
    width: 28px;
    height: 0;
    border-top: 3px solid;
    display: inline-block;
}
.household-energy-expenditures-legend-line--dashed { border-top-style: dashed; }
.household-energy-expenditures-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.household-energy-expenditures-table-wrapper details > summary {
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
.household-energy-expenditures-table-wrapper details > summary::-webkit-details-marker { display: none; }
.household-energy-expenditures-table-wrapper details > summary:hover,
.household-energy-expenditures-chart-frame button[type="button"]:hover { background-color: #404040 !important; }
.household-energy-expenditures-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.household-energy-expenditures-table-scrollbar > div { height: 20px; }
.household-energy-expenditures-table-responsive {
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
.household-energy-expenditures-table-responsive::-webkit-scrollbar { display: none; }
.household-energy-expenditures-table-responsive table { width: max-content; min-width: 100%; border-collapse: collapse; }
.household-energy-expenditures-table-responsive th,
.household-energy-expenditures-table-responsive td {
    padding: 8px 12px;
    border: 1px solid #ddd;
    font-family: Arial, sans-serif;
    color: var(--gc-text);
    white-space: nowrap;
}
.household-energy-expenditures-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.household-energy-expenditures-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.household-energy-expenditures-download-buttons button:hover { background: #404040 !important; }
@media (max-width: 768px) {
    .household-energy-expenditures-title { font-size: 37px; }
    .household-energy-expenditures-top-row { grid-template-columns: 1fr; gap: 20px; }
    .household-energy-expenditures-infographic-col { height: auto; }
    .household-energy-expenditures-infographic-visual { flex: 0 0 auto; }
    .household-energy-expenditures-subtitle,
    .household-energy-expenditures-chart-title { font-size: 26px; }
    .household-energy-expenditures-top-bullets,
    .household-energy-expenditures-bottom-bullets { font-size: 18px; }
}
@media (max-width: 480px) {
    .household-energy-expenditures-title { font-size: 28px; }
    .household-energy-expenditures-chart { height: 320px; }
}
            `}</style>

            <div className="household-energy-expenditures-inner">
                <header>
                    <h1 id="household-energy-expenditures-title" className="household-energy-expenditures-title">
                        {pageTitle}
                    </h1>
                </header>

                <div className="household-energy-expenditures-top-row" ref={topRowRef}>
                    <div className="household-energy-expenditures-infographic-col">
                        <div className="household-energy-expenditures-infographic-visual">
                            <figure
                                ref={infographicRef}
                                className="household-energy-expenditures-infographic-figure"
                                aria-label={getText('household_energy_expenditures_infographic_aria', lang)}
                            >
                                <img src={householdEnergyExpendituresBg} alt="" className="household-energy-expenditures-bg-image" draggable={false} aria-hidden="true" />
                                <figcaption className="wb-inv">{getText('household_energy_expenditures_infographic_aria', lang)}</figcaption>
                            </figure>
                        </div>
                        <div className="household-energy-expenditures-infographic-download">
                            <button type="button" className="household-energy-expenditures-download-btn" onClick={downloadInfographicPng}>
                                {getText('household_energy_expenditures_download_png', lang)}
                            </button>
                        </div>
                    </div>

                    <ul className="household-energy-expenditures-top-bullets" role="list">
                        <li role="listitem">
                            {getText('household_energy_expenditures_top_bullet1_part1', lang)}
                            <strong>{getText('household_energy_expenditures_top_bullet1_bold', lang)}</strong>
                            {getText('household_energy_expenditures_top_bullet1_part2', lang)}
                        </li>
                        <li role="listitem">
                            {getText('household_energy_expenditures_top_bullet2_part1', lang)}
                            <strong>{getText('household_energy_expenditures_top_bullet2_bold', lang)}</strong>
                            {getText('household_energy_expenditures_top_bullet2_part2', lang)}
                        </li>
                        <li role="listitem">
                            {getText('household_energy_expenditures_top_bullet3_part1', lang)}
                            <strong>{getText('household_energy_expenditures_top_bullet3_bold', lang)}</strong>
                            {getText('household_energy_expenditures_top_bullet3_part2', lang)}
                        </li>
                        <li role="listitem">
                            {getText('household_energy_expenditures_top_bullet4_part1', lang)}
                            <strong>{getText('household_energy_expenditures_top_bullet4_bold', lang)}</strong>
                            {getText('household_energy_expenditures_top_bullet4_part2', lang)}
                            {getText('household_energy_expenditures_top_bullet4_suffix', lang)}
                        </li>
                    </ul>
                </div>

                <section className="household-energy-expenditures-bottom-section" aria-labelledby="household-energy-expenditures-subtitle">
                    <h2 id="household-energy-expenditures-subtitle" className="household-energy-expenditures-subtitle">
                        {getText('household_energy_expenditures_subtitle', lang)}
                    </h2>

                    <ul className="household-energy-expenditures-bottom-bullets" role="list">
                        <li role="listitem">{getText('household_energy_expenditures_bottom_bullet1', lang)}</li>
                        <li role="listitem">{getText('household_energy_expenditures_bottom_bullet2', lang)}</li>
                    </ul>

                    <div className="household-energy-expenditures-chart-frame">
                        <h3 className="household-energy-expenditures-chart-title">{chartTitle}</h3>

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

                        <figure ref={chartRef} style={{ margin: 0 }}>
                            <div role="region" aria-label={getText('household_energy_expenditures_chart_aria', lang)} tabIndex="0">
                                <Plot
                                    key={`household-energy-expenditures-${selectionKey}-${plotHeight}`}
                                    data={[
                                        {
                                            x: CPI_YEARS,
                                            y: CPI_DATA.energy,
                                            type: 'scatter',
                                            mode: 'lines+markers',
                                            name: legendEnergy,
                                            line: { color: lineColorFor(0, COLORS.energy), width: 2.5 },
                                            marker: {
                                                color: COLORS.energy,
                                                size: 7,
                                                opacity: CPI_YEARS.map((_, i) => markerOpacityFor(0, i)),
                                            },
                                            hovertemplate: energyHover,
                                        },
                                        {
                                            x: CPI_YEARS,
                                            y: CPI_DATA.total,
                                            type: 'scatter',
                                            mode: 'lines+markers',
                                            name: legendTotal,
                                            line: { color: lineColorFor(1, COLORS.total), width: 2.5 },
                                            marker: {
                                                color: COLORS.total,
                                                size: 7,
                                                opacity: CPI_YEARS.map((_, i) => markerOpacityFor(1, i)),
                                            },
                                            hovertemplate: totalHover,
                                        },
                                        {
                                            x: CPI_YEARS,
                                            y: CPI_DATA.excluding,
                                            type: 'scatter',
                                            mode: 'lines+markers',
                                            name: legendExcluding,
                                            line: { color: lineColorFor(2, COLORS.excluding), width: 2.5, dash: 'dash' },
                                            marker: {
                                                color: COLORS.excluding,
                                                size: 7,
                                                opacity: CPI_YEARS.map((_, i) => markerOpacityFor(2, i)),
                                            },
                                            hovertemplate: excludingHover,
                                        },
                                    ]}
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
                                            tickvals: CPI_YEARS.filter((y) => y % 2 === 1),
                                            ticktext: CPI_YEARS.filter((y) => y % 2 === 1).map(String),
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
                                            range: [90, 250],
                                            tickmode: 'array',
                                            tickvals: yTickvals,
                                            ticktext: yTickvals.map((v) => formatIndex(v)),
                                            showgrid: true,
                                            gridcolor: '#e0e0e0',
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
                                    className="household-energy-expenditures-chart"
                                    useResizeHandler
                                    onClick={handleChartClick}
                                />
                            </div>
                        </figure>

                        <div className="household-energy-expenditures-legend" aria-hidden="true">
                            <div className="household-energy-expenditures-legend-item">
                                <span className="household-energy-expenditures-legend-line" style={{ borderColor: COLORS.energy }} />
                                <span>{legendEnergy}</span>
                            </div>
                            <div className="household-energy-expenditures-legend-item">
                                <span className="household-energy-expenditures-legend-line" style={{ borderColor: COLORS.total }} />
                                <span>{legendTotal}</span>
                            </div>
                            <div className="household-energy-expenditures-legend-item">
                                <span className="household-energy-expenditures-legend-line household-energy-expenditures-legend-line--dashed" style={{ borderColor: COLORS.excluding }} />
                                <span>{legendExcluding}</span>
                            </div>
                        </div>

                        <div className="household-energy-expenditures-table-wrapper">
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
                                <div ref={topScrollRef} className="household-energy-expenditures-table-scrollbar" aria-hidden="true">
                                    <div />
                                </div>
                                <div ref={tableScrollRef} className="household-energy-expenditures-table-responsive" role="region" tabIndex="0">
                                    <table className="table table-striped table-hover">
                                        <caption className="wb-inv">{getText('household_energy_expenditures_table_caption', lang)}</caption>
                                        <thead>
                                            <tr>
                                                {tableHeaders.map((hdr) => (
                                                    <th
                                                        key={hdr}
                                                        scope="col"
                                                        style={{ fontWeight: 'bold', textAlign: hdr === tableHeaders[0] ? 'left' : 'center' }}
                                                    >
                                                        {hdr}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tableRowsDesc.map((row) => (
                                                <tr key={row.year}>
                                                    <th scope="row" style={{ fontWeight: 'bold' }}>
                                                        {row.year}
                                                    </th>
                                                    <td style={{ textAlign: 'center' }}>{formatIndex(row.energy)}</td>
                                                    <td style={{ textAlign: 'center' }}>{formatIndex(row.total)}</td>
                                                    <td style={{ textAlign: 'center' }}>{formatIndex(row.excluding)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div className="household-energy-expenditures-download-buttons">
                                        <button type="button" onClick={downloadTableAsCSV}>
                                            {getText('household_energy_expenditures_download_csv', lang)}
                                        </button>
                                        <button type="button" onClick={downloadTableAsDocx}>
                                            {getText('household_energy_expenditures_download_docx', lang)}
                                        </button>
                                    </div>
                                </div>
                                <div ref={bottomScrollRef} className="household-energy-expenditures-table-scrollbar" aria-hidden="true">
                                    <div />
                                </div>
                            </details>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
};

export default HouseholdEnergyExpenditures;
