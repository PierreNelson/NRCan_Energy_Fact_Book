import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getIndustrialEnergyUseData, industrialEnergyUseRowHasCompleteData } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const PIE_ORDER = ['NG', 'DFOx', 'SGPC', 'WWPL', 'Other_x', 'Ele'];
const TABLE_ORDER = ['Ele', 'NG', 'DFOx', 'SGPC', 'WWPL', 'Other_x'];
const LABEL_KEYS = {
    Ele: 'page53_label_electricity',
    NG: 'page53_label_natural_gas',
    DFOx: 'page53_label_diesel_fuel_oil',
    SGPC: 'page53_label_still_gas_petroleum_coke',
    WWPL: 'page53_label_wood_waste',
    Other_x: 'page53_label_other'
};
const COLORS = {
    Ele: '#4b4c4d',
    NG: '#D28004',
    DFOx: '#A687A5',
    SGPC: '#6b87a6',
    WWPL: '#1f8c9b',
    Other_x: '#949494'
};
const MIN_DISPLAY_YEAR = 2022;

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    return hex;
};

const substitute = (text, vars) => Object.keys(vars || {}).reduce((s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '–')), text || '');

const Page53 = () => {
    const outlet = useOutletContext();
    const lang = outlet?.lang ?? 'en';
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const yearDropdownRef = useRef(null);
    const yearButtonRef = useRef(null);
    const chartRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });
    const tableTopRef = useRef(null);
    const tableScrollRef = useRef(null);
    const tableBottomRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const formatNumber = (num, digits = 0) => {
        if (num == null || Number.isNaN(Number(num))) return '–';
        return Number(num).toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    };
    const formatFlexible = (num, maxDigits = 1) => {
        if (num == null || Number.isNaN(Number(num))) return '–';
        return Number(num).toLocaleString(locale, { maximumFractionDigits: maxDigits });
    };
    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const scrollToElement = (id) => (e) => {
        e?.preventDefault();
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    useEffect(() => {
        getIndustrialEnergyUseData()
            .then((d) => {
                setResult(d);
                const available = (d?.years || []).filter((y) => y >= MIN_DISPLAY_YEAR);
                if (available.length) setSelectedYear(Math.max(...available));
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
    const years = [...new Set(dataRows.filter(industrialEnergyUseRowHasCompleteData).map((r) => r.year))]
        .filter((y) => y >= MIN_DISPLAY_YEAR)
        .sort((a, b) => b - a);
    const selectedRow = selectedYear == null ? null : dataRows.find((r) => r.year === selectedYear) || null;
    const tableRows = dataRows
        .filter((r) => r.year >= MIN_DISPLAY_YEAR && industrialEnergyUseRowHasCompleteData(r))
        .sort((a, b) => a.year - b.year);
    const chartTitle = substitute(getText('page53_chart_title', lang), { year: selectedYear ?? '' });
    const yearRange = tableRows.length ? `${tableRows[0].year}-${tableRows[tableRows.length - 1].year}` : '';
    const tableFileTitle = lang === 'en'
        ? `Canada's secondary energy use by fuel type ${yearRange}`
        : `Consommation d'énergie secondaire du Canada par source d'énergie ${yearRange}`;
    const pngFileTitle = lang === 'en'
        ? `Canada's secondary energy use by fuel type ${selectedYear ?? ''}`
        : `Consommation d'énergie secondaire du Canada par source d'énergie ${selectedYear ?? ''}`;

    const pieCategories = selectedRow?.slices?.length ? PIE_ORDER.map((key) => selectedRow.slices.find((s) => s.key === key)).filter(Boolean) : [];
    const zoomLegendMode = windowWidth <= 800;
    const effectiveSlices = windowWidth > 768 ? selectedSlices : null;
    const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 17;
    const pieValues = pieCategories.map((s) => (s.pj != null && s.pj > 0 ? s.pj : 0.001));
    const pieBaseColors = pieCategories.map((s) => COLORS[s.key]);
    const pieColors = effectiveSlices?.length
        ? pieBaseColors.map((c, i) => (effectiveSlices.includes(i) ? c : hexToRgba(c, 0.3)))
        : pieBaseColors;
    const pieTrace = selectedRow?.teu && pieCategories.length ? {
        type: 'pie',
        values: pieValues,
        labels: pieCategories.map((s) => getText(LABEL_KEYS[s.key], lang)),
        customdata: pieCategories.map((s) => s.pct),
        hole: 0.55,
        direction: 'clockwise',
        sort: false,
        texttemplate: windowWidth <= 768 ? '%{customdata:.0f}%' : '%{label}<br>%{customdata:.0f}%',
        textinfo: windowWidth <= 768 ? 'percent' : 'label+percent',
        textposition: windowWidth <= 768 ? 'inside' : 'outside',
        textfont: { size: textSize, family: 'Arial, sans-serif', color: windowWidth <= 768 ? '#ffffff' : pieColors },
        outsidetextfont: { size: textSize, color: pieColors },
        marker: { colors: pieColors, line: { color: '#ffffff', width: 1 } },
        pull: effectiveSlices?.length ? pieValues.map((_, i) => (effectiveSlices.includes(i) ? 0.08 : 0.02)) : pieValues.map(() => 0.02),
        hovertext: pieCategories.map((s) => `<b>${getText(LABEL_KEYS[s.key], lang)}</b><br>${formatFlexible(s.pj, 1)} PJ<br>${formatFlexible(s.pct, 1)}%`),
        hoverinfo: 'text',
        hoverlabel: { bgcolor: '#ffffff', font: { color: '#333333', size: 14, family: 'Arial, sans-serif' } },
        automargin: true
    } : null;

    const layout = {
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
        margin: {
            t: 105,
            b: zoomLegendMode ? 120 : 70,
            l: windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 80,
            r: windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 190
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        height: windowWidth <= 480 ? 430 : 520,
        clickmode: 'event',
        dragmode: windowWidth <= 768 ? false : 'zoom',
        annotations: selectedRow?.teu != null ? [{
            text: `${getText('page53_center_total', lang)}<br><b>${formatNumber(selectedRow.teu)}</b><br>PJ`,
            showarrow: false,
            x: 0.5,
            y: 0.5,
            xref: 'paper',
            yref: 'paper',
            font: { size: windowWidth <= 480 ? 15 : 20, color: '#424243', family: 'Arial Black, sans-serif' }
        }] : []
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
                ctx.fillText(pngFileTitle, canvas.width / 2, 44);
                ctx.drawImage(img, 0, titleHeight);
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = `${pngFileTitle}.png`;
                link.click();
            };
            img.src = imgData;
        } catch (error) {
            console.warn('Unable to download chart image.', error);
            try {
                await window.Plotly.relayout(plotEl, { paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)' });
            } catch (restoreError) {
                console.warn('Unable to restore chart background.', restoreError);
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
        lang === 'en' ? 'Total (PJ)' : 'Total (PJ)',
        ...TABLE_ORDER.flatMap((key) => [`${getText(LABEL_KEYS[key], lang)} (PJ)`, `${getText(LABEL_KEYS[key], lang)} (%)`]),
        lang === 'en' ? 'Change since 2000 (%)' : 'Variation depuis 2000 (%)',
        lang === 'en' ? 'Energy efficiency improvement (%)' : 'Amélioration de l’efficacité énergétique (%)',
        lang === 'en' ? 'Energy savings (PJ)' : 'Économies d’énergie (PJ)',
        lang === 'en' ? 'Energy cost savings ($ billion)' : 'Économies de coûts énergétiques (milliards de dollars)'
    ];

    const tableCellsForRow = (row) => [
        row.year,
        row.teu != null ? Number(row.teu).toFixed(2) : '',
        ...TABLE_ORDER.flatMap((key) => {
            const slice = row.slices?.find((s) => s.key === key);
            return [
                slice?.pj != null ? Number(slice.pj).toFixed(2) : '',
                slice?.pct != null ? Number(slice.pct).toFixed(1) : ''
            ];
        }),
        row.change_since_2000_pct ?? '',
        row.ee_improvement_pct ?? '',
        row.ee_savings_pj ?? '',
        row.ee_savings_billion ?? ''
    ];

    const downloadTableCSV = () => {
        if (!tableRows.length) return;
        const rows = tableRows.map((row) => tableCellsForRow(row));
        const csv = [headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${tableFileTitle}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadTableDocx = async () => {
        if (!tableRows.length) return;
        const headerRow = new TableRow({
            children: headers.map((h) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 14 })], alignment: AlignmentType.CENTER })],
                shading: { fill: 'E6E6E6' }
            }))
        });
        const dataRows = tableRows.map((row) => new TableRow({
            children: tableCellsForRow(row).map((cell, i) => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: cell === '' ? '–' : String(cell), size: 16 })],
                    alignment: i === 0 ? AlignmentType.CENTER : AlignmentType.RIGHT
                })]
            }))
        }));
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: tableFileTitle, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [700, 1100, ...TABLE_ORDER.flatMap(() => [1350, 900]), 1200, 1500, 1200, 1500],
                        rows: [headerRow, ...dataRows]
                    })
                ]
            }]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${tableFileTitle}.docx`);
    };

    const renderBulletTwo = () => {
        const pct = selectedRow?.change_since_2000_pct;
        const key = pct != null && pct < 0 ? 'page53_bullet2_bold_decreased' : 'page53_bullet2_bold';
        return (
            <>
                {substitute(getText('page53_bullet2_prefix', lang), { year: selectedYear ?? '–' })}
                <strong>{substitute(getText(key, lang), { pct: pct != null ? Math.abs(pct) : '–' })}</strong>
            </>
        );
    };

    if (loading) return <p>{lang === 'en' ? 'Loading...' : 'Chargement...'}</p>;
    if (error) return <p>{error}</p>;
    if (!result?.data?.length || !selectedRow) return <p>{getText('page53_no_data', lang)}</p>;

    return (
        <main id="main-content" tabIndex="-1" className="page-content page-53" role="main" aria-labelledby="page53-chart-title" style={{ backgroundColor: '#ffffff' }}>
            <style>{`
.page-53 { width: 100%; }
.page53-container { width: 100%; padding: 15px 0 0 0; display: flex; flex-direction: column; box-sizing: border-box; flex: 1; overflow: visible; }
.page53-bullets { font-family: 'Noto Sans', sans-serif; font-size: 20px; color: var(--gc-text); line-height: 1.45; margin: 0 0 20px 0; padding-left: 1.35rem; max-width: 78ch; }
.page53-bullets li { margin-bottom: 10px; }
.page53-year-dropdown { position: relative; margin-bottom: 20px; width: 200px; font-family: Arial, sans-serif; }
.page53-year-dropdown label { display: block; font-size: 14px; font-weight: bold; margin-bottom: 5px; }
.page53-year-dropdown button[aria-expanded] { width: 100%; padding: 10px 15px; background-color: #fff; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; font-weight: bold; text-align: left; display: flex; justify-content: space-between; align-items: center; font-size: 16px; color: #333; }
.page53-year-dropdown [role="listbox"] { position: absolute; top: 100%; left: 0; width: 100%; max-height: 300px; overflow-y: auto; background-color: #fff; border: 1px solid #ccc; border-radius: 4px; z-index: 100; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
.page53-year-dropdown [role="option"] { display: flex; align-items: center; width: 100%; text-align: left; padding: 10px 15px; cursor: pointer; border: none; border-bottom: 1px solid #eee; background-color: #fff; font-family: Arial, sans-serif; }
.page53-chart-frame { background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-top: 0; margin-bottom: 20px; box-sizing: border-box; overflow: visible; }
.section-four-page .page-53 .page53-chart-frame { padding-bottom: 20px !important; margin-bottom: 20px !important; }
.page53-chart-title { font-family: 'Lato', sans-serif; font-size: 29px; font-weight: bold; color: var(--gc-text); text-align: center; margin: 0 0 5px 0; }
.page53-chart-scroll { width: 100%; overflow: hidden; display: flex; justify-content: center; }
.page53-chart { width: 100%; min-width: 0; height: 520px; position: relative; z-index: 1; overflow: visible; flex-shrink: 0; }
.page53-chart > div { width: 100%; height: 100%; overflow: visible; }
.page53-chart .js-plotly-plot,
.page53-chart .plot-container,
.page53-chart .svg-container { overflow: visible !important; }
.page53-clear-selection { padding: 6px 12px; background-color: #8C8C8C; border: 1px solid #404040; border-radius: 4px; cursor: pointer; font-family: Arial, sans-serif; font-size: 14px; color: #fff; margin-bottom: 8px; }
.page53-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.page53-table-wrapper details > summary { display: block; width: 100%; padding: 12px 15px; background-color: #8C8C8C; border: 1px solid #404040; border-radius: 4px; cursor: pointer; font-family: Arial, sans-serif; font-weight: bold; color: #ffffff; list-style: none; }
.page53-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page53-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page53-table-scrollbar > div { height: 20px; }
.page53-table-responsive { display: block; width: 100%; overflow-x: auto; border: 1px solid #ddd; background: #fff; }
.page53-table-responsive { scrollbar-width: none; -ms-overflow-style: none; }
.page53-table-responsive::-webkit-scrollbar { display: none; }
.page53-table-responsive table { width: max-content !important; min-width: 100%; border-collapse: collapse; }
.page53-table-responsive th, .page53-table-responsive td { white-space: nowrap; padding: 8px 12px; font-family: Arial, sans-serif; color: var(--gc-text); border: 1px solid #ddd; }
.page53-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.page53-download-buttons button { padding: 8px 16px; border: 1px solid #404040; border-radius: 4px; background: #8C8C8C; cursor: pointer; font-family: Arial, sans-serif; font-weight: bold; color: #ffffff; }
.page53-chart-frame button:hover, .page53-table-wrapper summary:hover { background-color: #404040 !important; }
.page53-footnotes { font-family: var(--font-body); font-size: 1rem; color: var(--gc-text); margin-top: 24px; margin-bottom: 0; padding-top: 12px; border-top: 1px solid #e0e0e0; line-height: 1.65; max-width: 100%; box-sizing: border-box; }
.page53-footnotes h2 { font-family: var(--font-heading); font-size: 1.4rem; font-weight: 700; color: var(--gc-text); margin-top: 0; margin-bottom: 1rem; }
.page53-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
@media (max-width: 768px) {
    .page-53 { border-right: none !important; }
    .page53-bullets { font-size: 18px; }
    .page53-chart-title { font-size: 26px; }
    .page53-footnotes { font-size: 0.9rem; }
    .page53-footnotes h2 { font-size: 1.2rem; margin-bottom: 0.75rem; }
}
@media (max-width: 480px) {
    .page53-chart { height: 430px; }
}
            `}</style>
            <div className="page53-container">
                <ul className="page53-bullets">
                    <li><strong>{getText('page53_bullet1_bold', lang)}</strong>{getText('page53_bullet1_text', lang)}</li>
                    <li>{renderBulletTwo()}</li>
                    <li>
                        {getText('page53_bullet3_prefix', lang)}
                        <strong>{substitute(getText('page53_bullet3_mid1', lang), { improvement: formatFlexible(selectedRow.ee_improvement_pct, 0) })}</strong>
                        {getText('page53_bullet3_mid2', lang)}
                        <strong>{substitute(getText('page53_bullet3_mid3', lang), { pj: formatFlexible(selectedRow.ee_savings_pj, 0) })}</strong>
                        {getText('page53_bullet3_mid4', lang)}
                        <strong>{substitute(getText('page53_bullet3_mid5', lang), { billion: formatNumber(selectedRow.ee_savings_billion, 1) })}</strong>
                        {substitute(getText('page53_bullet3_suffix', lang), { year: selectedYear })}
                    </li>
                </ul>

                <div className="page53-year-dropdown" ref={yearDropdownRef}>
                    <label htmlFor="page53-year-button">{getText('year_slider_label', lang)}</label>
                    <button ref={yearButtonRef} id="page53-year-button" type="button" onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)} aria-expanded={isYearDropdownOpen} aria-haspopup="listbox" aria-label={selectedYear != null ? String(selectedYear) : ''}>
                        <span>{selectedYear ?? ''}</span>
                        <span aria-hidden="true" style={{ fontSize: '12px' }}>{isYearDropdownOpen ? '▲' : '▼'}</span>
                    </button>
                    {isYearDropdownOpen && (
                        <div role="listbox" aria-label={lang === 'en' ? 'Year' : 'Année'}>
                            {years.map((year) => {
                                const isSelected = year === selectedYear;
                                return (
                                    <button key={year} role="option" aria-selected={isSelected} type="button" onClick={() => { setSelectedYear(year); setSelectedSlices(null); setIsYearDropdownOpen(false); setTimeout(() => yearButtonRef.current?.focus(), 0); }} style={{ backgroundColor: isSelected ? '#f0f9ff' : '#fff' }}>
                                        <span aria-hidden="true" style={{ height: '18px', width: '18px', borderRadius: '50%', border: '1px solid #ccc', marginRight: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
                                            {isSelected && <span style={{ height: '10px', width: '10px', borderRadius: '50%', backgroundColor: '#000' }} />}
                                        </span>
                                        <span style={{ fontSize: '16px', color: '#333' }}>{year}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <div role="status" className="wb-inv" aria-live="polite">
                        {selectedYear != null ? (lang === 'en' ? `Showing data for ${selectedYear}` : `Données affichées pour ${selectedYear}`) : ''}
                    </div>
                </div>

                <div className="page53-chart-frame">
                    <h2 id="page53-chart-title" className="page53-chart-title">
                        {chartTitle}
                        <sup id="fn-other-rf-page53">
                            <a className="fn-lnk" href="#fn-other-page53" onClick={scrollToElement('fn-other-page53')}>
                                <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>*
                            </a>
                        </sup>
                    </h2>
                    {effectiveSlices?.length > 0 && <button type="button" className="page53-clear-selection" onClick={() => setSelectedSlices(null)}>{lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}</button>}
                    <div className="page53-chart-scroll">
                        <figure ref={chartRef} className="page53-chart" role="region" aria-label={chartTitle} tabIndex="0" style={{ margin: 0 }}>
                            <div aria-hidden="true">
                                {pieTrace && (
                                    <Plot
                                        key={`page53-${selectedYear}-${effectiveSlices ? effectiveSlices.join('-') : 'none'}`}
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
                                            setSelectedSlices((prev) => {
                                                if (prev === null) return [index];
                                                if (prev.includes(index)) return prev.length <= 1 ? null : prev.filter((i) => i !== index);
                                                return [...prev, index];
                                            });
                                        }}
                                    />
                                )}
                            </div>
                        </figure>
                    </div>
                    <div className="page53-table-wrapper">
                        <details className="page53-data-table" onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                            </summary>
                            <div ref={tableTopRef} className="page53-table-scrollbar" aria-hidden="true"><div /></div>
                            <div ref={tableScrollRef} className="page53-table-responsive" role="region" aria-labelledby="page53-table-caption" tabIndex={0}>
                                <table className="table table-striped table-hover">
                                    <caption id="page53-table-caption" className="wb-inv">{getText('page53_table_caption', lang)}</caption>
                                    <thead>
                                        <tr>
                                            {headers.map((header) => (
                                                <th key={header} scope="col">
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableRows.map((row) => (
                                            <tr key={row.year}>
                                                <th scope="row">{row.year}</th>
                                                <td style={{ textAlign: 'right' }}>{formatFlexible(row.teu, 2)}</td>
                                                {TABLE_ORDER.map((key) => {
                                                    const slice = row.slices?.find((s) => s.key === key);
                                                    return (
                                                        <React.Fragment key={key}>
                                                            <td style={{ textAlign: 'right' }}>{formatFlexible(slice?.pj, 2)}</td>
                                                            <td style={{ textAlign: 'right' }}>{slice?.pct != null ? `${formatFlexible(slice.pct, 1)}%` : '–'}</td>
                                                        </React.Fragment>
                                                    );
                                                })}
                                                <td style={{ textAlign: 'right' }}>{row.change_since_2000_pct != null ? `${row.change_since_2000_pct}%` : '–'}</td>
                                                <td style={{ textAlign: 'right' }}>{row.ee_improvement_pct != null ? `${formatFlexible(row.ee_improvement_pct, 0)}%` : '–'}</td>
                                                <td style={{ textAlign: 'right' }}>{formatFlexible(row.ee_savings_pj, 0)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatNumber(row.ee_savings_billion, 1)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div ref={tableBottomRef} className="page53-table-scrollbar" aria-hidden="true"><div /></div>
                            <div className="page53-download-buttons">
                                <button type="button" onClick={downloadTableCSV}>{lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}</button>
                                <button type="button" onClick={downloadTableDocx}>{lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}</button>
                            </div>
                        </details>
                    </div>
                </div>

                <aside className="wb-fnote page53-footnotes" role="note">
                    <h2 id="fn">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</dt>
                        <dd id="fn-other-page53">
                            <a href="#fn-other-rf-page53" onClick={scrollToElement('fn-other-rf-page53')} className="fn-num" title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}>
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                            </a>
                            {' '}{getText('page53_footnote_other', lang)}
                        </dd>
                        <dd>{getText('page53_footnote_rounding', lang)}</dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page53;
