import React from 'react';
import page55Bg from '../assets/page55_bg.png';

const NATIVE_SIZE = { width: 1052, height: 151 };

/**
 * Individual overlay anchors (% of wrapper), calibrated against page55.png / page55fr.png
 * and page55_bg.png (icon ~0–11%, arrows ~34% and ~64%).
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
        className={`page55-overlay ${className}`}
        style={{
            left: `${slot.left}%`,
            top: `${slot.top}%`,
            width: slot.width ? `${slot.width}%` : undefined,
        }}
    >
        {children}
    </div>
);

const Page55IntensityInfographic = ({ lang, getText, ariaLabel, figureRef }) => {
    const overlayLang = lang === 'fr' ? 'fr' : 'en';
    const slots = TEXT_SLOTS[overlayLang];

    return (
        <figure ref={figureRef} className="page55-infographic-figure" aria-label={ariaLabel}>
            <style>{`
.page55-infographic-figure {
    display: block;
    width: 100%;
    max-width: none;
    margin: 24px 0 0 0;
    padding: 0;
}
.page55-infographic-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: ${NATIVE_SIZE.width} / ${NATIVE_SIZE.height};
    container-type: inline-size;
    background: #ffffff;
}
.page55-bg-image {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    user-select: none;
    pointer-events: none;
}
.page55-overlay {
    position: absolute;
    z-index: 2;
    box-sizing: border-box;
    pointer-events: none;
}
.page55-infographic-figure p.page55-overlay-body {
    font-family: 'Noto Sans', sans-serif;
    font-size: 1.4cqw;
    font-weight: bold;
    line-height: 1.28;
    color: #332f30;
    margin: 0;
    text-align: left;
}
.page55-infographic-figure p.page55-overlay-body--bold {
    font-weight: 700;
}
.page-55.page-content .page55-infographic-figure p.page55-overlay-pct {
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
    .page55-infographic-figure p.page55-overlay-body { font-size: 1.55cqw; }
    .page-55.page-content .page55-infographic-figure p.page55-overlay-pct { font-size: 6.5cqw; }
}
            `}</style>

            <div className="page55-infographic-wrapper">
                <img src={page55Bg} alt="" className="page55-bg-image" draggable={false} aria-hidden="true" />

                <OverlayBlock slot={slots.leftLead} className="page55-overlay--left-lead">
                    <p className="page55-overlay-body">{getText('page55_info_left_lead', lang)}</p>
                </OverlayBlock>

                <OverlayBlock slot={slots.leftPct} className="page55-overlay--left-pct">
                    <p className="page55-overlay-pct">{getText('page55_info_left_pct', lang)}</p>
                </OverlayBlock>

                <OverlayBlock slot={slots.leftSuffix} className="page55-overlay--left-suffix">
                    <p
                        className={`page55-overlay-body${lang === 'fr' ? ' page55-overlay-body--bold' : ''}`}
                        dangerouslySetInnerHTML={{ __html: getText('page55_info_left_suffix', lang) }}
                    />
                </OverlayBlock>

                <OverlayBlock slot={slots.rightLead} className="page55-overlay--right-lead">
                    <p className={`page55-overlay-body${lang === 'fr' ? ' page55-overlay-body--bold' : ''}`}>
                        {getText('page55_info_right_lead', lang)}
                    </p>
                </OverlayBlock>

                <OverlayBlock slot={slots.rightPct} className="page55-overlay--right-pct">
                    <p className="page55-overlay-pct">{getText('page55_info_right_pct', lang)}</p>
                </OverlayBlock>

                <OverlayBlock slot={slots.rightSuffix} className="page55-overlay--right-suffix">
                    <p
                        className={`page55-overlay-body${lang === 'fr' ? ' page55-overlay-body--bold' : ''}`}
                        dangerouslySetInnerHTML={{ __html: getText('page55_info_right_suffix', lang) }}
                    />
                </OverlayBlock>
            </div>
            <figcaption className="wb-inv">{ariaLabel}</figcaption>
        </figure>
    );
};

export default Page55IntensityInfographic;
