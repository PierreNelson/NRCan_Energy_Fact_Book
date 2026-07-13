import React, { useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import cleanPowerLowCarbonOverviewImage from '../assets/clean_power_low_carbon_overview_bg.jpg';

const CleanPowerLowCarbonOverview = () => {
    const { lang, layoutPadding } = useOutletContext();

    useEffect(() => {
    }, []);

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-59 clean-power-low-carbon-overview-main cover-page" 
            role="main"
            style={{
                backgroundColor: '#819476',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <style>{`

.clean-power-low-carbon-overview-main {
    width: 100%;
    margin-top: 0;
    padding: 0;
}

.clean-power-low-carbon-overview-container {
    width: 100%;
    min-height: calc(100vh - 295px);
    display: flex;
    flex-direction: column;
    flex: 1;
}

.clean-power-low-carbon-overview-image-title-wrapper {
    position: relative;
    width: 100%;
    min-height: 450px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
}

.clean-power-low-carbon-overview-title {
    position: relative;
    z-index: 2;
    width: 100%;
    padding: 0;
    background-color: transparent;
    box-sizing: border-box;
}

.clean-power-low-carbon-overview-title-box {
    background-color: rgba(255, 255, 255, 0.7); 
    padding: 20px ${layoutPadding?.right || 15}px 20px ${layoutPadding?.left || 55}px;
    width: 100%;
    box-sizing: border-box;
}

.clean-power-low-carbon-overview-list {
    width: 100%;
    background-color: #819476;
    padding: 42px ${layoutPadding?.right || 15}px 30px ${layoutPadding?.left || 55}px;
    box-sizing: border-box;
}

.clean-power-low-carbon-overview-title-text {
    font-family: 'Lato', sans-serif;
    font-size: 4.5rem;
    color: #221e1f;
    display: block;
    line-height: 1.15;
    text-shadow: 0px 0px 10px rgba(255, 255, 255, 0.5);
    text-align: left;
}

.clean-power-low-carbon-overview-list-item {
    margin-bottom: 8px;
    font-size: 2.2rem;
    text-align: left;
    color: #ebe8e1;
}

@media (max-width: 1745px) { .clean-power-low-carbon-overview-title-text { font-size: 4.2rem; } }
@media (max-width: 1536px) { .clean-power-low-carbon-overview-title-text { font-size: 4.0rem; } }
@media (max-width: 1280px) { .clean-power-low-carbon-overview-title-text { font-size: 3.8rem; } }
@media (max-width: 1100px) { .clean-power-low-carbon-overview-title-text { font-size: 3.5rem; } }

@media (max-width: 960px) {
    .clean-power-low-carbon-overview-image-title-wrapper { min-height: 350px; }
    .clean-power-low-carbon-overview-title-text { font-size: 3.2rem; }
    .clean-power-low-carbon-overview-list-item { font-size: 1.7rem; }
}

@media (max-width: 640px) {
    .clean-power-low-carbon-overview-title-text { font-size: 2.5rem; }
    .clean-power-low-carbon-overview-list-item { font-size: 1.5rem; }
}

@media (max-width: 480px) {
    .clean-power-low-carbon-overview-image-title-wrapper { min-height: 250px; }
    .clean-power-low-carbon-overview-title-text { font-size: 2.0rem; }
    .clean-power-low-carbon-overview-list-item { font-size: 1.3rem; }
}

            `}</style>

            <div className="clean-power-low-carbon-overview-container">
                <div className="clean-power-low-carbon-overview-image-title-wrapper">
                    <img 
                        src={cleanPowerLowCarbonOverviewImage} 
                        alt={getText('clean_power_low_carbon_overview_image_alt', lang)}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: '50% 35%',
                            zIndex: 0
                        }} 
                    />
                    <div className="clean-power-low-carbon-overview-title">
                        <div className="clean-power-low-carbon-overview-title-box">
                            <h1 className="clean-power-low-carbon-overview-title-text">
                                <span style={{ fontWeight: 'normal' }}>{getText('clean_power_low_carbon_overview_section', lang)}</span>
                                <br />
                                <span style={{ fontWeight: 'bold' }}>{getText('clean_power_low_carbon_overview_title', lang)}</span>
                            </h1>
                        </div>
                    </div>
                </div>

                <nav className="clean-power-low-carbon-overview-list" aria-label={getText('clean_power_low_carbon_overview_nav_label', lang)}>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontFamily: "'Noto Sans', sans-serif" }}>
                        <li className="clean-power-low-carbon-overview-list-item">
                            <Link to="/section-5#clean-technology-economy" style={{ color: 'inherit', textDecoration: 'underline' }}>
                                {getText('clean_power_low_carbon_overview_item1', lang)}
                            </Link>
                        </li>
                        <li className="clean-power-low-carbon-overview-list-item">
                            <Link to="/section-5#renewable-energy-international" style={{ color: 'inherit', textDecoration: 'underline' }}>
                                {getText('clean_power_low_carbon_overview_item2', lang)}
                            </Link>
                        </li>
                        <li className="clean-power-low-carbon-overview-list-item">
                            <Link to="/section-5#biofuels-transportation" style={{ color: 'inherit', textDecoration: 'underline' }}>
                                {getText('clean_power_low_carbon_overview_item3', lang)}
                            </Link>
                        </li>
                    </ul>
                </nav>
            </div>
        </main>
    );
};

export default CleanPowerLowCarbonOverview;
