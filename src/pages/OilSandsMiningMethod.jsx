import React, { useEffect, useRef, useState } from 'react';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import SafeHtml from '../components/SafeHtml';
import { useOutletContext } from 'react-router-dom';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import { formatLocaleNumber } from '../utils/formatLocale';
import { resolveAccessibleInfographicGraphic, waitForImage } from '../utils/downloadInfographicPng';
import AccessibleInfographic from '../components/AccessibleInfographic';
import { getOilSandsMiningData } from '../utils/dataLoader';
import oilSandsMiningBgEn from '../assets/oil_sands_mining_bg.svg';
import oilSandsMiningBgFr from '../assets/oil_sands_mining_bg_fr.svg';
import oilSandsMiningPctMaskEn from '../assets/oil_sands_mining_pct_mask_en.png';
import oilSandsMiningPctMaskFr from '../assets/oil_sands_mining_pct_mask_fr.png';

const SVG_NATURAL = { width: 666.31335, height: 373.78668 };
const SVG_CROP_TOP = 105;
const SVG_DISPLAY_HEIGHT = SVG_NATURAL.height - SVG_CROP_TOP;
const SVG_CROP_TOP_PERCENT = (SVG_CROP_TOP / SVG_DISPLAY_HEIGHT) * 100;
const DROPLET = { x: 149.7, y: 181.0, width: 266.2, height: 105.6 };

const PRODUCTION_PCT_BOX = {
    en: { left: 26.885, top: 46.371, width: 7.587, height: 8.334, fontCqw: 3.45 },
    fr: { left: 26.917, top: 49.656, width: 7.669, height: 8.201, fontCqw: 3.4 },
};

const COUNT_WORDS = {
    en: { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten' },
    fr: { 1: 'un', 2: 'deux', 3: 'trois', 4: 'quatre', 5: 'cinq', 6: 'six', 7: 'sept', 8: 'huit', 9: 'neuf', 10: 'dix' },
};

const roundHalfUp = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.round(number);
};

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const wholeLabel = (value, lang) => {
    const rounded = roundHalfUp(value);
    if (rounded == null) return '';
    return formatLocaleNumber(rounded, lang, { maximumFractionDigits: 0 });
};

const exportOilSandsMiningInfographicPng = async (imgEl, { scale = 2, lang = 'en', productionPct = null, maskSrc = null }) => {
    if (!imgEl) return null;

    const loaded = await waitForImage(imgEl);
    const cropTop = (SVG_CROP_TOP / SVG_NATURAL.width) * loaded.naturalWidth;
    const cropHeight = (SVG_DISPLAY_HEIGHT / SVG_NATURAL.width) * loaded.naturalWidth;
    const cropWidth = loaded.naturalWidth;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(cropWidth * scale);
    canvas.height = Math.round(cropHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cropWidth, cropHeight);
    ctx.drawImage(loaded, 0, cropTop, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    if (productionPct != null && maskSrc) {
        const mask = new Image();
        mask.src = maskSrc;
        const loadedMask = await waitForImage(mask);
        if (lang === 'fr') {
            ctx.drawImage(loadedMask, 0, cropTop, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        } else {
            const unit = loaded.naturalWidth / SVG_NATURAL.width;
            ctx.drawImage(
                loadedMask,
                DROPLET.x * unit,
                DROPLET.y * unit - cropTop,
                DROPLET.width * unit,
                DROPLET.height * unit,
            );
        }
        const box = PRODUCTION_PCT_BOX[lang] || PRODUCTION_PCT_BOX.en;
        const x = (box.left / 100) * cropWidth;
        const y = (box.top / 100) * cropHeight;
        const width = (box.width / 100) * cropWidth;
        const height = (box.height / 100) * cropHeight;
        ctx.fillStyle = '#ffffff';
        ctx.font = `700 ${Math.round((box.fontCqw / 100) * cropWidth)}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${productionPct}%`, x + width / 2, y + height / 2);
    }
    return canvas;
};

const OilSandsMiningMethod = () => {
    const { lang, layoutPadding } = useOutletContext();
    const infographicImgRef = useRef(null);
    const [stats, setStats] = useState(null);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getOilSandsMiningData()
            .then((result) => {
                if (cancelled) return;
                setStats(result);
                setLoadError(!(result?.projects?.length === 7));
            })
            .catch(() => {
                if (!cancelled) setLoadError(true);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const pageTitle = getText('oil_sands_mining_title', lang);
    const bgImage = lang === 'en' ? oilSandsMiningBgEn : oilSandsMiningBgFr;
    const fileSlugBase = getText('oil_sands_mining_download_title', lang).replace(/\s+/g, '_');
    const projects = stats?.projects || [];
    const productionPct = roundHalfUp(stats?.productionPct);
    const pctBox = PRODUCTION_PCT_BOX[lang] || PRODUCTION_PCT_BOX.en;
    const pctMask = lang === 'fr' ? oilSandsMiningPctMaskFr : oilSandsMiningPctMaskEn;
    const countWords = COUNT_WORDS[lang]?.[roundHalfUp(stats?.projectCount)] || '';
    const projectValue = (key) => wholeLabel(projects.find((item) => item.key === key)?.mbd, lang);
    const narrative = projects.length === 7 && stats?.reportingYear && countWords
        ? substitute(getText('oil_sands_mining_intro_2', lang), {
            year: stats.reportingYear,
            count: countWords,
            total: wholeLabel(stats.totalMbd, lang),
            horizon: projectValue('horizon'),
            syncrude: projectValue('syncrude'),
            kearl: projectValue('kearl'),
            suncor: projectValue('suncor'),
            fortHills: projectValue('fort_hills'),
            muskeg: projectValue('muskeg'),
            jackpine: projectValue('jackpine'),
        })
        : '';
    const percentLabel = productionPct == null ? '' : `${productionPct}%`;
    const ariaPercent = productionPct == null ? '' : (lang === 'fr' ? `${productionPct} %` : `${productionPct}%`);

    const downloadInfographicPng = async () => {
        const canvas = await exportOilSandsMiningInfographicPng(
            resolveAccessibleInfographicGraphic(infographicImgRef.current),
            { scale: 2, lang, productionPct, maskSrc: pctMask },
        );
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${fileSlugBase}.png`);
        });
    };

    return (
        <PageShell tabIndex="-1"
            className="page-content oil-sands-mining page-chrome page-chrome--bleed"
            aria-labelledby="oil-sands-mining-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.oil-sands-mining {
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
    container-type: inline-size;
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
.oil-sands-mining-pct-mask {
    position: absolute;
    pointer-events: none;
    z-index: 1;
}
.oil-sands-mining-production-pct {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: #ffffff;
    z-index: 2;
    font-family: Arial, sans-serif;
    font-weight: 700;
    line-height: 1;
    pointer-events: none;
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
                    {narrative ? <SafeHtml as="p" html={narrative} /> : null}
                    {loadError && <p role="alert">{getText('oil_sands_mining_no_data', lang)}</p>}
                </div>

                <div className="oil-sands-mining-infographic-section">
                    <AccessibleInfographic
                        ref={infographicImgRef}
                        as="figure"
                        mode="image"
                        className="oil-sands-mining-infographic-figure"
                        title={pageTitle}
                        overview={`${pageTitle}. ${substitute(getText('oil_sands_mining_infographic_aria', lang), { percent: ariaPercent })}`}
                        src={bgImage}
                        imgClassName="oil-sands-mining-bg-image"
                    >
                        {productionPct != null && (
                            <img
                                className="oil-sands-mining-pct-mask"
                                src={pctMask}
                                alt=""
                                aria-hidden="true"
                                style={lang === 'fr'
                                    ? {
                                        top: `-${SVG_CROP_TOP_PERCENT}%`,
                                        left: 0,
                                        width: '100%',
                                        height: 'auto',
                                    }
                                    : {
                                        left: '22.467%',
                                        top: '28.275%',
                                        width: '39.951%',
                                        height: '39.288%',
                                    }}
                            />
                        )}
                        {productionPct != null && (
                            <span
                                className="oil-sands-mining-production-pct"
                                style={{
                                    left: `${pctBox.left}%`,
                                    top: `${pctBox.top}%`,
                                    width: `${pctBox.width}%`,
                                    height: `${pctBox.height}%`,
                                    fontSize: `${pctBox.fontCqw}cqw`,
                                }}
                                aria-hidden="true"
                            >
                                {percentLabel}
                            </span>
                        )}
                    </AccessibleInfographic>

                    <div className="oil-sands-mining-download-buttons">
                        <button type="button" onClick={downloadInfographicPng}>
                            {getText('oil_sands_mining_download_png', lang)}
                        </button>
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default OilSandsMiningMethod;
