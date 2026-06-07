import React from 'react';
import page65Bg from '../assets/page65_bg.png';

/** Matches page65_bg.png (408×157). Towers at 60% size, pinned left/right; values beside each tower. */
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
        className={`page65-overlay ${className}`}
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

const Page65TradeInfographic = ({ lang, getText, ariaLabel, figureRef }) => {
    const overlayLang = lang === 'fr' ? 'fr' : 'en';
    const slots = TEXT_SLOTS[overlayLang];

    return (
        <figure ref={figureRef} className="page65-infographic-figure" aria-label={ariaLabel}>
            <style>{`
.page65-infographic-figure {
    display: block;
    width: 100%;
    max-width: none;
    margin: 0 0 20px 0;
    padding: 0;
}
.page65-infographic-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: ${NATIVE_SIZE.width} / ${NATIVE_SIZE.height};
    container-type: inline-size;
    background: #ffffff;
}
.page65-bg-image {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    user-select: none;
    pointer-events: none;
}
.page65-overlay {
    position: absolute;
    z-index: 2;
    box-sizing: border-box;
    pointer-events: none;
}
.page65-infographic-figure p.page65-overlay-label {
    font-family: 'Lato', sans-serif;
    font-size: 3.2cqw;
    font-weight: 700;
    line-height: 1.1;
    color: #58585a;
    margin: 0;
    letter-spacing: 0.01em;
}
.page65-infographic-figure p.page65-overlay-value {
    font-family: 'Lato', sans-serif;
    font-size: 2.4cqw;
    font-weight: 700;
    line-height: 1;
    color: #332f30;
    margin: 0;
    white-space: nowrap;
}
.page65-overlay--exports-label p,
.page65-overlay--exports-value p {
    text-align: left;
}
.page65-overlay--imports-label p,
.page65-overlay--imports-value p {
    text-align: right;
}
@media (max-width: 768px) {
    .page65-infographic-figure p.page65-overlay-label { font-size: 3.6cqw; }
    .page65-infographic-figure p.page65-overlay-value { font-size: 2.8cqw; }
}
            `}</style>

            <div className="page65-infographic-wrapper">
                <img src={page65Bg} alt="" className="page65-bg-image" draggable={false} aria-hidden="true" />

                <OverlayBlock slot={slots.exportsLabel} className="page65-overlay--exports-label">
                    <p className="page65-overlay-label">{getText('page65_info_exports_label', lang)}</p>
                </OverlayBlock>

                <OverlayBlock slot={slots.exportsValue} className="page65-overlay--exports-value">
                    <p className="page65-overlay-value">{getText('page65_info_exports_value', lang)}</p>
                </OverlayBlock>

                <OverlayBlock slot={slots.importsLabel} className="page65-overlay--imports-label">
                    <p className="page65-overlay-label">{getText('page65_info_imports_label', lang)}</p>
                </OverlayBlock>

                <OverlayBlock slot={slots.importsValue} className="page65-overlay--imports-value">
                    <p className="page65-overlay-value">{getText('page65_info_imports_value', lang)}</p>
                </OverlayBlock>
            </div>
            <figcaption className="wb-inv">{ariaLabel}</figcaption>
        </figure>
    );
};

export default Page65TradeInfographic;
