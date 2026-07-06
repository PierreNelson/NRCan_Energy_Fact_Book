import React from 'react';
import { windSolarElectricityGrowthBg, NATIVE_SIZE, OVERLAY_LAYOUT, BG_IMAGE_SCALE } from './WindSolarElectricityGrowthInfographic.constants';

const slotStyle = (slot) => ({
    position: 'absolute',
    left: `${slot.left}%`,
    top: `${slot.top}%`,
    width: `${slot.width}%`,
    textAlign: slot.align || 'left',
});

const MetricOverlays = ({ metricKey, fonts, label, endValue, endYear, startValue, startYear }) => {
    const slots = OVERLAY_LAYOUT[metricKey];

    return (
        <>
            <span
                className="wind-solar-electricity-growth-overlay wind-solar-electricity-growth-label"
                data-align={slots.label.align || 'center'}
                data-metric={metricKey}
                style={{ ...slotStyle(slots.label), fontSize: `${fonts.label}cqw` }}
            >
                {label}
            </span>
            <span
                className="wind-solar-electricity-growth-overlay wind-solar-electricity-growth-value wind-solar-electricity-growth-value-end"
                data-align={slots.endValue.align || 'center'}
                data-metric={metricKey}
                style={{ ...slotStyle(slots.endValue), fontSize: `${fonts.value}cqw` }}
            >
                {endValue}
            </span>
            <span
                className="wind-solar-electricity-growth-overlay wind-solar-electricity-growth-year wind-solar-electricity-growth-year-end"
                data-align={slots.endYear.align || 'center'}
                data-metric={metricKey}
                style={{ ...slotStyle(slots.endYear), fontSize: `${fonts.year}cqw` }}
            >
                {endYear}
            </span>
            <span
                className="wind-solar-electricity-growth-overlay wind-solar-electricity-growth-value wind-solar-electricity-growth-value-start"
                data-align={slots.startValue.align || 'center'}
                data-metric={metricKey}
                style={{ ...slotStyle(slots.startValue), fontSize: `${fonts.value}cqw` }}
            >
                {startValue}
            </span>
            <span
                className="wind-solar-electricity-growth-overlay wind-solar-electricity-growth-year wind-solar-electricity-growth-year-start"
                data-align={slots.startYear.align || 'center'}
                data-metric={metricKey}
                style={{ ...slotStyle(slots.startYear), fontSize: `${fonts.year}cqw` }}
            >
                {startYear}
            </span>
        </>
    );
};

const WindSolarElectricityGrowthInfographic = ({ wind, solar, ariaLabel }) => {
    const fonts = OVERLAY_LAYOUT.fonts;

    return (
        <figure className="wind-solar-electricity-growth-infographic-figure" aria-label={ariaLabel}>
            <div
                className="wind-solar-electricity-growth-infographic-wrapper"
                style={{ aspectRatio: `${NATIVE_SIZE.width} / ${NATIVE_SIZE.height}` }}
            >
                <img
                    src={windSolarElectricityGrowthBg}
                    alt=""
                    className="wind-solar-electricity-growth-bg-image"
                    style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: `${BG_IMAGE_SCALE * 100}%`,
                        height: 'auto',
                    }}
                    draggable={false}
                />
                <MetricOverlays metricKey="wind" fonts={fonts} {...wind} />
                <MetricOverlays metricKey="solar" fonts={fonts} {...solar} />
            </div>
        </figure>
    );
};

export default WindSolarElectricityGrowthInfographic;
