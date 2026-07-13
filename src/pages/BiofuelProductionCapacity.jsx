import React, { useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import biofuelCapacityBgEn from '../assets/biofuel_production_capacity_bg.svg';
import biofuelCapacityBgFr from '../assets/biofuel_production_capacity_bg_fr.svg';

const waitForImage = (img) =>
    new Promise((resolve, reject) => {
        if (img.complete && img.naturalWidth > 0) {
            resolve(img);
            return;
        }
        img.onload = () => resolve(img);
        img.onerror = reject;
    });

const BiofuelProductionCapacity = () => {
    const { lang, layoutPadding } = useOutletContext();
    const infographicImgRef = useRef(null);

    const bgImage = lang === 'en' ? biofuelCapacityBgEn : biofuelCapacityBgFr;
    const infographicTitle = getText('biofuel_production_capacity_infographic_title', lang);
    const fileSlug = getText('biofuel_production_capacity_download_title', lang).replace(/\s+/g, '_');

    const downloadInfographicPng = async () => {
        const imgEl = infographicImgRef.current;
        if (!imgEl) return;
        const loaded = await waitForImage(imgEl);
        const scale = 2;
        const titleHeight = 100;
        const canvas = document.createElement('canvas');
        canvas.width = loaded.naturalWidth * scale;
        canvas.height = (loaded.naturalHeight + titleHeight) * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, loaded.naturalWidth, loaded.naturalHeight + titleHeight);
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 36px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(infographicTitle, loaded.naturalWidth / 2, titleHeight / 2);
        ctx.drawImage(loaded, 0, titleHeight, loaded.naturalWidth, loaded.naturalHeight);
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${fileSlug}.png`);
        });
    };

    const downloadBtnStyle = {
        padding: '8px 16px',
        border: '1px solid #404040',
        borderRadius: '4px',
        background: '#8C8C8C',
        cursor: 'pointer',
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#ffffff',
        whiteSpace: 'nowrap',
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content biofuel-production-capacity"
            role="main"
            aria-labelledby="biofuel-production-capacity-infographic-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.biofuel-production-capacity {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.biofuel-production-capacity-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.biofuel-production-capacity-intro {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    line-height: 1.55;
    color: var(--gc-text);
    margin: 0 0 28px 0;

}
.biofuel-production-capacity-intro p { margin: 0 0 1rem 0; }
.biofuel-production-capacity-intro p:last-child { margin-bottom: 0; }
.biofuel-production-capacity-infographic-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 12px 0;
    line-height: 1.2;
    text-transform: none;
}
.biofuel-production-capacity-infographic-section { width: 100%; margin-bottom: 0; }
.biofuel-production-capacity-infographic-figure { margin: 0; width: 100%; }
.biofuel-production-capacity-bg-image {
    width: 100%;
    height: auto;
    display: block;
}
.biofuel-production-capacity-download-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 15px;
}
.biofuel-production-capacity-download-buttons button:hover { background-color: #404040 !important; }
.wb-inv {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    border: 0;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
}
@media (max-width: 768px) {
    .biofuel-production-capacity-intro { font-size: 18px; }
    .biofuel-production-capacity-infographic-title { font-size: 26px; }
}
            `}</style>

            <div className="biofuel-production-capacity-inner">
                <div className="biofuel-production-capacity-intro">
                    <p>
                        {getText('biofuel_production_capacity_intro_1_pre', lang)}
                        <strong>{getText('biofuel_production_capacity_intro_1_bold1', lang)}</strong>
                        {getText('biofuel_production_capacity_intro_1_mid', lang)}
                        <strong>{getText('biofuel_production_capacity_intro_1_bold2', lang)}</strong>
                        {getText('biofuel_production_capacity_intro_1_post', lang)}
                        {' '}
                        {getText('biofuel_production_capacity_intro_2', lang)}
                    </p>
                </div>

                <div className="biofuel-production-capacity-infographic-section">
                    <h2
                        id="biofuel-production-capacity-infographic-title"
                        className="biofuel-production-capacity-infographic-title"
                    >
                        {infographicTitle}
                    </h2>
                    <figure
                        className="biofuel-production-capacity-infographic-figure"
                        aria-label={getText('biofuel_production_capacity_infographic_aria', lang)}
                    >
                        <img
                            ref={infographicImgRef}
                            src={bgImage}
                            alt=""
                            className="biofuel-production-capacity-bg-image"
                            draggable={false}
                            aria-hidden="true"
                        />
                        <figcaption className="wb-inv">
                            {getText('biofuel_production_capacity_infographic_aria', lang)}
                        </figcaption>
                    </figure>

                    <div className="biofuel-production-capacity-download-buttons">
                        <button type="button" onClick={downloadInfographicPng} style={downloadBtnStyle}>
                            {getText('biofuel_production_capacity_download_infographic_png', lang)}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default BiofuelProductionCapacity;
