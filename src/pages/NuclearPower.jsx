import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';

const CANADA_CAPSULE = '#819476';
const TOP_RANKS = [1, 2, 3, 4, 5];
const DATA_YEAR = 2023;
const WORLD_TOTAL_TWH = 2552;

const TOP5_DATA = [
    { rank: 1, key: 'usa', sharePct: 31 },
    { rank: 2, key: 'china', sharePct: 17 },
    { rank: 3, key: 'france', sharePct: 13 },
    { rank: 4, key: 'russia', sharePct: 8 },
    { rank: 5, key: 'south_korea', sharePct: 7 },
];

const CANADA_DATA = { rank: 6, key: 'canada', sharePct: 3 };

const hydroGenerationCountryLabel = (key, lang) => {
    const text = getText(`nuclear_power_country_${key}`, lang);
    if (text && text !== `nuclear_power_country_${key}`) return text;
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

const formatSharePct = (value, locale) => {
    if (value == null || Number.isNaN(Number(value))) return '—';
    const n = Number(value);
    if (n < 1) {
        return n.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    }
    return String(Math.round(n));
};

const formatTwh = (value, locale) =>
    Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });

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
    const pillW = 64;
    const startY = pad + titleH + pad;

    rows.forEach((row, index) => {
        const y = startY + index * (rowH + rowGap);
        if (row.isEllipsis) {
            ctx.fillStyle = '#333333';
            ctx.font = 'bold 20px "Noto Sans", sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('...', pad, y + rowH / 2 - 10);
            return;
        }

        const maxPct = rows.find((r) => !r.isEllipsis)?.pct || 1;
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
        ctx.fillText(`${row.shareLabel}%`, pillX + pillW / 2, y + rowH / 2);
    });

    canvas.toBlob((blob) => {
        if (blob) saveAs(blob, filename);
    });
};

const NuclearPower = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const bottomScrollRef = useRef(null);
    const infographicRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const rankingRows = useMemo(
        () =>
            TOP5_DATA.map((row) => ({
                ...row,
                name: hydroGenerationCountryLabel(row.key, lang),
                shareLabel: formatSharePct(row.sharePct, locale),
                pct: Number(row.sharePct),
            })),
        [lang, locale],
    );

    const canadaRow = useMemo(
        () => ({
            ...CANADA_DATA,
            name: hydroGenerationCountryLabel(CANADA_DATA.key, lang),
            shareLabel: formatSharePct(CANADA_DATA.sharePct, locale),
            pct: Number(CANADA_DATA.sharePct),
            isCanada: true,
        }),
        [lang, locale],
    );

    const graphicTitle = substitute(getText('nuclear_power_chart_title', lang), {
        totalTwh: formatTwh(WORLD_TOTAL_TWH, locale),
        year: DATA_YEAR,
    });

    const tableHeaders = [
        getText('nuclear_power_table_col_year', lang),
        getText('nuclear_power_table_col_total', lang),
        ...TOP_RANKS.map((rank) => getText(`nuclear_power_table_col_rank${rank}`, lang)),
        getText('nuclear_power_table_col_canada', lang),
        getText('nuclear_power_table_col_canada_rank', lang),
    ];

    const formatTopCountryCell = useCallback(
        (entry) => {
            if (!entry) return '—';
            return `${hydroGenerationCountryLabel(entry.key, lang)} (${formatSharePct(entry.sharePct, locale)}%)`;
        },
        [lang, locale],
    );

    const tableRow = useMemo(
        () => ({
            year: DATA_YEAR,
            totalTwh: formatTwh(WORLD_TOTAL_TWH, locale),
            topCountryCells: TOP_RANKS.map((rank) =>
                formatTopCountryCell(TOP5_DATA.find((item) => item.rank === rank)),
            ),
            canadaPct: formatSharePct(CANADA_DATA.sharePct, locale),
            canadaRank: CANADA_DATA.rank,
        }),
        [formatTopCountryCell, locale],
    );

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
        const row = [
            tableRow.year,
            tableRow.totalTwh,
            ...tableRow.topCountryCells,
            tableRow.canadaPct,
            tableRow.canadaRank,
        ]
            .map(csvEscape)
            .join(',');
        saveAs(
            new Blob([[header, row].join('\n')], { type: 'text/csv;charset=utf-8;' }),
            getText('nuclear_power_csv_slug', lang),
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
        const dataRows = new TableRow({
            children: [
                tableRow.year,
                tableRow.totalTwh,
                ...tableRow.topCountryCells,
                tableRow.canadaPct,
                tableRow.canadaRank,
            ].map(
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
        });

        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: stripHtml(substitute(getText('nuclear_power_table_caption', lang), { year: DATA_YEAR })),
                                bold: true,
                                size: 28,
                            }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [900, 1200, 1100, 1100, 1200, 1000, 1000, 1100, 1100],
                        rows: [headerRow, dataRows],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), getText('nuclear_power_docx_slug', lang));
    };

    const downloadInfographicPng = () => {
        const rows = [
            ...rankingRows.map((row) => ({ ...row, isCanada: false })),
            { isEllipsis: true },
            canadaRow,
        ];
        exportCapsuleInfographicPng({
            title: stripHtml(graphicTitle),
            rows,
            filename: getText('nuclear_power_png_slug', lang),
        });
    };

    const renderCapsuleRow = (row, maxPct) => {
        const isCanada = row.isCanada;
        const rawRatio = maxPct > 0 ? row.pct / maxPct : 1;
        const barWidthPct = 62 + 18 * rawRatio;
        return (
            <div key={`${row.rank}-${row.name}`} className={`nuclear-power-capsule-row ${isCanada ? 'nuclear-power-capsule-row-canada' : ''}`}>
                <div className="nuclear-power-capsule-bar-wrap">
                    <div className="nuclear-power-capsule-bar" style={{ width: `${barWidthPct}%` }}>
                        <span className="nuclear-power-capsule-bar-text">{row.rank} {row.name}</span>
                    </div>
                </div>
                <div className="nuclear-power-capsule-connector" />
                <div className="nuclear-power-capsule-pill">
                    <span className={`nuclear-power-capsule-pill-text${isCanada ? ' nuclear-power-capsule-pill-text-canada' : ''}`}>
                        {row.shareLabel}%
                    </span>
                </div>
            </div>
        );
    };

    const rankingAria = useMemo(() => {
        const parts = rankingRows.map((row) =>
            lang === 'en'
                ? `Rank ${row.rank}, ${row.name}, ${row.shareLabel} percent`
                : `Rang ${row.rank}, ${row.name}, ${row.shareLabel} pour cent`,
        );
        const canadaPart =
            lang === 'en'
                ? `Rank ${canadaRow.rank}, ${canadaRow.name}, ${canadaRow.shareLabel} percent`
                : `Rang ${canadaRow.rank}, ${canadaRow.name}, ${canadaRow.shareLabel} pour cent`;
        return lang === 'en'
            ? `World nuclear generation ranking for ${DATA_YEAR}: ${parts.join('. ')}. ${canadaPart}.`
            : `Classement mondial de la production nucléaire pour ${DATA_YEAR} : ${parts.join('. ')}. ${canadaPart}.`;
    }, [rankingRows, canadaRow, lang]);

    const pctDisplay = lang === 'fr' ? '13\u00a0%' : '13%';

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-86"
            role="main"
            aria-labelledby="nuclear-power-main-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-86.page-content { max-width: none !important; overflow-x: visible !important; }
.page-86 {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.nuclear-power-container { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.nuclear-power-title {
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
.nuclear-power-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.nuclear-power-split {
    display: grid;
    grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
    gap: 0;
    align-items: stretch;
}
.nuclear-power-left {
    background-color: #ebebeb;
    padding: 28px 32px;
    box-sizing: border-box;
}
.nuclear-power-right {
    background-color: #ffffff;
    padding: 28px 32px;
    box-sizing: border-box;
    position: relative;
}
.nuclear-power-left-kicker {
    font-family: 'Lato', sans-serif;
    font-size: clamp(26px, 3vw, 34px);
    font-weight: bold;
    color: #4d7c2f;
    margin: 0 0 18px 0;
    text-transform: none;
}
.nuclear-power-context-title {
    font-family: 'Lato', sans-serif;
    font-size: clamp(22px, 2.6vw, 28px);
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 12px 0;
    text-transform: none;
}
.nuclear-power-bullets {
    font-family: var(--font-body);
    font-size: clamp(17px, 2vw, 20px);
    color: var(--gc-text);
    line-height: 1.55;
    margin: 0;
    padding-left: 1.25rem;
}
.nuclear-power-bullets li { margin-bottom: 0.85rem; }
.nuclear-power-bullet-pct {
    font-family: 'Lato', sans-serif;
    font-size: clamp(42px, 5vw, 56px);
    font-weight: bold;
    line-height: 1;
    color: var(--gc-text);
    vertical-align: baseline;
}
.nuclear-power-bullets .visual-bold { font-weight: bold; }
.nuclear-power-graphic-title {
    font-family: 'Lato', sans-serif;
    font-size: clamp(20px, 2.4vw, 26px);
    font-weight: bold;
    color: #000000;
    margin: 0 0 14px 0;
    text-transform: none;
}
.nuclear-power-capsule-graphic {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    font-family: 'Noto Sans', sans-serif;
}
.nuclear-power-capsule-row {
    display: flex;
    align-items: center;
    min-height: 52px;
    gap: 0;
    min-width: 0;
}
.nuclear-power-capsule-bar-wrap { flex: 0 0 28%; min-width: 0; display: flex; align-items: center; }
.nuclear-power-capsule-bar {
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
.nuclear-power-capsule-bar-text { word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; white-space: normal; line-height: 1.3; }
.nuclear-power-capsule-row-canada .nuclear-power-capsule-bar { background-color: ${CANADA_CAPSULE}; color: #fff; font-weight: bold; }
.nuclear-power-capsule-connector { flex: 1 1 0; min-width: 10px; height: 2px; background-color: #b0b0b0; }
.nuclear-power-capsule-row-canada .nuclear-power-capsule-connector { background-color: ${CANADA_CAPSULE}; }
.nuclear-power-capsule-pill {
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
.nuclear-power-capsule-pill-text { font-size: 15px; }
.nuclear-power-capsule-row-canada .nuclear-power-capsule-pill { border-width: 2px; border-color: ${CANADA_CAPSULE}; }
.nuclear-power-capsule-pill-text-canada { font-size: 22px; font-weight: bold; }
.nuclear-power-capsule-ellipsis { min-height: 28px; padding-left: 4%; color: #333; font-size: 18px; font-weight: bold; }
.nuclear-power-table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    border: 1px solid #dee2e6;
    background: #fff;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.nuclear-power-table-responsive::-webkit-scrollbar { display: none; }
.nuclear-power-table-responsive table { width: max-content !important; min-width: 100%; }
.nuclear-power-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.nuclear-power-chart-section .data-table-wrapper { padding-top: 5px; margin-top: 20px; width: 100%; box-sizing: border-box; }
.page-86 .data-table-wrapper summary {
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
    width: 100%;
    color: #ffffff;
}
.page-86 .data-table-wrapper summary::-webkit-details-marker { display: none; }
.page-86 .data-table-wrapper summary:hover,
.page-86 .data-table-wrapper button:hover { background-color: #404040 !important; }
.nuclear-power-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.nuclear-power-table-scrollbar > div { height: 20px; }
@media (max-width: 880px) {
    .nuclear-power-split { grid-template-columns: 1fr; }
    .nuclear-power-title { font-size: 37px; }
}
@media (max-width: 480px) {
    .nuclear-power-title { font-size: 28px; }
}
            `}</style>

            <div className="nuclear-power-container">
                <header>
                    <h1 id="nuclear-power-main-title" className="nuclear-power-title">{getText('nuclear_power_title', lang)}</h1>
                </header>

                <div className="nuclear-power-split" ref={infographicRef}>
                    <div className="nuclear-power-left">
                        <p className="nuclear-power-left-kicker" aria-hidden="true">{getText('nuclear_power_title', lang)}</p>
                        <ul className="nuclear-power-bullets">
                            <li>
                                <span className="wb-inv">{getText('nuclear_power_bullet_full', lang)}</span>
                                <span aria-hidden="true">
                                    {getText('nuclear_power_bullet_prefix', lang)}
                                    <span className="nuclear-power-bullet-pct">{pctDisplay}</span>
                                    <span className="visual-bold">{getText('nuclear_power_bullet_highlight', lang)}</span>
                                    {getText('nuclear_power_bullet_suffix', lang)}
                                </span>
                            </li>
                        </ul>
                    </div>

                    <div className="nuclear-power-right">
                        <h2 className="nuclear-power-context-title">{getText('nuclear_power_context_title', lang)}</h2>

                        <section className="nuclear-power-chart-section" aria-label={rankingAria}>
                            <h3 className="nuclear-power-graphic-title">{graphicTitle}</h3>
                            <div className="nuclear-power-capsule-graphic" role="img" aria-label={rankingAria}>
                                {rankingRows.map((row) => renderCapsuleRow(row, rankingRows[0]?.pct || 1))}
                                <div className="nuclear-power-capsule-row nuclear-power-capsule-ellipsis" aria-hidden="true"><span>...</span></div>
                                {renderCapsuleRow(canadaRow, rankingRows[0]?.pct || 1)}
                            </div>

                            <div className="nuclear-power-download-buttons">
                                <button type="button" onClick={downloadInfographicPng} style={downloadBtnStyle}>
                                    {getText('nuclear_power_download_infographic_png', lang)}
                                </button>
                            </div>

                            <details className="data-table-wrapper" onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                                <summary role="button" aria-expanded={isTableOpen}>
                                    <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                    {getText('nuclear_power_table_summary', lang)}
                                    <span className="wb-inv">
                                        {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                    </span>
                                </summary>
                                <div ref={topScrollRef} className="nuclear-power-table-scrollbar" aria-hidden="true"><div /></div>
                                <div ref={tableScrollRef} className="nuclear-power-table-responsive table-responsive" role="region" tabIndex={0}>
                                    <table className="table table-bordered table-striped table-hover">
                                        <caption className="wb-inv">
                                            {substitute(getText('nuclear_power_table_caption', lang), { year: DATA_YEAR })}
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
                                            <tr>
                                                <th scope="row" style={{ fontWeight: 'bold', textAlign: 'center' }}>{tableRow.year}</th>
                                                <td style={{ textAlign: 'center' }}>{tableRow.totalTwh}</td>
                                                {tableRow.topCountryCells.map((cell, index) => (
                                                    <td key={`${tableRow.year}-rank-${index + 1}`} style={{ textAlign: 'center' }}>{cell}</td>
                                                ))}
                                                <td style={{ textAlign: 'center' }}>{tableRow.canadaPct}</td>
                                                <td style={{ textAlign: 'center' }}>{tableRow.canadaRank}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div ref={bottomScrollRef} className="nuclear-power-table-scrollbar" aria-hidden="true"><div /></div>
                                <div className="nuclear-power-download-buttons">
                                    <button type="button" onClick={downloadCsv} style={downloadBtnStyle}>{getText('nuclear_power_download_csv', lang)}</button>
                                    <button type="button" onClick={downloadDocx} style={downloadBtnStyle}>{getText('nuclear_power_download_docx', lang)}</button>
                                </div>
                            </details>
                        </section>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default NuclearPower;
