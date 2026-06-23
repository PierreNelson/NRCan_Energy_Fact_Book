import React from 'react';
import page57Bg from '../assets/page57_bg.svg';

const NATIVE_SIZE = { width: 718.37335, height: 531.50665 };

const SECTOR_KEYS = [
    'residential',
    'commercial',
    'transportation_passenger',
    'freight',
    'industrial_full',
    'industrial_no_mining',
];

const SECTOR_DATA = {
    residential: { energyUse: 6, energyIntensity: -30 },
    commercial: { energyUse: 21, energyIntensity: -5 },
    transportation_passenger: { energyUse: -14, energyIntensity: -17 },
    freight: { energyUse: 24, energyIntensity: -7 },
    industrial_full: { energyUse: 21, energyIntensity: -3 },
    industrial_no_mining: { energyUse: -15, energyIntensity: -29 },
};

const SVG_SCALE = 0.13333333;
const TOTAL_W = NATIVE_SIZE.width;

/** Column x-ranges from page57_bg.svg sector colour blocks (source coords × scale). */
const svgColumnBounds = (xMin, xMax) => {
    const leftPx = xMin * SVG_SCALE;
    const widthPx = (xMax - xMin) * SVG_SCALE;
    return {
        left: (leftPx / TOTAL_W) * 100,
        width: (widthPx / TOTAL_W) * 100,
    };
};

const COLUMN_BOUNDS = {
    residential: svgColumnBounds(0, 930.477),
    commercial: svgColumnBounds(930.477, 1832.3),
    transportation_passenger: svgColumnBounds(1822.72, 2773.77),
    freight: svgColumnBounds(2773.77, 3578.94),
    industrial_full: svgColumnBounds(3576.65, 4380.68),
    industrial_no_mining: svgColumnBounds(4380.68, 5384.43),
};

const COLUMN_LAYOUT = {
    residential: { titleTop: 52.5, useTop: 77.5, intensityTop: 87.5 },
    commercial: { titleTop: 52.5, useTop: 77.5, intensityTop: 87.5 },
    transportation_passenger: { titleTop: 52.7, useTop: 77.5, intensityTop: 87.5 },
    freight: { titleTop: 52.5, useTop: 77.5, intensityTop: 87.5 },
    industrial_full: { titleTop: 52.7, useTop: 77.5, intensityTop: 87.5 },
    industrial_no_mining: { titleTop: 52.7, useTop: 77.5, intensityTop: 87.5 },
};

const METRIC_INSET = {
    en: { default: { padL: 5, padR: 4 }, narrow: { padL: 4, padR: 3 } },
    fr: { default: { padL: 3.5, padR: 2.5 }, narrow: { padL: 3, padR: 2 } },
};

const NARROW_COLUMNS = new Set(['freight', 'industrial_full', 'industrial_no_mining']);

const getMetricInsets = (sectorKey, lang) => {
    const locale = lang === 'fr' ? 'fr' : 'en';
    const bucket = NARROW_COLUMNS.has(sectorKey) ? 'narrow' : 'default';
    return METRIC_INSET[locale][bucket];
};

const formatPct = (value, lang) => {
    const sign = value > 0 ? '+' : value < 0 ? '-' : '';
    const abs = Math.abs(value);
    return lang === 'fr' ? `${sign}${abs} %` : `${sign}${abs}%`;
};

const SectorColumn = ({ sectorKey, lang, getText }) => {
    const layout = COLUMN_LAYOUT[sectorKey];
    const bounds = COLUMN_BOUNDS[sectorKey];
    const data = SECTOR_DATA[sectorKey];
    const titleHtml = getText(`page57_sector_${sectorKey}`, lang);
    const useLabelHtml = getText('page57_energy_use', lang);
    const intensityLabelHtml = getText('page57_energy_intensity', lang);
    const insets = getMetricInsets(sectorKey, lang);
    const metricRowStyle = {
        paddingLeft: `${insets.padL}%`,
        paddingRight: `${insets.padR}%`,
    };

    return (
        <div
            className="page57-column"
            style={{
                left: `${bounds.left}%`,
                width: `${bounds.width}%`,
            }}
        >
            <p
                className="page57-sector-title"
                style={{ top: `${layout.titleTop}%` }}
                dangerouslySetInnerHTML={{ __html: titleHtml }}
            />
            <div className="page57-metric-row" style={{ top: `${layout.useTop}%`, ...metricRowStyle }}>
                <span
                    className="page57-metric-label"
                    dangerouslySetInnerHTML={{ __html: useLabelHtml }}
                />
                <span className="page57-metric-value">{formatPct(data.energyUse, lang)}</span>
            </div>
            <div className="page57-metric-row" style={{ top: `${layout.intensityTop}%`, ...metricRowStyle }}>
                <span
                    className="page57-metric-label"
                    dangerouslySetInnerHTML={{ __html: intensityLabelHtml }}
                />
                <span className="page57-metric-value">{formatPct(data.energyIntensity, lang)}</span>
            </div>
        </div>
    );
};

const Page57SectorTrendsInfographic = ({ figureRef, lang, getText, ariaLabel, title, titleId }) => {
    const isFr = lang === 'fr';

    return (
    <figure ref={figureRef} className="page57-infographic-figure" aria-label={ariaLabel}>
        <style>{`
.page57-infographic-figure {
    display: block;
    width: 100%;
    max-width: none;
    margin: 0;
}
.page57-infographic-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: ${NATIVE_SIZE.width} / ${NATIVE_SIZE.height};
    container-type: inline-size;
    background: #ffffff;
}
.page57-bg-image {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    user-select: none;
    pointer-events: none;
}
.page57-column {
    position: absolute;
    top: 0;
    height: 100%;
    box-sizing: border-box;
    pointer-events: none;
}
.page57-sector-title {
    position: absolute;
    left: 0;
    right: 0;
    margin: 0;
    padding: 0 5%;
    font-family: 'Noto Sans', sans-serif;
    font-size: 1.85cqw;
    font-weight: 700;
    line-height: 1.12;
    color: #ffffff;
    text-align: center;
    text-transform: uppercase;
}
.page57-sector-title .page57-sector-subtitle {
    display: block;
    width: 100%;
    margin-top: 0.08em;
    font-size: 1.25cqw;
    font-weight: 400;
    line-height: 1.14;
    text-align: center;
    text-transform: none;
}
.page57-metric-row {
    position: absolute;
    left: 0;
    right: 0;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.2rem;
}
.page57-metric-label {
    flex: 0 1 auto;
    max-width: 54%;
    font-family: 'Noto Sans', sans-serif;
    font-size: 1.65cqw;
    font-weight: 400;
    line-height: 1.08;
    color: #ffffff;
    text-align: left;
}
.page57-metric-value {
    flex: 0 0 auto;
    margin-left: auto;
    font-family: 'Lato', sans-serif;
    font-size: 2.75cqw;
    font-weight: 700;
    line-height: 1;
    color: #ffffff;
    text-align: right;
    white-space: nowrap;
}
.page-57.page-content .page57-infographic-figure p.page57-sector-title {
    font-size: 1.85cqw;
    line-height: 1.12;
    color: #ffffff;
    text-align: center !important;
}
.page-57.page-content .page57-infographic-figure p.page57-sector-title .page57-sector-subtitle {
    display: block;
    width: 100%;
    font-size: 1.25cqw;
    font-weight: 400;
    text-align: center !important;
}
.page-57.page-content .page57-infographic-figure span.page57-metric-label {
    font-size: 1.65cqw;
    color: #ffffff;
}
.page-57.page-content .page57-infographic-figure span.page57-metric-value {
    font-size: 2.75cqw;
    color: #ffffff;
}
.page57-infographic-wrapper--fr .page57-sector-title {
    font-size: 1.72cqw;
}
.page57-infographic-wrapper--fr .page57-sector-title .page57-sector-subtitle {
    font-size: 1.12cqw;
}
.page57-infographic-wrapper--fr .page57-metric-row {
    gap: 0.1rem;
}
.page57-infographic-wrapper--fr .page57-metric-label {
    max-width: 48%;
    font-size: 1.32cqw;
}
.page57-infographic-wrapper--fr .page57-metric-value {
    font-size: 2.15cqw;
}
.page-57.page-content .page57-infographic-wrapper--fr p.page57-sector-title {
    font-size: 1.72cqw;
}
.page-57.page-content .page57-infographic-wrapper--fr p.page57-sector-title .page57-sector-subtitle {
    font-size: 1.12cqw;
}
.page-57.page-content .page57-infographic-wrapper--fr span.page57-metric-label {
    font-size: 1.32cqw;
}
.page-57.page-content .page57-infographic-wrapper--fr span.page57-metric-value {
    font-size: 2.15cqw;
}
.page57-infographic-title-overlay {
    position: absolute;
    top: 2.5%;
    left: 0;
    right: 0;
    z-index: 3;
    margin: 0;
    padding: 0 3%;
    font-family: 'Lato', sans-serif;
    font-weight: bold;
    font-size: 3.4cqw;
    line-height: 1.15;
    color: #333333;
    text-align: center;
    text-transform: none;
    pointer-events: none;
    box-sizing: border-box;
}
@media (max-width: 768px) {
    .page57-sector-title { font-size: 2.1cqw; }
    .page57-sector-title .page57-sector-subtitle { font-size: 1.4cqw; }
    .page57-metric-label { font-size: 1.85cqw; }
    .page57-metric-value { font-size: 3.05cqw; }
    .page57-infographic-wrapper--fr .page57-sector-title { font-size: 1.95cqw; }
    .page57-infographic-wrapper--fr .page57-sector-title .page57-sector-subtitle { font-size: 1.25cqw; }
    .page57-infographic-wrapper--fr .page57-metric-label { font-size: 1.5cqw; }
    .page57-infographic-wrapper--fr .page57-metric-value { font-size: 2.45cqw; }
}
        `}</style>

        <div className={`page57-infographic-wrapper${isFr ? ' page57-infographic-wrapper--fr' : ''}`}>
            <img src={page57Bg} alt="" className="page57-bg-image" draggable={false} aria-hidden="true" />
            {title && (
                <h2 id={titleId} className="page57-infographic-title-overlay">
                    {title}
                </h2>
            )}
            {SECTOR_KEYS.map((key) => (
                <SectorColumn key={key} sectorKey={key} lang={lang} getText={getText} />
            ))}
        </div>
        <figcaption className="wb-inv">{ariaLabel}</figcaption>
    </figure>
    );
};

export default Page57SectorTrendsInfographic;
