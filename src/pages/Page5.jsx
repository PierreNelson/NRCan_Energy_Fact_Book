import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const PEP_REGIONS = ['BC', 'Alta', 'Sask', 'Man', 'Ont', 'Que', 'NL', 'Territories', 'Maritimes'];
const SOURCES_INCLUDING = ['coal', 'crude_oil', 'natural_gas', 'ngls', 'hydro', 'uranium', 'other_renewables'];
const SOURCES_EXCLUDING = ['coal', 'crude_oil', 'natural_gas', 'ngls', 'hydro', 'nuclear', 'other_renewables'];

const PAGE5_HARDCODED = {
    year: 2023,
    regions: {
        BC: { coal: 20, crude_oil: 380, natural_gas: 1850, ngls: 120, hydro: 1050, uranium: 0, other_renewables: 580 },
        Alta: { coal: 380, crude_oil: 7200, natural_gas: 5800, ngls: 950, hydro: 90, uranium: 0, other_renewables: 580 },
        Sask: { coal: 220, crude_oil: 5200, natural_gas: 1150, ngls: 280, hydro: 180, uranium: 6200, other_renewables: 390 },
        Man: { coal: 0, crude_oil: 40, natural_gas: 10, ngls: 0, hydro: 1050, uranium: 0, other_renewables: 200 },
        Ont: { coal: 0, crude_oil: 0, natural_gas: 80, ngls: 0, hydro: 800, uranium: 2100, other_renewables: 420 },
        Que: { coal: 0, crude_oil: 0, natural_gas: 0, ngls: 0, hydro: 1850, uranium: 0, other_renewables: 180 },
        NL: { coal: 0, crude_oil: 1250, natural_gas: 420, ngls: 90, hydro: 380, uranium: 0, other_renewables: 20 },
        Territories: { coal: 0, crude_oil: 0, natural_gas: 0, ngls: 0, hydro: 30, uranium: 0, other_renewables: 5 },
        Maritimes: { coal: 180, crude_oil: 220, natural_gas: 90, ngls: 20, hydro: 60, uranium: 0, other_renewables: 140 }
    }
};

const COLORS = {
    coal: '#7A7A7A',
    crude_oil: '#9b8a42',
    natural_gas: '#3A9FC8',
    ngls: '#9A9389',
    hydro: '#245e7f',
    uranium: '#1C6B7E',
    nuclear: '#1C6B7E',
    other_renewables: '#857650'
};

const formatProductionByRegionNumber = (num, lang) => {
    if (num === undefined || num === null) return '—';
    return Math.round(num).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');
};

const Page5 = () => {
    const { lang } = useOutletContext();
    const pageData = PAGE5_HARDCODED;
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen1, setIsTableOpen1] = useState(false);
    const [isTableOpen2, setIsTableOpen2] = useState(false);
    const [selectedPoints1, setSelectedPoints1] = useState(null);
    const [selectedPoints2, setSelectedPoints2] = useState(null);
    const chartRef1 = useRef(null);
    const chartRef2 = useRef(null);
    const topScrollRef1 = useRef(null);
    const tableScrollRef1 = useRef(null);
    const topScrollRef2 = useRef(null);
    const tableScrollRef2 = useRef(null);
    const lastClickRef1 = useRef({ time: 0, traceIndex: null, pointIndex: null });
    const lastClickRef2 = useRef({ time: 0, traceIndex: null, pointIndex: null });

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
        const setupSync = (topScroll, tableScroll) => {
            if (!topScroll || !tableScroll) return () => {};
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
        };
        const cleanup1 = setupSync(topScrollRef1.current, tableScrollRef1.current);
        const cleanup2 = setupSync(topScrollRef2.current, tableScrollRef2.current);
        return () => { cleanup1(); cleanup2(); };
    }, [isTableOpen1, isTableOpen2, windowWidth]);

    useEffect(() => {
        const setupChartAccessibility = (ref) => {
            if (!ref?.current) return;
            const plotContainer = ref.current;
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
        };
        const t1 = setTimeout(() => setupChartAccessibility(chartRef1), 500);
        const t2 = setTimeout(() => setupChartAccessibility(chartRef2), 500);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [pageData, lang]);

    const regionLabels = useMemo(() =>
        PEP_REGIONS.map(r => getText(`page5_region_${r}`, lang)),
        [lang]
    );

    const chart1Traces = useMemo(() => {
        if (!pageData || !pageData.regions || Object.keys(pageData.regions).length === 0) return [];
        return SOURCES_INCLUDING.map((sourceKey, traceIndex) => {
            const sourceLabel = getText(sourceKey === 'uranium' ? 'page4_uranium' : `page4_${sourceKey}`, lang);
            const xArr = PEP_REGIONS.map(region => pageData.regions[region]?.[sourceKey] ?? 0);
            const hovertext = PEP_REGIONS.map((region, i) => {
                const val = xArr[i];
                const regionLabelFull = getText(`page5_region_${region}_full`, lang);
                return `<b>${regionLabelFull}</b><br>${sourceLabel}: ${formatProductionByRegionNumber(val, lang)} PJ`;
            });
            const baseColor = COLORS[sourceKey];
            const markerColor = selectedPoints1 === null
                ? baseColor
                : xArr.map((_, pointIndex) => {
                    const isSelected = selectedPoints1.some(p => p.traceIndex === traceIndex && p.pointIndex === pointIndex);
                    return isSelected ? baseColor : hexToRgba(baseColor, 0.3);
                });
            return {
                type: 'bar',
                orientation: 'h',
                name: sourceLabel,
                x: xArr,
                y: regionLabels,
                marker: { color: markerColor },
                hovertext,
                hoverinfo: 'text',
                textinfo: 'none'
            };
        });
    }, [pageData, lang, regionLabels, selectedPoints1]);

    const chart2Traces = useMemo(() => {
        if (!pageData || !pageData.regions || Object.keys(pageData.regions).length === 0) return [];
        return SOURCES_EXCLUDING.map((sourceKey, traceIndex) => {
            const dataKey = sourceKey === 'nuclear' ? 'uranium' : sourceKey;
            const sourceLabel = getText(`page4_${sourceKey}`, lang);
            const xArr = PEP_REGIONS.map(region => pageData.regions[region]?.[dataKey] ?? 0);
            const hovertext = PEP_REGIONS.map((region, i) => {
                const val = xArr[i];
                const regionLabelFull = getText(`page5_region_${region}_full`, lang);
                return `<b>${regionLabelFull}</b><br>${sourceLabel}: ${formatProductionByRegionNumber(val, lang)} PJ`;
            });
            const baseColor = COLORS[sourceKey];
            const markerColor = selectedPoints2 === null
                ? baseColor
                : xArr.map((_, pointIndex) => {
                    const isSelected = selectedPoints2.some(p => p.traceIndex === traceIndex && p.pointIndex === pointIndex);
                    return isSelected ? baseColor : hexToRgba(baseColor, 0.3);
                });
            return {
                type: 'bar',
                orientation: 'h',
                name: sourceLabel,
                x: xArr,
                y: regionLabels,
                marker: { color: markerColor },
                hovertext,
                hoverinfo: 'text',
                textinfo: 'none'
            };
        });
    }, [pageData, lang, regionLabels, selectedPoints2]);

    const xMax = useMemo(() => {
        if (!pageData?.regions) return 16000;
        let total = 0;
        PEP_REGIONS.forEach(region => {
            const r = pageData.regions[region];
            if (!r) return;
            const sum = SOURCES_INCLUDING.reduce((acc, s) => acc + (r[s] || 0), 0);
            if (sum > total) total = sum;
        });
        return Math.max(16000, Math.ceil(total / 2000) * 2000);
    }, [pageData]);

    const stripHtml = (text) => text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

    const downloadChartWithTitle = async (ref, titleKey) => {
        const plotElement = ref?.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        try {
            const title = stripHtml(getText(titleKey, lang));
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
                link.download = lang === 'en' ? 'primary_energy_by_region.png' : 'production_energie_par_region.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            };
            img.src = imgData;
        } catch (e) {
            console.error(e);
        }
    };

    const plotLayout = (xMaxVal) => ({
        barmode: 'stack',
        showlegend: false,
        clickmode: 'event',
        hovermode: 'closest',
        hoverlabel: {
            bgcolor: '#ffffff',
            font: { color: '#000000', size: 14, family: 'Arial, sans-serif' }
        },
        xaxis: {
            title: { text: getText('page5_xaxis', lang), font: { size: windowWidth <= 480 ? 14 : 18, family: 'Arial, sans-serif' }, standoff: 15 },
            range: [0, xMaxVal],
            tick0: 0,
            dtick: 2000,
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
        margin: { l: 80, r: 20, t: 20, b: 80 },
        
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        autosize: true
    });

    const handleChart1Click = (data) => {
        if (!data.points || data.points.length === 0) return;
        const pt = data.points[0];
        const traceIndex = pt.curveNumber;
        const pointIndex = pt.pointIndex;
        if (windowWidth <= 768) {
            const now = Date.now();
            const last = lastClickRef1.current;
            const same = last.traceIndex === traceIndex && last.pointIndex === pointIndex;
            const doubleTap = same && (now - last.time < 300);
            lastClickRef1.current = { time: now, traceIndex, pointIndex };
            if (!doubleTap) return;
        }
        setSelectedPoints1(prev => {
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

    const handleChart2Click = (data) => {
        if (!data.points || data.points.length === 0) return;
        const pt = data.points[0];
        const traceIndex = pt.curveNumber;
        const pointIndex = pt.pointIndex;
        if (windowWidth <= 768) {
            const now = Date.now();
            const last = lastClickRef2.current;
            const same = last.traceIndex === traceIndex && last.pointIndex === pointIndex;
            const doubleTap = same && (now - last.time < 300);
            lastClickRef2.current = { time: now, traceIndex, pointIndex };
            if (!doubleTap) return;
        }
        setSelectedPoints2(prev => {
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

    const downloadTableAsCSV1 = () => {
        const sourceLabels = SOURCES_INCLUDING.map(s => getText(s === 'uranium' ? 'page4_uranium' : `page4_${s}`, lang));
        const headers = [lang === 'en' ? 'Region' : 'Région', ...sourceLabels, lang === 'en' ? 'Total (PJ)' : 'Total (PJ)'];
        const rows = PEP_REGIONS.map(region => {
            const r = pageData.regions[region] || {};
            const vals = SOURCES_INCLUDING.map(s => r[s] ?? 0);
            const total = vals.reduce((a, b) => a + b, 0);
            return [getText(`page5_region_${region}`, lang), ...vals.map(v => formatProductionByRegionNumber(v, lang)), formatProductionByRegionNumber(total, lang)];
        });
        const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'primary_energy_by_region_including.csv' : 'production_energie_par_region_incluant.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadTableAsCSV2 = () => {
        const sourceLabels = SOURCES_EXCLUDING.map(s => getText(`page4_${s}`, lang));
        const headers = [lang === 'en' ? 'Region' : 'Région', ...sourceLabels, lang === 'en' ? 'Total (PJ)' : 'Total (PJ)'];
        const rows = PEP_REGIONS.map(region => {
            const r = pageData.regions[region] || {};
            const vals = SOURCES_EXCLUDING.map(s => (s === 'nuclear' ? r.uranium : r[s]) ?? 0);
            const total = vals.reduce((a, b) => a + b, 0);
            return [getText(`page5_region_${region}`, lang), ...vals.map(v => formatProductionByRegionNumber(v, lang)), formatProductionByRegionNumber(total, lang)];
        });
        const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'primary_energy_by_region_excluding.csv' : 'production_energie_par_region_excluant.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadTableAsDocx1 = async () => {
        const title = stripHtml(getText('page5_title', lang)) + ' – ' + stripHtml(getText('page5_chart1_title', lang));
        const sourceLabels = SOURCES_INCLUDING.map(s => getText(s === 'uranium' ? 'page4_uranium' : `page4_${s}`, lang));
        const headerCells = [lang === 'en' ? 'Region' : 'Région', ...sourceLabels, lang === 'en' ? 'Total (PJ)' : 'Total (PJ)'].map(h =>
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 22 })], alignment: AlignmentType.CENTER })], shading: { fill: 'E6E6E6' } })
        );
        const dataRows = PEP_REGIONS.map(region => {
            const r = pageData.regions[region] || {};
            const vals = SOURCES_INCLUDING.map(s => r[s] ?? 0);
            const total = vals.reduce((a, b) => a + b, 0);
            const cells = [getText(`page5_region_${region}`, lang), ...vals.map(v => formatProductionByRegionNumber(v, lang)), formatProductionByRegionNumber(total, lang)].map((text, i) =>
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(text), size: 22 })], alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER })] })
            );
            return new TableRow({ children: cells });
        });
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [2200, 1400, 1400, 1400, 1400, 1400, 1400, 1400, 1600], rows: [new TableRow({ children: headerCells }), ...dataRows] })
                ]
            }]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'primary_energy_by_region_including.docx' : 'production_energie_par_region_incluant.docx');
    };

    const downloadTableAsDocx2 = async () => {
        const title = stripHtml(getText('page5_title', lang)) + ' – ' + stripHtml(getText('page5_chart2_title', lang));
        const sourceLabels = SOURCES_EXCLUDING.map(s => getText(`page4_${s}`, lang));
        const headerCells = [lang === 'en' ? 'Region' : 'Région', ...sourceLabels, lang === 'en' ? 'Total (PJ)' : 'Total (PJ)'].map(h =>
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 22 })], alignment: AlignmentType.CENTER })], shading: { fill: 'E6E6E6' } })
        );
        const dataRows = PEP_REGIONS.map(region => {
            const r = pageData.regions[region] || {};
            const vals = SOURCES_EXCLUDING.map(s => (s === 'nuclear' ? r.uranium : r[s]) ?? 0);
            const total = vals.reduce((a, b) => a + b, 0);
            const cells = [getText(`page5_region_${region}`, lang), ...vals.map(v => formatProductionByRegionNumber(v, lang)), formatProductionByRegionNumber(total, lang)].map((text, i) =>
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(text), size: 22 })], alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER })] })
            );
            return new TableRow({ children: cells });
        });
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [2200, 1400, 1400, 1400, 1400, 1400, 1400, 1400, 1600], rows: [new TableRow({ children: headerCells }), ...dataRows] })
                ]
            }]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'primary_energy_by_region_excluding.docx' : 'production_energie_par_region_excluant.docx');
    };

    const config = {
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d', 'toImage'],
        modeBarButtonsToAdd: [{
            name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: () => {}
        }]
    };

    const hasData = pageData?.regions && Object.keys(pageData.regions).length > 0;

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-5"
            role="main"
            aria-labelledby="page5-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-5 { width: 100%; }
.page5-container { width: 100%; padding: 15px 0 0 0; display: flex; flex-direction: column; box-sizing: border-box; flex: 1; overflow: visible; }
.page5-title { font-family: 'Lato', sans-serif; font-size: 41px; font-weight: bold; color: var(--gc-text, #332f30); margin-top: 0; margin-bottom: 25px; line-height: 1.2; position: relative; padding-bottom: 0.5em; }
.page5-title::after { content: ''; position: absolute; left: 0; bottom: 0.2em; width: 72px; height: 6px; background-color: var(--gc-red, #A62A1E); }
.page5-chart-frame { background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-sizing: border-box; overflow: visible; }
.page5-chart-title { font-family: 'Lato', sans-serif; font-size: 29px; font-weight: bold; color: #333333; margin-top: 0; margin-bottom: 10px; text-align: center; }
.page5-chart { width: 100%; height: 420px; position: relative; z-index: 1; }
.page5-chart button[type="button"]:hover,
.page5-chart button:hover,
.page5-chart-frame button[type="button"]:hover,
.page5-chart-frame button:hover { background-color: #404040 !important; }
.page5-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 20px 24px; margin-top: 16px; margin-bottom: 10px; font-family: Arial, sans-serif; position: relative; z-index: 10; background-color: #f5f5f5; padding: 10px 0; }
.page5-legend-item { display: flex; align-items: center; gap: 8px; }
.page5-legend-color { width: 20px; height: 12px; display: inline-block; }
.page5-legend-label { font-size: 18px; color: #333333; }
.page5-no-data { font-family: 'Noto Sans', sans-serif; font-size: 18px; color: #555; padding: 24px; text-align: center; }
.page5-table-wrapper { display: block; width: 100%; margin: 20px 0 0 0; }
.page5-table-wrapper details > summary { display: block; width: 100%; padding: 12px 15px; background-color: #8C8C8C; border: 1px solid #404040; border-radius: 4px; cursor: pointer; font-family: Arial, sans-serif; font-weight: bold; color: #ffffff; list-style: none; }
.page5-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page5-table-wrapper details > summary:hover { background-color: #404040 !important; }
.page5-table-wrapper button[type="button"]:hover,
.page5-table-wrapper button:hover { background-color: #404040 !important; }
.page5-table-wrapper .table-responsive { display: block; width: 100%; overflow-x: auto; border: 1px solid #ddd; background: #fff; }
.page5-table-wrapper .table-responsive table { width: max-content; min-width: 100%; border-collapse: collapse; }
@media (max-width: 768px) {
.page5-title { font-size: 37px; }
.page5-chart-title { font-size: 26px; }
.page5-legend-label { font-size: 14px; }
}
            `}</style>
            <div className="page5-container">
                <header role="region" aria-label={getText('page5_title', lang)}>
                    <h1 id="page5-title" className="page5-title" aria-hidden="true">{getText('page5_title', lang)}</h1>
                    <h1 className="wb-inv">{stripHtml(getText('page5_title', lang))}</h1>
                </header>

                <div className="page5-chart-frame">
                    <h2 className="page5-chart-title">{getText('page5_chart1_title', lang)}</h2>
                    {hasData ? (
                        <>
                            <div role="region" aria-label={getText('page5_chart1_title', lang)} tabIndex="0">
                                {selectedPoints1 !== null && selectedPoints1.length > 0 && (
                                        <div style={{ marginBottom: 8 }}>
                                            <button type="button" onClick={() => setSelectedPoints1(null)} style={{ padding: '6px 12px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontSize: 14, color: '#fff' }}>{lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}</button>
                                        </div>
                                    )}
                                    <figure ref={chartRef1} className="page5-chart" style={{ margin: 0, position: 'relative' }}>
                                    <div aria-hidden="true">
                                        <Plot
                                            data={chart1Traces}
                                            layout={plotLayout(xMax)}
                                            config={{ ...config, modeBarButtonsToAdd: [{ name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG', icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' }, click: () => downloadChartWithTitle(chartRef1, 'page5_chart1_title') }] }}
                                            style={{ width: '100%', height: '100%' }}
                                            useResizeHandler={true}
                                            onClick={handleChart1Click}
                                        />
                                    </div>
                                </figure>
                            </div>
                            <div className="page5-legend" aria-hidden="true">
                                {SOURCES_INCLUDING.map(key => (
                                    <div key={key} className="page5-legend-item">
                                        <span className="page5-legend-color" style={{ backgroundColor: COLORS[key] }} />
                                        <span className="page5-legend-label">{getText(`page4_${key}`, lang)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="page5-table-wrapper">
                                <details onToggle={(e) => setIsTableOpen1(e.currentTarget.open)}>
                                    <summary role="button" aria-expanded={isTableOpen1}>
                                        <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen1 ? '▼' : '▶'}</span>
                                        {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                        <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                                    </summary>
                                    <div ref={topScrollRef1} style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', marginBottom: 0, display: windowWidth <= 768 ? 'none' : 'block' }} aria-hidden="true">
                                        <div style={{ height: '20px' }} />
                                    </div>
                                    <div ref={tableScrollRef1} className="table-responsive" role="region" style={{ borderTop: 'none', padding: '15px' }} tabIndex="0">
                                        <table className="table table-striped table-hover">
                                            <caption className="wb-inv">{getText('page5_chart1_title', lang)}</caption>
                                            <thead>
                                                <tr>
                                                    <th scope="col" rowSpan={2} style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd', verticalAlign: 'middle' }}>{lang === 'en' ? 'Region' : 'Région'}</th>
                                                    <th scope="col" colSpan={8} style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{getText('page5_xaxis', lang)}</th>
                                                </tr>
                                                <tr>
                                                    {SOURCES_INCLUDING.map(s => (
                                                        <th key={s} scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd' }}>{getText(s === 'uranium' ? 'page4_uranium' : `page4_${s}`, lang)}</th>
                                                    ))}
                                                    <th scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd' }}>{lang === 'en' ? 'Total' : 'Total'}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {PEP_REGIONS.map(region => {
                                                    const r = pageData.regions[region] || {};
                                                    const vals = SOURCES_INCLUDING.map(s => r[s] ?? 0);
                                                    const total = vals.reduce((a, b) => a + b, 0);
                                                    return (
                                                        <tr key={region}>
                                                            <th scope="row" style={{ fontWeight: 'bold', padding: '8px', border: '1px solid #ddd' }}>{getText(`page5_region_${region}`, lang)}</th>
                                                            {vals.map((v, i) => (
                                                                <td key={i} style={{ textAlign: 'center', padding: '8px', border: '1px solid #ddd' }} aria-label={`${getText(`page5_region_${region}`, lang)}, ${getText(SOURCES_INCLUDING[i] === 'uranium' ? 'page4_uranium' : `page4_${SOURCES_INCLUDING[i]}`, lang)}: ${formatProductionByRegionNumber(v, lang)} PJ`}>{formatProductionByRegionNumber(v, lang)}</td>
                                                            ))}
                                                            <td style={{ textAlign: 'center', padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>{formatProductionByRegionNumber(total, lang)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '15px' }}>
                                            <button type="button" onClick={downloadTableAsCSV1} style={{ padding: '8px 16px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
                                                {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                            </button>
                                            <button type="button" onClick={downloadTableAsDocx1} style={{ padding: '8px 16px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
                                                {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                            </button>
                                        </div>
                                    </div>
                                </details>
                            </div>
                        </>
                    ) : (
                        <p className="page5-no-data">{lang === 'en' ? 'No data available.' : 'Aucune donnée disponible.'}</p>
                    )}
                </div>

                <div className="page5-chart-frame">
                    <h2 className="page5-chart-title">{getText('page5_chart2_title', lang)}</h2>
                    {hasData ? (
                        <>
                            <div role="region" aria-label={getText('page5_chart2_title', lang)} tabIndex="0">
                                {selectedPoints2 !== null && selectedPoints2.length > 0 && (
                                        <div style={{ marginBottom: 8 }}>
                                            <button type="button" onClick={() => setSelectedPoints2(null)} style={{ padding: '6px 12px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontSize: 14, color: '#fff' }}>{lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}</button>
                                        </div>
                                    )}
                                    <figure ref={chartRef2} className="page5-chart" style={{ margin: 0, position: 'relative' }}>
                                    <div aria-hidden="true">
                                        <Plot
                                            data={chart2Traces}
                                            layout={plotLayout(xMax)}
                                            config={{ ...config, modeBarButtonsToAdd: [{ name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG', icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' }, click: () => downloadChartWithTitle(chartRef2, 'page5_chart2_title') }] }}
                                            style={{ width: '100%', height: '100%' }}
                                            useResizeHandler={true}
                                            onClick={handleChart2Click}
                                        />
                                    </div>
                                </figure>
                            </div>
                            <div className="page5-legend" aria-hidden="true">
                                {SOURCES_EXCLUDING.map(key => (
                                    <div key={key} className="page5-legend-item">
                                        <span className="page5-legend-color" style={{ backgroundColor: COLORS[key] }} />
                                        <span className="page5-legend-label">{getText(`page4_${key}`, lang)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="page5-table-wrapper">
                                <details onToggle={(e) => setIsTableOpen2(e.currentTarget.open)}>
                                    <summary role="button" aria-expanded={isTableOpen2}>
                                        <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen2 ? '▼' : '▶'}</span>
                                        {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                        <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                                    </summary>
                                    <div ref={topScrollRef2} style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', marginBottom: 0, display: windowWidth <= 768 ? 'none' : 'block' }} aria-hidden="true">
                                        <div style={{ height: '20px' }} />
                                    </div>
                                    <div ref={tableScrollRef2} className="table-responsive" role="region" style={{ borderTop: 'none', padding: '15px' }} tabIndex="0">
                                        <table className="table table-striped table-hover">
                                            <caption className="wb-inv">{getText('page5_chart2_title', lang)}</caption>
                                            <thead>
                                                <tr>
                                                    <th scope="col" rowSpan={2} style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd', verticalAlign: 'middle' }}>{lang === 'en' ? 'Region' : 'Région'}</th>
                                                    <th scope="col" colSpan={8} style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{getText('page5_xaxis', lang)}</th>
                                                </tr>
                                                <tr>
                                                    {SOURCES_EXCLUDING.map(s => (
                                                        <th key={s} scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd' }}>{getText(`page4_${s}`, lang)}</th>
                                                    ))}
                                                    <th scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd' }}>{lang === 'en' ? 'Total' : 'Total'}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {PEP_REGIONS.map(region => {
                                                    const r = pageData.regions[region] || {};
                                                    const vals = SOURCES_EXCLUDING.map(s => (s === 'nuclear' ? r.uranium : r[s]) ?? 0);
                                                    const total = vals.reduce((a, b) => a + b, 0);
                                                    return (
                                                        <tr key={region}>
                                                            <th scope="row" style={{ fontWeight: 'bold', padding: '8px', border: '1px solid #ddd' }}>{getText(`page5_region_${region}`, lang)}</th>
                                                            {vals.map((v, i) => (
                                                                <td key={i} style={{ textAlign: 'center', padding: '8px', border: '1px solid #ddd' }} aria-label={`${getText(`page5_region_${region}`, lang)}, ${getText(`page4_${SOURCES_EXCLUDING[i]}`, lang)}: ${formatProductionByRegionNumber(v, lang)} PJ`}>{formatProductionByRegionNumber(v, lang)}</td>
                                                            ))}
                                                            <td style={{ textAlign: 'center', padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>{formatProductionByRegionNumber(total, lang)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '15px' }}>
                                            <button type="button" onClick={downloadTableAsCSV2} style={{ padding: '8px 16px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
                                                {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                            </button>
                                            <button type="button" onClick={downloadTableAsDocx2} style={{ padding: '8px 16px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
                                                {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                            </button>
                                        </div>
                                    </div>
                                </details>
                            </div>
                        </>
                    ) : (
                        <p className="page5-no-data">{lang === 'en' ? 'No data available.' : 'Aucune donnée disponible.'}</p>
                    )}
                </div>
            </div>
        </main>
    );
};

export default Page5;
