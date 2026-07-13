import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import worldBiofuelsBgEn from '../assets/world_biofuels_production_bg.svg';
import worldBiofuelsBgFr from '../assets/world_biofuels_production_bg_fr.svg';
import {
    TRACE_KEYS,
    LEGEND_KEYS,
    COLORS,
    DOC_COLUMN_WIDTHS,
    Y_TICKVALS,
    Y_RANGE,
    START_YEAR,
    END_YEAR,
    CHART_DATA,
    rowTotal,
} from './WorldBiofuelsProduction.constants';

const TRACE_COUNT = TRACE_KEYS.length;

const HOVER_LABEL = {
    bgcolor: '#ffffff',
    bordercolor: '#000000',
    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
};

const DENSIFY_STEPS = 12;

const densifyBandSeries = (years, yTops, yBases, label, categoryValues, formatHover) => {
    if (!years.length) return { x: [], y: [], hover: [] };

    const xDense = [];
    const topDense = [];
    const baseDense = [];
    const hover = [];

    const pushPoint = (xVal, top, bottom, nearestIdx) => {
        xDense.push(xVal);
        topDense.push(top);
        baseDense.push(bottom);
        hover.push(`<b>${label}</b><br>${years[nearestIdx]}: ${formatHover(categoryValues[nearestIdx])}<extra></extra>`);
    };

    if (years.length === 1) {
        pushPoint(years[0], yTops[0], yBases[0] ?? 0, 0);
    } else {
        for (let i = 0; i < years.length - 1; i += 1) {
            for (let s = 0; s < DENSIFY_STEPS; s += 1) {
                const t = s / DENSIFY_STEPS;
                const xVal = years[i] + t * (years[i + 1] - years[i]);
                const top = yTops[i] + t * (yTops[i + 1] - yTops[i]);
                const bottom = yBases[i] + t * (yBases[i + 1] - yBases[i]);
                const nearestIdx = t < 0.5 ? i : i + 1;
                pushPoint(xVal, top, bottom, nearestIdx);
            }
        }
        const last = years.length - 1;
        pushPoint(years[last], yTops[last], yBases[last], last);
    }

    const hoverClosed = [...hover, ...hover.slice().reverse()];
    return {
        x: [...xDense, ...xDense.slice().reverse()],
        y: [...topDense, ...baseDense.slice().reverse()],
        hover: hoverClosed,
    };
};

const traceIndexFromCurveNumber = (curveNumber) => {
    if (curveNumber == null || curveNumber < 0) return null;
    if (curveNumber < TRACE_COUNT) return curveNumber;
    if (curveNumber < TRACE_COUNT * 2) return curveNumber - TRACE_COUNT;
    return null;
};

const traceOpacityFor = (selectedTraceIds, traceIndex) => {
    if (selectedTraceIds === null || selectedTraceIds.includes(traceIndex)) return 1;
    return 0.3;
};

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    }
    return hex;
};

/** Build cumulative tops for each band (bottom → top). Index 0 top = values[0], etc. */
const buildCumTops = (valueArrays) => {
    const n = valueArrays[0]?.length ?? 0;
    return valueArrays.map((_, bandIdx) =>
        Array.from({ length: n }, (_, i) => {
            let sum = 0;
            for (let b = 0; b <= bandIdx; b += 1) sum += valueArrays[b][i];
            return sum;
        }),
    );
};

const resolveHoverFromPointer = (graphDiv, clientX, clientY, data) => {
    if (!graphDiv?._fullLayout || !data?.years?.length) return null;

    const { years, traceLabels, traceValueArrays, cumTops, yRangeMax, formatHover } = data;

    const xax = graphDiv._fullLayout.xaxis;
    const yax = graphDiv._fullLayout.yaxis;
    const gdRect = graphDiv.getBoundingClientRect();
    const xPx = clientX - gdRect.left - xax._offset;
    const yPx = clientY - gdRect.top - yax._offset;

    if (xPx < 0 || xPx > xax._length || yPx < 0 || yPx > yax._length) return null;

    const xData = xax.p2l(xPx);
    const yData = yax.p2l(yPx);
    if (xData < years[0] || xData > years[years.length - 1]) return null;
    if (yData < 0 || yData > yRangeMax) return null;

    let nearestIndex = 0;
    let minDist = Infinity;
    years.forEach((year, i) => {
        const dist = Math.abs(year - xData);
        if (dist < minDist) {
            minDist = dist;
            nearestIndex = i;
        }
    });

    let segIndex = years.length - 2;
    for (let i = 0; i < years.length - 1; i += 1) {
        if (xData <= years[i + 1]) {
            segIndex = i;
            break;
        }
    }
    segIndex = Math.max(0, Math.min(segIndex, years.length - 2));

    const x0 = years[segIndex];
    const x1 = years[segIndex + 1];
    const t = x1 === x0 ? 0 : (xData - x0) / (x1 - x0);
    const lerp = (arr) => arr[segIndex] + t * (arr[segIndex + 1] - arr[segIndex]);

    const bandBounds = cumTops.map((tops, bandIdx) => {
        const lo = bandIdx === 0 ? 0 : lerp(cumTops[bandIdx - 1]);
        const hi = lerp(tops);
        return [lo, hi];
    });

    const yEpsilon = yRangeMax * 0.002;
    let traceIndex = null;
    for (let i = TRACE_COUNT - 1; i >= 0; i -= 1) {
        const [lo, hi] = bandBounds[i];
        if (yData >= lo - yEpsilon && yData <= hi + yEpsilon) {
            traceIndex = i;
            break;
        }
    }
    if (traceIndex === null) return null;

    return {
        traceIndex,
        nearestIndex,
        xData,
        category: traceLabels[traceIndex],
        year: years[nearestIndex],
        value: formatHover(traceValueArrays[traceIndex][nearestIndex]),
    };
};

const waitForImage = (img) =>
    new Promise((resolve, reject) => {
        if (img.complete && img.naturalWidth > 0) {
            resolve(img);
            return;
        }
        img.onload = () => resolve(img);
        img.onerror = reject;
    });

const exportInfographicPng = async (imgEl, { scale = 2 } = {}) => {
    if (!imgEl) return null;
    const loaded = await waitForImage(imgEl);
    const canvas = document.createElement('canvas');
    canvas.width = loaded.naturalWidth * scale;
    canvas.height = loaded.naturalHeight * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(loaded, 0, 0, loaded.naturalWidth, loaded.naturalHeight);
    return canvas;
};

const WorldBiofuelsProductionPlot = memo(function WorldBiofuelsProductionPlot({
    plotData, plotLayout, chartConfig, plotHeight, onPlotReady,
}) {
    return (
        <Plot
            key={`world-biofuels-production-${plotHeight}`}
            data={plotData}
            layout={plotLayout}
            config={chartConfig}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
            onInitialized={onPlotReady}
            onUpdate={onPlotReady}
        />
    );
});

const WorldBiofuelsProduction = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedTraceIds, setSelectedTraceIds] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const chartRef = useRef(null);
    const graphDivRef = useRef(null);
    const clickHandlerRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null });
    const hoverDataRef = useRef(null);
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);
    const infographicImgRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');
    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const formatPj = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const hoverUnit = getText('world_biofuels_production_hover_unit', lang);
    const tableUnitSuffix = getText('world_biofuels_production_table_unit', lang);

    const formatHover = (value) => {
        const formatted = formatPj(value);
        return formatted === '—' ? formatted : `${formatted}${hoverUnit}`;
    };

    const tableRows = CHART_DATA;
    const years = tableRows.map((row) => row.year);
    const yearTicks = years.filter((y) => y % 2 === 1);
    const tableRowsDesc = useMemo(() => [...tableRows].slice().reverse(), []);

    const traceLabels = TRACE_KEYS.map((key) => getText(`world_biofuels_production_legend_${key}`, lang));
    const chartTitle = getText('world_biofuels_production_chart_title', lang);
    const pageTitle = getText('world_biofuels_production_title', lang);
    const yAxisTitle = getText('world_biofuels_production_yaxis', lang);
    const downloadTitle = getText('world_biofuels_production_download_title', lang);
    const fileTitle = `${downloadTitle}_${START_YEAR}-${END_YEAR}`;
    const infographicFileTitle = getText('world_biofuels_production_infographic_download_title', lang);
    const tableCaption = getText('world_biofuels_production_table_caption', lang);
    const supplyDemandTitle = getText('world_biofuels_production_supply_demand_title', lang);
    const bgImage = lang === 'en' ? worldBiofuelsBgEn : worldBiofuelsBgFr;

    const tableHeaders = [
        getText('world_biofuels_production_table_col_year', lang),
        ...traceLabels.map((label) => `${label} ${tableUnitSuffix}`),
        `${getText('world_biofuels_production_table_col_total', lang)} ${tableUnitSuffix}`,
    ];

    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 72 : windowWidth <= 768 ? 62 : 50;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    const traceValueArrays = TRACE_KEYS.map((key) => tableRows.map((row) => row[key]));
    const cumTops = buildCumTops(traceValueArrays);
    const zeroBases = years.map(() => 0);

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
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
    }, [lang, selectedTraceIds]);

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
    }, [isTableOpen, windowWidth, syncTableScroll]);

    const toggleTraceSelection = useCallback((traceIndex) => {
        setSelectedTraceIds((prev) => {
            if (prev === null) return [traceIndex];
            if (prev.includes(traceIndex)) {
                const next = prev.filter((t) => t !== traceIndex);
                return next.length === 0 ? null : next;
            }
            return [...prev, traceIndex];
        });
    }, []);

    const applyTraceSelection = useCallback(
        (traceIndex) => {
            if (traceIndex == null || traceIndex < 0 || traceIndex >= TRACE_COUNT) return;

            if (windowWidth <= 768) {
                const currentTime = Date.now();
                const lastClick = lastClickRef.current;
                const isDoubleTap = traceIndex === lastClick.traceIndex && currentTime - lastClick.time < 300;
                lastClickRef.current = { time: currentTime, traceIndex };
                if (!isDoubleTap) return;
            }

            toggleTraceSelection(traceIndex);
        },
        [windowWidth, toggleTraceSelection],
    );

    const handleChartClick = useCallback(
        (event) => {
            let traceIndex = null;
            if (event?.points?.length) {
                traceIndex = traceIndexFromCurveNumber(event.points[0].curveNumber);
            }
            if (traceIndex == null && event?.event && graphDivRef.current) {
                const resolved = resolveHoverFromPointer(
                    graphDivRef.current,
                    event.event.clientX,
                    event.event.clientY,
                    hoverDataRef.current,
                );
                if (resolved) traceIndex = resolved.traceIndex;
            }
            if (traceIndex == null) return;
            applyTraceSelection(traceIndex);
        },
        [applyTraceSelection],
    );

    useEffect(() => {
        clickHandlerRef.current = handleChartClick;
    }, [handleChartClick]);

    const bindPlotHandlers = useCallback((graphDiv) => {
        if (!graphDiv?.on) return;
        graphDivRef.current = graphDiv;

        if (graphDiv._worldBiofuelsProductionClick) {
            graphDiv.removeListener('plotly_click', graphDiv._worldBiofuelsProductionClick);
        }

        const clickHandler = (event) => clickHandlerRef.current?.(event);
        graphDiv._worldBiofuelsProductionClick = clickHandler;
        graphDiv.on('plotly_click', clickHandler);
    }, []);

    const onPlotReady = useCallback(
        (_figure, graphDiv) => bindPlotHandlers(graphDiv),
        [bindPlotHandlers],
    );

    const downloadChartPng = async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        const title = stripHtml(chartTitle);
        try {
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
                const legendItems = LEGEND_KEYS.map((key) => ({
                    color: COLORS[key],
                    label: getText(`world_biofuels_production_legend_${key}`, lang),
                }));
                const itemWidth = Math.max(180, Math.floor(canvas.width / Math.max(legendItems.length, 1)));
                const totalWidth = legendItems.length * itemWidth;
                let x = (canvas.width - totalWidth) / 2 + 20;
                ctx.font = '22px Arial';
                ctx.textAlign = 'left';
                legendItems.forEach((item) => {
                    ctx.fillStyle = item.color;
                    ctx.fillRect(x, legendY - 10, 24, 24);
                    ctx.fillStyle = '#333333';
                    ctx.fillText(item.label, x + 32, legendY + 6);
                    x += itemWidth;
                });
                canvas.toBlob((blob) => {
                    if (blob) saveAs(blob, `${fileTitle}.png`);
                });
            };
            img.src = imgData;
        } catch {
            /* ignore export errors */
        }
    };

    const downloadCsv = () => {
        const header = tableHeaders.map(csvEscape).join(',');
        const rows = tableRowsDesc.map((row) => {
            const total = rowTotal(row);
            return [row.year, ...TRACE_KEYS.map((key) => row[key]), total].map(csvEscape).join(',');
        });
        saveAs(new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' }), `${fileTitle}.csv`);
    };

    const downloadDocx = async () => {
        const headerRow = new TableRow({
            children: tableHeaders.map(
                (header) =>
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 22 })], alignment: AlignmentType.CENTER })],
                        shading: { fill: 'E6E6E6' },
                    }),
            ),
        });
        const dataRows = tableRowsDesc.map((row) => {
            const total = rowTotal(row);
            const values = [row.year, ...TRACE_KEYS.map((key) => row[key]), total];
            return new TableRow({
                children: values.map((value, index) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: String(value), size: 22 })],
                                alignment: index === 0 ? AlignmentType.CENTER : AlignmentType.RIGHT,
                            }),
                        ],
                    }),
                ),
            });
        });
        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: stripHtml(chartTitle), bold: true, size: 28 })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: DOC_COLUMN_WIDTHS,
                            rows: [headerRow, ...dataRows],
                        }),
                    ],
                },
            ],
        });
        saveAs(await Packer.toBlob(doc), `${fileTitle}.docx`);
    };

    const downloadInfographicPng = async () => {
        const canvas = await exportInfographicPng(infographicImgRef.current, { scale: 2 });
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${infographicFileTitle}.png`);
        });
    };

    const downloadBtnStyle = {
        padding: '8px 16px',
        backgroundColor: '#8C8C8C',
        border: '1px solid #404040',
        borderRadius: '4px',
        cursor: 'pointer',
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        color: '#ffffff',
    };

    const denseBands = TRACE_KEYS.map((key, bandIdx) => {
        const yTops = cumTops[bandIdx];
        const yBases = bandIdx === 0 ? zeroBases : cumTops[bandIdx - 1];
        return densifyBandSeries(
            years,
            yTops,
            yBases,
            traceLabels[bandIdx],
            traceValueArrays[bandIdx],
            formatHover,
        );
    });

    useEffect(() => {
        hoverDataRef.current = {
            years,
            traceLabels,
            traceValueArrays,
            cumTops,
            yRangeMax: Y_RANGE[1],
            formatHover,
        };
    });

    const plotData = [
        ...TRACE_KEYS.map((key, traceIndex) => ({
            type: 'scatter',
            mode: 'lines',
            x: years,
            y: traceValueArrays[traceIndex],
            stackgroup: 'world-biofuels',
            fill: traceIndex === 0 ? 'tozeroy' : 'tonexty',
            line: { color: hexToRgba(COLORS[key], traceOpacityFor(selectedTraceIds, traceIndex)), width: 0 },
            fillcolor: hexToRgba(COLORS[key], traceOpacityFor(selectedTraceIds, traceIndex)),
            connectgaps: true,
            hoverinfo: 'skip',
            showlegend: false,
        })),
        ...denseBands.map(({ x, y, hover }) => ({
            type: 'scatter',
            x,
            y,
            fill: 'toself',
            fillcolor: 'rgba(0,0,0,0.001)',
            line: { color: 'rgba(0,0,0,0)', width: 0 },
            hoveron: 'points+fills',
            hovertemplate: hover,
            showlegend: false,
            name: '',
        })),
    ];

    return (
        <main
            tabIndex="-1"
            className="page-content world-biofuels-production"
            role="main"
            aria-label={pageTitle}
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.world-biofuels-production.page-content { max-width: none !important; overflow-x: visible !important; }
.world-biofuels-production {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.world-biofuels-production-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.world-biofuels-production-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-top: 0;
    margin-bottom: 0;
    box-sizing: border-box;
    overflow: visible;
}
.world-biofuels-production-chart-title,
.world-biofuels-production-supply-demand-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
}
.world-biofuels-production-supply-demand-title { margin-top: 32px; }
.world-biofuels-production-chart { width: 100%; min-width: 0; height: ${plotHeight}px; position: relative; }
.world-biofuels-production-chart > div { width: 100%; height: 100%; }
.world-biofuels-production-legend {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 18px 28px;
    flex-wrap: wrap;
    margin-top: 12px;
    margin-bottom: 8px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: var(--gc-text);
}
.world-biofuels-production-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
}
.world-biofuels-production-legend-swatch { width: 22px; height: 14px; display: inline-block; border: 1px solid rgba(0, 0, 0, 0.12); }
.world-biofuels-production-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.world-biofuels-production-download-buttons button:hover,
.world-biofuels-production .data-table-wrapper summary:hover,
.world-biofuels-production .data-table-wrapper button:hover { background-color: #404040 !important; }
.world-biofuels-production .data-table-wrapper { padding-top: 5px; margin-top: 20px; width: 100%; box-sizing: border-box; }
.world-biofuels-production .data-table-wrapper summary {
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    padding: 10px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    list-style: none;
    box-sizing: border-box;
    width: 100%;
    color: #ffffff;
}
.world-biofuels-production .data-table-wrapper summary::-webkit-details-marker { display: none; }
.world-biofuels-production-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.world-biofuels-production-table-scrollbar > div { height: 20px; }
.world-biofuels-production .table-responsive table {
    font-family: var(--font-body);
    font-size: 14px;
    color: #000000;
}
.world-biofuels-production .table-responsive th,
.world-biofuels-production .table-responsive td {
    font-family: var(--font-body);
    font-size: 14px;
    color: #000000;
}
.world-biofuels-production-infographic-section { margin-top: 8px; }
.world-biofuels-production-infographic-figure { margin: 0; width: 100%; }
.world-biofuels-production-bg-image {
    display: block;
    width: 100%;
    height: auto;
    max-width: 100%;
}
@media (max-width: 768px) {
    .world-biofuels-production-chart-title,
    .world-biofuels-production-supply-demand-title { font-size: 26px; }
}
            `}</style>
            <div className="world-biofuels-production-inner">
                <div className="world-biofuels-production-chart-frame">
                    <h2 id="world-biofuels-production-chart-title" className="world-biofuels-production-chart-title">{chartTitle}</h2>

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
                                {getText('world_biofuels_production_clear_selection', lang)}
                            </button>
                        </div>
                    )}

                    <figure
                        ref={chartRef}
                        className="world-biofuels-production-chart"
                        role="region"
                        aria-label={chartTitle}
                        tabIndex={0}
                        style={{ margin: 0 }}
                    >
                        <WorldBiofuelsProductionPlot
                            plotData={plotData}
                            plotLayout={{
                                showlegend: false,
                                hovermode: 'closest',
                                hoverdistance: 50,
                                hoverlabel: HOVER_LABEL,
                                clickmode: 'event',
                                dragmode: false,
                                margin: { t: plotTopMargin, b: plotBottomMargin, l: 72, r: 24 },
                                paper_bgcolor: 'rgba(0,0,0,0)',
                                plot_bgcolor: 'rgba(0,0,0,0)',
                                autosize: true,
                                xaxis: {
                                    tickmode: 'array',
                                    tickvals: yearTicks,
                                    ticktext: yearTicks.map(String),
                                    range: years.length
                                        ? [years[0], years[years.length - 1]]
                                        : undefined,
                                    tickfont: tickFont,
                                    showgrid: false,
                                    showline: true,
                                    linewidth: 1,
                                    linecolor: '#333',
                                    automargin: true,
                                    fixedrange: true,
                                },
                                yaxis: {
                                    title: { text: yAxisTitle, font: axisTitleFont, standoff: 12 },
                                    tickvals: Y_TICKVALS,
                                    ticktext: Y_TICKVALS.map((v) => formatPj(v)),
                                    range: Y_RANGE,
                                    tickfont: tickFont,
                                    showgrid: false,
                                    showline: true,
                                    linewidth: 1,
                                    linecolor: '#333',
                                    zeroline: false,
                                    automargin: true,
                                    fixedrange: true,
                                },
                            }}
                            chartConfig={{
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
                                modeBarButtonsToAdd: [{
                                    name: getText('world_biofuels_production_download_png', lang),
                                    icon: {
                                        width: 24,
                                        height: 24,
                                        path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z',
                                    },
                                    click: (gd) => downloadChartPng(gd),
                                }],
                            }}
                            plotHeight={plotHeight}
                            onPlotReady={onPlotReady}
                        />
                    </figure>

                    <div className="world-biofuels-production-legend" aria-hidden="true">
                        {LEGEND_KEYS.map((key) => (
                            <span key={key} className="world-biofuels-production-legend-item">
                                <span className="world-biofuels-production-legend-swatch" style={{ backgroundColor: COLORS[key] }} />
                                {getText(`world_biofuels_production_legend_${key}`, lang)}
                            </span>
                        ))}
                    </div>

                    <details className="data-table-wrapper" onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                        <summary role="button" aria-expanded={isTableOpen}>
                            <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                            {getText('world_biofuels_production_table_summary', lang)}
                            <span className="wb-inv">
                                {getText('world_biofuels_production_table_toggle_hint', lang)}
                            </span>
                        </summary>
                        <div ref={topScrollRef} className="world-biofuels-production-table-scrollbar" aria-hidden="true"><div /></div>
                        <div
                            ref={tableScrollRef}
                            className="table-responsive"
                            role="region"
                            aria-label={getText('world_biofuels_production_table_summary', lang)}
                            tabIndex={0}
                        >
                            <table className="table table-bordered table-striped table-hover">
                                <caption className="wb-inv">{tableCaption}</caption>
                                <thead>
                                    <tr>
                                        {tableHeaders.map((header, index) => (
                                            <th
                                                key={header}
                                                scope="col"
                                                style={{
                                                    fontWeight: 'bold',
                                                    textAlign: 'center',
                                                    whiteSpace: 'nowrap',
                                                    verticalAlign: 'bottom',
                                                    ...(index === 0
                                                        ? {
                                                              position: 'sticky',
                                                              left: 0,
                                                              backgroundColor: '#f8f9fa',
                                                              zIndex: 2,
                                                              borderRight: '2px solid #dee2e6',
                                                          }
                                                        : {}),
                                                }}
                                            >
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableRowsDesc.map((row) => {
                                        const total = rowTotal(row);
                                        return (
                                            <tr key={row.year}>
                                                <th
                                                    scope="row"
                                                    style={{
                                                        position: 'sticky',
                                                        left: 0,
                                                        zIndex: 1,
                                                        fontWeight: 'bold',
                                                        textAlign: 'center',
                                                        borderRight: '2px solid #dee2e6',
                                                    }}
                                                >
                                                    {row.year}
                                                </th>
                                                {TRACE_KEYS.map((key) => (
                                                    <td key={key} style={{ textAlign: 'right' }}>{formatPj(row[key])}</td>
                                                ))}
                                                <td style={{ textAlign: 'right' }}>{formatPj(total)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div ref={bottomScrollRef} className="world-biofuels-production-table-scrollbar" aria-hidden="true"><div /></div>
                        <div className="world-biofuels-production-download-buttons">
                            <button type="button" onClick={downloadCsv} style={downloadBtnStyle}>
                                {getText('world_biofuels_production_download_csv', lang)}
                            </button>
                            <button type="button" onClick={downloadDocx} style={downloadBtnStyle}>
                                {getText('world_biofuels_production_download_docx', lang)}
                            </button>
                        </div>
                    </details>
                </div>

                <h2 className="world-biofuels-production-supply-demand-title">{supplyDemandTitle}</h2>

                <div className="world-biofuels-production-infographic-section">
                    <figure
                        className="world-biofuels-production-infographic-figure"
                        aria-label={getText('world_biofuels_production_infographic_aria', lang)}
                    >
                        <img
                            ref={infographicImgRef}
                            src={bgImage}
                            alt=""
                            className="world-biofuels-production-bg-image"
                            draggable={false}
                            aria-hidden="true"
                        />
                        <figcaption className="wb-inv">
                            {getText('world_biofuels_production_infographic_aria', lang)}
                        </figcaption>
                    </figure>

                    <div className="world-biofuels-production-download-buttons">
                        <button type="button" onClick={downloadInfographicPng} style={downloadBtnStyle}>
                            {getText('world_biofuels_production_download_infographic_png', lang)}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default WorldBiofuelsProduction;
