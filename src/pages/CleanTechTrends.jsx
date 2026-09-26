import React, { useEffect, useMemo, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageFootnotes from '../components/PageFootnotes';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import { useOutletContext } from 'react-router-dom';
import { getCleanTechTrendsData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';

const CATEGORY_DEFS = [
    { key: 'total', labelKey: 'clean_tech_trends_total', isTotal: true },
    { key: 'hydro', labelKey: 'clean_tech_trends_hydro' },
    { key: 'wind', labelKey: 'clean_tech_trends_wind' },
    { key: 'biomass', labelKey: 'clean_tech_trends_biomass' },
    { key: 'solar', labelKey: 'clean_tech_trends_solar' },
    { key: 'nuclear', labelKey: 'clean_tech_trends_nuclear' },
    { key: 'ccs', labelKey: 'clean_tech_trends_ccs' },
    { key: 'geothermal', labelKey: 'clean_tech_trends_geothermal' },
    { key: 'tidal', labelKey: 'clean_tech_trends_tidal' },
    { key: 'multiple', labelKey: 'clean_tech_trends_multiple', footnote: '1' },
    { key: 'other', labelKey: 'clean_tech_trends_other', footnote: '2' },
];

const CleanTechTrends = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        getCleanTechTrendsData()
            .then((data) => setPageData(data))
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const years = useMemo(() => pageData.map((d) => d.year), [pageData]);
    const minYear = years.length > 0 ? Math.min(...years) : 2021;
    const maxYear = years.length > 0 ? Math.max(...years) : 2024;
    const pageTitle = `${getText('clean_tech_trends_title_prefix', lang)}${minYear} ${lang === 'en' ? 'to' : 'à'} ${maxYear}`;
    const exportTitle = stripHtml(pageTitle);
    const tableCaption = getText('clean_tech_trends_table_caption', lang);
    const csvFilename = lang === 'en' ? 'clean_technology_trends.csv' : 'tendances_technologies_propres.csv';
    const docxFilename = lang === 'en' ? 'clean_technology_trends.docx' : 'tendances_technologies_propres.docx';

    const categories = useMemo(() => CATEGORY_DEFS.map((cat) => ({
        ...cat,
        label: getText(cat.labelKey, lang),
    })), [lang]);

    const tableColumns = useMemo(() => [
        {
            key: 'category',
            header: lang === 'en' ? 'Category' : 'Catégorie',
            align: 'left',
        },
        ...years.map((y) => ({
            key: String(y),
            header: String(y),
            align: 'num',
        })),
    ], [lang, years]);

    const tableRows = useMemo(() => {
        const formatValue = (val) => {
            if (val === undefined || val === null) return '—';
            if (lang === 'en') {
                if (val < 1) return `$${val.toFixed(2)}B`;
                return `$${val.toFixed(1)}B`;
            }
            if (val < 1) return `${val.toFixed(2).replace('.', ',')} G$`;
            return `${val.toFixed(1).replace('.', ',')} G$`;
        };
        const projectsWord = getText('clean_tech_trends_projects', lang);
        return categories.map((cat) => {
            const row = {
                category: cat.label,
                footnote: cat.footnote || null,
            };
            years.forEach((y) => {
                const yearData = pageData.find((d) => d.year === y);
                const projects = yearData ? yearData[`${cat.key}_projects`] : 0;
                const value = yearData ? yearData[`${cat.key}_value`] : 0;
                const projectLabel = projects === 1
                    ? (lang === 'en' ? 'project' : 'projet')
                    : projectsWord;
                row[String(y)] = `${projects ?? 0} ${projectLabel} (${formatValue(value)})`;
            });
            return row;
        });
    }, [categories, years, pageData, lang]);

    const docxColumnWidths = useMemo(() => {
        const yearWidth = years.length > 0 ? Math.floor(6500 / years.length) : 1500;
        return [2500, ...years.map(() => yearWidth)];
    }, [years]);

    if (loading || error) return <PageStatus lang={lang} loading={loading} error={error} />;
    if (!pageData || pageData.length === 0) {
        return <div className="error">{lang === 'en' ? 'No data available' : 'Aucune donnée disponible'}</div>;
    }

    return (
        <PageShell
            id="main-content"
            tabIndex="-1"
            className="page-content page-29 clean-tech-trends-page page-chrome page-chrome--bleed"
            role="main"
            aria-labelledby="clean-tech-trends-main-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.page-29.page-content { max-width: none !important; overflow-x: visible !important; }
.clean-tech-trends-container { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.clean-tech-trends-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 25px 0;
    line-height: 1.25;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: none;
}
.clean-tech-trends-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.clean-tech-trends-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.clean-tech-trends-values-note {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--gc-text);
    margin: 2rem 0 0.75rem 0;
    line-height: 1.65;
    max-width: 80ch;
}
@media (max-width: 768px) {
    .clean-tech-trends-title { font-size: 37px; }
}
@media (max-width: 480px) {
    .clean-tech-trends-title { font-size: 28px; }
}
            `}</style>

            <div className="clean-tech-trends-container">
                <header>
                    <h1 id="clean-tech-trends-main-title" className="clean-tech-trends-title">
                        {pageTitle}
                    </h1>
                </header>

                <div className="clean-tech-trends-table-wrapper">
                    <ChartDataTable
                        lang={lang}
                        defaultOpen
                        label={lang === 'en' ? 'Data table' : 'Tableau de données'}
                        columns={tableColumns}
                        rows={tableRows}
                        csvFilename={csvFilename}
                        docx={{
                            filename: docxFilename,
                            title: exportTitle,
                            titleAlign: 'center',
                            columnWidths: docxColumnWidths,
                            fontSize: 20,
                        }}
                        caption={tableCaption}
                        tableAriaLabel={tableCaption}
                        renderCell={(raw, { colIndex, row }) => {
                            if (colIndex === 0) {
                                const footnote = row?.footnote;
                                if (!footnote) return String(raw ?? '');
                                return (
                                    <>
                                        {String(raw ?? '')}
                                        <span
                                            id={`fn${footnote}-rf`}
                                            style={{ verticalAlign: 'super', fontSize: '0.75em', lineHeight: '0' }}
                                        >
                                            <a className="fn-lnk" href={`#fn${footnote}`}>
                                                <span className="wb-inv">
                                                    {lang === 'en' ? 'Footnote ' : 'Note de bas de page '}
                                                </span>
                                                <span aria-hidden="true">{footnote}</span>
                                            </a>
                                        </span>
                                    </>
                                );
                            }
                            return String(raw ?? '');
                        }}
                    />
                </div>

                <p className="clean-tech-trends-values-note">
                    {getText('clean_tech_trends_footnote_values', lang)}
                </p>

                <PageFootnotes
                    lang={lang}
                    items={[
                        {
                            id: 'fn1',
                            marker: '1',
                            text: getText('clean_tech_trends_footnote1', lang),
                            returnHref: '#fn1-rf',
                        },
                        {
                            id: 'fn2',
                            marker: '2',
                            text: getText('clean_tech_trends_footnote2', lang),
                            returnHref: '#fn2-rf',
                        },
                    ]}
                />
            </div>
        </PageShell>
    );
};

export default CleanTechTrends;
