import React from 'react';
import page40BgBack from '../assets/page40_bg_1.svg';
import page40BgFront from '../assets/page40_bg_2.png';

export const BG_FRONT_SIZE = { width: 996, height: 365 };
export const BG_BACK_SIZE = { width: 672, height: 276.456 };

/** Layout height for bubble text overlays (excludes PNG tail margin below ~y310). */
const FRONT_LAYOUT_HEIGHT = 310;

/** Overlap between bubble art and workers scene. */
const OVERLAP_RATIO = 0.048;

/** Scale back scene up from the bottom so windmills/tower reach behind bubbles. */
const BACK_HEIGHT_SCALE = 1.08;

/** Nudge bubble PNG down (tails only — text overlays stay put). */
const BUBBLE_ART_NUDGE_PCT = 0.5;

const BACK_HEIGHT_AT_WIDTH =
    (BG_FRONT_SIZE.width * BG_BACK_SIZE.height) / BG_BACK_SIZE.width;

/** Full composite with layers overlapping like page40.png (not stacked). */
export const NATIVE_SIZE = {
    width: BG_FRONT_SIZE.width,
    height: FRONT_LAYOUT_HEIGHT + BACK_HEIGHT_AT_WIDTH - BG_FRONT_SIZE.width * OVERLAP_RATIO,
};

const FRONT_HEIGHT_PCT = (FRONT_LAYOUT_HEIGHT / NATIVE_SIZE.height) * 100;
const BACK_HEIGHT_PCT = (BACK_HEIGHT_AT_WIDTH / NATIVE_SIZE.height) * 100;
const BACK_SHELL_HEIGHT_PCT = BACK_HEIGHT_PCT * BACK_HEIGHT_SCALE;

/** Map text slots (365px PNG coords) onto the shorter layout strip. */
const SLOT_SCALE = BG_FRONT_SIZE.height / FRONT_LAYOUT_HEIGHT;

export const BUBBLE_KEYS = ['women', 'indigenous', 'education', 'aging', 'diversity', 'immigrants'];

/** Overlay anchors (% of layout strip). Calibrated against page40_bg_2.png. */
export const BUBBLE_SLOTS = {
    women: { left: 1.5, top: 0, width: 20, height: 42 },
    indigenous: { left: 1.5, top: 57, width: 20, height: 22 },
    education: { left: 24.5, top: 2, width: 30, height: 40 },
    aging: { left: 25, top: 51, width: 32, height: 30 },
    diversity: { left: 56.5, top: 2, width: 46, height: 42 },
    immigrants: { left: 60.5, top: 51, right: 7, height: 24 },
};

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
        <div className="page40-bubble" style={boxStyle}>
            <div className="page40-bubble-text" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
    );
};

/** Export title + infographic using live DOM measurements. */
export const exportPage40InfographicPng = async (figureEl, { title, scale = 2 }) => {
    if (!figureEl) return null;

    const exportRoot = figureEl.closest('.page40-inner');
    const titleEl = exportRoot?.querySelector('#page40-title');
    const wrapper = figureEl.querySelector('.page40-infographic-wrapper');
    if (!exportRoot || !titleEl || !wrapper) return null;

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

    const drawRichText = (el) => {
        const box = rel(el);
        const style = window.getComputedStyle(el);
        const fontSize = parseFloat(style.fontSize) || 14;
        const fontFamily = style.fontFamily;
        const lineHeight = fontSize * 1.35;
        const maxWidth = box.w;

        const measureWord = (text, bold) => {
            ctx.font = `${bold ? 'bold' : 'normal'} ${fontSize}px ${fontFamily}`;
            return ctx.measureText(text).width;
        };

        const measureSpace = () => {
            ctx.font = `normal ${fontSize}px ${fontFamily}`;
            return ctx.measureText(' ').width;
        };

        const words = [];
        el.childNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.replace(/\s+/g, ' ').trim();
                if (!text) return;
                text.split(' ').filter(Boolean).forEach((word) => {
                    words.push({ text: word, bold: false, accent: false });
                });
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const text = node.textContent.replace(/\s+/g, ' ').trim();
                if (!text) return;
                const bold = node.tagName === 'STRONG' || node.tagName === 'B';
                const accent = node.classList?.contains('page40-accent');
                text.split(' ').filter(Boolean).forEach((word) => {
                    words.push({ text: word, bold: bold || accent, accent });
                });
            }
        });

        const lines = [];
        let line = [];
        let lineWidth = 0;
        const spaceWidth = measureSpace();

        words.forEach((word) => {
            const addWidth = (line.length ? spaceWidth : 0) + measureWord(word.text, word.bold);
            if (line.length > 0 && lineWidth + addWidth > maxWidth) {
                lines.push(line);
                line = [word];
                lineWidth = measureWord(word.text, word.bold);
            } else {
                line.push(word);
                lineWidth += addWidth;
            }
        });
        if (line.length) lines.push(line);

        const totalHeight = lines.length * lineHeight;
        let y = box.y + (box.h - totalHeight) / 2 + lineHeight / 2;

        lines.forEach((lineWords) => {
            let lineTextWidth = 0;
            lineWords.forEach((word, index) => {
                if (index > 0) lineTextWidth += spaceWidth;
                lineTextWidth += measureWord(word.text, word.bold);
            });

            let x = box.x + (box.w - lineTextWidth) / 2;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            lineWords.forEach((word, index) => {
                if (index > 0) x += spaceWidth;
                ctx.font = `${word.bold ? 'bold' : 'normal'} ${fontSize}px ${fontFamily}`;
                ctx.fillStyle = word.accent ? '#a0346e' : '#332f30';
                ctx.fillText(word.text, x, y);
                x += measureWord(word.text, word.bold);
            });
            y += lineHeight;
        });
    };

    const titleBox = rel(titleEl);
    const titleStyle = window.getComputedStyle(titleEl);
    ctx.fillStyle = titleStyle.color;
    ctx.font = `${titleStyle.fontWeight} ${titleStyle.fontSize} ${titleStyle.fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, titleBox.x, titleBox.y + titleBox.h / 2);

    const bgBack = wrapper.querySelector('.page40-bg-back');
    const bgFront = wrapper.querySelector('.page40-bg-front');
    const bgBackLoaded = await waitForImage(bgBack);
    const bgFrontLoaded = await waitForImage(bgFront);

    if (bgBackLoaded) {
        const box = rel(bgBackLoaded);
        ctx.drawImage(bgBackLoaded, box.x, box.y, box.w, box.h);
    }
    if (bgFrontLoaded) {
        const box = rel(bgFrontLoaded);
        ctx.drawImage(bgFrontLoaded, box.x, box.y, box.w, box.h);
    }

    wrapper.querySelectorAll('.page40-bubble-text').forEach(drawRichText);

    return canvas;
};

const Page40DemographicsInfographic = ({ figureRef, ariaLabel, bubbleHtml }) => (
    <figure ref={figureRef} className="page40-infographic-figure" aria-label={ariaLabel}>
        <style>{`
.page40-infographic-figure {
    display: block;
    width: 100%;
    max-width: 100%;
    margin: 0;
}
.page40-infographic-wrapper {
    position: relative;
    width: 100%;
    max-width: 100%;
    aspect-ratio: ${NATIVE_SIZE.width} / ${NATIVE_SIZE.height};
    overflow: hidden;
    background: #ffffff;
}
.page40-bg-back {
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
.page40-front-layer {
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
.page40-bg-front {
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
.page40-bubble {
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
.page40-bubble-text {
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
.page40-bubble-text .page40-accent {
    color: #a0346e;
    font-weight: bold;
}
.page40-bubble-text strong {
    font-weight: bold;
}
@media (max-width: 768px) {
    .page40-bubble-text { font-size: 1.55cqw; }
}
@media (max-width: 480px) {
    .page40-bubble-text { font-size: 1.75cqw; }
}
        `}</style>
        <div className="page40-infographic-wrapper">
            <img src={page40BgBack} alt="" className="page40-bg-back" draggable={false} aria-hidden="true" />
            <div className="page40-front-layer" aria-hidden="true">
                <img src={page40BgFront} alt="" className="page40-bg-front" draggable={false} />
                {BUBBLE_KEYS.map((key) => (
                    <BubbleOverlay key={key} slotKey={key} html={bubbleHtml[key]} />
                ))}
            </div>
        </div>
        <figcaption className="wb-inv">{ariaLabel}</figcaption>
    </figure>
);

export default Page40DemographicsInfographic;
