import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { Page69CityLabels, Page69HoverTooltip, Page69IconLayer, Page69LeaderLines, Page69MapLayer } from '../components/Page69ElectricityInfographic';
import {
    BAR_COLORS,
    CHART_AXIS,
    exportElectricityPricesChartPng,
    getElectricityPriceToY,
    getElectricityPriceSlotBarY,
    MAP_ASPECT_RATIO,
    MAP_CITY_SLOTS,
} from '../components/Page69ElectricityInfographic.constants';
import { getElectricityPricesMapData } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const TRACE_KEYS = ['industrial', 'residential'];

const HOVER_LABEL = {
    bgcolor: '#ffffff',
    bordercolor: '#000000',
    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
};

const MODEBAR_REMOVE = [
    'pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d',
    'autoScale2d', 'resetScale2d', 'toImage', 'hoverClosestCartesian',
    'hoverCompareCartesian', 'toggleSpikelines',
];

const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

const getPlotTooltipPosition = (event, bgRef, chartRef) => {
    const bgEl = bgRef.current;
    if (!bgEl) return null;
    const bgRect = bgEl.getBoundingClientRect();
    const mouseEv = event?.event ?? event?.nativeEvent;
    if (mouseEv && Number.isFinite(mouseEv.clientX) && Number.isFinite(mouseEv.clientY)) {
        return {
            left: mouseEv.clientX - bgRect.left,
            top: mouseEv.clientY - bgRect.top,
        };
    }
    const pt = event?.points?.[0];
    const plotEl = chartRef.current?.querySelector('.plot-container') ?? chartRef.current;
    if (pt?.bbox && plotEl) {
        const plotRect = plotEl.getBoundingClientRect();
        return {
            left: plotRect.left - bgRect.left + (pt.bbox.x0 + pt.bbox.x1) / 2,
            top: plotRect.top - bgRect.top + (pt.bbox.y0 + pt.bbox.y1) / 2,
        };
    }
    return null;
};

const hexToRgba = (hex, opacity = 1) => {
    const normalized = hex.replace('#', '');
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const Page69Plot = memo(function Page69Plot({
    plotData, plotLayout, chartConfig, plotHeight, onPlotReady,
}) {
    return (
        <Plot
            key={`page69-${plotHeight}`}
            data={plotData}
            layout={plotLayout}
            config={chartConfig}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
            onInitialized={onPlotReady}
        />
    );
});

const formatReferenceYear = (refDate, lang) => {
    if (!refDate) return '';
    const parts = String(refDate).trim().split('-');
    const year = Number(parts[0]);
    if (Number.isNaN(year)) return String(refDate);
    if (parts.length === 1 || !parts[1]) {
        return String(year);
    }
    const month = Number(parts[1]);
    if (Number.isNaN(month)) return String(year);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { month: 'long', year: 'numeric' });
};

const Page69 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const [hoverTip, setHoverTip] = useState(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

    const chartRef = useRef(null);
    const chartBgRef = useRef(null);
    const hoverHandlerRef = useRef(null);
    const clickHandlerRef = useRef(null);
    const hoverClearRef = useRef(null);
    const tableTopRef = useRef(null);
    const tableScrollRef = useRef(null);
    const tableBottomRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const getCityLabel = useCallback(
        (key) => getText(`page69_city_${key}`, lang),
        [lang],
    );

    const formatPrice = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const scrollToFootnote = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-page69')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const scrollToRef = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-rf-page69')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    useEffect(() => {
        getElectricityPricesMapData()
            .then(setResult)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const syncTableScroll = useCallback(() => {
        const topScroll = tableTopRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = tableBottomRef.current;
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
        const topScroll = tableTopRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = tableBottomRef.current;
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

    const cities = useMemo(() => {
        const rows = result?.cities ?? [];
        return rows.map((row) => ({
            ...row,
            label: getCityLabel(row.key),
        }));
    }, [result, getCityLabel]);

    const referenceDate = result?.referenceDate;
    const monthYear = formatReferenceYear(referenceDate, lang);
    const textVars = { monthYear };

    const chartTitleMain = getText('page69_chart_title', lang);
    const chartTitleSuffix = substitute(getText('page69_chart_title_suffix', lang), textVars);
    const chartTitleFull = `${stripHtml(chartTitleMain)}${stripHtml(chartTitleSuffix)}`;
    const tableCaption = substitute(getText('page69_table_caption', lang), textVars);
    const fileTitle = getText('page69_download_title', lang);

    const plotHeight = useMemo(() => {
        const widthBased = windowWidth > 0 ? windowWidth / MAP_ASPECT_RATIO : 520;
        return Math.max(420, Math.min(720, Math.round(widthBased * 0.85)));
    }, [windowWidth]);

    const halfGap = CHART_AXIS.barGap / 2;
    const barOffset = CHART_AXIS.barWidth / 2 + halfGap;

    const citySlotsByKey = useMemo(() => {
        const map = {};
        MAP_CITY_SLOTS.forEach((slot) => { map[slot.key] = slot; });
        return map;
    }, []);

    const priceToY = useMemo(
        () => getElectricityPriceToY(cities, CHART_AXIS.barHeightMax),
        [cities],
    );

    const barOpacityFor = useCallback((traceIndex, cityIndex) => {
        if (selectedPoints === null) return 1;
        return selectedPoints[traceIndex]?.includes(cityIndex) ? 1 : 0.3;
    }, [selectedPoints]);

    const plotData = useMemo(() => {
        const traces = [];

        cities.forEach((city, cityIndex) => {
            const slot = citySlotsByKey[city.key];
            if (!slot) return;
            const baseY = getElectricityPriceSlotBarY(slot);

            TRACE_KEYS.forEach((priceKey, traceIndex) => {
                const price = city[priceKey];
                const height = Number(price) * priceToY;
                const xPos = priceKey === 'industrial'
                    ? slot.x - barOffset
                    : slot.x + barOffset;

                const categoryLabel = getText(`page69_legend_${priceKey}`, lang);
                const cityLabel = getCityLabel(city.key);
                const meta = [cityIndex, traceIndex, cityLabel, price, categoryLabel, monthYear];

                traces.push({
                    type: 'bar',
                    name: categoryLabel,
                    legendgroup: priceKey,
                    showlegend: false,
                    x: [xPos],
                    y: [height],
                    base: baseY,
                    width: CHART_AXIS.barWidth,
                    marker: {
                        color: hexToRgba(
                            BAR_COLORS[priceKey],
                            barOpacityFor(traceIndex, cityIndex),
                        ),
                        line: { width: 0 },
                    },
                    hoverinfo: 'none',
                    customdata: [meta],
                });
            });
        });

        return traces;
    }, [cities, priceToY, citySlotsByKey, barOffset, lang, getCityLabel, monthYear, barOpacityFor, locale]);

    const plotLayout = useMemo(() => ({
        showlegend: false,
        hovermode: 'closest',
        hoverlabel: HOVER_LABEL,
        clickmode: 'event',
        dragmode: false,
        height: plotHeight,
        bargap: 0,
        bargroupgap: 0,
        xaxis: {
            type: 'linear',
            range: [CHART_AXIS.xMin, CHART_AXIS.xMax],
            visible: false,
            fixedrange: true,
        },
        yaxis: {
            range: [CHART_AXIS.yMin, CHART_AXIS.yMax],
            visible: false,
            fixedrange: true,
        },
        margin: { l: 4, r: 4, t: 58, b: 4 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        autosize: true,
    }), [plotHeight]);

    const parsePointMeta = useCallback((pt) => {
        let meta = pt.customdata;
        if (Array.isArray(meta) && meta.length === 1 && Array.isArray(meta[0])) {
            meta = meta[0];
        }
        if (Array.isArray(meta) && meta.length >= 2 && typeof meta[0] === 'number') {
            return {
                cityIndex: meta[0],
                traceIndex: meta[1],
                city: meta[2],
                price: meta[3],
                category: meta[4],
                date: meta[5],
            };
        }
        const curveNumber = pt.curveNumber;
        if (curveNumber == null) return null;
        const cityIndex = Math.floor(curveNumber / TRACE_KEYS.length);
        const traceIndex = curveNumber % TRACE_KEYS.length;
        const cityRow = cities[cityIndex];
        if (!cityRow) return null;
        const priceKey = TRACE_KEYS[traceIndex];
        return {
            cityIndex,
            traceIndex,
            city: getCityLabel(cityRow.key),
            price: cityRow[priceKey],
            category: getText(`page69_legend_${priceKey}`, lang),
            date: monthYear,
        };
    }, [cities, getCityLabel, lang, monthYear]);

    const handleChartHover = useCallback((event) => {
        const pt = event?.points?.[0];
        if (!pt) return;
        const meta = parsePointMeta(pt);
        if (!meta) return;
        const position = getPlotTooltipPosition(event, chartBgRef, chartRef);
        if (!position) return;
        setHoverTip({
            left: position.left,
            top: position.top,
            city: meta.city,
            category: meta.category,
            priceLabel: `${formatPrice(meta.price)} cents/kWh`,
            date: meta.date,
        });
    }, [parsePointMeta, locale]);

    const handleChartClick = useCallback((event) => {
        if (!event?.points?.length) return;
        const pt = event.points[0];
        const parsed = parsePointMeta(pt);
        if (!parsed) return;
        const { cityIndex, traceIndex } = parsed;
        if (cityIndex === undefined || traceIndex == null) return;

        setHoverTip(null);

        setSelectedPoints((prev) => {
            const next = prev ? prev.map((arr) => [...arr]) : [[], []];
            const current = next[traceIndex] || [];
            if (!prev) {
                next[traceIndex] = [cityIndex];
                return next;
            }
            if (current.includes(cityIndex)) {
                next[traceIndex] = current.filter((i) => i !== cityIndex);
                const anySelected = next.some((arr) => arr.length > 0);
                return anySelected ? next : null;
            }
            next[traceIndex] = [...current, cityIndex];
            return next;
        });
    }, [parsePointMeta]);

    hoverHandlerRef.current = handleChartHover;
    clickHandlerRef.current = handleChartClick;
    hoverClearRef.current = () => setHoverTip(null);

    const bindPlotHandlers = useCallback((graphDiv) => {
        if (!graphDiv?.on) return;
        if (graphDiv._page69Hover) {
            graphDiv.removeListener('plotly_hover', graphDiv._page69Hover);
        }
        if (graphDiv._page69Unhover) {
            graphDiv.removeListener('plotly_unhover', graphDiv._page69Unhover);
        }
        if (graphDiv._page69Click) {
            graphDiv.removeListener('plotly_click', graphDiv._page69Click);
        }
        const hoverHandler = (event) => hoverHandlerRef.current?.(event);
        const unhoverHandler = () => hoverClearRef.current?.();
        const clickHandler = (event) => clickHandlerRef.current?.(event);
        graphDiv._page69Hover = hoverHandler;
        graphDiv._page69Unhover = unhoverHandler;
        graphDiv._page69Click = clickHandler;
        graphDiv.on('plotly_hover', hoverHandler);
        graphDiv.on('plotly_unhover', unhoverHandler);
        graphDiv.on('plotly_click', clickHandler);
    }, []);

    const onPlotReady = useCallback(
        (_figure, graphDiv) => bindPlotHandlers(graphDiv),
        [bindPlotHandlers],
    );

    const handleChartWrapperLeave = useCallback(() => setHoverTip(null), []);

    const clearSelection = () => {
        setSelectedPoints(null);
    };

    const downloadChartWithLegend = async () => {
        const wrapper = chartBgRef.current;
        const plotElement = chartRef.current?.querySelector('.js-plotly-plot');
        if (!wrapper || !plotElement || !window.Plotly) return;
        try {
            const plotlyImgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: wrapper.clientWidth,
                height: plotHeight,
                scale: 2,
            });
            const scale = 2;
            const chartCanvas = await exportElectricityPricesChartPng(wrapper, plotlyImgData, { scale });
            if (!chartCanvas) return;

            const titleHeight = 56;
            const unitHeight = 24;
            const legendHeight = 44;
            const headerH = (titleHeight + unitHeight) * scale;
            const footerH = legendHeight * scale;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = chartCanvas.width;
            canvas.height = chartCanvas.height + headerH + footerH;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#333333';
            ctx.font = `bold ${18 * scale}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(chartTitleFull, canvas.width / 2, 32);
            ctx.font = `${14 * scale}px Arial`;
            ctx.fillText(getText('page69_unit', lang), canvas.width / 2, 54);
            ctx.drawImage(chartCanvas, 0, headerH);

            const legendItems = TRACE_KEYS.map((key) => ({
                color: BAR_COLORS[key],
                label: getText(`page69_legend_${key}`, lang),
            }));
            const legendY = headerH + chartCanvas.height + 28;
            ctx.font = `${16 * scale}px Arial`;
            const totalLegendWidth = legendItems.reduce((sum, item) => sum + ctx.measureText(item.label).width + 36 * scale, 0);
            let legendX = (canvas.width - totalLegendWidth) / 2;
            legendItems.forEach((item) => {
                ctx.fillStyle = item.color;
                ctx.fillRect(legendX, legendY - 8 * scale, 22 * scale, 14 * scale);
                ctx.fillStyle = '#333333';
                ctx.textAlign = 'left';
                ctx.fillText(item.label, legendX + 28 * scale, legendY + 4 * scale);
                legendX += ctx.measureText(item.label).width + 36 * scale;
            });

            canvas.toBlob((blob) => {
                if (blob) saveAs(blob, `${fileTitle}.png`);
            });
        } catch (err) {
            console.error(err);
        }
    };

    const downloadCsv = () => {
        const headers = [
            getText('page69_table_col_city', lang),
            getText('page69_table_col_industrial', lang),
            getText('page69_table_col_residential', lang),
        ];
        const rows = cities.map((row) => [getCityLabel(row.key), row.industrial, row.residential]);
        const csv = [headers.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
        saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${fileTitle}.csv`);
    };

    const downloadDocx = async () => {
        const headerCells = [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: getText('page69_table_col_city', lang), bold: true, size: 22 })], alignment: AlignmentType.LEFT })], shading: { fill: 'E6E6E6' } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: getText('page69_table_col_industrial', lang), bold: true, size: 22 })], alignment: AlignmentType.CENTER })], shading: { fill: 'E6E6E6' } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: getText('page69_table_col_residential', lang), bold: true, size: 22 })], alignment: AlignmentType.CENTER })], shading: { fill: 'E6E6E6' } }),
        ];
        const dataRows = cities.map((row) => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: getCityLabel(row.key), size: 22 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatPrice(row.industrial), size: 22 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatPrice(row.residential), size: 22 })], alignment: AlignmentType.RIGHT })] }),
            ],
        }));
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: chartTitleFull, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [4800, 2600, 2600], rows: [new TableRow({ children: headerCells }), ...dataRows] }),
                ],
            }],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${fileTitle}.docx`);
    };

    const chartConfig = {
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        modeBarButtonsToRemove: MODEBAR_REMOVE,
        modeBarButtonsToAdd: [{
            name: getText('page69_download_png', lang),
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: () => { downloadChartWithLegend(); },
        }],
    };

    if (loading) {
        return <p className="page69-loading">{lang === 'en' ? 'Loading data…' : 'Chargement des données…'}</p>;
    }
    if (error) {
        return <p className="page69-error" role="alert">{error}</p>;
    }
    if (!cities.length) {
        return <p className="page69-error">{lang === 'en' ? 'No data available.' : 'Aucune donnée disponible.'}</p>;
    }

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-69"
            role="main"
            aria-labelledby="page69-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-69.page-content { max-width: none !important; overflow-x: visible !important; }
.page-69 {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.page69-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.page69-title {
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
.page69-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.page69-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    box-sizing: border-box;
    overflow: visible;
}
.page69-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 6px 0;
    text-transform: none;
    line-height: 1.3;
}
.page69-chart-title .fn-lnk { color: #26374a; text-decoration: underline; }
.page69-unit {
    font-family: Arial, sans-serif;
    font-size: 16px;
    font-weight: bold;
    color: #58585a;
    text-align: center;
    margin: 0 0 12px 0;
}
.page69-chart-bg-wrapper { position: relative; width: 100%; }
.page69-chart-overlay { position: relative; z-index: 4; width: 100%; }
.page69-chart {
    width: 100%;
    min-width: 0;
    position: relative;
    z-index: 4;
    overflow: visible;
}
.page69-chart > div { width: 100%; height: 100%; overflow: visible; }
.page69-chart .js-plotly-plot,
.page69-chart .plot-container,
.page69-chart .svg-container { overflow: visible !important; pointer-events: auto !important; }
.page69-chart .js-plotly-plot .plotly .modebar { right: 4px !important; top: 2px !important; }
.page69-chart .hoverlayer { display: none !important; }
.page69-clear-selection {
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
.page69-legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 14px 24px;
    margin-top: 16px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: var(--gc-text);
}
.page69-legend-item { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.page69-legend-swatch { width: 22px; height: 14px; display: inline-block; border: 1px solid rgba(0, 0, 0, 0.12); }
.page69-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.page69-table-wrapper details > summary {
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
.page69-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page69-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page69-table-scrollbar > div { height: 20px; }
.page69-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #ddd;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.page69-table-responsive::-webkit-scrollbar { display: none; }
.page69-table-responsive table { width: max-content !important; min-width: 100%; }
.page69-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.page69-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.page69-chart-frame button:hover,
.page69-table-wrapper summary:hover,
.page69-download-buttons button:hover { background-color: #404040 !important; }
.page69-footnotes {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--gc-text);
    margin-top: 24px;
    margin-bottom: 0;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
    line-height: 1.65;
    max-width: 100%;
    box-sizing: border-box;
}
.page69-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 1rem;
}
.page69-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
.page69-loading, .page69-error {
    font-family: 'Noto Sans', sans-serif;
    font-size: 18px;
    color: var(--gc-text);
    margin: 24px 0;
}
@media (max-width: 768px) {
    .page69-title { font-size: 37px; }
    .page69-chart-title { font-size: 26px; }
    .page69-footnotes { font-size: 0.9rem; }
    .page69-footnotes h2 { font-size: 1.2rem; margin-bottom: 0.75rem; }
}
            `}</style>

            <div className="page69-inner">
                <h1 id="page69-title" className="page69-title">{getText('page69_title', lang)}</h1>

                <div className="page69-chart-frame">
                    <h2 id="page69-chart-title" className="page69-chart-title">
                        {chartTitleMain}
                        <span id="fn-asterisk-rf-page69" style={{ verticalAlign: 'super', fontSize: '0.75em' }}>
                            <a className="fn-lnk" href="#fn-asterisk-page69" onClick={scrollToFootnote}>
                                <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                                <span aria-hidden="true">*</span>
                            </a>
                        </span>
                        {chartTitleSuffix}
                    </h2>
                    <p className="page69-unit">{getText('page69_unit', lang)}</p>

                    {selectedPoints !== null && (
                        <button type="button" className="page69-clear-selection" onClick={clearSelection}>
                            {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                        </button>
                    )}

                    <div
                        className="page69-chart-bg-wrapper"
                        ref={chartBgRef}
                        style={{ minHeight: plotHeight }}
                        onMouseLeave={handleChartWrapperLeave}
                    >
                        <Page69MapLayer minHeight={plotHeight} />
                        <Page69LeaderLines minHeight={plotHeight} />
                        <Page69CityLabels cities={cities} lang={lang} minHeight={plotHeight} />

                        <div className="page69-chart-overlay">
                            <figure
                                ref={chartRef}
                                className="page69-chart"
                                style={{ height: plotHeight, margin: 0 }}
                                role="region"
                                aria-label={chartTitleFull}
                            >
                                <Page69Plot
                                    plotData={plotData}
                                    plotLayout={plotLayout}
                                    chartConfig={chartConfig}
                                    plotHeight={plotHeight}
                                    onPlotReady={onPlotReady}
                                />
                            </figure>
                        </div>

                        <Page69IconLayer cities={cities} minHeight={plotHeight} />
                        <Page69HoverTooltip tip={hoverTip} />
                    </div>

                    <div className="page69-legend">
                        {TRACE_KEYS.map((key) => (
                            <span key={key} className="page69-legend-item">
                                <span className="page69-legend-swatch" style={{ backgroundColor: BAR_COLORS[key] }} />
                                {getText(`page69_legend_${key}`, lang)}
                            </span>
                        ))}
                    </div>

                    <div className="page69-table-wrapper">
                        <details className="page69-data-table" onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                            </summary>
                            <div ref={tableTopRef} className="page69-table-scrollbar" aria-hidden="true"><div /></div>
                            <div
                                ref={tableScrollRef}
                                className="page69-table-responsive"
                                role="region"
                                aria-labelledby="page69-table-caption"
                                tabIndex={0}
                            >
                                <table className="table table-bordered table-striped table-hover">
                                    <caption id="page69-table-caption" className="wb-inv">{tableCaption}</caption>
                                    <thead>
                                        <tr>
                                            <th scope="col">{getText('page69_table_col_city', lang)}</th>
                                            <th scope="col">{getText('page69_table_col_industrial', lang)}</th>
                                            <th scope="col">{getText('page69_table_col_residential', lang)}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cities.map((row) => (
                                            <tr key={row.key}>
                                                <th scope="row">{getCityLabel(row.key)}</th>
                                                <td style={{ textAlign: 'right' }}>{formatPrice(row.industrial)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatPrice(row.residential)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div ref={tableBottomRef} className="page69-table-scrollbar" aria-hidden="true"><div /></div>
                            <div className="page69-download-buttons">
                                <button type="button" onClick={downloadCsv}>{getText('page69_download_csv', lang)}</button>
                                <button type="button" onClick={downloadDocx}>{getText('page69_download_docx', lang)}</button>
                            </div>
                        </details>
                    </div>
                </div>

                <aside className="wb-fnote page69-footnotes" role="note">
                    <h2>{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnote' : 'Note de bas de page'}</dt>
                        <dd id="fn-asterisk-page69">
                            <a href="#fn-asterisk-rf-page69" onClick={scrollToRef} className="fn-num" title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}>
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                            </a>
                            {' '}{getText('page69_footnote', lang)}
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page69;
