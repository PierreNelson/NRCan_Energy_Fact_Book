import React, { useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { getText } from '../utils/translations';
import { getCapitalExpendituresData, getInfrastructureData, getEconomicContributionsData } from '../utils/dataLoader';
import investmentOverviewImage from '../assets/investment_overview_bg.jpg';

const Investment = () => {
    const { lang, layoutPadding } = useOutletContext();

    useEffect(() => {
        getCapitalExpendituresData();
        getInfrastructureData();
        getEconomicContributionsData();
    }, []);

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-23 investment-overview-main cover-page" 
            role="main"
            style={{
                backgroundColor: '#8a7d5a',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <style>{`

.investment-overview-main {
    width: 100%;
    padding: 0;
}

.investment-overview-container {
    width: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    flex: 1;
}

.investment-overview-image-title-wrapper {
    position: relative;
    width: 100%;
    min-height: 320px; 
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
}

.investment-overview-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
}

.investment-overview-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 65%;
}

.investment-overview-title {
    position: relative;
    z-index: 1;
    width: 100%;
    padding: 0;
    background-color: transparent;
    box-sizing: border-box;
}

.investment-overview-title-box {
    background-color: rgba(255, 255, 255, 0.7); 
    padding: 20px ${layoutPadding?.right || 15}px 20px ${layoutPadding?.left || 55}px;
    width: 100%;
    box-sizing: border-box;
}

.investment-overview-list {
    width: 100%;
    background-color: #8a7d5a;
    padding: 30px ${layoutPadding?.right || 15}px 30px ${layoutPadding?.left || 55}px;
    box-sizing: border-box;
    flex: 1;
}

.investment-overview-title-text {
    font-family: 'Lato', sans-serif;
    font-size: 4.5rem;
    color: #221e1f;
    display: block;
    line-height: 1.15;
    text-shadow: 0px 0px 10px rgba(255, 255, 255, 0.5);
    text-align: left;
}

.investment-overview-list-item {
    margin-bottom: 8px;
    font-size: 2.2rem;
    text-align: left;
}

.investment-overview-list-item a {
    color: #ebe8e1;
    text-decoration: underline;
    transition: color 0.2s ease;
}

.investment-overview-list-item a:hover,
.investment-overview-list-item a:focus {
    color: #ffffff;
    text-decoration: underline;
}

.investment-overview-list-item a:focus {
    outline: 2px solid #ffffff;
    outline-offset: 2px;
}

@media (max-width: 1745px) { .investment-overview-title-text { font-size: 4.2rem; } }
@media (max-width: 1536px) { .investment-overview-title-text { font-size: 4.0rem; } }
@media (max-width: 1280px) { .investment-overview-title-text { font-size: 3.8rem; } }
@media (max-width: 1100px) { .investment-overview-title-text { font-size: 3.5rem; } }

@media (max-width: 960px) {
    .investment-overview-image-title-wrapper { min-height: 240px; }
    .investment-overview-title-text { font-size: 3.2rem; }
    .investment-overview-list-item { font-size: 1.7rem; }
}

@media (max-width: 640px) {
    .investment-overview-title-text { font-size: 2.5rem; }
    .investment-overview-list-item { font-size: 1.5rem; }
}

@media (max-width: 480px) {
    .investment-overview-image-title-wrapper { min-height: 180px; }
    .investment-overview-title-text { font-size: 2.0rem; }
    .investment-overview-list-item { font-size: 1.3rem; }
}

@media (max-width: 384px) {
    .investment-overview-image-title-wrapper { min-height: 160px; }
    .investment-overview-title-text { font-size: 1.8rem; }
    .investment-overview-list-item { font-size: 1.2rem; }
}
            `}</style>

            <div className="investment-overview-container">
                <div className="investment-overview-image-title-wrapper">
                    <div className="investment-overview-image" aria-hidden="true">
                        <img
                            src={investmentOverviewImage}
                            alt=""
                        />
                    </div>

                    <header className="investment-overview-title">
                        <div className="investment-overview-title-box">
                            <h1 style={{ margin: 0 }}>
                                <span className="investment-overview-title-text" style={{ fontWeight: 'normal' }}>
                                    {getText('investment_section', lang)}
                                </span>
                                <span className="investment-overview-title-text" style={{ fontWeight: 'bold', lineHeight: '1.1', whiteSpace: 'nowrap' }}>
                                    {getText('investment_title', lang)}
                                </span>
                            </h1>
                        </div>
                    </header>
                </div>

                <nav className="investment-overview-list" aria-label={lang === 'en' ? 'Section topics' : 'Sujets de la section'}>
                    <ul style={{
                        listStyleType: 'none',
                        padding: '0',
                        margin: '0',
                        color: '#ebe8e1',
                        fontFamily: "'Noto Sans', sans-serif"
                    }}>
                        <li className="investment-overview-list-item">
                            <Link to="/section-2#capital-expenditure">
                                {getText('investment_item1', lang)}
                            </Link>
                        </li>
                        <li className="investment-overview-list-item">
                            <Link to="/section-2#infrastructure-stock">
                                {getText('investment_item2', lang)}
                            </Link>
                        </li>
                        <li className="investment-overview-list-item">
                            <Link to="/section-2#international-investment">
                                {getText('investment_item3', lang)}
                            </Link>
                        </li>
                        <li className="investment-overview-list-item">
                            <Link to="/section-2#canadian-energy-assets">
                                {getText('investment_item4', lang)}
                            </Link>
                        </li>
                        <li className="investment-overview-list-item">
                            {getText('investment_item5', lang)}
                        </li>
                        <li className="investment-overview-list-item">
                            <Link to="/section-2#environmental-protection">
                                {getText('investment_item6', lang)}
                            </Link>
                        </li>
                    </ul>
                </nav>
            </div>
        </main>
    );
};

export default Investment;
