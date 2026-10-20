import React, { useRef } from 'react';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import AccessibleInfographic from '../components/AccessibleInfographic';
import PageFootnotes from '../components/PageFootnotes';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import { downloadInfographicImagePng } from '../utils/downloadInfographicPng';
import pipelinesBgEn from '../assets/cer_regulated_gas_pipelines_bg.png';
import pipelinesBgFr from '../assets/cer_regulated_gas_pipelines_bg_fr.png';

const CerRegulatedGasPipelines = () => {
    const { lang, layoutPadding } = useOutletContext();
    const infographicRef = useRef(null);

    const pageTitle = getText('cer_regulated_gas_pipelines_title', lang);
    const pageSubtitle = getText('cer_regulated_gas_pipelines_subtitle', lang);
    const imageSrc = lang === 'en' ? pipelinesBgEn : pipelinesBgFr;
    const fileSlugBase = getText('cer_regulated_gas_pipelines_download_title', lang).replace(/\s+/g, '_');

    const downloadInfographicPng = async () => {
        await downloadInfographicImagePng(
            infographicRef.current?.getGraphicElement?.() ?? infographicRef.current,
            { filename: `${fileSlugBase}.png`, scale: 2 },
        );
    };

    return (
        <PageShell tabIndex="-1"
            className="page-content cer-regulated-gas-pipelines page-chrome page-chrome--bleed"
            aria-labelledby="cer-regulated-gas-pipelines-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.cer-regulated-gas-pipelines {
}
.cer-regulated-gas-pipelines-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.cer-regulated-gas-pipelines.page-content .cer-regulated-gas-pipelines-title {
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
.cer-regulated-gas-pipelines.page-content .cer-regulated-gas-pipelines-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.cer-regulated-gas-pipelines.page-content .cer-regulated-gas-pipelines-subtitle {
    font-family: 'Lato', sans-serif;
    font-size: 39px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 15px 0;
    text-transform: none;
}
.cer-regulated-gas-pipelines-infographic-section { width: 100%; margin-bottom: 0; }
.cer-regulated-gas-pipelines-infographic-figure { margin: 0; width: 100%; }
.cer-regulated-gas-pipelines-bg-image {
    width: 100%;
    height: auto;
    display: block;
}
.cer-regulated-gas-pipelines-download-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 15px;
}
.cer-regulated-gas-pipelines-download-buttons button {
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
.cer-regulated-gas-pipelines-download-buttons button:hover { background-color: #404040 !important; }
@media (max-width: 768px) {
    .cer-regulated-gas-pipelines.page-content .cer-regulated-gas-pipelines-title { font-size: 37px; }
    .cer-regulated-gas-pipelines.page-content .cer-regulated-gas-pipelines-subtitle { font-size: 35px; }
}
            `}</style>

            <div className="cer-regulated-gas-pipelines-inner">
                <h1
                    id="cer-regulated-gas-pipelines-title"
                    className="cer-regulated-gas-pipelines-title"
                >
                    {pageTitle}
                </h1>
                <p className="cer-regulated-gas-pipelines-subtitle">
                    {pageSubtitle}
                </p>

                <div className="cer-regulated-gas-pipelines-infographic-section">
                    <AccessibleInfographic
                        ref={infographicRef}
                        mode="image"
                        as="figure"
                        className="cer-regulated-gas-pipelines-infographic-figure"
                        title={pageTitle}
                        overview={pageSubtitle}
                        src={imageSrc}
                        imgClassName="cer-regulated-gas-pipelines-bg-image"
                        imgStyle={{ width: '100%', height: 'auto', display: 'block' }}
                        idPrefix={`cer-gas-pipelines-${lang}`}
                    />

                    <div className="cer-regulated-gas-pipelines-download-buttons">
                        <button type="button" onClick={downloadInfographicPng}>
                            {getText('cer_regulated_gas_pipelines_download_png', lang)}
                        </button>
                    </div>
                </div>

                <PageFootnotes
                    lang={lang}
                    titleId="fn-cer-regulated-gas-pipelines"
                    items={[{
                        id: 'fn-asterisk-cer-regulated-gas-pipelines',
                        text: getText('cer_regulated_gas_pipelines_footnote', lang),
                        hideMarker: true,
                    }]}
                />
            </div>
        </PageShell>
    );
};

export default CerRegulatedGasPipelines;
