import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getEnergyUseData } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const PAGE48_PIE_KEYS = ['pie_secondary', 'pie_losses', 'pie_nonenergy', 'pie_noncovered', 'pie_pipeline'];
const PAGE48_BAR_KEYS = ['bar_industrial', 'bar_transportation', 'bar_residential', 'bar_commercial', 'bar_agriculture'];
const PAGE48_PIE_FIELDS = ['TSEU', 'EL', 'NPC', 'FK', 'P'];
const PAGE48_BAR_FIELDS = ['I', 'T', 'R', 'C', 'A'];
const PAGE48_PIE_COLORS = ['#fcb340', '#657f9b', '#1f8093', '#6b666a', '#4b4c4d'];
const PAGE48_BAR_COLORS = ['#c88d34', '#A687A5', '#7F94AD', '#577F6A', '#50A569'];

const Page48 = () => {
    const { lang, layoutPadding } = useOutletContext();
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

    useEffect(() => {
        setSelectedSlices(null);
        setSelectedBars(null);
    }, [selectedYear]);

    const scrollToFootnote = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-page48')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const scrollToRef = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-rf-page48')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

    const hexToRgba = (hex, opacity = 1) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
        return hex;
    };

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

    const formatPJ = (n) => {
        if (n === undefined || n === null) return '—';
        return Math.round(Number(n)).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');
    };
    const stripHtml = (text) => text ? String(text).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

    const yearsList = data.years || [];
    const hasData = yearsList.length > 0 && computed;

    const pieChartData = useMemo(() => {
        if (!computed || computed.TPD <= 0) return null;
        const hoverTexts = [];
        const labels = PAGE48_PIE_KEYS.map((k) => getText('page48_' + k, lang));
        computed.pieValues.forEach((val, i) => {
            const pct = computed.TPD > 0 ? (val / computed.TPD) * 100 : 0;
            hoverTexts.push(`<b>${labels[i]}</b><br>${formatPJ(val)} PJ<br>${pct.toFixed(0)}%`);
        });
        return { labels, hoverTexts, colors: PAGE48_PIE_COLORS };
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
    }, [computed, lang, pieChartData, selectedSlices, zoomLegendMode, windowWidth]);

    const barLabelFontSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18;
    const barTextSize = Math.max(barLabelFontSize, 14);
    const barData = useMemo(() => {
        if (!computed || !computed.barPct) return [];
        const labels = PAGE48_BAR_KEYS.map((k) => getText('page48_' + k, lang));
        return PAGE48_BAR_FIELDS.map((field, i) => {
            const isSelected = selectedBars === null || selectedBars.includes(i);
            const color = isSelected ? PAGE48_BAR_COLORS[i] : hexToRgba(PAGE48_BAR_COLORS[i], 0.3);
            return {
                x: [computed.barPct[i]],
                y: [''],
                name: labels[i],
                type: 'bar',
                orientation: 'h',
                marker: { color },
                hoverinfo: 'text',
                hovertext: `<b>${labels[i]}</b><br>${Math.round(computed.barPct[i])}%<br>${formatPJ(computed.barValues[i])} PJ`,
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
            font: { size: 11 }
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
    }), [windowWidth]);

    const config = {
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d']
    };

    const downloadPieTableCSV = () => {
        if (!data.data || data.data.length === 0) return;
        const pieHeaders = [lang === 'en' ? 'Year' : 'Année', ...PAGE48_PIE_KEYS.map((k) => stripHtml(getText('page48_' + k, lang)) + ' (PJ)'), lang === 'en' ? 'Total (PJ)' : 'Total (PJ)'];
        const pieRows = data.data.map((r) => {
            const R = Number(r.R); const C = Number(r.C); const I = Number(r.I); const T = Number(r.T); const A = Number(r.A);
            const TSEU = R + C + I + T + A;
            const P = Number(r.P); const NPC = Number(r.NPC); const FK = Number(r.FK); const EL = Number(r.EL);
            const TPD = TSEU + P + NPC + FK + EL;
            return [r.year, Math.round(TSEU), Math.round(EL), Math.round(NPC), Math.round(FK), Math.round(P), Math.round(TPD)];
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
        const pieLabels = PAGE48_PIE_KEYS.map((k) => stripHtml(getText('page48_' + k, lang)));
        const headers = [lang === 'en' ? 'Year' : 'Année', ...pieLabels.map((l) => l + ' (PJ)'), lang === 'en' ? 'Total (PJ)' : 'Total (PJ)'];
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
            const cells = [r.year, Math.round(TSEU), Math.round(EL), Math.round(NPC), Math.round(FK), Math.round(P), Math.round(TPD)];
            return new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(cells[0]), size: 20 })], alignment: AlignmentType.CENTER })] }),
                    ...cells.slice(1).map((val) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(val), size: 20 })], alignment: AlignmentType.RIGHT })] }))
                ]
            });
        });
        const title = stripHtml(getText('page48_chart_title', lang));
        const pieColumnWidths = [1100, 1150, 1150, 1150, 1150, 1150, 1150];
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
        const barLabels = PAGE48_BAR_KEYS.map((k) => stripHtml(getText('page48_' + k, lang)));
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
        const barLabels = PAGE48_BAR_KEYS.map((k) => stripHtml(getText('page48_' + k, lang)));
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
        const title = stripHtml(getText('page48_chart_title', lang));
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
            <div className="page48-loading">
                {lang === 'en' ? 'Loading...' : 'Chargement...'}
            </div>
        );
    }
    if (error) {
        return (
            <div className="page48-error">
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
            aria-labelledby="page48-title"
            style={{ backgroundColor: '#fff' }}
        >
            <style>{`
                .page-48 { width: 100%; max-width: 1140px; margin: 0 auto; box-sizing: border-box; }
                .page48-inner { padding: 24px ${layoutPadding?.right ?? 24}px 32px ${layoutPadding?.left ?? 24}px; }
                .page48-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 50px;
                    font-weight: bold;
                    color: #245e7f;
                    margin: 0 0 10px 0;
                    line-height: 1.2;
                    position: relative;
                    padding-bottom: 0.5em;
                }
                .page48-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }
                .page48-subtitle {
                    font-family: 'Lato', sans-serif;
                    font-size: 39px;
                    font-weight: bold;
                    color: #58585a;
                    margin: 0 0 15px 0;
                }
                .page48-bullets { margin: 0 0 24px 0; padding-left: 1.2em; max-width: 80ch; }
                .page48-bullets li { margin-bottom: 10px; font-family: 'Noto Sans', sans-serif; font-size: 20px; line-height: 1.6; color: var(--gc-text); }
                .page48-year-selector { display: flex; align-items: center; margin-bottom: 20px; }
                .page48-year-selector label { font-weight: bold; margin-right: 15px; font-size: 20px; font-family: 'Noto Sans', sans-serif; }
                .page48-year-selector .dropdown-button {
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
                .page48-year-selector .dropdown-button:hover { border-color: #007bff; }
                .page48-year-selector .dropdown-button:focus { outline: 2px solid #005fcc; outline-offset: 2px; border-color: #007bff; }
                .page48-chart-title {
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
                .page48-chart-title a { color: #26374a; text-decoration: underline; }
                .page48-charts-anchor {
                    margin-left: -${layoutPadding?.left ?? 24}px;
                    width: calc(100% + ${layoutPadding?.left ?? 24}px);
                    padding-left: 0;
                    box-sizing: border-box;
                }
                .page48-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 24px;
                    box-sizing: border-box;
                }
                .page48-chart-frame:first-of-type { min-width: 400px; min-height: 420px; }
                .page48-chart-frame:last-of-type { margin-bottom: 0; }
                .page48-chart-wrap { display: flex; flex-direction: column; width: 100%; gap: 24px; margin-bottom: 0; }
                .page48-pie-wrap { width: 100%; }
                .page48-bar-wrap { width: 100%; }
                .page-48 .table-responsive { display: block; width: 100%; overflow-x: auto; }
                .page-48 .table-responsive table { width: max-content !important; min-width: 100%; border-collapse: collapse; }
                .page-48 .table-responsive th, .page-48 .table-responsive td { border: 1px solid #ddd; padding: 8px; }
                .page48-footnote { margin-top: 24px; font-family: 'Noto Sans', sans-serif; font-size: 20px; line-height: 1.6; color: var(--gc-text); }
                .page48-loading, .page48-error { padding: 24px; font-family: 'Noto Sans', sans-serif; }
                .page48-pie-wrap .js-plotly-plot .plotly .modebar { right: 20px !important; }
            `}</style>

            <div className="page48-inner">
                <h1 id="page48-title" className="page48-title">
                    {getText('page48_title', lang)}
                </h1>
                <p className="page48-subtitle">
                    {getText('page48_subtitle', lang)}
                </p>

                <ul className="page48-bullets">
                    <li>{getText('page48_bullet1', lang)}</li>
                    <li>{getText('page48_bullet2', lang)}</li>
                    <li>{getText('page48_bullet3', lang)}</li>
                    <li>{getText('page48_bullet4', lang)}</li>
                    <li>
                        {getText('page48_bullet5_prefix', lang)}
                        {hasData ? <strong>{formatPJ(computed.TPD)}</strong> : '—'}
                        {getText('page48_bullet5_suffix', lang)}
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

                        <div className="page48-charts-anchor">
                        <p className="page48-chart-title" style={{ textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
                            {getText('page48_chart_title', lang)}
                            <span id="fn-asterisk-rf-page48" style={{ verticalAlign: 'super', fontSize: '0.75em' }}>
                                <a className="fn-lnk" href="#fn-asterisk-page48" onClick={scrollToFootnote}>
                                    <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                                    <span aria-hidden="true">*</span>
                                </a>
                            </span>
                        </p>

                        <div className="page48-chart-wrap" ref={chartRef}>
                            <div className="page48-chart-frame">
                            <div className="page48-pie-wrap" style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                                <figure style={{ width: '100%', maxWidth: 800, minWidth: 360, minHeight: 380, margin: '0 auto', position: 'relative' }}>
                                    {selectedSlices !== null && (
                                        <button type="button" onClick={() => setSelectedSlices(null)} style={{ position: 'absolute', top: 0, right: 20, zIndex: 20 }}>{lang === 'en' ? 'Clear' : 'Effacer'}</button>
                                    )}
                                    <Plot
                                        key={`pie-${selectedSlices ? selectedSlices.join('-') : 'none'}`}
                                        data={pieData}
                                        layout={pieLayout}
                                        config={config}
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
                                            border: '1px solid #26374a',
                                            backgroundColor: '#26374a',
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
                                        aria-labelledby="page48-pie-caption"
                                        tabIndex={0}
                                    >
                                        <table className="table table-striped table-hover">
                                            <caption id="page48-pie-caption" className="wb-inv">
                                                {getText('page48_chart_title', lang)} {lang === 'en' ? '– Primary breakdown (PJ)' : '– Répartition primaire (PJ)'}
                                            </caption>
                                            <thead>
                                                <tr>
                                                    <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Year' : 'Année'}</th>
                                                    {PAGE48_PIE_KEYS.map((k) => (
                                                        <th key={k} scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{getText('page48_' + k, lang)} (PJ)</th>
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
                                                    return (
                                                        <tr key={r.year}>
                                                            <th scope="row" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{r.year}</th>
                                                            <td style={{ textAlign: 'right', border: '1px solid #ddd' }}>{formatPJ(TSEU)}</td>
                                                            <td style={{ textAlign: 'right', border: '1px solid #ddd' }}>{formatPJ(EL)}</td>
                                                            <td style={{ textAlign: 'right', border: '1px solid #ddd' }}>{formatPJ(NPC)}</td>
                                                            <td style={{ textAlign: 'right', border: '1px solid #ddd' }}>{formatPJ(FK)}</td>
                                                            <td style={{ textAlign: 'right', border: '1px solid #ddd' }}>{formatPJ(P)}</td>
                                                            <td style={{ textAlign: 'right', border: '1px solid #ddd' }}><strong>{formatPJ(TPD)}</strong></td>
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
                                            style={{ padding: '8px 16px', backgroundColor: '#26374a', border: '1px solid #26374a', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}
                                        >
                                            {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => downloadPieTableDocx()}
                                            style={{ padding: '8px 16px', backgroundColor: '#26374a', border: '1px solid #26374a', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}
                                        >
                                            {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                        </button>
                                    </div>
                                </details>
                            )}
                            </div>

                            <div className="page48-chart-frame">
                            <div className="page48-bar-wrap" style={{ width: '100%', maxWidth: 1140, margin: '0 auto', display: 'flex', justifyContent: 'center' }}>
                                <figure style={{ width: '100%', minHeight: 250, margin: '0 auto', position: 'relative' }}>
                                    {selectedBars !== null && (
                                        <button type="button" onClick={() => setSelectedBars(null)} style={{ position: 'absolute', top: 0, right: 20, zIndex: 20 }}>{lang === 'en' ? 'Clear' : 'Effacer'}</button>
                                    )}
                                    <Plot
                                        data={barData}
                                        layout={barLayout}
                                        config={config}
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
                                            border: '1px solid #26374a',
                                            backgroundColor: '#26374a',
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
                                        aria-labelledby="page48-bar-caption"
                                        tabIndex={0}
                                    >
                                        <table className="table table-striped table-hover">
                                            <caption id="page48-bar-caption" className="wb-inv">
                                                {getText('page48_chart_title', lang)} {lang === 'en' ? '– Secondary energy by sector (PJ and %)' : '– Énergie secondaire par secteur (PJ et %)'}
                                            </caption>
                                            <thead>
                                                <tr>
                                                    <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Year' : 'Année'}</th>
                                                    {PAGE48_BAR_KEYS.map((k) => (
                                                        <React.Fragment key={k}>
                                                            <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{getText('page48_' + k, lang)} (PJ)</th>
                                                            <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{getText('page48_' + k, lang)} (%)</th>
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
                                                                    <td style={{ textAlign: 'right', border: '1px solid #ddd' }}>{formatPJ(v)}</td>
                                                                    <td style={{ textAlign: 'right', border: '1px solid #ddd' }}>{pcts[i]}%</td>
                                                                </React.Fragment>
                                                            ))}
                                                            <td style={{ textAlign: 'right', border: '1px solid #ddd' }}><strong>{formatPJ(TSEU)}</strong></td>
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
                                            style={{ padding: '8px 16px', backgroundColor: '#26374a', border: '1px solid #26374a', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}
                                        >
                                            {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => downloadBarTableDocx()}
                                            style={{ padding: '8px 16px', backgroundColor: '#26374a', border: '1px solid #26374a', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}
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
                    <p className="page48-no-data" style={{ fontFamily: "'Noto Sans', sans-serif", fontSize: 16 }}>
                        {getText('page48_no_data', lang)}
                    </p>
                )}

                {hasData && (
                    <aside className="wb-fnote page48-footnote" role="note">
                        <h2 id="fn">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                        <dl>
                            <dt className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</dt>
                            <dd id="fn-asterisk-page48">
                                <a href="#fn-asterisk-rf-page48" onClick={scrollToRef} className="fn-num" title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}>
                                    <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                                </a>
                                {' '}{getText('page48_footnote', lang)}
                            </dd>
                        </dl>
                    </aside>
                )}
            </div>
        </main>
    );
};

export default Page48;
