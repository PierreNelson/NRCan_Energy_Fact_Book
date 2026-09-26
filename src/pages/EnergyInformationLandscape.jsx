import React from 'react';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import { prepareInlineSvgMarkup } from '../utils/prefixSvgIds';
import energyInformationLandscapeBgEn from '../assets/energy_information_landscape_bg.svg?raw';
import energyInformationLandscapeBgFr from '../assets/energy_information_landscape_bg_fr.svg?raw';

/**
 * Page 21 SR pattern (matches other Factbook pages):
 * - Intro: visible <p class="*-intro"> with role="region" + aria-label
 *   (same approach as EnergyAffordability intros — avoids Chromium "group")
 * - Columns: focusable role="region" overlays with aria-label
 *   (same approach as chart regions — header then bullets in the label)
 * - SVG is visual-only (aria-hidden)
 */
const COLUMN_KEYS = [
    {
        heading: 'energy_information_landscape_heading_federal',
        items: [
            'energy_information_landscape_federal_1',
            'energy_information_landscape_federal_2',
            'energy_information_landscape_federal_3',
            'energy_information_landscape_federal_4',
        ],
    },
    {
        heading: 'energy_information_landscape_heading_provinces',
        items: [
            'energy_information_landscape_provinces_1',
            'energy_information_landscape_provinces_2',
            'energy_information_landscape_provinces_3',
        ],
    },
    {
        heading: 'energy_information_landscape_heading_industry',
        items: [
            'energy_information_landscape_industry_1',
            'energy_information_landscape_industry_2',
            'energy_information_landscape_industry_3',
        ],
    },
    {
        heading: 'energy_information_landscape_heading_researchers',
        items: [
            'energy_information_landscape_researchers_1',
            'energy_information_landscape_researchers_2',
            'energy_information_landscape_researchers_3',
        ],
    },
];

function columnSpokenLabel(lang, col) {
    const heading = getText(col.heading, lang);
    const items = col.items.map((k) => getText(k, lang));
    // Header first, then bullets — same order as visual columns
    return [heading, ...items].join('. ');
}

const EnergyInformationLandscape = () => {
    const { lang, layoutPadding } = useOutletContext();
    const pageTitle = getText('energy_information_landscape_title', lang);
    const introBefore = getText('energy_information_landscape_intro_before', lang);
    const introOrg = getText('energy_information_landscape_intro_org', lang);
    const introAfter = getText('energy_information_landscape_intro_after', lang);
    const introLabel = `${introBefore} ${introOrg} ${introAfter}`;

    const svgMarkup = prepareInlineSvgMarkup(
        lang === 'fr' ? energyInformationLandscapeBgFr : energyInformationLandscapeBgEn,
        `eil-${lang}`,
    );

    const columns = COLUMN_KEYS.map((col) => ({
        key: col.heading,
        label: columnSpokenLabel(lang, col),
    }));

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-21 energy-information-landscape-main page-chrome page-chrome--bleed"
            aria-labelledby="energy-information-landscape-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.energy-information-landscape-main {
    width: 100%;
    margin: 0;
    padding: 0;
    background-color: #fff;
}
.energy-information-landscape-inner {
    width: 100%;
    padding: 15px 0 40px 0;
    box-sizing: border-box;
}
.energy-information-landscape-main.page-content h1.energy-information-landscape-title {
    font-family: var(--font-heading);
    font-size: 41px;
    font-weight: bold;
    color: #332f30;
    margin: 0 0 25px 0;
    line-height: 1.2;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: none;
}
.energy-information-landscape-main.page-content h1.energy-information-landscape-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: #A62A1E;
}
.energy-information-landscape-intro {
    font-family: var(--font-body);
    font-size: 20px;
    color: #332f30;
    margin: 0 0 16px 0;
    line-height: 1.5;
    width: 100%;
    box-sizing: border-box;
    border-radius: 2px;
}
.energy-information-landscape-intro:focus,
.energy-information-landscape-intro:focus-visible,
.energy-information-landscape-col:focus,
.energy-information-landscape-col:focus-visible {
    outline: 3px solid #ffbf47;
    outline-offset: 4px;
}
.energy-information-landscape-graphic {
    position: relative;
    width: 100%;
    margin: 0;
}
.energy-information-landscape-graphic-svg,
.energy-information-landscape-graphic-svg svg {
    width: 100%;
    height: auto;
    display: block;
    max-width: none;
}
.energy-information-landscape-cols {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
}
.energy-information-landscape-col {
    min-width: 0;
    min-height: 100%;
    border-radius: 2px;
    box-sizing: border-box;
}
@media (max-width: 900px) {
    .energy-information-landscape-main.page-content h1.energy-information-landscape-title {
        font-size: 37px;
    }
    .energy-information-landscape-intro {
        font-size: 18px;
    }
}
@media (max-width: 480px) {
    .energy-information-landscape-main.page-content h1.energy-information-landscape-title {
        font-size: 28px;
    }
}
            `}</style>

            <div className="energy-information-landscape-inner">
                <h1 id="energy-information-landscape-title" className="energy-information-landscape-title">
                    {pageTitle}
                </h1>

                {/* Same intro pattern as EnergyAffordability: region + aria-label */}
                <p
                    className="energy-information-landscape-intro"
                    role="region"
                    aria-label={introLabel}
                    tabIndex={0}
                    data-prose-tab="1"
                >
                    {introBefore}{' '}
                    <strong>{introOrg}</strong>{' '}
                    {introAfter}
                </p>

                <div className="energy-information-landscape-graphic">
                    <div
                        className="energy-information-landscape-graphic-svg"
                        aria-hidden="true"
                        dangerouslySetInnerHTML={{ __html: svgMarkup }}
                    />
                    {/* Same focusable-region pattern as chart pages (PetroleumGdp, etc.) */}
                    <div className="energy-information-landscape-cols">
                        {columns.map((col, i) => (
                            <div
                                key={col.key}
                                className="energy-information-landscape-col"
                                role="region"
                                aria-label={col.label}
                                tabIndex={0}
                                data-column-index={i}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default EnergyInformationLandscape;
