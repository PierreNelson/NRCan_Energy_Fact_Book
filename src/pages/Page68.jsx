import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getElectricalEnergyUseData } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const SECTOR_KEYS = ['R', 'C', 'I', 'T', 'A'];
const SECTOR_LABEL_KEYS = {
    R: 'page68_sector_R',
    C: 'page68_sector_C',
    I: 'page68_sector_I',
    T: 'page68_sector_T',
    A: 'page68_sector_A',
};
const PROVINCE_KEYS = ['atl', 'bc_terr', 'alta', 'sask', 'man', 'ont', 'que'];
const PROVINCE_LABEL_KEYS = {
    atl: 'page68_label_atl',
    bc_terr: 'page68_label_bc_terr',
    alta: 'page68_label_alta',
    sask: 'page68_label_sask',
    man: 'page68_label_man',
    ont: 'page68_label_ont',
    que: 'page68_label_que',
};
const PROVINCE_FULL_LABEL_KEYS = {
    atl: 'page68_full_atl',
    bc_terr: 'page68_full_bc_terr',
    alta: 'page68_full_alta',
    sask: 'page68_full_sask',
    man: 'page68_full_man',
    ont: 'page68_full_ont',
    que: 'page68_full_que',
};
const COLORS = {
    atl: '#519CC8',
    bc_terr: '#63ad46',
    alta: '#779E29',
    sask: '#B36109',
    man: '#DF790C',
    ont: '#4f5f56',
    que: '#006d3b',
};

const MODEBAR_REMOVE = [
    'pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d',
    'autoScale2d', 'resetScale2d', 'toImage', 'hoverClosestCartesian',
    'hoverCompareCartesian', 'toggleSpikelines',
];

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    }
    return hex;
};

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const Page68 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const [isChartTableOpen, setIsChartTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [zoomLevel, setZoomLevel] = useState(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

    const chartRef = useRef(null);
    const sectorTableRef = useRef(null);
    const chartTableTopRef = useRef(null);
    const chartTableScrollRef = useRef(null);
    const chartTableBottomRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const formatPj = (value, digits = 1) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    };

    const formatPct = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        const formatted = Number(value).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        return lang === 'en' ? `${formatted}%` : `${formatted} %`;
    };

    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const scrollToElement = (id) => (event) => {
        event?.preventDefault();
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    useEffect(() => {
        getElectricalEnergyUseData()
            .then((data) => {
                setResult(data);
                setSelectedYear(data?.latestYear ?? null);
            })
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const onResize = () => {
            setWindowWidth(window.innerWidth);
            const viewportScale = window.visualViewport?.scale || 1;
            setZoomLevel(Math.max(viewportScale, window.devicePixelRatio || 1));
        };
        onResize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
            window.visualViewport?.removeEventListener('resize', onResize);
        };
    }, []);

    const syncChartTableScroll = useCallback(() => {
        const topScroll = chartTableTopRef.current;
        const tableScroll = chartTableScrollRef.current;
        const bottomScroll = chartTableBottomRef.current;
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
        const topScroll = chartTableTopRef.current;
        const tableScroll = chartTableScrollRef.current;
        const bottomScroll = chartTableBottomRef.current;
        if (!topScroll || !tableScroll || !bottomScroll || !isChartTableOpen) return;
        const syncFrom = (source) => {
            if (source !== topScroll && topScroll.scrollLeft !== source.scrollLeft) topScroll.scrollLeft = source.scrollLeft;
            if (source !== tableScroll && tableScroll.scrollLeft !== source.scrollLeft) tableScroll.scrollLeft = source.scrollLeft;
            if (source !== bottomScroll && bottomScroll.scrollLeft !== source.scrollLeft) bottomScroll.scrollLeft = source.scrollLeft;
        };
        const handleTopScroll = () => syncFrom(topScroll);
        const handleTableScroll = () => syncFrom(tableScroll);
        const handleBottomScroll = () => syncFrom(bottomScroll);
        const sync = () => window.requestAnimationFrame(syncChartTableScroll);
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
    }, [isChartTableOpen, windowWidth, syncChartTableScroll]);

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
                if (dataTitle && (dataTitle.includes('Download') || /télécharger|charger/i.test(dataTitle))) {
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
    }, [result, lang, selectedYear, selectedSlices]);

    const dataRows = result?.data || [];
    const selectedRow = useMemo(
        () => dataRows.find((row) => row.year === selectedYear) || dataRows[dataRows.length - 1] || null,
        [dataRows, selectedYear],
    );
    const year = selectedRow?.year ?? null;
    const prevRow = year != null ? dataRows.find((row) => row.year === year - 1) : null;
    const direction = prevRow && selectedRow?.total != null && prevRow.total != null && selectedRow.total < prevRow.total
        ? 'fell'
        : 'rose';

    const tableSubtitleAfterFn = substitute(
        getText(direction === 'fell' ? 'page68_table_subtitle_after_fn_fell' : 'page68_table_subtitle_after_fn_rose', lang),
        { total: formatPj(selectedRow?.total), year: year ?? '' },
    );

    const chartTitle = substitute(getText('page68_chart_title', lang), { year: year ?? '' });
    const tableFileTitle = substitute(getText('page68_table_download_title', lang), { year: year ?? '' });
    const chartFileTitle = substitute(getText('page68_chart_download_title', lang), { year: year ?? '' });

    const zoomLegendMode = windowWidth <= 1000 || zoomLevel >= 1.75;
    const effectiveSlices = windowWidth > 768 ? selectedSlices : null;

    const slices = useMemo(() => {
        if (!selectedRow?.provinces?.length) return [];
        return PROVINCE_KEYS.map((key) => selectedRow.provinces.find((slice) => slice.key === key)).filter(Boolean);
    }, [selectedRow]);

    const pieValues = slices.map((slice) => (slice.value != null && slice.value > 0 ? slice.value : 0.001));
    const baseColors = slices.map((slice) => COLORS[slice.key]);
    const pieColors = effectiveSlices?.length
        ? baseColors.map((color, index) => (effectiveSlices.includes(index) ? color : hexToRgba(color, 0.3)))
        : baseColors;
    const labels = slices.map((slice) => getText(PROVINCE_LABEL_KEYS[slice.key], lang));
    const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 16;
    const outsideTextSize = zoomLegendMode ? 16 : textSize;
    const hiddenLabelKeys = ['atl'];
    const outsideLabelTemplate = slices.map((slice) => (hiddenLabelKeys.includes(slice.key) ? '' : '%{label}<br>%{percent:.1%}'));
    const zoomLabelTemplate = slices.map((slice) => (hiddenLabelKeys.includes(slice.key) ? '' : '%{percent:.1%}'));
    const atlSlice = slices.find((slice) => slice.key === 'atl');

    const pieTrace = slices.length ? {
        type: 'pie',
        values: pieValues,
        labels,
        hole: 0.55,
        direction: 'clockwise',
        rotation: 0,
        sort: false,
        texttemplate: zoomLegendMode ? zoomLabelTemplate : outsideLabelTemplate,
        textinfo: zoomLegendMode ? 'percent' : 'label+percent',
        textposition: zoomLegendMode ? 'inside' : 'outside',
        textfont: { size: textSize, family: 'Arial, sans-serif', color: zoomLegendMode ? '#ffffff' : pieColors },
        outsidetextfont: { size: outsideTextSize, color: pieColors },
        marker: { colors: pieColors, line: { color: '#ffffff', width: 1 } },
        pull: effectiveSlices?.length
            ? pieValues.map((_, index) => (effectiveSlices.includes(index) ? 0.08 : 0.02))
            : pieValues.map(() => 0.02),
        hovertext: slices.map((slice) => `<b>${getText(PROVINCE_FULL_LABEL_KEYS[slice.key], lang)}</b><br>${formatPj(slice.value)} ${getText('page68_center_pj', lang)}<br>${formatPct(slice.pct)}`),
        hoverinfo: 'text',
        hoverlabel: { bgcolor: '#ffffff', font: { color: '#333333', size: 14, family: 'Arial, sans-serif' } },
        automargin: true,
    } : null;

    const pieLayout = {
        showlegend: false,
        margin: {
            t: zoomLegendMode ? 80 : 95,
            b: zoomLegendMode ? 120 : 80,
            l: windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 200,
            r: windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 200,
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        height: windowWidth <= 480 ? 430 : 520,
        clickmode: 'event',
        dragmode: false,
        annotations: selectedRow?.total != null ? [{
            text: `<b>${getText('page68_center_total', lang)}</b><br><b>${formatPj(selectedRow.total)}</b><br>${getText('page68_center_pj', lang)}`,
            showarrow: false,
            x: 0.5,
            y: 0.5,
            xref: 'paper',
            yref: 'paper',
            font: { size: windowWidth <= 480 ? 15 : 18, color: '#424243', family: 'Arial Black, Arial, sans-serif' },
        }] : [],
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
                ctx.fillText(chartTitle, canvas.width / 2, 44);
                ctx.drawImage(img, 0, titleHeight);
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = `${chartFileTitle}.png`;
                link.click();
            };
            img.src = imgData;
        } catch (err) {
            console.warn('Unable to download chart image.', err);
        }
    };

    const chartConfig = {
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        modeBarButtonsToRemove: MODEBAR_REMOVE,
        modeBarButtonsToAdd: [{
            name: getText('page68_download_png', lang),
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: downloadChartPng,
        }],
    };

    const sectorTableHeaders = [
        getText('page68_table_col_sector', lang),
        getText('page68_table_col_energy', lang),
        getText('page68_table_col_share', lang),
    ];

    const sectorTableBodyRows = selectedRow
        ? [
            ...SECTOR_KEYS.map((key) => {
                const sector = selectedRow.sectors.find((item) => item.key === key);
                return {
                    key,
                    label: getText(SECTOR_LABEL_KEYS[key], lang),
                    value: sector?.value,
                    pct: sector?.pct,
                    isTotal: false,
                };
            }),
            {
                key: 'total',
                label: getText('page68_sector_total', lang),
                value: selectedRow.total,
                pct: 100,
                isTotal: true,
            },
        ]
        : [];

    const chartTableHeaders = [
        getText('page68_chart_table_col_year', lang),
        getText('page68_chart_table_col_region', lang),
        getText('page68_chart_table_col_energy', lang),
        getText('page68_chart_table_col_share', lang),
    ];

    const chartTableRows = selectedRow
        ? slices.map((slice) => ({
            year,
            region: getText(PROVINCE_FULL_LABEL_KEYS[slice.key], lang),
            value: slice.value,
            pct: slice.pct,
        }))
        : [];

    const downloadSectorCsv = () => {
        if (!sectorTableBodyRows.length) return;
        const rows = sectorTableBodyRows.map((row) => [row.label, formatPj(row.value), formatPct(row.pct)]);
        const csv = [sectorTableHeaders.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
        saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${tableFileTitle}.csv`);
    };

    const downloadSectorDocx = async () => {
        if (!sectorTableBodyRows.length) return;
        const headerRow = new TableRow({
            children: sectorTableHeaders.map((header) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 22, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
                shading: { fill: '48484A' },
            })),
        });
        const dataDocRows = sectorTableBodyRows.map((row, index) => {
            const isTotal = row.isTotal;
            const isOdd = !isTotal && index % 2 === 0;
            const fill = isTotal ? '48484A' : isOdd ? 'B8BEAD' : 'fefefe';
            const color = isTotal ? 'FFFFFF' : '000000';
            return new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: row.label, bold: true, size: 22, color })], alignment: AlignmentType.LEFT })],
                        shading: { fill },
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: formatPj(row.value), bold: isTotal, size: 22, color })], alignment: AlignmentType.CENTER })],
                        shading: { fill },
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: formatPct(row.pct), bold: isTotal, size: 22, color })], alignment: AlignmentType.CENTER })],
                        shading: { fill },
                    }),
                ],
            });
        });
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: `${getText('page68_table_subtitle_before_fn', lang)} ${tableSubtitleAfterFn}`, bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [4200, 2400, 2400],
                        rows: [headerRow, ...dataDocRows],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), `${tableFileTitle}.docx`);
    };

    const downloadSectorPng = () => {
        if (!sectorTableBodyRows.length) return;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const colWidths = [260, 180, 160];
        const rowHeight = 42;
        const headerHeight = 48;
        const titleHeight = 72;
        const tableWidth = colWidths.reduce((sum, w) => sum + w, 0);
        const tableHeight = headerHeight + sectorTableBodyRows.length * rowHeight;
        canvas.width = tableWidth + 40;
        canvas.height = titleHeight + tableHeight + 40;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#26374a';
        ctx.font = 'bold 20px "Noto Sans", Arial, sans-serif';
        ctx.textAlign = 'center';
        const titleLines = (`${getText('page68_table_subtitle_before_fn', lang)} ${tableSubtitleAfterFn}`).match(/.{1,55}(\s|$)/g) || [];
        titleLines.forEach((line, index) => {
            ctx.fillText(line.trim(), canvas.width / 2, 28 + index * 24);
        });
        const startX = 20;
        let y = titleHeight;
        ctx.font = 'bold 16px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(startX, y, tableWidth, headerHeight);
        ctx.fillStyle = '#48484A';
        ctx.fillRect(startX, y, tableWidth, headerHeight);
        sectorTableHeaders.forEach((header, index) => {
            const x = startX + colWidths.slice(0, index).reduce((sum, w) => sum + w, 0) + colWidths[index] / 2;
            ctx.fillText(header, x, y + 30);
        });
        y += headerHeight;
        sectorTableBodyRows.forEach((row, rowIndex) => {
            const isTotal = row.isTotal;
            const isOdd = !isTotal && rowIndex % 2 === 0;
            const fill = isTotal ? '#48484A' : isOdd ? '#B8BEAD' : '#fefefe';
            const color = isTotal ? '#ffffff' : '#000000';
            ctx.fillStyle = fill;
            ctx.fillRect(startX, y, tableWidth, rowHeight);
            ctx.fillStyle = color;
            ctx.font = isTotal ? 'bold 15px Arial, sans-serif' : '15px Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(row.label, startX + 12, y + 27);
            ctx.textAlign = 'center';
            ctx.fillText(formatPj(row.value), startX + colWidths[0] + colWidths[1] / 2, y + 27);
            ctx.fillText(formatPct(row.pct), startX + colWidths[0] + colWidths[1] + colWidths[2] / 2, y + 27);
            y += rowHeight;
        });
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `${tableFileTitle}.png`;
        link.click();
    };

    const downloadChartCsv = () => {
        if (!chartTableRows.length) return;
        const rows = chartTableRows.map((row) => [row.year, row.region, formatPj(row.value), formatPct(row.pct)]);
        const csv = [chartTableHeaders.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
        saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${chartFileTitle}.csv`);
    };

    const downloadChartDocx = async () => {
        if (!chartTableRows.length) return;
        const headerRow = new TableRow({
            children: chartTableHeaders.map((header) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 22 })], alignment: AlignmentType.CENTER })],
                shading: { fill: 'E6E6E6' },
            })),
        });
        const dataDocRows = chartTableRows.map((row) => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(row.year), size: 22 })], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row.region, size: 22 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatPj(row.value), size: 22 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatPct(row.pct), size: 22 })], alignment: AlignmentType.RIGHT })] }),
            ],
        }));
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: chartTitle, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [1200, 4200, 1800, 1800],
                        rows: [headerRow, ...dataDocRows],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), `${chartFileTitle}.docx`);
    };

    if (loading) return <p className="page68-loading">{lang === 'en' ? 'Loading…' : 'Chargement…'}</p>;
    if (error) return <p className="page68-error" role="alert">{error}</p>;
    if (!selectedRow) return <p className="page68-error">{getText('page68_no_data', lang)}</p>;

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-68"
            role="main"
            aria-labelledby="page68-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-68.page-content { max-width: none !important; overflow-x: visible !important; }
.page-68 {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.page68-container { width: 100%; padding: 15px 0 0 0; box-sizing: border-box; }
.page68-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 25px;
    line-height: 1.25;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: none;
}
.page68-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.page68-main-row {
    display: flex;
    flex-direction: column;
    gap: 28px;
    align-items: stretch;
    margin-bottom: 24px;
}
.page68-table-col, .page68-chart-col { min-width: 0; width: 100%; }
.page68-table-subtitle {
    font-family: 'Lato', sans-serif;
    font-size: 22px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 16px 0;
    line-height: 1.35;
    text-transform: none;
}
.page68-sector-table {
    width: 100%;
    border-collapse: collapse;
    font-family: Arial, sans-serif;
    font-size: 0.95rem;
}
.page68-sector-table th,
.page68-sector-table td {
    border: 1px solid #ddd;
    padding: 10px 12px;
    text-align: center;
}
.page68-sector-table th {
    background-color: #48484A;
    color: #ffffff;
    font-weight: bold;
}
.page68-sector-table tbody tr:nth-child(odd):not(.page68-total-row) { background-color: #B8BEAD; }
.page68-sector-table tbody tr:nth-child(even):not(.page68-total-row) { background-color: #fefefe; }
.page68-sector-table tbody tr.page68-total-row th,
.page68-sector-table tbody tr.page68-total-row td {
    background-color: #48484A;
    color: #ffffff;
    font-weight: bold;
}
.page68-sector-table tbody tr th[scope="row"],
.page68-sector-table tbody tr td:first-child { text-align: left; font-weight: bold; }
.page68-sector-table tbody tr:hover:not(.page68-total-row) {
    box-shadow: inset 0 0 0 9999px rgba(0, 0, 0, 0.2);
    background-color: transparent;
}
.page68-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.page68-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.page68-download-buttons button:hover,
.page68-table-wrapper summary:hover,
.page68-clear-selection:hover { background-color: #404040 !important; }
.page68-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    box-sizing: border-box;
    overflow: visible;
}
.page68-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 24px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 8px 0;
    text-transform: none;
}
.page68-chart-scroll { width: 100%; overflow: hidden; display: flex; justify-content: center; }
.page68-chart { width: 100%; min-width: 0; height: 520px; position: relative; z-index: 1; overflow: visible; }
.page68-chart > div { width: 100%; height: 100%; overflow: visible; }
.page68-html-pie-label {
    position: absolute;
    z-index: 40;
    font-family: Arial, sans-serif;
    font-size: ${textSize}px;
    line-height: 1.15;
    font-weight: 400;
    text-align: center;
    pointer-events: auto;
}
.page68-atl-label { left: calc(50% - 72px); top: 36px; color: ${COLORS.atl}; }
.page68-custom-legend {
    position: relative;
    z-index: 60;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px 18px;
    flex-wrap: wrap;
    margin-top: 8px;
    margin-bottom: 8px;
    padding: 0 12px;
    font-family: Arial, sans-serif;
    font-size: 11px;
    color: var(--gc-text);
}
.page68-custom-legend-item { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.page68-custom-legend-swatch { width: 12px; height: 12px; display: inline-block; border-radius: 2px; border: 1px solid rgba(0, 0, 0, 0.15); }
.page68-clear-selection {
    padding: 6px 12px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: #fff;
    margin-bottom: 8px;
}
.page68-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.page68-table-wrapper details > summary {
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
.page68-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page68-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page68-table-scrollbar > div { height: 20px; }
.page68-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #ddd;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.page68-table-responsive::-webkit-scrollbar { display: none; }
.page68-table-responsive table { width: max-content !important; min-width: 100%; border-collapse: collapse; }
.page68-table-responsive th, .page68-table-responsive td {
    white-space: nowrap;
    padding: 8px 12px;
    font-family: Arial, sans-serif;
    color: var(--gc-text);
    border: 1px solid #ddd;
}
.page68-footnotes {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--gc-text);
    margin-top: 24px;
    margin-bottom: 0;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
    line-height: 1.65;
    max-width: 100%;
    box-sizing: border-box;
}
.page68-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 1rem;
}
.page68-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
.page68-footnotes dd p { margin: 0; }
.page68-loading, .page68-error {
    font-family: 'Noto Sans', sans-serif;
    font-size: 18px;
    color: var(--gc-text);
    margin: 24px 0;
}
@media (max-width: 768px) {
    .page68-title { font-size: 37px; }
    .page68-table-subtitle { font-size: 20px; }
    .page68-chart-title { font-size: 22px; }
    .page68-atl-label { left: calc(50% - 58px); top: 40px; }
}
            `}</style>

            <div className="page68-container">
                <h1 id="page68-title" className="page68-title">{getText('page68_title', lang)}</h1>

                <div className="page68-main-row">
                    <div className="page68-table-col">
                        <h2 className="page68-table-subtitle">
                            {getText('page68_table_subtitle_before_fn', lang)}
                            <a
                                id="fn1-rf-page68"
                                className="fn-lnk"
                                href="#fn1-page68"
                                onClick={scrollToElement('fn1-page68')}
                            >
                                <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>*
                            </a>
                            {tableSubtitleAfterFn}
                        </h2>
                        <div ref={sectorTableRef}>
                            <table className="page68-sector-table">
                                <caption className="wb-inv">{getText('page68_table_caption', lang)}</caption>
                                <thead>
                                    <tr>
                                        {sectorTableHeaders.map((header) => (
                                            <th key={header} scope="col">{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sectorTableBodyRows.map((row) => (
                                        <tr key={row.key} className={row.isTotal ? 'page68-total-row' : undefined}>
                                            <th scope="row">{row.label}</th>
                                            <td>{formatPj(row.value)}</td>
                                            <td>{formatPct(row.pct)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="page68-download-buttons">
                            <button type="button" onClick={downloadSectorCsv}>{getText('page68_download_csv', lang)}</button>
                            <button type="button" onClick={downloadSectorDocx}>{getText('page68_download_docx', lang)}</button>
                            <button type="button" onClick={downloadSectorPng}>{getText('page68_download_table_png', lang)}</button>
                        </div>
                    </div>

                    <div className="page68-chart-col">
                        <div className="page68-chart-frame">
                            <h2 id="page68-chart-title" className="page68-chart-title">{chartTitle}</h2>
                            {effectiveSlices?.length > 0 && (
                                <button type="button" className="page68-clear-selection" onClick={() => setSelectedSlices(null)}>
                                    {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                                </button>
                            )}
                            <div className="page68-chart-scroll">
                                <figure ref={chartRef} className="page68-chart" role="region" aria-label={chartTitle} tabIndex="0" style={{ margin: 0 }}>
                                    <div aria-hidden="true">
                                        {pieTrace && (
                                            <Plot
                                                key={`page68-pie-${year}-${zoomLegendMode ? 'compact' : 'wide'}-${effectiveSlices ? effectiveSlices.join('-') : 'none'}`}
                                                data={[pieTrace]}
                                                layout={pieLayout}
                                                config={chartConfig}
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
                                                    setSelectedSlices((previous) => {
                                                        if (previous === null) return [index];
                                                        if (previous.includes(index)) {
                                                            return previous.length <= 1 ? null : previous.filter((item) => item !== index);
                                                        }
                                                        return [...previous, index];
                                                    });
                                                }}
                                            />
                                        )}
                                    </div>
                                    {!zoomLegendMode && atlSlice && (
                                        <span id="fn2-rf-page68" className="page68-html-pie-label page68-atl-label">
                                            {getText('page68_label_atl', lang)}
                                            <a className="fn-lnk" href="#fn2-page68" onClick={scrollToElement('fn2-page68')}>
                                                <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>*
                                            </a>
                                            <br />
                                            {formatPct(atlSlice.pct)}
                                        </span>
                                    )}
                                </figure>
                            </div>
                            {zoomLegendMode && (
                                <div className="page68-custom-legend" aria-label={lang === 'en' ? 'Chart legend' : 'Légende du graphique'}>
                                    {slices.map((slice) => (
                                        <span key={slice.key} className="page68-custom-legend-item" id={slice.key === 'atl' ? 'fn2-rf-page68' : undefined}>
                                            <span className="page68-custom-legend-swatch" style={{ backgroundColor: COLORS[slice.key] }} aria-hidden="true" />
                                            <span>{getText(PROVINCE_LABEL_KEYS[slice.key], lang)}</span>
                                            {slice.key === 'atl' && (
                                                <a className="fn-lnk" href="#fn2-page68" onClick={scrollToElement('fn2-page68')}>
                                                    <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>*
                                                </a>
                                            )}
                                            <span>{formatPct(slice.pct)}</span>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="page68-table-wrapper">
                                <details className="page68-data-table" onToggle={(event) => setIsChartTableOpen(event.currentTarget.open)}>
                                    <summary role="button" aria-expanded={isChartTableOpen}>
                                        <span aria-hidden="true" style={{ marginRight: '8px' }}>{isChartTableOpen ? '▼' : '▶'}</span>
                                        {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                        <span className="wb-inv">
                                            {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                        </span>
                                    </summary>
                                    <p id="page68-chart-table-caption" className="wb-inv">{substitute(getText('page68_chart_table_caption', lang), { year: year ?? '' })}</p>
                                    <div ref={chartTableTopRef} className="page68-table-scrollbar" aria-hidden="true"><div /></div>
                                    <div ref={chartTableScrollRef} className="page68-table-responsive" role="region" aria-labelledby="page68-chart-table-caption" tabIndex={0}>
                                        <table className="table table-bordered table-striped table-hover">
                                            <thead>
                                                <tr>
                                                    {chartTableHeaders.map((header) => <th key={header} scope="col">{header}</th>)}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {chartTableRows.map((row) => (
                                                    <tr key={row.region}>
                                                        <th scope="row">{row.year}</th>
                                                        <td>{row.region}</td>
                                                        <td style={{ textAlign: 'right' }}>{formatPj(row.value)}</td>
                                                        <td style={{ textAlign: 'right' }}>{formatPct(row.pct)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div ref={chartTableBottomRef} className="page68-table-scrollbar" aria-hidden="true"><div /></div>
                                    <div className="page68-download-buttons">
                                        <button type="button" onClick={downloadChartCsv}>{getText('page68_download_csv', lang)}</button>
                                        <button type="button" onClick={downloadChartDocx}>{getText('page68_download_docx', lang)}</button>
                                        <button type="button" onClick={downloadChartPng}>{getText('page68_download_png', lang)}</button>
                                    </div>
                                </details>
                            </div>
                        </div>
                    </div>
                </div>

                <aside className="wb-fnote page68-footnotes" role="note">
                    <h2 id="fn-page68">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</dt>
                        <dt>{lang === 'en' ? 'Footnote 1' : 'Note de bas de page 1'}</dt>
                        <dd id="fn1-page68">
                            <a
                                href="#fn1-rf-page68"
                                onClick={scrollToElement('fn1-rf-page68')}
                                className="fn-num"
                                title={lang === 'en' ? 'Return to footnote 1 referrer' : 'Retour à la référence de la note de bas de page 1'}
                            >
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>
                                1
                            </a>
                            <p>{getText('page68_footnote1', lang)}</p>
                        </dd>
                        <dt>{lang === 'en' ? 'Footnote 2' : 'Note de bas de page 2'}</dt>
                        <dd id="fn2-page68">
                            <a
                                href="#fn2-rf-page68"
                                onClick={scrollToElement('fn2-rf-page68')}
                                className="fn-num"
                                title={lang === 'en' ? 'Return to footnote 2 referrer' : 'Retour à la référence de la note de bas de page 2'}
                            >
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>
                                2
                            </a>
                            <p>{getText('page68_footnote2', lang)}</p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page68;
