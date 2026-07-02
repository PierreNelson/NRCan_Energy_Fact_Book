import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getWorldProvedCrudeReservesData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import Page109WorldReservesInfographic from '../components/Page109WorldReservesInfographic';
import {
    COUNTRY_LABEL_KEYS,
    COUNTRY_LABEL_FONT,
    exportWorldReservesChartPng,
    HEADLINE_FONT,
    HEADLINE_FONT_MOBILE,
    HEADLINE_SLOT,
    HEADLINE_YEAR_FONT,
    HEADLINE_YEAR_FONT_MOBILE,
    PIE_PERCENT_FONT,
    SLICE_COLORS,
    SLICE_KEYS,
} from '../components/Page109WorldReservesInfographic.constants';

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (value, key) => value.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '–')),
        text || '',
    );

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    }
    return hex;
};

const Page109 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const chartRef = useRef(null);
    const infographicFigureRef = useRef(null);
    const tableTopRef = useRef(null);
    const tableScrollRef = useRef(null);
    const tableBottomRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const formatNumber = (value, digits = 0) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    };

    const formatPct = (value, digits = 0) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return `${Number(value).toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
    };

    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const scrollToElement = (id) => (event) => {
        event?.preventDefault();
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    useEffect(() => {
        getWorldProvedCrudeReservesData()
            .then((data) => {
                setResult(data);
                setSelectedYear(data?.reportingYear ?? data?.years?.[0] ?? null);
            })
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
    }, [isTableOpen, windowWidth, syncTableScroll, result, selectedYear]);

    useEffect(() => {
        if (!chartRef.current) return;
        const setupChartAccessibility = () => {
            const plotContainer = chartRef.current;
            if (!plotContainer) return;
            plotContainer.querySelectorAll('.main-svg, .svg-container svg').forEach((svg) => {
                svg.setAttribute('aria-hidden', 'true');
            });
            plotContainer.querySelectorAll('.plot-container, .svg-container, .js-plotly-plot, .main-svg, .hoverlayer').forEach((el) => {
                el.style.overflow = 'visible';
            });
            plotContainer.querySelectorAll('.modebar-btn').forEach((btn) => {
                const dataTitle = btn.getAttribute('data-title');
                if (dataTitle && (dataTitle.includes('Download') || /charger/i.test(dataTitle))) {
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
    }, [result, lang, selectedSlices, selectedYear]);

    const yearData = useMemo(() => {
        if (!result) return null;
        if (selectedYear != null && result.byYear?.[selectedYear]) return result.byYear[selectedYear];
        return {
            reportingYear: result.reportingYear,
            totalBb: result.totalBb,
            oilSandsSharePct: result.oilSandsSharePct,
            slices: result.slices,
        };
    }, [result, selectedYear]);

    const year = yearData?.reportingYear ?? selectedYear ?? '–';
    const textVars = { year, total: formatNumber(yearData?.totalBb, 0) };
    const chartTitle = substitute(getText('page109_chart_title', lang), textVars);
    const downloadTitle = substitute(getText('page109_download_title', lang), textVars)
        .replace(/\s+/g, '_')
        .replace(/–/g, '-');
    const exportSlug = `${getText('page109_export_slug', lang)}_${year}`;

    const slices = useMemo(() => {
        if (!yearData?.slices?.length) return [];
        return SLICE_KEYS.map((key) => yearData.slices.find((slice) => slice.key === key)).filter(Boolean);
    }, [yearData]);

    const chartLegendItems = useMemo(
        () => slices.map((slice) => ({
            key: slice.key,
            label: `${getText(COUNTRY_LABEL_KEYS[slice.key], lang)}${slice.key === 'saudi' ? '*' : ''}`,
            color: SLICE_COLORS[slice.key],
            share: formatPct(slice.sharePct, 0),
        })),
        [slices, lang],
    );

    const effectiveSlices = windowWidth > 768 ? selectedSlices : null;
    const pieValues = slices.map((slice) => (slice.sharePct > 0 ? slice.sharePct : 0.001));
    const baseColors = slices.map((slice) => SLICE_COLORS[slice.key]);
    const pieColors = effectiveSlices?.length
        ? baseColors.map((color, index) => (effectiveSlices.includes(index) ? color : hexToRgba(color, 0.3)))
        : baseColors;
    const textSize = windowWidth <= 480
        ? PIE_PERCENT_FONT.mobile
        : windowWidth <= 768
            ? PIE_PERCENT_FONT.tablet
            : PIE_PERCENT_FONT.desktop;
    const labelFontSize = windowWidth <= 480
        ? COUNTRY_LABEL_FONT.mobile
        : windowWidth <= 768
            ? COUNTRY_LABEL_FONT.tablet
            : COUNTRY_LABEL_FONT.desktop;

    const pieTrace = slices.length
        ? {
            type: 'pie',
            values: pieValues,
            labels: slices.map(() => ''),
            direction: 'clockwise',
            rotation: 135,
            sort: false,
            texttemplate: '%{percent:.0%}',
            textinfo: 'percent',
            textposition: 'inside',
            textfont: {
                size: textSize,
                family: 'Arial, sans-serif',
                color: slices.map((slice) => (slice.key === 'canada' ? '#ffffff' : '#333333')),
            },
            marker: { colors: pieColors, line: { color: '#ffffff', width: 1 } },
            pull: effectiveSlices?.length
                ? pieValues.map((_, index) => (effectiveSlices.includes(index) ? 0.08 : 0.02))
                : pieValues.map(() => 0.02),
            hovertext: slices.map(
                (slice) => `<b>${getText(COUNTRY_LABEL_KEYS[slice.key], lang)}</b><br>${formatNumber(slice.valueBb, 0)} Bb<br>${formatPct(slice.sharePct, 0)}`,
            ),
            hoverinfo: 'text',
            hoverlabel: { bgcolor: '#ffffff', font: { color: '#333333', size: 14, family: 'Arial, sans-serif' } },
            automargin: false,
        }
        : null;

    const pieLayout = {
        showlegend: false,
        margin: { t: 2, b: 2, l: 2, r: 2 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        autosize: true,
        clickmode: 'event',
        dragmode: windowWidth <= 768 ? false : 'zoom',
    };

    const downloadChartPng = async () => {
        const plotEl = chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotEl) return;
        try {
            const canvas = await exportWorldReservesChartPng(plotEl, {
                chartTitle,
                legendItems: chartLegendItems,
            });
            if (!canvas) return;
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `${downloadTitle}.png`;
            link.click();
        } catch (err) {
            console.warn('Unable to download chart image.', err);
        }
    };

    const pieConfig = {
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d', 'toImage'],
        modeBarButtonsToAdd: [{
            name: getText('page109_download_chart', lang),
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: downloadChartPng,
        }],
    };

    const tableHeaders = [
        getText('page109_table_col_year', lang),
        getText('page109_table_col_country', lang),
        getText('page109_table_col_reserves', lang),
        getText('page109_table_col_share', lang),
    ];

    const tableRows = useMemo(() => {
        if (!result?.byYear || !result.years?.length) return [];
        return result.years.flatMap((dataYear) => {
            const bucket = result.byYear[dataYear];
            const ordered = SLICE_KEYS.map((key) => bucket.slices.find((slice) => slice.key === key)).filter(Boolean);
            return ordered.map((slice, index) => ({
                year: index === 0 ? dataYear : '',
                country: getText(COUNTRY_LABEL_KEYS[slice.key], lang),
                reserves: slice.valueBb,
                share: slice.sharePct,
            }));
        });
    }, [result, lang]);

    const downloadTableCSV = () => {
        if (!tableRows.length) return;
        const rows = tableRows.map((row) => [
            row.year,
            row.country,
            row.reserves != null ? formatNumber(row.reserves, 0) : '',
            row.share != null ? Number(row.share).toFixed(0) : '',
        ]);
        const csv = [tableHeaders.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${exportSlug}.csv`);
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
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row.country, size: 18 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row.reserves != null ? formatNumber(row.reserves, 0) : '—', size: 18 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row.share != null ? Number(row.share).toFixed(0) : '—', size: 18 })], alignment: AlignmentType.RIGHT })] }),
            ],
        }));
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: chartTitle, bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [900, 4800, 1600, 1400],
                        rows: [headerRow, ...rows],
                    }),
                ],
            }],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${exportSlug}.docx`);
    };

    const infographicAria = substitute(getText('page109_chart_aria', lang), textVars);

    const headlineValue = substitute(getText('page109_headline_value', lang), textVars);
    const headlineBarrelsWord = getText('page109_headline_barrels_word', lang);
    const headlineYear = substitute(getText('page109_headline_year', lang), textVars);
    const oilSandsPct = formatPct(yearData?.oilSandsSharePct, 0);

    const handlePieClick = (data) => {
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
    };

    if (loading) return <p>{lang === 'en' ? 'Loading...' : 'Chargement...'}</p>;
    if (error) return <p>{error}</p>;
    if (!yearData || !slices.length) return <p>{getText('page109_no_data', lang)}</p>;

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-109"
            role="main"
            aria-labelledby="page109-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-109 {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.page109-container {
    width: 100%;
    padding: 15px 0 40px 0;
    box-sizing: border-box;
}
.page109-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 20px 0;
    line-height: 1.25;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: none;
}
.page109-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.page109-infographic-section {
    overflow: visible;
    position: relative;
}
.page-109 p.page109-headline-on-art {
    position: absolute;
    z-index: 3;
    margin: 0;
    padding: 0;
    font-family: 'Lato', sans-serif;
    font-weight: bold;
    font-size: ${HEADLINE_FONT};
    line-height: 1.2;
    text-align: left;
    pointer-events: none;
}
.page-109 p.page109-headline-on-art .page109-headline-on-art-year {
    display: block;
    font-weight: bold;
    font-size: ${HEADLINE_YEAR_FONT};
    margin-top: 0;
    color: #000000;
}
.page-109 p.page109-headline-on-art .page109-headline-on-art-value {
    color: #50809a;
}
.page-109 p.page109-headline-on-art .page109-headline-on-art-barrels {
    color: #000000;
}
.page109-chart-host {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: visible;
}
.page109-chart-host > div {
    width: 100%;
    height: 100%;
    overflow: visible;
}
.page109-chart-host .js-plotly-plot,
.page109-chart-host .plot-container,
.page109-chart-host .svg-container {
    overflow: visible !important;
}
.page109-table-wrapper { margin-top: 24px; }
.page109-table-wrapper details > summary {
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
    margin-bottom: 8px;
}
.page109-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page109-table-wrapper details > summary::marker { content: ''; }
.page109-table-wrapper details > summary:hover { background-color: #404040; }
.page109-table-scrollbar {
    overflow-x: auto;
    overflow-y: hidden;
    height: 20px;
    margin-bottom: 4px;
}
.page109-table-scrollbar > div { height: 20px; }
.page109-table-responsive {
    overflow-x: auto;
    width: 100%;
    border: 1px solid #ddd;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.page109-table-responsive::-webkit-scrollbar { display: none; }
.page109-table-responsive table {
    width: max-content !important;
    min-width: 100%;
    border-collapse: collapse;
}
.page109-table-responsive th,
.page109-table-responsive td {
    white-space: nowrap;
    padding: 8px 12px;
    font-family: Arial, sans-serif;
    border: 1px solid #ddd;
}
.page109-download-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 12px;
}
.page109-download-buttons button {
    padding: 8px 16px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
    font-size: 14px;
}
.page109-footnotes {
    margin-top: 28px;
    font-size: 0.95rem;
}
.page109-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 1rem;
}
.page109-footnotes dd {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-left: 0;
    margin-bottom: 1rem;
}
@media (max-width: 768px) {
    .page109-title { font-size: 37px; }
    .page-109 p.page109-headline-on-art { font-size: ${HEADLINE_FONT_MOBILE}; }
    .page-109 p.page109-headline-on-art .page109-headline-on-art-year { font-size: ${HEADLINE_YEAR_FONT_MOBILE}; }
}
            `}</style>

            <div className="page109-container">
                <h1 id="page109-title" className="page109-title">{getText('page109_title', lang)}</h1>

                <div className="page109-infographic-section">
                    <p
                        className="page109-headline-on-art"
                        aria-hidden="true"
                        style={{
                            left: `${HEADLINE_SLOT.left}%`,
                            top: `${HEADLINE_SLOT.top}%`,
                        }}
                    >
                        <span className="page109-headline-on-art-value">{headlineValue}</span>
                        {' '}
                        <span className="page109-headline-on-art-barrels">{headlineBarrelsWord}</span>
                        <span className="page109-headline-on-art-year">{headlineYear}</span>
                    </p>
                    <Page109WorldReservesInfographic
                        figureRef={infographicFigureRef}
                        lang={lang}
                        oilSandsPct={oilSandsPct}
                        oilSandsText={getText('page109_oil_sands_text', lang)}
                        slices={slices}
                        labelFontSize={labelFontSize}
                        getText={getText}
                        onFootnoteClick={scrollToElement}
                        ariaLabel={infographicAria}
                        showClearSelection={effectiveSlices?.length > 0}
                        onClearSelection={() => setSelectedSlices(null)}
                        pieChart={(
                            <div ref={chartRef} className="page109-chart-host" role="img" aria-label={infographicAria}>
                                {pieTrace && (
                                    <Plot
                                        key={`page109-pie-${year}-${effectiveSlices ? effectiveSlices.join('-') : 'none'}`}
                                        data={[pieTrace]}
                                        layout={pieLayout}
                                        config={pieConfig}
                                        style={{ width: '100%', height: '100%' }}
                                        useResizeHandler
                                        onClick={handlePieClick}
                                    />
                                )}
                            </div>
                        )}
                    />
                </div>

                <div className="page109-table-wrapper">
                    <details className="page109-data-table" onToggle={(event) => setIsTableOpen(event.currentTarget.open)}>
                        <summary role="button" aria-expanded={isTableOpen}>
                            <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                            {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                            <span className="wb-inv">
                                {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                            </span>
                        </summary>
                        <div ref={tableTopRef} className="page109-table-scrollbar" aria-hidden="true"><div /></div>
                        <div ref={tableScrollRef} className="page109-table-responsive" role="region" aria-labelledby="page109-table-caption" tabIndex={0}>
                            <table className="table table-striped table-hover">
                                <caption id="page109-table-caption" className="wb-inv">{getText('page109_table_caption', lang)}</caption>
                                <thead>
                                    <tr>
                                        {tableHeaders.map((header) => <th key={header} scope="col">{header}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableRows.map((row, index) => (
                                        <tr key={`${row.country}-${row.year}-${index}`}>
                                            <th scope="row">{row.year}</th>
                                            <td>{row.country}</td>
                                            <td style={{ textAlign: 'right' }}>{row.reserves != null ? formatNumber(row.reserves, 0) : '—'}</td>
                                            <td style={{ textAlign: 'right' }}>{row.share != null ? formatPct(row.share, 0) : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div ref={tableBottomRef} className="page109-table-scrollbar" aria-hidden="true"><div /></div>
                        <div className="page109-download-buttons">
                            <button type="button" onClick={downloadTableCSV}>{getText('page109_download_csv', lang)}</button>
                            <button type="button" onClick={downloadTableDocx}>{getText('page109_download_docx', lang)}</button>
                        </div>
                    </details>
                </div>

                <aside className="wb-fnote page109-footnotes" role="note">
                    <h2 id="fn">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnote' : 'Note de bas de page'}</dt>
                        <dd id="fn-saudi-page109">
                            <a href="#fn-saudi-rf-page109" onClick={scrollToElement('fn-saudi-rf-page109')} className="fn-num" title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}>
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote' : 'Retour à la note de bas de page'}</span>*
                            </a>
                            <p>{getText('page109_footnote_saudi', lang)}</p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page109;
