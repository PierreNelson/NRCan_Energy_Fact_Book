import React, { useMemo, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import PageFootnotes from '../components/PageFootnotes';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import YearSelect from '../components/YearSelect';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';

import { makeScrollToIdHandler } from '../utils/scrollToId';

const DATA_BY_YEAR = {
    2020: {
        production: {
            total: 84.5,
            items: [
                { key: 'usa', pct: 20 },
                { key: 'russia', pct: 12 },
                { key: 'saudi', pct: 11 },
                { key: 'canada', pct: 6 },
                { key: 'iraq', pct: 5 }
            ]
        },
        exports: {
            total: 41.2,
            items: [
                { key: 'saudi', pct: 16 },
                { key: 'russia', pct: 11 },
                { key: 'canada', pct: 8 },
                { key: 'usa', pct: 9 },
                { key: 'iraq', pct: 7 }
            ]
        }
    },
    2021: {
        production: {
            total: 85.8,
            items: [
                { key: 'usa', pct: 20 },
                { key: 'russia', pct: 12 },
                { key: 'saudi', pct: 11 },
                { key: 'canada', pct: 6 },
                { key: 'iraq', pct: 5 }
            ]
        },
        exports: {
            total: 42.5,
            items: [
                { key: 'saudi', pct: 15 },
                { key: 'russia', pct: 12 },
                { key: 'canada', pct: 8 },
                { key: 'usa', pct: 9 },
                { key: 'iraq', pct: 7 }
            ]
        }
    },
    2022: {
        production: {
            total: 87.1,
            items: [
                { key: 'usa', pct: 19 },
                { key: 'russia', pct: 12 },
                { key: 'saudi', pct: 11 },
                { key: 'canada', pct: 7 },
                { key: 'iraq', pct: 5 }
            ]
        },
        exports: {
            total: 43.9,
            items: [
                { key: 'saudi', pct: 15 },
                { key: 'russia', pct: 12 },
                { key: 'canada', pct: 9 },
                { key: 'usa', pct: 9 },
                { key: 'iraq', pct: 7 }
            ]
        }
    },
    2023: {
        production: {
            total: 88.4,
            items: [
                { key: 'usa', pct: 19 },
                { key: 'russia', pct: 12 },
                { key: 'saudi', pct: 11 },
                { key: 'canada', pct: 7 },
                { key: 'iraq', pct: 5 }
            ]
        },
        exports: {
            total: 45.3,
            items: [
                { key: 'saudi', pct: 15 },
                { key: 'russia', pct: 12 },
                { key: 'canada', pct: 9 },
                { key: 'usa', pct: 9 },
                { key: 'iraq', pct: 7 }
            ]
        }
    },
    2024: {
        production: {
            total: 89.2,
            items: [
                { key: 'usa', pct: 19 },
                { key: 'russia', pct: 12 },
                { key: 'saudi', pct: 11 },
                { key: 'canada', pct: 7 },
                { key: 'iraq', pct: 5 }
            ]
        },
        exports: {
            total: 46.0,
            items: [
                { key: 'saudi', pct: 15 },
                { key: 'russia', pct: 12 },
                { key: 'canada', pct: 9 },
                { key: 'usa', pct: 9 },
                { key: 'iraq', pct: 7 }
            ]
        }
    }
};

const YEARS_DESC = [2024, 2023, 2022, 2021, 2020];
const YEARS_ASC = [2020, 2021, 2022, 2023, 2024];
const PRODUCTION_COLUMN_KEYS = ['usa', 'russia', 'saudi', 'canada', 'iraq'];
const EXPORT_COLUMN_KEYS = ['saudi', 'russia', 'canada', 'usa', 'iraq'];

const pctForCountry = (items, key) => {
    const it = items.find((i) => i.key === key);
    return it != null ? Math.round(it.pct) : '';
};

const CrudeOilInternational = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [year, setYear] = useState(2024);

    const formatVolume = (n) =>
        n.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    const renderPctCell = (raw) => (raw === '' || raw == null ? '\u2014' : String(raw));

    const yearBundle = DATA_BY_YEAR[year] || DATA_BY_YEAR[2024];
    const production = yearBundle.production;
    const exportsBlock = yearBundle.exports;

    const productionRows = useMemo(
        () =>
            production.items.map((row, index) => ({
                ...row,
                rank: index + 1,
                name: getText(`crude_oil_international_country_${row.key}`, lang),
                pctRounded: Math.round(row.pct)
            })),
        [production.items, lang]
    );

    const exportRows = useMemo(
        () =>
            exportsBlock.items.map((row, index) => ({
                ...row,
                rank: index + 1,
                name: getText(`crude_oil_international_country_${row.key}`, lang),
                pctRounded: Math.round(row.pct)
            })),
        [exportsBlock.items, lang]
    );

    const productionAria =
        lang === 'en'
            ? `World crude oil production ranking for ${year}: ${productionRows.map((r) => `Rank ${r.rank}, ${r.name}, ${r.pctRounded} percent`).join('. ')}.`
            : `Classement de la production mondiale de pétrole brut pour ${year}: ${productionRows.map((r) => `Rang ${r.rank}, ${r.name}, ${r.pctRounded} pour cent`).join('. ')}.`;

    const exportsAria =
        lang === 'en'
            ? `World crude oil exports ranking for ${year}: ${exportRows.map((r) => `Rank ${r.rank}, ${r.name}, ${r.pctRounded} percent`).join('. ')}.`
            : `Classement des exportations mondiales de pétrole brut pour ${year}: ${exportRows.map((r) => `Rang ${r.rank}, ${r.name}, ${r.pctRounded} pour cent`).join('. ')}.`;

    const yearSpanLabel = `${YEARS_ASC[0]}\u2013${YEARS_ASC[YEARS_ASC.length - 1]}`;
    const productionTableTitle = `${stripHtml(getText('crude_oil_international_production_label', lang))} (${yearSpanLabel})`;
    const exportsTableTitle = `${stripHtml(getText('crude_oil_international_exports_label', lang))} (${yearSpanLabel})`;
    const productionCaption = getText('crude_oil_international_table_caption_production', lang);
    const exportsCaption = getText('crude_oil_international_table_caption_exports', lang);

    const productionTableColumns = useMemo(
        () => [
            { key: 'year', header: getText('crude_oil_international_table_col_year', lang), align: 'left' },
            { key: 'total', header: getText('crude_oil_international_table_col_total', lang), align: 'num' },
            ...PRODUCTION_COLUMN_KEYS.map((k) => ({
                key: k,
                header: `${stripHtml(getText(`crude_oil_international_country_${k}`, lang))} (%)`,
                align: 'num'
            }))
        ],
        [lang]
    );

    const exportTableColumns = useMemo(
        () => [
            { key: 'year', header: getText('crude_oil_international_table_col_year', lang), align: 'left' },
            { key: 'total', header: getText('crude_oil_international_table_col_total', lang), align: 'num' },
            ...EXPORT_COLUMN_KEYS.map((k) => ({
                key: k,
                header: `${stripHtml(getText(`crude_oil_international_country_${k}`, lang))} (%)`,
                align: 'num'
            }))
        ],
        [lang]
    );

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

    const scrollToFootnote = makeScrollToIdHandler('fn-asterisk-crude-oil-international');

    const scrollToRef = makeScrollToIdHandler('fn-asterisk-rf-crude-oil-international');

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
            className="page-content page-108 page-chrome page-chrome--bleed"
            aria-labelledby="crude-oil-international-main-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
                .page-108 {
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

                .crude-oil-international-content-wrapper.layout-stacked .crude-oil-international-chart-section .data-table-wrapper {
                    margin-top: 30px;
                    width: 100% !important;
                }

                .crude-oil-international-content-wrapper.layout-stacked .crude-oil-international-chart-section .data-table-wrapper summary {
                    width: 100% !important;
                    white-space: normal;
                }

                .crude-oil-international-chart-section .data-table-wrapper {
                    padding-top: 5px;
                    margin-top: 20px;
                    margin-bottom: 0;
                    width: 100%;
                    box-sizing: border-box;
                }

                .crude-oil-international-chart-section .data-table-wrapper summary {
                    width: 100%;
                }

                .page-108 .data-table-wrapper summary {
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    padding: 10px;
                    background-color: #8C8C8C;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    list-style: none;
                    list-style-type: none;
                    box-sizing: border-box;
                    width: 100%;
                    color: #ffffff;
                    display: flex;
                    align-items: center;
                }

                .page-108 .data-table-wrapper summary::-webkit-details-marker {
                    display: none;
                }

                .page-108 .data-table-wrapper summary::marker {
                    content: none;
                    display: none;
                    font-size: 0;
                }

                .page-108 .data-table-wrapper summary:hover {
                    background-color: #404040 !important;
                }

                .page-108 .data-table-wrapper button:hover {
                    background-color: #404040 !important;
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

                    .page-108 .data-table-wrapper summary {
                        font-size: 18px;
                    }
                }
            `}</style>

            <div className="crude-oil-international-container">
                <header>
                    <h1 id="crude-oil-international-main-title" className="crude-oil-international-title">
                        {getText('crude_oil_international_title', lang)}
                    </h1>
                    <p className="crude-oil-international-subtitle">{getText('crude_oil_international_subtitle', lang)}</p>
                </header>

                <>
                    <YearSelect
                        lang={lang}
                        id="crude-oil-international-year-select"
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
                                {getText('crude_oil_international_production_label', lang)}
                                <span
                                    id="fn-asterisk-rf-crude-oil-international"
                                    style={{ verticalAlign: 'super', fontSize: '0.75em', lineHeight: '0', marginLeft: '0.15em' }}
                                >
                                    <a href="#fn-asterisk-crude-oil-international" onClick={scrollToFootnote} className="fn-lnk">
                                        <span className="wb-inv">
                                            {lang === 'en' ? 'Footnote ' : 'Note de bas de page '}
                                        </span>
                                        <span aria-hidden="true">*</span>
                                    </a>
                                </span>
                                {' \u2013 '}
                                {formatVolume(production.total)} {getText('crude_oil_international_unit_rate', lang)} ({year})
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
                                csvFilename={lang === 'en' ? 'crude_oil_world_production.csv' : 'production_mondiale_petrole_brut.csv'}
                                docx={{
                                    filename: lang === 'en' ? 'crude_oil_world_production.docx' : 'production_mondiale_petrole_brut.docx',
                                    title: productionTableTitle,
                                    titleAlign: 'center',
                                    columnWidths: [1200, 1600, ...PRODUCTION_COLUMN_KEYS.map(() => 1280)],
                                    fontSize: 22
                                }}
                                caption={productionCaption}
                                tableAriaLabel={productionCaption}
                                renderCell={(raw, { column }) => (
                                    column?.key === 'year' ? String(raw ?? '')
                                        : column?.key === 'total' ? formatVolume(raw)
                                            : renderPctCell(raw)
                                )}
                            />
                        </div>

                        <div className="crude-oil-international-chart-section">
                            <h3 className="crude-oil-international-graphic-title">
                                {getText('crude_oil_international_exports_label', lang)}
                                <span
                                    style={{ verticalAlign: 'super', fontSize: '0.75em', lineHeight: '0', marginLeft: '0.15em' }}
                                >
                                    <a href="#fn-asterisk-crude-oil-international" onClick={scrollToFootnote} className="fn-lnk">
                                        <span className="wb-inv">
                                            {lang === 'en' ? 'Footnote ' : 'Note de bas de page '}
                                        </span>
                                        <span aria-hidden="true">*</span>
                                    </a>
                                </span>
                                {' \u2013 '}
                                {formatVolume(exportsBlock.total)} {getText('crude_oil_international_unit_rate', lang)} ({year})
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
                                csvFilename={lang === 'en' ? 'crude_oil_world_exports.csv' : 'exportations_mondiales_petrole_brut.csv'}
                                docx={{
                                    filename: lang === 'en' ? 'crude_oil_world_exports.docx' : 'exportations_mondiales_petrole_brut.docx',
                                    title: exportsTableTitle,
                                    titleAlign: 'center',
                                    columnWidths: [1200, 1600, ...EXPORT_COLUMN_KEYS.map(() => 1280)],
                                    fontSize: 22
                                }}
                                caption={exportsCaption}
                                tableAriaLabel={exportsCaption}
                                renderCell={(raw, { column }) => (
                                    column?.key === 'year' ? String(raw ?? '')
                                        : column?.key === 'total' ? formatVolume(raw)
                                            : renderPctCell(raw)
                                )}
                            />
                        </div>
                    </div>
                </>

                <PageFootnotes
                    lang={lang}
                    titleId="fn-crude-oil-international"
                    items={[
                        { id: 'fn-asterisk-crude-oil-international', marker: '*', text: getText('crude_oil_international_footnote', lang), returnHref: '#fn-asterisk-rf-crude-oil-international' },
                    ]}
                />
            </div>
        </PageShell>
    );
};

export default CrudeOilInternational;
