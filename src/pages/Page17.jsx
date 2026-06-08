import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const PAGE17_YEARS = [2011, 2013, 2015, 2017, 2019, 2021, 2023];
const PAGE17_CATEGORIES = ['oil_gas', 'petroleum_coal', 'utilities', 'pipelines'];

const PAGE17_HARDCODED = [
    { year: 2011, oil_gas: 2.5, petroleum_coal: 1.0, utilities: 0.1, pipelines: 0.2 },
    { year: 2013, oil_gas: 2.0, petroleum_coal: 1.2, utilities: 0.1, pipelines: 0.2 },
    { year: 2015, oil_gas: 2.7, petroleum_coal: 2.0, utilities: 0.2, pipelines: 0.3 },
    { year: 2017, oil_gas: 1.0, petroleum_coal: 1.0, utilities: 0.1, pipelines: 0.2 },
    { year: 2019, oil_gas: 1.5, petroleum_coal: 1.0, utilities: 0.2, pipelines: 0.6 },
    { year: 2021, oil_gas: 2.6, petroleum_coal: 1.5, utilities: 0.1, pipelines: 0.3 },
    { year: 2023, oil_gas: 5.3, petroleum_coal: 6.2, utilities: 0.3, pipelines: 0.5 }
];

const PAGE17_COLORS = {
    oil_gas: '#86754f',
    petroleum_coal: '#2C9EAA',
    utilities: '#005c97',
    pipelines: '#4AA56F'
};

const formatPage17Number = (num, lang) => {
    if (num === undefined || num === null) return '—';
    return Number(num).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
};

const Page17 = () => {
    const { lang } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const chartRef = useRef(null);
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });

    const hexToRgba = (hex, opacity = 1) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
        return hex;
    };

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

    const chartTraces = useMemo(() => {
        return PAGE17_CATEGORIES.map((key, traceIndex) => {
            const label = getText(`page17_legend_${key}`, lang);
            const yArr = PAGE17_HARDCODED.map(row => row[key]);
            const hovertext = PAGE17_HARDCODED.map((row) => {
                const val = row[key];
                const total = PAGE17_CATEGORIES.reduce((s, k) => s + row[k], 0);
                return `<b>${row.year}</b><br>${label}: ${formatPage17Number(val, lang)} ${lang === 'en' ? '$ billion' : 'milliards de dollars'}<br>${lang === 'en' ? 'Total' : 'Total'}: ${formatPage17Number(total, lang)}`;
            });
            const baseColor = PAGE17_COLORS[key];
            const markerColor = selectedPoints === null
                ? baseColor
                : yArr.map((_, pointIndex) => {
                    const isSelected = selectedPoints.some(p => p.traceIndex === traceIndex && p.pointIndex === pointIndex);
                    return isSelected ? baseColor : hexToRgba(baseColor, 0.3);
                });
            return {
                type: 'bar',
                orientation: 'v',
                name: label,
                x: PAGE17_YEARS,
                y: yArr,
                marker: { color: markerColor },
                hovertext,
                hoverinfo: 'text',
                textinfo: 'none'
            };
        });
    }, [lang, selectedPoints]);

    const plotLayout = useMemo(() => ({
        barmode: 'stack',
        showlegend: false,
        clickmode: 'event',
        hovermode: 'closest',
        hoverlabel: {
            bgcolor: '#ffffff',
            font: { color: '#000000', size: 14, family: 'Arial, sans-serif' }
        },
        xaxis: {
            tickvals: PAGE17_YEARS,
            tickfont: { size: windowWidth <= 480 ? 12 : 16, family: 'Arial, sans-serif' },
            showgrid: false,
            zeroline: false,
            automargin: true
        },
        yaxis: {
            title: { text: getText('page17_yaxis', lang), font: { size: windowWidth <= 480 ? 14 : 18, family: 'Arial, sans-serif' }, standoff: 15 },
            range: [0, 14],
            dtick: 2,
            showgrid: false,
            zeroline: true,
            tickfont: { size: windowWidth <= 480 ? 12 : 16, family: 'Arial, sans-serif' },
            automargin: true
        },
        margin: { l: 80, r: 20, t: 20, b: 60 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        autosize: true
    }), [lang, windowWidth]);

    const handleChartClick = (data) => {
        if (!data.points || data.points.length === 0) return;
        const pt = data.points[0];
        const traceIndex = pt.curveNumber;
        const pointIndex = pt.pointIndex;
        const now = Date.now();
        const last = lastClickRef.current;
        if (now - last.time < 400 && last.traceIndex === traceIndex && last.pointIndex === pointIndex) {
            setSelectedPoints(prev => {
                if (prev === null) return [{ traceIndex, pointIndex }];
                const idx = prev.findIndex(p => p.traceIndex === traceIndex && p.pointIndex === pointIndex);
                if (idx >= 0) {
                    const next = prev.filter((_, i) => i !== idx);
                    return next.length === 0 ? null : next;
                }
                return [...prev, { traceIndex, pointIndex }];
            });
            lastClickRef.current = { time: 0, traceIndex: null, pointIndex: null };
            return;
        }
        lastClickRef.current = { time: now, traceIndex, pointIndex };
        setSelectedPoints(prev => {
            const key = { traceIndex, pointIndex };
            if (prev === null) return [key];
            const idx = prev.findIndex(p => p.traceIndex === traceIndex && p.pointIndex === pointIndex);
            if (idx >= 0) {
                const next = prev.filter((_, i) => i !== idx);
                return next.length === 0 ? null : next;
            }
            return [...prev, key];
        });
    };

    const stripHtml = (text) => text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

    const downloadChartWithTitle = async () => {
        const plotElement = chartRef?.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        try {
            const title = stripHtml(getText('page17_title', lang));
            const imgData = await window.Plotly.toImage(plotElement, { format: 'png', width: 1000, height: 500, scale: 2 });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                const titleHeight = 60;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 24px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, canvas.width / 2, 40);
                ctx.drawImage(img, 0, titleHeight);
                const link = document.createElement('a');
                link.download = lang === 'en' ? 'corporate_income_taxes_energy.png' : 'impots_revenu_industries_energetiques.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            };
            img.src = imgData;
        } catch (e) {
            console.error(e);
        }
    };

    const downloadTableAsCSV = () => {
        const headers = [lang === 'en' ? 'Year' : 'Année', ...PAGE17_CATEGORIES.map(k => getText(`page17_legend_${k}`, lang)), lang === 'en' ? 'Total' : 'Total'];
        const rows = PAGE17_HARDCODED.map(row => {
            const vals = PAGE17_CATEGORIES.map(k => row[k]);
            const total = vals.reduce((a, b) => a + b, 0);
            return [row.year, ...vals.map(v => formatPage17Number(v, lang)), formatPage17Number(total, lang)];
        });
        const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'corporate_income_taxes_energy.csv' : 'impots_revenu_industries_energetiques.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadTableAsDocx = async () => {
        const title = stripHtml(getText('page17_title', lang));
        const uom = getText('page17_yaxis', lang);
        const headerRow1 = [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: lang === 'en' ? 'Year' : 'Année', bold: true, size: 22 })], alignment: AlignmentType.CENTER })], shading: { fill: 'E6E6E6' }, rowSpan: 2 }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: uom, bold: true, size: 22 })], alignment: AlignmentType.CENTER })], shading: { fill: 'E6E6E6' }, columnSpan: 5 })
        ];
        const catCells = PAGE17_CATEGORIES.map(k =>
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: getText('page17_legend_' + k, lang), bold: true, size: 22 })], alignment: AlignmentType.CENTER })], shading: { fill: 'E6E6E6' } })
        );
        const totalLabel = lang === 'en' ? 'Total' : 'Total';
        const totalCell = new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: totalLabel, bold: true, size: 22 })], alignment: AlignmentType.CENTER })], shading: { fill: 'E6E6E6' } });
        const headerRow2 = new TableRow({ children: [...catCells, totalCell] });
        const dataRows = PAGE17_HARDCODED.map(row => {
            const vals = PAGE17_CATEGORIES.map(k => row[k]);
            const total = vals.reduce((a, b) => a + b, 0);
            const cells = [row.year, ...vals.map(v => formatPage17Number(v, lang)), formatPage17Number(total, lang)].map((text, i) =>
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(text), size: 22 })], alignment: i === 0 ? AlignmentType.CENTER : AlignmentType.CENTER })] })
            );
            return new TableRow({ children: cells });
        });
        const tableRows = [
            new TableRow({ children: headerRow1 }),
            headerRow2,
            ...dataRows
        ];
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [1200, 2200, 2200, 1400, 1400, 1200], rows: tableRows })
                ]
            }]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'corporate_income_taxes_energy.docx' : 'impots_revenu_industries_energetiques.docx');
    };

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

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page17"
            role="main"
            aria-labelledby="page17-chart-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page17 { width: 100%; }
.page17-container { width: 100%; padding: 15px 0 0 0; display: flex; flex-direction: column; box-sizing: border-box; flex: 1; overflow: visible; }
.page17-chart-title { font-family: 'Lato', sans-serif; font-size: 29px; font-weight: bold; color: var(--gc-text, #332f30); text-align: center; margin: 0 0 10px 0; }
.page17-chart-frame { background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-sizing: border-box; overflow: visible; }
.page17-chart { width: 100%; height: 420px; position: relative; z-index: 1; }
.page17-chart button[type="button"]:hover,
.page17-chart button:hover { background-color: #404040 !important; }
.page17-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 20px 24px; margin-top: 16px; margin-bottom: 10px; font-family: Arial, sans-serif; position: relative; z-index: 10; background-color: #f5f5f5; padding: 10px 0; }
.page17-legend-item { display: flex; align-items: center; gap: 8px; }
.page17-legend-color { width: 20px; height: 12px; display: inline-block; }
.page17-legend-label { font-size: 18px; color: #333333; }
.page17-table-wrapper { display: block; width: 100%; margin: 20px 0 0 0; }
.page17-table-wrapper details > summary { display: block; width: 100%; padding: 12px 15px; background-color: #8C8C8C; border: 1px solid #404040; border-radius: 4px; cursor: pointer; font-family: Arial, sans-serif; font-weight: bold; color: #ffffff; list-style: none; }
.page17-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page17-table-wrapper details > summary:hover { background-color: #404040 !important; }
.page17-table-wrapper button[type="button"]:hover,
.page17-table-wrapper button:hover { background-color: #404040 !important; }
.page17-table-wrapper .table-responsive { display: block; width: 100%; overflow-x: auto; border: 1px solid #ddd; background: #fff; }
.page17-table-wrapper .table-responsive table { width: max-content; min-width: 100%; border-collapse: collapse; }
@media (max-width: 768px) {
.page17-chart-title { font-size: 26px; }
.page17-legend-label { font-size: 14px; }
}
            `}</style>
            <div className="page17-container">
                <div className="page17-chart-frame">
                    <h2 id="page17-chart-title" className="page17-chart-title" aria-hidden="true">{getText('page17_title', lang)}</h2>
                    <h1 className="wb-inv">{stripHtml(getText('page17_title', lang))}</h1>
                    <div role="region" aria-label={getText('page17_title', lang)} tabIndex="0">
                        {selectedPoints !== null && selectedPoints.length > 0 && (
                                <div style={{ marginBottom: 8 }}>
                                    <button type="button" onClick={() => setSelectedPoints(null)} style={{ padding: '6px 12px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontSize: 14, color: '#fff' }}>{lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}</button>
                                </div>
                            )}
                        <figure ref={chartRef} className="page17-chart" style={{ margin: 0, position: 'relative' }}>
                            <div aria-hidden="true">
                                <Plot
                                    data={chartTraces}
                                    layout={plotLayout}
                                    config={config}
                                    style={{ width: '100%', height: '100%' }}
                                    useResizeHandler={true}
                                    onClick={handleChartClick}
                                />
                            </div>
                        </figure>
                    </div>
                    <div className="page17-legend" aria-hidden="true">
                        {PAGE17_CATEGORIES.map(key => (
                            <div key={key} className="page17-legend-item">
                                <span className="page17-legend-color" style={{ backgroundColor: PAGE17_COLORS[key] }} />
                                <span className="page17-legend-label">{getText(`page17_legend_${key}`, lang)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="page17-table-wrapper">
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
                                    <caption className="wb-inv">{getText('page17_title', lang)}</caption>
                                    <thead>
                                        <tr>
                                            <th scope="col" rowSpan={2} style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd', verticalAlign: 'middle' }}>{lang === 'en' ? 'Year' : 'Année'}</th>
                                            <th scope="col" colSpan={5} style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{getText('page17_yaxis', lang)}</th>
                                        </tr>
                                        <tr>
                                            {PAGE17_CATEGORIES.map(k => (
                                                <th key={k} scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd' }}>{getText(`page17_legend_${k}`, lang)}</th>
                                            ))}
                                            <th scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd' }}>{lang === 'en' ? 'Total' : 'Total'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {PAGE17_HARDCODED.map(row => {
                                            const vals = PAGE17_CATEGORIES.map(k => row[k]);
                                            const total = vals.reduce((a, b) => a + b, 0);
                                            return (
                                                <tr key={row.year}>
                                                    <th scope="row" style={{ fontWeight: 'bold', padding: '8px', border: '1px solid #ddd' }}>{row.year}</th>
                                                    {vals.map((v, i) => (
                                                        <td key={i} style={{ textAlign: 'center', padding: '8px', border: '1px solid #ddd' }} aria-label={`${row.year}, ${getText(`page17_legend_${PAGE17_CATEGORIES[i]}`, lang)}: ${formatPage17Number(v, lang)} ${getText('page17_yaxis', lang)}`}>{formatPage17Number(v, lang)}</td>
                                                    ))}
                                                    <td style={{ textAlign: 'center', padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>{formatPage17Number(total, lang)}</td>
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
        </main>
    );
};

export default Page17;
