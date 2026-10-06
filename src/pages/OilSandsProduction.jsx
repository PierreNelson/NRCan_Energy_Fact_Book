import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import YearSelect from '../components/YearSelect';
import { useOutletContext } from 'react-router-dom';
import { saveAs } from 'file-saver';
import { getOilSandsProductionData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import OilSandsProductionInfographic from '../components/OilSandsProductionInfographic';
import { OVERLAY_COLORS, OVERLAY_SLOTS } from '../components/OilSandsProductionInfographic.constants';
import oilSandsBgEn from '../assets/oil_sands_bg.png';
import oilSandsBgFr from '../assets/oil_sands_bg_fr.png';
import { formatLocaleNumber, formatLocalePct } from '../utils/formatLocale';

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const OilSandsProduction = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const figureRef = useRef(null);

    const formatNumber = (value, digits = 0) => formatLocaleNumber(value, lang, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });

    const formatPct = (value, digits = 0) => formatLocalePct(value, lang, {
        suffix: false,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });

    const formatPctDisplay = (value, digits = 0) => formatLocalePct(value, lang, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });

    const formatMmbd = (value, digits = 1) => formatNumber(value, digits);

    const formatMmbdDisplay = (value, digits = 1) => {
        const formatted = formatMmbd(value, digits);
        if (formatted === '—') return formatted;
        return lang === 'fr' ? formatted.replace('.', ',') : formatted;
    };

    useEffect(() => {
        getOilSandsProductionData()
            .then(setResult)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    const effectiveSelectedYear = useMemo(() => {
        if (!result?.selectorYears?.length) return null;
        if (selectedYear != null && result.selectorYears.includes(selectedYear)) {
            return selectedYear;
        }
        return result.selectorYears[0];
    }, [result, selectedYear]);

    const productionRows = result?.production ?? [];
    const selectorYears = result?.selectorYears ?? [];
    const selectedRow = effectiveSelectedYear != null
        ? productionRows.find((row) => row.year === effectiveSelectedYear) ?? null
        : null;
    const year = selectedRow?.year ?? effectiveSelectedYear ?? null;
    const startYear = result?.startYear ?? 2000;
    const endYear = result?.endYear ?? year;
    const textVars = {
        year,
        startYear,
        endYear,
        sharePct: selectedRow?.sharePct != null ? formatPct(selectedRow.sharePct, 0) : '–',
        oilSandsMmbd: selectedRow?.oilSandsMmbd != null ? formatMmbd(selectedRow.oilSandsMmbd, 1) : '–',
    };

    const totalCapexBn = selectedRow?.cumulativeCapexBn != null
        ? Math.round(Number(selectedRow.cumulativeCapexBn))
        : null;
    const refYearCapexBn = selectedRow?.annualCapexM != null
        ? Math.round(Number(selectedRow.annualCapexM) / 100) / 10
        : null;

    const overlayValues = selectedRow
        ? {
            reservesPct: selectedRow.provedReservesPct,
            productionSharePct: selectedRow.sharePct,
            oilSandsMmbd: selectedRow.oilSandsMmbd,
            year: selectedRow.year,
        }
        : null;

    const fileSlugBase = substitute(getText('oil_sands_download_title', lang), textVars)
        .replace(/\s+/g, '_')
        .replace(/–/g, '-');
    const infographicPngSlug = substitute(getText('oil_sands_infographic_png_slug', lang), { year: year ?? '' })
        .replace(/\s+/g, '_');
    const infographicDownloadTitle = substitute(getText('oil_sands_infographic_download_title', lang), textVars)
        .replace(/\s+/g, '_')
        .replace(/–/g, '-');

    const tableCaption = substitute(getText('oil_sands_table_caption', lang), textVars);
    const infographicTableCaption = substitute(getText('oil_sands_infographic_table_caption', lang), textVars);
    const exportTableTitle = stripHtml(tableCaption);
    const exportInfographicTableTitle = stripHtml(infographicTableCaption);

    const infographicColumns = useMemo(() => [
        { key: 'year', header: getText('oil_sands_table_col_year', lang), align: 'left' },
        { key: 'provedReservesPct', header: getText('oil_sands_infographic_table_col_reserves', lang), align: 'num' },
        { key: 'sharePct', header: getText('oil_sands_infographic_table_col_production_share', lang), align: 'num' },
        { key: 'oilSandsMmbd', header: getText('oil_sands_infographic_table_col_production_mmbd', lang), align: 'num' },
    ], [lang]);

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('oil_sands_table_col_year', lang), align: 'left' },
        { key: 'oilSandsThousandM3', header: getText('oil_sands_table_col_oil_sands_m3', lang), align: 'num' },
        { key: 'conventionalThousandM3', header: getText('oil_sands_table_col_conventional_m3', lang), align: 'num' },
        { key: 'totalThousandM3', header: getText('oil_sands_table_col_total_m3', lang), align: 'num' },
        { key: 'oilSandsMmbd', header: getText('oil_sands_table_col_oil_sands_mmbd', lang), align: 'num' },
        { key: 'conventionalMmbd', header: getText('oil_sands_table_col_conventional_mmbd', lang), align: 'num' },
        { key: 'totalMmbd', header: getText('oil_sands_table_col_total_mmbd', lang), align: 'num' },
        { key: 'sharePct', header: getText('oil_sands_table_col_share', lang), align: 'num' },
    ], [lang]);

    const downloadInfographicPng = async () => {
        const bgImage = lang === 'fr' ? oilSandsBgFr : oilSandsBgEn;
        const overlayLang = lang === 'fr' ? 'fr' : 'en';
        const slots = OVERLAY_SLOTS[overlayLang];

        const img = new Image();
        img.src = bgImage;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        const scale = 3;
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const pctSuffix = lang === 'fr' ? ' %' : '%';
        const drawText = (text, slot, { color, font }) => {
            if (!text || text === '–') return;
            ctx.fillStyle = color;
            ctx.font = font;
            ctx.textBaseline = 'middle';
            ctx.textAlign = slot.align ?? 'right';
            const x = (slot.left / 100) * canvas.width;
            const y = (slot.top / 100) * canvas.height;
            ctx.fillText(text, x, y);
        };

        const pctFont = `bold ${Math.round(canvas.width * 0.0735)}px "Times New Roman", Times, serif`;
        const captionFont = `bold ${Math.round(canvas.width * 0.027)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;

        if (overlayValues?.reservesPct != null && !Number.isNaN(Number(overlayValues.reservesPct))) {
            drawText(
                `${formatPct(overlayValues.reservesPct, 0)}${pctSuffix}`,
                slots.reserves_pct,
                { color: OVERLAY_COLORS.reserves_pct, font: pctFont },
            );
        }
        drawText(
            `${formatPct(overlayValues?.productionSharePct, 0)}${pctSuffix}`,
            slots.production_pct,
            { color: OVERLAY_COLORS.production_pct, font: pctFont },
        );
        drawText(String(overlayValues?.year ?? ''), slots.production_year, {
            color: OVERLAY_COLORS.production_year,
            font: captionFont,
        });
        drawText(formatMmbd(overlayValues?.oilSandsMmbd, 1), slots.production_mmbd, {
            color: OVERLAY_COLORS.production_mmbd,
            font: captionFont,
        });

        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${infographicPngSlug}.png`);
        });
    };

    if (loading || error) return <PageStatus lang={lang} loading={loading} error={error} />;
    if (!productionRows.length || !selectedRow) return <p>{getText('oil_sands_no_data', lang)}</p>;

    return (
        <PageShell
            id="main-content"
            tabIndex="-1"
            className="page-content page-113 oil-sands-oil-sands page-chrome page-chrome--bleed"
            aria-labelledby="oil-sands-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.page-113.oil-sands-oil-sands {
}
.oil-sands-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.oil-sands-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 20px 0;
    line-height: 1.25;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: none;
}
.oil-sands-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.oil-sands-capex {
    font-family: var(--font-body);
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
    margin: 0 0 24px 0;
    max-width: none;
}
.oil-sands-section-title {
    font-family: 'Lato', sans-serif;
    font-size: 28px;
    font-weight: bold;
    color: #423330;
    margin: 0 0 16px 0;
    text-transform: none;
}
.oil-sands-text {
    font-family: var(--font-body);
    line-height: 1.5;
    color: var(--gc-text);
    margin-bottom: 28px;
    max-width: none;
}
.oil-sands-text ul {
    margin: 0;
    padding-left: 1.25rem;
}
.oil-sands-text li {
    margin-bottom: 0.65rem;
    font-family: var(--font-body);
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
}
.oil-sands-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.oil-sands-section-title--after-infographic { margin-top: 28px !important; }
.oil-sands-download-buttons { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
.oil-sands-download-buttons button {
    padding: 8px 16px;
    border: 1px solid #404040;
    border-radius: 4px;
    background: #8C8C8C;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.oil-sands-download-buttons button:hover { background-color: #404040 !important; }
@media (max-width: 768px) {
    .oil-sands-title { font-size: 37px; }
    .oil-sands-section-title { font-size: 24px; }
    .oil-sands-text li, .oil-sands-capex { font-size: 18px; }
}
            `}</style>

            <div className="oil-sands-inner">
                <h1 id="oil-sands-title" className="oil-sands-title">{getText('oil_sands_title', lang)}</h1>

                <YearSelect
                    lang={lang}
                    id="oil-sands-year-button"
                    label={getText('year_slider_label', lang)}
                    years={selectorYears}
                    value={year}
                    onChange={setSelectedYear}
                />
                <div role="status" className="wb-inv" aria-live="polite">
                    {year != null ? (lang === 'en' ? `Showing data for ${year}` : `Données affichées pour ${year}`) : ''}
                </div>

                <p className="oil-sands-capex">
                    {lang === 'en' ? (
                        <>
                            {getText('oil_sands_capex_intro', lang)}
                            <strong>{formatNumber(totalCapexBn, 0)}</strong>
                            {getText('oil_sands_capex_mid', lang)}
                            <strong>{formatNumber(refYearCapexBn, 1)}</strong>
                            {getText('oil_sands_capex_end', lang)}
                            {year}
                        </>
                    ) : (
                        <>
                            {getText('oil_sands_capex_intro', lang)}
                            <strong>{formatNumber(totalCapexBn, 0)}</strong>
                            {getText('oil_sands_capex_mid', lang)}
                            <strong>{formatNumber(refYearCapexBn, 1).replace('.', ',')}</strong>
                            {getText('oil_sands_capex_end', lang)}
                            {year}
                        </>
                    )}
                </p>

                <OilSandsProductionInfographic
                    figureRef={figureRef}
                    lang={lang}
                    overlayValues={overlayValues}
                    formatPct={formatPct}
                    formatMmbd={formatMmbd}
                    getText={getText}
                    ariaLabel={getText('oil_sands_bg_alt', lang)}
                />

                <div className="oil-sands-download-buttons">
                    <button type="button" onClick={downloadInfographicPng}>
                        {getText('oil_sands_download_png', lang)}
                    </button>
                </div>

                <div className="oil-sands-table-wrapper oil-sands-infographic-table-wrapper">
                    <ChartDataTable
                        lang={lang}
                        columns={infographicColumns}
                        rows={productionRows}
                        csvFilename={`${infographicDownloadTitle}.csv`}
                        docx={{
                            filename: `${infographicDownloadTitle}.docx`,
                            title: exportInfographicTableTitle,
                            titleAlign: 'center',
                            columnWidths: [900, 1800, 1800, 1600],
                            fontSize: 20,
                        }}
                        caption={infographicTableCaption}
                        tableAriaLabel={infographicTableCaption}
                        renderCell={(raw, { column }) => {
                            if (column?.key === 'year') return String(raw ?? '');
                            if (column?.key === 'oilSandsMmbd') return formatMmbd(raw, 1);
                            return formatPct(raw, 0);
                        }}
                    />
                </div>

                <h2 className="oil-sands-section-title oil-sands-section-title--after-infographic">{getText('oil_sands_upgrading_title', lang)}</h2>
                <div className="oil-sands-text">
                    <ul>
                        <li>{substitute(getText('oil_sands_bullet_1', lang), textVars)}</li>
                        <li>
                            {substitute(getText('oil_sands_bullet_2_prefix', lang), textVars)}
                            <strong>{formatPctDisplay(selectedRow?.upgradingPct, 0)}</strong>
                            {getText('oil_sands_bullet_2_suffix', lang)}
                        </li>
                        <li>{substitute(getText('oil_sands_bullet_3', lang), textVars)}</li>
                        <li>
                            {getText('oil_sands_bullet_4_prefix', lang)}
                            <strong>{formatMmbdDisplay(selectedRow?.upgradingCapacityMmbd, 1)}</strong>
                            {getText('oil_sands_bullet_4_suffix', lang)}
                        </li>
                        <li>{getText('oil_sands_bullet_5', lang)}</li>
                    </ul>
                </div>

                <div className="oil-sands-table-wrapper">
                    <ChartDataTable
                        lang={lang}
                        columns={tableColumns}
                        rows={productionRows}
                        csvFilename={`${fileSlugBase}.csv`}
                        docx={{
                            filename: `${fileSlugBase}.docx`,
                            title: exportTableTitle,
                            titleAlign: 'center',
                            columnWidths: [900, 1300, 1300, 1300, 1200, 1200, 1200, 1100],
                            fontSize: 20,
                        }}
                        caption={tableCaption}
                        tableAriaLabel={tableCaption}
                        renderCell={(raw, { column }) => {
                            if (column?.key === 'year') return String(raw ?? '');
                            if (column?.key === 'sharePct') return formatPct(raw, 0);
                            if (column?.key?.endsWith('Mmbd')) return formatMmbd(raw, 1);
                            return formatNumber(raw, 1);
                        }}
                    />
                </div>
            </div>
        </PageShell>
    );
};

export default OilSandsProduction;
