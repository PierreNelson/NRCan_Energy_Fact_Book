import React from 'react';
import page41Bg from '../assets/page41_bg.svg';
import { BG_SIZE, LEFT_BULLET_KEYS, RIGHT_BULLET_KEYS } from './Page41WagesInfographic.constants';

const BulletItem = ({ html, ariaLabel }) => (
    <li className="page41-bullet-item" role="listitem" aria-label={ariaLabel}>
        <span className="page41-bullet-text" dangerouslySetInnerHTML={{ __html: html }} />
    </li>
);

const Page41WagesInfographic = ({ figureRef, ariaLabel, bulletHtml, bulletAria }) => (
    <figure ref={figureRef} className="page41-infographic-figure" aria-label={ariaLabel}>
        <style>{`
.page41-infographic-figure {
    display: block;
    width: 100%;
    max-width: 100%;
    margin: 0;
}
.page41-infographic-layout {
    width: 100%;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
}
.page41-text-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 2rem;
    row-gap: 0;
    width: 100%;
    padding: 0 0 1.25rem 0;
    box-sizing: border-box;
}
.page41-bullet-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-width: 0;
}
.page41-bullet-item {
    position: relative;
    padding-left: 1.25rem;
    margin: 0;
}
.page41-bullet-item::before {
    content: '';
    position: absolute;
    left: 0.2rem;
    top: 0.65em;
    width: 0.35em;
    height: 0.35em;
    border-radius: 50%;
    background: var(--gc-text);
}
.page41-bullet-text {
    display: block;
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
}
.page41-bullet-text .page41-accent {
    color: #a0346e;
    font-weight: bold;
}
.page41-bullet-text strong {
    font-weight: bold;
}
.page41-bg-wrapper {
    width: 100%;
    aspect-ratio: ${BG_SIZE.width} / ${BG_SIZE.height};
    flex-shrink: 0;
}
.page41-bg {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    object-position: center bottom;
    user-select: none;
    pointer-events: none;
}
@media (max-width: 768px) {
    .page41-text-columns {
        grid-template-columns: 1fr;
        row-gap: 0;
    }
    .page41-bullet-text { font-size: 18px; }
}
        `}</style>
        <div className="page41-infographic-layout">
            <div className="page41-text-columns">
                <ul className="page41-bullet-list" role="list">
                    {LEFT_BULLET_KEYS.map((key) => (
                        <BulletItem key={key} html={bulletHtml[key]} ariaLabel={bulletAria[key]} />
                    ))}
                </ul>
                <ul className="page41-bullet-list" role="list">
                    {RIGHT_BULLET_KEYS.map((key) => (
                        <BulletItem key={key} html={bulletHtml[key]} ariaLabel={bulletAria[key]} />
                    ))}
                </ul>
            </div>
            <div className="page41-bg-wrapper" aria-hidden="true">
                <img src={page41Bg} alt="" className="page41-bg" draggable={false} />
            </div>
        </div>
        <figcaption className="wb-inv">{ariaLabel}</figcaption>
    </figure>
);

export default Page41WagesInfographic;
