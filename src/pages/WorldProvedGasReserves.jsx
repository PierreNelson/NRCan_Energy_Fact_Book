import React, { useMemo, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import YearSelect from '../components/YearSelect';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import worldNaturalGasProvedReservesBgUrl from '../assets/world_natural_gas_proved_reserves_bg.png';

const CANADA_CAPSULE = '#423330';

/** World proved natural gas reserves: top five + Canada rank/share by year (placeholder series). */
const DATA_BY_YEAR = {
    2020: {
        totalTcf: 7320,
        totalTcm: 207,
        top: [
            { key: 'russia', pct: 24 },
            { key: 'iran', pct: 15 },
            { key: 'qatar', pct: 12 },
            { key: 'usa', pct: 7 },
            { key: 'turkmenistan', pct: 5 }
        ],
        canada: { rank: 11, pct: 2.8 }
    },
    2021: {
        totalTcf: 7400,
        totalTcm: 209,
        top: [
            { key: 'russia', pct: 23 },
            { key: 'iran', pct: 15 },
            { key: 'qatar', pct: 12 },
            { key: 'usa', pct: 7 },
            { key: 'turkmenistan', pct: 5 }
        ],
        canada: { rank: 11, pct: 2.9 }
    },
    2022: {
        totalTcf: 7480,
        totalTcm: 211,
        top: [
            { key: 'russia', pct: 23 },
            { key: 'iran', pct: 16 },
            { key: 'qatar', pct: 11 },
            { key: 'usa', pct: 8 },
            { key: 'turkmenistan', pct: 5 }
        ],
        canada: { rank: 10, pct: 2.9 }
    },
    2023: {
        totalTcf: 7550,
        totalTcm: 213,
        top: [
            { key: 'russia', pct: 22 },
            { key: 'iran', pct: 16 },
            { key: 'qatar', pct: 11 },
            { key: 'usa', pct: 8 },
            { key: 'turkmenistan', pct: 5 }
        ],
        canada: { rank: 10, pct: 3 }
    },
    2024: {
        totalTcf: 7604,
        totalTcm: 215,
        top: [
            { key: 'russia', pct: 22 },
            { key: 'iran', pct: 16 },
            { key: 'qatar', pct: 11 },
            { key: 'usa', pct: 8 },
            { key: 'turkmenistan', pct: 5 }
        ],
        canada: { rank: 10, pct: 3 }
    }
};

const YEAR_KEYS = Object.keys(DATA_BY_YEAR)
    .map(Number)
    .sort((a, b) => a - b);
const YEARS_ASC = YEAR_KEYS;
const YEARS_DESC = [...YEAR_KEYS].reverse();
const world_gas_reserves_DEFAULT_YEAR = YEAR_KEYS[YEAR_KEYS.length - 1];

const RESERVE_COLUMN_KEYS = ['russia', 'iran', 'qatar', 'usa', 'turkmenistan', 'canada'];

const pctFromBundle = (bundle, key) => {
    if (key === 'canada') return bundle.canada.pct;
    const it = bundle.top.find((i) => i.key === key);
    return it != null ? it.pct : '';
};

const formatCapsulePct = (pct, lang) => {
    const dec = pct % 1 === 0 ? 0 : 1;
    return Number(pct).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec
    });
};

const pctWithUnit = (pct, lang) => {
    const s = formatCapsulePct(pct, lang);
    return lang === 'en' ? `${s}%` : `${s}\u00a0%`;
};

const formatReserveTotal = (n, lang) =>
    n.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { maximumFractionDigits: 0 });

const tablePctCell = (v, lang) => {
    if (v === '' || v == null) return '\u2014';
    return formatCapsulePct(v, lang);
};

const WorldProvedGasReserves = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [year, setYear] = useState(world_gas_reserves_DEFAULT_YEAR);

    const countryLabel = (key) =>
        key === 'turkmenistan'
            ? getText('world_gas_reserves_country_turkmenistan', lang)
            : getText(`natural_gas_international_country_${key}`, lang);

    const bundle = DATA_BY_YEAR[year] || DATA_BY_YEAR[world_gas_reserves_DEFAULT_YEAR];
    const yearSpanLabel = `${YEARS_ASC[0]}\u2013${YEARS_ASC[YEARS_ASC.length - 1]}`;

    const tableCaption = getText('world_gas_reserves_table_caption', lang);
    const exportTableTitle = `${stripHtml(getText('world_gas_reserves_doc_title', lang))} (${yearSpanLabel})`;
    const fileSlugBase = lang === 'en'
        ? 'world_natural_gas_proved_reserves'
        : 'reserves_prouvees_gaz_naturel';

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('crude_oil_international_table_col_year', lang), align: 'left' },
        { key: 'totalTcf', header: getText('world_gas_reserves_table_col_total_tcf', lang), align: 'num' },
        { key: 'totalTcm', header: getText('world_gas_reserves_table_col_total_tcm', lang), align: 'num' },
        ...RESERVE_COLUMN_KEYS.map((k) => ({
            key: k,
            header: `${countryLabel(k)} (%)`,
            align: 'num',
        })),
    ], [lang]);

    const tableRows = useMemo(
        () =>
            YEARS_ASC.map((y) => {
                const b = DATA_BY_YEAR[y];
                const row = {
                    year: y,
                    totalTcf: b.totalTcf,
                    totalTcm: b.totalTcm,
                };
                RESERVE_COLUMN_KEYS.forEach((k) => {
                    row[k] = pctFromBundle(b, k);
                });
                return row;
            }),
        [],
    );

    const capsuleAriaParts = [
        ...bundle.top.map((row, i) => {
            const r = i + 1;
            const nm = countryLabel(row.key);
            return lang === 'en'
                ? `Rank ${r}, ${nm}, ${formatCapsulePct(row.pct, lang)} percent`
                : `Rang ${r}, ${nm}, ${formatCapsulePct(row.pct, lang)} pour cent`;
        }),
        lang === 'en'
            ? `Rank ${bundle.canada.rank}, ${countryLabel('canada')}, ${formatCapsulePct(bundle.canada.pct, lang)} percent`
            : `Rang ${bundle.canada.rank}, ${countryLabel('canada')}, ${formatCapsulePct(bundle.canada.pct, lang)} pour cent`
    ];
    const capsuleAria =
        (lang === 'en'
            ? `World proved natural gas reserves for ${year}: `
            : `Réserves mondiales prouvées de gaz naturel pour ${year} : `) +
        capsuleAriaParts.join('. ') +
        '.';

    const renderCapsuleRow = (rank, key, pct, maxPct, isCanada) => {
        const rawRatio = maxPct > 0 ? pct / maxPct : 1;
        const barWidthPct = 70 + 20 * rawRatio;
        const name = countryLabel(key);
        return (
            <div
                key={`${key}-${rank}-${isCanada ? 'ca' : 'top'}-${year}`}
                className={`crude-oil-international-capsule-row ${isCanada ? 'crude-oil-international-capsule-row-canada' : ''}`}
            >
                <div className="crude-oil-international-capsule-bar-wrap">
                    <div className="crude-oil-international-capsule-bar" style={{ width: `${barWidthPct}%` }}>
                        <span className="crude-oil-international-capsule-bar-text">
                            {rank} {name}
                        </span>
                    </div>
                </div>
                <div className="crude-oil-international-capsule-connector" />
                <div className="crude-oil-international-capsule-pill">
                    <span className="crude-oil-international-capsule-pill-text">{pctWithUnit(pct, lang)}</span>
                </div>
            </div>
        );
    };

    const renderCapsuleBlock = () => {
        const maxPct = bundle.top[0]?.pct || 1;
        const els = bundle.top.map((row, index) =>
            renderCapsuleRow(index + 1, row.key, row.pct, maxPct, false)
        );
        els.push(
            <div key="ellipsis" className="crude-oil-international-capsule-row world-natural-gas-proved-reserves-capsule-ellipsis" aria-hidden="true">
                <span>...</span>
            </div>
        );
        els.push(renderCapsuleRow(bundle.canada.rank, 'canada', bundle.canada.pct, maxPct, true));
        return els;
    };

    return (
        <PageShell tabIndex="-1"
            className="page-content page-108 page-123 world-natural-gas-proved-reserves-natural-gas-reserves page-chrome page-chrome--bleed"
            aria-labelledby="world-natural-gas-proved-reserves-main-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
                .page-123.page-content {
                    max-width: none !important;
                    overflow-x: visible !important;
                }
                .page-123.world-natural-gas-proved-reserves-natural-gas-reserves {
                }
                .page-123.page-content h1.world-natural-gas-proved-reserves-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 41px !important;
                    font-weight: bold;
                    color: var(--gc-text);
                    margin-top: 0;
                    margin-bottom: 25px;
                    position: relative;
                    padding-bottom: 0.5em;
                    line-height: 1.2;
                }
                .page-123.page-content h1.world-natural-gas-proved-reserves-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }
                .world-natural-gas-proved-reserves-capsule-ellipsis {
                    display: flex;
                    align-items: center;
                    min-height: 40px;
                    padding-left: 12%;
                    font-size: 24px !important;
                    color: #333;
                    font-family: 'Noto Sans', sans-serif;
                }
                .world-natural-gas-proved-reserves-chart-block .data-table-wrapper {
                    margin-bottom: 0;
                }
                .world-natural-gas-proved-reserves-hero-stack {
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    margin-top: 10px;
                    margin-bottom: 10px;
                }
                .world-natural-gas-proved-reserves-rankings-layer {
                    z-index: 2;
                    position: relative;
                    width: 50%;
                    min-width: 360px;
                    max-width: 500px;
                    padding-top: 10px;
                }
                .world-natural-gas-proved-reserves-art-layer {
                    z-index: 1;
                    position: relative;
                    width: 100%;
                    margin-top: -200px;
                    pointer-events: none;
                }
                .world-natural-gas-proved-reserves-art-layer img {
                    width: 100%;
                    height: auto;
                    display: block;
                }
                .world-natural-gas-proved-reserves-natural-gas-reserves .crude-oil-international-capsule-bar {
                    min-width: max-content !important;
                    padding-right: 14px !important;
                }
                .world-natural-gas-proved-reserves-natural-gas-reserves .crude-oil-international-capsule-bar-text {
                    white-space: nowrap !important;
                    font-size: 16px !important;
                }
                .world-natural-gas-proved-reserves-natural-gas-reserves .crude-oil-international-capsule-pill-text {
                    font-size: 16px !important;
                }
                @media (max-width: 1100px) {
                    .world-natural-gas-proved-reserves-art-layer { margin-top: -120px; }
                }
                /* Stacked layout: viewport width must exceed this after zoom (browsers often keep
                   layout width high on wide monitors — 900px was too low; ~1500px targets ~175% on 1080p–1440p). */
                @media (max-width: 1500px) {
                    .world-natural-gas-proved-reserves-rankings-layer {
                        width: 100%;
                        max-width: 100%;
                        padding-bottom: 20px;
                    }
                    .world-natural-gas-proved-reserves-art-layer {
                        margin-top: 0;
                    }
                }
                @media (max-width: 768px) {
                    .page-123.page-content h1.world-natural-gas-proved-reserves-title {
                        font-size: 37px !important;
                    }
                }
                .page-123.world-natural-gas-proved-reserves-natural-gas-reserves .crude-oil-international-capsule-row-canada .crude-oil-international-capsule-bar {
                    background-color: ${CANADA_CAPSULE};
                    color: #fff;
                }
                .page-123.world-natural-gas-proved-reserves-natural-gas-reserves .crude-oil-international-capsule-row-canada .crude-oil-international-capsule-connector {
                    background-color: ${CANADA_CAPSULE};
                }
                .page-123.world-natural-gas-proved-reserves-natural-gas-reserves .crude-oil-international-capsule-row-canada .crude-oil-international-capsule-pill {
                    border-width: 2px;
                    border-color: ${CANADA_CAPSULE};
                    font-weight: bold;
                }
            `}</style>

            <div className="crude-oil-international-container">
                <header>
                    <h1 id="world-natural-gas-proved-reserves-main-title" className="world-natural-gas-proved-reserves-title">
                        {getText('world_gas_reserves_title', lang)}
                    </h1>
                </header>

                <YearSelect
                    lang={lang}
                    id="world-proved-gas-reserves-year-select"
                    label={getText('year_slider_label', lang)}
                    years={YEARS_DESC}
                    value={year}
                    onChange={setYear}
                />
                    <div role="status" className="wb-inv" aria-live="polite">
                        {year
                            ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${year}`
                            : ''}
                    </div>

                <div className="crude-oil-international-content-wrapper layout-stacked world-natural-gas-proved-reserves-chart-block">
                    <div className="world-natural-gas-proved-reserves-hero-stack">
                        <div className="world-natural-gas-proved-reserves-rankings-layer crude-oil-international-chart-section">
                            <h3 className="crude-oil-international-graphic-title" tabIndex="0">
                                    {getText('coal_international_reserves_kicker', lang)}
                                    {' \u2013 '}
                                    <strong>
                                        {formatReserveTotal(bundle.totalTcf, lang)} {getText('world_gas_reserves_unit_tcf', lang)}
                                    </strong>
                                    {' '}
                                    ({formatReserveTotal(bundle.totalTcm, lang)} {getText('world_gas_reserves_unit_tcm', lang)})
                                    {' '}
                                    ({year})
                            </h3>

                            <div className="crude-oil-international-chart-container" role="region" aria-label={capsuleAria} tabIndex="0">
                                <div className="crude-oil-international-capsule-graphic" aria-hidden="true">
                                    {renderCapsuleBlock()}
                                </div>
                            </div>
                        </div>

                        <div className="world-natural-gas-proved-reserves-art-layer" aria-hidden="true">
                            <img
                                src={worldNaturalGasProvedReservesBgUrl}
                                alt=""
                                width={2000}
                                height={933}
                                decoding="async"
                            />
                        </div>
                    </div>

                    <ChartDataTable
                        lang={lang}
                        columns={tableColumns}
                        rows={tableRows}
                        csvFilename={`${fileSlugBase}.csv`}
                        docx={{
                            filename: `${fileSlugBase}.docx`,
                            title: exportTableTitle,
                            titleAlign: 'center',
                            columnWidths: [1200, 1400, 1400, ...RESERVE_COLUMN_KEYS.map(() => 1280)],
                            fontSize: 22,
                        }}
                        caption={tableCaption}
                        tableAriaLabel={tableCaption}
                        renderCell={(raw, { column }) => {
                            const key = column?.key;
                            if (key === 'year') return String(raw ?? '');
                            if (key === 'totalTcf' || key === 'totalTcm') return formatReserveTotal(Number(raw), lang);
                            return tablePctCell(raw, lang);
                        }}
                    />
                </div>
            </div>
        </PageShell>
    );
};

export default WorldProvedGasReserves;
