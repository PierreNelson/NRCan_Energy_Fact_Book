import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getPage74Data } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const TRACE_KEYS = ['hydro', 'wind', 'solarTidal', 'biomass'];
const LEGEND_KEYS = [...TRACE_KEYS].reverse();
const TRACE_COUNT = TRACE_KEYS.length;

const COLORS = {
    hydro: '#2B5C3F',
    wind: '#5E9348',
    solarTidal: '#C4D56E',
    biomass: '#6D91B3',
};

const HOVER_LABEL = {
    bgcolor: '#ffffff',
    bordercolor: '#000000',
    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
};

const DENSIFY_STEPS = 12;

const densifyBandSeries = (years, yTops, yBases, label, categoryValues, formatHoverMw) => {
    if (!years.length) return { x: [], y: [], hover: [] };

    const xDense = [];
    const topDense = [];
    const baseDense = [];
    const hover = [];

    const pushPoint = (xVal, top, bottom, nearestIdx) => {
        xDense.push(xVal);
        topDense.push(top);
        baseDense.push(bottom);
        hover.push(`<b>${label}</b><br>${years[nearestIdx]}: ${formatHoverMw(categoryValues[nearestIdx])}<extra></extra>`);
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

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const computeYAxis = (maxTotal) => {
    if (!maxTotal || maxTotal <= 0) {
        return { tickvals: [0, 20000, 40000, 60000, 80000, 100000], range: [0, 110000] };
    }
    const padded = maxTotal * 1.1;
    const magnitude = 10 ** Math.floor(Math.log10(padded));
    const step = padded <= 120000 ? 20000 : magnitude >= 100000 ? 100000 : 50000;
    const axisMax = Math.ceil(padded / step) * step;
    const tickvals = [];
    for (let v = 0; v <= axisMax; v += step) tickvals.push(v);
    return { tickvals, range: [0, axisMax] };
};

const resolveHoverFromPointer = (graphDiv, clientX, clientY, data) => {
    if (!graphDiv?._fullLayout || !data?.years?.length) return null;

    const {
        years, traceLabels, traceValueArrays, hydroValues,
        cumWindTops, cumSolarTidalTops, cumBiomassTops, yRangeMax, formatHoverMw,
    } = data;

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

    const bandBounds = [
        [0, lerp(hydroValues)],
        [lerp(hydroValues), lerp(cumWindTops)],
        [lerp(cumWindTops), lerp(cumSolarTidalTops)],
        [lerp(cumSolarTidalTops), lerp(cumBiomassTops)],
    ];

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
        value: formatHoverMw(traceValueArrays[traceIndex][nearestIndex]),
    };
};

const Page74Plot = memo(function Page74Plot({
    plotData, plotLayout, chartConfig, plotHeight, onPlotReady,
}) {
    return (
        <Plot
            key={`page74-${plotHeight}`}
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

const Page74 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
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

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');
    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const formatMw = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const hoverUnit = getText('page74_hover_unit', lang);
    const tableUnitSuffix = getText('page74_table_unit', lang);

    const formatHoverMw = (value) => {
        const formatted = formatMw(value);
        return formatted === '—' ? formatted : `${formatted}${hoverUnit}`;
    };

    useEffect(() => {
        getPage74Data()
            .then(setResult)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    const tableRows = useMemo(() => result?.data ?? [], [result]);
    const years = tableRows.map((row) => row.year);
    const startYear = result?.startYear;
    const endYear = result?.endYear;
    const yearTicks = years.filter((y) => y % 2 === 1);
    const tableRowsDesc = useMemo(() => [...tableRows].reverse(), [tableRows]);

    const hydroLabel = getText('page74_legend_hydro', lang);
    const windLabel = getText('page74_legend_wind', lang);
    const solarTidalLabel = getText('page74_legend_solarTidal', lang);
    const biomassLabel = getText('page74_legend_biomass', lang);
    const traceLabels = [hydroLabel, windLabel, solarTidalLabel, biomassLabel];
    const chartTitle = substitute(getText('page74_chart_title', lang), {
        startYear: startYear ?? '',
        endYear: endYear ?? '',
    });
    const yAxisTitle = getText('page74_yaxis', lang);
    const fileTitle = `${getText('page74_download_title', lang)}_${startYear ?? ''}-${endYear ?? ''}`;
    const tableCaption = substitute(getText('page74_table_caption', lang), {
        startYear: startYear ?? '',
        endYear: endYear ?? '',
    });

    const tableHeaders = [
        getText('page74_table_col_year', lang),
        `${hydroLabel} ${tableUnitSuffix}`,
        `${windLabel} ${tableUnitSuffix}`,
        `${solarTidalLabel} ${tableUnitSuffix}`,
        `${biomassLabel} ${tableUnitSuffix}`,
        `${getText('page74_table_col_total', lang)} ${tableUnitSuffix}`,
    ];

    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 72 : windowWidth <= 768 ? 62 : 50;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    const hydroValues = tableRows.map((row) => row.hydro);
    const windValues = tableRows.map((row) => row.wind);
    const solarTidalValues = tableRows.map((row) => row.solarTidal);
    const biomassValues = tableRows.map((row) => row.biomass);

    const maxTotal = useMemo(
        () => (tableRows.length
            ? Math.max(...tableRows.map((row) => row.hydro + row.wind + row.solarTidal + row.biomass))
            : 0),
        [tableRows],
    );
    const { tickvals: yTickvals, range: yRange } = useMemo(() => computeYAxis(maxTotal), [maxTotal]);

    const traceValueArrays = [hydroValues, windValues, solarTidalValues, biomassValues];
    const cumWindTops = years.map((_, i) => hydroValues[i] + windValues[i]);
    const cumSolarTidalTops = years.map((_, i) => hydroValues[i] + windValues[i] + solarTidalValues[i]);
    const cumBiomassTops = years.map(
        (_, i) => hydroValues[i] + windValues[i] + solarTidalValues[i] + biomassValues[i],
    );

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
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
    }, [lang, loading, error, result, selectedTraceIds]);

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

        if (graphDiv._page74Click) {
            graphDiv.removeListener('plotly_click', graphDiv._page74Click);
        }

        const clickHandler = (event) => clickHandlerRef.current?.(event);
        graphDiv._page74Click = clickHandler;
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
                    label: getText(`page74_legend_${key}`, lang),
                }));
                const totalWidth = legendItems.length * 260;
                let x = (canvas.width - totalWidth) / 2 + 20;
                ctx.font = '24px Arial';
                ctx.textAlign = 'left';
                legendItems.forEach((item) => {
                    ctx.fillStyle = item.color;
                    ctx.fillRect(x, legendY - 10, 24, 24);
                    ctx.fillStyle = '#333333';
                    ctx.fillText(item.label, x + 32, legendY + 6);
                    x += 260;
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
            const total = row.hydro + row.wind + row.solarTidal + row.biomass;
            return [row.year, row.hydro, row.wind, row.solarTidal, row.biomass, total].map(csvEscape).join(',');
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
            const total = row.hydro + row.wind + row.solarTidal + row.biomass;
            return new TableRow({
                children: [row.year, row.hydro, row.wind, row.solarTidal, row.biomass, total].map((value, index) =>
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
                            columnWidths: [1200, 1700, 1700, 2200, 1500, 1500],
                            rows: [headerRow, ...dataRows],
                        }),
                    ],
                },
            ],
        });
        saveAs(await Packer.toBlob(doc), `${fileTitle}.docx`);
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

    const zeroBases = years.map(() => 0);
    const hydroDense = densifyBandSeries(years, hydroValues, zeroBases, hydroLabel, hydroValues, formatHoverMw);
    const windDense = densifyBandSeries(years, cumWindTops, hydroValues, windLabel, windValues, formatHoverMw);
    const solarTidalDense = densifyBandSeries(years, cumSolarTidalTops, cumWindTops, solarTidalLabel, solarTidalValues, formatHoverMw);
    const biomassDense = densifyBandSeries(years, cumBiomassTops, cumSolarTidalTops, biomassLabel, biomassValues, formatHoverMw);

    hoverDataRef.current = {
        years,
        traceLabels,
        traceValueArrays,
        hydroValues,
        cumWindTops,
        cumSolarTidalTops,
        cumBiomassTops,
        yRangeMax: yRange[1],
        formatHoverMw,
    };

    const traceDefs = [
        { key: 'hydro', values: hydroValues, fill: 'tozeroy', traceIndex: 0 },
        { key: 'wind', values: windValues, fill: 'tonexty', traceIndex: 1 },
        { key: 'solarTidal', values: solarTidalValues, fill: 'tonexty', traceIndex: 2 },
        { key: 'biomass', values: biomassValues, fill: 'tonexty', traceIndex: 3 },
    ];

    const hitTraceDefs = [
        { ...hydroDense, traceIndex: 0 },
        { ...windDense, traceIndex: 1 },
        { ...solarTidalDense, traceIndex: 2 },
        { ...biomassDense, traceIndex: 3 },
    ];

    const plotData = [
        ...traceDefs.map(({ key, values, fill, traceIndex }) => ({
            type: 'scatter',
            mode: 'lines',
            x: years,
            y: values,
            stackgroup: 'renewable',
            fill,
            line: { color: hexToRgba(COLORS[key], traceOpacityFor(selectedTraceIds, traceIndex)), width: 0 },
            fillcolor: hexToRgba(COLORS[key], traceOpacityFor(selectedTraceIds, traceIndex)),
            connectgaps: true,
            hoverinfo: 'skip',
            showlegend: false,
        })),
        ...hitTraceDefs.map(({ x, y, hover }) => ({
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

    const hasChartData = !loading && !error && tableRows.length > 0;

    return (
        <main
            tabIndex="-1"
            className="page-content page-74"
            role="main"
            aria-labelledby="page74-chart-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-74.page-content { max-width: none !important; overflow-x: visible !important; }
.page-74 {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.page74-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.page74-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-top: 0;
    margin-bottom: 0;
    box-sizing: border-box;
    overflow: visible;
}
.page74-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
}
.page74-chart { width: 100%; min-width: 0; height: ${plotHeight}px; position: relative; }
.page74-chart > div { width: 100%; height: 100%; }
.page74-legend {
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
.page74-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
}
.page74-legend-swatch { width: 22px; height: 14px; display: inline-block; border: 1px solid rgba(0, 0, 0, 0.12); }
.page74-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.page74-download-buttons button:hover,
.page-74 .data-table-wrapper summary:hover,
.page-74 .data-table-wrapper button:hover { background-color: #404040 !important; }
.page-74 .data-table-wrapper { padding-top: 5px; margin-top: 20px; width: 100%; box-sizing: border-box; }
.page-74 .data-table-wrapper summary {
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
.page-74 .data-table-wrapper summary::-webkit-details-marker { display: none; }
.page74-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page74-table-scrollbar > div { height: 20px; }
@media (max-width: 768px) {
    .page74-chart-title { font-size: 26px; }
}
.page74-loading, .page74-error {
    font-family: Arial, sans-serif;
    font-size: 16px;
    color: var(--gc-text);
    padding: 24px 0;
}
            `}</style>
            <div className="page74-inner">
                {loading && (
                    <p className="page74-loading">{lang === 'en' ? 'Loading data…' : 'Chargement des données…'}</p>
                )}
                {!loading && error && (
                    <p className="page74-error" role="alert">{error}</p>
                )}
                {!loading && !error && !tableRows.length && (
                    <p className="page74-error">{lang === 'en' ? 'No data available.' : 'Aucune donnée disponible.'}</p>
                )}

                {hasChartData && (
                <div className="page74-chart-frame">
                    <h2 id="page74-chart-title" className="page74-chart-title">{chartTitle}</h2>

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

                    <figure
                        ref={chartRef}
                        className="page74-chart"
                        role="region"
                        aria-label={chartTitle}
                        tabIndex={0}
                        style={{ margin: 0 }}
                    >
                        <Page74Plot
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
                                    tickvals: yTickvals,
                                    ticktext: yTickvals.map((v) => formatMw(v)),
                                    range: yRange,
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
                                    name: getText('page74_download_png', lang),
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

                    <div className="page74-legend" aria-hidden="true">
                        {LEGEND_KEYS.map((key) => (
                            <span key={key} className="page74-legend-item">
                                <span className="page74-legend-swatch" style={{ backgroundColor: COLORS[key] }} />
                                {getText(`page74_legend_${key}`, lang)}
                            </span>
                        ))}
                    </div>

                    <details className="data-table-wrapper" onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                        <summary role="button" aria-expanded={isTableOpen}>
                            <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                            {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                            <span className="wb-inv">
                                {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                            </span>
                        </summary>
                        <div ref={topScrollRef} className="page74-table-scrollbar" aria-hidden="true"><div /></div>
                        <div
                            ref={tableScrollRef}
                            className="table-responsive"
                            role="region"
                            aria-label={lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
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
                                        const total = row.hydro + row.wind + row.solarTidal + row.biomass;
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
                                                <td style={{ textAlign: 'right' }}>{formatMw(row.hydro)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatMw(row.wind)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatMw(row.solarTidal)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatMw(row.biomass)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatMw(total)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div ref={bottomScrollRef} className="page74-table-scrollbar" aria-hidden="true"><div /></div>
                        <div className="page74-download-buttons">
                            <button type="button" onClick={downloadCsv} style={downloadBtnStyle}>
                                {getText('page74_download_csv', lang)}
                            </button>
                            <button type="button" onClick={downloadDocx} style={downloadBtnStyle}>
                                {getText('page74_download_docx', lang)}
                            </button>
                        </div>
                    </details>
                </div>
                )}
            </div>
        </main>
    );
};

export default Page74;
