import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getEnergyUseData } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const energy_use_PIE_KEYS = ['pie_secondary', 'pie_losses', 'pie_nonenergy', 'pie_noncovered', 'pie_pipeline'];
const energy_use_BAR_KEYS = ['bar_industrial', 'bar_transportation', 'bar_residential', 'bar_commercial', 'bar_agriculture'];
const ENERGY_USE_PIE_FIELDS = ['TSEU', 'EL', 'NPC', 'FK', 'P'];
const energy_use_BAR_FIELDS = ['I', 'T', 'R', 'C', 'A'];
const energy_use_PIE_COLORS = ['#fcb340', '#657f9b', '#1f8093', '#6b666a', '#4b4c4d'];
const energy_use_BAR_COLORS = ['#c88d34', '#A687A5', '#7F94AD', '#577F6A', '#50A569'];

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    return hex;
};

const formatPJ = (n, lang) => {
    if (n === undefined || n === null) return '—';
    return Math.round(Number(n)).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');
};

const EnergyUse = () => {
    const { lang } = useOutletContext();
    const [data, setData] = useState({ years: [], data: [] });
    const [selectedYear, setSelectedYear] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
    const [zoomLegendMode, setZoomLegendMode] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isPieTableOpen, setIsPieTableOpen] = useState(false);
    const [isBarTableOpen, setIsBarTableOpen] = useState(false);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const [selectedBars, setSelectedBars] = useState(null);
    const yearDropdownRef = useRef(null);
    const yearButtonRef = useRef(null);
    const chartRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });
    const pieTableTopRef = useRef(null);
    const pieTableScrollRef = useRef(null);
    const barTableTopRef = useRef(null);
    const barTableScrollRef = useRef(null);

    useEffect(() => {
        const checkZoom = () => setZoomLegendMode(window.innerWidth < 800);
        checkZoom();
        window.addEventListener('resize', checkZoom);
        return () => window.removeEventListener('resize', checkZoom);
    }, []);
    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const scrollToFootnote = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-energy-use')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const scrollToRef = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-rf-energy-use')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    useEffect(() => {
        getEnergyUseData()
            .then((d) => {
                setData(d);
                if (d.years && d.years.length > 0) {
                    setSelectedYear(d.years[d.years.length - 1]);
                }
            })
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target)) {
                setIsYearDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
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
        const topScroll = pieTableTopRef.current;
        const tableScroll = pieTableScrollRef.current;
        if (!topScroll || !tableScroll || !isPieTableOpen) return;
        const handleTopScroll = () => { if (tableScroll.scrollLeft !== topScroll.scrollLeft) tableScroll.scrollLeft = topScroll.scrollLeft; };
        const handleTableScroll = () => { if (topScroll.scrollLeft !== tableScroll.scrollLeft) topScroll.scrollLeft = tableScroll.scrollLeft; };
        const sync = () => window.requestAnimationFrame(() => syncTableScroll(pieTableTopRef, pieTableScrollRef));
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
    }, [isPieTableOpen, windowWidth]);
    useEffect(() => {
        const topScroll = barTableTopRef.current;
        const tableScroll = barTableScrollRef.current;
        if (!topScroll || !tableScroll || !isBarTableOpen) return;
        const handleTopScroll = () => { if (tableScroll.scrollLeft !== topScroll.scrollLeft) tableScroll.scrollLeft = topScroll.scrollLeft; };
        const handleTableScroll = () => { if (topScroll.scrollLeft !== tableScroll.scrollLeft) topScroll.scrollLeft = tableScroll.scrollLeft; };
        const sync = () => window.requestAnimationFrame(() => syncTableScroll(barTableTopRef, barTableScrollRef));
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
    }, [isBarTableOpen, windowWidth]);

    const row = useMemo(() => {
        if (!data.data || !selectedYear) return null;
        return data.data.find((r) => r.year === selectedYear) || null;
    }, [data.data, selectedYear]);

    const computed = useMemo(() => {
        if (!row) return null;
        const R = Number(row.R);
        const C = Number(row.C);
        const I = Number(row.I);
        const T = Number(row.T);
        const A = Number(row.A);
        const P = Number(row.P);
        const NPC = Number(row.NPC);
        const FK = Number(row.FK);
        const EL = Number(row.EL);
        const TSEU = R + C + I + T + A;
        const TPD = TSEU + P + NPC + FK + EL;
        const barVals = [I, T, R, C, A];
        const barPct = TSEU > 0 ? barVals.map((v) => (v / TSEU) * 100) : [0, 0, 0, 0, 0];
        return {
            TSEU,
            TPD,
            R,
            C,
            I,
            T,
            A,
            P,
            NPC,
            FK,
            EL,
            pieValues: [TSEU, EL, NPC, FK, P],
            barValues: barVals,
            barPct
        };
    }, [row]);

    const stripHtml = (text) => text ? String(text).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

    const yearsList = data.years || [];
    const hasData = yearsList.length > 0 && computed;

    const pieChartData = useMemo(() => {
        if (!computed || computed.TPD <= 0) return null;
        const hoverTexts = [];
        const labels = energy_use_PIE_KEYS.map((k) => getText('energy_use_' + k, lang));
        computed.pieValues.forEach((val, i) => {
            const pct = computed.TPD > 0 ? (val / computed.TPD) * 100 : 0;
            hoverTexts.push(`<b>${labels[i]}</b><br>${formatPJ(val, lang)} PJ<br>${pct.toFixed(0)}%`);
        });
        return { labels, hoverTexts, colors: energy_use_PIE_COLORS };
    }, [computed, lang]);

    const pieData = useMemo(() => {
        if (!pieChartData || !computed || computed.TPD <= 0) return [];
        const { labels, hoverTexts, colors } = pieChartData;
        const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18;
        const getColors = () => {
            if (selectedSlices === null) return colors;
            return colors.map((c, i) => selectedSlices.includes(i) ? c : hexToRgba(c, 0.3));
        };
        return [{
            type: 'pie',
            values: computed.pieValues,
            labels,
            hole: 0.45,
            direction: 'clockwise',
            sort: false,
            texttemplate: windowWidth <= 768 ? '%{percent:.0%}' : '%{label}<br>%{percent:.0%}',
            textinfo: windowWidth <= 768 ? 'percent' : 'label+percent',
            textposition: windowWidth <= 768 ? 'inside' : 'outside',
            textfont: {
                size: textSize,
                family: 'Arial, sans-serif',
                color: windowWidth <= 768 ? '#fff' : getColors()
            },
            outsidetextfont: { color: getColors() },
            marker: {
                colors: getColors(),
                line: { color: '#fff', width: 2 }
            },
            hovertext: hoverTexts,
            hoverinfo: 'text',
            hoverlabel: { bgcolor: 'white', font: { size: 14, family: 'Arial, sans-serif' } },
            pull: selectedSlices === null ? computed.pieValues.map(() => 0.02) : computed.pieValues.map((_, i) => selectedSlices.includes(i) ? 0.08 : 0.02),
            rotation: 335,
            automargin: true
        }];
    }, [computed, pieChartData, selectedSlices, windowWidth]);

    const barLabelFontSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18;
    const barTextSize = Math.max(barLabelFontSize, 14);
    const barData = useMemo(() => {
        if (!computed || !computed.barPct) return [];
        const labels = energy_use_BAR_KEYS.map((k) => getText('energy_use_' + k, lang));
        return energy_use_BAR_FIELDS.map((field, i) => {
            const isSelected = selectedBars === null || selectedBars.includes(i);
            const color = isSelected ? energy_use_BAR_COLORS[i] : hexToRgba(energy_use_BAR_COLORS[i], 0.3);
            return {
                x: [computed.barPct[i]],
                y: [''],
                name: labels[i],
                type: 'bar',
                orientation: 'h',
                marker: { color },
                hoverinfo: 'text',
                hovertext: `<b>${labels[i]}</b><br>${Math.round(computed.barPct[i])}%<br>${formatPJ(computed.barValues[i], lang)} PJ`,
                hoverlabel: { bgcolor: 'white', font: { size: 14, family: 'Arial, sans-serif' } },
                text: [Math.round(computed.barPct[i]) + '%'],
                textposition: 'inside',
                insidetextanchor: 'middle',
                textangle: windowWidth <= 768 ? 90 : 0,
                textfont: { size: barTextSize, family: 'Arial, sans-serif', color: '#ffffff' }
            };
        });
    }, [computed, lang, selectedBars, windowWidth, barTextSize]);

    const pieLayout = useMemo(() => ({
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
            t: 60, 
            b: zoomLegendMode ? 100 : 60, 
            /* NEW: At 250% zoom (480px or less), reset L and R margins to 0 */
            l: windowWidth <= 480 ? 0 : 20, 
            r: windowWidth <= 480 ? 0 : 240 
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        autosize: true,
        clickmode: 'event',
        dragmode: windowWidth <= 768 ? false : 'zoom'
    }), [zoomLegendMode, windowWidth]);

    const barLayout = useMemo(() => ({
        barmode: 'stack',
        showlegend: true,
        uniformtext: { mode: 'show', minsize: 14 },
        legend: windowWidth <= 768 ? {
            orientation: 'h',
            y: -0.2,
            x: 0.5,
            xanchor: 'center',
            yanchor: 'top',
            font: { size: barLabelFontSize, family: 'Arial, sans-serif' }
        } : {
            orientation: 'v',
            x: 1.02,
            y: 0.5,               
            xanchor: 'left',
            yanchor: 'middle',     
            font: { size: barLabelFontSize, family: 'Arial, sans-serif' }
        },
        margin: {
            t: 20,
            b: windowWidth <= 768 ? 80 : 20,
            l: 20,
            r: windowWidth <= 768 ? 20 : 280
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        xaxis: { range: [0, 100], visible: false, showticklabels: false, fixedrange: true },
        yaxis: { visible: false, showticklabels: false, fixedrange: true },
        autosize: true,
        clickmode: 'event',
        dragmode: windowWidth <= 768 ? false : 'zoom'
    }), [windowWidth, barLabelFontSize]);

    const downloadChartPng = async (plotContainerRef, filenameTitle) => {
        const plotEl = plotContainerRef?.current?.querySelector?.('.js-plotly-plot');
        if (!plotEl || !window.Plotly) return;
        const year = selectedYear != null ? selectedYear : '';
        const displayTitle = (filenameTitle + ' ' + year).trim();
        const safeName = (filenameTitle + ' ' + year).replace(/[^\w\s,-]/g, '').replace(/\s+/g, '_').trim() || 'chart';
        const filename = safeName + '.png';
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
                ctx.fillText(displayTitle, canvas.width / 2, 40);
                ctx.drawImage(img, 0, titleHeight);
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = filename;
                link.click();
            };
            img.src = imgData;
        } catch {
            try { await window.Plotly.relayout(plotEl, { paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)' }); } catch { /* ignore relayout restore */ }
        }
    };
    const pieChartRef = useRef(null);
    const barChartRef = useRef(null);
    const configPie = {
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d', 'toImage'],
        modeBarButtonsToAdd: [{
            name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: () => downloadChartPng(pieChartRef, lang === 'en' ? 'Primary and secondary energy use by sector' : "Consommation d'énergie primaire et secondaire par secteur")
        }]
    };
    const configBar = {
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d', 'toImage'],
        modeBarButtonsToAdd: [{
            name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: () => downloadChartPng(barChartRef, lang === 'en' ? 'Secondary energy use by sector' : "Consommation d'énergie secondaire par secteur")
        }]
    };

    const downloadPieTableCSV = () => {
        if (!data.data || data.data.length === 0) return;
        const pieLabels = energy_use_PIE_KEYS.map((k) => stripHtml(getText('energy_use_' + k, lang)));
        const pieHeaders = [lang === 'en' ? 'Year' : 'Année', ...pieLabels.flatMap((l) => [l + ' (PJ)', l + ' (%)']), lang === 'en' ? 'Total (PJ)' : 'Total (PJ)'];
        const pieRows = data.data.map((r) => {
            const R = Number(r.R); const C = Number(r.C); const I = Number(r.I); const T = Number(r.T); const A = Number(r.A);
            const TSEU = R + C + I + T + A;
            const P = Number(r.P); const NPC = Number(r.NPC); const FK = Number(r.FK); const EL = Number(r.EL);
            const TPD = TSEU + P + NPC + FK + EL;
            const pieVals = [TSEU, EL, NPC, FK, P];
            const piePcts = TPD > 0 ? pieVals.map((v) => Math.round((v / TPD) * 100)) : [0, 0, 0, 0, 0];
            const row = [r.year];
            pieVals.forEach((v, i) => { row.push(Math.round(v)); row.push(piePcts[i] + '%'); });
            row.push(Math.round(TPD));
            return row;
        });
        const csvContent = [pieHeaders.join(','), ...pieRows.map((row) => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'energy_use_primary_secondary.csv' : 'consommation_energie_primaire_secondaire.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };
    const downloadPieTableDocx = async () => {
        if (!data.data || data.data.length === 0) return;
        const pieLabels = energy_use_PIE_KEYS.map((k) => stripHtml(getText('energy_use_' + k, lang)));
        const headers = [lang === 'en' ? 'Year' : 'Année', ...pieLabels.flatMap((l) => [l + ' (PJ)', l + ' (%)']), lang === 'en' ? 'Total (PJ)' : 'Total (PJ)'];
        const headerRow = new TableRow({
            children: headers.map((h) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18 })], alignment: AlignmentType.CENTER })],
                shading: { fill: 'E6E6E6' }
            }))
        });
        const dataRows = data.data.map((r) => {
            const R = Number(r.R); const C = Number(r.C); const I = Number(r.I); const T = Number(r.T); const A = Number(r.A);
            const TSEU = R + C + I + T + A;
            const P = Number(r.P); const NPC = Number(r.NPC); const FK = Number(r.FK); const EL = Number(r.EL);
            const TPD = TSEU + P + NPC + FK + EL;
            const pieVals = [TSEU, EL, NPC, FK, P];
            const piePcts = TPD > 0 ? pieVals.map((v) => Math.round((v / TPD) * 100)) : [0, 0, 0, 0, 0];
            const cells = [r.year, ...pieVals.flatMap((v, i) => [Math.round(v), piePcts[i] + '%']), Math.round(TPD)];
            return new TableRow({
                children: cells.map((val, i) => new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({ text: String(val), size: 20 })],
                        alignment: i === 0 ? AlignmentType.CENTER : AlignmentType.RIGHT
                    })]
                }))
            });
        });
        const title = stripHtml(getText('energy_use_chart_title', lang));
        const pieColumnWidths = [1100, 1150, 1150, 1150, 1150, 1150, 1150, 1150, 1150, 1150, 1150, 1150];
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: pieColumnWidths, rows: [headerRow, ...dataRows] })
                ]
            }]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'energy_use_primary_secondary_table.docx' : 'consommation_energie_primaire_secondaire_tableau.docx');
    };
    const downloadBarTableCSV = () => {
        if (!data.data || data.data.length === 0) return;
        const barLabels = energy_use_BAR_KEYS.map((k) => stripHtml(getText('energy_use_' + k, lang)));
        const barHeaders = [lang === 'en' ? 'Year' : 'Année', ...barLabels.flatMap((l) => [l + ' (PJ)', l + ' (%)']), lang === 'en' ? 'Total (PJ)' : 'Total (PJ)'];
        const barRows = data.data.map((r) => {
            const R = Number(r.R); const C = Number(r.C); const I = Number(r.I); const T = Number(r.T); const A = Number(r.A);
            const TSEU = R + C + I + T + A;
            const vals = [I, T, R, C, A];
            const pcts = TSEU > 0 ? vals.map((v) => Math.round((v / TSEU) * 100)) : [0, 0, 0, 0, 0];
            const row = [r.year];
            vals.forEach((v, i) => { row.push(Math.round(v)); row.push(pcts[i] + '%'); });
            row.push(Math.round(TSEU));
            return row;
        });
        const csvContent = [barHeaders.join(','), ...barRows.map((row) => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'energy_use_secondary_by_sector.csv' : 'consommation_energie_secondaire_par_secteur.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };
    const downloadBarTableDocx = async () => {
        if (!data.data || data.data.length === 0) return;
        const barLabels = energy_use_BAR_KEYS.map((k) => stripHtml(getText('energy_use_' + k, lang)));
        const headers = [lang === 'en' ? 'Year' : 'Année', ...barLabels.flatMap((l) => [l + ' (PJ)', l + ' (%)']), lang === 'en' ? 'Total (PJ)' : 'Total (PJ)'];
        const headerRow = new TableRow({
            children: headers.map((h) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18 })], alignment: AlignmentType.CENTER })],
                shading: { fill: 'E6E6E6' }
            }))
        });
        const dataRows = data.data.map((r) => {
            const R = Number(r.R); const C = Number(r.C); const I = Number(r.I); const T = Number(r.T); const A = Number(r.A);
            const TSEU = R + C + I + T + A;
            const vals = [I, T, R, C, A];
            const pcts = TSEU > 0 ? vals.map((v) => Math.round((v / TSEU) * 100)) : [0, 0, 0, 0, 0];
            const cells = [r.year, ...vals.flatMap((v, i) => [Math.round(v), pcts[i] + '%']), Math.round(TSEU)];
            return new TableRow({
                children: cells.map((val, i) => new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({ text: String(val), size: 20 })],
                        alignment: i === 0 ? AlignmentType.CENTER : AlignmentType.RIGHT
                    })]
                }))
            });
        });
        const title = stripHtml(getText('energy_use_chart_title', lang));
        const barColumnWidths = [1100, 1150, 1150, 1150, 1150, 1150, 1150, 1150, 1150, 1150, 1150, 1150];
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: barColumnWidths, rows: [headerRow, ...dataRows] })
                ]
            }]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'energy_use_secondary_by_sector_table.docx' : 'consommation_energie_secondaire_par_secteur_tableau.docx');
    };

    if (loading) {
        return (
            <div className="energy-use-loading">
                {lang === 'en' ? 'Loading...' : 'Chargement...'}
            </div>
        );
    }
    if (error) {
        return (
            <div className="energy-use-error">
                {lang === 'en' ? 'Error: ' : 'Erreur : '}{error}
            </div>
        );
    }

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-48"
            role="main"
            aria-labelledby="energy-use-title"
            style={{ backgroundColor: '#fff' }}
        >
            <style>{`
                .page-48 { width: 100%; max-width: 1140px; margin: 0 auto; box-sizing: border-box; }
                .energy-use-inner { padding: 24px 0 32px 0; }
                .energy-use-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 50px;
                    font-weight: bold;
                    color: #C58516;
                    margin: 0 0 10px 0;
                    line-height: 1.2;
                    position: relative;
                    padding-bottom: 0.5em;
                }
                .energy-use-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }
                .page-48.page-content p.energy-use-subtitle {
                    font-family: 'Lato', sans-serif;
                    font-size: 41px;
                    font-weight: bold;
                    color: var(--gc-text);
                    margin: 0 0 15px 0;
                    line-height: 1.25;
                }
                .energy-use-bullets { margin: 0 0 24px 0; padding-left: 1.2em; }
                .energy-use-bullets li { margin-bottom: 10px; font-family: 'Noto Sans', sans-serif; font-size: 20px; line-height: 1.6; color: var(--gc-text); }
                .energy-use-year-selector { display: flex; align-items: center; margin-bottom: 20px; }
                .energy-use-year-selector label { font-weight: bold; margin-right: 15px; font-size: 20px; font-family: 'Noto Sans', sans-serif; }
                .energy-use-year-selector .dropdown-button {
                    padding: 10px 15px;
                    font-size: 16px;
                    font-family: 'Noto Sans', sans-serif;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    background: #fff;
                    cursor: pointer;
                    min-width: 100px;
                    text-align: left;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-weight: bold;
                }
                .energy-use-year-selector .dropdown-button:hover { border-color: #007bff; }
                .energy-use-year-selector .dropdown-button:focus { outline: 2px solid #005fcc; outline-offset: 2px; border-color: #007bff; }
                .energy-use-chart-title {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    font-weight: bold;
                    color: var(--gc-text);
                    margin: 0 0 12px 0;
                    text-align: center;
                    max-width: 100%;
                    overflow-wrap: break-word;
                    word-wrap: break-word;
                    word-break: break-word;
                    white-space: normal;
                    box-sizing: border-box;
                    padding: 0 8px;
                }
                .energy-use-chart-title a { color: #26374a; text-decoration: underline; }
                .energy-use-charts-anchor { width: 100%; padding-left: 0; box-sizing: border-box; }
                .energy-use-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 24px;
                    box-sizing: border-box;
                    min-width: 400px;
                    min-height: 420px;
                }
                .energy-use-chart-wrap { display: flex; flex-direction: column; width: 100%; margin-bottom: 0; }
                .energy-use-pie-wrap { width: 100%; }
                .energy-use-bar-wrap { width: 100%; }
                .page-48 .table-responsive { display: block; width: 100%; overflow-x: auto; }
                .page-48 .table-responsive table { width: max-content !important; min-width: 100%; border-collapse: collapse; }
                .page-48 .table-responsive th, .page-48 .table-responsive td { border: 1px solid #ddd; padding: 8px; }
                .energy-use-footnote {
                    width: 100%;
                    box-sizing: border-box;
                    margin-top: 24px;
                    font-family: var(--font-body);
                    font-size: 1rem;
                    line-height: 1.65;
                    color: var(--gc-text);
                }
                .energy-use-loading, .energy-use-error { padding: 24px; font-family: 'Noto Sans', sans-serif; }
                .energy-use-pie-wrap .js-plotly-plot .plotly .modebar { right: 20px !important; }
                .energy-use-chart-frame details > summary:hover { background-color: #404040 !important; }
                .energy-use-chart-frame button[type="button"]:hover,
                .energy-use-chart-frame button:hover { background-color: #404040 !important; }
            `}</style>

            <div className="energy-use-inner">
                <h1 id="energy-use-title" className="energy-use-title">
                    {getText('energy_use_title', lang)}
                </h1>
                <p className="energy-use-subtitle">
                    {getText('energy_use_subtitle', lang)}
                </p>

                <ul className="energy-use-bullets">
                    <li>{getText('energy_use_bullet1', lang)}</li>
                    <li>{getText('energy_use_bullet2', lang)}</li>
                    <li>{getText('energy_use_bullet3', lang)}</li>
                    <li>{getText('energy_use_bullet4', lang)}</li>
                    <li>
                        {getText('energy_use_bullet5_prefix', lang)}
                        {hasData ? <strong>{formatPJ(computed.TPD, lang)}</strong> : '—'}
                        {getText('energy_use_bullet5_suffix', lang)}
                    </li>
                </ul>

                {hasData ? (
                    <>
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
                                    {[...yearsList].sort((a, b) => b - a).map((y) => {
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
                                                <span
                                                    aria-hidden="true"
                                                    style={{
                                                        height: '18px',
                                                        width: '18px',
                                                        borderRadius: '50%',
                                                        border: '1px solid #ccc',
                                                        marginRight: '10px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        backgroundColor: '#fff'
                                                    }}
                                                >
                                                    {isSelected && (
                                                        <span style={{
                                                            height: '10px',
                                                            width: '10px',
                                                            borderRadius: '50%',
                                                            backgroundColor: '#000'
                                                        }} />
                                                    )}
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

                        <div className="energy-use-charts-anchor">
                        <div className="energy-use-chart-wrap" ref={chartRef}>
                            <div className="energy-use-chart-frame">
                            <p className="energy-use-chart-title" style={{ textAlign: 'center', width: '100%', boxSizing: 'border-box', marginTop: 0, marginBottom: '1rem' }}>
                                {getText('energy_use_chart_title', lang)}
                                <span id="fn-asterisk-rf-energy-use" style={{ verticalAlign: 'super', fontSize: '0.75em' }}>
                                    <a className="fn-lnk" href="#fn-asterisk-energy-use" onClick={scrollToFootnote}>
                                        <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                                        <span aria-hidden="true">*</span>
                                    </a>
                                </span>
                            </p>
                            <div className="energy-use-pie-wrap" ref={pieChartRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                {selectedSlices !== null && (
                                        <div style={{ marginBottom: 8 }}>
                                            <button type="button" onClick={() => setSelectedSlices(null)} style={{ padding: '6px 12px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontSize: 14, color: '#fff' }}>{lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}</button>
                                        </div>
                                    )}
                                    <figure style={{ width: '100%', maxWidth: 800, minWidth: 360, minHeight: 380, margin: '0 auto', position: 'relative' }}>
                                    <Plot
                                        key={selectedYear}
                                        data={pieData}
                                        layout={pieLayout}
                                        config={configPie}
                                        style={{ width: '100%', minWidth: 360, minHeight: 380 }}
                                        useResizeHandler
                                        onClick={(eventData) => {
                                            if (!eventData.points || eventData.points.length === 0) return;
                                            const pt = eventData.points[0];
                                            const idx = pt.pointNumber !== undefined ? pt.pointNumber : pt.pointIndex;
                                            if (idx === undefined) return;
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
                                                if (prev.includes(idx)) {
                                                    const next = prev.filter((p) => p !== idx);
                                                    return next.length === 0 ? null : next;
                                                }
                                                return [...prev, idx];
                                            });
                                        }}
                                    />
                                </figure>
                            </div>

                            {data.data && data.data.length > 0 && (
                                <details
                                    open={isPieTableOpen}
                                    onToggle={(e) => setIsPieTableOpen(e.target.open)}
                                    style={{ marginTop: 12, marginBottom: 24, width: '100%' }}
                                >
                                    <summary
                                        role="button"
                                        aria-expanded={isPieTableOpen}
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
                                        <span aria-hidden="true" style={{ marginRight: '8px' }}>{isPieTableOpen ? '▼' : '▶'}</span>
                                        {lang === 'en' ? 'Chart data table (primary and secondary)' : 'Tableau de données du graphique (primaire et secondaire)'}
                                        <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                                    </summary>
                                    <div
                                        ref={pieTableTopRef}
                                        style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', marginBottom: 0, display: windowWidth <= 768 ? 'none' : 'block' }}
                                        aria-hidden="true"
                                    >
                                        <div style={{ height: '20px' }} />
                                    </div>
                                    <div
                                        ref={pieTableScrollRef}
                                        className="table-responsive"
                                        role="region"
                                        aria-labelledby="energy-use-pie-caption"
                                        tabIndex={0}
                                    >
                                        <table className="table table-striped table-hover">
                                            <caption id="energy-use-pie-caption" className="wb-inv">
                                                {getText('energy_use_chart_title', lang)} {lang === 'en' ? '– Primary breakdown (PJ and %)' : '– Répartition primaire (PJ et %)'}
                                            </caption>
                                            <thead>
                                                <tr>
                                                    <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Year' : 'Année'}</th>
                                                    {energy_use_PIE_KEYS.map((k) => (
                                                        <React.Fragment key={k}>
                                                            <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{getText('energy_use_' + k, lang)} (PJ)</th>
                                                            <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{getText('energy_use_' + k, lang)} (%)</th>
                                                        </React.Fragment>
                                                    ))}
                                                    <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Total (PJ)' : 'Total (PJ)'}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.data.map((r) => {
                                                    const R = Number(r.R); const C = Number(r.C); const I = Number(r.I); const T = Number(r.T); const A = Number(r.A);
                                                    const TSEU = R + C + I + T + A;
                                                    const P = Number(r.P); const NPC = Number(r.NPC); const FK = Number(r.FK); const EL = Number(r.EL);
                                                    const TPD = TSEU + P + NPC + FK + EL;
                                                    const pieVals = [TSEU, EL, NPC, FK, P];
                                                    const piePcts = TPD > 0 ? pieVals.map((v) => Math.round((v / TPD) * 100)) : [0, 0, 0, 0, 0];
                                                    return (
                                                        <tr key={r.year}>
                                                            <th scope="row" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{r.year}</th>
                                                            {pieVals.map((v, i) => (
                                                                <React.Fragment key={i}>
                                                                    <td style={{ textAlign: 'right', border: '1px solid #ddd' }}>{formatPJ(v, lang)}</td>
                                                                    <td style={{ textAlign: 'right', border: '1px solid #ddd' }}>{piePcts[i]}%</td>
                                                                </React.Fragment>
                                                            ))}
                                                            <td style={{ textAlign: 'right', border: '1px solid #ddd' }}><strong>{formatPJ(TPD, lang)}</strong></td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={() => downloadPieTableCSV()}
                                            style={{ padding: '8px 16px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}
                                        >
                                            {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => downloadPieTableDocx()}
                                            style={{ padding: '8px 16px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}
                                        >
                                            {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                        </button>
                                    </div>
                                </details>
                            )}

                            <p className="energy-use-chart-title" style={{ textAlign: 'center', width: '100%', boxSizing: 'border-box', marginTop: 24, marginBottom: 12 }}>
                                {getText('energy_use_bar_chart_title', lang)}
                            </p>

                            <div className="energy-use-bar-wrap" ref={barChartRef} style={{ width: '100%', maxWidth: 1140, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                {selectedBars !== null && (
                                        <div style={{ marginBottom: 8 }}>
                                            <button type="button" onClick={() => setSelectedBars(null)} style={{ padding: '6px 12px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontSize: 14, color: '#fff' }}>{lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}</button>
                                        </div>
                                    )}
                                    <figure style={{ width: '100%', minHeight: 250, margin: '0 auto', position: 'relative' }}>
                                    <Plot
                                        key={selectedYear}
                                        data={barData}
                                        layout={barLayout}
                                        config={configBar}
                                        style={{ width: '100%', minHeight: 250 }} 
                                        useResizeHandler
                                        onClick={(eventData) => {
                                            if (!eventData.points || eventData.points.length === 0) return;
                                            const pt = eventData.points[0];
                                            const curveNumber = pt.curveNumber;
                                            if (curveNumber === undefined) return;
                                            setSelectedBars((prev) => {
                                                if (prev === null) return [curveNumber];
                                                if (prev.includes(curveNumber)) {
                                                    const next = prev.filter((p) => p !== curveNumber);
                                                    return next.length === 0 ? null : next;
                                                }
                                                return [...prev, curveNumber];
                                            });
                                        }}
                                    />
                                </figure>
                            </div>

                            {data.data && data.data.length > 0 && (
                                <details
                                    open={isBarTableOpen}
                                    onToggle={(e) => setIsBarTableOpen(e.target.open)}
                                    style={{ marginTop: 12, marginBottom: 24, width: '100%' }}
                                >
                                    <summary
                                        role="button"
                                        aria-expanded={isBarTableOpen}
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
                                        <span aria-hidden="true" style={{ marginRight: '8px' }}>{isBarTableOpen ? '▼' : '▶'}</span>
                                        {lang === 'en' ? 'Chart data table (secondary by sector)' : 'Tableau de données du graphique (secondaire par secteur)'}
                                        <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                                    </summary>
                                    <div
                                        ref={barTableTopRef}
                                        style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', marginBottom: 0, display: windowWidth <= 768 ? 'none' : 'block' }}
                                        aria-hidden="true"
                                    >
                                        <div style={{ height: '20px' }} />
                                    </div>
                                    <div
                                        ref={barTableScrollRef}
                                        className="table-responsive"
                                        role="region"
                                        aria-labelledby="energy-use-bar-caption"
                                        tabIndex={0}
                                    >
                                        <table className="table table-striped table-hover">
                                            <caption id="energy-use-bar-caption" className="wb-inv">
                                                {getText('energy_use_chart_title', lang)} {lang === 'en' ? '– Secondary energy by sector (PJ and %)' : '– Énergie secondaire par secteur (PJ et %)'}
                                            </caption>
                                            <thead>
                                                <tr>
                                                    <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Year' : 'Année'}</th>
                                                    {energy_use_BAR_KEYS.map((k) => (
                                                        <React.Fragment key={k}>
                                                            <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{getText('energy_use_' + k, lang)} (PJ)</th>
                                                            <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{getText('energy_use_' + k, lang)} (%)</th>
                                                        </React.Fragment>
                                                    ))}
                                                    <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Total (PJ)' : 'Total (PJ)'}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.data.map((r) => {
                                                    const R = Number(r.R); const C = Number(r.C); const I = Number(r.I); const T = Number(r.T); const A = Number(r.A);
                                                    const TSEU = R + C + I + T + A;
                                                    const vals = [I, T, R, C, A];
                                                    const pcts = TSEU > 0 ? vals.map((v) => Math.round((v / TSEU) * 100)) : [0, 0, 0, 0, 0];
                                                    return (
                                                        <tr key={r.year}>
                                                            <th scope="row" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{r.year}</th>
                                                            {vals.map((v, i) => (
                                                                <React.Fragment key={i}>
                                                                    <td style={{ textAlign: 'right', border: '1px solid #ddd' }}>{formatPJ(v, lang)}</td>
                                                                    <td style={{ textAlign: 'right', border: '1px solid #ddd' }}>{pcts[i]}%</td>
                                                                </React.Fragment>
                                                            ))}
                                                            <td style={{ textAlign: 'right', border: '1px solid #ddd' }}><strong>{formatPJ(TSEU, lang)}</strong></td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={() => downloadBarTableCSV()}
                                            style={{ padding: '8px 16px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}
                                        >
                                            {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => downloadBarTableDocx()}
                                            style={{ padding: '8px 16px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}
                                        >
                                            {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                        </button>
                                    </div>
                                </details>
                            )}
                            </div>
                        </div>
                        </div>
                    </>
                ) : (
                    <p className="energy-use-no-data" style={{ fontFamily: "'Noto Sans', sans-serif", fontSize: 16 }}>
                        {getText('energy_use_no_data', lang)}
                    </p>
                )}

                {hasData && (
                    <aside className="wb-fnote energy-use-footnote" role="note">
                        <h2 id="fn">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                        <dl>
                            <dt className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</dt>
                            <dd id="fn-asterisk-energy-use">
                                <a href="#fn-asterisk-rf-energy-use" onClick={scrollToRef} className="fn-num" title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}>
                                    <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                                </a>
                                {' '}{getText('energy_use_footnote', lang)}
                            </dd>
                        </dl>
                    </aside>
                )}
            </div>
        </main>
    );
};

export default EnergyUse;
