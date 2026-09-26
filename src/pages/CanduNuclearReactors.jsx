import React, { useMemo } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import CanduNuclearReactorsInfographic from '../components/CanduNuclearReactorsInfographic';

const candu_nuclear_reactors_DATA = {
    abroadOperating: 9,
    canadaOperating: 17,
    abroadCountries: 5,
    totalOperating: 26,
    globalReactorSharePct: 7,
    globalCapacitySharePct: 5,
    capacityGwe: 17.9,
};

const TABLE_ROW_KEYS = [
    'canada',
    'abroad',
    'abroad_countries',
    'total',
    'global_reactors',
    'global_capacity',
    'capacity_gwe',
];

const CanduNuclearReactors = () => {
    const { lang, layoutPadding } = useOutletContext();

    const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
    const pctSuffix = lang === 'fr' ? '\u00a0%' : '%';

    const tableCaption = getText('candu_nuclear_reactors_table_caption', lang);
    const exportTableTitle = stripHtml(tableCaption);
    const csvFilename = getText('candu_nuclear_reactors_csv_slug', lang);
    const docxFilename = getText('candu_nuclear_reactors_docx_slug', lang);

    const tableColumns = useMemo(() => [
        { key: 'description', header: getText('candu_nuclear_reactors_table_col_description', lang), align: 'left' },
        { key: 'value', header: getText('candu_nuclear_reactors_table_col_value', lang), align: 'num' },
    ], [lang]);

    const tableRows = useMemo(() => {
        const nearlyPrefix = getText('candu_nuclear_reactors_table_nearly_prefix', lang);
        const formatGwe = (value) =>
            Number(value).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        return TABLE_ROW_KEYS.map((key) => {
            let value;
            switch (key) {
                case 'canada':
                    value = String(candu_nuclear_reactors_DATA.canadaOperating);
                    break;
                case 'abroad':
                    value = String(candu_nuclear_reactors_DATA.abroadOperating);
                    break;
                case 'abroad_countries':
                    value = String(candu_nuclear_reactors_DATA.abroadCountries);
                    break;
                case 'total':
                    value = String(candu_nuclear_reactors_DATA.totalOperating);
                    break;
                case 'global_reactors':
                    value = `${nearlyPrefix}${candu_nuclear_reactors_DATA.globalReactorSharePct}${pctSuffix}`;
                    break;
                case 'global_capacity':
                    value = `${candu_nuclear_reactors_DATA.globalCapacitySharePct}${pctSuffix}`;
                    break;
                case 'capacity_gwe':
                    value = `${formatGwe(candu_nuclear_reactors_DATA.capacityGwe)} GWe`;
                    break;
                default:
                    value = '';
            }
            return {
                description: getText(`candu_nuclear_reactors_table_row_${key}`, lang),
                value,
            };
        });
    }, [lang, locale, pctSuffix]);

    const calloutAria = getText('candu_nuclear_reactors_callout_aria', lang);

    return (
        <PageShell id="main-content"
            tabIndex="-1"
            className="page-content page-89 page-chrome page-chrome--bleed"
            role="main"
            aria-labelledby="candu-nuclear-reactors-main-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.page-89.page-content { max-width: none !important; overflow-x: visible !important; }
.page-89 {
}
.candu-nuclear-reactors-container { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.candu-nuclear-reactors-title {
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
.candu-nuclear-reactors-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.candu-nuclear-reactors-bullets {
    font-family: var(--font-body);
    font-size: clamp(17px, 2vw, 20px);
    color: var(--gc-text);
    line-height: 1.55;
    margin: 0 0 28px 0;
    padding-left: 1.25rem;
}
.candu-nuclear-reactors-bullets li { margin-bottom: 0.85rem; }
.candu-nuclear-reactors-bullets strong { font-weight: bold; }
.candu-nuclear-reactors-table-wrapper { display: block; width: 100%; margin-top: 0; margin-bottom: 0; }
@media (max-width: 768px) {
    .candu-nuclear-reactors-title { font-size: 37px; }
}
@media (max-width: 480px) {
    .candu-nuclear-reactors-title { font-size: 28px; }
}
            `}</style>

            <div className="candu-nuclear-reactors-container">
                <header>
                    <h1 id="candu-nuclear-reactors-main-title" className="candu-nuclear-reactors-title">
                        {getText('candu_nuclear_reactors_title', lang)}
                    </h1>
                </header>

                <ul className="candu-nuclear-reactors-bullets">
                    <li dangerouslySetInnerHTML={{ __html: getText('candu_nuclear_reactors_bullet1', lang) }} />
                    <li>{getText('candu_nuclear_reactors_bullet2', lang)}</li>
                    <li>{getText('candu_nuclear_reactors_bullet3', lang)}</li>
                    <li>{getText('candu_nuclear_reactors_bullet4', lang)}</li>
                </ul>

                <CanduNuclearReactorsInfographic
                    lang={lang}
                    abroadCount={candu_nuclear_reactors_DATA.abroadOperating}
                    heading={getText('candu_nuclear_reactors_callout_heading', lang)}
                    suffix={getText('candu_nuclear_reactors_callout_suffix', lang)}
                    ariaLabel={calloutAria}
                />

                <div className="candu-nuclear-reactors-table-wrapper">
                    <ChartDataTable
                        lang={lang}
                        columns={tableColumns}
                        rows={tableRows}
                        csvFilename={csvFilename}
                        docx={{
                            filename: docxFilename,
                            title: exportTableTitle,
                            titleAlign: 'center',
                            columnWidths: [5200, 2200],
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

export default CanduNuclearReactors;
