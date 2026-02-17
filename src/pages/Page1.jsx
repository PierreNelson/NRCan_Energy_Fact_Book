import React, { useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { getText } from '../utils/translations';
import page1Image from '../assets/page1_bg.jpg';

const Page1 = () => {
    const { lang, layoutPadding } = useOutletContext();


    // Default target widths for testing
    const targetWidths = [1920, 1745, 1536, 1280, 1097, 960, 768, 640, 480, 384];

    useEffect(() => {
        import('./Page23');
    }, []);

    // Close dropdowns when clicking outside


    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-1 page1-main"
            role="main"
            style={{
                backgroundColor: '#5a7a8a',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <style>{`

                .page1-main {
                    width: calc(100% + ${layoutPadding?.left || 55}px + ${layoutPadding?.right || 15}px);
                    margin-left: -${layoutPadding?.left || 55}px;
                    margin-right: -${layoutPadding?.right || 15}px;
                    padding: 0;
                }

                .page1-container {
                    width: 100%;
                    min-height: 0;
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                }

                .page1-image-title-wrapper {
                    position: relative;
                    width: 100%;
                    min-height: 500px; 
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-end;
                }

                .page1-image {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 0;
                }

                .page1-image img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    object-position: 50% 65%;
                }

                .page1-title {
                    position: relative;
                    z-index: 1;
                    width: 100%;
                    padding: 0;
                    background-color: transparent;
                    box-sizing: border-box;
                }

                .page1-title-box {
                    background-color: rgba(255, 255, 255, 0.7); 
                    padding: 20px ${layoutPadding?.right || 15}px 20px ${layoutPadding?.left || 55}px;
                    width: 100%;
                    box-sizing: border-box;
                }

                .page1-list {
                    width: 100%;
                    background-color: #245e7f;
                    padding: 30px ${layoutPadding?.right || 15}px 30px ${layoutPadding?.left || 55}px;
                    box-sizing: border-box;
                    flex: 1;
                }

                .page1-title-text {
                    font-family: 'Lato', sans-serif;
                    font-size: 4.5rem; 
                    color: #221e1f;
                    display: block;
                    line-height: 1.15;
                    text-shadow: 0px 0px 10px rgba(255, 255, 255, 0.5);
                }

                .page1-list-item {
                    margin-bottom: 8px;
                    font-size: 2.2rem; 
                }

                .page1-list-item a {
                    color: #ebe8e1;
                    text-decoration: underline;
                    transition: color 0.2s ease;
                }

                .page1-list-item a:hover,
                .page1-list-item a:focus {
                    color: #ffffff;
                    text-decoration: underline;
                }

                .page1-list-item a:focus {
                    outline: 2px solid #ffffff;
                    outline-offset: 2px;
                }

                @container (max-width: 1745px) { .page1-title-text { font-size: 4.2rem; } }
                @container (max-width: 1536px) { .page1-title-text { font-size: 4.0rem; } }
                @container (max-width: 1280px) { .page1-title-text { font-size: 3.8rem; } }
                @container (max-width: 1100px) { .page1-title-text { font-size: 3.5rem; } }

                @container (max-width: 960px) {
                    .page1-image-title-wrapper { min-height: 350px; }
                    .page1-title-text { font-size: 3.2rem; }
                    .page1-list-item { font-size: 1.7rem; }
                }

                @container (max-width: 640px) {
                    .page1-title-text { font-size: 2.5rem; }
                    .page1-list-item { font-size: 1.5rem; }
                }

                @container (max-width: 480px) {
                    .page1-image-title-wrapper { min-height: 250px; }
                    .page1-title-text { font-size: 2.0rem; }
                    .page1-list-item { font-size: 1.3rem; }
                }
            `}</style>
            <div className="page1-container">
                <div className="page1-image-title-wrapper">
                    <div className="page1-image" aria-hidden="true">
                        <img src={page1Image} alt="" />
                    </div>

                    <header className="page1-title">
                        <div className="page1-title-box">
                            <h1 style={{ margin: 0 }}>
                                <span className="page1-title-text" style={{ fontWeight: 'normal' }}>
                                    {getText('page1_section', lang)}
                                </span>
                                <span className="page1-title-text" style={{ fontWeight: 'bold', lineHeight: '1.1', display: 'block' }}>
                                    {getText('page1_title', lang)}
                                </span>
                            </h1>
                        </div>
                    </header>
                </div>

                <nav className="page1-list" aria-label={lang === 'en' ? 'Section topics' : 'Sujets de la section'}>
                    <ul style={{
                        listStyleType: 'none',
                        padding: '0',
                        margin: '0',
                        color: '#ebe8e1',
                        fontFamily: "'Noto Sans', sans-serif"
                    }}>
                        <li className="page1-list-item">
                            <Link to="/section-1#energy-production">
                                {getText('page1_item1', lang)}
                            </Link>
                        </li>
                        <li className="page1-list-item">
                            <Link to="/section-1#economic-contributions">
                                {getText('page1_item2', lang)}
                            </Link>
                        </li>
                        <li className="page1-list-item">
                            {getText('page1_item3', lang)}
                        </li>
                    </ul>


                </nav>
            </div>
        </main>
    );
};

export default Page1;
