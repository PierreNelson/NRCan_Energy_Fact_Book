import React, { useState, useEffect, useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import YearSelect from '../components/YearSelect';
import { useOutletContext } from 'react-router-dom';
import { getEconomicContributionsData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import economicContributionsBgEn from '../assets/economic_contributions_bg.svg';
import economicContributionsBgFr from '../assets/economic_contributions_bg_fr.svg';

/**
 * Page 26 SR pattern (same as page 21 EnergyInformationLandscape):
 * - Fetch the text-editable SVG once and inline it (aria-hidden)
 * - On year change, mutate the SVG's <tspan> nodes in the live DOM
 * - Each text chunk is a separate focusable role="region" with aria-label
 */

const svgTemplateCache = new Map();

async function loadSvgTemplate(url) {
    if (svgTemplateCache.has(url)) return svgTemplateCache.get(url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load SVG (${res.status})`);
    const text = await res.text();
    if (!text.includes('<svg') && !text.includes('<SVG')) {
        throw new Error('SVG template response was not SVG markup');
    }
    svgTemplateCache.set(url, text);
    return text;
}

function asNumber(val, fallback = 0) {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
}

function formatJobsVisual(val, preCalcThousands, lang) {
    const k = asNumber(preCalcThousands, asNumber(val) / 1000);
    const n = k.toFixed(1);
    return lang === 'fr' ? n.replace('.', ',') : n;
}

function formatBillionsVisual(val, preCalcBillions, lang) {
    const b = asNumber(preCalcBillions, asNumber(val) / 1000);
    const n = b.toFixed(1);
    if (lang === 'fr') {
        return `${n.replace('.', ',')} milliards de dollars`;
    }
    return `$${n} billion`;
}

function formatBillionsShortFr(val, preCalcBillions) {
    const b = asNumber(preCalcBillions, asNumber(val) / 1000).toFixed(1).replace('.', ',');
    return `${b} milliards de`;
}

function goldTspans(el) {
    return [...(el?.querySelectorAll('tspan') || [])].filter((t) => {
        const fill = (t.getAttribute('fill') || '').trim().toLowerCase();
        return fill === '#9f8950';
    });
}

/** Pin editable columns to the SVG edges (= page left/right anchors when the graphic is full-bleed of the content). */
function setTextColumnX(textEl, x, anchor = 'start') {
    if (!textEl) return;
    const xStr = String(x);
    textEl.setAttribute('x', xStr);
    textEl.setAttribute('text-anchor', anchor);
    textEl.querySelectorAll(':scope > tspan').forEach((tspan) => {
        if (tspan.hasAttribute('x')) tspan.setAttribute('x', xStr);
    });
}

function alignEditableTextToAnchors(svgRoot) {
    if (!svgRoot) return;
    const vb = svgRoot.viewBox?.baseVal;
    const w = vb?.width || 1074;
    const texts = [...svgRoot.querySelectorAll('#editable-text > text')];
    if (texts.length < 4) return;
    setTextColumnX(texts[0], 0, 'start');
    setTextColumnX(texts[1], w / 2, 'middle');
    setTextColumnX(texts[2], w, 'end');
    setTextColumnX(texts[3], 0, 'start');
}

/** Mutate live SVG <tspan> nodes for the selected year (text-editable SVG). */
function applyValuesToSvgElement(svgRoot, lang, year, data) {
    if (!svgRoot || !data) return false;
    const texts = [...svgRoot.querySelectorAll('text')];
    if (texts.length < 4) return false;

    const jobsN = formatJobsVisual(data.jobs, data.jobs_thousands, lang);
    const income = formatBillionsVisual(
        data.employment_income,
        data.employment_income_billions,
        lang,
    );
    const gdp = formatBillionsVisual(data.gdp, data.gdp_billions, lang);
    const investment = formatBillionsVisual(
        data.investment_value,
        data.investment_value_billions,
        lang,
    );
    const gdpShortFr = formatBillionsShortFr(data.gdp, data.gdp_billions);

    if (lang === 'fr') {
        const g0 = goldTspans(texts[0]);
        if (g0[0]) g0[0].textContent = `${jobsN} k`;
        const g1 = goldTspans(texts[1]);
        if (g1[0]) g1[0].textContent = income;
        const g2 = goldTspans(texts[2]);
        if (g2[0]) g2[0].textContent = gdpShortFr;
        const g3 = goldTspans(texts[3]);
        if (g3[0]) g3[0].textContent = investment;
    } else {
        const g0 = goldTspans(texts[0]);
        if (g0[0]) g0[0].textContent = `${jobsN} k jobs`;
        const g1 = goldTspans(texts[1]);
        if (g1[0]) g1[0].textContent = income;
        const g2 = goldTspans(texts[2]);
        if (g2[0]) g2[0].textContent = gdp;
        const g3 = goldTspans(texts[3]);
        if (g3[0]) g3[0].textContent = investment;
    }

    // Replace years in text nodes only. Setting tspan.textContent on a parent
    // that wraps the gold value would flatten the nested <tspan> and drop fill/size.
    const yearRe = lang === 'fr' ? /\ben \d{4}\b/g : /\bin \d{4}\b/g;
    const yearText = lang === 'fr' ? `en ${year}` : `in ${year}`;
    const walker = document.createTreeWalker(svgRoot, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach((node) => {
        const prev = node.nodeValue || '';
        const next = prev.replace(yearRe, yearText);
        if (next !== prev) node.nodeValue = next;
    });

    return true;
}

function buildChunkLabels(lang, year, data) {
    const jobsN = formatJobsVisual(data.jobs, data.jobs_thousands, lang);
    const income = formatBillionsVisual(
        data.employment_income,
        data.employment_income_billions,
        lang,
    );
    const gdp = formatBillionsVisual(data.gdp, data.gdp_billions, lang);
    const investment = formatBillionsVisual(
        data.investment_value,
        data.investment_value_billions,
        lang,
    );

    if (lang === 'fr') {
        return [
            `soutenu ${jobsN} k emplois`,
            `généré des revenus d'emploi de ${income}`,
            `et ${gdp} de PIB en ${year} (contributions directes et indirectes).`,
            `Les investissements publics et privés dans les infrastructures de carburant, d'énergie et de pipeline en ${year} étaient de ${investment} (valeur nominale).`,
        ];
    }

    return [
        `supported ${jobsN} k jobs`,
        `generated ${income} in employment income`,
        `and ${gdp} in GDP in ${year} (direct and indirect contributions).`,
        `Public and private investment in fuel, energy and pipeline infrastructure in ${year} was ${investment} (nominal).`,
    ];
}

const EconomicContributions = () => {
    const { lang } = useOutletContext();
    const [year, setYear] = useState(null);
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [svgReady, setSvgReady] = useState(false);
    const assetUrl = lang === 'fr' ? economicContributionsBgFr : economicContributionsBgEn;
    const svgHostRef = useRef(null);

    useEffect(() => {
        getEconomicContributionsData()
            .then((data) => {
                setPageData(data);
                if (data && data.length > 0) {
                    setYear(data[data.length - 1].year);
                }
            })
            .catch((err) => {
                console.error('Failed to load economic contributions data:', err);
                setError(err.message || 'Failed to load data');
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    const minYear = pageData.length > 0 ? Number(pageData[0].year) : 2007;
    const maxYear = pageData.length > 0 ? Number(pageData[pageData.length - 1].year) : 2024;

    const yearsList = useMemo(
        () => Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i),
        [minYear, maxYear],
    );

    const yearsDesc = useMemo(
        () => [...yearsList].sort((a, b) => b - a),
        [yearsList],
    );

    const currentYearData = useMemo(() => {
        if (!pageData?.length || year == null) return null;
        const y = Number(year);
        return pageData.find((d) => Number(d.year) === y) || pageData[pageData.length - 1];
    }, [year, pageData]);

    // Inline the text-editable SVG once the page chrome is mounted.
    useEffect(() => {
        if (loading || error) return undefined;

        let cancelled = false;
        setSvgReady(false);

        const mountSvg = (markup) => {
            const host = svgHostRef.current;
            if (!host) return false;
            host.innerHTML = markup;
            const svg = host.querySelector('svg');
            if (!svg) return false;

            svg.setAttribute('width', '100%');
            svg.removeAttribute('height');
            svg.style.display = 'block';
            svg.style.height = 'auto';
            svg.style.maxWidth = 'none';
            svg.setAttribute('focusable', 'false');
            svg.setAttribute('aria-hidden', 'true');

            // Design file had editable text at fill-opacity=0 (invisible); PNG held
            // the visible numerals. Make live <text> visible and cover the baked
            // PNG text bands so year updates show on screen.
            const editable = svg.querySelector('#editable-text');
            if (editable) {
                editable.setAttribute('fill-opacity', '1');
                editable.querySelectorAll('text, tspan').forEach((node) => {
                    node.setAttribute('fill-opacity', '1');
                });
            }

            // Left / centre / right / footer → page content anchors (SVG is full content width).
            alignEditableTextToAnchors(svg);

            const image = svg.querySelector('image');
            if (image && editable && !svg.querySelector('#econ-png-text-cover')) {
                const vb = svg.viewBox?.baseVal;
                const w = vb?.width || 1074;
                const h = vb?.height || 613;
                const ns = 'http://www.w3.org/2000/svg';
                const coverGroup = document.createElementNS(ns, 'g');
                coverGroup.setAttribute('id', 'econ-png-text-cover');
                coverGroup.setAttribute('aria-hidden', 'true');
                const bands = [
                    [0, 0, w, Math.round(h * 0.34)],
                    [0, Math.round(h * 0.86), w, Math.ceil(h * 0.14)],
                ];
                bands.forEach(([x, y, bw, bh]) => {
                    const rect = document.createElementNS(ns, 'rect');
                    rect.setAttribute('x', String(x));
                    rect.setAttribute('y', String(y));
                    rect.setAttribute('width', String(bw));
                    rect.setAttribute('height', String(bh));
                    rect.setAttribute('fill', '#ffffff');
                    coverGroup.appendChild(rect);
                });
                editable.parentNode.insertBefore(coverGroup, editable);
            }

            return true;
        };

        loadSvgTemplate(assetUrl)
            .then((markup) => {
                if (cancelled) return;
                if (mountSvg(markup)) {
                    setSvgReady(true);
                    return;
                }
                // Host may not be committed yet on the first ready frame.
                requestAnimationFrame(() => {
                    if (cancelled) return;
                    if (mountSvg(markup)) setSvgReady(true);
                });
            })
            .catch((err) => {
                console.error('Economic contributions SVG load failed:', err);
            });

        return () => {
            cancelled = true;
        };
    }, [assetUrl, loading, error]);

    // Live-update SVG <tspan> text when the year (or data) changes.
    useEffect(() => {
        if (!svgReady || !currentYearData || year == null || !svgHostRef.current) return;
        const svg = svgHostRef.current.querySelector('svg');
        if (!svg) return;
        applyValuesToSvgElement(svg, lang, Number(year), currentYearData);
    }, [svgReady, lang, year, currentYearData]);

    const pageTitle = getText('economic_contributions_title', lang);
    const exportTableTitle = stripHtml(pageTitle);
    const tableCaption = lang === 'en'
        ? 'Economic contributions of fuel, energy and pipeline infrastructure'
        : 'Contributions économiques des infrastructures de carburant, d\'énergie et de pipelines';
    const csvFilename = lang === 'en'
        ? 'economic_contributions_data.csv'
        : 'contributions_economiques_donnees.csv';
    const docxFilename = lang === 'en'
        ? 'economic_contributions_table.docx'
        : 'contributions_economiques_tableau.docx';

    const tableColumns = useMemo(() => [
        { key: 'year', header: lang === 'en' ? 'Year' : 'Année', align: 'left' },
        {
            key: 'jobs',
            header: lang === 'en' ? 'Jobs (thousands)' : 'Emplois (milliers)',
            align: 'num',
        },
        {
            key: 'employment_income',
            header: lang === 'en' ? 'Employment income ($ billions)' : 'Revenu d\'emploi (milliards $)',
            align: 'num',
        },
        {
            key: 'gdp',
            header: lang === 'en' ? 'GDP ($ billions)' : 'PIB (milliards $)',
            align: 'num',
        },
        {
            key: 'investment',
            header: lang === 'en' ? 'Investment ($ billions)' : 'Investissement (milliards $)',
            align: 'num',
        },
    ], [lang]);

    const tableRows = useMemo(() => {
        if (!pageData?.length) return [];
        const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
        const fmt1 = (n) => n.toLocaleString(locale, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
        });
        return pageData.map((yearData) => ({
            year: yearData.year,
            jobs: fmt1(yearData.jobs_thousands ?? (yearData.jobs / 1000)),
            employment_income: fmt1(
                yearData.employment_income_billions ?? (yearData.employment_income / 1000),
            ),
            gdp: fmt1(yearData.gdp_billions ?? (yearData.gdp / 1000)),
            investment: fmt1(
                yearData.investment_value_billions ?? (yearData.investment_value / 1000),
            ),
        }));
    }, [pageData, lang]);

    const chunkLabels = useMemo(() => {
        if (!currentYearData || year === null) return [];
        return buildChunkLabels(lang, year, currentYearData);
    }, [lang, year, currentYearData]);

    if (loading || error) {
        return (
            <PageStatus
                lang={lang}
                loading={loading}
                error={error}
                style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
            />
        );
    }

    if (!currentYearData || year === null) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                No data available. Please refresh the page.
            </div>
        );
    }

    const topChunks = chunkLabels.slice(0, 3);
    const footerChunk = chunkLabels[3];

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-26 economic-contributions-main page-chrome"
            aria-labelledby="economic-contributions-title"
            style={{
                backgroundColor: 'white',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',
            }}
        >
            <style>{`
.wb-inv {
    clip: rect(1px, 1px, 1px, 1px);
    height: 1px;
    margin: 0;
    overflow: hidden;
    position: absolute;
    width: 1px;
    white-space: nowrap;
}
.economic-contributions-main {
    width: 100%;
}
.economic-contributions-inner {
    width: 100%;
    padding: 15px 0 40px 0;
    box-sizing: border-box;
}
.economic-contributions-main.page-content h1.economic-contributions-title {
    font-family: var(--font-heading);
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 25px 0;
    line-height: 1.2;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: none;
}
.economic-contributions-main.page-content h1.economic-contributions-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.economic-contributions-year-row {
    margin: 0 0 16px 0;
}
.economic-contributions-graphic {
    position: relative;
    width: 100%;
    margin: 0;
}
.economic-contributions-graphic-svg,
.economic-contributions-graphic-svg svg {
    width: 100%;
    height: auto;
    display: block;
    max-width: none;
}
.economic-contributions-graphic-img {
    width: 100%;
    height: auto;
    display: block;
    max-width: none;
}
/* Hit targets match left / centre / right text columns. The right column has an extra line. */
.economic-contributions-chunks-top {
    position: absolute;
    top: 0;
    left: 0;
    right: -10px;
    height: 28%;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    column-gap: 0.5%;
    align-items: start;
    box-sizing: border-box;
}
.economic-contributions-chunks-top .economic-contributions-chunk:nth-child(1),
.economic-contributions-chunks-top .economic-contributions-chunk:nth-child(2) {
    height: 78%;
}
.economic-contributions-chunk.economic-contributions-chunk-footer {
    position: absolute;
    left: -8px;
    right: 0;
    top: auto;
    bottom: -6px;
    height: 8%;
    width: auto;
}
.economic-contributions-chunk.economic-contributions-chunk-footer.is-fr {
    height: 13%;
}
.economic-contributions-chunk {
    min-width: 0;
    min-height: 0;
    height: 100%;
    border-radius: 2px;
    box-sizing: border-box;
}
.economic-contributions-chunk:focus,
.economic-contributions-chunk:focus-visible {
    outline: 3px solid #ffbf47;
    outline-offset: 2px;
}
.economic-contributions-data-table-wrapper {
    position: relative;
    z-index: 2;
    margin-top: 20px;
    margin-bottom: 20px;
    width: 100%;
}
@media (max-width: 768px) {
    .economic-contributions-main.page-content h1.economic-contributions-title {
        font-size: 37px;
    }
}
@media (max-width: 480px) {
    .economic-contributions-main.page-content h1.economic-contributions-title {
        font-size: 28px;
    }
}
            `}</style>

            <div className="economic-contributions-inner">
                <h1 id="economic-contributions-title" className="economic-contributions-title">
                    {pageTitle}
                </h1>

                <div className="economic-contributions-year-row">
                    <YearSelect
                        lang={lang}
                        id="economic-contributions-year-select"
                        label={getText('year_slider_label', lang)}
                        years={yearsDesc}
                        value={year}
                        onChange={setYear}
                    />
                    <div role="status" className="wb-inv" aria-live="polite">
                        {year
                            ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${year}`
                            : ''}
                    </div>
                </div>

                <div className="economic-contributions-graphic">
                    <div
                        ref={svgHostRef}
                        className="economic-contributions-graphic-svg"
                        aria-hidden="true"
                    />
                    <div className="economic-contributions-chunks-top">
                        {topChunks.map((label, i) => (
                            <div
                                key={`econ-chunk-${i}`}
                                className="economic-contributions-chunk"
                                role="region"
                                aria-label={label}
                                tabIndex={0}
                                data-chunk-index={i}
                            />
                        ))}
                    </div>
                    <div
                        className={`economic-contributions-chunk economic-contributions-chunk-footer${lang === 'fr' ? ' is-fr' : ''}`}
                        role="region"
                        aria-label={footerChunk}
                        tabIndex={0}
                        data-chunk-index={3}
                    />
                </div>

                <div className="economic-contributions-data-table-wrapper">
                    <ChartDataTable
                        lang={lang}
                        columns={tableColumns}
                        rows={tableRows}
                        csvFilename={csvFilename}
                        docx={{
                            filename: docxFilename,
                            title: exportTableTitle,
                            titleAlign: 'center',
                            columnWidths: [1400, 1900, 1900, 1900, 1900],
                            fontSize: 22,
                        }}
                        caption={tableCaption}
                        tableAriaLabel={tableCaption}
                    />
                </div>
            </div>
        </PageShell>
    );
};

export default EconomicContributions;
