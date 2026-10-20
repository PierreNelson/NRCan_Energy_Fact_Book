import React, { useLayoutEffect, useRef, useState } from 'react';
import FootnoteMarker from './FootnoteMarker';
import svgEn from '../assets/canadian_crude_reserves_bg.svg?raw';
import svgFr from '../assets/canadian_crude_reserves_bg_fr.svg?raw';

const replaceSvgText = (markup, id, value) => {
    const safe = String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return markup.replace(
        new RegExp(`(<text\\b[^>]*\\bid="${id}"[^>]*>)[\\s\\S]*?(</text>)`),
        `$1${safe}$2`,
    );
};

const CanadianCrudeReservesInfographic = ({
    lang,
    overlayValues,
    formatReserve,
    onFootnoteClick,
    ariaLabel,
    figureRef,
}) => {
    const hostRef = useRef(null);
    const [footnotePos, setFootnotePos] = useState(null);
    let svgMarkup = lang === 'fr' ? svgFr : svgEn;
    svgMarkup = svgMarkup.replace('id="footnote-marker"', 'id="footnote-marker" opacity="0"');
    svgMarkup = replaceSvgText(svgMarkup, 'value-total', formatReserve(overlayValues?.totalBb, 0));
    svgMarkup = replaceSvgText(svgMarkup, 'value-conventional', formatReserve(overlayValues?.conventionalBb, 0));
    svgMarkup = replaceSvgText(svgMarkup, 'value-oil-sands', formatReserve(overlayValues?.oilSandsBb, 0));
    svgMarkup = replaceSvgText(svgMarkup, 'value-mining', formatReserve(overlayValues?.miningBb, 0));
    svgMarkup = replaceSvgText(svgMarkup, 'value-insitu', formatReserve(overlayValues?.insituBb, 0));

    useLayoutEffect(() => {
        const host = hostRef.current;
        const marker = host?.querySelector('#footnote-marker');
        if (!host || !marker) return undefined;
        const placeFootnote = () => {
            const ctm = marker.getScreenCTM();
            const box = marker.getBBox();
            if (!ctm || !box.width) return;
            const point = marker.ownerSVGElement.createSVGPoint();
            point.x = box.x + box.width / 2;
            point.y = box.y + box.height / 2;
            const screen = point.matrixTransform(ctm);
            const hostBox = host.getBoundingClientRect();
            const height = box.height * Math.hypot(ctm.a, ctm.b);
            setFootnotePos({
                left: screen.x - hostBox.left,
                top: screen.y - hostBox.top,
                fontSize: Math.max(13, height),
            });
        };
        placeFootnote();
        const frame = requestAnimationFrame(placeFootnote);
        const observer = new ResizeObserver(placeFootnote);
        observer.observe(host);
        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
        };
    }, [lang, svgMarkup]);

    return (
        <figure
            ref={(node) => {
                hostRef.current = node;
                if (typeof figureRef === 'function') figureRef(node);
                else if (figureRef) figureRef.current = node;
            }}
            className="canadian-crude-reserves-infographic-figure"
            aria-label={ariaLabel}
        >
            <style>{`
.canadian-crude-reserves-infographic-figure {
    position: relative;
    width: 100%;
    margin: 0;
}
.canadian-crude-reserves-infographic-figure svg {
    display: block;
    width: 100%;
    height: auto;
}
.canadian-crude-reserves-footnote-hit {
    position: absolute;
    z-index: 3;
    transform: translate(-50%, -50%);
    line-height: 1;
}
            `}</style>
            <div dangerouslySetInnerHTML={{ __html: svgMarkup }} />
            {footnotePos && (
                <span
                    className="canadian-crude-reserves-footnote-hit"
                    style={{ left: footnotePos.left, top: footnotePos.top, fontSize: footnotePos.fontSize }}
                >
                    <FootnoteMarker
                        lang={lang}
                        href="#fn-dagger-canadian-crude-reserves"
                        id="fn-dagger-rf-canadian-crude-reserves-infographic"
                        marker="**"
                        onClick={onFootnoteClick('fn-dagger-canadian-crude-reserves')}
                    />
                </span>
            )}
        </figure>
    );
};

export default CanadianCrudeReservesInfographic;
