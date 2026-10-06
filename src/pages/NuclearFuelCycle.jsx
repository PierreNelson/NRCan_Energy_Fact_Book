import React, { useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import AccessibleInfographic from '../components/AccessibleInfographic';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import { getText } from '../utils/translations';
import { downloadInfographicImagePng } from '../utils/downloadInfographicPng';
import { stripHtml } from '../utils/stripHtml';
import nuclearFuelCycleBgEn from '../assets/nuclear_fuel_cycle_bg.svg?raw';
import nuclearFuelCycleBgFr from '../assets/nuclear_fuel_cycle_bg_fr.svg?raw';
import { TABLE_ROWS } from './NuclearFuelCycle.constants';

const NuclearFuelCycle = () => {
    const { lang, layoutPadding } = useOutletContext();
    const infographicRef = useRef(null);

    const svgMarkup = lang === 'en' ? nuclearFuelCycleBgEn : nuclearFuelCycleBgFr;
    const fileSlugBase = getText('nuclear_fuel_cycle_download_title', lang).replace(/\s+/g, '_');
    const pageTitle = getText('nuclear_fuel_cycle_title', lang);
    const infographicOverview = useMemo(() => {
        const sentences = [];
        const re = /<text\b[^>]*>([\s\S]*?)<\/text>/gi;
        let match = re.exec(svgMarkup);
        while (match) {
            const raw = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            if (raw.length > 40) sentences.push(raw);
            match = re.exec(svgMarkup);
        }
        return [pageTitle, ...sentences].filter(Boolean).join('. ').replace(/\.\s*\./g, '.').trim();
    }, [svgMarkup, pageTitle]);
    const exportTitle = stripHtml(pageTitle);
    const tableCaption = getText('nuclear_fuel_cycle_table_caption', lang);

    const tableColumns = useMemo(() => [
        { key: 'category', header: getText('nuclear_fuel_cycle_col_category', lang), align: 'left' },
        { key: 'site', header: getText('nuclear_fuel_cycle_col_site', lang), align: 'left' },
        { key: 'location', header: getText('nuclear_fuel_cycle_col_location', lang), align: 'left' },
    ], [lang]);

    const tableRows = useMemo(() => TABLE_ROWS.map((row) => ({
        category: getText(`nuclear_fuel_cycle_category_${row.categoryKey}`, lang),
        site: getText(`nuclear_fuel_cycle_site_${row.siteKey}`, lang),
        location: getText(`nuclear_fuel_cycle_location_${row.locationKey}`, lang),
    })), [lang]);

    const downloadInfographicPng = async () => {
        await downloadInfographicImagePng(
            infographicRef.current?.getGraphicElement?.() ?? infographicRef.current,
            { filename: `${fileSlugBase}.png`, scale: 2 },
        );
    };

    return (
        <PageShell tabIndex="-1"
            className="page-content nuclear-fuel-cycle page-chrome page-chrome--bleed"
            aria-label={pageTitle}
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
.nuclear-fuel-cycle {
}
.nuclear-fuel-cycle-inner { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.nuclear-fuel-cycle-infographic-section { width: 100%; margin-bottom: 0; }
.nuclear-fuel-cycle-infographic-figure { margin: 0; width: 100%; }
.nuclear-fuel-cycle-bg-image {
    width: 100%;
    height: auto;
    display: block;
}
.nuclear-fuel-cycle-download-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 15px;
}
            `}</style>

            <div className="nuclear-fuel-cycle-inner">
                <div className="nuclear-fuel-cycle-infographic-section">
                    <AccessibleInfographic
                        ref={infographicRef}
                        mode="text"
                        as="figure"
                        className="nuclear-fuel-cycle-infographic-figure"
                        label={infographicOverview}
                        svgMarkup={svgMarkup}
                        imgClassName="nuclear-fuel-cycle-bg-image"
                        imgStyle={{ width: '100%', height: 'auto', display: 'block' }}
                        idPrefix={`nuclear-fuel-cycle-${lang}`}
                    />

                    <div className="nuclear-fuel-cycle-download-buttons">
                        <button type="button" className="download-table-btn" onClick={downloadInfographicPng}>
                            {getText('nuclear_fuel_cycle_download_infographic_png', lang)}
                        </button>
                    </div>
                </div>

                <div className="nuclear-fuel-cycle-table-wrapper">
                    <ChartDataTable
                        lang={lang}
                        columns={tableColumns}
                        rows={tableRows}
                        csvFilename={`${fileSlugBase}.csv`}
                        docx={{
                            filename: `${fileSlugBase}.docx`,
                            title: exportTitle,
                            titleAlign: 'center',
                            columnWidths: [4800, 3200, 2600],
                            fontSize: 20,
                            alignByColumn: ['left', 'left', 'left'],
                        }}
                        caption={tableCaption}
                        tableAriaLabel={tableCaption}
                    />
                </div>
            </div>
        </PageShell>
    );
};

export default NuclearFuelCycle;
