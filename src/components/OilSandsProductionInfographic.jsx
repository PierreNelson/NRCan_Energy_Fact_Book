import React from 'react';
import oilSandsBgEn from '../assets/oil_sands_bg.png';
import oilSandsBgFr from '../assets/oil_sands_bg_fr.png';
import { OVERLAY_COLORS, OVERLAY_SLOTS } from './OilSandsProductionInfographic.constants';

/** Native pixel dimensions of each background asset */
const NATIVE_SIZE = {
    en: { width: 537, height: 196 },
    fr: { width: 685, height: 242 },
};

const OverlayNumber = ({ left, top, color, value, sizeClass, align = 'right' }) => {
    if (value == null || value === '–') return null;

    const transform = align === 'left' ? 'translate(0, -50%)' : 'translate(-100%, -50%)';

    return (
        <span
            className={`oil-sands-overlay-num ${sizeClass}`}
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

const OilSandsProductionInfographic = ({
    lang,
    overlayValues,
    formatPct,
    formatMmbd,
    ariaLabel,
    getText,
    figureRef,
}) => {
    const overlayLang = lang === 'fr' ? 'fr' : 'en';
    const bgImage = overlayLang === 'fr' ? oilSandsBgFr : oilSandsBgEn;
    const native = NATIVE_SIZE[overlayLang];
    const slots = OVERLAY_SLOTS[overlayLang];

    const pctSuffix = lang === 'fr' ? ' %' : '%';

    return (
        <figure ref={figureRef} className="oil-sands-infographic-figure" aria-label={ariaLabel}>
            <style>{`
.oil-sands-infographic-figure {
    width: 100%;
    max-width: none;
    margin: 0 0 28px 0;
}
.oil-sands-infographic-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: ${native.width} / ${native.height};
    container-type: inline-size;
}
.oil-sands-bg-image {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    user-select: none;
    pointer-events: none;
}
.oil-sands-overlay-num {
    position: absolute;
    z-index: 2;
    line-height: 1;
    white-space: nowrap;
    pointer-events: none;
}
.oil-sands-overlay-num--pct {
    font-family: 'Times New Roman', Times, serif;
    font-weight: 700;
    font-size: 7.35cqw;
}
.oil-sands-overlay-num--caption {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-weight: 700;
    font-size: 2.7cqw;
}
            `}</style>

            <div className="oil-sands-infographic-wrapper">
                <img
                    src={bgImage}
                    alt=""
                    className="oil-sands-bg-image"
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
                    sizeClass="oil-sands-overlay-num--pct"
                    align={slots.reserves_pct.align}
                />
                <OverlayNumber
                    left={slots.production_pct.left}
                    top={slots.production_pct.top}
                    color={OVERLAY_COLORS.production_pct}
                    value={`${formatPct(overlayValues?.productionSharePct, 0)}${pctSuffix}`}
                    sizeClass="oil-sands-overlay-num--pct"
                    align={slots.production_pct.align}
                />
                <OverlayNumber
                    left={slots.production_year.left}
                    top={slots.production_year.top}
                    color={OVERLAY_COLORS.production_year}
                    value={overlayValues?.year ?? '–'}
                    sizeClass="oil-sands-overlay-num--caption"
                    align={slots.production_year.align}
                />
                <OverlayNumber
                    left={slots.production_mmbd.left}
                    top={slots.production_mmbd.top}
                    color={OVERLAY_COLORS.production_mmbd}
                    value={formatMmbd(overlayValues?.oilSandsMmbd, 1)}
                    sizeClass="oil-sands-overlay-num--caption"
                    align={slots.production_mmbd.align}
                />
            </div>
            <figcaption className="wb-inv">{getText('oil_sands_bg_alt', lang)}</figcaption>
        </figure>
    );
};

export default OilSandsProductionInfographic;
