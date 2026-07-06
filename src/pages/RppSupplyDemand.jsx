import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getRppSupplyDemandData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import RppSupplyDemandInfographic, { OVERLAY_SLOTS, SUPPLY_KEYS, TEXT_COLORS } from '../components/RppSupplyDemandInfographic';
import rppSupplyDemandBgEn from '../assets/rpp_supply_demand_bg.png';
import rppSupplyDemandBgFr from '../assets/rpp_supply_demand_bg_fr.png';

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
    motor_gasoline: 'rpp_refinery_input_product_motor_gasoline',
    distillate: 'rpp_refinery_input_product_distillate',
    still_gas: 'rpp_refinery_input_product_still_gas',
    jet: 'rpp_refinery_input_product_jet',
    coke: 'rpp_refinery_input_product_coke',
    residual: 'rpp_refinery_input_product_residual',
    asphalt: 'rpp_refinery_input_product_asphalt',
    other: 'rpp_refinery_input_product_other',
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
    net_production: 'rpp_refinery_input_supply_net_production',
    exports: 'rpp_refinery_input_supply_exports',
    imports: 'rpp_refinery_input_supply_imports',
    domestic_consumption: 'rpp_refinery_input_supply_domestic',
    refinery_input: 'rpp_refinery_input_supply_refinery',
};

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    }
    return hex;
};

const RppSupplyDemand = () => {
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

    const pageTitle = substitute(getText('rpp_refinery_input_title', lang), textVars);
    const chartTitleBase = substitute(getText('rpp_refinery_input_chart_title', lang), textVars);
    const supplyDownloadTitle = substitute(getText('rpp_refinery_input_download_supply_title', lang), textVars);
    const productDownloadTitle = substitute(getText('rpp_refinery_input_download_products_title', lang), textVars);
    const infographicPngSlug = substitute(getText('rpp_refinery_input_infographic_png_slug', lang), textVars)
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
        getText('rpp_refinery_input_unit_mmbd', lang),
        getText('rpp_refinery_input_unit_bl', lang),
    ];

    const productHeaders = [
        yearHeader,
        descriptionHeader,
        shareHeader,
    ];

    const downloadInfographicPng = async () => {
        if (!selectedRow?.supply) return;
        const bgImage = lang === 'fr' ? rppSupplyDemandBgFr : rppSupplyDemandBgEn;
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
            return `${getText(SUPPLY_LABEL_KEYS[key], lang)}: ${formatNumber(supply?.mmbd, 1)} ${getText('rpp_refinery_input_unit_mmbd', lang)}, ${formatNumber(supply?.billion_l, 0)} ${getText('rpp_refinery_input_unit_bl', lang)}`;
        }).join('; ')
        : '';

    if (loading) return <p>{lang === 'en' ? 'Loading...' : 'Chargement...'}</p>;
    if (error) return <p>{error}</p>;
    if (!selectedRow) return <p>{getText('rpp_refinery_input_no_data', lang)}</p>;

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-136 rpp-supply-demand-rpp-supply"
            role="main"
            aria-labelledby="rpp-supply-demand-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-136.rpp-supply-demand-rpp-supply {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.rpp-supply-demand-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.rpp-supply-demand-title {
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
.rpp-supply-demand-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.rpp-supply-demand-infographic-figure {
    width: 100%;
    max-width: none;
    margin: 0 0 28px 0;
}
.rpp-supply-demand-supply-table-wrapper { margin-bottom: 28px; }
.rpp-supply-demand-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-top: 0;
    margin-bottom: 20px;
    box-sizing: border-box;
    overflow: visible;
}
.rpp-supply-demand-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 8px 0;
    text-transform: none;
}
.rpp-supply-demand-chart-scroll { width: 100%; overflow: hidden; display: flex; justify-content: center; }
.rpp-supply-demand-custom-legend {
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
.rpp-supply-demand-custom-legend-item { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.rpp-supply-demand-custom-legend-swatch {
    width: 12px;
    height: 12px;
    display: inline-block;
    border-radius: 2px;
    border: 1px solid rgba(0, 0, 0, 0.15);
}
.rpp-supply-demand-chart {
    width: 100%;
    min-width: 0;
    height: 520px;
    position: relative;
    z-index: 1;
    overflow: visible;
}
.rpp-supply-demand-chart > div { width: 100%; height: 100%; overflow: visible; }
.rpp-supply-demand-chart .js-plotly-plot,
.rpp-supply-demand-chart .plot-container,
.rpp-supply-demand-chart .svg-container { overflow: visible !important; }
.rpp-supply-demand-clear-selection {
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
.rpp-supply-demand-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.rpp-supply-demand-table-wrapper details > summary {
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
.rpp-supply-demand-table-wrapper details > summary::-webkit-details-marker { display: none; }
.rpp-supply-demand-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.rpp-supply-demand-table-scrollbar > div { height: 20px; }
.rpp-supply-demand-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #ddd;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.rpp-supply-demand-table-responsive::-webkit-scrollbar { display: none; }
.rpp-supply-demand-table-responsive table { width: max-content !important; min-width: 100%; border-collapse: collapse; }
.rpp-supply-demand-table-responsive th, .rpp-supply-demand-table-responsive td {
    white-space: nowrap;
    padding: 8px 12px;
    font-family: Arial, sans-serif;
    color: var(--gc-text);
    border: 1px solid #ddd;
}
.rpp-supply-demand-table-responsive th[scope="row"] { vertical-align: middle; }
.rpp-supply-demand-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.rpp-supply-demand-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.rpp-supply-demand-chart-frame button:hover, .rpp-supply-demand-table-wrapper summary:hover { background-color: #404040 !important; }
.rpp-supply-demand-footnotes {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--gc-text);
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
    line-height: 1.65;
}
.rpp-supply-demand-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0 0 1rem 0;
}
.rpp-supply-demand-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
@media (max-width: 768px) {
    .rpp-supply-demand-title { font-size: 37px; }
    .rpp-supply-demand-chart-title { font-size: 26px; }
    .rpp-supply-demand-chart { height: 430px; }
    .rpp-supply-demand-custom-legend { font-size: 10px; gap: 8px 12px; }
}
            `}</style>

            <div className="rpp-supply-demand-inner">
                <h1 id="rpp-supply-demand-title" className="rpp-supply-demand-title">{pageTitle}</h1>

                <RppSupplyDemandInfographic
                    lang={lang}
                    supply={selectedRow.supply}
                    formatNumber={formatNumber}
                    getText={getText}
                    ariaLabel={infographicAria}
                />

                <div className="rpp-supply-demand-table-wrapper rpp-supply-demand-supply-table-wrapper">
                    <details className="rpp-supply-demand-data-table" onToggle={(event) => setIsSupplyTableOpen(event.currentTarget.open)}>
                        <summary role="button" aria-expanded={isSupplyTableOpen}>
                            <span aria-hidden="true" style={{ marginRight: '8px' }}>{isSupplyTableOpen ? '▼' : '▶'}</span>
                            {getText('rpp_refinery_input_supply_table_summary', lang)}
                            <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                        </summary>
                        <div ref={supplyTableTopRef} className="rpp-supply-demand-table-scrollbar" aria-hidden="true"><div /></div>
                        <div ref={supplyTableScrollRef} className="rpp-supply-demand-table-responsive" role="region" aria-labelledby="rpp-supply-demand-supply-table-caption" tabIndex={0}>
                            <table className="table table-striped table-hover">
                                <caption id="rpp-supply-demand-supply-table-caption" className="wb-inv">
                                    {substitute(getText('rpp_refinery_input_supply_table_caption', lang), textVars)}
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
                        <div ref={supplyTableBottomRef} className="rpp-supply-demand-table-scrollbar" aria-hidden="true"><div /></div>
                        <div className="rpp-supply-demand-download-buttons">
                            <button type="button" onClick={downloadInfographicPng}>{getText('rpp_refinery_input_download_infographic_png', lang)}</button>
                            <button type="button" onClick={downloadSupplyCSV}>{lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}</button>
                            <button type="button" onClick={downloadSupplyDocx}>{lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}</button>
                        </div>
                    </details>
                </div>

                <div className="rpp-supply-demand-chart-frame">
                    <h2 id="rpp-supply-demand-chart-title" className="rpp-supply-demand-chart-title">
                        <span id="fn-products-rf-rpp-supply-demand">{chartTitleBase}</span>
                        <a className="fn-lnk" href="#fn-products-rpp-supply-demand" onClick={scrollToElement('fn-products-rpp-supply-demand')}>
                            <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>*
                        </a>
                    </h2>
                    {effectiveSlices?.length > 0 && (
                        <button type="button" className="rpp-supply-demand-clear-selection" onClick={() => setSelectedSlices(null)}>
                            {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                        </button>
                    )}
                    <div className="rpp-supply-demand-chart-scroll">
                        <figure ref={chartRef} className="rpp-supply-demand-chart" role="region" aria-label={`${chartTitleBase}*`} tabIndex="0" style={{ margin: 0 }}>
                            <div aria-hidden="true">
                                {pieTrace && (
                                    <Plot
                                        key={`rpp-supply-demand-${year}-${effectiveSlices ? effectiveSlices.join('-') : 'none'}`}
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
                        <div className="rpp-supply-demand-custom-legend" aria-label={lang === 'en' ? 'Chart legend' : 'Légende du graphique'}>
                            {productSlices.map((slice) => (
                                <span key={slice.key} className="rpp-supply-demand-custom-legend-item">
                                    <span className="rpp-supply-demand-custom-legend-swatch" style={{ backgroundColor: PRODUCT_COLORS[slice.key] }} aria-hidden="true" />
                                    <span>{getText(PRODUCT_LABEL_KEYS[slice.key], lang)}</span>
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="rpp-supply-demand-table-wrapper">
                        <details className="rpp-supply-demand-data-table" onToggle={(event) => setIsProductTableOpen(event.currentTarget.open)}>
                            <summary role="button" aria-expanded={isProductTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isProductTableOpen ? '▼' : '▶'}</span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                            </summary>
                            <div ref={productTableTopRef} className="rpp-supply-demand-table-scrollbar" aria-hidden="true"><div /></div>
                            <div ref={productTableScrollRef} className="rpp-supply-demand-table-responsive" role="region" aria-labelledby="rpp-supply-demand-table-caption" tabIndex={0}>
                                <table className="table table-striped table-hover">
                                    <caption id="rpp-supply-demand-table-caption" className="wb-inv">
                                        {substitute(getText('rpp_refinery_input_table_caption', lang), textVars)}
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
                            <div ref={productTableBottomRef} className="rpp-supply-demand-table-scrollbar" aria-hidden="true"><div /></div>
                            <div className="rpp-supply-demand-download-buttons">
                                <button type="button" onClick={downloadProductCSV}>{lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}</button>
                                <button type="button" onClick={downloadProductDocx}>{lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}</button>
                            </div>
                        </details>
                    </div>
                </div>

                <aside className="wb-fnote rpp-supply-demand-footnotes" role="note">
                    <h2 id="fn-rpp-supply-demand">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</dt>
                        <dd id="fn-products-rpp-supply-demand">
                            <a href="#fn-products-rf-rpp-supply-demand" onClick={scrollToElement('fn-products-rf-rpp-supply-demand')} className="fn-num" title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}>
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                            </a>
                            {' '}{getText('rpp_refinery_input_footnote_products', lang)}
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default RppSupplyDemand;
