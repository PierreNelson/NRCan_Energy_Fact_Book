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
    page69BgIcons,
    page69BgMap,
} from './Page69ElectricityInfographic.constants';

const mapLayerStyles = `
.page69-map-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
}
.page69-map-bg-inner {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: ${MAP_BG_LAYER.align};
    justify-content: ${MAP_BG_LAYER.justify};
    overflow: hidden;
}
.page69-map-bg-image {
    display: block;
    width: ${MAP_BG_LAYER.widthPct}%;
    height: auto;
    max-height: ${MAP_BG_LAYER.maxHeightPct}%;
    flex-shrink: 0;
}
`;

const overlayStyles = `
.page69-icon-layer,
.page69-label-layer {
    position: absolute;
    inset: 0;
    pointer-events: none !important;
    overflow: visible;
}
.page69-icon-layer { z-index: 5; }
.page69-label-layer { z-index: 3; }
.page69-icon-slot {
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
.page69-label-slot {
    position: absolute;
    transform: translate(-50%, 0);
    pointer-events: none;
    width: auto;
}
.page69-city-icon {
    display: block;
    width: 100%;
    height: auto;
    max-width: none;
    min-width: 0;
    background: transparent;
    pointer-events: none;
}
.page69-city-label {
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
.page69-hover-layer {
    position: absolute;
    inset: 0;
    z-index: 10;
    pointer-events: none;
    overflow: visible;
}
.page69-hover-tip {
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
.page69-hover-tip strong {
    display: block;
    font-weight: 700;
}
.page69-hover-tip span {
    display: block;
}
.page69-leader-lines {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2;
    overflow: visible;
}
`;

export const Page69MapLayer = ({ minHeight }) => (
    <div className="page69-map-layer" style={{ minHeight }} aria-hidden="true">
        <style>{mapLayerStyles}</style>
        <div className="page69-map-bg-inner">
            <img src={page69BgMap} alt="" className="page69-map-bg-image" draggable={false} />
        </div>
    </div>
);

/** Factory + house sprite on top of Plotly bars (transparent areas show bars beneath). */
export const Page69IconLayer = ({ cities, minHeight }) => (
    <div className="page69-icon-layer" style={{ minHeight }} aria-hidden="true">
        <style>{overlayStyles}</style>
        {cities?.map((city) => {
            const slot = MAP_CITY_SLOTS.find((s) => s.key === city.key);
            if (!slot) return null;
            return (
                <div
                    key={city.key}
                    className="page69-icon-slot"
                    style={{
                        left: `${getElectricityPriceSlotIconX(slot)}%`,
                        bottom: `${getElectricityPriceSlotIconY(slot)}%`,
                    }}
                >
                    <img
                        src={page69BgIcons}
                        alt=""
                        className="page69-city-icon"
                        draggable={false}
                    />
                </div>
            );
        })}
    </div>
);

export const Page69LeaderLines = ({ minHeight }) => {
    const lines = MAP_CITY_SLOTS.filter((slot) => slot.leader);
    if (!lines.length) return null;

    return (
        <svg className="page69-leader-lines" style={{ minHeight }} aria-hidden="true" preserveAspectRatio="none">
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

export const Page69HoverTooltip = ({ tip }) => {
    if (!tip) return null;
    return (
        <div className="page69-hover-layer" aria-hidden={false}>
            <div
                className="page69-hover-tip"
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

export const Page69CityLabels = ({ cities, lang, minHeight }) => (
    <div className="page69-label-layer" style={{ minHeight, containerType: 'inline-size' }} aria-hidden="true">
        <style>{overlayStyles}</style>
        {cities?.map((city) => {
            const slot = MAP_CITY_SLOTS.find((s) => s.key === city.key);
            if (!slot) return null;
            const label = lang === 'fr' ? (city.labelFr || city.label) : city.label;
            const labelTop = 100 - getElectricityPriceSlotIconY(slot) + ICON_LABEL_GAP_PCT;
            return (
                <div
                    key={city.key}
                    className="page69-label-slot"
                    style={{
                        left: `${getElectricityPriceSlotIconX(slot)}%`,
                        top: `${labelTop}%`,
                    }}
                >
                    <span className="page69-city-label">{label}</span>
                </div>
            );
        })}
    </div>
);

/** @deprecated Use Page69MapLayer + Page69IconLayer + Page69CityLabels */
export const Page69CityMarkers = (props) => (
    <>
        <Page69IconLayer cities={props.cities} minHeight={props.minHeight} />
        <Page69CityLabels {...props} />
    </>
);

/** @deprecated Use Page69MapLayer + Page69IconLayer + Page69CityLabels */
const Page69ElectricityInfographic = (props) => (
    <>
        <Page69MapLayer minHeight={props.minHeight} />
        <Page69LeaderLines minHeight={props.minHeight} />
        <Page69IconLayer cities={props.cities} minHeight={props.minHeight} />
        <Page69CityLabels {...props} />
    </>
);

export default Page69ElectricityInfographic;
