import React from 'react';
import energySectorWagesBg from '../assets/energy_sector_wages_bg.svg';
import { BG_SIZE, LEFT_BULLET_KEYS, RIGHT_BULLET_KEYS } from './EnergySectorWagesInfographic.constants';

const BulletItem = ({ html, ariaLabel }) => (
    <li className="energy-sector-wages-bullet-item" role="listitem" aria-label={ariaLabel}>
        <span className="energy-sector-wages-bullet-text" dangerouslySetInnerHTML={{ __html: html }} />
    </li>
);

const EnergySectorWagesInfographic = ({ figureRef, ariaLabel, bulletHtml, bulletAria }) => (
    <figure ref={figureRef} className="energy-sector-wages-infographic-figure" aria-label={ariaLabel}>
        <style>{`
.energy-sector-wages-infographic-figure {
    display: block;
    width: 100%;
    max-width: 100%;
    margin: 0;
}
.energy-sector-wages-infographic-layout {
    width: 100%;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
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
    list-style: none;
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
.energy-sector-wages-bg-wrapper {
    width: 100%;
    aspect-ratio: ${BG_SIZE.width} / ${BG_SIZE.height};
    flex-shrink: 0;
}
.energy-sector-wages-bg {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    object-position: center bottom;
    user-select: none;
    pointer-events: none;
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
                <ul className="energy-sector-wages-bullet-list" role="list">
                    {LEFT_BULLET_KEYS.map((key) => (
                        <BulletItem key={key} html={bulletHtml[key]} ariaLabel={bulletAria[key]} />
                    ))}
                </ul>
                <ul className="energy-sector-wages-bullet-list" role="list">
                    {RIGHT_BULLET_KEYS.map((key) => (
                        <BulletItem key={key} html={bulletHtml[key]} ariaLabel={bulletAria[key]} />
                    ))}
                </ul>
            </div>
            <div className="energy-sector-wages-bg-wrapper" aria-hidden="true">
                <img src={energySectorWagesBg} alt="" className="energy-sector-wages-bg" draggable={false} />
            </div>
        </div>
        <figcaption className="wb-inv">{ariaLabel}</figcaption>
    </figure>
);

export default EnergySectorWagesInfographic;
