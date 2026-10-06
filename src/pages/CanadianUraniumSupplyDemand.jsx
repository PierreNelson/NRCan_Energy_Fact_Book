import React, { useMemo } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import SafeHtml from '../components/SafeHtml';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import canadianUraniumSupplyDemandBg from '../assets/canadian_uranium_supply_demand_bg.png';

const STAT_GREEN = '#809276';
const DATA_YEAR = 2024;

const canadian_uranium_supply_demand_DATA = {
    year: DATA_YEAR,
    productionKtu: 14.3,
    valueBillions: 3,
    exportPct: 90,
    usPurchasesPct: 33,
    domesticPct: 10,
};

const substitute = (text, vars) =>
    (text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

const CanadianUraniumSupplyDemand = () => {
    const { lang, layoutPadding } = useOutletContext();

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const pctSuffix = lang === 'fr' ? '\u00a0%' : '%';

    const formatProduction = (value) =>
        Number(value).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    const productionDisplay = `${formatProduction(canadian_uranium_supply_demand_DATA.productionKtu)} ktU`;
    const valueDisplay =
        lang === 'fr'
            ? `${Number(canadian_uranium_supply_demand_DATA.valueBillions).toLocaleString(locale, { maximumFractionDigits: 0 })} milliards de dollars`
            : `$${Number(canadian_uranium_supply_demand_DATA.valueBillions).toLocaleString(locale, { maximumFractionDigits: 0 })} billion`;
    const exportPctDisplay = `${canadian_uranium_supply_demand_DATA.exportPct}${pctSuffix}`;
    const domesticPctDisplay = `${canadian_uranium_supply_demand_DATA.domesticPct}${pctSuffix}`;

    const textVars = { year: DATA_YEAR };
    const tableCaption = substitute(getText('canadian_uranium_supply_demand_table_caption', lang), textVars);
    const exportTableTitle = stripHtml(tableCaption);
    const csvFilename = getText('canadian_uranium_supply_demand_csv_slug', lang);
    const docxFilename = getText('canadian_uranium_supply_demand_docx_slug', lang);

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('canadian_uranium_supply_demand_table_col_year', lang) },
        { key: 'production', header: getText('canadian_uranium_supply_demand_table_col_production', lang) },
        { key: 'value', header: getText('canadian_uranium_supply_demand_table_col_value', lang) },
        { key: 'export', header: getText('canadian_uranium_supply_demand_table_col_export', lang) },
        { key: 'usShare', header: getText('canadian_uranium_supply_demand_table_col_us_share', lang) },
        { key: 'domestic', header: getText('canadian_uranium_supply_demand_table_col_domestic', lang) },
    ], [lang]);

    const tableRows = useMemo(
        () => [{
            year: DATA_YEAR,
            production: productionDisplay,
            value: valueDisplay,
            export: exportPctDisplay,
            usShare: `${canadian_uranium_supply_demand_DATA.usPurchasesPct}${pctSuffix}`,
            domestic: domesticPctDisplay,
        }],
        [productionDisplay, valueDisplay, exportPctDisplay, domesticPctDisplay, pctSuffix],
    );

    const speakPercent = (value) => {
        const formatted = Number(value).toLocaleString(locale, { maximumFractionDigits: 0 });
        return `${formatted} ${lang === 'en' ? 'percent' : 'pour cent'}`;
    };
    const usParagraphSpoken = stripHtml(
        substitute(getText('canadian_uranium_supply_demand_us_paragraph', lang), {
            pct: canadian_uranium_supply_demand_DATA.usPurchasesPct,
        }),
    )
        .replace(/(\d+(?:[.,]\d+)?)\s*%/g, (_, num) => `${num} ${lang === 'en' ? 'percent' : 'pour cent'}`)
        .replace(/\bU\.S\./g, 'United States');
    const joinSpoken = (parts) => parts
        .map((part) => String(part || '').replace(/\.+$/g, '').trim())
        .filter(Boolean)
        .join('. ');
    const leftColumnLabel = joinSpoken([
        getText('canadian_uranium_supply_demand_subtitle', lang),
        `${getText('canadian_uranium_supply_demand_production_label', lang)}, ${productionDisplay}`,
        getText('canadian_uranium_supply_demand_saskatchewan_note', lang),
        `${getText('canadian_uranium_supply_demand_value_heading', lang)} ${getText('canadian_uranium_supply_demand_value_about', lang)} ${valueDisplay}`,
    ]);
    const exportBlockLabel = joinSpoken([
        `${getText('canadian_uranium_supply_demand_export_prefix', lang)} ${speakPercent(canadian_uranium_supply_demand_DATA.exportPct)} ${getText('canadian_uranium_supply_demand_export_of_production', lang)} ${getText('canadian_uranium_supply_demand_export_suffix', lang)}`,
        usParagraphSpoken,
    ]);
    const domesticBlockLabel = joinSpoken([
        `${getText('canadian_uranium_supply_demand_domestic_heading', lang)} ${getText('canadian_uranium_supply_demand_domestic_prefix', lang)} ${speakPercent(canadian_uranium_supply_demand_DATA.domesticPct)} ${getText('canadian_uranium_supply_demand_domestic_of_production', lang)}`,
        getText('canadian_uranium_supply_demand_domestic_paragraph', lang),
    ]);

    return (
        <PageShell tabIndex="-1"
            className="page-content page-87 page-chrome page-chrome--bleed"
            aria-labelledby="canadian-uranium-supply-demand-main-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.page-87.page-content { max-width: none !important; overflow-x: visible !important; }
.page-87 {
}
.canadian-uranium-supply-demand-container { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.canadian-uranium-supply-demand-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 8px 0;
    line-height: 1.25;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: none;
}
.canadian-uranium-supply-demand-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.canadian-uranium-supply-demand-subtitle {
    font-family: 'Lato', sans-serif;
    font-size: clamp(26px, 3vw, 34px);
    font-weight: bold;
    color: ${STAT_GREEN};
    margin: 0 0 18px 0;
    text-transform: none;
}
.canadian-uranium-supply-demand-split {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 32px;
    align-items: stretch;
    width: 100%;
    margin-bottom: 28px;
}
.canadian-uranium-supply-demand-col { min-width: 0; font-family: var(--font-body); color: var(--gc-text); line-height: 1.45; }
.canadian-uranium-supply-demand-title:focus,
.canadian-uranium-supply-demand-title:focus-visible,
.canadian-uranium-supply-demand-col:focus,
.canadian-uranium-supply-demand-col:focus-visible,
.canadian-uranium-supply-demand-block:focus,
.canadian-uranium-supply-demand-block:focus-visible {
    outline: 3px solid #ffbf47;
    outline-offset: 2px;
}
.canadian-uranium-supply-demand-production-line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25em 0.45em;
    margin: 0 0 10px 0;
}
.canadian-uranium-supply-demand-production-label {
    font-size: clamp(17px, 2vw, 20px);
    font-weight: 400;
}
.canadian-uranium-supply-demand-stat-mid {
    font-family: 'Lato', sans-serif;
    font-size: clamp(34px, 4.2vw, 42px);
    font-weight: bold;
    color: ${STAT_GREEN};
    line-height: 1;
    letter-spacing: -0.01em;
}
.canadian-uranium-supply-demand-stat-value {
    font-family: 'Lato', sans-serif;
    font-size: clamp(42px, 5.2vw, 52px);
    font-weight: bold;
    color: ${STAT_GREEN};
    line-height: 1;
    letter-spacing: -0.01em;
}
.canadian-uranium-supply-demand-note { font-size: clamp(16px, 1.8vw, 18px); margin: 0 0 32px 0; }
.page-87 h3.canadian-uranium-supply-demand-section-heading {
    font-family: 'Lato', sans-serif;
    font-size: clamp(20px, 2.4vw, 26px);
    font-weight: bold;
    color: var(--gc-text);
    line-height: 1.3;
    margin: 0 0 12px 0;
    text-transform: none;
}
.page-87 h3.canadian-uranium-supply-demand-section-heading--compact {
    margin-bottom: 4px;
}
.canadian-uranium-supply-demand-value-about { font-size: clamp(15px, 1.7vw, 17px); margin: 0 0 6px 0; }
.canadian-uranium-supply-demand-value-line { margin: 0 0 20px 0; }
.canadian-uranium-supply-demand-truck-wrap { margin-top: 12px; max-width: 58%; }
.canadian-uranium-supply-demand-truck-image { display: block; width: 100%; height: auto; pointer-events: none; user-select: none; }
.canadian-uranium-supply-demand-export-line, .canadian-uranium-supply-demand-domestic-line {
    font-size: clamp(17px, 2vw, 20px);
    margin: 0 0 12px 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.2em 0.35em;
}
.canadian-uranium-supply-demand-export-line .canadian-uranium-supply-demand-inline-prefix,
.canadian-uranium-supply-demand-domestic-line .canadian-uranium-supply-demand-inline-prefix,
.canadian-uranium-supply-demand-export-line .canadian-uranium-supply-demand-inline-suffix,
.canadian-uranium-supply-demand-domestic-line .canadian-uranium-supply-demand-inline-suffix {
    font-weight: bold;
}
.canadian-uranium-supply-demand-export-suffix-line {
    font-size: clamp(17px, 2vw, 20px);
    margin: -4px 0 16px 0;
}
.canadian-uranium-supply-demand-paragraph { font-size: clamp(16px, 1.8vw, 18px); margin: 0 0 28px 0; }
.canadian-uranium-supply-demand-paragraph strong { font-weight: bold; }
.canadian-uranium-supply-demand-table-wrapper { display: block; width: 100%; margin-top: 0; margin-bottom: 0; }
@media (max-width: 1100px) {
    .canadian-uranium-supply-demand-split { grid-template-columns: 1fr; gap: 28px; }
}
@media (max-width: 768px) {
    .canadian-uranium-supply-demand-title { font-size: 37px; }
}
@media (max-width: 480px) {
    .canadian-uranium-supply-demand-title { font-size: 28px; }
}
            `}</style>

            <div className="canadian-uranium-supply-demand-container">
                <header>
                    <h1 id="canadian-uranium-supply-demand-main-title" className="canadian-uranium-supply-demand-title" tabIndex={0}>
                        {getText('canadian_uranium_supply_demand_title', lang)} ({DATA_YEAR})
                    </h1>
                </header>

                <div className="canadian-uranium-supply-demand-split">
                    <div
                        className="canadian-uranium-supply-demand-col canadian-uranium-supply-demand-left"
                        tabIndex={0}
                        role="group"
                        data-prose-tab="1"
                        aria-label={leftColumnLabel}
                    >
                    <div aria-hidden="true">
                        <h2 className="canadian-uranium-supply-demand-subtitle">{getText('canadian_uranium_supply_demand_subtitle', lang)}</h2>

                        <p className="canadian-uranium-supply-demand-production-line">
                            <span className="canadian-uranium-supply-demand-production-label">{getText('canadian_uranium_supply_demand_production_label', lang)}</span>
                            <span className="canadian-uranium-supply-demand-stat-mid">{productionDisplay}</span>
                        </p>
                        <p className="canadian-uranium-supply-demand-note">{getText('canadian_uranium_supply_demand_saskatchewan_note', lang)}</p>

                        <h3 className="canadian-uranium-supply-demand-section-heading canadian-uranium-supply-demand-section-heading--compact">
                            {getText('canadian_uranium_supply_demand_value_heading', lang)}
                        </h3>
                        <p className="canadian-uranium-supply-demand-value-about">{getText('canadian_uranium_supply_demand_value_about', lang)}</p>
                        <p className="canadian-uranium-supply-demand-value-line">
                            <span className="canadian-uranium-supply-demand-stat-value">{valueDisplay}</span>
                        </p>

                        <div className="canadian-uranium-supply-demand-truck-wrap">
                            <img src={canadianUraniumSupplyDemandBg} alt="" className="canadian-uranium-supply-demand-truck-image" draggable={false} aria-hidden="true" />
                        </div>
                    </div>
                    </div>

                    <div className="canadian-uranium-supply-demand-col canadian-uranium-supply-demand-right">
                        <div
                            className="canadian-uranium-supply-demand-block"
                            tabIndex={0}
                            role="group"
                            data-prose-tab="1"
                            aria-label={exportBlockLabel}
                        >
                            <div aria-hidden="true">
                                <p className="canadian-uranium-supply-demand-export-line">
                                    <span className="canadian-uranium-supply-demand-inline-prefix">{getText('canadian_uranium_supply_demand_export_prefix', lang)}</span>
                                    <span className="canadian-uranium-supply-demand-stat-mid">{exportPctDisplay}</span>
                                    <span className="canadian-uranium-supply-demand-inline-suffix">{getText('canadian_uranium_supply_demand_export_of_production', lang)}</span>
                                </p>
                                <p className="canadian-uranium-supply-demand-export-suffix-line">{getText('canadian_uranium_supply_demand_export_suffix', lang)}</p>
                                <SafeHtml
                                    as="p"
                                    className="canadian-uranium-supply-demand-paragraph"
                                    html={substitute(getText('canadian_uranium_supply_demand_us_paragraph', lang), { pct: canadian_uranium_supply_demand_DATA.usPurchasesPct })}
                                />
                            </div>
                        </div>
                        <div
                            className="canadian-uranium-supply-demand-block"
                            tabIndex={0}
                            role="group"
                            data-prose-tab="1"
                            aria-label={domesticBlockLabel}
                        >
                            <div aria-hidden="true">
                                <h3 className="canadian-uranium-supply-demand-section-heading">{getText('canadian_uranium_supply_demand_domestic_heading', lang)}</h3>
                                <p className="canadian-uranium-supply-demand-domestic-line">
                                    <span className="canadian-uranium-supply-demand-inline-prefix">{getText('canadian_uranium_supply_demand_domestic_prefix', lang)}</span>
                                    <span className="canadian-uranium-supply-demand-stat-mid">{domesticPctDisplay}</span>
                                    <span className="canadian-uranium-supply-demand-inline-suffix">{getText('canadian_uranium_supply_demand_domestic_of_production', lang)}</span>
                                </p>
                                <p className="canadian-uranium-supply-demand-paragraph">{getText('canadian_uranium_supply_demand_domestic_paragraph', lang)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="canadian-uranium-supply-demand-table-wrapper">
                    <ChartDataTable
                        lang={lang}
                        columns={tableColumns}
                        rows={tableRows}
                        csvFilename={csvFilename}
                        docx={{
                            filename: docxFilename,
                            title: exportTableTitle,
                            titleAlign: 'center',
                            columnWidths: [900, 1400, 1600, 1500, 2200, 1400],
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

export default CanadianUraniumSupplyDemand;
