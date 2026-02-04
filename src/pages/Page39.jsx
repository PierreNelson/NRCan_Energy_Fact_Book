import React, { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import page39Image from '../assets/page39_bg.jpg';

const Page39 = () => {
    const { lang, layoutPadding } = useOutletContext();

    useEffect(() => {
    }, []);

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-39 page39-main" 
            role="main"
            style={{
                backgroundColor: '#a8678f',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <style>{`

.page39-main {
    width: calc(100% + ${layoutPadding?.left || 55}px + ${layoutPadding?.right || 15}px);
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    margin-top: 0;
    padding: 0;
}

.page39-container {
    width: 100%;
    min-height: calc(100vh - 295px);
    display: flex;
    flex-direction: column;
    flex: 1;
}

.page39-image-title-wrapper {
    position: relative;
    width: 100%;
    min-height: 450px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
}

.page39-title {
    position: relative;
    z-index: 2;
    width: 100%;
    padding: 0;
    background-color: transparent;
    box-sizing: border-box;
}

.page39-title-box {
    background-color: rgba(255, 255, 255, 0.7); 
    padding: 20px ${layoutPadding?.right || 15}px 20px ${layoutPadding?.left || 55}px;
    width: 100%;
    box-sizing: border-box;
}

.page39-list {
    width: 100%;
    background-color: #a0346e;
    padding: 42px ${layoutPadding?.right || 15}px 30px ${layoutPadding?.left || 55}px;
    box-sizing: border-box;
}

.page39-title-text {
    font-family: 'Lato', sans-serif;
    font-size: 4.5rem;
    color: #221e1f;
    display: block;
    line-height: 1.15;
    text-shadow: 0px 0px 10px rgba(255, 255, 255, 0.5);
    text-align: left;
}

.page39-list-item {
    margin-bottom: 8px;
    font-size: 2.2rem;
    text-align: left;
    color: #ebe8e1;
}

@media (max-width: 1745px) { .page39-title-text { font-size: 4.2rem; } }
@media (max-width: 1536px) { .page39-title-text { font-size: 4.0rem; } }
@media (max-width: 1280px) { .page39-title-text { font-size: 3.8rem; } }
@media (max-width: 1100px) { .page39-title-text { font-size: 3.5rem; } }

@media (max-width: 960px) {
    .page39-image-title-wrapper { min-height: 350px; }
    .page39-title-text { font-size: 3.2rem; }
    .page39-list-item { font-size: 1.7rem; }
}

@media (max-width: 640px) {
    .page39-title-text { font-size: 2.5rem; }
    .page39-list-item { font-size: 1.5rem; }
}

@media (max-width: 480px) {
    .page39-image-title-wrapper { min-height: 250px; }
    .page39-title-text { font-size: 2.0rem; }
    .page39-list-item { font-size: 1.3rem; }
}

            `}</style>

            <div className="page39-container">
                <div className="page39-image-title-wrapper">
                    <img 
                        src={page39Image} 
                        alt={getText('page39_image_alt', lang)}
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
                    <div className="page39-title">
                        <div className="page39-title-box">
                            <h1 className="page39-title-text">
                                <span style={{ fontWeight: 'normal' }}>{getText('page39_section', lang)}</span>
                                <br />
                                <span style={{ fontWeight: 'bold' }}>{getText('page39_title', lang)}</span>
                            </h1>
                        </div>
                    </div>
                </div>

                <nav className="page39-list" aria-label={getText('page39_nav_label', lang)}>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontFamily: "'Noto Sans', sans-serif" }}>
                        <li className="page39-list-item">{getText('page39_item1', lang)}</li>
                        <li className="page39-list-item">{getText('page39_item2', lang)}</li>
                        <li className="page39-list-item">{getText('page39_item3', lang)}</li>
                    </ul>
                </nav>
            </div>
        </main>
    );
};

export default Page39;
