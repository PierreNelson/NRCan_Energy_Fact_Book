import React from 'react';
import AccessibleInfographic from './AccessibleInfographic';
import biomassBg from '../assets/biomass_bg.svg?raw';
import biomassBgFr from '../assets/biomass_bg_fr.svg?raw';

const FN_PREFIX = 'biomass';
const fnRefId = (n) => `fn${n}-rf-${FN_PREFIX}`;
const fnDefId = (n) => `fn${n}-${FN_PREFIX}`;

/**
 * Slots sit in SVG gaps after measured text (bold widths). EN 438×264 · FR 430×238.
 * `top` is the visual center of the text line; CSS uses translateY(-50%) to center the button.
 */
const EN_FN = {
    1: { left: ((67 + 5) / 438) * 100, top: ((20 - 15.5 * 0.36) / 264) * 100 },
    2: { left: ((232.5 + 5) / 438) * 100, top: ((58 - 15.5 * 0.36) / 264) * 100 },
};
const FR_FN = {
    1: { left: ((89 + 5) / 430) * 100, top: ((12 - 15 * 0.36) / 238) * 100 },
    2: { left: ((254 + 5) / 430) * 100, top: ((50 - 15 * 0.36) / 238) * 100 },
};

const FootnoteMark = ({ number, lang, scrollToElement, style }) => (
    <a
        id={fnRefId(number)}
        className="fn-lnk biomass-infographic-fn"
        href={`#${fnDefId(number)}`}
        onClick={scrollToElement(fnDefId(number))}
        style={style}
    >
        <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
        <span aria-hidden="true">{number}</span>
    </a>
);

const BiomassInfographic = ({
    lang,
    scrollToElement,
    title,
}) => {
    const isEn = lang === 'en';
    const fnPos = isEn ? EN_FN : FR_FN;

    return (
        <AccessibleInfographic
            mode="text"
            as="figure"
            className={`biomass-infographic-figure biomass-infographic biomass-infographic-${lang}`}
            title={title || 'Biomass'}
            svgMarkup={isEn ? biomassBg : biomassBgFr}
            imgClassName="biomass-infographic-bg"
            imgStyle={{ width: '100%', height: 'auto', display: 'block' }}
            idPrefix={isEn ? 'biomass-en' : 'biomass-fr'}
        >
            <FootnoteMark
                number="1"
                lang={lang}
                scrollToElement={scrollToElement}
                style={{
                    position: 'absolute',
                    left: `${fnPos[1].left}%`,
                    top: `${fnPos[1].top}%`,
                }}
            />
            <FootnoteMark
                number="2"
                lang={lang}
                scrollToElement={scrollToElement}
                style={{
                    position: 'absolute',
                    left: `${fnPos[2].left}%`,
                    top: `${fnPos[2].top}%`,
                }}
            />
        </AccessibleInfographic>
    );
};

export default BiomassInfographic;
