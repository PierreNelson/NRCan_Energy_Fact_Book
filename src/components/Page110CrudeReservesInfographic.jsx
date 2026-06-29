import React from 'react';
import page110Bg from '../assets/page110_bg.png';
import { LABEL_SLOTS, NATIVE_SIZE, OVERLAY_COLORS, VALUE_SLOTS } from './Page110CrudeReservesInfographic.constants';

const overlayTransform = (align) =>
    align === 'left' ? 'translate(0, -50%)' : align === 'right' ? 'translate(-100%, -50%)' : 'translate(-50%, -50%)';

const OverlayLabel = ({ left, top, align = 'left', children, className = '', style = {} }) => {
    if (!children) return null;

    return (
        <span
            className={`page110-overlay-label ${className}`.trim()}
            style={{
                left: `${left}%`,
                top: `${top}%`,
                transform: overlayTransform(align),
                textAlign: align,
                ...style,
            }}
        >
            {children}
        </span>
    );
};

const OverlayValue = ({ left, top, color, value, align = 'center', size = 'lg' }) => {
    if (value == null || value === '–') return null;

    return (
        <span
            className={`page110-overlay-value page110-overlay-value--${size}`}
            style={{
                left: `${left}%`,
                top: `${top}%`,
                color,
                transform: overlayTransform(align),
                textAlign: align,
            }}
            aria-hidden="true"
        >
            {value}
        </span>
    );
};

const Page110CrudeReservesInfographic = ({
    lang,
    overlayValues,
    formatReserve,
    getText,
    onFootnoteClick,
    ariaLabel,
    figureRef,
}) => {
    const overlayLang = lang === 'fr' ? 'fr' : 'en';
    const labelSlots = LABEL_SLOTS[overlayLang];
    const valueSlots = VALUE_SLOTS;

    return (
        <figure ref={figureRef} className="page110-infographic-figure" aria-label={ariaLabel}>
            <style>{`
.page110-infographic-figure {
    width: 100%;
    max-width: 520px;
    margin: 0 auto 20px auto;
}
.page110-infographic-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: ${NATIVE_SIZE.width} / ${NATIVE_SIZE.height};
    container-type: inline-size;
}
.page110-bg-image {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    user-select: none;
    pointer-events: none;
}
.page110-overlay-label {
    position: absolute;
    z-index: 2;
    line-height: 1.15;
    white-space: nowrap;
    pointer-events: none;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-weight: 700;
    font-size: 6.2cqw;
    color: ${OVERLAY_COLORS.label};
}
.page110-overlay-label--conventional {
    pointer-events: auto;
}
.page110-overlay-label--conventional .fn-lnk {
    font-weight: 700;
    text-decoration: none;
    color: inherit;
}
.page110-overlay-label--fr {
    font-size: 6.2cqw;
    white-space: normal;
}
.page110-overlay-value {
    position: absolute;
    z-index: 2;
    line-height: 1;
    white-space: nowrap;
    pointer-events: none;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-weight: 700;
}
.page110-overlay-value--lg {
    font-size: 6cqw;
}
.page110-overlay-value--sm {
    font-size: 6cqw;
}
            `}</style>

            <div className="page110-infographic-wrapper">
                <img src={page110Bg} alt="" className="page110-bg-image" draggable={false} />

                <OverlayLabel
                    left={labelSlots.canada_total.left}
                    top={labelSlots.canada_total.top}
                    align={labelSlots.canada_total.align}
                    className={overlayLang === 'fr' ? 'page110-overlay-label--fr' : ''}
                >
                    {getText('page110_label_canada_total', lang)}
                </OverlayLabel>

                <OverlayValue
                    left={valueSlots.total_bb.left}
                    top={valueSlots.total_bb.top}
                    color={OVERLAY_COLORS.total_bb}
                    value={formatReserve(overlayValues?.totalBb, 0)}
                    align={valueSlots.total_bb.align}
                    size={valueSlots.total_bb.size}
                />

                <OverlayLabel
                    left={labelSlots.conventional.left}
                    top={labelSlots.conventional.top}
                    align={labelSlots.conventional.align}
                    className={`page110-overlay-label--conventional${overlayLang === 'fr' ? ' page110-overlay-label--fr' : ''}`}
                >
                    {getText('page110_label_conventional', lang)}
                    <span id="fn-dagger-rf-page110-infographic" style={{ verticalAlign: 'super', fontSize: '0.75em', lineHeight: '0' }}>
                        <a className="fn-lnk" href="#fn-dagger-page110" onClick={onFootnoteClick('fn-dagger-page110')}>
                            <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                            <span aria-hidden="true">**</span>
                        </a>
                    </span>
                </OverlayLabel>

                <OverlayValue
                    left={valueSlots.conventional_bb.left}
                    top={valueSlots.conventional_bb.top}
                    color={OVERLAY_COLORS.conventional_bb}
                    value={formatReserve(overlayValues?.conventionalBb, 0)}
                    align={valueSlots.conventional_bb.align}
                    size={valueSlots.conventional_bb.size}
                />

                <OverlayLabel
                    left={labelSlots.oil_sands.left}
                    top={labelSlots.oil_sands.top}
                    align={labelSlots.oil_sands.align}
                    className={overlayLang === 'fr' ? 'page110-overlay-label--fr' : ''}
                >
                    {getText('page110_label_oil_sands', lang)}
                </OverlayLabel>

                <OverlayValue
                    left={valueSlots.oil_sands_bb.left}
                    top={valueSlots.oil_sands_bb.top}
                    color={OVERLAY_COLORS.oil_sands_bb}
                    value={formatReserve(overlayValues?.oilSandsBb, 0)}
                    align={valueSlots.oil_sands_bb.align}
                    size={valueSlots.oil_sands_bb.size}
                />

                <OverlayLabel
                    left={labelSlots.mining.left}
                    top={labelSlots.mining.top}
                    align={labelSlots.mining.align}
                    className={overlayLang === 'fr' ? 'page110-overlay-label--fr' : ''}
                >
                    {getText('page110_label_mining', lang)}
                </OverlayLabel>

                <OverlayValue
                    left={valueSlots.mining_bb.left}
                    top={valueSlots.mining_bb.top}
                    color={OVERLAY_COLORS.mining_bb}
                    value={formatReserve(overlayValues?.miningBb, 0)}
                    align={valueSlots.mining_bb.align}
                    size={valueSlots.mining_bb.size}
                />

                <OverlayLabel
                    left={labelSlots.insitu.left}
                    top={labelSlots.insitu.top}
                    align={labelSlots.insitu.align}
                >
                    {getText('page110_label_insitu', lang)}
                </OverlayLabel>

                <OverlayValue
                    left={valueSlots.insitu_bb.left}
                    top={valueSlots.insitu_bb.top}
                    color={OVERLAY_COLORS.insitu_bb}
                    value={formatReserve(overlayValues?.insituBb, 0)}
                    align={valueSlots.insitu_bb.align}
                    size={valueSlots.insitu_bb.size}
                />
            </div>
        </figure>
    );
};

export default Page110CrudeReservesInfographic;
