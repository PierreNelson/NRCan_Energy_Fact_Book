import React from 'react';
import SafeHtml from './SafeHtml';
import energySectorWagesBg from '../assets/energy_sector_wages_bg.svg';
import { BG_SIZE, LEFT_BULLET_KEYS, RIGHT_BULLET_KEYS } from './EnergySectorWagesInfographic.constants';

/**
 * Page 41 SR pattern (same as page 21 EnergyInformationLandscape):
 * - Each bullet is its own focusable role="region" with aria-label
 * - Illustration is decorative (aria-hidden)
 * - Do not wrap copy in AccessibleInfographic mode="image" (one role="img" for the whole block)
 */
const BulletItem = ({ html, ariaLabel }) => (
    <div
        className="energy-sector-wages-bullet-item"
        role="region"
        tabIndex={0}
        aria-label={ariaLabel}
        data-prose-tab="1"
    >
        <SafeHtml
            as="span"
            className="energy-sector-wages-bullet-text"
            html={html}
            aria-hidden="true"
        />
    </div>
);

const EnergySectorWagesInfographic = ({ figureRef, bulletHtml, bulletAria }) => (
    <figure ref={figureRef} className="energy-sector-wages-infographic-figure">
        <style>{`
.energy-sector-wages-infographic-figure {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 100%;
    margin: 0;
}
.energy-sector-wages-infographic-layout {
    order: 1;
    width: 100%;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
}
.energy-sector-wages-bg {
    order: 2;
    display: block;
    width: 100%;
    aspect-ratio: ${BG_SIZE.width} / ${BG_SIZE.height};
    height: auto;
    object-fit: fill;
    object-position: center bottom;
    user-select: none;
    pointer-events: none;
    flex-shrink: 0;
}
.energy-sector-wages-text-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 2rem;
    row-gap: 0;
    width: 100%;
    padding: 0 0 1.25rem 0;
    box-sizing: border-box;
}
.energy-sector-wages-bullet-list {
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-width: 0;
}
.energy-sector-wages-bullet-item {
    position: relative;
    padding-left: 1.25rem;
    margin: 0;
    border-radius: 2px;
    box-sizing: border-box;
}
.energy-sector-wages-bullet-item:focus,
.energy-sector-wages-bullet-item:focus-visible {
    outline: 3px solid #ffbf47;
    outline-offset: 4px;
}
.energy-sector-wages-bullet-item::before {
    content: '';
    position: absolute;
    left: 0.2rem;
    top: 0.65em;
    width: 0.35em;
    height: 0.35em;
    border-radius: 50%;
    background: var(--gc-text);
}
.energy-sector-wages-bullet-text {
    display: block;
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
}
.energy-sector-wages-bullet-text .energy-sector-wages-accent {
    color: #a0346e;
    font-weight: bold;
}
.energy-sector-wages-bullet-text strong {
    font-weight: bold;
}
@media (max-width: 768px) {
    .energy-sector-wages-text-columns {
        grid-template-columns: 1fr;
        row-gap: 0;
    }
    .energy-sector-wages-bullet-text { font-size: 18px; }
}
        `}</style>
        <div className="energy-sector-wages-infographic-layout">
            <div className="energy-sector-wages-text-columns">
                <div className="energy-sector-wages-bullet-list">
                    {LEFT_BULLET_KEYS.map((key) => (
                        <BulletItem key={key} html={bulletHtml[key]} ariaLabel={bulletAria[key]} />
                    ))}
                </div>
                <div className="energy-sector-wages-bullet-list">
                    {RIGHT_BULLET_KEYS.map((key) => (
                        <BulletItem key={key} html={bulletHtml[key]} ariaLabel={bulletAria[key]} />
                    ))}
                </div>
            </div>
        </div>
        <img
            src={energySectorWagesBg}
            alt=""
            className="energy-sector-wages-bg"
            draggable={false}
            aria-hidden="true"
        />
    </figure>
);

export default EnergySectorWagesInfographic;
