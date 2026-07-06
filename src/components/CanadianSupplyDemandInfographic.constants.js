/** Native pixel dimensions of each background asset */
export const NATIVE_SIZE = {
    en: { width: 702, height: 230 },
    fr: { width: 934, height: 346 },
};

/**
 * Overlay anchors (% of wrapper). Values sit over the baked-in MMb/d / Mb/j labels.
 * Calibrated from canadian_supply_demand.png against canadian_supply_demand_bg*.png.
 */
export const OVERLAY_SLOTS = {
    en: {
        production: { left: 10.5, top: 50, align: 'center' },
        exports: { left: 27, top: 50, align: 'center' },
        imports: { left: 43, top: 50.5, align: 'center' },
        refinery: { left: 80, top: 50, align: 'center' },
    },
    fr: {
        production: { left: 10, top: 46, align: 'center' },
        exports: { left: 26.8, top: 46, align: 'center' },
        imports: { left: 42.8, top: 47.3, align: 'center' },
        refinery: { left: 80, top: 49, align: 'center' },
    },
};

export const OVERLAY_COLORS = {
    production: '#FFFFFF',
    exports: '#FFFFFF',
    imports: '#000000',
    refinery: '#FFFFFF',
};

export const INFOGRAPHIC_KEYS = ['production', 'exports', 'imports', 'refinery'];

/** Matches `.canadian-supply-demand-overlay-num--rate { font-size: …cqw }` in the live infographic. */
export const OVERLAY_FONT_SIZE_CQW = 4.5;

export const getOverlayFontSizePx = (containerWidthPx) =>
    Math.round(containerWidthPx * (OVERLAY_FONT_SIZE_CQW / 100));

/** Draw overlay values on a canvas using the same slot/align/font rules as the component. */
export const drawInfographicOverlays = (ctx, { slots, values, formatValue, colors, width, height }) => {
    const fontSize = getOverlayFontSizePx(width);
    ctx.font = `bold ${fontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.textBaseline = 'middle';

    INFOGRAPHIC_KEYS.forEach((key) => {
        const value = formatValue(values?.[key]);
        if (!value || value === '–') return;
        const slot = slots[key];
        ctx.fillStyle = colors[key];
        ctx.textAlign = slot.align === 'left' ? 'left' : slot.align === 'right' ? 'right' : 'center';
        const x = (slot.left / 100) * width;
        const y = (slot.top / 100) * height;
        ctx.fillText(value, x, y);
    });
};
