/** Wind power infographic — overlay positions on wind_power_canada_bg.png (562×219 native). */
export const NATIVE_SIZE = { width: 562, height: 219 };

/** Slightly inset bg so “since 2011” clears the arrow edges (tune here only). */
export const BG_IMAGE_SCALE = 0.94;

/**
 * Overlay slots per metric on wind_power_canada_bg.png.
 * Each block owns every slot for that metric at its on-screen position.
 */
export const OVERLAY_LAYOUT = {
    capacity: {
        label: { left: -9, top: 4, width: 44 },
        value: { left: -9, top: 16, width: 44 },
        growthPrefix: { left: -9, top: 34, width: 44 },
        growthWord: { left: -9, top: 32, width: 44 },
        multiplier: { left: 23, top: 78, width: 12, align: 'center' },
        since: { left: 33.5, top: 80, width: 20, align: 'center' },
    },
    generation: {
        label: { left: 49, top: 6, width: 44 },
        value: { left: 49, top: 16, width: 44 },
        growthPrefix: { left: 49, top: 31.5, width: 44 },
        growthWord: { left: 49, top: 46, width: 44 },
        multiplier: { left: 82.5, top: 78, width: 12, align: 'center' },
        since: { left: 93, top: 80, width: 20, align: 'center' },
    },
    fonts: {
        label: 3.2,
        value: 4.2,
        growth: 3.2,
        multiplier: 3.8,
        since: 2.8,
    },
};

/** Split growth phrase so "tripled" can wrap onto its own positioned line. */
export const getGrowthOverlayParts = (growthKey, getText, lang) => {
    if (growthKey === 'more_than_tripled') {
        return {
            prefix: getText('wind_power_canada_growth_prefix_more_than', lang),
            word: getText('wind_power_canada_growth_tripled', lang),
        };
    }
    return {
        prefix: '',
        word: getText(`wind_power_canada_growth_${growthKey}`, lang),
    };
};

export const exportCanadianWindInfographicPng = async (figureEl, { scale = 2 }) => {
    if (!figureEl) return null;

    const wrapper = figureEl.querySelector('.wind-power-canada-infographic-wrapper');
    if (!wrapper) return null;

    const rootRect = wrapper.getBoundingClientRect();

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

    const bgImg = wrapper.querySelector('.wind-power-canada-bg-image');
    const overlayEls = [...wrapper.querySelectorAll('.wind-power-canada-overlay')];
    await waitForImage(bgImg);

    const measureEls = [bgImg, ...overlayEls].filter(Boolean);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    measureEls.forEach((el) => {
        const box = rel(el);
        minX = Math.min(minX, box.x);
        minY = Math.min(minY, box.y);
        maxX = Math.max(maxX, box.x + box.w);
        maxY = Math.max(maxY, box.y + box.h);
    });

    const pad = 12;
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;

    const canvasW = Math.max(1, Math.ceil(maxX - minX));
    const canvasH = Math.max(1, Math.ceil(maxY - minY));

    const canvas = document.createElement('canvas');
    canvas.width = canvasW * scale;
    canvas.height = canvasH * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const offsetBox = (box) => ({
        x: box.x - minX,
        y: box.y - minY,
        w: box.w,
        h: box.h,
    });

    const drawTextEl = (el) => {
        const box = offsetBox(rel(el));
        const style = window.getComputedStyle(el);
        ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        ctx.fillStyle = style.color;
        ctx.textBaseline = 'middle';
        const text = el.textContent?.trim();
        if (!text) return;

        if (el.dataset.align === 'center') {
            ctx.textAlign = 'center';
            ctx.fillText(text, box.x + box.w / 2, box.y + box.h / 2);
            return;
        }
        ctx.textAlign = 'left';
        ctx.fillText(text, box.x, box.y + box.h / 2);
    };

    if (bgImg) {
        const box = offsetBox(rel(bgImg));
        ctx.drawImage(bgImg, box.x, box.y, box.w, box.h);
    }

    overlayEls.forEach(drawTextEl);
    return canvas;
};
