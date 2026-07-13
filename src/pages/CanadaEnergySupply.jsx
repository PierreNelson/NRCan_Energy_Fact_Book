import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import canadaEnergySupplyGlobalBgEn from '../assets/canada_energy_supply_global_bg.svg';
import canadaEnergySupplyGlobalBgFr from '../assets/canada_energy_supply_global_bg_fr.svg';

const REFERENCE_YEAR = 2023;
const SOURCE_KEYS = [
    'natural_gas',
    'oil',
    'nuclear',
    'biofuels_waste',
    'other_renewables',
    'hydro',
    'coal',
];
const FOOTNOTE_NUM_BY_KEY = { other_renewables: 3 };
const COLORS = {
    natural_gas: '#30B8C8',
    oil: '#807050',
    nuclear: '#607888',
    biofuels_waste: '#A0A0A0',
    other_renewables: '#98B0A8',
    hydro: '#204098',
    coal: '#68B888',
};

const DATA_BY_YEAR = {
    2023: {
        total: 12210,
        fossilPct: 76,
        renewablesPct: 16.5,
        slices: {
            natural_gas: { pct: 40 },
            oil: { pct: 33 },
            nuclear: { pct: 8 },
            biofuels_waste: { pct: 5 },
            other_renewables: { pct: 1 },
            hydro: { pct: 10 },
            coal: { pct: 3 },
        },
    },
};

const STACKED_LAYOUT_BROWSER_ZOOM = 1.1;
const STACKED_LAYOUT_DETECTED_ZOOM = 1.0 + (STACKED_LAYOUT_BROWSER_ZOOM - 1.0) * 0.25;
const HOVER_LABEL = {
    bgcolor: '#ffffff',
    bordercolor: '#000000',
    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
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

const pixelToPaper = (plotEl, xPx, yPx) => {
    const layout = plotEl?._fullLayout;
    if (!layout) return { x: 0.5, y: 0.5 };
    const plotWidth = layout.width - layout.margin.l - layout.margin.r;
    const plotHeight = layout.height - layout.margin.t - layout.margin.b;
    if (!plotWidth || !plotHeight) return { x: 0.5, y: 0.5 };
    return {
        x: (xPx - layout.margin.l) / plotWidth,
        y: 1 - ((yPx - layout.margin.t) / plotHeight),
    };
};

const computeChartDecorations = ({ plotEl, chartEl, slices, textSize, zoomLegendMode }) => {
    if (!plotEl || !chartEl || zoomLegendMode || !slices.length) {
        return { footnoteButtons: [], fnAnnotations: [] };
    }

    const containerRect = chartEl.getBoundingClientRect();
    const sliceTexts = plotEl.querySelectorAll('g.pielayer g.slicetext text, g.trace g.slicetext text');
    const footnoteButtons = [];
    const fnAnnotations = [];

    slices.forEach((slice, index) => {
        const textEl = sliceTexts[index];
        if (!textEl) return;

        const textBox = textEl.getBoundingClientRect();
        if (!textBox.width) return;

        const footnoteNum = FOOTNOTE_NUM_BY_KEY[slice.key];
        if (footnoteNum == null) return;

        const buttonLeft = textBox.right - containerRect.left + 2;
        const buttonTop = textBox.top - containerRect.top + 1;
        footnoteButtons.push({
            key: slice.key,
            footnoteNum,
            left: buttonLeft,
            top: buttonTop,
        });

        const paperPos = pixelToPaper(plotEl, buttonLeft + 6, buttonTop + 8);
        fnAnnotations.push({
            text: String(footnoteNum),
            showarrow: false,
            x: paperPos.x,
            y: paperPos.y,
            xref: 'paper',
            yref: 'paper',
            xanchor: 'left',
            yanchor: 'middle',
            font: { size: Math.max(10, textSize - 2), color: '#26374a', family: 'Arial, sans-serif' },
        });
    });

    return { footnoteButtons, fnAnnotations };
};

const decorationsEqual = (a, b) => (
    JSON.stringify(a?.footnoteButtons ?? []) === JSON.stringify(b?.footnoteButtons ?? [])
);

const waitForImage = (img) =>
    new Promise((resolve, reject) => {
        if (img.complete && img.naturalWidth > 0) {
            resolve(img);
            return;
        }
        img.onload = () => resolve(img);
        img.onerror = reject;
    });

const exportInfographicPng = async (imgEl, { scale = 2 }) => {
    if (!imgEl) return null;
    const loaded = await waitForImage(imgEl);
    const canvas = document.createElement('canvas');
    canvas.width = loaded.naturalWidth * scale;
    canvas.height = loaded.naturalHeight * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(loaded, 0, 0, loaded.naturalWidth, loaded.naturalHeight);
    return canvas;
};

const CanadaEnergySupply = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [selectedYear] = useState(REFERENCE_YEAR);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [pageCssZoom, setPageCssZoom] = useState(() => computePageZoomScale(null).pageCssZoom);
    const [zoomLevel, setZoomLevel] = useState(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const [chartDecorations, setChartDecorations] = useState({ footnoteButtons: [], fnAnnotations: [] });
    const [isChartHovering, setIsChartHovering] = useState(false);
    const zoomBaselineRef = useRef(null);

    const chartRef = useRef(null);
    const infographicImgRef = useRef(null);
    const tableTopRef = useRef(null);
    const tableScrollRef = useRef(null);
    const tableBottomRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const useStackedLayout = pageCssZoom >= STACKED_LAYOUT_DETECTED_ZOOM;
    const textVars = { year: selectedYear };
    const yearData = DATA_BY_YEAR[selectedYear] ?? DATA_BY_YEAR[REFERENCE_YEAR];

    const formatPj = useCallback((value) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    }, [locale]);

    const formatPct = useCallback((value, digits = 0) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        const formatted = Number(value).toLocaleString(locale, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        });
        return lang === 'fr' ? `${formatted} %` : `${formatted}%`;
    }, [lang, locale]);

    const scrollToElement = (id) => (event) => {
        event?.preventDefault();
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    useEffect(() => {
        const syncLayout = () => {
            setWindowWidth(window.innerWidth);
            const viewportScale = window.visualViewport?.scale || 1;
            setZoomLevel(Math.max(viewportScale, window.devicePixelRatio || 1));
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

    const slices = useMemo(() => {
        if (!yearData) return [];
        return SOURCE_KEYS.map((key) => {
            const pct = yearData.slices[key]?.pct ?? 0;
            const pj = Math.round((yearData.total * pct) / 100);
            return { key, pct, pj };
        });
    }, [yearData]);

    const year = selectedYear;
    const totalPj = yearData?.total ?? 0;
    const chartTitle = substitute(getText('canada_energy_supply_chart_title', lang), textVars);
    const chartTitleBefore = substitute(getText('canada_energy_supply_chart_title_before', lang), textVars);
    const chartTitleAfter = substitute(getText('canada_energy_supply_chart_title_after', lang), textVars);
    const fileTitle = substitute(getText('canada_energy_supply_download_title', lang), textVars);
    const infographicFileSlug = getText('canada_energy_supply_infographic_download_title', lang).replace(/\s+/g, '_');
    const tableCaption = substitute(getText('canada_energy_supply_table_caption', lang), textVars);
    const bgImage = lang === 'en' ? canadaEnergySupplyGlobalBgEn : canadaEnergySupplyGlobalBgFr;

    const zoomLegendMode = windowWidth <= 1000 || zoomLevel >= 1.75;
    const effectiveSlices = windowWidth > 768 ? selectedSlices : null;
    const pieValues = slices.map((slice) => (slice.pj > 0 ? slice.pj : 0.001));
    const baseColors = slices.map((slice) => COLORS[slice.key]);
    const pieColors = effectiveSlices?.length
        ? baseColors.map((color, index) => (effectiveSlices.includes(index) ? color : hexToRgba(color, 0.3)))
        : baseColors;
    const labels = slices.map((slice) => getText(`canada_energy_supply_label_${slice.key}`, lang));

    const textSize = zoomLegendMode ? 14 : 16;
    const outsideTextSize = 16;
    const piePlotHeight = windowWidth <= 480 ? 360 : windowWidth <= 768 ? 400 : 480;
    const pieSideMargin = windowWidth <= 480 ? 8 : zoomLegendMode ? 24 : 160;

    const outsideLabelTemplate = slices.map(() => '%{label}<br>%{percent:.0%}');
    const zoomLabelTemplate = slices.map((slice) => (slice.pct >= 8 ? '%{percent:.0%}' : ''));

    const pieTrace = slices.length ? {
        type: 'pie',
        values: pieValues,
        labels,
        hole: 0.55,
        direction: 'clockwise',
        rotation: -20,
        sort: false,
        texttemplate: zoomLegendMode ? zoomLabelTemplate : outsideLabelTemplate,
        textinfo: zoomLegendMode ? 'percent' : 'label+percent',
        textposition: zoomLegendMode ? 'inside' : 'outside',
        textfont: {
            size: textSize,
            family: 'Arial, sans-serif',
            color: zoomLegendMode ? '#ffffff' : pieColors,
        },
        insidetextfont: zoomLegendMode
            ? { size: textSize, family: 'Arial, sans-serif', color: '#ffffff' }
            : undefined,
        outsidetextfont: { size: outsideTextSize, color: pieColors },
        marker: { colors: pieColors, line: { color: '#ffffff', width: 1 } },
        pull: effectiveSlices?.length
            ? pieValues.map((_, index) => (effectiveSlices.includes(index) ? 0.08 : 0.02))
            : pieValues.map(() => 0.02),
        hovertext: slices.map((slice) => {
            const label = getText(`canada_energy_supply_label_${slice.key}`, lang);
            return `<b>${label}</b><br>${formatPj(slice.pj)} PJ<br>${formatPct(slice.pct)}`;
        }),
        hoverinfo: 'text',
        hoverlabel: HOVER_LABEL,
        automargin: true,
        customdata: slices.map((slice) => slice.key),
    } : null;

    const centerAnnotation = useMemo(() => (totalPj != null ? {
        text: `${getText('canada_energy_supply_center_total', lang)}<br><b>${formatPj(totalPj)}</b><br>PJ`,
        showarrow: false,
        x: 0.5,
        y: 0.5,
        xref: 'paper',
        yref: 'paper',
        font: { size: windowWidth <= 480 ? 14 : 18, color: '#424243', family: 'Arial Black, Arial, sans-serif' },
    } : null), [totalPj, lang, windowWidth, formatPj]);

    const pieLayout = {
        showlegend: false,
        margin: {
            t: zoomLegendMode ? 60 : 70,
            b: zoomLegendMode ? 90 : 70,
            l: pieSideMargin,
            r: pieSideMargin,
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        height: piePlotHeight,
        clickmode: 'event',
        dragmode: false,
        annotations: centerAnnotation ? [centerAnnotation] : [],
        uirevision: `canada-energy-supply-${year}`,
    };

    const updateChartDecorations = useCallback(() => {
        const chartEl = chartRef.current;
        const plotEl = chartEl?.querySelector('.js-plotly-plot');
        const next = computeChartDecorations({
            plotEl,
            chartEl,
            slices,
            textSize,
            zoomLegendMode,
        });
        setChartDecorations((prev) => (decorationsEqual(prev, next) ? prev : next));
    }, [slices, textSize, zoomLegendMode]);

    useEffect(() => {
        const timer = window.setTimeout(updateChartDecorations, 120);
        window.addEventListener('resize', updateChartDecorations);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('resize', updateChartDecorations);
        };
    }, [updateChartDecorations, year, lang, effectiveSlices, windowWidth, zoomLegendMode]);

    const togglePieSelection = useCallback((sliceIndex) => {
        if (windowWidth <= 768) {
            const now = Date.now();
            const last = lastPieClickRef.current;
            const isDoubleTap = sliceIndex === last.index && now - last.time < 300;
            lastPieClickRef.current = { time: now, index: sliceIndex };
            if (!isDoubleTap) return;
        }
        setSelectedSlices((previous) => {
            if (previous === null) return [sliceIndex];
            if (previous.includes(sliceIndex)) {
                return previous.length <= 1 ? null : previous.filter((item) => item !== sliceIndex);
            }
            return [...previous, sliceIndex];
        });
    }, [windowWidth]);

    const handlePieClick = useCallback((event) => {
        const point = event?.points?.[0];
        if (!point) return;
        const index = point.pointNumber ?? point.pointIndex;
        if (index == null || index < 0) return;
        togglePieSelection(index);
    }, [togglePieSelection]);

    const bindPlotClickHandler = useCallback((graphDiv) => {
        if (!graphDiv?.on) return;
        if (graphDiv._canadaEnergySupplyClick) {
            graphDiv.removeListener('plotly_click', graphDiv._canadaEnergySupplyClick);
        }
        graphDiv._canadaEnergySupplyClick = handlePieClick;
        graphDiv.on('plotly_click', graphDiv._canadaEnergySupplyClick);
    }, [handlePieClick]);

    const onPieInitialized = useCallback((_figure, graphDiv) => {
        bindPlotClickHandler(graphDiv);
        if (!graphDiv?.on) return;
        if (graphDiv._canadaEnergySupplyAfterPlot) {
            graphDiv.removeListener('plotly_afterplot', graphDiv._canadaEnergySupplyAfterPlot);
        }
        graphDiv._canadaEnergySupplyAfterPlot = () => window.requestAnimationFrame(updateChartDecorations);
        graphDiv.on('plotly_afterplot', graphDiv._canadaEnergySupplyAfterPlot);

        if (graphDiv._canadaEnergySupplyHover) {
            graphDiv.removeListener('plotly_hover', graphDiv._canadaEnergySupplyHover);
        }
        if (graphDiv._canadaEnergySupplyUnhover) {
            graphDiv.removeListener('plotly_unhover', graphDiv._canadaEnergySupplyUnhover);
        }
        graphDiv._canadaEnergySupplyHover = () => setIsChartHovering(true);
        graphDiv._canadaEnergySupplyUnhover = () => setIsChartHovering(false);
        graphDiv.on('plotly_hover', graphDiv._canadaEnergySupplyHover);
        graphDiv.on('plotly_unhover', graphDiv._canadaEnergySupplyUnhover);
    }, [bindPlotClickHandler, updateChartDecorations]);

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
    }, [isTableOpen, windowWidth, syncTableScroll, lang, year]);

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
    }, [lang, year, effectiveSlices]);

    const tableHeaders = [
        getText('canada_energy_supply_table_col_year', lang),
        getText('canada_energy_supply_table_col_source', lang),
        getText('canada_energy_supply_table_col_pj', lang),
        getText('canada_energy_supply_table_col_share', lang),
    ];

    const tableRows = slices.map((slice) => ({
        year,
        source: getText(`canada_energy_supply_label_${slice.key}`, lang),
        pj: slice.pj,
        pct: slice.pct,
    }));

    const downloadChartPng = async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        const chartEl = chartRef.current;
        if (!plotElement || !window.Plotly) return;
        const title = stripHtml(chartTitle);
        try {
            const exportDecorations = computeChartDecorations({
                plotEl: plotElement,
                chartEl,
                slices,
                textSize,
                zoomLegendMode,
            });
            await window.Plotly.relayout(plotElement, {
                paper_bgcolor: '#ffffff',
                plot_bgcolor: '#ffffff',
                annotations: [
                    ...(centerAnnotation ? [centerAnnotation] : []),
                    ...exportDecorations.fnAnnotations,
                ],
            });
            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 1200,
                height: 900,
                scale: 2,
            });
            await window.Plotly.relayout(plotElement, {
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                annotations: centerAnnotation ? [centerAnnotation] : [],
            });
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
                ctx.fillText(title, canvas.width / 2, 44);
                ctx.drawImage(img, 0, titleHeight);
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = `${fileTitle}.png`;
                link.click();
            };
            img.src = imgData;
        } catch (err) {
            console.warn('Unable to download chart image.', err);
            try {
                await window.Plotly.relayout(plotElement, {
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    annotations: centerAnnotation ? [centerAnnotation] : [],
                });
            } catch (restoreError) {
                console.warn('Unable to restore chart background.', restoreError);
            }
        }
    };

    const chartConfig = {
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d', 'toImage'],
        modeBarButtonsToAdd: [{
            name: getText('canada_energy_supply_download_chart', lang),
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: (gd) => { downloadChartPng(gd); },
        }],
    };

    const downloadTableCsv = () => {
        if (!tableRows.length) return;
        const rows = tableRows.map((row) => [row.year, row.source, row.pj, Number(row.pct).toFixed(0)]);
        const csv = [tableHeaders.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${fileTitle}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadTableDocx = async () => {
        if (!tableRows.length) return;
        const headerRow = new TableRow({
            children: tableHeaders.map((header) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 18 })], alignment: AlignmentType.CENTER })],
                shading: { fill: 'E6E6E6' },
            })),
        });
        const rows = tableRows.map((row) => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(row.year), size: 18 })], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row.source, size: 18 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(row.pj), size: 18 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: Number(row.pct).toFixed(0), size: 18 })], alignment: AlignmentType.RIGHT })] }),
            ],
        }));
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: fileTitle, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [1400, 4200, 1600, 1600],
                        rows: [headerRow, ...rows],
                    }),
                ],
            }],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${fileTitle}.docx`);
    };

    const downloadInfographicPng = async () => {
        const canvas = await exportInfographicPng(infographicImgRef.current, { scale: 2 });
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${infographicFileSlug}.png`);
        });
    };

    const renderFootnoteButton = (button) => (
        <a
            key={button.key}
            id={`fn${button.footnoteNum}-rf-canada-energy-supply`}
            className={`canada-energy-supply-fn-button fn-lnk${isChartHovering ? ' is-under-hover' : ''}`}
            href={`#fn${button.footnoteNum}-canada-energy-supply`}
            onClick={scrollToElement(`fn${button.footnoteNum}-canada-energy-supply`)}
            style={{
                left: `${button.left}px`,
                top: `${button.top}px`,
            }}
        >
            <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
            {button.footnoteNum}
        </a>
    );

    const renderZoomLegendItem = (slice) => {
        const footnoteNum = FOOTNOTE_NUM_BY_KEY[slice.key];
        const referrerId = footnoteNum ? `fn${footnoteNum}-rf-canada-energy-supply` : undefined;
        return (
            <span key={slice.key} className="canada-energy-supply-custom-legend-item" id={referrerId}>
                <span className="canada-energy-supply-custom-legend-swatch" style={{ backgroundColor: COLORS[slice.key] }} aria-hidden="true" />
                {getText(`canada_energy_supply_label_${slice.key}`, lang)}
                {footnoteNum != null && (
                    <a className="fn-lnk" href={`#fn${footnoteNum}-canada-energy-supply`} onClick={scrollToElement(`fn${footnoteNum}-canada-energy-supply`)}>
                        <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                        {footnoteNum}
                    </a>
                )}
                {' '}
                {formatPct(slice.pct)}
            </span>
        );
    };

    const pageTitle = getText('canada_energy_supply_title', lang);

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content canada-energy-supply"
            role="main"
            aria-labelledby="canada-energy-supply-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.canada-energy-supply {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.canada-energy-supply-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.canada-energy-supply.page-content h1.canada-energy-supply-title {
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
.canada-energy-supply.page-content h1.canada-energy-supply-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.canada-energy-supply-intro {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    line-height: 1.55;
    color: var(--gc-text);
    margin: 0 0 16px 0;
}
.canada-energy-supply.page-content p.canada-energy-supply-formula {
    font-family: 'Lato', sans-serif;
    font-size: clamp(18px, 2.2vw, 26px);
    font-weight: bold;
    color: #537290 !important;
    text-align: center;
    margin: 0 0 28px 0;
    line-height: 1.35;
}
.canada-energy-supply-content-row {
    display: flex;
    flex-direction: row;
    width: 100%;
    gap: 28px;
    align-items: flex-start;
}
.canada-energy-supply-chart-column {
    width: 54%;
    min-width: 0;
    box-sizing: border-box;
}
.canada-energy-supply-side-column {
    width: 46%;
    min-width: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
}
.canada-energy-supply-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    box-sizing: border-box;
    overflow: visible;
}
.canada-energy-supply-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 24px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
    line-height: 1.3;
}
.canada-energy-supply-chart-scroll { width: 100%; overflow: hidden; display: flex; justify-content: center; }
.canada-energy-supply-chart {
    width: 100%;
    min-width: 0;
    height: ${piePlotHeight}px;
    position: relative;
    z-index: 1;
    overflow: visible;
}
.canada-energy-supply-chart > div {
    width: 100%;
    height: 100%;
    overflow: visible;
    position: relative;
    z-index: 1;
}
.canada-energy-supply-chart .js-plotly-plot,
.canada-energy-supply-chart .plot-container,
.canada-energy-supply-chart .svg-container { overflow: visible !important; }
.canada-energy-supply-fn-button {
    position: absolute;
    z-index: 2;
    transform: translate(0, 0);
    pointer-events: auto;
}
.canada-energy-supply-fn-button.is-under-hover {
    z-index: 0;
    pointer-events: none;
}
.canada-energy-supply-custom-legend {
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
    color: #333333;
}
.canada-energy-supply-custom-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
}
.canada-energy-supply-custom-legend-swatch {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    display: inline-block;
    border-radius: 2px;
    border: 1px solid rgba(0, 0, 0, 0.2);
}
.canada-energy-supply-clear-selection {
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
.canada-energy-supply-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.canada-energy-supply-table-wrapper details > summary {
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
.canada-energy-supply-table-wrapper details > summary::-webkit-details-marker { display: none; }
.canada-energy-supply-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.canada-energy-supply-table-scrollbar > div { height: 20px; }
.canada-energy-supply-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #ddd;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.canada-energy-supply-table-responsive::-webkit-scrollbar { display: none; }
.canada-energy-supply-table-responsive table { width: max-content !important; min-width: 100%; border-collapse: collapse; }
.canada-energy-supply-table-responsive th,
.canada-energy-supply-table-responsive td {
    white-space: nowrap;
}
.canada-energy-supply-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.canada-energy-supply-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.canada-energy-supply-chart-frame button:hover,
.canada-energy-supply-table-wrapper summary:hover,
.canada-energy-supply-infographic-actions button:hover { background-color: #404040 !important; }
.canada-energy-supply-bullets {
    font-family: var(--font-body);
    font-size: clamp(17px, 2vw, 20px);
    color: var(--gc-text);
    margin: 0 0 20px 0;
    padding-left: 1.25em;
    line-height: 1.5;
}
.canada-energy-supply-bullets li { margin-bottom: 0.75rem; }
.canada-energy-supply-bullets li:last-child { margin-bottom: 0; }
.canada-energy-supply-infographic-section { width: 100%; }
.canada-energy-supply-infographic-figure { margin: 0; width: 100%; }
.canada-energy-supply-bg-image { width: 100%; height: auto; display: block; }
.canada-energy-supply-infographic-actions { margin: 12px 0 0 0; }
.canada-energy-supply-infographic-actions button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.canada-energy-supply-footnotes {
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
.canada-energy-supply-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 1rem;
}
.canada-energy-supply-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
.canada-energy-supply-footnotes dd p { margin: 0; }
.layout-stacked.canada-energy-supply-content-row { flex-direction: column !important; }
.layout-stacked .canada-energy-supply-chart-column,
.layout-stacked .canada-energy-supply-side-column { width: 100% !important; min-width: 0 !important; }
.layout-stacked .canada-energy-supply-chart-column { margin-bottom: 28px; }
@media (max-width: 768px) {
    .canada-energy-supply.page-content h1.canada-energy-supply-title { font-size: 37px !important; }
    .canada-energy-supply-intro { font-size: 18px; }
    .canada-energy-supply-chart-title { font-size: 22px; }
    .canada-energy-supply-custom-legend { font-size: 16px; }
    .canada-energy-supply-footnotes { font-size: 0.9rem; }
    .canada-energy-supply-footnotes h2 { font-size: 1.2rem; margin-bottom: 0.75rem; }
}
@media (max-width: 480px) {
    .canada-energy-supply-custom-legend {
        font-size: 14px;
        gap: 8px 12px;
        justify-content: flex-start;
    }
}
            `}</style>

            <div className="canada-energy-supply-inner">
                <h1 id="canada-energy-supply-title" className="canada-energy-supply-title">{pageTitle}</h1>

                <p className="canada-energy-supply-intro">
                    {getText('canada_energy_supply_intro_before', lang)}
                    <span id="fn1-rf-canada-energy-supply">
                        {getText('canada_energy_supply_intro_tes', lang)}
                        <a
                            className="fn-lnk"
                            href="#fn1-canada-energy-supply"
                            onClick={scrollToElement('fn1-canada-energy-supply')}
                        >
                            <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                            1
                        </a>
                    </span>
                    {getText('canada_energy_supply_intro_after', lang)}
                </p>

                <p className="canada-energy-supply-formula" aria-label={getText('canada_energy_supply_formula', lang)}>
                    {getText('canada_energy_supply_formula', lang)}
                </p>

                <div className={`canada-energy-supply-content-row ${useStackedLayout ? 'layout-stacked' : ''}`}>
                    <div className="canada-energy-supply-chart-column">
                        <div className="canada-energy-supply-chart-frame">
                            <h2 id="canada-energy-supply-chart-title" className="canada-energy-supply-chart-title">
                                <span id="fn2-rf-canada-energy-supply">
                                    {chartTitleBefore}
                                    <a
                                        className="fn-lnk"
                                        href="#fn2-canada-energy-supply"
                                        onClick={scrollToElement('fn2-canada-energy-supply')}
                                    >
                                        <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                                        2
                                    </a>
                                </span>
                                {chartTitleAfter}
                            </h2>

                            {effectiveSlices?.length > 0 && (
                                <button type="button" className="canada-energy-supply-clear-selection" onClick={() => setSelectedSlices(null)}>
                                    {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                                </button>
                            )}

                            <div className="canada-energy-supply-chart-scroll">
                                <figure
                                    ref={chartRef}
                                    className="canada-energy-supply-chart"
                                    role="region"
                                    aria-label={chartTitle}
                                    tabIndex="0"
                                    style={{ margin: 0 }}
                                >
                                    <div aria-hidden="true">
                                        {pieTrace && (
                                            <Plot
                                                key={`canada-energy-supply-pie-${year}-${zoomLegendMode ? 'compact' : 'wide'}-${effectiveSlices ? effectiveSlices.join('-') : 'none'}-${lang}`}
                                                data={[pieTrace]}
                                                layout={pieLayout}
                                                config={chartConfig}
                                                style={{ width: '100%', height: '100%' }}
                                                useResizeHandler
                                                onInitialized={onPieInitialized}
                                                onUpdate={onPieInitialized}
                                            />
                                        )}
                                    </div>
                                    {!zoomLegendMode && chartDecorations.footnoteButtons.map(renderFootnoteButton)}
                                </figure>
                            </div>

                            {zoomLegendMode && (
                                <div className="canada-energy-supply-custom-legend" aria-label={lang === 'en' ? 'Chart legend' : 'Légende du graphique'}>
                                    {slices.map((slice) => renderZoomLegendItem(slice))}
                                </div>
                            )}

                            <div className="canada-energy-supply-table-wrapper">
                                <details className="canada-energy-supply-data-table" open={isTableOpen} onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                                    <summary role="button" aria-expanded={isTableOpen}>
                                        <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                        {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                        <span className="wb-inv">
                                            {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                        </span>
                                    </summary>
                                    <div ref={tableTopRef} className="canada-energy-supply-table-scrollbar" aria-hidden="true"><div /></div>
                                    <div
                                        ref={tableScrollRef}
                                        className="canada-energy-supply-table-responsive table-responsive"
                                        role="region"
                                        aria-labelledby="canada-energy-supply-table-caption"
                                        tabIndex={0}
                                    >
                                        <table className="table table-bordered table-striped table-hover">
                                            <caption id="canada-energy-supply-table-caption" className="wb-inv">{tableCaption}</caption>
                                            <thead>
                                                <tr>
                                                    {tableHeaders.map((header) => (
                                                        <th
                                                            key={header}
                                                            scope="col"
                                                            style={{
                                                                fontWeight: 'bold',
                                                                textAlign: 'center',
                                                                whiteSpace: 'nowrap',
                                                                verticalAlign: 'bottom',
                                                            }}
                                                        >
                                                            {header}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tableRows.map((row) => (
                                                    <tr key={`${row.year}-${row.source}`}>
                                                        <th scope="row" style={{ fontWeight: 'bold', textAlign: 'center' }}>{row.year}</th>
                                                        <td style={{ textAlign: 'left' }}>{row.source}</td>
                                                        <td style={{ textAlign: 'center' }}>{formatPj(row.pj)}</td>
                                                        <td style={{ textAlign: 'center' }}>{formatPct(row.pct)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div ref={tableBottomRef} className="canada-energy-supply-table-scrollbar" aria-hidden="true"><div /></div>
                                    <div className="canada-energy-supply-download-buttons">
                                        <button type="button" onClick={downloadTableCsv}>{getText('canada_energy_supply_download_csv', lang)}</button>
                                        <button type="button" onClick={downloadTableDocx}>{getText('canada_energy_supply_download_docx', lang)}</button>
                                    </div>
                                </details>
                            </div>
                        </div>
                    </div>

                    <div className="canada-energy-supply-side-column">
                        <ul className="canada-energy-supply-bullets" role="list">
                            <li role="listitem">
                                {substitute(getText('canada_energy_supply_bullet1_before', lang), textVars)}
                                <strong>{formatPct(yearData.fossilPct)}</strong>
                                {substitute(getText('canada_energy_supply_bullet1_after', lang), textVars)}
                            </li>
                            <li role="listitem">
                                {substitute(getText('canada_energy_supply_bullet2_before', lang), textVars)}
                                <strong>{formatPct(yearData.renewablesPct, 1)}</strong>
                                {substitute(getText('canada_energy_supply_bullet2_after', lang), textVars)}
                            </li>
                        </ul>

                        <div className="canada-energy-supply-infographic-section">
                            <figure className="canada-energy-supply-infographic-figure">
                                <img
                                    ref={infographicImgRef}
                                    className="canada-energy-supply-bg-image"
                                    src={bgImage}
                                    alt={getText('canada_energy_supply_infographic_aria', lang)}
                                />
                            </figure>
                            <div className="canada-energy-supply-infographic-actions">
                                <button type="button" onClick={downloadInfographicPng}>
                                    {getText('canada_energy_supply_download_png', lang)}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <aside className="wb-fnote canada-energy-supply-footnotes" role="note">
                    <h2 id="fn-canada-energy-supply">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</dt>
                        <dt>{lang === 'en' ? 'Footnote 1' : 'Note de bas de page 1'}</dt>
                        <dd id="fn1-canada-energy-supply">
                            <a
                                href="#fn1-rf-canada-energy-supply"
                                onClick={scrollToElement('fn1-rf-canada-energy-supply')}
                                className="fn-num"
                                title={lang === 'en' ? 'Return to footnote 1 referrer' : 'Retour à la référence de la note de bas de page 1'}
                            >
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>
                                1
                            </a>
                            <p>{getText('canada_energy_supply_footnote1', lang)}</p>
                        </dd>
                        <dt>{lang === 'en' ? 'Footnote 2' : 'Note de bas de page 2'}</dt>
                        <dd id="fn2-canada-energy-supply">
                            <a
                                href="#fn2-rf-canada-energy-supply"
                                onClick={scrollToElement('fn2-rf-canada-energy-supply')}
                                className="fn-num"
                                title={lang === 'en' ? 'Return to footnote 2 referrer' : 'Retour à la référence de la note de bas de page 2'}
                            >
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>
                                2
                            </a>
                            <p>{getText('canada_energy_supply_footnote2', lang)}</p>
                        </dd>
                        <dt>{lang === 'en' ? 'Footnote 3' : 'Note de bas de page 3'}</dt>
                        <dd id="fn3-canada-energy-supply">
                            <a
                                href="#fn3-rf-canada-energy-supply"
                                onClick={scrollToElement('fn3-rf-canada-energy-supply')}
                                className="fn-num"
                                title={lang === 'en' ? 'Return to footnote 3 referrer' : 'Retour à la référence de la note de bas de page 3'}
                            >
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>
                                3
                            </a>
                            <p>{getText('canada_energy_supply_footnote3', lang)}</p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default CanadaEnergySupply;
