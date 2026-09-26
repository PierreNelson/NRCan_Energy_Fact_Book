import React, { useEffect, useMemo, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import { saveAs } from 'file-saver';
import { getUraniumInternationalData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';

const CANADA_CAPSULE = '#819476';
const TOP_RANKS = [1, 2, 3, 4, 5];

const uraniumCountryLabel = (key, lang) => getText(`uranium_international_country_${key}`, lang);

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

    rows.forEach((row) => {
        const y = startY + rows.indexOf(row) * (rowH + rowGap);
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

const UraniumRankingSection = ({
    sectionId,
    series,
    chartTitleKey,
    tableCaptionKey,
    totalColKey,
    csvSlugKey,
    docxSlugKey,
    pngSlugKey,
    lang,
    locale,
}) => {
    const yearBundle = useMemo(
        () => series?.rows?.find((row) => row.year === series?.defaultYear) ?? series?.rows?.[series?.rows?.length - 1] ?? null,
        [series],
    );

    const formatTotal = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '—';
        return Number(value).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    };

    const rankingRows = useMemo(() => {
        if (!yearBundle?.top5) return [];
        return yearBundle.top5.map((row) => ({
            ...row,
            name: uraniumCountryLabel(row.key, lang),
            pctRounded: Math.round(row.sharePct),
            isCanada: row.key === 'canada',
        }));
    }, [yearBundle, lang]);

    const graphicTitle = substitute(getText(chartTitleKey, lang), {
        total: formatTotal(yearBundle?.total),
        year: yearBundle?.year ?? '',
    });

    const tableCaption = substitute(getText(tableCaptionKey, lang), {
        startYear: series?.startYear ?? '',
        endYear: series?.endYear ?? '',
    });
    const exportTableTitle = stripHtml(tableCaption);

    const yearSpanFile = series?.years?.length
        ? `${series.years[0]}-${series.years[series.years.length - 1]}`
        : '';

    const downloadFilename = (slugKey, yearSuffix = yearSpanFile) => {
        const slug = getText(slugKey, lang);
        const match = slug.match(/^(.+)\.(csv|docx|png)$/);
        if (!match) return slug;
        return `${match[1]} ${yearSuffix}.${match[2]}`;
    };

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('uranium_international_table_col_year', lang), align: 'left' },
        { key: 'total', header: getText(totalColKey, lang), align: 'num' },
        ...TOP_RANKS.map((rank) => ({
            key: `rank${rank}`,
            header: getText(`uranium_international_table_col_rank${rank}`, lang),
            align: 'left',
        })),
        { key: 'canadaPct', header: getText('uranium_international_table_col_canada', lang), align: 'num' },
        { key: 'canadaRank', header: getText('uranium_international_table_col_canada_rank', lang), align: 'num' },
    ], [lang, totalColKey]);

    const tableRows = useMemo(
        () =>
            (series?.rows ?? []).map((row) => {
                const formatTopCountryCell = (entry) => {
                    if (!entry) return '—';
                    return `${uraniumCountryLabel(entry.key, lang)} (${Math.round(entry.sharePct)}%)`;
                };
                const rankCells = Object.fromEntries(
                    TOP_RANKS.map((rank) => [
                        `rank${rank}`,
                        formatTopCountryCell(row.top5?.find((item) => item.rank === rank)),
                    ]),
                );
                return {
                    year: row.year,
                    total: row.total,
                    ...rankCells,
                    canadaPct: row.canadaSharePct != null ? Math.round(row.canadaSharePct) : '',
                    canadaRank: row.canadaRank != null ? Math.round(row.canadaRank) : '',
                };
            }),
        [series, lang],
    );

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

    const downloadInfographicPng = () => {
        if (!rankingRows.length) return;
        exportCapsuleInfographicPng({
            title: stripHtml(graphicTitle),
            rows: rankingRows.map((row) => ({ ...row, pct: row.pctRounded })),
            filename: downloadFilename(pngSlugKey, String(yearBundle?.year ?? yearSpanFile)),
        });
    };

    const renderCapsuleRow = (row, maxPct) => {
        const rawRatio = maxPct > 0 ? row.pctRounded / maxPct : 1;
        const barWidthPct = 62 + 18 * rawRatio;
        const isCanada = row.isCanada;
        return (
            <div key={`${row.rank}-${row.name}`} className={`uranium-international-capsule-row ${isCanada ? 'uranium-international-capsule-row-canada' : ''}`}>
                <div className="uranium-international-capsule-bar-wrap">
                    <div className="uranium-international-capsule-bar" style={{ width: `${barWidthPct}%` }}>
                        <span className="uranium-international-capsule-bar-text">{row.rank} {row.name}</span>
                    </div>
                </div>
                <div className="uranium-international-capsule-connector" />
                <div className="uranium-international-capsule-pill">
                    <span className={`uranium-international-capsule-pill-text${isCanada ? ' uranium-international-capsule-pill-text-canada' : ''}`}>{row.pctRounded}%</span>
                </div>
            </div>
        );
    };

    if (!yearBundle || !rankingRows.length) return null;

    const maxPct = rankingRows[0]?.pctRounded || 1;
    const rankingAria = rankingRows.map((row) =>
        lang === 'en'
            ? `Rank ${row.rank}, ${row.name}, ${row.pctRounded} percent`
            : `Rang ${row.rank}, ${row.name}, ${row.pctRounded} pour cent`,
    ).join('. ');

    return (
        <section className="uranium-international-chart-section" aria-labelledby={`${sectionId}-title`}>
            <h3 id={`${sectionId}-title`} className="uranium-international-graphic-title">{graphicTitle}</h3>
            <div className="uranium-international-capsule-graphic" role="img" aria-label={rankingAria} tabIndex={0}>
                {rankingRows.map((row) => renderCapsuleRow(row, maxPct))}
            </div>

            <div className="uranium-international-download-buttons">
                <button type="button" onClick={downloadInfographicPng} style={downloadBtnStyle}>
                    {getText('uranium_international_download_infographic_png', lang)}
                </button>
            </div>

            <ChartDataTable
                lang={lang}
                columns={tableColumns}
                rows={tableRows}
                csvFilename={downloadFilename(csvSlugKey)}
                docx={{
                    filename: downloadFilename(docxSlugKey),
                    title: exportTableTitle,
                    titleAlign: 'center',
                    columnWidths: [900, 1200, 1100, 1100, 1200, 1000, 1000, 1100, 1100],
                    fontSize: 22,
                }}
                caption={tableCaption}
                tableAriaLabel={tableCaption}
                renderCell={(raw, { column }) => {
                    const key = column?.key;
                    if (key === 'total') return formatTotal(raw);
                    if (key === 'canadaPct') {
                        return raw === '' || raw == null ? '—' : `${raw}%`;
                    }
                    if (key === 'canadaRank') {
                        return raw === '' || raw == null ? '—' : String(raw);
                    }
                    return String(raw ?? '');
                }}
            />
        </section>
    );
};

const UraniumInternational = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    useEffect(() => {
        getUraniumInternationalData()
            .then(setResult)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);


    const hasData = !loading && !error && result
        && (result.exports?.rows?.length || result.production?.rows?.length || result.resources?.rows?.length);

    return (
        <PageShell tabIndex="-1"
            className="page-content page-85 page-chrome page-chrome--bleed"
            role="main"
            aria-labelledby="uranium-international-main-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.page-85.page-content { max-width: none !important; overflow-x: visible !important; }
.page-85 {
}
.uranium-international-container { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.uranium-international-title {
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
.uranium-international-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.uranium-international-intro {
    font-family: 'Noto Sans', sans-serif;
    font-size: 16px;
    line-height: 1.5;
    color: var(--gc-text);
    margin: 0 0 24px 0;
}
.uranium-international-intro ul { margin: 0; padding-left: 1.25em; }
.uranium-international-context-title {
    font-family: 'Lato', sans-serif;
    font-size: 22px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 24px 0;
    text-transform: none;
}
.uranium-international-chart-section { margin-bottom: 36px; }
.uranium-international-graphic-title {
    font-family: 'Lato', sans-serif;
    font-size: 20px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 16px 0;
    text-transform: none;
}
.uranium-international-capsule-graphic {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    font-family: 'Noto Sans', sans-serif;
}
.uranium-international-capsule-row {
    display: flex;
    align-items: center;
    gap: 0;
    min-height: 52px;
    min-width: 0;
}
.uranium-international-capsule-bar-wrap { flex: 0 0 28%; min-width: 0; display: flex; align-items: center; }
.uranium-international-capsule-bar {
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
    color: #333;
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
}
.uranium-international-capsule-row-canada .uranium-international-capsule-bar { background-color: ${CANADA_CAPSULE}; color: #fff; font-weight: bold; }
.uranium-international-capsule-bar-text { word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; white-space: normal; line-height: 1.3; }
.uranium-international-capsule-connector { flex: 1 1 0; min-width: 10px; height: 2px; background-color: #b0b0b0; }
.uranium-international-capsule-row-canada .uranium-international-capsule-connector { background-color: ${CANADA_CAPSULE}; }
.uranium-international-capsule-pill {
    flex: 0 0 64px;
    height: 36px;
    min-width: 64px;
    border-radius: 999px;
    border: 1px solid #b0b0b0;
    background-color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #333;
    box-sizing: border-box;
}
.uranium-international-capsule-pill-text { font-size: 15px; }
.uranium-international-capsule-row-canada .uranium-international-capsule-pill { border-width: 2px; border-color: ${CANADA_CAPSULE}; font-weight: bold; }
.uranium-international-capsule-pill-text-canada { font-size: 16px; font-weight: bold; }
.uranium-international-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.uranium-international-loading, .uranium-international-error { font-family: Arial, sans-serif; font-size: 16px; color: var(--gc-text); }
.uranium-international-chart-section .data-table-wrapper { padding-top: 5px; margin-top: 20px; width: 100%; box-sizing: border-box; }
.page-85 .data-table-wrapper summary {
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    padding: 10px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    list-style: none;
    box-sizing: border-box;
    width: 100%;
    color: #ffffff;
}
.page-85 .data-table-wrapper summary::-webkit-details-marker { display: none; }
.page-85 .data-table-wrapper summary:hover,
.page-85 .data-table-wrapper button:hover { background-color: #404040 !important; }
@media (max-width: 480px) {
    .uranium-international-title { font-size: 28px; }
}
            `}</style>

            <div className="uranium-international-container">
                {loading && <p className="uranium-international-loading">{lang === 'en' ? 'Loading data…' : 'Chargement des données…'}</p>}
                {!loading && error && <p className="uranium-international-error" role="alert">{error}</p>}
                {!loading && !error && !hasData && (
                    <p className="uranium-international-error">{lang === 'en' ? 'No data available.' : 'Aucune donnée disponible.'}</p>
                )}

                {hasData && (
                    <>
                        <header>
                            <h1 id="uranium-international-main-title" className="uranium-international-title">{getText('uranium_international_title', lang)}</h1>
                        </header>

                        <div className="uranium-international-intro">
                            <ul>
                                <li dangerouslySetInnerHTML={{ __html: getText('uranium_international_bullet1', lang) }} />
                            </ul>
                        </div>

                        <h2 className="uranium-international-context-title">{getText('uranium_international_context_title', lang)}</h2>

                        <UraniumRankingSection
                            sectionId="uranium-international-exports"
                            series={result.exports}
                            chartTitleKey="uranium_international_exports_chart_title"
                            tableCaptionKey="uranium_international_exports_table_caption"
                            totalColKey="uranium_international_table_col_total_exports"
                            csvSlugKey="uranium_international_exports_csv_slug"
                            docxSlugKey="uranium_international_exports_docx_slug"
                            pngSlugKey="uranium_international_exports_png_slug"
                            lang={lang}
                            locale={locale}
                        />

                        <UraniumRankingSection
                            sectionId="uranium-international-production"
                            series={result.production}
                            chartTitleKey="uranium_international_production_chart_title"
                            tableCaptionKey="uranium_international_production_table_caption"
                            totalColKey="uranium_international_table_col_total_production"
                            csvSlugKey="uranium_international_production_csv_slug"
                            docxSlugKey="uranium_international_production_docx_slug"
                            pngSlugKey="uranium_international_production_png_slug"
                            lang={lang}
                            locale={locale}
                        />

                        <UraniumRankingSection
                            sectionId="uranium-international-resources"
                            series={result.resources}
                            chartTitleKey="uranium_international_resources_chart_title"
                            tableCaptionKey="uranium_international_resources_table_caption"
                            totalColKey="uranium_international_table_col_total_resources"
                            csvSlugKey="uranium_international_resources_csv_slug"
                            docxSlugKey="uranium_international_resources_docx_slug"
                            pngSlugKey="uranium_international_resources_png_slug"
                            lang={lang}
                            locale={locale}
                        />
                    </>
                )}
            </div>
        </PageShell>
    );
};

export default UraniumInternational;
