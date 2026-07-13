import React, { useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import pipelinesBgEn from '../assets/major_cer_regulated_oil_pipelines_bg.svg';
import pipelinesBgFr from '../assets/major_cer_regulated_oil_pipelines_bg_fr.svg';

const waitForImage = (img) =>
    new Promise((resolve, reject) => {
        if (img.complete && img.naturalWidth > 0) {
            resolve(img);
            return;
        }
        img.onload = () => resolve(img);
        img.onerror = reject;
    });

const exportInfographicPng = async (imgEl, { scale = 2 }) => {
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

const MajorCerRegulatedOilPipelines = () => {
    const { lang, layoutPadding } = useOutletContext();
    const infographicImgRef = useRef(null);

    const pageTitle = getText('major_cer_regulated_oil_pipelines_title', lang);
    const bgImage = lang === 'en' ? pipelinesBgEn : pipelinesBgFr;
    const fileSlugBase = getText('major_cer_regulated_oil_pipelines_download_title', lang).replace(/\s+/g, '_');

    const downloadInfographicPng = async () => {
        const canvas = await exportInfographicPng(infographicImgRef.current, { scale: 2 });
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${fileSlugBase}.png`);
        });
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content major-cer-regulated-oil-pipelines"
            role="main"
            aria-labelledby="major-cer-regulated-oil-pipelines-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.major-cer-regulated-oil-pipelines {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.major-cer-regulated-oil-pipelines-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.major-cer-regulated-oil-pipelines.page-content .major-cer-regulated-oil-pipelines-title {
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
.major-cer-regulated-oil-pipelines.page-content .major-cer-regulated-oil-pipelines-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.major-cer-regulated-oil-pipelines-infographic-section { width: 100%; margin-bottom: 0; }
.major-cer-regulated-oil-pipelines-infographic-figure { margin: 0; width: 100%; }
.major-cer-regulated-oil-pipelines-bg-image {
    width: 100%;
    height: auto;
    display: block;
}
.major-cer-regulated-oil-pipelines-download-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 15px;
}
.major-cer-regulated-oil-pipelines-download-buttons button {
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
.major-cer-regulated-oil-pipelines-download-buttons button:hover { background-color: #404040 !important; }
@media (max-width: 768px) {
    .major-cer-regulated-oil-pipelines.page-content .major-cer-regulated-oil-pipelines-title { font-size: 37px; }
}
            `}</style>

            <div className="major-cer-regulated-oil-pipelines-inner">
                <h1
                    id="major-cer-regulated-oil-pipelines-title"
                    className="major-cer-regulated-oil-pipelines-title"
                >
                    {pageTitle}
                </h1>

                <div className="major-cer-regulated-oil-pipelines-infographic-section">
                    <figure
                        className="major-cer-regulated-oil-pipelines-infographic-figure"
                        aria-label={getText('major_cer_regulated_oil_pipelines_infographic_aria', lang)}
                    >
                        <img
                            ref={infographicImgRef}
                            src={bgImage}
                            alt=""
                            className="major-cer-regulated-oil-pipelines-bg-image"
                            draggable={false}
                            aria-hidden="true"
                        />
                        <figcaption className="wb-inv">
                            {getText('major_cer_regulated_oil_pipelines_infographic_aria', lang)}
                        </figcaption>
                    </figure>

                    <div className="major-cer-regulated-oil-pipelines-download-buttons">
                        <button type="button" onClick={downloadInfographicPng}>
                            {getText('major_cer_regulated_oil_pipelines_download_png', lang)}
                        </button>
                    </div>
                </div>

                <aside className="wb-fnote" role="note">
                    <h2 id="fn-major-cer-regulated-oil-pipelines">
                        {lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}
                    </h2>
                    <dl>
                        <dt>{lang === 'en' ? 'Footnote' : 'Note de bas de page'}</dt>
                        <dd>
                            <p>{getText('major_cer_regulated_oil_pipelines_footnote', lang)}</p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default MajorCerRegulatedOilPipelines;
