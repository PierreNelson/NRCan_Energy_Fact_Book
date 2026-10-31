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
import infographicEn from '../assets/canada_us_natural_gas_resources.svg?raw';
import infographicFr from '../assets/canada_us_natural_gas_resources_fr.svg?raw';
import { summarizeCanadaUsGasResources } from './canadaUsGasResourcesData';

const fnDefId = (n) => `fn${n}-canada-us-gas-resources`;
const fnRefId = (n) => `fn${n}-rf-canada-us-gas-resources`;

/** Fallback slots in the cropped viewBox, used until the SVG is measured. */
const STAR_FALLBACK = {
    en: { left: ((207 - 15) / 1038) * 100, top: ((85 - 13) / 722) * 100 },
    fr: { left: ((244 - 33) / 971) * 100, top: ((123 - 12) / 684) * 100 },
};
const DOUBLE_FALLBACK = {
    en: { left: ((274 - 15) / 1038) * 100, top: ((165.61 - 32) / 722) * 100 },
    fr: { left: ((269 - 33) / 971) * 100, top: ((174.66 - 28) / 684) * 100 },
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

const displayYearSpan = (start, end, lang) => {
    if (start == null || end == null) return '';
    if (start === end) return String(start);
    return lang === 'fr' ? `${start} à ${end}` : `${start} to ${end}`;
};

const fileYearSpan = (start, end) => {
    if (start == null || end == null) return '';
    if (start === end) return String(start);
    return `${start}-${end}`;
};

const formatVolume = (value, lang) => formatLocaleNumber(value, lang, { maximumFractionDigits: 0 });

const CanadaUsGasResources = () => {
    const { lang, layoutPadding } = useOutletContext();
    const infographicRef = useRef(null);
    const stats = useMemo(() => summarizeCanadaUsGasResources(), []);
    const volume = useCallback((value) => formatVolume(value, lang), [lang]);
    const yearSpan = displayYearSpan(stats.startYear, stats.endYear, lang);
    const fileSlug = fill(getText('canada_us_gas_resources_csv', lang), {
        yearSpan: fileYearSpan(stats.startYear, stats.endYear),
    });
    const chartTitle = fill(getText('canada_us_gas_resources_chart_title', lang), { yearSpan });
    const [starPos, setStarPos] = useState(STAR_FALLBACK[lang] || STAR_FALLBACK.en);
    const [doublePos, setDoublePos] = useState(DOUBLE_FALLBACK[lang] || DOUBLE_FALLBACK.en);

    const svgMarkup = useMemo(() => {
        const source = lang === 'fr' ? infographicFr : infographicEn;
        const pairs = [
            ['proved_reserves_year', stats.provedYear],
            ['canada_proved', volume(stats.canadaProvedTcf)],
            ['united_states_proved', volume(stats.usProvedTcf)],
            ['proved_total', volume(stats.provedTotalTcf)],
            ['canada_2023', stats.canadaYear],
            ['canada_resources', volume(stats.canadaTotalTcf)],
            ['canada_conventional', volume(stats.canadaConventionalTcf)],
            ['canada_unconventional', volume(stats.canadaUnconventionalTcf)],
            ['world_2022', stats.worldYear],
            ['world_resources', volume(stats.worldTotalTcf)],
            ['world_conventional', volume(stats.worldConventionalTcf)],
            ['world_unconventional', volume(stats.worldUnconventionalTcf)],
            ['us_2020', stats.usYear],
            ['us_resources', volume(stats.usTotalTcf)],
            ['us_shale_tight', volume(stats.usShaleTightTcf)],
            ['us_other', volume(stats.usOtherTcf)],
        ];
        return pairs.reduce((markup, [id, value]) => replaceSvgText(markup, id, value), source);
    }, [lang, stats, volume]);

    const label = fill(getText('canada_us_gas_resources_label', lang), {
        provedYear: stats.provedYear,
        canadaProved: volume(stats.canadaProvedTcf),
        usProved: volume(stats.usProvedTcf),
        provedTotal: volume(stats.provedTotalTcf),
        canadaYear: stats.canadaYear,
        canadaTotal: volume(stats.canadaTotalTcf),
        canadaConv: volume(stats.canadaConventionalTcf),
        canadaUnconv: volume(stats.canadaUnconventionalTcf),
        worldYear: stats.worldYear,
        worldTotal: volume(stats.worldTotalTcf),
        worldConv: volume(stats.worldConventionalTcf),
        worldUnconv: volume(stats.worldUnconventionalTcf),
        usYear: stats.usYear,
        usTotal: volume(stats.usTotalTcf),
        usShale: volume(stats.usShaleTightTcf),
        usOther: volume(stats.usOtherTcf),
    });

    useLayoutEffect(() => {
        const measure = () => {
            const svg = resolveAccessibleInfographicGraphic(infographicRef.current);
            if (!svg) return;
            const svgRect = svg.getBoundingClientRect();
            if (!svgRect.width || !svgRect.height) return;
            const star = svg.querySelector('[id$="reserves_asterisk"]');
            const proved = svg.querySelector('[id$="canada_proved"]');
            if (star) {
                const rect = star.getBoundingClientRect();
                if (rect.width || rect.height) {
                    setStarPos({
                        left: ((rect.left - svgRect.left) / svgRect.width) * 100,
                        top: ((rect.top - svgRect.top) / svgRect.height) * 100,
                    });
                }
            }
            if (proved) {
                const rect = proved.getBoundingClientRect();
                if (rect.width) {
                    setDoublePos({
                        left: ((rect.right - svgRect.left + 4) / svgRect.width) * 100,
                        top: ((rect.top - svgRect.top) / svgRect.height) * 100,
                    });
                }
            }
        };
        measure();
        const svg = resolveAccessibleInfographicGraphic(infographicRef.current);
        if (!svg) return undefined;
        const observer = new ResizeObserver(measure);
        observer.observe(svg);
        return () => observer.disconnect();
    }, [svgMarkup, lang]);

    const columns = useMemo(() => ([
        { key: 'item', header: getText('canada_us_gas_resources_col_item', lang), align: 'left' },
        { key: 'year', header: getText('canada_us_gas_resources_col_year', lang), align: 'left' },
        { key: 'volume', header: getText('canada_us_gas_resources_col_volume', lang), align: 'right' },
    ]), [lang]);

    const rows = useMemo(() => ([
        ['canada_proved', stats.provedYear, stats.canadaProvedTcf],
        ['us_proved', stats.provedYear, stats.usProvedTcf],
        ['total_proved', stats.provedYear, stats.provedTotalTcf],
        ['canada_total', stats.canadaYear, stats.canadaTotalTcf],
        ['canada_conventional', stats.canadaYear, stats.canadaConventionalTcf],
        ['canada_unconventional', stats.canadaYear, stats.canadaUnconventionalTcf],
        ['world_total', stats.worldYear, stats.worldTotalTcf],
        ['world_conventional', stats.worldYear, stats.worldConventionalTcf],
        ['world_unconventional', stats.worldYear, stats.worldUnconventionalTcf],
        ['us_total', stats.usYear, stats.usTotalTcf],
        ['us_shale_tight', stats.usYear, stats.usShaleTightTcf],
        ['us_other', stats.usYear, stats.usOtherTcf],
    ].map(([key, year, amount]) => ({
        item: getText(`canada_us_gas_resources_row_${key}`, lang),
        year,
        volume: volume(amount),
    }))), [lang, stats, volume]);

    const downloadInfographicPng = useCallback(async () => {
        const graphic = resolveAccessibleInfographicGraphic(infographicRef.current);
        if (!graphic) return;
        const clone = graphic.cloneNode(true);
        const star = clone.querySelector('[id$="reserves_asterisk"]');
        if (star) star.textContent = '1';
        const proved = clone.querySelector('[id$="canada_proved"]');
        if (proved) proved.textContent = `${proved.textContent}2`;
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
        const blob = await new Promise((resolve) => titled.toBlob(resolve, 'image/png'));
        if (blob) saveAs(blob, `${fileSlug}.png`);
    }, [chartTitle, fileSlug]);

    const scrollToFirst = useMemo(() => makeScrollToIdHandler(fnDefId(1)), []);
    const scrollToSecond = useMemo(() => makeScrollToIdHandler(fnDefId(2)), []);

    return (
        <PageShell
            className="page-content page-124 canada-us-gas-resources page-chrome page-chrome--bleed"
            aria-labelledby="canada-us-gas-resources-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.canada-us-gas-resources.page-content {
    max-width: none !important;
    overflow-x: visible !important;
}
.canada-us-gas-resources.page-content h1.page-chrome-title {
    margin-bottom: 0;
    position: relative;
    z-index: 2;
    max-width: 48%;
}
.canada-us-gas-resources-figure {
    position: relative;
    z-index: 1;
    margin: 0 0 8px 0;
    width: 100%;
}
.canada-us-gas-resources-figure-en {
    margin-top: calc(-70 / 1038 * 100%);
}
.canada-us-gas-resources-figure-fr {
    margin-top: calc(-104 / 971 * 100%);
}
.canada-us-gas-resources-figure .accessible-infographic-svg svg {
    width: 100%;
    height: auto;
    display: block;
}
.canada-us-gas-resources-figure svg [id$="reserves_asterisk"] {
    opacity: 0;
}
.canada-us-gas-resources-figure .fn-lnk.canada-us-gas-resources-fn {
    position: absolute;
    z-index: 3;
    margin: 0;
    vertical-align: baseline;
    height: auto;
    min-height: 1.1rem;
    line-height: 1.1rem;
}
.canada-us-gas-resources-download-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin: 8px 0 4px 0;
}
.canada-us-gas-resources-download-buttons button {
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
.canada-us-gas-resources-download-buttons button:hover,
.canada-us-gas-resources-download-buttons button:focus {
    background-color: #404040;
}
            `}</style>
            <h1 id="canada-us-gas-resources-title" className="page-chrome-title">
                {getText('canada_us_gas_resources_title', lang)}
            </h1>
            <AccessibleInfographic
                ref={infographicRef}
                as="figure"
                mode="text"
                className={`canada-us-gas-resources-figure canada-us-gas-resources-figure-${lang}`}
                label={label}
                svgMarkup={svgMarkup}
                idPrefix={lang === 'fr' ? 'canada-us-gas-fr' : 'canada-us-gas-en'}
            >
                <a
                    id={fnRefId(1)}
                    className="fn-lnk canada-us-gas-resources-fn"
                    href={`#${fnDefId(1)}`}
                    onClick={scrollToFirst}
                    style={{ left: `${starPos.left}%`, top: `${starPos.top}%` }}
                >
                    <span className="wb-inv">{lang === 'fr' ? 'Note de bas de page ' : 'Footnote '}</span>
                    <span aria-hidden="true">1</span>
                </a>
                <a
                    id={fnRefId(2)}
                    className="fn-lnk canada-us-gas-resources-fn"
                    href={`#${fnDefId(2)}`}
                    onClick={scrollToSecond}
                    style={{ left: `${doublePos.left}%`, top: `${doublePos.top}%` }}
                >
                    <span className="wb-inv">{lang === 'fr' ? 'Note de bas de page ' : 'Footnote '}</span>
                    <span aria-hidden="true">2</span>
                </a>
            </AccessibleInfographic>
            <div className="canada-us-gas-resources-download-buttons">
                <button type="button" onClick={downloadInfographicPng}>
                    {getText('canada_us_gas_resources_download_png', lang)}
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
                    columnWidths: [5600, 1400, 2400],
                    fontSize: 20,
                }}
                caption={chartTitle}
                tableAriaLabel={getText('canada_us_gas_resources_table_summary', lang)}
            />
            <PageFootnotes
                lang={lang}
                titleId="fn-canada-us-gas-resources"
                items={[
                    {
                        id: fnDefId(1),
                        marker: '1',
                        text: getText('canada_us_gas_resources_footnote_star', lang),
                        returnHref: `#${fnRefId(1)}`,
                    },
                    {
                        id: fnDefId(2),
                        marker: '2',
                        text: getText('canada_us_gas_resources_footnote_double', lang),
                        returnHref: `#${fnRefId(2)}`,
                    },
                ]}
            />
        </PageShell>
    );
};

export default CanadaUsGasResources;
