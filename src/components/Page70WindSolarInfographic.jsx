import React from 'react';
import { page70Bg, NATIVE_SIZE, OVERLAY_LAYOUT, BG_IMAGE_SCALE } from './Page70WindSolarInfographic.constants';

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
                className="page70-overlay page70-label"
                data-align={slots.label.align || 'center'}
                data-metric={metricKey}
                style={{ ...slotStyle(slots.label), fontSize: `${fonts.label}cqw` }}
            >
                {label}
            </span>
            <span
                className="page70-overlay page70-value page70-value-end"
                data-align={slots.endValue.align || 'center'}
                data-metric={metricKey}
                style={{ ...slotStyle(slots.endValue), fontSize: `${fonts.value}cqw` }}
            >
                {endValue}
            </span>
            <span
                className="page70-overlay page70-year page70-year-end"
                data-align={slots.endYear.align || 'center'}
                data-metric={metricKey}
                style={{ ...slotStyle(slots.endYear), fontSize: `${fonts.year}cqw` }}
            >
                {endYear}
            </span>
            <span
                className="page70-overlay page70-value page70-value-start"
                data-align={slots.startValue.align || 'center'}
                data-metric={metricKey}
                style={{ ...slotStyle(slots.startValue), fontSize: `${fonts.value}cqw` }}
            >
                {startValue}
            </span>
            <span
                className="page70-overlay page70-year page70-year-start"
                data-align={slots.startYear.align || 'center'}
                data-metric={metricKey}
                style={{ ...slotStyle(slots.startYear), fontSize: `${fonts.year}cqw` }}
            >
                {startYear}
            </span>
        </>
    );
};

const Page70WindSolarInfographic = ({ wind, solar, ariaLabel }) => {
    const fonts = OVERLAY_LAYOUT.fonts;

    return (
        <figure className="page70-infographic-figure" aria-label={ariaLabel}>
            <div
                className="page70-infographic-wrapper"
                style={{ aspectRatio: `${NATIVE_SIZE.width} / ${NATIVE_SIZE.height}` }}
            >
                <img
                    src={page70Bg}
                    alt=""
                    className="page70-bg-image"
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

export default Page70WindSolarInfographic;
