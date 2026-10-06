import React, { useLayoutEffect, useRef } from 'react';
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

const speakMetric = (metric, lang = 'en') => {
    if (!metric) return '';
    const expandUnits = (text) => String(text)
        .replace(/\bGWh\b/g, lang === 'fr' ? 'gigawattheures' : 'gigawatt hours')
        .replace(/\bTWh\b/g, lang === 'fr' ? 'térawattheures' : 'terawatt hours')
        .replace(/\bGW\b/g, 'gigawatts')
        .replace(/\bMW\b/g, lang === 'fr' ? 'mégawatts' : 'megawatts');
    const parts = [metric.label, metric.value, metric.growthPrefix, metric.growthWord, metric.since]
        .map((part) => expandUnits(String(part ?? '').trim()))
        .filter(Boolean);
    return parts.length ? `${parts.join(', ')}.` : '';
};

const COLUMNS = [
    { key: 'capacity', left: 0, width: 50 },
    { key: 'generation', left: 50, width: 50 },
];

const textBounds = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
    if (!rects.length) return el.getBoundingClientRect();
    return {
        left: Math.min(...rects.map((rect) => rect.left)),
        top: Math.min(...rects.map((rect) => rect.top)),
        right: Math.max(...rects.map((rect) => rect.right)),
        bottom: Math.max(...rects.map((rect) => rect.bottom)),
    };
};

const CanadianWindPowerInfographic = ({ capacity, generation, lang = 'en' }) => {
    const fonts = OVERLAY_LAYOUT.fonts;
    const metrics = { capacity, generation };
    const wrapperRef = useRef(null);
    const stopRefs = useRef({});

    useLayoutEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return undefined;

        const positionStops = () => {
            const root = wrapper.getBoundingClientRect();
            if (!root.width || !root.height) return;

            COLUMNS.forEach((column) => {
                const stop = stopRefs.current[column.key];
                if (!stop) return;

                const nodes = wrapper.querySelectorAll(`[data-metric="${column.key}"]`);
                let minL = root.left + (column.left / 100) * root.width;
                let minT = root.top;
                let maxR = minL + (column.width / 100) * root.width;
                let maxB = root.bottom;

                nodes.forEach((node) => {
                    const box = textBounds(node);
                    minL = Math.min(minL, box.left);
                    minT = Math.min(minT, box.top);
                    maxR = Math.max(maxR, box.right);
                    maxB = Math.max(maxB, box.bottom);
                });

                const pad = 10;
                stop.style.left = `${minL - root.left - pad}px`;
                stop.style.top = `${minT - root.top - pad}px`;
                stop.style.width = `${maxR - minL + pad * 2}px`;
                stop.style.height = `${maxB - minT + pad * 2}px`;
            });
        };

        let alive = true;
        const positionIfAlive = () => {
            if (alive) positionStops();
        };
        positionStops();
        const observer = new ResizeObserver(positionIfAlive);
        observer.observe(wrapper);
        document.fonts?.ready?.then(positionIfAlive);
        return () => {
            alive = false;
            observer.disconnect();
        };
    }, [capacity, generation, lang]);

    return (
        <figure className="wind-power-canada-infographic-figure">
            <div
                ref={wrapperRef}
                className="wind-power-canada-infographic-wrapper"
                style={{ aspectRatio: `${NATIVE_SIZE.width} / ${NATIVE_SIZE.height}` }}
            >
                <img
                    src={windPowerCanadaBg}
                    alt=""
                    className="wind-power-canada-bg-image"
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
                        ref={(node) => { stopRefs.current[column.key] = node; }}
                        className="wind-power-canada-column-stop"
                        style={{ left: `${column.left}%`, width: `${column.width}%` }}
                        tabIndex={0}
                        data-prose-tab="1"
                        role="group"
                        aria-label={speakMetric(metrics[column.key], lang)}
                    />
                ))}
                <div aria-hidden="true">
                    <MetricOverlays metricKey="capacity" fonts={fonts} {...capacity} />
                    <MetricOverlays metricKey="generation" fonts={fonts} {...generation} />
                </div>
            </div>
        </figure>
    );
};

export default CanadianWindPowerInfographic;
