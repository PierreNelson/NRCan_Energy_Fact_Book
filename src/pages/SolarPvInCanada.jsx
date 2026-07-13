import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import SolarPvCanadaInfographic from '../components/SolarPvCanadaInfographic';

const TRACE_KEYS = ['cumulative', 'annual'];
const COLORS = {
    cumulative: '#8CC63E',
    annual: '#2D5A27',
};
const DOC_COLUMN_WIDTHS = [1400, 3200, 3200];
const START_YEAR = 2011;
const END_YEAR = 2024;
const STAT_YEAR = 2024;

/** Hardcoded installed capacity (MW) — replace with pipeline data when available. */
const CHART_ROWS = [
    { year: 2011, cumulativeMw: 500, annualMw: 300 },
    { year: 2012, cumulativeMw: 700, annualMw: 200 },
    { year: 2013, cumulativeMw: 1100, annualMw: 400 },
    { year: 2014, cumulativeMw: 1600, annualMw: 550 },
    { year: 2015, cumulativeMw: 2200, annualMw: 600 },
    { year: 2016, cumulativeMw: 2300, annualMw: 100 },
    { year: 2017, cumulativeMw: 2550, annualMw: 250 },
    { year: 2018, cumulativeMw: 2700, annualMw: 150 },
    { year: 2019, cumulativeMw: 2900, annualMw: 200 },
    { year: 2020, cumulativeMw: 3150, annualMw: 250 },
    { year: 2021, cumulativeMw: 3950, annualMw: 800 },
    { year: 2022, cumulativeMw: 4400, annualMw: 450 },
    { year: 2023, cumulativeMw: 5100, annualMw: 700 },
    { year: 2024, cumulativeMw: 5290, annualMw: 190 },
];

const MODEBAR_REMOVE = [
    'pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d',
    'autoScale2d', 'resetScale2d', 'toImage',
];

const HOVER_LABEL = {
    bgcolor: '#ffffff',
    bordercolor: '#000000',
    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
};

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const computeYAxis = (maxValue) => {
    const padded = (maxValue || 6000) * 1.05;
    const step = 1000;
    const axisMax = Math.max(step, Math.ceil(padded / step) * step);
    const tickvals = [];
    for (let v = 0; v <= axisMax; v += step) tickvals.push(v);
    return { tickvals, range: [0, axisMax] };
};

const SolarPvInCanada = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [selectedPoints, setSelectedPoints] = useState(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [viewportScale, setViewportScale] = useState(
        typeof window !== 'undefined' ? (window.visualViewport?.scale || 1) : 1,
    );
    const chartRef = useRef(null);
    const infographicRef = useRef(null);
    const leftColRef = useRef(null);
    const chartAlignSpacerRef = useRef(null);
    const closedLeftHeightRef = useRef(null);
    const closedSpacerHeightRef = useRef(null);
    const [lockedLeftHeight, setLockedLeftHeight] = useState(null);
    const [lockedSpacerHeight, setLockedSpacerHeight] = useState(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const stackedLayout = viewportScale >= 1.1 || windowWidth <= 1000;
    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');
    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    useEffect(() => {
        const onResize = () => {
            setWindowWidth(window.innerWidth);
            const vvScale = window.visualViewport?.scale || 1;
            const approxZoom = window.outerWidth > 0 && window.innerWidth > 0
                ? window.outerWidth / window.innerWidth
                : 1;
            setViewportScale(Math.max(vvScale, approxZoom));
        };
        onResize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('scroll', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
            window.visualViewport?.removeEventListener('resize', onResize);
            window.visualViewport?.removeEventListener('scroll', onResize);
        };
    }, []);

    const tableRows = CHART_ROWS;
    const tableRowsDesc = useMemo(() => [...tableRows].reverse(), [tableRows]);
    const years = tableRows.map((row) => row.year);

    const formatMw = useCallback((value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    }, [locale]);

    const vars = { startYear: START_YEAR, endYear: END_YEAR, year: STAT_YEAR };
    const chartTitle = substitute(getText('solar_pv_canada_chart_title', lang), vars);
    const yAxisTitle = getText('solar_pv_canada_yaxis', lang);
    const cumulativeLabel = getText('solar_pv_canada_legend_cumulative', lang);
    const annualLabel = getText('solar_pv_canada_legend_annual', lang);
    const fileTitle = `${getText('solar_pv_canada_download_title', lang)}_${START_YEAR}-${END_YEAR}`;
    const tableCaption = substitute(getText('solar_pv_canada_table_caption', lang), vars);
    const infographicAria = substitute(getText('solar_pv_canada_infographic_aria', lang), vars);

    const tableHeaders = [
        getText('solar_pv_canada_table_col_year', lang),
        `${cumulativeLabel} (${getText('solar_pv_canada_table_unit_mw', lang)})`,
        `${annualLabel} (${getText('solar_pv_canada_table_unit_mw', lang)})`,
    ];

    const plotHeight = stackedLayout
        ? (windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420)
        : (windowWidth <= 768 ? 300 : 320);
    const plotTopMargin = stackedLayout
        ? (windowWidth <= 480 ? 24 : 20)
        : 12;
    const plotBottomMargin = stackedLayout
        ? (windowWidth <= 480 ? 72 : windowWidth <= 768 ? 62 : 50)
        : (windowWidth <= 768 ? 48 : 40);
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    const cumulativeValues = tableRows.map((row) => row.cumulativeMw ?? 0);
    const annualValues = tableRows.map((row) => row.annualMw ?? 0);
    const maxCumulative = cumulativeValues.length ? Math.max(...cumulativeValues) : 6000;
    const { tickvals: yTickvals, range: yRange } = useMemo(() => computeYAxis(maxCumulative), [maxCumulative]);

    const pointOpacityFor = (traceIndex, pointIndex) => {
        if (selectedPoints === null) return 1;
        return selectedPoints[traceIndex]?.includes(pointIndex) ? 1 : 0.25;
    };

    const pointOpacitiesFor = (traceIndex) =>
        selectedPoints === null ? 1 : years.map((_, i) => pointOpacityFor(traceIndex, i));

    const buildHoverTemplate = (label) =>
        `<b>${label}</b><br>%{x}: %{customdata} ${getText('solar_pv_canada_table_unit_mw', lang)}<extra></extra>`;

    const plotData = [
        {
            type: 'bar',
            name: cumulativeLabel,
            x: years.map(String),
            y: cumulativeValues,
            marker: { color: COLORS.cumulative, opacity: pointOpacitiesFor(0) },
            customdata: cumulativeValues.map((v) => formatMw(v)),
            hovertemplate: buildHoverTemplate(cumulativeLabel),
            hoverlabel: HOVER_LABEL,
        },
        {
            type: 'bar',
            name: annualLabel,
            x: years.map(String),
            y: annualValues,
            marker: { color: COLORS.annual, opacity: pointOpacitiesFor(1) },
            customdata: annualValues.map((v) => formatMw(v)),
            hovertemplate: buildHoverTemplate(annualLabel),
            hoverlabel: HOVER_LABEL,
        },
    ];

    const layout = {
        barmode: 'group',
        bargap: 0.15,
        bargroupgap: 0.08,
        hovermode: 'closest',
        hoverlabel: HOVER_LABEL,
        clickmode: 'event',
        dragmode: false,
        showlegend: false,
        xaxis: {
            type: 'category',
            categoryorder: 'array',
            categoryarray: years.map(String),
            tickmode: 'array',
            tickvals: years.map(String),
            ticktext: years.map(String),
            showgrid: false,
            zeroline: false,
            tickfont: tickFont,
            automargin: true,
            fixedrange: true,
        },
        yaxis: {
            title: { text: yAxisTitle, font: axisTitleFont, standoff: 12 },
            tickvals: yTickvals,
            range: yRange,
            showgrid: true,
            gridcolor: '#e0e0e0',
            showline: true,
            linewidth: 1,
            linecolor: '#333',
            zeroline: false,
            tickfont: tickFont,
            automargin: true,
            fixedrange: true,
        },
        margin: { t: plotTopMargin, r: 20, b: plotBottomMargin, l: windowWidth <= 480 ? 56 : 72 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        height: plotHeight,
    };

    useEffect(() => {
        if (stackedLayout) {
            setLockedLeftHeight(null);
            setLockedSpacerHeight(null);
        }
    }, [stackedLayout]);

    useLayoutEffect(() => {
        if (!stackedLayout && !isTableOpen) {
            if (leftColRef.current) closedLeftHeightRef.current = leftColRef.current.offsetHeight;
            if (chartAlignSpacerRef.current) closedSpacerHeightRef.current = chartAlignSpacerRef.current.offsetHeight;
        }
    });

    const handleTableSummaryClick = (event) => {
        event.preventDefault();
        const willOpen = !isTableOpen;
        if (willOpen && !stackedLayout) {
            // Lock aligned heights before the table expands so the summary does not jitter.
            flushSync(() => {
                setLockedLeftHeight(closedLeftHeightRef.current);
                setLockedSpacerHeight(closedSpacerHeightRef.current || 0);
                setIsTableOpen(true);
            });
            return;
        }
        flushSync(() => {
            setIsTableOpen(willOpen);
            if (!willOpen) {
                setLockedLeftHeight(null);
                setLockedSpacerHeight(null);
            }
        });
    };

    const syncTableScroll = useCallback(() => {
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = bottomScrollRef.current;
        if (!topScroll || !tableScroll || !bottomScroll || !isTableOpen) return;
        const table = tableScroll.querySelector('table');
        if (!table) return;
        [topScroll.firstElementChild, bottomScroll.firstElementChild].forEach((spacer) => {
            if (spacer) spacer.style.width = `${table.offsetWidth}px`;
        });
        const shouldShow = table.offsetWidth > tableScroll.clientWidth;
        topScroll.style.display = shouldShow ? 'block' : 'none';
        bottomScroll.style.display = shouldShow ? 'block' : 'none';
    }, [isTableOpen]);

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

    const handleChartClick = useCallback(
        (data) => {
            if (!data?.points?.length) return;
            const traceIndex = data.points[0].curveNumber;
            const pointIndex = data.points[0].pointIndex;
            if (traceIndex === undefined || traceIndex < 0 || traceIndex >= TRACE_KEYS.length) return;
            if (pointIndex === undefined || pointIndex < 0) return;

            if (windowWidth <= 768) {
                const currentTime = Date.now();
                const lastClick = lastClickRef.current;
                const isSamePoint =
                    traceIndex === lastClick.traceIndex &&
                    pointIndex === lastClick.pointIndex &&
                    lastClick.traceIndex != null;
                const isDoubleTap = isSamePoint && currentTime - lastClick.time < 300;
                lastClickRef.current = { time: currentTime, traceIndex, pointIndex };
                if (!isDoubleTap) return;
            }

            setSelectedPoints((prev) => {
                if (prev === null) {
                    const newSelection = TRACE_KEYS.map(() => []);
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
        },
        [windowWidth],
    );

    const downloadInfographicPng = async () => {
        const img = infographicRef.current?.querySelector('.solar-pv-canada-infographic-bg');
        if (!img?.complete) return;
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${getText('solar_pv_canada_download_infographic_title', lang)}.png`);
        });
    };

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
            const image = new Image();
            image.onload = () => {
                const titleHeight = 100;
                const legendHeight = 56;
                canvas.width = image.width;
                canvas.height = image.height + titleHeight + legendHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 36px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, canvas.width / 2, 48);
                ctx.drawImage(image, 0, titleHeight);
                const legendY = titleHeight + image.height + 36;
                const legendItems = [
                    { color: COLORS.cumulative, label: cumulativeLabel },
                    { color: COLORS.annual, label: annualLabel },
                ];
                const totalWidth = legendItems.length * 320;
                let x = (canvas.width - totalWidth) / 2 + 20;
                ctx.font = '24px Arial';
                ctx.textAlign = 'left';
                legendItems.forEach((item) => {
                    ctx.fillStyle = item.color;
                    ctx.fillRect(x, legendY - 10, 24, 24);
                    ctx.fillStyle = '#333333';
                    ctx.fillText(item.label, x + 32, legendY + 6);
                    x += 320;
                });
                canvas.toBlob((blob) => {
                    if (blob) saveAs(blob, `${fileTitle}.png`);
                });
            };
            image.src = imgData;
        } catch {
            /* ignore export errors */
        }
    };

    const downloadCsv = () => {
        const header = tableHeaders.map(csvEscape).join(',');
        const rows = tableRowsDesc.map((row) =>
            [row.year, row.cumulativeMw, row.annualMw ?? 0].map(csvEscape).join(','),
        );
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
        const dataRows = tableRowsDesc.map((row) =>
            new TableRow({
                children: [row.year, row.cumulativeMw, row.annualMw ?? 0].map((value, index) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: String(value), size: 22 })],
                                alignment: index === 0 ? AlignmentType.CENTER : AlignmentType.RIGHT,
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

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content solar-pv-canada-page"
            role="main"
            aria-labelledby="solar-pv-canada-main-title"
            style={{
                backgroundColor: 'white',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',
                boxSizing: 'border-box',
            }}
        >
            <style>{`
.solar-pv-canada-page {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
    container-type: inline-size;
}
.solar-pv-canada-container { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.solar-pv-canada-title {
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
.solar-pv-canada-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.solar-pv-canada-split {
    display: grid;
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
    gap: 24px;
    align-items: start;
}
.solar-pv-canada-split.is-stacked {
    grid-template-columns: 1fr;
}
.solar-pv-canada-split:not(.is-stacked):not(.is-table-open) {
    align-items: stretch;
}
.solar-pv-canada-left,
.solar-pv-canada-right { min-width: 0; }
.solar-pv-canada-split:not(.is-stacked) .solar-pv-canada-left {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
}
.solar-pv-canada-split:not(.is-stacked) .solar-pv-canada-infographic-download {
    margin-top: auto;
    margin-bottom: 0;
}
.solar-pv-canada-split:not(.is-stacked) .solar-pv-canada-chart-frame {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    padding: 14px 16px 16px;
}
.solar-pv-canada-split:not(.is-stacked):not(.is-table-open) .solar-pv-canada-chart-frame {
    height: 100%;
}
.solar-pv-canada-split:not(.is-stacked) .solar-pv-canada-chart-align-spacer {
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
}
.solar-pv-canada-split:not(.is-stacked).is-table-open .solar-pv-canada-chart-align-spacer {
    flex: 0 0 auto;
}
.solar-pv-canada-split:not(.is-stacked) .solar-pv-canada-chart-scroll {
    padding-top: 20px;
    padding-right: 24px;
}
.solar-pv-canada-split:not(.is-stacked) .solar-pv-canada-chart-title {
    margin-bottom: 8px;
}
.solar-pv-canada-split:not(.is-stacked) .solar-pv-canada-custom-legend {
    margin: 4px 0 8px;
}
.solar-pv-canada-split:not(.is-stacked) .solar-pv-canada-table-wrapper {
    margin-top: 0 !important;
}
.solar-pv-canada-infographic-figure { margin: 0 0 12px 0; }
.solar-pv-canada-infographic { width: 100%; }
.solar-pv-canada-infographic-bg { width: 100%; height: auto; display: block; }
.solar-pv-canada-infographic-download { display: flex; gap: 10px; flex-wrap: wrap; margin: 0 0 8px; }
.solar-pv-canada-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    box-sizing: border-box;
    overflow: visible;
}
.solar-pv-canada-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
}
.solar-pv-canada-chart-scroll {
    width: 100%;
    overflow: visible;
    position: relative;
    padding-top: 36px;
    padding-right: 36px;
    box-sizing: border-box;
}
.solar-pv-canada-chart { width: 100%; min-width: 0; position: relative; z-index: 1; overflow: visible; margin: 0; }
.solar-pv-canada-chart > div { width: 100%; height: 100%; overflow: visible; }
.solar-pv-canada-chart .js-plotly-plot,
.solar-pv-canada-chart .plot-container,
.solar-pv-canada-chart .svg-container { overflow: visible !important; pointer-events: auto !important; }
.solar-pv-canada-custom-legend {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px 24px;
    flex-wrap: wrap;
    margin: 8px 0;
    font-family: Arial, sans-serif;
    font-size: 13px;
    color: var(--gc-text);
}
.solar-pv-canada-custom-legend-item { display: inline-flex; align-items: center; gap: 6px; }
.solar-pv-canada-custom-legend-swatch {
    width: 14px;
    height: 14px;
    border-radius: 2px;
    border: 1px solid rgba(0,0,0,0.12);
}
.solar-pv-canada-clear-selection {
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
.solar-pv-canada-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.solar-pv-canada-data-table > summary {
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
    box-sizing: border-box;
}
.solar-pv-canada-data-table > summary::-webkit-details-marker { display: none; }
.solar-pv-canada-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.solar-pv-canada-table-scrollbar > div { height: 20px; }
.solar-pv-canada-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #dee2e6;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.solar-pv-canada-table-responsive::-webkit-scrollbar { display: none; }
.solar-pv-canada-table-responsive table {
    width: max-content !important;
    min-width: 100%;
    border-collapse: collapse;
    font-size: 14px;
}
.solar-pv-canada-table-responsive th,
.solar-pv-canada-table-responsive td {
    white-space: nowrap;
    padding: 0.75rem;
    vertical-align: top;
    font-family: var(--font-body);
    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    color: #000000;
    border: 1px solid #dee2e6;
    text-align: left;
}
.solar-pv-canada-table-responsive thead th,
.solar-pv-canada-table-responsive tbody th { font-weight: 700; }
.solar-pv-canada-table-responsive thead th { vertical-align: bottom; }
.solar-pv-canada-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.solar-pv-canada-infographic-download button:hover,
.solar-pv-canada-download-buttons button:hover,
.solar-pv-canada-data-table summary:hover,
.solar-pv-canada-clear-selection:hover { background-color: #404040 !important; }
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
    .solar-pv-canada-title { font-size: 37px; }
    .solar-pv-canada-chart-title { font-size: 24px; }
}
            `}</style>

            <div className="solar-pv-canada-container">
                <header>
                    <h1 id="solar-pv-canada-main-title" className="solar-pv-canada-title">
                        {getText('solar_pv_canada_title', lang)}
                    </h1>
                </header>

                <div className={`solar-pv-canada-split${stackedLayout ? ' is-stacked' : ''}${!stackedLayout && isTableOpen ? ' is-table-open' : ''}`}>
                    <div
                        className="solar-pv-canada-left"
                        ref={leftColRef}
                        style={lockedLeftHeight && !stackedLayout ? { height: lockedLeftHeight } : undefined}
                    >
                        <SolarPvCanadaInfographic
                            lang={lang}
                            stacked={stackedLayout}
                            ariaLabel={infographicAria}
                            figureRef={infographicRef}
                        />
                        <div className="solar-pv-canada-infographic-download">
                            <button type="button" onClick={downloadInfographicPng} style={downloadBtnStyle}>
                                {getText('solar_pv_canada_download_infographic_png', lang)}
                            </button>
                        </div>
                    </div>

                    <div className="solar-pv-canada-right">
                        <div className="solar-pv-canada-chart-frame">
                            <h2 id="solar-pv-canada-chart-title" className="solar-pv-canada-chart-title">{chartTitle}</h2>
                            {selectedPoints && (
                                <button
                                    type="button"
                                    className="solar-pv-canada-clear-selection"
                                    onClick={() => setSelectedPoints(null)}
                                >
                                    {getText('solar_pv_canada_clear_selection', lang)}
                                </button>
                            )}
                            <div className="solar-pv-canada-chart-scroll">
                                <figure ref={chartRef} className="solar-pv-canada-chart" role="img" aria-label={chartTitle}>
                                    <Plot
                                        key={`solar-pv-canada-${selectedPoints ? 'sel' : 'all'}-${plotHeight}-${stackedLayout ? 'stack' : 'side'}`}
                                        data={plotData}
                                        layout={layout}
                                        config={{
                                            displayModeBar: true,
                                            displaylogo: false,
                                            responsive: true,
                                            scrollZoom: false,
                                            modeBarButtonsToRemove: MODEBAR_REMOVE,
                                            modeBarButtonsToAdd: [{
                                                name: getText('solar_pv_canada_download_chart_png', lang),
                                                icon: {
                                                    width: 24,
                                                    height: 24,
                                                    path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z',
                                                },
                                                click: (gd) => downloadChartPng(gd),
                                            }],
                                        }}
                                        style={{ width: '100%' }}
                                        useResizeHandler
                                        onClick={handleChartClick}
                                    />
                                </figure>
                            </div>
                            <div className="solar-pv-canada-custom-legend" aria-hidden="true">
                                <span className="solar-pv-canada-custom-legend-item">
                                    <span className="solar-pv-canada-custom-legend-swatch" style={{ backgroundColor: COLORS.cumulative }} />
                                    {cumulativeLabel}
                                </span>
                                <span className="solar-pv-canada-custom-legend-item">
                                    <span className="solar-pv-canada-custom-legend-swatch" style={{ backgroundColor: COLORS.annual }} />
                                    {annualLabel}
                                </span>
                            </div>

                            {!stackedLayout && (
                                <div
                                    ref={chartAlignSpacerRef}
                                    className="solar-pv-canada-chart-align-spacer"
                                    aria-hidden="true"
                                    style={lockedSpacerHeight != null ? { height: lockedSpacerHeight } : undefined}
                                />
                            )}

                            <div className="solar-pv-canada-table-wrapper">
                                <details className="solar-pv-canada-data-table" open={isTableOpen}>
                                    <summary
                                        role="button"
                                        aria-expanded={isTableOpen}
                                        onClick={handleTableSummaryClick}
                                    >
                                        <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                        {getText('solar_pv_canada_table_summary', lang)}
                                        <span className="wb-inv">
                                            {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                        </span>
                                    </summary>
                                    <div ref={topScrollRef} className="solar-pv-canada-table-scrollbar" aria-hidden="true"><div /></div>
                                    <div
                                        ref={tableScrollRef}
                                        className="solar-pv-canada-table-responsive table-responsive"
                                        role="region"
                                        aria-label={getText('solar_pv_canada_table_summary', lang)}
                                        tabIndex={0}
                                    >
                                        <table className="table table-bordered table-striped table-hover">
                                            <caption className="wb-inv">{tableCaption}</caption>
                                            <thead>
                                                <tr>
                                                    {tableHeaders.map((header) => (
                                                        <th key={header} scope="col" style={{ textAlign: 'center' }}>{header}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tableRowsDesc.map((row) => (
                                                    <tr key={row.year}>
                                                        <th scope="row" style={{ textAlign: 'center' }}>{row.year}</th>
                                                        <td style={{ textAlign: 'right' }}>{formatMw(row.cumulativeMw)}</td>
                                                        <td style={{ textAlign: 'right' }}>{formatMw(row.annualMw ?? 0)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div ref={bottomScrollRef} className="solar-pv-canada-table-scrollbar" aria-hidden="true"><div /></div>
                                    <div className="solar-pv-canada-download-buttons">
                                        <button type="button" onClick={downloadCsv} style={downloadBtnStyle}>
                                            {getText('solar_pv_canada_download_csv', lang)}
                                        </button>
                                        <button type="button" onClick={downloadDocx} style={downloadBtnStyle}>
                                            {getText('solar_pv_canada_download_docx', lang)}
                                        </button>
                                    </div>
                                </details>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default SolarPvInCanada;
