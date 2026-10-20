import React, { useEffect, useRef, useState } from 'react';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import SafeHtml from '../components/SafeHtml';
import { useOutletContext } from 'react-router-dom';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import { resolveAccessibleInfographicGraphic, waitForImage } from '../utils/downloadInfographicPng';
import AccessibleInfographic from '../components/AccessibleInfographic';
import { getOilSandsInSituData } from '../utils/dataLoader';
import oilSandsInSituBgEn from '../assets/oil_sands_in_situ_bg.svg';
import oilSandsInSituBgFr from '../assets/oil_sands_in_situ_bg_fr.svg';
import oilSandsInSituPctMaskEn from '../assets/oil_sands_in_situ_pct_mask_en.png';
import oilSandsInSituPctMaskFr from '../assets/oil_sands_in_situ_pct_mask_fr.png';

const PRODUCTION_PCT_BOX = {
    en: { left: 14.313, top: 13.491, width: 6.107, height: 4.722, fontCqw: 2.481 },
    fr: { left: 13.504, top: 14.147, width: 7.031, height: 4.651, fontCqw: 2.455 },
};

const PRODUCTION_PCT_MASK = {
    en: oilSandsInSituPctMaskEn,
    fr: oilSandsInSituPctMaskFr,
};

const roundHalfUp = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.round(number);
};

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const exportOilSandsInSituInfographicPng = async (imgEl, { scale = 2, lang = 'en', productionPct = null, maskSrc = null }) => {
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
    if (productionPct != null) {
        const box = PRODUCTION_PCT_BOX[lang] || PRODUCTION_PCT_BOX.en;
        if (maskSrc) {
            const mask = new Image();
            mask.src = maskSrc;
            const loadedMask = await waitForImage(mask);
            ctx.drawImage(loadedMask, 0, 0, loaded.naturalWidth, loaded.naturalHeight);
        }
        const x = (box.left / 100) * loaded.naturalWidth;
        const y = (box.top / 100) * loaded.naturalHeight;
        const width = (box.width / 100) * loaded.naturalWidth;
        const height = (box.height / 100) * loaded.naturalHeight;
        const label = lang === 'fr' ? `${productionPct} %` : `${productionPct}%`;
        ctx.fillStyle = '#ffffff';
        ctx.font = `700 ${Math.round((box.fontCqw / 100) * loaded.naturalWidth)}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + width / 2, y + height / 2);
    }
    return canvas;
};

const OilSandsInSituMethod = () => {
    const { lang, layoutPadding } = useOutletContext();
    const infographicImgRef = useRef(null);
    const [stats, setStats] = useState(null);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getOilSandsInSituData()
            .then((result) => {
                if (cancelled) return;
                setStats(result);
                setLoadError(!(result?.projects?.length >= 4));
            })
            .catch(() => {
                if (!cancelled) setLoadError(true);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const pageTitle = getText('oil_sands_in_situ_title', lang);
    const titleUsesHtml = lang === 'fr';
    const bgImage = lang === 'en' ? oilSandsInSituBgEn : oilSandsInSituBgFr;
    const fileSlugBase = getText('oil_sands_in_situ_download_title', lang).replace(/\s+/g, '_');

    const productionPct = roundHalfUp(stats?.productionPct);
    const projects = stats?.projects || [];
    const volumeUnit = lang === 'fr' ? 'kb/j' : 'Mb/d';
    const percentLabel = productionPct == null
        ? ''
        : (lang === 'fr' ? `${productionPct} %` : `${productionPct}%`);
    const pctBox = PRODUCTION_PCT_BOX[lang] || PRODUCTION_PCT_BOX.en;
    const pctMask = PRODUCTION_PCT_MASK[lang] || PRODUCTION_PCT_MASK.en;

    const downloadInfographicPng = async () => {
        const canvas = await exportOilSandsInSituInfographicPng(
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
            className="page-content oil-sands-in-situ page-chrome page-chrome--bleed"
            aria-labelledby="oil-sands-in-situ-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.oil-sands-in-situ {
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
.oil-sands-in-situ-infographic-figure { margin: 0; width: 100%; position: relative; container-type: inline-size; }
.oil-sands-in-situ-production-pct {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: #ffffff;
    z-index: 1;
    font-family: Arial, sans-serif;
    font-weight: 700;
    line-height: 1;
    pointer-events: none;
}
.oil-sands-in-situ-pct-mask {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}
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
                        <SafeHtml as="span" html={pageTitle}  />
                    ) : (
                        pageTitle
                    )}
                </h1>

                <div className="oil-sands-in-situ-intro">
                    <p>{getText('oil_sands_in_situ_intro_1', lang)}</p>
                    {projects.length >= 4 && (
                        <p>
                            <strong>
                                {lang === 'fr'
                                    ? `${roundHalfUp(stats.projectCount)} projets en Alberta :`
                                    : `${roundHalfUp(stats.projectCount)} projects in Alberta –`}
                            </strong>
                            {' '}
                            {lang === 'fr' ? (
                                <>
                                    Les projets les plus importants en date de {stats.reportingYear} sont les projets {projects[0].label} à <strong>{roundHalfUp(projects[0].mbd)} {volumeUnit}</strong>, {projects[1].label} à <strong>{roundHalfUp(projects[1].mbd)} {volumeUnit}</strong>, {projects[2].label} à <strong>{roundHalfUp(projects[2].mbd)} {volumeUnit}</strong> et {projects[3].label} à <strong>{roundHalfUp(projects[3].mbd)} {volumeUnit}</strong>.
                                </>
                            ) : (
                                <>
                                    The largest projects in {stats.reportingYear} were {projects[0].label} at <strong>{roundHalfUp(projects[0].mbd)} {volumeUnit}</strong>, {projects[1].label} at <strong>{roundHalfUp(projects[1].mbd)} {volumeUnit}</strong>, {projects[2].label} at <strong>{roundHalfUp(projects[2].mbd)} {volumeUnit}</strong> and {projects[3].label} at <strong>{roundHalfUp(projects[3].mbd)} {volumeUnit}</strong>.
                                </>
                            )}
                        </p>
                    )}
                    {loadError && <p role="alert">{getText('oil_sands_in_situ_no_data', lang)}</p>}
                </div>

                <div className="oil-sands-in-situ-infographic-section">
                    <AccessibleInfographic
                        ref={infographicImgRef}
                        as="figure"
                        mode="image"
                        className="oil-sands-in-situ-infographic-figure"
                        title={getText('oil_sands_in_situ_title', lang).replace(/<[^>]*>/g, '')}
                        overview={`${getText('oil_sands_in_situ_title', lang).replace(/<[^>]*>/g, '')}. ${substitute(getText('oil_sands_in_situ_infographic_aria', lang), { percent: percentLabel })}`}
                        src={bgImage}
                        imgClassName="oil-sands-in-situ-bg-image"
                    >
                        {productionPct != null && (
                            <img
                                className="oil-sands-in-situ-pct-mask"
                                src={pctMask}
                                alt=""
                                aria-hidden="true"
                            />
                        )}
                        {productionPct != null && (
                            <span
                                className="oil-sands-in-situ-production-pct"
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

                    <div className="oil-sands-in-situ-download-buttons">
                        <button type="button" onClick={downloadInfographicPng}>
                            {getText('oil_sands_in_situ_download_png', lang)}
                        </button>
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default OilSandsInSituMethod;
