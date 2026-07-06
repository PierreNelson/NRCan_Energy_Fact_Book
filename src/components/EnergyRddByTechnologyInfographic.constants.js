export const COLUMN_KEYS = ['federal', 'provincial', 'industry'];
export const ROW_KEYS = ['hydrocarbons', 'renewable', 'endUse'];
export const FN_PREFIX = 'energy-rdd-by-technology';

export const INFOGRAPHIC_DATA = {
    hydrocarbons: { federal: 138, provincial: 57, industry: 998 },
    renewable: { federal: 576, provincial: 138, industry: 803 },
    endUse: { federal: 751, provincial: 201, industry: 896 },
    total: { federal: 1464, provincial: 396, industry: 2697 },
};

export const BG1_SIZE = { width: 550, height: 109 };
export const BG2_SIZE = { width: 76, height: 232 };

/** Export infographic + title to canvas using live DOM measurements (matches on-screen layout). */
export const exportRddInfographicPng = async (figureEl, { title, scale = 2 }) => {
    if (!figureEl) return null;

    const exportRoot = figureEl.closest('.energy-rdd-by-technology-inner');
    const titleEl = exportRoot?.querySelector('#energy-rdd-by-technology-title');
    const grid = figureEl.querySelector('.energy-rdd-by-technology-infographic-grid');
    if (!exportRoot || !titleEl || !grid) return null;

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

    const getLabelTextWithoutFootnotes = (el) =>
        Array.from(el.childNodes)
            .map((node) => {
                if (node.nodeType === Node.TEXT_NODE) return node.textContent;
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.classList?.contains('fn-lnk') || node.querySelector?.('.fn-lnk')) return '';
                }
                return '';
            })
            .join('')
            .replace(/\s+/g, ' ')
            .trim();

    const drawTextBlock = (el) => {
        const box = rel(el);
        const style = window.getComputedStyle(el);
        ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        ctx.fillStyle = style.color;
        ctx.textBaseline = 'middle';

        const isCentered = style.textAlign === 'center' || el.classList.contains('energy-rdd-by-technology-col-label');
        ctx.textAlign = isCentered ? 'center' : 'left';

        const labelText = el.classList.contains('energy-rdd-by-technology-cell-value')
            ? el.textContent.trim()
            : getLabelTextWithoutFootnotes(el);

        if (!labelText) return;

        const x = isCentered ? box.x + box.w / 2 : box.x;
        ctx.fillText(labelText, x, box.y + box.h / 2);
    };

    const titleBox = rel(titleEl);
    const titleStyle = window.getComputedStyle(titleEl);
    ctx.fillStyle = titleStyle.color;
    ctx.font = `${titleStyle.fontWeight} ${titleStyle.fontSize} ${titleStyle.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, titleBox.x + titleBox.w / 2, titleBox.y + titleBox.h / 2);

    const bg1 = grid.querySelector('.energy-rdd-by-technology-bg1-img');
    const bg2 = grid.querySelector('.energy-rdd-by-technology-bg2-img');
    const bg1Loaded = await waitForImage(bg1);
    const bg2Loaded = await waitForImage(bg2);

    if (bg1Loaded) {
        const box = rel(bg1Loaded);
        ctx.drawImage(bg1Loaded, box.x, box.y, box.w, box.h);
    }
    if (bg2Loaded) {
        const box = rel(bg2Loaded);
        ctx.drawImage(bg2Loaded, box.x, box.y, box.w, box.h);
    }

    grid.querySelectorAll('.energy-rdd-by-technology-col-label').forEach(drawTextBlock);
    grid.querySelectorAll('.energy-rdd-by-technology-row-label').forEach(drawTextBlock);
    grid.querySelectorAll('.energy-rdd-by-technology-cell-value').forEach(drawTextBlock);

    return canvas;
};
