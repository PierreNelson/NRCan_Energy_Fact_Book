import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getPage71Data } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const TRACE_KEYS = ['coal', 'naturalGas', 'other'];

const COLORS = {
    coal: '#2B5C3F',
    naturalGas: '#5E9348',
    other: '#84962C',
};

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const computeYAxis = (maxTotal) => {
    if (!maxTotal || maxTotal <= 0) {
        return { tickvals: [0, 20, 40, 60, 80, 100, 120, 140], range: [0, 140] };
    }
    const padded = maxTotal * 1.1;
    const step = padded <= 120 ? 20 : 25;
    const axisMax = Math.ceil(padded / step) * step;
    const tickvals = [];
    for (let v = 0; v <= axisMax; v += step) tickvals.push(v);
    return { tickvals, range: [0, axisMax] };
};

const markerOpacityFor = (selectedPoints, years, traceIndex) => {
    if (selectedPoints === null) return 1;
    return years.map((_, i) => (selectedPoints[traceIndex]?.includes(i) ? 1 : 0.3));
};

const Page71 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');
    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const formatMt = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const hoverUnit = lang === 'en' ? ' Mt' : ' Mt';
    const tableUnitSuffix = getText('page71_table_unit', lang);

    const formatHoverMt = (value) => {
        const formatted = formatMt(value);
        return formatted === '—' ? formatted : `${formatted}${hoverUnit}`;
    };

    useEffect(() => {
        getPage71Data()
            .then(setResult)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    const tableRows = useMemo(() => result?.data ?? [], [result]);
    const years = tableRows.map((row) => row.year);
    const startYear = result?.startYear;
    const endYear = result?.endYear;
    const baseYear = result?.baseYear;
    const referenceYear = result?.referenceYear;
    const yearTicks = years.filter((y) => y % 2 === 1);
    const tableRowsDesc = useMemo(() => [...tableRows].reverse(), [tableRows]);

    const formatPctDisplay = (value) => {
        const n = Math.abs(Math.round(Number(value)));
        return lang === 'fr' ? `${n} %` : `${n}%`;
    };

    const intro1Bold = result?.totalPctChange != null
        ? (() => {
            const pct = formatPctDisplay(result.totalPctChange);
            if (lang === 'fr') {
                const verb = Number(result.totalPctChange) < 0 ? `diminué de ${pct}` : `augmenté de ${pct}`;
                return verb;
            }
            const verb = Number(result.totalPctChange) < 0 ? `decreased by ${pct}` : `increased by ${pct}`;
            return verb;
        })()
        : getText('page71_intro1_bold', lang);

    const intro2Bold1 = result?.coalGenSharePct != null
        ? (lang === 'fr'
            ? `${formatPctDisplay(result.coalGenSharePct)} de la production totale d'électricité`
            : `${formatPctDisplay(result.coalGenSharePct)} of generation`)
        : getText('page71_intro2_bold1', lang);

    const intro2Bold2 = result?.coalGhgSharePct != null
        ? (lang === 'fr' ? formatPctDisplay(result.coalGhgSharePct) : `${formatPctDisplay(result.coalGhgSharePct)} of electricity-related GHG`)
        : getText('page71_intro2_bold2', lang);

    const textVars = { startYear: startYear ?? '', endYear: endYear ?? '', baseYear: baseYear ?? '', referenceYear: referenceYear ?? '' };
    const intro1Part2 = substitute(getText('page71_intro1_part2', lang), textVars);
    const intro2Part3 = substitute(getText('page71_intro2_part3', lang), textVars);

    const coalLabel = getText('page71_legend_coal', lang);
    const naturalGasLabel = getText('page71_legend_naturalGas', lang);
    const otherLabel = getText('page71_legend_other', lang);
    const chartTitle = substitute(getText('page71_chart_title', lang), textVars);
    const yAxisTitle = getText('page71_yaxis', lang);
    const fileTitle = `${getText('page71_download_title', lang)}_${startYear ?? ''}-${endYear ?? ''}`;
    const tableCaption = substitute(getText('page71_table_caption', lang), textVars);

    const tableHeaders = [
        getText('page71_table_col_year', lang),
        `${coalLabel} ${tableUnitSuffix}`,
        `${naturalGasLabel} ${tableUnitSuffix}`,
        `${otherLabel} ${tableUnitSuffix}`,
        `${getText('page71_table_col_total', lang)} ${tableUnitSuffix}`,
    ];

    const plotHeight = windowWidth <= 480 ? 340 : windowWidth <= 768 ? 380 : 420;
    const plotTopMargin = windowWidth <= 480 ? 24 : 20;
    const plotBottomMargin = windowWidth <= 480 ? 72 : windowWidth <= 768 ? 62 : 50;
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };

    const coalValues = tableRows.map((row) => row.coal);
    const naturalGasValues = tableRows.map((row) => row.naturalGas);
    const otherValues = tableRows.map((row) => row.other);

    const maxTotal = useMemo(
        () => (tableRows.length ? Math.max(...tableRows.map((row) => row.total)) : 0),
        [tableRows],
    );
    const { tickvals: yTickvals, range: yRange } = useMemo(() => computeYAxis(maxTotal), [maxTotal]);

    const coalHoverTexts = years.map(
        (yearValue, i) => `<b>${coalLabel}</b><br>${yearValue}: ${formatHoverMt(coalValues[i])}<extra></extra>`,
    );
    const naturalGasHoverTexts = years.map(
        (yearValue, i) => `<b>${naturalGasLabel}</b><br>${yearValue}: ${formatHoverMt(naturalGasValues[i])}<extra></extra>`,
    );
    const otherHoverTexts = years.map(
        (yearValue, i) => `<b>${otherLabel}</b><br>${yearValue}: ${formatHoverMt(otherValues[i])}<extra></extra>`,
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
    }, [lang, loading, error, result, selectedPoints]);

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

    const handleChartClick = useCallback(
        (data) => {
            if (!data?.points?.length) return;
            const traceIndex = data.points[0].curveNumber;
            const pointIndex = data.points[0].pointIndex;
            if (traceIndex === undefined || traceIndex < 0 || traceIndex > 2) return;
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
                    const newSelection = [[], [], []];
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

    const downloadChartPng = async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        const title = `${stripHtml(chartTitle)} (${startYear}–${endYear})`;
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
                const legendItems = TRACE_KEYS.map((key, index) => ({
                    color: COLORS[key],
                    label: getText(`page71_legend_${key}`, lang),
                    index,
                }));
                const totalWidth = legendItems.length * 280;
                let x = (canvas.width - totalWidth) / 2 + 20;
                ctx.font = '24px Arial';
                ctx.textAlign = 'left';
                legendItems.forEach((item) => {
                    ctx.fillStyle = item.color;
                    ctx.fillRect(x, legendY - 10, 24, 24);
                    ctx.fillStyle = '#333333';
                    ctx.fillText(item.label, x + 32, legendY + 6);
                    x += 280;
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
            const total = row.coal + row.naturalGas + row.other;
            return [row.year, row.coal, row.naturalGas, row.other, total].map(csvEscape).join(',');
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
            const total = row.coal + row.naturalGas + row.other;
            return new TableRow({
                children: [row.year, row.coal, row.naturalGas, row.other, total].map((value, index) =>
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
                            children: [new TextRun({ text: `${stripHtml(chartTitle)} (${startYear}–${endYear})`, bold: true, size: 28 })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [1200, 1800, 2000, 1600, 1600],
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

    const plotData = [
        {
            x: years,
            y: coalValues,
            name: coalLabel,
            type: 'bar',
            marker: {
                color: COLORS.coal,
                opacity: markerOpacityFor(selectedPoints, years, 0),
            },
            hovertemplate: coalHoverTexts,
        },
        {
            x: years,
            y: naturalGasValues,
            name: naturalGasLabel,
            type: 'bar',
            marker: {
                color: COLORS.naturalGas,
                opacity: markerOpacityFor(selectedPoints, years, 1),
            },
            hovertemplate: naturalGasHoverTexts,
        },
        {
            x: years,
            y: otherValues,
            name: otherLabel,
            type: 'bar',
            marker: {
                color: COLORS.other,
                opacity: markerOpacityFor(selectedPoints, years, 2),
            },
            hovertemplate: otherHoverTexts,
        },
    ];

    if (loading) {
        return <p className="page71-loading">{lang === 'en' ? 'Loading data…' : 'Chargement des données…'}</p>;
    }
    if (error) {
        return <p className="page71-error" role="alert">{error}</p>;
    }
    if (!tableRows.length) {
        return <p className="page71-error">{lang === 'en' ? 'No data available.' : 'Aucune donnée disponible.'}</p>;
    }

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-71"
            role="main"
            aria-labelledby="page71-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-71.page-content { max-width: none !important; overflow-x: visible !important; }
.page-71 {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.page71-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.page71-title {
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
.page71-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.page71-intro {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: #332f30;
    margin: 0 0 16px 0;
    line-height: 1.45;
    max-width: 80ch;
}
.page71-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-top: 20px;
    margin-bottom: 0;
    box-sizing: border-box;
    overflow: visible;
}
.page71-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
}
.page71-chart { width: 100%; min-width: 0; height: ${plotHeight}px; position: relative; }
.page71-chart > div { width: 100%; height: 100%; }
.page71-legend {
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
.page71-legend-item { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.page71-legend-swatch { width: 22px; height: 14px; display: inline-block; border: 1px solid rgba(0, 0, 0, 0.12); }
.page71-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.page71-download-buttons button:hover,
.page-71 .data-table-wrapper summary:hover,
.page-71 .data-table-wrapper button:hover { background-color: #404040 !important; }
.page-71 .data-table-wrapper { padding-top: 5px; margin-top: 20px; width: 100%; box-sizing: border-box; }
.page-71 .data-table-wrapper summary {
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
.page-71 .data-table-wrapper summary::-webkit-details-marker { display: none; }
.page71-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page71-table-scrollbar > div { height: 20px; }
@media (max-width: 768px) {
    .page71-title { font-size: 37px; }
    .page71-intro { font-size: 18px; }
    .page71-chart-title { font-size: 26px; }
}
.page71-loading, .page71-error {
    font-family: Arial, sans-serif;
    font-size: 16px;
    color: var(--gc-text);
    padding: 24px 0;
}
            `}</style>

            <div className="page71-inner">
                <h1 id="page71-title" className="page71-title">{getText('page71_title', lang)}</h1>

                <p className="page71-intro">
                    {getText('page71_intro1_part1', lang)}
                    <strong>{intro1Bold}</strong>
                    {intro1Part2}
                </p>
                <p className="page71-intro">
                    {getText('page71_intro2_part1', lang)}
                    <strong>{intro2Bold1}</strong>
                    {getText('page71_intro2_part2', lang)}
                    <strong>{intro2Bold2}</strong>
                    {intro2Part3}
                    {lang === 'fr' && (
                        <>
                            <strong>{getText('page71_intro2_bold3', lang)}</strong>
                            {substitute(getText('page71_intro2_part4', lang), textVars)}
                        </>
                    )}
                </p>

                <div className="page71-chart-frame">
                    <h2 id="page71-chart-title" className="page71-chart-title">{chartTitle}</h2>

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

                    <figure ref={chartRef} className="page71-chart" role="region" aria-label={chartTitle} tabIndex={0} style={{ margin: 0 }}>
                        <Plot
                            key={`page71-${selectedPoints ? selectedPoints.map((arr) => arr.join('-')).join('_') : 'all'}-${plotHeight}`}
                            data={plotData}
                            layout={{
                                barmode: 'stack',
                                showlegend: false,
                                hoverlabel: {
                                    bgcolor: '#ffffff',
                                    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
                                },
                                hovermode: 'closest',
                                clickmode: 'event',
                                dragmode: false,
                                margin: { t: plotTopMargin, b: plotBottomMargin, l: 60, r: 20 },
                                paper_bgcolor: 'rgba(0,0,0,0)',
                                plot_bgcolor: 'rgba(0,0,0,0)',
                                autosize: true,
                                bargap: 0.15,
                                xaxis: {
                                    tickvals: yearTicks,
                                    tickfont: tickFont,
                                    automargin: true,
                                    fixedrange: true,
                                },
                                yaxis: {
                                    title: { text: yAxisTitle, font: axisTitleFont, standoff: 12 },
                                    tickvals: yTickvals,
                                    range: yRange,
                                    tickfont: tickFont,
                                    automargin: true,
                                    fixedrange: true,
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
                                modeBarButtonsToAdd: [{
                                    name: getText('page71_download_png', lang),
                                    icon: {
                                        width: 24,
                                        height: 24,
                                        path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z',
                                    },
                                    click: (gd) => downloadChartPng(gd),
                                }],
                            }}
                            style={{ width: '100%', height: '100%' }}
                            useResizeHandler
                            onClick={handleChartClick}
                        />
                    </figure>

                    <div className="page71-legend" aria-hidden="true">
                        {TRACE_KEYS.map((key) => (
                            <span key={key} className="page71-legend-item">
                                <span className="page71-legend-swatch" style={{ backgroundColor: COLORS[key] }} />
                                {getText(`page71_legend_${key}`, lang)}
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
                        <div ref={topScrollRef} className="page71-table-scrollbar" aria-hidden="true"><div /></div>
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
                                        const total = row.coal + row.naturalGas + row.other;
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
                                                <td style={{ textAlign: 'right' }}>{formatMt(row.coal)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatMt(row.naturalGas)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatMt(row.other)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatMt(total)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div ref={bottomScrollRef} className="page71-table-scrollbar" aria-hidden="true"><div /></div>
                        <div className="page71-download-buttons">
                            <button type="button" onClick={downloadCsv} style={downloadBtnStyle}>
                                {getText('page71_download_csv', lang)}
                            </button>
                            <button type="button" onClick={downloadDocx} style={downloadBtnStyle}>
                                {getText('page71_download_docx', lang)}
                            </button>
                        </div>
                    </details>
                </div>
            </div>
        </main>
    );
};

export default Page71;
