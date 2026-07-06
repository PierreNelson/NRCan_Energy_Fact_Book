import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import energyInformationLandscapeBg1 from '../assets/energy_information_landscape_bg1.png';
import energyInformationLandscapeBg2 from '../assets/energy_information_landscape_bg2.png';
import energyInformationLandscapeBg3 from '../assets/energy_information_landscape_bg3.png';

const ResearchDevelopmentDemonstration = () => {
    const { lang } = useOutletContext();

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-34"
            role="main"
            aria-labelledby="research-development-demonstration-title"
            style={{
                backgroundColor: 'white',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',
                boxSizing: 'border-box',
            }}
        >
            <style>{`
.page-34 { width: 100%; }
.research-development-demonstration-container {
    width: 100%;
    padding: 15px 0 32px 0;
    box-sizing: border-box;
}
.research-development-demonstration-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin-top: 5px;
    margin-bottom: 25px;
    line-height: 1.3;
    position: relative;
    padding-bottom: 0.5em;
}
.research-development-demonstration-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.research-development-demonstration-subtitle {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    font-weight: bold;
    color: #332f30;
    margin: 0 0 16px 0;
    line-height: 1.45;
    max-width: 80ch;
    text-transform: none;
}
.research-development-demonstration-intro {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: #332f30;
    margin: 0 0 28px 0;
    line-height: 1.5;
    max-width: 80ch;
}
.research-development-demonstration-row {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 20px;
    margin-bottom: 28px;
    width: 100%;
    box-sizing: border-box;
}
.research-development-demonstration-row-icon {
    flex: 0 0 auto;
    width: 96px;
    min-width: 72px;
    padding-top: 4px;
}
.research-development-demonstration-row-icon img {
    width: 100%;
    height: auto;
    display: block;
}
.research-development-demonstration-row-body {
    flex: 1 1 auto;
    min-width: 0;
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: #332f30;
    line-height: 1.5;
}
.research-development-demonstration-row-body p {
    margin: 0 0 14px 0;
}
.research-development-demonstration-row-body p:last-child {
    margin-bottom: 0;
}
@media (max-width: 768px) {
    .research-development-demonstration-title { font-size: 37px; }
    .research-development-demonstration-subtitle,
    .research-development-demonstration-intro,
    .research-development-demonstration-row-body { font-size: 18px; }
    .research-development-demonstration-row { flex-direction: column; gap: 12px; }
    .research-development-demonstration-row-icon { width: 80px; }
}
            `}</style>
            <div className="research-development-demonstration-container">
                <h1 id="research-development-demonstration-title" className="research-development-demonstration-title">
                    {getText('research_development_demonstration_title', lang)}
                </h1>
                <p className="research-development-demonstration-subtitle">{getText('research_development_demonstration_subtitle', lang)}</p>
                <p className="research-development-demonstration-intro">{getText('research_development_demonstration_intro', lang)}</p>

                <div className="research-development-demonstration-row" role="region" aria-label={getText('research_development_demonstration_row_federal_aria', lang)}>
                    <div className="research-development-demonstration-row-icon" aria-hidden="true">
                        <img src={energyInformationLandscapeBg1} alt="" width={120} height={120} />
                    </div>
                    <div className="research-development-demonstration-row-body">
                        <p>
                            {getText('research_development_demonstration_federal_p1_pre', lang)}
                            <strong>{getText('research_development_demonstration_federal_p1_bold', lang)}</strong>
                            {getText('research_development_demonstration_federal_p1_post', lang)}
                        </p>
                        <p>
                            {getText('research_development_demonstration_federal_p2_pre', lang)}
                            <strong>{getText('research_development_demonstration_federal_p2_bold_2b', lang)}</strong>
                            {getText('research_development_demonstration_federal_p2_mid', lang)}
                            <strong>{getText('research_development_demonstration_federal_p2_bold_138', lang)}</strong>
                            {getText('research_development_demonstration_federal_p2_post', lang)}
                        </p>
                    </div>
                </div>

                <div className="research-development-demonstration-row" role="region" aria-label={getText('research_development_demonstration_row_pt_aria', lang)}>
                    <div className="research-development-demonstration-row-icon" aria-hidden="true">
                        <img src={energyInformationLandscapeBg2} alt="" width={120} height={120} />
                    </div>
                    <div className="research-development-demonstration-row-body">
                        <p>
                            {getText('research_development_demonstration_pt_pre', lang)}
                            <strong>{getText('research_development_demonstration_pt_bold1', lang)}</strong>
                            {getText('research_development_demonstration_pt_mid1', lang)}
                            <strong>{getText('research_development_demonstration_pt_bold2', lang)}</strong>
                            {getText('research_development_demonstration_pt_mid2', lang)}
                            <strong>{getText('research_development_demonstration_pt_bold3', lang)}</strong>
                            {getText('research_development_demonstration_pt_mid3', lang)}
                            <strong>{getText('research_development_demonstration_pt_bold4', lang)}</strong>
                            {getText('research_development_demonstration_pt_post', lang)}
                        </p>
                    </div>
                </div>

                <div className="research-development-demonstration-row" role="region" aria-label={getText('research_development_demonstration_row_industry_aria', lang)}>
                    <div className="research-development-demonstration-row-icon" aria-hidden="true">
                        <img src={energyInformationLandscapeBg3} alt="" width={120} height={120} />
                    </div>
                    <div className="research-development-demonstration-row-body">
                        <p>
                            {getText('research_development_demonstration_industry_pre', lang)}
                            <strong>{getText('research_development_demonstration_industry_bold1', lang)}</strong>
                            {getText('research_development_demonstration_industry_mid', lang)}
                            <strong>{getText('research_development_demonstration_industry_bold2', lang)}</strong>
                            {getText('research_development_demonstration_industry_post', lang)}
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default ResearchDevelopmentDemonstration;
