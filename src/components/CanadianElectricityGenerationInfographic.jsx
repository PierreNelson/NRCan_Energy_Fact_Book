import React from 'react';
import canadianElectricityGenerationBgEn from '../assets/canadian_electricity_generation_bg.png';
import canadianElectricityGenerationBgFr from '../assets/canadian_electricity_generation_bg_fr.png';
import {
    NATIVE_SIZE,
    OVERLAY_LAYOUT,
    formatSharePct,
    getCanadaPctSlot,
    getCanadianGenerationProvinceRows,
    getProvinceAbbrSlot,
    getProvincePctSlot,
} from './CanadianElectricityGenerationInfographic.constants';

const overlayTransform = (align) => {
    if (align === 'right') return 'translate(-100%, -50%)';
    if (align === 'center') return 'translate(-50%, -50%)';
    return 'translate(0, -50%)';
};

const OverlaySlot = ({ left, top, align = 'left', className, children }) => (
    <span
        className={`canadian-electricity-generation-overlay ${className}`}
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

const CanadianElectricityGenerationInfographic = ({ lang, getText, figureRef, ariaLabel, data }) => {
    const overlayLang = lang === 'fr' ? 'fr' : 'en';
    const bgImage = overlayLang === 'fr' ? canadianElectricityGenerationBgFr : canadianElectricityGenerationBgEn;
    const native = NATIVE_SIZE[overlayLang];
    const layout = OVERLAY_LAYOUT[overlayLang];
    const { fonts, columns } = layout;
    const sources = data?.sources || {};

    return (
        <figure ref={figureRef} className="canadian-electricity-generation-infographic-figure" aria-label={ariaLabel}>
            <style>{`
.canadian-electricity-generation-infographic-figure {
    display: block;
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0;
}
.canadian-electricity-generation-infographic-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: ${native.width} / ${native.height};
    container-type: inline-size;
    background: #ffffff;
}
.canadian-electricity-generation-bg-image {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    user-select: none;
    pointer-events: none;
}
.canadian-electricity-generation-overlay-layer {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
}
.canadian-electricity-generation-overlay {
    position: absolute;
    z-index: 2;
    color: #ffffff;
    font-family: 'Noto Sans', sans-serif;
    white-space: nowrap;
    pointer-events: none;
}
.canadian-electricity-generation-canada-pct {
    font-weight: 700;
    font-size: ${fonts.canada}cqw;
    line-height: 1;
}
.canadian-electricity-generation-prov-abbr,
.canadian-electricity-generation-prov-pct {
    font-weight: 400;
    font-size: ${fonts.prov}cqw;
    line-height: 1.28;
}
            `}</style>

            <div className="canadian-electricity-generation-infographic-wrapper">
                <img src={bgImage} alt="" className="canadian-electricity-generation-bg-image" draggable={false} aria-hidden="true" />

                <div className="canadian-electricity-generation-overlay-layer" aria-hidden="true">
                    {columns.map((column) => {
                        const block = sources[column.key];
                        if (!block) return null;
                        const provinceRows = getCanadianGenerationProvinceRows(column.key, block);
                        const canadaSlot = getCanadaPctSlot(column);

                        return (
                            <React.Fragment key={column.key}>
                                {(block.canada != null || block.canada === 0) && (
                                    <OverlaySlot
                                        left={canadaSlot.left}
                                        top={canadaSlot.top}
                                        align={canadaSlot.align}
                                        className="canadian-electricity-generation-canada-pct"
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
                                                className="canadian-electricity-generation-prov-abbr"
                                            >
                                                {getText(`electricity_generation_provincial_prov_${row.key}`, lang)}
                                            </OverlaySlot>
                                            <OverlaySlot
                                                left={pctSlot.left}
                                                top={pctSlot.top}
                                                align="right"
                                                className="canadian-electricity-generation-prov-pct"
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

export default CanadianElectricityGenerationInfographic;
