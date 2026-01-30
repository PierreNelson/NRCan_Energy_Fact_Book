import React, { useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { getText } from '../utils/translations';
import { getCapitalExpendituresData, getInfrastructureData, getEconomicContributionsData } from '../utils/dataLoader';
import page23Image from '../assets/page23_bg.jpg';

const Page23 = () => {
    const { lang, layoutPadding } = useOutletContext();

    useEffect(() => {
        getCapitalExpendituresData();
        getInfrastructureData();
        getEconomicContributionsData();
        import('./Page24');
    }, []);

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-23 page23-main" 
            role="main"
            style={{
                backgroundColor: '#8a7d5a',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <style>{`

.page23-main {
    width: calc(100% + ${layoutPadding?.left || 55}px + ${layoutPadding?.right || 15}px);
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    padding: 0;
}

.page23-container {
    width: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    flex: 1;
}

.page23-image-title-wrapper {
    position: relative;
    width: 100%;
    min-height: 320px; 
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
}

.page23-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
}

.page23-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 65%;
}

.page23-title {
    position: relative;
    z-index: 1;
    width: 100%;
    padding: 0;
    background-color: transparent;
    box-sizing: border-box;
}

.page23-title-box {
    background-color: rgba(255, 255, 255, 0.7); 
    padding: 20px ${layoutPadding?.right || 15}px 20px ${layoutPadding?.left || 55}px;
    width: 100%;
    box-sizing: border-box;
}

.page23-list {
    width: 100%;
    background-color: #8a7d5a;
    padding: 30px ${layoutPadding?.right || 15}px 30px ${layoutPadding?.left || 55}px;
    box-sizing: border-box;
    flex: 1;
}

.page23-title-text {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 4.5rem;
    color: #221e1f;
    display: block;
    line-height: 1.15;
    text-shadow: 0px 0px 10px rgba(255, 255, 255, 0.5);
    text-align: left;
}

.page23-list-item {
    margin-bottom: 8px;
    font-size: 2.2rem;
    text-align: left;
}

.page23-list-item a {
    color: #ebe8e1;
    text-decoration: underline;
    transition: color 0.2s ease;
}

.page23-list-item a:hover,
.page23-list-item a:focus {
    color: #ffffff;
    text-decoration: underline;
}

.page23-list-item a:focus {
    outline: 2px solid #ffffff;
    outline-offset: 2px;
}

@media (max-width: 1745px) { .page23-title-text { font-size: 4.2rem; } }
@media (max-width: 1536px) { .page23-title-text { font-size: 4.0rem; } }
@media (max-width: 1280px) { .page23-title-text { font-size: 3.8rem; } }
@media (max-width: 1100px) { .page23-title-text { font-size: 3.5rem; } }

@media (max-width: 960px) {
    .page23-image-title-wrapper { min-height: 240px; }
    .page23-title-text { font-size: 3.2rem; }
    .page23-list-item { font-size: 1.7rem; }
}

@media (max-width: 640px) {
    .page23-title-text { font-size: 2.5rem; }
    .page23-list-item { font-size: 1.5rem; }
}

@media (max-width: 480px) {
    .page23-image-title-wrapper { min-height: 180px; }
    .page23-title-text { font-size: 2.0rem; }
    .page23-list-item { font-size: 1.3rem; }
}

@media (max-width: 384px) {
    .page23-image-title-wrapper { min-height: 160px; }
    .page23-title-text { font-size: 1.8rem; }
    .page23-list-item { font-size: 1.2rem; }
}
            `}</style>

            <div className="page23-container">
                <div className="page23-image-title-wrapper">
                    <div className="page23-image" aria-hidden="true">
                        <img
                            src={page23Image}
                            alt=""
                        />
                    </div>

                    <header className="page23-title">
                        <div className="page23-title-box">
                            <h1 style={{ margin: 0 }}>
                                <span className="page23-title-text" style={{ fontWeight: 'normal' }}>
                                    {getText('page23_section', lang)}
                                </span>
                                <span className="page23-title-text" style={{ fontWeight: 'bold', lineHeight: '1.1', whiteSpace: 'nowrap' }}>
                                    {getText('page23_title', lang)}
                                </span>
                            </h1>
                        </div>
                    </header>
                </div>

                <nav className="page23-list" aria-label={lang === 'en' ? 'Section topics' : 'Sujets de la section'}>
                    <ul style={{
                        listStyleType: 'none',
                        padding: '0',
                        margin: '0',
                        color: '#ebe8e1',
                        fontFamily: 'Arial, sans-serif'
                    }}>
                        <li className="page23-list-item">
                            <Link to="/section-2#capital-expenditure">
                                {getText('page23_item1', lang)}
                            </Link>
                        </li>
                        <li className="page23-list-item">
                            <Link to="/section-2#infrastructure-stock">
                                {getText('page23_item2', lang)}
                            </Link>
                        </li>
                        <li className="page23-list-item">
                            <Link to="/section-2#economic-contributions">
                                {getText('page23_item3', lang)}
                            </Link>
                        </li>
                        <li className="page23-list-item">
                            {getText('page23_item4', lang)}
                        </li>
                        <li className="page23-list-item">
                            {getText('page23_item5', lang)}
                        </li>
                        <li className="page23-list-item">
                            <Link to="/section-2#environmental-protection">
                                {getText('page23_item6', lang)}
                            </Link>
                        </li>
                    </ul>
                </nav>
            </div>
        </main>
    );
};

export default Page23;
