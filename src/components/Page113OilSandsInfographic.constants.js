/**
 * Overlay anchors (% of wrapper).
 * Calibrated from page113.png / page113fr.png against page113_bg*.png.
 */
export const OVERLAY_SLOTS = {
    en: {
        reserves_pct: { left: 40.22, top: 23.63, align: 'right' },
        production_pct: { left: 88.2, top: 40.5, align: 'right' },
        production_year: { left: 71.58, top: 86, align: 'right' },
        production_mmbd: { left: 80.79, top: 86.62, align: 'right' },
    },
    fr: {
        reserves_pct: { left: 44, top: 20.16, align: 'right' },
        production_pct: { left: 88, top: 43, align: 'right' },
        production_year: { left: 77, top: 91, align: 'left' },
        production_mmbd: { left: 91.5, top: 91, align: 'right' },
    },
};

export const OVERLAY_COLORS = {
    reserves_pct: '#5B8492',
    production_pct: '#FFFFFF',
    production_year: '#000000',
    production_mmbd: '#000000',
};
