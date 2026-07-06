import React from 'react';
import {
    canduNuclearReactorsBg,
    NATIVE_SIZE,
    STAT_GREEN,
    CALLOUT_SLOTS,
    CALLOUT_FONT_SIZES,
} from './CanduNuclearReactorsInfographic.constants';

const CanduNuclearReactorsInfographic = ({
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
        <figure className="candu-nuclear-reactors-infographic-figure" aria-label={ariaLabel}>
            <style>{`
.candu-nuclear-reactors-infographic-figure {
    width: 100%;
    margin: 0 0 28px 0;
}
.candu-nuclear-reactors-infographic-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: ${NATIVE_SIZE.width} / ${NATIVE_SIZE.height};
    container-type: inline-size;
}
.candu-nuclear-reactors-bg-image {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    user-select: none;
    pointer-events: none;
}
.candu-nuclear-reactors-callout {
    position: absolute;
    z-index: 2;
    pointer-events: none;
    color: var(--gc-text);
    line-height: 1.15;
}
.candu-nuclear-reactors-callout-line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.15em 0.35em;
    margin: 0 0 0.35em 0;
}
.candu-nuclear-reactors-stat {
    font-family: 'Lato', sans-serif;
    font-size: clamp(28px, ${fonts.stat}cqw, 52px);
    font-weight: bold;
    color: ${STAT_GREEN};
    line-height: 1;
}
.candu-nuclear-reactors-callout-heading {
    font-family: 'Lato', sans-serif;
    font-size: clamp(13px, ${fonts.heading}cqw, 19px);
    font-weight: bold;
    line-height: 1.15;
}
.candu-nuclear-reactors-callout-suffix {
    font-family: var(--font-body);
    font-size: clamp(12px, ${fonts.suffix}cqw, 16px);
    margin: 0;
    line-height: 1.25;
}
            `}</style>

            <div className="candu-nuclear-reactors-infographic-wrapper">
                <img src={canduNuclearReactorsBg} alt="" className="candu-nuclear-reactors-bg-image" draggable={false} />
                <div
                    className="candu-nuclear-reactors-callout"
                    style={{
                        left: `${slot.left}%`,
                        top: `${slot.top}%`,
                        width: `${slot.width}%`,
                    }}
                >
                    <span className="wb-inv">{ariaLabel}</span>
                    <div className="candu-nuclear-reactors-callout-line" aria-hidden="true">
                        <span className="candu-nuclear-reactors-stat">{abroadCount}</span>
                        <span className="candu-nuclear-reactors-callout-heading">{heading}</span>
                    </div>
                    <p className="candu-nuclear-reactors-callout-suffix" aria-hidden="true">
                        {suffix}
                    </p>
                </div>
            </div>
        </figure>
    );
};

export default CanduNuclearReactorsInfographic;
