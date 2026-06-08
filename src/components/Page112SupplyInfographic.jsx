import React from 'react';
import page112BgEn from '../assets/page112_bg.png';
import page112BgFr from '../assets/page112_bg_fr.png';
import {
    INFOGRAPHIC_KEYS,
    NATIVE_SIZE,
    OVERLAY_COLORS,
    OVERLAY_FONT_SIZE_CQW,
    OVERLAY_SLOTS,
} from './Page112SupplyInfographic.constants';

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
