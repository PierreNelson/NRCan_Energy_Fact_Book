import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getPage80Data } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import Page80WindInfographic from '../components/Page80WindInfographic';
import { exportPage80InfographicPng, getGrowthOverlayParts } from '../components/Page80WindInfographic.constants';

const TRACE_KEYS = ['cumulative', 'annual'];
const COLORS = {
    cumulative: '#8CC63E',
    annual: '#2D5A27',
};

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
    const padded = (maxValue || 17000) * 1.05;
    const step = 1000;
    const axisMax = Math.ceil(padded / step) * step;
    const tickvals = [];
    for (let v = 0; v <= axisMax; v += step) tickvals.push(v);
    return { tickvals, range: [0, axisMax] };
};

const Page80 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const chartRef = useRef(null);
    const infographicRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');
    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    useEffect(() => {
        getPage80Data()
            .then(setResult)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const tableRows = useMemo(() => result?.chartRows ?? [], [result]);
    const years = tableRows.map((row) => row.year);
    const startYear = result?.startYear;
    const endYear = result?.endYear;
    const stats = result?.stats ?? {};
    const tableRowsDesc = useMemo(() => [...tableRows].reverse(), [tableRows]);

    const formatMw = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const formatGw = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    };

    const formatTwh = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    };

    const chartTitle = substitute(getText('page80_chart_title', lang), {
        startYear: startYear ?? '',
        endYear: endYear ?? '',
    });
    const yAxisTitle = getText('page80_yaxis', lang);
    const cumulativeLabel = getText('page80_legend_cumulative', lang);
    const annualLabel = getText('page80_legend_annual', lang);
    const fileTitle = `${getText('page80_download_title', lang)}_${startYear ?? ''}-${endYear ?? ''}`;
    const tableCaption = substitute(getText('page80_table_caption', lang), {
        startYear: startYear ?? '',
        endYear: endYear ?? '',
    });

    const tableHeaders = [
        getText('page80_table_col_year', lang),
        `${cumulativeLabel} (${getText('page80_table_unit_mw', lang)})`,
        `${annualLabel} (${getText('page80_table_unit_mw', lang)})`,
    ];

    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 72 : windowWidth <= 768 ? 62 : 50;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    const cumulativeValues = tableRows.map((row) => row.cumulativeMw ?? 0);
    const annualValues = tableRows.map((row) => row.annualMw ?? 0);
    const maxCumulative = cumulativeValues.length ? Math.max(...cumulativeValues) : 17000;
    const { tickvals: yTickvals, range: yRange } = useMemo(() => computeYAxis(maxCumulative), [maxCumulative]);

    const pointOpacityFor = (traceIndex, pointIndex) => {
        if (selectedPoints === null) return 1;
        return selectedPoints[traceIndex]?.includes(pointIndex) ? 1 : 0.25;
    };

    const pointOpacitiesFor = (traceIndex) =>
        selectedPoints === null ? 1 : years.map((_, i) => pointOpacityFor(traceIndex, i));

    const buildHoverTemplate = (label) =>
        `<b>${label}</b><br>%{x}: %{customdata} ${getText('page80_table_unit_mw', lang)}<extra></extra>`;

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
            showgrid: false,
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
        const canvas = await exportPage80InfographicPng(infographicRef.current, { scale: 2 });
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${getText('page80_download_infographic_title', lang)}.png`);
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
            img.src = imgData;
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
                            columnWidths: [1400, 3200, 3200],
                            rows: [headerRow, ...dataRows],
                        }),
                    ],
                },
            ],
        });
        saveAs(await Packer.toBlob(doc), `${fileTitle}.docx`);
    };

    const capYear = stats.capYear != null ? Math.round(stats.capYear) : '';
    const genYear = stats.genYear != null ? Math.round(stats.genYear) : '';
    const capUnit = getText('page80_unit_gw', lang);
    const genUnit = getText('page80_unit_twh', lang);
    const sinceLabel = getText('page80_since_2011', lang);
    const infographicAria = substitute(getText('page80_infographic_aria', lang), { capYear, genYear });
    const capGrowth = getGrowthOverlayParts(stats.capGrowthKey, getText, lang);
    const genGrowth = getGrowthOverlayParts(stats.genGrowthKey, getText, lang);

    if (loading) {
        return (
            <main id="main-content" className="page-content page-80" role="main">
                <p>{lang === 'en' ? 'Loading…' : 'Chargement…'}</p>
            </main>
        );
    }

    if (error) {
        return (
            <main id="main-content" className="page-content page-80" role="main">
                <p role="alert">{error}</p>
            </main>
        );
    }

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-80"
            role="main"
            aria-label={getText('page80_title', lang)}
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
.page-80 {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
    container-type: inline-size;
}
.page80-page-title {
    font-family: 'Lato', sans-serif;
    font-size: clamp(28px, 4vw, 39px);
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 24px 0;
    line-height: 1.2;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: none;
}
.page80-page-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.page80-infographic-section {
    width: 100%;
    max-width: 900px;
    margin: 0 auto 8px;
    overflow: visible;
}
.page80-infographic-figure {
    margin: 0;
    width: 100%;
    overflow: visible;
}
.page80-infographic-wrapper {
    position: relative;
    width: 100%;
    container-type: inline-size;
    overflow: visible;
}
.page80-bg-image {
    display: block;
    pointer-events: none;
}
.page80-overlay {
    position: absolute;
    font-family: 'Arial Black', Arial, sans-serif;
    font-weight: 900;
    color: #333333;
    line-height: 1.15;
    pointer-events: none;
}
.page80-value-green,
.page80-growth,
.page80-growth-prefix,
.page80-growth-word {
    color: #63ad46;
}
.page80-growth-prefix,
.page80-growth-word {
    display: block;
    white-space: nowrap;
}
.page80-label {
    font-family: Arial, sans-serif;
    font-weight: bold;
}
.page80-since {
    font-family: Arial, sans-serif;
    font-weight: bold;
}
.page80-chart-section { width: 100%; }
.page80-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    box-sizing: border-box;
    overflow: visible;
}
.page80-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
}
.page80-chart-scroll {
    width: 100%;
    overflow: visible;
    position: relative;
    padding-top: 36px;
    padding-right: 36px;
    box-sizing: border-box;
}
.page80-chart { width: 100%; min-width: 0; position: relative; z-index: 1; overflow: visible; }
.page80-chart > div { width: 100%; height: 100%; overflow: visible; }
.page80-chart .js-plotly-plot,
.page80-chart .plot-container,
.page80-chart .svg-container { overflow: visible !important; pointer-events: auto !important; }
.page80-custom-legend {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px 24px;
    flex-wrap: wrap;
    margin: 8px 0;
    font-family: Arial, sans-serif;
    font-size: 13px;
}
.page80-custom-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
.page80-custom-legend-swatch {
    width: 14px;
    height: 14px;
    border-radius: 2px;
    border: 1px solid rgba(0,0,0,0.12);
}
.page80-clear-selection {
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
.page80-infographic-download {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin: 12px 0 28px;
    max-width: 900px;
}
.page80-infographic-download button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
    font-size: 14px;
}
.page80-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.page80-table-wrapper details > summary {
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
.page80-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page80-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page80-table-scrollbar > div { height: 20px; }
.page80-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #dee2e6;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.page80-table-responsive::-webkit-scrollbar { display: none; }
.page80-table-responsive table { width: max-content !important; min-width: 100%; }
.page80-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.page80-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.page80-infographic-download button:hover,
.page80-download-buttons button:hover,
.page80-table-wrapper summary:hover,
.page80-clear-selection:hover {
    background-color: #404040 !important;
}
`}</style>

            <h1 className="page80-page-title">{getText('page80_title', lang)}</h1>

            <section className="page80-infographic-section" ref={infographicRef} aria-label={infographicAria}>
                <Page80WindInfographic
                    capacity={{
                        label: substitute(getText('page80_capacity_label', lang), { year: capYear }),
                        value: `${formatGw(stats.capGw)} ${capUnit}`,
                        growthPrefix: genGrowth.prefix,
                        growthWord: genGrowth.word,
                        mult: stats.genMultLabel,
                        since: sinceLabel,
                    }}
                    generation={{
                        label: substitute(getText('page80_generation_label', lang), { year: genYear }),
                        value: `${formatTwh(stats.genTwh)} ${genUnit}`,
                        growthPrefix: capGrowth.prefix,
                        growthWord: capGrowth.word,
                        mult: stats.capMultLabel,
                        since: sinceLabel,
                    }}
                    ariaLabel={infographicAria}
                />
            </section>

            <div className="page80-infographic-download">
                <button type="button" onClick={downloadInfographicPng}>
                    {getText('page80_download_infographic_png', lang)}
                </button>
            </div>

            <section className="page80-chart-section">
                <div className="page80-chart-frame">
                    <h2 id="page80-chart-title" className="page80-chart-title">{chartTitle}</h2>
                    {selectedPoints && (
                        <button type="button" className="page80-clear-selection" onClick={() => setSelectedPoints(null)}>
                            {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                        </button>
                    )}
                    <div className="page80-chart-scroll">
                        <figure ref={chartRef} className="page80-chart" role="img" aria-label={chartTitle}>
                            <Plot
                                key={`page80-${selectedPoints ? 'sel' : 'all'}-${plotHeight}`}
                                data={plotData}
                                layout={layout}
                                config={{
                                    displayModeBar: true,
                                    displaylogo: false,
                                    responsive: true,
                                    scrollZoom: false,
                                    modeBarButtonsToRemove: MODEBAR_REMOVE,
                                    modeBarButtonsToAdd: [{
                                        name: getText('page80_download_chart_png', lang),
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
                    <div className="page80-custom-legend" aria-hidden="true">
                        <span className="page80-custom-legend-item">
                            <span className="page80-custom-legend-swatch" style={{ backgroundColor: COLORS.cumulative }} />
                            {cumulativeLabel}
                        </span>
                        <span className="page80-custom-legend-item">
                            <span className="page80-custom-legend-swatch" style={{ backgroundColor: COLORS.annual }} />
                            {annualLabel}
                        </span>
                    </div>
                    <div className="page80-table-wrapper">
                        <details className="page80-data-table" onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">
                                    {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                </span>
                            </summary>
                            <div ref={topScrollRef} className="page80-table-scrollbar" aria-hidden="true"><div /></div>
                            <div
                                ref={tableScrollRef}
                                className="page80-table-responsive"
                                role="region"
                                aria-labelledby="page80-table-caption"
                                tabIndex={0}
                            >
                                <table className="table table-bordered table-striped table-hover">
                                    <caption id="page80-table-caption" className="wb-inv">{tableCaption}</caption>
                                    <thead>
                                        <tr>
                                            {tableHeaders.map((header) => (
                                                <th key={header} scope="col">{header}</th>
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
                            <div ref={bottomScrollRef} className="page80-table-scrollbar" aria-hidden="true"><div /></div>
                            <div className="page80-download-buttons">
                                <button type="button" onClick={downloadCsv}>
                                    {getText('page80_download_csv', lang)}
                                </button>
                                <button type="button" onClick={downloadDocx}>
                                    {getText('page80_download_docx', lang)}
                                </button>
                            </div>
                        </details>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default Page80;
