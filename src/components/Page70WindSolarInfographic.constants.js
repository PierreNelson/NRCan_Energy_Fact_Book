/** wind/solar growth overlay on page70_bg.png (436×280 native). */
import page70Bg from '../assets/page70_bg.png';

export { page70Bg };

export const NATIVE_SIZE = { width: 436, height: 280 };

export const BG_IMAGE_SCALE = 1;

export const OVERLAY_LAYOUT = {
    wind: {
        label: { left: 14, top: 24, width: 22, align: 'center' },
        endValue: { left: 19, top: 55, width: 18, align: 'center' },
        endYear: { left: 32, top: 56, width: 18, align: 'center' },
        startValue: { left: 19, top: 96, width: 18, align: 'center' },
        startYear: { left: 32, top: 96.5, width: 18, align: 'center' },
    },
    solar: {
        label: { left: 62, top: 40, width: 22, align: 'center' },
        endValue: { left: 73.8, top: 68, width: 18, align: 'center' },
        endYear: { left: 87, top: 68, width: 18, align: 'center' },
        startValue: { left: 74, top: 96.5, width: 18, align: 'center' },
        startYear: { left: 87, top: 96.5, width: 18, align: 'center' },
    },
    fonts: {
        label: 5,
        value: 3.8,
        year: 3.5,
    },
};

export const exportWindSolarGrowthInfographicPng = async (figureEl, { title, scale = 2 }) => {
    if (!figureEl) return null;

    const wrapper = figureEl.querySelector?.('.page70-infographic-wrapper') ?? figureEl;
    if (!wrapper) return null;

    const rootRect = wrapper.getBoundingClientRect();
    const titleBand = title ? 72 : 0;
    const pad = 12;

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

    const bgImg = wrapper.querySelector('.page70-bg-image');
    const overlayEls = [...wrapper.querySelectorAll('.page70-overlay')];
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

    const contentW = Math.max(1, Math.ceil(maxX - minX + pad * 2));
    const contentH = Math.max(1, Math.ceil(maxY - minY + pad * 2));
    const canvasW = contentW;
    const canvasH = titleBand + contentH;

    const canvas = document.createElement('canvas');
    canvas.width = canvasW * scale;
    canvas.height = canvasH * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    if (title) {
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 22px Lato, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(title, pad, pad, canvasW - pad * 2);
    }

    const contentOffsetY = titleBand;

    const drawTextEl = (el) => {
        const box = rel(el);
        const x = box.x - minX + pad;
        const y = box.y - minY + pad + contentOffsetY;
        const style = window.getComputedStyle(el);
        ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        ctx.fillStyle = style.color;
        ctx.textBaseline = 'middle';
        const text = el.textContent?.trim();
        if (!text) return;

        if (el.dataset.align === 'center') {
            ctx.textAlign = 'center';
            ctx.fillText(text, x + box.w / 2, y + box.h / 2);
            return;
        }
        ctx.textAlign = 'left';
        ctx.fillText(text, x, y + box.h / 2);
    };

    if (bgImg) {
        const box = rel(bgImg);
        ctx.drawImage(
            bgImg,
            box.x - minX + pad,
            box.y - minY + pad + contentOffsetY,
            box.w,
            box.h,
        );
    }

    overlayEls.forEach(drawTextEl);
    return canvas;
};
