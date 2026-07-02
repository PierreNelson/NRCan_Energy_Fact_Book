import React, { useEffect, useRef } from 'react';
import page109Bg from '../assets/page109_bg.svg';
import {
    COUNTRY_LABEL_KEYS,
    COUNTRY_LABEL_SLOTS,
    DEFINITION_SLOTS,
    GREY_SECTION_TOP,
    NATIVE_SIZE,
    OVERLAY_COLORS,
    OVERLAY_FONT_SIZES,
    OVERLAY_SLOTS,
    getModebarSlotStyle,
    getPieLayerStyle,
    SLICE_KEYS,
} from './Page109WorldReservesInfographic.constants';

const overlayTransform = (align, valign = 'center') => {
    const y = valign === 'top' ? '0' : '-50%';
    if (align === 'left') return `translate(0, ${y})`;
    if (align === 'right') return `translate(-100%, ${y})`;
    return `translate(-50%, ${y})`;
};

const OverlayText = ({ left, top, align = 'left', valign = 'center', children, className = '', style = {}, maxWidth }) => {
    if (!children) return null;

    return (
        <span
            className={`page109-overlay ${className}`.trim()}
            style={{
                left: `${left}%`,
                top: `${top}%`,
                transform: overlayTransform(align, valign),
                textAlign: align,
                maxWidth: maxWidth ? `${maxWidth}%` : undefined,
                ...style,
            }}
        >
            {children}
        </span>
    );
};

const MultilineOverlay = (props) => {
    const { text, ...rest } = props;
    if (!text) return null;
    const lines = String(text).split('\n');
    return (
        <OverlayText {...rest}>
            {lines.map((line, index) => (
                <React.Fragment key={`${index}-${line}`}>
                    {index > 0 && <br />}
                    {line}
                </React.Fragment>
            ))}
        </OverlayText>
    );
};

const Page109WorldReservesInfographic = ({
    lang,
    oilSandsPct,
    oilSandsText,
    slices,
    labelFontSize,
    getText,
    onFootnoteClick,
    ariaLabel,
    figureRef,
    pieChart,
    showClearSelection,
    onClearSelection,
}) => {
    const overlayLang = lang === 'fr' ? 'fr' : 'en';
    const slots = OVERLAY_SLOTS[overlayLang];
    const definitionSlot = DEFINITION_SLOTS[overlayLang];
    const sliceByKey = Object.fromEntries((slices || []).map((slice) => [slice.key, slice]));
    const pieClipRef = useRef(null);
    const modebarSlotRef = useRef(null);

    useEffect(() => {
        const reparentModebar = () => {
            const slot = modebarSlotRef.current;
            const clip = pieClipRef.current;
            if (!slot || !clip) return;
            const modebarRoot = clip.querySelector('.modebar-container') || clip.querySelector('.modebar');
            if (!modebarRoot || modebarRoot.parentElement === slot) return;
            slot.appendChild(modebarRoot);
        };
        reparentModebar();
        const clip = pieClipRef.current;
        if (!clip) return undefined;
        const observer = new MutationObserver(reparentModebar);
        observer.observe(clip, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [pieChart]);

    return (
        <figure ref={figureRef} className="page109-infographic-figure" aria-label={ariaLabel}>
            <style>{`
.page109-infographic-figure {
    width: 100%;
    max-width: none;
    margin: 0 0 24px 0;
    overflow: visible;
}
.page109-infographic-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: ${NATIVE_SIZE.width} / ${NATIVE_SIZE.height};
    container-type: inline-size;
    overflow: visible;
}
.page109-bg-image {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    user-select: none;
    pointer-events: none;
}
.page109-overlay {
    position: absolute;
    z-index: 2;
    line-height: 1.15;
    pointer-events: none;
    font-family: 'Noto Sans', Arial, sans-serif;
}
.page109-overlay--definition {
    font-weight: 400;
    font-size: ${OVERLAY_FONT_SIZES.definition};
    line-height: 1.18;
    white-space: normal;
    display: block;
    box-sizing: border-box;
}
.page109-clear-selection {
    position: absolute;
    z-index: 50;
    left: 0;
    top: ${GREY_SECTION_TOP}%;
    transform: translateY(0);
    padding: 6px 12px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: ${OVERLAY_FONT_SIZES.clear_selection};
    color: #fff;
    pointer-events: auto;
}
.page109-clear-selection:hover {
    background-color: #404040;
}
.page109-overlay--oil-sands-pct {
    font-weight: 700;
    font-size: ${OVERLAY_FONT_SIZES.oil_sands_pct};
    white-space: nowrap;
}
.page109-overlay--oil-sands-text {
    font-weight: 700;
    font-size: ${OVERLAY_FONT_SIZES.oil_sands_text};
    line-height: 1.18;
    white-space: nowrap;
}
.page109-pie-layer {
    position: absolute;
    z-index: 5;
    overflow: visible;
    pointer-events: auto;
}
.page109-pie-clip {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: visible;
}
.page109-pie-clip .page109-chart-host {
    position: relative;
    width: 100%;
    height: 100%;
    z-index: 5;
    overflow: visible;
}
.page109-pie-clip .js-plotly-plot,
.page109-pie-clip .plot-container,
.page109-pie-clip .svg-container,
.page109-pie-clip .main-svg {
    overflow: visible !important;
}
.page109-pie-clip .page109-chart-host,
.page109-pie-clip .js-plotly-plot {
    width: 100% !important;
    height: 100% !important;
}
.page109-pie-clip .hoverlayer {
    pointer-events: none;
    z-index: 100 !important;
    overflow: visible !important;
}
.page109-modebar-slot {
    position: absolute;
    z-index: 300;
    pointer-events: none;
    overflow: visible;
}
.page109-modebar-slot.js-plotly-plot .modebar-container,
.page109-modebar-slot.js-plotly-plot .modebar {
    position: absolute !important;
    top: 0 !important;
    right: 0 !important;
    left: auto !important;
    pointer-events: auto;
    overflow: visible !important;
}
.page109-modebar-slot.js-plotly-plot .modebar-btn {
    background-color: rgba(104, 104, 104, 0.92) !important;
    border-radius: 2px !important;
}
.page109-modebar-slot.js-plotly-plot .modebar-btn:hover,
.page109-modebar-slot.js-plotly-plot .modebar-btn:focus {
    background-color: #404040 !important;
}
.page109-modebar-slot.js-plotly-plot .modebar-btn svg path {
    fill: #ffffff !important;
}
.page109-modebar-slot .modebar-title,
.page109-modebar-slot .modebar-info {
    z-index: 350 !important;
}
.page109-html-pie-label a.fn-lnk.page109-fn-asterisk {
    position: relative;
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    min-width: 1.1rem;
    height: 1.1rem;
    padding: 0 0.15rem;
    margin-left: 2px;
    font-family: var(--font-body, Arial, sans-serif);
    font-size: 0.7rem !important;
    font-weight: 700 !important;
    line-height: 1;
    color: #26374a !important;
    background-color: #ffffff !important;
    border: 1px solid #6f6f6f !important;
    border-radius: 2px;
    text-decoration: none !important;
    vertical-align: middle;
    pointer-events: auto;
}
.page109-html-pie-label a.fn-lnk.page109-fn-asterisk:hover,
.page109-html-pie-label a.fn-lnk.page109-fn-asterisk:focus {
    background-color: #f5f5f5 !important;
    border-color: #26374a !important;
    color: #26374a !important;
}
.page109-html-pie-label {
    position: absolute;
    z-index: 40;
    font-family: Arial, sans-serif;
    font-size: ${labelFontSize}px;
    line-height: 1.15;
    font-weight: 400;
    color: ${OVERLAY_COLORS.country_label};
    pointer-events: auto;
    white-space: nowrap;
}
.page109-html-pie-label--bold {
    font-weight: 700;
}
            `}</style>

            <div className="page109-infographic-wrapper">
                <img src={page109Bg} alt="" className="page109-bg-image" draggable={false} />

                {showClearSelection && (
                    <button type="button" className="page109-clear-selection" onClick={onClearSelection}>
                        {getText('page109_clear_selection', lang)}
                    </button>
                )}

                <MultilineOverlay
                    left={definitionSlot.left}
                    top={definitionSlot.top}
                    align={definitionSlot.align}
                    valign="top"
                    maxWidth={definitionSlot.maxWidth}
                    className="page109-overlay--definition"
                    style={{ color: OVERLAY_COLORS.definition }}
                    text={getText('page109_definition', lang)}
                />

                <OverlayText
                    left={slots.oil_sands_pct.left}
                    top={slots.oil_sands_pct.top}
                    align={slots.oil_sands_pct.align}
                    className="page109-overlay--oil-sands-pct"
                    style={{ color: OVERLAY_COLORS.oil_sands_pct }}
                    aria-hidden="true"
                >
                    {oilSandsPct}
                </OverlayText>

                <MultilineOverlay
                    left={slots.oil_sands_text.left}
                    top={slots.oil_sands_text.top}
                    align={slots.oil_sands_text.align}
                    maxWidth={slots.oil_sands_text.maxWidth}
                    className="page109-overlay--oil-sands-text"
                    style={{ color: OVERLAY_COLORS.oil_sands_text }}
                    text={oilSandsText}
                />

                <div className="page109-pie-layer" style={getPieLayerStyle()}>
                    <div className="page109-pie-clip" ref={pieClipRef}>
                        {pieChart}
                    </div>
                </div>

                <div
                    ref={modebarSlotRef}
                    className="page109-modebar-slot js-plotly-plot plotly"
                    style={getModebarSlotStyle()}
                    aria-hidden="true"
                />

                {SLICE_KEYS.map((key) => {
                    const slot = COUNTRY_LABEL_SLOTS[key];
                    const slice = sliceByKey[key];
                    if (!slot || !slice) return null;
                    const isSaudi = key === 'saudi';
                    const textAlign = slot.align === 'right' ? 'right' : slot.align === 'left' ? 'left' : 'center';
                    return (
                        <span
                            key={key}
                            className={`page109-html-pie-label${slot.bold ? ' page109-html-pie-label--bold' : ''}`}
                            style={{
                                left: `${slot.left}%`,
                                top: `${slot.top}%`,
                                transform: overlayTransform(slot.align),
                                textAlign,
                            }}
                            id={isSaudi ? 'fn-saudi-rf-page109' : undefined}
                        >
                            {getText(COUNTRY_LABEL_KEYS[key], lang)}
                            {isSaudi && (
                                <a
                                    className="fn-lnk page109-fn-asterisk"
                                    href="#fn-saudi-page109"
                                    onClick={onFootnoteClick('fn-saudi-page109')}
                                    aria-label={lang === 'en' ? 'Footnote for Saudi Arabia' : 'Note de bas de page pour l\'Arabie saoudite'}
                                >
                                    *
                                </a>
                            )}
                        </span>
                    );
                })}
            </div>
        </figure>
    );
};

export default Page109WorldReservesInfographic;
