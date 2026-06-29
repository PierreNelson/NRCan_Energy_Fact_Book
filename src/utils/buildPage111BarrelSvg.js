import {
    BARREL_INTERIOR,
    BREAKOUT_THRESHOLD_PCT,
    LABEL_SLOT_BOTTOM_Y,
    LABEL_SLOT_TOP_Y,
    RIGHT_ANCHOR_X,
    LEADER_TRUNK_STEP_X,
    LEADER_TRUNK_X_BY_ROW,
    OTHER_SUB_KEYS,
    OVERLAY_COLORS,
    PRIMARY_PROVINCE_ORDER,
} from '../components/Page111ProvinceInfographic.constants';

/** Barrel interior right edge (constant across Y in page111_bg.svg). */
export const barrelRightEdgeX = () => BARREL_INTERIOR.rightEdge;

/** @deprecated Use barrelRightEdgeX — kept for any external callers. */
export const sideRightAtY = () => BARREL_INTERIOR.rightEdge;

/**
 * Evenly-spaced label row positions (decoupled from band height).
 * Returns slotTopPct for HTML and leaderSlotY in viewBox coordinates.
 */
export function computeLabelSlots(count) {
    if (count <= 0) return [];

    const { nativeHeight } = BARREL_INTERIOR;
    const topY = LABEL_SLOT_TOP_Y;
    const bottomY = LABEL_SLOT_BOTTOM_Y;

    if (count === 1) {
        return [{
            slotTopPct: (topY / nativeHeight) * 100,
            leaderSlotY: topY,
        }];
    }

    return Array.from({ length: count }, (_, index) => {
        const t = index / (count - 1);
        const leaderSlotY = topY + t * (bottomY - topY);
        return {
            slotTopPct: (leaderSlotY / nativeHeight) * 100,
            leaderSlotY,
        };
    });
}

function getTrunkX(rowIndex) {
    const trunkIndex = Math.max(0, rowIndex - 1);
    if (trunkIndex < LEADER_TRUNK_X_BY_ROW.length) {
        return LEADER_TRUNK_X_BY_ROW[trunkIndex];
    }
    const last = LEADER_TRUNK_X_BY_ROW[LEADER_TRUNK_X_BY_ROW.length - 1];
    return last + (trunkIndex - LEADER_TRUNK_X_BY_ROW.length + 1) * LEADER_TRUNK_STEP_X;
}

/** Residual Other share: pipeline other + sub-provinces below breakout threshold. */
export function getRolledOtherShare(provinces, options = {}) {
    const threshold = options.breakoutThresholdPct ?? BREAKOUT_THRESHOLD_PCT;
    const otherSubKeys = options.otherSubKeys ?? OTHER_SUB_KEYS;
    if (!provinces) return 0;

    const baseOther = provinces.other?.sharePct ?? 0;
    const subSum = otherSubKeys.reduce((sum, key) => {
        const share = provinces[key]?.sharePct ?? 0;
        return share < threshold ? sum + share : sum;
    }, 0);

    return Math.round((baseOther + subSum) * 10) / 10;
}

/**
 * Resolve display rows with share percentages (includes rolled-up Other).
 */
export function resolveDisplayItems(provinces, options = {}) {
    const threshold = options.breakoutThresholdPct ?? BREAKOUT_THRESHOLD_PCT;
    const primaryOrder = options.primaryOrder ?? PRIMARY_PROVINCE_ORDER;
    const otherSubKeys = options.otherSubKeys ?? OTHER_SUB_KEYS;

    if (!provinces) return [];

    const items = [];

    primaryOrder.forEach((key) => {
        const sharePct = provinces[key]?.sharePct ?? 0;
        if (sharePct > 0) {
            items.push({ key, sharePct, color: OVERLAY_COLORS[key] });
        }
    });

    otherSubKeys
        .map((key) => ({ key, sharePct: provinces[key]?.sharePct ?? 0 }))
        .filter(({ sharePct }) => sharePct >= threshold)
        .sort((a, b) => b.sharePct - a.sharePct)
        .forEach(({ key, sharePct }) => {
            items.push({ key, sharePct, color: OVERLAY_COLORS[key] });
        });

    const rolledOther = getRolledOtherShare(provinces, options);
    if (rolledOther > 0) {
        items.push({ key: 'other', sharePct: rolledOther, color: OVERLAY_COLORS.other });
    }

    return items;
}

/**
 * Resolve which provinces appear as individual barrel rows for a given year.
 */
export function resolveDisplayProvinces(provinces, options = {}) {
    return resolveDisplayItems(provinces, options).map((item) => item.key);
}

/** Keys still lumped in the residual Other bucket (for footnotes). */
export function getOtherFootnoteKeys(provinces, options = {}) {
    const threshold = options.breakoutThresholdPct ?? BREAKOUT_THRESHOLD_PCT;
    const otherSubKeys = options.otherSubKeys ?? OTHER_SUB_KEYS;
    if (!provinces) return otherSubKeys;

    return otherSubKeys.filter((key) => (provinces[key]?.sharePct ?? 0) < threshold);
}

/**
 * Leader line from band to label slot (factbook reference geometry).
 * Straight horizontal when label Y falls inside the band; elbow otherwise.
 */
export function buildLeaderPolyline(segment, rowIndex, leaderSlotY) {
    const { y, height } = segment;
    const bandMidY = y + height / 2;
    const startX = BARREL_INTERIOR.rightEdge;
    const endX = RIGHT_ANCHOR_X;
    const labelInBand = leaderSlotY >= y && leaderSlotY <= y + height;

    if (labelInBand) {
        return [
            [startX, leaderSlotY],
            [endX, leaderSlotY],
        ];
    }

    const trunkX = getTrunkX(rowIndex);
    return [
        [startX, bandMidY],
        [trunkX, bandMidY],
        [trunkX, leaderSlotY],
        [endX, leaderSlotY],
    ];
}

/**
 * Build stacked band layout for the barrel interior.
 * Band heights follow sharePct; label slots are evenly spaced by row index.
 */
export function buildPage111BarrelLayout(provinces, options = {}) {
    const shares = resolveDisplayItems(provinces, options);
    if (!shares.length) {
        return { displayKeys: [], segments: [], labels: [] };
    }

    const { top, bottom } = BARREL_INTERIOR;
    const interiorHeight = bottom - top;

    const totalShare = shares.reduce((sum, item) => sum + item.sharePct, 0);
    if (totalShare <= 0) {
        return { displayKeys: [], segments: [], labels: [] };
    }

    const slots = computeLabelSlots(shares.length);
    const displayKeys = shares.map((item) => item.key);

    let cursorY = top;
    const segments = [];
    const labels = [];

    shares.forEach(({ key, sharePct, color }, index) => {
        const height = (sharePct / totalShare) * interiorHeight;
        const slot = slots[index];

        segments.push({
            key,
            y: cursorY,
            height,
            color,
            sharePct,
        });

        labels.push({
            key,
            slotTopPct: slot.slotTopPct,
            leaderSlotY: slot.leaderSlotY,
            color,
            sharePct,
            leaderPoints: buildLeaderPolyline(
                { y: cursorY, height },
                index,
                slot.leaderSlotY,
            ),
        });

        cursorY += height;
    });

    return { displayKeys, segments, labels };
}

export { BARREL_CLIP_PATH_D } from '../components/Page111ProvinceInfographic.constants';
