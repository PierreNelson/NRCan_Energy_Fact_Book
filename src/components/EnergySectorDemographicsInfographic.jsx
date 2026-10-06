import React, { useMemo } from 'react';
import energySectorDemographicsBgEn from '../assets/energy_sector_demographics_bg.svg';
import energySectorDemographicsBgFr from '../assets/energy_sector_demographics_bg_fr.svg';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { BUBBLE_BOXES, BUBBLE_KEYS } from './EnergySectorDemographicsInfographic.constants';

function spokenBubble(html) {
    return stripHtml(html)
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/\s+([.,;:!?])/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Each speech bubble is its own focusable region. The illustration (text baked
 * into the graphic) stays visual-only so a screen reader does not treat the
 * whole infographic as one image.
 */
const EnergySectorDemographicsInfographic = ({ figureRef, lang }) => {
    const src = lang === 'fr' ? energySectorDemographicsBgFr : energySectorDemographicsBgEn;
    const boxes = lang === 'fr' ? BUBBLE_BOXES.fr : BUBBLE_BOXES.en;

    const bubbles = useMemo(
        () => BUBBLE_KEYS.map((key) => ({
            key,
            label: spokenBubble(getText(`energy_sector_demographics_bubble_${key}`, lang)),
            box: boxes[key],
        })),
        [boxes, lang],
    );

    return (
        <figure ref={figureRef} className="energy-sector-demographics-infographic-figure">
            <style>{`
.energy-sector-demographics-infographic-figure {
    position: relative;
    display: block;
    width: 100%;
    max-width: 100%;
    margin: 0;
}
.energy-sector-demographics-graphic {
    position: relative;
    width: 100%;
}
.energy-sector-demographics-bg {
    width: 100%;
    height: auto;
    display: block;
    user-select: none;
    pointer-events: none;
}
.energy-sector-demographics-bubble {
    position: absolute;
    border-radius: 12px;
    box-sizing: border-box;
}
.energy-sector-demographics-bubble:focus,
.energy-sector-demographics-bubble:focus-visible {
    outline: 3px solid #ffbf47;
    outline-offset: 2px;
}
            `}</style>
            <div className="energy-sector-demographics-graphic">
                <img
                    src={src}
                    alt=""
                    aria-hidden="true"
                    className="energy-sector-demographics-bg"
                    draggable={false}
                />
                {bubbles.map(({ key, label, box }) => (
                    <div
                        key={key}
                        className={`energy-sector-demographics-bubble energy-sector-demographics-bubble--${key}`}
                        role="region"
                        tabIndex={0}
                        aria-label={label}
                        data-prose-tab="1"
                        style={{
                            left: `${box.left}%`,
                            top: `${box.top}%`,
                            width: `${box.width}%`,
                            height: `${box.height}%`,
                        }}
                    />
                ))}
            </div>
        </figure>
    );
};

export default EnergySectorDemographicsInfographic;
