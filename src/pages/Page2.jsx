import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getWorldEnergyProductionData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import capsuleGraphic from '../assets/page2_capsule_graphic.png';

const Page2 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [year, setYear] = useState(null);
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [isRankingsTableOpen, setIsRankingsTableOpen] = useState(false);
    const chartRef = useRef(null);
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const rankingsTopScrollRef = useRef(null);
    const rankingsTableScrollRef = useRef(null);

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [focusedYear, setFocusedYear] = useState(null);
    const dropdownRef = useRef(null);
    const listRef = useRef(null);
    const yearButtonRef = useRef(null);
    const chartDetailsRef = useRef(null);
    const rankingsDetailsRef = useRef(null);
    const contentWrapperRef = useRef(null);

    useEffect(() => {
        const handleDropdownClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleDropdownClickOutside);
        return () => document.removeEventListener('mousedown', handleDropdownClickOutside);
    }, []);

    useEffect(() => {
        if (year) setFocusedYear(year);
    }, [year, isDropdownOpen]);

    useEffect(() => {
        if (isDropdownOpen && listRef.current) {
            listRef.current.focus();
        }
    }, [isDropdownOpen]);

    useEffect(() => {
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;

        if (!topScroll || !tableScroll) return;

        const syncScrollbars = () => {
            const table = tableScroll.querySelector('table');
            if (!table) return;

            const scrollWidth = table.offsetWidth;
            const containerWidth = tableScroll.clientWidth;

            const topSpacer = topScroll.firstElementChild;
            if (topSpacer) {
                topSpacer.style.width = `${scrollWidth}px`;
            }

            if (scrollWidth > containerWidth) {
                topScroll.style.display = 'block';
                topScroll.style.opacity = '1';
            } else {
                topScroll.style.display = 'none';
            }
        };

        const handleTopScroll = () => {
            if (tableScroll.scrollLeft !== topScroll.scrollLeft) {
                tableScroll.scrollLeft = topScroll.scrollLeft;
            }
        };

        const handleTableScroll = () => {
            if (topScroll.scrollLeft !== tableScroll.scrollLeft) {
                topScroll.scrollLeft = tableScroll.scrollLeft;
            }
        };

        topScroll.addEventListener('scroll', handleTopScroll);
        tableScroll.addEventListener('scroll', handleTableScroll);

        const observer = new ResizeObserver(() => {
            window.requestAnimationFrame(syncScrollbars);
        });

        const tableElement = tableScroll.querySelector('table');
        if (tableElement) observer.observe(tableElement);
        observer.observe(tableScroll);

        syncScrollbars();

        return () => {
            topScroll.removeEventListener('scroll', handleTopScroll);
            tableScroll.removeEventListener('scroll', handleTableScroll);
            observer.disconnect();
        };
    }, [isTableOpen, windowWidth]);

    useEffect(() => {
        if (isTableOpen && chartDetailsRef.current) {
            setTimeout(() => {
                chartDetailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        } else if (!isTableOpen && !isRankingsTableOpen && contentWrapperRef.current) {
            setTimeout(() => {
                contentWrapperRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }, [isTableOpen]);

    useEffect(() => {
        if (isRankingsTableOpen && rankingsDetailsRef.current) {
            setTimeout(() => {
                rankingsDetailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        } else if (!isRankingsTableOpen && !isTableOpen && contentWrapperRef.current) {
            setTimeout(() => {
                contentWrapperRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }, [isRankingsTableOpen]);

    const stripHtml = (text) => text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

    const minYear = useMemo(() => pageData.length > 0 ? pageData[0].year : 2007, [pageData]);
    const maxYear = useMemo(() => pageData.length > 0 ? pageData[pageData.length - 1].year : 2023, [pageData]);

    const yearsList = useMemo(() => {
        return pageData.map(d => d.year);
    }, [pageData]);

    useEffect(() => {
        const handleResize = () => {
            const newWidth = window.innerWidth;
            setWindowWidth(newWidth);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        getWorldEnergyProductionData()
            .then(data => {
                setPageData(data);
                if (data && data.length > 0) {
                    setYear(data[data.length - 1].year);
                }
            })
            .catch(err => {
                console.error("Failed to load world energy production data:", err);
                setError(err.message || 'Failed to load data');
            })
            .finally(() => {
                setLoading(false);
            });
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
    }, [pageData, lang]);

    const currentYearData = useMemo(() => {
        if (!year || pageData.length === 0) return null;
        return pageData.find(d => d.year === year);
    }, [year, pageData]);

    const countryNameMap = {
        'china': 'page2_country_china',
        'united_states': 'page2_country_united_states',
        'india': 'page2_country_india',
        'canada': 'page2_country_canada',
        'indonesia': 'page2_country_indonesia',
        'australia': 'page2_country_australia',
        'brazil': 'page2_country_brazil',
        'norway': 'page2_country_norway',
        'mexico': 'page2_country_mexico',
        'south_africa': 'page2_country_south_africa',
        'colombia': 'page2_country_colombia',
        'united_kingdom': 'page2_country_united_kingdom',
        'egypt': 'page2_country_egypt',
        'argentina': 'page2_country_argentina',
    };

    const topProducers = useMemo(() => {
        if (!currentYearData) return [];
        
        const allCountries = Object.keys(countryNameMap)
            .map(key => {
                const pct = currentYearData[`${key}_pct`];
                if (pct === undefined || pct === null) return null;
                return {
                    key,
                    nameKey: countryNameMap[key],
                    name: getText(countryNameMap[key], lang),
                    pct: pct,
                    pctRounded: Math.round(pct),
                };
            })
            .filter(c => c !== null);

        return allCountries
            .sort((a, b) => b.pct - a.pct)
            .slice(0, 6);
    }, [currentYearData, lang]);

    const dynamicColumns = useMemo(() => {
        if (!pageData || pageData.length === 0) return [];

        const uniqueCountries = new Set();

        pageData.forEach(yearRow => {
            const yearCountries = Object.keys(countryNameMap)
                .map(key => ({
                    key,
                    pct: yearRow[`${key}_pct`] || 0
                }))
                .sort((a, b) => b.pct - a.pct)
                .slice(0, 6);

            yearCountries.forEach(c => uniqueCountries.add(c.key));
        });

        return Array.from(uniqueCountries);
    }, [pageData]);

    const canadaGrowth = currentYearData?.canada_growth_since_2005 || 42;
    const worldGrowth = currentYearData?.world_growth_since_2005 || 34;

    const rankingsData = [
        { resource: 'page2_crude_oil', reserves: 4, production: 4, exports: 3 },
        { resource: 'page2_uranium', reserves: 3, production: 2, exports: 2 },
        { resource: 'page2_hydroelectricity', reserves: 4, production: 3, exports: '-' },
        { resource: 'page2_electricity', reserves: 8, production: 7, exports: 3 },
        { resource: 'page2_coal', reserves: 19, production: 14, exports: 8 },
        { resource: 'page2_natural_gas', reserves: 10, production: 5, exports: 6 },
    ];

    const rankingsYearData = useMemo(() => {
        const years = [];
        for (let y = 2007; y <= 2024; y++) {
            years.push({
                year: y,
                crude_oil_reserves: 4,
                crude_oil_production: 4,
                crude_oil_exports: 3,
                uranium_reserves: 3,
                uranium_production: 2,
                uranium_exports: 2,
                hydroelectricity_reserves: 4,
                hydroelectricity_production: 3,
                hydroelectricity_exports: '-',
                electricity_reserves: 8,
                electricity_production: 7,
                electricity_exports: 3,
                coal_reserves: 19,
                coal_production: 14,
                coal_exports: 8,
                natural_gas_reserves: 10,
                natural_gas_production: 5,
                natural_gas_exports: 6,
            });
        }
        return years;
    }, []);

    const chartTitle = `${getText('page2_chart_title', lang)} - ${getText('page2_chart_subtitle', lang)}${year}`;

    const downloadTableAsCSV = () => {
        if (!pageData || pageData.length === 0) return;

        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            ...dynamicColumns.map(key => getText(countryNameMap[key], lang) + ' (%)')
        ];

        const rows = pageData.map(d => [
            d.year,
            ...dynamicColumns.map(key => {
                const val = d[`${key}_pct`];
                return val ? Math.round(val) : '';
            })
        ]);

        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'energy_production_data.csv' : 'donnees_production_energie.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadTableAsDocx = async () => {
        if (!pageData || pageData.length === 0) return;

        const title = stripHtml(getText('page2_chart_title', lang));

        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            ...dynamicColumns.map(key => getText(countryNameMap[key], lang) + ' (%)')
        ];

        const headerRow = new TableRow({
            children: headers.map(header => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: header, bold: true, size: 22 })],
                    alignment: AlignmentType.CENTER
                })],
                shading: { fill: 'E6E6E6' }
            }))
        });

        const dataRows = pageData.map(d => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(d.year), size: 22 })], alignment: AlignmentType.CENTER })] }),
                ...dynamicColumns.map(key => {
                    const val = d[`${key}_pct`];
                    return new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: val ? `${Math.round(val)}%` : '-', size: 22 })], alignment: AlignmentType.CENTER })] });
                })
            ]
        }));

        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: `${title} (${minYear}-${maxYear})`, bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 }
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [headerRow, ...dataRows]
                    })
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'energy_production_data.docx' : 'donnees_production_energie.docx');
    };

    const downloadRankingsAsCSV = () => {
        const resources = ['crude_oil', 'uranium', 'hydroelectricity', 'electricity', 'coal', 'natural_gas'];
        const resourceNames = {
            'crude_oil': 'page2_crude_oil',
            'uranium': 'page2_uranium',
            'hydroelectricity': 'page2_hydroelectricity',
            'electricity': 'page2_electricity',
            'coal': 'page2_coal',
            'natural_gas': 'page2_natural_gas',
        };

        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            ...resources.flatMap(r => [
                `${stripHtml(getText(resourceNames[r], lang))} - ${getText('page2_rankings_header_reserves', lang)}`,
                `${stripHtml(getText(resourceNames[r], lang))} - ${getText('page2_rankings_header_production', lang)}`,
                `${stripHtml(getText(resourceNames[r], lang))} - ${getText('page2_rankings_header_exports', lang)}`,
            ])
        ];

        const rows = rankingsYearData.map(d => [
            d.year,
            ...resources.flatMap(r => [
                d[`${r}_reserves`],
                d[`${r}_production`],
                d[`${r}_exports`],
            ])
        ]);

        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'canada_energy_rankings.csv' : 'classements_energie_canada.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadRankingsAsDocx = async () => {
        const title = stripHtml(getText('page2_rankings_title', lang));
        const resources = ['crude_oil', 'uranium', 'hydroelectricity', 'electricity', 'coal', 'natural_gas'];
        const resourceNames = {
            'crude_oil': 'page2_crude_oil',
            'uranium': 'page2_uranium',
            'hydroelectricity': 'page2_hydroelectricity',
            'electricity': 'page2_electricity',
            'coal': 'page2_coal',
            'natural_gas': 'page2_natural_gas',
        };

        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            ...resources.flatMap(r => [
                `${stripHtml(getText(resourceNames[r], lang))} - ${getText('page2_rankings_header_reserves', lang)}`,
                `${stripHtml(getText(resourceNames[r], lang))} - ${getText('page2_rankings_header_production', lang)}`,
                `${stripHtml(getText(resourceNames[r], lang))} - ${getText('page2_rankings_header_exports', lang)}`,
            ])
        ];

        const headerRow = new TableRow({
            children: headers.map(header => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: header, bold: true, size: 18 })],
                    alignment: AlignmentType.CENTER
                })],
                shading: { fill: 'E6E6E6' }
            }))
        });

        const dataRows = rankingsYearData.map(d => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(d.year), size: 20 })], alignment: AlignmentType.CENTER })] }),
                ...resources.flatMap(r => [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(d[`${r}_reserves`]), size: 20 })], alignment: AlignmentType.CENTER })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(d[`${r}_production`]), size: 20 })], alignment: AlignmentType.CENTER })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(d[`${r}_exports`]), size: 20 })], alignment: AlignmentType.CENTER })] }),
                ])
            ]
        }));

        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: `${title} (2007-2024)`, bold: true, size: 28 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 300 }
                    }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [headerRow, ...dataRows]
                    })
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'canada_energy_rankings.docx' : 'classements_energie_canada.docx');
    };

    if (loading) {
        return (
            <main id="main-content" tabIndex="-1" className="page2-main" role="main">
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                    <p>{lang === 'en' ? 'Loading...' : 'Chargement...'}</p>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main id="main-content" tabIndex="-1" className="page2-main" role="main">
                <div style={{ padding: '20px', color: 'red' }}>
                    <p>Error: {error}</p>
                </div>
            </main>
        );
    }

    return (
        <main id="main-content" tabIndex="-1" className="page2-main" role="main">
            <style>{`
                .page2-main {
                    width: calc(100% + ${layoutPadding?.left || 55}px + ${layoutPadding?.right || 15}px);
                    margin-left: -${layoutPadding?.left || 55}px;
                    margin-right: -${layoutPadding?.right || 15}px;
                    padding: 0;
                    background-color: #fff;
                    overflow-x: hidden;
                }

                .page2-container {
                    padding-left: ${layoutPadding?.left || 55}px;
                    padding-right: ${layoutPadding?.right || 15}px;
                    padding-top: 20px;
                    padding-bottom: 30px;
                    width: 100%;
                    box-sizing: border-box;
                }

                .page2-title {
                    font-family: Georgia, "Times New Roman", serif;
                    font-size: 2.8rem;
                    font-weight: bold;
                    color: #245e7f;
                    margin: 0 0 10px 0;
                    line-height: 1.2;
                }

                .page2-subtitle {
                    font-family: Arial, sans-serif;
                    font-size: 2.4rem;
                    font-weight: bold;
                    color: #58585a;
                    margin: 0 0 15px 0;
                }

                .page2-narrative {
                    font-family: Arial, sans-serif;
                    font-size: 1.2rem;
                    line-height: 1.6;
                    color: #333;
                    margin-bottom: 20px;
                }

                .page2-narrative strong {
                    font-weight: bold;
                }

                .page2-content-wrapper {
                    display: flex;
                    flex-direction: row;
                    gap: 30px;
                    margin-top: 20px;
                    align-items: stretch;
                }

                .page2-chart-section {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                }

                .page2-rankings-section {
                    flex: 0 0 450px;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                }

                .page2-chart-section .data-table-wrapper,
                .page2-rankings-section .data-table-wrapper {
                    margin-top: auto;
                    width: 100%;
                    box-sizing: border-box;
                }
                    

                .data-table-wrapper summary {
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    padding: 10px;
                    background-color: #f5f5f5;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    list-style: none;
                    box-sizing: border-box;
                    width: 100%;
                }

                .page2-chart-section .data-table-wrapper summary {
                    width: 500px;
                    max-width: 100%;
                }

                .page2-chart-title {
                    font-family: Arial, sans-serif;
                    font-size: 1.3rem;
                    font-weight: bold;
                    color: #000000;
                    margin: 0 0 10px 0;
                    text-align: left;
                    width: 100%;
                }

                .page2-rankings-title {
                    font-family: Arial, sans-serif;
                    font-size: 1.3rem;
                    font-weight: bold;
                    color: #000000;
                    margin: 0 0 40px 0;
                    text-align: left;
                    width: 100%;
                    white-space: nowrap;
                }

                .page2-rankings-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-family: Arial, sans-serif;
                    font-size: 0.9rem;
                }

                .page2-rankings-table th {
                    background-color: #48494a;
                    color: white;
                    padding: 8px 10px;
                    text-align: center;
                    font-weight: bold;
                }

                .page2-rankings-table td {
                    padding: 17px 15px;
                    text-align: center;
                    border: 1px solid #ddd;
                }

                .page2-rankings-table tr:nth-child(even) {
                    background-color: #f5f5f5;
                }

                .page2-rankings-table .resource-cell {
                    text-align: left;
                    font-weight: bold;
                    color: #48494a;
                }

                .page2-year-selector {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin: 15px 0;
                }

                .page2-year-label {
                    font-weight: bold;
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

                .data-table-wrapper {
                    margin-top: 20px;
                }

                .data-table-wrapper summary {
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    padding: 10px;
                    background-color: #f5f5f5;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    list-style: none;
                    width: 100%;
                }

                .data-table-wrapper summary::-webkit-details-marker {
                    display: none;
                }

                .data-table-wrapper summary::marker {
                    display: none;
                }

                .table-responsive {
                    overflow-x: auto;
                    margin-top: 5px;
                }

                .table-responsive table {
                    width: max-content !important;
                    min-width: 100%;
                    border-collapse: collapse;
                }

                .custom-chart-container {
                    position: relative;
                    width: 100%;
                    max-width: 500px;
                    margin-left: 0;
                    margin-right: auto;
                }

                .chart-bg-image {
                    width: 115%;
                    height: auto;
                    margin-left: -7%;
                    display: block;
                }

                .chart-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-around;
                    padding: 3% 0 8% 0;
                }

                .chart-row {
                    display: flex;
                    align-items: center;
                    width: 100%;
                    flex: 1;
                }

                .chart-text-left {
                    width: 52%;
                    padding-top: 2%;
                    padding-left: 2%;
                    font-family: Arial, sans-serif;
                    font-size: clamp(11px, 2.2vw, 15px);
                    color: #333;
                    display: flex;
                    align-items: center;
                    white-space: nowrap;
                }

                .chart-text-right {
                    width: 28%;
                    padding-top: 2%;
                    margin-right: -10%;
                    margin-left: auto;

                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-family: Arial, sans-serif;
                    font-size: clamp(12px, 2.5vw, 18px);
                    color: #333;
                    white-space: nowrap;
                }

                @media (max-width: 1280px) {
                    .page2-content-wrapper {
                        flex-direction: column;
                    }

                    .page2-rankings-section {
                        flex: 1;
                        width: 100%;
                    }

                    .page2-chart-section {
                        width: 100%;
                    }

                    .page2-chart-section .data-table-wrapper summary,
                    .page2-rankings-section .data-table-wrapper summary {
                        width: 100% !important;
                        white-space: normal;
                    }
                }



                .layout-stacked {
                    flex-direction: column !important;
                }

                .layout-stacked .page2-chart-section {
                    width: 100% !important;
                }

                .layout-stacked .page2-rankings-section {
                    width: 100% !important;
                    margin-top: 30px;
                }

                .layout-stacked .page2-chart-section .data-table-wrapper,
                .layout-stacked .page2-rankings-section .data-table-wrapper {
                    width: 100% !important;
                }

                .layout-stacked .page2-chart-section .data-table-wrapper summary,
                .layout-stacked .page2-rankings-section .data-table-wrapper summary {
                    width: 100% !important;
                    white-space: normal;
                }

                .layout-stacked .page2-rankings-section .data-table-wrapper {
                    margin-top: 40px;
                }
            `}</style>

            <div className="page2-container">
                <header>
                    <h1 className="page2-title">{getText('page2_title', lang)}</h1>
                    <h2 className="wb-inv">{stripHtml(getText('page2_title', lang))} - {stripHtml(getText('page2_subtitle', lang))}</h2>
                    <p className="page2-subtitle" aria-hidden="true">{getText('page2_subtitle', lang)}</p>
                </header>

                <p className="page2-narrative" aria-label={
                    lang === 'en'
                        ? `The amount of primary energy produced by Canada in ${year} is ${Math.round(canadaGrowth)} percent more than in 2005. The world, on average, has increased energy production by ${Math.round(worldGrowth)} percent in the same period.`
                        : `La quantité d'énergie primaire produite par le Canada en ${year} est supérieure de ${Math.round(canadaGrowth)} pour cent à la quantité produite en 2005. La quantité d'énergie produite à l'échelle mondiale a connu une augmentation de ${Math.round(worldGrowth)} pour cent pendant la même période.`
                }>
                    <span aria-hidden="true">
                        {getText('page2_narrative_part1', lang)}{year}{getText('page2_narrative_part2', lang)}
                        <strong>{Math.round(canadaGrowth)}{getText('page2_narrative_part3', lang)}</strong>
                        {getText('page2_narrative_part4', lang)}
                        <strong>{Math.round(worldGrowth)}{getText('page2_narrative_part5', lang)}</strong>
                        {getText('page2_narrative_part6', lang)}
                    </span>
                </p>

                <div className="page2-year-selector" ref={dropdownRef}>
                    <label id="year-label-2" className="page2-year-label" aria-hidden="true">
                        {getText('year_slider_label', lang)}
                    </label>
                    <div id="year-instructions-2" className="wb-inv">
                        {lang === 'en' 
                            ? "Press Space to open the menu. Use the Up and Down arrow keys to navigate options. Press Enter to select a year." 
                            : "Appuyez sur Espace pour ouvrir le menu. Utilisez les flèches haut et bas pour naviguer. Appuyez sur Entrée pour sélectionner une année."}
                    </div>
                    <div className="custom-dropdown">
                        <button
                            ref={yearButtonRef}
                            type="button"
                            className="dropdown-button"
                            aria-haspopup="listbox"
                            aria-expanded={isDropdownOpen}
                            aria-label={`${getText('year_slider_label', lang)} ${year || maxYear}`}
                            aria-describedby="year-instructions-2"
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
                            {year || maxYear}
                            <span className="dropdown-arrow" aria-hidden="true">▼</span>
                        </button>
                        {isDropdownOpen && (
                            <ul
                                ref={listRef}
                                role="listbox"
                                aria-label={getText('year_slider_label', lang)}
                                aria-activedescendant={focusedYear ? `year-option-2-${focusedYear}` : undefined}
                                tabIndex={-1}
                                className="dropdown-list"
                                onKeyDown={(e) => {
                                    const currentIndex = yearsList.findIndex(y => y === focusedYear);
                                    
                                    if (e.key === 'ArrowDown') {
                                        e.preventDefault();
                                        const nextIndex = Math.min(currentIndex + 1, yearsList.length - 1);
                                        setFocusedYear(yearsList[nextIndex]);
                                    } else if (e.key === 'ArrowUp') {
                                        e.preventDefault();
                                        const prevIndex = Math.max(currentIndex - 1, 0);
                                        setFocusedYear(yearsList[prevIndex]);
                                    } else if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setYear(focusedYear);
                                        setIsDropdownOpen(false);
                                        if (yearButtonRef.current) yearButtonRef.current.focus();
                                    } else if (e.key === 'Escape') {
                                        setIsDropdownOpen(false);
                                        if (yearButtonRef.current) yearButtonRef.current.focus();
                                    } else if (e.key === 'Tab') {
                                        setIsDropdownOpen(false);
                                    } else if (e.key === 'Home') {
                                        e.preventDefault();
                                        setFocusedYear(yearsList[0]);
                                    } else if (e.key === 'End') {
                                        e.preventDefault();
                                        setFocusedYear(yearsList[yearsList.length - 1]);
                                    }
                                }}
                            >
                                {yearsList.map((y) => (
                                    <li
                                        key={y}
                                        id={`year-option-2-${y}`}
                                        role="option"
                                        aria-selected={year === y}
                                        className={`dropdown-option ${focusedYear === y ? 'focused' : ''} ${year === y ? 'selected' : ''}`}
                                        onClick={() => {
                                            setYear(y);
                                            setIsDropdownOpen(false);
                                            if (yearButtonRef.current) yearButtonRef.current.focus();
                                        }}
                                        onMouseEnter={() => setFocusedYear(y)}
                                    >
                                        {y}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div role="status" className="wb-inv" aria-live="polite">
                        {year ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${year}` : ''}
                    </div>
                </div>

                <div ref={contentWrapperRef} className={`page2-content-wrapper ${isTableOpen || isRankingsTableOpen ? 'layout-stacked' : ''}`}>
                    <div className="page2-chart-section">
                        <h3 className="page2-chart-title" aria-hidden="true">
                            {getText('page2_chart_title', lang)}<br />
                            {getText('page2_chart_subtitle', lang)}{year}
                        </h3>
                        <h3 className="wb-inv">{chartTitle}</h3>

                        <div className="custom-chart-container" ref={chartRef}>
                            <img 
                                src={capsuleGraphic} 
                                alt="" 
                                aria-hidden="true" 
                                className="chart-bg-image"
                            />
                            <div className="chart-overlay">
                                {topProducers.map((producer, index) => {
                                    const isCanada = producer.key === 'canada';
                                    return (
                                        <div key={producer.key} className="chart-row">
                                            <div 
                                                className="chart-text-left"
                                                style={{ 
                                                    fontWeight: isCanada ? 'bold' : 'normal'
                                                }}
                                            >
                                                {index + 1} {producer.name}
                                            </div>
                                            <div 
                                                className="chart-text-right"
                                                style={{
                                                    fontWeight: isCanada ? 'bold' : 'normal'
                                                }}
                                            >
                                                {producer.pctRounded}%
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <details 
                            ref={chartDetailsRef}
                            className="data-table-wrapper"
                            onToggle={(e) => setIsTableOpen(e.currentTarget.open)}
                        >
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                            </summary>

                            <div 
                                ref={topScrollRef}
                                style={{ 
                                    width: '100%', 
                                    overflowX: 'auto', 
                                    overflowY: 'hidden',
                                    marginBottom: '0px',
                                    marginTop: '5px',
                                    display: windowWidth <= 768 ? 'none' : 'block' 
                                }}
                                aria-hidden="true"
                            >
                                <div style={{ height: '20px' }}></div>
                            </div>

                            <div 
                                ref={tableScrollRef}
                                className="table-responsive" 
                                role="region" 
                                aria-label={lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                tabIndex="0"
                            >
                                <table className="table table-striped table-hover">
                                    <caption className="wb-inv">
                                        {lang === 'en' 
                                            ? 'Historical top energy producers data, percentage of world total' 
                                            : 'Données historiques des principaux producteurs d\'énergie, pourcentage du total mondial'}
                                    </caption>
                                    <thead>
                                        <tr>
                                            <th scope="col" style={{ position: 'sticky', left: 0, backgroundColor: '#fff', zIndex: 2, fontWeight: 'bold', textAlign: 'center', minWidth: '80px', borderRight: '2px solid #ddd' }}>
                                                {lang === 'en' ? 'Year' : 'Année'}
                                            </th>
                                            {dynamicColumns.map(countryKey => (
                                                <th key={countryKey} scope="col" style={{ fontWeight: 'bold', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                    {getText(countryNameMap[countryKey], lang)} (%)
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pageData.map(d => (
                                            <tr key={d.year}>
                                                <th scope="row" style={{ position: 'sticky', left: 0, backgroundColor: '#f9f9f9', zIndex: 1, fontWeight: 'bold', textAlign: 'center', borderRight: '2px solid #ddd' }}>
                                                    {d.year}
                                                </th>
                                                {dynamicColumns.map(countryKey => {
                                                    const val = d[`${countryKey}_pct`];
                                                    return (
                                                        <td key={countryKey} style={{ textAlign: 'center' }}>
                                                            {val ? Math.round(val) : '-'}
                                                        </td>
                                                    );
                                                })}
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
                                        color: '#333'
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
                                        color: '#333'
                                    }}
                                >
                                    {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                </button>
                            </div>
                        </details>
                    </div>

                    <div className="page2-rankings-section">
                        <h3 className="page2-rankings-title">{getText('page2_rankings_title', lang)}, {year}</h3>
                        <table className="page2-rankings-table">
                            <thead>
                                <tr>
                                    <th scope="col"></th>
                                    <th scope="col">{getText('page2_rankings_header_reserves', lang)}</th>
                                    <th scope="col">{getText('page2_rankings_header_production', lang)}</th>
                                    <th scope="col">{getText('page2_rankings_header_exports', lang)}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rankingsData.map((row, idx) => (
                                    <tr key={idx}>
                                        <td className="resource-cell">{getText(row.resource, lang)}</td>
                                        <td>{row.reserves}</td>
                                        <td>{row.production}</td>
                                        <td>{row.exports}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <details 
                            ref={rankingsDetailsRef}
                            className="data-table-wrapper"
                            onToggle={(e) => setIsRankingsTableOpen(e.currentTarget.open)}
                        >
                            <summary role="button" aria-expanded={isRankingsTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isRankingsTableOpen ? '▼' : '▶'}</span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                            </summary>

                            <div 
                                ref={rankingsTopScrollRef}
                                style={{ 
                                    width: '100%', 
                                    overflowX: 'auto', 
                                    overflowY: 'hidden',
                                    marginBottom: '0px',
                                    marginTop: '-20px',
                                    display: windowWidth <= 768 ? 'none' : 'block' 
                                }}
                                aria-hidden="true"
                            >
                                <div style={{ height: '20px' }}></div>
                            </div>

                            <div 
                                ref={rankingsTableScrollRef}
                                className="table-responsive" 
                                role="region" 
                                aria-label={lang === 'en' ? 'Rankings data table' : 'Tableau des classements'}
                                tabIndex="0"
                            >
                                <table className="table table-striped table-hover">
                                    <caption className="wb-inv">
                                        {lang === 'en' 
                                            ? 'Global energy rankings for Canada by resource type and year' 
                                            : 'Classements énergétiques mondiaux du Canada par type de ressource et année'}
                                    </caption>
                                    <thead>
                                        <tr>
                                            <th scope="col" rowSpan="2" style={{ position: 'sticky', left: 0, backgroundColor: '#fff', zIndex: 2, fontWeight: 'bold', textAlign: 'center', minWidth: '80px', borderRight: '2px solid #ddd', verticalAlign: 'middle' }}>
                                                {lang === 'en' ? 'Year' : 'Année'}
                                            </th>
                                            <th scope="colgroup" colSpan="3" style={{ fontWeight: 'bold', textAlign: 'center', borderBottom: '1px solid #ddd' }}>
                                                {getText('page2_crude_oil', lang)}
                                            </th>
                                            <th scope="colgroup" colSpan="3" style={{ fontWeight: 'bold', textAlign: 'center', borderBottom: '1px solid #ddd' }}>
                                                {getText('page2_uranium', lang)}
                                            </th>
                                            <th scope="colgroup" colSpan="3" style={{ fontWeight: 'bold', textAlign: 'center', borderBottom: '1px solid #ddd' }}>
                                                {getText('page2_hydroelectricity', lang)}
                                            </th>
                                            <th scope="colgroup" colSpan="3" style={{ fontWeight: 'bold', textAlign: 'center', borderBottom: '1px solid #ddd' }}>
                                                {getText('page2_electricity', lang)}
                                            </th>
                                            <th scope="colgroup" colSpan="3" style={{ fontWeight: 'bold', textAlign: 'center', borderBottom: '1px solid #ddd' }}>
                                                {getText('page2_coal', lang)}
                                            </th>
                                            <th scope="colgroup" colSpan="3" style={{ fontWeight: 'bold', textAlign: 'center', borderBottom: '1px solid #ddd' }}>
                                                {getText('page2_natural_gas', lang)}
                                            </th>
                                        </tr>
                                        <tr>
                                            {[...Array(6)].map((_, i) => (
                                                <React.Fragment key={i}>
                                                    <th scope="col" style={{ fontWeight: 'bold', textAlign: 'center', fontSize: '0.8rem' }}>
                                                        {lang === 'en' ? 'Res.' : 'Rés.'}
                                                    </th>
                                                    <th scope="col" style={{ fontWeight: 'bold', textAlign: 'center', fontSize: '0.8rem' }}>
                                                        {lang === 'en' ? 'Prod.' : 'Prod.'}
                                                    </th>
                                                    <th scope="col" style={{ fontWeight: 'bold', textAlign: 'center', fontSize: '0.8rem' }}>
                                                        {lang === 'en' ? 'Exp.' : 'Exp.'}
                                                    </th>
                                                </React.Fragment>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rankingsYearData.map(d => (
                                            <tr key={d.year}>
                                                <th scope="row" style={{ position: 'sticky', left: 0, backgroundColor: '#f9f9f9', zIndex: 1, fontWeight: 'bold', textAlign: 'center', borderRight: '2px solid #ddd' }}>
                                                    {d.year}
                                                </th>
                                                <td style={{ textAlign: 'center' }}>{d.crude_oil_reserves}</td>
                                                <td style={{ textAlign: 'center' }}>{d.crude_oil_production}</td>
                                                <td style={{ textAlign: 'center' }}>{d.crude_oil_exports}</td>
                                                <td style={{ textAlign: 'center' }}>{d.uranium_reserves}</td>
                                                <td style={{ textAlign: 'center' }}>{d.uranium_production}</td>
                                                <td style={{ textAlign: 'center' }}>{d.uranium_exports}</td>
                                                <td style={{ textAlign: 'center' }}>{d.hydroelectricity_reserves}</td>
                                                <td style={{ textAlign: 'center' }}>{d.hydroelectricity_production}</td>
                                                <td style={{ textAlign: 'center' }}>{d.hydroelectricity_exports}</td>
                                                <td style={{ textAlign: 'center' }}>{d.electricity_reserves}</td>
                                                <td style={{ textAlign: 'center' }}>{d.electricity_production}</td>
                                                <td style={{ textAlign: 'center' }}>{d.electricity_exports}</td>
                                                <td style={{ textAlign: 'center' }}>{d.coal_reserves}</td>
                                                <td style={{ textAlign: 'center' }}>{d.coal_production}</td>
                                                <td style={{ textAlign: 'center' }}>{d.coal_exports}</td>
                                                <td style={{ textAlign: 'center' }}>{d.natural_gas_reserves}</td>
                                                <td style={{ textAlign: 'center' }}>{d.natural_gas_production}</td>
                                                <td style={{ textAlign: 'center' }}>{d.natural_gas_exports}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                                <button
                                    onClick={() => downloadRankingsAsCSV()}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: '#f9f9f9',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontFamily: 'Arial, sans-serif',
                                        fontWeight: 'bold',
                                        color: '#333'
                                    }}
                                >
                                    {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                </button>
                                <button
                                    onClick={() => downloadRankingsAsDocx()}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: '#f9f9f9',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontFamily: 'Arial, sans-serif',
                                        fontWeight: 'bold',
                                        color: '#333'
                                    }}
                                >
                                    {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                </button>
                            </div>
                        </details>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Page2;
