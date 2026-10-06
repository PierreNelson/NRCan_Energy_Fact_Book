import React, { useState, useEffect, useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import PageFootnotes from '../components/PageFootnotes';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useWindowWidth from '../hooks/useWindowWidth';
import PageShell from '../components/PageShell';
import YearSelect from '../components/YearSelect';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import hexToRgba from '../utils/hexToRgba';

import { makeScrollToIdHandler } from '../utils/scrollToId';
import { formatLocalePct } from '../utils/formatLocale';

const employment_PROVINCE_INFO = {
    'nl': { nameEn: 'Newfoundland and Labrador', nameFr: 'Terre-Neuve-et-Labrador', abbrevEn: 'N.L.', abbrevFr: 'T.-N.-L.', geoJsonName: 'Newfoundland and Labrador' },
    'pe': { nameEn: 'Prince Edward Island', nameFr: 'Île-du-Prince-Édouard', abbrevEn: 'P.E.I.', abbrevFr: 'Î.-P.-É.', geoJsonName: 'Prince Edward Island' },
    'ns': { nameEn: 'Nova Scotia', nameFr: 'Nouvelle-Écosse', abbrevEn: 'N.S.', abbrevFr: 'N.-É.', geoJsonName: 'Nova Scotia' },
    'nb': { nameEn: 'New Brunswick', nameFr: 'Nouveau-Brunswick', abbrevEn: 'N.B.', abbrevFr: 'N.-B.', geoJsonName: 'New Brunswick' },
    'qc': { nameEn: 'Quebec', nameFr: 'Québec', abbrevEn: 'Que.', abbrevFr: 'Qc', geoJsonName: 'Quebec' },
    'on': { nameEn: 'Ontario', nameFr: 'Ontario', abbrevEn: 'Ont.', abbrevFr: 'Ont.', geoJsonName: 'Ontario' },
    'mb': { nameEn: 'Manitoba', nameFr: 'Manitoba', abbrevEn: 'Man.', abbrevFr: 'Man.', geoJsonName: 'Manitoba' },
    'sk': { nameEn: 'Saskatchewan', nameFr: 'Saskatchewan', abbrevEn: 'Sask.', abbrevFr: 'Sask.', geoJsonName: 'Saskatchewan' },
    'ab': { nameEn: 'Alberta', nameFr: 'Alberta', abbrevEn: 'Alta.', abbrevFr: 'Alb.', geoJsonName: 'Alberta' },
    'bc': { nameEn: 'British Columbia', nameFr: 'Colombie-Britannique', abbrevEn: 'B.C.', abbrevFr: 'C.-B.', geoJsonName: 'British Columbia' },
    'yt': { nameEn: 'Yukon', nameFr: 'Yukon', abbrevEn: 'Y.T.', abbrevFr: 'Yn', geoJsonName: 'Yukon Territory' },
    'nt': { nameEn: 'Northwest Territories', nameFr: 'Territoires du Nord-Ouest', abbrevEn: 'N.W.T.', abbrevFr: 'T.N.-O.', geoJsonName: 'Northwest Territories' },
    'nu': { nameEn: 'Nunavut', nameFr: 'Nunavut', abbrevEn: 'Nunavut', abbrevFr: 'Nt', geoJsonName: 'Nunavut' },
};

const employment_PROVINCE_CODES = ['bc', 'ab', 'sk', 'mb', 'on', 'qc', 'nb', 'ns', 'pe', 'nl', 'yt', 'nt', 'nu'];

const employment_PROVINCE_CENTROIDS = {
    'nl': { lat: 53.5, lon: -57.0 },
    'pe': { lat: 47.5, lon: -63.0 },
    'ns': { lat: 43.5, lon: -61.5 },
    'nb': { lat: 44.5, lon: -68.5 },
    'qc': { lat: 52.5, lon: -72.0 },
    'on': { lat: 50.5, lon: -86.0 },
    'mb': { lat: 55.5, lon: -98.0 },
    'sk': { lat: 54.5, lon: -106.0 },
    'ab': { lat: 54.5, lon: -115.5 },
    'bc': { lat: 54.0, lon: -125.0 },
    'yt': { lat: 64.5, lon: -135.5 },
    'nt': { lat: 65.5, lon: -120.0 },
    'nu': { lat: 67.0, lon: -95.0 }
};

const employment_INDIRECT_RATIO = 428300 / 316200;

const employment_EMPLOYMENT_DATA = {
    bc: { direct: 29873, indirect: Math.round(29873 * employment_INDIRECT_RATIO) },
    ab: { direct: 159826, indirect: Math.round(159826 * employment_INDIRECT_RATIO) },
    sk: { direct: 17168, indirect: Math.round(17168 * employment_INDIRECT_RATIO) },
    mb: { direct: 6679, indirect: Math.round(6679 * employment_INDIRECT_RATIO) },
    on: { direct: 53834, indirect: Math.round(53834 * employment_INDIRECT_RATIO) },
    qc: { direct: 33109, indirect: Math.round(33109 * employment_INDIRECT_RATIO) },
    nb: { direct: 5491, indirect: Math.round(5491 * employment_INDIRECT_RATIO) },
    ns: { direct: 3128, indirect: Math.round(3128 * employment_INDIRECT_RATIO) },
    pe: { direct: 348, indirect: Math.round(348 * employment_INDIRECT_RATIO) },
    nl: { direct: 6155, indirect: Math.round(6155 * employment_INDIRECT_RATIO) },
    yt: { direct: 149, indirect: Math.round(149 * employment_INDIRECT_RATIO) },
    nt: { direct: 254, indirect: Math.round(254 * employment_INDIRECT_RATIO) },
    nu: { direct: 229, indirect: Math.round(229 * employment_INDIRECT_RATIO) },
    direct_total: 316200,
    indirect_total: 428300,
    total: 744500,
    indigenous_employed: 18200,
    share_total_pct: 3.6,
    energy_direct_pct: 1.5,
    petroleum_pct: 0.9,
    electricity_pct: 0.5,
    other_pct: 0.1,
    energy_indirect_pct: 2.1
};

const employment_COLORS = {
    'energy_sector': '#245e7f',
    'non_energy': '#9A9389',
    'map_fill': '#AA9255'
};

const formatNationalAccountsNumber = (num, lang) => {
    if (num === undefined || num === null) return '—';
    return Math.round(num).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');
};

const Employment = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [year, setYear] = useState(2024);
    const windowWidth = useWindowWidth();
    const [selectedProvinces, setSelectedProvinces] = useState(null);
    const mapChartRef = useRef(null);
    const pieChartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, index: null });

    const scrollToFootnote = makeScrollToIdHandler('fn-asterisk-employment');

    const scrollToRef = makeScrollToIdHandler('fn-asterisk-rf-employment');

    const years = useMemo(() => Array.from({ length: 2024 - 2009 + 1 }, (_, i) => 2024 - i), []);

    // Yearly employment data by province for all years (currently same values - will be updated with real data later)
    // Each year contains direct employment values for each province
    const yearlyProvinceData = useMemo(() => years.map(yr => ({
        year: yr,
        bc: 29873,
        ab: 159826,
        sk: 17168,
        mb: 6679,
        on: 53834,
        qc: 33109,
        nb: 5491,
        ns: 3128,
        pe: 348,
        nl: 6155,
        yt: 149,
        nt: 254,
        nu: 229,
        national_total: 316200
    })), [years]);

    const pageTitle = getText('employment_title', lang).replace(/\b20\d{2}\b/, String(year));
    const exportTableTitle = stripHtml(pageTitle);
    const mapExportTitle = stripHtml(getText('employment_map_title', lang));
    const tableCaption = lang === 'en'
        ? 'Energy sector direct employment by province/territory, 2009-2024'
        : "Emplois directs du secteur de l'énergie par province/territoire, 2009-2024";
    const csvFilename = lang === 'en' ? 'employment_data.csv' : 'donnees_emploi.csv';
    const docxFilename = lang === 'en' ? 'employment_data.docx' : 'donnees_emploi.docx';

    const tableColumns = useMemo(() => [
        {
            key: 'province',
            header: lang === 'en' ? 'Province/Territory' : 'Province/Territoire',
            align: 'left',
        },
        ...yearlyProvinceData.map((d) => ({
            key: String(d.year),
            header: String(d.year),
            align: 'num',
        })),
    ], [lang, yearlyProvinceData]);

    const tableRows = useMemo(() => {
        const provinceRows = employment_PROVINCE_CODES.map((code) => {
            const info = employment_PROVINCE_INFO[code];
            const row = {
                province: lang === 'en' ? info.nameEn : info.nameFr,
                rowKind: 'jobs',
            };
            yearlyProvinceData.forEach((yearData) => {
                row[String(yearData.year)] = yearData[code];
            });
            return row;
        });

        const totalRow = {
            province: lang === 'en' ? 'Canada Total (Direct)' : 'Total Canada (direct)',
            rowKind: 'jobs',
        };
        yearlyProvinceData.forEach((yearData) => {
            totalRow[String(yearData.year)] = yearData.national_total;
        });

        const shareDirectRow = {
            province: lang === 'en' ? 'Share of total employment (Direct)' : "Part de l'emploi total (direct)",
            rowKind: 'share',
        };
        const shareIndirectRow = {
            province: lang === 'en' ? 'Share of total employment (Indirect)' : "Part de l'emploi total (indirect)",
            rowKind: 'share',
        };
        const shareTotalRow = {
            province: lang === 'en' ? 'Share of total employment (Total)' : "Part de l'emploi total (total)",
            rowKind: 'share',
        };
        yearlyProvinceData.forEach((yearData) => {
            const y = String(yearData.year);
            shareDirectRow[y] = employment_EMPLOYMENT_DATA.energy_direct_pct;
            shareIndirectRow[y] = employment_EMPLOYMENT_DATA.energy_indirect_pct;
            shareTotalRow[y] = employment_EMPLOYMENT_DATA.share_total_pct;
        });

        return [...provinceRows, totalRow, shareDirectRow, shareIndirectRow, shareTotalRow];
    }, [lang, yearlyProvinceData]);

    const docxColumnWidths = useMemo(() => {
        const yearWidth = yearlyProvinceData.length > 0
            ? Math.floor(6500 / yearlyProvinceData.length)
            : 1500;
        return [2500, ...yearlyProvinceData.map(() => yearWidth)];
    }, [yearlyProvinceData]);

    

    

    const formatPercent = (num) => formatLocalePct(num, lang, { maximumFractionDigits: 20 });

    const downloadMapWithTitle = useChartPngDownloader(
        mapChartRef,
        () => ({
        filename: lang === 'en' ? `employment_map_${year}.png` : `emploi_carte_${year}.png`,
        title: mapExportTitle,
        width: 1200,
        height: 800,
    }),
        [lang, mapExportTitle, year],
    );

    const downloadPieWithTitle = useChartPngDownloader(
        pieChartRef,
        () => {
        const title = lang === 'en'
            ? `Share of total employment, ${year}`
            : `Pourcentage du total des emplois, ${year}`;
        return {
            filename: lang === 'en' ? `employment_share_${year}.png` : `part_emploi_${year}.png`,
            title,
            width: 800,
            height: 600,
            legendItems: [
                {
                    label: `${getText('employment_energy_direct_label', lang)} ${formatPercent(employment_EMPLOYMENT_DATA.energy_direct_pct)}`,
                    color: employment_COLORS.energy_sector,
                },
                {
                    label: `${getText('employment_petroleum', lang)} ${formatPercent(employment_EMPLOYMENT_DATA.petroleum_pct)}`,
                    color: '#58585a',
                },
                {
                    label: `${getText('employment_electricity', lang)} ${formatPercent(employment_EMPLOYMENT_DATA.electricity_pct)}`,
                    color: '#58585a',
                },
                {
                    label: `${getText('employment_other', lang)} ${formatPercent(employment_EMPLOYMENT_DATA.other_pct)}`,
                    color: '#58585a',
                },
                {
                    label: `${getText('employment_energy_indirect_label', lang)} ${formatPercent(employment_EMPLOYMENT_DATA.energy_indirect_pct)}`,
                    color: employment_COLORS.energy_sector,
                },
            ],
        };
    },
        [employment_COLORS, employment_EMPLOYMENT_DATA, formatPercent, getText, lang, year],
    );

    const mapPlotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadMapWithTitle(gd),
        staticPlot: false,
    });

    const piePlotConfig = buildPngOnlyPlotConfig({
        lang,
        click: () => downloadPieWithTitle(),
        staticPlot: false,
    });

    const getMapSRSummary = () => {
        const jobsWord = getText('employment_jobs', lang);
        const places = employment_PROVINCE_CODES.map((code) => {
            const info = employment_PROVINCE_INFO[code];
            const name = lang === 'en' ? info.nameEn : info.nameFr;
            const value = formatNationalAccountsNumber(employment_EMPLOYMENT_DATA[code]?.direct, lang);
            return `${name}, ${value} ${jobsWord}.`;
        }).join(' ');
        const intro = lang === 'en'
            ? `Energy sector direct employment by province and territory, ${year}.`
            : `Emplois directs du secteur de l'énergie par province et territoire, ${year}.`;
        return `${intro} ${places}`;
    };

    const getPieSRSummary = () => {
        if (lang === 'en') {
            return `Pie chart showing energy sector's share of total employment in ${year}. Energy sector represents ${employment_EMPLOYMENT_DATA.share_total_pct}% of total employment, with Energy Direct at ${employment_EMPLOYMENT_DATA.energy_direct_pct}% and Energy Indirect at ${employment_EMPLOYMENT_DATA.energy_indirect_pct}%.`;
        } else {
            return `Graphique circulaire montrant la part du secteur de l'énergie dans l'emploi total en ${year}. Le secteur de l'énergie représente ${employment_EMPLOYMENT_DATA.share_total_pct} % de l'emploi total, avec l'énergie directe à ${employment_EMPLOYMENT_DATA.energy_direct_pct} % et l'énergie indirecte à ${employment_EMPLOYMENT_DATA.energy_indirect_pct} %.`;
        }
    };

    const getLegendText = () => {
        if (lang === 'en') {
            return `Total employment breakdown. Energy Direct: ${employment_EMPLOYMENT_DATA.energy_direct_pct}%, including Petroleum at ${employment_EMPLOYMENT_DATA.petroleum_pct}%, Electricity at ${employment_EMPLOYMENT_DATA.electricity_pct}%, and Other at ${employment_EMPLOYMENT_DATA.other_pct}%. Energy Indirect: ${employment_EMPLOYMENT_DATA.energy_indirect_pct}%.`;
        }
        return `Répartition de l'emploi total. Énergie directe : ${employment_EMPLOYMENT_DATA.energy_direct_pct} %, incluant le Pétrole à ${employment_EMPLOYMENT_DATA.petroleum_pct} %, l'Électricité à ${employment_EMPLOYMENT_DATA.electricity_pct} % et Autres à ${employment_EMPLOYMENT_DATA.other_pct} %. Énergie indirecte : ${employment_EMPLOYMENT_DATA.energy_indirect_pct} %.`;
    };

    const getStatsAriaLabel = () => {
        const direct = `${getText('employment_direct', lang)}: ${formatNationalAccountsNumber(employment_EMPLOYMENT_DATA.direct_total, lang)} ${getText('employment_jobs', lang)}`;
        const indirect = `${getText('employment_indirect', lang)}: ${formatNationalAccountsNumber(employment_EMPLOYMENT_DATA.indirect_total, lang)} ${getText('employment_jobs', lang)}`;
        const total = `${getText('employment_total_label', lang)}: ${formatNationalAccountsNumber(employment_EMPLOYMENT_DATA.total, lang)} ${getText('employment_jobs', lang)}`;
        return `${direct}. ${indirect}. ${total}.`;
    };

    const indigenousBulletText = lang === 'en'
        ? `About ${formatNationalAccountsNumber(employment_EMPLOYMENT_DATA.indigenous_employed, lang)} Indigenous people were directly employed in the energy sector in 2023.`
        : `Le secteur de l'énergie employait directement environ ${formatNationalAccountsNumber(employment_EMPLOYMENT_DATA.indigenous_employed, lang)} Autochtones en 2023.`;

    const pieTitleText = lang === 'en'
        ? `Share of total employment, ${year}`
        : `Pourcentage du total des emplois, ${year}`;


    // Responsive map height based on window width
    const mapHeight = useMemo(() => {
        if (windowWidth <= 384) return 400;
        if (windowWidth <= 640) return 440;
        if (windowWidth <= 768) return 500;
        if (windowWidth <= 1280) return 560;
        return 600;
    }, [windowWidth]);

    const mapChartData = useMemo(() => {
        const values = [];
        const hoverTexts = [];
        const labelLats = [];
        const labelLons = [];
        const labelTexts = [];
        const geoJsonNames = [];
        const highZoomOffsets = {
            'bc': 4,
            'ab': -3,
            'sk': 4,
            'mb': -3,
            'on': -4,
            'qc': 3,
            'nb': -2,
            'ns': -3,
            'pe': 0,
            'nl': 0,
            'yt': 0,
            'nt': 0,
            'nu': 0
        };

        employment_PROVINCE_CODES.forEach(code => {
            const value = employment_EMPLOYMENT_DATA[code]?.direct || 0;
            const info = employment_PROVINCE_INFO[code];
            const name = lang === 'en' ? info.nameEn : info.nameFr;
            const abbrev = lang === 'en' ? info.abbrevEn : info.abbrevFr;

            values.push(value);
            hoverTexts.push(`<b>${name}</b><br>${formatNationalAccountsNumber(value, lang)} ${lang === 'en' ? 'jobs' : 'emplois'}`);
            geoJsonNames.push(info.geoJsonName);
            const centroid = employment_PROVINCE_CENTROIDS[code];
            const latOffset = windowWidth <= 480 ? (highZoomOffsets[code] || 0) : 0;
            labelLats.push(centroid.lat + latOffset);
            labelLons.push(centroid.lon);
            labelTexts.push(`${abbrev}\n${formatNationalAccountsNumber(value, lang)}`);
        });

        return { values, hoverTexts, labelLats, labelLons, labelTexts, geoJsonNames };
    }, [lang, windowWidth]);

    const pieChartData = useMemo(() => {
        const energyPct = employment_EMPLOYMENT_DATA.share_total_pct;
        const nonEnergyPct = 100 - energyPct;

        const energyLabel = `<b>${lang === 'fr' ? energyPct.toString().replace('.', ',') : energyPct}${lang === 'fr' ? ' %' : '%'}</b>`;

        return [{
            type: 'pie',
            values: [energyPct, nonEnergyPct],
            labels: [
                getText('employment_energy_sector', lang),
                getText('employment_non_energy', lang)
            ],
            text: [energyLabel, ''],
            texttemplate: windowWidth <= 768 ? '%{percent:.1%}' : '%{text}',
            textinfo: windowWidth <= 768 ? 'percent' : 'text',
            textposition: windowWidth <= 768 ? 'inside' : 'outside',
            textfont: { 
                size: windowWidth <= 480 ? 14 : windowWidth <= 768 ? 16 : 24, 
                family: 'Arial, sans-serif',
                color: windowWidth <= 768 ? '#ffffff' : '#221e1f'
            },
            outsidetextfont: { 
                color: '#221e1f',
                size: windowWidth <= 768 ? 16 : 24,
                family: 'Arial, sans-serif'
            },
            hoverinfo: 'text',
            hovertext: [
                `<b>${getText('employment_energy_sector', lang)}</b><br>${energyPct}%`,
                `<b>${getText('employment_non_energy', lang)}</b><br>${nonEnergyPct.toFixed(1)}%`
            ],
            hoverlabel: {
                bgcolor: '#ffffff',
                bordercolor: '#000000',
                font: { color: '#000000', size: windowWidth <= 640 ? 12 : 14, family: 'Arial, sans-serif' }
            },
            marker: {
                colors: [employment_COLORS.energy_sector, employment_COLORS.non_energy],
                line: { color: '#ffffff', width: 2 }
            },
            hole: 0.0,
            direction: 'clockwise',
            rotation: 45,
            sort: false,
            pull: [0.02, 0],
        }];
    }, [lang, windowWidth]);

    const { mapScale, mapCenter } = useMemo(() => {
        // Keep Canada fully visible inside the chart frame (no edge clipping).
        const scale = (windowWidth > 960 && windowWidth <= 1097) ? 2.35 : windowWidth <= 768 ? 2.25 : 2.5;
        return {
            mapScale: scale,
            mapCenter: { lon: -96, lat: 63 },
        };
    }, [windowWidth]);

    

    

    return (
        <PageShell tabIndex="-1"
            className="page-content page-9 page-chrome page-chrome--bleed"
            aria-label={pageTitle}
            style={{backgroundColor: 'white',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',
                boxSizing: 'border-box', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
                .wb-inv {
                    clip: rect(1px, 1px, 1px, 1px);
                    height: 1px;
                    margin: 0;
                    overflow: hidden;
                    position: absolute;
                    width: 1px;
                    white-space: nowrap;
                }

                .page-9 {
                    padding-left: ${layoutPadding?.left || 55}px; 
                }

                .employment-container {
                    width: 100%;
                    padding: 12px 0 0;
                    display: flex;
                    flex-direction: column;
                }

                .employment-title {
                    font-size: 50px;
                    color: #245e7f;
                }

                .employment-content-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 30px;
                    align-items: flex-start;
                }

                .employment-left-column {
                    flex: 1 1 58%;
                    min-width: 300px;
                    max-width: 100%;
                    position: relative;
                    z-index: 1;
                    overflow: visible;
                }

                .employment-right-column {
                    flex: 1 1 36%;
                    min-width: 280px;
                    max-width: 100%;
                    padding-left: 12px;
                    position: relative;
                    z-index: 2;
                    box-sizing: border-box;
                    overflow: visible;
                }

                .employment-stats {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    color: #332f30;
                    margin-bottom: 15px;
                    line-height: 1.6;
                    border-radius: 2px;
                    width: fit-content;
                    max-width: 100%;
                }

                .employment-stats-line {
                    margin-bottom: 4px;
                }

                .employment-stats-total {
                    font-weight: bold;
                    font-size: 22px;
                }

                .employment-stats:focus,
                .employment-stats:focus-visible,
                .employment-map-focus:focus,
                .employment-map-focus:focus-visible,
                .employment-pie-focus:focus,
                .employment-pie-focus:focus-visible,
                .employment-indigenous-bullet:focus,
                .employment-indigenous-bullet:focus-visible,
                .employment-legend:focus,
                .employment-legend:focus-visible {
                    outline: 3px solid #ffbf47;
                    outline-offset: 2px;
                }

                .employment-map-title-and-map {
                    width: 100%;
                    max-width: 100%;
                    position: relative;
                }

                .employment-map-chart-title,
                .employment-pie-chart-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 20px;
                    font-weight: bold;
                    color: #000000;
                    margin: 0 0 6px 0;
                    text-align: center;
                }

                .employment-map-focus {
                    display: block;
                    width: 100%;
                    max-width: 100%;
                    border-radius: 2px;
                    box-sizing: border-box;
                    position: relative;
                    overflow: visible;
                }

                .employment-map-container {
                    position: relative;
                    display: block;
                    width: 100%;
                    max-width: 100%;
                    min-width: 0;
                    margin: 0 !important;
                    overflow: visible;
                    z-index: 1;
                    pointer-events: none;
                    box-sizing: border-box;
                }

                .employment-map-container .js-plotly-plot,
                .employment-map-container .lazy-plot-host,
                .employment-map-container .lazy-plot-inner {
                    width: 100% !important;
                    max-width: 100%;
                }

                .employment-map-container .js-plotly-plot,
                .employment-map-container button,
                .employment-map-container div[role="button"] {
                    pointer-events: auto;
                }

                .employment-map-container .js-plotly-plot .plotly .modebar-container {
                    right: 4px !important;
                    left: auto !important;
                    width: auto !important;
                    top: 4px !important;
                    z-index: 20 !important;
                }
                .employment-map-container .js-plotly-plot .plotly .modebar {
                    right: auto !important;
                    left: auto !important;
                    top: 0 !important;
                }

                .employment-indigenous-bullet {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    color: #000000;
                    margin-top: 0;
                    margin-bottom: 12px;
                    line-height: 1.6;
                    border-radius: 2px;
                    width: fit-content;
                    max-width: 100%;
                }

                .employment-pie-focus {
                    display: block;
                    width: 100%;
                    max-width: 350px;
                    margin: 0 auto;
                    border-radius: 2px;
                    box-sizing: border-box;
                    overflow: visible;
                }

                .employment-pie-container {
                    width: 100%;
                    max-width: 350px;
                    height: 300px;
                    margin: 0 auto 8px auto !important;
                    overflow: visible;
                    position: relative;
                }
                .employment-pie-container .lazy-plot-host,
                .employment-pie-container .lazy-plot-inner {
                    width: 100%;
                    height: 100%;
                    overflow: visible;
                }

                .employment-pie-container .js-plotly-plot .plotly .modebar-container {
                    right: 4px !important;
                    left: auto !important;
                    width: auto !important;
                    top: 4px !important;
                    z-index: 20 !important;
                }
                .employment-pie-container .js-plotly-plot .plotly .modebar {
                    right: auto !important;
                    left: auto !important;
                    top: 0 !important;
                }

                .employment-legend {
                    font-family: 'Noto Sans', sans-serif;
                    padding-top: 4px;
                    width: fit-content;
                    max-width: 100%;
                    margin: 0 auto !important;
                    border-radius: 2px;
                    box-sizing: border-box;
                }

                .employment-legend-header {
                    font-weight: bold;
                    font-size: 20px;
                    margin-bottom: 8px;
                }

                .employment-legend-main {
                    font-weight: bold;
                    color: #245e7f;
                    font-size: 20px;
                    margin-bottom: 6px;
                }

                .employment-legend-sub {
                    margin-left: 25px;
                    color: #58585a;
                    font-size: 20px;
                    margin-bottom: 4px;
                    font-weight: bold;
                }

                .employment-legend-indirect {
                    font-weight: bold;
                    color: #245e7f;
                    font-size: 20px;
                    margin-top: 12px;
                }

                .employment-table-wrapper {
                    display: block;
                    width: 100%;
                    margin: 8px 0 0 0;
                    position: relative;
                    z-index: 10;
                }

                @media (max-width: 1280px) {
                    .employment-content-row {
                        flex-direction: column;
                    }
                    .employment-left-column,
                    .employment-right-column {
                        width: 100%;
                        overflow: visible;
                    }
                    .employment-right-column {
                        padding-left: 0;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        text-align: center;
                    }

                    .employment-pie-container {
                        margin: 0 auto 8px auto !important;
                        max-width: 420px;
                        height: 300px;
                    }

                    .employment-pie-chart-title {
                        margin-top: 16px !important;
                    }

                    .employment-map-chart-title,
                    .employment-map-focus {
                        margin-top: 0 !important;
                        width: 100%;
                        margin-left: 0;
                    }

                    .employment-legend {
                        text-align: center;
                        margin: 0 auto !important;
                        width: 100%;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    }

                    .employment-legend-sub {
                        margin-left: 0;
                    }
                    .employment-indigenous-bullet {
                        text-align: left;
                        align-self: center;
                        max-width: 600px;
                    }

                    .employment-map-container {
                        margin: 0 !important;
                    }

                    .employment-pie-focus {
                        max-width: 420px;
                    }

                    .employment-map-container .js-plotly-plot .plotly .modebar-container,
                    .employment-pie-container .js-plotly-plot .plotly .modebar-container {
                        right: 4px !important;
                        left: auto !important;
                        width: auto !important;
                        top: 4px !important;
                    }
                }

                @media (max-width: 768px) {
                    .employment-title {
                        font-size: 37px;
                    }
                    .employment-stats,
                    .employment-indigenous-bullet,
                    .employment-legend-header,
                    .employment-legend-main,
                    .employment-legend-sub,
                    .employment-legend-indirect {
                        font-size: 18px;
                    }
                    .employment-map-container {
                        min-width: 0;
                    }
                }

                @media (max-width: 640px) {
                    .page-9 {
                        border-left: none !important;
                        margin-left: 0;
                        width: 100%;
                        padding-left: 0;
                    }
                }
            `}</style>

            <div className="employment-container">
                <header>
                    <h1 className="employment-title page-chrome-title">
                        {pageTitle}
                    </h1>
                </header>

                <div className="employment-chart-frame page-chrome-chart-frame">
                    <YearSelect
                        lang={lang}
                        id="employment-year-select"
                        className="employment-year-selector"
                        label={getText('year_slider_label', lang)}
                        years={years}
                        value={year}
                        onChange={setYear}
                    />
                    <div role="status" className="wb-inv" aria-live="polite">
                        {year ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${year}` : ''}
                    </div>

                    <div className="employment-content-row">
                        <div className="employment-left-column">
                            <div
                                className="employment-stats"
                                role="region"
                                tabIndex={0}
                                aria-label={getStatsAriaLabel()}
                            >
                                <div className="employment-stats-line" aria-hidden="true">
                                    {getText('employment_direct', lang)}: {formatNationalAccountsNumber(employment_EMPLOYMENT_DATA.direct_total, lang)} {getText('employment_jobs', lang)}
                                </div>
                                <div className="employment-stats-line" aria-hidden="true">
                                    {getText('employment_indirect', lang)}: {formatNationalAccountsNumber(employment_EMPLOYMENT_DATA.indirect_total, lang)} {getText('employment_jobs', lang)}
                                </div>
                                <div className="employment-stats-line employment-stats-total" aria-hidden="true">
                                    {getText('employment_total_label', lang)}: {formatNationalAccountsNumber(employment_EMPLOYMENT_DATA.total, lang)} {getText('employment_jobs', lang)}
                                </div>
                            </div>

                            <div className="employment-map-title-and-map">
                                <h2 className="employment-map-chart-title">
                                    {getText('employment_map_title', lang)}
                                    <span id="fn-asterisk-rf-employment" style={{ verticalAlign: 'super', fontSize: '0.75em', lineHeight: '0' }}>
                                        <a href="#fn-asterisk-employment" onClick={scrollToFootnote} className="fn-lnk">
                                            <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span><span aria-hidden="true">*</span>
                                        </a>
                                    </span>
                                </h2>
                                <div
                                    className="employment-map-focus"
                                    role="region"
                                    aria-label={getMapSRSummary()}
                                    tabIndex={0}
                                >
                                    {selectedProvinces !== null && <ClearSelectionButton lang={lang} onClick={() => setSelectedProvinces(null)} />}
                                    <figure
                                        ref={mapChartRef}
                                        className="employment-map-container"
                                        style={{ margin: 0, position: 'relative', height: mapHeight }}
                                    >
                                    <Plot
                                        key={`map-${selectedProvinces ? selectedProvinces.join('-') : 'none'}`}
                                        data={[
                                            {
                                                type: 'choropleth',
                                                locationmode: 'geojson-id',
                                                geojson: 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/canada.geojson',
                                                featureidkey: 'properties.name',
                                                locations: mapChartData.geoJsonNames,
                                                z: mapChartData.values,
                                                text: mapChartData.hoverTexts,
                                                hoverinfo: 'text',
                                                hoverlabel: {
                                                    bgcolor: '#ffffff',
                                                    bordercolor: '#000000',
                                                    font: { color: '#000000', size: windowWidth <= 640 ? 12 : 14, family: 'Arial, sans-serif' }
                                                },
                                                colorscale: [[0, '#AA9255'], [1, '#AA9255']],
                                                zmin: 0,
                                                zmax: 1,
                                                showscale: false,
                                                marker: {
                                                    line: {
                                                        color: 'white',
                                                        width: 1.5
                                                    }
                                                },
                                                selectedpoints: selectedProvinces,
                                                selected: {
                                                    marker: {
                                                        opacity: 1
                                                    }
                                                },
                                                unselected: {
                                                    marker: {
                                                        opacity: 0.3
                                                    }
                                                }
                                            },
                                            {
                                                type: 'scattergeo',
                                                mode: 'text',
                                                lat: mapChartData.labelLats,
                                                lon: mapChartData.labelLons,
                                                text: employment_PROVINCE_CODES.map((code, i) => {
                                                    const info = employment_PROVINCE_INFO[code];
                                                    const abbrev = lang === 'en' ? info.abbrevEn : info.abbrevFr;
                                                    if (windowWidth <= 480) {
                                                        return `${abbrev}<br>${formatNationalAccountsNumber(mapChartData.values[i], lang)}`;
                                                    }
                                                    return `<b>${abbrev}</b><br><b>${formatNationalAccountsNumber(mapChartData.values[i], lang)}</b>`;
                                                }),
                                                textfont: {
                                                    family: 'Arial, sans-serif',
                                                    size: windowWidth <= 640 ? 12 : 14,
                                                    color: selectedProvinces === null 
                                                        ? '#000000' 
                                                        : employment_PROVINCE_CODES.map((_, i) => selectedProvinces.includes(i) ? '#333333' : hexToRgba('#333333', 0.3))
                                                },
                                                hoverinfo: 'text',
                                                hovertext: mapChartData.hoverTexts,
                                                hoverlabel: {
                                                    bgcolor: '#ffffff',
                                                    bordercolor: '#000000',
                                                    font: { color: '#000000', size: windowWidth <= 640 ? 12 : 14, family: 'Arial, sans-serif' }
                                                },
                                                showlegend: false
                                            }
                                        ]}
                                        layout={{
                                            geo: {
                                                scope: 'north america',
                                                projection: {
                                                    type: 'conic conformal',
                                                    parallels: [50, 70],
                                                    rotation: { lon: -96 },
                                                    scale: mapScale
                                                },
                                                center: mapCenter,
                                                showframe: false,
                                                showland: false,
                                                showcountries: false,
                                                showcoastlines: false,
                                                showsubunits: false,
                                                showlakes: true,
                                                lakecolor: '#f5f5f5',
                                                bgcolor: 'rgba(0,0,0,0)'
                                            },
                                            margin: { l: 10, r: 10, t: 36, b: 10 },
                                            height: mapHeight,
                                            clickmode: 'event',
                                            dragmode: false,
                                            paper_bgcolor: 'rgba(0,0,0,0)',
                                            plot_bgcolor: 'rgba(0,0,0,0)'
                                        }}
                                        onClick={(data) => {
                                            if (!data.points || data.points.length === 0) return;
                                            const clickedPoint = data.points[0];
                                            const provinceIndex = clickedPoint.pointNumber !== undefined ? clickedPoint.pointNumber : clickedPoint.pointIndex;

                                            if (provinceIndex === undefined) return;
                                            if (windowWidth <= 768) {
                                                const currentTime = new Date().getTime();
                                                const lastClick = lastClickRef.current;
                                                const isSamePoint = (provinceIndex === lastClick.index);
                                                const isDoubleTap = isSamePoint && (currentTime - lastClick.time < 300);
                                                
                                                lastClickRef.current = { time: currentTime, index: provinceIndex };
                                                
                                                if (!isDoubleTap) {
                                                    return;
                                                }
                                            }

                                            setSelectedProvinces(prev => {
                                                if (prev === null) {
                                                    return [provinceIndex];
                                                }
                                                const isSelected = prev.includes(provinceIndex);
                                                if (isSelected) {
                                                    const newSelection = prev.filter(p => p !== provinceIndex);
                                                    if (newSelection.length === 0) {
                                                        return null;
                                                    }
                                                    return newSelection;
                                                } else {
                                                    return [...prev, provinceIndex];
                                                }
                                            });
                                        }}
                                        config={mapPlotConfig}
                                        style={{ width: '100%', height: '100%' }}
                                    />
                                </figure>
                                </div>
                            </div>
                        </div>

                        <div className="employment-right-column">
                            <div
                                className="employment-indigenous-bullet"
                                role="region"
                                tabIndex={0}
                                aria-label={indigenousBulletText}
                            >
                                <ul style={{ listStyle: 'disc', paddingLeft: '20px', margin: 0 }} aria-hidden="true">
                                    <li>
                                        {getText('employment_indigenous_bullet', lang).replace('18,200', formatNationalAccountsNumber(employment_EMPLOYMENT_DATA.indigenous_employed, lang)).replace('18 200', formatNationalAccountsNumber(employment_EMPLOYMENT_DATA.indigenous_employed, lang))}
                                    </li>
                                </ul>
                            </div>

                            <h2 className="employment-pie-chart-title">
                                {pieTitleText}
                            </h2>

                            <div
                                className="employment-pie-focus"
                                role="region"
                                aria-label={getPieSRSummary()}
                                tabIndex={0}
                            >
                                <figure
                                    ref={pieChartRef}
                                    className="employment-pie-container"
                                    style={{ margin: '0 auto' }}
                                >
                                    <Plot
                                        data={pieChartData}
                                        layout={{
                                            autosize: true,
                                            clickmode: 'event',
                                            dragmode: false,
                                            showlegend: false,
                                            margin: { t: 36, r: 80, b: 30, l: 30 },
                                            paper_bgcolor: 'rgba(0,0,0,0)',
                                            plot_bgcolor: 'rgba(0,0,0,0)',
                                        }}
                                        config={piePlotConfig}
                                        style={{ width: '100%', height: '100%', overflow: 'visible' }}
                                    />
                                </figure>
                            </div>

                            <aside
                                className="employment-legend"
                                role="region"
                                tabIndex={0}
                                aria-label={getLegendText()}
                            >
                                <div aria-hidden="true">
                                    <div className="employment-legend-header">
                                        {getText('employment_total_employment', lang)}
                                    </div>
                                    
                                    <div className="employment-legend-main">
                                        {getText('employment_energy_direct_label', lang)} {formatPercent(employment_EMPLOYMENT_DATA.energy_direct_pct)}
                                    </div>
                                    <div className="employment-legend-sub">
                                        {getText('employment_petroleum', lang)} {formatPercent(employment_EMPLOYMENT_DATA.petroleum_pct)}
                                    </div>
                                    <div className="employment-legend-sub">
                                        {getText('employment_electricity', lang)} {formatPercent(employment_EMPLOYMENT_DATA.electricity_pct)}
                                    </div>
                                    <div className="employment-legend-sub">
                                        {getText('employment_other', lang)} {formatPercent(employment_EMPLOYMENT_DATA.other_pct)}
                                    </div>
                                    
                                    <div className="employment-legend-indirect">
                                        {getText('employment_energy_indirect_label', lang)} {formatPercent(employment_EMPLOYMENT_DATA.energy_indirect_pct)}
                                    </div>
                                </div>
                            </aside>
                        </div>
                    </div>

                    <div className="employment-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            className="employment-data-table"
                            columns={tableColumns}
                            rows={tableRows}
                            csvFilename={csvFilename}
                            docx={{
                                filename: docxFilename,
                                title: exportTableTitle,
                                titleAlign: 'center',
                                columnWidths: docxColumnWidths,
                                fontSize: 18,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                            renderCell={(raw, { colIndex, row }) => {
                                if (colIndex === 0) return String(raw ?? '');
                                if (row?.rowKind === 'share') {
                                    return typeof raw === 'number' ? `${raw}%` : String(raw ?? '');
                                }
                                return formatNationalAccountsNumber(raw, lang);
                            }}
                        />
                    </div>
                </div>

                <PageFootnotes
                    lang={lang}
                    titleId="fn"
                    items={[
                        { id: 'fn-asterisk-employment', marker: '*', text: getText('employment_footnote', lang), returnHref: '#fn-asterisk-rf-employment' },
                    ]}
                />
            </div>
        </PageShell>
    );
};

export default Employment;
