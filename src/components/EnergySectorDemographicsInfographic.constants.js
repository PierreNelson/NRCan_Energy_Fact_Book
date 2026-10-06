export const BUBBLE_KEYS = ['women', 'indigenous', 'education', 'aging', 'diversity', 'immigrants'];

/**
 * Focus-target boxes for each speech bubble, as percentages of the graphic.
 * Measured from the pale bubble fill (tails excluded) on the EN and FR art.
 */
export const BUBBLE_BOXES = {
    en: {
        women: { left: 3.62, top: 12.48, width: 18, height: 16.69 },
        indigenous: { left: 0.56, top: 32.45, width: 23.47, height: 17.16 },
        education: { left: 24.95, top: 1.09, width: 30.98, height: 23.71 },
        aging: { left: 24.03, top: 27.15, width: 33.4, height: 23.56 },
        diversity: { left: 59.93, top: 0.31, width: 35.34, height: 24.96 },
        immigrants: { left: 58.63, top: 28.08, width: 33.67, height: 18.72 },
    },
    fr: {
        women: { left: 1.84, top: 3.9, width: 21.26, height: 25.16 },
        indigenous: { left: 0.58, top: 32.79, width: 21.74, height: 19.64 },
        education: { left: 23, top: 1.46, width: 32.95, height: 25.97 },
        aging: { left: 22.22, top: 29.22, width: 37.58, height: 21.75 },
        diversity: { left: 57, top: 1.14, width: 40.29, height: 27.92 },
        immigrants: { left: 57, top: 30.03, width: 39.42, height: 24.03 },
    },
};

/** Export title + infographic using live DOM measurements. */
export const exportDemographicsInfographicPng = async (figureEl, { title, scale = 2 }) => {
    if (!figureEl) return null;

    const exportRoot = figureEl.closest('.energy-sector-demographics-inner');
    const titleEl = exportRoot?.querySelector('#energy-sector-demographics-title');
    const img = figureEl.querySelector('img.energy-sector-demographics-bg') || figureEl.querySelector('img');
    if (!exportRoot || !titleEl || !img) return null;

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

    const waitForImage = (image) =>
        new Promise((resolve, reject) => {
            if (!image) {
                resolve(null);
                return;
            }
            if (image.complete && image.naturalWidth > 0) {
                resolve(image);
                return;
            }
            image.onload = () => resolve(image);
            image.onerror = reject;
        });

    const titleBox = rel(titleEl);
    const titleStyle = window.getComputedStyle(titleEl);
    ctx.fillStyle = titleStyle.color;
    ctx.font = `${titleStyle.fontWeight} ${titleStyle.fontSize} ${titleStyle.fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, titleBox.x, titleBox.y + titleBox.h / 2);

    const loaded = await waitForImage(img);
    if (loaded) {
        const box = rel(loaded);
        ctx.drawImage(loaded, box.x, box.y, box.w, box.h);
    }

    return canvas;
};
