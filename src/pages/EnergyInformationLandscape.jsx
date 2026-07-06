import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import energyInformationLandscapeBg1 from '../assets/energy_information_landscape_bg1.png';
import energyInformationLandscapeBg2 from '../assets/energy_information_landscape_bg2.png';
import energyInformationLandscapeBg3 from '../assets/energy_information_landscape_bg3.png';
import energyInformationLandscapeBg4 from '../assets/energy_information_landscape_bg4.png';

const energy_information_landscape_ICONS = [energyInformationLandscapeBg1, energyInformationLandscapeBg2, energyInformationLandscapeBg3, energyInformationLandscapeBg4];

const EnergyInformationLandscape = () => {
    const { lang } = useOutletContext();

    const sections = [
        {
            icon: 'federal',
            titleKey: 'energy_information_landscape_heading_federal',
            items: ['energy_information_landscape_federal_1', 'energy_information_landscape_federal_2', 'energy_information_landscape_federal_3', 'energy_information_landscape_federal_4'],
        },
        {
            icon: 'provinces',
            titleKey: 'energy_information_landscape_heading_provinces',
            items: ['energy_information_landscape_provinces_1', 'energy_information_landscape_provinces_2', 'energy_information_landscape_provinces_3'],
        },
        {
            icon: 'industry',
            titleKey: 'energy_information_landscape_heading_industry',
            items: ['energy_information_landscape_industry_1', 'energy_information_landscape_industry_2', 'energy_information_landscape_industry_3'],
        },
        {
            icon: 'researchers',
            titleKey: 'energy_information_landscape_heading_researchers',
            items: ['energy_information_landscape_researchers_1', 'energy_information_landscape_researchers_2', 'energy_information_landscape_researchers_3'],
        },
    ];

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-21 energy-information-landscape-main"
            role="main"
            aria-labelledby="energy-information-landscape-title"
        >
            <style>{`
.energy-information-landscape-main {
    width: 100%;
    margin: 0;
    padding: 0;
    position: relative;
    min-height: 100%;
    background-color: #fff;
}
.energy-information-landscape-container {
    width: 100%;
    max-width: 1140px;
    margin: 0 auto;
    padding: 40px 24px 40px;
    box-sizing: border-box;
}
.energy-information-landscape-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: #332f30;
    margin: 0 0 25px 0;
    line-height: 1.2;
}
.energy-information-landscape-title::after {
    content: '';
    display: block;
    width: 72px;
    height: 6px;
    background-color: #A62A1E;
    margin-top: 0.5em;
}
.energy-information-landscape-intro {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: #332f30;
    margin: 0 0 32px 0;
    line-height: 1.5;
}
.energy-information-landscape-four-col {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
    width: 100%;
}
.energy-information-landscape-col {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
}
.energy-information-landscape-col-head {
    width: fit-content;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 12px;
}
.energy-information-landscape-col-icon {
    margin-bottom: 16px;
    display: flex;
    justify-content: center;
    width: 100%;
}
.energy-information-landscape-col-icon img {
    max-width: 100%;
    height: auto;
    display: block;
}
.energy-information-landscape-col-title {
    font-family: 'Lato', sans-serif;
    font-size: 20px;
    font-weight: bold;
    color: #332f30;
    margin: 0;
    text-transform: none;
    text-align: left;
}
.energy-information-landscape-col ul {
    list-style: disc;
    margin: 0;
    padding-left: 1.2em;
    font-family: 'Noto Sans', sans-serif;
    font-size: 18px;
    color: #332f30;
    line-height: 1.6;
    width: 100%;
    box-sizing: border-box;
}
.energy-information-landscape-col li {
    margin-bottom: 6px;
}
@media (max-width: 900px) {
    .energy-information-landscape-four-col { grid-template-columns: repeat(2, 1fr); }
    .energy-information-landscape-title { font-size: 37px; }
    .energy-information-landscape-intro { font-size: 18px; }
}
@media (max-width: 480px) {
    .energy-information-landscape-four-col { grid-template-columns: 1fr; }
    .energy-information-landscape-container { padding: 24px 16px 40px; }
    .energy-information-landscape-title { font-size: 28px; }
}
            `}</style>
            <div className="energy-information-landscape-container">
                <h1 id="energy-information-landscape-title" className="energy-information-landscape-title">
                    {getText('energy_information_landscape_title', lang)}
                </h1>
                <p className="energy-information-landscape-intro">
                    {getText('energy_information_landscape_intro_before', lang)}{' '}
                    <strong>{getText('energy_information_landscape_intro_org', lang)}</strong>{' '}
                    {getText('energy_information_landscape_intro_after', lang)}
                </p>
                <div className="energy-information-landscape-four-col" role="list">
                    {sections.map((sec, i) => (
                        <section key={sec.icon} className="energy-information-landscape-col" role="listitem" aria-labelledby={`energy-information-landscape-${sec.icon}-title`}>
                            <div className="energy-information-landscape-col-head">
                                <div className="energy-information-landscape-col-icon" aria-hidden="true">
                                    <img src={energy_information_landscape_ICONS[i]} alt="" />
                                </div>
                                <h2 id={`energy-information-landscape-${sec.icon}-title`} className="energy-information-landscape-col-title">
                                    {getText(sec.titleKey, lang)}
                                </h2>
                            </div>
                            <ul>
                                {sec.items.map((key) => (
                                    <li key={key}>{getText(key, lang)}</li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            </div>
        </main>
    );
};

export default EnergyInformationLandscape;
