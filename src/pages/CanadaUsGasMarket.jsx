import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import AccessibleInfographic from '../components/AccessibleInfographic';
import ChartDataTable from '../components/ChartDataTable';
import PageFootnotes from '../components/PageFootnotes';
import PageShell from '../components/PageShell';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import { formatLocaleNumber } from '../utils/formatLocale';
import { resolveAccessibleInfographicGraphic, svgElementToCanvas } from '../utils/downloadInfographicPng';
import { makeScrollToIdHandler } from '../utils/scrollToId';
import infographicEn from '../assets/canada_us_natural_gas_market.svg?raw';
import infographicFr from '../assets/canada_us_natural_gas_market_fr.svg?raw';
import { summarizeCanadaUsGasMarket } from './canadaUsGasMarketData';

const FN = 'fn1-canada-us-gas-market';
const FN_CANADA = 'fn1-rf-canada-us-gas-market';
const FN_US = 'fn1-us-rf-canada-us-gas-market';

/** Fallback slots in the cropped viewBox, used until the SVG is measured. */
const CANADA_FALLBACK = {
    en: { left: ((351.41 - 72) / 905) * 100, top: ((359.37 - 30 - 8) / 607) * 100 },
    fr: { left: ((395.26 - 76) / 852) * 100, top: ((360.84 - 21 - 8) / 566) * 100 },
};
const US_FALLBACK = {
    en: { left: ((351.41 - 72) / 905) * 100, top: ((558.37 - 30 - 8) / 607) * 100 },
    fr: { left: ((395.26 - 76) / 852) * 100, top: ((522.84 - 21 - 8) / 566) * 100 },
};

const fill = (template, vars) => String(template || '').replace(
    /\{\{(\w+)\}\}/g,
    (_, key) => (vars[key] != null ? String(vars[key]) : ''),
);

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

const formatVolume = (value, lang, digits) => formatLocaleNumber(value, lang, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
});

const CanadaUsGasMarket = () => {
    const { lang, layoutPadding } = useOutletContext();
    const infographicRef = useRef(null);
    const stats = useMemo(() => summarizeCanadaUsGasMarket(), []);
    const num = useCallback((value, digits) => formatVolume(value, lang, digits), [lang]);
    const fileSlug = fill(getText('canada_us_gas_market_csv', lang), { year: stats.year });
    const chartTitle = fill(getText('canada_us_gas_market_chart_title', lang), { year: stats.year });
    const [canadaPos, setCanadaPos] = useState(CANADA_FALLBACK[lang] || CANADA_FALLBACK.en);
    const [usPos, setUsPos] = useState(US_FALLBACK[lang] || US_FALLBACK.en);

    const figures = useMemo(() => ({
        productionBcfd: num(stats.productionBcfd, 1),
        productionBcmd: num(stats.productionBcmd, 2),
        canadaBcfd: num(stats.canadaBcfd, 1),
        canadaBcmd: num(stats.canadaBcmd, 2),
        canadaConv: num(stats.canadaConventionalPct, 0),
        canadaUnconv: num(stats.canadaUnconventionalPct, 0),
        usBcfd: num(stats.usBcfd, 1),
        usBcmd: num(stats.usBcmd, 2),
        usConv: num(stats.usConventionalPct, 0),
        usUnconv: num(stats.usUnconventionalPct, 0),
        lngImportCanada: num(stats.lngImportCanadaMmcfd, 0),
        lngImportUs: num(stats.lngImportUsMmcfd, 0),
        lngExportCanada: num(stats.lngExportCanadaMmcfd, 0),
        lngExportUs: num(stats.lngExportUsMmcfd, 0),
    }), [num, stats]);

    const svgMarkup = useMemo(() => {
        const source = lang === 'fr' ? infographicFr : infographicEn;
        const pairs = [
            ['production', figures.productionBcfd],
            ['conversion', figures.productionBcmd],
            ['canada-total', figures.canadaBcfd],
            ['canada-bcm', figures.canadaBcmd],
            ['canada-conventional', figures.canadaConv],
            ['canada-unconventional', figures.canadaUnconv],
            ['us-total', figures.usBcfd],
            ['us-bcm', figures.usBcmd],
            ['us-conventional', figures.usConv],
            ['us-unconventional', figures.usUnconv],
            ['lng-import-canada', figures.lngImportCanada],
            ['lng-import-us', figures.lngImportUs],
            ['lng-export-canada', figures.lngExportCanada],
            ['lng-export-us', figures.lngExportUs],
        ];
        return pairs.reduce((markup, [id, value]) => replaceSvgText(markup, id, value), source);
    }, [figures, lang]);

    const label = fill(getText('canada_us_gas_market_label', lang), {
        year: stats.year,
        ...figures,
    });

    useLayoutEffect(() => {
        const measure = () => {
            const svg = resolveAccessibleInfographicGraphic(infographicRef.current);
            if (!svg) return;
            const svgRect = svg.getBoundingClientRect();
            if (!svgRect.width || !svgRect.height) return;
            const place = (id) => {
                const el = svg.querySelector(`[id$="${id}"]`);
                if (!el) return null;
                const rect = el.getBoundingClientRect();
                if (!rect.width && !rect.height) return null;
                return {
                    left: ((rect.left - svgRect.left) / svgRect.width) * 100,
                    top: ((rect.top - svgRect.top) / svgRect.height) * 100,
                };
            };
            const canada = place('canada-asterisk');
            const us = place('us-asterisk');
            if (canada) setCanadaPos(canada);
            if (us) setUsPos(us);
        };
        measure();
        const svg = resolveAccessibleInfographicGraphic(infographicRef.current);
        if (!svg) return undefined;
        const observer = new ResizeObserver(measure);
        observer.observe(svg);
        return () => observer.disconnect();
    }, [svgMarkup, lang]);

    const columns = useMemo(() => ([
        { key: 'item', header: getText('canada_us_gas_market_col_item', lang), align: 'left' },
        { key: 'value', header: getText('canada_us_gas_market_col_value', lang), align: 'right' },
        { key: 'unit', header: getText('canada_us_gas_market_col_unit', lang), align: 'left' },
    ]), [lang]);

    const unit = useCallback((key) => getText(`canada_us_gas_market_unit_${key}`, lang), [lang]);

    const rows = useMemo(() => ([
        ['production_bcfd', figures.productionBcfd, unit('bcfd')],
        ['production_bcmd', figures.productionBcmd, unit('bcmd')],
        ['canada_bcfd', figures.canadaBcfd, unit('bcfd')],
        ['canada_bcmd', figures.canadaBcmd, unit('bcmd')],
        ['canada_conventional', figures.canadaConv, '%'],
        ['canada_unconventional', figures.canadaUnconv, '%'],
        ['us_bcfd', figures.usBcfd, unit('bcfd')],
        ['us_bcmd', figures.usBcmd, unit('bcmd')],
        ['us_conventional', figures.usConv, '%'],
        ['us_unconventional', figures.usUnconv, '%'],
        ['lng_import_canada', figures.lngImportCanada, unit('mmcfd')],
        ['lng_import_us', figures.lngImportUs, unit('mmcfd')],
        ['lng_export_canada', figures.lngExportCanada, unit('mmcfd')],
        ['lng_export_us', figures.lngExportUs, unit('mmcfd')],
    ].map(([key, value, rowUnit]) => ({
        item: getText(`canada_us_gas_market_row_${key}`, lang),
        value,
        unit: rowUnit,
    }))), [figures, lang, unit]);

    const downloadInfographicPng = useCallback(async () => {
        const graphic = resolveAccessibleInfographicGraphic(infographicRef.current);
        if (!graphic) return;
        const clone = graphic.cloneNode(true);
        clone.querySelectorAll('[id$="canada-asterisk"], [id$="us-asterisk"]').forEach((node) => {
            node.textContent = '*';
        });
        const canvas = await svgElementToCanvas(clone, { scale: 2 });
        if (!canvas) return;
        const titled = document.createElement('canvas');
        const ctx = titled.getContext('2d');
        const titleHeight = chartTitle ? 110 : 0;
        titled.width = canvas.width;
        titled.height = canvas.height + titleHeight;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, titled.width, titled.height);
        if (chartTitle) {
            ctx.fillStyle = '#333333';
            ctx.textAlign = 'center';
            let fontSize = 36;
            ctx.font = `bold ${fontSize}px Arial`;
            while (fontSize > 18 && ctx.measureText(chartTitle).width > titled.width - 48) {
                fontSize -= 2;
                ctx.font = `bold ${fontSize}px Arial`;
            }
            ctx.fillText(chartTitle, titled.width / 2, 56);
        }
        ctx.drawImage(canvas, 0, titleHeight);
        const intro = getText('canada_us_gas_market_intro', lang);
        if (intro) {
            const boxWidth = canvas.width * 0.44;
            const wrapLines = (context, copy, maxWidth) => {
                const words = copy.split(/\s+/);
                const lines = [];
                let line = '';
                words.forEach((word) => {
                    const next = line ? `${line} ${word}` : word;
                    if (context.measureText(next).width > maxWidth && line) {
                        lines.push(line);
                        line = word;
                    } else {
                        line = next;
                    }
                });
                if (line) lines.push(line);
                return lines;
            };
            let fontSize = Math.max(16, Math.round(canvas.width * 0.016));
            ctx.textAlign = 'left';
            ctx.fillStyle = '#333333';
            ctx.font = `${fontSize}px "Noto Sans", Arial, sans-serif`;
            let lines = wrapLines(ctx, intro, boxWidth);
            const maxHeight = canvas.height * 0.38;
            while (lines.length * fontSize * 1.45 > maxHeight && fontSize > 12) {
                fontSize -= 1;
                ctx.font = `${fontSize}px "Noto Sans", Arial, sans-serif`;
                lines = wrapLines(ctx, intro, boxWidth);
            }
            let textY = titleHeight + fontSize * 1.7;
            lines.forEach((row) => {
                ctx.fillText(row, canvas.width * 0.012, textY);
                textY += fontSize * 1.45;
            });
        }
        const blob = await new Promise((resolve) => titled.toBlob(resolve, 'image/png'));
        if (blob) saveAs(blob, `${fileSlug}.png`);
    }, [chartTitle, fileSlug, lang]);

    const scrollToFootnote = useMemo(() => makeScrollToIdHandler(FN), []);
    const footnoteLabel = lang === 'fr' ? 'Note de bas de page ' : 'Footnote ';

    return (
        <PageShell
            className="page-content page-125 canada-us-gas-market page-chrome page-chrome--bleed"
            aria-labelledby="canada-us-gas-market-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.canada-us-gas-market.page-content {
    max-width: none !important;
    overflow-x: visible !important;
}
.canada-us-gas-market.page-content h1.page-chrome-title {
    margin-bottom: 0;
}
.canada-us-gas-market-stage {
    position: relative;
    container-type: inline-size;
    width: 100%;
    margin: 0 0 8px 0;
}
.canada-us-gas-market-intro {
    position: absolute;
    z-index: 2;
    left: 0;
    top: 0;
    width: 46%;
    margin: 0;
    font-family: 'Noto Sans', sans-serif;
    font-size: clamp(13px, 1.55cqw, 18px);
    line-height: 1.45;
    color: var(--gc-text, #333);
}
.canada-us-gas-market-figure {
    position: relative;
    margin: 0;
    width: 100%;
}
.canada-us-gas-market-figure .accessible-infographic-svg svg {
    width: 100%;
    height: auto;
    display: block;
}
.canada-us-gas-market-figure svg [id$="canada-asterisk"],
.canada-us-gas-market-figure svg [id$="us-asterisk"] {
    opacity: 0;
}
.canada-us-gas-market-figure .fn-lnk.canada-us-gas-market-fn {
    position: absolute;
    z-index: 3;
    margin: 0;
    vertical-align: baseline;
    height: auto;
    min-height: 1.1rem;
    line-height: 1.1rem;
}
.canada-us-gas-market-download-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin: 8px 0 4px 0;
}
.canada-us-gas-market-download-buttons button {
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
.canada-us-gas-market-download-buttons button:hover,
.canada-us-gas-market-download-buttons button:focus {
    background-color: #404040;
}
            `}</style>
            <h1 id="canada-us-gas-market-title" className="page-chrome-title">
                {getText('canada_us_gas_market_title', lang)}
            </h1>
            <div className="canada-us-gas-market-stage">
            <p className="canada-us-gas-market-intro">
                {getText('canada_us_gas_market_intro', lang)}
            </p>
            <AccessibleInfographic
                ref={infographicRef}
                as="figure"
                mode="text"
                className="canada-us-gas-market-figure"
                label={label}
                svgMarkup={svgMarkup}
                idPrefix={lang === 'fr' ? 'canada-us-market-fr' : 'canada-us-market-en'}
            >
                <a
                    id={FN_CANADA}
                    className="fn-lnk canada-us-gas-market-fn"
                    href={`#${FN}`}
                    onClick={scrollToFootnote}
                    style={{ left: `${canadaPos.left}%`, top: `${canadaPos.top}%` }}
                >
                    <span className="wb-inv">{footnoteLabel}</span>
                    <span aria-hidden="true">*</span>
                </a>
                <a
                    id={FN_US}
                    className="fn-lnk canada-us-gas-market-fn"
                    href={`#${FN}`}
                    onClick={scrollToFootnote}
                    style={{ left: `${usPos.left}%`, top: `${usPos.top}%` }}
                >
                    <span className="wb-inv">{footnoteLabel}</span>
                    <span aria-hidden="true">*</span>
                </a>
            </AccessibleInfographic>
            </div>
            <div className="canada-us-gas-market-download-buttons">
                <button type="button" onClick={downloadInfographicPng}>
                    {getText('canada_us_gas_market_download_png', lang)}
                </button>
            </div>
            <ChartDataTable
                lang={lang}
                columns={columns}
                rows={rows}
                csvFilename={`${fileSlug}.csv`}
                docx={{
                    filename: `${fileSlug}.docx`,
                    title: chartTitle,
                    titleAlign: 'center',
                    columnWidths: [6200, 1600, 1800],
                    fontSize: 20,
                }}
                caption={chartTitle}
                tableAriaLabel={getText('canada_us_gas_market_table_summary', lang)}
            />
            <PageFootnotes
                lang={lang}
                titleId="fn-canada-us-gas-market"
                items={[
                    {
                        id: FN,
                        marker: '*',
                        text: getText('canada_us_gas_market_footnote', lang),
                        returnHref: `#${FN_CANADA}`,
                    },
                ]}
            />
        </PageShell>
    );
};

export default CanadaUsGasMarket;
