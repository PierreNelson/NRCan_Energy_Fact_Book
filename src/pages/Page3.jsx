import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';

const Page3 = () => {
    const { lang, layoutPadding } = useOutletContext();

    const stripHtml = (text) => text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

    return (
        <main id="main-content" tabIndex="-1" className="page3-main" role="main">
            <style>{`
                .page3-main {
                    width: calc(100% + ${layoutPadding?.left || 55}px + ${layoutPadding?.right || 15}px);
                    margin-left: -${layoutPadding?.left || 55}px;
                    margin-right: -${layoutPadding?.right || 15}px;
                    padding: 0;
                    background-color: var(--gc-background);
                    min-height: calc(100vh - 100px);
                    overflow-x: hidden;
                }

                .page3-container {
                    padding-left: ${layoutPadding?.left || 55}px;
                    padding-right: ${layoutPadding?.right || 15}px;
                    padding-top: 40px;
                    padding-bottom: 300px;
                    width: 100%;
                    box-sizing: border-box;
                }

                .page3-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 41px;
                    font-weight: bold;
                    color: var(--gc-text);
                    margin: 0 0 30px 0;
                    line-height: 1.2;
                    position: relative;
                    padding-bottom: 0.5em;
                }

                .page3-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }

                .page3-paragraph {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    line-height: 1.5;
                    color: var(--gc-text);
                    margin-bottom: 25px;
                    max-width: 65ch;
                }

                .page3-paragraph em {
                    font-style: italic;
                }

                @media (max-width: 768px) {
                    .page3-title {
                        font-size: 37px;
                    }

                    .page3-paragraph {
                        font-size: 18px;
                    }

                    .page3-container {
                        padding-bottom: 200px;
                    }
                }
            `}</style>

            <div className="page3-container">
                <header>
                    <h1 className="page3-title">{getText('page3_title', lang)}</h1>
                </header>

                <article>
                    <p 
                        className="page3-paragraph"
                        dangerouslySetInnerHTML={{ __html: getText('page3_para1', lang) }}
                        aria-label={stripHtml(getText('page3_para1', lang))}
                    />
                    <p 
                        className="page3-paragraph"
                        dangerouslySetInnerHTML={{ __html: getText('page3_para2', lang) }}
                        aria-label={stripHtml(getText('page3_para2', lang))}
                    />
                </article>
            </div>
        </main>
    );
};

export default Page3;
