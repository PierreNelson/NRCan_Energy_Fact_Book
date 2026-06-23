import React from 'react';
import page66BgEn from '../assets/page66_bg.png';
import page66BgFr from '../assets/page66_bg_fr.png';
import {
    NATIVE_SIZE,
    OVERLAY_LAYOUT,
    formatSharePct,
    getCanadaPctSlot,
    getPage66ProvinceRows,
    getProvinceAbbrSlot,
    getProvincePctSlot,
} from './Page66GenerationInfographic.constants';

const overlayTransform = (align) => {
    if (align === 'right') return 'translate(-100%, -50%)';
    if (align === 'center') return 'translate(-50%, -50%)';
    return 'translate(0, -50%)';
};

const OverlaySlot = ({ left, top, align = 'left', className, children }) => (
    <span
        className={`page66-overlay ${className}`}
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

const Page66GenerationInfographic = ({ lang, getText, figureRef, ariaLabel, data }) => {
    const overlayLang = lang === 'fr' ? 'fr' : 'en';
    const bgImage = overlayLang === 'fr' ? page66BgFr : page66BgEn;
    const native = NATIVE_SIZE[overlayLang];
    const layout = OVERLAY_LAYOUT[overlayLang];
    const { fonts, columns } = layout;
    const sources = data?.sources || {};

    return (
        <figure ref={figureRef} className="page66-infographic-figure" aria-label={ariaLabel}>
            <style>{`
.page66-infographic-figure {
    display: block;
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0;
}
.page66-infographic-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: ${native.width} / ${native.height};
    container-type: inline-size;
    background: #ffffff;
}
.page66-bg-image {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    user-select: none;
    pointer-events: none;
}
.page66-overlay-layer {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
}
.page66-overlay {
    position: absolute;
    z-index: 2;
    color: #ffffff;
    font-family: 'Noto Sans', sans-serif;
    white-space: nowrap;
    pointer-events: none;
}
.page66-canada-pct {
    font-weight: 700;
    font-size: ${fonts.canada}cqw;
    line-height: 1;
}
.page66-prov-abbr,
.page66-prov-pct {
    font-weight: 400;
    font-size: ${fonts.prov}cqw;
    line-height: 1.28;
}
            `}</style>

            <div className="page66-infographic-wrapper">
                <img src={bgImage} alt="" className="page66-bg-image" draggable={false} aria-hidden="true" />

                <div className="page66-overlay-layer" aria-hidden="true">
                    {columns.map((column) => {
                        const block = sources[column.key];
                        if (!block) return null;
                        const provinceRows = getPage66ProvinceRows(column.key, block);
                        const canadaSlot = getCanadaPctSlot(column);

                        return (
                            <React.Fragment key={column.key}>
                                {(block.canada != null || block.canada === 0) && (
                                    <OverlaySlot
                                        left={canadaSlot.left}
                                        top={canadaSlot.top}
                                        align={canadaSlot.align}
                                        className="page66-canada-pct"
                                    >
                                        {formatSharePct(block.canada, lang)}
                                    </OverlaySlot>
                                )}

                                {provinceRows.map((row, rowIndex) => {
                                    const abbrSlot = getProvinceAbbrSlot(column, rowIndex);
                                    const pctSlot = getProvincePctSlot(column, rowIndex);
                                    return (
                                        <React.Fragment key={`${column.key}-${row.key}`}>
                                            <OverlaySlot
                                                left={abbrSlot.left}
                                                top={abbrSlot.top}
                                                className="page66-prov-abbr"
                                            >
                                                {getText(`page67_prov_${row.key}`, lang)}
                                            </OverlaySlot>
                                            <OverlaySlot
                                                left={pctSlot.left}
                                                top={pctSlot.top}
                                                align="right"
                                                className="page66-prov-pct"
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

export default Page66GenerationInfographic;
