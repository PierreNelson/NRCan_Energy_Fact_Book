import React from 'react';
import energySectorDemographicsBgBack from '../assets/energy_sector_demographics_bg_1.svg';
import energySectorDemographicsBgFront from '../assets/energy_sector_demographics_bg_2.png';
import { BUBBLE_KEYS, BUBBLE_SLOTS, NATIVE_SIZE } from './EnergySectorDemographicsInfographic.constants';

/** Layout height for bubble text overlays (excludes PNG tail margin below ~y310). */
const FRONT_LAYOUT_HEIGHT = 310;

/** Scale back scene up from the bottom so windmills/tower reach behind bubbles. */
const BACK_HEIGHT_SCALE = 1.08;

/** Nudge bubble PNG down (tails only — text overlays stay put). */
const BUBBLE_ART_NUDGE_PCT = 0.5;

const BG_FRONT_SIZE = { width: 996, height: 365 };
const BG_BACK_SIZE = { width: 672, height: 276.456 };

const BACK_HEIGHT_AT_WIDTH =
    (BG_FRONT_SIZE.width * BG_BACK_SIZE.height) / BG_BACK_SIZE.width;

const FRONT_HEIGHT_PCT = (FRONT_LAYOUT_HEIGHT / NATIVE_SIZE.height) * 100;
const BACK_HEIGHT_PCT = (BACK_HEIGHT_AT_WIDTH / NATIVE_SIZE.height) * 100;
const BACK_SHELL_HEIGHT_PCT = BACK_HEIGHT_PCT * BACK_HEIGHT_SCALE;

/** Map text slots (365px PNG coords) onto the shorter layout strip. */
const SLOT_SCALE = BG_FRONT_SIZE.height / FRONT_LAYOUT_HEIGHT;

const BubbleOverlay = ({ slotKey, html }) => {
    const slot = BUBBLE_SLOTS[slotKey];
    const widthPct = Math.min(slot.width ?? Infinity, 100 - slot.left);

    const boxStyle = {
        left: `${slot.left}%`,
        top: `${slot.top * SLOT_SCALE}%`,
        height: `${slot.height * SLOT_SCALE}%`,
    };

    if (slot.right != null) {
        boxStyle.right = `${slot.right}%`;
    } else {
        boxStyle.width = `${widthPct}%`;
    }

    return (
        <div className="energy-sector-demographics-bubble" style={boxStyle}>
            <div className="energy-sector-demographics-bubble-text" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
    );
};

const EnergySectorDemographicsInfographic = ({ figureRef, ariaLabel, bubbleHtml }) => (
    <figure ref={figureRef} className="energy-sector-demographics-infographic-figure" aria-label={ariaLabel}>
        <style>{`
.energy-sector-demographics-infographic-figure {
    display: block;
    width: 100%;
    max-width: 100%;
    margin: 0;
}
.energy-sector-demographics-infographic-wrapper {
    position: relative;
    width: 100%;
    max-width: 100%;
    aspect-ratio: ${NATIVE_SIZE.width} / ${NATIVE_SIZE.height};
    overflow: hidden;
    background: #ffffff;
}
.energy-sector-demographics-bg-back {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: ${BACK_SHELL_HEIGHT_PCT}%;
    object-fit: fill;
    object-position: center bottom;
    z-index: 1;
    user-select: none;
    pointer-events: none;
}
.energy-sector-demographics-front-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: ${FRONT_HEIGHT_PCT}%;
    z-index: 2;
    container-type: inline-size;
    pointer-events: none;
    overflow: visible;
}
.energy-sector-demographics-bg-front {
    position: absolute;
    top: 0;
    left: 0;
    display: block;
    width: 100%;
    height: auto;
    transform: translateY(${BUBBLE_ART_NUDGE_PCT}%);
    user-select: none;
    pointer-events: none;
}
.energy-sector-demographics-bubble {
    position: absolute;
    z-index: 3;
    display: grid;
    align-content: center;
    justify-items: stretch;
    text-align: center;
    padding: 2% 1%;
    box-sizing: border-box;
    pointer-events: none;
    overflow: hidden;
}
.energy-sector-demographics-bubble-text {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    font-family: 'Noto Sans', sans-serif;
    font-size: 1.7cqw;
    line-height: 1.3;
    color: #332f30;
    overflow-wrap: break-word;
    word-break: normal;
    hyphens: none;
}
.energy-sector-demographics-bubble-text .energy-sector-demographics-accent {
    color: #a0346e;
    font-weight: bold;
}
.energy-sector-demographics-bubble-text strong {
    font-weight: bold;
}
@media (max-width: 768px) {
    .energy-sector-demographics-bubble-text { font-size: 1.55cqw; }
}
@media (max-width: 480px) {
    .energy-sector-demographics-bubble-text { font-size: 1.75cqw; }
}
        `}</style>
        <div className="energy-sector-demographics-infographic-wrapper">
            <img src={energySectorDemographicsBgBack} alt="" className="energy-sector-demographics-bg-back" draggable={false} aria-hidden="true" />
            <div className="energy-sector-demographics-front-layer" aria-hidden="true">
                <img src={energySectorDemographicsBgFront} alt="" className="energy-sector-demographics-bg-front" draggable={false} />
                {BUBBLE_KEYS.map((key) => (
                    <BubbleOverlay key={key} slotKey={key} html={bubbleHtml[key]} />
                ))}
            </div>
        </div>
        <figcaption className="wb-inv">{ariaLabel}</figcaption>
    </figure>
);

export default EnergySectorDemographicsInfographic;
