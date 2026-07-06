import React, { useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import oilSandsMiningBgEn from '../assets/oil_sands_mining_bg.svg';
import oilSandsMiningBgFr from '../assets/oil_sands_mining_bg_fr.svg';

const SVG_NATURAL = { width: 666.31335, height: 373.78668 };
const SVG_CROP_TOP = 105;
const SVG_DISPLAY_HEIGHT = SVG_NATURAL.height - SVG_CROP_TOP;
const SVG_CROP_TOP_RATIO = SVG_CROP_TOP / SVG_NATURAL.height;
const SVG_CROP_TOP_PERCENT = (SVG_CROP_TOP / SVG_DISPLAY_HEIGHT) * 100;

const waitForImage = (img) =>
    new Promise((resolve, reject) => {
        if (img.complete && img.naturalWidth > 0) {
            resolve(img);
            return;
        }
        img.onload = () => resolve(img);
        img.onerror = reject;
    });

const exportOilSandsMiningInfographicPng = async (imgEl, { scale = 2 }) => {
    if (!imgEl) return null;

    const loaded = await waitForImage(imgEl);
    const cropTop = Math.round(loaded.naturalHeight * SVG_CROP_TOP_RATIO);
    const cropWidth = loaded.naturalWidth;
    const cropHeight = loaded.naturalHeight - cropTop;

    const canvas = document.createElement('canvas');
    canvas.width = cropWidth * scale;
    canvas.height = cropHeight * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cropWidth, cropHeight);
    ctx.drawImage(loaded, 0, cropTop, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    return canvas;
};

const OilSandsMiningMethod = () => {
    const { lang, layoutPadding } = useOutletContext();
    const infographicImgRef = useRef(null);

    const pageTitle = getText('oil_sands_mining_title', lang);
    const bgImage = lang === 'en' ? oilSandsMiningBgEn : oilSandsMiningBgFr;
    const fileSlugBase = getText('oil_sands_mining_download_title', lang).replace(/\s+/g, '_');

    const downloadInfographicPng = async () => {
        const canvas = await exportOilSandsMiningInfographicPng(infographicImgRef.current, { scale: 2 });
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${fileSlugBase}.png`);
        });
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content oil-sands-mining"
            role="main"
            aria-labelledby="oil-sands-mining-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.oil-sands-mining {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.oil-sands-mining-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.oil-sands-mining.page-content .oil-sands-mining-title {
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
.oil-sands-mining.page-content .oil-sands-mining-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.oil-sands-mining-intro {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    line-height: 1.55;
    color: var(--gc-text);
    margin: 0 0 80px 0;
}
.oil-sands-mining-intro p { margin: 0 0 1rem 0; }
.oil-sands-mining-intro p:last-child { margin-bottom: 0; }
.oil-sands-mining-intro strong { font-weight: bold; }
.oil-sands-mining-infographic-section { width: 100%; margin-bottom: 0; margin-top: 0; }
.oil-sands-mining-infographic-figure {
    margin: 0;
    width: 100%;
    overflow: hidden;
    position: relative;
    aspect-ratio: ${SVG_NATURAL.width} / ${SVG_DISPLAY_HEIGHT};
}
.oil-sands-mining-bg-image {
    position: absolute;
    top: -${SVG_CROP_TOP_PERCENT}%;
    left: 0;
    width: 100%;
    height: auto;
    display: block;
}
.oil-sands-mining-download-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 15px;
}
.oil-sands-mining-download-buttons button {
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
.oil-sands-mining-download-buttons button:hover { background-color: #404040 !important; }
@media (max-width: 768px) {
    .oil-sands-mining.page-content .oil-sands-mining-title { font-size: 37px; }
    .oil-sands-mining-intro { font-size: 18px; }
}
            `}</style>

            <div className="oil-sands-mining-inner">
                <h1 id="oil-sands-mining-title" className="oil-sands-mining-title">
                    {pageTitle}
                </h1>

                <div className="oil-sands-mining-intro">
                    <p>{getText('oil_sands_mining_intro_1', lang)}</p>
                    <p dangerouslySetInnerHTML={{ __html: getText('oil_sands_mining_intro_2', lang) }} />
                </div>

                <div className="oil-sands-mining-infographic-section">
                    <figure
                        className="oil-sands-mining-infographic-figure"
                        aria-label={getText('oil_sands_mining_infographic_aria', lang)}
                    >
                        <img
                            ref={infographicImgRef}
                            src={bgImage}
                            alt=""
                            className="oil-sands-mining-bg-image"
                            draggable={false}
                            aria-hidden="true"
                        />
                        <figcaption className="wb-inv">{getText('oil_sands_mining_infographic_aria', lang)}</figcaption>
                    </figure>

                    <div className="oil-sands-mining-download-buttons">
                        <button type="button" onClick={downloadInfographicPng}>
                            {getText('oil_sands_mining_download_png', lang)}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default OilSandsMiningMethod;
