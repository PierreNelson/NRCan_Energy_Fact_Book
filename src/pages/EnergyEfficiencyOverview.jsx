import React, { useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { getText } from '../utils/translations';
import energyEfficiencyOverviewImage from '../assets/energy_efficiency_overview_bg.jpg';

const EnergyEfficiencyOverview = () => {
    const { lang, layoutPadding } = useOutletContext();

    useEffect(() => {
    }, []);

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-47 energy-efficiency-overview-main cover-page" 
            role="main"
            style={{
                backgroundColor: '#edb95e',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <style>{`

.energy-efficiency-overview-main {
    width: 100%;
    margin: 0;
    padding: 0;
}

.energy-efficiency-overview-container {
    width: 100%;
    min-height: calc(100vh - 295px);
    display: flex;
    flex-direction: column;
    flex: 1;
}

.energy-efficiency-overview-image-title-wrapper {
    position: relative;
    width: 100%;
    min-height: 500px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
}

.energy-efficiency-overview-title {
    position: relative;
    z-index: 2;
    width: 100%;
    padding: 0;
    background-color: transparent;
    box-sizing: border-box;
}

.energy-efficiency-overview-title-box {
    background-color: rgba(255, 255, 255, 0.7); 
    padding: 20px ${layoutPadding?.right || 15}px 20px ${layoutPadding?.left || 55}px;
    width: 100%;
    box-sizing: border-box;
}

.energy-efficiency-overview-list {
    width: 100%;
    background-color: #C58516;
    padding: 30px ${layoutPadding?.right || 15}px 30px ${layoutPadding?.left || 55}px;
    box-sizing: border-box;
}

.energy-efficiency-overview-title-text {
    font-family: 'Lato', sans-serif;
    font-size: 4.5rem;
    color: #221e1f;
    display: block;
    line-height: 1.15;
    text-shadow: 0px 0px 10px rgba(255, 255, 255, 0.5);
    text-align: left;
}

.energy-efficiency-overview-list-item {
    margin-bottom: 8px;
    font-size: 2.2rem;
    text-align: left;
    color: #221e1f;
}

@media (max-width: 1745px) { .energy-efficiency-overview-title-text { font-size: 4.2rem; } }
@media (max-width: 1536px) { .energy-efficiency-overview-title-text { font-size: 4.0rem; } }
@media (max-width: 1280px) { .energy-efficiency-overview-title-text { font-size: 3.8rem; } }
@media (max-width: 1100px) { .energy-efficiency-overview-title-text { font-size: 3.5rem; } }

@media (max-width: 960px) {
    .energy-efficiency-overview-image-title-wrapper { min-height: 350px; }
    .energy-efficiency-overview-title-text { font-size: 3.2rem; }
    .energy-efficiency-overview-list-item { font-size: 1.7rem; }
}

@media (max-width: 640px) {
    .energy-efficiency-overview-title-text { font-size: 2.5rem; }
    .energy-efficiency-overview-list-item { font-size: 1.5rem; }
}

@media (max-width: 480px) {
    .energy-efficiency-overview-image-title-wrapper { min-height: 250px; }
    .energy-efficiency-overview-title-text { font-size: 2.0rem; }
    .energy-efficiency-overview-list-item { font-size: 1.3rem; }
}

            `}</style>

            <div className="energy-efficiency-overview-container">
                <div className="energy-efficiency-overview-image-title-wrapper">
                    <img 
                        src={energyEfficiencyOverviewImage} 
                        alt={getText('energy_efficiency_overview_image_alt', lang)}
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
                    <div className="energy-efficiency-overview-title">
                        <div className="energy-efficiency-overview-title-box">
                            <h1 className="energy-efficiency-overview-title-text">
                                <span style={{ fontWeight: 'normal' }}>{getText('energy_efficiency_overview_section', lang)}</span>
                                <br />
                                <span style={{ fontWeight: 'bold' }}>{getText('energy_efficiency_overview_title', lang)}</span>
                            </h1>
                        </div>
                    </div>
                </div>

                <nav className="energy-efficiency-overview-list" aria-label={getText('energy_efficiency_overview_nav_label', lang)}>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontFamily: "'Noto Sans', sans-serif" }}>
                        <li className="energy-efficiency-overview-list-item"><Link to="/section-4#energy-use" style={{ color: 'inherit', textDecoration: 'underline' }}>{getText('energy_efficiency_overview_item1', lang)}</Link></li>
                        <li className="energy-efficiency-overview-list-item"><Link to="/section-4#efficiency-trends" style={{ color: 'inherit', textDecoration: 'underline' }}>{getText('energy_efficiency_overview_item2', lang)}</Link></li>
                    </ul>
                </nav>
            </div>
        </main>
    );
};

export default EnergyEfficiencyOverview;
