import React from 'react';
import page111Bg from '../assets/page111_bg_1.png';
import {
    NATIVE_SIZE,
    OVERLAY_COLORS,
    PCT_SLOTS,
    PROVINCE_ORDER,
    getImageTrimStyles,
} from './Page111ProvinceInfographic.constants';

const OverlayPct = ({ left, top, color, value, align = 'right' }) => {
    if (value == null || value === '–') return null;
    const transform = align === 'left' ? 'translate(0, -50%)' : 'translate(-100%, -50%)';

    return (
        <span
            className="page111-overlay-pct"
            style={{
                left: `${left}%`,
                top: `${top}%`,
                color,
                transform,
                textAlign: align,
            }}
            aria-hidden="true"
        >
            {value}
        </span>
    );
};

const Page111ProvinceInfographic = ({
    lang,
    provinceValues,
    formatPct,
    getProvinceLabel,
    ariaLabel,
    figureRef,
    graphicHeight = 480,
}) => {
    const slots = PCT_SLOTS;
    const trimStyles = getImageTrimStyles();
    const pctSuffix = lang === 'fr' ? ' %' : '%';
    const labelColumnWidth = lang === 'fr' ? 168 : 152;
    const maxGraphicHeight = `min(${graphicHeight}px, 42vw)`;

    return (
        <div ref={figureRef} className="page111-infographic-layout" aria-label={ariaLabel} role="img">
            <style>{`
.page111-infographic-layout {
    display: flex;
    align-items: stretch;
    width: 100%;
    max-width: 100%;
    gap: 0;
}
.page111-infographic-graphic {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: flex-start;
}
.page111-infographic-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: ${NATIVE_SIZE.width} / ${NATIVE_SIZE.height};
    max-height: ${maxGraphicHeight};
    container-type: size;
    overflow: hidden;
}
.page111-infographic-art {
    position: absolute;
    top: 0;
    height: 100%;
    width: ${trimStyles.artWidth};
    left: ${trimStyles.artLeft};
}
.page111-bg-image {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    user-select: none;
    pointer-events: none;
}
.page111-overlay-pct {
    position: absolute;
    z-index: 2;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
    pointer-events: none;
    font-size: clamp(11px, 4.5cqmin, 22px);
}
.page111-province-names {
    position: relative;
    flex: 0 0 ${labelColumnWidth}px;
    width: ${labelColumnWidth}px;
    max-width: 30%;
    margin-left: auto;
    padding-left: 12px;
    box-sizing: border-box;
    align-self: stretch;
}
.page111-province-name {
    position: absolute;
    right: 0;
    left: 0;
    width: 100%;
    transform: translateY(-50%);
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-weight: 600;
    font-size: clamp(12px, 2.4vw, 17px);
    line-height: 1.2;
    white-space: normal;
    overflow-wrap: break-word;
    word-break: normal;
    hyphens: auto;
    text-align: right;
}
            `}</style>

            <div className="page111-infographic-graphic">
                <div className="page111-infographic-wrapper">
                    <div className="page111-infographic-art">
                        <img
                            src={page111Bg}
                            alt=""
                            className="page111-bg-image"
                            draggable={false}
                        />
                        {PROVINCE_ORDER.map((key) => {
                            const slot = slots[key];
                            const values = provinceValues?.[key];
                            if (!slot || !values) return null;
                            const pctText = values.sharePct != null
                                ? `${formatPct(values.sharePct, 1)}${pctSuffix}`
                                : null;
                            return (
                                <OverlayPct
                                    key={key}
                                    left={slot.left}
                                    top={slot.top}
                                    color={OVERLAY_COLORS[key]}
                                    value={pctText}
                                    align={slot.align}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="page111-province-names" aria-hidden="true">
                {PROVINCE_ORDER.map((key) => {
                    const slot = slots[key];
                    const values = provinceValues?.[key];
                    if (!slot || !values) return null;
                    return (
                        <span
                            key={key}
                            className="page111-province-name"
                            style={{ top: `${slot.top}%`, color: OVERLAY_COLORS[key] }}
                        >
                            {getProvinceLabel(key)}
                        </span>
                    );
                })}
            </div>
        </div>
    );
};

export default Page111ProvinceInfographic;
