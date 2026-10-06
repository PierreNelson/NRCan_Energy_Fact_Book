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

const speakMetric = (metric, lang) => {
    if (!metric) return '';
    const unit = lang === 'fr' ? 'gigawattheures' : 'gigawatt hours';
    const end = `${metric.endValue} ${unit}, ${metric.endYear}`;
    const start = `${metric.startValue} ${unit}, ${metric.startYear}`;
    return `${metric.label}. ${end}. ${start}.`;
};

const COLUMNS = [
    { key: 'wind', left: 0, width: 50 },
    { key: 'solar', left: 50, width: 50 },
];

const WindSolarElectricityGrowthInfographic = ({ wind, solar, lang = 'en' }) => {
    const fonts = OVERLAY_LAYOUT.fonts;
    const metrics = { wind, solar };

    return (
        <figure className="wind-solar-electricity-growth-infographic-figure">
            <div
                className="wind-solar-electricity-growth-infographic-wrapper"
                style={{ aspectRatio: `${NATIVE_SIZE.width} / ${NATIVE_SIZE.height}` }}
            >
                <img
                    src={windSolarElectricityGrowthBg}
                    alt=""
                    className="wind-solar-electricity-growth-bg-image"
                    draggable={false}
                    aria-hidden="true"
                    style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: `${BG_IMAGE_SCALE * 100}%`,
                        height: 'auto',
                    }}
                />
                {COLUMNS.map((column) => (
                    <div
                        key={column.key}
                        className="wind-solar-electricity-growth-column-stop"
                        style={{ left: `${column.left}%`, width: `${column.width}%` }}
                        tabIndex={0}
                        data-prose-tab="1"
                        role="group"
                        aria-label={speakMetric(metrics[column.key], lang)}
                    />
                ))}
                <div aria-hidden="true">
                    <MetricOverlays metricKey="wind" fonts={fonts} {...wind} />
                    <MetricOverlays metricKey="solar" fonts={fonts} {...solar} />
                </div>
            </div>
        </figure>
    );
};

export default WindSolarElectricityGrowthInfographic;
