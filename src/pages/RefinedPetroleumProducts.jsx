import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import refinedPetroleumProductsBgEn from '../assets/refined_petroleum_products_bg.svg';
import refinedPetroleumProductsBgFr from '../assets/refined_petroleum_products_bg_fr.svg';

const RefinedPetroleumProducts = () => {
    const { lang, layoutPadding } = useOutletContext();
    const diagramSrc = lang === 'fr' ? refinedPetroleumProductsBgFr : refinedPetroleumProductsBgEn;

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-108 refined-petroleum-products-refined-products"
            role="main"
            aria-labelledby="refined-petroleum-products-main-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
                .page-108.refined-petroleum-products-refined-products {
                    margin-left: -${layoutPadding?.left || 55}px;
                    margin-right: -${layoutPadding?.right || 15}px;
                    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
                    padding-left: ${layoutPadding?.left || 55}px;
                    padding-right: ${layoutPadding?.right || 15}px;
                }
                .refined-petroleum-products-inner {
                    width: 100%;
                    padding: 15px 0 40px 0;
                    box-sizing: border-box;
                }
                .refined-petroleum-products-layout {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: flex-start;
                    gap: 28px 36px;
                    margin-top: 8px;
                }
                .refined-petroleum-products-text {
                    flex: 1 1 320px;
                    min-width: 260px;
                    max-width: 52ch;
                    font-family: var(--font-body);
                    font-size: 1rem;
                    line-height: 1.65;
                    color: var(--gc-text);
                }
                .refined-petroleum-products-text p {
                    margin: 0 0 1.25rem 0;
                }
                .refined-petroleum-products-text h2 {
                    font-family: var(--font-body);
                    font-size: 1.125rem;
                    font-weight: 700;
                    color: var(--gc-text);
                    margin: 1.5rem 0 0.75rem 0;
                }
                .refined-petroleum-products-text h2:first-of-type {
                    margin-top: 0.5rem;
                }
                .refined-petroleum-products-text ul {
                    margin: 0 0 1rem 0;
                    padding-left: 1.25rem;
                }
                .refined-petroleum-products-text li {
                    margin-bottom: 0.5rem;
                }
                .refined-petroleum-products-text li strong {
                    font-weight: 700;
                }
                .refined-petroleum-products-figure {
                    flex: 1 1 340px;
                    min-width: 260px;
                    max-width: 640px;
                    margin: 0;
                }
                .refined-petroleum-products-figure img {
                    display: block;
                    width: 100%;
                    height: auto;
                }
                @media (max-width: 768px) {
                    .refined-petroleum-products-layout {
                        flex-direction: column;
                    }
                    .refined-petroleum-products-figure {
                        max-width: 100%;
                    }
                }
            `}</style>

            <div className="crude-oil-international-container refined-petroleum-products-inner">
                <header>
                    <h1 id="refined-petroleum-products-main-title" className="crude-oil-international-title">
                        {getText('refined_petroleum_products_title', lang)}
                    </h1>
                    <p className="crude-oil-international-subtitle">{getText('refined_petroleum_products_subtitle', lang)}</p>
                </header>

                <div className="refined-petroleum-products-layout">
                    <div className="refined-petroleum-products-text">
                        <p>{getText('refined_petroleum_products_intro', lang)}</p>

                        <section aria-labelledby="refined-petroleum-products-activities-heading">
                            <h2 id="refined-petroleum-products-activities-heading">{getText('refined_petroleum_products_section_activities', lang)}</h2>
                            <ul>
                                <li>
                                    <strong>{getText('refined_petroleum_products_act1_label', lang)}</strong>{' '}
                                    {getText('refined_petroleum_products_act1_text', lang)}
                                </li>
                                <li>
                                    <strong>{getText('refined_petroleum_products_act2_label', lang)}</strong>{' '}
                                    {getText('refined_petroleum_products_act2_text', lang)}
                                </li>
                                <li>
                                    <strong>{getText('refined_petroleum_products_act3_label', lang)}</strong>{' '}
                                    {getText('refined_petroleum_products_act3_text', lang)}
                                </li>
                            </ul>
                        </section>

                        <section aria-labelledby="refined-petroleum-products-outputs-heading">
                            <h2 id="refined-petroleum-products-outputs-heading">{getText('refined_petroleum_products_section_outputs', lang)}</h2>
                            <ul>
                                <li>
                                    <strong>{getText('refined_petroleum_products_out1_label', lang)}</strong>{' '}
                                    {getText('refined_petroleum_products_out1_text', lang)}
                                </li>
                                <li>{getText('refined_petroleum_products_out2', lang)}</li>
                                <li>
                                    <strong>{getText('refined_petroleum_products_out3_label', lang)}</strong>{' '}
                                    {getText('refined_petroleum_products_out3_text', lang)}
                                </li>
                                <li>{getText('refined_petroleum_products_out4', lang)}</li>
                                <li>
                                    <strong>{getText('refined_petroleum_products_out5_label', lang)}</strong>{' '}
                                    {getText('refined_petroleum_products_out5_text', lang)}
                                </li>
                            </ul>
                        </section>
                    </div>

                    <figure className="refined-petroleum-products-figure">
                        <img src={diagramSrc} alt={getText('refined_petroleum_products_diagram_alt', lang)} />
                    </figure>
                </div>
            </div>
        </main>
    );
};

export default RefinedPetroleumProducts;
