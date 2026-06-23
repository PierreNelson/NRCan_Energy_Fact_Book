import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getPage66Data } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import Page66GenerationInfographic from '../components/Page66GenerationInfographic';
import {
    formatSharePct,
    exportPage66InfographicPng,
    getPage66ProvinceRows,
} from '../components/Page66GenerationInfographic.constants';

const PIE_KEYS = ['petroleum', 'hydro', 'nuclear', 'other_renewables', 'natural_gas', 'coal'];
const PIE_LABEL_KEYS = {
    petroleum: 'page66_label_petroleum',
    hydro: 'page66_label_hydro',
    nuclear: 'page66_label_nuclear',
    other_renewables: 'page66_label_other_renewables',
    natural_gas: 'page66_label_natural_gas',
    coal: 'page66_label_coal',
};
const PIE_COLORS = ['#8B2942', '#006d3b', '#4a8c5c', '#63ad46', '#DF790C', '#B36109'];
const INFOGRAPHIC_SOURCE_KEYS = ['hydro', 'nuclear', 'wind'];
const INFOGRAPHIC_LABEL_KEYS = {
    hydro: 'page66_infographic_hydro',
    nuclear: 'page66_infographic_nuclear',
    wind: 'page66_infographic_wind',
};

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    return hex;
};

const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const Page66 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [pageData, setPageData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [zoomLevel, setZoomLevel] = useState(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const chartRef = useRef(null);
    const figureRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);

    useEffect(() => {
        getPage66Data()
            .then(setPageData)
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

    const selectedYear = pageData?.latestYear ?? null;
    const national = pageData?.national;
    const infographic = pageData?.infographic;
    const vars = { year: selectedYear ?? '', total: national?.totalTwh != null ? Math.round(national.totalTwh) : '' };
    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const zoomLegendMode = windowWidth <= 1000 || zoomLevel >= 1.75;
    const selectEnabled = windowWidth > 768;
    const effectiveSelectedSlices = selectEnabled ? selectedSlices : null;

    const formatPct = (value) => {
        if (value == null || value === 'lt0.1' || value === 'lt0.2') return formatSharePct(value, lang);
        return `${Number(value).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
    };

    const chartTitle = substitute(getText('page66_chart_title', lang), vars);
    const generationTotal = substitute(getText('page66_generation_total', lang), vars);
    const sectionTitle = getText('page66_section_title', lang);
    const ariaLabel = substitute(getText('page66_infographic_aria', lang), vars);
    const fileSlugBase = substitute(getText('page66_download_title', lang), vars).replace(/\s+/g, '_');

    const slices = useMemo(() => {
        if (!national?.slices?.length) return [];
        return PIE_KEYS.map((key) => national.slices.find((s) => s.key === key)).filter(Boolean);
    }, [national]);

    const pieValues = slices.map((slice) => {
        const n = typeof slice.pct === 'number' ? slice.pct : 0;
        return n > 0 ? n : 0.001;
    });
    const baseColors = slices.map((_, index) => PIE_COLORS[index] ?? '#999999');
    const pieColors = effectiveSelectedSlices?.length
        ? baseColors.map((color, index) => (effectiveSelectedSlices.includes(index) ? color : hexToRgba(color, 0.3)))
        : baseColors;
    const labels = slices.map((slice) => getText(PIE_LABEL_KEYS[slice.key], lang));
    const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18;
    const outsideTextSize = zoomLegendMode ? 18 : textSize;

    const plotData = useMemo(() => {
        if (!slices.length) return [];
        const pull = effectiveSelectedSlices?.length
            ? pieValues.map((_, index) => (effectiveSelectedSlices.includes(index) ? 0.08 : 0.02))
            : pieValues.map(() => 0.02);
        return [{
            type: 'pie',
            values: pieValues,
            labels,
            hole: 0.55,
            direction: 'clockwise',
            sort: false,
            texttemplate: zoomLegendMode ? '%{percent:.1%}' : '%{label}<br>%{percent:.1%}',
            textinfo: zoomLegendMode ? 'percent' : 'label+percent',
            textposition: zoomLegendMode ? 'inside' : 'outside',
            textfont: { size: textSize, family: 'Arial, sans-serif', color: zoomLegendMode ? '#ffffff' : pieColors },
            outsidetextfont: { size: outsideTextSize, color: pieColors },
            marker: { colors: pieColors, line: { color: '#ffffff', width: 1 } },
            pull,
            hovertext: slices.map((slice) => {
                const label = getText(PIE_LABEL_KEYS[slice.key], lang);
                return `<b>${label}</b><br>${formatPct(slice.pct)}`;
            }),
            hoverinfo: 'text',
            hoverlabel: { bgcolor: '#ffffff', font: { color: '#333333', size: 14, family: 'Arial, sans-serif' } },
            automargin: true,
        }];
    }, [slices, labels, pieValues, pieColors, effectiveSelectedSlices, windowWidth, textSize, outsideTextSize, zoomLegendMode, lang]);

    const layout = useMemo(() => ({
        showlegend: false,
        margin: {
            t: zoomLegendMode ? 80 : 95,
            b: zoomLegendMode ? 40 : 80,
            l: windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 220,
            r: windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 220,
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        height: windowWidth <= 480 ? 430 : 520,
        clickmode: 'event',
        dragmode: windowWidth <= 768 ? false : 'zoom',
        annotations: national?.totalTwh != null ? [{
            text: `${getText('page66_center_total', lang)}<br><b>${Math.round(national.totalTwh).toLocaleString(locale)}</b><br>${getText('page66_twh_unit', lang)}`,
            showarrow: false,
            x: 0.5,
            y: 0.5,
            xref: 'paper',
            yref: 'paper',
            font: { size: windowWidth <= 480 ? 15 : 20, color: '#424243', family: 'Arial Black, Arial, sans-serif' },
        }] : [],
    }), [national, lang, locale, zoomLegendMode, windowWidth]);

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
                link.download = `${fileSlugBase}_chart.png`;
                link.click();
            };
            img.src = imgData;
        } catch (err) {
            console.warn('Unable to download Page 66 chart image.', err);
        }
    };

    const plotConfig = {
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d', 'toImage'],
        modeBarButtonsToAdd: [{
            name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: downloadChartPng,
        }],
    };

    const tableHeaders = [
        lang === 'en' ? 'Year' : 'Année',
        getText('page66_table_col_source', lang),
        getText('page66_table_col_province', lang),
        getText('page66_table_col_share', lang),
    ];

    const tableRows = useMemo(() => {
        if (!selectedYear) return [];
        const rows = [];
        slices.forEach((slice) => {
            rows.push({
                year: selectedYear,
                source: getText(PIE_LABEL_KEYS[slice.key], lang),
                province: getText('page66_canada_label', lang),
                share: formatPct(slice.pct),
                sortKey: `0-${PIE_KEYS.indexOf(slice.key)}`,
            });
        });
        INFOGRAPHIC_SOURCE_KEYS.forEach((sourceKey) => {
            const block = infographic?.sources?.[sourceKey];
            if (!block) return;
            const sourceLabel = getText(INFOGRAPHIC_LABEL_KEYS[sourceKey], lang);
            getPage66ProvinceRows(sourceKey, block).forEach((row, index) => {
                rows.push({
                    year: selectedYear,
                    source: sourceLabel,
                    province: getText(`page67_prov_${row.key}`, lang),
                    share: formatSharePct(row.value, lang),
                    sortKey: `1-${sourceKey}-${index}`,
                });
            });
        });
        return rows;
    }, [selectedYear, slices, infographic, lang]);

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

    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

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

    const downloadCsv = () => {
        const header = tableHeaders.map(csvEscape).join(',');
        const rows = tableRows.map((row) => [row.year, row.source, row.province, row.share].map(csvEscape).join(','));
        saveAs(new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' }), `${fileSlugBase}.csv`);
    };

    const downloadDocx = async () => {
        const headerRow = new TableRow({
            children: tableHeaders.map((header) =>
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 22 })], alignment: AlignmentType.CENTER })],
                    shading: { fill: 'E6E6E6' },
                }),
            ),
        });
        const dataRows = tableRows.map((row) =>
            new TableRow({
                children: [row.year, row.source, row.province, row.share].map((value, index) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: String(value), size: 22 })],
                                alignment: index === 0 || index === 3 ? AlignmentType.CENTER : AlignmentType.LEFT,
                            }),
                        ],
                    }),
                ),
            }),
        );
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: stripHtml(chartTitle), bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [1200, 3200, 2400, 1800],
                        rows: [headerRow, ...dataRows],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), `${fileSlugBase}.docx`);
    };

    const downloadInfographicPng = async () => {
        const canvas = await exportPage66InfographicPng(figureRef.current, { scale: 2 });
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${fileSlugBase}_infographic.png`);
        });
    };

    if (loading) return <p>{lang === 'en' ? 'Loading...' : 'Chargement...'}</p>;
    if (error) return <p>{error}</p>;
    if (!selectedYear || !slices.length) return <p>{getText('page66_no_data', lang)}</p>;

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-66"
            role="main"
            aria-labelledby="page66-section-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-66.page-content { max-width: none !important; overflow-x: visible !important; }
.page-66 {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.page66-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.page66-page-title {
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
    text-align: left;
}
.page66-page-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.page-66 p.page66-page-subtitle {
    font-family: 'Lato', sans-serif;
    font-size: 39px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 20px 0;
    line-height: 1.15;
    text-transform: none;
    text-align: left;
}
.page66-charts-anchor { width: 100%; box-sizing: border-box; }
.page66-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 0;
    box-sizing: border-box;
    overflow: visible;
}
.page66-donut-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    min-height: 480px;
}
.page66-donut-figure {
    width: 100%;
    max-width: 800px;
    min-width: 360px;
    min-height: 450px;
    height: 520px;
    margin: 0;
    position: relative;
}
.page66-clear-selection {
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
.page66-custom-legend {
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
.page66-custom-legend-item { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.page66-custom-legend-swatch {
    width: 12px;
    height: 12px;
    display: inline-block;
    border-radius: 2px;
    border: 1px solid rgba(0, 0, 0, 0.15);
}
.page66-infographic-section { width: 100%; margin-top: 30px; margin-bottom: 0; }
.page66-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.page66-chart-frame details > summary:hover,
.page66-chart-frame button:hover,
.page66-download-buttons button:hover { background-color: #404040 !important; }
.page66-data-table { margin-top: 12px; margin-bottom: 0; width: 100%; }
.page66-data-table > summary {
    cursor: pointer;
    color: #ffffff;
    font-weight: bold;
    padding: 10px;
    border: 1px solid #404040;
    background-color: #8C8C8C;
    border-radius: 4px;
    list-style: none;
    font-family: Arial, sans-serif;
    box-sizing: border-box;
    width: 100%;
}
.page66-data-table > summary::-webkit-details-marker { display: none; }
.page66-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page66-table-scrollbar > div { height: 20px; }
@media (max-width: 768px) {
    .page66-page-title { font-size: 37px; }
    .page-66 p.page66-page-subtitle { font-size: 35px; }
    .page66-donut-figure { height: 430px; min-height: 430px; }
    .page66-custom-legend { font-size: 10px; gap: 8px 12px; }
}
            `}</style>

            <div className="page66-inner">
                <h1 id="page66-section-title" className="page66-page-title">{sectionTitle}</h1>
                <p className="page66-page-subtitle">{generationTotal}</p>

                <div className="page66-charts-anchor">
                    <div className="page66-chart-frame">
                        <p className="page66-chart-title">{chartTitle}</p>
                        {effectiveSelectedSlices?.length > 0 && (
                            <button type="button" className="page66-clear-selection" onClick={() => setSelectedSlices(null)}>
                                {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                            </button>
                        )}
                        <div className="page66-donut-wrap" ref={chartRef}>
                            <figure className="page66-donut-figure" role="region" aria-label={chartTitle}>
                                <Plot
                                    key={`page66-${selectedYear}-${zoomLegendMode ? 'compact' : 'wide'}-${effectiveSelectedSlices ? effectiveSelectedSlices.join('-') : 'none'}`}
                                    data={plotData}
                                    layout={layout}
                                    config={plotConfig}
                                    style={{ width: '100%', minWidth: 360, minHeight: 450, height: '100%' }}
                                    useResizeHandler
                                    onClick={(eventData) => {
                                        if (!selectEnabled || !eventData.points?.length) return;
                                        const idx = eventData.points[0].pointNumber ?? eventData.points[0].pointIndex;
                                        if (idx == null) return;
                                        if (windowWidth <= 768) {
                                            const now = Date.now();
                                            const last = lastPieClickRef.current;
                                            const doubleTap = idx === last.index && now - last.time < 300;
                                            lastPieClickRef.current = { time: now, index: idx };
                                            if (!doubleTap) return;
                                        }
                                        setSelectedSlices((prev) => {
                                            if (prev === null) return [idx];
                                            if (prev.includes(idx)) return prev.length <= 1 ? null : prev.filter((i) => i !== idx);
                                            return [...prev, idx];
                                        });
                                    }}
                                />
                            </figure>
                            {zoomLegendMode && (
                                <div className="page66-custom-legend" aria-label={lang === 'en' ? 'Chart legend' : 'Légende du graphique'}>
                                    {slices.map((slice, index) => (
                                        <span key={slice.key} className="page66-custom-legend-item">
                                            <span className="page66-custom-legend-swatch" style={{ backgroundColor: PIE_COLORS[index] }} aria-hidden="true" />
                                            <span>{getText(PIE_LABEL_KEYS[slice.key], lang)}</span>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <details className="page66-data-table" open={isTableOpen} onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                {isTableOpen ? '▼' : '▶'}
                                {' '}
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">
                                    {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                </span>
                            </summary>
                            <div ref={topScrollRef} className="page66-table-scrollbar" aria-hidden="true"><div /></div>
                            <div
                                ref={tableScrollRef}
                                className="table-responsive"
                                role="region"
                                aria-label={lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                tabIndex={0}
                                style={{ marginTop: 12, overflowX: 'auto' }}
                            >
                                <table className="table table-bordered table-striped table-hover">
                                    <caption className="wb-inv">{substitute(getText('page66_table_caption', lang), vars)}</caption>
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
                                                        border: '1px solid #ddd',
                                                        ...(index === 1
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
                                        {tableRows.map((row) => (
                                            <tr key={`${row.sortKey}-${row.province}`}>
                                                <td style={{ textAlign: 'center', border: '1px solid #ddd' }}>{row.year}</td>
                                                <th
                                                    scope="row"
                                                    style={{
                                                        position: 'sticky',
                                                        left: 0,
                                                        zIndex: 1,
                                                        fontWeight: 'bold',
                                                        border: '1px solid #ddd',
                                                        borderRight: '2px solid #dee2e6',
                                                    }}
                                                >
                                                    {row.source}
                                                </th>
                                                <td style={{ border: '1px solid #ddd' }}>{row.province}</td>
                                                <td style={{ textAlign: 'center', border: '1px solid #ddd' }}>{row.share}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div ref={bottomScrollRef} className="page66-table-scrollbar" aria-hidden="true"><div /></div>
                            <div className="page66-download-buttons">
                                <button type="button" onClick={downloadCsv} style={downloadBtnStyle}>
                                    {getText('page66_download_csv', lang)}
                                </button>
                                <button type="button" onClick={downloadDocx} style={downloadBtnStyle}>
                                    {getText('page66_download_docx', lang)}
                                </button>
                            </div>
                        </details>
                    </div>
                </div>

                <div className="page66-infographic-section">
                    <Page66GenerationInfographic
                        lang={lang}
                        getText={getText}
                        figureRef={figureRef}
                        ariaLabel={ariaLabel}
                        data={infographic}
                    />
                    <div className="page66-download-buttons">
                        <button type="button" onClick={downloadInfographicPng} style={downloadBtnStyle}>
                            {getText('page66_download_png', lang)}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Page66;
