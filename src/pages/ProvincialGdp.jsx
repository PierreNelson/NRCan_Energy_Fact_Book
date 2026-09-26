import React, { useState, useEffect, useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import PageFootnotes from '../components/PageFootnotes';
import YearSelect from '../components/YearSelect';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import PageStatus from '../components/PageStatus';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getProvincialGdpData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import hexToRgba from '../utils/hexToRgba';

import { makeScrollToIdHandler } from '../utils/scrollToId';

const provincial_gdp_PROVINCE_INFO = {
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

const provincial_gdp_PROVINCE_CODES = ['bc', 'ab', 'sk', 'mb', 'on', 'qc', 'nb', 'ns', 'pe', 'nl', 'yt', 'nt', 'nu'];

const provincial_gdp_PROVINCE_CENTROIDS = {
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

const formatProvincialGdpNumber = (num, lang) => {
    if (num === undefined || num === null) return '—';
    return Math.round(num).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');
};

const ProvincialGdp = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [year, setYear] = useState(null);
    const [allData, setAllData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isChartInteractive, setIsChartInteractive] = useState(typeof window !== 'undefined' ? window.innerWidth > 768 : true);
    const [selectedProvinces, setSelectedProvinces] = useState(null);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, index: null });

    const scrollToFootnote = makeScrollToIdHandler('fn-asterisk-provincial-gdp');

    const scrollToRef = makeScrollToIdHandler('fn-asterisk-rf-provincial-gdp');

    useEffect(() => {
        const handleResize = () => {
            const newWidth = window.innerWidth;
            setWindowWidth(newWidth);
            if (newWidth > 768) {
                setIsChartInteractive(true);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (windowWidth <= 768 && isChartInteractive && chartRef.current && !chartRef.current.contains(event.target)) {
                setIsChartInteractive(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isChartInteractive, windowWidth]);

    const exportChartTitle = `${stripHtml(getText('provincial_gdp_subtitle', lang)).replace(/\s+/g, ' ')} (${year})`;

        const downloadChartWithTitle = useChartPngDownloader(
            chartRef,
            () => ({
            filename: lang === 'en' ? `provincial_gdp_map_${year}.png` : `carte_pib_provincial_${year}.png`,
            title: exportChartTitle,
            width: 1200,
            height: 800,
        }),
            [exportChartTitle, lang, year],
        );
    useEffect(() => {
        getProvincialGdpData()
            .then(data => {
                setAllData(data);
                if (data && data.length > 0) {
                    setYear(data[data.length - 1].year);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error('Error loading page data:', err);
                setError(err.message);
                setLoading(false);
            });
    }, []);

    

    const minYear = useMemo(() => allData.length > 0 ? allData[0].year : 2019, [allData]);
    const maxYear = useMemo(() => allData.length > 0 ? allData[allData.length - 1].year : 2024, [allData]);
    const yearsDescending = useMemo(
        () => [...allData].sort((a, b) => b.year - a.year).map((d) => d.year),
        [allData]
    );
    const currentYearData = useMemo(() => {
        if (!year || allData.length === 0) return null;
        return allData.find(d => d.year === year) || allData[allData.length - 1];
    }, [year, allData]);

    const unitHeader = lang === 'en' ? '($ millions)' : '(millions $)';
    const tableCaption = lang === 'en'
        ? `Energy sector direct nominal GDP by province/territory, ${minYear}-${maxYear} (millions of dollars)`
        : `PIB nominal direct du secteur de l'énergie par province/territoire, ${minYear}-${maxYear} (millions de dollars)`;
    const tableFilenameBase = lang === 'en' ? 'provincial_gdp_data' : 'pib_provincial_donnees';
    const docxFilenameBase = lang === 'en' ? 'provincial_gdp_table' : 'pib_provincial_tableau';

    const chartTitleRaw = getText('provincial_gdp_subtitle', lang);
    const chartTitleSpoken = chartTitleRaw
        .replace(/\*/g, '')
        .replace(/\(\$\s*millions\)/gi, 'millions of dollars')
        .replace(/\(millions\s*de\s*\$\)/gi, 'millions de dollars')
        .replace(/\(millions\s*\$\)/gi, 'millions de dollars')
        .replace(/\s+/g, ' ')
        .trim();

    const tableColumns = useMemo(() => [
        {
            key: 'province',
            header: lang === 'en' ? 'Province/Territory' : 'Province/Territoire',
            align: 'left',
        },
        ...allData.map((yearData) => ({
            key: String(yearData.year),
            header: `${yearData.year} ${unitHeader}`,
            align: 'num',
        })),
    ], [lang, allData, unitHeader]);

    const tableRows = useMemo(() => {
        const provinceRows = provincial_gdp_PROVINCE_CODES.map((code) => {
            const info = provincial_gdp_PROVINCE_INFO[code];
            const row = {
                province: lang === 'en' ? info.nameEn : info.nameFr,
            };
            allData.forEach((yearData) => {
                row[String(yearData.year)] = yearData[code] || 0;
            });
            return row;
        });
        const totalRow = {
            province: lang === 'en' ? 'Canada Total' : 'Total Canada',
        };
        allData.forEach((yearData) => {
            totalRow[String(yearData.year)] = yearData.national_total || 0;
        });
        return [...provinceRows, totalRow];
    }, [lang, allData]);

    const docxColumnWidths = useMemo(
        () => [2500, ...allData.map(() => 1100)],
        [allData],
    );

    const getSRSummary = () => {
        if (!currentYearData) return '';
        const total = currentYearData.national_total || 0;
        const topProvince = lang === 'en' ? 'Alberta' : 'l\'Alberta';
        const topValue = currentYearData.ab || 0;

        if (lang === 'en') {
            return `Energy's nominal GDP contribution by province and territory for ${year}. ` +
                   `The national total is ${formatProvincialGdpNumber(total, lang)} million dollars. ` +
                   `${topProvince} has the highest contribution at ${formatProvincialGdpNumber(topValue, lang)} million dollars.`;
        } else {
            return `Contribution de l'énergie au PIB nominal par province et territoire pour ${year}. ` +
                   `Le total national est de ${formatProvincialGdpNumber(total, lang)} millions de dollars. ` +
                   `${topProvince} a la contribution la plus élevée à ${formatProvincialGdpNumber(topValue, lang)} millions de dollars.`;
        }
    };
    const chartData = useMemo(() => {
        if (!currentYearData) return null;

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

        provincial_gdp_PROVINCE_CODES.forEach(code => {
            const value = currentYearData[code] || 0;
            const info = provincial_gdp_PROVINCE_INFO[code];
            const name = lang === 'en' ? info.nameEn : info.nameFr;
            const abbrev = lang === 'en' ? info.abbrevEn : info.abbrevFr;

            values.push(value);
            hoverTexts.push(`<b>${name}</b><br>$${formatProvincialGdpNumber(value, lang)}M`);
            geoJsonNames.push(info.geoJsonName);
            const centroid = provincial_gdp_PROVINCE_CENTROIDS[code];
            const latOffset = windowWidth <= 480 ? (highZoomOffsets[code] || 0) : 0;
            labelLats.push(centroid.lat + latOffset);
            labelLons.push(centroid.lon);
            labelTexts.push(`${abbrev}\n${formatProvincialGdpNumber(value, lang)}`);
        });

        return { values, hoverTexts, labelLats, labelLons, labelTexts, geoJsonNames };
    }, [currentYearData, lang, windowWidth]);
    const { mapScale, mapCenter } = useMemo(() => {
        const scale = (windowWidth > 960 && windowWidth <= 1097) ? 2 : 2.2;
        return { 
            mapScale: scale, 
            mapCenter: { lon: -96, lat: 64 } 
        };
    }, [windowWidth]);

    if (loading || error) {
        return (
            <main className="page-content page-8" role="main">
                <PageStatus
                    lang={lang}
                    loading={loading}
                    error={error}
                    style={{ padding: '40px', textAlign: 'center' }}
                />
            </main>
        );
    }


    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd), name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
    });

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-8" 
            role="main"
            aria-label={getText('provincial_gdp_title', lang)}
            style={{
                backgroundColor: 'white',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',
                boxSizing: 'border-box',
            }}
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

                .page-8 {
                    margin-left: -${layoutPadding?.left || 55}px;
                    width: calc(100% + ${layoutPadding?.left || 55}px);
                    padding-left: ${layoutPadding?.left || 55}px; 
                }

                .provincial-gdp-container {
                    width: 100%;
                    padding: 20px 0;
                    display: flex;
                    flex-direction: column;
                }

                .provincial-gdp-header {
                    margin-bottom: 20px;
                }

                .provincial-gdp-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 41px;
                    font-weight: bold;
                    color: var(--gc-text);
                    margin-top: 0;
                    margin-bottom: 25px;
                    position: relative;
                    padding-bottom: 0.5em;
                }

                .provincial-gdp-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }

                .provincial-gdp-subtitle {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: var(--gc-text);
                    margin-top: 0;
                    margin-bottom: 20px;
                    white-space: pre-line;
                }

                .provincial-gdp-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    margin-top: 0;
                    margin-bottom: 20px;
                    box-sizing: border-box;
                }
                .provincial-gdp-chart-frame .provincial-gdp-chart-title-block {
                    margin-bottom: 20px;
                }
                .provincial-gdp-chart-frame .provincial-gdp-chart-title-block h1 {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: var(--gc-text);
                    margin: 0 0 0.25em 0;
                    white-space: pre-line;
                }
                .provincial-gdp-chart-frame .provincial-gdp-chart-title-block .provincial-gdp-subtitle {
                    margin: 0;
                }
                .provincial-gdp-chart-frame .provincial-gdp-chart-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: var(--gc-text);
                    text-align: center;
                    margin: 0 0 1em 0;
                    white-space: pre-line;
                }

                .provincial-gdp-year-selector {
                    display: flex;
                    align-items: center;
                    margin: 10px 0;
                    padding: 2px 0;
                    position: relative;
                    z-index: 10;
                }

                .provincial-gdp-year-label {
                    font-weight: bold;
                    margin-right: 15px;
                    font-size: 20px;
                    font-family: 'Noto Sans', sans-serif;
                    white-space: nowrap;
                }

                .custom-dropdown {
                    position: relative;
                    display: inline-block;
                }

                .dropdown-button {
                    padding: 8px 35px 8px 12px;
                    font-size: 20px;
                    font-family: 'Noto Sans', sans-serif;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    background-color: #fff;
                    cursor: pointer;
                    min-width: 100px;
                    text-align: left;
                    position: relative;
                }

                .dropdown-button:hover {
                    border-color: #007bff;
                }

                .dropdown-button:focus {
                    outline: 2px solid #005fcc;
                    outline-offset: 2px;
                    border-color: #007bff;
                }

                .dropdown-arrow {
                    position: absolute;
                    right: 10px;
                    top: 50%;
                    transform: translateY(-50%);
                    font-size: 10px;
                    pointer-events: none;
                }

                .dropdown-list {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    width: 100%;
                    margin: 0;
                    padding: 0;
                    list-style: none;
                    border: 1px solid #ccc;
                    border-top: none;
                    border-radius: 0 0 4px 4px;
                    background-color: #fff;
                    max-height: 200px;
                    overflow-y: auto;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    z-index: 1000;
                }

                .dropdown-list:focus {
                    outline: 2px solid #005fcc;
                    outline-offset: -2px;
                }

                .dropdown-option {
                    padding: 8px 12px;
                    cursor: pointer;
                    border-bottom: 1px solid #eee;
                }

                .dropdown-option:last-child {
                    border-bottom: none;
                }

                .dropdown-option.focused {
                    background-color: #005fcc;
                    color: #fff;
                }

                .dropdown-option.selected {
                    font-weight: bold;
                }

                .dropdown-option:hover {
                    background-color: #005fcc;
                    color: #fff;
                }

                .provincial-gdp-map-container {
                    position: relative;
                    width: 100%;
                    min-width: 600px;
                    height: 650px;
                    margin-left: auto;
                    margin-right: auto;
                    margin-top: 0;
                    margin-bottom: 0;
                    overflow: visible;
                    z-index: 1;
                    pointer-events: none;
                }

                .provincial-gdp-map-container .js-plotly-plot,
                .provincial-gdp-map-container button,
                .provincial-gdp-map-container div[role="button"] {
                    pointer-events: auto;
                }

                .provincial-gdp-clear-btn:hover {
                    background-color: #404040 !important;
                }

                @media (max-width: 1100px) {
                    .provincial-gdp-map-container {
                        width: 100%;
                        min-width: 0;
                        height: 700px;
                        margin-bottom: 0;
                    }
                }

                @media (max-width: 768px) {
                    .provincial-gdp-map-container {
                        margin-bottom: 0;
                        margin-top: 0;
                    }
                
                    .provincial-gdp-title {
                        font-size: 37px;
                    }
                    .provincial-gdp-subtitle {
                        font-size: 26px;
                    }
                    .provincial-gdp-chart-frame .provincial-gdp-chart-title {
                        font-size: 26px;
                    }
                    .provincial-gdp-year-label {
                        font-size: 18px;
                    }
                    .dropdown-button {
                        font-size: 18px;
                    }
                }
                

                @media (max-width: 640px) {
                    .page-8 { 
                        border-left: none !important; 
                        margin-left: 0;
                        width: 100%;
                        padding-left: 0;
                    }
                    .provincial-gdp-map-container {
                        width: 100%;
                        min-width: 0;
                        height: 450px;
                        margin-top: 0;
                        margin-bottom: 0;
                    }
                    .provincial-gdp-year-selector {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                    .provincial-gdp-year-label {
                        margin-bottom: 10px;
                        margin-right: 0;
                    }
                }

                @media (max-width: 480px) {
                    .provincial-gdp-map-container {
                        width: 140%;
                        margin-top: 0;
                        margin-left: -20% !important;
                        height: 400px;
                    }
                }

                .sr-only { 
                    position: absolute; 
                    width: 1px; 
                    height: 1px; 
                    padding: 0; 
                    margin: -1px; 
                    overflow: hidden; 
                    clip: rect(0, 0, 0, 0); 
                    white-space: nowrap; 
                    border: 0; 
                }

                .provincial-gdp-table-wrapper {
                    display: block;
                    width: 100%;
                    margin-top: 20px;
                }
            `}</style>
            <div className="provincial-gdp-container">
                <header 
                    className="provincial-gdp-header"
                    role="region"
                    aria-label={getText('provincial_gdp_title', lang)}
                    tabIndex="0"
                >
                    <h1 className="provincial-gdp-title" aria-hidden="true">
                        {getText('provincial_gdp_title', lang)}
                    </h1>
                </header>
                {/* Chart frame: chart title inside (centered), then year selector and chart */}
                <div className="provincial-gdp-chart-frame">
                    <h2 className="provincial-gdp-chart-title" aria-label={chartTitleSpoken}>
                        {chartTitleRaw.split('*')[0]}
                        {chartTitleRaw.includes('*') ? '\n' : ''}
                        {chartTitleRaw.split('*').slice(1).join('*')}
                        <span id="fn-asterisk-rf-provincial-gdp" style={{ verticalAlign: 'super', fontSize: '0.75em', lineHeight: '0', marginLeft: '0.15em' }}>
                            <a href="#fn-asterisk-provincial-gdp" onClick={scrollToFootnote} className="fn-lnk">
                                <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span><span aria-hidden="true">*</span>
                            </a>
                        </span>
                    </h2>
                <YearSelect
                    lang={lang}
                    id="provincial-gdp-year-select"
                    label={getText('year_slider_label', lang)}
                    years={yearsDescending}
                    value={year}
                    onChange={setYear}
                />
                    
                    <div role="status" className="wb-inv" aria-live="polite">
                        {year ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${year}` : ''}
                    </div>
                <div 
                    role="region" 
                    aria-label={getSRSummary()}
                    tabIndex="0"
                >
                    <figure ref={chartRef} className="provincial-gdp-map-container" style={{ margin: 0, position: 'relative' }}>
                    {selectedProvinces !== null && <ClearSelectionButton lang={lang} onClick={() => setSelectedProvinces(null)} />}
                    {chartData && (
                        <Plot
                            key={`map-${selectedProvinces ? selectedProvinces.join('-') : 'none'}`}
                            data={[
                                {
                                    type: 'choropleth',
                                    locationmode: 'geojson-id',
                                    geojson: 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/canada.geojson',
                                    featureidkey: 'properties.name',
                                    locations: chartData.geoJsonNames,
                                    z: chartData.values,
                                    text: provincial_gdp_PROVINCE_CODES.map((code, i) => {
                                        const info = provincial_gdp_PROVINCE_INFO[code];
                                        const name = lang === 'en' ? info.nameEn : info.nameFr;
                                        return `<b>${name}</b><br>${year}<br>$${formatProvincialGdpNumber(chartData.values[i], lang)}M`;
                                    }),
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
                                    lat: chartData.labelLats,
                                    lon: chartData.labelLons,
                                    text: provincial_gdp_PROVINCE_CODES.map((code, i) => {
                                        const info = provincial_gdp_PROVINCE_INFO[code];
                                        const abbrev = lang === 'en' ? info.abbrevEn : info.abbrevFr;
                                        if (windowWidth <= 480) {
                                            return `${abbrev}<br>${formatProvincialGdpNumber(chartData.values[i], lang)}`;
                                        }
                                        return `<b>${abbrev}</b><br><b>${formatProvincialGdpNumber(chartData.values[i], lang)}</b>`;
                                    }),
                                    textfont: {
                                        family: 'Arial, sans-serif',
                                        size: windowWidth <= 640 ? 12 : 14,
                                        color: selectedProvinces === null 
                                            ? '#000000' 
                                            : provincial_gdp_PROVINCE_CODES.map((_, i) => selectedProvinces.includes(i) ? '#333333' : hexToRgba('#333333', 0.3))
                                    },
                                    hoverinfo: 'text',
                                    hovertext: provincial_gdp_PROVINCE_CODES.map((code, i) => {
                                        const info = provincial_gdp_PROVINCE_INFO[code];
                                        const name = lang === 'en' ? info.nameEn : info.nameFr;
                                        return `<b>${name}</b><br>${year}<br>$${formatProvincialGdpNumber(chartData.values[i], lang)}M`;
                                    }),
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
                                margin: { l: 0, r: 0, t: 0, b: 0 },
                                height: 650,
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
                                        return; // Single tap: show hover label only
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
                            config={plotConfig}
                            style={{ width: '100%', height: '100%' }}
                        />
                    )}
                    </figure>
                </div>

                <div className="provincial-gdp-table-wrapper">
                    <ChartDataTable
                        lang={lang}
                        columns={tableColumns}
                        rows={tableRows}
                        csvFilename={`${tableFilenameBase}.csv`}
                        docx={{
                            filename: `${docxFilenameBase}.docx`,
                            title: getText('provincial_gdp_title', lang),
                            titleAlign: 'center',
                            columnWidths: docxColumnWidths,
                            fontSize: 20,
                        }}
                        caption={tableCaption}
                        tableAriaLabel={tableCaption}
                        renderCell={(raw, { colIndex }) => (
                            colIndex === 0 ? String(raw ?? '') : formatProvincialGdpNumber(raw, lang)
                        )}
                    />
                </div>
                </div> {/* End chart-frame */}
                <PageFootnotes
                    lang={lang}
                    titleId="fn"
                    items={[
                        {
                            id: 'fn-asterisk-provincial-gdp',
                            marker: '*',
                            text: getText('provincial_gdp_footnote', lang) + (year === 2024 ? getText('provincial_gdp_footnote_2024', lang) : ''),
                            returnHref: '#fn-asterisk-rf-provincial-gdp',
                        },
                    ]}
                />
            </div>
        </main>
    );
};

export default ProvincialGdp;
