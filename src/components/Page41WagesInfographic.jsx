import React from 'react';
import page41Bg from '../assets/page41_bg.svg';

export const BG_SIZE = { width: 672, height: 245.848 };

export const LEFT_BULLET_KEYS = ['wages', 'gender_gap'];
export const RIGHT_BULLET_KEYS = ['degree', 'occupations', 'occupation_gaps'];
export const BULLET_KEYS = [...LEFT_BULLET_KEYS, ...RIGHT_BULLET_KEYS];

export const exportPage41InfographicPng = async (figureEl, { title, scale = 2 }) => {
    if (!figureEl) return null;

    const exportRoot = figureEl.closest('.page41-inner');
    const titleEl = exportRoot?.querySelector('#page41-title');
    const layout = figureEl.querySelector('.page41-infographic-layout');
    if (!exportRoot || !titleEl || !layout) return null;

    const rootRect = exportRoot.getBoundingClientRect();
    const canvasW = Math.ceil(exportRoot.clientWidth);
    const canvasH = Math.ceil(
        Math.max(figureEl.getBoundingClientRect().bottom, titleEl.getBoundingClientRect().bottom) -
            rootRect.top +
            16,
    );

    const canvas = document.createElement('canvas');
    canvas.width = canvasW * scale;
    canvas.height = canvasH * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const rel = (el) => {
        const box = el.getBoundingClientRect();
        return {
            x: box.left - rootRect.left,
            y: box.top - rootRect.top,
            w: box.width,
            h: box.height,
        };
    };

    const waitForImage = (img) =>
        new Promise((resolve, reject) => {
            if (!img) {
                resolve(null);
                return;
            }
            if (img.complete && img.naturalWidth > 0) {
                resolve(img);
                return;
            }
            img.onload = () => resolve(img);
            img.onerror = reject;
        });

    const drawBulletMarker = (li) => {
        const liBox = rel(li);
        const textEl = li.querySelector('.page41-bullet-text');
        if (!textEl) return;
        const textStyle = window.getComputedStyle(textEl);
        const fontSize = parseFloat(textStyle.fontSize) || 20;
        const x = liBox.x + fontSize * 0.2;
        const y = liBox.y + fontSize * 0.65;
        ctx.fillStyle = '#333333';
        ctx.beginPath();
        ctx.arc(x, y, fontSize * 0.175, 0, Math.PI * 2);
        ctx.fill();
    };

    const drawTitleFromDOM = (el) => {
        const style = window.getComputedStyle(el);
        const transform = style.textTransform;
        ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        ctx.fillStyle = style.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        const applyTextTransform = (text) => {
            if (transform === 'uppercase') return text.toUpperCase();
            if (transform === 'lowercase') return text.toLowerCase();
            return text;
        };

        const range = document.createRange();
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const lineMap = new Map();

        let textNode;
        while ((textNode = walker.nextNode())) {
            const content = textNode.textContent ?? '';
            for (let i = 0; i < content.length; i += 1) {
                range.setStart(textNode, i);
                range.setEnd(textNode, i + 1);
                const charRect = range.getBoundingClientRect();
                if (charRect.width === 0 && charRect.height === 0) continue;

                const lineKey = Math.round(charRect.top);
                if (!lineMap.has(lineKey)) {
                    lineMap.set(lineKey, { chars: [], rect: charRect });
                }
                const entry = lineMap.get(lineKey);
                entry.chars.push({ char: content[i], x: charRect.left });
                if (charRect.top < entry.rect.top || charRect.left < entry.rect.left) {
                    entry.rect = charRect;
                }
            }
        }

        [...lineMap.entries()]
            .sort((a, b) => a[0] - b[0])
            .forEach(([, { chars, rect }]) => {
                chars.sort((a, b) => a.x - b.x);
                const lineText = applyTextTransform(chars.map((c) => c.char).join('').trim());
                if (!lineText) return;

                const x = Math.min(...chars.map((c) => c.x)) - rootRect.left;
                const y = rect.bottom - rootRect.top - rect.height * 0.12;
                ctx.fillText(lineText, x, y);
            });
    };

    const drawDomWords = (el) => {
        const style = window.getComputedStyle(el);
        const fontSize = parseFloat(style.fontSize) || 20;
        const fontFamily = style.fontFamily;
        const segments = [];

        const walk = (node, inherited) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const content = node.textContent ?? '';
                if (!content) return;

                let offset = 0;
                const parts = content.split(/(\s+)/);
                parts.forEach((part) => {
                    if (!part) return;
                    if (/^\s+$/.test(part)) {
                        offset += part.length;
                        return;
                    }

                    const range = document.createRange();
                    range.setStart(node, offset);
                    range.setEnd(node, offset + part.length);
                    const rect = range.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        segments.push({
                            text: part.replace(/\u00a0/g, '\u00a0'),
                            x: rect.left - rootRect.left,
                            y: rect.top - rootRect.top + rect.height / 2,
                            bold: inherited.bold,
                            accent: inherited.accent,
                        });
                    }
                    offset += part.length;
                });
                return;
            }

            if (node.nodeType !== Node.ELEMENT_NODE) return;

            const bold = inherited.bold || node.tagName === 'STRONG' || node.tagName === 'B';
            const accent = inherited.accent || node.classList?.contains('page41-accent');
            node.childNodes.forEach((child) => walk(child, { bold, accent }));
        };

        el.childNodes.forEach((child) => walk(child, { bold: false, accent: false }));

        segments.forEach((seg) => {
            ctx.font = `${seg.bold ? 'bold' : 'normal'} ${fontSize}px ${fontFamily}`;
            ctx.fillStyle = seg.accent ? '#a0346e' : '#333333';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(seg.text, seg.x, seg.y);
        });
    };

    const bgLoaded = await waitForImage(layout.querySelector('.page41-bg'));
    if (bgLoaded) {
        const box = rel(bgLoaded);
        ctx.drawImage(bgLoaded, box.x, box.y, box.w, box.h);
    }

    drawTitleFromDOM(titleEl);

    layout.querySelectorAll('.page41-bullet-item').forEach((li) => {
        drawBulletMarker(li);
        const textEl = li.querySelector('.page41-bullet-text');
        if (textEl) drawDomWords(textEl);
    });

    return canvas;
};

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
