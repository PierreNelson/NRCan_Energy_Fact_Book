/**
 * Page 76 chart backdrop — tune overlay positions and dam image (page76_bg_1.png) here.
 * Asset filenames on disk: bg_1 = dam graphic, bg_2 = Canada map.
 */
import page76BgDam from '../assets/page76_bg_1.png';
import page76BgMap from '../assets/page76_bg_2.png';

export { page76BgDam, page76BgMap };

/** Canada map layer (page84-style full chart backdrop). */
export const MAP_BG_LAYER = {
    /** Flex alignment when map is narrower than the chart area. */
    justify: 'center',
    align: 'center',
    /** Image width as % of chart backdrop width. */
    widthPct: 100,
    maxHeightPct: 100,
};

/**
 * Dam graphic (page76_bg_1.png) — position as % of chart backdrop box.
 * left/top = anchor point; width = % of backdrop width.
 */
export const DAM_IMAGE_SLOT = {
    left: 52,
    top: 0,
    width: 28,
};

/**
 * “Total capacity (MW)” label above the dam graphic — separate from the
 * three-line capacity stat callout below. Position as % of chart backdrop.
 */
export const TOTAL_CAPACITY_LABEL = {
    fonts: {
        size: 2.4,
    },
    en: {
        label: { left: 66, top: 0, width: 28, align: 'center' },
    },
    fr: {
        label: { left: 66, top: 0, width: 28, align: 'center' },
    },
};

/**
 * Hydro capacity stat callout (e.g. “Hydroelectricity capacity in Canada was…”)
 * — one slot per line (% of chart backdrop).
 */
export const TOTAL_CAPACITY_CALLOUT = {
    fonts: {
        size: 2.8,
    },
    en: {
        line1: { left: 72, top: 16, width: 36, align: 'right' },
        line2: { left: 72, top: 22, width: 36, align: 'right' },
        line3: { left: 72, top: 28, width: 36, align: 'right' },
    },
    fr: {
        line1: { left: 72, top: 16, width: 38, align: 'right' },
        line2: { left: 72, top: 22, width: 38, align: 'right' },
        line3: { left: 72, top: 28, width: 38, align: 'right' },
    },
};

/** @deprecated Use TOTAL_CAPACITY_CALLOUT */
export const OVERLAY_LAYOUT = TOTAL_CAPACITY_CALLOUT;
