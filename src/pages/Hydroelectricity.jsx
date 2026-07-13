import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';
import hydroelectricityBg from '../assets/hydroelectricity_bg.svg';

const YEAR = 2023;
const WORLD_TOTAL_TWH = 4252;
const CANADA_ELECTRICITY_SHARE = 55;
const CANADA_CAPSULE = '#819476';
const DOC_COLUMN_WIDTHS = [1200, 4200, 1800];

const TOP5 = [
    { rank: 1, key: 'china', pct: 29 },
    { rank: 2, key: 'brazil', pct: 10 },
    { rank: 3, key: 'canada', pct: 8, isCanada: true },
    { rank: 4, key: 'united_states', pct: 6 },
    { rank: 5, key: 'russia', pct: 5 },
];

const countryLabel = (key, lang) => {
    const text = getText(`hydroelectricity_country_${key}`, lang);
    if (text && text !== `hydroelectricity_country_${key}`) return text;
    return String(key || '')
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
};

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

const drawRoundedRect = (ctx, x, y, w, h, r) => {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
};

const waitForImage = (img) =>
    new Promise((resolve, reject) => {
        if (img.complete && img.naturalWidth > 0) {
            resolve(img);
            return;
        }
        img.onload = () => resolve(img);
        img.onerror = reject;
    });

const BODY_FONT = '20px "Noto Sans", sans-serif';
const SHARE_FONT = 'bold 48px "Noto Sans", sans-serif';
const BODY_LINE = 30;
const SHARE_LINE = 52;

/** Layout body text with an emphasized share token ({{share}}) into wrapped lines. */
const layoutBodyWithShare = (ctx, template, shareLabel, maxWidth) => {
    const parts = String(template || '').split('{{share}}');
    const tokens = [];
    parts.forEach((part, index) => {
        String(part)
            .split(/(\s+)/)
            .filter((t) => t.length > 0)
            .forEach((t) => tokens.push({ text: t, kind: 'body' }));
        if (index < parts.length - 1) {
            tokens.push({ text: shareLabel, kind: 'share' });
        }
    });

    const lines = [];
    let line = [];
    let lineWidth = 0;

    const pushLine = () => {
        if (line.length) lines.push(line);
        line = [];
        lineWidth = 0;
    };

    tokens.forEach((token) => {
        const isShare = token.kind === 'share';
        ctx.font = isShare ? SHARE_FONT : BODY_FONT;
        const w = ctx.measureText(token.text).width;
        const isSpace = /^\s+$/.test(token.text);

        if (!isSpace && lineWidth > 0 && lineWidth + w > maxWidth) {
            pushLine();
        }

        if (isSpace && line.length === 0) return;

        line.push({ ...token, width: w });
        lineWidth += w;
    });
    pushLine();

    const lineHeights = lines.map((ln) =>
        ln.some((t) => t.kind === 'share') ? SHARE_LINE : BODY_LINE,
    );
    const totalHeight = lineHeights.reduce((sum, h) => sum + h, 0);
    return { lines, lineHeights, totalHeight };
};

const drawBodyWithShare = (ctx, layout, x, y, color = '#333333') => {
    let cy = y;
    layout.lines.forEach((ln, i) => {
        const lineH = layout.lineHeights[i];
        let cx = x;
        const baseline = cy + lineH * 0.78;
        ln.forEach((token) => {
            ctx.font = token.kind === 'share' ? SHARE_FONT : BODY_FONT;
            ctx.fillStyle = color;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(token.text, cx, baseline);
            cx += token.width;
        });
        cy += lineH;
    });
};

const exportLeftInfographicPng = async (imgEl, { title, bodyTemplate, shareLabel, filename, scale = 2 }) => {
    if (!imgEl) return;
    const loaded = await waitForImage(imgEl);
    const pad = 36;
    const titleH = 48;
    const gap = 20;
    const contentW = 560;
    const imgDisplayW = contentW;
    const imgDisplayH = Math.round((loaded.naturalHeight / loaded.naturalWidth) * imgDisplayW);
    const W = contentW + pad * 2;

    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    const bodyLayout = layoutBodyWithShare(measureCtx, bodyTemplate, shareLabel, contentW);
    const H = pad + titleH + gap + imgDisplayH + gap + bodyLayout.totalHeight + pad;

    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ebebeb';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#333333';
    ctx.font = 'bold 28px Lato, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, pad, pad, contentW);

    ctx.drawImage(loaded, pad, pad + titleH + gap, imgDisplayW, imgDisplayH);

    drawBodyWithShare(ctx, bodyLayout, pad, pad + titleH + gap + imgDisplayH + gap);

    canvas.toBlob((blob) => {
        if (blob) saveAs(blob, filename);
    });
};

const exportCapsuleInfographicPng = ({ title, rows, filename }) => {
    const scale = 2;
    const W = 1000;
    const pad = 32;
    const titleH = 64;
    const rowH = 44;
    const rowGap = 10;
    const H = pad + titleH + pad + rows.length * (rowH + rowGap) + pad;

    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 26px Lato, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, pad, pad, W - pad * 2);

    const barWrapW = W * 0.28;
    const pillW = 72;
    const startY = pad + titleH + pad;

    rows.forEach((row, index) => {
        const y = startY + index * (rowH + rowGap);
        const maxPct = rows[0]?.pct || 1;
        const ratio = maxPct > 0 ? row.pct / maxPct : 1;
        const barW = Math.max(82, barWrapW * (0.62 + 0.18 * ratio));
        const isCanada = row.isCanada;
        const barColor = isCanada ? CANADA_CAPSULE : '#d1d1d1';
        const textColor = isCanada ? '#ffffff' : '#333333';
        const connectorColor = isCanada ? CANADA_CAPSULE : '#b0b0b0';
        const pillBorder = isCanada ? CANADA_CAPSULE : '#b0b0b0';

        ctx.fillStyle = barColor;
        drawRoundedRect(ctx, pad, y + (rowH - 44) / 2, barW, 44, 22);
        ctx.fill();

        ctx.fillStyle = textColor;
        ctx.font = `${isCanada ? 'bold ' : ''}15px "Noto Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${row.rank} ${row.name}`, pad + barW / 2, y + rowH / 2);

        const connX = pad + barW;
        const connW = W - pad - barW - pillW - pad;
        ctx.strokeStyle = connectorColor;
        ctx.lineWidth = isCanada ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(connX, y + rowH / 2);
        ctx.lineTo(connX + connW, y + rowH / 2);
        ctx.stroke();

        const pillX = W - pad - pillW;
        const pillY = y + (rowH - 36) / 2;
        ctx.fillStyle = '#ffffff';
        drawRoundedRect(ctx, pillX, pillY, pillW, 36, 18);
        ctx.fill();
        ctx.strokeStyle = pillBorder;
        ctx.lineWidth = isCanada ? 2 : 1;
        drawRoundedRect(ctx, pillX, pillY, pillW, 36, 18);
        ctx.stroke();

        ctx.fillStyle = '#333333';
        ctx.font = `${isCanada ? 'bold 16px' : '15px'} "Noto Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(row.shareLabel, pillX + pillW / 2, y + rowH / 2);
    });

    canvas.toBlob((blob) => {
        if (blob) saveAs(blob, filename);
    });
};

const Hydroelectricity = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

    const leftImgRef = useRef(null);
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const formatSharePct = useCallback((value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        const formatted = Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
        return lang === 'en' ? `${formatted}%` : `${formatted} %`;
    }, [lang, locale]);

    const formatTwh = (value) =>
        Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });

    const rankingRows = useMemo(
        () =>
            TOP5.map((row) => ({
                ...row,
                name: countryLabel(row.key, lang),
                shareLabel: formatSharePct(row.pct),
            })),
        [lang, formatSharePct],
    );

    const graphicTitle = substitute(getText('hydroelectricity_chart_title', lang), {
        twh: formatTwh(WORLD_TOTAL_TWH),
        year: YEAR,
    });

    const downloadSlug = getText('hydroelectricity_download_title', lang).replace(/\s+/g, '_');
    const leftDownloadSlug = getText('hydroelectricity_left_download_title', lang).replace(/\s+/g, '_');

    const tableHeaders = [
        getText('hydroelectricity_table_col_rank', lang),
        getText('hydroelectricity_table_col_country', lang),
        getText('hydroelectricity_table_col_share', lang),
    ];

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

        const handleTopScroll = () => syncFrom(topScroll);
        const handleTableScroll = () => syncFrom(tableScroll);
        const handleBottomScroll = () => syncFrom(bottomScroll);

        topScroll.addEventListener('scroll', handleTopScroll);
        tableScroll.addEventListener('scroll', handleTableScroll);
        bottomScroll.addEventListener('scroll', handleBottomScroll);
        const observer = new ResizeObserver(() => window.requestAnimationFrame(syncTableScroll));
        const tableElement = tableScroll.querySelector('table');
        if (tableElement) observer.observe(tableElement);
        observer.observe(tableScroll);
        syncTableScroll();

        return () => {
            topScroll.removeEventListener('scroll', handleTopScroll);
            tableScroll.removeEventListener('scroll', handleTableScroll);
            bottomScroll.removeEventListener('scroll', handleBottomScroll);
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
        const rows = rankingRows.map((row) =>
            [row.rank, csvEscape(row.name), csvEscape(formatSharePct(row.pct))].join(','),
        );
        saveAs(
            new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' }),
            `${downloadSlug}.csv`,
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
        const dataRows = rankingRows.map(
            (row) =>
                new TableRow({
                    children: [String(row.rank), row.name, formatSharePct(row.pct)].map(
                        (value, index) =>
                            new TableCell({
                                children: [
                                    new Paragraph({
                                        children: [new TextRun({ text: String(value ?? ''), size: 22 })],
                                        alignment: index === 1 ? AlignmentType.LEFT : AlignmentType.CENTER,
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
                                text: stripHtml(getText('hydroelectricity_table_caption', lang)),
                                bold: true,
                                size: 28,
                            }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: DOC_COLUMN_WIDTHS,
                        rows: [headerRow, ...dataRows],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), `${downloadSlug}.docx`);
    };

    const downloadLeftInfographicPng = () => {
        exportLeftInfographicPng(leftImgRef.current, {
            title: getText('hydroelectricity_title', lang),
            bodyTemplate: getText('hydroelectricity_body', lang),
            shareLabel: formatSharePct(CANADA_ELECTRICITY_SHARE),
            filename: `${leftDownloadSlug}.png`,
        });
    };

    const downloadInfographicPng = () => {
        exportCapsuleInfographicPng({
            title: stripHtml(graphicTitle),
            rows: rankingRows,
            filename: `${downloadSlug}.png`,
        });
    };

    const renderCapsuleRow = (row, maxPct) => {
        const isCanada = row.isCanada;
        const rawRatio = maxPct > 0 ? row.pct / maxPct : 1;
        const barWidthPct = 62 + 18 * rawRatio;
        return (
            <div
                key={`${row.rank}-${row.name}`}
                className={`hydroelectricity-capsule-row${isCanada ? ' hydroelectricity-capsule-row-canada' : ''}`}
            >
                <div className="hydroelectricity-capsule-bar-wrap">
                    <div className="hydroelectricity-capsule-bar" style={{ width: `${barWidthPct}%` }}>
                        <span className="hydroelectricity-capsule-bar-text">{row.rank} {row.name}</span>
                    </div>
                </div>
                <div className="hydroelectricity-capsule-connector" />
                <div className="hydroelectricity-capsule-pill">
                    <span className={`hydroelectricity-capsule-pill-text${isCanada ? ' hydroelectricity-capsule-pill-text-canada' : ''}`}>
                        {row.shareLabel}
                    </span>
                </div>
            </div>
        );
    };

    const rankingAria = useMemo(() => {
        const parts = rankingRows.map((row) =>
            lang === 'en'
                ? `Rank ${row.rank}, ${row.name}, ${row.shareLabel}`
                : `Rang ${row.rank}, ${row.name}, ${row.shareLabel}`,
        );
        return lang === 'en'
            ? `World generation of hydroelectricity ranking for ${YEAR}: ${parts.join('. ')}.`
            : `Classement de la production mondiale d'hydroélectricité pour ${YEAR} : ${parts.join('. ')}.`;
    }, [rankingRows, lang]);

    const bodyHtml = substitute(getText('hydroelectricity_body', lang), {
        share: `<strong class="hydroelectricity-share-emphasis">${formatSharePct(CANADA_ELECTRICITY_SHARE)}</strong>`,
    });

    return (
        <main
            tabIndex="-1"
            className="page-content hydroelectricity"
            role="main"
            aria-labelledby="hydroelectricity-main-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.hydroelectricity.page-content { max-width: none !important; overflow-x: visible !important; }
.hydroelectricity {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.hydroelectricity-container { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.hydroelectricity-title {
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
.hydroelectricity-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.hydroelectricity-split {
    display: grid;
    grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
    gap: 0;
    align-items: stretch;
}
.hydroelectricity-left {
    background-color: #ebebeb;
    padding: 28px 32px;
    box-sizing: border-box;
}
.hydroelectricity-right {
    background-color: #ffffff;
    padding: 28px 32px;
    box-sizing: border-box;
    position: relative;
}
.hydroelectricity-left-image {
    display: block;
    width: 100%;
    height: auto;
    margin: 0 0 18px 0;
}
.hydroelectricity-left .hydroelectricity-download-buttons {
    margin-top: 18px;
    margin-bottom: 0;
}
.hydroelectricity-body {
    font-family: var(--font-body);
    font-size: clamp(17px, 2vw, 20px);
    color: var(--gc-text);
    line-height: 1.55;
    margin: 0;
}
.hydroelectricity-body .hydroelectricity-share-emphasis {
    font-size: 2.4em;
    font-weight: bold;
    line-height: 1.05;
}
.hydroelectricity-context-title {
    font-family: 'Lato', sans-serif;
    font-size: clamp(22px, 2.6vw, 28px);
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 12px 0;
    text-transform: none;
}
.hydroelectricity-graphic-title {
    font-family: 'Lato', sans-serif;
    font-size: clamp(20px, 2.4vw, 26px);
    font-weight: bold;
    color: #000000;
    margin: 0 0 14px 0;
    text-transform: none;
}
.hydroelectricity-capsule-graphic {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    font-family: 'Noto Sans', sans-serif;
}
.hydroelectricity-capsule-row {
    display: flex;
    align-items: center;
    min-height: 52px;
    gap: 0;
    min-width: 0;
}
.hydroelectricity-capsule-bar-wrap { flex: 0 0 28%; min-width: 0; display: flex; align-items: center; }
.hydroelectricity-capsule-bar {
    min-height: 44px;
    min-width: 82px;
    border-radius: 999px;
    background-color: #d1d1d1;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 10px 12px;
    font-size: clamp(13px, 1.5vw, 15px);
    color: #333333;
    box-sizing: border-box;
}
.hydroelectricity-capsule-bar-text { word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; white-space: normal; line-height: 1.3; }
.hydroelectricity-capsule-row-canada .hydroelectricity-capsule-bar { background-color: ${CANADA_CAPSULE}; color: #fff; font-weight: bold; }
.hydroelectricity-capsule-connector { flex: 1 1 0; min-width: 10px; height: 2px; background-color: #b0b0b0; }
.hydroelectricity-capsule-row-canada .hydroelectricity-capsule-connector { background-color: ${CANADA_CAPSULE}; }
.hydroelectricity-capsule-pill {
    flex: 0 0 auto;
    min-width: 64px;
    min-height: 36px;
    border-radius: 999px;
    border: 1px solid #b0b0b0;
    background-color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 12px;
    box-sizing: border-box;
}
.hydroelectricity-capsule-pill-text { font-size: 15px; }
.hydroelectricity-capsule-row-canada .hydroelectricity-capsule-pill { border-width: 2px; border-color: ${CANADA_CAPSULE}; }
.hydroelectricity-capsule-pill-text-canada { font-size: 22px; font-weight: bold; }
.hydroelectricity-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #dee2e6;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.hydroelectricity-table-responsive::-webkit-scrollbar { display: none; }
.hydroelectricity-table-responsive table { width: max-content !important; min-width: 100%; }
.hydroelectricity-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.hydroelectricity-chart-section .data-table-wrapper { padding-top: 5px; margin-top: 20px; width: 100%; box-sizing: border-box; }
.hydroelectricity .data-table-wrapper summary {
    display: block;
    width: 100%;
    padding: 12px 15px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
    list-style: none;
    box-sizing: border-box;
}
.hydroelectricity .data-table-wrapper summary::-webkit-details-marker { display: none; }
.hydroelectricity .data-table-wrapper summary:hover,
.hydroelectricity .data-table-wrapper button:hover { background-color: #404040 !important; }
.hydroelectricity-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.hydroelectricity-table-scrollbar > div { height: 20px; }
@media (max-width: 880px) {
    .hydroelectricity-split { grid-template-columns: 1fr; }
    .hydroelectricity-title { font-size: 37px; }
}
            `}</style>

            <div className="hydroelectricity-container">
                <header>
                    <h1 id="hydroelectricity-main-title" className="hydroelectricity-title">
                        {getText('hydroelectricity_title', lang)}
                    </h1>
                </header>

                <div className="hydroelectricity-split">
                    <div className="hydroelectricity-left">
                        <img
                            ref={leftImgRef}
                            src={hydroelectricityBg}
                            alt=""
                            className="hydroelectricity-left-image"
                            draggable={false}
                        />
                        <p
                            className="hydroelectricity-body"
                            dangerouslySetInnerHTML={{ __html: bodyHtml }}
                        />
                        <div className="hydroelectricity-download-buttons">
                            <button type="button" onClick={downloadLeftInfographicPng} style={downloadBtnStyle}>
                                {getText('hydroelectricity_download_infographic_png', lang)}
                            </button>
                        </div>
                    </div>

                    <div className="hydroelectricity-right">
                        <h2 className="hydroelectricity-context-title">
                            {getText('hydroelectricity_context_title', lang)}
                        </h2>

                        <section className="hydroelectricity-chart-section" aria-label={rankingAria}>
                            <h3 className="hydroelectricity-graphic-title">{graphicTitle}</h3>
                            <div className="hydroelectricity-capsule-graphic" role="img" aria-label={rankingAria}>
                                {rankingRows.map((row) => renderCapsuleRow(row, rankingRows[0]?.pct || 1))}
                            </div>

                            <div className="hydroelectricity-download-buttons">
                                <button type="button" onClick={downloadInfographicPng} style={downloadBtnStyle}>
                                    {getText('hydroelectricity_download_infographic_png', lang)}
                                </button>
                            </div>

                            <details className="data-table-wrapper" onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                                <summary role="button" aria-expanded={isTableOpen}>
                                    <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                    {getText('hydroelectricity_table_summary', lang)}
                                    <span className="wb-inv">
                                        {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                    </span>
                                </summary>
                                <div ref={topScrollRef} className="hydroelectricity-table-scrollbar" aria-hidden="true"><div /></div>
                                <div ref={tableScrollRef} className="hydroelectricity-table-responsive table-responsive" role="region" tabIndex={0}>
                                    <table className="table table-bordered table-striped table-hover">
                                        <caption className="wb-inv">
                                            {getText('hydroelectricity_table_caption', lang)}
                                        </caption>
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
                                            {rankingRows.map((row) => (
                                                <tr key={row.key}>
                                                    <th scope="row" style={{ fontWeight: 'bold', textAlign: 'center' }}>{row.rank}</th>
                                                    <td style={{ textAlign: 'left' }}>{row.name}</td>
                                                    <td style={{ textAlign: 'center' }}>{formatSharePct(row.pct)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div ref={bottomScrollRef} className="hydroelectricity-table-scrollbar" aria-hidden="true"><div /></div>
                                <div className="hydroelectricity-download-buttons">
                                    <button type="button" onClick={downloadCsv} style={downloadBtnStyle}>
                                        {getText('hydroelectricity_download_csv', lang)}
                                    </button>
                                    <button type="button" onClick={downloadDocx} style={downloadBtnStyle}>
                                        {getText('hydroelectricity_download_docx', lang)}
                                    </button>
                                </div>
                            </details>
                        </section>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Hydroelectricity;
