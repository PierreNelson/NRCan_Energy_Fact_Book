import React from 'react';
import page80Bg from '../assets/page80_bg.png';
import { NATIVE_SIZE, OVERLAY_LAYOUT, BG_IMAGE_SCALE } from './Page80WindInfographic.constants';

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
                    className="page80-overlay page80-growth page80-growth-prefix"
                    data-align="left"
                    data-metric={metricKey}
                    style={{ ...slotStyle(growthPrefixSlot), fontSize: growthFont }}
                >
                    {growthPrefix}
                </span>
                <span
                    className="page80-overlay page80-growth page80-growth-word"
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
            className="page80-overlay page80-growth page80-growth-word"
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
                className="page80-overlay page80-label"
                data-align="left"
                data-metric={metricKey}
                style={{ ...slotStyle(slots.label), fontSize: `${fonts.label}cqw` }}
            >
                {label}
            </span>
            <span
                className="page80-overlay page80-value page80-value-green"
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
                className="page80-overlay page80-mult"
                data-align={slots.multiplier.align}
                data-metric={metricKey}
                style={{ ...slotStyle(slots.multiplier), fontSize: `${fonts.multiplier}cqw` }}
            >
                {mult}
            </span>
            <span
                className="page80-overlay page80-since"
                data-align={slots.since.align}
                data-metric={metricKey}
                style={{ ...slotStyle(slots.since), fontSize: `${fonts.since}cqw` }}
            >
                {since}
            </span>
        </>
    );
};

const Page80WindInfographic = ({ capacity, generation, ariaLabel }) => {
    const fonts = OVERLAY_LAYOUT.fonts;

    return (
        <figure className="page80-infographic-figure" aria-label={ariaLabel}>
            <div
                className="page80-infographic-wrapper"
                style={{ aspectRatio: `${NATIVE_SIZE.width} / ${NATIVE_SIZE.height}` }}
            >
                <img
                    src={page80Bg}
                    alt=""
                    className="page80-bg-image"
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

export default Page80WindInfographic;
