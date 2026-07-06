import React from 'react';
import energyIntensityIndexBg from '../assets/energy_intensity_index_bg.png';

const NATIVE_SIZE = { width: 1052, height: 151 };

/**
 * Individual overlay anchors (% of wrapper), calibrated against energy_intensity_index.png
 * and energy_intensity_index_bg.png (icon ~0–11%, arrows ~34% and ~64%).
 */
const TEXT_SLOTS = {
    en: {
        leftLead: { left: 7.5, top: 62, width: 19 },
        leftPct: { left: 28, top: 32 },
        leftSuffix: { left: 38, top: 38, width: 17 },
        rightLead: { left: 63, top: 38, width: 10 },
        rightPct: { left: 73, top: 46 },
        rightSuffix: { left: 86, top: 48, width: 28 },
    },
    fr: {
        leftLead: { left: 7.5, top: 62, width: 21 },
        leftPct: { left: 28, top: 32 },
        leftSuffix: { left: 38, top: 38, width: 16 },
        rightLead: { left: 63, top: 38, width: 15 },
        rightPct: { left: 73, top: 46 },
        rightSuffix: { left: 86, top: 48, width: 32 },
    },
};

const OverlayBlock = ({ slot, className, children }) => (
    <div
        className={`energy-intensity-index-overlay ${className}`}
        style={{
            left: `${slot.left}%`,
            top: `${slot.top}%`,
            width: slot.width ? `${slot.width}%` : undefined,
        }}
    >
        {children}
    </div>
);

const EnergyIntensityIndexInfographic = ({ lang, getText, ariaLabel, figureRef }) => {
    const overlayLang = lang === 'fr' ? 'fr' : 'en';
    const slots = TEXT_SLOTS[overlayLang];

    return (
        <figure ref={figureRef} className="energy-intensity-index-infographic-figure" aria-label={ariaLabel}>
            <style>{`
.energy-intensity-index-infographic-figure {
    display: block;
    width: 100%;
    max-width: none;
    margin: 24px 0 0 0;
    padding: 0;
}
.energy-intensity-index-infographic-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: ${NATIVE_SIZE.width} / ${NATIVE_SIZE.height};
    container-type: inline-size;
    background: #ffffff;
}
.energy-intensity-index-bg-image {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    user-select: none;
    pointer-events: none;
}
.energy-intensity-index-overlay {
    position: absolute;
    z-index: 2;
    box-sizing: border-box;
    pointer-events: none;
}
.energy-intensity-index-infographic-figure p.energy-intensity-index-overlay-body {
    font-family: 'Noto Sans', sans-serif;
    font-size: 1.4cqw;
    font-weight: bold;
    line-height: 1.28;
    color: #332f30;
    margin: 0;
    text-align: left;
}
.energy-intensity-index-infographic-figure p.energy-intensity-index-overlay-body--bold {
    font-weight: 700;
}
.page-55.page-content .energy-intensity-index-infographic-figure p.energy-intensity-index-overlay-pct {
    font-family: 'Lato', sans-serif;
    font-size: 6cqw;
    font-weight: 700;
    line-height: 1;
    color: #C58516;
    margin: 0;
    text-align: left;
    white-space: nowrap;
}
@media (max-width: 768px) {
    .energy-intensity-index-infographic-figure p.energy-intensity-index-overlay-body { font-size: 1.55cqw; }
    .page-55.page-content .energy-intensity-index-infographic-figure p.energy-intensity-index-overlay-pct { font-size: 6.5cqw; }
}
            `}</style>

            <div className="energy-intensity-index-infographic-wrapper">
                <img src={energyIntensityIndexBg} alt="" className="energy-intensity-index-bg-image" draggable={false} aria-hidden="true" />

                <OverlayBlock slot={slots.leftLead} className="energy-intensity-index-overlay--left-lead">
                    <p className="energy-intensity-index-overlay-body">{getText('energy_intensity_index_info_left_lead', lang)}</p>
                </OverlayBlock>

                <OverlayBlock slot={slots.leftPct} className="energy-intensity-index-overlay--left-pct">
                    <p className="energy-intensity-index-overlay-pct">{getText('energy_intensity_index_info_left_pct', lang)}</p>
                </OverlayBlock>

                <OverlayBlock slot={slots.leftSuffix} className="energy-intensity-index-overlay--left-suffix">
                    <p
                        className={`energy-intensity-index-overlay-body${lang === 'fr' ? ' energy-intensity-index-overlay-body--bold' : ''}`}
                        dangerouslySetInnerHTML={{ __html: getText('energy_intensity_index_info_left_suffix', lang) }}
                    />
                </OverlayBlock>

                <OverlayBlock slot={slots.rightLead} className="energy-intensity-index-overlay--right-lead">
                    <p className={`energy-intensity-index-overlay-body${lang === 'fr' ? ' energy-intensity-index-overlay-body--bold' : ''}`}>
                        {getText('energy_intensity_index_info_right_lead', lang)}
                    </p>
                </OverlayBlock>

                <OverlayBlock slot={slots.rightPct} className="energy-intensity-index-overlay--right-pct">
                    <p className="energy-intensity-index-overlay-pct">{getText('energy_intensity_index_info_right_pct', lang)}</p>
                </OverlayBlock>

                <OverlayBlock slot={slots.rightSuffix} className="energy-intensity-index-overlay--right-suffix">
                    <p
                        className={`energy-intensity-index-overlay-body${lang === 'fr' ? ' energy-intensity-index-overlay-body--bold' : ''}`}
                        dangerouslySetInnerHTML={{ __html: getText('energy_intensity_index_info_right_suffix', lang) }}
                    />
                </OverlayBlock>
            </div>
            <figcaption className="wb-inv">{ariaLabel}</figcaption>
        </figure>
    );
};

export default EnergyIntensityIndexInfographic;
