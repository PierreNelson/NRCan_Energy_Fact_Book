import React, { useState, useEffect, useMemo, useRef } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import PageFootnotes from '../components/PageFootnotes';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useWindowWidth from '../hooks/useWindowWidth';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import YearSelect from '../components/YearSelect';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { getCEAData } from '../utils/dataLoader';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { saveDocxBlob, Document, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from '../utils/exportTableToDocx';

import { makeScrollToIdHandler } from '../utils/scrollToId';
import { formatLocalePct } from '../utils/formatLocale';

const canadian_energy_assets_REGION_DEFINITIONS = [
    { key: 'canada', nameEn: 'Canada', nameFr: 'Canada', color: '#48A36C', labelLat: 78, labelLon: -160 },
    { key: 'north_america', nameEn: 'U.S. and Mexico', nameFr: 'États-Unis et Mexique', color: '#48A36C', labelLat: 35, labelLon: -150 },
    { key: 'latin_america', nameEn: 'Americas (South and Central\nAmerica, Caribbean)', nameFr: 'Amériques (Amérique du Sud,\nAmérique centrale et Caraïbes)', color: '#f26721', labelLat: -18, labelLon: -120 },
    { key: 'europe', nameEn: 'Europe', nameFr: 'Europe', color: '#204897', labelLat: 48, labelLon: -32 },
    { key: 'africa', nameEn: 'Africa', nameFr: 'Afrique', color: '#AB9217', labelLat: -10, labelLon: -5 },
    { key: 'asia', nameEn: 'Asia', nameFr: 'Asie', color: '#a91e22', labelLat: 20, labelLon: 140 },
    { key: 'oceania', nameEn: 'Oceania', nameFr: 'Océanie', color: '#857550', labelLat: -25, labelLon: 90 }
];

const formatCEABillionSR = (num, lang) => {
    if (num === undefined || num === null) return '';
    const rounded = Math.round(num);
    return lang === 'en'
        ? `${rounded} billion dollars`
        : `${rounded} milliards de dollars`;
};

const CEA = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const [year, setYear] = useState(null);
    const [allData, setAllData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const scrollToFootnote = makeScrollToIdHandler('fn-asterisk-canadian-energy-assets');

    const scrollToRef = makeScrollToIdHandler('fn-asterisk-rf-canadian-energy-assets');
    const chartRef = useRef(null);

    const formatBillion = (num, useFrench = false) => {
        if (num === undefined || num === null) return '—';
        const rounded = Math.round(num * 10) / 10; // Round to 1 decimal
        if (useFrench) {
            // French format: "563,8 G$"
            return `${rounded.toString().replace('.', ',')} G$`;
        }
        // English format: "$563.8B"
        return `$${rounded}B`;
    };

    const formatPercent = (num) => formatLocalePct(num, lang, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });

    useEffect(() => {
        getCEAData()
            .then(data => {
                setAllData(data);
                if (data && data.length > 0) {
                    // Get the latest year, excluding 2012 (no previous year data)
                    const validYears = data.filter(d => d.year !== 2012);
                    if (validYears.length > 0) {
                        setYear(validYears[validYears.length - 1].year);
                    }
                }
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            })
            .finally(() => setLoading(false));
    }, []);

    

    const currentYearData = useMemo(() => {
        if (!year || !allData.length) return null;
        return allData.find(d => d.year === year);
    }, [year, allData]);

    const previousYearData = useMemo(() => {
        if (!year || !allData.length) return null;
        const prevYear = year - 1;
        return allData.find(d => d.year === prevYear);
    }, [year, allData]);

    const calculatedValues = useMemo(() => {
        if (!currentYearData || !previousYearData) return null;

        const A1 = currentYearData.total || 0;
        const A2 = previousYearData.total || 0;
        const A3 = currentYearData.domestic || 0;
        const A4 = currentYearData.abroad || 0;
        const A5 = previousYearData.abroad || 0;

        const B1 = A2 > 0 ? ((A1 - A2) / A2) * 100 : 0;
        const B2 = previousYearData.domestic > 0 
            ? ((A3 - previousYearData.domestic) / previousYearData.domestic) * 100 
            : 0;

        return { A1, A2, A3, A4, A5, B1, B2 };
    }, [currentYearData, previousYearData]);

    const tableData = useMemo(() => {
        if (!allData || allData.length === 0) return [];
        return allData.filter(d => d.year !== 2012).sort((a, b) => a.year - b.year);
    }, [allData]);

    const yearsDescending = useMemo(
        () => tableData.map((d) => d.year).slice().sort((a, b) => b - a),
        [tableData],
    );

    const unitHeader = lang === 'en' ? '($ billions)' : '(G$)';
    const exportChartTitle = stripHtml(`${getText('canadian_energy_assets_chart_title', lang)} ${year ?? ''}`.trim());
    const chartDownloadSlug = lang === 'en' ? `canadian_energy_assets_${year}` : `actifs_energetiques_canadiens_${year}`;
    const tableCaption = lang === 'en'
        ? 'Canadian energy assets by region and year (values in billions of dollars)'
        : 'Actifs énergétiques canadiens par région et année (valeurs en milliards de dollars)';
    const csvFilename = lang === 'en' ? 'canadian_energy_assets.csv' : 'actifs_energetiques_canadiens.csv';
    const docxFilename = lang === 'en' ? 'canadian_energy_assets.docx' : 'actifs_energetiques_canadiens.docx';

    const tableColumns = useMemo(() => [
        { key: 'year', header: lang === 'en' ? 'Year' : 'Année', align: 'left' },
        ...canadian_energy_assets_REGION_DEFINITIONS.map((r) => ({
            key: r.key,
            header: `${(lang === 'en' ? r.nameEn : r.nameFr).replace(/\n/g, ' ')} ${unitHeader}`,
            align: 'num',
        })),
    ], [lang, unitHeader]);

    const formatTableValue = (num) => {
        if (num === undefined || num === null || num === '') return '—';
        return Number(num).toFixed(1);
    };

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${chartDownloadSlug}.png`,
        title: exportChartTitle,
        width: 1400,
        height: 900,
    }),
        [chartDownloadSlug, exportChartTitle],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const downloadTableAsDocx = async () => {
        if (!tableData || tableData.length === 0) return;

        const years = tableData.map(d => d.year);
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        const title = `${getText('canadian_energy_assets_chart_title', lang)} ${minYear} ${lang === 'en' ? 'to' : 'à'} ${maxYear}`;
        const regionKeys = canadian_energy_assets_REGION_DEFINITIONS.map(r => r.key);

        const unitRow = new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({ children: [] })],
                    shading: { fill: 'E6E6E6' }
                }),
                new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({ text: unitHeader, bold: true, size: 22 })],
                        alignment: AlignmentType.CENTER
                    })],
                    shading: { fill: 'E6E6E6' },
                    columnSpan: canadian_energy_assets_REGION_DEFINITIONS.length
                })
            ]
        });

        const headerRow = new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({ text: lang === 'en' ? 'Year' : 'Année', bold: true, size: 22 })],
                        alignment: AlignmentType.CENTER
                    })],
                    shading: { fill: 'E6E6E6' }
                }),
                ...canadian_energy_assets_REGION_DEFINITIONS.map(r => new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({ 
                            text: lang === 'en' ? r.nameEn.replace(/\n/g, ' ') : r.nameFr.replace(/\n/g, ' '), 
                            bold: true, 
                            size: 22 
                        })],
                        alignment: AlignmentType.CENTER
                    })],
                    shading: { fill: 'E6E6E6' }
                }))
            ]
        });

        const dataRows = tableData.map(yearData => new TableRow({
            children: [
                new TableCell({ 
                    children: [new Paragraph({ 
                        children: [new TextRun({ text: String(yearData.year), size: 22 })], 
                        alignment: AlignmentType.CENTER 
                    })] 
                }),
                ...regionKeys.map(key => new TableCell({ 
                    children: [new Paragraph({ 
                        children: [new TextRun({ 
                            text: yearData[key] ? yearData[key].toFixed(1) : '—', 
                            size: 22 
                        })], 
                        alignment: AlignmentType.RIGHT 
                    })] 
                }))
            ]
        }));

        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: title, bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 }
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [1200, 1300, 1300, 1300, 1300, 1300, 1300, 1300],
                        rows: [unitRow, headerRow, ...dataRows]
                    })
                ]
            }]
        });

        await saveDocxBlob(docxFilename, doc);
    };

    // ISO-3 country codes for each region (excluding Antarctica)
    const regionCountryCodes = useMemo(() => ({
        canada: ['CAN'],
        north_america: ['USA', 'MEX'],
        latin_america: [
            'GTM', 'BLZ', 'SLV', 'HND', 'NIC', 'CRI', 'PAN', // Central America
            'CUB', 'JAM', 'HTI', 'DOM', 'PRI', 'TTO', 'BHS', 'BRB', 'GRD', 'ATG', 'DMA', 'KNA', 'LCA', 'VCT', // Caribbean
            'COL', 'VEN', 'GUY', 'SUR', 'ECU', 'PER', 'BRA', 'BOL', 'PRY', 'URY', 'ARG', 'CHL', 'GUF' // South America
        ],
        europe: [
            'ISL', 'NOR', 'SWE', 'FIN', 'DNK', 'GBR', 'IRL', 'NLD', 'BEL', 'LUX', 'FRA', 'ESP', 'PRT', 'AND',
            'DEU', 'AUT', 'CHE', 'LIE', 'ITA', 'SMR', 'VAT', 'MLT', 'POL', 'CZE', 'SVK', 'HUN', 'SVN', 'HRV',
            'BIH', 'SRB', 'MNE', 'MKD', 'ALB', 'GRC', 'BGR', 'ROU', 'MDA', 'UKR', 'BLR', 'LTU', 'LVA', 'EST', 
            'TUR', 'CYP', 'GRL', 'SJM'
        ],
        africa: [
            'MAR', 'DZA', 'TUN', 'LBY', 'EGY', 'ESH', 'MRT', 'MLI', 'NER', 'TCD', 'SDN', 'ERI', 'DJI', 'SOM',
            'SEN', 'GMB', 'GNB', 'GIN', 'SLE', 'LBR', 'CIV', 'BFA', 'GHA', 'TGO', 'BEN', 'NGA', 'CMR', 'CAF',
            'SSD', 'ETH', 'UGA', 'KEN', 'RWA', 'BDI', 'TZA', 'COD', 'COG', 'GAB', 'GNQ', 'AGO', 'ZMB', 'MWI',
            'MOZ', 'ZWE', 'BWA', 'NAM', 'ZAF', 'SWZ', 'LSO', 'MDG', 'MUS', 'COM', 'SYC'
        ],
        asia: [
            'AFG', 'PAK', 'IND', 'NPL', 'BTN', 'BGD', 'LKA', 'MDV', 'MMR', 'THA', 'LAO', 'VNM', 'KHM', 'MYS',
            'SGP', 'IDN', 'BRN', 'PHL', 'TWN', 'CHN', 'MNG', 'PRK', 'KOR', 'JPN', 'TJK', 'KGZ', 'UZB', 'TKM',
            'IRN', 'IRQ', 'SYR', 'JOR', 'ISR', 'PSE', 'LBN', 'SAU', 'YEM', 'OMN', 'ARE', 'QAT', 'BHR', 'KWT',
            'RUS', 'KAZ', 'AZE', 'GEO','ARM'
        ],
        oceania: [
            'AUS', 'NZL', 'PNG', 'FJI', 'SLB', 'VUT', 'NCL', 'WSM', 'TON', 'KIR', 'FSM', 'MHL', 'PLW', 'NRU', 'TUV'
        ]
    }), []);

    const regionData = useMemo(() => {
        if (!currentYearData) return [];

        return canadian_energy_assets_REGION_DEFINITIONS.map(region => ({
            ...region,
            value: currentYearData[region.key] || 0,
            countries: regionCountryCodes[region.key] || []
        })).filter(r => r.value > 0);
    }, [currentYearData, regionCountryCodes]);

    const mapData = useMemo(() => {
        if (!regionData.length) return [];

        // 1. Detect Zoom Level (Moved to top so we can use it for labels)
        const zoomLevel = typeof window !== 'undefined' ? Math.round(window.devicePixelRatio * 100) : 100;
        const isHighZoom = zoomLevel >= 200; // Covers 200%, 250%, 300%+

        // 2. Create choropleth traces
        const choroplethTraces = regionData.map(region => ({
            type: 'choropleth',
            locationmode: 'ISO-3',
            locations: region.countries,
            z: region.countries.map(() => 1), 
            colorscale: [[0, region.color], [1, region.color]],
            showscale: false,
            hoverinfo: 'skip',
            marker: {
                line: {
                    color: region.color,
                    width: 1
                }
            },
            name: lang === 'en' ? region.nameEn : region.nameFr,
            showlegend: false
        }));

        // 3. Create text annotations
        const textTrace = {
            type: 'scattergeo',
            mode: 'text',
            lat: regionData.map(r => r.labelLat),
            lon: regionData.map(r => r.labelLon),
            text: regionData.map(r => {
                const valueText = `<b>${formatBillion(r.value, lang === 'fr')}</b>`;
                let rawName = lang === 'en' ? r.nameEn : r.nameFr;

                // SPECIAL WRAPPING FOR HIGH ZOOM (300%)
                if (isHighZoom && lang === 'en') {
                    if (r.key === 'north_america') {
                        // "U.S. and /nMexico"
                        rawName = 'U.S. and\nMexico';
                    } else if (r.key === 'latin_america') {
                        // "Americas (South and /nCentral America, /nCaribbean)"
                        rawName = 'Americas (South \nand Central\n America, Caribbean)';
                    }
                }

                // Replace all newlines with HTML breaks
                const regionName = rawName.replace(/\n/g, '<br>');
                return `${valueText}<br>${regionName}`;
            }),
            textfont: {
                size: windowWidth <= 768 ? 12 : 14,
                color: '#000000',
                family: 'Arial, sans-serif'
            },
            hoverinfo: 'skip',
            showlegend: false
        };

        // 4. Correction Dot for Big Diomede Island (Russia)
        const islandMaskTrace = {
            type: 'scattergeo',
            mode: 'markers',
            lat: [65.78], 
            lon: [-173.0], 
            marker: {
                size: 25,         
                color: '#f5f5f5', 
                opacity: 1,
                symbol: 'circle'
            },
            hoverinfo: 'skip',
            showlegend: false
        };

        // 5. Extra White Hider (Right of Russia)
        const extraWhiteMask = {
            type: 'scattergeo',
            mode: 'markers',
            lat: [54.0],   
            lon: [185.0], 
            marker: {
                size: 55,       
                color: '#f5f5f5', 
                opacity: 1,
                symbol: 'circle'
            },
            hoverinfo: 'skip',
            showlegend: false
        };

        // 6. Kaliningrad Correction
        const kaliningradMask = {
            type: 'scattergeo',
            mode: 'markers',
            lat: [54.8],    
            lon: [21.5],    
            marker: {
                size: 8,        
                color: '#204897', // Europe Blue
                opacity: 1,
                symbol: 'circle'
            },
            hoverinfo: 'skip',
            showlegend: false
        };
        
        // Return simplified traces for high zoom to prevent clutter
        if (isHighZoom) {
            return [...choroplethTraces, textTrace, kaliningradMask];
        }
        
        return [...choroplethTraces, textTrace, islandMaskTrace, extraWhiteMask, kaliningradMask];
    }, [regionData, lang, windowWidth]);

    const narrativeTextParts = useMemo(() => {
        if (!calculatedValues) return [];
        
        const isFr = lang === 'fr';
        const A1Text = formatBillion(calculatedValues.A1, isFr);
        const A2Text = formatBillion(calculatedValues.A2, isFr);
        const A3Text = formatBillion(calculatedValues.A3, isFr);
        const A4Text = formatBillion(calculatedValues.A4, isFr);
        const A5Text = formatBillion(calculatedValues.A5, isFr);
        const B1Text = formatPercent(calculatedValues.B1);
        const B2Text = formatPercent(calculatedValues.B2);

        if (lang === 'en') {
            return [
                'The total value of Canadian',
                <span key="fn-ref" id="fn-asterisk-rf-canadian-energy-assets" style={{ verticalAlign: 'super', fontSize: '0.75em', lineHeight: '0' }}><a className="fn-lnk" href="#fn-asterisk-canadian-energy-assets" onClick={scrollToFootnote}><span className="wb-inv">Footnote </span><span aria-hidden="true">*</span></a></span>,
                ' energy assets (CEA) went up in ',
                year.toString(),
                ' to ',
                A1Text,
                ', an increase of ',
                B1Text,
                ' from ',
                A2Text,
                ' in ',
                (year - 1).toString(),
                '. In ',
                year.toString(),
                ', domestic CEA totaled ',
                A3Text,
                ', up ',
                B2Text,
                ' from ',
                (year - 1).toString(),
                ', while CEA abroad totaled ',
                A4Text,
                ', up from ',
                A5Text,
                '.'
            ];
        } else {
            return [
                'La valeur totale des actifs énergétiques canadiens',
                <span key="fn-ref-fr" id="fn-asterisk-rf-canadian-energy-assets" style={{ verticalAlign: 'super', fontSize: '0.75em', lineHeight: '0' }}><a className="fn-lnk" href="#fn-asterisk-canadian-energy-assets" onClick={scrollToFootnote}><span className="wb-inv">Note de bas de page </span><span aria-hidden="true">*</span></a></span>,
                ' (AEC) a augmenté en ',
                year.toString(),
                ' pour s\'établir à ',
                A1Text,
                ', une hausse de ',
                B1Text,
                ' par rapport à ',
                A2Text,
                ' en ',
                (year - 1).toString(),
                '. En ',
                year.toString(),
                ', les ACE nationales ont totalisé ',
                A3Text,
                ', en hausse de ',
                B2Text,
                ' par rapport à ',
                (year - 1).toString(),
                ', tandis que les ACE à l\'étranger ont totalisé ',
                A4Text,
                ', contre ',
                A5Text,
                '.'
            ];
        }
    }, [calculatedValues, year, lang]);

    const narrativeTextSR = useMemo(() => {
        if (!calculatedValues) return '';
        
        const A1Text = formatCEABillionSR(calculatedValues.A1, lang);
        const A2Text = formatCEABillionSR(calculatedValues.A2, lang);
        const A3Text = formatCEABillionSR(calculatedValues.A3, lang);
        const A4Text = formatCEABillionSR(calculatedValues.A4, lang);
        const A5Text = formatCEABillionSR(calculatedValues.A5, lang);

        if (lang === 'en') {
            return `The total value of Canadian energy assets (CEA) went up in ${year} to ${A1Text}, an increase of ${calculatedValues.B1.toFixed(1)} percent from ${A2Text} in ${year - 1}. In ${year}, domestic CEA totaled ${A3Text}, up ${calculatedValues.B2.toFixed(1)} percent from ${year - 1}, while CEA abroad totaled ${A4Text}, up from ${A5Text}.`;
        } else {
            return `La valeur totale des actifs énergétiques canadiens (AEC) a augmenté en ${year} pour atteindre ${A1Text}, une hausse de ${calculatedValues.B1.toFixed(1)} pour cent par rapport à ${A2Text} en ${year - 1}. En ${year}, les AEC nationaux ont totalisé ${A3Text}, en hausse de ${calculatedValues.B2.toFixed(1)} pour cent par rapport à ${year - 1}, tandis que les AEC à l'étranger ont totalisé ${A4Text}, comparativement à ${A5Text}.`;
        }
    }, [calculatedValues, year, lang]);

    if (loading || error) {
        return (
            <PageShell tabIndex="-1" className="page-content page-33 page-chrome page-chrome--bleed" style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}>
                <PageStatus
                    lang={lang}
                    loading={loading}
                    error={error}
                    loadingMessage={lang === 'en' ? 'Loading data...' : 'Chargement des données...'}
                    style={{ padding: '40px', textAlign: 'center' }}
                />
            </PageShell>
        );
    }

    if (!currentYearData || !calculatedValues) {
        return (
            <PageShell tabIndex="-1" className="page-content page-33 page-chrome page-chrome--bleed" style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}>
                <div className="canadian-energy-assets-container">
                    <header>
                        <h1 className="canadian-energy-assets-title">
                            {getText('canadian_energy_assets_title', lang)}
                        </h1>
                    </header>
                    <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                        <p style={{ fontSize: '1.2rem', marginBottom: '10px' }}>
                            {lang === 'en' ? 'No data available' : 'Aucune donnée disponible'}
                        </p>
                        <p style={{ fontSize: '1rem' }}>
                            {lang === 'en' 
                                ? 'Please run the data retrieval script to process CEA data from CEA_2023.xlsx'
                                : 'Veuillez exécuter le script de récupération de données pour traiter les données AEC à partir de CEA_2023.xlsx'}
                        </p>
                    </div>
                </div>
            </PageShell>
        );
    }

    return (
        <PageShell 
            tabIndex="-1"
            className="page-content page-33 page-chrome page-chrome--bleed" 
            aria-labelledby="canadian-energy-assets-title"
            style={{backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding)}}
        >
            <style>{`
                .page-33 {
                    width: 100%;
                }

                .canadian-energy-assets-container {
                    width: 100%;
                    box-sizing: border-box;
                }

                .canadian-energy-assets-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 50px;
                    font-weight: bold;
                    margin-top: 0;
                    margin-bottom: 25px;
                    color: #8a7d5a;
                    margin: 30px 0 20px 0;
                    line-height: 1.2;
                    position: relative;
                    padding-bottom: 0.5em;
                }

                .canadian-energy-assets-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }

                .canadian-energy-assets-narrative {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    line-height: 1.6;
                    color: var(--gc-text);
                    margin-bottom: 20px;
                }

                .canadian-energy-assets-narrative strong {
                    font-weight: bold;
                }

                .canadian-energy-assets-map-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: var(--gc-text);
                    text-align: center;
                    margin: 0 0 10px 0;
                }

                .canadian-energy-assets-content-wrapper {
                    display: flex;
                    flex-direction: row;
                    justify-content: space-between; 
                    gap: 0;
                    margin-top: 20px;
                    position: relative;
                    z-index: 1;
                    overflow: visible;
                }
                
                .canadian-energy-assets-content-wrapper::after {
                    content: '';
                    display: table;
                    clear: both;
                }

                .canadian-energy-assets-map-container {
                    flex: 1;
                    position: relative;
                    overflow: hidden;
                    min-height: 300px;
                    display: block; 
                }
                
                .canadian-energy-assets-map-container .js-plotly-plot {
                    max-width: 90%;
                }
                
                .canadian-energy-assets-map-container .plot-container,
                .canadian-energy-assets-map-container .svg-container {
                    max-width: 100% !important;
                }

                .canadian-energy-assets-stats-container {
                    width: 280px;
                    flex-shrink: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    padding-top: 0;         
                    margin-left: auto;      
                    align-items: flex-end;  
                    box-sizing: border-box;
                }

                .canadian-energy-assets-stat {
                    text-align: right;
                }

                .canadian-energy-assets-stat-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: var(--gc-text);
                    margin-bottom: 5px;
                    line-height: 1.3;
                    white-space: nowrap;
                }

                .canadian-energy-assets-stat-value {
                    font-family: 'Lato', sans-serif;
                    font-size: 2.2rem;
                    font-weight: bold;
                    color: #857550;
                }

                .canadian-energy-assets-footnote {
                    font-family: var(--font-body);
                    font-size: 1rem;
                    color: var(--gc-text);
                    margin: 0;
                    line-height: 1.65;
                }
                
                .canadian-energy-assets-footnote-container {
                    position: relative;
                    z-index: 5;
                    background-color: white;
                    margin-top: 2rem;
                    margin-bottom: 0;
                }
                
                .canadian-energy-assets-footnote-container dl {
                    display: flex;
                    flex-wrap: wrap;
                    margin: 0;
                }
                
                .canadian-energy-assets-footnote-container dt {
                    margin-right: 4px;
                    font-size: 0.9rem;
                    color: var(--gc-text);
                    font-family: var(--font-body);
                }
                
                .canadian-energy-assets-footnote-container dd {
                    margin: 0;
                    flex: 1;
                }

                .year-selector {
                    display: flex;
                    align-items: center;
                    margin: 10px 0;
                    padding: 2px 0;
                    position: relative;
                    z-index: 100;
                }

                .year-selector label {
                    font-weight: bold;
                    margin-right: 15px;
                    font-size: 18px;
                    font-family: Arial, sans-serif;
                }

                .custom-dropdown {
                    position: relative;
                    display: inline-block;
                }

                .dropdown-button {
                    padding: 8px 35px 8px 12px;
                    font-size: 16px;
                    font-family: Arial, sans-serif;
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

                @media (max-width: 1100px) {
                    .canadian-energy-assets-content-wrapper {
                        flex-direction: column;
                    }
                    
                    .canadian-energy-assets-map-container {
                        flex: none;      
                        width: 100%;     
                        height: auto;    
                        margin-bottom: 30px; 
                        display: block;  
                    }

                    .canadian-energy-assets-map-container .js-plotly-plot {
                        max-width: 100%;
                    }

                    .canadian-energy-assets-stats-container {
                        width: 100%;
                        flex-direction: row;
                        justify-content: flex-start;
                        gap: 40px;
                        padding-top: 10px;
                        margin-right: 0;
                        padding-right: 0;
                    }
                    .canadian-energy-assets-stat {
                        text-align: left;
                    }
                }

                @media (max-width: 768px) {
                    .canadian-energy-assets-title {
                        font-size: 37px;
                    }
                    .canadian-energy-assets-narrative {
                        font-size: 18px;
                    }
                    .canadian-energy-assets-map-title {
                        font-size: 26px;
                    }
                    .canadian-energy-assets-stat-title {
                        font-size: 26px;
                    }
                    .canadian-energy-assets-footnote {
                        font-size: 0.9rem;
                    }
                }

                @media (max-width: 640px) {
                    .canadian-energy-assets-content-wrapper {
                        flex-direction: column;
                    }
                    
                    .canadian-energy-assets-map-container {
                        flex: none;      
                        width: 100%;     
                        height: auto;    
                        margin-bottom: 30px; 
                        display: block;  
                    }

                    .canadian-energy-assets-stats-container {
                        width: 100%;
                        /* Stack vertically */
                        flex-direction: column; 
                        /* Align left */
                        align-items: flex-start;
                        justify-content: flex-start;
                        gap: 20px; 
                        padding-top: 10px;
                        margin-right: 0;
                        padding-right: 0;
                    }
                    
                    .canadian-energy-assets-stat {
                        text-align: left;
                    }
                }

                .canadian-energy-assets-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    box-sizing: border-box;
                }

                .canadian-energy-assets-table-wrapper {
                    display: block;
                    width: 100%;
                    margin-top: 20px;
                }
            `}</style>

            <div className="canadian-energy-assets-container">
                <header>
                    <h1 id="canadian-energy-assets-title" className="canadian-energy-assets-title">
                        {getText('canadian_energy_assets_title', lang)}
                    </h1>
                </header>

                <div className="canadian-energy-assets-chart-frame">
                {/* SINGLE-SELECT RADIO DROPDOWN */}
                <YearSelect
                    lang={lang}
                    id="canadian-energy-assets-year-select"
                    label={getText('year_slider_label', lang)}
                    years={yearsDescending}
                    value={year}
                    onChange={setYear}
                />
                <div role="status" className="wb-inv" aria-live="polite">
                    {year ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${year}` : ''}
                </div>

                <p className="canadian-energy-assets-narrative" role="region" aria-label={narrativeTextSR}>
                    {narrativeTextParts.map((part, i) => {
                        // If part is a JSX element (the footnote sup), render it accessible
                        if (typeof part !== 'string') {
                            return <React.Fragment key={i}>{part}</React.Fragment>;
                        }
                        // Text parts are hidden from screen reader (aria-label provides the text)
                        if (part.match(/^\$[\d.]+B$/) || part.match(/^[\d,]+ G\$$/) || part.match(/^\d+\.\d+%$/)) {
                            return <strong key={i} aria-hidden="true">{part}</strong>;
                        }
                        return <span key={i} aria-hidden="true">{part}</span>;
                    })}
                </p>

                <div className="canadian-energy-assets-content-wrapper">
                    <div className="canadian-energy-assets-map-container">
                    <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: '10px' }}>
                        <h2 
                            className="canadian-energy-assets-map-title" 
                            style={{ margin: 0, textAlign: 'center' }}
                            aria-label={`${stripHtml(getText('canadian_energy_assets_map_title', lang))} ${year}`}
                            tabIndex="0"
                        >
                            <span aria-hidden="true">{getText('canadian_energy_assets_map_title', lang)} {year}</span>
                        </h2>
                    </div>
                        {}
                        <div 
                            ref={chartRef} 
                            style={{ 
                                position: 'relative', 
                                width: '100%', 
                                height: windowWidth <= 768 ? '400px' : '500px' 
                            }}
                        >
                            <div role="region" aria-label={getText('canadian_energy_assets_chart_summary', lang)} tabIndex="0">
                                <figure style={{ margin: 0, position: 'relative' }} aria-hidden="true">
                                    <Plot
                                        data={mapData}
                                        layout={{
                                            geo: {
                                                scope: 'world',
                                                projection: {
                                                    type: 'natural earth'
                                                },
                                                showframe: false,
                                                showland: true,
                                                landcolor: '#e8e8e8',
                                                showcountries: false,
                                                showcoastlines: true,
                                                coastlinecolor: '#999999',
                                                showlakes: false,
                                                showocean: false,
                                                bgcolor: 'rgba(0,0,0,0)',
                                                lataxis: { range: [-55, 85] },
                                                lonaxis: { range: [-170, 180] },
                                                fitbounds: false
                                            },
                                            margin: { l: 0, r: 0, t: 0, b: 0 },
                                            height: windowWidth <= 768 ? 400 : 500,
                                            dragmode: false,
                                            paper_bgcolor: 'rgba(0,0,0,0)',
                                            plot_bgcolor: 'rgba(0,0,0,0)',
                                            showlegend: false
                                        }}
                                        config={plotConfig}
                                        useResizeHandler={true}
                                        style={{ width: '100%', height: '100%' }}
                                    />
                                </figure>
                            </div>
                        </div>
                    </div>

                    <div 
                        className="canadian-energy-assets-stats-container" 
                        role="region" 
                        aria-label={`${getText('canadian_energy_assets_card_total', lang)}: ${formatCEABillionSR(calculatedValues.A1, lang)}. ${getText('canadian_energy_assets_card_abroad', lang)}: ${formatCEABillionSR(calculatedValues.A4, lang)}.`} 
                        tabIndex="0"
                    >
                        <div className="canadian-energy-assets-stat">
                            <div className="canadian-energy-assets-stat-title" aria-hidden="true">
                                {getText('canadian_energy_assets_card_total', lang)}
                            </div>
                            <div className="canadian-energy-assets-stat-value" aria-hidden="true">
                                {formatBillion(calculatedValues.A1, lang === 'fr')}
                            </div>
                        </div>
                        <div className="canadian-energy-assets-stat">
                            <div className="canadian-energy-assets-stat-title" aria-hidden="true">
                                {getText('canadian_energy_assets_card_abroad', lang)}
                            </div>
                            <div className="canadian-energy-assets-stat-value" aria-hidden="true">
                                {formatBillion(calculatedValues.A4, lang === 'fr')}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="canadian-energy-assets-table-wrapper">
                    <ChartDataTable
                        lang={lang}
                        columns={tableColumns}
                        rows={tableData}
                        csvFilename={csvFilename}
                        caption={tableCaption}
                        tableAriaLabel={tableCaption}
                        onDownloadDocx={downloadTableAsDocx}
                        renderCell={(raw, { colIndex }) => (
                            colIndex === 0 ? String(raw ?? '') : formatTableValue(raw)
                        )}
                    />
                </div>
                </div>

                <PageFootnotes
                    lang={lang}
                    titleId="fn"
                    items={[
                        { id: 'fn-asterisk-canadian-energy-assets', marker: '*', text: getText('canadian_energy_assets_footnote', lang), returnHref: '#fn-asterisk-rf-canadian-energy-assets' },
                    ]}
                />
            </div>
        </PageShell>
    );
};

export default CEA;
