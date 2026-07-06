import React from 'react';
import electricityTradeUsBg from '../assets/electricity_trade_us_bg.png';

/** Matches electricity_trade_us_bg.png (408×157). Towers at 60% size, pinned left/right; values beside each tower. */
const NATIVE_SIZE = { width: 408, height: 157 };
const TOWER_WIDTH_PCT = (44 / NATIVE_SIZE.width) * 100;
const VALUE_GAP_PCT = 2;
const VALUE_OFFSET_PCT = TOWER_WIDTH_PCT + VALUE_GAP_PCT;

const TEXT_SLOTS = {
    en: {
        exportsLabel: { left: 0, top: 10, width: 18 },
        exportsValue: { left: 0, top: 80 },
        importsLabel: { right: 0, top: 10, width: 18, textAlign: 'right' },
        importsValue: { right: 0, top: 80, textAlign: 'right' },
    },
    fr: {
        exportsLabel: { left: 0, top: 10, width: 20 },
        exportsValue: { left: 0, top: 80 },
        importsLabel: { right: 0, top: 10, width: 20, textAlign: 'right' },
        importsValue: { right: 0, top: 80, textAlign: 'right' },
    },
};

const OverlayBlock = ({ slot, className, children }) => (
    <div
        className={`electricity-trade-us-overlay ${className}`}
        style={{
            left: slot.left != null ? `${slot.left}%` : undefined,
            right: slot.right != null ? `${slot.right}%` : undefined,
            top: `${slot.top}%`,
            width: slot.width ? `${slot.width}%` : undefined,
            textAlign: slot.textAlign || 'left',
        }}
    >
        {children}
    </div>
);

const ElectricityTradeInfographic = ({
    lang,
    getText,
    ariaLabel,
    figureRef,
    exportsValue,
    importsValue,
}) => {
    const overlayLang = lang === 'fr' ? 'fr' : 'en';
    const slots = TEXT_SLOTS[overlayLang];

    return (
        <figure ref={figureRef} className="electricity-trade-us-infographic-figure" aria-label={ariaLabel}>
            <style>{`
.electricity-trade-us-infographic-figure {
    display: block;
    width: 100%;
    max-width: none;
    margin: 0 0 20px 0;
    padding: 0;
}
.electricity-trade-us-infographic-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: ${NATIVE_SIZE.width} / ${NATIVE_SIZE.height};
    container-type: inline-size;
    background: #ffffff;
}
.electricity-trade-us-bg-image {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    user-select: none;
    pointer-events: none;
}
.electricity-trade-us-overlay {
    position: absolute;
    z-index: 2;
    box-sizing: border-box;
    pointer-events: none;
}
.electricity-trade-us-infographic-figure p.electricity-trade-us-overlay-label {
    font-family: 'Lato', sans-serif;
    font-size: 3.2cqw;
    font-weight: 700;
    line-height: 1.1;
    color: #58585a;
    margin: 0;
    letter-spacing: 0.01em;
}
.electricity-trade-us-infographic-figure p.electricity-trade-us-overlay-value {
    font-family: 'Lato', sans-serif;
    font-size: 2.4cqw;
    font-weight: 700;
    line-height: 1;
    color: #332f30;
    margin: 0;
    white-space: nowrap;
}
.electricity-trade-us-overlay--exports-label p,
.electricity-trade-us-overlay--exports-value p {
    text-align: left;
}
.electricity-trade-us-overlay--imports-label p,
.electricity-trade-us-overlay--imports-value p {
    text-align: right;
}
@media (max-width: 768px) {
    .electricity-trade-us-infographic-figure p.electricity-trade-us-overlay-label { font-size: 3.6cqw; }
    .electricity-trade-us-infographic-figure p.electricity-trade-us-overlay-value { font-size: 2.8cqw; }
}
            `}</style>

            <div className="electricity-trade-us-infographic-wrapper">
                <img src={electricityTradeUsBg} alt="" className="electricity-trade-us-bg-image" draggable={false} aria-hidden="true" />

                <OverlayBlock slot={slots.exportsLabel} className="electricity-trade-us-overlay--exports-label">
                    <p className="electricity-trade-us-overlay-label">{getText('electricity_trade_us_info_exports_label', lang)}</p>
                </OverlayBlock>

                <OverlayBlock slot={slots.exportsValue} className="electricity-trade-us-overlay--exports-value">
                    <p className="electricity-trade-us-overlay-value">{exportsValue}</p>
                </OverlayBlock>

                <OverlayBlock slot={slots.importsLabel} className="electricity-trade-us-overlay--imports-label">
                    <p className="electricity-trade-us-overlay-label">{getText('electricity_trade_us_info_imports_label', lang)}</p>
                </OverlayBlock>

                <OverlayBlock slot={slots.importsValue} className="electricity-trade-us-overlay--imports-value">
                    <p className="electricity-trade-us-overlay-value">{importsValue}</p>
                </OverlayBlock>
            </div>
            <figcaption className="wb-inv">{ariaLabel}</figcaption>
        </figure>
    );
};

export default ElectricityTradeInfographic;
