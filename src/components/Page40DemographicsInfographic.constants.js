export const BG_FRONT_SIZE = { width: 996, height: 365 };
export const BG_BACK_SIZE = { width: 672, height: 276.456 };

/** Layout height for bubble text overlays (excludes PNG tail margin below ~y310). */
const FRONT_LAYOUT_HEIGHT = 310;

/** Overlap between bubble art and workers scene. */
const OVERLAP_RATIO = 0.048;

const BACK_HEIGHT_AT_WIDTH =
    (BG_FRONT_SIZE.width * BG_BACK_SIZE.height) / BG_BACK_SIZE.width;

/** Full composite with layers overlapping like page40.png (not stacked). */
export const NATIVE_SIZE = {
    width: BG_FRONT_SIZE.width,
    height: FRONT_LAYOUT_HEIGHT + BACK_HEIGHT_AT_WIDTH - BG_FRONT_SIZE.width * OVERLAP_RATIO,
};

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

/** Export title + infographic using live DOM measurements. */
export const exportDemographicsInfographicPng = async (figureEl, { title, scale = 2 }) => {
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
