import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';

const DATA_YEAR = 2025;

const FUEL_KEYS = ['diesel', 'ethanol', 'heavy_fuel_oil', 'aviation', 'other', 'motor_gasoline'];
const FOOTNOTE_NUM_BY_KEY = { ethanol: 1, other: 2 };

const LABEL_KEYS = {
    motor_gasoline: 'page95_label_motor_gasoline',
    diesel: 'page95_label_diesel',
    ethanol: 'page95_label_ethanol',
    heavy_fuel_oil: 'page95_label_heavy_fuel_oil',
    aviation: 'page95_label_aviation',
    other: 'page95_label_other',
};

const COLORS = {
    motor_gasoline: '#3d6b4f',
    diesel: '#6B9B4E',
    ethanol: '#A4C639',
    heavy_fuel_oil: '#DF790C',
    aviation: '#4b4c4d',
    other: '#519CC8',
};

/** Hardcoded until data pipeline is available — transportation sector fuel mix reference values (2023). */
const HARDCODED_DATA = [
    {
        year: DATA_YEAR,
        total: 2647,
        slices: {
            motor_gasoline: { pct: 53 },
            diesel: { pct: 28 },
            ethanol: { pct: 4 },
            heavy_fuel_oil: { pct: 1 },
            aviation: { pct: 12 },
            other: { pct: 2 },
        },
    },
];

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

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const pixelToPaper = (plotEl, xPx, yPx) => {
    const layout = plotEl._fullLayout;
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

const Page95 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [selectedYear] = useState(DATA_YEAR);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [zoomLevel, setZoomLevel] = useState(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const [chartDecorations, setChartDecorations] = useState({ footnoteButtons: [], fnAnnotations: [] });

    const chartRef = useRef(null);
    const tableTopRef = useRef(null);
    const tableScrollRef = useRef(null);
    const tableBottomRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const textVars = { year: selectedYear };

    const formatPj = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const formatPct = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return `${Number(value).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}%`;
    };

    const scrollToElement = (id) => (event) => {
        event?.preventDefault();
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    useEffect(() => {
        const onResize = () => {
            setWindowWidth(window.innerWidth);
            const viewportScale = window.visualViewport?.scale || 1;
            setZoomLevel(Math.max(viewportScale, window.devicePixelRatio || 1));
        };
        onResize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
            window.visualViewport?.removeEventListener('resize', onResize);
        };
    }, []);

    const currentRow = useMemo(
        () => HARDCODED_DATA.find((row) => row.year === selectedYear) || HARDCODED_DATA[0],
        [selectedYear],
    );

    const slices = useMemo(() => {
        if (!currentRow) return [];
        return FUEL_KEYS.map((key) => {
            const pct = currentRow.slices[key]?.pct ?? 0;
            const pj = Math.round((currentRow.total * pct) / 100);
            return { key, pct, pj };
        });
    }, [currentRow]);

    const year = currentRow?.year ?? DATA_YEAR;
    const totalPj = currentRow?.total ?? 0;

    const chartTitle = substitute(getText('page95_chart_title', lang), textVars);
    const fileTitle = substitute(getText('page95_download_title', lang), textVars);
    const tableCaption = substitute(getText('page95_table_caption', lang), textVars);

    const zoomLegendMode = windowWidth <= 1000 || zoomLevel >= 1.75;
    const effectiveSlices = windowWidth > 768 ? selectedSlices : null;
    const pieValues = slices.map((slice) => (slice.pj > 0 ? slice.pj : 0.001));
    const baseColors = slices.map((slice) => COLORS[slice.key]);
    const pieColors = effectiveSlices?.length
        ? baseColors.map((color, index) => (effectiveSlices.includes(index) ? color : hexToRgba(color, 0.3)))
        : baseColors;
    const labels = slices.map((slice) => getText(LABEL_KEYS[slice.key], lang));

    const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 17;
    const outsideTextSize = zoomLegendMode ? 18 : textSize;

    const outsideLabelTemplate = slices.map(() => '%{label}<br>%{percent:.0%}');
    const zoomLabelTemplate = slices.map(() => '%{percent:.0%}');

    const pieTrace = slices.length ? {
        type: 'pie',
        values: pieValues,
        labels,
        hole: 0.55,
        direction: 'clockwise',
        rotation: 0,
        sort: false,
        texttemplate: zoomLegendMode ? zoomLabelTemplate : outsideLabelTemplate,
        textinfo: zoomLegendMode ? 'percent' : 'label+percent',
        textposition: zoomLegendMode ? 'inside' : 'outside',
        textfont: { size: textSize, family: 'Arial, sans-serif', color: zoomLegendMode ? '#ffffff' : pieColors },
        outsidetextfont: { size: outsideTextSize, color: pieColors },
        marker: { colors: pieColors, line: { color: '#ffffff', width: 1 } },
        pull: effectiveSlices?.length
            ? pieValues.map((_, index) => (effectiveSlices.includes(index) ? 0.08 : 0.02))
            : pieValues.map(() => 0.02),
        hovertext: slices.map((slice) => {
            const label = getText(LABEL_KEYS[slice.key], lang);
            return `<b>${label}</b><br>${formatPj(slice.pj)} PJ<br>${formatPct(slice.pct)}`;
        }),
        hoverinfo: 'text',
        hoverlabel: HOVER_LABEL,
        automargin: true,
    } : null;

    const piePlotHeight = windowWidth <= 480 ? 430 : 520;
    const pieSideMargin = windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 240;

    const centerAnnotation = totalPj != null ? {
        text: `${getText('page95_center_total', lang)}<br><b>${formatPj(totalPj)}</b><br>PJ`,
        showarrow: false,
        x: 0.5,
        y: 0.5,
        xref: 'paper',
        yref: 'paper',
        font: { size: windowWidth <= 480 ? 15 : 20, color: '#424243', family: 'Arial Black, Arial, sans-serif' },
    } : null;

    const pieLayout = {
        showlegend: false,
        margin: {
            t: zoomLegendMode ? 80 : 95,
            b: zoomLegendMode ? 120 : 95,
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
        if (graphDiv._page95Click) {
            graphDiv.removeListener('plotly_click', graphDiv._page95Click);
        }
        graphDiv._page95Click = handlePieClick;
        graphDiv.on('plotly_click', graphDiv._page95Click);
    }, [handlePieClick]);

    const onPieInitialized = useCallback((_figure, graphDiv) => {
        bindPlotClickHandler(graphDiv);
        if (!graphDiv?.on) return;
        if (graphDiv._page95AfterPlot) {
            graphDiv.removeListener('plotly_afterplot', graphDiv._page95AfterPlot);
        }
        graphDiv._page95AfterPlot = () => window.requestAnimationFrame(updateChartDecorations);
        graphDiv.on('plotly_afterplot', graphDiv._page95AfterPlot);
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
    }, [isTableOpen, windowWidth, syncTableScroll, lang]);

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
        getText('page95_table_col_year', lang),
        getText('page95_table_col_total', lang),
        ...FUEL_KEYS.map((key) => `${getText(LABEL_KEYS[key], lang)} (PJ)`),
        ...FUEL_KEYS.map((key) => `${getText(LABEL_KEYS[key], lang)} (%)`),
    ];

    const tableRowCells = [
        year,
        formatPj(totalPj),
        ...slices.map((slice) => formatPj(slice.pj)),
        ...slices.map((slice) => formatPct(slice.pct)),
    ];

    const downloadChartPng = useCallback(async (plotEl = null) => {
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
        }
    }, [chartTitle, fileTitle, centerAnnotation, slices, textSize, zoomLegendMode]);

    const chartConfig = useMemo(() => ({
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        modeBarButtonsToRemove: MODEBAR_REMOVE,
        modeBarButtonsToAdd: [{
            name: getText('page95_download_png', lang),
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: (gd) => downloadChartPng(gd),
        }],
    }), [lang, downloadChartPng]);

    const downloadTableCsv = () => {
        const csv = [tableHeaders.map(csvEscape).join(','), tableRowCells.map(csvEscape).join(',')].join('\n');
        saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${fileTitle}.csv`);
    };

    const downloadTableDocx = async () => {
        const headerRow = new TableRow({
            children: tableHeaders.map((header) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 22 })], alignment: AlignmentType.CENTER })],
                shading: { fill: 'E6E6E6' },
            })),
        });
        const dataRow = new TableRow({
            children: tableRowCells.map((cell, index) => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: String(cell), size: 22 })],
                    alignment: index === 0 ? AlignmentType.CENTER : AlignmentType.RIGHT,
                })],
            })),
        });
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: tableCaption, bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [900, 1100, 1300, 1300, 1300, 1300, 1300, 1300, 900, 900, 900, 900, 900, 900],
                        rows: [headerRow, dataRow],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), `${fileTitle}.docx`);
    };

    const renderFootnoteButton = (button) => (
        <a
            key={button.key}
            id={`fn${button.footnoteNum}-rf-page95`}
            className="page95-fn-button fn-lnk"
            href={`#fn${button.footnoteNum}-page95`}
            onClick={scrollToElement(`fn${button.footnoteNum}-page95`)}
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
        const referrerId = footnoteNum ? `fn${footnoteNum}-rf-page95` : undefined;
        return (
            <span key={slice.key} className="page95-custom-legend-item" id={referrerId}>
                <span className="page95-custom-legend-swatch" style={{ backgroundColor: COLORS[slice.key] }} aria-hidden="true" />
                {getText(LABEL_KEYS[slice.key], lang)}
                {footnoteNum != null && (
                    <a className="fn-lnk" href={`#fn${footnoteNum}-page95`} onClick={scrollToElement(`fn${footnoteNum}-page95`)}>
                        <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                        {footnoteNum}
                    </a>
                )}
                {' '}
                {formatPct(slice.pct)}
            </span>
        );
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-95"
            role="main"
            aria-labelledby="page95-chart-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-95.page-content { max-width: none !important; overflow-x: visible !important; }
.page-95 {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.page95-container { width: 100%; padding: 15px 0 0 0; box-sizing: border-box; }
.page95-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 0;
    box-sizing: border-box;
    overflow: visible;
}
.page95-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
}
.page95-chart-scroll { width: 100%; overflow: hidden; display: flex; justify-content: center; }
.page95-chart {
    width: 100%;
    min-width: 0;
    height: ${piePlotHeight}px;
    position: relative;
    z-index: 1;
    overflow: visible;
}
.page95-chart > div { width: 100%; height: 100%; overflow: visible; }
.page95-chart .js-plotly-plot,
.page95-chart .plot-container,
.page95-chart .svg-container { overflow: visible !important; }
.page95-fn-button {
    position: absolute;
    z-index: 2;
    transform: translate(0, 0);
    pointer-events: auto;
}
.page95-custom-legend {
    position: relative;
    z-index: 60;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px 18px;
    flex-wrap: wrap;
    margin-top: 8px;
    margin-bottom: 8px;
    padding: 0 12px;
    font-family: Arial, sans-serif;
    font-size: 11px;
    color: var(--gc-text);
}
.page95-custom-legend-item { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.page95-custom-legend-swatch { width: 12px; height: 12px; display: inline-block; border-radius: 2px; border: 1px solid rgba(0, 0, 0, 0.15); }
.page95-clear-selection {
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
.page95-bullets {
    font-family: var(--font-body);
    font-size: clamp(17px, 2vw, 20px);
    color: var(--gc-text);
    line-height: 1.55;
    margin: 36px 0 28px 0;
    padding-left: 1.25rem;
}
.page95-bullets li { margin-bottom: 0.85rem; }
.page95-bullets li:last-child { margin-bottom: 0; }
.page95-bullets strong { font-weight: bold; }
.page95-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.page95-table-wrapper details > summary {
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
.page95-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page95-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page95-table-scrollbar > div { height: 20px; }
.page95-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #dee2e6;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.page95-table-responsive::-webkit-scrollbar { display: none; }
.page95-table-responsive table { width: max-content !important; min-width: 100%; }
.page95-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.page95-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.page95-chart-frame button:hover,
.page95-table-wrapper summary:hover { background-color: #404040 !important; }
.page95-footnotes {
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
.page95-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 1rem;
}
.page95-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
.page95-footnotes dd p { margin: 0; }
.page95-footnotes .page95-rounding-note { margin: 0; font-size: 1rem; }
@media (max-width: 768px) {
    .page95-chart-title { font-size: 26px; }
}
            `}</style>

            <div className="page95-container">
                <div className="page95-chart-frame">
                    <h2 id="page95-chart-title" className="page95-chart-title">{chartTitle}</h2>
                    {effectiveSlices?.length > 0 && (
                        <button type="button" className="page95-clear-selection" onClick={() => setSelectedSlices(null)}>
                            {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                        </button>
                    )}
                    <div className="page95-chart-scroll">
                        <figure
                            ref={chartRef}
                            className="page95-chart"
                            role="region"
                            aria-label={getText('page95_chart_aria', lang)}
                            tabIndex="0"
                            style={{ margin: 0 }}
                        >
                            <div aria-hidden="true">
                                {pieTrace && (
                                    <Plot
                                        key={`page95-pie-${year}-${zoomLegendMode ? 'compact' : 'wide'}-${effectiveSlices ? effectiveSlices.join('-') : 'none'}-${chartDecorations.footnoteButtons.length}`}
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
                        <div className="page95-custom-legend" aria-label={lang === 'en' ? 'Chart legend' : 'Légende du graphique'}>
                            {slices.map((slice) => renderZoomLegendItem(slice))}
                        </div>
                    )}

                    <div className="page95-table-wrapper">
                        <details className="page95-data-table" open={isTableOpen} onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">
                                    {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                </span>
                            </summary>
                            <div ref={tableTopRef} className="page95-table-scrollbar" aria-hidden="true"><div /></div>
                            <div
                                ref={tableScrollRef}
                                className="page95-table-responsive table-responsive"
                                role="region"
                                aria-labelledby="page95-table-caption"
                                tabIndex={0}
                            >
                                <table className="table table-bordered table-striped table-hover">
                                    <caption id="page95-table-caption" className="wb-inv">{tableCaption}</caption>
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
                                        <tr>
                                            <th scope="row" style={{ fontWeight: 'bold', textAlign: 'center' }}>{year}</th>
                                            {tableRowCells.slice(1).map((cell, index) => (
                                                <td key={`${year}-${index}`} style={{ textAlign: 'center' }}>
                                                    {cell}
                                                </td>
                                            ))}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div ref={tableBottomRef} className="page95-table-scrollbar" aria-hidden="true"><div /></div>
                            <div className="page95-download-buttons">
                                <button type="button" onClick={downloadTableCsv}>{getText('page95_download_csv', lang)}</button>
                                <button type="button" onClick={downloadTableDocx}>{getText('page95_download_docx', lang)}</button>
                            </div>
                        </details>
                    </div>
                </div>

                <ul className="page95-bullets" aria-label={getText('page95_bullets_aria', lang)}>
                    <li>
                        {getText('page95_bullet1_part1', lang)}
                        <strong>{getText('page95_bullet1_bold', lang)}</strong>
                        {getText('page95_bullet1_part2', lang)}
                    </li>
                    <li>
                        {getText('page95_bullet2_part1', lang)}
                        <strong>{getText('page95_bullet2_bold1', lang)}</strong>
                        {getText('page95_bullet2_part2', lang)}
                        <strong>{getText('page95_bullet2_bold2', lang)}</strong>
                        {getText('page95_bullet2_part3', lang)}
                    </li>
                    <li>
                        {getText('page95_bullet3_part1', lang)}
                        <strong>{getText('page95_bullet3_bold1', lang)}</strong>
                        {getText('page95_bullet3_part2', lang)}
                        <strong>{getText('page95_bullet3_bold2', lang)}</strong>
                        {getText('page95_bullet3_part3', lang)}
                        <strong>{getText('page95_bullet3_bold3', lang)}</strong>
                        {getText('page95_bullet3_part4', lang)}
                    </li>
                </ul>

                <aside className="wb-fnote page95-footnotes" role="note">
                    <h2 id="fn-page95">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</dt>
                        <dt>{lang === 'en' ? 'Footnote 1' : 'Note de bas de page 1'}</dt>
                        <dd id="fn1-page95">
                            <a
                                href="#fn1-rf-page95"
                                onClick={scrollToElement('fn1-rf-page95')}
                                className="fn-num"
                                title={lang === 'en' ? 'Return to footnote 1 referrer' : 'Retour à la référence de la note de bas de page 1'}
                            >
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>
                                1
                            </a>
                            <p>{getText('page95_footnote1', lang)}</p>
                        </dd>
                        <dt>{lang === 'en' ? 'Footnote 2' : 'Note de bas de page 2'}</dt>
                        <dd id="fn2-page95">
                            <a
                                href="#fn2-rf-page95"
                                onClick={scrollToElement('fn2-rf-page95')}
                                className="fn-num"
                                title={lang === 'en' ? 'Return to footnote 2 referrer' : 'Retour à la référence de la note de bas de page 2'}
                            >
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>
                                2
                            </a>
                            <p>{getText('page95_footnote2', lang)}</p>
                        </dd>
                    </dl>
                    <p className="page95-rounding-note">{getText('page95_footnote_rounding', lang)}</p>
                </aside>
            </div>
        </main>
    );
};

export default Page95;
