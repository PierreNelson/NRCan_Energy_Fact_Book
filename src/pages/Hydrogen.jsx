import React, { useRef } from 'react';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import { downloadInfographicImagePng, resolveAccessibleInfographicGraphic } from '../utils/downloadInfographicPng';
import AccessibleInfographic from '../components/AccessibleInfographic';
import hydrogenBgEn from '../assets/hydrogen_bg.svg';
import hydrogenBgFr from '../assets/hydrogen_bg_fr.svg';

const INTRO_KEYS = ['intro_1', 'intro_2', 'intro_3'];

const Hydrogen = () => {
    const { lang, layoutPadding } = useOutletContext();
    const infographicImgRef = useRef(null);

    const pageTitle = getText('hydrogen_title', lang);
    const bgImage = lang === 'en' ? hydrogenBgEn : hydrogenBgFr;
    const fileSlugBase = getText('hydrogen_download_title', lang).replace(/\s+/g, '_');

    const downloadInfographicPng = async () => {
        await downloadInfographicImagePng(resolveAccessibleInfographicGraphic(infographicImgRef.current), {
            filename: `${fileSlugBase}.png`,
            scale: 2,
        });
    };

    return (
        <PageShell tabIndex="-1"
            className="page-content hydrogen page-chrome page-chrome--bleed"
            aria-labelledby="hydrogen-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.hydrogen {
}
.hydrogen-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.hydrogen.page-content .hydrogen-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 25px;
    line-height: 1.25;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: none;
}
.hydrogen.page-content .hydrogen-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.hydrogen-intro {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    line-height: 1.55;
    color: var(--gc-text);
    margin: 0 0 28px 0;
}
.hydrogen-intro p { margin: 0 0 1rem 0; }
.hydrogen-intro p:last-child { margin-bottom: 0; }
.hydrogen-infographic-section { width: 100%; margin-bottom: 0; }
.hydrogen-infographic-figure { margin: 0; width: 100%; }
.hydrogen-bg-image {
    width: 100%;
    height: auto;
    display: block;
}
.hydrogen-download-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 15px;
}
.hydrogen-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: bold;
    color: #ffffff;
    white-space: nowrap;
}
.hydrogen-download-buttons button:hover { background-color: #404040 !important; }
@media (max-width: 768px) {
    .hydrogen.page-content .hydrogen-title { font-size: 37px; }
    .hydrogen-intro { font-size: 18px; }
}
            `}</style>

            <div className="hydrogen-inner">
                <h1 id="hydrogen-title" className="hydrogen-title">
                    {pageTitle}
                </h1>

                <div className="hydrogen-intro">
                    {INTRO_KEYS.map((key) => (
                        <p key={key}>{getText(`hydrogen_${key}`, lang)}</p>
                    ))}
                </div>

                <div className="hydrogen-infographic-section">
                    <AccessibleInfographic
                        ref={infographicImgRef}
                        as="figure"
                        mode="image"
                        className="hydrogen-infographic-figure"
                        title={pageTitle}
                        overview={`${pageTitle}. ${getText('hydrogen_infographic_aria', lang)}`}
                        src={bgImage}
                        imgClassName="hydrogen-bg-image"
                    />

                    <div className="hydrogen-download-buttons">
                        <button type="button" onClick={downloadInfographicPng}>
                            {getText('hydrogen_download_png', lang)}
                        </button>
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default Hydrogen;
