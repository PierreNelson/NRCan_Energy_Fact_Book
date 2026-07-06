/**
 * Overlay anchors (% of wrapper) calibrated to world_crude_reserves_bg.svg (690.44 × 480.81).
 *
 * Fine-tuning guide:
 * - HEADLINE_SLOT: `left` / `top` in the world reserves infographic page for "1,768 billion barrels".
 * - DEFINITION_SLOTS: droplet definition text (EN + FR).
 * - OVERLAY_SLOTS: oil sands % and text.
 * - COUNTRY_LABEL_SLOTS: white country labels beside the pie.
 * - PIE_SLOT: pie position and size.
 */
export const NATIVE_SIZE = { width: 690.44, height: 480.81 };

export const PAGE_TITLE_FONT = '50px';
export const PAGE_TITLE_FONT_MOBILE = '37px';

export const HEADLINE_FONT = '39px';
export const HEADLINE_FONT_MOBILE = '35px';
export const HEADLINE_YEAR_FONT = '39px';
export const HEADLINE_YEAR_FONT_MOBILE = '35px';

export const OVERLAY_FONT_SIZES = {
    definition: '14px',
    oil_sands_pct: '8cqw',
    oil_sands_text: '26px',
    clear_selection: '14px',
};

export const COUNTRY_LABEL_FONT = { mobile: 10, tablet: 12, desktop: 18 };
export const PIE_PERCENT_FONT = { mobile: 10, tablet: 12, desktop: 18 };

export const HEADLINE_SLOT = { left: 0, top: 0 };

export const DEFINITION_SLOTS = {
    en: { left: 52, top: 12, align: 'center', maxWidth: 24 },
    fr: { left: 52, top: 10, align: 'center', maxWidth: 24 },
};

export const LEFT_ANCHOR = 0;
export const GREY_SECTION_TOP = 48.5;

export const SLICE_KEYS = ['other', 'venezuela', 'saudi', 'iran', 'canada', 'iraq'];

export const PIE_SLOT = { centerX: 25.2, centerY: 78, size: 27 };

export const getPieLayerStyle = (slot = PIE_SLOT) => {
    const heightPct = slot.size * (NATIVE_SIZE.width / NATIVE_SIZE.height);
    return {
        left: `${slot.centerX}%`,
        top: `${slot.centerY}%`,
        width: `${slot.size}%`,
        height: `${heightPct}%`,
        transform: 'translate(-50%, -50%)',
    };
};

export const getModebarSlotStyle = (slot = PIE_SLOT) => {
    const heightPct = slot.size * (NATIVE_SIZE.width / NATIVE_SIZE.height);
    return {
        left: `${slot.centerX + slot.size / 2}%`,
        top: `${slot.centerY - heightPct / 2}%`,
        transform: 'translate(-100%, 0)',
    };
};

export const OVERLAY_SLOTS = {
    en: {
        oil_sands_pct: { left: 92, top: 30, align: 'center' },
        oil_sands_text: { left: 86, top: 56, align: 'right', maxWidth: 30 },
    },
    fr: {
        oil_sands_pct: { left: 92, top: 30, align: 'center' },
        oil_sands_text: { left: 86, top: 56, align: 'right', maxWidth: 32 },
    },
};

export const COUNTRY_LABEL_SLOTS = {
    other: { left: 12, top: 90, align: 'right' },
    venezuela: { left: 12, top: 66, align: 'right' },
    saudi: { left: 30, top: 52, align: 'left' },
    iran: { left: 37, top: 64, align: 'left' },
    canada: { left: 40, top: 78, align: 'left', bold: true },
    iraq: { left: 39, top: 88.5, align: 'left' },
};

export const SLICE_COLORS = {
    other: '#B8C9D9',
    venezuela: '#8FAFC8',
    saudi: '#7A9BB5',
    iran: '#6A8BA8',
    canada: '#C8102E',
    iraq: '#9AA5B0',
};

export const OVERLAY_COLORS = {
    definition: '#ffffff',
    oil_sands_pct: '#50809a',
    oil_sands_text: '#ffffff',
    country_label: '#ffffff',
};

export const COUNTRY_LABEL_KEYS = {
    other: 'world_crude_reserves_country_other',
    venezuela: 'world_crude_reserves_country_venezuela',
    saudi: 'world_crude_reserves_country_saudi',
    iran: 'world_crude_reserves_country_iran',
    canada: 'world_crude_reserves_country_canada',
    iraq: 'world_crude_reserves_country_iraq',
};

const loadImage = (src) =>
    new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });

const EXPORT_LEGEND_COLS = 3;
const EXPORT_LEGEND_ROW_H = 26;
const EXPORT_LEGEND_PAD = 14;

const drawExportLegend = (ctx, legendItems, plotW, legendTop) => {
    if (!legendItems?.length) return;

    const cols = EXPORT_LEGEND_COLS;
    const colW = plotW / cols;
    const swatch = 12;
    const gap = 8;
    const fontSize = 13;

    ctx.font = `400 ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    legendItems.forEach((item, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = col * colW + EXPORT_LEGEND_PAD;
        const y = legendTop + row * EXPORT_LEGEND_ROW_H + EXPORT_LEGEND_ROW_H / 2;

        ctx.fillStyle = item.color;
        ctx.fillRect(x, y - swatch / 2, swatch, swatch);

        ctx.fillStyle = '#333333';
        const label = item.share ? `${item.label} (${item.share})` : item.label;
        const maxTextW = colW - EXPORT_LEGEND_PAD * 2 - swatch - gap;
        let display = label;
        while (display.length > 1 && ctx.measureText(display).width > maxTextW) {
            display = `${display.slice(0, -2)}…`;
        }
        ctx.fillText(display, x + swatch + gap, y);
    });
};

const exportLegendHeight = (itemCount) => {
    if (!itemCount) return 0;
    const rows = Math.ceil(itemCount / EXPORT_LEGEND_COLS);
    return rows * EXPORT_LEGEND_ROW_H + EXPORT_LEGEND_PAD * 2;
};

/** White-background pie PNG (900×700) + title + legend below the chart. */
export const exportWorldReservesChartPng = async (plotEl, { chartTitle, legendItems, scale = 2 }) => {
    if (!plotEl || !window.Plotly) return null;

    const plotW = 900;
    const plotH = 700;
    const titleH = 70;
    const legendH = exportLegendHeight(legendItems?.length);

    try {
        await window.Plotly.relayout(plotEl, { paper_bgcolor: '#ffffff', plot_bgcolor: '#ffffff' });
        const imgData = await window.Plotly.toImage(plotEl, {
            format: 'png',
            width: plotW,
            height: plotH,
            scale,
        });

        const canvas = document.createElement('canvas');
        canvas.width = plotW * scale;
        canvas.height = (plotH + titleH + legendH) * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, plotW, plotH + titleH + legendH);
        ctx.fillStyle = '#26374a';
        ctx.font = 'bold 24px "Noto Sans", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(chartTitle, plotW / 2, 44);

        const pieImg = await loadImage(imgData);
        ctx.drawImage(pieImg, 0, titleH, plotW, plotH);

        if (legendH > 0) {
            drawExportLegend(ctx, legendItems, plotW, titleH + plotH + EXPORT_LEGEND_PAD);
        }

        return canvas;
    } finally {
        try {
            await window.Plotly.relayout(plotEl, { paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)' });
        } catch {
            /* ignore restore errors */
        }
    }
};
