/**
 * bar + icon layout tuning (compare to page69.png / page69fr.png).
 *
 * MANUAL TUNING GUIDE
 * -------------------
 * MAP_CITY_SLOTS — one entry per city on the chart:
 *   x, y          Bar-pair centre (x) and base (y), % from left / bottom (0–100).
 *   iconX, iconY  Factory+house sprite position, % from left / bottom (0–100).
 *   leader        Optional leader line:
 *                 fromX, fromY — line start on the map (% from left / bottom)
 *                 mapX, mapY   — line end on the map (% from left / bottom)
 *
 * CHART_AXIS — Plotly bar geometry (same % scale as x above):
 *   barWidth      Width of each bar (% of chart width).
 *   barGap        Gap between industrial and residential bar (%).
 *   barHeightMax  Max bar height in y-axis units for the highest price in the dataset.
 *                 Bar height = price × (barHeightMax / maxPrice) — always proportional.
 *
 * ICON_WIDTH_SCALE — icon sprite width = BAR_PAIR_WIDTH_PCT × this (2 = double size).
 * ICON_LABEL_GAP_PCT — gap between icon bottom and city name label.
 */
import page69BgIcons from '../assets/page69_bg_1.png';
import page69BgMap from '../assets/page69_bg_2.png';

export { page69BgIcons, page69BgMap };

export const MAP_BG_LAYER = {
    justify: 'center',
    align: 'center',
    widthPct: 100,
    maxHeightPct: 100,
};

/** Native map aspect ratio (page69_bg_2.png). */
export const MAP_ASPECT_RATIO = 1492 / 1054;

export const BAR_COLORS = {
    industrial: '#709735',
    residential: '#2B5C3F',
};

export const CHART_AXIS = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    barWidth: 1.55,
    barGap: 0.28,
    /** ↓ decrease to shorten all bars (tallest price fills this many y-units). */
    barHeightMax: 17,
};

/** y-units per cent/kWh — derived from loaded data so bar heights stay proportional. */
export function getElectricityPriceToY(cities, barHeightMax = CHART_AXIS.barHeightMax) {
    const maxPrice = (cities ?? []).reduce((max, city) => {
        const peak = Math.max(Number(city?.industrial) || 0, Number(city?.residential) || 0);
        return peak > max ? peak : max;
    }, 0);
    return maxPrice > 0 ? barHeightMax / maxPrice : 0;
}

/** Width of industrial + residential bar pair as % of chart backdrop. */
export const BAR_PAIR_WIDTH_PCT = 2 * CHART_AXIS.barWidth + CHART_AXIS.barGap;

/** Icon width multiplier relative to bar-pair width (2 = double). */
export const ICON_WIDTH_SCALE = 1.5;

/** Icon slot width as % of chart backdrop. */
export const ICON_SLOT_WIDTH_PCT = BAR_PAIR_WIDTH_PCT * ICON_WIDTH_SCALE;

/** Approx. icon sprite height as % of chart backdrop — used to place city labels below icons. */
export const ICON_SPRITE_HEIGHT_PCT = 4.5 * ICON_WIDTH_SCALE;

/** Gap between icon bottom and city name label (% of chart height, top-based positioning). */
export const ICON_LABEL_GAP_PCT = 0.35;

/** Native aspect ratio of page69_bg_1.png (width / height). */
export const PAGE69_ICONS_ASPECT = 1912 / 823;

/** Bar-pair centre (x) in chart axis units (% from left). */
export function getElectricityPriceSlotBarX(slot) {
    return slot?.x ?? 50;
}

/** Bar-pair base (y) in chart axis units (% from bottom). */
export function getElectricityPriceSlotBarY(slot) {
    if (slot?.y != null) return slot.y;
    if (slot?.iconBottom != null) return slot.iconBottom;
    return 10;
}

/** Icon sprite anchor (% from left); defaults to bar x. */
export function getElectricityPriceSlotIconX(slot) {
    if (slot?.iconX != null) return slot.iconX;
    return getElectricityPriceSlotBarX(slot);
}

/** Icon sprite anchor (% from bottom); defaults to bar y. */
export function getElectricityPriceSlotIconY(slot) {
    if (slot?.iconY != null) return slot.iconY;
    if (slot?.iconBottom != null) return slot.iconBottom;
    return getElectricityPriceSlotBarY(slot);
}

/** Leader line start (% from left / bottom); defaults to bar x / y. */
export function getElectricityPriceLeaderFrom(slot) {
    const leader = slot?.leader;
    if (!leader) return null;
    return {
        x: leader.fromX ?? leader.x ?? getElectricityPriceSlotBarX(slot),
        y: leader.fromY ?? leader.y ?? getElectricityPriceSlotBarY(slot),
    };
}

/** Leader line end on map (% from left / bottom). */
export function getElectricityPriceLeaderTo(slot) {
    const leader = slot?.leader;
    if (!leader || leader.mapX == null || leader.mapY == null) return null;
    return { x: leader.mapX, y: leader.mapY };
}

/** @deprecated Use getElectricityPriceSlotIconY */
export function getElectricityPriceSlotIconBottom(slot) {
    return getElectricityPriceSlotIconY(slot);
}

const loadImage = (src) =>
    new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });

const relBox = (el, rootRect) => {
    const box = el.getBoundingClientRect();
    return {
        x: box.left - rootRect.left,
        y: box.top - rootRect.top,
        w: box.width,
        h: box.height,
    };
};

/** Composite map, leaders, Plotly chart, icons, and city labels for PNG download. */
export const exportElectricityPricesChartPng = async (wrapperEl, plotlyImgDataUrl, { scale = 2 } = {}) => {
    if (!wrapperEl || !plotlyImgDataUrl) return null;

    const rootRect = wrapperEl.getBoundingClientRect();
    const canvasW = Math.ceil(wrapperEl.clientWidth);
    const canvasH = Math.ceil(wrapperEl.clientHeight);

    const canvas = document.createElement('canvas');
    canvas.width = canvasW * scale;
    canvas.height = canvasH * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const mapImg = wrapperEl.querySelector('.page69-map-bg-image');
    if (mapImg?.complete && mapImg.naturalWidth > 0) {
        const box = relBox(mapImg, rootRect);
        ctx.drawImage(mapImg, box.x, box.y, box.w, box.h);
    }

    const leaderSvg = wrapperEl.querySelector('.page69-leader-lines');
    if (leaderSvg) {
        const svgBox = relBox(leaderSvg, rootRect);
        const svgMarkup = new XMLSerializer().serializeToString(leaderSvg);
        const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
        try {
            const svgImg = await loadImage(svgUrl);
            ctx.drawImage(svgImg, svgBox.x, svgBox.y, svgBox.w, svgBox.h);
        } catch {
            // skip leaders if SVG rasterization fails
        }
    }

    wrapperEl.querySelectorAll('.page69-city-label').forEach((el) => {
        const box = relBox(el, rootRect);
        const style = window.getComputedStyle(el);
        ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        ctx.fillStyle = style.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(el.textContent?.trim() || '', box.x + box.w / 2, box.y);
    });

    const plotImg = await loadImage(plotlyImgDataUrl);
    const plotWrap = wrapperEl.querySelector('.page69-chart-overlay');
    const plotBox = plotWrap ? relBox(plotWrap, rootRect) : relBox(wrapperEl, rootRect);
    ctx.drawImage(plotImg, plotBox.x, plotBox.y, plotBox.w, plotBox.h);

    const iconImgs = wrapperEl.querySelectorAll('.page69-city-icon');
    await Promise.all([...iconImgs].map(async (img) => {
        if (!img.complete || img.naturalWidth <= 0) {
            await new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
            });
        }
        if (img.naturalWidth > 0) {
            const box = relBox(img, rootRect);
            ctx.drawImage(img, box.x, box.y, box.w, box.h);
        }
    }));

    return canvas;
};

/**
 * City positions — edit x / y (bars), iconX / iconY (sprites), leader from/to per city.
 */
export const MAP_CITY_SLOTS = [
    { key: 'vancouver', x: 18.2, y: 46.5, iconX: 18.4, iconY: 38 },
    { key: 'calgary', x: 30.2, y: 10.5, iconX: 30.5, iconY: 5.5, leader: { fromX: 27, fromY: 3, mapX: 28, mapY: 29 } },
    { key: 'edmonton', x: 30.1, y: 42, iconX: 30.4, iconY: 34 },
    { key: 'regina', x: 37.2, y: 27.5, iconX: 37.4, iconY: 21 },
    { key: 'winnipeg', x: 44, y: 25, iconX: 44.4, iconY: 19 },
    { key: 'toronto', x: 62.3, y: 8.5, iconX: 62.2, iconY: 4 },
    { key: 'ottawa', x: 65.3, y: 35, iconX: 65.2, iconY: 28, leader: { fromX: 65, fromY: 25, mapX: 65, mapY: 14 } },
    { key: 'montreal', x: 68.3, y: 18.5, iconX: 68.2, iconY: 13 },
    { key: 'moncton', x: 88, y: 13, iconX: 87.8, iconY: 8, leader: { fromX: 84, fromY: 6, mapX: 79, mapY: 22 } },
    { key: 'halifax', x: 84, y: 51.5, iconX: 83.8, iconY: 42.5, leader: { fromX: 84, fromY: 39, mapX: 81, mapY: 21 } },
    { key: 'charlottetown', x: 72, y: 63, iconX: 72, iconY: 53.5, leader: { fromX: 72, fromY: 50, mapX: 80, mapY: 24 } },
    { key: 'st_johns', x: 92, y: 38.5, iconX: 91.8, iconY: 31 },
];
