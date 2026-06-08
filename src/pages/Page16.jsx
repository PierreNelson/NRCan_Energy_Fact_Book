import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const PAGE16_YEARS = [2011, 2013, 2015, 2017, 2019, 2021, 2023];
const PAGE16_CATEGORIES = ['land_sales', 'income_taxes', 'royalties'];

const PAGE16_DONUT = { land_sales: 0.4, income_taxes: 6.9, royalties: 17.2 };
const PAGE16_TOTAL = 24.4;

const PAGE16_TABLE_DATA = [
    { year: 2011, land_sales: 0.2, income_taxes: 3.5, royalties: 12.0 },
    { year: 2013, land_sales: 0.2, income_taxes: 4.0, royalties: 14.0 },
    { year: 2015, land_sales: 0.2, income_taxes: 3.0, royalties: 11.0 },
    { year: 2017, land_sales: 0.3, income_taxes: 4.5, royalties: 15.0 },
    { year: 2019, land_sales: 0.4, income_taxes: 5.5, royalties: 16.0 },
    { year: 2021, land_sales: 0.4, income_taxes: 7.0, royalties: 18.0 },
    { year: 2023, land_sales: 0.5, income_taxes: 9.0, royalties: 22.0 }
];

const PAGE16_COLORS = { land_sales: '#689F38', income_taxes: '#3CA1AF', royalties: '#7A6F4E' };

const formatPage16Number = (num, lang) => {
    if (num === undefined || num === null) return '—';
    return Number(num).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
};

const Page16 = () => {
    const { lang } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const chartRef = useRef(null);
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const lastClickRef = useRef({ time: 0, index: null });

    const hexToRgba = (hex, opacity = 1) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
        return hex;
    };

    const scrollToFootnote = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-page16')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const scrollToRef = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-rf-page16')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const stripHtml = (text) => text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;
        if (!topScroll || !tableScroll) return;
        const syncScrollbars = () => {
            const table = tableScroll.querySelector('table');
            if (!table) return;
            const scrollWidth = table.offsetWidth;
            const containerWidth = tableScroll.clientWidth;
            const topSpacer = topScroll.firstElementChild;
            if (topSpacer) topSpacer.style.width = `${scrollWidth}px`;
            if (scrollWidth > containerWidth) {
                topScroll.style.display = 'block';
                topScroll.style.opacity = '1';
            } else {
                topScroll.style.display = 'none';
            }
        };
        const handleTopScroll = () => { if (tableScroll.scrollLeft !== topScroll.scrollLeft) tableScroll.scrollLeft = topScroll.scrollLeft; };
        const handleTableScroll = () => { if (topScroll.scrollLeft !== tableScroll.scrollLeft) topScroll.scrollLeft = tableScroll.scrollLeft; };
        topScroll.addEventListener('scroll', handleTopScroll);
        tableScroll.addEventListener('scroll', handleTableScroll);
        const observer = new ResizeObserver(() => window.requestAnimationFrame(syncScrollbars));
        const tableEl = tableScroll.querySelector('table');
        if (tableEl) observer.observe(tableEl);
        observer.observe(tableScroll);
        syncScrollbars();
        return () => {
            topScroll.removeEventListener('scroll', handleTopScroll);
            tableScroll.removeEventListener('scroll', handleTableScroll);
            observer.disconnect();
        };
    }, [isTableOpen, windowWidth]);

    useEffect(() => {
        if (!chartRef?.current) return;
        const plotContainer = chartRef.current;
        const svgElements = plotContainer.querySelectorAll('.main-svg, .svg-container svg');
        svgElements.forEach(svg => svg.setAttribute('aria-hidden', 'true'));
        const modebarButtons = plotContainer.querySelectorAll('.modebar-btn');
        modebarButtons.forEach(btn => {
            const dataTitle = btn.getAttribute('data-title');
            if (dataTitle && (dataTitle.includes('Download') || dataTitle.includes('Télécharger'))) {
                btn.setAttribute('aria-label', dataTitle);
                btn.setAttribute('role', 'button');
                btn.setAttribute('tabindex', '0');
                btn.removeAttribute('aria-hidden');
            } else {
                btn.setAttribute('aria-hidden', 'true');
                btn.setAttribute('tabindex', '-1');
            }
        });
    }, [lang]);

    const donutLabels = useMemo(() => PAGE16_CATEGORIES.map(k => getText('page16_' + k, lang)), [lang]);
    const donutValues = useMemo(() => PAGE16_CATEGORIES.map(k => PAGE16_DONUT[k]), []);
    const totalFormatted = useMemo(() => lang === 'en' ? `$${PAGE16_TOTAL}` : `${PAGE16_TOTAL.toLocaleString('fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} $`, [lang]);

    const pieData = useMemo(() => {
        const hovertext = PAGE16_CATEGORIES.map((k, i) => {
            const v = donutValues[i];
            const pct = Math.round((v / PAGE16_TOTAL) * 100);
            return `${donutLabels[i]}: ${formatPage16Number(v, lang)} ${getText('page16_table_uom', lang)}, ${pct}%`;
        });
        const colors = PAGE16_CATEGORIES.map(k => PAGE16_COLORS[k]);
        const textColors = selectedSlices === null
            ? colors
            : colors.map((c, i) => selectedSlices.includes(i) ? c : hexToRgba(c, 0.3));
        const markerColors = selectedSlices === null
            ? colors
            : colors.map((c, i) => selectedSlices.includes(i) ? c : hexToRgba(c, 0.3));
        const useCompactLayout = windowWidth <= 768;
        const pullValues = selectedSlices === null
            ? donutValues.map(() => 0.02)
            : donutValues.map((_, i) => selectedSlices.includes(i) ? 0.08 : 0.02);
        const texttemplate = useCompactLayout ? '%{percent:.0%}' : (lang === 'en' ? '%{label}<br>$%{value:.1f}, %{percent:.0%}' : '%{label}<br>%{value:.1f} $, %{percent:.0%}');
        return [{
            type: 'pie',
            values: donutValues,
            labels: donutLabels,
            hole: 0.5,
            direction: 'clockwise',
            sort: false,
            texttemplate,
            textinfo: useCompactLayout ? 'percent' : 'label+value+percent',
            textposition: useCompactLayout ? 'inside' : 'outside',
            textfont: {
                size: windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18,
                family: 'Arial, sans-serif',
                color: useCompactLayout ? '#ffffff' : textColors
            },
            outsidetextfont: {
                size: windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18,
                family: 'Arial, sans-serif',
                color: textColors
            },
            insidetextfont: { color: '#ffffff', size: windowWidth <= 480 ? 10 : 12, family: 'Arial, sans-serif' },
            hoverinfo: 'text',
            hovertext: hovertext,
            hoverlabel: {
                bgcolor: '#ffffff',
                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' }
            },
            marker: {
                colors: markerColors,
                line: { color: '#ffffff', width: 2 }
            },
            pull: pullValues
        }];
    }, [lang, donutLabels, donutValues, windowWidth, selectedSlices]);

    const plotLayout = useMemo(() => {
        const compact = windowWidth <= 768;
        const margin = compact
            ? (windowWidth <= 384 ? { l: 0, r: 0, t: 10, b: 80 } : windowWidth <= 480 ? { l: 0, r: 0, t: 10, b: 70 } : windowWidth <= 640 ? { l: 0, r: 0, t: 10, b: 60 } : { l: 0, r: 0, t: 10, b: 10 })
            : { l: 40, r: 40, t: 80, b: 80 };
        const legendConfig = compact ? (
            windowWidth <= 384 ? { orientation: 'h', y: -0.50, x: 0.5, xanchor: 'center', yanchor: 'top', font: { size: 9 }, itemclick: false, itemdoubleclick: false }
            : windowWidth <= 480 ? { orientation: 'h', y: -0.15, x: 0.5, xanchor: 'center', yanchor: 'top', font: { size: 9 }, itemclick: false, itemdoubleclick: false }
            : windowWidth <= 640 ? { orientation: 'h', y: -0.15, x: 0.6, xanchor: 'center', yanchor: 'top', font: { size: 10 }, itemclick: false, itemdoubleclick: false }
            : { orientation: 'v', y: 0.5, x: 1.05, xanchor: 'left', yanchor: 'middle', font: { size: 10 }, itemclick: false, itemdoubleclick: false }
        ) : undefined;
        return {
            showlegend: compact,
            legend: legendConfig,
            margin,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            autosize: true,
            clickmode: 'event',
            annotations: [
                { x: 0.5, y: 0.55, text: getText('page16_total_label', lang), showarrow: false, font: { size: 14, family: 'Arial, sans-serif', color: 'var(--gc-text, #333)' } },
                { x: 0.5, y: 0.45, text: totalFormatted, showarrow: false, font: { size: 22, family: 'Arial, sans-serif', color: 'var(--gc-text, #333)' } }
            ]
        };
    }, [lang, totalFormatted, windowWidth]);

    const config = {
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d', 'toImage'],
        modeBarButtonsToAdd: [{
            name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: () => downloadChartWithTitle()
        }]
    };

    const downloadChartWithTitle = async () => {
        const plotElement = chartRef?.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        try {
            const title = stripHtml(getText('page16_chart_title', lang));
            const imgData = await window.Plotly.toImage(plotElement, { format: 'png', width: 800, height: 500, scale: 2 });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                const titleHeight = 50;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, canvas.width / 2, 35);
                ctx.drawImage(img, 0, titleHeight);
                const link = document.createElement('a');
                link.download = lang === 'en' ? 'government_energy_revenue.png' : 'recettes_publiques_energie.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            };
            img.src = imgData;
        } catch (e) {
            console.error(e);
        }
    };

    const downloadTableAsCSV = () => {
        const headers = [lang === 'en' ? 'Year' : 'Année', ...PAGE16_CATEGORIES.map(k => getText('page16_' + k, lang)), lang === 'en' ? 'Total' : 'Total', ...PAGE16_CATEGORIES.map(k => getText('page16_' + k, lang) + ' %')];
        const rows = PAGE16_TABLE_DATA.map(row => {
            const vals = PAGE16_CATEGORIES.map(k => row[k]);
            const total = vals.reduce((a, b) => a + b, 0);
            const pcts = total > 0 ? vals.map(v => formatPage16Number((v / total) * 100, lang)) : vals.map(() => '0');
            return [row.year, ...vals.map(v => formatPage16Number(v, lang)), formatPage16Number(total, lang), ...pcts];
        });
        const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'government_revenues.csv' : 'recettes_publiques.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadTableAsDocx = async () => {
        const title = stripHtml(getText('page16_title', lang));
        const uom = getText('page16_table_uom', lang);
        const headerRow1 = [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: lang === 'en' ? 'Year' : 'Année', bold: true, size: 22 })], alignment: AlignmentType.CENTER })], shading: { fill: 'E6E6E6' }, rowSpan: 2 }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: uom, bold: true, size: 22 })], alignment: AlignmentType.CENTER })], shading: { fill: 'E6E6E6' }, columnSpan: 4 }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '%', bold: true, size: 22 })], alignment: AlignmentType.CENTER })], shading: { fill: 'E6E6E6' }, columnSpan: 3 })
        ];
        const catCells = PAGE16_CATEGORIES.map(k =>
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: getText('page16_' + k, lang), bold: true, size: 22 })], alignment: AlignmentType.CENTER })], shading: { fill: 'E6E6E6' } })
        );
        const totalCell = new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: lang === 'en' ? 'Total' : 'Total', bold: true, size: 22 })], alignment: AlignmentType.CENTER })], shading: { fill: 'E6E6E6' } });
        const headerRow2 = new TableRow({ children: [...catCells, totalCell, ...catCells] });
        const dataRows = PAGE16_TABLE_DATA.map(row => {
            const vals = PAGE16_CATEGORIES.map(k => row[k]);
            const total = vals.reduce((a, b) => a + b, 0);
            const pcts = total > 0 ? vals.map(v => formatPage16Number((v / total) * 100, lang)) : vals.map(() => '0');
            const cells = [row.year, ...vals.map(v => formatPage16Number(v, lang)), formatPage16Number(total, lang), ...pcts].map((text) =>
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(text), size: 22 })], alignment: AlignmentType.CENTER })] })
            );
            return new TableRow({ children: cells });
        });
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [1000, 1400, 1400, 1400, 1200, 1000, 1000, 1000], rows: [new TableRow({ children: headerRow1 }), headerRow2, ...dataRows] })
                ]
            }]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'government_revenues.docx' : 'recettes_publiques.docx');
    };

    const getChartSummary = () => {
        const parts = PAGE16_CATEGORIES.map((k, i) => `${donutLabels[i]}: ${formatPage16Number(donutValues[i], lang)} ${getText('page16_table_uom', lang)}`).join(', ');
        return `${stripHtml(getText('page16_chart_title', lang))}. ${getText('page16_total_label', lang)}: ${totalFormatted}. ${parts}.`;
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-16"
            role="main"
            aria-labelledby="page16-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-16 { width: 100%; }
.page16-container { width: 100%; display: flex; flex-direction: column; min-height: 100%; box-sizing: border-box; }
.page16-header { padding-top: 20px; padding-bottom: 20px; }
.page16-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 25px;
    line-height: 1.2;
    position: relative;
    padding-bottom: 0.5em;
}
.page16-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.page16-intro {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 20px;
}
.page16-content-row {
    display: flex;
    flex-direction: row;
    flex: 1;
    width: 100%;
    overflow: visible;
    gap: 40px;
}
.page16-chart-column { width: 55%; }
.page16-text-column {
    width: 45%;
    padding-top: 30px;
    padding-left: 30px;
    padding-right: 0;
    box-sizing: border-box;
    min-width: 300px;
}
.page16-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-sizing: border-box;
}
.page16-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    line-height: 1.2;
    margin: 0 0 15px 0;
    text-align: center;
}
.page16-chart { width: 100%; height: 340px; }
.page16-chart button[type="button"]:hover,
.page16-chart button:hover,
.page16-chart-frame button[type="button"]:hover,
.page16-chart-frame button:hover { background-color: #404040 !important; }
.page16-bullet {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
    margin-bottom: 15px;
}
.page16-table-wrapper { display: block; width: 100%; margin: 20px 0 0 0; }
.page16-table-wrapper details > summary {
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
.page16-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page16-table-wrapper details > summary:hover { background-color: #404040 !important; }
.page16-table-wrapper button[type="button"]:hover,
.page16-table-wrapper button:hover { background-color: #404040 !important; }
.page16-table-wrapper .table-responsive { display: block; width: 100%; overflow-x: auto; border: 1px solid #ddd; background: #fff; }
.page16-table-wrapper .table-responsive table { width: max-content; min-width: 100%; border-collapse: collapse; }
.page16-footnote {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--gc-text);
    margin-top: 2rem;
    margin-bottom: 0;
}
.layout-stacked { flex-direction: column !important; height: auto !important; align-items: center !important; }
.layout-stacked .page16-chart-column { width: 100% !important; margin-bottom: 30px !important; overflow: visible !important; }
.layout-stacked .page16-text-column { width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; padding-top: 0 !important; margin-top: 20px !important; }
@media (max-width: 1400px) {
    .page16-content-row { flex-direction: column; }
    .page16-chart-column { width: 100%; margin-bottom: 30px; }
    .page16-text-column { width: 100%; padding-top: 0; padding-left: 0; }
}
@media (max-width: 768px) {
    .page16-title { font-size: 37px; }
    .page16-chart-title { font-size: 26px; }
    .page16-intro { font-size: 18px; }
    .page16-bullet { font-size: 18px; }
    .page16-chart { height: 300px; }
}
            `}</style>
            <div className="page16-container">
                <header className="page16-header">
                    <h1 id="page16-title" className="page16-title">{getText('page16_title', lang)}</h1>
                </header>
                <p className="page16-intro" role="region" aria-label={stripHtml(getText('page16_intro', lang))}>
                    {getText('page16_intro', lang)}
                </p>
                <div className={`page16-content-row ${isTableOpen ? 'layout-stacked' : ''}`}>
                    <div className="page16-chart-column">
                        <div className="page16-chart-frame">
                            <h2 className="page16-chart-title" role="region" aria-label={stripHtml(getText('page16_chart_title', lang))} tabIndex="0">
                                <span aria-hidden="true">{getText('page16_chart_title', lang)}</span>
                                <span id="fn-asterisk-rf-page16" style={{ verticalAlign: 'super', fontSize: '0.75em', lineHeight: '0' }}>
                                    <a className="fn-lnk" href="#fn-asterisk-page16" onClick={scrollToFootnote}>
                                        <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span><span aria-hidden="true">*</span>
                                    </a>
                                </span>
                            </h2>
                            <div role="region" aria-label={getChartSummary()} tabIndex="0">
                                <figure ref={chartRef} className="page16-chart" style={{ margin: 0, position: 'relative' }}>
                                    {selectedSlices !== null && selectedSlices.length > 0 && (
                                        <div style={{ marginBottom: 8 }}>
                                            <button type="button" onClick={() => setSelectedSlices(null)} style={{ padding: '6px 12px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontSize: 14, color: '#fff' }}>{lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}</button>
                                        </div>
                                    )}
                                    <Plot
                                        key={selectedSlices ? selectedSlices.join('-') : 'none'}
                                        data={pieData}
                                        layout={plotLayout}
                                        config={config}
                                        style={{ width: '100%', height: '100%' }}
                                        useResizeHandler={true}
                                        onClick={(data) => {
                                            if (!data.points || data.points.length === 0) return;
                                            const clickedPoint = data.points[0];
                                            const sliceIndex = clickedPoint.pointNumber !== undefined ? clickedPoint.pointNumber : clickedPoint.pointIndex;
                                            if (sliceIndex === undefined) return;
                                            if (windowWidth <= 768) {
                                                const currentTime = Date.now();
                                                const last = lastClickRef.current;
                                                const isSamePoint = sliceIndex === last.index;
                                                const isDoubleTap = isSamePoint && (currentTime - last.time < 300);
                                                lastClickRef.current = { time: currentTime, index: sliceIndex };
                                                if (!isDoubleTap) return;
                                            }
                                            setSelectedSlices(prev => {
                                                if (prev === null) return [sliceIndex];
                                                const isSelected = prev.includes(sliceIndex);
                                                if (isSelected) {
                                                    const next = prev.filter(p => p !== sliceIndex);
                                                    return next.length === 0 ? null : next;
                                                }
                                                return [...prev, sliceIndex];
                                            });
                                        }}
                                    />
                                </figure>
                            </div>
                            <div className="page16-table-wrapper">
                                <details onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                                    <summary role="button" aria-expanded={isTableOpen}>
                                        <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                        {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                        <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                                    </summary>
                                    <div ref={topScrollRef} style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', marginBottom: 0, display: windowWidth <= 768 ? 'none' : 'block' }} aria-hidden="true">
                                        <div style={{ height: '20px' }} />
                                    </div>
                                    <div ref={tableScrollRef} className="table-responsive" role="region" style={{ borderTop: 'none', padding: '15px' }} tabIndex="0">
                                        <table className="table table-striped table-hover">
                                            <caption className="wb-inv">{getText('page16_chart_title', lang)}</caption>
                                            <thead>
                                                <tr>
                                                    <th scope="col" rowSpan={2} style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd', verticalAlign: 'middle' }}>{lang === 'en' ? 'Year' : 'Année'}</th>
                                                    <th scope="col" colSpan={4} style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{getText('page16_table_uom', lang)}</th>
                                                    <th scope="col" colSpan={3} style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>%</th>
                                                </tr>
                                                <tr>
                                                    {PAGE16_CATEGORIES.map(k => (
                                                        <th key={k} scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd' }}>{getText('page16_' + k, lang)}</th>
                                                    ))}
                                                    <th scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd' }}>{lang === 'en' ? 'Total' : 'Total'}</th>
                                                    {PAGE16_CATEGORIES.map(k => (
                                                        <th key={'pct-' + k} scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd' }}>{getText('page16_' + k, lang)}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {PAGE16_TABLE_DATA.map(row => {
                                                    const vals = PAGE16_CATEGORIES.map(k => row[k]);
                                                    const total = vals.reduce((a, b) => a + b, 0);
                                                    const pcts = total > 0 ? vals.map(v => (v / total) * 100) : [0, 0, 0];
                                                    return (
                                                        <tr key={row.year}>
                                                            <th scope="row" style={{ fontWeight: 'bold', padding: '8px', border: '1px solid #ddd' }}>{row.year}</th>
                                                            {vals.map((v, i) => (
                                                                <td key={i} style={{ textAlign: 'center', padding: '8px', border: '1px solid #ddd' }}>{formatPage16Number(v, lang)}</td>
                                                            ))}
                                                            <td style={{ textAlign: 'center', padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>{formatPage16Number(total, lang)}</td>
                                                            {pcts.map((p, i) => (
                                                                <td key={i} style={{ textAlign: 'center', padding: '8px', border: '1px solid #ddd' }}>{formatPage16Number(p, lang)}</td>
                                                            ))}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '15px' }}>
                                            <button type="button" onClick={downloadTableAsCSV} style={{ padding: '8px 16px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
                                                {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                            </button>
                                            <button type="button" onClick={downloadTableAsDocx} style={{ padding: '8px 16px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
                                                {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                            </button>
                                        </div>
                                    </div>
                                </details>
                            </div>
                        </div>
                    </div>
                    <aside className="page16-text-column">
                        <ul style={{ listStyleType: 'disc', paddingLeft: '24px', margin: 0 }}>
                            <li className="page16-bullet">
                                {getText('page16_bullet1_part1', lang)}<strong>{getText('page16_bullet1_part2', lang)}</strong>{getText('page16_bullet1_part3', lang)}<strong>{getText('page16_bullet1_part4', lang)}</strong>{getText('page16_bullet1_part5', lang)}
                            </li>
                            <li className="page16-bullet">
                                {getText('page16_bullet2_part1', lang)}<strong>{getText('page16_bullet2_part2', lang)}</strong>{getText('page16_bullet2_part3', lang)}<strong>{getText('page16_bullet2_part4', lang)}</strong>{getText('page16_bullet2_part5', lang)}
                            </li>
                        </ul>
                    </aside>
                </div>
                <aside className="wb-fnote page16-footnote" role="note">
                    <h2 id="fn">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnote *' : 'Note de bas de page *'}</dt>
                        <dd id="fn-asterisk-page16">
                            <a href="#fn-asterisk-rf-page16" onClick={scrollToRef} className="fn-num" title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}>
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                            </a>
                            <p style={{ display: 'inline', marginLeft: '4px' }}>{getText('page16_footnote', lang)}</p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page16;
