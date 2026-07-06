import React from 'react';
import rppSupplyDemandBgEn from '../assets/rpp_supply_demand_bg.png';
import rppSupplyDemandBgFr from '../assets/rpp_supply_demand_bg_fr.png';

/** Native pixel dimensions of each background asset */
const NATIVE_SIZE = {
    en: { width: 708, height: 458 },
    fr: { width: 926, height: 596 },
};

/**
 * Overlay anchors (% of wrapper).
 * Rate: right edge sits immediately left of baked-in MMb/d / Mb/j.
 * Volume: left edge sits immediately after baked-in "(".
 * Calibrated from rpp_supply_demand.png against rpp_refinery_input_bg.png / rpp_refinery_input_bg_fr.png.
 */
const OVERLAY_SLOTS = {
    en: {
        net_production: {
            rate: { left: 12.75, top: 35.6 },
            volume: { left: 6, top: 44.4 },
        },
        exports: {
            rate: { left: 29.5, top: 33.6 },
            volume: { left: 23.5, top: 41.7 },
        },
        imports: {
            rate: { left: 44.5, top: 31.5 },
            volume: { left: 38.8, top: 39.4 },
        },
        refinery_input: {
            rate: { left: 75.2, top: 24.1 },
            volume: { left: 68.5, top: 32.1 },
        },
        domestic_consumption: {
            rate: { left: 51.6, top: 79 },
            volume: { left: 45.2, top: 87.5 },
        },
    },
    fr: {
        net_production: {
            rate: { left: 12.5, top: 32 },
            volume: { left: 6, top: 40.1 },
        },
        exports: {
            rate: { left: 30.6, top: 32.5 },
            volume: { left: 24.4, top: 40.4 },
        },
        imports: {
            rate: { left: 46.3, top: 30.5 },
            volume: { left: 40.7, top: 38.2 },
        },
        refinery_input: {
            rate: { left: 75.5, top: 22.5 },
            volume: { left: 69, top: 30.5 },
        },
        domestic_consumption: {
            rate: { left: 51, top: 81 },
            volume: { left: 44.4, top: 89.4 },
        },
    },
};

const TEXT_COLORS = {
    net_production: '#ffffff',
    exports: '#000000',
    imports: '#000000',
    domestic_consumption: '#ffffff',
    refinery_input: '#ffffff',
};

const SUPPLY_KEYS = [
    'net_production',
    'exports',
    'imports',
    'domestic_consumption',
    'refinery_input',
];

const OverlayNumber = ({ left, top, color, value, sizeClass, align = 'right' }) => {
    if (value == null || value === '–') return null;

    const transform = align === 'left' ? 'translate(0, -50%)' : 'translate(-100%, -50%)';

    return (
        <span
            className={`rpp-supply-demand-overlay-num ${sizeClass}`}
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

const RppSupplyDemandInfographic = ({
    lang,
    supply,
    formatNumber,
    ariaLabel,
    getText,
}) => {
    const overlayLang = lang === 'fr' ? 'fr' : 'en';
    const bgImage = overlayLang === 'fr' ? rppSupplyDemandBgFr : rppSupplyDemandBgEn;
    const native = NATIVE_SIZE[overlayLang];
    const slots = OVERLAY_SLOTS[overlayLang];

    return (
        <figure className="rpp-supply-demand-infographic-figure" aria-label={ariaLabel}>
            <style>{`
.rpp-supply-demand-infographic-figure {
    width: 100%;
    max-width: none;
    margin: 0 0 28px 0;
}
.rpp-supply-demand-infographic-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: ${native.width} / ${native.height};
    container-type: inline-size;
}
.rpp-supply-demand-bg-image {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    user-select: none;
    pointer-events: none;
}
.rpp-supply-demand-overlay-num {
    position: absolute;
    z-index: 2;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
    pointer-events: none;
}
.rpp-supply-demand-overlay-num--rate {
    font-size: 2.55cqw;
}
.rpp-supply-demand-overlay-num--volume {
    font-size: 1.95cqw;
    font-weight: 600;
}
@media (max-width: 480px) {
    .rpp-supply-demand-overlay-num--rate { font-size: 2.85cqw; }
    .rpp-supply-demand-overlay-num--volume { font-size: 2.15cqw; }
}
            `}</style>

            <div className="rpp-supply-demand-infographic-wrapper">
                <img
                    src={bgImage}
                    alt=""
                    className="rpp-supply-demand-bg-image"
                    draggable={false}
                />
                {SUPPLY_KEYS.flatMap((key) => {
                    const data = supply?.[key];
                    const slot = slots[key];
                    if (!data || !slot) return [];

                    return [
                        <OverlayNumber
                            key={`${key}-rate`}
                            left={slot.rate.left}
                            top={slot.rate.top}
                            color={TEXT_COLORS[key]}
                            value={formatNumber(data.mmbd, 1)}
                            sizeClass="rpp-supply-demand-overlay-num--rate"
                            align="right"
                        />,
                        <OverlayNumber
                            key={`${key}-volume`}
                            left={slot.volume.left}
                            top={slot.volume.top}
                            color={TEXT_COLORS[key]}
                            value={formatNumber(data.billion_l, 0)}
                            sizeClass="rpp-supply-demand-overlay-num--volume"
                            align="left"
                        />,
                    ];
                })}
            </div>
            <figcaption className="wb-inv">{getText('rpp_refinery_input_bg_alt', lang)}</figcaption>
        </figure>
    );
};

export { OVERLAY_SLOTS, TEXT_COLORS, SUPPLY_KEYS };
export default RppSupplyDemandInfographic;
