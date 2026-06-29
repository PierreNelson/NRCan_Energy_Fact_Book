import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import Page70WindSolarInfographic from '../components/Page70WindSolarInfographic';
import { exportPage70InfographicPng } from '../components/Page70WindSolarInfographic.constants';
import { getPage70Data } from '../utils/dataLoader';
import { getText } from '../utils/translations';

const CANADA_CAPSULE = '#819476';
const RANKING_COUNTRY_KEYS = ['canada', 'usa', 'russia', 'china', 'india'];

const page70CountryLabel = (key, lang) => getText(`page70_country_${key}`, lang);
const page70TableColLabel = (key, lang) => getText(`page70_table_col_${key}`, lang);

const formatRankingPct = (value) => (value === '' ? '\u2014' : `${value}%`);

const stripHtml = (text) => (text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

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
    const maxPct = rows[0]?.pct || 1;

    rows.forEach((row, index) => {
        const y = startY + index * (rowH + rowGap);
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
        ctx.fillText(`${row.pctRounded}%`, pillX + pillW / 2, y + rowH / 2);
    });

    canvas.toBlob((blob) => {
        if (blob) saveAs(blob, filename);
    });
};

const Page70 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [year, setYear] = useState(null);
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

    const infographicRef = useRef(null);
    const yearDropdownRef = useRef(null);
    const yearButtonRef = useRef(null);
    const tableTopRef = useRef(null);
    const tableScrollRef = useRef(null);
    const tableBottomRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    useEffect(() => {
        getPage70Data()
            .then((data) => {
                setResult(data);
                setYear(data.defaultRankingYear ?? data.rankingYears?.[0] ?? null);
            })
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const onResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target)) {
                setIsYearDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const syncTableScroll = useCallback(() => {
        const topScroll = tableTopRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = tableBottomRef.current;
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
        const topScroll = tableTopRef.current;
        const tableScroll = tableScrollRef.current;
        const bottomScroll = tableBottomRef.current;
        if (!topScroll || !tableScroll || !bottomScroll || !isTableOpen) return;

        const syncFrom = (source) => {
            if (source !== topScroll && topScroll.scrollLeft !== source.scrollLeft) topScroll.scrollLeft = source.scrollLeft;
            if (source !== tableScroll && tableScroll.scrollLeft !== source.scrollLeft) tableScroll.scrollLeft = source.scrollLeft;
            if (source !== bottomScroll && bottomScroll.scrollLeft !== source.scrollLeft) bottomScroll.scrollLeft = source.scrollLeft;
        };

        const handleTopScroll = () => syncFrom(topScroll);
        const handleTableScroll = () => syncFrom(tableScroll);
        const handleBottomScroll = () => syncFrom(bottomScroll);
        const sync = () => window.requestAnimationFrame(syncTableScroll);

        topScroll.addEventListener('scroll', handleTopScroll);
        tableScroll.addEventListener('scroll', handleTableScroll);
        bottomScroll.addEventListener('scroll', handleBottomScroll);
        const observer = new ResizeObserver(sync);
        const tableElement = tableScroll.querySelector('table');
        if (tableElement) observer.observe(tableElement);
        observer.observe(tableScroll);
        sync();

        return () => {
            topScroll.removeEventListener('scroll', handleTopScroll);
            tableScroll.removeEventListener('scroll', handleTableScroll);
            bottomScroll.removeEventListener('scroll', handleBottomScroll);
            observer.disconnect();
        };
    }, [isTableOpen, windowWidth, syncTableScroll, result]);

    const scrollToFootnote = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-page70')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const scrollToRef = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-rf-page70')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const rankingYears = result?.rankingYears ?? [];
    const rankingYearsDesc = useMemo(
        () => [...rankingYears].sort((a, b) => b - a),
        [rankingYears],
    );

    const rankingHistoryRows = useMemo(
        () => result?.rankingHistoryRows ?? [],
        [result],
    );

    const rankingYearsAsc = useMemo(
        () => [...rankingYears].sort((a, b) => a - b),
        [rankingYears],
    );

    const textVars = useMemo(() => ({
        startYear: result?.startYear ?? '',
        endYear: result?.endYear ?? '',
        rankingYear: year ?? '',
        pctChange: result?.pctChange ?? '',
        nonGhgShare: result?.nonGhgPct ?? '',
        hydroShare: result?.hydroPct ?? '',
        nuclearShare: result?.nuclearPct ?? '',
        otherRenewablesShare: result?.otherRenewablesPct ?? '',
    }), [result, year]);

    const rankingRows = useMemo(() => {
        const source = year != null ? result?.rankingsByYear?.[year] ?? [] : [];
        return source.map((row) => ({
            ...row,
            name: page70CountryLabel(row.key, lang),
            pctRounded: Math.round(row.pct),
            isCanada: row.key === 'canada',
        }));
    }, [result, year, lang]);

    const rankingTitle = substitute(getText('page70_ranking_title', lang), textVars);
    const infographicTitle = substitute(getText('page70_infographic_title', lang), textVars);
    const tableCaption = getText('page70_table_caption', lang);

    const tableHeaders = useMemo(
        () => [
            getText('page70_table_col_year', lang),
            ...RANKING_COUNTRY_KEYS.map((k) => page70TableColLabel(k, lang)),
        ],
        [lang],
    );

    const yearSpanFile = rankingYearsAsc.length > 1
        ? `${rankingYearsAsc[0]}-${rankingYearsAsc[rankingYearsAsc.length - 1]}`
        : String(rankingYearsAsc[0] ?? year ?? '');

    const downloadFilename = (slugKey, yearSuffix = yearSpanFile) => {
        const slug = getText(slugKey, lang);
        const match = slug.match(/^(.+)\.(csv|docx|png)$/);
        if (!match) return slug;
        return `${match[1]} ${yearSuffix}.${match[2]}`;
    };

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

    const downloadRankingPng = () => {
        exportCapsuleInfographicPng({
            title: stripHtml(rankingTitle),
            rows: rankingRows.map((row) => ({ ...row, pct: row.pctRounded })),
            filename: downloadFilename('page70_ranking_png_slug', year),
        });
    };

    const downloadTableCsv = () => {
        const rows = rankingHistoryRows.map((row) => [
            row.year,
            ...row.pcts.map((p) => (p === '' ? '' : String(p))),
        ]);
        saveAs(
            new Blob([[tableHeaders.join(','), ...rows.map((r) => r.join(','))].join('\n')], { type: 'text/csv;charset=utf-8;' }),
            downloadFilename('page70_table_csv_slug'),
        );
    };

    const downloadTableDocx = async () => {
        const headerRow = new TableRow({
            children: tableHeaders.map(
                (header) =>
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 22 })], alignment: AlignmentType.CENTER })],
                        shading: { fill: 'E6E6E6' },
                    }),
            ),
        });
        const dataRows = rankingHistoryRows.map(
            (row) =>
                new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(row.year), size: 22 })], alignment: AlignmentType.CENTER })] }),
                        ...row.pcts.map(
                            (p) =>
                                new TableCell({
                                    children: [new Paragraph({ children: [new TextRun({ text: p === '' ? '\u2014' : `${p}%`, size: 22 })], alignment: AlignmentType.CENTER })],
                                }),
                        ),
                    ],
                }),
        );
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: stripHtml(tableCaption), bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 },
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [1200, ...RANKING_COUNTRY_KEYS.map(() => 1200)],
                        rows: [headerRow, ...dataRows],
                    }),
                ],
            }],
        });
        saveAs(await Packer.toBlob(doc), downloadFilename('page70_table_docx_slug'));
    };

    const downloadInfographicPng = async () => {
        const canvas = await exportPage70InfographicPng(infographicRef.current, {
            title: stripHtml(infographicTitle),
            scale: 2,
        });
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, downloadFilename('page70_infographic_png_slug', `${result?.startYear ?? ''}-${result?.endYear ?? ''}`));
        });
    };

    const renderCapsuleRow = (row, maxPct) => {
        const rawRatio = maxPct > 0 ? row.pct / maxPct : 1;
        const barWidthPct = 62 + 18 * rawRatio;
        return (
            <div key={`${row.rank}-${row.key}`} className={`page70-capsule-row ${row.isCanada ? 'page70-capsule-row-canada' : ''}`}>
                <div className="page70-capsule-bar-wrap">
                    <div className="page70-capsule-bar" style={{ width: `${barWidthPct}%` }}>
                        <span className="page70-capsule-bar-text">{row.rank} {row.name}</span>
                    </div>
                </div>
                <div className="page70-capsule-connector" />
                <div className="page70-capsule-pill">
                    <span className="page70-capsule-pill-text">{row.pctRounded}%</span>
                </div>
            </div>
        );
    };

    if (loading) {
        return <p className="page70-loading">{lang === 'en' ? 'Loading data…' : 'Chargement des données…'}</p>;
    }
    if (error) {
        return <p className="page70-error" role="alert">{error}</p>;
    }
    if (!result || year == null) {
        return <p className="page70-error">{lang === 'en' ? 'No data available.' : 'Aucune donnée disponible.'}</p>;
    }

    const maxPct = rankingRows[0]?.pct || 1;

    const windOverlay = {
        label: getText('page70_wind_label', lang),
        endValue: Number(result.windEnd).toLocaleString(locale, { maximumFractionDigits: 0 }),
        endYear: result.endYear,
        startValue: Number(result.windStart).toLocaleString(locale, { maximumFractionDigits: 0 }),
        startYear: result.startYear,
    };

    const solarOverlay = {
        label: getText('page70_solar_label', lang),
        endValue: Number(result.solarEnd).toLocaleString(locale, { maximumFractionDigits: 0 }),
        endYear: result.endYear,
        startValue: Number(result.solarStart).toLocaleString(locale, { maximumFractionDigits: 0 }),
        startYear: result.startYear,
    };

    const rankingAria = lang === 'en'
        ? `Non-emitting electricity ranking for ${year}: ${rankingRows.map((r) => `Rank ${r.rank}, ${r.name}, ${r.pctRounded} percent`).join('. ')}.`
        : `Classement de l'électricité non émettrice pour ${year} : ${rankingRows.map((r) => `Rang ${r.rank}, ${r.name}, ${r.pctRounded} pour cent`).join('. ')}.`;

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-70"
            role="main"
            aria-labelledby="page70-content"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
.page-70.page-content { max-width: none !important; overflow-x: visible !important; }
.page-70 {
    margin-left: -${layoutPadding?.left || 55}px;
    margin-right: -${layoutPadding?.right || 15}px;
    width: calc(100% + ${(layoutPadding?.left || 55) + (layoutPadding?.right || 15)}px);
    padding-left: ${layoutPadding?.left || 55}px;
    padding-right: ${layoutPadding?.right || 15}px;
}
.page70-container { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.page70-year-dropdown { position: relative; margin-bottom: 20px; width: 200px; }
.page70-bullets {
    font-family: 'Noto Sans', sans-serif;
    font-size: 1.05rem;
    line-height: 1.55;
    color: var(--gc-text);
    margin: 0 0 24px 0;
    padding-left: 1.25rem;
}
.page70-bullets li { margin-bottom: 0.85rem; }
.page70-bullets strong { font-weight: 700; }
.page70-bullets .fn-lnk { color: #26374a; text-decoration: underline; }
.page70-split-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 24px;
    align-items: start;
    width: 100%;
}
.page70-ranking-col { min-width: 0; }
.page70-infographic-col { min-width: 0; }
.page70-graphic-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: #000000;
    margin: 0 0 10px 0;
    text-align: left;
    width: 100%;
    text-transform: none;
}
.page70-capsule-graphic {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    font-family: 'Noto Sans', sans-serif;
}
.page70-capsule-row { display: flex; align-items: center; min-height: 52px; gap: 0; min-width: 0; }
.page70-capsule-bar-wrap { flex: 0 0 28%; min-width: 0; display: flex; align-items: center; }
.page70-capsule-bar {
    min-height: 44px; min-width: 82px; border-radius: 999px; background-color: #d1d1d1;
    display: flex; align-items: center; justify-content: center; text-align: center;
    padding: 10px 12px; font-size: clamp(13px, 1.5vw, 15px); color: #333; box-sizing: border-box;
    width: 100%; max-width: 100%;
}
.page70-capsule-bar-text { word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; white-space: normal; line-height: 1.3; }
.page70-capsule-row-canada .page70-capsule-bar { background-color: ${CANADA_CAPSULE}; color: #fff; font-weight: bold; }
.page70-capsule-connector { flex: 1 1 0; min-width: 10px; height: 2px; background-color: #b0b0b0; }
.page70-capsule-row-canada .page70-capsule-connector { background-color: ${CANADA_CAPSULE}; }
.page70-capsule-pill {
    flex: 0 0 64px; height: 36px; min-width: 64px; border-radius: 999px; border: 1px solid #b0b0b0;
    background-color: #fff; display: flex; align-items: center; justify-content: center;
    font-size: 15px; color: #333; box-sizing: border-box;
}
.page70-capsule-row-canada .page70-capsule-pill { border-width: 2px; border-color: ${CANADA_CAPSULE}; font-weight: bold; font-size: 16px; }
.page70-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.page70-infographic-figure { margin: 0; width: 100%; }
.page70-infographic-wrapper {
    position: relative;
    width: 100%;
    container-type: inline-size;
    overflow: visible;
}
.page70-bg-image { display: block; max-width: 100%; pointer-events: none; user-select: none; }
.page70-overlay {
    position: absolute;
    font-family: 'Noto Sans', sans-serif;
    color: #333333;
    line-height: 1.15;
    pointer-events: none;
    white-space: nowrap;
}
.page70-overlay.page70-label { font-weight: 400; }
.page70-overlay.page70-value { font-weight: 700; }
.page70-overlay.page70-year { font-weight: 400; }
.page70-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.page70-table-wrapper details > summary {
    cursor: pointer; font-family: Arial, sans-serif; font-weight: bold; padding: 10px;
    background-color: #8C8C8C; border: 1px solid #404040; border-radius: 4px;
    list-style: none; box-sizing: border-box; width: 100%; color: #ffffff;
}
.page70-table-wrapper details > summary::-webkit-details-marker { display: none; }
.page70-table-wrapper summary:hover, .page70-download-buttons button:hover { background-color: #404040 !important; }
.page70-table-scrollbar { width: 100%; overflow-x: auto; overflow-y: hidden; margin: 0; }
.page70-table-scrollbar > div { height: 20px; }
.page70-table-responsive {
    width: 100%; overflow-x: auto; overflow-y: hidden; -ms-overflow-style: none; scrollbar-width: none;
}
.page70-table-responsive::-webkit-scrollbar { display: none; }
.page70-table-responsive table { width: max-content !important; min-width: 100%; }
.page70-footnotes {
    margin-top: 28px; font-family: 'Noto Sans', sans-serif; font-size: 0.95rem; color: var(--gc-text);
    border-top: 1px solid #ddd; padding-top: 16px;
}
.page70-footnotes h2 {
    font-size: 1.25rem; font-weight: bold; margin: 0 0 0.75rem 0;
}
.page70-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
.page70-loading, .page70-error { padding: 20px; font-family: 'Noto Sans', sans-serif; }
@media (max-width: 900px) {
    .page70-split-row { grid-template-columns: 1fr; }
    .page70-graphic-title { font-size: 26px; }
}
            `}</style>

            <div className="page70-container" id="page70-content">
                {rankingYearsDesc.length > 0 && (
                    <div ref={yearDropdownRef} className="page70-year-dropdown">
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>
                            {getText('year_slider_label', lang)}
                        </label>
                        <button
                            ref={yearButtonRef}
                            type="button"
                            onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                            aria-expanded={isYearDropdownOpen}
                            style={{
                                width: '100%',
                                padding: '10px 15px',
                                backgroundColor: '#fff',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                textAlign: 'left',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '16px',
                            }}
                        >
                            <span>{year}</span>
                            <span aria-hidden="true" style={{ fontSize: '12px' }}>
                                {isYearDropdownOpen ? '▲' : '▼'}
                            </span>
                        </button>
                        {isYearDropdownOpen && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    width: '100%',
                                    maxHeight: '300px',
                                    overflowY: 'auto',
                                    backgroundColor: '#fff',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    zIndex: 100,
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                                }}
                            >
                                {rankingYearsDesc.map((y) => {
                                    const isSelected = year === y;
                                    return (
                                        <button
                                            key={y}
                                            type="button"
                                            aria-pressed={isSelected}
                                            aria-label={String(y)}
                                            onClick={() => {
                                                setYear(y);
                                                setIsYearDropdownOpen(false);
                                                setTimeout(() => yearButtonRef.current?.focus(), 0);
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                width: '100%',
                                                textAlign: 'left',
                                                padding: '10px 15px',
                                                cursor: 'pointer',
                                                border: 'none',
                                                borderBottom: '1px solid #eee',
                                                backgroundColor: isSelected ? '#f0f9ff' : '#fff',
                                                fontFamily: 'Arial, sans-serif',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#f5f5f5';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = isSelected ? '#f0f9ff' : '#fff';
                                            }}
                                        >
                                            <span
                                                aria-hidden="true"
                                                style={{
                                                    height: '18px',
                                                    width: '18px',
                                                    borderRadius: '50%',
                                                    border: '1px solid #ccc',
                                                    marginRight: '10px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    backgroundColor: '#fff',
                                                }}
                                            >
                                                {isSelected && (
                                                    <span
                                                        style={{
                                                            height: '10px',
                                                            width: '10px',
                                                            borderRadius: '50%',
                                                            backgroundColor: '#000',
                                                        }}
                                                    />
                                                )}
                                            </span>
                                            <span aria-hidden="true" style={{ fontSize: '16px', color: '#333' }}>
                                                {y}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <div role="status" className="wb-inv" aria-live="polite">
                            {year
                                ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${year}`
                                : ''}
                        </div>
                    </div>
                )}

                <ul className="page70-bullets">
                    <li dangerouslySetInnerHTML={{ __html: substitute(getText('page70_bullet1', lang), textVars) }} />
                    <li>
                        <span dangerouslySetInnerHTML={{ __html: substitute(getText('page70_bullet2', lang), textVars) }} />
                        <span id="fn-asterisk-rf-page70" style={{ verticalAlign: 'super', fontSize: '0.75em' }}>
                            <a className="fn-lnk" href="#fn-asterisk-page70" onClick={scrollToFootnote}>*</a>
                        </span>
                    </li>
                </ul>

                <div className="page70-split-row">
                    <section className="page70-ranking-col" aria-label={rankingAria}>
                        <h2 className="page70-graphic-title">{rankingTitle}</h2>
                        <div className="page70-capsule-graphic">
                            {rankingRows.map((row) => renderCapsuleRow(row, maxPct))}
                        </div>
                        <div className="page70-download-buttons">
                            <button type="button" style={downloadBtnStyle} onClick={downloadRankingPng}>
                                {getText('page70_download_ranking_png', lang)}
                            </button>
                        </div>
                    </section>

                    <section className="page70-infographic-col" aria-label={stripHtml(infographicTitle)}>
                        <h2 className="page70-graphic-title">{infographicTitle}</h2>
                        <div ref={infographicRef}>
                            <Page70WindSolarInfographic
                                wind={windOverlay}
                                solar={solarOverlay}
                                ariaLabel={stripHtml(infographicTitle)}
                            />
                        </div>
                        <div className="page70-download-buttons">
                            <button type="button" style={downloadBtnStyle} onClick={downloadInfographicPng}>
                                {getText('page70_download_infographic_png', lang)}
                            </button>
                        </div>
                    </section>
                </div>

                <div className="page70-table-wrapper">
                    <details className="page70-data-table" onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                        <summary role="button" aria-expanded={isTableOpen}>
                            <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                            {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                            <span className="wb-inv">
                                {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                            </span>
                        </summary>
                        <div ref={tableTopRef} className="page70-table-scrollbar" aria-hidden="true"><div /></div>
                        <div
                            ref={tableScrollRef}
                            className="page70-table-responsive"
                            role="region"
                            aria-labelledby="page70-table-caption"
                            tabIndex={0}
                        >
                            <table className="table table-bordered table-striped table-hover">
                                <caption id="page70-table-caption" className="wb-inv">{tableCaption}</caption>
                                <thead>
                                    <tr>
                                        <th scope="col" style={{ position: 'sticky', left: 0, backgroundColor: '#f8f9fa', zIndex: 2, fontWeight: 'bold', textAlign: 'center', minWidth: '80px', borderRight: '2px solid #dee2e6' }}>
                                            {getText('page70_table_col_year', lang)}
                                        </th>
                                        {RANKING_COUNTRY_KEYS.map((k) => (
                                            <th key={k} scope="col" style={{ fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
                                                {page70TableColLabel(k, lang)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rankingHistoryRows.map((row) => (
                                        <tr key={row.year}>
                                            <th scope="row" style={{ position: 'sticky', left: 0, zIndex: 1, fontWeight: 'bold', textAlign: 'center', borderRight: '2px solid #dee2e6' }}>
                                                {row.year}
                                            </th>
                                            {row.pcts.map((p, idx) => (
                                                <td key={RANKING_COUNTRY_KEYS[idx]} style={{ textAlign: 'center' }}>
                                                    {formatRankingPct(p)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div ref={tableBottomRef} className="page70-table-scrollbar" aria-hidden="true"><div /></div>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                            <button type="button" style={downloadBtnStyle} onClick={downloadTableCsv}>
                                {getText('page70_download_csv', lang)}
                            </button>
                            <button type="button" style={downloadBtnStyle} onClick={downloadTableDocx}>
                                {getText('page70_download_docx', lang)}
                            </button>
                        </div>
                    </details>
                </div>

                <aside className="wb-fnote page70-footnotes" role="note">
                    <h2>{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt className="wb-inv">{lang === 'en' ? 'Footnote' : 'Note'}</dt>
                        <dd id="fn-asterisk-page70">
                            <a
                                href="#fn-asterisk-rf-page70"
                                onClick={scrollToRef}
                                className="fn-num"
                                title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}
                            >
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                            </a>
                            {' '}{getText('page70_footnote', lang)}
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page70;
