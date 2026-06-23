import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getPage65Data } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import Page65TradeInfographic from '../components/Page65TradeInfographic';

const COLORS = {
    exports: '#8DBE45',
    imports: '#5D91B4',
    net: '#F16532',
};

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    }
    return hex;
};

const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const Page65 = () => {
    const { lang } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const chartRef = useRef(null);
    const tableTopRef = useRef(null);
    const tableScrollRef = useRef(null);
    const tableBottomRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const formatTwh = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    };

    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const scrollToFootnote = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-page65')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const scrollToRef = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-rf-page65')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    useEffect(() => {
        getPage65Data()
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
    }, [lang, selectedPoints, loading, error, result]);

    const pageData = useMemo(() => result?.data ?? [], [result]);
    const referenceYear = result?.referenceYear ?? null;
    const referenceRow = result?.referenceRow ?? null;
    const chartStartYear = result?.chartStartYear ?? null;
    const chartEndYear = result?.chartEndYear ?? referenceYear;

    const years = useMemo(() => pageData.map((row) => row.year), [pageData]);
    const exportValues = useMemo(() => pageData.map((row) => row.exports), [pageData]);
    const importValues = useMemo(() => pageData.map((row) => row.imports), [pageData]);
    const netValues = useMemo(() => pageData.map((row) => row.net), [pageData]);
    const tableRowsDesc = useMemo(() => [...pageData].reverse(), [pageData]);

    const yAxisMax = useMemo(() => {
        if (!pageData.length) return 80;
        const peak = Math.max(...pageData.flatMap((row) => [row.exports, row.imports, row.net]));
        return Math.ceil((peak + 5) / 10) * 10;
    }, [pageData]);

    const exportsLabel = getText('page65_legend_exports', lang);
    const importsLabel = getText('page65_legend_imports', lang);
    const netLabel = getText('page65_legend_net', lang);
    const chartTitle = substitute(getText('page65_chart_title', lang), {
        startYear: chartStartYear ?? '',
        endYear: chartEndYear ?? '',
    });
    const exportChartTitle = stripHtml(chartTitle);
    const yearRangeLabel = chartStartYear && chartEndYear ? `${chartStartYear}–${chartEndYear}` : '';
    const fileTitle = yearRangeLabel
        ? `${getText('page65_download_title', lang)} ${yearRangeLabel}`
        : getText('page65_download_title', lang);
    const yAxisTitle = getText('page65_yaxis', lang);
    const pageTitle = substitute(getText('page65_title', lang), { year: referenceYear ?? '' });
    const tableCaption = substitute(getText('page65_table_caption', lang), {
        startYear: chartStartYear ?? '',
        endYear: chartEndYear ?? '',
    });
    const infographicAria = referenceRow
        ? substitute(getText('page65_infographic_aria', lang), {
            year: referenceRow.year,
            exports: formatTwh(referenceRow.exports),
            imports: formatTwh(referenceRow.imports),
        })
        : getText('page65_infographic_aria', lang);
    const exportsInfographicValue = referenceRow
        ? `${formatTwh(referenceRow.exports)} ${getText('page65_twh_unit', lang)}`
        : '';
    const importsInfographicValue = referenceRow
        ? `${formatTwh(referenceRow.imports)} ${getText('page65_twh_unit', lang)}`
        : '';

    const tableHeaders = [
        getText('page65_col_year', lang),
        `${exportsLabel} (${yAxisTitle})`,
        `${importsLabel} (${yAxisTitle})`,
        `${netLabel} (${yAxisTitle})`,
    ];

    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };
    const plotHeight = windowWidth <= 480 ? 360 : windowWidth <= 768 ? 400 : 460;
    const xTickvals = years.filter((y) => y % 2 === 0);

    const traceHasSelection = (traceIndex) => selectedPoints?.[traceIndex]?.length > 0;

    const barOpacityFor = (traceIndex, pointIndex) => {
        if (selectedPoints === null) return 1;
        if (!traceHasSelection(traceIndex)) return 0.3;
        return selectedPoints[traceIndex]?.includes(pointIndex) ? 1 : 0.3;
    };

    const lineOpacityFor = (pointIndex) => {
        if (selectedPoints === null) return 1;
        if (!traceHasSelection(2)) return 0.3;
        return selectedPoints[2]?.includes(pointIndex) ? 1 : 0.3;
    };

    const lineColorFor = () => {
        if (selectedPoints === null) return COLORS.net;
        return traceHasSelection(2) ? COLORS.net : hexToRgba(COLORS.net, 0.3);
    };

    const exportsHover = years.map(
        (y, i) => `<b>${exportsLabel}</b><br>${y}: ${formatTwh(exportValues[i])}<extra></extra>`,
    );
    const importsHover = years.map(
        (y, i) => `<b>${importsLabel}</b><br>${y}: ${formatTwh(importValues[i])}<extra></extra>`,
    );
    const netHover = years.map(
        (y, i) => `<b>${netLabel}</b><br>${y}: ${formatTwh(netValues[i])}<extra></extra>`,
    );

    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        try {
            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 1200,
                height: 680,
                scale: 2,
            });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                const titleHeight = 100;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 32px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(exportChartTitle, canvas.width / 2, 48);
                ctx.drawImage(img, 0, titleHeight);
                canvas.toBlob((blob) => {
                    if (blob) saveAs(blob, `${fileTitle}.png`);
                });
            };
            img.src = imgData;
        } catch (err) {
            console.error('Error downloading chart:', err);
        }
    };

    const downloadTableCSV = () => {
        const lines = [tableHeaders.map((h) => csvEscape(h)).join(',')];
        tableRowsDesc.forEach((row) => {
            lines.push([row.year, row.exports, row.imports, row.net].join(','));
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${fileTitle}.csv`);
    };

    const downloadTableDocx = async () => {
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
                    children: [row.year, formatTwh(row.exports), formatTwh(row.imports), formatTwh(row.net)].map(
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
                            columnWidths: [900, 2800, 2800, 2800],
                            rows: [headerRow, ...dataRows],
                        }),
                    ],
                },
            ],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${fileTitle}.docx`);
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

    const hasSelection = selectedPoints !== null && selectedPoints.some((arr) => arr.length > 0);

    const selectionKey = selectedPoints
        ? selectedPoints.map((arr) => arr.join('-')).join('_')
        : 'all';

    const config = {
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        modeBarButtonsToRemove: [
            'pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d',
            'autoScale2d', 'resetScale2d', 'toImage', 'hoverClosestCartesian',
            'hoverCompareCartesian', 'toggleSpikelines',
        ],
        modeBarButtonsToAdd: [{
            name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: (gd) => downloadChartWithTitle(gd),
        }],
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-65"
            role="main"
            aria-labelledby="page65-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-65 { width: 100%; }
.page65-container { width: 100%; padding: 15px 0 0 0; display: flex; flex-direction: column; box-sizing: border-box; flex: 1; overflow: visible; }
.page65-title { font-family: 'Lato', sans-serif; font-size: 41px; font-weight: bold; color: var(--gc-text); margin-top: 0; margin-bottom: 25px; line-height: 1.25; position: relative; padding-bottom: 0.5em; text-transform: none; }
.page65-title::after { content: ''; position: absolute; left: 0; bottom: 0.2em; width: 72px; height: 6px; background-color: var(--gc-red); }
.page65-subtitle { font-family: 'Noto Sans', sans-serif; font-size: 20px; color: #332f30; margin: 0 0 20px 0; line-height: 1.45; white-space: nowrap; }
.page65-subtitle--with-infographic { margin-bottom: -60px; }
.page65-chart-frame { background-color: #f5f5f5; padding: 20px; padding-bottom: 20px; border-radius: 8px; margin-top: 0; margin-bottom: 20px; box-sizing: border-box; overflow: visible; }
.page65-chart-title { font-family: 'Lato', sans-serif; font-size: 29px; font-weight: bold; color: var(--gc-text); text-align: center; margin: 0 0 12px 0; text-transform: none; }
.page65-chart-title .fn-lnk { color: #26374a; text-decoration: underline; }
.page65-chart-scroll { width: 100%; overflow: hidden; }
.page65-chart { width: 100%; min-width: 0; height: ${plotHeight}px; position: relative; z-index: 1; overflow: visible; }
.page65-chart > div { width: 100%; height: 100%; overflow: visible; }
.page65-chart .js-plotly-plot,
.page65-chart .plot-container,
.page65-chart .svg-container { overflow: visible !important; }
.page65-clear-selection { padding: 6px 12px; background-color: #8C8C8C; border: 1px solid #404040; border-radius: 4px; cursor: pointer; font-family: Arial, sans-serif; font-size: 14px; color: #fff; margin-bottom: 8px; }
.page65-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.page65-table-wrapper details > summary { display: block; width: 100%; padding: 12px 15px; background-color: #8C8C8C; border: 1px solid #404040; border-radius: 4px; cursor: pointer; font-family: Arial, sans-serif; font-weight: bold; color: #ffffff; list-style: none; }
.page65-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page65-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page65-table-scrollbar > div { height: 20px; }
.page65-table-responsive { display: block; width: 100%; overflow-x: auto; border: 1px solid #ddd; background: #fff; scrollbar-width: none; -ms-overflow-style: none; }
.page65-table-responsive::-webkit-scrollbar { display: none; }
.page65-table-responsive table { width: max-content !important; min-width: 100%; border-collapse: collapse; }
.page65-table-responsive th, .page65-table-responsive td { white-space: nowrap; padding: 8px 12px; font-family: Arial, sans-serif; color: var(--gc-text); border: 1px solid #ddd; }
.page65-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.page65-download-buttons button { padding: 8px 16px; border: 1px solid #404040; border-radius: 4px; background: #8C8C8C; cursor: pointer; font-family: Arial, sans-serif; font-weight: bold; color: #ffffff; }
.page65-chart-frame button:hover, .page65-table-wrapper summary:hover { background-color: #404040 !important; }
.page65-loading, .page65-error { font-family: 'Noto Sans', sans-serif; font-size: 18px; color: var(--gc-text); margin: 24px 0; }
.page65-footnotes { font-family: var(--font-body); font-size: 1rem; color: var(--gc-text); margin-top: 24px; margin-bottom: 0; padding-top: 12px; border-top: 1px solid #e0e0e0; line-height: 1.65; max-width: 100%; box-sizing: border-box; }
.page65-footnotes h2 { font-family: var(--font-heading); font-size: 1.4rem; font-weight: 700; color: var(--gc-text); margin-top: 0; margin-bottom: 1rem; }
.page65-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
@media (max-width: 768px) {
    .page65-title { font-size: 37px; }
    .page65-subtitle { font-size: 18px; white-space: normal; }
    .page65-chart-title { font-size: 26px; }
    .page65-footnotes { font-size: 0.9rem; }
    .page65-footnotes h2 { font-size: 1.2rem; margin-bottom: 0.75rem; }
}
            `}</style>

            <div className="page65-container">
                <h1 id="page65-title" className="page65-title">{pageTitle}</h1>
                <p className={`page65-subtitle${!loading && !error && referenceRow ? ' page65-subtitle--with-infographic' : ''}`}>{getText('page65_subtitle', lang)}</p>

                {loading && <p className="page65-loading">{lang === 'en' ? 'Loading data…' : 'Chargement des données…'}</p>}
                {error && <p className="page65-error" role="alert">{error}</p>}
                {!loading && !error && !pageData.length && (
                    <p className="page65-error">{lang === 'en' ? 'No data available.' : 'Aucune donnée disponible.'}</p>
                )}

                {!loading && !error && referenceRow && (
                <Page65TradeInfographic
                    lang={lang}
                    getText={getText}
                    ariaLabel={infographicAria}
                    exportsValue={exportsInfographicValue}
                    importsValue={importsInfographicValue}
                />
                )}

                {!loading && !error && pageData.length > 0 && (
                <div className="page65-chart-frame">
                    <h2 id="page65-chart-title" className="page65-chart-title">
                        {chartTitle}
                        <span id="fn-asterisk-rf-page65" style={{ verticalAlign: 'super', fontSize: '0.75em' }}>
                            <a className="fn-lnk" href="#fn-asterisk-page65" onClick={scrollToFootnote}>
                                <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                                <span aria-hidden="true">*</span>
                            </a>
                        </span>
                    </h2>

                    {hasSelection && (
                        <button type="button" className="page65-clear-selection" onClick={() => setSelectedPoints(null)}>
                            {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                        </button>
                    )}

                    <div className="page65-chart-scroll">
                        <figure ref={chartRef} className="page65-chart" role="region" aria-label={chartTitle} tabIndex="0" style={{ margin: 0 }}>
                            <div aria-hidden="true">
                                <Plot
                                    key={`page65-${selectionKey}-${plotHeight}`}
                                    data={[
                                        {
                                            x: years,
                                            y: exportValues,
                                            type: 'bar',
                                            name: exportsLabel,
                                            marker: {
                                                color: COLORS.exports,
                                                opacity: years.map((_, i) => barOpacityFor(0, i)),
                                            },
                                            hovertemplate: exportsHover,
                                        },
                                        {
                                            x: years,
                                            y: importValues,
                                            type: 'bar',
                                            name: importsLabel,
                                            marker: {
                                                color: COLORS.imports,
                                                opacity: years.map((_, i) => barOpacityFor(1, i)),
                                            },
                                            hovertemplate: importsHover,
                                        },
                                        {
                                            x: years,
                                            y: netValues,
                                            type: 'scatter',
                                            mode: 'lines+markers',
                                            name: netLabel,
                                            line: { color: lineColorFor(), width: 2.5 },
                                            marker: {
                                                color: COLORS.net,
                                                size: 7,
                                                opacity: years.map((_, i) => lineOpacityFor(i)),
                                            },
                                            hovertemplate: netHover,
                                        },
                                    ]}
                                    layout={{
                                        barmode: 'group',
                                        bargap: 0.15,
                                        bargroupgap: 0.08,
                                        hoverlabel: {
                                            bgcolor: '#ffffff',
                                            font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
                                        },
                                        hovermode: 'closest',
                                        clickmode: 'event',
                                        dragmode: false,
                                        showlegend: true,
                                        legend: {
                                            orientation: 'h',
                                            x: 0.5,
                                            xanchor: 'center',
                                            y: -0.18,
                                            yanchor: 'top',
                                            font: { size: 13, family: 'Arial, sans-serif' },
                                        },
                                        xaxis: {
                                            type: 'category',
                                            tickmode: 'array',
                                            tickvals: xTickvals,
                                            ticktext: xTickvals.map(String),
                                            showgrid: false,
                                            showline: true,
                                            linewidth: 1,
                                            linecolor: '#333',
                                            tickfont: tickFont,
                                            automargin: true,
                                        },
                                        yaxis: {
                                            title: {
                                                text: yAxisTitle,
                                                font: axisTitleFont,
                                                standoff: 12,
                                            },
                                            range: [0, yAxisMax],
                                            dtick: 10,
                                            showgrid: true,
                                            gridcolor: '#cccccc',
                                            gridwidth: 1,
                                            zeroline: true,
                                            tickfont: tickFont,
                                            automargin: true,
                                        },
                                        margin: {
                                            l: 70,
                                            r: 20,
                                            t: 20,
                                            b: windowWidth <= 480 ? 90 : 80,
                                        },
                                        paper_bgcolor: 'rgba(0,0,0,0)',
                                        plot_bgcolor: 'rgba(0,0,0,0)',
                                        autosize: true,
                                    }}
                                    config={config}
                                    style={{ width: '100%', height: '100%' }}
                                    useResizeHandler
                                    onClick={handleChartClick}
                                />
                            </div>
                        </figure>
                    </div>

                    <div className="page65-table-wrapper">
                        <details className="page65-data-table" onToggle={(event) => setIsTableOpen(event.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                            </summary>
                            <div ref={tableTopRef} className="page65-table-scrollbar" aria-hidden="true"><div /></div>
                            <div ref={tableScrollRef} className="page65-table-responsive" role="region" aria-labelledby="page65-table-caption" tabIndex={0}>
                                <table className="table table-striped table-hover">
                                    <caption id="page65-table-caption" className="wb-inv">{tableCaption}</caption>
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
                                                <th scope="row">{row.year}</th>
                                                <td style={{ textAlign: 'right' }}>{formatTwh(row.exports)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatTwh(row.imports)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatTwh(row.net)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div ref={tableBottomRef} className="page65-table-scrollbar" aria-hidden="true"><div /></div>
                            <div className="page65-download-buttons">
                                <button type="button" onClick={downloadTableCSV}>{lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}</button>
                                <button type="button" onClick={downloadTableDocx}>{lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}</button>
                            </div>
                        </details>
                    </div>
                </div>
                )}

                {!loading && !error && pageData.length > 0 && (
                <aside className="wb-fnote page65-footnotes" role="note">
                    <h2>{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnote' : 'Note de bas de page'}</dt>
                        <dd id="fn-asterisk-page65">
                            <a href="#fn-asterisk-rf-page65" onClick={scrollToRef} className="fn-num" title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}>
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                            </a>
                            {' '}{getText('page65_footnote', lang)}
                        </dd>
                    </dl>
                </aside>
                )}
            </div>
        </main>
    );
};

export default Page65;
