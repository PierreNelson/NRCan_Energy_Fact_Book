import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';

const BAR_KEYS = [
    'total',
    'activity',
    'structure',
    'service_level',
    'weather',
    'energy_efficiency',
    'other',
];

const energy_use_factors_DATA = {
    total: 1225,
    activity: 2591,
    structure: -486,
    service_level: 159,
    weather: -43,
    energy_efficiency: -1103,
    other: 108,
};

const COLORS = {
    total: '#CE8003',
    factor: '#4b4c4d',
};

const OPERATORS = ['=', '+', '+', '+', '+', '+'];

const energy_use_factors_VERTICAL_TICK_ZOOM = 2.5;
const energy_use_factors_OPERATOR_OVERLAP_ZOOM = 4.0;
const LIKELY_OS_DPR_BASES = [1, 1.25, 1.3333333333333333, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5];

const WRAPPED_CATEGORY_LABELS = {
    en: {
        total: 'Total change<br>in energy use',
        activity: 'Activity<br>effect',
        structure: 'Structure<br>effect',
        service_level: 'Service level<br>effect',
        weather: 'Weather<br>effect',
        energy_efficiency: 'Energy<br>efficiency<br>effect',
        other: 'Other',
    },
    fr: {
        total: "Variation globale<br>de la consommation<br>d'énergie",
        activity: "Effet de<br>l'activité",
        structure: 'Effet de<br>la structure',
        service_level: 'Effet du niveau<br>de service',
        weather: 'Effet des conditions<br>météorologiques',
        energy_efficiency: "Effet de<br>l'efficacité<br>énergétique",
        other: 'Autres',
    },
};

const createInitialViewportZoom = () => {
    if (typeof window === 'undefined') {
        return { pinScale: 1, layoutRatio: 1, cssZoomFactor: 1, screenZoomHint: 1 };
    }
    const inner = window.innerWidth;
    const outer = window.outerWidth;
    const vv = window.visualViewport;
    let pinScale = 1;
    let layoutRatio = 1;
    if (vv) {
        pinScale = vv.scale || 1;
        const w = vv.width || inner;
        layoutRatio = w > 0 ? inner / w : 1;
    }
    const sw = window.screen?.availWidth ?? window.screen?.width ?? 0;
    let screenZoomHint = 1;
    if (sw > 0 && outer >= sw - 24 && inner > 0) {
        const ratio = sw / inner;
        if (ratio >= 1.75) screenZoomHint = Math.min(ratio, 10);
    }
    return { pinScale, layoutRatio, cssZoomFactor: 1, screenZoomHint };
};

function isBrowserZoomInVerticalTickRange() {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    return LIKELY_OS_DPR_BASES.some((b) => {
        const z = dpr / b;
        return z >= energy_use_factors_VERTICAL_TICK_ZOOM && z <= 6.0;
    });
};

const hexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    }
    return hex;
};

const EnergyUseFactors = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [viewportZoom, setViewportZoom] = useState(createInitialViewportZoom);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedBars, setSelectedBars] = useState(null);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, pointIndex: null });
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

    const formatPj = (num) => {
        if (num == null || Number.isNaN(Number(num))) return '—';
        return Math.round(Number(num)).toLocaleString(locale);
    };

    const categoryLabels = useMemo(
        () => BAR_KEYS.map((key) => getText(`energy_use_factors_cat_${key}`, lang)),
        [lang],
    );

    const values = useMemo(() => BAR_KEYS.map((key) => energy_use_factors_DATA[key]), []);

    const baseColors = useMemo(
        () => BAR_KEYS.map((key) => (key === 'total' ? COLORS.total : COLORS.factor)),
        [],
    );

    const chartTitle = getText('energy_use_factors_chart_title', lang);
    const exportChartTitle = stripHtml(chartTitle);
    const chartDownloadSlug = getText('energy_use_factors_download_title', lang).replace(/\s+/g, '_');
    const yAxisTitle = getText('energy_use_factors_yaxis', lang);

    const overlayLang = lang === 'fr' ? 'fr' : 'en';
    const wrappedCategoryLabels = useMemo(
        () => BAR_KEYS.map((key) => WRAPPED_CATEGORY_LABELS[overlayLang][key]),
        [overlayLang],
    );

    const pageZoomForLayout = Math.max(
        viewportZoom.pinScale,
        viewportZoom.layoutRatio,
        viewportZoom.cssZoomFactor,
        viewportZoom.screenZoomHint,
    );
    const pinVertical =
        viewportZoom.pinScale > 1.02 && viewportZoom.pinScale >= energy_use_factors_VERTICAL_TICK_ZOOM;
    const useVerticalXLabels =
        pageZoomForLayout >= energy_use_factors_VERTICAL_TICK_ZOOM ||
        pinVertical ||
        isBrowserZoomInVerticalTickRange() ||
        windowWidth <= 480;

    const xTickText = useVerticalXLabels ? categoryLabels : wrappedCategoryLabels;
    const xTickAngle = useVerticalXLabels ? 90 : 0;
    const xTickFontSize = useVerticalXLabels
        ? windowWidth <= 480
            ? 12
            : 13
        : windowWidth <= 480
          ? 12
          : 14;

    const plotHeight = useVerticalXLabels
        ? windowWidth <= 480
            ? 500
            : windowWidth <= 768
              ? 540
              : 560
        : windowWidth <= 480
          ? 480
          : windowWidth <= 768
            ? 520
            : 540;
    const plotBottomMargin = useVerticalXLabels
        ? windowWidth <= 480
            ? 130
            : 110
        : windowWidth <= 480
          ? 155
          : windowWidth <= 768
            ? 145
            : 135;

    const barGap = useMemo(() => {
        if (pageZoomForLayout >= energy_use_factors_OPERATOR_OVERLAP_ZOOM) return 0.52;
        if (pageZoomForLayout >= 3) return 0.38;
        if (pageZoomForLayout >= energy_use_factors_VERTICAL_TICK_ZOOM) return 0.30;
        return 0.22;
    }, [pageZoomForLayout]);

    const operatorFontSize = useMemo(() => {
        const base = windowWidth <= 768 ? 18 : 22;
        if (pageZoomForLayout >= 5) return Math.max(11, Math.round(base * 0.5));
        if (pageZoomForLayout >= energy_use_factors_OPERATOR_OVERLAP_ZOOM) return Math.max(12, Math.round(base * 0.62));
        if (pageZoomForLayout >= 3) return Math.round(base * 0.85);
        return base;
    }, [pageZoomForLayout, windowWidth]);

    const barLabelFontSize = windowWidth <= 768 ? 12 : 14;
    const barLabelFont = {
        size: barLabelFontSize,
        color: '#333333',
        family: 'Arial, sans-serif',
    };

    const axisTitleFont = { size: windowWidth <= 768 ? 16 : 18, family: 'Arial, sans-serif', color: '#58585a' };
    const yTickFont = { size: windowWidth <= 480 ? 11 : windowWidth <= 768 ? 12 : 13, family: 'Arial, sans-serif' };

    const tableHeaders = [
        getText('energy_use_factors_table_col_factor', lang),
        `${yAxisTitle} (PJ)`,
    ];

    const yTickvals = [-1500, -1000, -500, 0, 500, 1000, 1500, 2000, 2500, 3000, 3500];
    const yTicktext = yTickvals.map((v) => formatPj(v));

    const barOpacityFor = (pointIndex) => {
        if (selectedBars === null) return 1;
        return selectedBars.includes(pointIndex) ? 1 : 0.3;
    };

    const barColorFor = (pointIndex, baseColor) => {
        if (selectedBars === null) return baseColor;
        return selectedBars.includes(pointIndex) ? baseColor : hexToRgba(baseColor, 0.3);
    };

    const operatorAnnotations = useMemo(
        () =>
            OPERATORS.map((text, i) => ({
                x: i + 0.5,
                y: 0,
                xref: 'x',
                yref: 'y',
                text,
                showarrow: false,
                font: {
                    family: 'Arial, sans-serif',
                    size: operatorFontSize,
                    color: '#347cba',
                },
                xanchor: 'center',
                yanchor: 'middle',
            })),
        [operatorFontSize],
    );

    const scrollToFootnote = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-energy-use-factors')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const scrollToRef = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-rf-energy-use-factors')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    useEffect(() => {
        const syncViewportZoom = () => {
            setWindowWidth(window.innerWidth);
            setViewportZoom(createInitialViewportZoom());
        };
        syncViewportZoom();
        window.addEventListener('resize', syncViewportZoom);
        window.visualViewport?.addEventListener('resize', syncViewportZoom);
        window.visualViewport?.addEventListener('scroll', syncViewportZoom);
        return () => {
            window.removeEventListener('resize', syncViewportZoom);
            window.visualViewport?.removeEventListener('resize', syncViewportZoom);
            window.visualViewport?.removeEventListener('scroll', syncViewportZoom);
        };
    }, []);

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
                    btn.onkeydown = (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            btn.click();
                        }
                    };
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
    }, [lang, selectedBars]);

    const syncTableScroll = useCallback(() => {
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = bottomScrollRef.current;
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
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = bottomScrollRef.current;
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

    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        try {
            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 1200,
                height: 680,
                scale: 2,
            });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                const titleHeight = 100;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 32px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(exportChartTitle, canvas.width / 2, 48);
                ctx.drawImage(img, 0, titleHeight);
                canvas.toBlob((blob) => {
                    if (blob) saveAs(blob, `${chartDownloadSlug}.png`);
                });
            };
            img.src = imgData;
        } catch (err) {
            console.error('Error downloading chart:', err);
        }
    };

    const downloadTableAsCSV = () => {
        const lines = [tableHeaders.map((h) => `"${h.replace(/"/g, '""')}"`).join(',')];
        BAR_KEYS.forEach((key, i) => {
            lines.push([`"${categoryLabels[i].replace(/"/g, '""')}"`, values[i]].join(','));
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `${chartDownloadSlug}.csv`);
    };

    const downloadTableAsDocx = async () => {
        const headerRow = new TableRow({
            children: tableHeaders.map(
                (cell) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: cell, bold: true, size: 20 })],
                                alignment: AlignmentType.CENTER,
                            }),
                        ],
                        shading: { fill: 'E6E6E6' },
                    }),
            ),
        });
        const dataRows = BAR_KEYS.map((key, i) =>
            new TableRow({
                children: [categoryLabels[i], formatPj(values[i])].map((val, index) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: String(val), size: 20 })],
                                alignment: index === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
                            }),
                        ],
                    }),
                ),
            }),
        );
        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: exportChartTitle, bold: true, size: 28 })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [5200, 2200],
                            rows: [headerRow, ...dataRows],
                        }),
                    ],
                },
            ],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${chartDownloadSlug}.docx`);
    };

    const handleChartClick = (event) => {
        if (!event.points?.length) return;
        const pointIndex = event.points[0].pointIndex;
        if (pointIndex === undefined) return;

        if (windowWidth <= 768) {
            const currentTime = Date.now();
            const lastClick = lastClickRef.current;
            const isSamePoint = pointIndex === lastClick.pointIndex;
            const isDoubleTap = isSamePoint && currentTime - lastClick.time < 300;
            lastClickRef.current = { time: currentTime, pointIndex };
            if (!isDoubleTap) return;
        }

        setSelectedBars((prev) => {
            if (prev === null) return [pointIndex];
            if (prev.includes(pointIndex)) {
                const next = prev.filter((p) => p !== pointIndex);
                return next.length === 0 ? null : next;
            }
            return [...prev, pointIndex];
        });
    };

    const hoverTemplates = categoryLabels.map(
        (label, i) => `<b>${label}</b><br>${formatPj(values[i])} PJ<extra></extra>`,
    );

    const bulletKeys = ['activity', 'structure', 'service_level', 'energy_efficiency'];

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-56 energy-use-factors-energy-factors"
            role="main"
            aria-labelledby="energy-use-factors-chart-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-56.energy-use-factors-energy-factors {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.energy-use-factors-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.energy-use-factors-bullets {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: var(--gc-text);
    line-height: 1.5;
    margin: 0 0 24px 0;
    padding-left: 1.25rem;
    max-width: none;
}
.energy-use-factors-bullets li { margin-bottom: 0.65rem; }
.energy-use-factors-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-top: 0;
    box-sizing: border-box;
    overflow: visible;
}
.energy-use-factors-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    text-transform: none;
}
.energy-use-factors-chart {
    width: 100%;
    min-width: 0;
    height: ${plotHeight}px;
    position: relative;
}
.energy-use-factors-chart > div { width: 100%; height: 100%; }
.energy-use-factors-chart .xaxislayer-above path.domain,
.energy-use-factors-chart .xaxislayer-below path.domain {
    stroke: transparent !important;
    stroke-width: 0 !important;
}
.energy-use-factors-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.energy-use-factors-table-wrapper details > summary {
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
.energy-use-factors-table-wrapper details > summary::-webkit-details-marker { display: none; }
.energy-use-factors-table-wrapper details > summary:hover,
.energy-use-factors-chart-frame button[type="button"]:hover { background-color: #404040 !important; }
.energy-use-factors-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.energy-use-factors-table-scrollbar > div { height: 20px; }
.energy-use-factors-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #ddd;
    background: #fff;
    padding: 15px;
    box-sizing: border-box;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.energy-use-factors-table-responsive::-webkit-scrollbar { display: none; }
.energy-use-factors-table-responsive table { width: max-content; min-width: 100%; border-collapse: collapse; }
.energy-use-factors-table-responsive th,
.energy-use-factors-table-responsive td {
    padding: 8px 12px;
    border: 1px solid #ddd;
    font-family: Arial, sans-serif;
    color: var(--gc-text);
    white-space: nowrap;
}
.energy-use-factors-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.energy-use-factors-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.energy-use-factors-footnotes {
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
.energy-use-factors-footnotes h2 {
    font-family: var(--font-heading);
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 1rem;
}
.energy-use-factors-footnotes dd {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-left: 0;
    margin-bottom: 0;
}
@media (max-width: 768px) {
    .energy-use-factors-bullets { font-size: 18px; }
    .energy-use-factors-chart-title { font-size: 26px; }
    .energy-use-factors-footnotes { font-size: 0.9rem; }
    .energy-use-factors-footnotes h2 { font-size: 1.2rem; margin-bottom: 0.75rem; }
}
            `}</style>

            <div className="energy-use-factors-inner">
                <ul className="energy-use-factors-bullets" role="list">
                    {bulletKeys.map((key) => (
                        <li key={key} role="listitem">
                            <strong>{getText(`energy_use_factors_bullet_${key}_bold`, lang)}</strong>
                            {getText(`energy_use_factors_bullet_${key}_text`, lang)}
                        </li>
                    ))}
                </ul>

                <div className="energy-use-factors-chart-frame">
                    <h2 id="energy-use-factors-chart-title" className="energy-use-factors-chart-title">
                        {chartTitle}
                        <sup id="fn-asterisk-rf-energy-use-factors">
                            <a className="fn-lnk" href="#fn-asterisk-energy-use-factors" onClick={scrollToFootnote}>
                                <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                                <span aria-hidden="true">*</span>
                            </a>
                        </sup>
                    </h2>

                    {selectedBars !== null && (
                        <div style={{ marginBottom: 8 }}>
                            <button
                                type="button"
                                onClick={() => setSelectedBars(null)}
                                style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#8C8C8C',
                                    border: '1px solid #404040',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontFamily: 'Arial, sans-serif',
                                    fontSize: 14,
                                    color: '#fff',
                                }}
                            >
                                {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                            </button>
                        </div>
                    )}

                    <figure ref={chartRef} style={{ margin: 0 }}>
                        <div role="region" aria-label={getText('energy_use_factors_chart_aria', lang)} tabIndex="0">
                            <Plot
                                key={`energy-use-factors-${selectedBars ? selectedBars.join('-') : 'all'}-${useVerticalXLabels ? 'v' : 'h'}-${plotHeight}-${barGap.toFixed(2)}-${operatorFontSize}`}
                                data={[
                                    {
                                        x: BAR_KEYS,
                                        y: values,
                                        type: 'bar',
                                        name: yAxisTitle,
                                        marker: {
                                            color: baseColors.map((color, i) => barColorFor(i, color)),
                                            opacity: values.map((_, i) => barOpacityFor(i)),
                                            line: { width: 0 },
                                        },
                                        text: values.map((v) => formatPj(v)),
                                        textposition: 'outside',
                                        textfont: barLabelFont,
                                        outsidetextfont: barLabelFont,
                                        insidetextfont: barLabelFont,
                                        uniformtext: { mode: 'show', minsize: barLabelFontSize },
                                        constraintext: 'none',
                                        cliponaxis: false,
                                        hovertemplate: hoverTemplates,
                                    },
                                ]}
                                layout={{
                                    showlegend: false,
                                    bargap: barGap,
                                    clickmode: 'event',
                                    dragmode: false,
                                    hovermode: 'closest',
                                    hoverlabel: {
                                        bgcolor: '#ffffff',
                                        font: { color: '#000000', size: 14, family: 'Arial, sans-serif' },
                                    },
                                    margin: { l: 72, r: 24, t: 20, b: plotBottomMargin },
                                    paper_bgcolor: 'rgba(0,0,0,0)',
                                    plot_bgcolor: 'rgba(0,0,0,0)',
                                    height: plotHeight,
                                    autosize: true,
                                    annotations: operatorAnnotations,
                                    xaxis: {
                                        type: 'category',
                                        categoryorder: 'array',
                                        categoryarray: BAR_KEYS,
                                        tickmode: 'array',
                                        tickvals: BAR_KEYS,
                                        ticktext: xTickText,
                                        showgrid: false,
                                        zeroline: false,
                                        showline: false,
                                        linewidth: 0,
                                        linecolor: 'rgba(0,0,0,0)',
                                        mirror: false,
                                        tickfont: { size: xTickFontSize, family: 'Arial, sans-serif' },
                                        tickangle: xTickAngle,
                                        automargin: true,
                                    },
                                    yaxis: {
                                        title: { text: yAxisTitle, font: axisTitleFont, standoff: 12 },
                                        range: [-1500, 3500],
                                        tickmode: 'array',
                                        tickvals: yTickvals,
                                        ticktext: yTicktext,
                                        showgrid: true,
                                        gridcolor: '#e0e0e0',
                                        showline: true,
                                        linewidth: 1,
                                        linecolor: '#333333',
                                        zeroline: false,
                                        tickfont: yTickFont,
                                        automargin: true,
                                    },
                                }}
                                config={{
                                    displayModeBar: true,
                                    displaylogo: false,
                                    responsive: true,
                                    scrollZoom: false,
                                    modeBarButtonsToRemove: [
                                        'pan2d',
                                        'select2d',
                                        'lasso2d',
                                        'zoom2d',
                                        'zoomIn2d',
                                        'zoomOut2d',
                                        'autoScale2d',
                                        'resetScale2d',
                                        'toImage',
                                    ],
                                    modeBarButtonsToAdd: [
                                        {
                                            name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
                                            icon: {
                                                width: 24,
                                                height: 24,
                                                path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z',
                                            },
                                            click: (gd) => downloadChartWithTitle(gd),
                                        },
                                    ],
                                }}
                                className="energy-use-factors-chart"
                                useResizeHandler
                                onClick={handleChartClick}
                            />
                        </div>
                    </figure>

                    <div className="energy-use-factors-table-wrapper">
                        <details onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>
                                    {isTableOpen ? '▼' : '▶'}
                                </span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">
                                    {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                </span>
                            </summary>
                            <div ref={topScrollRef} className="energy-use-factors-table-scrollbar" aria-hidden="true">
                                <div />
                            </div>
                            <div ref={tableScrollRef} className="energy-use-factors-table-responsive" role="region" tabIndex="0">
                                <table className="table table-striped table-hover">
                                    <caption className="wb-inv">{getText('energy_use_factors_table_caption', lang)}</caption>
                                    <thead>
                                        <tr>
                                            {tableHeaders.map((hdr) => (
                                                <th
                                                    key={hdr}
                                                    scope="col"
                                                    style={{
                                                        fontWeight: 'bold',
                                                        textAlign: hdr === tableHeaders[0] ? 'left' : 'center',
                                                    }}
                                                >
                                                    {hdr}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {BAR_KEYS.map((key, i) => (
                                            <tr key={key}>
                                                <th scope="row" style={{ fontWeight: 'bold' }}>{categoryLabels[i]}</th>
                                                <td style={{ textAlign: 'center' }}>{formatPj(values[i])}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="energy-use-factors-download-buttons">
                                    <button type="button" onClick={downloadTableAsCSV}>
                                        {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                    </button>
                                    <button type="button" onClick={downloadTableAsDocx}>
                                        {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                    </button>
                                </div>
                            </div>
                            <div ref={bottomScrollRef} className="energy-use-factors-table-scrollbar" aria-hidden="true">
                                <div />
                            </div>
                        </details>
                    </div>
                </div>

                <aside className="wb-fnote energy-use-factors-footnotes" role="note">
                    <h2>{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt id="fn-asterisk-energy-use-factors" className="wb-inv">
                            {lang === 'en' ? 'Footnote 1' : 'Note de bas de page 1'}
                        </dt>
                        <dd>
                            <a
                                href="#fn-asterisk-rf-energy-use-factors"
                                onClick={scrollToRef}
                                className="fn-num"
                                title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}
                            >
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                            </a>
                            {' '}
                            {getText('energy_use_factors_footnote', lang)}
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default EnergyUseFactors;
