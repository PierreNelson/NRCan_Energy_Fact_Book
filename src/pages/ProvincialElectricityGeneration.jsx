import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import { useOutletContext } from 'react-router-dom';
import { saveAs } from 'file-saver';
import { getProvincialElectricityGenerationData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import ProvincialElectricityGenerationInfographic from '../components/ProvincialElectricityGenerationInfographic';
import {
    SOURCE_KEYS,
    formatSharePct,
    pctSortValue,
    exportProvincialGenerationInfographicPng,
} from '../components/ProvincialElectricityGenerationInfographic.constants';
import { resolveAccessibleInfographicRoot } from '../utils/downloadInfographicPng';

const substitute = (text, vars) =>
    Object.keys(vars || {}).reduce(
        (s, key) => s.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(vars[key] ?? '')),
        text || '',
    );

const ProvincialElectricityGeneration = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [pageData, setPageData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const figureRef = useRef(null);

    useEffect(() => {
        getProvincialElectricityGenerationData()
            .then(setPageData)
            .catch((err) => setError(err?.message || 'Failed to load data'))
            .finally(() => setLoading(false));
    }, []);

    const year = pageData?.latestYear ?? null;
    const vars = { year: year ?? '' };

    const infographicTitle = substitute(getText('electricity_generation_provincial_infographic_title', lang), vars);
    const exportTableTitle = stripHtml(infographicTitle);
    const ariaLabel = substitute(getText('electricity_generation_provincial_infographic_aria', lang), vars);
    const fileSlugBase = substitute(getText('electricity_generation_provincial_download_title', lang), vars).replace(/\s+/g, '_');
    const tableCaption = substitute(getText('electricity_generation_provincial_table_caption', lang), vars);

    const tableColumns = useMemo(() => [
        { key: 'source', header: getText('electricity_generation_provincial_table_col_source', lang), align: 'left' },
        { key: 'province', header: getText('electricity_generation_provincial_table_col_province', lang), align: 'left' },
        { key: 'share', header: getText('electricity_generation_provincial_table_col_share', lang), align: 'num' },
    ], [lang]);

    const tableRows = useMemo(() => {
        if (!pageData?.sources) return [];
        const rows = SOURCE_KEYS.flatMap((sourceKey) => {
            const block = pageData.sources[sourceKey];
            if (!block?.provinces?.length) return [];
            return block.provinces.map((row) => ({
                sourceKey,
                source: getText(`electricity_generation_provincial_source_${sourceKey}`, lang),
                province: getText(`electricity_generation_provincial_prov_${row.key}`, lang),
                share: formatSharePct(row.value, lang),
                sortPct: pctSortValue(row.value),
            }));
        });
        return rows.sort((a, b) => {
            const sourceDiff = SOURCE_KEYS.indexOf(a.sourceKey) - SOURCE_KEYS.indexOf(b.sourceKey);
            if (sourceDiff !== 0) return sourceDiff;
            return b.sortPct - a.sortPct;
        });
    }, [pageData, lang]);

    const downloadPng = async () => {
        const canvas = await exportProvincialGenerationInfographicPng(
            resolveAccessibleInfographicRoot(figureRef.current),
            { scale: 2 },
        );
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${fileSlugBase}.png`);
        });
    };

    if (loading || error) {
        return (
            <PageShell
                id="main-content"
                tabIndex="-1"
                className="page-content page-67 page-chrome page-chrome--bleed"
                aria-labelledby="provincial-electricity-generation-infographic-title"
                style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
            >
                <PageStatus lang={lang} loading={loading} error={error} />
            </PageShell>
        );
    }

    if (!pageData?.latestYear) {
        return (
            <PageShell
                id="main-content"
                tabIndex="-1"
                className="page-content page-67 page-chrome page-chrome--bleed"
                aria-labelledby="provincial-electricity-generation-infographic-title"
                style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
            >
                <p>{getText('electricity_generation_provincial_no_data', lang)}</p>
            </PageShell>
        );
    }

    return (
        <PageShell
            id="main-content"
            tabIndex="-1"
            className="page-content page-67 page-chrome page-chrome--bleed"
            aria-labelledby="provincial-electricity-generation-infographic-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.page-67.page-content { max-width: none !important; overflow-x: visible !important; }
.page-67 {
}
.provincial-electricity-generation-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.provincial-electricity-generation-infographic-section { width: 100%; margin-bottom: 0; }
.provincial-electricity-generation-download-buttons { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
.provincial-electricity-generation-download-btn {
    padding: 8px 16px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
}
.provincial-electricity-generation-download-btn:hover { background-color: #404040 !important; }
.provincial-electricity-generation-table-wrapper { display: block; width: 100%; margin-top: 20px; }
            `}</style>

            <div className="provincial-electricity-generation-inner">
                <div className="provincial-electricity-generation-infographic-section">
                    <ProvincialElectricityGenerationInfographic
                        lang={lang}
                        getText={getText}
                        figureRef={figureRef}
                        ariaLabel={ariaLabel}
                        data={pageData}
                        title={infographicTitle}
                        titleId="provincial-electricity-generation-infographic-title"
                    />

                    <div className="provincial-electricity-generation-download-buttons">
                        <button type="button" className="provincial-electricity-generation-download-btn" onClick={downloadPng}>
                            {getText('electricity_generation_provincial_download_png', lang)}
                        </button>
                    </div>

                    <div className="provincial-electricity-generation-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={`${fileSlugBase}.csv`}
                            docx={{
                                filename: `${fileSlugBase}.docx`,
                                title: exportTableTitle,
                                titleAlign: 'center',
                                columnWidths: [3200, 2400, 1800],
                                fontSize: 22,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                        />
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default ProvincialElectricityGeneration;
