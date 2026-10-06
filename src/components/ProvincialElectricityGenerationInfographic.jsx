import React from 'react';
import provincialElectricityGenerationBgEn from '../assets/provincial_electricity_generation_bg.png';
import provincialElectricityGenerationBgFr from '../assets/provincial_electricity_generation_bg_fr.png';
import {
    NATIVE_SIZE,
    OVERLAY_LAYOUT,
    formatSharePct,
    getCanadaPctSlot,
    getProvinceAbbrSlot,
    getProvincePctSlot,
} from './ProvincialElectricityGenerationInfographic.constants';

const overlayTransform = (align) => {
    if (align === 'right') return 'translate(-100%, -50%)';
    if (align === 'center') return 'translate(-50%, -50%)';
    return 'translate(0, -50%)';
};

const OverlaySlot = ({ left, top, align = 'left', className, children }) => (
    <span
        className={`provincial-electricity-generation-overlay ${className}`}
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

const ProvincialElectricityGenerationInfographic = ({ lang, getText, figureRef, data, title, titleId }) => {
    const overlayLang = lang === 'fr' ? 'fr' : 'en';
    const bgImage = overlayLang === 'fr' ? provincialElectricityGenerationBgFr : provincialElectricityGenerationBgEn;
    const native = NATIVE_SIZE[overlayLang];
    const layout = OVERLAY_LAYOUT[overlayLang];
    const { fonts, columns } = layout;
    const sources = data?.sources || {};

    const canadaLabel = getText('electricity_generation_canada_canada_label', lang);

    return (
        <figure
            ref={figureRef}
            className="provincial-electricity-generation-infographic-figure"
        >
            <style>{`
.provincial-electricity-generation-infographic-figure {
    position: relative;
    display: block;
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0;
}
.provincial-electricity-generation-infographic-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: ${native.width} / ${native.height};
    container-type: inline-size;
    background: #ffffff;
}
.provincial-electricity-generation-bg-image {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    user-select: none;
    pointer-events: none;
}
.provincial-electricity-generation-column-stop {
    position: absolute;
    z-index: 4;
    top: 16%;
    bottom: 0;
    pointer-events: auto;
}
.provincial-electricity-generation-column-stop:focus,
.provincial-electricity-generation-column-stop:focus-visible {
    outline: 3px solid #ffbf47;
    outline-offset: 0 !important;
}
.provincial-electricity-generation-overlay-layer {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
}
.provincial-electricity-generation-overlay {
    position: absolute;
    z-index: 2;
    color: #ffffff;
    font-family: 'Noto Sans', sans-serif;
    white-space: nowrap;
    pointer-events: none;
}
.provincial-electricity-generation-canada-pct {
    font-weight: 700;
    font-size: ${fonts.canada}cqw;
    line-height: 1;
}
.provincial-electricity-generation-prov-abbr,
.provincial-electricity-generation-prov-pct {
    font-weight: 400;
    font-size: ${fonts.prov}cqw;
    line-height: 1.28;
}
.provincial-electricity-generation-infographic-title-overlay {
    position: absolute;
    top: 2.5%;
    left: 0;
    right: 0;
    z-index: 5;
    margin: 0;
    padding: 0 3%;
    font-family: 'Lato', sans-serif;
    font-weight: bold;
    font-size: 3.1cqw;
    line-height: 1.15;
    color: #333333;
    text-align: center;
    text-transform: none;
    pointer-events: auto;
    box-sizing: border-box;
}
.provincial-electricity-generation-infographic-title-overlay:focus,
.provincial-electricity-generation-infographic-title-overlay:focus-visible {
    outline: 3px solid #ffbf47;
    outline-offset: 2px;
}
            `}</style>

            <div className="provincial-electricity-generation-infographic-wrapper">
                <img src={bgImage} alt="" className="provincial-electricity-generation-bg-image" draggable={false} aria-hidden="true" />
                {title && (
                    <h1 id={titleId} className="provincial-electricity-generation-infographic-title-overlay" tabIndex={0} data-prose-tab="1">
                        {title}
                    </h1>
                )}
                {columns.map((column) => {
                    const block = sources[column.key];
                    if (!block) return null;
                    const spoken = [
                        getText(`electricity_generation_provincial_source_${column.key}`, lang),
                        `${canadaLabel}, ${formatSharePct(block.canada, lang)}`,
                        ...(block.provinces || []).map((row) => `${getText(`electricity_generation_provincial_prov_${row.key}_full`, lang)}, ${formatSharePct(row.value, lang)}`),
                    ].join('. ') + '.';
                    return (
                        <div
                            key={`stop-${column.key}`}
                            className="provincial-electricity-generation-column-stop"
                            style={{ left: `${column.left}%`, width: `${column.width}%` }}
                            tabIndex={0}
                            data-prose-tab="1"
                            role="group"
                            aria-label={spoken}
                        />
                    );
                })}

                <div className="provincial-electricity-generation-overlay-layer" aria-hidden="true">
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
                                    className="provincial-electricity-generation-canada-pct"
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
                                                className="provincial-electricity-generation-prov-abbr"
                                            >
                                                {getText(`electricity_generation_provincial_prov_${row.key}`, lang)}
                                            </OverlaySlot>
                                            <OverlaySlot
                                                left={pctSlot.left}
                                                top={pctSlot.top}
                                                align="right"
                                                className="provincial-electricity-generation-prov-pct"
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
        </figure>
    );
};

export default ProvincialElectricityGenerationInfographic;
