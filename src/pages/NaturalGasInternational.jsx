import React, { useMemo, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import YearSelect from '../components/YearSelect';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';

const DATA_BY_YEAR = {
    2020: {
        production: {
            total: 398.2,
            bcm: 11.3,
            items: [
                { key: 'usa', pct: 24 },
                { key: 'russia', pct: 17 },
                { key: 'iran', pct: 6 },
                { key: 'china', pct: 6 },
                { key: 'canada', pct: 5 }
            ]
        },
        exports: {
            total: 112.4,
            bcm: 3.2,
            items: [
                { key: 'usa', pct: 17 },
                { key: 'russia', pct: 14 },
                { key: 'norway', pct: 11 },
                { key: 'qatar', pct: 9 },
                { key: 'australia', pct: 8 },
                { key: 'canada', pct: 7 }
            ]
        }
    },
    2021: {
        production: {
            total: 402.5,
            bcm: 11.4,
            items: [
                { key: 'usa', pct: 24 },
                { key: 'russia', pct: 17 },
                { key: 'iran', pct: 7 },
                { key: 'china', pct: 6 },
                { key: 'canada', pct: 5 }
            ]
        },
        exports: {
            total: 114.8,
            bcm: 3.25,
            items: [
                { key: 'usa', pct: 17 },
                { key: 'russia', pct: 14 },
                { key: 'norway', pct: 10 },
                { key: 'qatar', pct: 10 },
                { key: 'australia', pct: 8 },
                { key: 'canada', pct: 7 }
            ]
        }
    },
    2022: {
        production: {
            total: 406.8,
            bcm: 11.5,
            items: [
                { key: 'usa', pct: 25 },
                { key: 'russia', pct: 16 },
                { key: 'iran', pct: 7 },
                { key: 'china', pct: 6 },
                { key: 'canada', pct: 5 }
            ]
        },
        exports: {
            total: 116.5,
            bcm: 3.3,
            items: [
                { key: 'usa', pct: 18 },
                { key: 'russia', pct: 13 },
                { key: 'norway', pct: 10 },
                { key: 'qatar', pct: 10 },
                { key: 'australia', pct: 9 },
                { key: 'canada', pct: 7 }
            ]
        }
    },
    2023: {
        production: {
            total: 410.1,
            bcm: 11.6,
            items: [
                { key: 'usa', pct: 25 },
                { key: 'russia', pct: 16 },
                { key: 'iran', pct: 7 },
                { key: 'china', pct: 6 },
                { key: 'canada', pct: 5 }
            ]
        },
        exports: {
            total: 117.9,
            bcm: 3.35,
            items: [
                { key: 'usa', pct: 18 },
                { key: 'russia', pct: 13 },
                { key: 'norway', pct: 10 },
                { key: 'qatar', pct: 10 },
                { key: 'australia', pct: 9 },
                { key: 'canada', pct: 7 }
            ]
        }
    },
    2024: {
        production: {
            total: 413,
            bcm: 11.7,
            items: [
                { key: 'usa', pct: 25 },
                { key: 'russia', pct: 16 },
                { key: 'iran', pct: 7 },
                { key: 'china', pct: 6 },
                { key: 'canada', pct: 5 }
            ]
        },
        exports: {
            total: 119,
            bcm: 3.4,
            items: [
                { key: 'usa', pct: 18 },
                { key: 'russia', pct: 13 },
                { key: 'norway', pct: 10 },
                { key: 'qatar', pct: 10 },
                { key: 'australia', pct: 9 },
                { key: 'canada', pct: 7 }
            ]
        }
    }
};

const YEAR_KEYS = Object.keys(DATA_BY_YEAR)
    .map(Number)
    .sort((a, b) => a - b);
const YEARS_ASC = YEAR_KEYS;
const YEARS_DESC = [...YEAR_KEYS].reverse();
const natural_gas_international_DEFAULT_YEAR = YEAR_KEYS[YEAR_KEYS.length - 1];
const PRODUCTION_COLUMN_KEYS = ['usa', 'russia', 'iran', 'china', 'canada'];
const EXPORT_COLUMN_KEYS = ['usa', 'russia', 'norway', 'qatar', 'australia', 'canada'];

const pctForCountry = (items, key) => {
    const it = items.find((i) => i.key === key);
    return it != null ? Math.round(it.pct) : '';
};

const NaturalGasInternational = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [year, setYear] = useState(natural_gas_international_DEFAULT_YEAR);

    const formatVolume = (n) =>
        n.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    const yearBundle = DATA_BY_YEAR[year] || DATA_BY_YEAR[2024];
    const production = yearBundle.production;
    const exportsBlock = yearBundle.exports;
    const yearSpanLabel = `${YEARS_ASC[0]}\u2013${YEARS_ASC[YEARS_ASC.length - 1]}`;

    const countryLabel = (key) => stripHtml(getText(`natural_gas_international_country_${key}`, lang));

    const productionRows = useMemo(
        () =>
            production.items.map((row, index) => ({
                ...row,
                rank: index + 1,
                name: getText(`natural_gas_international_country_${row.key}`, lang),
                pctRounded: Math.round(row.pct)
            })),
        [production.items, lang]
    );

    const exportRows = useMemo(
        () =>
            exportsBlock.items.map((row, index) => ({
                ...row,
                rank: index + 1,
                name: getText(`natural_gas_international_country_${row.key}`, lang),
                pctRounded: Math.round(row.pct)
            })),
        [exportsBlock.items, lang]
    );

    const productionAria =
        lang === 'en'
            ? `World natural gas production ranking for ${year}: ${productionRows.map((r) => `Rank ${r.rank}, ${r.name}, ${r.pctRounded} percent`).join('. ')}.`
            : `Classement de la production mondiale de gaz naturel pour ${year}: ${productionRows.map((r) => `Rang ${r.rank}, ${r.name}, ${r.pctRounded} pour cent`).join('. ')}.`;

    const exportsAria =
        lang === 'en'
            ? `World natural gas exports ranking for ${year}: ${exportRows.map((r) => `Rank ${r.rank}, ${r.name}, ${r.pctRounded} percent`).join('. ')}.`
            : `Classement des exportations mondiales de gaz naturel pour ${year}: ${exportRows.map((r) => `Rang ${r.rank}, ${r.name}, ${r.pctRounded} pour cent`).join('. ')}.`;

    const productionCaption = getText('natural_gas_international_table_caption_production', lang);
    const exportsCaption = getText('natural_gas_international_table_caption_exports', lang);
    const productionTableTitle = `${stripHtml(getText('natural_gas_international_production_label', lang))} (${yearSpanLabel})`;
    const exportsTableTitle = `${stripHtml(getText('natural_gas_international_exports_label', lang))} (${yearSpanLabel})`;

    const productionTableColumns = useMemo(() => [
        { key: 'year', header: getText('crude_oil_international_table_col_year', lang), align: 'left' },
        { key: 'total', header: getText('natural_gas_international_table_col_total', lang), align: 'num' },
        ...PRODUCTION_COLUMN_KEYS.map((k) => ({
            key: k,
            header: `${countryLabel(k)} (%)`,
            align: 'num',
        })),
    ], [lang]);

    const exportTableColumns = useMemo(() => [
        { key: 'year', header: getText('crude_oil_international_table_col_year', lang), align: 'left' },
        { key: 'total', header: getText('natural_gas_international_table_col_total', lang), align: 'num' },
        ...EXPORT_COLUMN_KEYS.map((k) => ({
            key: k,
            header: `${countryLabel(k)} (%)`,
            align: 'num',
        })),
    ], [lang]);

    const productionTableRows = useMemo(
        () =>
            YEARS_ASC.map((y) => {
                const b = DATA_BY_YEAR[y].production;
                const row = { year: y, total: b.total };
                PRODUCTION_COLUMN_KEYS.forEach((k) => {
                    row[k] = pctForCountry(b.items, k);
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
                    row[k] = pctForCountry(b.items, k);
                });
                return row;
            }),
        []
    );

    const renderPctCell = (raw) => (raw === '' || raw == null ? '\u2014' : String(raw));

    const renderTableCell = (raw, { column }) => (
        column?.key === 'year' ? String(raw ?? '')
            : column?.key === 'total' ? formatVolume(raw)
                : renderPctCell(raw)
    );

    const renderCapsuleRows = (rows) =>
        rows.map((row, index) => {
            const isCanada = row.key === 'canada';
            const maxPct = rows[0]?.pct || 1;
            const rawRatio = maxPct > 0 ? row.pct / maxPct : 1;
            const barWidthPct = 62 + 18 * rawRatio;
            return (
                <div
                    key={`${row.key}-${index}`}
                    className={`crude-oil-international-capsule-row ${isCanada ? 'crude-oil-international-capsule-row-canada' : ''}`}
                >
                    <div className="crude-oil-international-capsule-bar-wrap">
                        <div className="crude-oil-international-capsule-bar" style={{ width: `${barWidthPct}%` }}>
                            <span className="crude-oil-international-capsule-bar-text">
                                {row.rank} {row.name}
                            </span>
                        </div>
                    </div>
                    <div className="crude-oil-international-capsule-connector" />
                    <div className="crude-oil-international-capsule-pill">
                        <span className="crude-oil-international-capsule-pill-text">{row.pctRounded}%</span>
                    </div>
                </div>
            );
        });

    return (
        <PageShell tabIndex="-1"
            className="page-content page-108 natural-gas-international-natural-gas page-chrome page-chrome--bleed"
            aria-labelledby="natural-gas-international-main-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
                .page-108.natural-gas-international-natural-gas {
                }

                .page-108.page-content {
                    max-width: none !important;
                    overflow-x: visible !important;
                }

                .page-108 p.crude-oil-international-subtitle {
                    font-family: 'Lato', sans-serif;
                    font-size: 39px;
                    font-weight: bold;
                    color: #423330;
                    margin: 0 0 15px 0;
                }

                .crude-oil-international-container {
                    width: 100%;
                    padding: 15px 0 40px 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                }

                .crude-oil-international-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 50px;
                    font-weight: bold;
                    color: #423330;
                    margin-top: 0;
                    margin-bottom: 25px;
                    position: relative;
                    padding-bottom: 0.5em;
                }

                .crude-oil-international-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }

                .crude-oil-international-content-wrapper {
                    display: flex;
                    flex-direction: column;
                    gap: 30px;
                    margin-top: 20px;
                    align-items: stretch;
                }

                .crude-oil-international-chart-section {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    width: 100%;
                }

                .crude-oil-international-content-wrapper.layout-stacked .crude-oil-international-chart-section {
                    width: 100% !important;
                }

                .crude-oil-international-content-wrapper.layout-stacked .crude-oil-international-chart-container {
                    width: 100% !important;
                    max-width: 1280px !important;
                    margin-left: auto !important;
                    margin-right: auto !important;
                }

                .crude-oil-international-graphic-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: #000000;
                    margin: 0 0 10px 0;
                    text-align: left;
                    width: 100%;
                }

                .crude-oil-international-chart-container {
                    position: relative;
                    width: 100%;
                    max-width: 1280px;
                    margin-left: auto;
                    margin-right: auto;
                }

                .crude-oil-international-capsule-graphic {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    width: 100%;
                    font-family: 'Noto Sans', sans-serif;
                }

                .crude-oil-international-capsule-row {
                    display: flex;
                    align-items: center;
                    min-height: 52px;
                    gap: 0;
                    min-width: 0;
                }

                .crude-oil-international-capsule-bar-wrap {
                    flex: 0 0 28%;
                    min-width: 0;
                    display: flex;
                    align-items: center;
                }

                .crude-oil-international-capsule-bar {
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

                .crude-oil-international-capsule-bar .crude-oil-international-capsule-bar-text {
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    word-break: break-word;
                    white-space: normal;
                    line-height: 1.3;
                }

                .crude-oil-international-capsule-row-canada .crude-oil-international-capsule-bar {
                    background-color: #423330;
                    color: #fff;
                }

                .crude-oil-international-capsule-connector {
                    flex: 1 1 0;
                    min-width: 10px;
                    height: 2px;
                    background-color: #b0b0b0;
                }

                .crude-oil-international-capsule-row-canada .crude-oil-international-capsule-connector {
                    background-color: #423330;
                }

                .crude-oil-international-capsule-pill {
                    flex: 0 0 64px;
                    height: 36px;
                    min-width: 64px;
                    border-radius: 999px;
                    border: 1px solid #b0b0b0;
                    background-color: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 15px;
                    color: #333;
                    box-sizing: border-box;
                }

                .crude-oil-international-capsule-row-canada .crude-oil-international-capsule-pill {
                    border-width: 2px;
                    border-color: #423330;
                    font-weight: bold;
                    font-size: 16px;
                }

                @media (max-width: 1280px) {
                    .crude-oil-international-chart-container {
                        max-width: 100% !important;
                    }
                }

                @media (max-width: 768px) {
                    .crude-oil-international-title {
                        font-size: 37px;
                    }

                    .page-108 p.crude-oil-international-subtitle {
                        font-size: 35px;
                    }

                    .crude-oil-international-graphic-title {
                        font-size: 26px;
                    }
                }
            `}</style>

            <div className="crude-oil-international-container">
                <header>
                    <h1 id="natural-gas-international-main-title" className="crude-oil-international-title">
                        {getText('natural_gas_international_title', lang)}
                    </h1>
                    <p className="crude-oil-international-subtitle">{getText('natural_gas_international_subtitle', lang)}</p>
                </header>

                <>
                    <YearSelect
                        lang={lang}
                        id="natural-gas-international-year-select"
                        className="natural-gas-international-year-selector"
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
                            <h3 className="crude-oil-international-graphic-title" tabIndex="0">
                                    {getText('natural_gas_international_production_label', lang)}
                                    {' \u2013 '}
                                    {formatVolume(production.total)} {getText('natural_gas_international_unit_bcf', lang)} (
                                    {formatVolume(production.bcm)} {getText('natural_gas_international_unit_bcm', lang)}) ({year})
                            </h3>

                            <div className="crude-oil-international-chart-container" role="region" aria-label={productionAria} tabIndex="0">
                                <div className="crude-oil-international-capsule-graphic" aria-hidden="true">
                                    {renderCapsuleRows(productionRows)}
                                </div>
                            </div>

                            <ChartDataTable
                                lang={lang}
                                columns={productionTableColumns}
                                rows={productionTableRows}
                                csvFilename={lang === 'en' ? 'world_natural_gas_production.csv' : 'production_mondiale_gaz_naturel.csv'}
                                docx={{
                                    filename: lang === 'en' ? 'world_natural_gas_production.docx' : 'production_mondiale_gaz_naturel.docx',
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
                            <h3 className="crude-oil-international-graphic-title" tabIndex="0">
                                    {getText('natural_gas_international_exports_label', lang)}
                                    {' \u2013 '}
                                    {formatVolume(exportsBlock.total)} {getText('natural_gas_international_unit_bcf', lang)} (
                                    {formatVolume(exportsBlock.bcm)} {getText('natural_gas_international_unit_bcm', lang)}) ({year})
                            </h3>

                            <div className="crude-oil-international-chart-container" role="region" aria-label={exportsAria} tabIndex="0">
                                <div className="crude-oil-international-capsule-graphic" aria-hidden="true">
                                    {renderCapsuleRows(exportRows)}
                                </div>
                            </div>

                            <ChartDataTable
                                lang={lang}
                                columns={exportTableColumns}
                                rows={exportTableRows}
                                csvFilename={lang === 'en' ? 'world_natural_gas_exports.csv' : 'exportations_mondiales_gaz_naturel.csv'}
                                docx={{
                                    filename: lang === 'en' ? 'world_natural_gas_exports.docx' : 'exportations_mondiales_gaz_naturel.docx',
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

export default NaturalGasInternational;
