import React, { useRef } from 'react';
import { saveAs } from 'file-saver';
import AccessibleInfographic from '../components/AccessibleInfographic';
import ChartDataTable from '../components/ChartDataTable';
import PageShell from '../components/PageShell';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import { formatLocaleNumber } from '../utils/formatLocale';
import { resolveAccessibleInfographicGraphic, svgElementToCanvas } from '../utils/downloadInfographicPng';
import infographicEn from '../assets/page128en_final_fixed.svg?raw';
import infographicFr from '../assets/page128fr_final_fixed.svg?raw';
import { CANADA_US_GAS_TRADE } from './canadaUsGasTradeData';

const BULLET_KEYS = [
    'canada_us_gas_trade_bullet_1',
    'canada_us_gas_trade_bullet_2',
    'canada_us_gas_trade_bullet_3',
    'canada_us_gas_trade_bullet_4',
    'canada_us_gas_trade_bullet_5',
];

const fill = (template, vars) => String(template || '').replace(
    /\{\{(\w+)\}\}/g,
    (_, key) => (vars[key] != null ? String(vars[key]) : ''),
);

const INFOGRAPHIC_VIEWBOX = {
    en: '0 40 1002 1373',
    fr: '37 40 977 1353',
};

const cropViewBox = (markup, viewBox) => markup.replace(/viewBox="[^"]+"/, `viewBox="${viewBox}"`);

const replaceSvgText = (markup, id, value) => {
    const safe = String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return markup.replace(
        new RegExp(`(<text\\b[^>]*\\bid="${id}"[^>]*>)[\\s\\S]*?(</text>)`),
        `$1${safe}$2`,
    );
};

const CanadaUsGasTrade = () => {
    const { lang, layoutPadding } = useOutletContext();
    const figureRef = useRef(null);
    const stats = CANADA_US_GAS_TRADE;
    const textVars = { year: stats.year };

    const formatShare = (value, greaterThan = false) => {
        const number = formatLocaleNumber(value, lang, { maximumFractionDigits: 0 });
        const body = lang === 'fr' ? `${number} %` : `${number}%`;
        return greaterThan ? `>${body}` : body;
    };
    const formatBillion = formatLocaleNumber(stats.netExportBillion, lang, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });
    const netExportText = lang === 'fr'
        ? `${formatBillion} milliards de dollars`
        : `$${formatBillion} billion`;
    const yearText = `${stats.year}.`;
    const yearPhrase = lang === 'fr' ? `en ${stats.year}.` : `in ${stats.year}.`;

    const chartTitle = fill(getText('canada_us_gas_trade_chart_title', lang), textVars);
    const fileSlug = fill(getText('canada_us_gas_trade_slug', lang), textVars);

    const svgSource = cropViewBox(
        lang === 'fr' ? infographicFr : infographicEn,
        lang === 'fr' ? INFOGRAPHIC_VIEWBOX.fr : INFOGRAPHIC_VIEWBOX.en,
    );
    const svgMarkup = [
        ['export-share', formatShare(stats.exportSharePct)],
        ['export-year', yearText],
        ['us-import-share', formatShare(stats.usImportSharePct, true)],
        ['us-consumption-share', formatShare(stats.usConsumptionSharePct)],
        ['net-export-value', netExportText],
        ['net-export-year', yearPhrase],
        ['import-share', formatShare(stats.canadaImportSharePct)],
        ['consumption-share', formatShare(stats.canadaConsumptionSharePct)],
    ].reduce((markup, [id, value]) => replaceSvgText(markup, id, value), svgSource);

    const bullets = BULLET_KEYS.map((key) => fill(getText(key, lang), textVars));

    const rows = [
        ['export_share', formatShare(stats.exportSharePct), '%'],
        ['us_import_share', formatShare(stats.usImportSharePct, true), '%'],
        ['us_consumption_share', formatShare(stats.usConsumptionSharePct), '%'],
        ['net_exports', formatBillion, getText('canada_us_gas_trade_unit_billion', lang)],
        ['import_share', formatShare(stats.canadaImportSharePct), '%'],
        ['consumption_share', formatShare(stats.canadaConsumptionSharePct), '%'],
    ].map(([key, value, unit]) => ({
        item: getText(`canada_us_gas_trade_row_${key}`, lang),
        value,
        unit,
    }));

    const label = fill(getText('canada_us_gas_trade_label', lang), {
        ...textVars,
        exportShare: formatShare(stats.exportSharePct),
        usImportShare: formatShare(stats.usImportSharePct, true),
        usConsumptionShare: formatShare(stats.usConsumptionSharePct),
        netExports: netExportText,
        importShare: formatShare(stats.canadaImportSharePct),
        consumptionShare: formatShare(stats.canadaConsumptionSharePct),
    });

    const downloadInfographicPng = async () => {
        const graphic = resolveAccessibleInfographicGraphic(figureRef.current);
        if (!graphic) return;
        const canvas = await svgElementToCanvas(graphic, { scale: 2 });
        if (!canvas) return;
        const titled = document.createElement('canvas');
        const ctx = titled.getContext('2d');
        const titleHeight = 110;
        titled.width = canvas.width;
        titled.height = canvas.height + titleHeight;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, titled.width, titled.height);
        ctx.fillStyle = '#333333';
        ctx.textAlign = 'center';
        let fontSize = 36;
        ctx.font = `bold ${fontSize}px Arial`;
        while (fontSize > 18 && ctx.measureText(chartTitle).width > titled.width - 48) {
            fontSize -= 2;
            ctx.font = `bold ${fontSize}px Arial`;
        }
        ctx.fillText(chartTitle, titled.width / 2, 56);
        ctx.drawImage(canvas, 0, titleHeight);
        const blob = await new Promise((resolve) => titled.toBlob(resolve, 'image/png'));
        if (blob) saveAs(blob, `${fileSlug}.png`);
    };

    return (
        <PageShell
            className="page-content page-128 canada-us-gas-trade page-chrome page-chrome--bleed"
            aria-labelledby="canada-us-gas-trade-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
                .canada-us-gas-trade.page-content {
                    max-width: none !important;
                    overflow-x: visible !important;
                }
                .canada-us-gas-trade-layout {
                    display: grid;
                    grid-template-columns: minmax(280px, 1fr) minmax(280px, 1fr);
                    gap: 28px 36px;
                    align-items: start;
                }
                .canada-us-gas-trade-layout > .canada-us-gas-trade-figure {
                    margin-top: 0.15em;
                }
                .canada-us-gas-trade-bullets {
                    margin: 0;
                    padding-left: 1.2em;
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    line-height: 1.55;
                    color: var(--gc-text, #333);
                }
                .canada-us-gas-trade-bullets li + li { margin-top: 0.85em; }
                .canada-us-gas-trade-figure { margin: 0; width: 100%; }
                .canada-us-gas-trade-figure .accessible-infographic-svg svg {
                    width: 100%;
                    height: auto;
                    display: block;
                }
                .canada-us-gas-trade-download-buttons {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                    margin: 12px 0 4px;
                }
                .canada-us-gas-trade-download-buttons button {
                    padding: 8px 16px;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    background: #8C8C8C;
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-size: 14px;
                    font-weight: bold;
                    color: #ffffff;
                }
                .canada-us-gas-trade-download-buttons button:hover,
                .canada-us-gas-trade-download-buttons button:focus {
                    background-color: #404040;
                }
                .wb-inv {
                    position: absolute !important;
                    width: 1px;
                    height: 1px;
                    margin: -1px;
                    overflow: hidden;
                    clip: rect(0, 0, 0, 0);
                }
                @media (max-width: 800px) {
                    .canada-us-gas-trade-layout { grid-template-columns: 1fr; }
                    .canada-us-gas-trade-bullets { font-size: 18px; }
                }
            `}</style>

            <h1 id="canada-us-gas-trade-title" className="wb-inv">
                {fill(getText('canada_us_gas_trade_title', lang), textVars)}
            </h1>
            <div className="canada-us-gas-trade-layout">
                <ul className="canada-us-gas-trade-bullets">
                    {bullets.map((text) => <li key={text}>{text}</li>)}
                </ul>
                <AccessibleInfographic
                    ref={figureRef}
                    mode="text"
                    as="figure"
                    className="canada-us-gas-trade-figure"
                    idPrefix={lang === 'fr' ? 'canada-us-gas-trade-fr' : 'canada-us-gas-trade-en'}
                    label={label}
                    svgMarkup={svgMarkup}
                />
            </div>
            <div className="canada-us-gas-trade-download-buttons">
                <button type="button" onClick={downloadInfographicPng}>
                    {getText('canada_us_gas_trade_download_png', lang)}
                </button>
            </div>
            <ChartDataTable
                lang={lang}
                columns={[
                    { key: 'item', header: getText('canada_us_gas_trade_col_item', lang) },
                    { key: 'value', header: getText('canada_us_gas_trade_col_value', lang) },
                    { key: 'unit', header: getText('canada_us_gas_trade_col_unit', lang) },
                ]}
                rows={rows}
                csvFilename={`${fileSlug}.csv`}
                docx={{
                    filename: `${fileSlug}.docx`,
                    title: chartTitle,
                    titleAlign: 'center',
                    columnWidths: [6200, 1600, 2200],
                    fontSize: 20,
                }}
                caption={fill(getText('canada_us_gas_trade_caption', lang), textVars)}
                tableAriaLabel={fill(getText('canada_us_gas_trade_caption', lang), textVars)}
            />
        </PageShell>
    );
};

export default CanadaUsGasTrade;
