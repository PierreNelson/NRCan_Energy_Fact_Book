import React from 'react';
import windPowerCanadaBg from '../assets/wind_power_canada_bg.png';
import { NATIVE_SIZE, OVERLAY_LAYOUT, BG_IMAGE_SCALE } from './CanadianWindPowerInfographic.constants';

const slotStyle = (slot) => ({
    position: 'absolute',
    left: `${slot.left}%`,
    top: `${slot.top}%`,
    width: `${slot.width}%`,
    textAlign: slot.align || 'left',
});

const GrowthOverlay = ({ growthPrefix, growthWord, growthPrefixSlot, growthWordSlot, fonts, metricKey }) => {
    const growthFont = `${fonts.growth}cqw`;
    if (growthPrefix) {
        return (
            <>
                <span
                    className="wind-power-canada-overlay wind-power-canada-growth wind-power-canada-growth-prefix"
                    data-align="left"
                    data-metric={metricKey}
                    style={{ ...slotStyle(growthPrefixSlot), fontSize: growthFont }}
                >
                    {growthPrefix}
                </span>
                <span
                    className="wind-power-canada-overlay wind-power-canada-growth wind-power-canada-growth-word"
                    data-align="left"
                    data-metric={metricKey}
                    style={{ ...slotStyle(growthWordSlot), fontSize: growthFont }}
                >
                    {growthWord}
                </span>
            </>
        );
    }
    return (
        <span
            className="wind-power-canada-overlay wind-power-canada-growth wind-power-canada-growth-word"
            data-align="left"
            data-metric={metricKey}
            style={{ ...slotStyle(growthWordSlot), fontSize: growthFont }}
        >
            {growthWord}
        </span>
    );
};

/** All slots for one metric come from OVERLAY_LAYOUT[metricKey] only. */
const MetricOverlays = ({ metricKey, fonts, label, value, growthPrefix, growthWord, mult, since }) => {
    const slots = OVERLAY_LAYOUT[metricKey];

    return (
        <>
            <span
                className="wind-power-canada-overlay wind-power-canada-label"
                data-align="left"
                data-metric={metricKey}
                style={{ ...slotStyle(slots.label), fontSize: `${fonts.label}cqw` }}
            >
                {label}
            </span>
            <span
                className="wind-power-canada-overlay wind-power-canada-value wind-power-canada-value-green"
                data-align="left"
                data-metric={metricKey}
                style={{ ...slotStyle(slots.value), fontSize: `${fonts.value}cqw` }}
            >
                {value}
            </span>
            <GrowthOverlay
                metricKey={metricKey}
                fonts={fonts}
                growthPrefix={growthPrefix}
                growthWord={growthWord}
                growthPrefixSlot={slots.growthPrefix}
                growthWordSlot={slots.growthWord}
            />
            <span
                className="wind-power-canada-overlay wind-power-canada-mult"
                data-align={slots.multiplier.align}
                data-metric={metricKey}
                style={{ ...slotStyle(slots.multiplier), fontSize: `${fonts.multiplier}cqw` }}
            >
                {mult}
            </span>
            <span
                className="wind-power-canada-overlay wind-power-canada-since"
                data-align={slots.since.align}
                data-metric={metricKey}
                style={{ ...slotStyle(slots.since), fontSize: `${fonts.since}cqw` }}
            >
                {since}
            </span>
        </>
    );
};

const CanadianWindPowerInfographic = ({ capacity, generation, ariaLabel }) => {
    const fonts = OVERLAY_LAYOUT.fonts;

    return (
        <figure className="wind-power-canada-infographic-figure" aria-label={ariaLabel}>
            <div
                className="wind-power-canada-infographic-wrapper"
                style={{ aspectRatio: `${NATIVE_SIZE.width} / ${NATIVE_SIZE.height}` }}
            >
                <img
                    src={windPowerCanadaBg}
                    alt=""
                    className="wind-power-canada-bg-image"
                    style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: `${BG_IMAGE_SCALE * 100}%`,
                        height: 'auto',
                    }}
                />

                <MetricOverlays metricKey="capacity" fonts={fonts} {...capacity} />
                <MetricOverlays metricKey="generation" fonts={fonts} {...generation} />
            </div>
        </figure>
    );
};

export default CanadianWindPowerInfographic;
