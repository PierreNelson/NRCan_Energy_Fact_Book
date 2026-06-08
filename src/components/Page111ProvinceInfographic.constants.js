/** Native pixel dimensions of the province infographic background. */
export const NATIVE_SIZE = { width: 331, height: 260 };

/** Transparent padding measured from source PNG (fraction of native width). */
export const IMAGE_TRIM = { left: 21 / 331, right: 10 / 331 };

export const PROVINCE_ORDER = ['ab', 'sk', 'nl', 'mb', 'bc', 'other'];

export const OVERLAY_COLORS = {
    ab: '#3B95C9',
    sk: '#6B8FA3',
    nl: '#4A6670',
    mb: '#7A8440',
    bc: '#809636',
    other: '#2A3542',
};

export const PCT_SLOTS = {
    ab: { left: 96.07, top: 27.5, align: 'right' },
    sk: { left: 96.07, top: 41, align: 'right' },
    nl: { left: 96.37, top: 54, align: 'right' },
    mb: { left: 96.68, top: 67, align: 'right' },
    bc: { left: 96.68, top: 80.01, align: 'right' },
    other: { left: 96.37, top: 92.56, align: 'right' },
};

export const OVERLAY_SLOTS = PCT_SLOTS;

export const getImageTrimStyles = () => {
    const trim = IMAGE_TRIM;
    const contentWidthFrac = 1 - trim.left - trim.right;
    return {
        contentWidthFrac,
        artWidth: `${(100 / contentWidthFrac).toFixed(4)}%`,
        artLeft: `${((-trim.left / contentWidthFrac) * 100).toFixed(4)}%`,
    };
};
