import React from 'react';
import {
    ICON_LABEL_GAP_PCT,
    ICON_SLOT_WIDTH_PCT,
    getElectricityPriceLeaderFrom,
    getElectricityPriceLeaderTo,
    getElectricityPriceSlotIconX,
    getElectricityPriceSlotIconY,
    MAP_BG_LAYER,
    MAP_CITY_SLOTS,
    electricityPricesBgIcons,
    electricityPricesBgMap,
} from './ElectricityPricesMapInfographic.constants';

const mapLayerStyles = `
.electricity-prices-map-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
}
.electricity-prices-map-bg-inner {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: ${MAP_BG_LAYER.align};
    justify-content: ${MAP_BG_LAYER.justify};
    overflow: hidden;
}
.electricity-prices-map-bg-image {
    display: block;
    width: ${MAP_BG_LAYER.widthPct}%;
    height: auto;
    max-height: ${MAP_BG_LAYER.maxHeightPct}%;
    flex-shrink: 0;
}
`;

const overlayStyles = `
.electricity-prices-icon-layer,
.electricity-prices-label-layer {
    position: absolute;
    inset: 0;
    pointer-events: none !important;
    overflow: visible;
}
.electricity-prices-icon-layer { z-index: 5; }
.electricity-prices-label-layer { z-index: 3; }
.electricity-prices-icon-slot {
    position: absolute;
    transform: translate(-50%, 0);
    box-sizing: border-box;
    width: ${ICON_SLOT_WIDTH_PCT}%;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-end;
    background: transparent;
}
.electricity-prices-label-slot {
    position: absolute;
    transform: translate(-50%, 0);
    pointer-events: none;
    width: auto;
}
.electricity-prices-city-icon {
    display: block;
    width: 100%;
    height: auto;
    max-width: none;
    min-width: 0;
    background: transparent;
    pointer-events: none;
}
.electricity-prices-city-label {
    font-family: Arial, sans-serif;
    font-size: clamp(14px, 1.55cqw, 19px);
    font-weight: 700;
    color: #000000;
    text-align: center;
    white-space: nowrap;
    line-height: 1.15;
    display: block;
    pointer-events: none;
}
.electricity-prices-hover-layer {
    position: absolute;
    inset: 0;
    z-index: 10;
    pointer-events: none;
    overflow: visible;
}
.electricity-prices-hover-tip {
    position: absolute;
    z-index: 10;
    pointer-events: none;
    background: #ffffff;
    border: 1px solid #000000;
    padding: 8px 12px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: 400;
    color: #000000;
    line-height: 1.3;
    transform: translate(12px, -50%);
}
.electricity-prices-hover-tip strong {
    display: block;
    font-weight: 700;
}
.electricity-prices-hover-tip span {
    display: block;
}
.electricity-prices-leader-lines {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2;
    overflow: visible;
}
`;

export const ElectricityPricesMapMapLayer = ({ minHeight }) => (
    <div className="electricity-prices-map-layer" style={{ minHeight }} aria-hidden="true">
        <style>{mapLayerStyles}</style>
        <div className="electricity-prices-map-bg-inner">
            <img src={electricityPricesBgMap} alt="" className="electricity-prices-map-bg-image" draggable={false} />
        </div>
    </div>
);

/** Factory + house sprite on top of Plotly bars (transparent areas show bars beneath). */
export const ElectricityPricesMapIconLayer = ({ cities, minHeight }) => (
    <div className="electricity-prices-icon-layer" style={{ minHeight }} aria-hidden="true">
        <style>{overlayStyles}</style>
        {cities?.map((city) => {
            const slot = MAP_CITY_SLOTS.find((s) => s.key === city.key);
            if (!slot) return null;
            return (
                <div
                    key={city.key}
                    className="electricity-prices-icon-slot"
                    style={{
                        left: `${getElectricityPriceSlotIconX(slot)}%`,
                        bottom: `${getElectricityPriceSlotIconY(slot)}%`,
                    }}
                >
                    <img
                        src={electricityPricesBgIcons}
                        alt=""
                        className="electricity-prices-city-icon"
                        draggable={false}
                    />
                </div>
            );
        })}
    </div>
);

export const ElectricityPricesMapLeaderLines = ({ minHeight }) => {
    const lines = MAP_CITY_SLOTS.filter((slot) => slot.leader);
    if (!lines.length) return null;

    return (
        <svg className="electricity-prices-leader-lines" style={{ minHeight }} aria-hidden="true" preserveAspectRatio="none">
            <style>{overlayStyles}</style>
            {lines.map((slot) => {
                const from = getElectricityPriceLeaderFrom(slot);
                const to = getElectricityPriceLeaderTo(slot);
                if (!from || !to) return null;
                return (
                    <line
                        key={slot.key}
                        x1={`${from.x}%`}
                        y1={`${100 - from.y}%`}
                        x2={`${to.x}%`}
                        y2={`${100 - to.y}%`}
                        stroke="#000000"
                        strokeWidth="1"
                    />
                );
            })}
        </svg>
    );
};

export const ElectricityPricesMapHoverTooltip = ({ tip }) => {
    if (!tip) return null;
    return (
        <div className="electricity-prices-hover-layer" aria-hidden={false}>
            <div
                className="electricity-prices-hover-tip"
                style={{ left: tip.left, top: tip.top }}
                role="tooltip"
            >
                <strong>{tip.city}</strong>
                <span>{`${tip.category}: ${tip.priceLabel}`}</span>
                <span>{tip.date}</span>
            </div>
        </div>
    );
};

export const ElectricityPricesMapCityLabels = ({ cities, lang, minHeight }) => (
    <div className="electricity-prices-label-layer" style={{ minHeight, containerType: 'inline-size' }} aria-hidden="true">
        <style>{overlayStyles}</style>
        {cities?.map((city) => {
            const slot = MAP_CITY_SLOTS.find((s) => s.key === city.key);
            if (!slot) return null;
            const label = lang === 'fr' ? (city.labelFr || city.label) : city.label;
            const labelTop = 100 - getElectricityPriceSlotIconY(slot) + ICON_LABEL_GAP_PCT;
            return (
                <div
                    key={city.key}
                    className="electricity-prices-label-slot"
                    style={{
                        left: `${getElectricityPriceSlotIconX(slot)}%`,
                        top: `${labelTop}%`,
                    }}
                >
                    <span className="electricity-prices-city-label">{label}</span>
                </div>
            );
        })}
    </div>
);

/** @deprecated Use ElectricityPricesMapMapLayer + ElectricityPricesMapIconLayer + ElectricityPricesMapCityLabels */
export const ElectricityPricesMapCityMarkers = (props) => (
    <>
        <ElectricityPricesMapIconLayer cities={props.cities} minHeight={props.minHeight} />
        <ElectricityPricesMapCityLabels {...props} />
    </>
);

/** @deprecated Use ElectricityPricesMapMapLayer + ElectricityPricesMapIconLayer + ElectricityPricesMapCityLabels */
const ElectricityPricesMapInfographic = (props) => (
    <>
        <ElectricityPricesMapMapLayer minHeight={props.minHeight} />
        <ElectricityPricesMapLeaderLines minHeight={props.minHeight} />
        <ElectricityPricesMapIconLayer cities={props.cities} minHeight={props.minHeight} />
        <ElectricityPricesMapCityLabels {...props} />
    </>
);

export default ElectricityPricesMapInfographic;
