import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getPage52Data } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import page52Bg2 from '../assets/page52_bg2.png';
import page52Bg3 from '../assets/page52_bg3.png';
import page52Bg4 from '../assets/page52_bg4.png';
import page52Bg5 from '../assets/page52_bg5.png';

const CIEU_SLICE_ORDER = ['sh', 'ae', 'lt', 'wh', 'am', 'sc'];
const CIEU_COLORS = ['#CE8003', '#4b4c4d', '#6b5b95', '#6b666a', '#1f8093', '#7db8d4'];
/** Chart and table only show data up to this year (no 2024–2026). */
const PAGE52_MAX_YEAR = 2023;
/** Fixed filename for CSV/DOCX (no year). */
const PAGE52_TABLE_FILENAME_BASE = 'commercial_institutional_energy_by_end_use';

const substitute = (str, vars) => {
    if (!str || typeof str !== 'string') return str;
    return Object.keys(vars || {}).reduce((s, k) => s.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(vars[k] ?? '–')), str);
};

const Page52 = () => {
    const outlet = useOutletContext();
    const lang = outlet?.lang ?? 'en';
    const layoutPadding = outlet?.layoutPadding ?? { left: 55, right: 15 };
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const yearDropdownRef = useRef(null);
    const yearButtonRef = useRef(null);
    const chartRef = useRef(null);
    const tableTopRef = useRef(null);
    const tableScrollRef = useRef(null);

    useEffect(() => {
        getPage52Data()
            .then((d) => {
                setResult(d ?? null);
                const data = d?.data;
                if (Array.isArray(data) && data.length > 0) {
                    const validYears = data.filter((r) => r.year <= PAGE52_MAX_YEAR && r.teu != null && r.teu > 0).map((r) => r.year);
                    const latestValid = validYears.length ? Math.max(...validYears) : null;
                    const upToMax = data.filter((r) => r.year <= PAGE52_MAX_YEAR).map((r) => r.year).sort((a, b) => b - a);
                    const fallback = upToMax[0];
                    const lastRow = data[data.length - 1];
                    setSelectedYear(latestValid ?? fallback ?? data.find((r) => r.year <= PAGE52_MAX_YEAR)?.year ?? lastRow?.year);
                }
            })
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target)) setIsYearDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const syncTableScroll = (topRef, tableRef) => {
        const topScroll = topRef?.current;
        const tableScroll = tableRef?.current;
        if (!topScroll || !tableScroll) return;
        const table = tableScroll.querySelector('table');
        if (!table) return;
        const scrollWidth = table.offsetWidth;
        const containerWidth = tableScroll.clientWidth;
        const spacer = topScroll?.firstElementChild;
        if (spacer) spacer.style.width = `${scrollWidth}px`;
        if (scrollWidth > containerWidth) {
            topScroll.style.display = 'block';
            topScroll.style.opacity = '1';
        } else {
            topScroll.style.display = 'none';
        }
    };

    useEffect(() => {
        const topScroll = tableTopRef.current;
        const tableScroll = tableScrollRef.current;
        if (!topScroll || !tableScroll || !isTableOpen) return;
        const handleTopScroll = () => { if (tableScroll.scrollLeft !== topScroll.scrollLeft) tableScroll.scrollLeft = topScroll.scrollLeft; };
        const handleTableScroll = () => { if (topScroll.scrollLeft !== tableScroll.scrollLeft) topScroll.scrollLeft = tableScroll.scrollLeft; };
        const sync = () => window.requestAnimationFrame(() => syncTableScroll(tableTopRef, tableScrollRef));
        topScroll.addEventListener('scroll', handleTopScroll);
        tableScroll.addEventListener('scroll', handleTableScroll);
        const observer = new ResizeObserver(sync);
        const tableEl = tableScroll.querySelector('table');
        if (tableEl) observer.observe(tableEl);
        observer.observe(tableScroll);
        sync();
        return () => {
            topScroll.removeEventListener('scroll', handleTopScroll);
            tableScroll.removeEventListener('scroll', handleTableScroll);
            observer.disconnect();
        };
    }, [isTableOpen, windowWidth]);

    const pad = layoutPadding && typeof layoutPadding === 'object' ? layoutPadding : { left: 55, right: 15 };
    const years = useMemo(() => {
        const raw = result?.years ?? [];
        return [...raw].filter((y) => y <= PAGE52_MAX_YEAR).sort((a, b) => b - a);
    }, [result?.years]);

    useEffect(() => {
        if (years.length > 0 && (selectedYear == null || selectedYear > PAGE52_MAX_YEAR || !years.includes(selectedYear)))
            setSelectedYear(years[0]);
    }, [years, selectedYear]);
    const selectedRow = useMemo(() => (result?.data && selectedYear != null ? result.data.find((r) => r.year === selectedYear) : null), [result?.data, selectedYear]);

    const getSliceLabelKey = (key) => {
        const m = { sh: 'page52_label_space_heating', wh: 'page52_label_water_heating', ae: 'page52_label_auxiliary_equipment', am: 'page52_label_auxiliary_motors', lt: 'page52_label_lighting', sc: 'page52_label_space_cooling' };
        return m[key] || key;
    };

    const orderedSlices = useMemo(() => {
        if (!selectedRow?.slices?.length) return [];
        return CIEU_SLICE_ORDER.map((k) => selectedRow.slices.find((s) => s.key === k)).filter(Boolean);
    }, [selectedRow?.slices]);

    const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18;
    const pieTrace = useMemo(() => {
        if (!orderedSlices.length || orderedSlices.length !== 6) return null;
        const total = selectedRow?.teu;
        if (total == null || total <= 0) return null;
        const values = orderedSlices.map((s) => (s.pj != null && s.pj > 0 ? s.pj : 0.001));
        const labels = orderedSlices.map((s) => getText(getSliceLabelKey(s.key), lang));
        const customdata = orderedSlices.map((s) => s.pct);
        const hoverTexts = orderedSlices.map((s) => {
            const label = getText(getSliceLabelKey(s.key), lang);
            return `<b>${label}</b><br>${Number(s.pj).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { maximumFractionDigits: 1 })} PJ<br>${Number(s.pct).toFixed(1)}%`;
        });
        return {
            type: 'pie',
            values,
            labels,
            customdata,
            hole: 0.55,
            textinfo: 'label+percent',
            textposition: 'outside',
            texttemplate: '%{label}<br>%{customdata:.1f}%',
            textfont: { size: textSize, family: 'Arial, sans-serif', color: CIEU_COLORS },
            outsidetextfont: { size: textSize, color: CIEU_COLORS },
            hovertemplate: '%{customdata}<extra></extra>',
            hovertext: hoverTexts,
            hoverinfo: 'text',
            hoverlabel: { bgcolor: '#fff', font: { color: '#333', size: 14 } },
            marker: { colors: CIEU_COLORS, line: { color: '#fff', width: 1 } },
            direction: 'clockwise',
            sort: false,
        };
    }, [selectedRow, orderedSlices, lang, textSize]);

    const chartTitle = substitute(getText('page52_chart_title', lang), { year: selectedYear ?? '' });
    const centerLabel = getText('page52_center_total', lang);
    const teuFormatted = selectedRow?.teu != null ? Number(selectedRow.teu).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { maximumFractionDigits: 1 }) : '–';

    const tableAllYearsRows = useMemo(() => {
        const data = result?.data;
        if (!Array.isArray(data) || data.length === 0) return [];
        return [...data]
            .filter((r) => r.year <= PAGE52_MAX_YEAR)
            .sort((a, b) => a.year - b.year)
            .map((r) => {
                const row = { year: r.year, total: r.teu };
                CIEU_SLICE_ORDER.forEach((k) => {
                    const slice = r.slices?.find((s) => s.key === k);
                    row[k] = slice?.pj != null ? slice.pj : null;
                });
                return row;
            });
    }, [result?.data]);

    const downloadChartPng = async () => {
        const plotEl = chartRef?.current?.querySelector('.js-plotly-plot');
        if (!plotEl || !window.Plotly) return;
        const safeFilename = (chartTitle || 'chart').replace(/[^\w\s,-]/g, '').replace(/\s+/g, '_').trim() || 'commercial_institutional_energy_by_end_use';
        const fullFilename = `${safeFilename}.png`;
        try {
            await window.Plotly.relayout(plotEl, { paper_bgcolor: '#ffffff', plot_bgcolor: '#ffffff' });
            const imgData = await window.Plotly.toImage(plotEl, { format: 'png', width: 1200, height: 800, scale: 2 });
            await window.Plotly.relayout(plotEl, { paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)' });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                const titleHeight = 60;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#26374a';
                ctx.font = 'bold 20px "Noto Sans", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(chartTitle, canvas.width / 2, 40);
                ctx.drawImage(img, 0, titleHeight);
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = fullFilename;
                link.click();
            };
            img.src = imgData;
        } catch (e) {
            try { await window.Plotly.relayout(plotEl, { paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)' }); } catch (_) {}
        }
    };

    const config = useMemo(() => ({
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
    }), [lang, chartTitle]);

    const downloadTableCSV = () => {
        if (!tableAllYearsRows.length) return;
        const yearCol = lang === 'en' ? 'Year' : 'Année';
        const headers = [yearCol, ...CIEU_SLICE_ORDER.map((k) => getText(getSliceLabelKey(k), lang)), lang === 'en' ? 'Total (PJ)' : 'Total (PJ)'];
        const rows = tableAllYearsRows.map((r) => [r.year, ...CIEU_SLICE_ORDER.map((k) => r[k] != null ? Number(r[k]).toFixed(2) : ''), r.total != null ? Number(r.total).toFixed(2) : '']);
        const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = PAGE52_TABLE_FILENAME_BASE + '.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadTableDocx = async () => {
        if (!tableAllYearsRows.length) return;
        const yearCol = lang === 'en' ? 'Year' : 'Année';
        const headers = [yearCol, ...CIEU_SLICE_ORDER.map((k) => getText(getSliceLabelKey(k), lang)), lang === 'en' ? 'Total (PJ)' : 'Total (PJ)'];
        const headerRow = new TableRow({
            children: headers.map((h) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 22 })], alignment: AlignmentType.CENTER })],
                shading: { fill: 'E6E6E6' },
            })),
        });
        const dataRows = tableAllYearsRows.map((r) => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(r.year), size: 20 })], alignment: AlignmentType.LEFT })] }),
                ...CIEU_SLICE_ORDER.map((k) => new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({ text: r[k] != null ? Number(r[k]).toFixed(2) : '–', size: 20 })],
                        alignment: AlignmentType.RIGHT
                    })]
                })),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.total != null ? Number(r.total).toFixed(2) : '–', size: 20 })], alignment: AlignmentType.RIGHT })] }),
            ],
        }));
        const columnWidths = [800, ...CIEU_SLICE_ORDER.map(() => 1500), 1500];
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: chartTitle, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths,
                        rows: [headerRow, ...dataRows],
                    }),
                ],
            }],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, PAGE52_TABLE_FILENAME_BASE + '.docx');
    };

    const layout = useMemo(() => ({
        showlegend: false,
        margin: { t: 40, b: 60, l: 80, r: 80 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        height: 420,
        annotations: selectedRow?.teu != null ? [{
            text: `${centerLabel}<br>${teuFormatted} PJ`,
            showarrow: false,
            x: 0.5,
            y: 0.5,
            font: { size: 18, color: '#424243', family: 'Arial Black, sans-serif' },
            xref: 'paper',
            yref: 'paper',
        }] : [],
    }), [selectedRow, centerLabel, teuFormatted]);

    if (loading) {
        return (
            <div className="page52-main" style={{ padding: `0 ${pad.right}px 2rem ${pad.left}px` }}>
                <p>{lang === 'en' ? 'Loading...' : 'Chargement...'}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page52-main" style={{ padding: `0 ${pad.right}px 2rem ${pad.left}px` }}>
                <p>{error}</p>
            </div>
        );
    }

    if (!result?.data?.length) {
        return (
            <div className="page52-main" style={{ padding: `0 ${pad.right}px 2rem ${pad.left}px` }}>
                <p>{getText('page52_no_data', lang)}</p>
            </div>
        );
    }

    return (
        <div className="page52-main">
            <style>{`
.page52-main { width: 100%; margin: 0; padding: 0; font-family: 'Noto Sans', sans-serif; }
.page52-stack { width: 100%; padding: 0 ${pad.right}px 2rem ${pad.left}px; box-sizing: border-box; display: flex; flex-direction: column; gap: 0; }
.page52-year-dropdown { position: relative; margin-bottom: 20px; width: 200px; }
.page52-year-dropdown label { display: block; font-size: 14px; font-weight: bold; margin-bottom: 5px; }
.page52-year-dropdown button[aria-expanded] { width: 100%; padding: 10px 15px; background-color: #fff; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; font-weight: bold; text-align: left; display: flex; justify-content: space-between; align-items: center; font-size: 16px; }
.page52-year-dropdown [role="listbox"] { position: absolute; top: 100%; left: 0; width: 100%; max-height: 300px; overflow-y: auto; background-color: #fff; border: 1px solid #ccc; border-radius: 4px; z-index: 100; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
.page52-year-dropdown [role="option"] { display: flex; align-items: center; width: 100%; text-align: left; padding: 10px 15px; cursor: pointer; border: none; border-bottom: 1px solid #eee; background-color: #fff; font-family: Arial, sans-serif; }
.page52-chart-frame { background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-sizing: border-box; overflow: visible; }
.page52-chart-title { font-family: 'Noto Sans', sans-serif; font-size: 20px; font-weight: bold; color: var(--gc-text, #333); margin: 0 0 12px 0; text-align: center; }
.page52-chart { width: 100%; height: 420px; position: relative; z-index: 1; }
.page52-narrative { font-size: 1.1rem; color: #333; line-height: 1.6; margin-top: 1.5rem; max-width: 80ch; }
.page52-narrative p { margin-bottom: 1rem; }
.page52-narrative-line { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35em 0.5rem; margin-bottom: 0.75rem; }
.page52-narrative-line .page52-narrative-text { flex: 1 1 12ch; min-width: 0; }
.page52-narrative-line .page52-narrative-pct { font-weight: bold; color: #c8782a; font-size: 1.25em; }
.page52-narrative-icon { flex-shrink: 0; width: 28px; height: 28px; object-fit: contain; vertical-align: middle; }
.page52-table-responsive { display: block; width: 100%; overflow-x: auto; }
.page52-table-responsive table { width: max-content !important; min-width: 100%; border-collapse: collapse; }
            `}</style>

            <div className="page52-stack">
                    <div className="page52-year-dropdown" ref={yearDropdownRef}>
                        <label htmlFor="page52-year-button">
                            {getText('year_slider_label', lang)}
                        </label>
                        <button
                            ref={yearButtonRef}
                            id="page52-year-button"
                            type="button"
                            onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                            aria-expanded={isYearDropdownOpen}
                            aria-haspopup="listbox"
                            aria-label={selectedYear != null ? String(selectedYear) : ''}
                        >
                            <span>{selectedYear ?? ''}</span>
                            <span aria-hidden="true" style={{ fontSize: '12px' }}>{isYearDropdownOpen ? '▲' : '▼'}</span>
                        </button>
                        {isYearDropdownOpen && (
                            <div role="listbox" aria-label={lang === 'en' ? 'Year' : 'Année'}>
                                {years.map((y) => {
                                    const isSelected = y === selectedYear;
                                    return (
                                        <button
                                            key={y}
                                            role="option"
                                            aria-selected={isSelected}
                                            type="button"
                                            onClick={() => { setSelectedYear(y); setIsYearDropdownOpen(false); setTimeout(() => yearButtonRef.current?.focus(), 0); }}
                                            style={{ backgroundColor: isSelected ? '#f0f9ff' : '#fff' }}
                                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isSelected ? '#f0f9ff' : '#f5f5f5'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isSelected ? '#f0f9ff' : '#fff'; }}
                                        >
                                            <span aria-hidden="true" style={{ height: '18px', width: '18px', borderRadius: '50%', border: '1px solid #ccc', marginRight: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
                                                {isSelected && <span style={{ height: '10px', width: '10px', borderRadius: '50%', backgroundColor: '#000' }} />}
                                            </span>
                                            <span style={{ fontSize: '16px', color: '#333' }}>{y}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <div role="status" className="wb-inv" aria-live="polite">
                            {selectedYear != null ? (lang === 'en' ? `Showing data for ${selectedYear}` : `Données affichées pour ${selectedYear}`) : ''}
                        </div>
                    </div>

                    <div className="page52-chart-frame">
                        <h3 className="page52-chart-title">{chartTitle}</h3>
                        <div className="page52-chart" ref={chartRef} role="region" aria-label={chartTitle}>
                            {pieTrace ? (
                                <Plot
                                    data={[pieTrace]}
                                    layout={layout}
                                    config={config}
                                    style={{ width: '100%', height: '100%' }}
                                    useResizeHandler
                                />
                            ) : (
                                <p style={{ padding: '2rem', textAlign: 'center', color: '#555' }}>
                                    {lang === 'en' ? 'No chart data for the selected year.' : 'Aucune donnée pour l\'année sélectionnée.'}
                                </p>
                            )}
                        </div>
                        <details open={isTableOpen} onToggle={(e) => setIsTableOpen(e.currentTarget.open)} style={{ marginTop: 12, width: '100%' }}>
                            <summary role="button" aria-expanded={isTableOpen} style={{ cursor: 'pointer', color: '#fff', fontWeight: 'bold', padding: '10px', border: '1px solid #26374a', backgroundColor: '#26374a', borderRadius: '4px', listStyle: 'none' }}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                            </summary>
                            <div
                                ref={tableTopRef}
                                style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', marginBottom: 0, display: windowWidth <= 768 ? 'none' : 'block' }}
                                aria-hidden="true"
                            >
                                <div style={{ height: '20px' }} />
                            </div>
                            <div
                                ref={tableScrollRef}
                                className="page52-table-responsive"
                                role="region"
                                aria-labelledby="page52-table-caption"
                                tabIndex={0}
                                style={{ marginTop: 0 }}
                            >
                                <table className="table table-striped table-hover">
                                    <caption id="page52-table-caption" className="wb-inv">{chartTitle}</caption>
                                    <thead>
                                        <tr>
                                            <th scope="col">{lang === 'en' ? 'Year' : 'Année'}</th>
                                            {CIEU_SLICE_ORDER.map((k) => (
                                                <th key={k} scope="col">{getText(getSliceLabelKey(k), lang)} (PJ)</th>
                                            ))}
                                            <th scope="col">{lang === 'en' ? 'Total (PJ)' : 'Total (PJ)'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableAllYearsRows.map((r) => (
                                            <tr key={r.year}>
                                                <td>{r.year}</td>
                                                {CIEU_SLICE_ORDER.map((k) => (
                                                    <td key={k}>{r[k] != null ? Number(r[k]).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { maximumFractionDigits: 2 }) : '–'}</td>
                                                ))}
                                                <td>{r.total != null ? Number(r.total).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { maximumFractionDigits: 2 }) : '–'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button type="button" onClick={downloadTableCSV} style={{ padding: '6px 12px', backgroundColor: '#26374a', border: '1px solid #26374a', borderRadius: '4px', cursor: 'pointer', color: '#fff', fontSize: 14 }}>
                                    {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                </button>
                                <button type="button" onClick={downloadTableDocx} style={{ padding: '6px 12px', backgroundColor: '#26374a', border: '1px solid #26374a', borderRadius: '4px', cursor: 'pointer', color: '#fff', fontSize: 14 }}>
                                    {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                </button>
                            </div>
                        </details>
                    </div>

                    <div className="page52-narrative">
                            {selectedRow && (
                                <>
                                    <div className="page52-narrative-line">
                                        <span className="page52-narrative-text">{substitute(getText('page52_narrative_1', lang), { year: selectedYear })}</span>
                                        {selectedRow.chEuPct != null && selectedRow.chEuWeiPct != null && (
                                            <>
                                                <img src={page52Bg2} alt="" className="page52-narrative-icon" aria-hidden="true" />
                                                <img src={page52Bg3} alt="" className="page52-narrative-icon" aria-hidden="true" />
                                                <span className="page52-narrative-pct">{selectedRow.chEuPct}%</span>
                                            </>
                                        )}
                                    </div>
                                    <div className="page52-narrative-line">
                                        <span className="page52-narrative-text">{getText('page52_narrative_1_but', lang)}</span>
                                        <img src={page52Bg4} alt="" className="page52-narrative-icon" aria-hidden="true" />
                                        {selectedRow.chEuWeiPct != null && <span className="page52-narrative-pct">{selectedRow.chEuWeiPct}%</span>}
                                        <img src={page52Bg5} alt="" className="page52-narrative-icon" aria-hidden="true" />
                                        <span className="page52-narrative-text">{getText('page52_narrative_1_without', lang)}</span>
                                    </div>
                                    {selectedRow.eiPct != null && (
                                        <div className="page52-narrative-line">
                                            <span className="page52-narrative-text">{getText('page52_narrative_2', lang)}</span>
                                            <span className="page52-narrative-pct">{substitute(getText('page52_narrative_2_by', lang), { pct: selectedRow.eiPct })}</span>
                                        </div>
                                    )}
                                    {selectedRow.ee_improvement_pct != null && selectedRow.ee_savings_pj != null && selectedRow.ee_savings_billion != null && (
                                        <p style={{ marginTop: '1rem', marginBottom: 0 }}>
                                            {substitute(getText('page52_narrative_3', lang), {
                                                improvement: selectedRow.ee_improvement_pct,
                                                pj: Number(selectedRow.ee_savings_pj).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { maximumFractionDigits: 0 }),
                                                billion: Number(selectedRow.ee_savings_billion).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
                                                year: selectedYear
                                            })}
                                        </p>
                                    )}
                                </>
                            )}
                    </div>
            </div>
        </div>
    );
};

export default Page52;
