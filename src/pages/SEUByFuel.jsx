import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getSEUByFuelData } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const seu_by_fuel_KEYS = ['Ele', 'NG', 'mogas', 'Oil', 'OOP', 'BM', 'OT'];
const seu_by_fuel_LABEL_KEYS = {
    Ele: 'seu_by_fuel_label_electricity',
    NG: 'seu_by_fuel_label_natural_gas',
    mogas: 'seu_by_fuel_label_motor_gasoline',
    Oil: 'seu_by_fuel_label_oil',
    OOP: 'seu_by_fuel_label_other_oil',
    BM: 'seu_by_fuel_label_biomass',
    OT: 'seu_by_fuel_label_other'
};
const seu_by_fuel_COLORS = ['#657f9b', '#CE8003', '#4b4c4d', '#6b666a', '#1f8093', '#A687A5', '#949494'];

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    return hex;
};

const SEUByFuel = () => {
    const { lang } = useOutletContext();
    const [seuData, setSeuData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const yearDropdownRef = useRef(null);
    const yearButtonRef = useRef(null);
    const chartRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

    useEffect(() => {
        getSEUByFuelData()
            .then((d) => {
                setSeuData(d);
                if (d?.years?.length) setSelectedYear(d.latestYear ?? d.years[d.years.length - 1]);
            })
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target)) setIsYearDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const currentRow = useMemo(() => {
        if (!seuData?.data?.length || selectedYear == null) return null;
        return seuData.data.find((r) => r.year === selectedYear) || null;
    }, [seuData, selectedYear]);

    const baseline = useMemo(() => {
        if (!seuData?.data?.length) return null;
        return seuData.data.find((r) => r.year === 2000) || null;
    }, [seuData]);

    const categories = useMemo(() => {
        if (!currentRow || !currentRow.TE || currentRow.TE <= 0) return [];
        return seu_by_fuel_KEYS.map((key) => {
            const value = currentRow[key] ?? 0;
            const pct = Number(((value / currentRow.TE) * 100).toFixed(1));
            return { key, value, pct };
        });
    }, [currentRow]);

    const TE = currentRow ? Math.round(currentRow.TE) : null;
    const TEX = useMemo(() => {
        if (!baseline?.TE || !currentRow?.TE || baseline.TE <= 0) return null;
        return Math.round(((currentRow.TE - baseline.TE) / baseline.TE) * 100);
    }, [baseline, currentRow]);
    const EleX = useMemo(() => {
        if (!baseline?.Ele || !currentRow?.Ele || baseline.Ele <= 0) return null;
        return Math.round(((currentRow.Ele - baseline.Ele) / baseline.Ele) * 100);
    }, [baseline, currentRow]);
    const NGX = useMemo(() => {
        if (!baseline?.NG || !currentRow?.NG || baseline.NG <= 0) return null;
        return Math.round(((currentRow.NG - baseline.NG) / baseline.NG) * 100);
    }, [baseline, currentRow]);

    /** Same pool as the year dropdown (excludes 2000 baseline from chart series). */
    const yearsListFiltered = useMemo(() => {
        if (!seuData?.years?.length) return [];
        return seuData.years.filter((y) => y !== 2000);
    }, [seuData]);

    const yearsListDesc = useMemo(
        () => [...yearsListFiltered].sort((a, b) => b - a),
        [yearsListFiltered]
    );

    /** Chronological columns for the chart data table (all selector years). */
    const selectorYearsAsc = useMemo(
        () => [...yearsListFiltered].sort((a, b) => a - b),
        [yearsListFiltered]
    );

    /** One row per year (left column = year), fuel PJ/% columns — same pattern as other chart data tables. */
    const secondaryEnergyByFuelYearRows = useMemo(() => {
        if (!seuData?.data?.length || !selectorYearsAsc.length) return [];
        return selectorYearsAsc.map((y) => {
            const row = seuData.data.find((r) => r.year === y);
            const byKey = {};
            if (!row || !row.TE || row.TE <= 0) {
                seu_by_fuel_KEYS.forEach((k) => {
                    byKey[k] = { value: null, pct: null };
                });
                return { year: y, te: null, byKey };
            }
            const te = Math.round(row.TE);
            seu_by_fuel_KEYS.forEach((key) => {
                const value = row[key] ?? 0;
                const pct = Number(((value / row.TE) * 100).toFixed(1));
                byKey[key] = { value: Math.round(value), pct };
            });
            return { year: y, te, byKey };
        });
    }, [seuData, selectorYearsAsc]);

    const chartTitle = useMemo(() => {
        const t = getText('seu_by_fuel_chart_title', lang) || '';
        return selectedYear != null ? t.replace(/\{\{year\}\}/g, String(selectedYear)) : t;
    }, [selectedYear, lang]);

    const donutData = useMemo(() => {
        if (!categories.length) return { values: [], labels: [], hoverTexts: [], total: 0 };
        const values = categories.map((c) => c.value);
        const labels = categories.map((c) => getText(seu_by_fuel_LABEL_KEYS[c.key], lang));
        const hoverTexts = categories.map((c) => {
            const label = getText(seu_by_fuel_LABEL_KEYS[c.key], lang);
            return `<b>${label}</b><br>${Math.round(c.value)} PJ<br>${Number(c.pct).toFixed(1)}%`;
        });
        return { values, labels, hoverTexts, total: TE };
    }, [categories, TE, lang]);

    const zoomLegendMode = windowWidth <= 800;
    const selectEnabled = windowWidth > 768;
    const effectiveSelectedSlices = selectEnabled ? selectedSlices : null;

    const plotData = useMemo(() => {
        if (!donutData.values.length) return [];
        const getColors = () => (effectiveSelectedSlices === null ? seu_by_fuel_COLORS : seu_by_fuel_COLORS.map((c, i) => (effectiveSelectedSlices.includes(i) ? c : hexToRgba(c, 0.3))));
        const pull = effectiveSelectedSlices === null ? donutData.values.map(() => 0.02) : donutData.values.map((_, i) => (effectiveSelectedSlices.includes(i) ? 0.08 : 0.02));
        const labelColors = getColors();
        const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18;
        return [{
            type: 'pie',
            values: donutData.values,
            labels: donutData.labels,
            hole: 0.55,
            direction: 'clockwise',
            sort: false,
            texttemplate: windowWidth <= 768 ? '%{percent:.1%}' : '%{label}<br>%{percent:.1%}',
            textinfo: windowWidth <= 768 ? 'percent' : 'label+percent',
            textposition: windowWidth <= 768 ? 'inside' : 'outside',
            textfont: {
                size: textSize,
                family: 'Arial, sans-serif',
                color: windowWidth <= 768 ? '#fff' : labelColors
            },
            outsidetextfont: { size: textSize, color: labelColors },
            marker: {
                colors: getColors(),
                line: { color: '#fff', width: 1 }
            },
            pull,
            hovertext: donutData.hoverTexts,
            hoverinfo: 'text',
            hoverlabel: { bgcolor: '#fff', font: { color: '#333', size: 14 } },
            automargin: true
        }];
    }, [donutData, effectiveSelectedSlices, windowWidth]);

    const layout = useMemo(() => ({
        showlegend: zoomLegendMode,
        legend: zoomLegendMode ? {
            orientation: 'h',
            y: -0.12,
            x: 0.5,
            xanchor: 'center',
            yanchor: 'top',
            font: { size: 11 },
            itemclick: false,
            itemdoubleclick: false
        } : undefined,
        margin: { t: 100, b: zoomLegendMode ? 120 : 80, l: windowWidth <= 480 ? 0 : 20, r: windowWidth <= 480 ? 0 : 240 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { family: 'Arial, sans-serif', size: 12 },
        clickmode: 'event',
        dragmode: windowWidth <= 768 ? false : 'zoom',
        annotations: donutData.total != null ? [{
            text: `${getText('seu_by_fuel_total', lang)}<br><b>${(donutData.total || 0).toLocaleString()}</b><br>PJ`,
            showarrow: false,
            x: 0.5,
            y: 0.5,
            xref: 'paper',
            yref: 'paper',
            font: { size: 22, color: '#424243', family: 'Arial Black, sans-serif' }
        }] : []
    }), [donutData.total, lang, zoomLegendMode, windowWidth]);

    const scrollToFootnote = (e) => {
        e?.preventDefault();
        document.getElementById('fn-asterisk-secondary-energy-by-fuel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const scrollToRef = (e) => {
        e?.preventDefault();
        document.getElementById('fn-asterisk-rf-secondary-energy-by-fuel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const downloadTableAsCSV = () => {
        if (!secondaryEnergyByFuelYearRows.length) return;
        const yearLabel = lang === 'en' ? 'Year' : 'Année';
        const totalLabel = `${getText('seu_by_fuel_total', lang)} (PJ)`;
        const headers = [
            yearLabel,
            totalLabel,
            ...seu_by_fuel_KEYS.flatMap((key) => {
                const base = getText(seu_by_fuel_LABEL_KEYS[key], lang);
                return [`${base} (PJ)`, `${base} (%)`];
            })
        ];
        const rows = secondaryEnergyByFuelYearRows.map((yr) => {
            const cells = [
                String(yr.year),
                yr.te != null ? String(yr.te) : '',
                ...seu_by_fuel_KEYS.flatMap((key) => {
                    const cell = yr.byKey[key];
                    if (cell?.value == null || cell?.pct == null) return ['', ''];
                    return [String(cell.value), `${cell.pct}%`];
                })
            ];
            return cells;
        });
        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'secondary_energy_use_by_fuel.csv' : 'consommation_energie_secondaire_par_source.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadTableAsDocx = async () => {
        if (!secondaryEnergyByFuelYearRows.length) return;
        const yearLabel = lang === 'en' ? 'Year' : 'Année';
        const totalLabel = `${getText('seu_by_fuel_total', lang)} (PJ)`;
        const headers = [
            yearLabel,
            totalLabel,
            ...seu_by_fuel_KEYS.flatMap((key) => {
                const base = getText(seu_by_fuel_LABEL_KEYS[key], lang);
                return [`${base} (PJ)`, `${base} (%)`];
            })
        ];
        const headerRow = new TableRow({
            children: headers.map((h) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 14 })], alignment: AlignmentType.CENTER })],
                shading: { fill: 'E6E6E6' }
            }))
        });
        const dataRows = secondaryEnergyByFuelYearRows.map((yr) => new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: String(yr.year), size: 18 })], alignment: AlignmentType.CENTER })]
                }),
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: yr.te != null ? String(yr.te) : '–', size: 18 })], alignment: AlignmentType.RIGHT })]
                }),
                ...seu_by_fuel_KEYS.flatMap((key) => {
                    const cell = yr.byKey[key];
                    const pj = cell?.value != null ? String(cell.value) : '–';
                    const pct = cell?.pct != null ? `${cell.pct}%` : '–';
                    return [
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: pj, size: 18 })], alignment: AlignmentType.RIGHT })]
                        }),
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: pct, size: 18 })], alignment: AlignmentType.RIGHT })]
                        })
                    ];
                })
            ]
        }));
        const title = chartTitle;
        const nCols = headers.length;
        const columnWidths = Array.from({ length: nCols }, (_, i) => (i === 0 ? 3600 : 2000));
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths, rows: [headerRow, ...dataRows] })
                ]
            }]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'secondary_energy_use_by_fuel_table.docx' : 'consommation_energie_secondaire_par_source_tableau.docx');
    };

    const downloadChartPng = async () => {
        const plotEl = chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotEl || !window.Plotly) return;
        const baseTitle = lang === 'en' ? "Canada's secondary energy use by fuel type" : "Consommation d'énergie secondaire au Canada par source d'énergie";
        const year = selectedYear != null ? selectedYear : '';
        const displayTitle = (baseTitle + ' ' + year).trim();
        const titleForFile = (baseTitle + ' ' + year).replace(/[^\w\s,-]/g, '').replace(/\s+/g, '_').trim() || 'chart';
        const filename = `${titleForFile}.png`;
        try {
            await window.Plotly.relayout(plotEl, { paper_bgcolor: '#ffffff', plot_bgcolor: '#ffffff' });
            const imgData = await window.Plotly.toImage(plotEl, { format: 'png', width: 1200, height: 800, scale: 2 });
            await window.Plotly.relayout(plotEl, { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent' });
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
                ctx.fillText(displayTitle, canvas.width / 2, 40);
                ctx.drawImage(img, 0, titleHeight);
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = filename;
                link.click();
            };
            img.src = imgData;
        } catch {
            try { await window.Plotly.relayout(plotEl, { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent' }); } catch { /* ignore relayout restore */ }
        }
    };
    const config = {
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d', 'toImage'],
        modeBarButtonsToAdd: [{
            name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: downloadChartPng
        }]
    };

    if (loading) {
        return (
            <div className="secondary-energy-by-fuel-root">
                <p className="secondary-energy-by-fuel-loading">{lang === 'en' ? 'Loading...' : 'Chargement...'}</p>
            </div>
        );
    }

    if (error || !seuData) {
        return (
            <div className="secondary-energy-by-fuel-root">
                <p className="secondary-energy-by-fuel-error">{getText('seu_by_fuel_no_data', lang)}</p>
            </div>
        );
    }

    const hasData = currentRow != null && categories.length > 0;

    return (
        <div className="secondary-energy-by-fuel-root">
            <style>{`
.secondary-energy-by-fuel-chart-frame details > summary:hover { background-color: #404040 !important; }
.secondary-energy-by-fuel-chart-frame button[type="button"]:hover,
.secondary-energy-by-fuel-chart-frame button:hover { background-color: #404040 !important; }
            `}</style>
            <ul className="secondary-energy-by-fuel-bullets">
                <li>{getText('seu_by_fuel_bullet1', lang)}</li>
                {hasData && TE != null && (
                    <li>
                        {(getText('seu_by_fuel_bullet2_was', lang) || '').replace(/\{\{year\}\}/g, String(selectedYear))}
                        <strong>{TE.toLocaleString()}</strong>
                        {getText('seu_by_fuel_bullet2_pj', lang)}
                    </li>
                )}
                {hasData && TEX != null && EleX != null && NGX != null && (
                    <li>
                        {getText('seu_by_fuel_bullet3_prefix', lang)}
                        <strong>{TEX >= 0 ? getText('seu_by_fuel_bullet3_increased_word', lang) : getText('seu_by_fuel_bullet3_decreased_word', lang)}</strong>
                        {' '}
                        <strong>{Math.abs(TEX)}%</strong>
                        {getText('seu_by_fuel_bullet3_mid1', lang)}{selectedYear}.{getText('seu_by_fuel_bullet3_mid2', lang)}
                        <strong>{NGX}%</strong>
                        {getText('seu_by_fuel_bullet3_mid3', lang)}
                        <strong>{EleX}%</strong>
                        {getText('seu_by_fuel_bullet3_suffix', lang)}
                    </li>
                )}
            </ul>

            {hasData && yearsListDesc.length > 0 && (
                <div ref={yearDropdownRef} style={{ position: 'relative', marginBottom: '20px', width: '200px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>
                        {getText('year_slider_label', lang)}
                    </label>
                    <button
                        ref={yearButtonRef}
                        type="button"
                        onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                        aria-expanded={isYearDropdownOpen}
                        style={{
                            width: '100%',
                            padding: '10px 15px',
                            backgroundColor: '#fff',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            textAlign: 'left',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '16px'
                        }}
                    >
                        <span>{selectedYear}</span>
                        <span aria-hidden="true" style={{ fontSize: '12px' }}>{isYearDropdownOpen ? '▲' : '▼'}</span>
                    </button>
                    {isYearDropdownOpen && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            width: '100%',
                            maxHeight: '300px',
                            overflowY: 'auto',
                            backgroundColor: '#fff',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            zIndex: 100,
                            boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                        }}>
                            {yearsListDesc.map((y) => {
                                const isSelected = y === selectedYear;
                                return (
                                    <button
                                        key={y}
                                        type="button"
                                        aria-pressed={isSelected}
                                        aria-label={y.toString()}
                                        onClick={() => {
                                            setSelectedYear(y);
                                            setIsYearDropdownOpen(false);
                                            setTimeout(() => yearButtonRef.current?.focus(), 0);
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: '10px 15px',
                                            cursor: 'pointer',
                                            border: 'none',
                                            borderBottom: '1px solid #eee',
                                            backgroundColor: isSelected ? '#f0f9ff' : '#fff',
                                            fontFamily: 'Arial, sans-serif'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f5f5f5'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isSelected ? '#f0f9ff' : '#fff'; }}
                                    >
                                        <span aria-hidden="true" style={{ height: '18px', width: '18px', borderRadius: '50%', border: '1px solid #ccc', marginRight: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
                                            {isSelected && <span style={{ height: '10px', width: '10px', borderRadius: '50%', backgroundColor: '#000' }} />}
                                        </span>
                                        <span aria-hidden="true" style={{ fontSize: '16px', color: '#333' }}>{y}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <div role="status" className="wb-inv" aria-live="polite">
                        {selectedYear ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${selectedYear}` : ''}
                    </div>
                </div>
            )}

            {hasData && (
                <>
                    <div className="secondary-energy-by-fuel-charts-anchor" style={{ width: '100%', boxSizing: 'border-box' }}>
                        <div className="secondary-energy-by-fuel-chart-wrap" ref={chartRef}>
                            <div className="secondary-energy-by-fuel-chart-frame" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <p className="secondary-energy-by-fuel-chart-title" style={{ textAlign: 'center', width: '100%', boxSizing: 'border-box', margin: '0 0 1rem 0' }}>
                                    {chartTitle}
                                    <span id="fn-asterisk-rf-secondary-energy-by-fuel" style={{ verticalAlign: 'super', fontSize: '0.75em' }}>
                                        <a className="fn-lnk" href="#fn-asterisk-secondary-energy-by-fuel" onClick={scrollToFootnote}>
                                            <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                                            <span aria-hidden="true">*</span>
                                        </a>
                                    </span>
                                </p>
                                <div className="secondary-energy-by-fuel-donut-wrap" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', minHeight: 480 }}>
                                    {effectiveSelectedSlices !== null && (
                                            <div style={{ marginBottom: 8 }}>
                                                <button type="button" onClick={() => setSelectedSlices(null)} style={{ padding: '6px 12px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontSize: 14, color: '#fff' }}>{lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}</button>
                                            </div>
                                        )}
                                        <figure style={{ width: '100%', maxWidth: 800, minWidth: 360, minHeight: 450, height: 450, margin: 0, position: 'relative' }}>
                                        <Plot
                                            key={selectedYear}
                                            data={plotData}
                                            layout={layout}
                                            config={config}
                                            style={{ width: '100%', minWidth: 360, minHeight: 450, height: 450 }}
                                            useResizeHandler
                                            onClick={(eventData) => {
                                                if (!selectEnabled || !eventData.points?.length) return;
                                                const idx = eventData.points[0].pointNumber ?? eventData.points[0].pointIndex;
                                                if (idx == null) return;
                                                if (windowWidth <= 768) {
                                                    const now = Date.now();
                                                    const last = lastPieClickRef.current;
                                                    const samePoint = idx === last.index;
                                                    const doubleTap = samePoint && (now - last.time < 300);
                                                    lastPieClickRef.current = { time: now, index: idx };
                                                    if (!doubleTap) return;
                                                }
                                                setSelectedSlices((prev) => {
                                                    if (prev === null) return [idx];
                                                    if (prev.includes(idx)) return prev;
                                                    return [...prev, idx];
                                                });
                                            }}
                                        />
                                    </figure>
                                </div>

                            <details
                                className="secondary-energy-by-fuel-data-table"
                                open={isTableOpen}
                                onToggle={(e) => setIsTableOpen(e.currentTarget.open)}
                                style={{ marginTop: 12, marginBottom: 24, width: '100%' }}
                            >
                                <summary
                                    role="button"
                                    aria-expanded={isTableOpen}
                                    style={{
                                        cursor: 'pointer',
                                        color: '#ffffff',
                                        fontWeight: 'bold',
                                        padding: '10px',
                                        border: '1px solid #404040',
                                        backgroundColor: '#8C8C8C',
                                        borderRadius: '4px',
                                        listStyle: 'none'
                                    }}
                                >
                                    {isTableOpen ? '▼' : '▶'}
                                    {' '}
                                    {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                    <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                                </summary>
                                <div className="table-responsive" role="region" tabIndex={0} style={{ marginTop: 12, overflowX: 'auto' }}>
                                    <table className="table table-striped table-hover">
                                        <caption id="secondary-energy-by-fuel-table-caption" className="wb-inv">{getText('seu_by_fuel_table_caption', lang)}</caption>
                                        <thead>
                                            <tr>
                                                <th scope="col" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Year' : 'Année'}</th>
                                                <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd', whiteSpace: 'nowrap' }}>{getText('seu_by_fuel_total', lang)} (PJ)</th>
                                                {seu_by_fuel_KEYS.map((key) => (
                                                    <React.Fragment key={key}>
                                                        <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd', whiteSpace: 'nowrap' }}>{getText(seu_by_fuel_LABEL_KEYS[key], lang)} (PJ)</th>
                                                        <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd', whiteSpace: 'nowrap' }}>{getText(seu_by_fuel_LABEL_KEYS[key], lang)} (%)</th>
                                                    </React.Fragment>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {secondaryEnergyByFuelYearRows.map((yr) => (
                                                <tr key={yr.year}>
                                                    <th scope="row" style={{ border: '1px solid #ddd' }}>{yr.year}</th>
                                                    <td style={{ border: '1px solid #ddd', textAlign: 'right' }}>{yr.te != null ? yr.te : '–'}</td>
                                                    {seu_by_fuel_KEYS.map((key) => {
                                                        const cell = yr.byKey[key];
                                                        const show = cell?.value != null && cell?.pct != null;
                                                        return (
                                                            <React.Fragment key={key}>
                                                                <td style={{ border: '1px solid #ddd', textAlign: 'right' }}>{show ? cell.value : '–'}</td>
                                                                <td style={{ border: '1px solid #ddd', textAlign: 'right' }}>{show ? `${cell.pct}%` : '–'}</td>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                                    <button type="button" onClick={downloadTableAsCSV} style={{ padding: '8px 16px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
                                        {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                    </button>
                                    <button type="button" onClick={downloadTableAsDocx} style={{ padding: '8px 16px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
                                        {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                    </button>
                                </div>
                            </details>
                            </div>
                        </div>
                    </div>

                    <aside className="wb-fnote secondary-energy-by-fuel-footnote" role="note">
                        <h2 id="fn">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                        <dl>
                            <dt className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</dt>
                            <dd id="fn-asterisk-secondary-energy-by-fuel">
                                <a href="#fn-asterisk-rf-secondary-energy-by-fuel" onClick={scrollToRef} className="fn-num" title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}>
                                    <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                                </a>
                                {' '}{getText('seu_by_fuel_footnote_other', lang)}
                            </dd>
                            <dd>
                                {getText('seu_by_fuel_footnote_rounding', lang)}
                            </dd>
                        </dl>
                    </aside>
                </>
            )}
        </div>
    );
};

export default SEUByFuel;
