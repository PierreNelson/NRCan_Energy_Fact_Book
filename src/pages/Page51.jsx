import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getResidentialEnergyUseData, residentialEnergyUseRowHasCompleteData } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const REU_BY_TYPE_ORDER = ['space_heating', 'water_heating', 'appliances', 'lighting', 'space_cooling'];
const REU_BY_TYPE_COLORS = ['#CE8003', '#4b4c4d', '#6b666a', '#1f8093', '#A687A5'];
const SOURCE_ORDER = ['natural_gas', 'electricity', 'heating_oil', 'wood', 'other'];
const SOURCE_COLORS = ['#CE8003', '#4b4c4d', '#A687A5', '#1f8093', '#949494'];
const PAGE51_CHART_HEIGHT = 420;
/** Fixed margins so all three pies use the same plot area (same size). Large enough for chart 2's labels at 100% and high zoom. */
const PAGE51_CHART_MARGIN = { t: 165, b: 55, l: 245, r: 245 };
/** Min width so pie doesn't shrink when viewport is narrow at high zoom. Wrapper keeps chart centered. */
const PAGE51_CHART_MIN_WIDTH = 800;
/** Earliest year in the year selector and in chart data tables; newer years appear automatically from data. */
const PAGE51_MIN_DISPLAY_YEAR = 2022;

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    return hex;
};

const wrapLabel = (text) => {
    if (!text || text.length <= 14) return text;
    const firstSpace = text.indexOf(' ');
    if (firstSpace > 0 && firstSpace < text.length - 1) return text.slice(0, firstSpace) + '<br>' + text.slice(firstSpace + 1);
    if (text.length > 18) return text.slice(0, 18) + '<br>' + text.slice(18);
    return text;
};

const getReuLabelKey = (key) => {
    const m = { space_heating: 'page51_label_space_heating', water_heating: 'page51_label_water_heating', appliances: 'page51_label_appliances', lighting: 'page51_label_lighting', space_cooling: 'page51_label_space_cooling' };
    return m[key] || key;
};

const getSourceLabelKey = (key) => {
    const m = { natural_gas: 'page51_label_natural_gas', electricity: 'page51_label_electricity', heating_oil: 'page51_label_heating_oil', wood: 'page51_label_wood', other: 'page51_label_other' };
    return m[key] || key;
};

const getSourceLabel = (key, lang) => getText(getSourceLabelKey(key), lang);

const buildPieTrace = (categories, labelKeyFn, colors, totalVal, textSize, lang, labelOverrideFn, selectedSlices) => {
    if (!categories.length) return null;
    const getLabel = (c) => (labelOverrideFn ? labelOverrideFn(c) : getText(labelKeyFn(c.key), lang));
    const values = categories.map((c) => (c.value > 0 ? c.value : 0.001));
    const labels = categories.map((c) => {
        const raw = getLabel(c);
        if (c.key === 'space_heating' || c.key === 'water_heating') {
            const match = raw.match(/^(\S+)\s+(.*)$/);
            return match ? `${match[1]}<br>${match[2]}` : raw;
        }
        return wrapLabel(raw);
    });
    const hoverTexts = categories.map((c) => {
        const label = getLabel(c);
        return `<b>${label}</b><br>${Number(c.value).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { maximumFractionDigits: 1 })} PJ<br>${Number(c.pct).toFixed(1)}%`;
    });
    const baseColors = colors.slice(0, values.length);
    const effectiveColors = selectedSlices && selectedSlices.length > 0
        ? baseColors.map((c, i) => (selectedSlices.includes(i) ? c : hexToRgba(c, 0.3)))
        : baseColors;
    const pull = selectedSlices && selectedSlices.length > 0
        ? values.map((_, i) => (selectedSlices.includes(i) ? 0.08 : 0.02))
        : values.map(() => 0.02);
    return {
        values,
        labels,
        hoverTexts,
        customdata: categories.map((c) => c.pct),
        total: totalVal,
        texttemplate: '%{label}<br>%{customdata:.1f}%',
        textinfo: 'label+percent',
        textposition: 'outside',
        textfont: { size: textSize, family: 'Arial, sans-serif', color: effectiveColors },
        outsidetextfont: { size: textSize, color: effectiveColors },
        marker: { colors: effectiveColors, line: { color: '#fff', width: 1 } },
        pull,
        hovertext: hoverTexts,
        hoverinfo: 'text',
        hoverlabel: { bgcolor: '#fff', font: { color: '#333', size: 14 } },
    };
};

const Page51 = () => {
    const outlet = useOutletContext();
    const lang = outlet?.lang ?? 'en';
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pickedYear, setPickedYear] = useState(null);
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
    const [isTable1Open, setIsTable1Open] = useState(false);
    const [isTable2Open, setIsTable2Open] = useState(false);
    const [isTable3Open, setIsTable3Open] = useState(false);
    const [selectedSlices1, setSelectedSlices1] = useState(null);
    const [selectedSlices2, setSelectedSlices2] = useState(null);
    const [selectedSlices3, setSelectedSlices3] = useState(null);
    const yearDropdownRef = useRef(null);
    const yearButtonRef = useRef(null);
    const chartRef1 = useRef(null);
    const chartRef2 = useRef(null);
    const chartRef3 = useRef(null);
    const lastPieClickRef1 = useRef({ time: 0, index: null });
    const lastPieClickRef2 = useRef({ time: 0, index: null });
    const lastPieClickRef3 = useRef({ time: 0, index: null });
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

    useEffect(() => {
        getResidentialEnergyUseData()
            .then((d) => {
                setResult(d);
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

    const years = useMemo(() => {
        if (!result?.data?.length) return [];
        return [...new Set(result.data.filter(residentialEnergyUseRowHasCompleteData).map((r) => r.year))]
            .filter((y) => y !== 2000 && y >= PAGE51_MIN_DISPLAY_YEAR)
            .sort((a, b) => b - a);
    }, [result]);

    const selectedYear = pickedYear != null && years.includes(pickedYear) ? pickedYear : (years[0] ?? null);

    const selectedRow = useMemo(() => (result?.data && selectedYear != null ? result.data.find((r) => r.year === selectedYear) : null), [result, selectedYear]);

    const reuByTypeCategories = useMemo(() => {
        if (!selectedRow?.reuByType) return [];
        const total = selectedRow.reuByType.total ?? 0;
        return REU_BY_TYPE_ORDER.map((key) => {
            const value = selectedRow.reuByType[key] ?? 0;
            const pct = total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0;
            return { key, value, pct };
        });
    }, [selectedRow]);

    const waterHeatingCategories = useMemo(() => {
        if (!selectedRow?.waterHeating) return [];
        const wh = selectedRow.waterHeating;
        const total = wh.total ?? SOURCE_ORDER.reduce((sum, k) => sum + (Number(wh[k]) || 0), 0);
        return SOURCE_ORDER.map((key) => {
            const value = wh[key] ?? 0;
            const pct = total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0;
            return { key, value, pct };
        });
    }, [selectedRow]);

    const spaceHeatingCategories = useMemo(() => {
        if (!selectedRow?.spaceHeating) return [];
        const sh = selectedRow.spaceHeating;
        const total = sh.total ?? SOURCE_ORDER.reduce((sum, k) => sum + (Number(sh[k]) || 0), 0);
        return SOURCE_ORDER.map((key) => {
            const value = sh[key] ?? 0;
            const pct = total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0;
            return { key, value, pct };
        });
    }, [selectedRow]);

    const table1AllYearsRows = useMemo(() => {
        if (!result?.data?.length) return [];
        return [...result.data].filter((r) => residentialEnergyUseRowHasCompleteData(r) && r.year !== 2000 && r.year >= PAGE51_MIN_DISPLAY_YEAR).sort((a, b) => a.year - b.year).map((r) => {
            const reu = r.reuByType || {};
            const total = reu.total ?? 0;
            const row = { year: r.year, total };
            REU_BY_TYPE_ORDER.forEach((key) => {
                const v = reu[key] ?? 0;
                row[key] = v;
                row[`${key}_pct`] = total > 0 ? Number(((v / total) * 100).toFixed(1)) : 0;
            });
            return row;
        });
    }, [result]);
    const table2AllYearsRows = useMemo(() => {
        if (!result?.data?.length) return [];
        return [...result.data].filter((r) => residentialEnergyUseRowHasCompleteData(r) && r.year !== 2000 && r.year >= PAGE51_MIN_DISPLAY_YEAR).sort((a, b) => a.year - b.year).map((r) => {
            const wh = r.waterHeating || {};
            const total = wh.total ?? SOURCE_ORDER.reduce((sum, k) => sum + (Number(wh[k]) || 0), 0);
            const row = { year: r.year, total };
            SOURCE_ORDER.forEach((key) => {
                const v = wh[key] ?? 0;
                row[key] = v;
                row[`${key}_pct`] = total > 0 ? Number(((v / total) * 100).toFixed(1)) : 0;
            });
            return row;
        });
    }, [result]);
    const table3AllYearsRows = useMemo(() => {
        if (!result?.data?.length) return [];
        return [...result.data].filter((r) => residentialEnergyUseRowHasCompleteData(r) && r.year !== 2000 && r.year >= PAGE51_MIN_DISPLAY_YEAR).sort((a, b) => a.year - b.year).map((r) => {
            const sh = r.spaceHeating || {};
            const total = sh.total ?? SOURCE_ORDER.reduce((sum, k) => sum + (Number(sh[k]) || 0), 0);
            const row = { year: r.year, total };
            SOURCE_ORDER.forEach((key) => {
                const v = sh[key] ?? 0;
                row[key] = v;
                row[`${key}_pct`] = total > 0 ? Number(((v / total) * 100).toFixed(1)) : 0;
            });
            return row;
        });
    }, [result]);

    const chart1Title = useMemo(() => {
        const t = getText('page51_chart1_title', lang) || '';
        return selectedYear != null ? t.replace(/\{\{year\}\}/g, String(selectedYear)) : t;
    }, [selectedYear, lang]);
    const chart2Title = useMemo(() => {
        const t = getText('page51_chart2_title', lang) || '';
        return selectedYear != null ? t.replace(/\{\{year\}\}/g, String(selectedYear)) : t;
    }, [selectedYear, lang]);
    const chart3Title = useMemo(() => {
        const t = getText('page51_chart3_title', lang) || '';
        return selectedYear != null ? t.replace(/\{\{year\}\}/g, String(selectedYear)) : t;
    }, [selectedYear, lang]);

    const scrollToFootnote = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-page51')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    const scrollToRef = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-rf-page51')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const selectEnabled = windowWidth > 768;
    const effectiveSlices1 = selectEnabled ? selectedSlices1 : null;
    const effectiveSlices2 = selectEnabled ? selectedSlices2 : null;
    const effectiveSlices3 = selectEnabled ? selectedSlices3 : null;

    const downloadChartPng = async (chartRef, displayTitle, filename) => {
        const plotEl = chartRef?.current?.querySelector('.js-plotly-plot');
        if (!plotEl || !window.Plotly) return;
        const safeFilename = (filename || displayTitle || 'chart').replace(/[^\w\s,-]/g, '').replace(/\s+/g, '_').trim() || 'chart';
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
                ctx.fillText(displayTitle.replace(/\*$/g, ''), canvas.width / 2, 40);
                ctx.drawImage(img, 0, titleHeight);
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = fullFilename;
                link.click();
            };
            img.src = imgData;
        } catch {
            try { await window.Plotly.relayout(plotEl, { paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)' }); } catch { /* ignore relayout restore */ }
        }
    };

    const configBase = {
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d', 'toImage'],
    };
    const config1 = {
        ...configBase,
        modeBarButtonsToAdd: [{
            name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: () => downloadChartPng(chartRef1, chart1Title, (chart1Title.replace(/\*$/g, '').replace(/[^\w\s,-]/g, '').replace(/\s+/g, '_').trim()) || 'residential_energy_by_type'),
        }],
    };
    const config2 = {
        ...configBase,
        modeBarButtonsToAdd: [{
            name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: () => downloadChartPng(chartRef2, chart2Title, (chart2Title.replace(/[^\w\s,-]/g, '').replace(/\s+/g, '_').trim()) || 'water_heating_by_source'),
        }],
    };
    const config3 = {
        ...configBase,
        modeBarButtonsToAdd: [{
            name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: () => downloadChartPng(chartRef3, chart3Title, (chart3Title.replace(/[^\w\s,-]/g, '').replace(/\s+/g, '_').trim()) || 'space_heating_by_source'),
        }],
    };

    const downloadTable1CSV = () => {
        if (!table1AllYearsRows.length) return;
        const yearCol = lang === 'en' ? 'Year' : 'Année';
        const headers = [yearCol, ...REU_BY_TYPE_ORDER.map((k) => getText(getReuLabelKey(k), lang)), lang === 'en' ? 'Total (PJ)' : 'Total (PJ)'];
        const rows = table1AllYearsRows.map((r) => [r.year, ...REU_BY_TYPE_ORDER.map((k) => Number(r[k]).toFixed(2)), Number(r.total).toFixed(2)]);
        const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'residential_energy_by_type.csv' : 'consommation_residentielle_par_type.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };
    const downloadTable1Docx = async () => {
        if (!table1AllYearsRows.length) return;
        const yearCol = lang === 'en' ? 'Year' : 'Année';
        const headers = [yearCol, ...REU_BY_TYPE_ORDER.map((k) => getText(getReuLabelKey(k), lang)), lang === 'en' ? 'Total (PJ)' : 'Total (PJ)'];
        const headerRow = new TableRow({
            children: headers.map((h) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 22 })], alignment: AlignmentType.CENTER })],
                shading: { fill: 'E6E6E6' },
            })),
        });
        const dataRows = table1AllYearsRows.map((r) => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(r.year), size: 20 })], alignment: AlignmentType.LEFT })] }),
                ...REU_BY_TYPE_ORDER.map((k) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: Number(r[k]).toFixed(2), size: 20 })], alignment: AlignmentType.RIGHT })] })),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: Number(r.total).toFixed(2), size: 20 })], alignment: AlignmentType.RIGHT })] }),
            ],
        }));
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: getText('page51_chart1_title', lang).replace(/\{\{year\}\}/g, '').replace(/\*$/, '').trim(), bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [800, ...REU_BY_TYPE_ORDER.map(() => 1500), 1500],
                        rows: [headerRow, ...dataRows],
                    }),
                ],
            }],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'residential_energy_by_type.docx' : 'consommation_residentielle_par_type.docx');
    };

    const downloadTable2CSV = () => {
        if (!table2AllYearsRows.length) return;
        const yearCol = lang === 'en' ? 'Year' : 'Année';
        const headers = [yearCol, ...SOURCE_ORDER.map((k) => getSourceLabel(k, lang)), lang === 'en' ? 'Total (PJ)' : 'Total (PJ)'];
        const rows = table2AllYearsRows.map((r) => [r.year, ...SOURCE_ORDER.map((k) => Number(r[k]).toFixed(2)), Number(r.total).toFixed(2)]);
        const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'water_heating_by_source.csv' : 'chauffage_eau_par_source.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };
    const downloadTable2Docx = async () => {
        if (!table2AllYearsRows.length) return;
        const yearCol = lang === 'en' ? 'Year' : 'Année';
        const headers = [yearCol, ...SOURCE_ORDER.map((k) => getSourceLabel(k, lang)), lang === 'en' ? 'Total (PJ)' : 'Total (PJ)'];
        const headerRow = new TableRow({
            children: headers.map((h) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 22 })], alignment: AlignmentType.CENTER })],
                shading: { fill: 'E6E6E6' },
            })),
        });
        const dataRows = table2AllYearsRows.map((r) => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(r.year), size: 20 })], alignment: AlignmentType.LEFT })] }),
                ...SOURCE_ORDER.map((k) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: Number(r[k]).toFixed(2), size: 20 })], alignment: AlignmentType.RIGHT })] })),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: Number(r.total).toFixed(2), size: 20 })], alignment: AlignmentType.RIGHT })] }),
            ],
        }));
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: getText('page51_chart2_title', lang).replace(/\{\{year\}\}/g, '').trim(), bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [800, ...SOURCE_ORDER.map(() => 1500), 1500],
                        rows: [headerRow, ...dataRows],
                    }),
                ],
            }],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'water_heating_by_source.docx' : 'chauffage_eau_par_source.docx');
    };

    const downloadTable3CSV = () => {
        if (!table3AllYearsRows.length) return;
        const yearCol = lang === 'en' ? 'Year' : 'Année';
        const headers = [yearCol, ...SOURCE_ORDER.map((k) => getSourceLabel(k, lang)), lang === 'en' ? 'Total (PJ)' : 'Total (PJ)'];
        const rows = table3AllYearsRows.map((r) => [r.year, ...SOURCE_ORDER.map((k) => Number(r[k]).toFixed(2)), Number(r.total).toFixed(2)]);
        const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'space_heating_by_source.csv' : 'chauffage_locaux_par_source.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };
    const downloadTable3Docx = async () => {
        if (!table3AllYearsRows.length) return;
        const yearCol = lang === 'en' ? 'Year' : 'Année';
        const headers = [yearCol, ...SOURCE_ORDER.map((k) => getSourceLabel(k, lang)), lang === 'en' ? 'Total (PJ)' : 'Total (PJ)'];
        const headerRow = new TableRow({
            children: headers.map((h) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 22 })], alignment: AlignmentType.CENTER })],
                shading: { fill: 'E6E6E6' },
            })),
        });
        const dataRows = table3AllYearsRows.map((r) => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(r.year), size: 20 })], alignment: AlignmentType.LEFT })] }),
                ...SOURCE_ORDER.map((k) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: Number(r[k]).toFixed(2), size: 20 })], alignment: AlignmentType.RIGHT })] })),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: Number(r.total).toFixed(2), size: 20 })], alignment: AlignmentType.RIGHT })] }),
            ],
        }));
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: getText('page51_chart3_title', lang).replace(/\{\{year\}\}/g, '').trim(), bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [800, ...SOURCE_ORDER.map(() => 1500), 1500],
                        rows: [headerRow, ...dataRows],
                    }),
                ],
            }],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'space_heating_by_source.docx' : 'chauffage_locaux_par_source.docx');
    };

    const hasData = result && result.data?.length > 0;
    const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18;

    const plot1Trace = reuByTypeCategories.length
        ? buildPieTrace(reuByTypeCategories, getReuLabelKey, REU_BY_TYPE_COLORS, selectedRow?.reuByType?.total, textSize, lang, undefined, effectiveSlices1)
        : null;
    const plot1Data = plot1Trace ? [{ ...plot1Trace, type: 'pie', hole: 0.55, direction: 'clockwise', sort: false, automargin: false }] : [];

    const plot2Trace = waterHeatingCategories.length
        ? buildPieTrace(waterHeatingCategories, getSourceLabelKey, SOURCE_COLORS, selectedRow?.waterHeating?.total, textSize, lang, (c) => getSourceLabel(c.key, lang), effectiveSlices2)
        : null;
    const plot2Data = plot2Trace ? [{ ...plot2Trace, type: 'pie', hole: 0.55, direction: 'clockwise', sort: false, automargin: false }] : [];

    const plot3Trace = spaceHeatingCategories.length
        ? buildPieTrace(spaceHeatingCategories, getSourceLabelKey, SOURCE_COLORS, selectedRow?.spaceHeating?.total, textSize, lang, (c) => getSourceLabel(c.key, lang), effectiveSlices3)
        : null;
    const plot3Data = plot3Trace ? [{ ...plot3Trace, type: 'pie', hole: 0.55, direction: 'clockwise', sort: false, automargin: false }] : [];

    const layout1 = useMemo(() => ({
        height: PAGE51_CHART_HEIGHT,
        showlegend: false,
        margin: PAGE51_CHART_MARGIN,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        clickmode: 'event',
        annotations: selectedRow?.reuByType?.total != null ? [{
            text: `${lang === 'en' ? 'Total' : 'Total'}<br>${Number(selectedRow.reuByType.total).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { maximumFractionDigits: 0 })} PJ`,
            showarrow: false,
            x: 0.5,
            y: 0.5,
            font: { size: 18, color: '#424243', family: 'Arial Black, sans-serif' },
            xref: 'paper',
            yref: 'paper',
        }] : [],
    }), [selectedRow, lang]);

    const waterHeatingTotalDisplay = useMemo(() => {
        const wh = selectedRow?.waterHeating;
        if (!wh) return null;
        return wh.total ?? SOURCE_ORDER.reduce((sum, k) => sum + (Number(wh[k]) || 0), 0);
    }, [selectedRow]);
    const spaceHeatingTotalDisplay = useMemo(() => {
        const sh = selectedRow?.spaceHeating;
        if (!sh) return null;
        return sh.total ?? SOURCE_ORDER.reduce((sum, k) => sum + (Number(sh[k]) || 0), 0);
    }, [selectedRow]);

    const layout2 = useMemo(() => ({
        height: PAGE51_CHART_HEIGHT,
        showlegend: false,
        margin: PAGE51_CHART_MARGIN,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        clickmode: 'event',
        annotations: waterHeatingTotalDisplay != null ? [{
            text: `${lang === 'en' ? 'Total' : 'Total'}<br>${Number(waterHeatingTotalDisplay).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { maximumFractionDigits: 0 })} PJ`,
            showarrow: false,
            x: 0.5,
            y: 0.5,
            font: { size: 18, color: '#424243', family: 'Arial Black, sans-serif' },
            xref: 'paper',
            yref: 'paper',
        }] : [],
    }), [waterHeatingTotalDisplay, lang]);

    const layout3 = useMemo(() => ({
        height: PAGE51_CHART_HEIGHT,
        showlegend: false,
        margin: PAGE51_CHART_MARGIN,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        clickmode: 'event',
        annotations: spaceHeatingTotalDisplay != null ? [{
            text: `${lang === 'en' ? 'Total' : 'Total'}<br>${Number(spaceHeatingTotalDisplay).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { maximumFractionDigits: 0 })} PJ`,
            showarrow: false,
            x: 0.5,
            y: 0.5,
            font: { size: 18, color: '#424243', family: 'Arial Black, sans-serif' },
            xref: 'paper',
            yref: 'paper',
        }] : [],
    }), [spaceHeatingTotalDisplay, lang]);

    return (
        <main id="main-content" tabIndex={-1} className="page-content page-51" role="main" style={{ backgroundColor: '#ffffff' }}>
            <style>{`
                .page-51 { width: 100%; }
                .page51-container { width: 100%; padding: 15px 0 0 0; display: flex; flex-direction: column; box-sizing: border-box; flex: 1; overflow: visible; }
                .page51-chart-frame { background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-sizing: border-box; overflow: visible; }
                .section-four-page .page-51 .page51-chart-frame-before-footnote { padding-bottom: 20px !important; margin-bottom: 20px !important; }
                .page51-chart-title { font-family: var(--font-body); font-size: 20px; font-weight: bold; color: var(--gc-text); margin: 0 0 12px 0; text-align: center; max-width: 100%; overflow-wrap: break-word; word-wrap: break-word; word-break: break-word; white-space: normal; box-sizing: border-box; padding: 0 8px; }
                .page51-chart-title a { color: var(--gc-link); text-decoration: underline; }
                .page51-footnote { border-top: 1px solid #e0e0e0; padding-top: 12px; margin-top: 24px; margin-bottom: 0; font-family: var(--font-body); font-size: 1rem; line-height: 1.65; color: var(--gc-text); max-width: 100%; box-sizing: border-box; }
                @media (max-width: 768px) { .page51-chart-title { font-size: 18px; } }
                .page51-chart-frame details > summary:hover { background-color: #404040 !important; }
                .page51-chart-frame button[type="button"]:hover,
                .page51-chart-frame button:hover { background-color: #404040 !important; }
            `}</style>
            <div className="page51-container">
                {loading && <p>{lang === 'en' ? 'Loading…' : 'Chargement…'}</p>}
                {error && <p style={{ color: '#c00' }}>{error}</p>}
                {!loading && !error && !hasData && <p>{getText('page51_no_data', lang)}</p>}
                {!loading && !error && hasData && (
                    <>
                        <div ref={yearDropdownRef} style={{ position: 'relative', marginBottom: '20px', width: '200px' }}>
                            <label htmlFor="page51-year-button" style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>
                                {getText('year_slider_label', lang)}
                            </label>
                            <button
                                ref={yearButtonRef}
                                id="page51-year-button"
                                type="button"
                                onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                                aria-expanded={isYearDropdownOpen}
                                aria-label={selectedYear != null ? String(selectedYear) : ''}
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
                                <div role="listbox" aria-label={lang === 'en' ? 'Year' : 'Année'} style={{ position: 'absolute', top: '100%', left: 0, width: '100%', maxHeight: '300px', overflowY: 'auto', backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', zIndex: 100, boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                                    {years.map((y) => {
                                        const isSelected = y === selectedYear;
                                        return (
                                            <button
                                                key={y}
                                                role="option"
                                                aria-selected={isSelected}
                                                type="button"
                                                onClick={() => { setPickedYear(y); setIsYearDropdownOpen(false); setTimeout(() => yearButtonRef.current?.focus(), 0); }}
                                                style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '10px 15px', cursor: 'pointer', border: 'none', borderBottom: '1px solid #eee', backgroundColor: isSelected ? '#f0f9ff' : '#fff', fontFamily: 'Arial, sans-serif' }}
                                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isSelected ? '#f0f9ff' : '#f5f5f5'; }}
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
                                {selectedYear != null ? (lang === 'en' ? `Showing data for ${selectedYear}` : `Données affichées pour ${selectedYear}`) : ''}
                            </div>
                        </div>

                        <div className="page51-chart-frame page51-chart-frame-before-footnote">
                            <p className="page51-chart-title" style={{ textAlign: 'center', width: '100%', boxSizing: 'border-box', margin: '0 0 1rem 0' }}>
                                {chart1Title}
                                <span id="fn-asterisk-rf-page51" style={{ verticalAlign: 'super', fontSize: '0.75em' }}>
                                    <a className="fn-lnk" href="#fn-asterisk-page51" onClick={scrollToFootnote}>
                                        <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                                        <span aria-hidden="true">*</span>
                                    </a>
                                </span>
                            </p>
                            {effectiveSlices1 != null && effectiveSlices1.length > 0 && (
                                <div style={{ marginBottom: 8 }}>
                                    <button type="button" onClick={() => setSelectedSlices1(null)} style={{ padding: '6px 12px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontSize: 14, color: '#fff' }}>
                                        {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                                    </button>
                                </div>
                            )}
                            <div style={{ width: '100%', overflow: 'hidden', display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                                <div ref={chartRef1} role="region" aria-label={chart1Title} tabIndex={0} style={{ position: 'relative', overflow: 'visible', minWidth: PAGE51_CHART_MIN_WIDTH, width: '100%', maxWidth: '100%', flexShrink: 0 }}>
                                    <figure style={{ width: '100%', height: PAGE51_CHART_HEIGHT, margin: 0, overflow: 'visible' }}>
                                        <Plot
                                            key={selectedYear}
                                            data={plot1Data}
                                            layout={layout1}
                                            config={config1}
                                            style={{ width: '100%', height: PAGE51_CHART_HEIGHT }}
                                            useResizeHandler
                                            onClick={(data) => {
                                            const pt = data.points?.[0];
                                            const idx = pt && (pt.pointNumber !== undefined ? pt.pointNumber : pt.pointIndex);
                                            if (idx == null) return;
                                            if (windowWidth <= 768) {
                                                const now = Date.now();
                                                const last = lastPieClickRef1.current;
                                                const samePoint = idx === last.index;
                                                const doubleTap = samePoint && (now - last.time < 300);
                                                lastPieClickRef1.current = { time: now, index: idx };
                                                if (!doubleTap) return;
                                            }
                                            setSelectedSlices1((prev) => {
                                                if (prev === null) return [idx];
                                                if (prev.includes(idx)) return prev.length <= 1 ? null : prev.filter((i) => i !== idx);
                                                return [...prev, idx];
                                            });
                                        }}
                                        />
                                    </figure>
                                </div>
                            </div>
                            <details open={isTable1Open} onToggle={(e) => setIsTable1Open(e.currentTarget.open)} style={{ marginTop: 12, width: '100%' }}>
                                <summary role="button" aria-expanded={isTable1Open} style={{ cursor: 'pointer', color: '#fff', fontWeight: 'bold', padding: '10px', border: '1px solid #404040', backgroundColor: '#8C8C8C', borderRadius: '4px', listStyle: 'none' }}>
                                    <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTable1Open ? '▼' : '▶'}</span>
                                    {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                    <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                                </summary>
                                <div className="table-responsive" role="region" tabIndex={0} style={{ marginTop: 12 }}>
                                    <table className="table table-striped table-hover">
                                        <caption className="wb-inv">{getText('page51_table_caption_by_type', lang)}</caption>
                                        <thead>
                                            <tr>
                                                <th scope="col" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Year' : 'Année'}</th>
                                                {REU_BY_TYPE_ORDER.map((k) => (
                                                    <th key={k} scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{getText(getReuLabelKey(k), lang)} (PJ)</th>
                                                ))}
                                                <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Total (PJ)' : 'Total (PJ)'}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {table1AllYearsRows.map((r) => (
                                                <tr key={r.year}>
                                                    <th scope="row" style={{ border: '1px solid #ddd' }}>{r.year}</th>
                                                    {REU_BY_TYPE_ORDER.map((k) => (
                                                        <td key={k} style={{ border: '1px solid #ddd', textAlign: 'right' }}>{Number(r[k]).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { maximumFractionDigits: 2 })}</td>
                                                    ))}
                                                    <td style={{ border: '1px solid #ddd', textAlign: 'right' }}>{Number(r.total).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { maximumFractionDigits: 2 })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                                    <button type="button" onClick={downloadTable1CSV} style={{ padding: '8px 16px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
                                        {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                    </button>
                                    <button type="button" onClick={downloadTable1Docx} style={{ padding: '8px 16px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
                                        {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                    </button>
                                </div>
                            </details>
                        </div>

                        <div className="page51-chart-frame">
                            <p className="page51-chart-title" style={{ textAlign: 'center', width: '100%', boxSizing: 'border-box', margin: '0 0 1rem 0' }}>{chart2Title}</p>
                            {effectiveSlices2 != null && effectiveSlices2.length > 0 && (
                                <div style={{ marginBottom: 8 }}>
                                    <button type="button" onClick={() => setSelectedSlices2(null)} style={{ padding: '6px 12px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontSize: 14, color: '#fff' }}>
                                        {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                                    </button>
                                </div>
                            )}
                            <div style={{ width: '100%', overflow: 'hidden', display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                                <div ref={chartRef2} role="region" aria-label={chart2Title} tabIndex={0} style={{ position: 'relative', overflow: 'visible', minWidth: PAGE51_CHART_MIN_WIDTH, width: '100%', maxWidth: '100%', flexShrink: 0 }}>
                                    <figure style={{ width: '100%', height: PAGE51_CHART_HEIGHT, margin: 0, overflow: 'visible' }}>
                                        <Plot
                                            key={selectedYear}
                                            data={plot2Data}
                                            layout={layout2}
                                            config={config2}
                                            style={{ width: '100%', height: PAGE51_CHART_HEIGHT }}
                                            useResizeHandler
                                            onClick={(data) => {
                                            const pt = data.points?.[0];
                                            const idx = pt && (pt.pointNumber !== undefined ? pt.pointNumber : pt.pointIndex);
                                            if (idx == null) return;
                                            if (windowWidth <= 768) {
                                                const now = Date.now();
                                                const last = lastPieClickRef2.current;
                                                const samePoint = idx === last.index;
                                                const doubleTap = samePoint && (now - last.time < 300);
                                                lastPieClickRef2.current = { time: now, index: idx };
                                                if (!doubleTap) return;
                                            }
                                            setSelectedSlices2((prev) => {
                                                if (prev === null) return [idx];
                                                if (prev.includes(idx)) return prev.length <= 1 ? null : prev.filter((i) => i !== idx);
                                                return [...prev, idx];
                                            });
                                        }}
                                        />
                                    </figure>
                                </div>
                            </div>
                            <details open={isTable2Open} onToggle={(e) => setIsTable2Open(e.currentTarget.open)} style={{ marginTop: 12, width: '100%' }}>
                                <summary role="button" aria-expanded={isTable2Open} style={{ cursor: 'pointer', color: '#fff', fontWeight: 'bold', padding: '10px', border: '1px solid #404040', backgroundColor: '#8C8C8C', borderRadius: '4px', listStyle: 'none' }}>
                                    <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTable2Open ? '▼' : '▶'}</span>
                                    {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                    <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                                </summary>
                                <div className="table-responsive" role="region" tabIndex={0} style={{ marginTop: 12 }}>
                                    <table className="table table-striped table-hover">
                                        <caption className="wb-inv">{getText('page51_table_caption_water', lang)}</caption>
                                        <thead>
                                            <tr>
                                                <th scope="col" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Year' : 'Année'}</th>
                                                {SOURCE_ORDER.map((k) => (
                                                    <th key={k} scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{getSourceLabel(k, lang)} (PJ)</th>
                                                ))}
                                                <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Total (PJ)' : 'Total (PJ)'}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {table2AllYearsRows.map((r) => (
                                                <tr key={r.year}>
                                                    <th scope="row" style={{ border: '1px solid #ddd' }}>{r.year}</th>
                                                    {SOURCE_ORDER.map((k) => (
                                                        <td key={k} style={{ border: '1px solid #ddd', textAlign: 'right' }}>{Number(r[k]).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { maximumFractionDigits: 2 })}</td>
                                                    ))}
                                                    <td style={{ border: '1px solid #ddd', textAlign: 'right' }}>{Number(r.total).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { maximumFractionDigits: 2 })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                                    <button type="button" onClick={downloadTable2CSV} style={{ padding: '8px 16px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
                                        {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                    </button>
                                    <button type="button" onClick={downloadTable2Docx} style={{ padding: '8px 16px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
                                        {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                    </button>
                                </div>
                            </details>
                        </div>

                        <div className="page51-chart-frame">
                            <p className="page51-chart-title" style={{ textAlign: 'center', width: '100%', boxSizing: 'border-box', margin: '0 0 1rem 0' }}>{chart3Title}</p>
                            {effectiveSlices3 != null && effectiveSlices3.length > 0 && (
                                <div style={{ marginBottom: 8 }}>
                                    <button type="button" onClick={() => setSelectedSlices3(null)} style={{ padding: '6px 12px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontSize: 14, color: '#fff' }}>
                                        {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                                    </button>
                                </div>
                            )}
                            <div style={{ width: '100%', overflow: 'hidden', display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                                <div ref={chartRef3} role="region" aria-label={chart3Title} tabIndex={0} style={{ position: 'relative', overflow: 'visible', minWidth: PAGE51_CHART_MIN_WIDTH, width: '100%', maxWidth: '100%', flexShrink: 0 }}>
                                    <figure style={{ width: '100%', height: PAGE51_CHART_HEIGHT, margin: 0, overflow: 'visible' }}>
                                        <Plot
                                            key={selectedYear}
                                            data={plot3Data}
                                            layout={layout3}
                                            config={config3}
                                            style={{ width: '100%', height: PAGE51_CHART_HEIGHT }}
                                            useResizeHandler
                                            onClick={(data) => {
                                            const pt = data.points?.[0];
                                            const idx = pt && (pt.pointNumber !== undefined ? pt.pointNumber : pt.pointIndex);
                                            if (idx == null) return;
                                            if (windowWidth <= 768) {
                                                const now = Date.now();
                                                const last = lastPieClickRef3.current;
                                                const samePoint = idx === last.index;
                                                const doubleTap = samePoint && (now - last.time < 300);
                                                lastPieClickRef3.current = { time: now, index: idx };
                                                if (!doubleTap) return;
                                            }
                                            setSelectedSlices3((prev) => {
                                                if (prev === null) return [idx];
                                                if (prev.includes(idx)) return prev.length <= 1 ? null : prev.filter((i) => i !== idx);
                                                return [...prev, idx];
                                            });
                                        }}
                                        />
                                    </figure>
                                </div>
                            </div>
                            <details open={isTable3Open} onToggle={(e) => setIsTable3Open(e.currentTarget.open)} style={{ marginTop: 12, width: '100%' }}>
                                <summary role="button" aria-expanded={isTable3Open} style={{ cursor: 'pointer', color: '#fff', fontWeight: 'bold', padding: '10px', border: '1px solid #404040', backgroundColor: '#8C8C8C', borderRadius: '4px', listStyle: 'none' }}>
                                    <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTable3Open ? '▼' : '▶'}</span>
                                    {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                    <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                                </summary>
                                <div className="table-responsive" role="region" tabIndex={0} style={{ marginTop: 12 }}>
                                    <table className="table table-striped table-hover">
                                        <caption className="wb-inv">{getText('page51_table_caption_space', lang)}</caption>
                                        <thead>
                                            <tr>
                                                <th scope="col" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Year' : 'Année'}</th>
                                                {SOURCE_ORDER.map((k) => (
                                                    <th key={k} scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{getSourceLabel(k, lang)} (PJ)</th>
                                                ))}
                                                <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Total (PJ)' : 'Total (PJ)'}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {table3AllYearsRows.map((r) => (
                                                <tr key={r.year}>
                                                    <th scope="row" style={{ border: '1px solid #ddd' }}>{r.year}</th>
                                                    {SOURCE_ORDER.map((k) => (
                                                        <td key={k} style={{ border: '1px solid #ddd', textAlign: 'right' }}>{Number(r[k]).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { maximumFractionDigits: 2 })}</td>
                                                    ))}
                                                    <td style={{ border: '1px solid #ddd', textAlign: 'right' }}>{Number(r.total).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { maximumFractionDigits: 2 })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                                    <button type="button" onClick={downloadTable3CSV} style={{ padding: '8px 16px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
                                        {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                    </button>
                                    <button type="button" onClick={downloadTable3Docx} style={{ padding: '8px 16px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
                                        {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                    </button>
                                </div>
                            </details>
                        </div>

                        <aside className="wb-fnote page51-footnote" role="note">
                            <h2 id="fn">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                            <dl>
                                <dt className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</dt>
                                <dd id="fn-asterisk-page51">
                                    <a href="#fn-asterisk-rf-page51" onClick={scrollToRef} className="fn-num" title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}>
                                        <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                                    </a>
                                    {' '}{getText('page51_footnote_rounding', lang)}
                                </dd>
                            </dl>
                        </aside>
                    </>
                )}
            </div>
        </main>
    );
};

export default Page51;
