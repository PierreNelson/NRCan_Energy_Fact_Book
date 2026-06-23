import React from 'react';
import {
    DAM_IMAGE_SLOT,
    MAP_BG_LAYER,
    TOTAL_CAPACITY_CALLOUT,
    TOTAL_CAPACITY_LABEL,
    page76BgDam,
    page76BgMap,
} from './Page76HydroInfographic.constants';

const CALLOUT_LINE_KEYS = ['line1', 'line2', 'line3'];

const overlayTransform = (align) => {
    if (align === 'right') return 'translate(-100%, 0)';
    if (align === 'center') return 'translate(-50%, 0)';
    return 'translate(0, 0)';
};

const OverlaySlot = ({ slot, className, children, dataMetric }) => (
    <div
        className={`page76-overlay ${className}`}
        data-metric={dataMetric}
        data-align={slot.align || 'left'}
        style={{
            left: `${slot.left}%`,
            top: `${slot.top}%`,
            width: slot.width ? `${slot.width}%` : undefined,
            transform: overlayTransform(slot.align || 'left'),
            textAlign: slot.align || 'left',
        }}
    >
        {children}
    </div>
);

const mapLayerStyles = `
.page76-map-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
}
.page76-map-bg-inner {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: ${MAP_BG_LAYER.align};
    justify-content: ${MAP_BG_LAYER.justify};
    overflow: hidden;
}
.page76-map-bg-image {
    display: block;
    width: ${MAP_BG_LAYER.widthPct}%;
    height: auto;
    max-height: ${MAP_BG_LAYER.maxHeightPct}%;
    flex-shrink: 0;
}
`;

const foregroundStyles = (calloutFonts, labelFonts) => `
.page76-foreground-overlays {
    position: absolute;
    inset: 0;
    width: 100%;
    container-type: inline-size;
    pointer-events: none;
    z-index: 4;
    overflow: visible;
}
.page76-dam-image {
    position: absolute;
    left: ${DAM_IMAGE_SLOT.left}%;
    top: ${DAM_IMAGE_SLOT.top}%;
    width: ${DAM_IMAGE_SLOT.width}%;
    height: auto;
    z-index: 1;
    display: block;
}
.page76-overlay-layer {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
}
.page76-overlay {
    position: absolute;
    z-index: 2;
    box-sizing: border-box;
    pointer-events: none;
    font-family: 'Lato', sans-serif;
    color: var(--gc-text);
    line-height: 1.4;
    margin: 0;
}
.page76-overlay-dam-label {
    font-family: Arial, sans-serif;
    font-size: ${labelFonts.size}cqw;
    font-weight: 700;
    color: #000000;
    line-height: 1.2;
    white-space: nowrap;
}
.page76-overlay-callout-line {
    font-size: ${calloutFonts.size}cqw;
    font-weight: 700;
    color: #000000;
    text-align: right;
    line-height: 1.35;
    white-space: nowrap;
}
@media (max-width: 768px) {
    .page76-overlay-dam-label { font-size: ${labelFonts.size * 1.1}cqw; }
    .page76-overlay-callout-line { font-size: ${calloutFonts.size * 1.1}cqw; }
}
`;

/** Canada map — behind the bar chart. */
export const Page76HydroMapLayer = ({ minHeight }) => (
    <div className="page76-map-layer" style={{ minHeight }} aria-hidden="true">
        <style>{mapLayerStyles}</style>
        <div className="page76-map-bg-inner">
            <img src={page76BgMap} alt="" className="page76-map-bg-image" draggable={false} />
        </div>
    </div>
);

/** Dam image + capacity callout — on top of the bar chart. Tune in constants file. */
export const Page76HydroForegroundOverlays = ({
    lang,
    damLabel,
    calloutLines,
    minHeight,
}) => {
    const overlayLang = lang === 'fr' ? 'fr' : 'en';
    const calloutSlots = TOTAL_CAPACITY_CALLOUT[overlayLang];
    const labelSlot = TOTAL_CAPACITY_LABEL[overlayLang].label;
    const calloutFonts = TOTAL_CAPACITY_CALLOUT.fonts;
    const labelFonts = TOTAL_CAPACITY_LABEL.fonts;

    return (
        <div className="page76-foreground-overlays" style={{ minHeight }} aria-hidden="true">
            <style>{foregroundStyles(calloutFonts, labelFonts)}</style>

            <img src={page76BgDam} alt="" className="page76-dam-image" draggable={false} />

            {damLabel ? (
                <OverlaySlot
                    slot={labelSlot}
                    className="page76-overlay-dam-label"
                    dataMetric="totalCapacityLabel"
                >
                    {damLabel}
                </OverlaySlot>
            ) : null}

            {calloutLines?.length ? (
                <div className="page76-overlay-layer">
                    {calloutLines.map((line, index) => {
                        const slotKey = CALLOUT_LINE_KEYS[index];
                        if (!slotKey || !calloutSlots[slotKey]) return null;
                        return (
                            <OverlaySlot
                                key={slotKey}
                                slot={calloutSlots[slotKey]}
                                className="page76-overlay-callout-line"
                                dataMetric={slotKey}
                            >
                                {line}
                            </OverlaySlot>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
};

/** @deprecated Use Page76HydroMapLayer + Page76HydroForegroundOverlays */
const Page76HydroInfographic = (props) => (
    <>
        <Page76HydroMapLayer minHeight={props.minHeight} />
        <Page76HydroForegroundOverlays {...props} />
    </>
);

export default Page76HydroInfographic;
