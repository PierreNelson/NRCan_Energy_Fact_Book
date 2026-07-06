export const SOURCE_KEYS = ['biomass', 'naturalGas', 'petroleum', 'solar', 'coal', 'other'];

export const NATIVE_SIZE = {
    en: { width: 763, height: 560 },
    fr: { width: 1022, height: 746 },
};

/**
 * Overlay calibration — all positions are % of the infographic wrapper (same as GHG emissions sector and spotlight).
 *
 * HOW TO ADJUST (per column, independently of other columns)
 * - `left` / `width`              — horizontal band for province rows
 * - `canadaPctLeft` / `canadaPctTop` — position of the large Canada total (1.5%, 15.4%, …)
 * - `canadaPctAlign`               — 'left' | 'center' | 'right' (anchor for canadaPctLeft)
 * - `listTop`                      — vertical start of the first province row
 * - `provAbbrInset` / `provPctInset` — horizontal gap between province abbr and %
 * - `provRowStep` / `provRowSteps` — vertical spacing between province rows
 * - `overrides.canadaPct`          — fine-tune Canada % with `left`, `top`, `align`
 * - `overrides.provinces[n]`       — fine-tune a single province row
 *
 * Source labels (Biomass, etc.) are baked into the background — not overlaid.
 */
export const OVERLAY_LAYOUT = {
    en: {
        fonts: {
            canada: 1.5,
            prov: 1.8,
        },
        columns: [
            {
                key: 'biomass',
                left: 0,
                width: 16.5,
                canadaPctLeft: 14,
                canadaPctTop: 52,
                canadaPctAlign: 'center',
                listTop: 58,
                provAbbrInset: 1.2,
                provPctInset: 1.0,
                provRowStep: 3.2,
            },
            {
                key: 'naturalGas',
                left: 19,
                width: 16.5,
                canadaPctLeft: 31.1,
                canadaPctTop: 51.5,
                canadaPctAlign: 'center',
                listTop: 58,
                provAbbrInset: 1.2,
                provPctInset: 1.0,
                provRowStep: 3.2,
            },
            {
                key: 'petroleum',
                left: 36,
                width: 16.5,
                canadaPctLeft: 48.5,
                canadaPctTop: 52,
                canadaPctAlign: 'center',
                listTop: 58,
                provAbbrInset: 1.2,
                provPctInset: 1.0,
                provRowStep: 3.2,
            },
            {
                key: 'solar',
                left: 53,
                width: 16.5,
                canadaPctLeft: 64.5,
                canadaPctTop: 52,
                canadaPctAlign: 'center',
                listTop: 58,
                provAbbrInset: 1.2,
                provPctInset: 2,
                provRowStep: 3.2,
            },
            {
                key: 'coal',
                left: 68.0,
                width: 16.5,
                canadaPctLeft: 80.5,
                canadaPctTop: 52.7,
                canadaPctAlign: 'center',
                listTop: 58,
                provAbbrInset: 1.2,
                provPctInset: 1.0,
                provRowStep: 3.2,
            },
            {
                key: 'other',
                left: 83.7,
                width: 16.5,
                canadaPctLeft: 97,
                canadaPctTop: 57.2,
                canadaPctAlign: 'center',
                listTop: 62.5,
                provAbbrInset: 1.2,
                provPctInset: 1.0,
                provRowStep: 3.2,
            },
        ],
    },
    fr: {
        fonts: {
            canada: 1.4,
            prov: 1.8,
        },
        columns: [
            {
                key: 'biomass',
                left: 0,
                width: 16.5,
                canadaPctLeft: 14,
                canadaPctTop: 51.6,
                canadaPctAlign: 'center',
                listTop: 58,
                provAbbrInset: 1.2,
                provPctInset: -1.5,
                provRowStep: 3.2,
            },
            {
                key: 'naturalGas',
                left: 19,
                width: 16.5,
                canadaPctLeft: 32,
                canadaPctTop: 51.5,
                canadaPctAlign: 'center',
                listTop: 58,
                provAbbrInset: 1.2,
                provPctInset: -1.5,
                provRowStep: 3.2,
            },
            {
                key: 'petroleum',
                left: 36,
                width: 16.5,
                canadaPctLeft: 49.8,
                canadaPctTop: 51.8,
                canadaPctAlign: 'center',
                listTop: 58,
                provAbbrInset: 2.7,
                provPctInset: -1.6,
                provRowStep: 3.2,
            },
            {
                key: 'solar',
                left: 53,
                width: 16.5,
                canadaPctLeft: 65.7,
                canadaPctTop: 51.6,
                canadaPctAlign: 'center',
                listTop: 58,
                provAbbrInset: 2.7,
                provPctInset: 0.8,
                provRowStep: 3.2,
            },
            {
                key: 'coal',
                left: 68.0,
                width: 16.5,
                canadaPctLeft: 81.3,
                canadaPctTop: 51.5,
                canadaPctAlign: 'center',
                listTop: 58,
                provAbbrInset: 2.5,
                provPctInset: 1.0,
                provRowStep: 3.2,
            },
            {
                key: 'other',
                left: 83.7,
                width: 16.5,
                canadaPctLeft: 97,
                canadaPctTop: 59.7,
                canadaPctAlign: 'center',
                listTop: 66.5,
                provAbbrInset: 2.8,
                provPctInset: 1.0,
                provRowStep: 3.2,
            },
        ],
    },
};

const getProvinceRowTop = (column, rowIndex) => {
    const override = column.overrides?.provinces?.[rowIndex];
    if (override?.abbrTop != null) return override.abbrTop;
    if (override?.pctTop != null) return override.pctTop;
    if (override?.top != null) return override.top;

    if (Array.isArray(column.provRowSteps) && column.provRowSteps.length > 0) {
        let top = column.listTop;
        for (let i = 0; i < rowIndex; i++) {
            top += column.provRowSteps[i] ?? column.provRowStep;
        }
        return top;
    }

    return column.listTop + rowIndex * column.provRowStep;
};

export const getCanadaPctSlot = (column) => {
    const override = column.overrides?.canadaPct ?? {};
    return {
        left: override.left ?? column.canadaPctLeft,
        top: override.top ?? column.canadaPctTop,
        align: override.align ?? column.canadaPctAlign ?? 'center',
    };
};

export const getProvinceAbbrSlot = (column, rowIndex) => {
    const override = column.overrides?.provinces?.[rowIndex] ?? {};
    return {
        left: override.abbrLeft ?? override.left ?? column.left + column.provAbbrInset,
        top: override.abbrTop ?? override.top ?? getProvinceRowTop(column, rowIndex),
    };
};

export const getProvincePctSlot = (column, rowIndex) => {
    const override = column.overrides?.provinces?.[rowIndex] ?? {};
    return {
        left: override.pctLeft ?? override.left ?? column.left + column.width - column.provPctInset,
        top: override.pctTop ?? override.top ?? getProvinceRowTop(column, rowIndex),
    };
};

export const pctSortValue = (value) => {
    if (value === 'lt0.1') return 0.05;
    if (value === 'lt0.2') return 0.15;
    return Number(value);
};

export const formatSharePct = (value, lang) => {
    if (value === 'lt0.1') return lang === 'fr' ? '<0,1 %' : '<0.1%';
    if (value === 'lt0.2') return lang === 'fr' ? '<0,2 %' : '<0.2%';
    const locale = lang === 'fr' ? 'fr-CA' : 'en-CA';
    const text = Number(value).toLocaleString(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });
    return lang === 'fr' ? `${text} %` : `${text}%`;
};

export const exportProvincialGenerationInfographicPng = async (figureEl, { scale = 2 }) => {
    if (!figureEl) return null;

    const wrapper = figureEl.querySelector('.provincial-electricity-generation-infographic-wrapper');
    const titleEl = wrapper?.querySelector('#provincial-electricity-generation-infographic-title');
    if (!wrapper) return null;

    const rootRect = figureEl.getBoundingClientRect();
    const canvasW = Math.ceil(figureEl.clientWidth);
    const canvasH = Math.ceil(figureEl.clientHeight);

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

    const drawTextEl = (el) => {
        const box = rel(el);
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

        if (el.dataset.align === 'right') {
            ctx.textAlign = 'right';
            ctx.fillText(text, box.x + box.w, box.y + box.h / 2);
            return;
        }

        ctx.textAlign = 'left';
        ctx.fillText(text, box.x, box.y + box.h / 2);
    };

    const drawTitleEl = (el) => {
        const box = rel(el);
        const style = window.getComputedStyle(el);
        ctx.fillStyle = style.color;
        ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(el.textContent?.trim() || '', box.x + box.w / 2, box.y);
    };

    const bgImg = wrapper.querySelector('.provincial-electricity-generation-bg-image');
    const bgLoaded = await waitForImage(bgImg);
    if (bgLoaded) {
        const box = rel(wrapper);
        ctx.drawImage(bgLoaded, box.x, box.y, box.w, box.h);
    }

    if (titleEl) drawTitleEl(titleEl);
    wrapper.querySelectorAll('.provincial-electricity-generation-overlay').forEach(drawTextEl);

    return canvas;
};
