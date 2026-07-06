import React from 'react';
import canadianSupplyDemandBgEn from '../assets/canadian_supply_demand_bg.png';
import canadianSupplyDemandBgFr from '../assets/canadian_supply_demand_bg_fr.png';
import {
    INFOGRAPHIC_KEYS,
    NATIVE_SIZE,
    OVERLAY_COLORS,
    OVERLAY_FONT_SIZE_CQW,
    OVERLAY_SLOTS,
} from './CanadianSupplyDemandInfographic.constants';

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
            className={`canadian-supply-demand-overlay-num ${sizeClass}`}
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

const CanadianSupplyDemandInfographic = ({
    lang,
    overlayValues,
    formatMmbd,
    ariaLabel,
    getText,
    figureRef,
}) => {
    const overlayLang = lang === 'fr' ? 'fr' : 'en';
    const bgImage = overlayLang === 'fr' ? canadianSupplyDemandBgFr : canadianSupplyDemandBgEn;
    const native = NATIVE_SIZE[overlayLang];
    const slots = OVERLAY_SLOTS[overlayLang];

    return (
        <figure ref={figureRef} className="canadian-supply-demand-infographic-figure" aria-label={ariaLabel}>
            <style>{`
.canadian-supply-demand-infographic-figure {
    width: 100%;
    max-width: none;
    margin: 0 0 28px 0;
}
.canadian-supply-demand-infographic-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: ${native.width} / ${native.height};
    container-type: inline-size;
}
.canadian-supply-demand-bg-image {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    user-select: none;
    pointer-events: none;
}
.canadian-supply-demand-overlay-num {
    position: absolute;
    z-index: 2;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
    pointer-events: none;
}
.canadian-supply-demand-overlay-num--rate {
    font-size: ${OVERLAY_FONT_SIZE_CQW}cqw;
}
            `}</style>

            <div className="canadian-supply-demand-infographic-wrapper">
                <img
                    src={bgImage}
                    alt=""
                    className="canadian-supply-demand-bg-image"
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
                        sizeClass="canadian-supply-demand-overlay-num--rate"
                    />
                ))}
            </div>
            <figcaption className="wb-inv">{getText('canadian_supply_demand_bg_alt', lang)}</figcaption>
        </figure>
    );
};

export default CanadianSupplyDemandInfographic;
