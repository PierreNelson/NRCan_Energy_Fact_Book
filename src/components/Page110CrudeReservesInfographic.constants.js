/**
 * Overlay anchors (% of wrapper) calibrated to page110_bg.png (431×368).
 */
export const NATIVE_SIZE = { width: 431, height: 368 };

export const LABEL_SLOTS = {
    en: {
        canada_total: { left: 10, top: 20, align: 'left', fontSize: 50 },
        conventional: { left: 50, top: 8, align: 'left' },
        oil_sands: { left: 50, top: 36, align: 'left' },
        mining: { left: 52, top: 70, align: 'left' },
        insitu: { left: 74, top: 70, align: 'left' },
    },
    fr: {
        canada_total: { left: 6, top: 18, align: 'left' },
        conventional: { left: 44, top: 6, align: 'left' },
        oil_sands: { left: 44, top: 34, align: 'left' },
        mining: { left: 48, top: 68, align: 'left' },
        insitu: { left: 68, top: 68, align: 'left' },
    },
};

export const VALUE_SLOTS = {
    total_bb: { left: 22.5, top: 44, align: 'center', size: 'lg' },
    conventional_bb: { left: 72, top: 28, align: 'center', size: 'lg' },
    oil_sands_bb: { left: 72, top: 48, align: 'center', size: 'lg' },
    mining_bb: { left: 66, top: 78, align: 'left', size: 'sm' },
    insitu_bb: { left: 88, top: 78, align: 'left', size: 'sm' },
};

export const OVERLAY_COLORS = {
    label: '#000000',
    total_bb: '#FFFFFF',
    conventional_bb: '#000000',
    oil_sands_bb: '#000000',
    mining_bb: '#000000',
    insitu_bb: '#000000',
};
