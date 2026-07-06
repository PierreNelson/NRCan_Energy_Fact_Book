/** Native pixel dimensions of the province infographic background. */
export const NATIVE_SIZE = { width: 331, height: 260 };

/** Transparent padding measured from source artwork (fraction of native width). */
export const IMAGE_TRIM = { left: 21 / 331, right: 10 / 331 };

export const PRIMARY_PROVINCE_ORDER = ['ab', 'sk', 'nl', 'mb', 'bc'];
export const OTHER_SUB_KEYS = ['ns', 'on', 'nt'];
export const ALL_PROVINCE_KEYS = [...PRIMARY_PROVINCE_ORDER, ...OTHER_SUB_KEYS, 'other'];

/** Fixed table/export column order (all possible keys). */
export const PROVINCE_ORDER = ALL_PROVINCE_KEYS;

export const BREAKOUT_THRESHOLD_PCT = 0.2;

/** Label row Y anchors in viewBox coordinates (from canadian_production_bg.svg reference artwork). */
export const LABEL_SLOT_TOP_Y = 79;
export const LABEL_SLOT_BOTTOM_Y = 247;

/** Barrel interior geometry in viewBox coordinates (from canadian_production_bg.svg). */
export const BARREL_INTERIOR = Object.freeze({
    nativeHeight: NATIVE_SIZE.height,
    top: 25,
    bottom: 246,
    leftEdge: 26,
    rightEdge: 160,
    frontLeft: 49,
    frontRight: 87,
});

/** Leader line geometry in viewBox coordinates. */
/** Right edge of visible artwork (trimmed transparent padding). */
export const RIGHT_ANCHOR_X = NATIVE_SIZE.width - Math.round(IMAGE_TRIM.right * NATIVE_SIZE.width);
/** Trunk X for elbow leaders (rows 1–5 in the 2025 reference). */
export const LEADER_TRUNK_X_BY_ROW = [166, 178, 190, 202, 214];
export const LEADER_TRUNK_STEP_X = 12;

export const labelLeftPct = (x) => (x / NATIVE_SIZE.width) * 100;
export const labelRightInsetPct = ((NATIVE_SIZE.width - RIGHT_ANCHOR_X) / NATIVE_SIZE.width) * 100;

/** Label corridor begins at the barrel interior right edge. */
export const BARREL_RIGHT_PCT = (BARREL_INTERIOR.rightEdge / NATIVE_SIZE.width) * 100;

export const getImageTrimStyles = () => {
    const trim = IMAGE_TRIM;
    const contentWidthFrac = 1 - trim.left - trim.right;
    const contentWidth = NATIVE_SIZE.width * contentWidthFrac;
    return {
        contentWidthFrac,
        contentWidth,
        artWidth: `${(100 / contentWidthFrac).toFixed(4)}%`,
        artLeft: `${((-trim.left / contentWidthFrac) * 100).toFixed(4)}%`,
        aspectRatio: `${contentWidth} / ${NATIVE_SIZE.height}`,
    };
};

export const OVERLAY_COLORS = {
    ab: '#3B95C9',
    sk: '#6B8FA3',
    nl: '#4A6670',
    mb: '#7A8440',
    bc: '#809636',
    ns: '#5C7A8A',
    on: '#6B7280',
    nt: '#4B5563',
    other: '#2A3542',
};

/** White mask over baked leader-line pixels (right of barrel interior). */
export const LEADER_CORRIDOR_MASK = {
    x: 159,
    y: 20,
    width: NATIVE_SIZE.width - 159,
    height: NATIVE_SIZE.height - 20,
};

/** SVG clip path for barrel interior (rectangle x=26–160). */
export const BARREL_CLIP_PATH_D = (() => {
    const { top, bottom, leftEdge, rightEdge } = BARREL_INTERIOR;
    return [
        `M ${leftEdge} ${top}`,
        `L ${rightEdge} ${top}`,
        `L ${rightEdge} ${bottom}`,
        `L ${leftEdge} ${bottom}`,
        'Z',
    ].join(' ');
})();

/** Rasterize the live infographic DOM (SVG + overlay label rows) to canvas. */
export const exportCanadianProductionInfographicPng = async (figureEl, { scale = 2 } = {}) => {
    if (!figureEl) return null;

    const wrapper = figureEl.querySelector('.canadian-crude-production-infographic-wrapper');
    if (!wrapper) return null;

    const artEl = wrapper.querySelector('.canadian-crude-production-infographic-art') ?? wrapper;

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

    const svgEl = artEl.querySelector('.canadian-crude-production-barrel-svg');
    if (svgEl) {
        const box = rel(wrapper);
        const svgData = new XMLSerializer().serializeToString(svgEl);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
        ctx.drawImage(img, box.x, box.y, box.w, box.h);
        URL.revokeObjectURL(url);
    }

    const drawLabelRow = (rowEl) => {
        const rowBox = rel(rowEl);
        const lineY = rowBox.y + rowBox.h;

        const pctEl = rowEl.querySelector('.canadian-crude-production-label-pct');
        if (pctEl) {
            const pctBox = rel(pctEl);
            const style = window.getComputedStyle(pctEl);
            ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
            ctx.fillStyle = style.color;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(pctEl.textContent?.trim() ?? '', pctBox.x + pctBox.w, lineY - 1);
        }

        const dotEl = rowEl.querySelector('.canadian-crude-production-label-dot');
        if (dotEl) {
            const dotBox = rel(dotEl);
            const style = window.getComputedStyle(dotEl);
            const radius = dotBox.w / 2;
            ctx.beginPath();
            ctx.arc(dotBox.x + radius, lineY - radius - 1, radius, 0, Math.PI * 2);
            ctx.fillStyle = style.backgroundColor;
            ctx.fill();
        }

        const nameEl = rowEl.querySelector('.canadian-crude-production-label-name');
        if (nameEl) {
            const nameBox = rel(nameEl);
            const style = window.getComputedStyle(nameEl);
            ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
            ctx.fillStyle = style.color;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            const text = nameEl.textContent?.trim() ?? '';
            const words = text.split(/\s+/);
            const lineHeight = parseFloat(style.fontSize) * 1.15;
            const lines = [];
            let current = words[0] ?? '';
            for (let i = 1; i < words.length; i += 1) {
                const next = `${current} ${words[i]}`;
                if (ctx.measureText(next).width <= nameBox.w) {
                    current = next;
                } else {
                    lines.push(current);
                    current = words[i];
                }
            }
            if (current) lines.push(current);
            let lineBaseY = lineY - 1;
            lines.forEach((line) => {
                ctx.fillText(line, nameBox.x, lineBaseY);
                lineBaseY -= lineHeight;
            });
        }
    };

    figureEl.querySelectorAll('.canadian-crude-production-label-row').forEach(drawLabelRow);

    return canvas;
};
