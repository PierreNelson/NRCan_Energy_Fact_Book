import React, { useMemo } from 'react';
import canadianCrudeProductionBgSvg from '../assets/canadian_crude_production_bg.svg';
import {
    BARREL_CLIP_PATH_D,
    BARREL_RIGHT_PCT,
    LEADER_CORRIDOR_MASK,
    NATIVE_SIZE,
    getImageTrimStyles,
    labelRightInsetPct,
} from './CanadianCrudeProductionInfographic.constants';
import { buildCanadianProductionBarrelLayout } from '../utils/buildCanadianProductionBarrelSvg';

export default function CanadianCrudeProductionInfographic({
    lang,
    provinceValues,
    formatPct,
    getProvinceLabel,
    ariaLabel,
    figureRef,
    graphicHeight = 480,
}) {
    const trimStyles = getImageTrimStyles();
    const pctSuffix = lang === 'fr' ? ' %' : '%';
    const maxGraphicHeight = `min(${graphicHeight}px, 42vw)`;

    const layout = useMemo(
        () => buildCanadianProductionBarrelLayout(provinceValues),
        [provinceValues],
    );

    return (
        <div ref={figureRef} className="canadian-crude-production-infographic-figure" aria-label={ariaLabel} role="img">
            <style>{`
.canadian-crude-production-infographic-figure {
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
}
.canadian-crude-production-infographic-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: ${trimStyles.aspectRatio};
    max-height: ${maxGraphicHeight};
    overflow: hidden;
}
.canadian-crude-production-infographic-art {
    position: absolute;
    top: 0;
    height: 100%;
    width: ${trimStyles.artWidth};
    left: ${trimStyles.artLeft};
}
.canadian-crude-production-barrel-svg {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    user-select: none;
    pointer-events: none;
    overflow: visible;
}
.canadian-crude-production-label-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
}
.canadian-crude-production-label-row {
    position: absolute;
    left: ${BARREL_RIGHT_PCT.toFixed(4)}%;
    right: ${labelRightInsetPct.toFixed(4)}%;
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: flex-end;
    align-items: flex-end;
    gap: 0.35em;
    transform: translateY(-100%);
    z-index: 2;
    box-sizing: border-box;
    padding-right: 1px;
}
.canadian-crude-production-label-pct {
    flex: 0 0 auto;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-weight: 700;
    font-size: clamp(10px, 1.2vw, 14px);
    line-height: 1;
    text-align: right;
    white-space: nowrap;
    padding-bottom: 1px;
    background: #ffffff;
}
.canadian-crude-production-label-dot {
    flex: 0 0 auto;
    width: clamp(8px, 0.85vw, 11px);
    height: clamp(8px, 0.85vw, 11px);
    border-radius: 50%;
    margin-bottom: 1px;
    z-index: 1;
}
.canadian-crude-production-label-name {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 100%;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-weight: 700;
    font-size: clamp(10px, 1.2vw, 14px);
    line-height: 1.15;
    color: #000000;
    text-align: left;
    white-space: normal;
    overflow-wrap: break-word;
    word-break: normal;
    hyphens: auto;
    padding-bottom: 1px;
    background: #ffffff;
}
            `}</style>

            <div className="canadian-crude-production-infographic-wrapper">
                <div className="canadian-crude-production-infographic-art">
                    <svg
                        className="canadian-crude-production-barrel-svg"
                        viewBox={`0 0 ${NATIVE_SIZE.width} ${NATIVE_SIZE.height}`}
                        preserveAspectRatio="none"
                        aria-hidden="true"
                    >
                        <defs>
                            <clipPath id="canadian-crude-production-barrel-clip">
                                <path d={BARREL_CLIP_PATH_D} />
                            </clipPath>
                        </defs>
                        <image
                            href={canadianCrudeProductionBgSvg}
                            width={NATIVE_SIZE.width}
                            height={NATIVE_SIZE.height}
                            preserveAspectRatio="none"
                        />
                        <rect
                            x={LEADER_CORRIDOR_MASK.x}
                            y={LEADER_CORRIDOR_MASK.y}
                            width={LEADER_CORRIDOR_MASK.width}
                            height={LEADER_CORRIDOR_MASK.height}
                            fill="#ffffff"
                        />
                        <g clipPath="url(#canadian-crude-production-barrel-clip)">
                            <path d={BARREL_CLIP_PATH_D} fill="#ffffff" />
                            {layout.segments.map((segment) => (
                                <rect
                                    key={segment.key}
                                    x={0}
                                    y={segment.y}
                                    width={NATIVE_SIZE.width}
                                    height={segment.height}
                                    fill={segment.color}
                                />
                            ))}
                        </g>
                        {layout.labels.map((label) => (
                            <polyline
                                key={`leader-${label.key}`}
                                points={label.leaderPoints.map(([x, y]) => `${x},${y}`).join(' ')}
                                fill="none"
                                stroke={label.color}
                                strokeWidth="0.75"
                            />
                        ))}
                    </svg>

                    <div className="canadian-crude-production-label-overlay" aria-hidden="true">
                        {layout.labels.map((label) => {
                            const pctText = label.sharePct != null
                                ? `${formatPct(label.sharePct, 1)}${pctSuffix}`
                                : null;
                            return (
                                <div
                                    key={label.key}
                                    className="canadian-crude-production-label-row"
                                    style={{ top: `${label.slotTopPct}%` }}
                                >
                                    <span className="canadian-crude-production-label-pct" style={{ color: label.color }}>
                                        {pctText}
                                    </span>
                                    <span
                                        className="canadian-crude-production-label-dot"
                                        style={{ backgroundColor: label.color }}
                                    />
                                    <span className="canadian-crude-production-label-name">
                                        {getProvinceLabel(label.key)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
