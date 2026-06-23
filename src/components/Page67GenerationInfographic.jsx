import React from 'react';
import page67BgEn from '../assets/page67_bg.png';
import page67BgFr from '../assets/page67_bg_fr.png';
import {
    NATIVE_SIZE,
    OVERLAY_LAYOUT,
    formatSharePct,
    getCanadaPctSlot,
    getProvinceAbbrSlot,
    getProvincePctSlot,
} from './Page67GenerationInfographic.constants';

const overlayTransform = (align) => {
    if (align === 'right') return 'translate(-100%, -50%)';
    if (align === 'center') return 'translate(-50%, -50%)';
    return 'translate(0, -50%)';
};

const OverlaySlot = ({ left, top, align = 'left', className, children }) => (
    <span
        className={`page67-overlay ${className}`}
        data-align={align}
        style={{
            left: `${left}%`,
            top: `${top}%`,
            transform: overlayTransform(align),
        }}
    >
        {children}
    </span>
);

const Page67GenerationInfographic = ({ lang, getText, figureRef, ariaLabel, data, title, titleId }) => {
    const overlayLang = lang === 'fr' ? 'fr' : 'en';
    const bgImage = overlayLang === 'fr' ? page67BgFr : page67BgEn;
    const native = NATIVE_SIZE[overlayLang];
    const layout = OVERLAY_LAYOUT[overlayLang];
    const { fonts, columns } = layout;
    const sources = data?.sources || {};

    return (
        <figure ref={figureRef} className="page67-infographic-figure" aria-label={ariaLabel}>
            <style>{`
.page67-infographic-figure {
    display: block;
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0;
}
.page67-infographic-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: ${native.width} / ${native.height};
    container-type: inline-size;
    background: #ffffff;
}
.page67-bg-image {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    user-select: none;
    pointer-events: none;
}
.page67-overlay-layer {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
}
.page67-overlay {
    position: absolute;
    z-index: 2;
    color: #ffffff;
    font-family: 'Noto Sans', sans-serif;
    white-space: nowrap;
    pointer-events: none;
}
.page67-canada-pct {
    font-weight: 700;
    font-size: ${fonts.canada}cqw;
    line-height: 1;
}
.page67-prov-abbr,
.page67-prov-pct {
    font-weight: 400;
    font-size: ${fonts.prov}cqw;
    line-height: 1.28;
}
.page67-infographic-title-overlay {
    position: absolute;
    top: 2.5%;
    left: 0;
    right: 0;
    z-index: 3;
    margin: 0;
    padding: 0 3%;
    font-family: 'Lato', sans-serif;
    font-weight: bold;
    font-size: 3.1cqw;
    line-height: 1.15;
    color: #333333;
    text-align: center;
    text-transform: none;
    pointer-events: none;
    box-sizing: border-box;
}
            `}</style>

            <div className="page67-infographic-wrapper">
                <img src={bgImage} alt="" className="page67-bg-image" draggable={false} aria-hidden="true" />
                {title && (
                    <h1 id={titleId} className="page67-infographic-title-overlay">
                        {title}
                    </h1>
                )}

                <div className="page67-overlay-layer" aria-hidden="true">
                    {columns.map((column) => {
                        const block = sources[column.key];
                        if (!block) return null;
                        const canadaSlot = getCanadaPctSlot(column);

                        return (
                            <React.Fragment key={column.key}>
                                <OverlaySlot
                                    left={canadaSlot.left}
                                    top={canadaSlot.top}
                                    align={canadaSlot.align}
                                    className="page67-canada-pct"
                                >
                                    {formatSharePct(block.canada, lang)}
                                </OverlaySlot>

                                {block.provinces.map((row, rowIndex) => {
                                    const abbrSlot = getProvinceAbbrSlot(column, rowIndex);
                                    const pctSlot = getProvincePctSlot(column, rowIndex);
                                    return (
                                        <React.Fragment key={`${column.key}-${row.key}`}>
                                            <OverlaySlot
                                                left={abbrSlot.left}
                                                top={abbrSlot.top}
                                                className="page67-prov-abbr"
                                            >
                                                {getText(`page67_prov_${row.key}`, lang)}
                                            </OverlaySlot>
                                            <OverlaySlot
                                                left={pctSlot.left}
                                                top={pctSlot.top}
                                                align="right"
                                                className="page67-prov-pct"
                                            >
                                                {formatSharePct(row.value, lang)}
                                            </OverlaySlot>
                                        </React.Fragment>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
            <figcaption className="wb-inv">{ariaLabel}</figcaption>
        </figure>
    );
};

export default Page67GenerationInfographic;
