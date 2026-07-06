import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getWorldEnergyProductionData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const world_energy_production_COUNTRY_NAME_MAP = {
    'china': 'world_energy_production_country_china',
    'united_states': 'world_energy_production_country_united_states',
    'india': 'world_energy_production_country_india',
    'canada': 'world_energy_production_country_canada',
    'indonesia': 'world_energy_production_country_indonesia',
    'australia': 'world_energy_production_country_australia',
    'brazil': 'world_energy_production_country_brazil',
    'norway': 'world_energy_production_country_norway',
    'mexico': 'world_energy_production_country_mexico',
    'south_africa': 'world_energy_production_country_south_africa',
    'colombia': 'world_energy_production_country_colombia',
    'united_kingdom': 'world_energy_production_country_united_kingdom',
    'egypt': 'world_energy_production_country_egypt',
    'argentina': 'world_energy_production_country_argentina',
};

const WorldEnergyProduction = () => {
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
    const staticRankingsTopScrollRef = useRef(null);
    const staticRankingsTableScrollRef = useRef(null);

    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
    const yearDropdownRef = useRef(null);
    const yearButtonRef = useRef(null);
    const chartDetailsRef = useRef(null);
    const rankingsDetailsRef = useRef(null);
    const contentWrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target)) {
                setIsYearDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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

    // Scroll syncing for rankings table
    useEffect(() => {
        const topScroll = rankingsTopScrollRef.current;
        const tableScroll = rankingsTableScrollRef.current;

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
    }, [isRankingsTableOpen, windowWidth]);

    // Scroll syncing for static rankings table (always visible)
    useEffect(() => {
        const topScroll = staticRankingsTopScrollRef.current;
        const tableScroll = staticRankingsTableScrollRef.current;

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
    }, [windowWidth]);

    useEffect(() => {
        if (isTableOpen && chartDetailsRef.current) {
            setTimeout(() => {
                chartDetailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }, [isTableOpen]);

    useEffect(() => {
        if (isRankingsTableOpen && rankingsDetailsRef.current) {
            setTimeout(() => {
                rankingsDetailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

            // Find the download button using data-title attribute
            const downloadBtn = plotContainer.querySelector('.modebar-btn[data-title*="Download"], .modebar-btn[data-title*="Télécharger"]');
            
            if (downloadBtn) {
                // Make it tabbable
                downloadBtn.setAttribute('tabindex', '0');
                downloadBtn.setAttribute('role', 'button');
                
                // Ensure it has a label
                const title = downloadBtn.getAttribute('data-title');
                if (title) downloadBtn.setAttribute('aria-label', title);

                // Add keyboard click support (crucial for screen readers)
                downloadBtn.onkeydown = (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        downloadBtn.click();
                    }
                };
            }

            // Hide other modebar buttons from screen readers
            const otherButtons = plotContainer.querySelectorAll('.modebar-btn');
            otherButtons.forEach(btn => {
                const dataTitle = btn.getAttribute('data-title');
                if (!dataTitle || (!dataTitle.includes('Download') && !dataTitle.includes('Télécharger'))) {
                    btn.setAttribute('aria-hidden', 'true');
                    btn.setAttribute('tabindex', '-1');
                }
            });
        };

        // Watch for changes (Plotly deletes/re-creates the modebar often)
        const observer = new MutationObserver(setupChartAccessibility);
        observer.observe(chartRef.current, { childList: true, subtree: true });

        // Run once immediately
        setupChartAccessibility();

        return () => observer.disconnect();
    }, [pageData, lang]);

    const currentYearData = useMemo(() => {
        if (!year || pageData.length === 0) return null;
        return pageData.find(d => d.year === year);
    }, [year, pageData]);

    const topProducers = useMemo(() => {
        if (!currentYearData) return [];
        
        const allCountries = Object.keys(world_energy_production_COUNTRY_NAME_MAP)
            .map(key => {
                const pct = currentYearData[`${key}_pct`];
                if (pct === undefined || pct === null) return null;
                return {
                    key,
                    nameKey: world_energy_production_COUNTRY_NAME_MAP[key],
                    name: getText(world_energy_production_COUNTRY_NAME_MAP[key], lang),
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
            const yearCountries = Object.keys(world_energy_production_COUNTRY_NAME_MAP)
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
        { resource: 'world_energy_production_crude_oil', reserves: 4, production: 4, exports: 3 },
        { resource: 'world_energy_production_uranium', reserves: 3, production: 2, exports: 2 },
        { resource: 'world_energy_production_hydroelectricity', reserves: 4, production: 3, exports: '-' },
        { resource: 'world_energy_production_electricity', reserves: 8, production: 7, exports: 3 },
        { resource: 'world_energy_production_coal', reserves: 19, production: 14, exports: 8 },
        { resource: 'world_energy_production_natural_gas', reserves: 10, production: 5, exports: 6 },
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

    const chartTitle = `${getText('world_energy_production_chart_title', lang)} - ${getText('world_energy_production_chart_subtitle', lang)}${year}`;

    const downloadTableAsCSV = () => {
        if (!pageData || pageData.length === 0) return;

        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            ...dynamicColumns.map(key => getText(world_energy_production_COUNTRY_NAME_MAP[key], lang) + ' (%)')
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

        const title = stripHtml(getText('world_energy_production_chart_title', lang));

        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            ...dynamicColumns.map(key => getText(world_energy_production_COUNTRY_NAME_MAP[key], lang) + ' (%)')
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
                        columnWidths: [1200, ...dynamicColumns.map(() => 1300)],
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
            'crude_oil': 'world_energy_production_crude_oil',
            'uranium': 'world_energy_production_uranium',
            'hydroelectricity': 'world_energy_production_hydroelectricity',
            'electricity': 'world_energy_production_electricity',
            'coal': 'world_energy_production_coal',
            'natural_gas': 'world_energy_production_natural_gas',
        };

        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            ...resources.flatMap(r => [
                `${stripHtml(getText(resourceNames[r], lang))} - ${getText('world_energy_production_rankings_header_reserves', lang)}`,
                `${stripHtml(getText(resourceNames[r], lang))} - ${getText('world_energy_production_rankings_header_production', lang)}`,
                `${stripHtml(getText(resourceNames[r], lang))} - ${getText('world_energy_production_rankings_header_exports', lang)}`,
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
        const title = stripHtml(getText('world_energy_production_rankings_title', lang));
        const resources = ['crude_oil', 'uranium', 'hydroelectricity', 'electricity', 'coal', 'natural_gas'];
        const resourceNames = {
            'crude_oil': 'world_energy_production_crude_oil',
            'uranium': 'world_energy_production_uranium',
            'hydroelectricity': 'world_energy_production_hydroelectricity',
            'electricity': 'world_energy_production_electricity',
            'coal': 'world_energy_production_coal',
            'natural_gas': 'world_energy_production_natural_gas',
        };

        // Resource header row (with merged cells spanning 3 columns each)
        const resourceHeaderRow = new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: '', bold: true, size: 18 })], alignment: AlignmentType.CENTER })],
                    shading: { fill: 'E6E6E6' },
                    verticalAlign: 'center'
                }),
                ...resources.map(r => new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({ text: stripHtml(getText(resourceNames[r], lang)), bold: true, size: 18 })],
                        alignment: AlignmentType.CENTER
                    })],
                    shading: { fill: 'E6E6E6' },
                    columnSpan: 3
                }))
            ]
        });

        // Sub-header row with Res., Prod., Exp.
        const subHeaderRow = new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({ text: lang === 'en' ? 'Year' : 'Année', bold: true, size: 18 })],
                        alignment: AlignmentType.CENTER
                    })],
                    shading: { fill: 'E6E6E6' }
                }),
                ...resources.flatMap(() => [
                    new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({ text: lang === 'en' ? 'Res.' : 'Rés.', bold: true, size: 16 })],
                            alignment: AlignmentType.CENTER
                        })],
                        shading: { fill: 'E6E6E6' }
                    }),
                    new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({ text: lang === 'en' ? 'Prod.' : 'Prod.', bold: true, size: 16 })],
                            alignment: AlignmentType.CENTER
                        })],
                        shading: { fill: 'E6E6E6' }
                    }),
                    new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({ text: lang === 'en' ? 'Exp.' : 'Exp.', bold: true, size: 16 })],
                            alignment: AlignmentType.CENTER
                        })],
                        shading: { fill: 'E6E6E6' }
                    })
                ])
            ]
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
                        columnWidths: [800, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500],
                        rows: [resourceHeaderRow, subHeaderRow, ...dataRows]
                    })
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'canada_energy_rankings.docx' : 'classements_energie_canada.docx');
    };

    if (loading) {
        return (
            <main id="main-content" tabIndex="-1" className="energy-production-main" role="main">
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                    <p>{lang === 'en' ? 'Loading...' : 'Chargement...'}</p>
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main id="main-content" tabIndex="-1" className="energy-production-main" role="main">
                <div style={{ padding: '20px', color: 'red' }}>
                    <p>Error: {error}</p>
                </div>
            </main>
        );
    }

    return (
        <main id="main-content" tabIndex="-1" className="energy-production-main" role="main">
            <style>{`
                .energy-production-main {
                    width: calc(100% + ${layoutPadding?.left || 55}px + ${layoutPadding?.right || 15}px);
                    margin-left: -${layoutPadding?.left || 55}px;
                    margin-right: -${layoutPadding?.right || 15}px;
                    padding: 0;
                    background-color: #fff;
                    overflow-x: hidden;
                }

                .energy-production-container {
                    padding-left: ${layoutPadding?.left || 55}px;
                    padding-right: ${layoutPadding?.right || 15}px;
                    padding-top: 20px;
                    padding-bottom: 30px;
                    width: 100%;
                    box-sizing: border-box;
                }

                .energy-production-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 50px;
                    font-weight: bold;
                    margin-top: 0;
                    margin-bottom: 25px;
                    color: #245e7f;
                    margin: 0 0 10px 0;
                    line-height: 1.2;
                    position: relative;
                    padding-bottom: 0.5em;
                }

                .energy-production-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }

                .energy-production-subtitle {
                    font-family: 'Lato', sans-serif;
                    font-size: 39px;
                    font-weight: bold;
                    color: #58585a;
                    margin: 0 0 15px 0;
                }

                .energy-production-narrative {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    line-height: 1.6;
                    color: var(--gc-text);
                    margin-bottom: 20px;
                }

                .energy-production-narrative strong {
                    font-weight: bold;
                }

                .energy-production-content-wrapper {
                    display: flex;
                    flex-direction: row;
                    gap: 30px;
                    margin-top: 20px;
                    align-items: stretch;
                }

                .energy-production-chart-section {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                }

                .energy-production-rankings-section {
                    flex: 0 0 auto;
                    min-width: 0;
                    max-width: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                }

                .energy-production-chart-section .data-table-wrapper,
                .energy-production-rankings-section .data-table-wrapper {
                    padding-top: 5px;
                    margin-top: 20px;
                    margin-bottom: 0;
                    width: 100%;
                    box-sizing: border-box;
                }
                    

                .data-table-wrapper summary {
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    padding: 10px;
                    background-color: #8C8C8C;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    list-style: none;
                    box-sizing: border-box;
                    width: 100%;
                    color: #ffffff;
                }

                .data-table-wrapper summary:hover {
                    background-color: #404040 !important;
                }

                .data-table-wrapper button[type="button"]:hover,
                .data-table-wrapper button:hover {
                    background-color: #404040 !important;
                }

                .energy-production-chart-section .data-table-wrapper summary {
                    width: 96%;
                }

                .energy-production-chart-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: #000000;
                    margin: 0 0 10px 0;
                    text-align: left;
                    width: 100%;
                }

                .energy-production-rankings-title {
                    font-family: 'Lato', sans-serif;
                    font-size: clamp(18px, 2.5vw, 29px);
                    font-weight: bold;
                    color: #000000;
                    margin: 0 0 clamp(20px, 3vw, 40px) 0;
                    text-align: left;
                    width: 100%;
                    white-space: normal;
                }

                .static-rankings-scroll-container {
                    display: block;
                    width: 100%;
                    overflow-x: auto !important;
                    -webkit-overflow-scrolling: touch;
                    border: 1px solid #ddd;
                    background: #fff;
                }

                .energy-production-rankings-table {
                    width: max-content !important;
                    min-width: 100%;
                    border-collapse: collapse;
                    font-family: 'Noto Sans', sans-serif;
                    font-size: clamp(14px, 1.5vw, 20px);
                }

                .energy-production-rankings-table th {
                    background-color: #48494a !important;
                    color: white !important;
                    padding: 8px 15px;
                    text-align: center;
                    font-weight: bold;
                    white-space: nowrap;
                }

                .energy-production-rankings-table td {
                    padding: 12px 15px;
                    text-align: center;
                    border: 1px solid #ddd;
                    white-space: nowrap;
                }

                /* Removed custom zebra - using .table-striped instead */

                .energy-production-rankings-table .resource-cell {
                    text-align: left;
                    font-weight: bold;
                    color: #48494a;
                    white-space: nowrap;
                }

                .energy-production-year-selector {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin: 15px 0;
                }

                .energy-production-year-label {
                    font-weight: bold;
                    font-size: 20px;
                    font-family: 'Noto Sans', sans-serif;
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

                .data-table-wrapper {
                    margin-top: 20px;
                    margin-bottom: 0;
                }

                .data-table-wrapper summary {
                    cursor: pointer;
                    font-family: 'Noto Sans', sans-serif;
                    font-weight: bold;
                    font-size: 20px;
                    padding: 10px;
                    background-color: #8C8C8C;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    list-style: none;
                    width: 100%;
                    color: #ffffff;
                }

                .data-table-wrapper summary::-webkit-details-marker {
                    display: none;
                }

                .data-table-wrapper summary::marker {
                    display: none;
                }

                .table-responsive {
                    display: block;
                    width: 100%;
                    overflow-x: auto !important;
                    -webkit-overflow-scrolling: touch;
                    border: 1px solid #ddd;
                    background: #fff;
                    margin-top: 5px;
                }

                .table-responsive table {
                    width: max-content !important;
                    min-width: 100%;
                    border-collapse: collapse;
                }

                .table-responsive table th,
                .table-responsive table td {
                    white-space: nowrap;
                    padding: 8px 12px;
                }

                .custom-chart-container {
                    position: relative;
                    width: 100%;
                    max-width: 380px;
                    margin-left: auto;
                    margin-right: auto;
                }

                .energy-production-capsule-graphic {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    width: 100%;
                    font-family: 'Noto Sans', sans-serif;
                }

                .energy-production-capsule-row {
                    display: flex;
                    align-items: center;
                    min-height: 52px;
                    gap: 0;
                    min-width: 0;
                }

                .energy-production-capsule-bar-wrap {
                    flex: 0 0 28%;
                    min-width: 0;
                    display: flex;
                    align-items: center;
                }

                .energy-production-capsule-bar {
                    min-height: 44px;
                    min-width: 82px;
                    border-radius: 999px;
                    background-color: #d1d1d1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    padding: 10px 12px;
                    font-size: clamp(13px, 1.5vw, 15px);
                    color: #333;
                    box-sizing: border-box;
                    width: 100%;
                    max-width: 100%;
                }

                .energy-production-capsule-bar .energy-production-capsule-bar-text {
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    word-break: break-word;
                    white-space: normal;
                    line-height: 1.3;
                }

                .energy-production-capsule-row-canada .energy-production-capsule-bar {
                    background-color: var(--gc-accent);
                    color: #fff;
                }

                .energy-production-capsule-connector {
                    flex: 1 1 0;
                    min-width: 10px;
                    height: 2px;
                    background-color: #b0b0b0;
                }

                .energy-production-capsule-row-canada .energy-production-capsule-connector {
                    background-color: var(--gc-accent);
                }

                .energy-production-capsule-pill {
                    flex: 0 0 64px;
                    height: 36px;
                    min-width: 64px;
                    border-radius: 999px;
                    border: 1px solid #b0b0b0;
                    background-color: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 15px;
                    color: #333;
                    box-sizing: border-box;
                }

                .energy-production-capsule-row-canada .energy-production-capsule-pill {
                    border-width: 2px;
                    border-color: var(--gc-accent);
                    font-weight: bold;
                    font-size: 16px;
                }

                .layout-stacked {
                    flex-direction: column !important;
                }

                .layout-stacked .energy-production-chart-section {
                    width: 100% !important;
                }

                .layout-stacked .custom-chart-container {
                    width: 100% !important;
                    max-width: 1280px !important;
                    margin: 0 auto !important;
                }

                .layout-stacked .energy-production-rankings-section {
                    width: 100% !important;
                    /* Match the table section's width to the chart's width */
                    max-width: 1280px !important; 
                    margin-left: auto !important;
                    margin-right: auto !important;
                    margin-top: 30px;
                }

                .layout-stacked .energy-production-chart-section .data-table-wrapper,
                .layout-stacked .energy-production-rankings-section .data-table-wrapper {
                    margin-top: 30px;
                    width: 100% !important;
                }

                .layout-stacked .energy-production-chart-section .data-table-wrapper summary,
                .layout-stacked .energy-production-rankings-section .data-table-wrapper summary {
                    width: 100% !important;
                    white-space: normal;
                }

                .layout-stacked .energy-production-rankings-section .data-table-wrapper {
                    margin-top: 30px;
                }

                @media (max-width: 1280px) {
                    .energy-production-content-wrapper {
                        flex-direction: column;
                    }
                    .energy-production-rankings-section {
                        flex: 1;
                        width: 100%;
                    }
                    .energy-production-chart-section {
                        width: 100%;
                    }
                    .custom-chart-container {
                        max-width: 100% !important; 
                        width: 100% !important;
                    }
                    .energy-production-chart-section .data-table-wrapper summary,
                    .energy-production-rankings-section .data-table-wrapper summary {
                        width: 100% !important;
                        white-space: normal;
                    }
                }

                @media (max-width: 768px) {
                    .energy-production-title {
                        font-size: 37px;
                    }
                    .energy-production-subtitle {
                        font-size: 35px;
                    }
                    .energy-production-narrative {
                        font-size: 18px;
                    }
                    .energy-production-chart-title,
                    .energy-production-rankings-title {
                        font-size: 26px;
                    }
                    .energy-production-rankings-table {
                        font-size: 18px;
                    }
                    .energy-production-year-label {
                        font-size: 18px;
                    }
                    .dropdown-button {
                        font-size: 18px;
                    }
                    .data-table-wrapper summary {
                        font-size: 18px;
                    }
                }
            `}</style>

            <div className="energy-production-container">
                <header>
                    <h1 
                        className="energy-production-title"
                        role="region"
                        aria-label={stripHtml(getText('world_energy_production_title', lang))}
                        tabIndex="0"
                    >
                        <span aria-hidden="true">{getText('world_energy_production_title', lang)}</span>
                    </h1>
                    <p 
                        className="energy-production-subtitle" 
                        role="region"
                        aria-label={stripHtml(getText('world_energy_production_subtitle', lang))}
                        tabIndex="0"
                    >
                        <span aria-hidden="true">{getText('world_energy_production_subtitle', lang)}</span>
                    </p>
                </header>

                <p className="energy-production-narrative" role="region" tabIndex="0" aria-label={
                    lang === 'en'
                        ? `The amount of primary energy produced by Canada in ${year} is ${Math.round(canadaGrowth)} percent more than in 2005. The world, on average, has increased energy production by ${Math.round(worldGrowth)} percent in the same period.`
                        : `La quantité d'énergie primaire produite par le Canada en ${year} est supérieure de ${Math.round(canadaGrowth)} pour cent à la quantité produite en 2005. La quantité d'énergie produite à l'échelle mondiale a connu une augmentation de ${Math.round(worldGrowth)} pour cent pendant la même période.`
                }>
                    <span aria-hidden="true">
                        {getText('world_energy_production_narrative_part1', lang)}{year}{getText('world_energy_production_narrative_part2', lang)}
                        <strong>{Math.round(canadaGrowth)}{getText('world_energy_production_narrative_part3', lang)}</strong>
                        {getText('world_energy_production_narrative_part4', lang)}
                        <strong>{Math.round(worldGrowth)}{getText('world_energy_production_narrative_part5', lang)}</strong>
                        {getText('world_energy_production_narrative_part6', lang)}
                    </span>
                </p>

                {/* SINGLE-SELECT RADIO DROPDOWN */}
                <div 
                    ref={yearDropdownRef} 
                    style={{ 
                        position: 'relative', 
                        marginBottom: '20px', 
                        width: '200px' 
                    }}
                >
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>
                        {getText('year_slider_label', lang)}
                    </label>
                    
                    {/* TOGGLE BUTTON */}
                    <button
                        ref={yearButtonRef}
                        onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                        aria-expanded={isYearDropdownOpen}
                        style={{
                            width: '100%',
                            padding: '10px 15px',
                            backgroundColor: '#fff',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            textAlign: 'left',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '16px'
                        }}
                    >
                        <span>{year || maxYear}</span>
                        <span aria-hidden="true" style={{ fontSize: '12px' }}>{isYearDropdownOpen ? '▲' : '▼'}</span>
                    </button>

                    {/* DROPDOWN LIST */}
                    {isYearDropdownOpen && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            width: '100%',
                            maxHeight: '300px',
                            overflowY: 'auto',
                            backgroundColor: '#fff',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            zIndex: 100,
                            boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                        }}>
                            {/* Sort Descending (Newest First) - Using buttons styled as radio */}
                            {[...yearsList].sort((a, b) => b - a).map((y) => {
                                const isSelected = year === y;
                                return (
                                    <button
                                        key={y}
                                        type="button"
                                        aria-pressed={isSelected}
                                        aria-label={y.toString()}
                                        onClick={() => {
                                            setYear(y);
                                            setIsYearDropdownOpen(false);
                                            setTimeout(() => {
                                                yearButtonRef.current?.focus();
                                            }, 0);
                                        }}
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: '10px 15px', 
                                            cursor: 'pointer',
                                            border: 'none',
                                            borderBottom: '1px solid #eee',
                                            backgroundColor: isSelected ? '#f0f9ff' : '#fff',
                                            fontFamily: 'Arial, sans-serif'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isSelected ? '#f0f9ff' : '#fff'}
                                    >
                                        {/* Fake radio circle */}
                                        <span 
                                            aria-hidden="true"
                                            style={{
                                                height: '18px',
                                                width: '18px',
                                                borderRadius: '50%',
                                                border: '1px solid #ccc',
                                                marginRight: '10px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: '#fff'
                                            }}
                                        >
                                            {isSelected && (
                                                <span style={{
                                                    height: '10px',
                                                    width: '10px',
                                                    borderRadius: '50%',
                                                    backgroundColor: '#000'
                                                }} />
                                            )}
                                        </span>
                                        <span aria-hidden="true" style={{ fontSize: '16px', color: '#333' }}>
                                            {y}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    
                    <div role="status" className="wb-inv" aria-live="polite">
                        {year ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${year}` : ''}
                    </div>
                </div>

                <div ref={contentWrapperRef} className="energy-production-content-wrapper layout-stacked">
                    <div className="energy-production-chart-section">
                        <h3 
                            className="energy-production-chart-title" 
                            role="region"
                            aria-label={chartTitle}
                            tabIndex="0"
                        >
                            <span aria-hidden="true">
                                {getText('world_energy_production_chart_title', lang)}<br />
                                {getText('world_energy_production_chart_subtitle', lang)}{year}
                            </span>
                        </h3>

                        <div 
                            className="custom-chart-container" 
                            ref={chartRef}
                            role="region"
                            aria-label={lang === 'en' 
                                ? `Top ${topProducers.length} energy producers in ${year}: ${topProducers.map((p, i) => `Number ${i + 1}, ${p.name}, ${p.pctRounded} percent`).join('. ')}.`
                                : `Les ${topProducers.length} principaux producteurs d'énergie en ${year}: ${topProducers.map((p, i) => `Numéro ${i + 1}, ${p.name}, ${p.pctRounded} pour cent`).join('. ')}.`
                            }
                            tabIndex="0"
                        >
                            <div className="energy-production-capsule-graphic" aria-hidden="true">
                                {topProducers.map((producer, index) => {
                                    const isCanada = producer.key === 'canada';
                                    const maxPct = topProducers[0]?.pct || 1;
                                    const rawRatio = maxPct > 0 ? producer.pct / maxPct : 1;
                                    const barWidthPct = 62 + 18 * rawRatio;
                                    return (
                                        <div
                                            key={producer.key}
                                            className={`energy-production-capsule-row ${isCanada ? 'energy-production-capsule-row-canada' : ''}`}
                                        >
                                            <div className="energy-production-capsule-bar-wrap">
                                                <div
                                                    className="energy-production-capsule-bar"
                                                    style={{ width: `${barWidthPct}%` }}
                                                >
                                                    <span className="energy-production-capsule-bar-text">{index + 1} {producer.name}</span>
                                                </div>
                                            </div>
                                            <div className="energy-production-capsule-connector" />
                                            <div className="energy-production-capsule-pill">
                                                <span className="energy-production-capsule-pill-text">{producer.pctRounded}%</span>
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

                            {/* Top scrollbar */}
                            <div 
                                ref={topScrollRef}
                                style={{ 
                                    width: '100%', 
                                    overflowX: 'auto', 
                                    overflowY: 'hidden',
                                    marginBottom: '0px',
                                    marginTop: '10px',
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
                                                    {getText(world_energy_production_COUNTRY_NAME_MAP[countryKey], lang)} (%)
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pageData.map((d) => (
                                            <tr key={d.year}>
                                                <th scope="row" style={{ position: 'sticky', left: 0, zIndex: 1, fontWeight: 'bold', textAlign: 'center', borderRight: '2px solid #ddd' }}>
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
                                        backgroundColor: '#8C8C8C',
                                        border: '1px solid #404040',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontFamily: 'Arial, sans-serif',
                                        fontWeight: 'bold',
                                        color: '#ffffff'
                                    }}
                                >
                                    {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                </button>
                                <button
                                    onClick={() => downloadTableAsDocx()}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: '#8C8C8C',
                                        border: '1px solid #404040',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontFamily: 'Arial, sans-serif',
                                        fontWeight: 'bold',
                                        color: '#ffffff'
                                    }}
                                >
                                    {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                </button>
                            </div>
                        </details>
                    </div>

                    <div className="energy-production-rankings-section">
                        <h3 className="energy-production-rankings-title">{getText('world_energy_production_rankings_title', lang)}, {year}</h3>
                        
                        {/* Top scrollbar for static rankings table */}
                        <div 
                            ref={staticRankingsTopScrollRef}
                            style={{ 
                                width: '100%', 
                                overflowX: 'auto', 
                                overflowY: 'hidden',
                                marginBottom: '0px',
                                display: windowWidth <= 768 ? 'none' : 'block' 
                            }}
                            aria-hidden="true"
                        >
                            <div style={{ height: '20px' }}></div>
                        </div>
                        
                        {/* Scrollable table container */}
                        <div 
                            ref={staticRankingsTableScrollRef}
                            className="static-rankings-scroll-container"
                            role="region"
                            aria-label={lang === 'en' ? 'Global energy rankings table' : 'Tableau des classements énergétiques mondiaux'}
                            tabIndex="0"
                        >
                            <table className="energy-production-rankings-table table table-striped table-hover">
                                <thead>
                                    <tr>
                                        <th scope="col"></th>
                                        <th scope="col">{getText('world_energy_production_rankings_header_reserves', lang)}</th>
                                        <th scope="col">{getText('world_energy_production_rankings_header_production', lang)}</th>
                                        <th scope="col">{getText('world_energy_production_rankings_header_exports', lang)}</th>
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
                        </div>

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

                            {/* Top scrollbar */}
                            <div 
                                ref={rankingsTopScrollRef}
                                style={{ 
                                    width: '100%', 
                                    overflowX: 'auto', 
                                    overflowY: 'hidden',
                                    marginBottom: '0px',
                                    marginTop: '10px',
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
                                                {getText('world_energy_production_crude_oil', lang)}
                                            </th>
                                            <th scope="colgroup" colSpan="3" style={{ fontWeight: 'bold', textAlign: 'center', borderBottom: '1px solid #ddd' }}>
                                                {getText('world_energy_production_uranium', lang)}
                                            </th>
                                            <th scope="colgroup" colSpan="3" style={{ fontWeight: 'bold', textAlign: 'center', borderBottom: '1px solid #ddd' }}>
                                                {getText('world_energy_production_hydroelectricity', lang)}
                                            </th>
                                            <th scope="colgroup" colSpan="3" style={{ fontWeight: 'bold', textAlign: 'center', borderBottom: '1px solid #ddd' }}>
                                                {getText('world_energy_production_electricity', lang)}
                                            </th>
                                            <th scope="colgroup" colSpan="3" style={{ fontWeight: 'bold', textAlign: 'center', borderBottom: '1px solid #ddd' }}>
                                                {getText('world_energy_production_coal', lang)}
                                            </th>
                                            <th scope="colgroup" colSpan="3" style={{ fontWeight: 'bold', textAlign: 'center', borderBottom: '1px solid #ddd' }}>
                                                {getText('world_energy_production_natural_gas', lang)}
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
                                        {rankingsYearData.map((d) => (
                                            <tr key={d.year}>
                                                <th scope="row" style={{ position: 'sticky', left: 0, zIndex: 1, fontWeight: 'bold', textAlign: 'center', borderRight: '2px solid #ddd' }}>
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
                                        backgroundColor: '#8C8C8C',
                                        border: '1px solid #404040',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontFamily: 'Arial, sans-serif',
                                        fontWeight: 'bold',
                                        color: '#ffffff'
                                    }}
                                >
                                    {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                </button>
                                <button
                                    onClick={() => downloadRankingsAsDocx()}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: '#8C8C8C',
                                        border: '1px solid #404040',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontFamily: 'Arial, sans-serif',
                                        fontWeight: 'bold',
                                        color: '#ffffff'
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

export default WorldEnergyProduction;
