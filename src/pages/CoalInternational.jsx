import React, { useMemo, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import YearSelect from '../components/YearSelect';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';

const COUNTRY_KEY_MAP = {
    usa: 'crude_oil_international_country_usa',
    russia: 'crude_oil_international_country_russia',
    canada: 'crude_oil_international_country_canada',
    china: 'natural_gas_international_country_china',
    australia: 'natural_gas_international_country_australia',
    india: 'coal_international_country_india',
    indonesia: 'coal_international_country_indonesia'
};

const DATA_BY_YEAR = {
    2020: {
        reserves: {
            total: 1128.0,
            top: [
                { key: 'usa', pct: 23 },
                { key: 'russia', pct: 15 },
                { key: 'china', pct: 13 },
                { key: 'australia', pct: 12 },
                { key: 'india', pct: 10 }
            ],
            canada: { rank: 20, pct: 1.2 }
        },
        production: {
            total: 7.85,
            top: [
                { key: 'china', pct: 48 },
                { key: 'india', pct: 11 },
                { key: 'indonesia', pct: 10 },
                { key: 'australia', pct: 6 },
                { key: 'usa', pct: 6 }
            ],
            canada: { rank: 15, pct: 0.4 }
        },
        exports: {
            total: 1.22,
            top: [
                { key: 'indonesia', pct: 35 },
                { key: 'australia', pct: 24 },
                { key: 'russia', pct: 13 },
                { key: 'usa', pct: 7 }
            ],
            canada: { rank: 9, pct: 1.7 }
        }
    },
    2021: {
        reserves: {
            total: 1142.3,
            top: [
                { key: 'usa', pct: 22 },
                { key: 'russia', pct: 15 },
                { key: 'china', pct: 13 },
                { key: 'australia', pct: 13 },
                { key: 'india', pct: 11 }
            ],
            canada: { rank: 20, pct: 1.1 }
        },
        production: {
            total: 8.05,
            top: [
                { key: 'china', pct: 49 },
                { key: 'india', pct: 11 },
                { key: 'indonesia', pct: 10 },
                { key: 'australia', pct: 5 },
                { key: 'usa', pct: 5 }
            ],
            canada: { rank: 15, pct: 0.4 }
        },
        exports: {
            total: 1.32,
            top: [
                { key: 'indonesia', pct: 36 },
                { key: 'australia', pct: 24 },
                { key: 'russia', pct: 12 },
                { key: 'usa', pct: 7 }
            ],
            canada: { rank: 9, pct: 1.8 }
        }
    },
    2022: {
        reserves: {
            total: 1154.1,
            top: [
                { key: 'usa', pct: 22 },
                { key: 'russia', pct: 14 },
                { key: 'china', pct: 13 },
                { key: 'australia', pct: 13 },
                { key: 'india', pct: 11 }
            ],
            canada: { rank: 19, pct: 1.1 }
        },
        production: {
            total: 8.35,
            top: [
                { key: 'china', pct: 49 },
                { key: 'india', pct: 12 },
                { key: 'indonesia', pct: 9 },
                { key: 'australia', pct: 5 },
                { key: 'usa', pct: 5 }
            ],
            canada: { rank: 14, pct: 0.5 }
        },
        exports: {
            total: 1.38,
            top: [
                { key: 'indonesia', pct: 36 },
                { key: 'australia', pct: 24 },
                { key: 'russia', pct: 12 },
                { key: 'usa', pct: 7 }
            ],
            canada: { rank: 8, pct: 1.9 }
        }
    },
    2023: {
        reserves: {
            total: 1166.0,
            top: [
                { key: 'usa', pct: 21 },
                { key: 'russia', pct: 14 },
                { key: 'china', pct: 13 },
                { key: 'australia', pct: 13 },
                { key: 'india', pct: 11 }
            ],
            canada: { rank: 19, pct: 1 }
        },
        production: {
            total: 8.55,
            top: [
                { key: 'china', pct: 49 },
                { key: 'india', pct: 12 },
                { key: 'indonesia', pct: 9 },
                { key: 'australia', pct: 5 },
                { key: 'usa', pct: 5 }
            ],
            canada: { rank: 14, pct: 0.5 }
        },
        exports: {
            total: 1.42,
            top: [
                { key: 'indonesia', pct: 37 },
                { key: 'australia', pct: 24 },
                { key: 'russia', pct: 12 },
                { key: 'usa', pct: 7 }
            ],
            canada: { rank: 8, pct: 2 }
        }
    },
    2024: {
        reserves: {
            total: 1169.5,
            top: [
                { key: 'usa', pct: 21 },
                { key: 'russia', pct: 14 },
                { key: 'china', pct: 13 },
                { key: 'australia', pct: 13 },
                { key: 'india', pct: 11 }
            ],
            canada: { rank: 19, pct: 1 }
        },
        production: {
            total: 8.8,
            top: [
                { key: 'china', pct: 50 },
                { key: 'india', pct: 12 },
                { key: 'indonesia', pct: 9 },
                { key: 'australia', pct: 5 },
                { key: 'usa', pct: 5 }
            ],
            canada: { rank: 14, pct: 0.5 }
        },
        exports: {
            total: 1.5,
            top: [
                { key: 'indonesia', pct: 37 },
                { key: 'australia', pct: 24 },
                { key: 'russia', pct: 12 },
                { key: 'usa', pct: 7 }
            ],
            canada: { rank: 8, pct: 2 }
        }
    }
};

const YEAR_KEYS = Object.keys(DATA_BY_YEAR)
    .map(Number)
    .sort((a, b) => a - b);
const YEARS_ASC = YEAR_KEYS;
const YEARS_DESC = [...YEAR_KEYS].reverse();
const coal_international_DEFAULT_YEAR = YEAR_KEYS[YEAR_KEYS.length - 1];

const RESERVES_COLUMN_KEYS = ['usa', 'russia', 'china', 'australia', 'india', 'canada'];
const PRODUCTION_COLUMN_KEYS = ['china', 'india', 'indonesia', 'australia', 'usa', 'canada'];
const EXPORT_COLUMN_KEYS = ['indonesia', 'australia', 'russia', 'usa', 'canada'];

const countryName = (key, lang) => getText(COUNTRY_KEY_MAP[key], lang);

const pctFromReservesBundle = (bundle, key) => {
    if (key === 'canada') return bundle.canada.pct;
    const it = bundle.top.find((i) => i.key === key);
    return it != null ? it.pct : '';
};

const pctFromProdExportsTop = (bundle, key) => {
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

const formatBt = (n, lang) =>
    n.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

const CoalInternational = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [year, setYear] = useState(coal_international_DEFAULT_YEAR);

    const yearBundle = DATA_BY_YEAR[year] || DATA_BY_YEAR[2024];
    const reservesBlock = yearBundle.reserves;
    const productionBlock = yearBundle.production;
    const exportsBlock = yearBundle.exports;

    const yearSpanLabel = `${YEARS_ASC[0]}\u2013${YEARS_ASC[YEARS_ASC.length - 1]}`;

    const countryLabel = (key) => stripHtml(countryName(key, lang));

    const reservesCaption = getText('coal_international_table_caption_reserves', lang);
    const productionCaption = getText('coal_international_table_caption_production', lang);
    const exportsCaption = getText('coal_international_table_caption_exports', lang);
    const reservesTableTitle = `${stripHtml(getText('coal_international_doc_title_reserves', lang))} (${yearSpanLabel})`;
    const productionTableTitle = `${stripHtml(getText('coal_international_doc_title_production', lang))} (${yearSpanLabel})`;
    const exportsTableTitle = `${stripHtml(getText('coal_international_doc_title_exports', lang))} (${yearSpanLabel})`;

    const reservesTableColumns = useMemo(() => [
        { key: 'year', header: getText('crude_oil_international_table_col_year', lang), align: 'left' },
        { key: 'total', header: getText('coal_international_table_col_total', lang), align: 'num' },
        ...RESERVES_COLUMN_KEYS.map((k) => ({
            key: k,
            header: `${countryLabel(k)} (%)`,
            align: 'num',
        })),
    ], [lang]);

    const productionTableColumns = useMemo(() => [
        { key: 'year', header: getText('crude_oil_international_table_col_year', lang), align: 'left' },
        { key: 'total', header: getText('coal_international_table_col_total', lang), align: 'num' },
        ...PRODUCTION_COLUMN_KEYS.map((k) => ({
            key: k,
            header: `${countryLabel(k)} (%)`,
            align: 'num',
        })),
    ], [lang]);

    const exportTableColumns = useMemo(() => [
        { key: 'year', header: getText('crude_oil_international_table_col_year', lang), align: 'left' },
        { key: 'total', header: getText('coal_international_table_col_total', lang), align: 'num' },
        ...EXPORT_COLUMN_KEYS.map((k) => ({
            key: k,
            header: `${countryLabel(k)} (%)`,
            align: 'num',
        })),
    ], [lang]);

    const reservesTableRows = useMemo(
        () =>
            YEARS_ASC.map((y) => {
                const b = DATA_BY_YEAR[y].reserves;
                const row = { year: y, total: b.total };
                RESERVES_COLUMN_KEYS.forEach((k) => {
                    row[k] = pctFromReservesBundle(b, k);
                });
                return row;
            }),
        []
    );

    const productionTableRows = useMemo(
        () =>
            YEARS_ASC.map((y) => {
                const b = DATA_BY_YEAR[y].production;
                const row = { year: y, total: b.total };
                PRODUCTION_COLUMN_KEYS.forEach((k) => {
                    row[k] = pctFromProdExportsTop(b, k);
                });
                return row;
            }),
        []
    );

    const exportTableRows = useMemo(
        () =>
            YEARS_ASC.map((y) => {
                const b = DATA_BY_YEAR[y].exports;
                const row = { year: y, total: b.total };
                EXPORT_COLUMN_KEYS.forEach((k) => {
                    row[k] = pctFromProdExportsTop(b, k);
                });
                return row;
            }),
        []
    );

    const renderPctCell = (raw) => (raw === '' || raw == null ? '\u2014' : formatCapsulePct(raw, lang));

    const renderTableCell = (raw, { column }) => (
        column?.key === 'year' ? String(raw ?? '')
            : column?.key === 'total' ? formatBt(raw, lang)
                : renderPctCell(raw)
    );

    const reservesAria = useMemo(() => {
        const bundle = DATA_BY_YEAR[year].reserves;
        const parts = bundle.top.map((row, i) => {
            const r = i + 1;
            const nm = countryName(row.key, lang);
            return lang === 'en'
                ? `Rank ${r}, ${nm}, ${formatCapsulePct(row.pct, lang)} percent`
                : `Rang ${r}, ${nm}, ${formatCapsulePct(row.pct, lang)} pour cent`;
        });
        parts.push(
            lang === 'en'
                ? `Rank ${bundle.canada.rank}, Canada, ${formatCapsulePct(bundle.canada.pct, lang)} percent`
                : `Rang ${bundle.canada.rank}, Canada, ${formatCapsulePct(bundle.canada.pct, lang)} pour cent`
        );
        return (
            (lang === 'en' ? `World proved coal reserves ranking for ${year}: ` : `Classement des réserves prouvées de charbon pour ${year} : `) +
            parts.join('. ') +
            '.'
        );
    }, [lang, year]);

    const productionAria = useMemo(() => {
        const bundle = DATA_BY_YEAR[year].production;
        const parts = bundle.top.map((row, i) => {
            const r = i + 1;
            const nm = countryName(row.key, lang);
            return lang === 'en'
                ? `Rank ${r}, ${nm}, ${formatCapsulePct(row.pct, lang)} percent`
                : `Rang ${r}, ${nm}, ${formatCapsulePct(row.pct, lang)} pour cent`;
        });
        parts.push(
            lang === 'en'
                ? `Rank ${bundle.canada.rank}, Canada, ${formatCapsulePct(bundle.canada.pct, lang)} percent`
                : `Rang ${bundle.canada.rank}, Canada, ${formatCapsulePct(bundle.canada.pct, lang)} pour cent`
        );
        return (
            (lang === 'en' ? `World coal production ranking for ${year}: ` : `Classement de la production mondiale de charbon pour ${year} : `) +
            parts.join('. ') +
            '.'
        );
    }, [lang, year]);

    const exportsAria = useMemo(() => {
        const bundle = DATA_BY_YEAR[year].exports;
        const parts = bundle.top.map((row, i) => {
            const r = i + 1;
            const nm = countryName(row.key, lang);
            return lang === 'en'
                ? `Rank ${r}, ${nm}, ${formatCapsulePct(row.pct, lang)} percent`
                : `Rang ${r}, ${nm}, ${formatCapsulePct(row.pct, lang)} pour cent`;
        });
        parts.push(
            lang === 'en'
                ? `Rank ${bundle.canada.rank}, Canada, ${formatCapsulePct(bundle.canada.pct, lang)} percent`
                : `Rang ${bundle.canada.rank}, Canada, ${formatCapsulePct(bundle.canada.pct, lang)} pour cent`
        );
        return (
            (lang === 'en' ? `World coal exports ranking for ${year}: ` : `Classement des exportations mondiales de charbon pour ${year} : `) +
            parts.join('. ') +
            '.'
        );
    }, [lang, year]);

    const renderCapsuleRow = (rank, key, pct, maxPct, isCanada) => {
        const rawRatio = maxPct > 0 ? pct / maxPct : 1;
        const barWidthPct = 62 + 18 * rawRatio;
        const name = countryName(key, lang);
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

    const renderCapsuleBlock = (topRows, canadaRow) => {
        const maxPct = topRows[0]?.pct || 1;
        const els = topRows.map((row, index) =>
            renderCapsuleRow(index + 1, row.key, row.pct, maxPct, false)
        );
        els.push(
            <div key="ellipsis" className="crude-oil-international-capsule-row coal-international-capsule-ellipsis" aria-hidden="true">
                <span>...</span>
            </div>
        );
        els.push(renderCapsuleRow(canadaRow.rank, 'canada', canadaRow.pct, maxPct, true));
        return els;
    };

    const billionTonnes = getText('coal_international_billion_tonnes', lang);

    return (
        <PageShell id="main-content"
            tabIndex="-1"
            className="page-content page-108 coal-international-coal-international page-chrome page-chrome--bleed"
            role="main"
            aria-labelledby="coal-international-main-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
                .page-108.coal-international-coal-international {
                }
                .coal-international-capsule-ellipsis {
                    display: flex;
                    align-items: center;
                    min-height: 40px;
                    padding-left: 12%;
                    font-size: 22px;
                    color: #333;
                    font-family: 'Noto Sans', sans-serif;
                }
            `}</style>

            <div className="crude-oil-international-container">
                <header>
                    <h1 id="coal-international-main-title" className="crude-oil-international-title">
                        {getText('coal_international_title', lang)}
                    </h1>
                    <p className="crude-oil-international-subtitle">{getText('coal_international_subtitle', lang)}</p>
                </header>

                <>
                    <YearSelect
                        lang={lang}
                        id="coal-international-year-select"
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

                    <div className="crude-oil-international-content-wrapper layout-stacked">
                        <div className="crude-oil-international-chart-section">
                            <h3 className="crude-oil-international-graphic-title">
                                <span aria-hidden="true">
                                    {getText('coal_international_reserves_kicker', lang)}
                                    {' \u2013 '}
                                    <strong>
                                        {formatBt(reservesBlock.total, lang)} {billionTonnes}
                                    </strong>
                                    {' '}
                                    ({year})
                                </span>
                            </h3>
                            <div className="crude-oil-international-chart-container" role="region" aria-label={reservesAria} tabIndex="0">
                                <div className="crude-oil-international-capsule-graphic" aria-hidden="true">
                                    {renderCapsuleBlock(reservesBlock.top, reservesBlock.canada)}
                                </div>
                            </div>
                            <ChartDataTable
                                lang={lang}
                                columns={reservesTableColumns}
                                rows={reservesTableRows}
                                csvFilename={lang === 'en' ? 'world_coal_proved_reserves.csv' : 'reserves_prouvees_charbon.csv'}
                                docx={{
                                    filename: lang === 'en' ? 'world_coal_proved_reserves.docx' : 'reserves_prouvees_charbon.docx',
                                    title: reservesTableTitle,
                                    titleAlign: 'center',
                                    columnWidths: [1200, 1600, ...RESERVES_COLUMN_KEYS.map(() => 1280)],
                                    fontSize: 22,
                                }}
                                caption={reservesCaption}
                                tableAriaLabel={reservesCaption}
                                renderCell={renderTableCell}
                            />
                        </div>

                        <div className="crude-oil-international-chart-section">
                            <h3 className="crude-oil-international-graphic-title">
                                <span aria-hidden="true">
                                    {getText('coal_international_production_kicker', lang)}
                                    {' \u2013 '}
                                    <strong>
                                        {formatBt(productionBlock.total, lang)} {billionTonnes}
                                    </strong>
                                    {' '}
                                    ({year})
                                </span>
                            </h3>
                            <div className="crude-oil-international-chart-container" role="region" aria-label={productionAria} tabIndex="0">
                                <div className="crude-oil-international-capsule-graphic" aria-hidden="true">
                                    {renderCapsuleBlock(productionBlock.top, productionBlock.canada)}
                                </div>
                            </div>
                            <ChartDataTable
                                lang={lang}
                                columns={productionTableColumns}
                                rows={productionTableRows}
                                csvFilename={lang === 'en' ? 'world_coal_production.csv' : 'production_mondiale_charbon.csv'}
                                docx={{
                                    filename: lang === 'en' ? 'world_coal_production.docx' : 'production_mondiale_charbon.docx',
                                    title: productionTableTitle,
                                    titleAlign: 'center',
                                    columnWidths: [1200, 1600, ...PRODUCTION_COLUMN_KEYS.map(() => 1280)],
                                    fontSize: 22,
                                }}
                                caption={productionCaption}
                                tableAriaLabel={productionCaption}
                                renderCell={renderTableCell}
                            />
                        </div>

                        <div className="crude-oil-international-chart-section">
                            <h3 className="crude-oil-international-graphic-title">
                                <span aria-hidden="true">
                                    {getText('coal_international_exports_kicker', lang)}
                                    {' \u2013 '}
                                    <strong>
                                        {formatBt(exportsBlock.total, lang)} {billionTonnes}
                                    </strong>
                                    {' '}
                                    ({year})
                                </span>
                            </h3>
                            <div className="crude-oil-international-chart-container" role="region" aria-label={exportsAria} tabIndex="0">
                                <div className="crude-oil-international-capsule-graphic" aria-hidden="true">
                                    {renderCapsuleBlock(exportsBlock.top, exportsBlock.canada)}
                                </div>
                            </div>
                            <ChartDataTable
                                lang={lang}
                                columns={exportTableColumns}
                                rows={exportTableRows}
                                csvFilename={lang === 'en' ? 'world_coal_exports.csv' : 'exportations_mondiales_charbon.csv'}
                                docx={{
                                    filename: lang === 'en' ? 'world_coal_exports.docx' : 'exportations_mondiales_charbon.docx',
                                    title: exportsTableTitle,
                                    titleAlign: 'center',
                                    columnWidths: [1200, 1600, ...EXPORT_COLUMN_KEYS.map(() => 1280)],
                                    fontSize: 22,
                                }}
                                caption={exportsCaption}
                                tableAriaLabel={exportsCaption}
                                renderCell={renderTableCell}
                            />
                        </div>
                    </div>
                </>
            </div>
        </PageShell>
    );
};

export default CoalInternational;
