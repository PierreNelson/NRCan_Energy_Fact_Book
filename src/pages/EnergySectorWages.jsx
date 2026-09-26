import React, { useMemo, useRef } from 'react';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import { exportTableToCsv, exportTableToDocx } from '../utils/exportTableToDocx';
import { stripHtml } from '../utils/stripHtml';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import { getText } from '../utils/translations';
import EnergySectorWagesInfographic from '../components/EnergySectorWagesInfographic';
import { BULLET_KEYS, exportWagesInfographicPng } from '../components/EnergySectorWagesInfographic.constants';
import { resolveAccessibleInfographicRoot } from '../utils/downloadInfographicPng';
import { saveAs } from 'file-saver';

const YEAR = '2023';

const EnergySectorWages = () => {
    const { lang, layoutPadding } = useOutletContext();
    const figureRef = useRef(null);

    const pageTitle = getText('energy_sector_wages_title', lang);

    const bulletHtml = useMemo(
        () => Object.fromEntries(BULLET_KEYS.map((key) => [key, getText(`energy_sector_wages_bullet_${key}`, lang)])),
        [lang],
    );

    const bulletAria = useMemo(
        () => Object.fromEntries(BULLET_KEYS.map((key) => [key, stripHtml(getText(`energy_sector_wages_bullet_${key}`, lang))])),
        [lang],
    );

    const tableRows = useMemo(
        () =>
            BULLET_KEYS.map((key) => ({
                key,
                indicator: getText(`energy_sector_wages_csv_${key}`, lang),
                value: getText(`energy_sector_wages_csv_value_${key}`, lang),
            })),
        [lang],
    );

    const fileSlugBase = getText('energy_sector_wages_download_title', lang).replace(/\{\{year\}\}/g, YEAR).replace(/\s+/g, '_');
    const headers = [getText('energy_sector_wages_csv_col_indicator', lang), getText('energy_sector_wages_csv_col_value', lang)];
    const exportRows = tableRows.map((row) => [row.indicator, row.value]);

    const downloadCsv = () => {
        exportTableToCsv({ filename: fileSlugBase, headers, rows: exportRows });
    };

    const downloadDocx = async () => {
        await exportTableToDocx({
            filename: fileSlugBase,
            title: stripHtml(pageTitle),
            headers,
            rows: exportRows,
            columnWidths: [5200, 3600],
            options: { titleAlign: 'left', fontSize: 18 },
        });
    };

    const downloadPng = async () => {
        const canvas = await exportWagesInfographicPng(resolveAccessibleInfographicRoot(figureRef.current), {
            title: stripHtml(pageTitle),
            scale: 2,
        });
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (blob) saveAs(blob, `${fileSlugBase}.png`);
        });
    };

    const bleedVars = layoutBleedCssVars(layoutPadding);

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-chrome page-chrome--bleed page-41 energy-sector-wages-wages"
            aria-labelledby="energy-sector-wages-title"
            style={{ backgroundColor: '#ffffff', ...bleedVars }}
        >
            <style>{`
.energy-sector-wages-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.energy-sector-wages-title {
    font-family: 'Lato', sans-serif;
    font-size: 41px;
    font-weight: bold;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 25px;
    line-height: 1.25;
    position: relative;
    padding-bottom: 0.5em;
}
.energy-sector-wages-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.energy-sector-wages-infographic-section { width: 100%; margin-bottom: 28px; }
.energy-sector-wages-download-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 15px;
}
@media (max-width: 768px) {
    .energy-sector-wages-title { font-size: 37px; }
}
            `}</style>

            <div className="energy-sector-wages-inner">
                <h1 id="energy-sector-wages-title" className="energy-sector-wages-title">
                    {pageTitle}
                </h1>

                <div className="energy-sector-wages-infographic-section">
                    <EnergySectorWagesInfographic
                        figureRef={figureRef}
                        bulletHtml={bulletHtml}
                        bulletAria={bulletAria}
                    />

                    <div className="energy-sector-wages-download-buttons chart-data-table-toolbar">
                        <button type="button" className="download-table-btn" onClick={downloadPng}>
                            {getText('energy_sector_wages_download_png', lang)}
                        </button>
                        <button type="button" className="download-table-btn" onClick={downloadCsv}>
                            {getText('energy_sector_wages_download_csv', lang)}
                        </button>
                        <button type="button" className="download-table-btn" onClick={downloadDocx}>
                            {getText('energy_sector_wages_download_docx', lang)}
                        </button>
                    </div>
                </div>
            </div>
        </PageShell>
    );
};

export default EnergySectorWages;
