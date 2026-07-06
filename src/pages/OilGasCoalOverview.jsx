import React, { useEffect } from 'react';
import { NavLink, useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import oilGasCoalOverviewImage from '../assets/oil_gas_coal_overview_bg.jpg';

const OilGasCoalOverview = () => {
    const { lang, layoutPadding } = useOutletContext();

    useEffect(() => {
    }, []);

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-103 oil-gas-coal-overview-main cover-page" 
            role="main"
            style={{
                backgroundColor: '#58504a',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <style>{`

.oil-gas-coal-overview-main {
    width: 100%;
    margin-top: 0;
    padding: 0;
}

.oil-gas-coal-overview-container {
    width: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    flex: 1;
}

.oil-gas-coal-overview-image-title-wrapper {
    position: relative;
    width: 100%;
    min-height: 320px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
}

.oil-gas-coal-overview-title {
    position: relative;
    z-index: 2;
    width: 100%;
    padding: 0;
    background-color: transparent;
    box-sizing: border-box;
}

.oil-gas-coal-overview-title-box {
    background-color: rgba(255, 255, 255, 0.7); 
    padding: 20px ${layoutPadding?.right || 15}px 20px ${layoutPadding?.left || 55}px;
    width: 100%;
    box-sizing: border-box;
}

.oil-gas-coal-overview-list {
    width: 100%;
    background-color: #423330;
    padding: 30px ${layoutPadding?.right || 15}px 30px ${layoutPadding?.left || 55}px;
    box-sizing: border-box;
    flex: 1;
}

.oil-gas-coal-overview-title-text {
    font-family: 'Lato', sans-serif;
    font-size: 4.5rem;
    color: #221e1f;
    display: block;
    line-height: 1.15;
    text-shadow: 0px 0px 10px rgba(255, 255, 255, 0.5);
    text-align: left;
}

.oil-gas-coal-overview-list-item {
    margin-bottom: 8px;
    font-size: 2.2rem;
    text-align: left;
    color: #ebe8e1;
}

.oil-gas-coal-overview-list-item a {
    color: #ebe8e1;
    text-decoration: underline;
    transition: color 0.2s ease;
}

.oil-gas-coal-overview-list-item a:hover,
.oil-gas-coal-overview-list-item a:focus {
    color: #ffffff;
    text-decoration: underline;
}

.oil-gas-coal-overview-list-item a:visited {
    color: #ebe8e1;
}

.oil-gas-coal-overview-list-item a:focus {
    outline: 2px solid #ffffff;
    outline-offset: 2px;
}

@media (max-width: 1745px) { .oil-gas-coal-overview-title-text { font-size: 4.2rem; } }
@media (max-width: 1536px) { .oil-gas-coal-overview-title-text { font-size: 4.0rem; } }
@media (max-width: 1280px) { .oil-gas-coal-overview-title-text { font-size: 3.8rem; } }
@media (max-width: 1100px) { .oil-gas-coal-overview-title-text { font-size: 3.5rem; } }

@media (max-width: 960px) {
    .oil-gas-coal-overview-image-title-wrapper { min-height: 240px; }
    .oil-gas-coal-overview-title-text { font-size: 3.2rem; }
    .oil-gas-coal-overview-list-item { font-size: 1.7rem; }
}

@media (max-width: 640px) {
    .oil-gas-coal-overview-title-text { font-size: 2.5rem; }
    .oil-gas-coal-overview-list-item { font-size: 1.5rem; }
}

@media (max-width: 480px) {
    .oil-gas-coal-overview-image-title-wrapper { min-height: 180px; }
    .oil-gas-coal-overview-title-text { font-size: 2.0rem; }
    .oil-gas-coal-overview-list-item { font-size: 1.3rem; }
}

            `}</style>

            <div className="oil-gas-coal-overview-container">
                <div className="oil-gas-coal-overview-image-title-wrapper">
                    <img 
                        src={oilGasCoalOverviewImage} 
                        alt={getText('oil_gas_coal_overview_image_alt', lang)}
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
                    <div className="oil-gas-coal-overview-title">
                        <div className="oil-gas-coal-overview-title-box">
                            <h1 className="oil-gas-coal-overview-title-text">
                                <span style={{ fontWeight: 'normal' }}>{getText('oil_gas_coal_overview_section', lang)}</span>
                                <br />
                                <span style={{ fontWeight: 'bold' }}>{getText('oil_gas_coal_overview_title', lang)}</span>
                            </h1>
                        </div>
                    </div>
                </div>

                <nav className="oil-gas-coal-overview-list" aria-label={getText('oil_gas_coal_overview_nav_label', lang)}>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontFamily: "'Noto Sans', sans-serif" }}>
                        <li className="oil-gas-coal-overview-list-item">
                            <NavLink to="/section-6#crude-oil-international">{getText('oil_gas_coal_overview_item1', lang)}</NavLink>
                        </li>
                        <li className="oil-gas-coal-overview-list-item">
                            <NavLink to="/section-6#natural-gas-international">{getText('oil_gas_coal_overview_item2', lang)}</NavLink>
                        </li>
                        <li className="oil-gas-coal-overview-list-item">{getText('oil_gas_coal_overview_item3', lang)}</li>
                        <li className="oil-gas-coal-overview-list-item">
                            <NavLink to="/section-6#refined-petroleum-products">{getText('oil_gas_coal_overview_item4', lang)}</NavLink>
                        </li>
                        <li className="oil-gas-coal-overview-list-item">
                            <NavLink to="/section-6#coal-international">{getText('oil_gas_coal_overview_item5', lang)}</NavLink>
                        </li>
                        <li className="oil-gas-coal-overview-list-item">{getText('oil_gas_coal_overview_item6', lang)}</li>
                    </ul>
                </nav>
            </div>
        </main>
    );
};

export default OilGasCoalOverview;
