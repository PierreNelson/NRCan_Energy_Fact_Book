import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getPage63Data } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const COLORS = {
    renewable_energy: '#006d3b',
    energy_efficiency: '#5EA343',
    biofuels_bioenergy: '#809E33',
    air_env_remediation: '#4f5f56',
    water_wastewater: '#77999C',
    smart_grid_storage: '#519CC8',
    transportation: '#f2652b',
    agriculture_forestry: '#CB850B',
    waste_recycling: '#9b1b5e',
    mining_manufacturing: '#8070a3'
};

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    return hex;
};

const substitute = (text, vars) => Object.keys(vars || {}).reduce((s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')), text || '');

const getPageZoomScale = () => {
    if (typeof window === 'undefined') return 1;
    const viewportScale = window.visualViewport?.scale || 1;
    const deviceScale = window.devicePixelRatio || 1;
    return Math.max(viewportScale, deviceScale);
};

const wrapLabel = (label, key, lang) => {
    const wraps = {
        en: {
            renewable_energy: 'Renewable<br>energy',
            energy_efficiency: 'Energy<br>efficiency',
            biofuels_bioenergy: 'Biofuels,<br>bioenergy and<br>bioproducts',
            air_env_remediation: 'Air, environment<br>and remediation',
            water_wastewater: 'Water and<br>wastewater',
            smart_grid_storage: 'Smart grid and<br>energy storage',
            transportation: 'Transportation',
            agriculture_forestry: 'Agriculture and<br>forestry',
            waste_recycling: 'Waste and<br>recycling',
            mining_manufacturing: 'Mining and<br>manufacturing'
        },
        fr: {
            renewable_energy: 'Énergie<br>renouvelable',
            energy_efficiency: 'Efficacité<br>énergétique',
            biofuels_bioenergy: 'Biocarburants,<br>bioénergie et<br>bioproduits',
            air_env_remediation: 'Air, environnement<br>et restauration',
            water_wastewater: 'Eau et eaux<br>usées',
            smart_grid_storage: 'Réseau intelligent<br>et stockage<br>énergétique',
            transportation: 'Transport',
            agriculture_forestry: 'Agriculture et<br>foresterie',
            waste_recycling: 'Déchets et<br>recyclage',
            mining_manufacturing: 'Mines et industries<br>manufacturières'
        }
    };
    return wraps[lang === 'fr' ? 'fr' : 'en'][key] || label;
};

const Page63 = () => {
    const { lang } = useOutletContext();
    const [result, setResult] = useState(null);
    const [selectedYear, setSelectedYear] = useState(2025);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedBars, setSelectedBars] = useState(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [zoomLevel, setZoomLevel] = useState(getPageZoomScale());
    const chartRef = useRef(null);
    const tableTopRef = useRef(null);
    const tableScrollRef = useRef(null);
    const tableBottomRef = useRef(null);
    const lastClickRef = useRef({ time: 0, index: null });

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const formatNumber = (value, digits = 0) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    };
    const formatPct = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        const formatted = Number(value).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        return lang === 'fr' ? `${formatted} %` : `${formatted}%`;
    };
    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    useEffect(() => {
        getPage63Data()
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
            setZoomLevel(getPageZoomScale());
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
    }, [isTableOpen, syncTableScroll]);

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
    }, [result, lang, selectedBars]);

    const dataRows = result?.data || [];
    const selectedRow = dataRows.find((row) => row.year === selectedYear) || dataRows.find((row) => row.year === 2025) || dataRows[dataRows.length - 1] || null;
    const year = selectedRow?.year ?? 2025;
    const chartTitle = substitute(getText('page63_chart_title', lang), { year });
    const fileTitle = `${getText('page63_download_title', lang)} ${year}`;
    const industries = selectedRow?.industries?.length ? selectedRow.industries : [];
    const labels = industries.map((item) => getText(`page63_industry_${item.key}`, lang));
    const xValues = industries.map((item) => item.key);
    const yValues = industries.map((item) => item.pct);
    const barColors = industries.map((item, index) => {
        const base = COLORS[item.key] || '#284162';
        return selectedBars?.length ? (selectedBars.includes(index) ? base : hexToRgba(base, 0.3)) : base;
    });
    const maxPct = Math.max(25, Math.ceil((Math.max(...yValues, 0) + 1) / 5) * 5);
    const tickFont = { size: windowWidth <= 480 ? 13 : windowWidth <= 768 ? 14 : 15, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 768 ? 18 : 22, family: 'Arial, sans-serif' };
    const highZoomLabels = zoomLevel >= 2.75;
    const xTickText = industries.map((item, index) => {
        const label = highZoomLabels ? labels[index] : wrapLabel(labels[index], item.key, lang);
        if (highZoomLabels) return label;
        return index % 2 === 1 ? `<br><br><br><br>${label}` : label;
    });
    const staggerGuideLines = industries
        .map((item, index) => (!highZoomLabels && index % 2 === 1 ? {
            type: 'line',
            xref: 'x',
            yref: 'paper',
            x0: item.key,
            x1: item.key,
            y0: -0.04,
            y1: -0.38,
            layer: 'above',
            line: { color: '#b8b8b8', width: 1, dash: 'dot' }
        } : null))
        .filter(Boolean);
    const marginBottom = highZoomLabels ? 250 : windowWidth <= 480 ? 245 : windowWidth <= 768 ? 255 : 205;

    const barTrace = industries.length ? {
        type: 'bar',
        x: xValues,
        y: yValues,
        marker: { color: barColors },
        hovertext: industries.map((item, index) => `<b>${labels[index]}</b><br>${getText('page63_col_companies', lang)}: ${formatNumber(item.count)}<br>${getText('page63_col_share', lang)}: ${formatPct(item.pct)}`),
        hoverinfo: 'text',
        hoverlabel: { bgcolor: '#ffffff', font: { color: '#333333', size: 14, family: 'Arial, sans-serif' } }
    } : null;

    const layout = {
        showlegend: false,
        margin: { t: 30, r: 20, b: marginBottom, l: windowWidth <= 480 ? 52 : 70 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12, color: '#333333' },
        height: windowWidth <= 480 ? 500 : 535,
        clickmode: 'event',
        dragmode: windowWidth <= 768 ? false : 'zoom',
        shapes: staggerGuideLines,
        xaxis: {
            type: 'category',
            categoryorder: 'array',
            categoryarray: xValues,
            tickmode: 'array',
            tickvals: xValues,
            ticktext: xTickText,
            tickangle: highZoomLabels ? 90 : 0,
            tickfont: { ...(highZoomLabels ? { ...tickFont, size: Math.max(11, tickFont.size - 2) } : tickFont), color: '#333333' },
            automargin: false,
            showgrid: false,
            zeroline: false,
            showline: true,
            linecolor: '#666666',
            linewidth: 1
        },
        yaxis: {
            title: { text: getText('page63_yaxis', lang), font: axisTitleFont, standoff: 8 },
            range: [0, maxPct],
            tickmode: 'array',
            tickvals: Array.from({ length: Math.floor(maxPct / 5) + 1 }, (_, i) => i * 5),
            ticktext: Array.from({ length: Math.floor(maxPct / 5) + 1 }, (_, i) => (lang === 'fr' ? `${i * 5} %` : `${i * 5}%`)),
            tickfont: { ...tickFont, color: '#333333' },
            showgrid: true,
            gridcolor: '#c4c4c4',
            zeroline: false,
            showline: true,
            linecolor: '#666666',
            linewidth: 1
        }
    };

    const downloadChartPng = async () => {
        const plotEl = chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotEl || !window.Plotly) return;
        try {
            await window.Plotly.relayout(plotEl, { paper_bgcolor: '#ffffff', plot_bgcolor: '#ffffff' });
            const imgData = await window.Plotly.toImage(plotEl, { format: 'png', width: 1200, height: 720, scale: 2 });
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
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 28px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(chartTitle, canvas.width / 2, 44);
                ctx.drawImage(img, 0, titleHeight);
                canvas.toBlob((blob) => {
                    if (blob) saveAs(blob, `${fileTitle}.png`);
                });
            };
            img.src = imgData;
        } catch (err) {
            console.warn('Unable to download Page 63 chart image.', err);
            try {
                await window.Plotly.relayout(plotEl, { paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)' });
            } catch (restoreError) {
                console.warn('Unable to restore Page 63 chart background.', restoreError);
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
        getText('page63_col_year', lang),
        getText('page63_col_industry', lang),
        getText('page63_col_companies', lang),
        getText('page63_col_share', lang)
    ];
    const tableRows = industries.map((item) => ({
        year,
        industry: getText(`page63_industry_${item.key}`, lang),
        count: item.count,
        pct: item.pct
    }));

    const downloadTableCSV = () => {
        if (!tableRows.length) return;
        const rows = tableRows.map((row) => [row.year, row.industry, row.count, Number(row.pct).toFixed(1)]);
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
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row.industry, size: 18 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatNumber(row.count), size: 18 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: Number(row.pct).toFixed(1), size: 18 })], alignment: AlignmentType.RIGHT })] })
            ]
        }));
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: fileTitle, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [1200, 5200, 1800, 1800],
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
    if (!selectedRow) return <p>{getText('page63_no_data', lang)}</p>;

    return (
        <main id="main-content" tabIndex="-1" className="page-content page-63" role="main" aria-labelledby="page63-chart-title" style={{ backgroundColor: '#ffffff' }}>
            <style>{`
.page-63 { width: 100%; }
.page63-container { width: 100%; padding: 15px 0 0 0; display: flex; flex-direction: column; box-sizing: border-box; flex: 1; overflow: visible; }
.page63-chart-frame { background-color: #f5f5f5; padding: 20px; padding-bottom: 20px; border-radius: 8px; margin-top: 0; margin-bottom: 20px; box-sizing: border-box; overflow: visible; }
.page63-chart-title { font-family: 'Lato', sans-serif; font-size: 29px; font-weight: bold; color: var(--gc-text); text-align: center; margin: 0 0 5px 0; text-transform: none; }
.page63-chart-scroll { width: 100%; overflow: hidden; }
.page63-chart { width: 100%; min-width: 0; height: ${layout.height}px; position: relative; z-index: 1; overflow: visible; }
.page63-chart > div { width: 100%; height: 100%; overflow: visible; }
.page63-chart .js-plotly-plot,
.page63-chart .plot-container,
.page63-chart .svg-container { overflow: visible !important; }
.page63-clear-selection { padding: 6px 12px; background-color: #8C8C8C; border: 1px solid #404040; border-radius: 4px; cursor: pointer; font-family: Arial, sans-serif; font-size: 14px; color: #fff; margin-bottom: 8px; }
.page63-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.page63-table-wrapper details > summary { display: block; width: 100%; padding: 12px 15px; background-color: #8C8C8C; border: 1px solid #404040; border-radius: 4px; cursor: pointer; font-family: Arial, sans-serif; font-weight: bold; color: #ffffff; list-style: none; }
.page63-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page63-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page63-table-scrollbar > div { height: 20px; }
.page63-table-responsive { display: block; width: 100%; overflow-x: auto; border: 1px solid #ddd; background: #fff; scrollbar-width: none; -ms-overflow-style: none; }
.page63-table-responsive::-webkit-scrollbar { display: none; }
.page63-table-responsive table { width: max-content !important; min-width: 100%; border-collapse: collapse; }
.page63-table-responsive th, .page63-table-responsive td { white-space: nowrap; padding: 8px 12px; font-family: Arial, sans-serif; color: var(--gc-text); border: 1px solid #ddd; }
.page63-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.page63-download-buttons button { padding: 8px 16px; border: 1px solid #404040; border-radius: 4px; background: #8C8C8C; cursor: pointer; font-family: Arial, sans-serif; font-weight: bold; color: #ffffff; }
.page63-chart-frame button:hover, .page63-table-wrapper summary:hover { background-color: #404040 !important; }
@media (max-width: 768px) {
    .page63-chart-title { font-size: 26px; }
}
            `}</style>
            <div className="page63-container">
                <div className="page63-chart-frame">
                    <h2 id="page63-chart-title" className="page63-chart-title">{chartTitle}</h2>
                    {selectedBars?.length > 0 && <button type="button" className="page63-clear-selection" onClick={() => setSelectedBars(null)}>{lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}</button>}
                    <div className="page63-chart-scroll">
                        <figure ref={chartRef} className="page63-chart" role="region" aria-label={chartTitle} tabIndex="0" style={{ margin: 0 }}>
                            <div aria-hidden="true">
                                {barTrace && (
                                    <Plot
                                        key={`page63-${year}-${selectedBars ? selectedBars.join('-') : 'none'}`}
                                        data={[barTrace]}
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
                                                const last = lastClickRef.current;
                                                const isDoubleTap = index === last.index && now - last.time < 300;
                                                lastClickRef.current = { time: now, index };
                                                if (!isDoubleTap) return;
                                            }
                                            setSelectedBars((previous) => {
                                                if (previous === null) return [index];
                                                if (previous.includes(index)) return previous.length <= 1 ? null : previous.filter((item) => item !== index);
                                                return [...previous, index];
                                            });
                                        }}
                                    />
                                )}
                            </div>
                        </figure>
                    </div>
                    <div className="page63-table-wrapper">
                        <details className="page63-data-table" onToggle={(event) => setIsTableOpen(event.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                            </summary>
                            <div ref={tableTopRef} className="page63-table-scrollbar" aria-hidden="true"><div /></div>
                            <div ref={tableScrollRef} className="page63-table-responsive" role="region" aria-labelledby="page63-table-caption" tabIndex={0}>
                                <table className="table table-striped table-hover">
                                    <caption id="page63-table-caption" className="wb-inv">{getText('page63_table_caption', lang)}</caption>
                                    <thead>
                                        <tr>
                                            {headers.map((header) => <th key={header} scope="col">{header}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableRows.map((row) => (
                                            <tr key={row.industry}>
                                                <th scope="row">{row.year}</th>
                                                <td>{row.industry}</td>
                                                <td style={{ textAlign: 'right' }}>{formatNumber(row.count)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatPct(row.pct)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div ref={tableBottomRef} className="page63-table-scrollbar" aria-hidden="true"><div /></div>
                            <div className="page63-download-buttons">
                                <button type="button" onClick={downloadTableCSV}>{lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}</button>
                                <button type="button" onClick={downloadTableDocx}>{lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}</button>
                            </div>
                        </details>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Page63;
