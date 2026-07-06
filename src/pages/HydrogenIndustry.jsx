import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
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

const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

const waitForImage = (img) =>
    new Promise((resolve, reject) => {
        if (img.complete && img.naturalWidth > 0) {
            resolve(img);
            return;
        }
        img.onload = () => resolve(img);
        img.onerror = reject;
    });

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
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);
    const exportRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const formatInt = useCallback((value) => Number(value).toLocaleString(locale, { maximumFractionDigits: 0 }), [locale]);

    const tableHeaders = [
        getText('hydrogen_industry_table_col_description', lang),
        getText('hydrogen_industry_table_col_value', lang),
    ];

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
                key,
                description: getText(`hydrogen_industry_table_row_${key}`, lang),
                value,
            };
        });
    }, [lang, formatInt]);

    const syncTableScroll = useCallback(() => {
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = bottomScrollRef.current;
        if (!topScroll || !tableScroll || !bottomScroll) return;
        const table = tableScroll.querySelector('table');
        if (!table) return;
        [topScroll.firstElementChild, bottomScroll.firstElementChild].forEach((spacer) => {
            if (spacer) spacer.style.width = `${table.offsetWidth}px`;
        });
        const shouldShow = table.offsetWidth > tableScroll.clientWidth;
        topScroll.style.display = shouldShow ? 'block' : 'none';
        bottomScroll.style.display = shouldShow ? 'block' : 'none';
    }, []);

    useEffect(() => {
        if (!isTableOpen) return undefined;
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = bottomScrollRef.current;
        if (!topScroll || !tableScroll || !bottomScroll) return undefined;

        const syncFrom = (source) => {
            if (source !== topScroll && topScroll.scrollLeft !== source.scrollLeft) topScroll.scrollLeft = source.scrollLeft;
            if (source !== tableScroll && tableScroll.scrollLeft !== source.scrollLeft) tableScroll.scrollLeft = source.scrollLeft;
            if (source !== bottomScroll && bottomScroll.scrollLeft !== source.scrollLeft) bottomScroll.scrollLeft = source.scrollLeft;
        };

        const handleTop = () => syncFrom(topScroll);
        const handleTable = () => syncFrom(tableScroll);
        const handleBottom = () => syncFrom(bottomScroll);
        const sync = () => window.requestAnimationFrame(syncTableScroll);

        topScroll.addEventListener('scroll', handleTop);
        tableScroll.addEventListener('scroll', handleTable);
        bottomScroll.addEventListener('scroll', handleBottom);
        const observer = new ResizeObserver(sync);
        const tableEl = tableScroll.querySelector('table');
        if (tableEl) observer.observe(tableEl);
        observer.observe(tableScroll);
        sync();

        return () => {
            topScroll.removeEventListener('scroll', handleTop);
            tableScroll.removeEventListener('scroll', handleTable);
            bottomScroll.removeEventListener('scroll', handleBottom);
            observer.disconnect();
        };
    }, [isTableOpen, windowWidth, syncTableScroll]);

    const downloadBtnStyle = {
        padding: '8px 16px',
        backgroundColor: '#8C8C8C',
        border: '1px solid #404040',
        borderRadius: '4px',
        cursor: 'pointer',
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        color: '#ffffff',
    };

    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const downloadCsv = () => {
        const header = tableHeaders.map(csvEscape).join(',');
        const rows = tableRows
            .map((row) => [row.description, row.value].map(csvEscape).join(','))
            .join('\n');
        saveAs(
            new Blob([[header, rows].join('\n')], { type: 'text/csv;charset=utf-8;' }),
            getText('hydrogen_industry_csv_slug', lang),
        );
    };

    const downloadDocx = async () => {
        const headerRow = new TableRow({
            children: tableHeaders.map(
                (header) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: header, bold: true, size: 22 })],
                                alignment: AlignmentType.CENTER,
                            }),
                        ],
                        shading: { fill: 'E6E6E6' },
                    }),
            ),
        });
        const dataRows = tableRows.map(
            (row) =>
                new TableRow({
                    children: [row.description, row.value].map(
                        (value) =>
                            new TableCell({
                                children: [
                                    new Paragraph({
                                        children: [new TextRun({ text: String(value ?? ''), size: 22 })],
                                        alignment: AlignmentType.CENTER,
                                    }),
                                ],
                            }),
                    ),
                }),
        );

        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: stripHtml(getText('hydrogen_industry_table_caption', lang)),
                                bold: true,
                                size: 28,
                            }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [5200, 2200],
                        rows: [headerRow, ...dataRows],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), getText('hydrogen_industry_docx_slug', lang));
    };

    const downloadInfographicPng = async () => {
        const canvas = await exportNuclearInfographicPng(exportRef.current, { scale: 2 });
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, getText('hydrogen_industry_png_slug', lang));
        });
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-102"
            role="main"
            aria-labelledby="hydrogen-industry-main-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-102.page-content { max-width: none !important; overflow-x: visible !important; }
.page-102 {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
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
.hydrogen-industry-table-wrapper details > summary {
    display: block;
    width: 100%;
    padding: 12px 15px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    color: #ffffff;
    font-family: Arial, sans-serif;
    font-weight: bold;
    cursor: pointer;
    list-style: none;
    box-sizing: border-box;
}
.hydrogen-industry-table-wrapper details > summary::-webkit-details-marker { display: none; }
.hydrogen-industry-table-wrapper details > summary:hover,
.hydrogen-industry-table-wrapper button:hover { background-color: #404040 !important; }
.hydrogen-industry-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.hydrogen-industry-table-scrollbar > div { height: 20px; }
.hydrogen-industry-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #dee2e6;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.hydrogen-industry-table-responsive::-webkit-scrollbar { display: none; }
.hydrogen-industry-table-responsive table { width: max-content !important; min-width: 100%; }
            `}</style>

            <div className="hydrogen-industry-container">
                <h1 id="hydrogen-industry-main-title" className="wb-inv">
                    {getText('hydrogen_industry_title', lang)}
                </h1>

                <div ref={exportRef} className="hydrogen-industry-export-region">
                    <ul className="hydrogen-industry-bullets">
                        <li dangerouslySetInnerHTML={{ __html: getText('hydrogen_industry_bullet1', lang) }} />
                        <li>{getText('hydrogen_industry_bullet2', lang)}</li>
                        <li dangerouslySetInnerHTML={{ __html: getText('hydrogen_industry_bullet3', lang) }} />
                        <li dangerouslySetInnerHTML={{ __html: getText('hydrogen_industry_bullet4', lang) }} />
                    </ul>

                    <figure
                        className="hydrogen-industry-infographic-figure"
                        aria-label={getText('hydrogen_industry_infographic_aria', lang)}
                    >
                        <div className="hydrogen-industry-infographic-wrapper">
                            <img
                                src={hydrogenIndustryBg}
                                alt=""
                                className="hydrogen-industry-bg-image"
                                draggable={false}
                            />
                        </div>
                    </figure>
                </div>

                <div className="hydrogen-industry-download-buttons">
                    <button type="button" onClick={downloadInfographicPng} style={downloadBtnStyle}>
                        {getText('hydrogen_industry_download_infographic_png', lang)}
                    </button>
                </div>

                <div className="hydrogen-industry-table-wrapper">
                    <details onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                        <summary role="button" aria-expanded={isTableOpen}>
                            <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                            {getText('hydrogen_industry_table_summary', lang)}
                            <span className="wb-inv">
                                {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                            </span>
                        </summary>
                        <div ref={topScrollRef} className="hydrogen-industry-table-scrollbar" aria-hidden="true"><div /></div>
                        <div
                            ref={tableScrollRef}
                            className="hydrogen-industry-table-responsive table-responsive"
                            role="region"
                            aria-label={getText('hydrogen_industry_table_summary', lang)}
                            tabIndex={0}
                        >
                            <table className="table table-bordered table-striped table-hover">
                                <caption className="wb-inv">{getText('hydrogen_industry_table_caption', lang)}</caption>
                                <thead>
                                    <tr>
                                        {tableHeaders.map((header) => (
                                            <th
                                                key={header}
                                                scope="col"
                                                style={{ fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}
                                            >
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableRows.map((row) => (
                                        <tr key={row.key}>
                                            <td style={{ textAlign: 'center' }}>{row.description}</td>
                                            <td style={{ textAlign: 'center' }}>{row.value}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div ref={bottomScrollRef} className="hydrogen-industry-table-scrollbar" aria-hidden="true"><div /></div>
                        <div className="hydrogen-industry-download-buttons">
                            <button type="button" onClick={downloadCsv} style={downloadBtnStyle}>
                                {getText('hydrogen_industry_download_csv', lang)}
                            </button>
                            <button type="button" onClick={downloadDocx} style={downloadBtnStyle}>
                                {getText('hydrogen_industry_download_docx', lang)}
                            </button>
                        </div>
                    </details>
                </div>
            </div>
        </main>
    );
};

export default HydrogenIndustry;
