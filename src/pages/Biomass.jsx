import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import BiomassInfographic from '../components/BiomassInfographic';

const YEAR = 2023;
const FN_PREFIX = 'biomass';
const biomassFnRefId = (n) => `fn${n}-rf-${FN_PREFIX}`;
const biomassFnDefId = (n) => `fn${n}-${FN_PREFIX}`;
const PIE_BY_YEAR = {
    2023: [
        { key: 'hydro', pct: 66 },
        { key: 'solid_biofuels', pct: 22 },
        { key: 'wind_solar', pct: 8 },
        { key: 'other_biomass', pct: 4 },
    ],
};
const PIE_KEYS = ['hydro', 'solid_biofuels', 'wind_solar', 'other_biomass'];
const DOC_COLUMN_WIDTHS = [1400, 4200, 1800];
const PIE_COLORS = {
    hydro: '#6B6B6B',
    solid_biofuels: '#2F6B3A',
    wind_solar: '#9A9A9A',
    other_biomass: '#8FBC8F',
};
const PIE_LABEL_KEYS = {
    hydro: 'biomass_label_hydro',
    solid_biofuels: 'biomass_label_solid_biofuels',
    wind_solar: 'biomass_label_wind_solar',
    other_biomass: 'biomass_label_other_biomass',
};
const SOLID_BIOFUELS_INDEX = PIE_KEYS.indexOf('solid_biofuels');

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

const Biomass = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [selectedYear] = useState(YEAR);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [viewportScale, setViewportScale] = useState(
        typeof window !== 'undefined' ? (window.visualViewport?.scale || 1) : 1,
    );
    const [zoomLevel, setZoomLevel] = useState(
        typeof window !== 'undefined' ? Math.max(window.visualViewport?.scale || 1, window.devicePixelRatio || 1) : 1,
    );
    const chartRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const stackedLayout = viewportScale >= 1.1 || windowWidth <= 1000;
    const zoomLegendMode = windowWidth <= 1000 || zoomLevel >= 1.75;
    const effectiveSelectedSlices = windowWidth > 768 ? selectedSlices : null;

    useEffect(() => {
        const onResize = () => {
            setWindowWidth(window.innerWidth);
            const vvScale = window.visualViewport?.scale || 1;
            const approxZoom = window.outerWidth > 0 && window.innerWidth > 0
                ? window.outerWidth / window.innerWidth
                : 1;
            const scale = Math.max(vvScale, approxZoom);
            setViewportScale(scale);
            setZoomLevel(Math.max(scale, window.devicePixelRatio || 1));
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

    const formatSharePct = useCallback((value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        const formatted = Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
        return lang === 'en' ? `${formatted}%` : `${formatted} %`;
    }, [lang, locale]);

    const vars = { year: selectedYear };
    const chartTitle = getText('biomass_chart_title', lang);
    const fileSlugBase = substitute(getText('biomass_download_title', lang), vars).replace(/\s+/g, '_');

    const scrollToElement = (id) => (event) => {
        event?.preventDefault();
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const slices = useMemo(() => {
        const yearSlices = PIE_BY_YEAR[selectedYear] || [];
        return PIE_KEYS.map((key) => yearSlices.find((s) => s.key === key)).filter(Boolean);
    }, [selectedYear]);

    const pieValues = slices.map((slice) => {
        const n = typeof slice.pct === 'number' ? slice.pct : 0;
        return n > 0 ? n : 0.001;
    });
    const baseColors = slices.map((slice) => PIE_COLORS[slice.key] ?? '#999999');
    const pieColors = effectiveSelectedSlices?.length
        ? baseColors.map((color, index) => (effectiveSelectedSlices.includes(index) ? color : hexToRgba(color, 0.3)))
        : baseColors;
    const labels = slices.map((slice) => getText(PIE_LABEL_KEYS[slice.key], lang));
    const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 16;
    const outsideTextSize = zoomLegendMode ? 16 : textSize;

    const plotData = useMemo(() => {
        if (!slices.length) return [];
        const pull = effectiveSelectedSlices?.length
            ? pieValues.map((_, index) => (effectiveSelectedSlices.includes(index) ? 0.08 : 0.02))
            : pieValues.map((_, index) => (index === SOLID_BIOFUELS_INDEX ? 0.05 : 0.02));
        return [{
            type: 'pie',
            values: pieValues,
            labels,
            direction: 'clockwise',
            sort: false,
            texttemplate: zoomLegendMode ? '%{percent:.0%}' : '%{label}<br>%{percent:.0%}',
            textinfo: zoomLegendMode ? 'percent' : 'label+percent',
            textposition: zoomLegendMode ? 'inside' : 'outside',
            textfont: { size: textSize, family: 'Arial, sans-serif', color: zoomLegendMode ? '#ffffff' : pieColors },
            outsidetextfont: { size: outsideTextSize, color: pieColors },
            marker: { colors: pieColors, line: { color: '#ffffff', width: 1 } },
            pull,
            hovertext: slices.map((slice) => {
                const label = getText(PIE_LABEL_KEYS[slice.key], lang);
                return `<b>${label}</b><br>${formatSharePct(slice.pct)}`;
            }),
            hoverinfo: 'text',
            hoverlabel: { bgcolor: '#ffffff', font: { color: '#333333', size: 14, family: 'Arial, sans-serif' } },
            automargin: true,
        }];
    }, [slices, labels, pieValues, pieColors, effectiveSelectedSlices, textSize, outsideTextSize, zoomLegendMode, lang, formatSharePct]);

    const layout = useMemo(() => ({
        showlegend: false,
        margin: {
            t: zoomLegendMode ? 40 : 50,
            b: zoomLegendMode ? 24 : 40,
            l: windowWidth <= 480 ? 0 : zoomLegendMode ? 16 : 120,
            r: windowWidth <= 480 ? 0 : zoomLegendMode ? 16 : 120,
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        height: windowWidth <= 480 ? 340 : 380,
        clickmode: 'event',
        dragmode: windowWidth <= 768 ? false : 'zoom',
    }), [zoomLegendMode, windowWidth]);

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
            console.warn('Unable to download chart image.', err);
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
        getText('biomass_table_col_year', lang),
        getText('biomass_table_col_category', lang),
        getText('biomass_table_col_share', lang),
    ];

    const tableRows = useMemo(
        () =>
            slices.map((slice) => ({
                year: selectedYear,
                category: getText(PIE_LABEL_KEYS[slice.key], lang),
                share: formatSharePct(slice.pct),
                key: slice.key,
            })),
        [slices, selectedYear, lang, formatSharePct],
    );

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
        if (!isTableOpen) return undefined;
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = bottomScrollRef.current;
        if (!topScroll || !tableScroll || !bottomScroll) return undefined;

        const syncFrom = (source) => {
            if (source !== topScroll && topScroll.scrollLeft !== source.scrollLeft) topScroll.scrollLeft = source.scrollLeft;
            if (source !== tableScroll && tableScroll.scrollLeft !== source.scrollLeft) tableScroll.scrollLeft = source.scrollLeft;
            if (source !== bottomScroll && bottomScroll.scrollLeft !== source.scrollLeft) bottomScroll.scrollLeft = source.scrollLeft;
        };

        const handleTopScroll = () => syncFrom(topScroll);
        const handleTableScroll = () => syncFrom(tableScroll);
        const handleBottomScroll = () => syncFrom(bottomScroll);

        topScroll.addEventListener('scroll', handleTopScroll);
        tableScroll.addEventListener('scroll', handleTableScroll);
        bottomScroll.addEventListener('scroll', handleBottomScroll);
        const observer = new ResizeObserver(() => window.requestAnimationFrame(syncTableScroll));
        const tableElement = tableScroll.querySelector('table');
        if (tableElement) observer.observe(tableElement);
        observer.observe(tableScroll);
        syncTableScroll();

        return () => {
            topScroll.removeEventListener('scroll', handleTopScroll);
            tableScroll.removeEventListener('scroll', handleTableScroll);
            bottomScroll.removeEventListener('scroll', handleBottomScroll);
            observer.disconnect();
        };
    }, [isTableOpen, windowWidth, syncTableScroll]);

    const downloadCsv = () => {
        const header = tableHeaders.map(csvEscape).join(',');
        const rows = tableRows.map((row) => [row.year, row.category, row.share].map(csvEscape).join(','));
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
                children: [String(row.year), row.category, row.share].map((value, index) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: String(value ?? ''), size: 22 })],
                                alignment: index === 1 ? AlignmentType.LEFT : AlignmentType.CENTER,
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
                        children: [new TextRun({ text: stripHtml(substitute(getText('biomass_table_caption', lang), vars)), bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: DOC_COLUMN_WIDTHS,
                        rows: [headerRow, ...dataRows],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), `${fileSlugBase}.docx`);
    };

    const bulletKeys = ['biomass_bullet1', 'biomass_bullet2', 'biomass_bullet3', 'biomass_bullet4'];

    return (
        <main
            tabIndex="-1"
            className="page-content biomass"
            role="main"
            aria-labelledby="biomass-main-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.biomass.page-content { max-width: none !important; overflow-x: visible !important; }
.biomass {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.biomass-container { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.biomass-title {
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
.biomass-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.biomass-split {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    gap: 24px;
    align-items: start;
}
.biomass-split.is-stacked { grid-template-columns: 1fr; }
.biomass-left { min-width: 0; }
.biomass-right { min-width: 0; }
.biomass-bullets {
    margin: 0;
    padding-left: 1.25em;
    font-family: var(--font-body);
    font-size: clamp(16px, 1.8vw, 18px);
    color: var(--gc-text);
    line-height: 1.55;
}
.biomass-bullets li { margin-bottom: 3.9em; }
.biomass-bullets li:last-child { margin-bottom: 0; }
.biomass-split.is-stacked .biomass-bullets li { margin-bottom: 0.85em; }
.biomass-split.is-stacked .biomass-bullets li:last-child { margin-bottom: 0; }
.biomass-infographic {
    position: relative;
    width: 100%;
    container-type: inline-size;
    container-name: biomass-infographic;
}
.biomass-infographic-bg {
    width: 100%;
    height: auto;
    display: block;
}
.biomass-infographic .fn-lnk.biomass-infographic-fn {
    /* Scale with the SVG so gaps stay proportional at browser zoom */
    min-width: 4.2cqw;
    width: 4.2cqw;
    height: 4.2cqw;
    padding: 0;
    font-size: 2.7cqw;
    line-height: 1;
    box-sizing: border-box;
    z-index: 2;
    transform: translateY(-50%);
}
.biomass-infographic-figure { margin: 0 0 16px 0; }
.biomass-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: clamp(18px, 2.2vw, 22px);
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 12px 0;
    text-transform: none;
}
.biomass-chart-frame {
    background-color: #f5f5f5;
    padding: 16px;
    border-radius: 8px;
    box-sizing: border-box;
    overflow: visible;
}
.biomass-clear-selection {
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
.biomass-donut-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    min-height: 340px;
}
.biomass-donut-figure {
    width: 100%;
    max-width: 720px;
    min-width: 280px;
    min-height: 320px;
    height: 380px;
    margin: 0;
    position: relative;
}
.biomass-custom-legend {
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
.biomass-custom-legend-item { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.biomass-custom-legend-swatch {
    width: 12px;
    height: 12px;
    display: inline-block;
    border-radius: 2px;
    border: 1px solid rgba(0, 0, 0, 0.15);
}
.biomass-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.biomass-chart-frame details > summary:hover,
.biomass-chart-frame button:hover,
.biomass-download-buttons button:hover { background-color: #404040 !important; }
.biomass-data-table { margin-top: 12px; margin-bottom: 0; width: 100%; }
.biomass-data-table > summary {
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
.biomass-data-table > summary::-webkit-details-marker { display: none; }
.biomass-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.biomass-table-scrollbar > div { height: 20px; }
.biomass-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #dee2e6;
    background: #fff;
    margin-top: 12px;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.biomass-table-responsive::-webkit-scrollbar { display: none; }
.biomass-table-responsive table { width: max-content !important; min-width: 100%; border-collapse: collapse; font-size: 14px; }
.biomass-table-responsive th,
.biomass-table-responsive td {
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
.biomass-table-responsive thead th,
.biomass-table-responsive tbody th {
    font-weight: 700;
}
.biomass-table-responsive thead th {
    vertical-align: bottom;
}
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
    .biomass-title { font-size: 37px; }
    .biomass-donut-figure { height: 340px; min-height: 340px; }
}
            `}</style>

            <div className="biomass-container">
                <header>
                    <h1 id="biomass-main-title" className="biomass-title">
                        {getText('biomass_title', lang)}
                    </h1>
                </header>

                <div className={`biomass-split${stackedLayout ? ' is-stacked' : ''}`}>
                    <div className="biomass-left">
                        <ul className="biomass-bullets">
                            {bulletKeys.map((key) => (
                                <li key={key} dangerouslySetInnerHTML={{ __html: getText(key, lang) }} />
                            ))}
                        </ul>
                    </div>

                    <div className="biomass-right">
                        <BiomassInfographic
                            lang={lang}
                            scrollToElement={scrollToElement}
                            ariaLabel={getText('biomass_infographic_aria', lang)}
                        />

                        <div className="biomass-chart-frame">
                            <h2 className="biomass-chart-title wb-inv">{chartTitle}</h2>
                            {effectiveSelectedSlices?.length > 0 && (
                                <button
                                    type="button"
                                    className="biomass-clear-selection"
                                    onClick={() => setSelectedSlices(null)}
                                >
                                    {getText('biomass_clear_selection', lang)}
                                </button>
                            )}
                            <div className="biomass-donut-wrap" ref={chartRef}>
                                <figure className="biomass-donut-figure" role="region" aria-label={chartTitle}>
                                    <Plot
                                        key={`biomass-${selectedYear}-${zoomLegendMode ? 'compact' : 'wide'}-${effectiveSelectedSlices ? effectiveSelectedSlices.join('-') : 'none'}`}
                                        data={plotData}
                                        layout={layout}
                                        config={plotConfig}
                                        style={{ width: '100%', minWidth: 280, minHeight: 320, height: '100%' }}
                                        useResizeHandler
                                        onClick={(eventData) => {
                                            if (!eventData.points?.length) return;
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
                                    <div className="biomass-custom-legend" aria-label={lang === 'en' ? 'Chart legend' : 'Légende du graphique'}>
                                        {slices.map((slice) => (
                                            <span key={slice.key} className="biomass-custom-legend-item">
                                                <span
                                                    className="biomass-custom-legend-swatch"
                                                    style={{ backgroundColor: PIE_COLORS[slice.key] }}
                                                    aria-hidden="true"
                                                />
                                                <span>{getText(PIE_LABEL_KEYS[slice.key], lang)}</span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <details className="biomass-data-table" open={isTableOpen} onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                                <summary role="button" aria-expanded={isTableOpen}>
                                    <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                    {getText('biomass_table_summary', lang)}
                                    <span className="wb-inv">
                                        {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                    </span>
                                </summary>
                                <div ref={topScrollRef} className="biomass-table-scrollbar" aria-hidden="true"><div /></div>
                                <div
                                    ref={tableScrollRef}
                                    className="biomass-table-responsive table-responsive"
                                    role="region"
                                    aria-label={getText('biomass_table_summary', lang)}
                                    tabIndex={0}
                                >
                                    <table className="table table-bordered table-striped table-hover">
                                        <caption className="wb-inv">{substitute(getText('biomass_table_caption', lang), vars)}</caption>
                                        <thead>
                                            <tr>
                                                {tableHeaders.map((header) => (
                                                    <th key={header} scope="col" style={{ textAlign: 'center' }}>
                                                        {header}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tableRows.map((row) => (
                                                <tr key={row.key}>
                                                    <td style={{ textAlign: 'center' }}>{row.year}</td>
                                                    <th scope="row">{row.category}</th>
                                                    <td style={{ textAlign: 'center' }}>{row.share}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div ref={bottomScrollRef} className="biomass-table-scrollbar" aria-hidden="true"><div /></div>
                                <div className="biomass-download-buttons">
                                    <button type="button" onClick={downloadCsv} style={downloadBtnStyle}>
                                        {getText('biomass_download_csv', lang)}
                                    </button>
                                    <button type="button" onClick={downloadDocx} style={downloadBtnStyle}>
                                        {getText('biomass_download_docx', lang)}
                                    </button>
                                </div>
                            </details>
                        </div>
                    </div>
                </div>

                <aside className="wb-fnote" role="note">
                    <h2 id="fn-biomass">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</dt>
                        <dt>{lang === 'en' ? 'Footnote 1' : 'Note de bas de page 1'}</dt>
                        <dd id={biomassFnDefId(1)}>
                            <a
                                href={`#${biomassFnRefId(1)}`}
                                onClick={scrollToElement(biomassFnRefId(1))}
                                className="fn-num"
                                title={lang === 'en' ? 'Return to footnote 1 referrer' : 'Retour à la référence de la note de bas de page 1'}
                            >
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>
                                1
                            </a>
                            <p>{getText('biomass_footnote1', lang)}</p>
                        </dd>
                        <dt>{lang === 'en' ? 'Footnote 2' : 'Note de bas de page 2'}</dt>
                        <dd id={biomassFnDefId(2)}>
                            <a
                                href={`#${biomassFnRefId(2)}`}
                                onClick={scrollToElement(biomassFnRefId(2))}
                                className="fn-num"
                                title={lang === 'en' ? 'Return to footnote 2 referrer' : 'Retour à la référence de la note de bas de page 2'}
                            >
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>
                                2
                            </a>
                            <p>{getText('biomass_footnote2', lang)}</p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Biomass;
