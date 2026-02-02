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
                    background-color: #fff;
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
                    font-family: Arial, sans-serif;
                    font-size: 2rem;
                    font-weight: bold;
                    color: #333;
                    margin: 0 0 30px 0;
                    line-height: 1.3;
                }

                .page3-paragraph {
                    font-family: Arial, sans-serif;
                    font-size: 1.15rem;
                    line-height: 1.8;
                    color: #333;
                    margin-bottom: 25px;
                }

                .page3-paragraph em {
                    font-style: italic;
                }

                @media (max-width: 768px) {
                    .page3-title {
                        font-size: 1.6rem;
                    }

                    .page3-paragraph {
                        font-size: 1rem;
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
