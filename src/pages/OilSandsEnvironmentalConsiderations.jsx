import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import PageShell from '../components/PageShell';
import AccessibleInfographic from '../components/AccessibleInfographic';
import ChartDataTable from '../components/ChartDataTable';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import { getText } from '../utils/translations';
import { formatLocaleNumber } from '../utils/formatLocale';
import { downloadInfographicImagePng } from '../utils/downloadInfographicPng';
import { getOilSandsEnvironmentalConsiderationsData } from '../utils/dataLoader';
import svgEn from '../assets/oil_sands_environmental_considerations_bg.svg?raw';
import svgFr from '../assets/oil_sands_environmental_considerations_bg_fr.svg?raw';

const replaceSvgText = (markup, id, value) => {
    const safe = String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return markup.replace(
        new RegExp(`(<text\\b[^>]*\\bid="${id}"[^>]*>)[\\s\\S]*?(</text>)`),
        `$1${safe}$2`,
    );
};

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const roundTo = (value, digits) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    const factor = 10 ** digits;
    return Math.round(number * factor) / factor;
};

const intensityLabel = (value, digits, lang) => {
    const rounded = roundTo(value, digits);
    if (rounded == null) return '';
    const shown = formatLocaleNumber(rounded, lang, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
    if (lang === 'fr') {
        return `${shown} ${Math.abs(rounded) < 2 ? 'baril' : 'barils'}`;
    }
    return `${shown} barrels`;
};

const shareLabel = (proportion, lang) => {
    const whole = roundTo(Number(proportion) * 100, 0);
    if (whole == null) return '';
    const shown = formatLocaleNumber(whole, lang, { maximumFractionDigits: 0 });
    return lang === 'fr' ? `${shown} %` : `${shown}%`;
};

const OilSandsEnvironmentalConsiderations = () => {
    const { lang, layoutPadding } = useOutletContext();
    const infographicRef = useRef(null);
    const [series, setSeries] = useState(null);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getOilSandsEnvironmentalConsiderationsData()
            .then((result) => {
                if (cancelled) return;
                setSeries(result);
                setLoadError(!result?.latest);
            })
            .catch(() => {
                if (!cancelled) setLoadError(true);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const latest = series?.latest;
    const years = series?.years || [];
    const startYear = years[0]?.year;
    const endYear = years[years.length - 1]?.year;
    const miningText = latest ? intensityLabel(latest.miningIntensity, 1, lang) : '';
    const insituText = latest ? intensityLabel(latest.insituIntensity, 2, lang) : '';
    const miningShareText = latest ? shareLabel(latest.miningRecycled, lang) : '';
    const insituShareText = latest ? shareLabel(latest.insituRecycled, lang) : '';
    const fileSlug = substitute(getText('oil_sands_environmental_considerations_download_title', lang), {
        startYear,
        endYear,
    });
    const caption = substitute(getText('oil_sands_environmental_considerations_table_caption', lang), {
        startYear,
        endYear,
    });
    const ariaLabel = substitute(getText('oil_sands_environmental_considerations_aria', lang), {
        mining: miningText,
        insitu: insituText,
        miningShare: miningShareText,
        insituShare: insituShareText,
    });

    const svgMarkup = useMemo(() => {
        if (!latest) return '';
        let markup = lang === 'fr' ? svgFr : svgEn;
        markup = replaceSvgText(markup, 'value-mining-intensity', miningText);
        markup = replaceSvgText(markup, 'value-insitu-intensity', insituText);
        markup = replaceSvgText(markup, 'value-mining-recycle', miningShareText);
        markup = replaceSvgText(markup, 'value-insitu-recycle', insituShareText);
        return markup;
    }, [lang, latest, miningText, insituText, miningShareText, insituShareText]);

    const columns = [
        { key: 'year', header: getText('oil_sands_environmental_considerations_col_year', lang), align: 'left' },
        { key: 'miningIntensity', header: getText('oil_sands_environmental_considerations_col_mining_intensity', lang), align: 'right' },
        { key: 'insituIntensity', header: getText('oil_sands_environmental_considerations_col_insitu_intensity', lang), align: 'right' },
        { key: 'miningRecycled', header: getText('oil_sands_environmental_considerations_col_mining_recycled', lang), align: 'right' },
        { key: 'insituRecycled', header: getText('oil_sands_environmental_considerations_col_insitu_recycled', lang), align: 'right' },
    ];

    const rows = years.map((row) => ({
        year: row.year,
        miningIntensity: intensityLabel(row.miningIntensity, 1, lang).replace(/ barrels| barils| baril/, ''),
        insituIntensity: intensityLabel(row.insituIntensity, 2, lang).replace(/ barrels| barils| baril/, ''),
        miningRecycled: shareLabel(row.miningRecycled, lang),
        insituRecycled: shareLabel(row.insituRecycled, lang),
    }));

    const downloadInfographicPng = async () => {
        const graphic = infographicRef.current?.getGraphicElement?.();
        if (!graphic) return;
        await downloadInfographicImagePng(graphic, { filename: `${fileSlug}.png`, scale: 2 });
    };

    return (
        <PageShell
            className="page-content page-120 oil-sands-environmental-considerations page-chrome page-chrome--bleed"
            aria-labelledby="oil-sands-environmental-considerations-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.oil-sands-environmental-considerations-inner {
    width: 100%;
    padding: 15px 0 40px 0;
    box-sizing: border-box;
}
.oil-sands-environmental-considerations-figure {
    margin: 0 0 15px 0;
    width: 100%;
}
.oil-sands-environmental-considerations-figure .accessible-infographic-svg svg {
    width: 100%;
    height: auto;
    display: block;
}
.oil-sands-environmental-considerations-download-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 15px;
}
.oil-sands-environmental-considerations-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: bold;
    color: #ffffff;
}
.oil-sands-environmental-considerations-download-buttons button:hover {
    background-color: #404040;
}
            `}</style>
            <div className="oil-sands-environmental-considerations-inner">
                <h1 id="oil-sands-environmental-considerations-title" className="oil-sands-environmental-considerations-title page-chrome-title">
                    {getText('oil_sands_environmental_considerations_title', lang)}
                </h1>
                {loadError && (
                    <p role="alert">{getText('oil_sands_environmental_considerations_no_data', lang)}</p>
                )}
                {latest && svgMarkup && (
                    <>
                        <AccessibleInfographic
                            ref={infographicRef}
                            as="figure"
                            mode="text"
                            className="oil-sands-environmental-considerations-figure"
                            label={ariaLabel}
                            svgMarkup={svgMarkup}
                        />
                        <div className="oil-sands-environmental-considerations-download-buttons">
                            <button type="button" onClick={downloadInfographicPng}>
                                {getText('oil_sands_environmental_considerations_download_png', lang)}
                            </button>
                        </div>
                        <ChartDataTable
                            lang={lang}
                            columns={columns}
                            rows={rows}
                            csvFilename={`${fileSlug}.csv`}
                            docx={{
                                filename: `${fileSlug}.docx`,
                                title: caption,
                                titleAlign: 'center',
                                columnWidths: [1400, 2800, 3400, 2800, 3000],
                                fontSize: 20,
                            }}
                            caption={caption}
                            tableAriaLabel={getText('oil_sands_environmental_considerations_table_summary', lang)}
                        />
                    </>
                )}
            </div>
        </PageShell>
    );
};

export default OilSandsEnvironmentalConsiderations;
