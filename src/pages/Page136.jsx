import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getRppSupplyDemandData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import Page136SupplyInfographic, { OVERLAY_SLOTS, SUPPLY_KEYS, TEXT_COLORS } from '../components/Page136SupplyInfographic';
import page136BgEn from '../assets/page136_bg.png';
import page136BgFr from '../assets/page136_bg_fr.png';

const substitute = (text, vars) => Object.keys(vars || {}).reduce(
    (value, key) => value.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '–')),
    text || '',
);

const PRODUCT_ORDER = [
    'motor_gasoline',
    'distillate',
    'still_gas',
    'jet',
    'coke',
    'asphalt',
    'residual',
    'other',
];

const PRODUCT_LABEL_KEYS = {
    motor_gasoline: 'page136_product_motor_gasoline',
    distillate: 'page136_product_distillate',
    still_gas: 'page136_product_still_gas',
    jet: 'page136_product_jet',
    coke: 'page136_product_coke',
    residual: 'page136_product_residual',
    asphalt: 'page136_product_asphalt',
    other: 'page136_product_other',
};

const PRODUCT_COLORS = {
    motor_gasoline: '#56433A',
    distillate: '#479CCD',
    still_gas: '#E77218',
    jet: '#1E4A6F',
    coke: '#7A7A7A',
    asphalt: '#A5916F',
    residual: '#2A9D8F',
    other: '#776240',
};

const SUPPLY_TABLE_KEYS = [
    'net_production',
    'exports',
    'imports',
    'domestic_consumption',
    'refinery_input',
];

const SUPPLY_LABEL_KEYS = {
    net_production: 'page136_supply_net_production',
    exports: 'page136_supply_exports',
    imports: 'page136_supply_imports',
    domestic_consumption: 'page136_supply_domestic',
    refinery_input: 'page136_supply_refinery',
};

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    }
    return hex;
};

const Page136 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const [isSupplyTableOpen, setIsSupplyTableOpen] = useState(false);
    const [isProductTableOpen, setIsProductTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [zoomLevel, setZoomLevel] = useState(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const chartRef = useRef(null);
    const supplyTableTopRef = useRef(null);
    const supplyTableScrollRef = useRef(null);
    const supplyTableBottomRef = useRef(null);
    const productTableTopRef = useRef(null);
    const productTableScrollRef = useRef(null);
    const productTableBottomRef = useRef(null);
    const lastPieClickRef = useRef({ time: 0, index: null });

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const formatNumber = (value, digits = 0) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    };
    const formatPct = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return `${Number(value).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`;
    };
    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const scrollToElement = (id) => (event) => {
        event?.preventDefault();
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    useEffect(() => {
        getRppSupplyDemandData()
            .then(setResult)
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

    const bindTableScrollSync = useCallback((isOpen, topRef, scrollRef, bottomRef) => {
        const topScroll = topRef.current;
        const tableScroll = scrollRef.current;
        const bottomScroll = bottomRef.current;
        if (!topScroll || !tableScroll || !bottomScroll || !isOpen) return undefined;
        const syncFrom = (source) => {
            if (source !== topScroll && topScroll.scrollLeft !== source.scrollLeft) topScroll.scrollLeft = source.scrollLeft;
            if (source !== tableScroll && tableScroll.scrollLeft !== source.scrollLeft) tableScroll.scrollLeft = source.scrollLeft;
            if (source !== bottomScroll && bottomScroll.scrollLeft !== source.scrollLeft) bottomScroll.scrollLeft = source.scrollLeft;
        };
        const handleTopScroll = () => syncFrom(topScroll);
        const handleTableScroll = () => syncFrom(tableScroll);
        const handleBottomScroll = () => syncFrom(bottomScroll);
        const sync = () => window.requestAnimationFrame(() => syncTableScroll(topRef, scrollRef, bottomRef));
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
    }, [syncTableScroll]);

    useEffect(
        () => bindTableScrollSync(isSupplyTableOpen, supplyTableTopRef, supplyTableScrollRef, supplyTableBottomRef),
        [isSupplyTableOpen, windowWidth, bindTableScrollSync],
    );

    useEffect(
        () => bindTableScrollSync(isProductTableOpen, productTableTopRef, productTableScrollRef, productTableBottomRef),
        [isProductTableOpen, windowWidth, bindTableScrollSync],
    );

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
    }, [result, lang, selectedSlices]);

    const selectedRow = result?.referenceYear != null
        ? result.data?.find((row) => row.year === result.referenceYear)
            || result.data?.find((row) => row.year === result.latestYear)
            || result.data?.[result.data.length - 1]
            || null
        : result?.data?.[result.data.length - 1] || null;
    const year = selectedRow?.year ?? result?.referenceYear ?? result?.latestYear ?? null;
    const yearLabel = year ?? '–';
    const textVars = { year: yearLabel };

    const productSlices = selectedRow
        ? PRODUCT_ORDER.map((key) => {
            const match = selectedRow.products.find((p) => p.key === key);
            return { key, pct: match?.pct ?? null };
        }).filter((slice) => slice.pct != null)
        : [];

    const pageTitle = substitute(getText('page136_title', lang), textVars);
    const chartTitleBase = substitute(getText('page136_chart_title', lang), textVars);
    const supplyDownloadTitle = substitute(getText('page136_download_supply_title', lang), textVars);
    const productDownloadTitle = substitute(getText('page136_download_products_title', lang), textVars);
    const infographicPngSlug = substitute(getText('page136_infographic_png_slug', lang), textVars)
        .replace(/\s+/g, '_');
    const zoomLegendMode = windowWidth <= 1000 || zoomLevel >= 1.75;
    const effectiveSlices = windowWidth > 768 ? selectedSlices : null;
    const pieValues = productSlices.map((slice) => (slice.pct > 0 ? slice.pct : 0.001));
    const baseColors = productSlices.map((slice) => PRODUCT_COLORS[slice.key]);
    const pieColors = effectiveSlices?.length
        ? baseColors.map((color, index) => (effectiveSlices.includes(index) ? color : hexToRgba(color, 0.3)))
        : baseColors;
    const labels = productSlices.map((slice) => getText(PRODUCT_LABEL_KEYS[slice.key], lang));
    const textSize = windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18;
    const outsideTextSize = zoomLegendMode ? 18 : textSize;
    const outsideLabelTemplate = productSlices.map(() => '%{label}<br>%{percent:.1%}');
    const zoomLabelTemplate = productSlices.map(() => '%{percent:.1%}');

    const pieTrace = productSlices.length ? {
        type: 'pie',
        values: pieValues,
        labels,
        hole: 0.55,
        direction: 'clockwise',
        rotation: 90,
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
        hovertext: productSlices.map((slice) => `<b>${getText(PRODUCT_LABEL_KEYS[slice.key], lang)}</b><br>${formatPct(slice.pct)}`),
        hoverinfo: 'text',
        hoverlabel: { bgcolor: '#ffffff', font: { color: '#333333', size: 14, family: 'Arial, sans-serif' } },
        automargin: true,
    } : null;

    const layout = {
        showlegend: false,
        margin: {
            t: zoomLegendMode ? 80 : 95,
            b: zoomLegendMode ? 120 : 80,
            l: windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 220,
            r: windowWidth <= 480 ? 0 : zoomLegendMode ? 20 : 220,
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Arial, sans-serif', size: 12 },
        height: windowWidth <= 480 ? 430 : 520,
        clickmode: 'event',
        dragmode: windowWidth <= 768 ? false : 'zoom',
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
                ctx.fillText(`${chartTitleBase}*`, canvas.width / 2, 44);
                ctx.drawImage(img, 0, titleHeight);
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = `${productDownloadTitle}.png`;
                link.click();
            };
            img.src = imgData;
        } catch (err) {
            console.warn('Unable to download chart image.', err);
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
            click: downloadChartPng,
        }],
    };

    const supplyTableRows = selectedRow
        ? SUPPLY_TABLE_KEYS.map((key) => ({
            description: getText(SUPPLY_LABEL_KEYS[key], lang),
            mmbd: selectedRow.supply[key]?.mmbd,
            billionL: selectedRow.supply[key]?.billion_l,
        }))
        : [];

    const productTableRows = productSlices.map((slice) => ({
        description: getText(PRODUCT_LABEL_KEYS[slice.key], lang),
        pct: slice.pct,
    }));

    const yearHeader = lang === 'en' ? 'Year' : 'Année';
    const descriptionHeader = lang === 'en' ? 'Description' : 'Description';
    const shareHeader = lang === 'en' ? 'Share (%)' : 'Part (%)';

    const supplyHeaders = [
        yearHeader,
        descriptionHeader,
        getText('page136_unit_mmbd', lang),
        getText('page136_unit_bl', lang),
    ];

    const productHeaders = [
        yearHeader,
        descriptionHeader,
        shareHeader,
    ];

    const downloadInfographicPng = async () => {
        if (!selectedRow?.supply) return;
        const bgImage = lang === 'fr' ? page136BgFr : page136BgEn;
        const overlayLang = lang === 'fr' ? 'fr' : 'en';
        const slots = OVERLAY_SLOTS[overlayLang];

        const img = new Image();
        img.src = bgImage;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        const scale = 3;
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const rateFont = `bold ${Math.round(canvas.width * 0.0255)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
        const volumeFont = `600 ${Math.round(canvas.width * 0.0195)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;

        SUPPLY_KEYS.forEach((key) => {
            const data = selectedRow.supply[key];
            const slot = slots[key];
            if (!data || !slot) return;

            const drawText = (text, position, color, font, align = 'right') => {
                if (text == null || text === '–') return;
                ctx.fillStyle = color;
                ctx.font = font;
                ctx.textBaseline = 'middle';
                const x = (position.left / 100) * canvas.width;
                const y = (position.top / 100) * canvas.height;
                ctx.textAlign = align;
                ctx.fillText(String(text), x, y);
            };

            drawText(formatNumber(data.mmbd, 1), slot.rate, TEXT_COLORS[key], rateFont, 'right');
            drawText(formatNumber(data.billion_l, 0), slot.volume, TEXT_COLORS[key], volumeFont, 'left');
        });

        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${infographicPngSlug}.png`);
        });
    };

    const downloadSupplyCSV = () => {
        if (!supplyTableRows.length) return;
        const rows = supplyTableRows.map((row, index) => [
            index === 0 ? yearLabel : '',
            row.description,
            row.mmbd != null ? formatNumber(row.mmbd, 1) : '',
            row.billionL != null ? formatNumber(row.billionL, 0) : '',
        ]);
        const csv = [supplyHeaders.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${supplyDownloadTitle}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadProductCSV = () => {
        if (!productTableRows.length) return;
        const rows = productTableRows.map((row, index) => [
            index === 0 ? yearLabel : '',
            row.description,
            row.pct != null ? Number(row.pct).toFixed(1) : '',
        ]);
        const csv = [productHeaders.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${productDownloadTitle}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadSupplyDocx = async () => {
        if (!supplyTableRows.length) return;
        const headerRow = new TableRow({
            children: supplyHeaders.map((header) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 18 })], alignment: AlignmentType.CENTER })],
                shading: { fill: 'E6E6E6' },
            })),
        });
        const rows = supplyTableRows.map((row, index) => new TableRow({
            children: [
                index === 0
                    ? new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: String(yearLabel), size: 18 })], alignment: AlignmentType.CENTER })],
                        rowSpan: supplyTableRows.length,
                    })
                    : null,
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row.description, size: 18 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row.mmbd != null ? formatNumber(row.mmbd, 1) : '—', size: 18 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row.billionL != null ? formatNumber(row.billionL, 0) : '—', size: 18 })], alignment: AlignmentType.RIGHT })] }),
            ].filter(Boolean),
        }));
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: supplyDownloadTitle, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [900, 4800, 1400, 1600],
                        rows: [headerRow, ...rows],
                    }),
                ],
            }],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${supplyDownloadTitle}.docx`);
    };

    const downloadProductDocx = async () => {
        if (!productTableRows.length) return;
        const headerRow = new TableRow({
            children: productHeaders.map((header) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 18 })], alignment: AlignmentType.CENTER })],
                shading: { fill: 'E6E6E6' },
            })),
        });
        const rows = productTableRows.map((row, index) => new TableRow({
            children: [
                index === 0
                    ? new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: String(yearLabel), size: 18 })], alignment: AlignmentType.CENTER })],
                        rowSpan: productTableRows.length,
                    })
                    : null,
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row.description, size: 18 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row.pct != null ? Number(row.pct).toFixed(1) : '—', size: 18 })], alignment: AlignmentType.RIGHT })] }),
            ].filter(Boolean),
        }));
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: productDownloadTitle, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [900, 5600, 1300],
                        rows: [headerRow, ...rows],
                    }),
                ],
            }],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${productDownloadTitle}.docx`);
    };

    const infographicAria = selectedRow
        ? Object.keys(SUPPLY_LABEL_KEYS).map((key) => {
            const supply = selectedRow.supply[key];
            return `${getText(SUPPLY_LABEL_KEYS[key], lang)}: ${formatNumber(supply?.mmbd, 1)} ${getText('page136_unit_mmbd', lang)}, ${formatNumber(supply?.billion_l, 0)} ${getText('page136_unit_bl', lang)}`;
        }).join('; ')
        : '';

    if (loading) return <p>{lang === 'en' ? 'Loading...' : 'Chargement...'}</p>;
    if (error) return <p>{error}</p>;
    if (!selectedRow) return <p>{getText('page136_no_data', lang)}</p>;

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-136 page136-rpp-supply"
            role="main"
            aria-labelledby="page136-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-136.page136-rpp-supply {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.page136-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.page136-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 24px 0;
    line-height: 1.25;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: none;
}
.page136-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.page136-infographic-figure {
    width: 100%;
    max-width: none;
    margin: 0 0 28px 0;
}
.page136-supply-table-wrapper { margin-bottom: 28px; }
.page136-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-top: 0;
    margin-bottom: 20px;
    box-sizing: border-box;
    overflow: visible;
}
.page136-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 8px 0;
    text-transform: none;
}
.page136-chart-scroll { width: 100%; overflow: hidden; display: flex; justify-content: center; }
.page136-custom-legend {
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
.page136-custom-legend-item { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.page136-custom-legend-swatch {
    width: 12px;
    height: 12px;
    display: inline-block;
    border-radius: 2px;
    border: 1px solid rgba(0, 0, 0, 0.15);
}
.page136-chart {
    width: 100%;
    min-width: 0;
    height: 520px;
    position: relative;
    z-index: 1;
    overflow: visible;
}
.page136-chart > div { width: 100%; height: 100%; overflow: visible; }
.page136-chart .js-plotly-plot,
.page136-chart .plot-container,
.page136-chart .svg-container { overflow: visible !important; }
.page136-clear-selection {
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
.page136-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.page136-table-wrapper details > summary {
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
.page136-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page136-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page136-table-scrollbar > div { height: 20px; }
.page136-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #ddd;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.page136-table-responsive::-webkit-scrollbar { display: none; }
.page136-table-responsive table { width: max-content !important; min-width: 100%; border-collapse: collapse; }
.page136-table-responsive th, .page136-table-responsive td {
    white-space: nowrap;
    padding: 8px 12px;
    font-family: Arial, sans-serif;
    color: var(--gc-text);
    border: 1px solid #ddd;
}
.page136-table-responsive th[scope="row"] { vertical-align: middle; }
.page136-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.page136-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.page136-chart-frame button:hover, .page136-table-wrapper summary:hover { background-color: #404040 !important; }
.page136-footnotes {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--gc-text);
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
    line-height: 1.65;
}
.page136-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0 0 1rem 0;
}
.page136-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
@media (max-width: 768px) {
    .page136-title { font-size: 37px; }
    .page136-chart-title { font-size: 26px; }
    .page136-chart { height: 430px; }
    .page136-custom-legend { font-size: 10px; gap: 8px 12px; }
}
            `}</style>

            <div className="page136-inner">
                <h1 id="page136-title" className="page136-title">{pageTitle}</h1>

                <Page136SupplyInfographic
                    lang={lang}
                    supply={selectedRow.supply}
                    formatNumber={formatNumber}
                    getText={getText}
                    ariaLabel={infographicAria}
                />

                <div className="page136-table-wrapper page136-supply-table-wrapper">
                    <details className="page136-data-table" onToggle={(event) => setIsSupplyTableOpen(event.currentTarget.open)}>
                        <summary role="button" aria-expanded={isSupplyTableOpen}>
                            <span aria-hidden="true" style={{ marginRight: '8px' }}>{isSupplyTableOpen ? '▼' : '▶'}</span>
                            {getText('page136_supply_table_summary', lang)}
                            <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                        </summary>
                        <div ref={supplyTableTopRef} className="page136-table-scrollbar" aria-hidden="true"><div /></div>
                        <div ref={supplyTableScrollRef} className="page136-table-responsive" role="region" aria-labelledby="page136-supply-table-caption" tabIndex={0}>
                            <table className="table table-striped table-hover">
                                <caption id="page136-supply-table-caption" className="wb-inv">
                                    {substitute(getText('page136_supply_table_caption', lang), textVars)}
                                </caption>
                                <thead>
                                    <tr>
                                        {supplyHeaders.map((header) => <th key={header} scope="col">{header}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {supplyTableRows.map((row, index) => (
                                        <tr key={row.description}>
                                            {index === 0 && (
                                                <th scope="row" rowSpan={supplyTableRows.length}>{yearLabel}</th>
                                            )}
                                            <td>{row.description}</td>
                                            <td style={{ textAlign: 'right' }}>{row.mmbd != null ? formatNumber(row.mmbd, 1) : '—'}</td>
                                            <td style={{ textAlign: 'right' }}>{row.billionL != null ? formatNumber(row.billionL, 0) : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div ref={supplyTableBottomRef} className="page136-table-scrollbar" aria-hidden="true"><div /></div>
                        <div className="page136-download-buttons">
                            <button type="button" onClick={downloadInfographicPng}>{getText('page136_download_infographic_png', lang)}</button>
                            <button type="button" onClick={downloadSupplyCSV}>{lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}</button>
                            <button type="button" onClick={downloadSupplyDocx}>{lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}</button>
                        </div>
                    </details>
                </div>

                <div className="page136-chart-frame">
                    <h2 id="page136-chart-title" className="page136-chart-title">
                        <span id="fn-products-rf-page136">{chartTitleBase}</span>
                        <a className="fn-lnk" href="#fn-products-page136" onClick={scrollToElement('fn-products-page136')}>
                            <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>*
                        </a>
                    </h2>
                    {effectiveSlices?.length > 0 && (
                        <button type="button" className="page136-clear-selection" onClick={() => setSelectedSlices(null)}>
                            {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                        </button>
                    )}
                    <div className="page136-chart-scroll">
                        <figure ref={chartRef} className="page136-chart" role="region" aria-label={`${chartTitleBase}*`} tabIndex="0" style={{ margin: 0 }}>
                            <div aria-hidden="true">
                                {pieTrace && (
                                    <Plot
                                        key={`page136-${year}-${effectiveSlices ? effectiveSlices.join('-') : 'none'}`}
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
                        </figure>
                    </div>
                    {zoomLegendMode && (
                        <div className="page136-custom-legend" aria-label={lang === 'en' ? 'Chart legend' : 'Légende du graphique'}>
                            {productSlices.map((slice) => (
                                <span key={slice.key} className="page136-custom-legend-item">
                                    <span className="page136-custom-legend-swatch" style={{ backgroundColor: PRODUCT_COLORS[slice.key] }} aria-hidden="true" />
                                    <span>{getText(PRODUCT_LABEL_KEYS[slice.key], lang)}</span>
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="page136-table-wrapper">
                        <details className="page136-data-table" onToggle={(event) => setIsProductTableOpen(event.currentTarget.open)}>
                            <summary role="button" aria-expanded={isProductTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isProductTableOpen ? '▼' : '▶'}</span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                            </summary>
                            <div ref={productTableTopRef} className="page136-table-scrollbar" aria-hidden="true"><div /></div>
                            <div ref={productTableScrollRef} className="page136-table-responsive" role="region" aria-labelledby="page136-table-caption" tabIndex={0}>
                                <table className="table table-striped table-hover">
                                    <caption id="page136-table-caption" className="wb-inv">
                                        {substitute(getText('page136_table_caption', lang), textVars)}
                                    </caption>
                                    <thead>
                                        <tr>
                                            {productHeaders.map((header) => <th key={header} scope="col">{header}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {productTableRows.map((row, index) => (
                                            <tr key={row.description}>
                                                {index === 0 && (
                                                    <th scope="row" rowSpan={productTableRows.length}>{yearLabel}</th>
                                                )}
                                                <td>{row.description}</td>
                                                <td style={{ textAlign: 'right' }}>{row.pct != null ? formatPct(row.pct) : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div ref={productTableBottomRef} className="page136-table-scrollbar" aria-hidden="true"><div /></div>
                            <div className="page136-download-buttons">
                                <button type="button" onClick={downloadProductCSV}>{lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}</button>
                                <button type="button" onClick={downloadProductDocx}>{lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}</button>
                            </div>
                        </details>
                    </div>
                </div>

                <aside className="wb-fnote page136-footnotes" role="note">
                    <h2 id="fn-page136">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</dt>
                        <dd id="fn-products-page136">
                            <a href="#fn-products-rf-page136" onClick={scrollToElement('fn-products-rf-page136')} className="fn-num" title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}>
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                            </a>
                            {' '}{getText('page136_footnote_products', lang)}
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page136;
