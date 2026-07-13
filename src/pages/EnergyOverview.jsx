import React from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { getText } from '../utils/translations';
import energyOverviewImage from '../assets/energy_overview_bg.jpg';

const EnergyOverview = () => {
    const { lang } = useOutletContext();

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-1 energy-overview-main cover-page" 
            role="main"
            style={{
                backgroundColor: '#5a7a8a',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <style>{`

                .energy-overview-main {
                    width: 100%;
                    padding: 0;
                }

                .energy-overview-container {
                    width: 100%;
                    min-height: 0;
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                }

                .energy-overview-image-title-wrapper {
                    position: relative;
                    width: 100%;
                    min-height: 500px; 
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-end;
                }

                .energy-overview-image {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 0;
                }

                .energy-overview-image img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    object-position: 50% 65%;
                }

                .energy-overview-title {
                    position: relative;
                    z-index: 1;
                    width: 100%;
                    padding: 0;
                    background-color: transparent;
                    box-sizing: border-box;
                }

                .energy-overview-title-box {
                    background-color: rgba(255, 255, 255, 0.7); 
                    padding: 20px;
                    width: 100%;
                    box-sizing: border-box;
                }

                .energy-overview-list {
                    width: 100%;
                    background-color: #245e7f;
                    padding: 30px 20px;
                    box-sizing: border-box;
                    flex: 1;
                }

                .energy-overview-title-text {
                    font-family: 'Lato', sans-serif;
                    font-size: 4.5rem; 
                    color: #221e1f;
                    display: block;
                    line-height: 1.15;
                    text-shadow: 0px 0px 10px rgba(255, 255, 255, 0.5);
                }

                .energy-overview-list-item {
                    margin-bottom: 8px;
                    font-size: 2.2rem; 
                }

                .energy-overview-list-item a {
                    color: #ebe8e1;
                    text-decoration: underline;
                    transition: color 0.2s ease;
                }

                .energy-overview-list-item a:hover,
                .energy-overview-list-item a:focus {
                    color: #ffffff;
                    text-decoration: underline;
                }

                .energy-overview-list-item a:focus {
                    outline: 2px solid #ffffff;
                    outline-offset: 2px;
                }

                @media (max-width: 1745px) { .energy-overview-title-text { font-size: 4.2rem; } }
                @media (max-width: 1536px) { .energy-overview-title-text { font-size: 4.0rem; } }
                @media (max-width: 1280px) { .energy-overview-title-text { font-size: 3.8rem; } }
                @media (max-width: 1100px) { .energy-overview-title-text { font-size: 3.5rem; } }

                @media (max-width: 960px) {
                    .energy-overview-image-title-wrapper { min-height: 350px; }
                    .energy-overview-title-text { font-size: 3.2rem; }
                    .energy-overview-list-item { font-size: 1.7rem; }
                }

                @media (max-width: 640px) {
                    .energy-overview-title-text { font-size: 2.5rem; }
                    .energy-overview-list-item { font-size: 1.5rem; }
                }

                @media (max-width: 480px) {
                    .energy-overview-image-title-wrapper { min-height: 250px; }
                    .energy-overview-title-text { font-size: 2.0rem; }
                    .energy-overview-list-item { font-size: 1.3rem; }
                }
            `}</style>

            <div className="energy-overview-container">
                <div className="energy-overview-image-title-wrapper">
                    <div className="energy-overview-image" aria-hidden="true">
                        <img src={energyOverviewImage} alt="" />
                    </div>

                    <header className="energy-overview-title">
                        <div className="energy-overview-title-box">
                            <h1 style={{ margin: 0 }}>
                                <span className="energy-overview-title-text" style={{ fontWeight: 'normal' }}>
                                    {getText('energy_overview_section', lang)}
                                </span>
                                <span className="energy-overview-title-text" style={{ fontWeight: 'bold', lineHeight: '1.1', display: 'block' }}>
                                    {getText('energy_overview_title', lang)}
                                </span>
                            </h1>
                        </div>
                    </header>
                </div>

                <nav className="energy-overview-list" aria-label={lang === 'en' ? 'Section topics' : 'Sujets de la section'}>
                    <ul style={{
                        listStyleType: 'none',
                        padding: '0',
                        margin: '0',
                        color: '#ebe8e1',
                        fontFamily: "'Noto Sans', sans-serif"
                    }}>
                        <li className="energy-overview-list-item">
                            <Link to="/section-1#energy-production">
                                {getText('energy_overview_item1', lang)}
                            </Link>
                        </li>
                        <li className="energy-overview-list-item">
                            <Link to="/section-1#economic-contributions">
                                {getText('energy_overview_item2', lang)}
                            </Link>
                        </li>
                        <li className="energy-overview-list-item">
                            <Link to="/section-1#energy-and-ghg-emissions">
                                {getText('energy_overview_item3', lang)}
                            </Link>
                        </li>
                    </ul>
                </nav>
            </div>
        </main>
    );
};

export default EnergyOverview;
