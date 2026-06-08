export const SOURCE_KEYS = ['biomass', 'naturalGas', 'petroleum', 'solar', 'coal', 'other'];

export const NATIVE_SIZE = {
    en: { width: 763, height: 560 },
    fr: { width: 1022, height: 746 },
};

/**
 * Overlay calibration — all positions are % of the infographic wrapper (same as Page 55 / Page 112).
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

export const PAGE67_DATA = {
    biomass: {
        canada: 1.5,
        provinces: [
            { key: 'bc', value: 7.1 },
            { key: 'nb', value: 3.8 },
            { key: 'ns', value: 3.2 },
            { key: 'alta', value: 2.1 },
            { key: 'ont', value: 0.8 },
            { key: 'que', value: 0.7 },
            { key: 'pei', value: 0.6 },
            { key: 'man', value: 0.2 },
            { key: 'sask', value: 'lt0.2' },
            { key: 'nl', value: 'lt0.1' },
        ],
    },
    naturalGas: {
        canada: 15.4,
        provinces: [
            { key: 'alta', value: 67.1 },
            { key: 'sask', value: 47.7 },
            { key: 'ns', value: 21.3 },
            { key: 'nb', value: 15.2 },
            { key: 'nwt', value: 14.7 },
            { key: 'ont', value: 13.8 },
            { key: 'yt', value: 6.4 },
            { key: 'bc', value: 1.6 },
            { key: 'nl', value: 0.6 },
            { key: 'man', value: 0.2 },
            { key: 'que', value: 'lt0.1' },
        ],
    },
    petroleum: {
        canada: 0.9,
        provinces: [
            { key: 'nvt', value: 99.5 },
            { key: 'nwt', value: 63.5 },
            { key: 'ns', value: 8.3 },
            { key: 'nb', value: 7.2 },
            { key: 'yt', value: 5.6 },
            { key: 'nl', value: 2.0 },
            { key: 'alta', value: 1.6 },
            { key: 'bc', value: 1.0 },
            { key: 'pei', value: 0.8 },
            { key: 'que', value: 0.2 },
            { key: 'man', value: 'lt0.1' },
            { key: 'ont', value: 'lt0.1' },
            { key: 'sask', value: 'lt0.1' },
        ],
    },
    solar: {
        canada: 1.1,
        provinces: [
            { key: 'pei', value: 3.0 },
            { key: 'alta', value: 3.0 },
            { key: 'ont', value: 2.5 },
            { key: 'yt', value: 2.1 },
            { key: 'ns', value: 1.1 },
            { key: 'nvt', value: 0.5 },
            { key: 'sask', value: 0.5 },
            { key: 'nwt', value: 0.2 },
            { key: 'bc', value: 0.2 },
            { key: 'man', value: 0.2 },
            { key: 'nb', value: 'lt0.1' },
            { key: 'que', value: 'lt0.1' },
            { key: 'nl', value: 'lt0.1' },
        ],
    },
    coal: {
        canada: 3.5,
        provinces: [
            { key: 'ns', value: 40.2 },
            { key: 'sask', value: 31.7 },
            { key: 'alta', value: 10.7 },
            { key: 'nb', value: 9.3 },
        ],
    },
    other: {
        canada: 0.2,
        provinces: [
            { key: 'sask', value: 1.0 },
            { key: 'alta', value: 0.8 },
            { key: 'ont', value: 0.1 },
            { key: 'que', value: 'lt0.1' },
            { key: 'man', value: 'lt0.1' },
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

export const exportPage67InfographicPng = async (figureEl, { title, scale = 2 }) => {
    if (!figureEl) return null;

    const exportRoot = figureEl.closest('.page67-inner');
    const titleEl = exportRoot?.querySelector('#page67-infographic-title');
    const wrapper = figureEl.querySelector('.page67-infographic-wrapper');
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

    const titleBox = rel(titleEl);
    const titleStyle = window.getComputedStyle(titleEl);
    ctx.fillStyle = titleStyle.color;
    ctx.font = `${titleStyle.fontWeight} ${titleStyle.fontSize} ${titleStyle.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, titleBox.x + titleBox.w / 2, titleBox.y + titleBox.h / 2);

    const bgImg = wrapper.querySelector('.page67-bg-image');
    const bgLoaded = await waitForImage(bgImg);
    if (bgLoaded) {
        const box = rel(wrapper);
        ctx.drawImage(bgLoaded, box.x, box.y, box.w, box.h);
    }

    wrapper.querySelectorAll('.page67-overlay').forEach(drawTextEl);

    return canvas;
};
