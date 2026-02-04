import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getEconomicContributionsData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import page26BgImage from '../assets/page26_bg.svg';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
const Page26 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [year, setYear] = useState(null);
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    
    // Custom dropdown state
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [focusedYear, setFocusedYear] = useState(null);
    const dropdownRef = useRef(null);
    const listRef = useRef(null);
    const yearButtonRef = useRef(null);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleDropdownClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleDropdownClickOutside);
        return () => document.removeEventListener('mousedown', handleDropdownClickOutside);
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
        getEconomicContributionsData()
            .then(data => {
                setPageData(data);
                if (data && data.length > 0) {
                    setYear(data[data.length - 1].year);
                }
            })
            .catch(err => {
                console.error("Failed to load economic contributions data:", err);
                setError(err.message || 'Failed to load data');
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    const minYear = pageData.length > 0 ? pageData[0].year : 2007;
    const maxYear = pageData.length > 0 ? pageData[pageData.length - 1].year : 2024;

    const yearsList = Array.from(
        { length: maxYear - minYear + 1 }, 
        (_, i) => minYear + i
    );

    const COLORS = {
        title: '#58585a',
        jobs: '#82734A',
        income: '#82734A',
        gdp: '#82734A',
        year: '#000000',
        border: '#8e7e52'
    };

    const currentYearData = useMemo(() => {
        return pageData.find(d => d.year === year) || pageData[pageData.length - 1];
    }, [year, pageData]);

    const formatJobs = (val) => `${(val / 1000).toFixed(1)} k`;

    const formatBillions = (val) => {
        const b = val / 1000;
        const text = getText('billion', lang);
        return lang === 'en' ? `$${b.toFixed(1)} ${text}` : `${b.toFixed(1)} $ ${text}`;
    };

    const formatJobsSR = (val) => {
        const k = (val / 1000).toFixed(1);
        return lang === 'en' ? `${k} thousand jobs` : `${k} mille emplois`;
    };

    const formatBillionsSR = (val) => {
        const b = (val / 1000).toFixed(1);
        const text = getText('billion', lang);
        return `${b} ${text} ${lang === 'en' ? 'dollars' : 'dollars'}`;
    };

    const formatNumberTable = (val) => {
        return (val / 1000).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { 
            minimumFractionDigits: 1, 
            maximumFractionDigits: 1 
        });
    };

    const formatJobsTable = (val) => {
        return (val / 1000).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { 
            minimumFractionDigits: 1, 
            maximumFractionDigits: 1 
        });
    };

    const getAccessibleDataTable = () => {
        if (!pageData || pageData.length === 0) return null;

        const captionId = 'page26-table-caption';

        return (
            <details 
                onToggle={(e) => setIsTableOpen(e.currentTarget.open)}
                style={{ 
                    marginTop: '10px', 
                    marginBottom: '10px', 
                    width: '100%', 
                    minWidth: '300px',
                    marginLeft: 0,
                    marginRight: 0,
                    fontFamily: 'Arial, sans-serif',
                    position: 'relative',
                    zIndex: 2,
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    borderRadius: '4px'
                }}
            >
                <summary 
                    role="button"
                    aria-expanded={isTableOpen}
                    style={{ 
                        cursor: 'pointer', 
                        color: '#333', 
                        fontWeight: 'bold', 
                        padding: '10px',
                        border: '1px solid #ccc',
                        backgroundColor: '#f9f9f9',
                        borderRadius: '4px',
                        listStyle: 'none'
                    }}
                >
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
                    aria-labelledby={captionId}
                    tabIndex="0"
                >
                    <table className="table table-striped table-hover">
                        <caption id={captionId} className="wb-inv">
                            {lang === 'en' 
                                ? 'Economic contributions of fuel, energy and pipeline infrastructure'
                                : 'Contributions économiques des infrastructures de carburant, d\'énergie et de pipelines'}
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd', padding: '10px' }}>{lang === 'en' ? 'Year' : 'Année'}</th>
                                <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd', padding: '10px' }}>
                                    {lang === 'en' ? 'Jobs' : 'Emplois'}<br/>
                                    <span aria-hidden="true">{lang === 'en' ? '(thousands)' : '(milliers)'}</span>
                                    <span className="wb-inv">{lang === 'en' ? '(thousands)' : '(milliers)'}</span>
                                </th>
                                <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd', padding: '10px' }}>
                                    {lang === 'en' ? 'Employment income' : 'Revenu d\'emploi'}<br/>
                                    <span aria-hidden="true">{lang === 'en' ? '($ billions)' : '(milliards $)'}</span>
                                    <span className="wb-inv">{lang === 'en' ? '(billions of dollars)' : '(milliards de dollars)'}</span>
                                </th>
                                <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd', padding: '10px' }}>
                                    {lang === 'en' ? 'GDP' : 'PIB'}<br/>
                                    <span aria-hidden="true">{lang === 'en' ? '($ billions)' : '(milliards $)'}</span>
                                    <span className="wb-inv">{lang === 'en' ? '(billions of dollars)' : '(milliards de dollars)'}</span>
                                </th>
                                <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd', padding: '10px' }}>
                                    {lang === 'en' ? 'Investment' : 'Investissement'}<br/>
                                    <span aria-hidden="true">{lang === 'en' ? '($ billions)' : '(milliards $)'}</span>
                                    <span className="wb-inv">{lang === 'en' ? '(billions of dollars)' : '(milliards de dollars)'}</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageData.map(yearData => {
                                const jobsLabel = lang === 'en' ? 'Jobs' : 'Emplois';
                                const incomeLabel = lang === 'en' ? 'Employment income' : 'Revenu d\'emploi';
                                const gdpLabel = lang === 'en' ? 'GDP' : 'PIB';
                                const investLabel = lang === 'en' ? 'Investment' : 'Investissement';
                                const jobsUnit = lang === 'en' ? ' thousand jobs' : ' mille emplois';
                                const billionUnit = lang === 'en' ? ' billion dollars' : ' milliards de dollars';

                                return (
                                    <tr key={yearData.year}>
                                        <th scope="row" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd', padding: '8px' }}>{yearData.year}</th>
                                        <td 
                                            style={{ textAlign: 'right', border: '1px solid #ddd', padding: '8px' }}
                                            aria-label={`${yearData.year}, ${jobsLabel}: ${formatJobsTable(yearData.jobs)}${jobsUnit}`}
                                        >
                                            {formatJobsTable(yearData.jobs)}
                                        </td>
                                        <td 
                                            style={{ textAlign: 'right', border: '1px solid #ddd', padding: '8px' }}
                                            aria-label={`${yearData.year}, ${incomeLabel}: ${formatNumberTable(yearData.employment_income)}${billionUnit}`}
                                        >
                                            {formatNumberTable(yearData.employment_income)}
                                        </td>
                                        <td 
                                            style={{ textAlign: 'right', border: '1px solid #ddd', padding: '8px' }}
                                            aria-label={`${yearData.year}, ${gdpLabel}: ${formatNumberTable(yearData.gdp)}${billionUnit}`}
                                        >
                                            {formatNumberTable(yearData.gdp)}
                                        </td>
                                        <td 
                                            style={{ textAlign: 'right', border: '1px solid #ddd', padding: '8px' }}
                                            aria-label={`${yearData.year}, ${investLabel}: ${formatNumberTable(yearData.investment_value)}${billionUnit}`}
                                        >
                                            {formatNumberTable(yearData.investment_value)}
                                        </td>
                                    </tr>
                                );
                            })}
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
        );
    };
    const downloadTableAsCSV = () => {
        if (!pageData || pageData.length === 0) return;
        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            lang === 'en' ? 'Jobs (thousands)' : 'Emplois (milliers)',
            lang === 'en' ? 'Employment income ($ billions)' : 'Revenu d\'emploi (milliards $)',
            lang === 'en' ? 'GDP ($ billions)' : 'PIB (milliards $)',
            lang === 'en' ? 'Investment ($ billions)' : 'Investissement (milliards $)'
        ];
        const rows = pageData.map(yearData => [
            yearData.year,
            (yearData.jobs || 0).toFixed(1),
            (yearData.employment_income || 0).toFixed(1),
            (yearData.gdp || 0).toFixed(1),
            (yearData.investment_value || 0).toFixed(1)
        ]);
        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'economic_contributions_data.csv' : 'contributions_economiques_donnees.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };
    const downloadTableAsDocx = async () => {
        if (!pageData || pageData.length === 0) return;

        const title = lang === 'en' 
            ? 'Economic contributions of fuel, energy and pipeline infrastructure'
            : 'Contributions économiques des infrastructures de carburant, d\'énergie et de pipelines';

        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            lang === 'en' ? 'Jobs (thousands)' : 'Emplois (milliers)',
            lang === 'en' ? 'Employment income ($ billions)' : 'Revenu d\'emploi (milliards $)',
            lang === 'en' ? 'GDP ($ billions)' : 'PIB (milliards $)',
            lang === 'en' ? 'Investment ($ billions)' : 'Investissement (milliards $)'
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

        const dataRows = pageData.map(yearData => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(yearData.year), size: 22 })], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (yearData.jobs || 0).toFixed(1), size: 22 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (yearData.employment_income || 0).toFixed(1), size: 22 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (yearData.gdp || 0).toFixed(1), size: 22 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (yearData.investment_value || 0).toFixed(1), size: 22 })], alignment: AlignmentType.RIGHT })] })
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
                        columnWidths: [1400, 1900, 1900, 1900, 1900],
                        rows: [headerRow, ...dataRows]
                    })
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'economic_contributions_table.docx' : 'contributions_economiques_tableau.docx');
    };

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
    }

    if (error) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'red' }}>Error: {error}. Please refresh the page.</div>;
    }

    if (!currentYearData || year === null) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>No data available. Please refresh the page.</div>;
    }

    const investmentValue = currentYearData.investment_value;

    const getTitleText = () => {
        return getText('page26_title', lang);
    };

    const getSliderText = () => {
        if (lang === 'en') {
            return `${getText('year_slider_label', lang)} ${year}. Use arrow keys to change year from ${minYear} to ${maxYear}.`;
        } else {
            return `${getText('year_slider_label', lang)} ${year}. Utilisez les touches fléchées pour changer l'année de ${minYear} à ${maxYear}.`;
        }
    };

    const getStatsSummary = () => {
        const jobsText = formatJobsSR(currentYearData.jobs);
        const incomeText = formatBillionsSR(currentYearData.employment_income);
        const gdpText = formatBillionsSR(currentYearData.gdp);

        if (lang === 'en') {
            return `Economic contributions in ${year}. Fuel, energy and pipeline infrastructure supported ${jobsText}, generated ${incomeText} in employment income, and ${gdpText} in GDP. These are direct and indirect contributions.`;
        } else {
            return `Contributions économiques en ${year}. Les infrastructures de carburant, d'énergie et de pipelines ont soutenu ${jobsText}, ont généré ${incomeText} en revenus d'emploi, et ${gdpText} en PIB. Ce sont des contributions directes et indirectes.`;
        }
    };

    const getFooterText = () => {
        const investmentText = formatBillionsSR(investmentValue);
        if (lang === 'en') {
            return `Public and private investment in fuel, energy and pipeline infrastructure in ${year} was ${investmentText} nominal.`;
        } else {
            return `L'investissement public et privé dans les infrastructures de carburant, d'énergie et de pipelines en ${year} était de ${investmentText} nominal.`;
        }
    };

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-26" 
            role="main"
            aria-label={getTitleText()}
            style={{
                backgroundColor: 'white',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',
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

                .page-26 {
                    margin-left: -${layoutPadding?.left || 55}px;
                    width: calc(100% + ${layoutPadding?.left || 55}px);
                    padding-left: ${layoutPadding?.left || 55}px; 
                }

                .page26-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 41px;
                    font-weight: bold;
                    color: #58585a;
                    margin-bottom: 10px;
                    margin-top: 0px;
                    position: relative;
                    padding-bottom: 0.5em;
                }

                .page26-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }

                .page26-body-text {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    max-width: 65ch;
                }

                .page26-bg-image {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    left: -${layoutPadding?.left || 55}px;
                    width: calc(100% + ${layoutPadding?.left || 55}px + 15px);
                    background-size: cover;
                    background-position: center center;
                    background-repeat: no-repeat;
                    z-index: 0;
                }

                .page26-year-selector {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                    padding: 10px 0;
                }

                .page26-year-label {
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
                    font-size: 18px;
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

                .page26-container {
                    width: 100%;
                    min-height: calc(100vh - 300px);
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                }

                .page26-slider-track {
                    flex: 1;
                }

                .page26-content {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    min-height: 450px;
                    width: 100%;
                }

                .page26-stats-row {
                    position: relative;
                    z-index: 1;
                    display: flex;
                    flex-direction: row;
                    justify-content: space-between;
                    margin-top: 10px;
                    padding: 0;
                }

                .page26-stat-col {
                    flex: none;
                    width: fit-content;
                    background: rgba(255, 255, 255, 0.95);
                    padding: 12px 16px;
                    border-radius: 6px;
                }

                .page26-stat-col-1 { margin-left: 0; }
                .page26-stat-col-2 { margin-left: 360px; }
                .page26-stat-col-3 { margin-left: 360px; }

                .page26-stat-value {
                    font-family: 'Lato', sans-serif;
                    font-size: 36px;
                    font-weight: bold;
                    line-height: 1;
                }

                .page26-stat-label {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                }

                @media (max-width: 1800px) {
                    .page26-container {
                        height: auto;
                    }

                    .page26-stats-row {
                        flex-direction: column;
                        gap: 30px;
                    }

                    .page26-stat-col {
                        margin-left: 0 !important;
                        padding: 12px 16px;
                        background: rgba(255, 255, 255, 0.95);
                        border-radius: 6px;
                        width: fit-content;
                    }

                    .page26-stat-value {
                        font-size: 28px;
                    }

                    .page26-stat-label {
                        font-size: 16px;
                    }
                }

                @media (max-width: 1280px) {
                    .page-26 {
                        border-left: none !important;
                    }
                }            

                @media (max-width: 1097px) {
                    .page26-bg-image {
                        background-size: cover !important;
                        background-position: center !important;
                    }
                }

                @media (max-width: 768px) {
                    .page26-title {
                        font-size: 37px;
                    }

                    .page26-body-text {
                        font-size: 18px;
                    }

                    .page26-year-label {
                        font-size: 18px;
                    }

                    .page26-stat-label {
                        font-size: 18px;
                    }

                    .page26-year-ticks { display: none !important; }

                    .page26-bg-image {
                        left: -15px;
                        width: calc(100% + 30px);
                        background-size: cover !important;
                        background-position: center !important;
                    }

                    .page26-slider-region {
                        flex-direction: column !important;
                        align-items: stretch !important;
                    }

                    .page26-slider-label {
                        white-space: normal !important;
                        margin-bottom: 10px;
                        margin-right: 0 !important;
                    }
                }

                @media (max-width: 480px) {
                    .page26-bg-image {
                        left: -15px;
                        width: calc(100% + 30px);
                        background-size: cover !important;
                        background-position: center !important;
                    }

                    .page26-stat-value {
                        font-size: 20px !important;
                    }

                    .page26-stat-label {
                        font-size: 14px !important;
                    }

                    .page26-container h1 {
                        font-size: 1.5rem !important;
                    }

                    .page26-content {
                        display: block !important;
                        min-height: auto !important;
                    }

                    .page26-data-table-wrapper {
                        margin-top: 20px !important;
                    }
                }

                details summary::-webkit-details-marker,
                details summary::marker {
                    display: none;
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

                /* FIXED: Grid layout with minmax(0, 1fr) forces scrollbar to appear */
                .page26-table-wrapper {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr);
                    width: 100%;
                }

                /* Table horizontal scroll */
                .table-responsive {
                    display: block;
                    width: 100%;
                    overflow-x: auto !important;
                    -webkit-overflow-scrolling: touch;
                    border: 1px solid #ddd;
                    background: #fff;
                }

                .table-responsive table {
                    width: max-content !important;
                    min-width: 100%;
                    border-collapse: collapse;
                }
            `}</style>

            <div className="page26-container">
                <header 
                    role="region"
                    aria-label={getTitleText()}
                    style={{ flexShrink: 0, padding: '15px 0px 0 0px'}}
                >
                    <h1 className="page26-title" aria-hidden="true">
                        {getText('page26_title', lang)}
                    </h1>
                    <div className="page26-year-selector" ref={dropdownRef}>
                        <label id="year-label-26" className="page26-year-label" aria-hidden="true">
                            {getText('year_slider_label', lang)}
                        </label>
                        <div id="year-instructions-26" className="wb-inv">
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
                                aria-label={`${getText('year_slider_label', lang)} ${year || '...'}`}
                                aria-describedby="year-instructions-26"
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
                                    aria-activedescendant={focusedYear ? `year-option-26-${focusedYear}` : undefined}
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
                                            id={`year-option-26-${y}`}
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
                </header>

                <div className="page26-content">
                    <div 
                        className="page26-bg-image" 
                        aria-hidden="true" 
                        style={{ backgroundImage: `url(${page26BgImage})` }}
                    />

                    <section 
                        className="page26-stats-row"
                        role="region"
                        aria-label={getStatsSummary()}
                    >
                        <div className="page26-stat-col page26-stat-col-1" aria-hidden="true">
                            <div className="page26-stat-label" style={{ fontWeight: 'bold', color: '#333' }}>{getText('page26_supported', lang)}</div>
                            <div className="page26-stat-value" style={{ color: COLORS.jobs }}>
                                {formatJobs(currentYearData.jobs)}
                            </div>
                            <div className="page26-stat-label" style={{ color: '#666' }}>{getText('page26_jobs', lang)}</div>
                        </div>

                        <div className="page26-stat-col page26-stat-col-2" aria-hidden="true">
                            <div className="page26-stat-label" style={{ fontWeight: 'bold', color: '#333' }}>{getText('page26_generated', lang)}</div>
                            <div className="page26-stat-value" style={{ color: COLORS.income }}>
                                {formatBillions(currentYearData.employment_income)}
                            </div>
                            <div className="page26-stat-label" style={{ color: '#333' }}>{getText('page26_in_employment_income', lang)}</div>
                        </div>

                        <div className="page26-stat-col page26-stat-col-3" aria-hidden="true">
                            <div className="page26-stat-label" style={{ fontWeight: 'bold', color: '#333' }}>{getText('page26_and', lang)}</div>
                            <div className="page26-stat-value" style={{ color: COLORS.gdp }}>
                                {formatBillions(currentYearData.gdp)}
                            </div>
                            <div style={{ fontSize: '30px', fontWeight: 'bold', color: '#666', lineHeight: '1' }}>{getText('page26_in_gdp', lang)}</div>
                            <div style={{ fontSize: '18px', color: '#333', marginTop: '5px' }}>
                                {getText('page26_in_year', lang)} <span style={{fontWeight: 'bold'}}>{year}</span>
                            </div>
                            <div style={{ fontSize: '14px', color: '#666', fontStyle: 'italic', marginTop: '5px' }}>
                                {getText('page26_contributions', lang)}
                            </div>
                        </div>
                    </section>
                </div>

                <div className="page26-data-table-wrapper" style={{ 
                    position: 'relative', 
                    zIndex: 2, 
                    marginTop: '20px',
                    marginBottom: '20px'
                }}>
                    <div className="page26-table-wrapper">
                        {getAccessibleDataTable()}
                    </div>
                </div>

                <footer 
                    role="region"
                    aria-label={getFooterText()}
                    style={{ 
                        position: 'relative',
                        zIndex: 1,
                        padding: '10px 0px',
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        marginBottom: '0px',
                        marginTop: '0px'
                    }}
                >
                    <p className="page26-body-text" aria-hidden="true" style={{ margin: '0', color: '#555' }}>
                        <span>{getText('page26_footer_part1', lang)}</span>
                        <span style={{ fontWeight: 'bold' }}> {year} </span>
                        <span>{getText('page26_footer_part2', lang)} </span>
                        <span style={{ color: '#544B30', fontWeight: 'bold', fontSize: '20px' }}>
                            {formatBillions(investmentValue)}
                        </span>
                        <span> {getText('page26_footer_part3', lang)}</span>
                    </p>
                </footer>
            </div>
        </main>
    );
};

export default Page26;
