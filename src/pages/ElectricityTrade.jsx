import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getElectricityTradeData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import ElectricityTradeInfographic from '../components/ElectricityTradeInfographic';

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

const ElectricityTrade = () => {
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
        document.getElementById('fn-asterisk-electricity-trade-us')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const scrollToRef = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-rf-electricity-trade-us')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    useEffect(() => {
        getElectricityTradeData()
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

    const exportsLabel = getText('electricity_trade_us_legend_exports', lang);
    const importsLabel = getText('electricity_trade_us_legend_imports', lang);
    const netLabel = getText('electricity_trade_us_legend_net', lang);
    const chartTitle = substitute(getText('electricity_trade_us_chart_title', lang), {
        startYear: chartStartYear ?? '',
        endYear: chartEndYear ?? '',
    });
    const exportChartTitle = stripHtml(chartTitle);
    const yearRangeLabel = chartStartYear && chartEndYear ? `${chartStartYear}–${chartEndYear}` : '';
    const fileTitle = yearRangeLabel
        ? `${getText('electricity_trade_us_download_title', lang)} ${yearRangeLabel}`
        : getText('electricity_trade_us_download_title', lang);
    const yAxisTitle = getText('electricity_trade_us_yaxis', lang);
    const pageTitle = substitute(getText('electricity_trade_us_title', lang), { year: referenceYear ?? '' });
    const tableCaption = substitute(getText('electricity_trade_us_table_caption', lang), {
        startYear: chartStartYear ?? '',
        endYear: chartEndYear ?? '',
    });
    const infographicAria = referenceRow
        ? substitute(getText('electricity_trade_us_infographic_aria', lang), {
            year: referenceRow.year,
            exports: formatTwh(referenceRow.exports),
            imports: formatTwh(referenceRow.imports),
        })
        : getText('electricity_trade_us_infographic_aria', lang);
    const exportsInfographicValue = referenceRow
        ? `${formatTwh(referenceRow.exports)} ${getText('electricity_trade_us_twh_unit', lang)}`
        : '';
    const importsInfographicValue = referenceRow
        ? `${formatTwh(referenceRow.imports)} ${getText('electricity_trade_us_twh_unit', lang)}`
        : '';

    const tableHeaders = [
        getText('electricity_trade_us_col_year', lang),
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
            aria-labelledby="electricity-trade-us-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-65 { width: 100%; }
.electricity-trade-us-container { width: 100%; padding: 15px 0 0 0; display: flex; flex-direction: column; box-sizing: border-box; flex: 1; overflow: visible; }
.electricity-trade-us-title { font-family: 'Lato', sans-serif; font-size: 41px; font-weight: bold; color: var(--gc-text); margin-top: 0; margin-bottom: 25px; line-height: 1.25; position: relative; padding-bottom: 0.5em; text-transform: none; }
.electricity-trade-us-title::after { content: ''; position: absolute; left: 0; bottom: 0.2em; width: 72px; height: 6px; background-color: var(--gc-red); }
.electricity-trade-us-subtitle { font-family: 'Noto Sans', sans-serif; font-size: 20px; color: #332f30; margin: 0 0 20px 0; line-height: 1.45; white-space: nowrap; }
.electricity-trade-us-subtitle--with-infographic { margin-bottom: -60px; }
.electricity-trade-us-chart-frame { background-color: #f5f5f5; padding: 20px; padding-bottom: 20px; border-radius: 8px; margin-top: 0; margin-bottom: 20px; box-sizing: border-box; overflow: visible; }
.electricity-trade-us-chart-title { font-family: 'Lato', sans-serif; font-size: 29px; font-weight: bold; color: var(--gc-text); text-align: center; margin: 0 0 12px 0; text-transform: none; }
.electricity-trade-us-chart-title .fn-lnk { color: #26374a; text-decoration: underline; }
.electricity-trade-us-chart-scroll { width: 100%; overflow: hidden; }
.electricity-trade-us-chart { width: 100%; min-width: 0; height: ${plotHeight}px; position: relative; z-index: 1; overflow: visible; }
.electricity-trade-us-chart > div { width: 100%; height: 100%; overflow: visible; }
.electricity-trade-us-chart .js-plotly-plot,
.electricity-trade-us-chart .plot-container,
.electricity-trade-us-chart .svg-container { overflow: visible !important; }
.electricity-trade-us-clear-selection { padding: 6px 12px; background-color: #8C8C8C; border: 1px solid #404040; border-radius: 4px; cursor: pointer; font-family: Arial, sans-serif; font-size: 14px; color: #fff; margin-bottom: 8px; }
.electricity-trade-us-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.electricity-trade-us-table-wrapper details > summary { display: block; width: 100%; padding: 12px 15px; background-color: #8C8C8C; border: 1px solid #404040; border-radius: 4px; cursor: pointer; font-family: Arial, sans-serif; font-weight: bold; color: #ffffff; list-style: none; }
.electricity-trade-us-table-wrapper details > summary::-webkit-details-marker { display: none; }
.electricity-trade-us-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.electricity-trade-us-table-scrollbar > div { height: 20px; }
.electricity-trade-us-table-responsive { display: block; width: 100%; overflow-x: auto; border: 1px solid #ddd; background: #fff; scrollbar-width: none; -ms-overflow-style: none; }
.electricity-trade-us-table-responsive::-webkit-scrollbar { display: none; }
.electricity-trade-us-table-responsive table { width: max-content !important; min-width: 100%; border-collapse: collapse; }
.electricity-trade-us-table-responsive th, .electricity-trade-us-table-responsive td { white-space: nowrap; padding: 8px 12px; font-family: Arial, sans-serif; color: var(--gc-text); border: 1px solid #ddd; }
.electricity-trade-us-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.electricity-trade-us-download-buttons button { padding: 8px 16px; border: 1px solid #404040; border-radius: 4px; background: #8C8C8C; cursor: pointer; font-family: Arial, sans-serif; font-weight: bold; color: #ffffff; }
.electricity-trade-us-chart-frame button:hover, .electricity-trade-us-table-wrapper summary:hover { background-color: #404040 !important; }
.electricity-trade-us-loading, .electricity-trade-us-error { font-family: 'Noto Sans', sans-serif; font-size: 18px; color: var(--gc-text); margin: 24px 0; }
.electricity-trade-us-footnotes { font-family: var(--font-body); font-size: 1rem; color: var(--gc-text); margin-top: 24px; margin-bottom: 0; padding-top: 12px; border-top: 1px solid #e0e0e0; line-height: 1.65; max-width: 100%; box-sizing: border-box; }
.electricity-trade-us-footnotes h2 { font-family: var(--font-heading); font-size: 1.4rem; font-weight: 700; color: var(--gc-text); margin-top: 0; margin-bottom: 1rem; }
.electricity-trade-us-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
@media (max-width: 768px) {
    .electricity-trade-us-title { font-size: 37px; }
    .electricity-trade-us-subtitle { font-size: 18px; white-space: normal; }
    .electricity-trade-us-chart-title { font-size: 26px; }
    .electricity-trade-us-footnotes { font-size: 0.9rem; }
    .electricity-trade-us-footnotes h2 { font-size: 1.2rem; margin-bottom: 0.75rem; }
}
            `}</style>

            <div className="electricity-trade-us-container">
                <h1 id="electricity-trade-us-title" className="electricity-trade-us-title">{pageTitle}</h1>
                <p className={`electricity-trade-us-subtitle${!loading && !error && referenceRow ? ' electricity-trade-us-subtitle--with-infographic' : ''}`}>{getText('electricity_trade_us_subtitle', lang)}</p>

                {loading && <p className="electricity-trade-us-loading">{lang === 'en' ? 'Loading data…' : 'Chargement des données…'}</p>}
                {error && <p className="electricity-trade-us-error" role="alert">{error}</p>}
                {!loading && !error && !pageData.length && (
                    <p className="electricity-trade-us-error">{lang === 'en' ? 'No data available.' : 'Aucune donnée disponible.'}</p>
                )}

                {!loading && !error && referenceRow && (
                <ElectricityTradeInfographic
                    lang={lang}
                    getText={getText}
                    ariaLabel={infographicAria}
                    exportsValue={exportsInfographicValue}
                    importsValue={importsInfographicValue}
                />
                )}

                {!loading && !error && pageData.length > 0 && (
                <div className="electricity-trade-us-chart-frame">
                    <h2 id="electricity-trade-us-chart-title" className="electricity-trade-us-chart-title">
                        {chartTitle}
                        <span id="fn-asterisk-rf-electricity-trade-us" style={{ verticalAlign: 'super', fontSize: '0.75em' }}>
                            <a className="fn-lnk" href="#fn-asterisk-electricity-trade-us" onClick={scrollToFootnote}>
                                <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                                <span aria-hidden="true">*</span>
                            </a>
                        </span>
                    </h2>

                    {hasSelection && (
                        <button type="button" className="electricity-trade-us-clear-selection" onClick={() => setSelectedPoints(null)}>
                            {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                        </button>
                    )}

                    <div className="electricity-trade-us-chart-scroll">
                        <figure ref={chartRef} className="electricity-trade-us-chart" role="region" aria-label={chartTitle} tabIndex="0" style={{ margin: 0 }}>
                            <div aria-hidden="true">
                                <Plot
                                    key={`electricity-trade-us-${selectionKey}-${plotHeight}`}
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

                    <div className="electricity-trade-us-table-wrapper">
                        <details className="electricity-trade-us-data-table" onToggle={(event) => setIsTableOpen(event.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                            </summary>
                            <div ref={tableTopRef} className="electricity-trade-us-table-scrollbar" aria-hidden="true"><div /></div>
                            <div ref={tableScrollRef} className="electricity-trade-us-table-responsive" role="region" aria-labelledby="electricity-trade-us-table-caption" tabIndex={0}>
                                <table className="table table-striped table-hover">
                                    <caption id="electricity-trade-us-table-caption" className="wb-inv">{tableCaption}</caption>
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
                            <div ref={tableBottomRef} className="electricity-trade-us-table-scrollbar" aria-hidden="true"><div /></div>
                            <div className="electricity-trade-us-download-buttons">
                                <button type="button" onClick={downloadTableCSV}>{lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}</button>
                                <button type="button" onClick={downloadTableDocx}>{lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}</button>
                            </div>
                        </details>
                    </div>
                </div>
                )}

                {!loading && !error && pageData.length > 0 && (
                <aside className="wb-fnote electricity-trade-us-footnotes" role="note">
                    <h2>{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnote' : 'Note de bas de page'}</dt>
                        <dd id="fn-asterisk-electricity-trade-us">
                            <a href="#fn-asterisk-rf-electricity-trade-us" onClick={scrollToRef} className="fn-num" title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}>
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                            </a>
                            {' '}{getText('electricity_trade_us_footnote', lang)}
                        </dd>
                    </dl>
                </aside>
                )}
            </div>
        </main>
    );
};

export default ElectricityTrade;
