import React, { useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import oilSandsInSituBgEn from '../assets/oil_sands_in_situ_bg.svg';
import oilSandsInSituBgFr from '../assets/oil_sands_in_situ_bg_fr.svg';

const waitForImage = (img) =>
    new Promise((resolve, reject) => {
        if (img.complete && img.naturalWidth > 0) {
            resolve(img);
            return;
        }
        img.onload = () => resolve(img);
        img.onerror = reject;
    });

const exportOilSandsInSituInfographicPng = async (imgEl, { scale = 2 }) => {
    if (!imgEl) return null;

    const loaded = await waitForImage(imgEl);
    const canvas = document.createElement('canvas');
    canvas.width = loaded.naturalWidth * scale;
    canvas.height = loaded.naturalHeight * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, loaded.naturalWidth, loaded.naturalHeight);
    ctx.drawImage(loaded, 0, 0, loaded.naturalWidth, loaded.naturalHeight);
    return canvas;
};

const OilSandsInSituMethod = () => {
    const { lang, layoutPadding } = useOutletContext();
    const infographicImgRef = useRef(null);

    const pageTitle = getText('oil_sands_in_situ_title', lang);
    const titleUsesHtml = lang === 'fr';
    const bgImage = lang === 'en' ? oilSandsInSituBgEn : oilSandsInSituBgFr;
    const fileSlugBase = getText('oil_sands_in_situ_download_title', lang).replace(/\s+/g, '_');

    const downloadInfographicPng = async () => {
        const canvas = await exportOilSandsInSituInfographicPng(infographicImgRef.current, { scale: 2 });
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${fileSlugBase}.png`);
        });
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content oil-sands-in-situ"
            role="main"
            aria-labelledby="oil-sands-in-situ-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.oil-sands-in-situ {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.oil-sands-in-situ-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.oil-sands-in-situ.page-content .oil-sands-in-situ-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 25px;
    line-height: 1.25;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: uppercase;
}
.oil-sands-in-situ.page-content .oil-sands-in-situ-title em {
    font-style: italic;
    text-transform: lowercase;
}
.oil-sands-in-situ.page-content .oil-sands-in-situ-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.oil-sands-in-situ-intro {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    line-height: 1.55;
    color: var(--gc-text);
    margin: 0 0 14px 0;
}
.oil-sands-in-situ-intro p { margin: 0 0 1rem 0; }
.oil-sands-in-situ-intro p:last-child { margin-bottom: 0; }
.oil-sands-in-situ-intro strong { font-weight: bold; }
.oil-sands-in-situ-infographic-section { width: 100%; margin-bottom: 0; margin-top: 0; }
.oil-sands-in-situ-infographic-figure { margin: 0; width: 100%; }
.oil-sands-in-situ-bg-image {
    width: 100%;
    height: auto;
    display: block;
}
.oil-sands-in-situ-download-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 15px;
}
.oil-sands-in-situ-download-buttons button {
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
.oil-sands-in-situ-download-buttons button:hover { background-color: #404040 !important; }
@media (max-width: 768px) {
    .oil-sands-in-situ.page-content .oil-sands-in-situ-title { font-size: 37px; }
    .oil-sands-in-situ-intro { font-size: 18px; }
}
            `}</style>

            <div className="oil-sands-in-situ-inner">
                <h1 id="oil-sands-in-situ-title" className="oil-sands-in-situ-title">
                    {titleUsesHtml ? (
                        <span dangerouslySetInnerHTML={{ __html: pageTitle }} />
                    ) : (
                        pageTitle
                    )}
                </h1>

                <div className="oil-sands-in-situ-intro">
                    <p>{getText('oil_sands_in_situ_intro_1', lang)}</p>
                    <p dangerouslySetInnerHTML={{ __html: getText('oil_sands_in_situ_intro_2', lang) }} />
                </div>

                <div className="oil-sands-in-situ-infographic-section">
                    <figure
                        className="oil-sands-in-situ-infographic-figure"
                        aria-label={getText('oil_sands_in_situ_infographic_aria', lang)}
                    >
                        <img
                            ref={infographicImgRef}
                            src={bgImage}
                            alt=""
                            className="oil-sands-in-situ-bg-image"
                            draggable={false}
                            aria-hidden="true"
                        />
                        <figcaption className="wb-inv">{getText('oil_sands_in_situ_infographic_aria', lang)}</figcaption>
                    </figure>

                    <div className="oil-sands-in-situ-download-buttons">
                        <button type="button" onClick={downloadInfographicPng}>
                            {getText('oil_sands_in_situ_download_png', lang)}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default OilSandsInSituMethod;
