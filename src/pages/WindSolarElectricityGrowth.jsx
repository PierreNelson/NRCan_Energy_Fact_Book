import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import PageFootnotes from '../components/PageFootnotes';
import YearSelect from '../components/YearSelect';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import { saveAs } from 'file-saver';
import WindSolarElectricityGrowthInfographic from '../components/WindSolarElectricityGrowthInfographic';
import { exportWindSolarGrowthInfographicPng } from '../components/WindSolarElectricityGrowthInfographic.constants';
import { getWindSolarElectricityGrowthData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';

import { makeScrollToIdHandler } from '../utils/scrollToId';

const CANADA_CAPSULE = '#819476';
const RANKING_COUNTRY_KEYS = ['canada', 'usa', 'russia', 'china', 'india'];

const windSolarCountryLabel = (key, lang) => getText(`wind_solar_electricity_growth_country_${key}`, lang);
const windSolarTableColLabel = (key, lang) => getText(`wind_solar_electricity_growth_table_col_${key}`, lang);

const formatRankingPct = (value) => (value === '' || value == null ? '\u2014' : `${value}%`);

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

const WindSolarElectricityGrowth = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [year, setYear] = useState(null);

    const infographicRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    useEffect(() => {
        getWindSolarElectricityGrowthData()
            .then((data) => {
                setResult(data);
                setYear(data.defaultRankingYear ?? data.rankingYears?.[0] ?? null);
            })
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    const scrollToFootnote = makeScrollToIdHandler('fn-asterisk-wind-solar-electricity-growth');

    const scrollToRef = makeScrollToIdHandler('fn-asterisk-rf-wind-solar-electricity-growth');

    const rankingYears = useMemo(() => result?.rankingYears ?? [], [result]);
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
            name: windSolarCountryLabel(row.key, lang),
            pctRounded: Math.round(row.pct),
            isCanada: row.key === 'canada',
        }));
    }, [result, year, lang]);

    const rankingTitle = substitute(getText('wind_solar_electricity_growth_ranking_title', lang), textVars);
    const infographicTitle = substitute(getText('wind_solar_electricity_growth_infographic_title', lang), textVars);
    const tableCaption = getText('wind_solar_electricity_growth_table_caption', lang);
    const exportTableTitle = stripHtml(tableCaption);

    const tableColumns = useMemo(
        () => [
            { key: 'year', header: getText('wind_solar_electricity_growth_table_col_year', lang), align: 'left' },
            ...RANKING_COUNTRY_KEYS.map((k) => ({
                key: k,
                header: windSolarTableColLabel(k, lang),
                align: 'num',
            })),
        ],
        [lang],
    );

    const tableRows = useMemo(
        () =>
            rankingHistoryRows.map((row) => {
                const cells = { year: row.year };
                RANKING_COUNTRY_KEYS.forEach((key, idx) => {
                    cells[key] = row.pcts?.[idx] ?? '';
                });
                return cells;
            }),
        [rankingHistoryRows],
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
            filename: downloadFilename('wind_solar_electricity_growth_ranking_png_slug', year),
        });
    };

    const downloadInfographicPng = async () => {
        const canvas = await exportWindSolarGrowthInfographicPng(infographicRef.current, {
            title: stripHtml(infographicTitle),
            scale: 2,
        });
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, downloadFilename('wind_solar_electricity_growth_infographic_png_slug', `${result?.startYear ?? ''}-${result?.endYear ?? ''}`));
        });
    };

    const renderCapsuleRow = (row, maxPct) => {
        const rawRatio = maxPct > 0 ? row.pct / maxPct : 1;
        const barWidthPct = 62 + 18 * rawRatio;
        return (
            <div key={`${row.rank}-${row.key}`} className={`wind-solar-electricity-growth-capsule-row ${row.isCanada ? 'wind-solar-electricity-growth-capsule-row-canada' : ''}`}>
                <div className="wind-solar-electricity-growth-capsule-bar-wrap">
                    <div className="wind-solar-electricity-growth-capsule-bar" style={{ width: `${barWidthPct}%` }}>
                        <span className="wind-solar-electricity-growth-capsule-bar-text">{row.rank} {row.name}</span>
                    </div>
                </div>
                <div className="wind-solar-electricity-growth-capsule-connector" />
                <div className="wind-solar-electricity-growth-capsule-pill">
                    <span className="wind-solar-electricity-growth-capsule-pill-text">{row.pctRounded}%</span>
                </div>
            </div>
        );
    };

    const hasPageData = !loading && !error && result && year != null;

    const maxPct = rankingRows[0]?.pct || 1;

    const windOverlay = hasPageData ? {
        label: getText('wind_solar_electricity_growth_wind_label', lang),
        endValue: Number(result.windEnd).toLocaleString(locale, { maximumFractionDigits: 0 }),
        endYear: result.endYear,
        startValue: Number(result.windStart).toLocaleString(locale, { maximumFractionDigits: 0 }),
        startYear: result.startYear,
    } : null;

    const solarOverlay = hasPageData ? {
        label: getText('wind_solar_electricity_growth_solar_label', lang),
        endValue: Number(result.solarEnd).toLocaleString(locale, { maximumFractionDigits: 0 }),
        endYear: result.endYear,
        startValue: Number(result.solarStart).toLocaleString(locale, { maximumFractionDigits: 0 }),
        startYear: result.startYear,
    } : null;

    const rankingBody = lang === 'en'
        ? `Non-emitting electricity ranking for ${year}: ${rankingRows.map((r) => `Rank ${r.rank}, ${r.name}, ${r.pctRounded} percent`).join('. ')}.`
        : `Classement de l'électricité non émettrice pour ${year} : ${rankingRows.map((r) => `Rang ${r.rank}, ${r.name}, ${r.pctRounded} pour cent`).join('. ')}.`;
    const rankingAria = `${stripHtml(rankingTitle)}. ${rankingBody}`;

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-70 page-chrome page-chrome--bleed"
            aria-labelledby="wind-solar-electricity-growth-content"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.page-70.page-content { max-width: none !important; overflow-x: visible !important; }
.page-70 {
}
.wind-solar-electricity-growth-container { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.wind-solar-electricity-growth-bullets {
    font-family: 'Noto Sans', sans-serif;
    font-size: 1.05rem;
    line-height: 1.55;
    color: var(--gc-text);
    margin: 0 0 24px 0;
    padding-left: 1.25rem;
}
.wind-solar-electricity-growth-bullets li { margin-bottom: 0.85rem; }
.wind-solar-electricity-growth-bullets strong { font-weight: 700; }
.wind-solar-electricity-growth-bullets .fn-lnk { color: #26374a; }
.wind-solar-electricity-growth-split-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 24px;
    align-items: start;
    width: 100%;
}
.wind-solar-electricity-growth-ranking-col { min-width: 0; }
.wind-solar-electricity-growth-infographic-col { min-width: 0; }
.wind-solar-electricity-growth-graphic-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: #000000;
    margin: 0 0 10px 0;
    text-align: left;
    width: 100%;
    text-transform: none;
}
.wind-solar-electricity-growth-capsule-graphic {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    font-family: 'Noto Sans', sans-serif;
}
.wind-solar-electricity-growth-capsule-row { display: flex; align-items: center; min-height: 52px; gap: 0; min-width: 0; }
.wind-solar-electricity-growth-capsule-bar-wrap { flex: 0 0 28%; min-width: 0; display: flex; align-items: center; }
.wind-solar-electricity-growth-capsule-bar {
    min-height: 44px; min-width: 82px; border-radius: 999px; background-color: #d1d1d1;
    display: flex; align-items: center; justify-content: center; text-align: center;
    padding: 10px 12px; font-size: clamp(13px, 1.5vw, 15px); color: #333; box-sizing: border-box;
    width: 100%; max-width: 100%;
}
.wind-solar-electricity-growth-capsule-bar-text { word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; white-space: normal; line-height: 1.3; }
.wind-solar-electricity-growth-capsule-row-canada .wind-solar-electricity-growth-capsule-bar { background-color: ${CANADA_CAPSULE}; color: #fff; font-weight: bold; }
.wind-solar-electricity-growth-capsule-connector { flex: 1 1 0; min-width: 10px; height: 2px; background-color: #b0b0b0; }
.wind-solar-electricity-growth-capsule-row-canada .wind-solar-electricity-growth-capsule-connector { background-color: ${CANADA_CAPSULE}; }
.wind-solar-electricity-growth-capsule-pill {
    flex: 0 0 64px; height: 36px; min-width: 64px; border-radius: 999px; border: 1px solid #b0b0b0;
    background-color: #fff; display: flex; align-items: center; justify-content: center;
    font-size: 15px; color: #333; box-sizing: border-box;
}
.wind-solar-electricity-growth-capsule-row-canada .wind-solar-electricity-growth-capsule-pill { border-width: 2px; border-color: ${CANADA_CAPSULE}; font-weight: bold; font-size: 16px; }
.wind-solar-electricity-growth-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.wind-solar-electricity-growth-infographic-figure { position: relative; margin: 0; width: 100%; }
.wind-solar-electricity-growth-infographic-wrapper {
    position: relative;
    width: 100%;
    container-type: inline-size;
    overflow: visible;
}
.wind-solar-electricity-growth-column-stop {
    position: absolute;
    z-index: 4;
    top: 0;
    /* Start values sit on the bottom edge; extend the stop so the focus outline clears them. */
    bottom: -8%;
}
.wind-solar-electricity-growth-column-stop:focus,
.wind-solar-electricity-growth-column-stop:focus-visible {
    outline: 3px solid #ffbf47;
    outline-offset: 0;
}
.wind-solar-electricity-growth-bg-image { display: block; max-width: 100%; pointer-events: none; user-select: none; }
.wind-solar-electricity-growth-overlay {
    position: absolute;
    font-family: 'Noto Sans', sans-serif;
    color: #333333;
    line-height: 1.15;
    pointer-events: none;
    white-space: nowrap;
}
.wind-solar-electricity-growth-overlay.wind-solar-electricity-growth-label { font-weight: 400; }
.wind-solar-electricity-growth-overlay.wind-solar-electricity-growth-value { font-weight: 700; }
.wind-solar-electricity-growth-overlay.wind-solar-electricity-growth-year { font-weight: 400; }
.wind-solar-electricity-growth-table-wrapper { display: block; width: 100%; margin-top: 20px; margin-bottom: 0; }
.wind-solar-electricity-growth-table-wrapper .data-table-wrapper { width: 100%; box-sizing: border-box; }
.wind-solar-electricity-growth-footnotes {
    margin-top: 28px; font-family: 'Noto Sans', sans-serif; font-size: 0.95rem; color: var(--gc-text);
    border-top: 1px solid #ddd; padding-top: 16px;
}
.wind-solar-electricity-growth-footnotes h2 {
    font-size: 1.25rem; font-weight: bold; margin: 0 0 0.75rem 0;
}
.wind-solar-electricity-growth-footnotes dd { display: flex; align-items: flex-start; gap: 0.75rem; margin-left: 0; margin-bottom: 1rem; }
.wind-solar-electricity-growth-loading, .wind-solar-electricity-growth-error { padding: 20px; font-family: 'Noto Sans', sans-serif; }
@media (max-width: 900px) {
    .wind-solar-electricity-growth-split-row { grid-template-columns: 1fr; }
    .wind-solar-electricity-growth-graphic-title { font-size: 26px; }
}
            `}</style>

            <div className="wind-solar-electricity-growth-container" id="wind-solar-electricity-growth-content">
                {loading && (
                    <p className="wind-solar-electricity-growth-loading">{lang === 'en' ? 'Loading data…' : 'Chargement des données…'}</p>
                )}
                {!loading && error && (
                    <p className="wind-solar-electricity-growth-error" role="alert">{error}</p>
                )}
                {!loading && !error && !hasPageData && (
                    <p className="wind-solar-electricity-growth-error">{lang === 'en' ? 'No data available.' : 'Aucune donnée disponible.'}</p>
                )}

                {hasPageData && (
                    <>
                        {rankingYearsDesc.length > 0 && (
                            <>
                                <YearSelect
                                    lang={lang}
                                    id="wind-solar-electricity-growth-year-button"
                                    className="wind-solar-electricity-growth-year-dropdown"
                                    label={getText('year_slider_label', lang)}
                                    years={rankingYearsDesc}
                                    value={year}
                                    onChange={setYear}
                                />
                                <div role="status" className="wb-inv" aria-live="polite">
                                    {year
                                        ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${year}`
                                        : ''}
                                </div>
                            </>
                        )}

                        <ul className="wind-solar-electricity-growth-bullets">
                            <li dangerouslySetInnerHTML={{ __html: substitute(getText('wind_solar_electricity_growth_bullet1', lang), textVars) }} />
                            <li>
                                <span dangerouslySetInnerHTML={{ __html: substitute(getText('wind_solar_electricity_growth_bullet2', lang), textVars) }} />
                                <span id="fn-asterisk-rf-wind-solar-electricity-growth" style={{ verticalAlign: 'super', fontSize: '0.75em' }}>
                                    <a className="fn-lnk" href="#fn-asterisk-wind-solar-electricity-growth" onClick={scrollToFootnote}>*</a>
                                </span>
                            </li>
                        </ul>

                        <div className="wind-solar-electricity-growth-split-row">
                            <section className="wind-solar-electricity-growth-ranking-col">
                                <h2 className="wind-solar-electricity-growth-graphic-title" tabIndex={0} data-prose-tab="1">{rankingTitle}</h2>
                                <div className="wind-solar-electricity-growth-capsule-graphic" role="region" tabIndex={0} aria-label={rankingAria}>
                                    {rankingRows.map((row) => renderCapsuleRow(row, maxPct))}
                                </div>
                                <div className="wind-solar-electricity-growth-download-buttons">
                                    <button type="button" style={downloadBtnStyle} onClick={downloadRankingPng}>
                                        {getText('wind_solar_electricity_growth_download_ranking_png', lang)}
                                    </button>
                                </div>
                            </section>

                            <section className="wind-solar-electricity-growth-infographic-col">
                                <h2 className="wind-solar-electricity-growth-graphic-title" tabIndex={0} data-prose-tab="1">{infographicTitle}</h2>
                                <div ref={infographicRef}>
                                    <WindSolarElectricityGrowthInfographic
                                        wind={windOverlay}
                                        solar={solarOverlay}
                                        lang={lang}
                                    />
                                </div>
                                <div className="wind-solar-electricity-growth-download-buttons">
                                    <button type="button" style={downloadBtnStyle} onClick={downloadInfographicPng}>
                                        {getText('wind_solar_electricity_growth_download_infographic_png', lang)}
                                    </button>
                                </div>
                            </section>
                        </div>

                        <div className="wind-solar-electricity-growth-table-wrapper">
                            <ChartDataTable
                                lang={lang}
                                columns={tableColumns}
                                rows={tableRows}
                                csvFilename={downloadFilename('wind_solar_electricity_growth_table_csv_slug')}
                                docx={{
                                    filename: downloadFilename('wind_solar_electricity_growth_table_docx_slug'),
                                    title: exportTableTitle,
                                    titleAlign: 'center',
                                    columnWidths: [1200, ...RANKING_COUNTRY_KEYS.map(() => 1200)],
                                    fontSize: 22,
                                }}
                                caption={tableCaption}
                                tableAriaLabel={tableCaption}
                                renderCell={(raw, { column }) => {
                                    if (column?.key === 'year') return String(raw ?? '');
                                    return formatRankingPct(raw);
                                }}
                            />
                        </div>

                        <PageFootnotes
                            lang={lang}
                            className="wind-solar-electricity-growth-footnotes"
                            items={[
                                { id: 'fn-asterisk-wind-solar-electricity-growth', marker: '*', text: getText('wind_solar_electricity_growth_footnote', lang), returnHref: '#fn-asterisk-rf-wind-solar-electricity-growth' },
                            ]}
                        />
                    </>
                )}
            </div>
        </PageShell>
    );
};

export default WindSolarElectricityGrowth;
