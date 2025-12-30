import React, { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
// Import data loader to prefetch and warm up cache
import { getCapitalExpendituresData, getInfrastructureData, getEconomicContributionsData } from '../utils/dataLoader';
import page23Image from '../assets/page23_bg.jpg';

const Page23 = () => {
    const { lang } = useOutletContext();

    // Prefetch data and code in the background while user views this page
    useEffect(() => {
        getCapitalExpendituresData();
        getInfrastructureData();
        getEconomicContributionsData();
        import('./Page24');
    }, []);

    // Build screen reader text for the title
    const getTitleText = () => {
        return `${getText('page23_section', lang)} ${getText('page23_title', lang)}`;
    };

    // Build screen reader text for the list items
    const getListItemsText = () => {
        const items = [1, 2, 3, 4, 5, 6].map(num => getText(`page23_item${num}`, lang));
        const prefix = lang === 'en' ? 'This section covers:' : 'Cette section couvre:';
        return `${prefix} ${items.join('. ')}.`;
    };

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-23 page23-main" 
            role="main"
            aria-label={getTitleText()}
            style={{
                backgroundColor: '#8a7d5a',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <style>{`
                .page23-main {
                    overflow: visible;
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
                    padding: 20px 40px;
                    width: 100%;
                    box-sizing: border-box;
                }
                
                .page23-list {
                    width: 100%;
                    background-color: #8a7d5a;
                    padding: 30px 40px;
                    box-sizing: border-box;
                    flex: 1;
                }
                
                .page23-title-text {
                    font-family: Georgia, "Times New Roman", serif;
                    font-size: 4.5rem;
                    color: #221e1f; /* Visible text */
                    display: block;
                    line-height: 1.15;
                    text-shadow: 0px 0px 10px rgba(255, 255, 255, 0.5);
                }
                
                .page23-list-item {
                    margin-bottom: 8px;
                    font-size: 2.2rem;
                }

                /* MEDIA QUERY: When zoomed in (110%+) */
                @media (max-width: 1536px) {
                    .page23-image-title-wrapper {
                        min-height: 280px;
                    }
                    
                    .page23-title-box {
                    background-color: rgba(255, 255, 255, 0.7); 
                    padding: 20px 40px;
                    width: 100%;
                    box-sizing: border-box;
                    }
                    
                    .page23-list {
                        min-height: 200px;
                        padding: 20px 40px;
                    }
                    
                    .page23-title-text {
                        font-size: 2.8rem;
                    }
                    
                    .page23-list-item {
                        font-size: 1.3rem;
                        margin-bottom: 10px;
                    }
                }
                
                /* REFLOW: At 250%+ zoom */
                @media (max-width: 768px) {
                    .page23-image-title-wrapper {
                        min-height: 200px;
                    }
                    
                    .page23-title-box {
                        padding: 12px 20px;
                    }
                    
                    .page23-title-text {
                        font-size: 1.8rem;
                    }
                    
                    .page23-list {
                        padding: 15px 20px;
                    }
                    
                    .page23-list-item {
                        font-size: 1.1rem;
                    }
                }
                
                /* REFLOW: At 400% zoom (320px width) */
                @media (max-width: 480px) {
                    .page23-image-title-wrapper {
                        min-height: auto;
                    }
                    
                    .page23-title {
                        padding-top: 10px;
                    }
                    
                    .page23-title-box {
                        padding: 10px 15px;
                    }
                    
                    .page23-title-text {
                        font-size: 1.4rem;
                        color: #221e1f;
                    }
                    
                    .page23-list {
                        padding: 10px 15px;
                    }
                    
                    .page23-list-item {
                        font-size: 1rem;
                    }
                }
            `}</style>

            <div className="page23-container">
                {/* Image and Title Wrapper */}
                <div className="page23-image-title-wrapper">
                    {/* Background Image - Windmills */}
                    <div className="page23-image" aria-hidden="true">
                        <img
                            src={page23Image}
                            alt=""
                        />
                    </div>

                    {/* REGION 1: Title */}
                    <header 
                        className="page23-title"
                        role="region"
                        aria-label={getTitleText()}
                    >
                        <div className="page23-title-box">
                            <h1 aria-hidden="true" style={{ margin: 0 }}>
                                <span className="page23-title-text" style={{ fontWeight: 'normal' }}>
                                    {getText('page23_section', lang)}
                                </span>
                                <span className="page23-title-text" style={{ fontWeight: 'bold', lineHeight: '1.1' }}>
                                    {getText('page23_title', lang)}
                                </span>
                            </h1>
                        </div>
                    </header>
                </div>

                {/* REGION 2: Section Contents */}
                <nav 
                    className="page23-list"
                    role="region"
                    aria-label={getListItemsText()}
                >
                    <ul aria-hidden="true" style={{
                        listStyleType: 'none',
                        padding: '0',
                        margin: '0',
                        color: '#ebe8e1',
                        fontFamily: 'Arial, sans-serif'
                    }}>
                        {[1, 2, 3, 4, 5, 6].map(num => (
                            <li key={num} className="page23-list-item">
                                {getText(`page23_item${num}`, lang)}
                            </li>
                        ))}
                    </ul>
                </nav>
            </div>
        </main>
    );
};

export default Page23;
