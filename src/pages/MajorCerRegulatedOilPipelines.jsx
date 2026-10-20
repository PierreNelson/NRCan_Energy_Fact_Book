import React, { useRef } from 'react';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import AccessibleInfographic from '../components/AccessibleInfographic';
import PageFootnotes from '../components/PageFootnotes';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import { downloadInfographicImagePng } from '../utils/downloadInfographicPng';
import pipelinesBgEn from '../assets/major_cer_regulated_oil_pipelines_bg.png';
import pipelinesBgFr from '../assets/major_cer_regulated_oil_pipelines_bg_fr.png';

const MajorCerRegulatedOilPipelines = () => {
    const { lang, layoutPadding } = useOutletContext();
    const infographicRef = useRef(null);

    const pageTitle = getText('major_cer_regulated_oil_pipelines_title', lang);
    const imageSrc = lang === 'en' ? pipelinesBgEn : pipelinesBgFr;
    const fileSlugBase = getText('major_cer_regulated_oil_pipelines_download_title', lang).replace(/\s+/g, '_');
    const footnote = getText('major_cer_regulated_oil_pipelines_footnote', lang);

    const downloadInfographicPng = async () => {
        await downloadInfographicImagePng(
            infographicRef.current?.getGraphicElement?.() ?? infographicRef.current,
            { filename: `${fileSlugBase}.png`, scale: 2 },
        );
    };

    return (
        <PageShell tabIndex="-1"
            className="page-content major-cer-regulated-oil-pipelines page-chrome page-chrome--bleed"
            aria-labelledby="major-cer-regulated-oil-pipelines-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.major-cer-regulated-oil-pipelines {
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
                    <AccessibleInfographic
                        ref={infographicRef}
                        mode="image"
                        as="figure"
                        className="major-cer-regulated-oil-pipelines-infographic-figure"
                        title={pageTitle}
                        overview={getText('major_cer_regulated_oil_pipelines_infographic_aria', lang)}
                        src={imageSrc}
                        imgClassName="major-cer-regulated-oil-pipelines-bg-image"
                        imgStyle={{ width: '100%', height: 'auto', display: 'block' }}
                        idPrefix={`cer-oil-pipelines-${lang}`}
                    />

                    <div className="major-cer-regulated-oil-pipelines-download-buttons">
                        <button type="button" onClick={downloadInfographicPng}>
                            {getText('major_cer_regulated_oil_pipelines_download_png', lang)}
                        </button>
                    </div>
                </div>

                <PageFootnotes
                    lang={lang}
                    titleId="fn-major-cer-regulated-oil-pipelines"
                    items={[{
                        id: 'fn-asterisk-major-cer-regulated-oil-pipelines',
                        marker: '*',
                        text: footnote,
                        hideReturn: true,
                    }]}
                />
            </div>
        </PageShell>
    );
};

export default MajorCerRegulatedOilPipelines;
