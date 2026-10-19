import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import { saveAs } from 'file-saver';
import { getHydrogenCanadaSummaryData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { waitForImage } from '../utils/downloadInfographicPng';
import { stripHtml } from '../utils/stripHtml';
import AccessibleInfographic from '../components/AccessibleInfographic';
import hydrogenIndustryBg from '../assets/hydrogen_industry_bg.svg';

const NATIVE_WIDTH = 2037.8134;
const NATIVE_HEIGHT = 828.94666;

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
    const [summary, setSummary] = useState(null);

    useEffect(() => {
        let cancelled = false;
        getHydrogenCanadaSummaryData().then((data) => {
            if (!cancelled) setSummary(data);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const bullets = summary?.[lang]?.length
        ? summary[lang]
        : [1, 2, 3, 4].map((index) => stripHtml(getText(`hydrogen_industry_bullet${index}`, lang)));

    const tableCaption = getText('hydrogen_industry_table_caption', lang);
    const exportTableTitle = stripHtml(tableCaption);
    const csvFilename = getText('hydrogen_industry_csv_slug', lang);
    const docxFilename = getText('hydrogen_industry_docx_slug', lang);

    const tableColumns = useMemo(() => [
        { key: 'summary', header: getText('hydrogen_industry_table_col_description', lang), align: 'left' },
    ], [lang]);

    const tableRows = useMemo(
        () => bullets.map((text) => ({ summary: text })),
        [bullets],
    );

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
                        {bullets.map((text) => (
                            <li key={text}>{text}</li>
                        ))}
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
                            columnWidths: [7400],
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
