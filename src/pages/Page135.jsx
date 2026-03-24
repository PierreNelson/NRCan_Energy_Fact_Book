import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import page135BgEn from '../assets/page135_bg.svg';
import page135BgFr from '../assets/page135_bg_fr.svg';

const Page135 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const diagramSrc = lang === 'fr' ? page135BgFr : page135BgEn;

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-108 page135-refined-products"
            role="main"
            aria-labelledby="page135-main-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
                .page-108.page135-refined-products {
                    margin-left: -${layoutPadding?.left || 55}px;
                    margin-right: -${layoutPadding?.right || 15}px;
                    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
                    padding-left: ${layoutPadding?.left || 55}px;
                    padding-right: ${layoutPadding?.right || 15}px;
                }
                .page135-inner {
                    width: 100%;
                    padding: 15px 0 40px 0;
                    box-sizing: border-box;
                }
                .page135-layout {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: flex-start;
                    gap: 28px 36px;
                    margin-top: 8px;
                }
                .page135-text {
                    flex: 1 1 320px;
                    min-width: 260px;
                    max-width: 52ch;
                    font-family: var(--font-body);
                    font-size: 1rem;
                    line-height: 1.65;
                    color: var(--gc-text);
                }
                .page135-text p {
                    margin: 0 0 1.25rem 0;
                }
                .page135-text h2 {
                    font-family: var(--font-body);
                    font-size: 1.125rem;
                    font-weight: 700;
                    color: var(--gc-text);
                    margin: 1.5rem 0 0.75rem 0;
                }
                .page135-text h2:first-of-type {
                    margin-top: 0.5rem;
                }
                .page135-text ul {
                    margin: 0 0 1rem 0;
                    padding-left: 1.25rem;
                }
                .page135-text li {
                    margin-bottom: 0.5rem;
                }
                .page135-text li strong {
                    font-weight: 700;
                }
                .page135-figure {
                    flex: 1 1 340px;
                    min-width: 260px;
                    max-width: 640px;
                    margin: 0;
                }
                .page135-figure img {
                    display: block;
                    width: 100%;
                    height: auto;
                }
                @media (max-width: 768px) {
                    .page135-layout {
                        flex-direction: column;
                    }
                    .page135-figure {
                        max-width: 100%;
                    }
                }
            `}</style>

            <div className="page108-container page135-inner">
                <header>
                    <h1 id="page135-main-title" className="page108-title">
                        {getText('page135_title', lang)}
                    </h1>
                    <p className="page108-subtitle">{getText('page135_subtitle', lang)}</p>
                </header>

                <div className="page135-layout">
                    <div className="page135-text">
                        <p>{getText('page135_intro', lang)}</p>

                        <section aria-labelledby="page135-activities-heading">
                            <h2 id="page135-activities-heading">{getText('page135_section_activities', lang)}</h2>
                            <ul>
                                <li>
                                    <strong>{getText('page135_act1_label', lang)}</strong>{' '}
                                    {getText('page135_act1_text', lang)}
                                </li>
                                <li>
                                    <strong>{getText('page135_act2_label', lang)}</strong>{' '}
                                    {getText('page135_act2_text', lang)}
                                </li>
                                <li>
                                    <strong>{getText('page135_act3_label', lang)}</strong>{' '}
                                    {getText('page135_act3_text', lang)}
                                </li>
                            </ul>
                        </section>

                        <section aria-labelledby="page135-outputs-heading">
                            <h2 id="page135-outputs-heading">{getText('page135_section_outputs', lang)}</h2>
                            <ul>
                                <li>
                                    <strong>{getText('page135_out1_label', lang)}</strong>{' '}
                                    {getText('page135_out1_text', lang)}
                                </li>
                                <li>{getText('page135_out2', lang)}</li>
                                <li>
                                    <strong>{getText('page135_out3_label', lang)}</strong>{' '}
                                    {getText('page135_out3_text', lang)}
                                </li>
                                <li>{getText('page135_out4', lang)}</li>
                                <li>
                                    <strong>{getText('page135_out5_label', lang)}</strong>{' '}
                                    {getText('page135_out5_text', lang)}
                                </li>
                            </ul>
                        </section>
                    </div>

                    <figure className="page135-figure">
                        <img src={diagramSrc} alt={getText('page135_diagram_alt', lang)} />
                    </figure>
                </div>
            </div>
        </main>
    );
};

export default Page135;
