import React from 'react';
import page113BgEn from '../assets/page113_bg.png';
import page113BgFr from '../assets/page113_bg_fr.png';

/** Native pixel dimensions of each background asset */
const NATIVE_SIZE = {
    en: { width: 537, height: 196 },
    fr: { width: 685, height: 242 },
};

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

const OverlayNumber = ({ left, top, color, value, sizeClass, align = 'right' }) => {
    if (value == null || value === '–') return null;

    const transform = align === 'left' ? 'translate(0, -50%)' : 'translate(-100%, -50%)';

    return (
        <span
            className={`page113-overlay-num ${sizeClass}`}
            style={{
                left: `${left}%`,
                top: `${top}%`,
                color,
                transform,
                textAlign: align,
            }}
            aria-hidden="true"
        >
            {value}
        </span>
    );
};

const Page113OilSandsInfographic = ({
    lang,
    overlayValues,
    formatPct,
    formatMmbd,
    ariaLabel,
    getText,
    figureRef,
}) => {
    const overlayLang = lang === 'fr' ? 'fr' : 'en';
    const bgImage = overlayLang === 'fr' ? page113BgFr : page113BgEn;
    const native = NATIVE_SIZE[overlayLang];
    const slots = OVERLAY_SLOTS[overlayLang];

    const pctSuffix = lang === 'fr' ? ' %' : '%';

    return (
        <figure ref={figureRef} className="page113-infographic-figure" aria-label={ariaLabel}>
            <style>{`
.page113-infographic-figure {
    width: 100%;
    max-width: none;
    margin: 0 0 28px 0;
}
.page113-infographic-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: ${native.width} / ${native.height};
    container-type: inline-size;
}
.page113-bg-image {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    user-select: none;
    pointer-events: none;
}
.page113-overlay-num {
    position: absolute;
    z-index: 2;
    line-height: 1;
    white-space: nowrap;
    pointer-events: none;
}
.page113-overlay-num--pct {
    font-family: 'Times New Roman', Times, serif;
    font-weight: 700;
    font-size: 7.35cqw;
}
.page113-overlay-num--caption {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-weight: 700;
    font-size: 2.7cqw;
}
            `}</style>

            <div className="page113-infographic-wrapper">
                <img
                    src={bgImage}
                    alt=""
                    className="page113-bg-image"
                    draggable={false}
                />
                <OverlayNumber
                    left={slots.reserves_pct.left}
                    top={slots.reserves_pct.top}
                    color={OVERLAY_COLORS.reserves_pct}
                    value={
                        overlayValues?.reservesPct != null && !Number.isNaN(Number(overlayValues.reservesPct))
                            ? `${formatPct(overlayValues.reservesPct, 0)}${pctSuffix}`
                            : null
                    }
                    sizeClass="page113-overlay-num--pct"
                    align={slots.reserves_pct.align}
                />
                <OverlayNumber
                    left={slots.production_pct.left}
                    top={slots.production_pct.top}
                    color={OVERLAY_COLORS.production_pct}
                    value={`${formatPct(overlayValues?.productionSharePct, 0)}${pctSuffix}`}
                    sizeClass="page113-overlay-num--pct"
                    align={slots.production_pct.align}
                />
                <OverlayNumber
                    left={slots.production_year.left}
                    top={slots.production_year.top}
                    color={OVERLAY_COLORS.production_year}
                    value={overlayValues?.year ?? '–'}
                    sizeClass="page113-overlay-num--caption"
                    align={slots.production_year.align}
                />
                <OverlayNumber
                    left={slots.production_mmbd.left}
                    top={slots.production_mmbd.top}
                    color={OVERLAY_COLORS.production_mmbd}
                    value={formatMmbd(overlayValues?.oilSandsMmbd, 1)}
                    sizeClass="page113-overlay-num--caption"
                    align={slots.production_mmbd.align}
                />
            </div>
            <figcaption className="wb-inv">{getText('page113_bg_alt', lang)}</figcaption>
        </figure>
    );
};

export default Page113OilSandsInfographic;
