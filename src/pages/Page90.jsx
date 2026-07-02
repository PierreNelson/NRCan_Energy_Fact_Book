import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';

const NUCLEAR_FACILITIES = [
    { key: 'darlington', facilityEn: 'Darlington', provinceKey: 'ontario', outputMw: 3736, units: 4 },
    { key: 'bruce_b', facilityEn: 'Bruce B', provinceKey: 'ontario', outputMw: 3507, units: 4 },
    { key: 'bruce_a', facilityEn: 'Bruce A', provinceKey: 'ontario', outputMw: 3437, units: 4 },
    { key: 'pickering_b', facilityEn: 'Pickering B', provinceKey: 'ontario', outputMw: 2160, units: 4 },
    { key: 'point_lepreau', facilityEn: 'Point Lepreau', provinceKey: 'nb', outputMw: 705, units: 1 },
];

const URANIUM_PRICE_DATA = [
    { year: 1996, spot: 15.2, foreignPurchases: 14.5 },
    { year: 1997, spot: 12.5, foreignPurchases: 13.0 },
    { year: 1998, spot: 11.8, foreignPurchases: 12.2 },
    { year: 1999, spot: 10.2, foreignPurchases: 11.5 },
    { year: 2000, spot: 9.8, foreignPurchases: 11.0 },
    { year: 2001, spot: 10.5, foreignPurchases: 11.2 },
    { year: 2002, spot: 10.8, foreignPurchases: 11.5 },
    { year: 2003, spot: 11.2, foreignPurchases: 12.0 },
    { year: 2004, spot: 20.3, foreignPurchases: 16.5 },
    { year: 2005, spot: 29.5, foreignPurchases: 24.0 },
    { year: 2006, spot: 41.8, foreignPurchases: 35.0 },
    { year: 2007, spot: 84.5, foreignPurchases: 42.0 },
    { year: 2008, spot: 44.5, foreignPurchases: 50.5 },
    { year: 2009, spot: 36.5, foreignPurchases: 48.0 },
    { year: 2010, spot: 45.8, foreignPurchases: 52.0 },
    { year: 2011, spot: 55.2, foreignPurchases: 55.5 },
    { year: 2012, spot: 49.0, foreignPurchases: 54.0 },
    { year: 2013, spot: 38.5, foreignPurchases: 51.0 },
    { year: 2014, spot: 35.8, foreignPurchases: 48.5 },
    { year: 2015, spot: 35.2, foreignPurchases: 46.0 },
    { year: 2016, spot: 26.8, foreignPurchases: 42.0 },
    { year: 2017, spot: 22.0, foreignPurchases: 38.5 },
    { year: 2018, spot: 24.5, foreignPurchases: 37.0 },
    { year: 2019, spot: 26.0, foreignPurchases: 36.0 },
    { year: 2020, spot: 29.5, foreignPurchases: 35.5 },
    { year: 2021, spot: 32.8, foreignPurchases: 35.0 },
    { year: 2022, spot: 48.5, foreignPurchases: 42.0 },
    { year: 2023, spot: 55.0, foreignPurchases: 48.0 },
    { year: 2024, spot: 72.0, foreignPurchases: 55.0 },
];

const CHART_COLORS = { spot: '#333333', foreign: '#809276' };

const HOVER_LABEL = {
    bgcolor: '#ffffff',
    bordercolor: '#000000',
    font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
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

const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const Page90 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [selectedTraceIds, setSelectedTraceIds] = useState(null);
    const [isChartTableOpen, setIsChartTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

    const chartRef = useRef(null);
    const chartTableTopRef = useRef(null);
    const chartTableScrollRef = useRef(null);
    const chartTableBottomRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null });

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const formatMw = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const formatPrice = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    };

    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const scrollToElement = (id) => (event) => {
        event?.preventDefault();
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const syncTableScroll = useCallback((topRef, scrollRef, bottomRef) => {
        const topScroll = topRef.current;
        const tableScroll = scrollRef.current;
        const bottomScroll = bottomRef.current;
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

    const syncChartTableScroll = useCallback(
        () => syncTableScroll(chartTableTopRef, chartTableScrollRef, chartTableBottomRef),
        [syncTableScroll],
    );

    useEffect(() => {
        if (!isChartTableOpen) return undefined;
        const topScroll = chartTableTopRef.current;
        const tableScroll = chartTableScrollRef.current;
        const bottomScroll = chartTableBottomRef.current;
        if (!topScroll || !tableScroll || !bottomScroll) return undefined;

        const syncFrom = (source) => {
            if (source !== topScroll && topScroll.scrollLeft !== source.scrollLeft) topScroll.scrollLeft = source.scrollLeft;
            if (source !== tableScroll && tableScroll.scrollLeft !== source.scrollLeft) tableScroll.scrollLeft = source.scrollLeft;
            if (source !== bottomScroll && bottomScroll.scrollLeft !== source.scrollLeft) bottomScroll.scrollLeft = source.scrollLeft;
        };

        const handleTop = () => syncFrom(topScroll);
        const handleTable = () => syncFrom(tableScroll);
        const handleBottom = () => syncFrom(bottomScroll);
        const sync = () => window.requestAnimationFrame(syncChartTableScroll);

        topScroll.addEventListener('scroll', handleTop);
        tableScroll.addEventListener('scroll', handleTable);
        bottomScroll.addEventListener('scroll', handleBottom);
        const observer = new ResizeObserver(sync);
        const tableEl = tableScroll.querySelector('table');
        if (tableEl) observer.observe(tableEl);
        observer.observe(tableScroll);
        sync();

        return () => {
            topScroll.removeEventListener('scroll', handleTop);
            tableScroll.removeEventListener('scroll', handleTable);
            bottomScroll.removeEventListener('scroll', handleBottom);
            observer.disconnect();
        };
    }, [isChartTableOpen, windowWidth, syncChartTableScroll]);

    useEffect(() => {
        if (!chartRef.current) return undefined;
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
    }, [lang, selectedTraceIds]);

    const facilitiesRows = useMemo(
        () =>
            NUCLEAR_FACILITIES.map((row) => ({
                ...row,
                facility: row.facilityEn,
                province: getText(`page90_province_${row.provinceKey}`, lang),
            })),
        [lang],
    );

    const years = useMemo(() => URANIUM_PRICE_DATA.map((row) => row.year), []);
    const spotValues = useMemo(() => URANIUM_PRICE_DATA.map((row) => row.spot), []);
    const foreignValues = useMemo(() => URANIUM_PRICE_DATA.map((row) => row.foreignPurchases), []);
    const chartYearStart = years[0];
    const chartYearEnd = years[years.length - 1];
    const chartYearVars = { startYear: chartYearStart, endYear: chartYearEnd };

    const spotLabel = getText('page90_legend_spot', lang);
    const foreignLabel = getText('page90_legend_foreign', lang);
    const chartTitle = getText('page90_chart_title', lang);
    const chartTitlePlain = stripHtml(chartTitle);
    const chartDocxTitle = `${substitute(getText('page90_chart_docx_title', lang), chartYearVars)}*`;
    const priceUnit = getText('page90_yaxis', lang);
    const facilitiesTitle = getText('page90_facilities_title', lang);
    const facilitiesFileSlug = getText('page90_facilities_csv_slug', lang).replace(/\.csv$/i, '');
    const chartFileSlug = substitute(getText('page90_chart_file_slug', lang), chartYearVars);

    const facilitiesTableHeaders = [
        getText('page90_facilities_col_facility', lang),
        getText('page90_facilities_col_province', lang),
        getText('page90_facilities_col_output', lang),
        getText('page90_facilities_col_units', lang),
    ];

    const chartTableHeaders = [
        getText('page90_chart_table_col_year', lang),
        getText('page90_chart_table_col_spot', lang),
        getText('page90_chart_table_col_foreign', lang),
    ];

    const chartTableRows = useMemo(
        () => [...URANIUM_PRICE_DATA].sort((a, b) => b.year - a.year),
        [],
    );

    const tickFont = { size: windowWidth <= 480 ? 12 : 14, family: 'Arial, sans-serif' };
    const axisTitleFont = { size: windowWidth <= 480 ? 13 : 15, family: 'Arial, sans-serif', color: '#333333' };
    const plotHeight = windowWidth <= 480 ? 320 : windowWidth <= 768 ? 360 : 400;
    const yearTicks = years.filter((year) => year % 2 === 0);

    const spotFocused = selectedTraceIds === null || selectedTraceIds.includes(0);
    const foreignFocused = selectedTraceIds === null || selectedTraceIds.includes(1);

    const spotHoverTemplates = years.map(
        (y, i) => `<b>${spotLabel}</b><br>${y}: ${formatPrice(spotValues[i])} ${priceUnit}<extra></extra>`,
    );
    const foreignHoverTemplates = years.map(
        (y, i) => `<b>${foreignLabel}</b><br>${y}: ${formatPrice(foreignValues[i])} ${priceUnit}<extra></extra>`,
    );

    const handleChartClick = useCallback((event) => {
        if (!event?.points?.length) return;
        const traceIndex = event.points[0].curveNumber;
        if (traceIndex !== 0 && traceIndex !== 1) return;

        if (windowWidth <= 768) {
            const now = Date.now();
            const last = lastClickRef.current;
            const isDoubleTap = traceIndex === last.traceIndex && now - last.time < 300;
            lastClickRef.current = { time: now, traceIndex };
            if (!isDoubleTap) return;
        }

        setSelectedTraceIds((prev) => {
            if (prev === null) return [traceIndex];
            if (prev.includes(traceIndex)) {
                const next = prev.filter((t) => t !== traceIndex);
                return next.length === 0 ? null : next;
            }
            return [...prev, traceIndex];
        });
    }, [windowWidth]);

    const downloadChartPng = async () => {
        const plotElement = chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        try {
            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 1200,
                height: 640,
                scale: 2,
            });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                const titleHeight = 80;
                const legendHeight = 56;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight + legendHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 32px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`${chartTitlePlain}*`, canvas.width / 2, 48);
                ctx.drawImage(img, 0, titleHeight);
                const legendY = titleHeight + img.height + 36;
                const legendItems = [
                    { color: CHART_COLORS.spot, label: spotLabel, type: 'line' },
                    { color: CHART_COLORS.foreign, label: foreignLabel, type: 'line' },
                ];
                ctx.font = '24px Arial';
                ctx.textAlign = 'left';
                const totalLegendWidth = legendItems.reduce((sum, item) => sum + ctx.measureText(item.label).width + 56, 0) + 40;
                let x = (canvas.width - totalLegendWidth) / 2;
                legendItems.forEach((item) => {
                    ctx.fillStyle = item.color;
                    ctx.fillRect(x, legendY - 4, 28, 4);
                    ctx.fillStyle = '#333333';
                    ctx.fillText(item.label, x + 36, legendY + 6);
                    x += 36 + ctx.measureText(item.label).width + 40;
                });
                canvas.toBlob((blob) => {
                    if (blob) saveAs(blob, `${chartFileSlug}.png`);
                });
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
            name: getText('page90_download_png', lang),
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: downloadChartPng,
        }],
    };

    const downloadFacilitiesCsv = () => {
        const rows = facilitiesRows.map((row) => [row.facility, row.province, row.outputMw, row.units]);
        const csv = [facilitiesTableHeaders.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
        saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${facilitiesFileSlug}.csv`);
    };

    const downloadFacilitiesDocx = async () => {
        const headerRow = new TableRow({
            children: facilitiesTableHeaders.map((header) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 22, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
                shading: { fill: '48484A' },
            })),
        });
        const dataDocRows = facilitiesRows.map((row, index) => {
            const isOdd = index % 2 === 0;
            const fill = isOdd ? 'B8BEAD' : 'fefefe';
            return new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: row.facility, bold: true, size: 22 })], alignment: AlignmentType.LEFT })],
                        shading: { fill },
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: row.province, size: 22 })], alignment: AlignmentType.LEFT })],
                        shading: { fill },
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: formatMw(row.outputMw), size: 22 })], alignment: AlignmentType.RIGHT })],
                        shading: { fill },
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: String(row.units), size: 22 })], alignment: AlignmentType.CENTER })],
                        shading: { fill },
                    }),
                ],
            });
        });
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: facilitiesTitle, bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [3200, 2400, 3200, 1400],
                        rows: [headerRow, ...dataDocRows],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), `${facilitiesFileSlug}.docx`);
    };

    const downloadFacilitiesPng = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const colWidths = [220, 180, 220, 100];
        const rowHeight = 42;
        const headerHeight = 48;
        const titleHeight = 72;
        const tableWidth = colWidths.reduce((sum, w) => sum + w, 0);
        const tableHeight = headerHeight + facilitiesRows.length * rowHeight;
        canvas.width = tableWidth + 40;
        canvas.height = titleHeight + tableHeight + 40;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#26374a';
        ctx.font = 'bold 18px Lato, Arial, sans-serif';
        ctx.textAlign = 'center';
        const titleLines = facilitiesTitle.match(/.{1,55}(\s|$)/g) || [facilitiesTitle];
        titleLines.forEach((line, index) => {
            ctx.fillText(line.trim(), canvas.width / 2, 28 + index * 24);
        });
        const startX = 20;
        let y = titleHeight;
        ctx.font = 'bold 15px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(startX, y, tableWidth, headerHeight);
        ctx.fillStyle = '#48484A';
        ctx.fillRect(startX, y, tableWidth, headerHeight);
        facilitiesTableHeaders.forEach((header, index) => {
            const x = startX + colWidths.slice(0, index).reduce((sum, w) => sum + w, 0) + colWidths[index] / 2;
            ctx.fillText(header, x, y + 30);
        });
        y += headerHeight;
        facilitiesRows.forEach((row, rowIndex) => {
            const isOdd = rowIndex % 2 === 0;
            const fill = isOdd ? '#B8BEAD' : '#fefefe';
            ctx.fillStyle = fill;
            ctx.fillRect(startX, y, tableWidth, rowHeight);
            ctx.fillStyle = '#000000';
            ctx.font = '15px Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(row.facility, startX + 12, y + 27);
            ctx.fillText(row.province, startX + colWidths[0] + 12, y + 27);
            ctx.textAlign = 'right';
            ctx.fillText(formatMw(row.outputMw), startX + colWidths[0] + colWidths[1] + colWidths[2] - 12, y + 27);
            ctx.textAlign = 'center';
            ctx.fillText(String(row.units), startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] / 2, y + 27);
            y += rowHeight;
        });
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `${facilitiesFileSlug}.png`;
        link.click();
    };

    const downloadChartCsv = () => {
        const rows = chartTableRows.map((row) => [row.year, formatPrice(row.spot), formatPrice(row.foreignPurchases)]);
        const csv = [chartTableHeaders.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
        saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${chartFileSlug}.csv`);
    };

    const downloadChartDocx = async () => {
        const headerRow = new TableRow({
            children: chartTableHeaders.map((header) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 22 })], alignment: AlignmentType.CENTER })],
                shading: { fill: 'E6E6E6' },
            })),
        });
        const dataDocRows = chartTableRows.map((row) => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(row.year), size: 22 })], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatPrice(row.spot), size: 22 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatPrice(row.foreignPurchases), size: 22 })], alignment: AlignmentType.RIGHT })] }),
            ],
        }));
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: chartDocxTitle, bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [1200, 3600, 3600],
                        rows: [headerRow, ...dataDocRows],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), `${chartFileSlug}.docx`);
    };

    const plotData = [
        {
            x: years,
            y: spotValues,
            type: 'scatter',
            mode: 'lines',
            name: spotLabel,
            line: {
                color: spotFocused ? CHART_COLORS.spot : hexToRgba(CHART_COLORS.spot, 0.3),
                width: 3,
            },
            hovertemplate: spotHoverTemplates,
            hoveron: 'points',
        },
        {
            x: years,
            y: foreignValues,
            type: 'scatter',
            mode: 'lines',
            name: foreignLabel,
            line: {
                color: foreignFocused ? CHART_COLORS.foreign : hexToRgba(CHART_COLORS.foreign, 0.3),
                width: 3,
            },
            hovertemplate: foreignHoverTemplates,
            hoveron: 'points',
        },
    ];

    const plotLayout = {
        showlegend: false,
        hovermode: 'closest',
        hoverlabel: HOVER_LABEL,
        clickmode: 'event',
        dragmode: false,
        height: plotHeight,
        margin: { l: 72, r: 24, t: 24, b: windowWidth <= 480 ? 72 : 56 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        xaxis: {
            showgrid: false,
            zeroline: false,
            showline: true,
            linewidth: 1,
            linecolor: '#333333',
            tickfont: tickFont,
            tickmode: 'array',
            tickvals: yearTicks,
            ticktext: yearTicks.map(String),
            range: [1995.5, 2024.5],
            automargin: true,
        },
        yaxis: {
            title: { text: getText('page90_yaxis', lang), font: axisTitleFont, standoff: 12 },
            showgrid: false,
            zeroline: false,
            showline: true,
            linewidth: 1,
            linecolor: '#333333',
            tickfont: tickFont,
            range: [0, 100],
            dtick: 10,
            automargin: true,
        },
        autosize: true,
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-90"
            role="main"
            aria-labelledby="page90-facilities-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-90.page-content { max-width: none !important; overflow-x: visible !important; }
.page-90 {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.page90-container { width: 100%; padding: 15px 0 0 0; box-sizing: border-box; }
.page90-facilities-title {
    font-family: 'Lato', sans-serif;
    font-size: 22px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 16px 0;
    line-height: 1.35;
    text-transform: none;
    text-align: center;
}
.page90-sector-table {
    width: 100%;
    border-collapse: collapse;
    font-family: Arial, sans-serif;
    font-size: 0.95rem;
}
.page90-sector-table th,
.page90-sector-table td {
    border: 1px solid #ddd;
    padding: 10px 12px;
    text-align: center;
}
.page90-sector-table thead th {
    background-color: #48484A;
    color: #ffffff;
    font-weight: bold;
}
.page90-sector-table tbody tr:nth-child(odd) { background-color: #B8BEAD; }
.page90-sector-table tbody tr:nth-child(even) { background-color: #fefefe; }
.page90-sector-table tbody tr th[scope="row"] {
    text-align: left;
    font-weight: bold;
    color: inherit;
    background-color: inherit;
}
.page90-sector-table tbody tr td:first-child { text-align: left; font-weight: bold; }
.page90-sector-table tbody tr td:nth-child(3) { text-align: right; }
.page90-sector-table tbody tr:hover {
    box-shadow: inset 0 0 0 9999px rgba(0, 0, 0, 0.2);
    background-color: transparent;
}
.page90-sector-table tbody tr:hover th,
.page90-sector-table tbody tr:hover td {
    background-color: transparent;
}
.page90-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-top: 28px;
    box-sizing: border-box;
    overflow: visible;
}
.page90-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
}
.page90-chart-title .fn-lnk { color: #26374a; text-decoration: underline; }
.page90-chart { width: 100%; min-width: 0; position: relative; z-index: 1; overflow: visible; }
.page90-chart > div { width: 100%; height: 100%; overflow: visible; }
.page90-clear-selection {
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
.page90-legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 14px 24px;
    margin-top: 16px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: var(--gc-text);
}
.page90-legend-item { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.page90-legend-line { width: 28px; height: 4px; display: inline-block; }
.page90-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.page90-table-wrapper details > summary {
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
.page90-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page90-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page90-table-scrollbar > div { height: 20px; }
.page90-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #ddd;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.page90-table-responsive::-webkit-scrollbar { display: none; }
.page90-table-responsive table { width: max-content !important; min-width: 100%; }
.page90-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.page90-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.page90-download-buttons button:hover,
.page90-table-wrapper summary:hover,
.page90-clear-selection:hover { background-color: #404040 !important; }
.page90-footnotes {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--gc-text);
    margin-top: 24px;
    margin-bottom: 0;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
    line-height: 1.65;
}
.page90-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 1rem;
}
.page90-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
.page90-footnotes dd p { margin: 0; }
@media (max-width: 768px) {
    .page90-facilities-title { font-size: 20px; }
    .page90-chart-title { font-size: 26px; }
}
            `}</style>

            <div className="page90-container">
                <h2 id="page90-facilities-title" className="page90-facilities-title">{facilitiesTitle}</h2>

                <table className="page90-sector-table">
                    <caption className="wb-inv">{getText('page90_facilities_caption', lang)}</caption>
                    <thead>
                        <tr>
                            {facilitiesTableHeaders.map((header) => (
                                <th key={header} scope="col">{header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {facilitiesRows.map((row) => (
                            <tr key={row.key}>
                                <th scope="row">{row.facility}</th>
                                <td>{row.province}</td>
                                <td>{formatMw(row.outputMw)}</td>
                                <td>{row.units}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="page90-download-buttons">
                    <button type="button" onClick={downloadFacilitiesCsv}>{getText('page90_download_csv', lang)}</button>
                    <button type="button" onClick={downloadFacilitiesDocx}>{getText('page90_download_docx', lang)}</button>
                    <button type="button" onClick={downloadFacilitiesPng}>{getText('page90_download_table_png', lang)}</button>
                </div>

                <div className="page90-chart-frame">
                    <h2 id="page90-chart-title" className="page90-chart-title">
                        {chartTitle}
                        <span id="fn-asterisk-rf-page90" style={{ verticalAlign: 'super', fontSize: '0.75em' }}>
                            <a className="fn-lnk" href="#fn-asterisk-page90" onClick={scrollToElement('fn-asterisk-page90')}>
                                <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                                <span aria-hidden="true">*</span>
                            </a>
                        </span>
                    </h2>

                    {selectedTraceIds !== null && (
                        <button type="button" className="page90-clear-selection" onClick={() => setSelectedTraceIds(null)}>
                            {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                        </button>
                    )}

                    <figure ref={chartRef} className="page90-chart" role="region" aria-label={chartTitlePlain} tabIndex={0} style={{ margin: 0 }}>
                        <Plot
                            key={`page90-${selectedTraceIds ? selectedTraceIds.join('-') : 'all'}-${plotHeight}`}
                            data={plotData}
                            layout={plotLayout}
                            config={chartConfig}
                            style={{ width: '100%', height: '100%' }}
                            useResizeHandler
                            onClick={handleChartClick}
                        />
                    </figure>

                    <div className="page90-legend" aria-hidden="true">
                        <span className="page90-legend-item">
                            <span className="page90-legend-line" style={{ backgroundColor: CHART_COLORS.spot }} />
                            {spotLabel}
                        </span>
                        <span className="page90-legend-item">
                            <span className="page90-legend-line" style={{ backgroundColor: CHART_COLORS.foreign }} />
                            {foreignLabel}
                        </span>
                    </div>

                    <div className="page90-table-wrapper">
                        <details onToggle={(e) => setIsChartTableOpen(e.currentTarget.open)}>
                            <summary role="button" aria-expanded={isChartTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isChartTableOpen ? '▼' : '▶'}</span>
                                {getText('page90_chart_table_summary', lang)}
                                <span className="wb-inv">
                                    {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                </span>
                            </summary>
                            <div ref={chartTableTopRef} className="page90-table-scrollbar" aria-hidden="true"><div /></div>
                            <div
                                ref={chartTableScrollRef}
                                className="page90-table-responsive"
                                role="region"
                                aria-labelledby="page90-chart-table-caption"
                                tabIndex={0}
                            >
                                <table className="table table-bordered table-striped table-hover">
                                    <caption id="page90-chart-table-caption" className="wb-inv">
                                        {getText('page90_chart_table_caption', lang)}
                                    </caption>
                                    <thead>
                                        <tr>
                                            {chartTableHeaders.map((header) => (
                                                <th key={header} scope="col" style={{ fontWeight: 'bold', textAlign: 'center' }}>{header}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {chartTableRows.map((row) => (
                                            <tr key={row.year}>
                                                <th scope="row" style={{ fontWeight: 'bold', textAlign: 'center' }}>{row.year}</th>
                                                <td style={{ textAlign: 'right' }}>{formatPrice(row.spot)}</td>
                                                <td style={{ textAlign: 'right' }}>{formatPrice(row.foreignPurchases)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div ref={chartTableBottomRef} className="page90-table-scrollbar" aria-hidden="true"><div /></div>
                            <div className="page90-download-buttons">
                                <button type="button" onClick={downloadChartCsv}>{getText('page90_download_csv', lang)}</button>
                                <button type="button" onClick={downloadChartDocx}>{getText('page90_download_docx', lang)}</button>
                            </div>
                        </details>
                    </div>
                </div>

                <aside className="wb-fnote page90-footnotes" role="note">
                    <h2>{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnote' : 'Note de bas de page'}</dt>
                        <dd id="fn-asterisk-page90">
                            <a
                                href="#fn-asterisk-rf-page90"
                                onClick={scrollToElement('fn-asterisk-rf-page90')}
                                className="fn-num"
                                title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}
                            >
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                            </a>
                            {' '}{getText('page90_footnote', lang)}
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page90;
