import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import page21Bg1 from '../assets/page21_bg1.png';
import page21Bg2 from '../assets/page21_bg2.png';
import page21Bg3 from '../assets/page21_bg3.png';

const MissionInnovationMark = ({ lang }) => (
    <figure className="page34-mi-mark">
        <svg width="72" height="72" viewBox="0 0 72 72" focusable="false" aria-hidden="true">
            <circle cx="36" cy="36" r="33" fill="none" stroke="#3d7a47" strokeWidth="3" />
            <circle cx="36" cy="36" r="25" fill="#1e5a8a" />
            <text
                x="36"
                y="41"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="17"
                fontWeight="bold"
                fontFamily="Arial, sans-serif"
            >
                MI
            </text>
        </svg>
        <figcaption className="wb-inv">{getText('page34_mi_logo_inv', lang)}</figcaption>
    </figure>
);

const Page34 = () => {
    const { lang } = useOutletContext();

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-34"
            role="main"
            aria-labelledby="page34-title"
            style={{
                backgroundColor: 'white',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',
                boxSizing: 'border-box',
            }}
        >
            <style>{`
.page-34 { width: 100%; }
.page34-container {
    width: 100%;
    padding: 15px 0 32px 0;
    box-sizing: border-box;
}
.page34-title {
    font-family: 'Lato', sans-serif;
    font-size: 50px;
    font-weight: bold;
    color: #5a6d3e;
    margin: 0 0 12px 0;
    line-height: 1.15;
    position: relative;
    padding-bottom: 0.5em;
}
.page34-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.page34-subtitle {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    font-weight: bold;
    color: #332f30;
    margin: 0 0 16px 0;
    line-height: 1.45;
    max-width: 80ch;
    text-transform: none;
}
.page34-intro {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: #332f30;
    margin: 0 0 28px 0;
    line-height: 1.5;
    max-width: 80ch;
}
.page34-row {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 20px;
    margin-bottom: 28px;
    width: 100%;
    box-sizing: border-box;
}
.page34-row-icon {
    flex: 0 0 auto;
    width: 96px;
    min-width: 72px;
    padding-top: 4px;
}
.page34-row-icon img {
    width: 100%;
    height: auto;
    display: block;
}
.page34-row-body {
    flex: 1 1 auto;
    min-width: 0;
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: #332f30;
    line-height: 1.5;
}
.page34-row-body p {
    margin: 0 0 14px 0;
}
.page34-row-body p:last-child {
    margin-bottom: 0;
}
.page34-federal-p2-row {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 16px 20px;
}
.page34-federal-p2-row p {
    flex: 1 1 240px;
    margin: 0;
    min-width: min(100%, 280px);
}
.page34-mi-mark {
    flex: 0 0 auto;
    margin: 0;
    align-self: center;
}
.page34-mi-mark svg {
    display: block;
}
.page34-footer {
    font-family: 'Noto Sans', sans-serif;
    font-size: 16px;
    color: #332f30;
    margin-top: 8px;
    padding-top: 16px;
    border-top: 1px solid #e0e0e0;
}
@media (max-width: 768px) {
    .page34-title { font-size: 37px; }
    .page34-subtitle,
    .page34-intro,
    .page34-row-body { font-size: 18px; }
    .page34-row { flex-direction: column; gap: 12px; }
    .page34-row-icon { width: 80px; }
    .page34-federal-p2-row { flex-direction: column; }
}
            `}</style>
            <div className="page34-container">
                <h1 id="page34-title" className="page34-title">
                    {getText('page34_title', lang)}
                </h1>
                <p className="page34-subtitle">{getText('page34_subtitle', lang)}</p>
                <p className="page34-intro">{getText('page34_intro', lang)}</p>

                <div className="page34-row" role="region" aria-label={getText('page34_row_federal_aria', lang)}>
                    <div className="page34-row-icon" aria-hidden="true">
                        <img src={page21Bg1} alt="" width={120} height={120} />
                    </div>
                    <div className="page34-row-body">
                        <p>
                            {getText('page34_federal_p1_pre', lang)}
                            <strong>{getText('page34_federal_p1_bold', lang)}</strong>
                            {getText('page34_federal_p1_post', lang)}
                        </p>
                        <div className="page34-federal-p2-row">
                            <p>
                                {getText('page34_federal_p2_pre', lang)}
                                <strong>{getText('page34_federal_p2_bold_2b', lang)}</strong>
                                {getText('page34_federal_p2_mid', lang)}
                                <strong>{getText('page34_federal_p2_bold_138', lang)}</strong>
                                {getText('page34_federal_p2_post', lang)}
                            </p>
                            <MissionInnovationMark lang={lang} />
                        </div>
                    </div>
                </div>

                <div className="page34-row" role="region" aria-label={getText('page34_row_pt_aria', lang)}>
                    <div className="page34-row-icon" aria-hidden="true">
                        <img src={page21Bg2} alt="" width={120} height={120} />
                    </div>
                    <div className="page34-row-body">
                        <p>
                            {getText('page34_pt_pre', lang)}
                            <strong>{getText('page34_pt_bold1', lang)}</strong>
                            {getText('page34_pt_mid1', lang)}
                            <strong>{getText('page34_pt_bold2', lang)}</strong>
                            {getText('page34_pt_mid2', lang)}
                            <strong>{getText('page34_pt_bold3', lang)}</strong>
                            {getText('page34_pt_mid3', lang)}
                            <strong>{getText('page34_pt_bold4', lang)}</strong>
                            {getText('page34_pt_post', lang)}
                        </p>
                    </div>
                </div>

                <div className="page34-row" role="region" aria-label={getText('page34_row_industry_aria', lang)}>
                    <div className="page34-row-icon" aria-hidden="true">
                        <img src={page21Bg3} alt="" width={120} height={120} />
                    </div>
                    <div className="page34-row-body">
                        <p>
                            {getText('page34_industry_pre', lang)}
                            <strong>{getText('page34_industry_bold1', lang)}</strong>
                            {getText('page34_industry_mid', lang)}
                            <strong>{getText('page34_industry_bold2', lang)}</strong>
                            {getText('page34_industry_post', lang)}
                        </p>
                    </div>
                </div>

                <div className="page34-footer">
                    <span>34</span> {getText('page34_footer_line', lang)}
                </div>
            </div>
        </main>
    );
};

export default Page34;
