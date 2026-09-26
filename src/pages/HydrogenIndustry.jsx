import React, { useCallback, useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import SafeHtml from '../components/SafeHtml';
import { useOutletContext } from 'react-router-dom';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import { waitForImage } from '../utils/downloadInfographicPng';
import { stripHtml } from '../utils/stripHtml';
import AccessibleInfographic from '../components/AccessibleInfographic';
import hydrogenIndustryBg from '../assets/hydrogen_industry_bg.svg';

const NATIVE_WIDTH = 2037.8134;
const NATIVE_HEIGHT = 828.94666;

const hydrogen_industry_DATA = {
    productionMt: 4,
    electrolyserMw: 20,
    lowCarbonCapacityTonnes: 12000,
    companies: 100,
    employment: 4300,
    revenueMillions: 525,
    rddMillions: 125,
};

const TABLE_ROW_KEYS = [
    'production_mt',
    'electrolyser_mw',
    'low_carbon_capacity',
    'companies',
    'employment',
    'revenue',
    'rdd',
];

const exportNuclearInfographicPng = async (exportRoot, { scale = 2 }) => {
    if (!exportRoot) return null;

    const bulletsEl = exportRoot.querySelector('.hydrogen-industry-bullets');
    const imgEl = exportRoot.querySelector('.hydrogen-industry-bg-image');
    if (!bulletsEl || !imgEl) return null;

    const loaded = await waitForImage(imgEl);
    const rootRect = exportRoot.getBoundingClientRect();
    const imgBox = (() => {
        const box = imgEl.getBoundingClientRect();
        return {
            x: box.left - rootRect.left,
            y: box.top - rootRect.top,
            w: box.width,
            h: box.height,
        };
    })();

    const canvasW = Math.ceil(exportRoot.clientWidth);
    const canvasH = Math.ceil(imgBox.y + imgBox.h + 16);
    const canvas = document.createElement('canvas');
    canvas.width = canvasW * scale;
    canvas.height = canvasH * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const rel = (el) => {
        const box = el.getBoundingClientRect();
        return {
            x: box.left - rootRect.left,
            y: box.top - rootRect.top,
            w: box.width,
            h: box.height,
        };
    };

    const drawTextSegment = (node) => {
        const raw = node.textContent ?? '';
        if (!raw.trim()) return;
        const range = document.createRange();
        range.selectNodeContents(node);
        const style = window.getComputedStyle(node.nodeType === Node.TEXT_NODE ? node.parentElement : node);
        ctx.fillStyle = style.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const rects = Array.from(range.getClientRects());
        if (rects.length <= 1) {
            const rect = rects[0] ?? range.getBoundingClientRect();
            ctx.fillText(raw, rect.left - rootRect.left, rect.top - rootRect.top);
            return;
        }
        const leading = raw.match(/^\s*/)?.[0] ?? '';
        const words = raw.trim().split(/\s+/);
        let wordIndex = 0;
        rects.forEach((rect, rectIndex) => {
            let line = rectIndex === 0 ? leading : '';
            while (wordIndex < words.length) {
                const separator = line && !line.endsWith(' ') ? ' ' : '';
                const candidate = `${line}${separator}${words[wordIndex]}`;
                if (line && ctx.measureText(candidate).width > rect.width + 2) break;
                line = candidate;
                wordIndex += 1;
            }
            if (line) {
                ctx.fillText(line, rect.left - rootRect.left, rect.top - rootRect.top);
            }
        });
    };

    ctx.drawImage(loaded, imgBox.x, imgBox.y, imgBox.w, imgBox.h);

    bulletsEl.querySelectorAll('li').forEach((li) => {
        const liBox = rel(li);
        const liStyle = window.getComputedStyle(li);
        ctx.font = `${liStyle.fontWeight} ${liStyle.fontSize} ${liStyle.fontFamily}`;
        ctx.fillStyle = liStyle.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('•', Math.max(0, liBox.x - 16), liBox.y);
        li.childNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
                drawTextSegment(node);
            }
        });
    });

    return canvas;
};

const HydrogenIndustry = () => {
    const { lang, layoutPadding } = useOutletContext();
    const exportRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const formatInt = useCallback((value) => Number(value).toLocaleString(locale, { maximumFractionDigits: 0 }), [locale]);

    const tableCaption = getText('hydrogen_industry_table_caption', lang);
    const exportTableTitle = stripHtml(tableCaption);
    const csvFilename = getText('hydrogen_industry_csv_slug', lang);
    const docxFilename = getText('hydrogen_industry_docx_slug', lang);

    const tableColumns = useMemo(() => [
        { key: 'description', header: getText('hydrogen_industry_table_col_description', lang), align: 'left' },
        { key: 'value', header: getText('hydrogen_industry_table_col_value', lang), align: 'num' },
    ], [lang]);

    const tableRows = useMemo(() => {
        const overPrefix = getText('hydrogen_industry_table_over_prefix', lang);
        const revenuePrefix = getText('hydrogen_industry_table_revenue_prefix', lang);
        return TABLE_ROW_KEYS.map((key) => {
            let value;
            switch (key) {
                case 'production_mt':
                    value = String(hydrogen_industry_DATA.productionMt);
                    break;
                case 'electrolyser_mw':
                    value = String(hydrogen_industry_DATA.electrolyserMw);
                    break;
                case 'low_carbon_capacity':
                    value = `${overPrefix}${formatInt(hydrogen_industry_DATA.lowCarbonCapacityTonnes)}`;
                    break;
                case 'companies':
                    value = `${overPrefix}${hydrogen_industry_DATA.companies}`;
                    break;
                case 'employment':
                    value = formatInt(hydrogen_industry_DATA.employment);
                    break;
                case 'revenue':
                    value = lang === 'fr'
                        ? `${overPrefix}${formatInt(hydrogen_industry_DATA.revenueMillions)}`
                        : `${revenuePrefix}${formatInt(hydrogen_industry_DATA.revenueMillions)}+`;
                    break;
                case 'rdd':
                    value = lang === 'fr'
                        ? formatInt(hydrogen_industry_DATA.rddMillions)
                        : `${revenuePrefix}${formatInt(hydrogen_industry_DATA.rddMillions)}`;
                    break;
                default:
                    value = '';
            }
            return {
                description: getText(`hydrogen_industry_table_row_${key}`, lang),
                value,
            };
        });
    }, [lang, formatInt]);

    const downloadInfographicPng = async () => {
        const canvas = await exportNuclearInfographicPng(exportRef.current, { scale: 2 });
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, getText('hydrogen_industry_png_slug', lang));
        });
    };

    return (
        <PageShell tabIndex="-1"
            className="page-content page-102 page-chrome page-chrome--bleed"
            aria-labelledby="hydrogen-industry-main-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.page-102.page-content { max-width: none !important; overflow-x: visible !important; }
.page-102 {
}
.hydrogen-industry-container { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.hydrogen-industry-bullets {
    font-family: var(--font-body);
    font-size: clamp(17px, 2vw, 20px);
    color: var(--gc-text);
    line-height: 1.55;
    margin: 0 0 28px 0;
    padding-left: 1.25rem;
}
.hydrogen-industry-bullets li { margin-bottom: 0.85rem; }
.hydrogen-industry-bullets strong { font-weight: bold; }
.hydrogen-industry-infographic-figure {
    position: relative;
    width: 100%;
    margin: 0 0 20px 0;
}
.hydrogen-industry-infographic-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: ${NATIVE_WIDTH} / ${NATIVE_HEIGHT};
}
.hydrogen-industry-bg-image {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    user-select: none;
    pointer-events: none;
}
.hydrogen-industry-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 24px; }
.hydrogen-industry-table-wrapper { display: block; width: 100%; margin-top: 0; margin-bottom: 0; }
            `}</style>

            <div className="hydrogen-industry-container">
                <h1 id="hydrogen-industry-main-title" className="wb-inv">
                    {getText('hydrogen_industry_title', lang)}
                </h1>

                <div ref={exportRef} className="hydrogen-industry-export-region">
                    <ul className="hydrogen-industry-bullets">
                        <SafeHtml as="li" html={getText('hydrogen_industry_bullet1', lang)}  />
                        <li>{getText('hydrogen_industry_bullet2', lang)}</li>
                        <SafeHtml as="li" html={getText('hydrogen_industry_bullet3', lang)}  />
                        <SafeHtml as="li" html={getText('hydrogen_industry_bullet4', lang)}  />
                    </ul>

                    <AccessibleInfographic
                        as="figure"
                        mode="image"
                        className="hydrogen-industry-infographic-figure"
                        title={getText('hydrogen_industry_title', lang)}
                        overview={`${getText('hydrogen_industry_title', lang)}. ${getText('hydrogen_industry_infographic_aria', lang)}`}
                        src={hydrogenIndustryBg}
                        imgClassName="hydrogen-industry-bg-image"
                    >
                        <div className="hydrogen-industry-infographic-wrapper" aria-hidden="true" />
                    </AccessibleInfographic>
                </div>

                <div className="hydrogen-industry-download-buttons">
                    <button type="button" className="download-table-btn" onClick={downloadInfographicPng}>
                        {getText('hydrogen_industry_download_infographic_png', lang)}
                    </button>
                </div>

                <div className="hydrogen-industry-table-wrapper">
                    <ChartDataTable
                        lang={lang}
                        columns={tableColumns}
                        rows={tableRows}
                        csvFilename={csvFilename}
                        docx={{
                            filename: docxFilename,
                            title: exportTableTitle,
                            titleAlign: 'center',
                            columnWidths: [5200, 2200],
                            fontSize: 22,
                        }}
                        caption={tableCaption}
                        tableAriaLabel={tableCaption}
                    />
                </div>
            </div>
        </PageShell>
    );
};

export default HydrogenIndustry;
