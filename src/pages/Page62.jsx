import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getPage62Data } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const REGION_KEYS = ['terr', 'atl', 'que', 'ont', 'man', 'sask', 'alta', 'bc'];
const LABEL_KEYS = {
    terr: 'page62_label_terr',
    atl: 'page62_label_atl',
    que: 'page62_label_que',
    ont: 'page62_label_ont',
    man: 'page62_label_man',
    sask: 'page62_label_sask',
    alta: 'page62_label_alta',
    bc: 'page62_label_bc'
};
const FULL_LABEL_KEYS = {
    terr: 'page62_full_terr',
    atl: 'page62_full_atl',
    que: 'page62_full_que',
    ont: 'page62_full_ont',
    man: 'page62_full_man',
    sask: 'page62_full_sask',
    alta: 'page62_full_alta',
    bc: 'page62_full_bc'
};
const COLORS = {
    terr: '#6D9BA2',
    atl: '#519CC8',
    que: '#006d3b',
    ont: '#4f5f56',
    man: '#DF790C',
    sask: '#B36109',
    alta: '#779E29',
    bc: '#63ad46'
};

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    return hex;
};

const substitute = (text, vars) => Object.keys(vars || {}).reduce((s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')), text || '');

const Page62 = () => {
    const { lang } = useOutletContext();
    const [result, setResult] = useState(null);
    const [selectedYear, setSelectedYear] = useState(2025);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [zoomLevel, setZoomLevel] = useState(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const chartRef = useRef(null);
    const tableTopRef = useRef(null);
    const tableScrollRef = useRef(null);
    const tableBottomRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const formatNumber = (value, digits = 0) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    };
    const formatPct = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return `${Number(value).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
    };
    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const scrollToElement = (id) => (event) => {
        event?.preventDefault();
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    useEffect(() => {
        getPage62Data()
            .then((data) => {
                setResult(data);
                setSelectedYear(data?.years?.includes(2025) ? 2025 : data?.latestYear ?? 2025);
            })
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

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
                if (dataTitle && (dataTitle.includes('Download') || /charger/i.test(dataTitle))) {
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
    }, [result, lang]);

    const dataRows = result?.data || [];
    const selectedRow = dataRows.find((row) => row.year === selectedYear) || dataRows.find((row) => row.year === 2025) || dataRows[dataRows.length - 1] || null;
    const year = selectedRow?.year ?? 2025;
    const chartTitle = substitute(getText('page62_chart_title', lang), { year });
    const fileTitle = `${getText('page62_download_title', lang)} ${year}`;
    const zoomLegendMode = windowWidth <= 1000 || zoomLevel >= 1.75;
    const effectiveSlices = windowWidth > 768 ? selectedSlices : null;
    const slices = selectedRow?.slices?.length ? REGION_KEYS.map((key) => selectedRow.slices.find((slice) => slice.key === key)).filter(Boolean) : [];
    const pieValues = slices.map((slice) => (slice.count != null && slice.count > 0 ? slice.count : 0.001));
    const baseColors = slices.map((slice) => COLORS[slice.key]);
    const pieColors = effectiveSlices?.length
        ? baseColors.map((color, index) => (effectiveSlices.includes(index) ? color : hexToRgba(color, 0.3)))
        : baseColors;
    const labels = slices.map((slice) => getText(LABEL_KEYS[slice.key], lang));
    const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18;
    const outsideTextSize = zoomLegendMode ? 18 : textSize;
    const hiddenLabelKeys = ['terr', 'atl'];
    const outsideLabelTemplate = slices.map((slice) => (hiddenLabelKeys.includes(slice.key) ? '' : '%{label}<br>%{percent:.1%}'));
    const zoomLabelTemplate = slices.map((slice) => (slice.key === 'terr' ? '' : '%{percent:.1%}'));
    const terrSlice = slices.find((slice) => slice.key === 'terr');
    const atlSlice = slices.find((slice) => slice.key === 'atl');

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
        pull: effectiveSlices?.length ? pieValues.map((_, index) => (effectiveSlices.includes(index) ? 0.08 : 0.02)) : pieValues.map(() => 0.02),
        hovertext: slices.map((slice) => `<b>${getText(FULL_LABEL_KEYS[slice.key], lang)}</b><br>${formatNumber(slice.count)} ${getText('page62_center_companies', lang)}<br>${formatPct(slice.pct)}`),
        hoverinfo: 'text',
        hoverlabel: { bgcolor: '#ffffff', font: { color: '#333333', size: 14, family: 'Arial, sans-serif' } },
        automargin: true
    } : null;

    const layout = {
        showlegend: false,
        margin: {
            t: zoomLegendMode ? 80 : 95,
            b: zoomLegendMode ? 120 : 80,
            l: windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 220,
            r: windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 220
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        height: windowWidth <= 480 ? 430 : 520,
        clickmode: 'event',
        dragmode: windowWidth <= 768 ? false : 'zoom',
        annotations: selectedRow?.total != null ? [
            {
                text: `${getText('page62_center_total', lang)}<br><b>${formatNumber(selectedRow.total)}</b><br>${getText('page62_center_companies', lang)}`,
                showarrow: false,
                x: 0.5,
                y: 0.5,
                xref: 'paper',
                yref: 'paper',
                font: { size: windowWidth <= 480 ? 15 : 20, color: '#424243', family: 'Arial Black, Arial, sans-serif' }
            }
        ] : []
    };

    const downloadChartPng = async () => {
        const plotEl = chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotEl || !window.Plotly) return;
        try {
            await window.Plotly.relayout(plotEl, { paper_bgcolor: '#ffffff', plot_bgcolor: '#ffffff' });
            const imgData = await window.Plotly.toImage(plotEl, { format: 'png', width: 1200, height: 800, scale: 2 });
            await window.Plotly.relayout(plotEl, { paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)' });
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
                ctx.fillText(chartTitle, canvas.width / 2, 44);
                ctx.drawImage(img, 0, titleHeight);
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = `${fileTitle}.png`;
                link.click();
            };
            img.src = imgData;
        } catch (err) {
            console.warn('Unable to download Page 62 chart image.', err);
            try {
                await window.Plotly.relayout(plotEl, { paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)' });
            } catch (restoreError) {
                console.warn('Unable to restore Page 62 chart background.', restoreError);
            }
        }
    };

    const config = {
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d', 'toImage'],
        modeBarButtonsToAdd: [{
            name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: downloadChartPng
        }]
    };

    const headers = [
        lang === 'en' ? 'Year' : 'Année',
        lang === 'en' ? 'Region' : 'Région',
        lang === 'en' ? 'Companies' : 'Entreprises',
        lang === 'en' ? 'Share (%)' : 'Part (%)'
    ];
    const tableRows = selectedRow ? slices.map((slice) => ({
        year,
        region: getText(FULL_LABEL_KEYS[slice.key], lang),
        count: slice.count,
        pct: slice.pct
    })) : [];

    const downloadTableCSV = () => {
        if (!tableRows.length) return;
        const rows = tableRows.map((row) => [row.year, row.region, row.count, Number(row.pct).toFixed(1)]);
        const csv = [headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
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
            children: headers.map((header) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 18 })], alignment: AlignmentType.CENTER })],
                shading: { fill: 'E6E6E6' }
            }))
        });
        const rows = tableRows.map((row) => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(row.year), size: 18 })], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row.region, size: 18 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(row.count), size: 18 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: Number(row.pct).toFixed(1), size: 18 })], alignment: AlignmentType.RIGHT })] })
            ]
        }));
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: fileTitle, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [1200, 4200, 1800, 1800],
                        rows: [headerRow, ...rows]
                    })
                ]
            }]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${fileTitle}.docx`);
    };

    if (loading) return <p>{lang === 'en' ? 'Loading...' : 'Chargement...'}</p>;
    if (error) return <p>{error}</p>;
    if (!selectedRow) return <p>{getText('page62_no_data', lang)}</p>;

    return (
        <main id="main-content" tabIndex="-1" className="page-content page-62" role="main" aria-labelledby="page62-title" style={{ backgroundColor: '#ffffff' }}>
            <style>{`
.page-62 { width: 100%; }
.page62-container { width: 100%; padding: 15px 0 0 0; display: flex; flex-direction: column; box-sizing: border-box; flex: 1; overflow: visible; }
.page62-title { font-family: 'Lato', sans-serif; font-size: 41px; font-weight: bold; color: var(--gc-text); margin-top: 0; margin-bottom: 25px; line-height: 1.25; position: relative; padding-bottom: 0.5em; text-transform: uppercase; }
.page62-title::after { content: ''; position: absolute; left: 0; bottom: 0.2em; width: 72px; height: 6px; background-color: var(--gc-red); }
.page62-subtitle { font-family: 'Noto Sans', sans-serif; font-size: 20px; color: #332f30; margin: 0 0 20px 0; line-height: 1.45; }
.page62-chart-frame { background-color: #f5f5f5; padding: 20px; padding-bottom: 20px; border-radius: 8px; margin-top: 0; margin-bottom: 20px; box-sizing: border-box; overflow: visible; }
.page62-chart-title { font-family: 'Lato', sans-serif; font-size: 29px; font-weight: bold; color: var(--gc-text); text-align: center; margin: 0 0 5px 0; text-transform: none; }
.page62-chart-scroll { width: 100%; overflow: hidden; display: flex; justify-content: center; }
.page62-chart { width: 100%; min-width: 0; height: 520px; position: relative; z-index: 1; overflow: visible; flex-shrink: 0; }
.page62-chart > div { width: 100%; height: 100%; overflow: visible; }
.page62-chart .js-plotly-plot,
.page62-chart .plot-container,
.page62-chart .svg-container { overflow: visible !important; }
.page62-html-pie-label { position: absolute; z-index: 40; font-family: Arial, sans-serif; font-size: ${textSize}px; line-height: 1.15; font-weight: 400; text-align: center; pointer-events: auto; }
.page62-terr-label { left: calc(50% + 8px); top: 36px; color: ${COLORS.terr}; }
.page62-terr-label::before { content: ''; position: absolute; left: -8px; top: 12px; width: 2px; height: 46px; background: #000; }
.page62-terr-label::after { content: ''; position: absolute; left: -8px; top: 12px; width: 12px; height: 2px; background: #000; }
.page62-atl-label { left: calc(50% + 80px); top: 72px; color: ${COLORS.atl}; }
.page62-custom-legend { position: relative; z-index: 60; display: flex; justify-content: center; align-items: center; gap: 12px 18px; flex-wrap: wrap; margin-top: 8px; margin-bottom: 8px; padding: 0 12px; font-family: Arial, sans-serif; font-size: 11px; color: var(--gc-text); pointer-events: auto; }
.page62-custom-legend-item { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.page62-custom-legend-swatch { width: 12px; height: 12px; display: inline-block; border-radius: 2px; border: 1px solid rgba(0, 0, 0, 0.15); }
.page62-custom-legend .fn-lnk { position: relative; z-index: 70; pointer-events: auto; }
.page62-clear-selection { padding: 6px 12px; background-color: #8C8C8C; border: 1px solid #404040; border-radius: 4px; cursor: pointer; font-family: Arial, sans-serif; font-size: 14px; color: #fff; margin-bottom: 8px; }
.page62-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.page62-table-wrapper details > summary { display: block; width: 100%; padding: 12px 15px; background-color: #8C8C8C; border: 1px solid #404040; border-radius: 4px; cursor: pointer; font-family: Arial, sans-serif; font-weight: bold; color: #ffffff; list-style: none; }
.page62-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page62-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page62-table-scrollbar > div { height: 20px; }
.page62-table-responsive { display: block; width: 100%; overflow-x: auto; border: 1px solid #ddd; background: #fff; scrollbar-width: none; -ms-overflow-style: none; }
.page62-table-responsive::-webkit-scrollbar { display: none; }
.page62-table-responsive table { width: max-content !important; min-width: 100%; border-collapse: collapse; }
.page62-table-responsive th, .page62-table-responsive td { white-space: nowrap; padding: 8px 12px; font-family: Arial, sans-serif; color: var(--gc-text); border: 1px solid #ddd; }
.page62-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.page62-download-buttons button { padding: 8px 16px; border: 1px solid #404040; border-radius: 4px; background: #8C8C8C; cursor: pointer; font-family: Arial, sans-serif; font-weight: bold; color: #ffffff; }
.page62-chart-frame button:hover, .page62-table-wrapper summary:hover { background-color: #404040 !important; }
.page62-footnotes { font-family: var(--font-body); font-size: 1rem; color: var(--gc-text); margin-top: 24px; margin-bottom: 0; padding-top: 12px; border-top: 1px solid #e0e0e0; line-height: 1.65; max-width: 100%; box-sizing: border-box; }
.page62-footnotes h2 { font-family: var(--font-heading); font-size: 1.4rem; font-weight: 700; color: var(--gc-text); margin-top: 0; margin-bottom: 1rem; }
.page62-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
@media (max-width: 768px) {
    .page62-title { font-size: 37px; }
    .page62-subtitle { font-size: 18px; }
    .page62-chart-title { font-size: 26px; }
    .page62-footnotes { font-size: 0.9rem; }
    .page62-footnotes h2 { font-size: 1.2rem; margin-bottom: 0.75rem; }
    .page62-terr-label { left: calc(50% + 6px); top: 40px; }
    .page62-terr-label::before { height: 42px; }
    .page62-atl-label { left: calc(50% + 58px); top: 74px; }
}
@media (max-width: 480px) {
    .page62-chart { height: 430px; }
    .page62-custom-legend { font-size: 10px; gap: 8px 12px; }
    .page62-terr-label { left: calc(50% + 4px); top: 44px; }
    .page62-terr-label::before { height: 36px; }
    .page62-atl-label { left: calc(50% + 42px); top: 76px; }
}
            `}</style>
            <div className="page62-container">
                <h1 id="page62-title" className="page62-title">{getText('page62_title', lang)}</h1>
                <p className="page62-subtitle">
                    {getText('page62_subtitle_prefix', lang)}
                    <strong>{formatNumber(selectedRow.total)}</strong>
                    {getText('page62_subtitle_mid', lang)}
                </p>
                <div className="page62-chart-frame">
                    <h2 id="page62-chart-title" className="page62-chart-title">{chartTitle}</h2>
                    {effectiveSlices?.length > 0 && <button type="button" className="page62-clear-selection" onClick={() => setSelectedSlices(null)}>{lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}</button>}
                    <div className="page62-chart-scroll">
                        <figure ref={chartRef} className="page62-chart" role="region" aria-label={chartTitle} tabIndex="0" style={{ margin: 0 }}>
                            <div aria-hidden="true">
                                {pieTrace && (
                                    <Plot
                                        key={`page62-${year}-${effectiveSlices ? effectiveSlices.join('-') : 'none'}`}
                                        data={[pieTrace]}
                                        layout={layout}
                                        config={config}
                                        style={{ width: '100%', height: '100%' }}
                                        useResizeHandler
                                        onClick={(data) => {
                                            const point = data.points?.[0];
                                            const index = point && (point.pointNumber !== undefined ? point.pointNumber : point.pointIndex);
                                            if (index == null) return;
                                            if (windowWidth <= 768) {
                                                const now = Date.now();
                                                const last = lastPieClickRef.current;
                                                const isDoubleTap = index === last.index && now - last.time < 300;
                                                lastPieClickRef.current = { time: now, index };
                                                if (!isDoubleTap) return;
                                            }
                                            setSelectedSlices((previous) => {
                                                if (previous === null) return [index];
                                                if (previous.includes(index)) return previous.length <= 1 ? null : previous.filter((item) => item !== index);
                                                return [...previous, index];
                                            });
                                        }}
                                    />
                                )}
                            </div>
                            {terrSlice && (
                                <span className="page62-html-pie-label page62-terr-label" aria-hidden="true">
                                    {getText('page62_label_terr', lang)}<br />
                                    {formatPct(terrSlice.pct)}
                                </span>
                            )}
                            {!zoomLegendMode && atlSlice && (
                                <span id="fn-atl-rf-page62" className="page62-html-pie-label page62-atl-label">
                                    {getText('page62_label_atl', lang)}
                                    <a className="fn-lnk" href="#fn-atl-page62" onClick={scrollToElement('fn-atl-page62')}>
                                        <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>*
                                    </a>
                                    <br />
                                    {formatPct(atlSlice.pct)}
                                </span>
                            )}
                        </figure>
                    </div>
                    {zoomLegendMode && (
                        <div className="page62-custom-legend" aria-label={lang === 'en' ? 'Chart legend' : 'Légende du graphique'}>
                            {slices.map((slice) => (
                                <span key={slice.key} className="page62-custom-legend-item" id={slice.key === 'atl' ? 'fn-atl-rf-page62' : undefined}>
                                    <span className="page62-custom-legend-swatch" style={{ backgroundColor: COLORS[slice.key] }} aria-hidden="true" />
                                    <span>{getText(LABEL_KEYS[slice.key], lang)}</span>
                                    {slice.key === 'atl' && (
                                        <a className="fn-lnk" href="#fn-atl-page62" onClick={scrollToElement('fn-atl-page62')}>
                                            <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>*
                                        </a>
                                    )}
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="page62-table-wrapper">
                        <details className="page62-data-table" onToggle={(event) => setIsTableOpen(event.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                            </summary>
                            <div ref={tableTopRef} className="page62-table-scrollbar" aria-hidden="true"><div /></div>
                            <div ref={tableScrollRef} className="page62-table-responsive" role="region" aria-labelledby="page62-table-caption" tabIndex={0}>
                                <table className="table table-striped table-hover">
                                    <caption id="page62-table-caption" className="wb-inv">{getText('page62_table_caption', lang)}</caption>
                                    <thead>
                                        <tr>
                                            {headers.map((header) => <th key={header} scope="col">{header}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableRows.map((row) => (
                                            <tr key={row.region}>
                                                <th scope="row">{row.year}</th>
                                                <td>{row.region}</td>
                                                <td style={{ textAlign: 'right' }}>{formatNumber(row.count)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatPct(row.pct)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div ref={tableBottomRef} className="page62-table-scrollbar" aria-hidden="true"><div /></div>
                            <div className="page62-download-buttons">
                                <button type="button" onClick={downloadTableCSV}>{lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}</button>
                                <button type="button" onClick={downloadTableDocx}>{lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}</button>
                            </div>
                        </details>
                    </div>
                </div>
                <aside className="wb-fnote page62-footnotes" role="note">
                    <h2 id="fn-page62">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</dt>
                        <dd id="fn-atl-page62">
                            <a href="#fn-atl-rf-page62" onClick={scrollToElement('fn-atl-rf-page62')} className="fn-num" title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}>
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                            </a>
                            {' '}{getText('page62_footnote_atl', lang)}
                        </dd>
                        <dd>{getText('page62_footnote_rounding', lang)}</dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page62;
