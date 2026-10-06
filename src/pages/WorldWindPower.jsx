import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import YearSelect from '../components/YearSelect';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import SafeHtml from '../components/SafeHtml';
import { useOutletContext } from 'react-router-dom';
import { saveAs } from 'file-saver';
import { getWorldWindPowerData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';

const CANADA_CAPSULE = '#819476';
const TOP_RANKS = [1, 2, 3, 4, 5];

const resolveWindShareForYear = (windShareByYear, selectedYear) => {
    if (selectedYear == null || !windShareByYear) return { year: null, share: null };
    if (windShareByYear[selectedYear] != null) {
        return { year: selectedYear, share: windShareByYear[selectedYear] };
    }
    const priorYears = Object.keys(windShareByYear)
        .map(Number)
        .filter((y) => y <= selectedYear)
        .sort((a, b) => b - a);
    if (priorYears.length) {
        const fallbackYear = priorYears[0];
        return { year: fallbackYear, share: windShareByYear[fallbackYear] };
    }
    return { year: null, share: null };
};

const worldWindCountryLabel = (key, lang) => {
    const text = getText(`world_wind_power_country_${key}`, lang);
    if (text && text !== `world_wind_power_country_${key}`) return text;
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
        ctx.fillText(`${row.pctRounded}%`, pillX + pillW / 2, y + rowH / 2);
    });

    canvas.toBlob((blob) => {
        if (blob) saveAs(blob, filename);
    });
};

const WorldWindPower = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [year, setYear] = useState(null);
    const infographicRef = useRef(null);

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';

    const minSelectorYear = useMemo(() => {
        const shareYears = Object.keys(result?.windShareByYear ?? {})
            .map(Number)
            .sort((a, b) => a - b);
        return shareYears[0] ?? 2018;
    }, [result]);

    const selectorYears = useMemo(
        () => (result?.years ?? []).filter((y) => y >= minSelectorYear),
        [result, minSelectorYear],
    );
    const yearsDesc = useMemo(() => [...selectorYears].reverse(), [selectorYears]);

    const effectiveYear = useMemo(() => {
        if (!selectorYears.length || year == null) return year;
        return selectorYears.includes(year) ? year : selectorYears[selectorYears.length - 1];
    }, [selectorYears, year]);

    const yearSpanFile = selectorYears.length
        ? `${selectorYears[0]}-${selectorYears[selectorYears.length - 1]}`
        : '';
    const yearBundle = useMemo(
        () => result?.rows?.find((row) => row.year === effectiveYear) ?? null,
        [result, effectiveYear],
    );

    const formatShare = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    };

    const formatGw = (value) => {
        if (value == null || Number.isNaN(Number(value))) return '–';
        return Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
    };

    const rankingRows = useMemo(() => {
        if (!yearBundle?.top5) return [];
        return yearBundle.top5.map((row) => ({
            ...row,
            name: worldWindCountryLabel(row.key, lang),
            pctRounded: Math.round(row.sharePct),
        }));
    }, [yearBundle, lang]);

    const canadaRow = useMemo(() => {
        if (!yearBundle) return null;
        return {
            rank: Math.round(yearBundle.canadaRank ?? 0),
            name: worldWindCountryLabel('canada', lang),
            pctRounded: Math.round(yearBundle.canadaSharePct ?? 0),
            isCanada: true,
        };
    }, [yearBundle, lang]);

    const windShareForBullet = useMemo(
        () => resolveWindShareForYear(result?.windShareByYear, effectiveYear),
        [effectiveYear, result],
    );

    const graphicTitle = substitute(getText('world_wind_power_chart_title', lang), {
        totalGw: formatGw(yearBundle?.totalGw),
        year: effectiveYear ?? '',
    });

    const tableCaption = substitute(getText('world_wind_power_table_caption', lang), {
        startYear: result?.startYear ?? '',
        endYear: result?.endYear ?? '',
    });
    const exportTableTitle = stripHtml(tableCaption);

    const downloadFilename = (slugKey, yearSuffix = yearSpanFile) => {
        const slug = getText(slugKey, lang);
        const match = slug.match(/^(.+)\.(csv|docx|png)$/);
        if (!match) return slug;
        return `${match[1]} ${yearSuffix}.${match[2]}`;
    };

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('world_wind_power_table_col_year', lang), align: 'left' },
        { key: 'totalGw', header: getText('world_wind_power_table_col_total', lang), align: 'num' },
        ...TOP_RANKS.map((rank) => ({
            key: `rank${rank}`,
            header: getText(`world_wind_power_table_col_rank${rank}`, lang),
            align: 'left',
        })),
        { key: 'canadaPct', header: getText('world_wind_power_table_col_canada', lang), align: 'num' },
        { key: 'canadaRank', header: getText('world_wind_power_table_col_canada_rank', lang), align: 'num' },
    ], [lang]);

    const tableRows = useMemo(
        () =>
            (result?.rows ?? []).slice().reverse().map((row) => {
                const formatTopCountryCell = (entry) => {
                    if (!entry) return '–';
                    return `${worldWindCountryLabel(entry.key, lang)} (${Math.round(entry.sharePct)}%)`;
                };
                const rankCells = Object.fromEntries(
                    TOP_RANKS.map((rank) => [
                        `rank${rank}`,
                        formatTopCountryCell(row.top5?.find((item) => item.rank === rank)),
                    ]),
                );
                return {
                    year: row.year,
                    totalGw: row.totalGw,
                    ...rankCells,
                    canadaPct: row.canadaSharePct != null ? Math.round(row.canadaSharePct) : '',
                    canadaRank: row.canadaRank != null ? Math.round(row.canadaRank) : '',
                };
            }),
        [result, lang],
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
        if (!rankingRows.length || !canadaRow) return;
        const rows = [
            ...rankingRows.map((row) => ({ ...row, pct: row.pctRounded, isCanada: false })),
            { isEllipsis: true },
            { ...canadaRow, pct: canadaRow.pctRounded },
        ];
        exportCapsuleInfographicPng({
            title: stripHtml(graphicTitle),
            rows,
            filename: downloadFilename('world_wind_power_png_slug', String(year ?? yearSpanFile)),
        });
    };

    const renderCapsuleRow = (row, maxPct) => {
        const isCanada = row.isCanada;
        const rawRatio = maxPct > 0 ? row.pctRounded / maxPct : 1;
        const barWidthPct = 62 + 18 * rawRatio;
        return (
            <div key={`${row.rank}-${row.name}`} className={`world-wind-power-capsule-row ${isCanada ? 'world-wind-power-capsule-row-canada' : ''}`}>
                <div className="world-wind-power-capsule-bar-wrap">
                    <div className="world-wind-power-capsule-bar" style={{ width: `${barWidthPct}%` }}>
                        <span className="world-wind-power-capsule-bar-text">{row.rank} {row.name}</span>
                    </div>
                </div>
                <div className="world-wind-power-capsule-connector" />
                <div className="world-wind-power-capsule-pill">
                    <span className={`world-wind-power-capsule-pill-text${isCanada ? ' world-wind-power-capsule-pill-text-canada' : ''}`}>{row.pctRounded}%</span>
                </div>
            </div>
        );
    };

    const rankingAria = useMemo(() => {
        if (!rankingRows.length || !canadaRow) return '';
        const parts = rankingRows.map((row) =>
            lang === 'en'
                ? `Rank ${row.rank}, ${row.name}, ${row.pctRounded} percent`
                : `Rang ${row.rank}, ${row.name}, ${row.pctRounded} pour cent`,
        );
        const canadaPart = lang === 'en'
            ? `Rank ${canadaRow.rank}, ${canadaRow.name}, ${canadaRow.pctRounded} percent`
            : `Rang ${canadaRow.rank}, ${canadaRow.name}, ${canadaRow.pctRounded} pour cent`;
        return lang === 'en'
            ? `World wind power capacity ranking for ${year}: ${parts.join('. ')}. ${canadaPart}.`
            : `Classement mondial de la capacité d'énergie éolienne pour ${year}: ${parts.join('. ')}. ${canadaPart}.`;
    }, [rankingRows, canadaRow, year, lang]);

    const hasChartData = !loading && !error && yearBundle && rankingRows.length > 0 && canadaRow;

    const bullet2Html = substitute(getText('world_wind_power_bullet2', lang), {
        share: formatShare(windShareForBullet.share),
        year: windShareForBullet.year ?? '',
    });

    useEffect(() => {
        getWorldWindPowerData()
            .then((data) => {
                setResult(data);
                const shareYears = Object.keys(data.windShareByYear ?? {})
                    .map(Number)
                    .sort((a, b) => a - b);
                const minYear = shareYears[0] ?? 2018;
                const selectable = (data.years ?? []).filter((y) => y >= minYear);
                if (selectable.length) setYear(selectable[selectable.length - 1]);
            })
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    return (
        <PageShell tabIndex="-1"
            className="page-content page-79 page-chrome page-chrome--bleed"
            aria-labelledby="world-wind-power-main-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.page-79.page-content { max-width: none !important; overflow-x: visible !important; }
.page-79 {
}
.world-wind-power-container { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.world-wind-power-title {
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
.world-wind-power-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.world-wind-power-split {
    display: grid;
    grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
    gap: 0;
    align-items: stretch;
}
.world-wind-power-left {
    background-color: #ebebeb;
    padding: 28px 32px;
    box-sizing: border-box;
}
.world-wind-power-right {
    background-color: #ffffff;
    padding: 28px 32px;
    box-sizing: border-box;
    position: relative;
}
.world-wind-power-left-kicker {
    font-family: 'Lato', sans-serif;
    font-size: clamp(26px, 3vw, 34px);
    font-weight: bold;
    color: #4d7c2f;
    margin: 0 0 18px 0;
    text-transform: none;
}
.world-wind-power-context-title {
    font-family: 'Lato', sans-serif;
    font-size: clamp(22px, 2.6vw, 28px);
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 12px 0;
    text-transform: none;
}
.world-wind-power-bullets {
    font-family: var(--font-body);
    font-size: clamp(17px, 2vw, 20px);
    color: var(--gc-text);
    line-height: 1.55;
    margin: 0;
    padding-left: 1.25rem;
}
.world-wind-power-bullets li { margin-bottom: 0.85rem; }
.world-wind-power-bullets strong {
    font-weight: bold;
    font-size: 1.55em;
    line-height: 1.15;
}
.world-wind-power-bullets .world-wind-power-share-emphasis {
    font-size: 2.4em;
    line-height: 1.05;
}
.world-wind-power-graphic-title {
    font-family: 'Lato', sans-serif;
    font-size: clamp(20px, 2.4vw, 26px);
    font-weight: bold;
    color: #000000;
    margin: 0 0 14px 0;
    text-transform: none;
}
.world-wind-power-capsule-graphic {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    font-family: 'Noto Sans', sans-serif;
}
.world-wind-power-capsule-row {
    display: flex;
    align-items: center;
    min-height: 52px;
    gap: 0;
    min-width: 0;
}
.world-wind-power-capsule-bar-wrap { flex: 0 0 28%; min-width: 0; display: flex; align-items: center; }
.world-wind-power-capsule-bar {
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
.world-wind-power-capsule-bar-text { word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; white-space: normal; line-height: 1.3; }
.world-wind-power-capsule-row-canada .world-wind-power-capsule-bar { background-color: ${CANADA_CAPSULE}; color: #fff; font-weight: bold; }
.world-wind-power-capsule-connector { flex: 1 1 0; min-width: 10px; height: 2px; background-color: #b0b0b0; }
.world-wind-power-capsule-row-canada .world-wind-power-capsule-connector { background-color: ${CANADA_CAPSULE}; }
.world-wind-power-capsule-pill {
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
.world-wind-power-capsule-pill-text { font-size: 15px; }
.world-wind-power-capsule-row-canada .world-wind-power-capsule-pill { border-width: 2px; border-color: ${CANADA_CAPSULE}; }
.world-wind-power-capsule-pill-text-canada { font-size: 22px; font-weight: bold; }
.world-wind-power-capsule-ellipsis { min-height: 28px; padding-left: 4%; color: #333; font-size: 18px; font-weight: bold; }
.world-wind-power-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.world-wind-power-loading, .world-wind-power-error { font-family: Arial, sans-serif; font-size: 16px; color: var(--gc-text); }
.world-wind-power-chart-section .data-table-wrapper { padding-top: 5px; margin-top: 20px; width: 100%; box-sizing: border-box; }
@media (max-width: 880px) {
    .world-wind-power-split { grid-template-columns: 1fr; }
    .world-wind-power-title { font-size: 37px; }
}
@media (max-width: 480px) {
    .world-wind-power-title { font-size: 28px; }
}
            `}</style>

            <div className="world-wind-power-container">
                {loading && <p className="world-wind-power-loading">{lang === 'en' ? 'Loading data…' : 'Chargement des données…'}</p>}
                {!loading && error && <p className="world-wind-power-error" role="alert">{error}</p>}
                {!loading && !error && !result?.rows?.length && (
                    <p className="world-wind-power-error">{lang === 'en' ? 'No data available.' : 'Aucune donnée disponible.'}</p>
                )}

                {hasChartData && (
                    <>
                        <header>
                            <h1 id="world-wind-power-main-title" className="world-wind-power-title">{getText('world_wind_power_title', lang)}</h1>
                        </header>

                        <YearSelect
                            lang={lang}
                            id="world-wind-power-year-button"
                            className="world-wind-power-year-selector"
                            label={getText('year_slider_label', lang)}
                            years={yearsDesc}
                            value={year}
                            onChange={setYear}
                        />
                        <div role="status" className="wb-inv" aria-live="polite">
                            {year ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${year}` : ''}
                        </div>

                        <div className="world-wind-power-split" ref={infographicRef}>
                            <div className="world-wind-power-left">
                                <p className="world-wind-power-left-kicker" aria-hidden="true">{getText('world_wind_power_title', lang)}</p>
                                <ul className="world-wind-power-bullets">
                                    <SafeHtml as="li" html={getText('world_wind_power_bullet1', lang)}  />
                                    <SafeHtml as="li" html={bullet2Html}  />
                                </ul>
                            </div>

                            <div className="world-wind-power-right">
                                <h2 className="world-wind-power-context-title" tabIndex={0} data-prose-tab="1">{getText('world_wind_power_context_title', lang)}</h2>

                                <section className="world-wind-power-chart-section">
                                    <h3 className="world-wind-power-graphic-title">{graphicTitle}</h3>
                                    <div className="world-wind-power-capsule-graphic" role="region" tabIndex={0} aria-label={rankingAria}>
                                        {rankingRows.map((row) => renderCapsuleRow({ ...row, pctRounded: row.pctRounded, isCanada: false }, rankingRows[0]?.pctRounded || 1))}
                                        <div className="world-wind-power-capsule-row world-wind-power-capsule-ellipsis" aria-hidden="true"><span>...</span></div>
                                        {canadaRow && renderCapsuleRow(canadaRow, rankingRows[0]?.pctRounded || 1)}
                                    </div>

                                    <div className="world-wind-power-download-buttons">
                                        <button type="button" onClick={downloadInfographicPng} style={downloadBtnStyle}>
                                            {getText('world_wind_power_download_infographic_png', lang)}
                                        </button>
                                    </div>

                                    <ChartDataTable
                                        lang={lang}
                                        columns={tableColumns}
                                        rows={tableRows}
                                        csvFilename={downloadFilename('world_wind_power_csv_slug')}
                                        docx={{
                                            filename: downloadFilename('world_wind_power_docx_slug'),
                                            title: exportTableTitle,
                                            titleAlign: 'center',
                                            columnWidths: [900, 1200, 1100, 1100, 1200, 1000, 1000, 1100, 1100],
                                            fontSize: 22,
                                        }}
                                        caption={tableCaption}
                                        tableAriaLabel={tableCaption}
                                        renderCell={(raw, { column }) => {
                                            const key = column?.key;
                                            if (key === 'totalGw') return formatGw(raw);
                                            if (key === 'canadaPct' || key === 'canadaRank') {
                                                return raw === '' || raw == null ? '—' : String(raw);
                                            }
                                            return String(raw ?? '');
                                        }}
                                    />
                                </section>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </PageShell>
    );
};

export default WorldWindPower;
