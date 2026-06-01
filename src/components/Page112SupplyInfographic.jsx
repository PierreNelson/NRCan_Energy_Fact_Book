import React from 'react';
import page112BgEn from '../assets/page112_bg.png';
import page112BgFr from '../assets/page112_bg_fr.png';

/** Native pixel dimensions of each background asset */
export const NATIVE_SIZE = {
    en: { width: 702, height: 230 },
    fr: { width: 934, height: 346 },
};

/**
 * Overlay anchors (% of wrapper). Values sit over the baked-in MMb/d / Mb/j labels.
 * Calibrated from page112.png / page112fr.png against page112_bg*.png.
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

/** Matches `.page112-overlay-num--rate { font-size: …cqw }` in the live infographic. */
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

const OverlayNumber = ({ left, top, color, value, sizeClass, align = 'center' }) => {
    if (value == null || value === '–') return null;

    const transform =
        align === 'left'
            ? 'translate(0, -50%)'
            : align === 'right'
              ? 'translate(-100%, -50%)'
              : 'translate(-50%, -50%)';

    return (
        <span
            className={`page112-overlay-num ${sizeClass}`}
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

const Page112SupplyInfographic = ({
    lang,
    overlayValues,
    formatMmbd,
    ariaLabel,
    getText,
    figureRef,
}) => {
    const overlayLang = lang === 'fr' ? 'fr' : 'en';
    const bgImage = overlayLang === 'fr' ? page112BgFr : page112BgEn;
    const native = NATIVE_SIZE[overlayLang];
    const slots = OVERLAY_SLOTS[overlayLang];

    return (
        <figure ref={figureRef} className="page112-infographic-figure" aria-label={ariaLabel}>
            <style>{`
.page112-infographic-figure {
    width: 100%;
    max-width: none;
    margin: 0 0 28px 0;
}
.page112-infographic-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: ${native.width} / ${native.height};
    container-type: inline-size;
}
.page112-bg-image {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    user-select: none;
    pointer-events: none;
}
.page112-overlay-num {
    position: absolute;
    z-index: 2;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
    pointer-events: none;
}
.page112-overlay-num--rate {
    font-size: ${OVERLAY_FONT_SIZE_CQW}cqw;
}
            `}</style>

            <div className="page112-infographic-wrapper">
                <img
                    src={bgImage}
                    alt=""
                    className="page112-bg-image"
                    draggable={false}
                />
                {INFOGRAPHIC_KEYS.map((key) => (
                    <OverlayNumber
                        key={key}
                        left={slots[key].left}
                        top={slots[key].top}
                        align={slots[key].align}
                        color={OVERLAY_COLORS[key]}
                        value={formatMmbd(overlayValues?.[key], 1)}
                        sizeClass="page112-overlay-num--rate"
                    />
                ))}
            </div>
            <figcaption className="wb-inv">{getText('page112_bg_alt', lang)}</figcaption>
        </figure>
    );
};

export default Page112SupplyInfographic;
