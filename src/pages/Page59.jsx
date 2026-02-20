import React, { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import page59Image from '../assets/page59_bg.jpg';

const Page59 = () => {
    const { lang, layoutPadding } = useOutletContext();

    useEffect(() => {
    }, []);

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-59 page59-main cover-page" 
            role="main"
            style={{
                backgroundColor: '#819476',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <style>{`

.page59-main {
    width: 100%;
    margin-top: 0;
    padding: 0;
}

.page59-container {
    width: 100%;
    min-height: calc(100vh - 295px);
    display: flex;
    flex-direction: column;
    flex: 1;
}

.page59-image-title-wrapper {
    position: relative;
    width: 100%;
    min-height: 450px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
}

.page59-title {
    position: relative;
    z-index: 2;
    width: 100%;
    padding: 0;
    background-color: transparent;
    box-sizing: border-box;
}

.page59-title-box {
    background-color: rgba(255, 255, 255, 0.7); 
    padding: 20px ${layoutPadding?.right || 15}px 20px ${layoutPadding?.left || 55}px;
    width: 100%;
    box-sizing: border-box;
}

.page59-list {
    width: 100%;
    background-color: #819476;
    padding: 42px ${layoutPadding?.right || 15}px 30px ${layoutPadding?.left || 55}px;
    box-sizing: border-box;
}

.page59-title-text {
    font-family: 'Lato', sans-serif;
    font-size: 4.5rem;
    color: #221e1f;
    display: block;
    line-height: 1.15;
    text-shadow: 0px 0px 10px rgba(255, 255, 255, 0.5);
    text-align: left;
}

.page59-list-item {
    margin-bottom: 8px;
    font-size: 2.2rem;
    text-align: left;
    color: #ebe8e1;
}

@media (max-width: 1745px) { .page59-title-text { font-size: 4.2rem; } }
@media (max-width: 1536px) { .page59-title-text { font-size: 4.0rem; } }
@media (max-width: 1280px) { .page59-title-text { font-size: 3.8rem; } }
@media (max-width: 1100px) { .page59-title-text { font-size: 3.5rem; } }

@media (max-width: 960px) {
    .page59-image-title-wrapper { min-height: 350px; }
    .page59-title-text { font-size: 3.2rem; }
    .page59-list-item { font-size: 1.7rem; }
}

@media (max-width: 640px) {
    .page59-title-text { font-size: 2.5rem; }
    .page59-list-item { font-size: 1.5rem; }
}

@media (max-width: 480px) {
    .page59-image-title-wrapper { min-height: 250px; }
    .page59-title-text { font-size: 2.0rem; }
    .page59-list-item { font-size: 1.3rem; }
}

            `}</style>

            <div className="page59-container">
                <div className="page59-image-title-wrapper">
                    <img 
                        src={page59Image} 
                        alt={getText('page59_image_alt', lang)}
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
                    <div className="page59-title">
                        <div className="page59-title-box">
                            <h1 className="page59-title-text">
                                <span style={{ fontWeight: 'normal' }}>{getText('page59_section', lang)}</span>
                                <br />
                                <span style={{ fontWeight: 'bold' }}>{getText('page59_title', lang)}</span>
                            </h1>
                        </div>
                    </div>
                </div>

                <nav className="page59-list" aria-label={getText('page59_nav_label', lang)}>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontFamily: "'Noto Sans', sans-serif" }}>
                        <li className="page59-list-item">{getText('page59_item1', lang)}</li>
                        <li className="page59-list-item">{getText('page59_item2', lang)}</li>
                        <li className="page59-list-item">{getText('page59_item3', lang)}</li>
                    </ul>
                </nav>
            </div>
        </main>
    );
};

export default Page59;
