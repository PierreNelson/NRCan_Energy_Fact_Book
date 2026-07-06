import React from 'react';
import canadianCoalSupplyDemandBg from '../assets/canadian_coal_supply_demand_bg.png';
import canadianCoalSupplyDemandBgStacked from '../assets/canadian_coal_supply_demand_bg_stacked.png';
import {
    getNativeSize,
    getOverlaySlots,
    OVERLAY_COLORS,
} from './CanadianCoalSupplyDemandInfographic.constants';

const OverlayCaption = ({ left, top, align = 'center', color, children }) => {
    const transform =
        align === 'left'
            ? 'none'
            : align === 'right'
              ? 'translateX(-100%)'
              : 'translateX(-50%)';

    return (
        <p
            className="canadian-coal-supply-demand-overlay-caption"
            style={{
                left: `${left}%`,
                top: `${top}%`,
                transform,
                textAlign: align,
                color,
            }}
            aria-hidden="true"
        >
            {children}
        </p>
    );
};

const OverlayTotal = ({ left, top, align = 'center', color, children }) => {
    const transform =
        align === 'left'
            ? 'translate(0, -50%)'
            : align === 'right'
              ? 'translate(-100%, -50%)'
              : 'translate(-50%, -50%)';

    return (
        <span
            className="canadian-coal-supply-demand-overlay-total"
            style={{
                left: `${left}%`,
                top: `${top}%`,
                transform,
                textAlign: align,
                color,
            }}
            aria-hidden="true"
        >
            {children}
        </span>
    );
};

const CanadianCoalSupplyDemandInfographic = ({
    lang,
    useStackedLayout = false,
    formatMt,
    totalMt,
    electricityLabel,
    metallurgicalLabel,
    ariaLabel,
    figureRef,
}) => {
    const slots = getOverlaySlots(lang, useStackedLayout);
    const native = getNativeSize(useStackedLayout);
    const bgImage = useStackedLayout ? canadianCoalSupplyDemandBgStacked : canadianCoalSupplyDemandBg;
    const figureClass = useStackedLayout
        ? 'canadian-coal-supply-demand-infographic-figure canadian-coal-supply-demand-infographic-figure--stacked'
        : 'canadian-coal-supply-demand-infographic-figure';

    return (
        <figure ref={figureRef} className={figureClass} aria-label={ariaLabel}>
            <style>{`
.canadian-coal-supply-demand-infographic-figure {
    width: 100%;
    max-width: 360px;
    margin: 0 auto;
}
.canadian-coal-supply-demand-infographic-figure--stacked {
    max-width: 100%;
}
.canadian-coal-supply-demand-infographic-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: ${native.width} / ${native.height};
    container-type: inline-size;
}
.canadian-coal-supply-demand-bg-image {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    user-select: none;
    pointer-events: none;
}
.canadian-coal-supply-demand-overlay-total {
    position: absolute;
    z-index: 2;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-weight: 700;
    font-size: 11cqw;
    line-height: 1;
    white-space: nowrap;
    pointer-events: none;
}
.canadian-coal-supply-demand-infographic-figure--stacked .canadian-coal-supply-demand-overlay-total {
    font-size: 3.8cqw;
}
.canadian-coal-supply-demand-overlay-caption {
    position: absolute;
    z-index: 2;
    width: 92%;
    margin: 0;
    font-family: 'Noto Sans', sans-serif;
    font-size: 5.5cqw;
    line-height: 1.35;
    white-space: pre-line;
    pointer-events: none;
}
.canadian-coal-supply-demand-infographic-figure--stacked .canadian-coal-supply-demand-overlay-caption {
    width: 30%;
    font-size: 2.4cqw;
}
            `}</style>
            <div className="canadian-coal-supply-demand-infographic-wrapper">
                <img
                    src={bgImage}
                    alt=""
                    className="canadian-coal-supply-demand-bg-image"
                    draggable={false}
                />
                <OverlayTotal
                    left={slots.totalMt.left}
                    top={slots.totalMt.top}
                    align={slots.totalMt.align}
                    color={OVERLAY_COLORS.totalMt}
                >
                    {formatMt(totalMt)}
                </OverlayTotal>
                <OverlayCaption
                    left={slots.electricityText.left}
                    top={slots.electricityText.top}
                    align={slots.electricityText.align}
                    color={OVERLAY_COLORS.electricityText}
                >
                    {electricityLabel}
                </OverlayCaption>
                <OverlayCaption
                    left={slots.metallurgicalText.left}
                    top={slots.metallurgicalText.top}
                    align={slots.metallurgicalText.align}
                    color={OVERLAY_COLORS.metallurgicalText}
                >
                    {metallurgicalLabel}
                </OverlayCaption>
            </div>
        </figure>
    );
};

export default CanadianCoalSupplyDemandInfographic;
