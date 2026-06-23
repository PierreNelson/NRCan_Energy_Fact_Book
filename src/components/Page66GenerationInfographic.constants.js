/** Must match actual page66_bg.png / page66_bg_fr.png pixel dimensions (aspect ~763:560, same as page 67). */
export const NATIVE_SIZE = {
    en: { width: 1464, height: 1075 },
    fr: { width: 1464, height: 1075 },
};

/** Province rows per source — order and membership match Energy Fact Book p. 66. */
export const PAGE66_PROVINCE_ORDER = {
    hydro: ['nl', 'man', 'que', 'bc', 'yt', 'ont', 'nb', 'nwt', 'sask', 'ns', 'alta'],
    nuclear: ['ont', 'nb'],
    wind: ['pei', 'ns', 'alta', 'ont', 'nb', 'sask', 'que', 'man', 'bc', 'nwt', 'yt', 'nl'],
};

export const getPage66ProvinceRows = (sourceKey, block) => {
    const order = PAGE66_PROVINCE_ORDER[sourceKey] || [];
    if (!block?.provinces?.length) return [];
    const byKey = Object.fromEntries(block.provinces.map((row) => [row.key, row]));
    return order.map((key) => byKey[key]).filter(Boolean);
};

export const OVERLAY_LAYOUT = {
    en: {
        fonts: {
            canada: 2.5,
            prov: 1.8,
        },
        columns: [
            {
                key: 'hydro',
                left: 0,
                width: 33.3,
                canadaPctLeft: 26.5,
                canadaPctTop: 52,
                canadaPctAlign: 'center',
                listTop: 62,
                provAbbrInset: 3.5,
                provPctInset: 2.5,
                provRowStep: 3.2,
            },
            {
                key: 'nuclear',
                left: 33.3,
                width: 33.3,
                canadaPctLeft: 58,
                canadaPctTop: 52.8,
                canadaPctAlign: 'center',
                listTop: 62,
                provAbbrInset: 3.5,
                provPctInset: 2.5,
                provRowStep: 3.2,
            },
            {
                key: 'wind',
                left: 66.6,
                width: 33.3,
                canadaPctLeft: 90.8,
                canadaPctTop: 52.8,
                canadaPctAlign: 'center',
                listTop: 62,
                provAbbrInset: 3.5,
                provPctInset: 2.5,
                provRowStep: 3.05,
            },
        ],
    },
    fr: {
        fonts: {
            canada: 2.5,
            prov: 1.8,
        },
        columns: [
            {
                key: 'hydro',
                left: 0,
                width: 33.3,
                canadaPctLeft: 27,
                canadaPctTop: 54,
                canadaPctAlign: 'center',
                listTop: 65,
                provAbbrInset: 3.5,
                provPctInset: 2.5,
                provRowStep: 3.2,
            },
            {
                key: 'nuclear',
                left: 33.3,
                width: 33.3,
                canadaPctLeft: 59,
                canadaPctTop: 55,
                canadaPctAlign: 'center',
                listTop: 65,
                provAbbrInset: 3.5,
                provPctInset: 2.5,
                provRowStep: 3.2,
            },
            {
                key: 'wind',
                left: 66.6,
                width: 33.3,
                canadaPctLeft: 91.5,
                canadaPctTop: 55,
                canadaPctAlign: 'center',
                listTop: 64.5,
                provAbbrInset: 3.5,
                provPctInset: 2.5,
                provRowStep: 3.05,
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

export const getColumnSourceSlot = (column) => {
    const override = column.overrides?.sourceTitle ?? {};
    return {
        left: override.left ?? column.sourceTitleLeft,
        top: override.top ?? column.sourceTitleTop,
        align: override.align ?? column.sourceTitleAlign ?? 'center',
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

export const exportPage66InfographicPng = async (figureEl, { scale = 2 }) => {
    if (!figureEl) return null;

    const wrapper = figureEl.querySelector('.page66-infographic-wrapper');
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

    const bgImg = wrapper.querySelector('.page66-bg-image');
    const bgLoaded = await waitForImage(bgImg);
    if (bgLoaded) {
        const box = rel(wrapper);
        ctx.drawImage(bgLoaded, box.x, box.y, box.w, box.h);
    }

    wrapper.querySelectorAll('.page66-overlay').forEach(drawTextEl);

    return canvas;
};
