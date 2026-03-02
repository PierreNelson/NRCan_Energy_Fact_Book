import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import page21Bg1 from '../assets/page21_bg1.png';
import page21Bg2 from '../assets/page21_bg2.png';
import page21Bg3 from '../assets/page21_bg3.png';
import page21Bg4 from '../assets/page21_bg4.png';

const PAGE21_ICONS = [page21Bg1, page21Bg2, page21Bg3, page21Bg4];

const Page21 = () => {
    const { lang } = useOutletContext();

    const sections = [
        {
            icon: 'federal',
            titleKey: 'page21_heading_federal',
            items: ['page21_federal_1', 'page21_federal_2', 'page21_federal_3', 'page21_federal_4'],
        },
        {
            icon: 'provinces',
            titleKey: 'page21_heading_provinces',
            items: ['page21_provinces_1', 'page21_provinces_2', 'page21_provinces_3'],
        },
        {
            icon: 'industry',
            titleKey: 'page21_heading_industry',
            items: ['page21_industry_1', 'page21_industry_2', 'page21_industry_3'],
        },
        {
            icon: 'researchers',
            titleKey: 'page21_heading_researchers',
            items: ['page21_researchers_1', 'page21_researchers_2', 'page21_researchers_3'],
        },
    ];

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-21 page21-main"
            role="main"
            aria-labelledby="page21-title"
        >
            <style>{`
.page21-main {
    width: 100%;
    margin: 0;
    padding: 0;
    position: relative;
    min-height: 100%;
    background-color: #fff;
}
.page21-container {
    width: 100%;
    max-width: 1140px;
    margin: 0 auto;
    padding: 40px 24px 40px;
    box-sizing: border-box;
}
.page21-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: #332f30;
    margin: 0 0 25px 0;
    line-height: 1.2;
}
.page21-title::after {
    content: '';
    display: block;
    width: 72px;
    height: 6px;
    background-color: #A62A1E;
    margin-top: 0.5em;
}
.page21-intro {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: #332f30;
    margin: 0 0 32px 0;
    line-height: 1.5;
    max-width: 80ch;
}
.page21-four-col {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
    width: 100%;
}
.page21-col {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
}
.page21-col-head {
    width: fit-content;
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 12px;
}
.page21-col-icon {
    margin-bottom: 16px;
    display: flex;
    justify-content: center;
    width: 100%;
}
.page21-col-icon img {
    max-width: 100%;
    height: auto;
    display: block;
}
.page21-col-title {
    font-family: 'Lato', sans-serif;
    font-size: 20px;
    font-weight: bold;
    color: #332f30;
    margin: 0;
    text-transform: none;
    text-align: left;
}
.page21-col ul {
    list-style: disc;
    margin: 0;
    padding-left: 1.2em;
    font-family: 'Noto Sans', sans-serif;
    font-size: 18px;
    color: #332f30;
    line-height: 1.6;
    width: 100%;
    box-sizing: border-box;
}
.page21-col li {
    margin-bottom: 6px;
}
@media (max-width: 900px) {
    .page21-four-col { grid-template-columns: repeat(2, 1fr); }
    .page21-title { font-size: 37px; }
    .page21-intro { font-size: 18px; }
}
@media (max-width: 480px) {
    .page21-four-col { grid-template-columns: 1fr; }
    .page21-container { padding: 24px 16px 40px; }
    .page21-title { font-size: 28px; }
}
            `}</style>
            <div className="page21-container">
                <h1 id="page21-title" className="page21-title">
                    {getText('page21_title', lang)}
                </h1>
                <p className="page21-intro">
                    {getText('page21_intro_before', lang)}{' '}
                    <strong>{getText('page21_intro_org', lang)}</strong>{' '}
                    {getText('page21_intro_after', lang)}
                </p>
                <div className="page21-four-col" role="list">
                    {sections.map((sec, i) => (
                        <section key={sec.icon} className="page21-col" role="listitem" aria-labelledby={`page21-${sec.icon}-title`}>
                            <div className="page21-col-head">
                                <div className="page21-col-icon" aria-hidden="true">
                                    <img src={PAGE21_ICONS[i]} alt="" />
                                </div>
                                <h2 id={`page21-${sec.icon}-title`} className="page21-col-title">
                                    {getText(sec.titleKey, lang)}
                                </h2>
                            </div>
                            <ul>
                                {sec.items.map((key) => (
                                    <li key={key}>{getText(key, lang)}</li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            </div>
        </main>
    );
};

export default Page21;
