import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const energy_affordability_REGIONS = ['Can', 'NL', 'PEI', 'NS', 'NB', 'Que', 'Ont', 'Man', 'Sask', 'Alta', 'BC', 'YT', 'NWT', 'Nvt'];

const energy_affordability_DATA = {
    Can: 5.6,
    NL: 13.7,
    PEI: 11.4,
    NS: 12.5,
    NB: 10.7,
    Que: 4.2,
    Ont: 4.8,
    Man: 5.6,
    Sask: 6.9,
    Alta: 7.3,
    BC: 4.9,
    YT: 11.1,
    NWT: 9.5,
    Nvt: 3.7
};

const BAR_COLOR = '#9f346d';

const formatHouseholdEnergyNumber = (num, lang) => {
    if (num === undefined || num === null) return '—';
    return Number(num).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
};

const EnergyAffordability = () => {
    const { lang } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const chartRef = useRef(null);
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const lastClickRef = useRef({ time: 0, pointIndex: null });

    const hexToRgba = (hex, opacity = 1) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
        return hex;
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

    const regionLabels = useMemo(() => energy_affordability_REGIONS.map(r => getText('energy_affordability_region_' + r, lang)), [lang]);
    const barValues = useMemo(() => energy_affordability_REGIONS.map(r => energy_affordability_DATA[r]), []);

    const barTrace = useMemo(() => {
        const hovertext = energy_affordability_REGIONS.map((r, i) => {
            const full = getText('energy_affordability_region_' + r + '_full', lang);
            const pct = barValues[i];
            return `<b>${full}</b><br>${getText('energy_affordability_chart_title', lang)}: ${formatHouseholdEnergyNumber(pct, lang)}%`;
        });
        const markerColor = selectedPoints === null
            ? BAR_COLOR
            : energy_affordability_REGIONS.map((_, i) => selectedPoints.includes(i) ? BAR_COLOR : hexToRgba(BAR_COLOR, 0.3));
        return {
            type: 'bar',
            orientation: 'h',
            x: barValues,
            y: regionLabels,
            marker: { color: markerColor },
            hovertext,
            hoverinfo: 'text',
            hoverlabel: {
                bgcolor: '#ffffff',
                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' }
            },
            text: barValues.map(v => (lang === 'en' ? v + '%' : v.toLocaleString('fr-CA', { minimumFractionDigits: 1 }) + ' %')),
            textposition: 'outside',
            textfont: { size: windowWidth <= 480 ? 11 : 14, family: 'Arial, sans-serif' },
            insidetextfont: { size: 12, family: 'Arial, sans-serif' }
        };
    }, [lang, barValues, regionLabels, windowWidth, selectedPoints]);

    const plotLayout = useMemo(() => ({
        barmode: 'overlay',
        showlegend: false,
        hovermode: 'closest',
        clickmode: 'event',
        dragmode: windowWidth <= 768 ? false : 'zoom',
        xaxis: {
            title: { text: getText('energy_affordability_table_pct', lang), font: { size: windowWidth <= 480 ? 14 : 18, family: 'Arial, sans-serif' }, standoff: 15 },
            range: [0, 15],
            tick0: 0,
            dtick: 1,
            showgrid: true,
            zeroline: true,
            tickfont: { size: windowWidth <= 480 ? 12 : 16, family: 'Arial, sans-serif' },
            automargin: true
        },
        yaxis: {
            autorange: 'reversed',
            showgrid: false,
            tickfont: { size: windowWidth <= 480 ? 12 : 16, family: 'Arial, sans-serif' },
            automargin: true
        },
        margin: { l: 80, r: 60, t: 20, b: 80 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        autosize: true
    }), [lang, windowWidth]);

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
            const title = stripHtml(getText('energy_affordability_chart_title', lang));
            const imgData = await window.Plotly.toImage(plotElement, { format: 'png', width: 1000, height: 520, scale: 2 });
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
                link.download = lang === 'en' ? 'energy_poverty_rates.png' : 'taux_pauvrete_energetique.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            };
            img.src = imgData;
        } catch (e) {
            console.error(e);
        }
    };

    const downloadTableAsCSV = () => {
        const headers = [getText('energy_affordability_table_geo', lang), getText('energy_affordability_table_pct', lang)];
        const rows = energy_affordability_REGIONS.map(r => [getText('energy_affordability_region_' + r + '_full', lang), formatHouseholdEnergyNumber(energy_affordability_DATA[r], lang)]);
        const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'energy_poverty_rates.csv' : 'taux_pauvrete_energetique.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadTableAsDocx = async () => {
        const title = stripHtml(getText('energy_affordability_title', lang));
        const geoLabel = getText('energy_affordability_table_geo', lang);
        const pctLabel = getText('energy_affordability_table_pct', lang);
        const headerCells = [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: geoLabel, bold: true, size: 22 })], alignment: AlignmentType.CENTER })], shading: { fill: 'E6E6E6' } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: pctLabel, bold: true, size: 22 })], alignment: AlignmentType.CENTER })], shading: { fill: 'E6E6E6' } })
        ];
        const dataRows = energy_affordability_REGIONS.map(r => {
            const cells = [
                getText('energy_affordability_region_' + r + '_full', lang),
                formatHouseholdEnergyNumber(energy_affordability_DATA[r], lang)
            ].map((text, i) =>
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: String(text), size: 22 })], alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER })]
                })
            );
            return new TableRow({ children: cells });
        });
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [4000, 2000], rows: [new TableRow({ children: headerCells }), ...dataRows] })
                ]
            }]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'energy_poverty_rates.docx' : 'taux_pauvrete_energetique.docx');
    };

    const getChartSummary = () => {
        const parts = energy_affordability_REGIONS.map((r, i) => `${getText('energy_affordability_region_' + r + '_full', lang)}: ${formatHouseholdEnergyNumber(barValues[i], lang)}%`).join(', ');
        return `${stripHtml(getText('energy_affordability_chart_title', lang))}. ${parts}.`;
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-43"
            role="main"
            aria-labelledby="energy-affordability-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-43 { width: 100%; }
.energy-affordability-container { width: 100%; padding: 15px 0 0 0; display: flex; flex-direction: column; box-sizing: border-box; flex: 1; overflow: visible; }
.energy-affordability-title {
    font-family: 'Lato', sans-serif;
    font-size: 50px;
    font-weight: bold;
    color: #a0346e;
    margin: 0 0 10px 0;
    line-height: 1.2;
    position: relative;
    padding-bottom: 0.5em;
}
.energy-affordability-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.energy-affordability-intro {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 20px;
}
.energy-affordability-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-sizing: border-box;
    overflow: visible;
}
.energy-affordability-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 15px 0;
    text-align: center;
}
.energy-affordability-chart { width: 100%; height: 480px; }
.energy-affordability-table-wrapper { display: block; width: 100%; margin: 20px 0 0 0; }
.energy-affordability-table-wrapper details > summary {
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
.energy-affordability-table-wrapper details > summary::-webkit-details-marker { display: none; }
.energy-affordability-table-wrapper details > summary:hover { background-color: #404040 !important; }
.energy-affordability-table-wrapper button[type="button"]:hover,
.energy-affordability-table-wrapper button:hover,
.energy-affordability-chart-frame button[type="button"]:hover,
.energy-affordability-chart-frame button:hover { background-color: #404040 !important; }
.energy-affordability-table-wrapper .table-responsive { display: block; width: 100%; overflow-x: auto; border: 1px solid #ddd; background: #fff; }
.energy-affordability-table-wrapper .table-responsive table { width: max-content; min-width: 100%; border-collapse: collapse; }
/* Footer uses global .wb-fnote typography (see index.css) */
.energy-affordability-footer p {
    margin: 0 0 1rem 0;
    font-family: var(--font-body);
    font-size: 1rem;
    line-height: 1.65;
    color: var(--gc-text);
}
.energy-affordability-footer p:last-child { margin-bottom: 0; }
@media (max-width: 768px) {
    .energy-affordability-title { font-size: 37px; margin-bottom: 10px; }
    .energy-affordability-chart-title { font-size: 26px; }
    .energy-affordability-intro { font-size: 18px; }
    .energy-affordability-chart { height: 420px; }
}
            `}</style>
            <div className="energy-affordability-container">
                <header role="region" aria-label={getText('energy_affordability_title', lang)}>
                    <h1 id="energy-affordability-title" className="energy-affordability-title">{getText('energy_affordability_title', lang)}</h1>
                </header>
                <p className="energy-affordability-intro" role="region" aria-label={stripHtml(getText('energy_affordability_para1_part1', lang) + getText('energy_affordability_para1_part2', lang) + getText('energy_affordability_para1_part3', lang))}>
                    {getText('energy_affordability_para1_part1', lang)}<strong>{getText('energy_affordability_para1_part2', lang)}</strong>{getText('energy_affordability_para1_part3', lang)}
                </p>
                <p className="energy-affordability-intro" role="region" aria-label={stripHtml(getText('energy_affordability_para2_part1', lang) + getText('energy_affordability_para2_part2', lang) + getText('energy_affordability_para2_part3', lang))}>
                    {getText('energy_affordability_para2_part1', lang)}<strong>{getText('energy_affordability_para2_part2', lang)}</strong>{getText('energy_affordability_para2_part3', lang)}
                </p>
                <p className="energy-affordability-intro" role="region" aria-label={stripHtml(getText('energy_affordability_para3_part1', lang) + getText('energy_affordability_para3_part2', lang) + getText('energy_affordability_para3_part3', lang))}>
                    {getText('energy_affordability_para3_part1', lang)}<strong>{getText('energy_affordability_para3_part2', lang)}</strong>{getText('energy_affordability_para3_part3', lang)}
                </p>
                <div className="energy-affordability-chart-frame">
                    <h2 className="energy-affordability-chart-title">{getText('energy_affordability_chart_title', lang)}</h2>
                    <div role="region" aria-label={getChartSummary()} tabIndex="0">
                        <figure ref={chartRef} className="energy-affordability-chart" style={{ margin: 0, position: 'relative' }}>
                            {selectedPoints !== null && (
                                <div style={{ marginBottom: 8 }}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedPoints(null)}
                                        style={{ padding: '6px 12px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontSize: 14, color: '#fff' }}
                                    >
                                        {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                                    </button>
                                </div>
                            )}
                            <Plot
                                data={[barTrace]}
                                layout={plotLayout}
                                config={config}
                                style={{ width: '100%', height: '100%' }}
                                useResizeHandler={true}
                                onClick={(data) => {
                                    if (!data.points || data.points.length === 0) return;
                                    const pointIndex = data.points[0].pointIndex;
                                    if (windowWidth <= 768) {
                                        const currentTime = Date.now();
                                        const last = lastClickRef.current;
                                        const isSamePoint = pointIndex === last.pointIndex;
                                        const isDoubleTap = isSamePoint && (currentTime - last.time < 300);
                                        lastClickRef.current = { time: currentTime, pointIndex };
                                        if (!isDoubleTap) return;
                                    }
                                    setSelectedPoints(prev => {
                                        if (prev === null) return [pointIndex];
                                        const isSelected = prev.includes(pointIndex);
                                        if (isSelected) {
                                            const next = prev.filter(i => i !== pointIndex);
                                            return next.length === 0 ? null : next;
                                        }
                                        return [...prev, pointIndex];
                                    });
                                }}
                            />
                        </figure>
                    </div>
                    <div className="energy-affordability-table-wrapper">
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
                                    <caption className="wb-inv">{getText('energy_affordability_chart_title', lang)}</caption>
                                    <thead>
                                        <tr>
                                            <th scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd' }}>{getText('energy_affordability_table_geo', lang)}</th>
                                            <th scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{getText('energy_affordability_table_pct', lang)}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {energy_affordability_REGIONS.map(r => (
                                            <tr key={r}>
                                                <th scope="row" style={{ fontWeight: 'bold', padding: '8px', border: '1px solid #ddd' }}>{getText('energy_affordability_region_' + r + '_full', lang)}</th>
                                                <td style={{ textAlign: 'center', padding: '8px', border: '1px solid #ddd' }}>{formatHouseholdEnergyNumber(energy_affordability_DATA[r], lang)}</td>
                                            </tr>
                                        ))}
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
                <aside className="energy-affordability-footer wb-fnote" role="contentinfo">
                    <h2 id="footer-energy-affordability">{getText('energy_affordability_footer_heading', lang)}</h2>
                    <p>{getText('energy_affordability_footer1', lang)}</p>
                    <p>{getText('energy_affordability_footer2', lang)}</p>
                </aside>
            </div>
        </main>
    );
};

export default EnergyAffordability;
