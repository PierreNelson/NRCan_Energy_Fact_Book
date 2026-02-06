import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getCEAData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
const Page33 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [year, setYear] = useState(null);
    const [allData, setAllData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const scrollToFootnote = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-page33')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const scrollToRef = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-rf-page33')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const chartRef = useRef(null);
    
    // Custom dropdown state
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [focusedYear, setFocusedYear] = useState(null);
    const dropdownRef = useRef(null);
    const listRef = useRef(null);
    const buttonRef = useRef(null);

    const stripHtml = (text) => text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

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

    const formatBillionSR = (num) => {
        if (num === undefined || num === null) return '';
        const rounded = Math.round(num);
        return lang === 'en' 
            ? `${rounded} billion dollars` 
            : `${rounded} milliards de dollars`;
    };

    const formatPercent = (num) => {
        if (num === undefined || num === null) return '—';
        return `${num.toFixed(1)}%`;
    };

    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sync focusedYear when year changes or dropdown opens
    useEffect(() => {
        if (year) setFocusedYear(year);
    }, [year, isDropdownOpen]);

    // Auto-focus the list when dropdown opens
    useEffect(() => {
        if (isDropdownOpen && listRef.current) {
            listRef.current.focus();
        }
    }, [isDropdownOpen]);

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

    useEffect(() => {
        if (!chartRef.current) return;
        
        const setupChartAccessibility = () => {
            const plotContainer = chartRef.current;
            if (!plotContainer) return;

            const svgElements = plotContainer.querySelectorAll('.main-svg, .svg-container svg');
            svgElements.forEach(svg => {
                svg.setAttribute('aria-hidden', 'true');
            });

            const modebarButtons = plotContainer.querySelectorAll('.modebar-btn');
            modebarButtons.forEach(btn => {
                const dataTitle = btn.getAttribute('data-title');
                if (dataTitle && (dataTitle.includes('Download') || dataTitle.includes('Télécharger'))) {
                    btn.setAttribute('aria-label', dataTitle);
                    btn.setAttribute('role', 'button');
                    btn.setAttribute('tabindex', '0');
                    btn.removeAttribute('aria-hidden');
                } else {
                    btn.setAttribute('aria-hidden', 'true');
                    btn.setAttribute('tabindex', '-1');
                }
            });
        };

        const timer = setTimeout(setupChartAccessibility, 500);
        
        const observer = new MutationObserver(setupChartAccessibility);
        if (chartRef.current) {
            observer.observe(chartRef.current, { childList: true, subtree: true });
        }

        return () => {
            clearTimeout(timer);
            observer.disconnect();
        };
    }, [allData, lang]);

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

    const downloadChartWithTitle = async () => {
        const plotElement = chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement) {
            alert(lang === 'en' ? 'Could not find chart element. Please try again.' : 'Impossible de trouver l\'élément du graphique. Veuillez réessayer.');
            return;
        }

        const title = stripHtml(`${getText('page33_chart_title', lang)} ${year}`);

        try {
            if (!window.Plotly) {
                alert(lang === 'en' ? 'Plotly library not loaded. Please refresh the page and try again.' : 'La bibliothèque Plotly n\'est pas chargée. Veuillez actualiser la page et réessayer.');
                return;
            }

            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 1400,
                height: 900,
                scale: 2
            });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                const titleHeight = 80;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight;

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.fillStyle = '#333333';
                ctx.font = 'bold 36px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, canvas.width / 2, 50);

                ctx.drawImage(img, 0, titleHeight);

                const link = document.createElement('a');
                link.download = lang === 'en' ? `canadian_energy_assets_${year}.png` : `actifs_energetiques_canadiens_${year}.png`;
                link.href = canvas.toDataURL('image/png');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };

            img.src = imgData;
        } catch (error) {
            console.error('Error downloading chart:', error);
            alert(lang === 'en' ? 'Error downloading chart: ' + error.message : 'Erreur lors du téléchargement du graphique : ' + error.message);
        }
    };

    const tableData = useMemo(() => {
        if (!allData || allData.length === 0) return [];
        return allData.filter(d => d.year !== 2012).sort((a, b) => a.year - b.year);
    }, [allData]);

    const downloadTableAsCSV = () => {
        if (!tableData || tableData.length === 0) return;

        const regionKeys = regionDefinitions.map(r => r.key);
        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            ...regionDefinitions.map(r => lang === 'en' ? r.nameEn.replace(/\n/g, ' ') : r.nameFr.replace(/\n/g, ' '))
        ];

        const rows = tableData.map(yearData => [
            yearData.year,
            ...regionKeys.map(key => yearData[key] ? yearData[key].toFixed(1) : '—')
        ]);

        const csvContent = [
            headers.map(h => `"${h}"`).join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'canadian_energy_assets.csv' : 'actifs_energetiques_canadiens.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadTableAsDocx = async () => {
        if (!tableData || tableData.length === 0) return;

        const years = tableData.map(d => d.year);
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        const title = `${getText('page33_chart_title', lang)} ${minYear} ${lang === 'en' ? 'to' : 'à'} ${maxYear}`;
        const unitHeader = lang === 'en' ? '($ billions)' : '(G$)';
        const regionKeys = regionDefinitions.map(r => r.key);

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
                    columnSpan: regionDefinitions.length
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
                ...regionDefinitions.map(r => new TableCell({
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

        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'canadian_energy_assets.docx' : 'actifs_energetiques_canadiens.docx');
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

    // Region definitions with colors matching the reference image
    const regionDefinitions = useMemo(() => [
        { key: 'canada', nameEn: 'Canada', nameFr: 'Canada', color: '#48A36C', labelLat: 78, labelLon: -160 },
        { key: 'north_america', nameEn: 'U.S. and Mexico', nameFr: 'États-Unis et Mexique', color: '#48A36C', labelLat: 35, labelLon: -150 },
        { key: 'latin_america', nameEn: 'Americas (South and Central\nAmerica, Caribbean)', nameFr: 'Amériques (Amérique du Sud,\nAmérique centrale et Caraïbes)', color: '#f26721', labelLat: -18, labelLon: -120 },
        { key: 'europe', nameEn: 'Europe', nameFr: 'Europe', color: '#204897', labelLat: 48, labelLon: -32 },
        { key: 'africa', nameEn: 'Africa', nameFr: 'Afrique', color: '#AB9217', labelLat: -10, labelLon: -5 },
        { key: 'asia', nameEn: 'Asia', nameFr: 'Asie', color: '#a91e22', labelLat: 20, labelLon: 140 },
        { key: 'oceania', nameEn: 'Oceania', nameFr: 'Océanie', color: '#857550', labelLat: -25, labelLon: 90 }
    ], []);

    const regionData = useMemo(() => {
        if (!currentYearData) return [];

        return regionDefinitions.map(region => ({
            ...region,
            value: currentYearData[region.key] || 0,
            countries: regionCountryCodes[region.key] || []
        })).filter(r => r.value > 0);
    }, [currentYearData, regionDefinitions, regionCountryCodes]);

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
                color: '#ffffff', 
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
                color: '#ffffff', 
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
                <sup key="fn-ref" id="fn-asterisk-rf-page33"><a className="fn-lnk" href="#fn-asterisk-page33" onClick={scrollToFootnote} title="Footnote *"><span className="wb-inv">Footnote </span>*</a></sup>,
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
                <sup key="fn-ref-fr" id="fn-asterisk-rf-page33"><a className="fn-lnk" href="#fn-asterisk-page33" onClick={scrollToFootnote} title="Note de bas de page *"><span className="wb-inv">Note de bas de page </span>*</a></sup>,
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
        
        const A1Text = formatBillionSR(calculatedValues.A1);
        const A2Text = formatBillionSR(calculatedValues.A2);
        const A3Text = formatBillionSR(calculatedValues.A3);
        const A4Text = formatBillionSR(calculatedValues.A4);
        const A5Text = formatBillionSR(calculatedValues.A5);

        if (lang === 'en') {
            return `The total value of Canadian energy assets (CEA) went up in ${year} to ${A1Text}, an increase of ${calculatedValues.B1.toFixed(1)} percent from ${A2Text} in ${year - 1}. In ${year}, domestic CEA totaled ${A3Text}, up ${calculatedValues.B2.toFixed(1)} percent from ${year - 1}, while CEA abroad totaled ${A4Text}, up from ${A5Text}.`;
        } else {
            return `La valeur totale des actifs énergétiques canadiens (AEC) a augmenté en ${year} pour atteindre ${A1Text}, une hausse de ${calculatedValues.B1.toFixed(1)} pour cent par rapport à ${A2Text} en ${year - 1}. En ${year}, les AEC nationaux ont totalisé ${A3Text}, en hausse de ${calculatedValues.B2.toFixed(1)} pour cent par rapport à ${year - 1}, tandis que les AEC à l'étranger ont totalisé ${A4Text}, comparativement à ${A5Text}.`;
        }
    }, [calculatedValues, year, lang]);

    if (loading) {
        return (
            <main id="main-content" tabIndex="-1" className="page-content page-33" role="main">
                <div style={{ padding: '40px', textAlign: 'center' }}>
                    {lang === 'en' ? 'Loading data...' : 'Chargement des données...'}
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main id="main-content" tabIndex="-1" className="page-content page-33" role="main">
                <div style={{ padding: '40px', color: 'red' }}>
                    {lang === 'en' ? 'Error: ' : 'Erreur : '}{error}
                </div>
            </main>
        );
    }

    if (!currentYearData || !calculatedValues) {
        return (
            <main id="main-content" tabIndex="-1" className="page-content page-33" role="main">
                <div className="page33-container">
                    <header>
                        <h1 className="page33-title">
                            {getText('page33_title', lang)}
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
            </main>
        );
    }

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-33" 
            role="main"
            style={{
                backgroundColor: 'white',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <style>{`
                .page-33 {
                    width: calc(100% + ${layoutPadding?.left || 55}px + ${layoutPadding?.right || 15}px);
                    margin-left: -${layoutPadding?.left || 55}px;
                    margin-right: -${layoutPadding?.right || 15}px;
                }

                .page33-container {
                    padding-left: ${layoutPadding?.left || 55}px;
                    padding-right: ${layoutPadding?.right || 15}px;
                    width: 100%;
                    box-sizing: border-box;
                }

                .page33-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 41px;
                    font-weight: bold;
                    color: #8a7d5a;
                    margin: 30px 0 20px 0;
                    line-height: 1.2;
                    position: relative;
                    padding-bottom: 0.5em;
                }

                .page33-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }

                .page33-narrative {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    line-height: 1.6;
                    color: var(--gc-text);
                    margin-bottom: 20px;
                    max-width: 65ch;
                }

                .page33-narrative strong {
                    font-weight: bold;
                }

                .page33-map-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: var(--gc-text);
                    text-align: center;
                    margin: 0 0 10px 0;
                }

                .page33-content-wrapper {
                    display: flex;
                    flex-direction: row;
                    justify-content: space-between; 
                    gap: 0;
                    margin-top: 20px;
                    position: relative;
                    z-index: 1;
                }

                .page33-map-container {
                    flex: 1;
                    position: relative;
                    overflow: visible;
                    min-height: 300px;
                    display: block; 
                }
                
                .page33-map-container .js-plotly-plot {
                    max-width: 90%;
                }
                
                .page33-map-container .plot-container,
                .page33-map-container .svg-container {
                    max-width: 100% !important;
                }

                .page33-stats-container {
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

                .page33-stat {
                    text-align: right;
                }

                .page33-stat-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: var(--gc-text);
                    margin-bottom: 5px;
                    line-height: 1.3;
                    white-space: nowrap;
                }

                .page33-stat-value {
                    font-family: 'Lato', sans-serif;
                    font-size: 2.2rem;
                    font-weight: bold;
                    color: #857550;
                }

                .page33-footnote {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    color: #666;
                    margin: 0;
                    line-height: 1.5;
                    max-width: 65ch;
                }
                
                .page33-footnote-container {
                    position: relative;
                    z-index: 5;
                    background-color: white;
                    margin-top: 20px;
                }
                
                .page33-footnote-container dl {
                    display: flex;
                    flex-wrap: wrap;
                    margin: 0;
                }
                
                .page33-footnote-container dt {
                    margin-right: 4px;
                    font-size: 0.9rem;
                    color: #666;
                }
                
                .page33-footnote-container dd {
                    margin: 0;
                    flex: 1;
                }
                
                .data-table-wrapper {
                    margin-top: 20px;
                    position: relative;
                    z-index: 5;
                    background-color: white;
                }
                
                .data-table-wrapper summary {
                    cursor: pointer;
                    font-weight: bold;
                    padding: 10px;
                    background-color: #f5f5f5;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-family: Arial, sans-serif;
                    list-style: none;
                }
                
                .data-table-wrapper summary::-webkit-details-marker {
                    display: none;
                }
                
                .data-table-wrapper summary::marker {
                    display: none;
                }
                
                .data-table-wrapper summary:hover {
                    background-color: #e8e8e8;
                }
                
                .data-table-wrapper .table-responsive {
                    margin-top: 10px;
                    overflow-x: auto;
                    border: 1px solid #ddd;
                }
                
                .data-table-wrapper table {
                    width: 100%;
                    border-collapse: collapse;
                    font-family: Arial, sans-serif;
                    font-size: 0.9rem;
                }
                
                .data-table-wrapper th,
                .data-table-wrapper td {
                    padding: 8px 12px;
                    border: 1px solid #ddd;
                    text-align: right;
                }
                
                .data-table-wrapper th {
                    background-color: #f5f5f5;
                    font-weight: bold;
                }
                
                .data-table-wrapper th:first-child,
                .data-table-wrapper td:first-child {
                    text-align: left;
                }
                
                .data-table-wrapper tbody tr:nth-child(even) {
                    background-color: #fafafa;
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
                    .page33-content-wrapper {
                        flex-direction: column;
                    }
                    
                    .page33-map-container {
                        flex: none;      
                        width: 100%;     
                        height: auto;    
                        margin-bottom: 30px; 
                        display: block;  
                    }

                    .page33-map-container .js-plotly-plot {
                        max-width: 100%;
                    }

                    .page33-stats-container {
                        width: 100%;
                        flex-direction: row;
                        justify-content: flex-start;
                        gap: 40px;
                        padding-top: 10px;
                        margin-right: 0;
                        padding-right: 0;
                    }
                    .page33-stat {
                        text-align: left;
                    }
                }

                @media (max-width: 768px) {
                    .page33-title {
                        font-size: 37px;
                    }
                    .page33-narrative {
                        font-size: 18px;
                    }
                    .page33-map-title {
                        font-size: 26px;
                    }
                    .page33-stat-title {
                        font-size: 26px;
                    }
                    .page33-footnote {
                        font-size: 18px;
                    }
                }

                @media (max-width: 640px) {
                    .page33-content-wrapper {
                        flex-direction: column;
                    }
                    
                    .page33-map-container {
                        flex: none;      
                        width: 100%;     
                        height: auto;    
                        margin-bottom: 30px; 
                        display: block;  
                    }

                    .page33-stats-container {
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
                    
                    .page33-stat {
                        text-align: left;
                    }
                }
            `}</style>

            <div className="page33-container">
                <header>
                    <h1 className="page33-title">
                        {getText('page33_title', lang)}
                    </h1>
                </header>

                <div className="year-selector" ref={dropdownRef}>
                    <label id="year-label" aria-hidden="true">
                        {getText('year_slider_label', lang)}
                    </label>
                    <div id="year-instructions" className="wb-inv">
                        {lang === 'en' 
                            ? "Press Space to open the menu. Use the Up and Down arrow keys to navigate options. Press Enter to select a year." 
                            : "Appuyez sur Espace pour ouvrir le menu. Utilisez les flèches haut et bas pour naviguer. Appuyez sur Entrée pour sélectionner une année."}
                    </div>
                    <div className="custom-dropdown">
                        <button
                            ref={buttonRef}
                            type="button"
                            className="dropdown-button"
                            aria-haspopup="listbox"
                            aria-expanded={isDropdownOpen}
                            aria-label={`${getText('year_slider_label', lang)} ${year}`}
                            aria-describedby="year-instructions"
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            onKeyDown={(e) => {
                                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setIsDropdownOpen(true);
                                } else if (e.key === 'Escape') {
                                    setIsDropdownOpen(false);
                                }
                            }}
                        >
                            {year || '...'}
                            <span className="dropdown-arrow" aria-hidden="true">▼</span>
                        </button>
                        {isDropdownOpen && (
                            <ul
                                ref={listRef}
                                role="listbox"
                                aria-label={getText('year_slider_label', lang)}
                                aria-activedescendant={focusedYear ? `year-option-${focusedYear}` : undefined}
                                tabIndex={-1}
                                className="dropdown-list"
                                onKeyDown={(e) => {
                                    const validYears = allData.filter(d => d.year !== 2012);
                                    const currentIndex = validYears.findIndex(y => y.year === focusedYear);
                                    
                                    if (e.key === 'ArrowDown') {
                                        e.preventDefault();
                                        const nextIndex = Math.min(currentIndex + 1, validYears.length - 1);
                                        setFocusedYear(validYears[nextIndex].year);
                                    } else if (e.key === 'ArrowUp') {
                                        e.preventDefault();
                                        const prevIndex = Math.max(currentIndex - 1, 0);
                                        setFocusedYear(validYears[prevIndex].year);
                                    } else if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setYear(focusedYear);
                                        setIsDropdownOpen(false);
                                        if (buttonRef.current) buttonRef.current.focus();
                                    } else if (e.key === 'Escape') {
                                        setIsDropdownOpen(false);
                                        if (buttonRef.current) buttonRef.current.focus();
                                    } else if (e.key === 'Tab') {
                                        setIsDropdownOpen(false);
                                    } else if (e.key === 'Home') {
                                        e.preventDefault();
                                        setFocusedYear(validYears[0].year);
                                    } else if (e.key === 'End') {
                                        e.preventDefault();
                                        setFocusedYear(validYears[validYears.length - 1].year);
                                    }
                                }}
                            >
                                {allData.filter(d => d.year !== 2012).map((yearData) => (
                                    <li
                                        key={yearData.year}
                                        id={`year-option-${yearData.year}`}
                                        role="option"
                                        aria-selected={year === yearData.year}
                                        className={`dropdown-option ${focusedYear === yearData.year ? 'focused' : ''} ${year === yearData.year ? 'selected' : ''}`}
                                        onClick={() => {
                                            setYear(yearData.year);
                                            setIsDropdownOpen(false);
                                            if (buttonRef.current) buttonRef.current.focus();
                                        }}
                                        onMouseEnter={() => setFocusedYear(yearData.year)}
                                    >
                                        {yearData.year}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div role="status" className="wb-inv" aria-live="polite">
                        {year ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${year}` : ''}
                    </div>
                </div>

                <div className="page33-narrative" aria-label={narrativeTextSR}>
                    <span aria-hidden="true">
                        {narrativeTextParts.map((part, i) => {
                            // If part is not a string (e.g., JSX element), return it as-is
                            if (typeof part !== 'string') {
                                return <React.Fragment key={i}>{part}</React.Fragment>;
                            }
                            // Match English ($123.4B) or French (123,4 G$) currency formats, or percentage
                            if (part.match(/^\$[\d.]+B$/) || part.match(/^[\d,]+ G\$$/) || part.match(/^\d+\.\d+%$/)) {
                                return <strong key={i}>{part}</strong>;
                            }
                            return <React.Fragment key={i}>{part}</React.Fragment>;
                        })}
                    </span>
                </div>

                <div className="page33-content-wrapper">
                    <div className="page33-map-container">
                    <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: '10px' }}>
                        <h2 
                            className="page33-map-title" 
                            style={{ margin: 0, textAlign: 'center' }} // Remove margins so flex controls positioning
                        >
                            {getText('page33_map_title', lang)} {year}
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
                            <h2 className="wb-inv">{stripHtml(`${getText('page33_chart_title', lang)} ${year}`)}</h2>
                            <div role="region" aria-label={getText('page33_chart_summary', lang)}>
                                <figure style={{ margin: 0, position: 'relative' }}>
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
                                        config={{
                                            displayModeBar: true,
                                            displaylogo: false,
                                            responsive: true,
                                            scrollZoom: false,
                                            doubleClick: false,
                                            modeBarButtonsToRemove: ['select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'resetScale2d', 'toImage', 'resetGeo', 'pan2d', 'zoomin', 'zoomout'],
                                            modeBarButtonsToAdd: [{
                                                name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
                                                icon: {
                                                    width: 1000,
                                                    height: 1000,
                                                    path: 'm500 450c-83 0-150-67-150-150 0-83 67-150 150-150 83 0 150 67 150 150 0 83-67 150-150 150z m400 150h-120c-16 0-34 13-39 29l-31 93c-6 15-23 28-40 28h-340c-16 0-34-13-39-28l-31-94c-6-15-23-28-40-28h-120c-55 0-100-45-100-100v-450c0-55 45-100 100-100h800c55 0 100 45 100 100v450c0 55-45 100-100 100z m-400-550c-138 0-250 112-250 250 0 138 112 250 250 250 138 0 250-112 250-250 0-138-112-250-250-250z m365 380c-19 0-35 16-35 35 0 19 16 35 35 35 19 0 35-16 35-35 0-19-16-35-35-35z',
                                                    transform: 'matrix(1 0 0 -1 0 850)'
                                                },
                                                click: () => downloadChartWithTitle()
                                            }]
                                        }}
                                        useResizeHandler={true}
                                        style={{ width: '100%', height: '100%' }}
                                    />
                                </figure>
                            </div>
                        </div>
                    </div>

                    <div className="page33-stats-container">
                        <div className="page33-stat">
                            <div className="page33-stat-title">
                                {getText('page33_card_total', lang)}
                            </div>
                            <div className="page33-stat-value" aria-label={formatBillionSR(calculatedValues.A1)}>
                                <span aria-hidden="true">{formatBillion(calculatedValues.A1, lang === 'fr')}</span>
                            </div>
                        </div>
                        <div className="page33-stat">
                            <div className="page33-stat-title">
                                {getText('page33_card_abroad', lang)}
                            </div>
                            <div className="page33-stat-value" aria-label={formatBillionSR(calculatedValues.A4)}>
                                <span aria-hidden="true">{formatBillion(calculatedValues.A4, lang === 'fr')}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <details 
                    className="data-table-wrapper"
                    onToggle={(e) => setIsTableOpen(e.currentTarget.open)}
                >
                    <summary role="button" aria-expanded={isTableOpen}>
                        <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                        {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                        <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                    </summary>
                    <div className="table-responsive" role="region" aria-label={lang === 'en' ? 'Data Table' : 'Tableau de données'} tabIndex="0">
                        <table className="table table-striped table-hover">
                            <caption className="wb-inv">
                                {lang === 'en' 
                                    ? 'Canadian energy assets by region and year (values in billions of dollars)' 
                                    : 'Actifs énergétiques canadiens par région et année (valeurs en milliards de dollars)'}
                            </caption>
                            <thead>
                                <tr>
                                    <th scope="col" rowSpan={2} style={{ verticalAlign: 'bottom' }}>{lang === 'en' ? 'Year' : 'Année'}</th>
                                    <th scope="colgroup" colSpan={regionDefinitions.length} style={{ textAlign: 'center', fontWeight: 'bold' }}>
                                        <span aria-hidden="true">{lang === 'en' ? '($ billions)' : '(G$)'}</span>
                                        <span className="wb-inv">{lang === 'en' ? 'billions of dollars' : 'milliards de dollars'}</span>
                                    </th>
                                </tr>
                                <tr>
                                    {regionDefinitions.map(region => (
                                        <th key={region.key} scope="col" style={{ textAlign: 'right' }}>
                                            <span aria-hidden="true">{lang === 'en' ? region.nameEn.replace(/\n/g, ' ') : region.nameFr.replace(/\n/g, ' ')}</span>
                                            <span className="wb-inv">{lang === 'en' ? region.nameEn.replace(/\n/g, ' ') : region.nameFr.replace(/\n/g, ' ')}, {lang === 'en' ? 'billions of dollars' : 'milliards de dollars'}</span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {tableData.map(yearData => (
                                    <tr key={yearData.year}>
                                        <th scope="row">{yearData.year}</th>
                                        {regionDefinitions.map(region => (
                                            <td 
                                                key={region.key}
                                                style={{ textAlign: 'right' }}
                                                aria-label={`${yearData.year}, ${lang === 'en' ? region.nameEn.replace(/\n/g, ' ') : region.nameFr.replace(/\n/g, ' ')}: ${yearData[region.key] ? yearData[region.key].toFixed(1) : '—'} ${lang === 'en' ? 'billion dollars' : 'milliards de dollars'}`}
                                            >
                                                {yearData[region.key] ? yearData[region.key].toFixed(1) : '—'}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                        <button
                            onClick={() => downloadTableAsCSV()}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#f9f9f9',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontFamily: 'Arial, sans-serif',
                            fontWeight: 'bold',
                            color: 'var(--gc-text)'
                        }}
                    >
                        {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                    </button>
                    <button
                        onClick={() => downloadTableAsDocx()}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#f9f9f9',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontFamily: 'Arial, sans-serif',
                            fontWeight: 'bold',
                            color: 'var(--gc-text)'
                        }}
                        >
                            {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                        </button>
                    </div>
                </details>

                <aside className="wb-fnote" role="note">
                    <h2 id="fn">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt>{lang === 'en' ? 'Footnote *' : 'Note de bas de page *'}</dt>
                        <dd id="fn-asterisk-page33">
                            <a href="#fn-asterisk-rf-page33" onClick={scrollToRef} className="fn-num" title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}>
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                            </a>
                            <p>
                                {getText('page33_footnote', lang)}
                            </p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page33;
