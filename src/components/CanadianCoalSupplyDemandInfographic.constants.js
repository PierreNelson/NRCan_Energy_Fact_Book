export const NATIVE_SIZE = {
    default: { width: 328, height: 571 },
    stacked: { width: 1103, height: 201 },
};

/** Side-by-side layout overlay anchors (% of wrapper). */
export const OVERLAY_SLOTS = {
    en: {
        totalMt: { left: 45, top: 16, align: 'center' },
        electricityText: { left: 18, top: 30, align: 'center' },
        metallurgicalText: { left: 26, top: 72, align: 'center' },
    },
    fr: {
        totalMt: { left: 45, top: 16, align: 'center' },
        electricityText: { left: 18, top: 22.5, align: 'center' },
        metallurgicalText: { left: 18, top: 68, align: 'center' },
    },
};

/** Stacked layout overlay anchors (% of wrapper). Tune independently from side-by-side slots. */
export const STACKED_OVERLAY_SLOTS = {
    en: {
        totalMt: { left: 9.5, top: 54, align: 'center' },
        electricityText: { left: 24, top: -4, align: 'center' },
        metallurgicalText: { left: 74, top: 28, align: 'center' },
    },
    fr: {
        totalMt: { left: 9.5, top: 54, align: 'center' },
        electricityText: { left: 23, top: -28, align: 'center' },
        metallurgicalText: { left: 74, top: 10, align: 'center' },
    },
};

export const OVERLAY_COLORS = {
    totalMt: '#FFFFFF',
    electricityText: '#333333',
    metallurgicalText: '#333333',
};

export const INFOGRAPHIC_DATA = {
    totalMt: 12,
    electricityMt: 8.5,
};

export const getOverlayLang = (lang) => (lang === 'fr' ? 'fr' : 'en');

export const getNativeSize = (stacked = false) =>
    stacked ? NATIVE_SIZE.stacked : NATIVE_SIZE.default;

export const getOverlaySlots = (lang, stacked = false) => {
    const overlayLang = getOverlayLang(lang);
    return stacked ? STACKED_OVERLAY_SLOTS[overlayLang] : OVERLAY_SLOTS[overlayLang];
};

/** Rasterize the live infographic DOM so PNG matches on-screen text positioning. */
export const exportCanadianCoalSupplyDemandInfographicPng = async (figureEl, { scale = 3 } = {}) => {
    if (!figureEl) return null;

    const wrapper = figureEl.querySelector('.canadian-coal-supply-demand-infographic-wrapper');
    const bgImg = wrapper?.querySelector('.canadian-coal-supply-demand-bg-image');
    if (!wrapper || !bgImg) return null;

    const wrapperRect = wrapper.getBoundingClientRect();
    const overlayEls = wrapper.querySelectorAll(
        '.canadian-coal-supply-demand-overlay-total, .canadian-coal-supply-demand-overlay-caption',
    );

    if (wrapperRect.width <= 0 || wrapperRect.height <= 0) return null;

    const EXPORT_PAD = 2;
    let minX = 0;
    let minY = 0;
    let maxX = wrapperRect.width;
    let maxY = wrapperRect.height;

    overlayEls.forEach((el) => {
        const box = el.getBoundingClientRect();
        const x = box.left - wrapperRect.left;
        const y = box.top - wrapperRect.top;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + box.width);
        maxY = Math.max(maxY, y + box.height);
    });

    const padLeft = Math.ceil(Math.max(0, -minX)) + EXPORT_PAD;
    const padTop = Math.ceil(Math.max(0, -minY)) + EXPORT_PAD;
    const padRight = Math.ceil(Math.max(0, maxX - wrapperRect.width)) + EXPORT_PAD;
    const padBottom = Math.ceil(Math.max(0, maxY - wrapperRect.height)) + EXPORT_PAD;

    const canvasW = Math.ceil(wrapperRect.width + padLeft + padRight);
    const canvasH = Math.ceil(wrapperRect.height + padTop + padBottom);

    const canvas = document.createElement('canvas');
    canvas.width = canvasW * scale;
    canvas.height = canvasH * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const bgUrl = bgImg.currentSrc || bgImg.src;
    const img = new Image();
    await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = bgUrl;
    });
    ctx.drawImage(img, padLeft, padTop, wrapperRect.width, wrapperRect.height);

    const rel = (el) => {
        const box = el.getBoundingClientRect();
        return {
            x: box.left - wrapperRect.left + padLeft,
            y: box.top - wrapperRect.top + padTop,
            w: box.width,
            h: box.height,
        };
    };

    const drawOverlayText = (el) => {
        const text = el.innerText ?? '';
        if (!text.trim()) return;

        const style = window.getComputedStyle(el);
        const box = rel(el);
        ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        ctx.fillStyle = style.color;
        ctx.textBaseline = 'alphabetic';

        const textAlign = style.textAlign || 'left';
        ctx.textAlign = textAlign;

        const lines = text.split('\n');
        const fontSize = parseFloat(style.fontSize) || 14;
        const lineHeight = Number.isFinite(parseFloat(style.lineHeight))
            ? parseFloat(style.lineHeight)
            : fontSize * 1.35;

        let x = box.x;
        if (textAlign === 'center') x = box.x + box.w / 2;
        else if (textAlign === 'right') x = box.x + box.w;

        let y = box.y + fontSize * 0.85;
        lines.forEach((line) => {
            ctx.fillText(line, x, y);
            y += lineHeight;
        });
    };

    overlayEls.forEach(drawOverlayText);

    return canvas;
};
