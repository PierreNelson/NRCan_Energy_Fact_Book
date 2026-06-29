/**
 * Overlay anchors (% of wrapper) calibrated to page89_bg.png (902×224).
 * Adjust left / top / width to reposition the abroad-reactors callout.
 */
import page89Bg from '../assets/page89_bg.png';

export { page89Bg };

export const NATIVE_SIZE = { width: 902, height: 224 };

export const STAT_GREEN = '#809276';

/** Callout box position — percentages of the infographic wrapper. */
export const CALLOUT_SLOTS = {
    en: {
        left: 0,
        top: 50,
        width: 28,
    },
    fr: {
        left: 0,
        top: 50,
        width: 32,
    },
};

/** Font sizes use cqw (container query width) units inside the wrapper. */
export const CALLOUT_FONT_SIZES = {
    stat: 11,
    heading: 4.2,
    suffix: 3.5,
};
