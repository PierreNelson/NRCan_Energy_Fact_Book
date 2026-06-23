import React, { useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import Page57SectorTrendsInfographic from '../components/Page57SectorTrendsInfographic';

const SECTOR_KEYS = [
    'residential',
    'commercial',
    'transportation_passenger',
    'freight',
    'industrial_full',
    'industrial_no_mining',
];

const SECTOR_DATA = {
    residential: { energyUse: 6, energyIntensity: -30 },
    commercial: { energyUse: 21, energyIntensity: -5 },
    transportation_passenger: { energyUse: -14, energyIntensity: -17 },
    freight: { energyUse: 24, energyIntensity: -7 },
    industrial_full: { energyUse: 21, energyIntensity: -3 },
    industrial_no_mining: { energyUse: -15, energyIntensity: -29 },
};

const formatPct = (value, lang) => {
    const sign = value > 0 ? '+' : value < 0 ? '-' : '';
    const abs = Math.abs(value);
    return lang === 'fr' ? `${sign}${abs} %` : `${sign}${abs}%`;
};

const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

const exportPage57InfographicPng = async (figureEl, { scale = 2 }) => {
    if (!figureEl) return null;

    const wrapper = figureEl.querySelector('.page57-infographic-wrapper');
    const titleEl = wrapper?.querySelector('#page57-chart-title');
    if (!wrapper) return null;

    const rootRect = figureEl.getBoundingClientRect();
    const canvasW = Math.ceil(figureEl.clientWidth);
    const canvasH = Math.ceil(figureEl.clientHeight);

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

    const waitForImage = (img) =>
        new Promise((resolve, reject) => {
            if (!img) {
                resolve(null);
                return;
            }
            if (img.complete && img.naturalWidth > 0) {
                resolve(img);
                return;
            }
            img.onload = () => resolve(img);
            img.onerror = reject;
        });

    const drawTitle = () => {
        if (!titleEl) return;
        const box = rel(titleEl);
        const style = window.getComputedStyle(titleEl);
        ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        ctx.fillStyle = style.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(titleEl.textContent?.trim() || '', box.x + box.w / 2, box.y);
    };

    const drawTextNodesIn = (rootEl) => {
        const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
        let textNode = walker.nextNode();
        while (textNode) {
            const content = textNode.textContent ?? '';
            if (content.trim()) {
                const range = document.createRange();
                range.selectNodeContents(textNode);
                const style = window.getComputedStyle(textNode.parentElement);
                Array.from(range.getClientRects()).forEach((rect) => {
                    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
                    ctx.fillStyle = style.color;
                    ctx.textAlign = style.textAlign === 'right' ? 'right' : style.textAlign === 'center' ? 'center' : 'left';
                    ctx.textBaseline = 'top';
                    const x =
                        style.textAlign === 'right'
                            ? rect.right - rootRect.left
                            : style.textAlign === 'center'
                              ? rect.left - rootRect.left + rect.width / 2
                              : rect.left - rootRect.left;
                    ctx.fillText(content.trim(), x, rect.top - rootRect.top);
                });
            }
            textNode = walker.nextNode();
        }
    };

    const bgLoaded = await waitForImage(wrapper.querySelector('.page57-bg-image'));
    if (bgLoaded) {
        const box = rel(bgLoaded);
        ctx.drawImage(bgLoaded, box.x, box.y, box.w, box.h);
    }

    drawTitle();

    wrapper.querySelectorAll('.page57-sector-title, .page57-metric-label, .page57-metric-value').forEach(drawTextNodesIn);

    return canvas;
};

const Page57 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const figureRef = useRef(null);

    const chartTitle = getText('page57_chart_title', lang);
    const ariaLabel = getText('page57_infographic_aria', lang);
    const fileSlugBase = getText('page57_download_title', lang).replace(/\s+/g, '_');

    const tableRows = useMemo(
        () =>
            SECTOR_KEYS.map((key) => ({
                key,
                sector: stripHtml(getText(`page57_sector_${key}`, lang)),
                energyUse: formatPct(SECTOR_DATA[key].energyUse, lang),
                energyIntensity: formatPct(SECTOR_DATA[key].energyIntensity, lang),
            })),
        [lang],
    );

    const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const downloadCsv = () => {
        const headers = [
            getText('page57_csv_col_sector', lang),
            getText('page57_csv_col_energy_use', lang),
            getText('page57_csv_col_energy_intensity', lang),
        ];
        const rows = tableRows.map((row) => [row.sector, row.energyUse, row.energyIntensity]);
        const blob = new Blob(
            [[headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n')],
            { type: 'text/csv;charset=utf-8;' },
        );
        saveAs(blob, `${fileSlugBase}.csv`);
    };

    const downloadDocx = async () => {
        const headers = [
            getText('page57_csv_col_sector', lang),
            getText('page57_csv_col_energy_use', lang),
            getText('page57_csv_col_energy_intensity', lang),
        ];
        const headerRow = new TableRow({
            children: headers.map(
                (header, index) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [new TextRun({ text: header, bold: true, size: 18 })],
                                alignment: index === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
                            }),
                        ],
                        shading: { fill: 'E6E6E6' },
                    }),
            ),
        });

        const dataRows = tableRows.map(
            (row) =>
                new TableRow({
                    children: [row.sector, row.energyUse, row.energyIntensity].map((value, index) =>
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: value, size: 18 })],
                                    alignment: index === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
                                }),
                            ],
                        }),
                    ),
                }),
        );

        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: stripHtml(chartTitle), bold: true, size: 28 })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [4200, 2400, 2400],
                            rows: [headerRow, ...dataRows],
                        }),
                    ],
                },
            ],
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${fileSlugBase}.docx`);
    };

    const downloadPng = async () => {
        const canvas = await exportPage57InfographicPng(figureRef.current, { scale: 2 });
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${fileSlugBase}.png`);
        });
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-57 page57-sector-trends"
            role="main"
            aria-labelledby="page57-chart-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-57.page57-sector-trends {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.page57-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.page57-infographic-section { width: 100%; margin-bottom: 28px; }
.page57-download-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 15px;
}
.page57-download-btn {
    padding: 8px 16px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.page57-download-btn:hover { background-color: #404040 !important; }
            `}</style>

            <div className="page57-inner">
                <div className="page57-infographic-section">
                    <Page57SectorTrendsInfographic
                        figureRef={figureRef}
                        lang={lang}
                        getText={getText}
                        ariaLabel={ariaLabel}
                        title={chartTitle}
                        titleId="page57-chart-title"
                    />

                    <div className="page57-download-buttons">
                        <button type="button" className="page57-download-btn" onClick={downloadPng}>
                            {getText('page57_download_png', lang)}
                        </button>
                        <button type="button" className="page57-download-btn" onClick={downloadCsv}>
                            {getText('page57_download_csv', lang)}
                        </button>
                        <button type="button" className="page57-download-btn" onClick={downloadDocx}>
                            {getText('page57_download_docx', lang)}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Page57;
