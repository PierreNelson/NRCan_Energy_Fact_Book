export const BG_SIZE = { width: 672, height: 245.848 };

export const LEFT_BULLET_KEYS = ['wages', 'gender_gap'];
export const RIGHT_BULLET_KEYS = ['degree', 'occupations', 'occupation_gaps'];
export const BULLET_KEYS = [...LEFT_BULLET_KEYS, ...RIGHT_BULLET_KEYS];

export const exportPage41InfographicPng = async (figureEl, { scale = 2 } = {}) => {
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
