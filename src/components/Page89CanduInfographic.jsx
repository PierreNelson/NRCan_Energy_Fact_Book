import React from 'react';
import {
    page89Bg,
    NATIVE_SIZE,
    STAT_GREEN,
    CALLOUT_SLOTS,
    CALLOUT_FONT_SIZES,
} from './Page89CanduInfographic.constants';

const Page89CanduInfographic = ({
    lang,
    abroadCount,
    heading,
    suffix,
    ariaLabel,
}) => {
    const overlayLang = lang === 'fr' ? 'fr' : 'en';
    const slot = CALLOUT_SLOTS[overlayLang];
    const fonts = CALLOUT_FONT_SIZES;

    return (
        <figure className="page89-infographic-figure" aria-label={ariaLabel}>
            <style>{`
.page89-infographic-figure {
    width: 100%;
    margin: 0 0 28px 0;
}
.page89-infographic-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: ${NATIVE_SIZE.width} / ${NATIVE_SIZE.height};
    container-type: inline-size;
}
.page89-bg-image {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    user-select: none;
    pointer-events: none;
}
.page89-callout {
    position: absolute;
    z-index: 2;
    pointer-events: none;
    color: var(--gc-text);
    line-height: 1.15;
}
.page89-callout-line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.15em 0.35em;
    margin: 0 0 0.35em 0;
}
.page89-stat {
    font-family: 'Lato', sans-serif;
    font-size: clamp(28px, ${fonts.stat}cqw, 52px);
    font-weight: bold;
    color: ${STAT_GREEN};
    line-height: 1;
}
.page89-callout-heading {
    font-family: 'Lato', sans-serif;
    font-size: clamp(13px, ${fonts.heading}cqw, 19px);
    font-weight: bold;
    line-height: 1.15;
}
.page89-callout-suffix {
    font-family: var(--font-body);
    font-size: clamp(12px, ${fonts.suffix}cqw, 16px);
    margin: 0;
    line-height: 1.25;
}
            `}</style>

            <div className="page89-infographic-wrapper">
                <img src={page89Bg} alt="" className="page89-bg-image" draggable={false} />
                <div
                    className="page89-callout"
                    style={{
                        left: `${slot.left}%`,
                        top: `${slot.top}%`,
                        width: `${slot.width}%`,
                    }}
                >
                    <span className="wb-inv">{ariaLabel}</span>
                    <div className="page89-callout-line" aria-hidden="true">
                        <span className="page89-stat">{abroadCount}</span>
                        <span className="page89-callout-heading">{heading}</span>
                    </div>
                    <p className="page89-callout-suffix" aria-hidden="true">
                        {suffix}
                    </p>
                </div>
            </div>
        </figure>
    );
};

export default Page89CanduInfographic;
