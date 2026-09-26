export const BUBBLE_KEYS = ['women', 'indigenous', 'education', 'aging', 'diversity', 'immigrants'];

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
